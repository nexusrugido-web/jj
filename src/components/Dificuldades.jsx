import React from 'react';
import { DIFICULDADES } from '../lib/necessidades';

/* ============================================================
   O QUE MAIS TE TRAVA HOJE

   A mesma pergunta do formulário de entrada dos alunos, agora
   dentro do app. Até três, porque quem marca tudo não diz nada.
   O que a pessoa marca vira pedido pro motor de recomendação.
   ============================================================ */
export const MAX_DIFICULDADES = 3;

export function EscolherDificuldades({ valor = [], onChange }) {
  const cheio = valor.length >= MAX_DIFICULDADES;
  return (
    <div className="row wrap" style={{ gap: 7 }}>
      {DIFICULDADES.map((d) => {
        const on = valor.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            className={`chip ${on ? 'on' : ''}`}
            style={{ minHeight: 38, paddingInline: 13, opacity: !on && cheio ? 0.45 : 1 }}
            disabled={!on && cheio}
            onClick={() => onChange(on ? valor.filter((x) => x !== d.id) : [...valor, d.id])}
          >
            {d.nome}
          </button>
        );
      })}
    </div>
  );
}
