import React, { useEffect, useState } from 'react';
import { Gem, Check } from 'lucide-react';
import { useApp } from '../contexto';
import { Sheet, Btn, useToast } from './UI';
import { getMeta, setMeta } from '../db/db';
import { RECURSOS, diasParaVencer, usarCodigoGuardado } from '../lib/plano';
import { abrirLink } from '../lib/links';
import { hoje } from '../lib/utils';

/* ============================================================
   RENOVAÇÃO

   Duas coisas que rodam em volta do app, sem tela própria:

   1. O link do WhatsApp (?ativar=CODIGO) de quem comprou com outro
      e-mail: assim que tem conta aberta, libera sozinho.

   2. O aviso de renovar, no máximo um por dia, só quando o Premium
      vai acabar de verdade: a renovação foi cancelada e faltam 7
      dias ou menos, o pagamento da renovação não entrou, ou acabou
      há menos de uma semana. Quem renova sozinho nunca vê.
   ============================================================ */
export const HOTMART_MINHAS_COMPRAS = 'https://consumer.hotmart.com/';

export function motivoDeRenovar(acesso) {
  if (!acesso) return null;
  const dias = diasParaVencer(acesso);
  if (acesso.premium && acesso.status === 'carencia') return { tipo: 'pagamento', dias };
  if (acesso.premium && acesso.renova === false && dias !== null && dias <= 7) return { tipo: 'acaba', dias };
  if (!acesso.premium && ['expirada', 'cancelada'].includes(acesso.status) && dias !== null && dias >= -7 && dias < 0) {
    return { tipo: 'acabou', dias };
  }
  return null;
}

/* o que volta a travar sem o Premium, pra pessoa saber o que perde */
const PERDE = Object.values(RECURSOS).filter((r) => r.premium).slice(0, 5).map((r) => r.nome);

const quando = (dias) => (dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`);

export default function Renovacao() {
  const { acesso, sessao, ligada, recarregarAcesso, irPara, verComo } = useApp();
  const toast = useToast();
  const [aberto, setAberto] = useState(null);

  /* 1. o código do link, assim que tem conta */
  useEffect(() => {
    if (!sessao) return;
    usarCodigoGuardado().then((r) => {
      if (!r) return;
      toast(r.ok ? 'Premium liberado na sua conta 🥋' : r.mensagem, r.ok ? '' : 'err');
      if (r.ok) recarregarAcesso();
    }).catch(() => {});
  }, [sessao]);

  /* 2. o aviso de renovar, uma vez por dia */
  const motivo = ligada('cobranca') && !verComo ? motivoDeRenovar(acesso) : null;
  useEffect(() => {
    if (!motivo) return undefined;
    let vivo = true;
    const chave = `renovar:${motivo.tipo}`;
    getMeta('aviso_renovar', null).then((v) => {
      if (!vivo || (v?.dia === hoje() && v?.chave === chave)) return;
      setAberto(motivo);
      setMeta('aviso_renovar', { dia: hoje(), chave });
    });
    return () => { vivo = false; };
  }, [motivo?.tipo]);

  if (!aberto) return null;
  const pagamento = aberto.tipo === 'pagamento';
  const titulo = pagamento
    ? 'O pagamento da renovação não entrou'
    : aberto.tipo === 'acaba'
      ? `Seu Premium acaba ${quando(aberto.dias)}`
      : 'Seu Premium acabou';
  const texto = pagamento
    ? 'A Hotmart não conseguiu cobrar. O Premium continua ligado por uns dias enquanto você atualiza o cartão ou a forma de pagamento.'
    : aberto.tipo === 'acaba'
      ? 'A renovação está desligada. Sem renovar, estas partes voltam a travar:'
      : 'Estas partes voltaram a travar. Renovando, abrem de novo na hora:';

  return (
    <Sheet aberto onClose={() => setAberto(null)} titulo="">
      <div className="convite">
        <span className="convite-ico"><Gem size={22} /></span>
        <h2 className="convite-titulo">{titulo}</h2>
        <p className="tiny muted" style={{ lineHeight: 1.6 }}>{texto}</p>
        {!pagamento && (
          <ul className="vitrine-lista" style={{ marginTop: 0 }}>
            {PERDE.map((x) => <li key={x}><Check size={15} /> {x}</li>)}
          </ul>
        )}
        <p className="micro muted" style={{ lineHeight: 1.6 }}>
          Seus treinos, rolas e tudo que você registrou continuam seus, com ou sem Premium.
        </p>
        <Btn variant="primary" style={{ width: '100%' }} onClick={() => {
          setAberto(null);
          if (pagamento) window.open(HOTMART_MINHAS_COMPRAS, '_blank', 'noopener');
          else abrirLink('assinatura_mensal');
        }}>
          {pagamento ? 'Atualizar o pagamento' : 'Renovar o Premium'}
        </Btn>
        <Btn variant="ghost" style={{ width: '100%' }} onClick={() => { setAberto(null); irPara('ajustes'); }}>
          Ver minha assinatura
        </Btn>
      </div>
    </Sheet>
  );
}
