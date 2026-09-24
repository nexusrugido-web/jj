import React, { useMemo, useState } from 'react';
import {
  Plus, X, Check, Sparkles, Loader, ShieldAlert,
} from 'lucide-react';
import { Sheet, Btn, Busca, Field, Input, Select, useToast } from './UI';
import { db } from '../db/db';
import { podeUsar, buscaMatch } from '../lib/utils';
import { casaApelido } from '../db/sinonimos';
import { autopreencherTecnica } from '../lib/ai';

/* ============================================================
   SELETOR DE TÉCNICAS
   Usado no foco da aula, no ponto do rola e nos passos do plano.
   Busca em 331 técnicas, filtra por categoria, e deixa criar
   na hora o que não existe.
   ============================================================ */

export function SeletorTecnica({
  aberto, onClose, onEscolher,
  techniques, categories, positions,
  faixa = 'branca',
  categoriaFiltro = null,     // trava numa categoria (ex.: só quedas)
  titulo = 'Escolher técnica',
  recentes = [],
  multiplo = false,
  jaEscolhidas = [],
}) {
  const toast = useToast();
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState('todas');
  const [criando, setCriando] = useState(null);
  const [carregandoIa, setCarregandoIa] = useState(false);

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const catsPermitidas = useMemo(() => {
    if (!categoriaFiltro) return categories;
    const alvos = Array.isArray(categoriaFiltro) ? categoriaFiltro : [categoriaFiltro];
    return categories.filter((c) => alvos.includes(c.slug));
  }, [categories, categoriaFiltro]);

  const idsPermitidos = useMemo(() => new Set(catsPermitidas.map((c) => c.id)), [catsPermitidas]);

  const lista = useMemo(() => {
    let l = techniques.filter((t) => !t.arquivada);
    if (categoriaFiltro) l = l.filter((t) => idsPermitidos.has(t.categoriaId));
    if (cat !== 'todas') l = l.filter((t) => t.categoriaId === Number(cat));
    if (busca) l = l.filter((t) => buscaMatch(`${t.nome} ${t.nomeEn} ${(t.tags || []).join(' ')}`, busca) || casaApelido(t.nome, busca));
    return l.sort((a, b) => {
      const ra = recentes.indexOf(a.nome), rb = recentes.indexOf(b.nome);
      if (ra !== rb) return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
      return a.nome.localeCompare(b.nome);
    }).slice(0, 120);
  }, [techniques, cat, busca, categoriaFiltro, idsPermitidos, recentes]);

  const atalhos = useMemo(
    () => recentes
      .map((n) => techniques.find((t) => t.nome === n))
      .filter((t) => t && (!categoriaFiltro || idsPermitidos.has(t.categoriaId)))
      .slice(0, 6),
    [recentes, techniques, categoriaFiltro, idsPermitidos]
  );

  async function criarComIA() {
    if (!criando?.nome?.trim()) return;
    setCarregandoIa(true);
    try {
      const r = await autopreencherTecnica(criando.nome, faixa);
      const d = r?.dados;
      if (d) {
        const limpa = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const acha = (lista, alvo) => {
          const a = limpa(alvo);
          if (!a) return null;
          return lista.find((x) => limpa(x.nome) === a)
            || lista.find((x) => limpa(x.nome).startsWith(a.slice(0, 10)))
            || lista.find((x) => a.startsWith(limpa(x.nome).slice(0, 10)))
            || lista.find((x) => limpa(x.nome).includes(a.split(' ')[0]) && a.split(' ')[0].length > 3)
            || null;
        };
        const c = acha(categories, d.categoria);
        const o = acha(positions, d.origem);
        const dst = acha(positions, d.destino);
        setCriando({
          ...criando,
          nome: d.nomePt || criando.nome,
          nomeEn: d.nomeEn || '',
          categoriaId: c?.id ?? criando.categoriaId,
          origemId: o?.id ?? null,
          destinoId: dst?.id ?? null,
          faixaMin: d.faixaMin || 'branca',
          modo: d.modo || 'ambos',
          restricao: d.restricao || '',
          detalhes: d.detalhes || '',
        });
        toast('Preenchido pela IA, confira');
      }
    } catch (e) {
      toast(String(e.message || e), 'err');
    } finally {
      setCarregandoIa(false);
    }
  }

  async function salvarNova() {
    if (!criando.nome.trim()) return toast('Coloca o nome', 'err');
    const id = await db.techniques.add({
      nome: criando.nome.trim(), nomeEn: criando.nomeEn || '',
      categoriaId: criando.categoriaId ?? catsPermitidas[0]?.id ?? null,
      origemId: criando.origemId ?? null, destinoId: criando.destinoId ?? null,
      modo: criando.modo || 'ambos', faixaMin: criando.faixaMin || 'branca',
      restricao: criando.restricao || '', detalhes: criando.detalhes || '',
      status: 'aprendendo', nivel: 0, favorita: 0, tags: [], video: '',
      arquivada: 0, criadoEm: Date.now(),
    });
    const nova = await db.techniques.get(id);
    toast('Técnica criada');
    setCriando(null);
    onEscolher(nova);
    if (!multiplo) onClose();
  }

  return (
    <Sheet
      aberto={aberto}
      onClose={() => { setCriando(null); setBusca(''); onClose(); }}
      titulo={criando ? 'Nova técnica' : titulo}
      subtitulo={criando ? undefined : `${lista.length} de ${techniques.length} técnicas`}
      wide
      footer={criando ? (
        <>
          <Btn variant="ghost" onClick={() => setCriando(null)}>Voltar</Btn>
          <Btn variant="primary" icon={Check} onClick={salvarNova}>Criar e usar</Btn>
        </>
      ) : multiplo ? (
        <Btn variant="primary" onClick={onClose} style={{ width: '100%' }}>Pronto</Btn>
      ) : null}
    >
      {criando ? (
        <>
          <Field label="Nome da técnica">
            <Input value={criando.nome} onChange={(e) => setCriando({ ...criando, nome: e.target.value })} autoFocus />
          </Field>
          <Btn icon={carregandoIa ? Loader : Sparkles} onClick={criarComIA} disabled={carregandoIa}>
            {carregandoIa ? 'Consultando…' : 'Preencher o resto com IA'}
          </Btn>
          <Field label="Nome em inglês">
            <Input value={criando.nomeEn || ''} onChange={(e) => setCriando({ ...criando, nomeEn: e.target.value })} />
          </Field>
          <Field label="Categoria">
            <Select value={criando.categoriaId || ''} onChange={(e) => setCriando({ ...criando, categoriaId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Escolha</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Field>
          <div className="grid g2" style={{ gap: 12 }}>
            <Field label="Posição de origem">
              <Select value={criando.origemId || ''} onChange={(e) => setCriando({ ...criando, origemId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Qualquer posição</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
            </Field>
            <Field label="Leva para">
              <Select value={criando.destinoId || ''} onChange={(e) => setCriando({ ...criando, destinoId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Escolha</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Modalidade">
            <Select value={criando.modo || 'ambos'} onChange={(e) => setCriando({ ...criando, modo: e.target.value })}>
              <option value="ambos">Gi + No-Gi</option>
              <option value="gi">Só Gi</option>
              <option value="nogi">Só No-Gi</option>
            </Select>
          </Field>
          {criando.restricao && <p className="micro" style={{ color: 'var(--roar)' }}>{criando.restricao}</p>}
        </>
      ) : (
        <>
          <Busca value={busca} onChange={setBusca} placeholder="Buscar em português ou inglês…" />

          {atalhos.length > 0 && !busca && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>suas mais usadas</div>
              <div className="chips-scroll">
                {atalhos.map((t) => (
                  <button key={t.id} className="chip on" onClick={() => { onEscolher(t); if (!multiplo) onClose(); }}>
                    {t.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {catsPermitidas.length > 1 && (
            <div className="chips-scroll">
              <button className={`chip ${cat === 'todas' ? 'on' : ''}`} onClick={() => setCat('todas')}>Todas</button>
              {catsPermitidas.map((c) => (
                <button key={c.id} className={`chip ${cat === String(c.id) ? 'on' : ''}`} onClick={() => setCat(String(c.id))}>
                  {c.nome}
                </button>
              ))}
            </div>
          )}

          <div className="col" style={{ gap: 5, maxHeight: '52vh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {lista.map((t) => {
              const escolhida = jaEscolhidas.includes(t.nome);
              const ilegal = !podeUsar(faixa, t.faixaMin);
              return (
                <button
                  key={t.id}
                  className="list-item"
                  style={{
                    borderRadius: 10, borderBottom: 0,
                    background: escolhida ? 'color-mix(in srgb, var(--jade) 12%, var(--void))' : 'var(--void)',
                  }}
                  onClick={() => { onEscolher(t); if (!multiplo) onClose(); }}
                >
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="tiny" style={{ fontWeight: 600 }}>
                      {t.nome} {ilegal && <ShieldAlert size={11} style={{ color: 'var(--blood)', verticalAlign: -1 }} />}
                    </div>
                    <div className="micro muted truncate">
                      {t.nomeEn}{catById[t.categoriaId] && ` · ${catById[t.categoriaId].nome}`}
                    </div>
                  </div>
                  {escolhida ? <Check size={15} style={{ color: 'var(--jade)' }} /> : <Plus size={15} className="muted" />}
                </button>
              );
            })}
            {lista.length === 0 && (
              <div className="center" style={{ padding: 22 }}>
                <p className="tiny muted">Nenhuma técnica com esse nome.</p>
              </div>
            )}
          </div>

          <Btn
            icon={Plus}
            onClick={() => setCriando({ nome: busca, categoriaId: catsPermitidas[0]?.id ?? null })}
          >
            Criar "{busca || 'nova técnica'}"
          </Btn>
        </>
      )}
    </Sheet>
  );
}

/* ============================================================
   APRENDIZADO, como foi a técnica na aula
   ============================================================ */
export const APRENDIZADO = [
  { id: 'peguei', nome: 'Peguei', cor: 'jade', desc: 'Entendi e saiu no drill' },
  { id: 'meio', nome: 'Mais ou menos', cor: 'roar', desc: 'Entendi a ideia, não sai limpo' },
  { id: 'nao', nome: 'Não peguei', cor: 'blood', desc: 'Passou por cima da cabeça' },
];

export function ListaFoco({ itens, onChange, onAbrirSeletor }) {
  const set = (i, patch) => onChange(itens.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="col" style={{ gap: 9 }}>
      {itens.map((f, i) => (
        <div key={i} className="foco-item">
          <div className="row" style={{ gap: 8 }}>
            <span className="tiny" style={{ flex: 1, fontWeight: 600, minWidth: 0 }}>{f.nome}</span>
            <button className="btn ghost icon sm" onClick={() => onChange(itens.filter((_, j) => j !== i))} aria-label="Tirar">
              <X size={13} />
            </button>
          </div>
          <div className="row wrap" style={{ gap: 5, marginTop: 8 }}>
            {APRENDIZADO.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`chip ${f.aprendizado === a.id ? a.cor : ''}`}
                onClick={() => set(i, { aprendizado: f.aprendizado === a.id ? null : a.id })}
              >
                {a.nome}
              </button>
            ))}
          </div>
        </div>
      ))}

      <Btn icon={Plus} onClick={onAbrirSeletor}>
        {itens.length ? 'Mais uma técnica' : 'Escolher técnicas da aula'}
      </Btn>
    </div>
  );
}
