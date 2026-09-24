import React, { useMemo } from 'react';
import { Check, Circle, Heart } from 'lucide-react';
import { Card, Btn, Bar } from './UI';
import { estadoDeAtivacao, estadoDeAusencia } from '../lib/retencao';

/* ============================================================
   PRIMEIROS PASSOS

   Some sozinho quando a pessoa chega no terceiro treino, que é
   quando o app já tem dado pra mostrar algo de verdade.
   ============================================================ */

export function PrimeirosPassos({ sessions, rolls, tecnicas, irPara }) {
  const a = useMemo(() => estadoDeAtivacao(sessions, rolls, tecnicas), [sessions, rolls, tecnicas]);
  if (a.ativado && a.feitos === a.total) return null;
  if (a.ativado) return null;

  return (
    <Card className="accent" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">{a.feitos} de {a.total}</div>
          <h2 className="h-sec">Primeiros passos</h2>
        </div>
      </div>

      <Bar v={a.feitos} max={a.total} />

      <div className="col" style={{ gap: 10, marginTop: 16 }}>
        {a.passos.map((p) => (
          <div key={p.id} className="row" style={{ gap: 11, alignItems: 'flex-start', opacity: p.feito ? 0.5 : 1 }}>
            <span className={`passo-marca ${p.feito ? 'feito' : ''}`}>
              {p.feito ? <Check size={12} strokeWidth={3} /> : <Circle size={9} />}
            </span>
            <div style={{ flex: 1 }}>
              <div className="tiny" style={{ fontWeight: 600, textDecoration: p.feito ? 'line-through' : 'none' }}>
                {p.nome}
              </div>
              {!p.feito && <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.6 }}>{p.dica}</p>}
            </div>
          </div>
        ))}
      </div>

      {a.proximo && (
        <Btn variant="primary" onClick={() => irPara('treinos', { novo: 1 })} style={{ marginTop: 16 }}>
          {a.proximo.id === 'primeiro' ? 'Registrar o primeiro treino' : 'Registrar treino'}
        </Btn>
      )}

      <p className="micro muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
        Com três treinos anotados o app já consegue mostrar onde está o buraco do seu jogo e o que treinar em
        seguida. Antes disso ele ainda está no escuro.
      </p>
    </Card>
  );
}

/* ============================================================
   QUEM VOLTOU DEPOIS DE UM TEMPO
   ============================================================ */
export function AvisoDeVolta({ sessions, irPara, onDispensar }) {
  const a = useMemo(() => estadoDeAusencia(sessions), [sessions]);
  if (!a.sumiu) return null;

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <span className="stat-ico"><Heart size={16} /></span>
        <div style={{ flex: 1 }}>
          <div className="h-sec">{a.titulo}</div>
          <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.7 }}>{a.texto}</p>
          <div className="row wrap" style={{ gap: 8, marginTop: 13 }}>
            <Btn size="sm" variant="primary" onClick={() => irPara('treinos', { novo: 1 })}>{a.acao}</Btn>
            {onDispensar && <Btn size="sm" variant="ghost" onClick={onDispensar}>Fechar</Btn>}
          </div>
        </div>
      </div>
    </Card>
  );
}
