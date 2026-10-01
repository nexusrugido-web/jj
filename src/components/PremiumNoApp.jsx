import React, { useEffect, useRef, useState } from 'react';
import { Gem, Check } from 'lucide-react';
import { useApp } from '../contexto';
import { Sheet, Btn } from './UI';
import { OfertaPremium } from './Plano';
import { marcarFunil, ganharPresente, PRESENTE_NO_TREINO } from '../lib/plano';
import { fmtData } from '../lib/utils';

/* ============================================================
   O PREMIUM DENTRO DO APP

   Roda em volta do app, sem tela própria:

   1. A oferta: qualquer botão de assinar chama pedirOferta() e a
      folha abre aqui, com o recurso que a pessoa tocou em cima.
   2. Liberar na hora: quem tocou em Assinar foi pra Hotmart. Por meia
      hora, toda volta pro app (e a cada 20 s com ele aberto) confere
      de novo o acesso. Antes só conferia ao abrir, e quem pagava
      continuava travado.
   3. A comemoração: virou Premium (pagou ou ganhou o presente), a
      folha mostra o que abriu e por onde começar.
   4. O presente: no primeiro treino registrado, 7 dias de Premium,
      uma vez por conta (ganhar_presente, SQL 41). E os passos do
      funil de ativação (1º e 3º treino).
   ============================================================ */
const EXPERIMENTA = [
  'A Análise: como você vence e onde fica por baixo',
  'O que treinar agora, escolhido pelos seus rolas',
  'Registrar o próximo treino falando',
  'Meu jogo contra mais pesado, mais leve e em cada posição',
];

const lido = (k) => { try { return !!localStorage.getItem(k); } catch { return true; } };
const gravar = (k) => { try { localStorage.setItem(k, '1'); } catch { /* sem armazenamento, pede de novo */ } };

export default function PremiumNoApp() {
  const { acesso, sessao, sessions, recarregarAcesso, ligada, verComo } = useApp();
  const [oferta, setOferta] = useState(null);
  const [festa, setFesta] = useState(null);
  const assinando = useRef(0);
  const recarregar = useRef(recarregarAcesso);
  recarregar.current = recarregarAcesso;

  /* 1. a oferta */
  useEffect(() => {
    const abrir = (e) => {
      const recurso = e.detail?.recurso || null;
      setOferta({ recurso });
      marcarFunil('oferta_vista', recurso || 'geral');
    };
    window.addEventListener('abrir-oferta', abrir);
    return () => window.removeEventListener('abrir-oferta', abrir);
  }, []);

  /* 2. liberar na hora */
  useEffect(() => {
    const conferir = () => {
      if (document.visibilityState === 'visible' && Date.now() - assinando.current < 30 * 60 * 1000) recarregar.current?.();
    };
    document.addEventListener('visibilitychange', conferir);
    const t = setInterval(conferir, 20000);
    return () => { document.removeEventListener('visibilitychange', conferir); clearInterval(t); };
  }, []);

  /* 3. virou Premium agora */
  const antes = useRef(null);
  useEffect(() => {
    if (!acesso || acesso.status === 'checando' || verComo) return;
    const era = antes.current;
    antes.current = !!acesso.premium;
    if (era === false && acesso.premium) {
      setFesta(acesso.status === 'presente' ? 'presente' : 'liberou');
      if (acesso.status !== 'presente') marcarFunil('liberou');
      assinando.current = 0;
    }
  }, [acesso?.premium, acesso?.status, verComo]);

  /* 4. o presente e a ativação: só conta o treino que entra com o app
     aberto (quem já tinha treinos não vira "primeiro treino" de novo) */
  const qtd = useRef(null);
  const n = sessions?.length || 0;
  useEffect(() => {
    if (!ligada('cobranca') || !sessao) return;
    const eraN = qtd.current;
    qtd.current = n;
    if (eraN !== null) {
      if (eraN < 1 && n >= 1) marcarFunil('primeiro_treino');
      if (eraN < 3 && n >= 3) marcarFunil('terceiro_treino');
    }
    if (n >= PRESENTE_NO_TREINO && acesso?.status === 'sem_assinatura' && !lido('presente:pedido')) {
      gravar('presente:pedido');
      ganharPresente().then((r) => { if (r?.ganhou) recarregar.current?.(); }).catch(() => {});
    }
  }, [n, sessao, acesso?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Sheet aberto={!!oferta} onClose={() => setOferta(null)} titulo="">
        {oferta && (
          <OfertaPremium
            recurso={oferta.recurso}
            onAssinar={() => { assinando.current = Date.now(); setOferta(null); }}
          />
        )}
      </Sheet>

      <Sheet aberto={!!festa} onClose={() => setFesta(null)} titulo="">
        {festa && (
          <div className="convite">
            <span className="convite-ico"><Gem size={22} /></span>
            <h2 className="convite-titulo">{festa === 'presente' ? 'Você ganhou 7 dias de Premium 🎁' : 'Premium liberado 🥋'}</h2>
            <p className="tiny muted" style={{ lineHeight: 1.6 }}>
              {festa === 'presente'
                ? `Seu primeiro treino tá registrado. Até ${fmtData(String(acesso?.venceEm || '').slice(0, 10))}, tudo liberado. Experimenta:`
                : 'Valeu por assinar. Tudo aberto agora. Por onde começar:'}
            </p>
            <ul className="vitrine-lista" style={{ marginTop: 0 }}>
              {EXPERIMENTA.map((x) => <li key={x}><Check size={15} /> {x}</li>)}
            </ul>
            <Btn variant="primary" onClick={() => setFesta(null)} style={{ width: '100%' }}>Bora</Btn>
          </div>
        )}
      </Sheet>
    </>
  );
}
