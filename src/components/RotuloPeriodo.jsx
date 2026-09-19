import React from 'react';

/* ============================================================
   DE QUANDO É ESTE NÚMERO

   O selinho em cima de todo bloco que depende de tempo. Recebe o
   mesmo objeto de período que filtrou os dados (periodoDeDados),
   então o que está escrito é o que foi contado.
   ============================================================ */
export default function RotuloPeriodo({ periodo, children }) {
  return (
    <div className="eyebrow">
      {children ? `${children} · ` : ''}{periodo.rotulo.toLowerCase()}
    </div>
  );
}
