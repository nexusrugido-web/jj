import React from 'react';
import { Check } from 'lucide-react';
import { Bar, Chip } from './UI';

/* ============================================================
   A LINHA DE UMA META

   Uma só pra todo tipo de meta: o título à esquerda (até duas
   linhas), o número à direita, de quando é a conta numa linha
   discreta, e a barra na largura toda. A margem é a mesma pra
   todas, e "Horas no ano" passa por aqui igual às outras.

   p  o que progressoDaMeta (ou metaDeHorasNoAno) devolve
   ============================================================ */
export default function LinhaDeMeta({ titulo, p }) {
  const feita = p.pct >= 100;
  const perto = p.pct >= 80 && !feita;
  return (
    <div className={`meta-linha ${feita ? 'feita' : perto ? 'perto' : ''}`}>
      <div className="meta-linha-topo">
        <span className="meta-linha-titulo tiny">{titulo}</span>
        <span className="meta-linha-valor num micro">
          {feita && <Chip tone="jade"><Check size={11} /> feita</Chip>}
          {p.valor}
        </span>
      </div>
      {p.quando && <span className="micro muted">{p.quando}</span>}
      <Bar v={p.pct} max={100} tone={feita ? 'jade' : perto ? 'accent' : ''} />
      {perto && !p.invertida && (
        <span className="micro" style={{ color: 'var(--accent)' }}>
          Falta pouco, {p.alvo - p.atual}{p.horas ? 'h' : ''} pra fechar.
        </span>
      )}
    </div>
  );
}
