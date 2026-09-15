import React from 'react';
import { grauPorN } from '../lib/graus';

/* ============================================================
   A PONTEIRA

   Os quatro graus da técnica, desenhados igual à ponteira da
   faixa. Vive sozinha aqui porque várias telas usam, e página
   importando página cria ciclo de importação.
   ============================================================ */

export function Ponteira({ n = 0, mini = false, vertical = false }) {
  const g = grauPorN(n);
  const tam = mini ? 5 : 7;
  return (
    <span className="ponteira" style={{ flexDirection: vertical ? 'column' : 'row' }}>
      {[1, 2, 3, 4].map((i) => (
        <i key={i} style={{
          width: tam, height: tam,
          background: i <= n ? `var(--${g.cor})` : 'var(--seam-hi)',
          boxShadow: i <= n ? `0 0 6px -1px var(--${g.cor})` : 'none',
        }} />
      ))}
    </span>
  );
}

export default Ponteira;
