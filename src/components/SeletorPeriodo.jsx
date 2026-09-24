import React, { useState } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';
import { Sheet } from './UI';
import { PRESETS, periodoDeDados } from '../lib/periodo';

/* ============================================================
   PERÍODO

   Um seletor só, que manda em todos os números da tela. Antes
   cada bloco tinha o seu, e dava pra ver a análise de trinta
   dias ao lado do calendário do ano inteiro. Os períodos e os
   nomes vêm do cadastro de períodos (periodoDeDados).

   Os cinco períodos não ficam todos na tela. Só o escolhido
   aparece, e os outros abrem num painel, porque cinco botões
   lado a lado empurram o conteúdo pra baixo sem necessidade.
   ============================================================ */

export default function SeletorPeriodo({ valor, onMudar, compacto = false }) {
  const [aberto, setAberto] = useState(false);
  const atual = periodoDeDados(valor);

  return (
    <>
      <button className={`periodo-btn ${compacto ? 'compacto' : ''}`} onClick={() => setAberto(true)}>
        <Calendar size={14} />
        <span>{atual.rotuloCurto}</span>
        <ChevronDown size={14} className="muted" />
      </button>

      <Sheet aberto={aberto} onClose={() => setAberto(false)} titulo="Qual período" subtitulo="vale pra todos os números desta tela">
        <div className="col" style={{ gap: 9 }}>
          {PRESETS.map((id) => periodoDeDados(id)).map((p) => (
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
                  <div className="tiny" style={{ fontWeight: 600 }}>{p.rotulo}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="micro muted" style={{ lineHeight: 1.65 }}>
          Os números, os gráficos, o mapa de posições e o radar passam a contar só esse intervalo. O
          calendário de presença mostra sempre os últimos 30 dias, e o histórico dele fica em "Ver histórico".
        </p>
      </Sheet>
    </>
  );
}
