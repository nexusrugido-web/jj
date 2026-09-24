import React, { useEffect, useState, useCallback } from 'react';
import { UserPlus, Users, Check, X, Flame, Send } from 'lucide-react';
import { useApp } from '../contexto';
import { Card, Btn, Chip, useToast } from './UI';
import Avatar from './Avatar';
import {
  meusAmigos, meusConvitesDeSala, meuPar, pedirAmizade, responderAmizade, chamarPraSala, recusarConviteDeSala,
} from '../lib/amigos';
import { entrarNaSala, minhaSala } from '../lib/sala';
import { hoje, addDias, emQuanto } from '../lib/utils';
import { inicioSemana } from '../lib/stats';

/* ============================================================
   AMIGOS NA LIGA

   Em ordem de urgência: convite pra sala de um amigo, pedido de
   amizade esperando você, a sugestão da semana (alguém do seu
   ritmo), e os seus amigos com os pontos da semana, cada um com
   o botão de chamar pra sua sala.
   ============================================================ */
export default function Amigos({ onMudou }) {
  const { sessao, ligada } = useApp();
  const toast = useToast();
  const [dados, setDados] = useState(null);
  const [indo, setIndo] = useState(null);

  const ativa = ligada?.('liga');

  const buscar = useCallback(async () => {
    if (!sessao) return;
    try {
      const [amigos, convites, par, sala] = await Promise.all([
        meusAmigos(), meusConvitesDeSala(), meuPar().catch(() => null), minhaSala().catch(() => []),
      ]);
      setDados({ amigos, convites, par, temSala: sala.length > 0, salaCheia: sala.length >= 5 });
    } catch {
      setDados({ amigos: [], convites: [], par: null, temSala: false, salaCheia: false });
    }
  }, [sessao]);

  useEffect(() => { if (ativa) buscar(); }, [ativa, buscar]);

  if (!ativa || !sessao || !dados) return null;

  /* cada botão mostra que está indo e recarrega a lista no fim */
  const fazer = async (chave, acao, { mudouSala = false } = {}) => {
    setIndo(chave);
    try {
      const r = await acao();
      if (r?.mensagem) toast(r.mensagem, r.ok === false ? 'err' : '');
      await buscar();
      if (mudouSala) onMudou?.();
    } catch {
      toast('Não deu agora. Tenta de novo.', 'err');
    }
    setIndo(null);
  };

  const { amigos, convites, par, temSala, salaCheia } = dados;
  const recebidos = amigos.filter((a) => a.status === 'recebido');
  const deVerdade = amigos.filter((a) => a.status === 'amigo');
  const enviados = amigos.filter((a) => a.status === 'enviado');
  const sugestao = par?.rival_id && !par.amizade && !amigos.some((a) => a.user_id === par.rival_id) ? par : null;

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">quem treina com você</div>
          <h2 className="h-sec row" style={{ gap: 8 }}><Users size={16} /> Amigos</h2>
        </div>
        {deVerdade.length > 0 && <span className="micro muted">pontos da semana</span>}
      </div>

      <div className="col" style={{ gap: 8 }}>
        {convites.map((c) => (
          <div key={c.codigo} className="amigo-aviso">
            <Avatar nome={c.quem_chamou} foto={c.foto} className="liga-avatar" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tiny" style={{ fontWeight: 600 }}>{c.quem_chamou} te chamou pra sala</div>
              <div className="micro muted">{c.pessoas} de 5 · começa {emQuanto(addDias(inicioSemana(hoje()), 7))}</div>
            </div>
            <Btn size="sm" variant="primary" disabled={indo === c.codigo}
              onClick={() => fazer(c.codigo, () => entrarNaSala(c.codigo), { mudouSala: true })}>Entrar</Btn>
            <button type="button" className="btn ghost icon sm" aria-label="Agora não"
              onClick={() => fazer(c.codigo, () => recusarConviteDeSala(c.codigo))}><X size={14} /></button>
          </div>
        ))}

        {recebidos.map((a) => (
          <div key={a.user_id} className="amigo-aviso">
            <Avatar nome={a.nome} foto={a.foto} className="liga-avatar" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tiny" style={{ fontWeight: 600 }}>{a.nome} quer ser seu amigo</div>
            </div>
            <Btn size="sm" variant="primary" icon={Check} disabled={indo === a.user_id}
              onClick={() => fazer(a.user_id, async () => { await responderAmizade(a.user_id, true); return { mensagem: 'Agora vocês são amigos.' }; })}>Aceitar</Btn>
            <button type="button" className="btn ghost icon sm" aria-label="Recusar"
              onClick={() => fazer(a.user_id, () => responderAmizade(a.user_id, false))}><X size={14} /></button>
          </div>
        ))}

        {sugestao && (
          <div className="amigo-aviso sugestao">
            <Avatar nome={sugestao.rival_nome} foto={sugestao.rival_foto} className="liga-avatar" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tiny" style={{ fontWeight: 600 }}>{sugestao.rival_nome}</div>
              <div className="micro muted">
                {sugestao.rival_ritmo ? `Treina ${sugestao.rival_ritmo}x por semana, como você.` : 'Treina no seu ritmo.'}
              </div>
            </div>
            <Btn size="sm" icon={UserPlus} disabled={indo === sugestao.rival_id}
              onClick={() => fazer(sugestao.rival_id, () => pedirAmizade(sugestao.rival_id))}>Adicionar</Btn>
          </div>
        )}

        {deVerdade.map((a, i) => (
          <div key={a.user_id} className="liga-linha">
            <span className="liga-pos num">{i + 1}</span>
            <Avatar nome={a.nome} foto={a.foto} className="liga-avatar" />
            <span className="tiny liga-nome">{a.nome}</span>
            {a.sequencia > 0 && (
              <span className="micro num row" style={{ gap: 3, color: 'var(--roar)' }} title="dias de ofensiva">
                <Flame size={12} /> {a.sequencia}
              </span>
            )}
            {a.na_sala ? <Chip tone="jade">na sala</Chip>
              : a.chamado ? <Chip>chamado</Chip>
                : temSala && !salaCheia && (
                  <button type="button" className="btn ghost xs" disabled={indo === a.user_id}
                    onClick={() => fazer(a.user_id, () => chamarPraSala(a.user_id))}>
                    <Send size={12} /> Chamar
                  </button>
                )}
            <span className="num micro" style={{ minWidth: 30, textAlign: 'right' }}>{a.xp_semana}</span>
          </div>
        ))}

        {enviados.map((a) => (
          <div key={a.user_id} className="liga-linha" style={{ opacity: 0.6 }}>
            <Avatar nome={a.nome} foto={a.foto} className="liga-avatar" />
            <span className="tiny liga-nome">{a.nome}</span>
            <span className="micro muted">pedido enviado</span>
          </div>
        ))}
      </div>

      {!deVerdade.length && !recebidos.length && !convites.length && (
        <p className="micro muted" style={{ marginTop: sugestao || enviados.length ? 10 : 0, lineHeight: 1.6 }}>
          Toque no nome de alguém do seu grupo da liga pra adicionar como amigo. Amigo vê os seus pontos da semana,
          e dá pra chamar ele direto pra sua sala.
        </p>
      )}
      {deVerdade.length > 0 && !temSala && (
        <p className="micro muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
          Crie uma sala aqui embaixo pra correr a liga com eles.
        </p>
      )}
    </Card>
  );
}
