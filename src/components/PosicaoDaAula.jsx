import React, { useMemo, useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { Sheet, Chip } from './UI';
import { useApp } from '../contexto';
import {
  POSICOES_COMUNS, GRUPOS_DE_POSICAO, posicoesDoTema, posicoesRecentes, tecnicasDaPosicao,
} from '../lib/posicoes';

/* ============================================================
   A POSIÇÃO DA AULA

   O professor ensina por tema ("semana de De La Riva"). A pessoa
   escolhe a posição e as técnicas dela aparecem sozinhas, 1 toque
   cada. Escolher só a posição já vale: é o "Só a posição".
   Opcional: quem não quiser segue direto pra lista de técnicas.
   ============================================================ */
const VISIVEIS = 8;

/* a posição da aula, no cartão do treino e no calendário */
export function PosicoesDoTreino({ slugs = [], style }) {
  const { positions } = useApp();
  const nomes = slugs.map((s) => positions.find((p) => p.slug === s)?.nome).filter(Boolean);
  if (!nomes.length) return null;
  return (
    <div style={style}>
      <div className="eyebrow" style={{ marginBottom: 7 }}>{nomes.length > 1 ? 'posições da aula' : 'posição da aula'}</div>
      <div className="row wrap" style={{ gap: 5 }}>{nomes.map((n) => <Chip key={n} tone="warn">{n}</Chip>)}</div>
    </div>
  );
}

export default function PosicaoDaAula({ valor = [], foco = [], sessions, positions, techniques, categories, recentes = [], onChange, onTecnica }) {
  const [outra, setOutra] = useState(false);
  const [abertas, setAbertas] = useState({});
  const temas = useMemo(() => posicoesDoTema(positions), [positions]);
  const porSlug = useMemo(() => Object.fromEntries(temas.map((p) => [p.slug, p])), [temas]);
  const atalhos = useMemo(() => {
    const l = [...posicoesRecentes(sessions), ...POSICOES_COMUNS].filter((s) => porSlug[s] && !valor.includes(s));
    return [...new Set(l)].slice(0, 6);
  }, [sessions, porSlug, valor]);
  const escolhidas = new Set(foco.map((f) => f.nome));

  const tirar = (slug) => onChange(valor.filter((x) => x !== slug));
  const por = (slug) => { if (!valor.includes(slug)) onChange([...valor, slug]); setOutra(false); };

  return (
    <div className="col" style={{ gap: 10 }}>
      {valor.map((slug) => {
        const p = porSlug[slug];
        if (!p) return null;
        const lista = tecnicasDaPosicao(slug, { techniques, categories, positions, usadas: recentes });
        const marcadas = lista.filter((t) => escolhidas.has(t.nome));
        const tudo = abertas[slug];
        /* a ordem não muda ao tocar: a marcada fica onde estava */
        const mostrar = tudo ? lista : lista.filter((t, i) => i < VISIVEIS || escolhidas.has(t.nome));
        return (
          <div key={slug} className="card" style={{ background: 'var(--void)', padding: 13 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <span className="tiny" style={{ fontWeight: 700, flex: 1 }}>O que treinou da {p.nome}?</span>
              <button type="button" className="btn ghost xs" aria-label={`Tirar ${p.nome}`} onClick={() => tirar(slug)}><X size={13} /></button>
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              <span className={`chip ${marcadas.length ? '' : 'on'}`} aria-pressed={!marcadas.length}>
                {!marcadas.length && <Check size={12} />} Só a posição
              </span>
              {mostrar.map((t) => {
                const on = escolhidas.has(t.nome);
                return (
                  <button key={t.id} type="button" className={`chip ${on ? 'jade' : ''}`} aria-pressed={on} onClick={() => onTecnica(t)}>
                    {on && <Check size={12} />} {t.nome}
                  </button>
                );
              })}
            </div>
            {lista.length > mostrar.length && (
              <button type="button" className="btn ghost xs" style={{ marginTop: 8 }} onClick={() => setAbertas({ ...abertas, [slug]: true })}>
                Ver todas da {p.nome} ({lista.length})
              </button>
            )}
            {!lista.length && <p className="micro muted" style={{ marginTop: 8 }}>Ainda não tem técnica dessa posição na biblioteca. Use a busca abaixo.</p>}
          </div>
        );
      })}

      <div className="chips-scroll">
        {atalhos.map((slug) => (
          <button key={slug} type="button" className="chip" onClick={() => por(slug)}>{porSlug[slug].nome}</button>
        ))}
        <button type="button" className="chip" onClick={() => setOutra(true)}><Plus size={12} /> {valor.length ? 'Outra posição' : 'Outra'}</button>
      </div>

      <Sheet aberto={outra} onClose={() => setOutra(false)} titulo="A aula foi de qual posição?">
        <div className="col" style={{ gap: 14 }}>
          {GRUPOS_DE_POSICAO.map(([familia, nome]) => {
            const l = temas.filter((p) => p.familia === familia && !valor.includes(p.slug)).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
            if (!l.length) return null;
            return (
              <div key={familia}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>{nome}</div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {l.map((p) => <button key={p.slug} type="button" className="chip" onClick={() => por(p.slug)}>{p.nome}</button>)}
                </div>
              </div>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
