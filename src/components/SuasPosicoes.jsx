import React, { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { Card, Chip, Btn } from './UI';
import { repertorioPorPosicao } from '../lib/posicoes';

/* ============================================================
   SUAS POSIÇÕES (Meu jogo)

   De onde sai o seu jogo: em cada posição, quantas técnicas
   diferentes já entraram em rola e quantas vezes. Grátis vê o
   número e a dica da posição com uma saída só; o Premium vê quais
   técnicas e quanto cada uma entra.
   ============================================================ */
export default function SuasPosicoes({ rolls, sessions, techniques, categories, positions, completo, onAssinar }) {
  const lista = useMemo(
    () => repertorioPorPosicao({ rolls, sessions, techniques, categories, positions }).slice(0, 5),
    [rolls, sessions, techniques, categories, positions],
  );
  if (!lista.length) return null;
  const maior = lista[0].usos;
  /* uma saída só, usada bastante: quem lê ela te trava */
  const unica = lista.find((p) => p.tecnicas.length === 1 && p.usos >= 3);

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">de onde sai o seu jogo</div>
          <h2 className="h-sec">Suas posições</h2>
        </div>
      </div>
      <div className="col" style={{ gap: 14 }}>
        {lista.map((p) => (
          <div key={p.slug} className="col" style={{ gap: 5 }}>
            <div className="row tiny" style={{ gap: 8 }}>
              <span style={{ flex: 1, fontWeight: 600 }}>{p.nome}</span>
              <span className="num micro muted">
                {p.tecnicas.length} {p.tecnicas.length === 1 ? 'técnica' : 'técnicas'} · {p.usos}x
              </span>
            </div>
            <div className="bar thin jade"><i style={{ width: `${Math.round((p.usos / maior) * 100)}%` }} /></div>
            {completo && (
              <div className="row wrap" style={{ gap: 5, marginTop: 3 }}>
                {p.tecnicas.map((t) => <Chip key={t.nome}>{t.nome} <b className="num">×{t.usos}</b></Chip>)}
              </div>
            )}
          </div>
        ))}
        {unica && (
          <p className="micro" style={{ lineHeight: 1.6 }}>
            Da <b>{unica.nome}</b> você só tem 1 saída que entra no rola. Quem lê ela te trava: vale abrir a segunda.
          </p>
        )}
        {!completo && (
          <Btn variant="contorno" icon={Lock} onClick={onAssinar} style={{ width: '100%' }}>
            Ver quais técnicas entram em cada posição
          </Btn>
        )}
      </div>
    </Card>
  );
}
