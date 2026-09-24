import React from 'react';
import { FAIXAS } from '../db/seed';

/* ============================================================
   A FAIXA DE VERDADE

   A cor da faixa com a ponteira e as listras dos graus, igual à
   que o aluno amarra na cintura. Quem gradua é o professor: aqui
   só aparece o que o aluno registrou, sem previsão de quando vem
   o próximo grau.
   ============================================================ */
export default function FaixaVisual({ faixa = 'branca', graus = 0 }) {
  const f = FAIXAS.find((x) => x.id === faixa) || FAIXAS[0];
  const n = Math.min(4, Math.max(0, Number(graus) || 0));
  return (
    <div className={`faixa-vis ${faixa}`} style={{ '--cor': f.cor }} role="img" aria-label={`Faixa ${f.nome.toLowerCase()}, ${n} ${n === 1 ? 'grau' : 'graus'}`}>
      <span className="faixa-vis-ponta">
        {Array.from({ length: n }).map((_, i) => <i key={i} />)}
      </span>
    </div>
  );
}
