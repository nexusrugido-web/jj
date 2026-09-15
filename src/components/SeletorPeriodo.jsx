import React, { useState } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';
import { Sheet, Chip } from './UI';
import { PERIODOS } from '../lib/periodo';

/* ============================================================
   PERÍODO

   Um seletor só, que manda em todos os módulos analíticos.
   Antes cada bloco tinha o seu, e dava pra ver a análise de
   trinta dias ao lado do calendário do ano inteiro.

   Os cinco períodos não ficam todos na tela. Só o escolhido
   aparece, e os outros abrem num painel, porque cinco botões
   lado a lado empurram o conteúdo pra baixo sem necessidade.
   ============================================================ */

export const ROTULO_PERIODO = {
  '30d': 'Últimos 30 dias',
  '3m': 'Últimos 3 meses',
  '6m': 'Últimos 6 meses',
  '1a': 'Último ano',
  tudo: 'Desde o início',
};

export function rotuloDe(id) {
  return ROTULO_PERIODO[id] || 'Últimos 30 dias';
}

export default function SeletorPeriodo({ valor, onMudar, compacto = false }) {
  const [aberto, setAberto] = useState(false);
  const atual = PERIODOS.find((p) => p.id === valor) || PERIODOS[0];

  return (
    <>
      <button className={`periodo-btn ${compacto ? 'compacto' : ''}`} onClick={() => setAberto(true)}>
        <Calendar size={14} />
        <span>{atual.nome}</span>
        <ChevronDown size={14} className="muted" />
      </button>

      <Sheet aberto={aberto} onClose={() => setAberto(false)} titulo="Qual período" subtitulo="vale pra tudo nesta tela">
        <div className="col" style={{ gap: 9 }}>
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              className={`opcao-meta ${valor === p.id ? 'on' : ''}`}
              onClick={() => { onMudar(p.id); setAberto(false); }}
            >
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 99, flex: 'none',
                  display: 'grid', placeItems: 'center',
                  border: `1.5px solid ${valor === p.id ? 'var(--accent)' : 'var(--seam-hi)'}`,
                  background: valor === p.id ? 'var(--accent)' : 'transparent',
                }}>
                  {valor === p.id && <Check size={11} color="var(--accent-ink)" strokeWidth={3} />}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="tiny" style={{ fontWeight: 600 }}>{rotuloDe(p.id)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="micro muted" style={{ lineHeight: 1.65 }}>
          Os números, os gráficos, o mapa de posições e o radar passam a mostrar só esse intervalo.
        </p>
      </Sheet>
    </>
  );
}

/* o selinho que diz de qual período veio o número */
export function DoPeriodo({ periodo, children }) {
  return (
    <div className="eyebrow">
      {children ? `${children} · ` : ''}{rotuloDe(periodo).toLowerCase()}
    </div>
  );
}
