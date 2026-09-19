import React, { useState } from 'react';
import { Check, ShieldAlert } from 'lucide-react';
import { Sheet, Card, Chip } from './UI';

/* ============================================================
   ANTES DE COMPETIR

   Regras e checklist ficavam num módulo separado, que ninguém
   abria antes da luta. Agora abrem de dentro do registro do
   campeonato, que é onde a pessoa está quando pensa nisso.
   ============================================================ */

const PONTOS_IBJJF = [
  ['Queda (takedown)', 2],
  ['Raspagem (sweep)', 2],
  ['Joelho na barriga', 2],
  ['Passagem de guarda', 3],
  ['Montada', 4],
  ['Pegada nas costas (2 ganchos)', 4],
];

const CHECKLIST = [
  'Confirmar categoria de peso e idade na inscrição',
  'Pesar em casa com o kimono na semana da luta',
  'Conferir se o gi está dentro das medidas e sem rasgos',
  'Levar documento com foto',
  'Chegar 1h antes da chamada da categoria',
  'Aquecer 20 min antes de subir',
  'Levar água, banana e barra pra entre as lutas',
  'Revisar: faixa branca só pode chave de pé reta',
  'Lembrar: pular para a guarda é falta para faixa branca',
];

export default function AntesDeCompetir({ aberto, onClose }) {
  const [check, setCheck] = useState({});
  const feitos = Object.values(check).filter(Boolean).length;

  return (
    <Sheet aberto={aberto} onClose={onClose} titulo="Antes de competir" subtitulo="pontuação, o que é proibido e o que levar" wide>
      <Card>
        <div className="card-head">
          <h2 className="h-sec">Checklist</h2>
          <Chip tone="jade">{feitos}/{CHECKLIST.length}</Chip>
        </div>
        <div className="col" style={{ gap: 6 }}>
          {CHECKLIST.map((c, i) => (
            <button
              key={i}
              className="list-item"
              style={{ borderRadius: 10, borderBottom: 0, background: 'var(--void)' }}
              onClick={() => setCheck({ ...check, [i]: !check[i] })}
            >
              <span style={{
                width: 19, height: 19, borderRadius: 6, flex: 'none',
                border: `1.5px solid ${check[i] ? 'var(--jade)' : 'var(--seam-hi)'}`,
                background: check[i] ? 'var(--jade)' : 'transparent',
                display: 'grid', placeItems: 'center',
              }}>
                {check[i] && <Check size={12} color="var(--void)" strokeWidth={3} />}
              </span>
              <span className="tiny grow" style={{ textDecoration: check[i] ? 'line-through' : 'none', opacity: check[i] ? 0.5 : 1 }}>{c}</span>
            </button>
          ))}
        </div>
        <p className="micro muted" style={{ marginTop: 12 }}>
          Na IBJJF a pesagem é momentos antes da luta e não tem tolerância nem tempo pra reidratar. Compita no peso natural.
        </p>
      </Card>

      <Card>
        <div className="card-head"><h2 className="h-sec">Pontuação IBJJF</h2></div>
        <div className="col" style={{ gap: 8 }}>
          {PONTOS_IBJJF.map(([nome, pts]) => (
            <div key={nome} className="row" style={{ padding: '8px 10px', background: 'var(--void)', borderRadius: 10 }}>
              <span className="tiny" style={{ flex: 1 }}>{nome}</span>
              <span className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{pts}</span>
            </div>
          ))}
        </div>
        <p className="micro muted" style={{ marginTop: 12 }}>
          A posição precisa ser estabilizada por <b>3 segundos</b>. Se não estabilizar, vira vantagem. Vantagens e punições desempatam.
        </p>
      </Card>

      <Card style={{ borderColor: 'color-mix(in srgb, var(--blood) 30%, var(--seam))' }}>
        <div className="card-head">
          <h2 className="h-sec row" style={{ gap: 8 }}><ShieldAlert size={17} style={{ color: 'var(--blood)' }} /> Faixa branca</h2>
        </div>
        <div className="col" style={{ gap: 10 }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--jade)' }}>permitido</div>
            <p className="tiny muted" style={{ marginTop: 5 }}>
              Chave de pé reta (straight ankle lock), girando sempre <b style={{ color: 'var(--chalk)' }}>para fora</b> do joelho.
              Estrangulamentos e chaves de braço em geral.
            </p>
          </div>
          <div className="divider" />
          <div>
            <div className="eyebrow" style={{ color: 'var(--blood)' }}>proibido</div>
            <p className="tiny muted" style={{ marginTop: 5 }}>
              Heel hook, toe hold, kneebar, calf slicer, bicep slicer, knee reap, chave de pulso e
              <b style={{ color: 'var(--chalk)' }}> pular para a guarda</b>. Slam é proibido em todas as faixas.
            </p>
          </div>
          <div className="divider" />
          <p className="micro muted">
            No-Gi IBJJF liberou heel hook só para marrom e preta adultos. ADCC e CJI liberam praticamente tudo.
            <b style={{ color: 'var(--roar)' }}> Regras mudam, confira no site oficial antes de cada campeonato.</b>
          </p>
        </div>
      </Card>
    </Sheet>
  );
}
