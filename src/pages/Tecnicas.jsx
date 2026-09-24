import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Library, Star, Pencil, Trash2, Repeat, ShieldAlert, Check,
  ChevronRight, ListTree, List, Settings2, ArrowRight, Sparkles, Loader, Video, Filter, Gauge, SlidersHorizontal,
} from 'lucide-react';
import Guia from '../components/Guia';
import { useApp } from '../contexto';
import { Ponteira } from '../components/Ponteira';
import { minhasTecnicas, grauPorN } from '../lib/graus';
import { db } from '../db/db';
import { FAIXAS } from '../db/seed';
import {
  Card, Btn, Field, Input, NumeroInput, Textarea, Select, Modal, Sheet, Chip, Empty,
  Confirmar, useToast, Seg, Busca, TagsInput,
} from '../components/UI';
import { buscaMatch, podeUsar, FAIXA_ORDEM } from '../lib/utils';
import { casaApelido } from '../db/sinonimos';
import { novaRevisao } from '../lib/srs';
import { autopreencherTecnica, validarTecnica } from '../lib/ai';
import { Midia } from '../components/Midia';

const STATUS = [
  { id: 'nao_iniciada', nome: 'Não iniciada', tone: '' },
  { id: 'aprendendo', nome: 'Aprendendo', tone: 'warn' },
  { id: 'consolidada', nome: 'Consolidada', tone: 'jade' },
  { id: 'game', nome: 'No meu game', tone: 'on' },
];

const MODOS = [
  { id: 'ambos', nome: 'Gi + No-Gi' },
  { id: 'gi', nome: 'Só Gi' },
  { id: 'nogi', nome: 'Só No-Gi' },
];

const vazia = () => ({
  nome: '', nomeEn: '', categoriaId: null, origemId: null, destinoId: null,
  modo: 'ambos', faixaMin: 'branca', restricao: '', status: 'nao_iniciada',
  nivel: 0, favorita: 0, tags: [], video: '', detalhes: '',
});

export default function Tecnicas() {
  const { techniques, categories, positions, settings, reviews, rolls, partners, sessions, gradings, irPara } = useApp();
  const toast = useToast();
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState('todas');
  const [modo, setModo] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [soLegais, setSoLegais] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [vista, setVista] = useState('lista');
  const [edit, setEdit] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [gerenciar, setGerenciar] = useState(false);
  const [confirmando, setConfirmando] = useState(null);

  /* o grau de cada técnica sai dos rolas, não de um campo
     que ninguém preenche */
  const minhas = useMemo(
    () => minhasTecnicas(rolls, partners, sessions, techniques, settings.faixa, gradings, settings.graus || 0),
    [rolls, partners, sessions, techniques, settings.faixa, gradings, settings.graus]
  );
  const grauPorNome = useMemo(
    () => Object.fromEntries(minhas.map((t) => [String(t.nome).toLowerCase(), t.grau])),
    [minhas]
  );
  const grauDe = (nome) => grauPorNome[String(nome).toLowerCase()] || 0;

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const posById = useMemo(() => Object.fromEntries(positions.map((p) => [p.id, p])), [positions]);
  const emRevisao = useMemo(() => new Set(reviews.map((r) => r.techniqueId)), [reviews]);

  /* ============================================================
     O QUE APARECE, E POR QUÊ

     A biblioteca tem 626 técnicas. Abrir nela inteira é como
     abrir um dicionário pra aprender uma palavra: o aluno vê
     tudo e não vê nada.

     Por padrão aparece só o que interessa agora: o que você já
     usa e o que é da sua faixa. O resto continua ali, na busca,
     pra quem quiser se aventurar.
     ============================================================ */
  const lista = useMemo(() => {
    const buscando = busca.trim().length > 0;
    const filtrando = cat !== 'todas' || modo !== 'todos' || status !== 'todos';

    return techniques
      .filter((t) => {
        if (cat !== 'todas' && t.categoriaId !== Number(cat)) return false;
        if (modo !== 'todos' && t.modo !== modo && t.modo !== 'ambos') return false;
        if (status !== 'todos' && t.status !== status) return false;
        if (soLegais && !podeUsar(settings.faixa, t.faixaMin)) return false;

        if (buscando) {
          return [t.nome, t.nomeEn, (t.tags || []).join(' '), catById[t.categoriaId]?.nome, posById[t.origemId]?.nome]
            .some((c) => buscaMatch(c, busca));
        }

        /* sem busca e sem filtro: só o que é seu ou da sua faixa */
        if (!filtrando) {
          if (grauDe(t.nome) > 0) return true;
          return podeUsar(settings.faixa, t.faixaMin);
        }
        return true;
      })
      .sort((a, b) => {
        /* o que você usa vem primeiro, e por grau */
        const ga = grauDe(a.nome);
        const gb = grauDe(b.nome);
        if (ga !== gb) return gb - ga;
        return (b.favorita || 0) - (a.favorita || 0) || a.nome.localeCompare(b.nome);
      });
  }, [techniques, cat, modo, status, soLegais, busca, settings.faixa, catById, posById, grauPorNome]);

  const resumoLista = useMemo(() => {
    const minhasAqui = lista.filter((t) => grauDe(t.nome) > 0).length;
    const daFaixa = lista.filter((t) => podeUsar(settings.faixa, t.faixaMin)).length;
    return {
      minhas: minhasAqui,
      daFaixa,
      foraDaFaixa: lista.length - daFaixa,
      escondidas: techniques.length - lista.length,
    };
  }, [lista, techniques, settings.faixa, grauPorNome]);

  const porPosicao = useMemo(() => {
    const m = new Map();
    for (const t of lista) {
      const k = t.origemId ?? 0;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    }
    return [...m.entries()]
      .map(([k, v]) => ({ pos: posById[k], techs: v }))
      .sort((a, b) => (a.pos?.ordem ?? 99) - (b.pos?.ordem ?? 99));
  }, [lista, posById]);

  async function gravar(t) {
    const limpo = { ...t, arquivada: 0 };
    if (limpo.id) await db.techniques.put(limpo);
    else await db.techniques.add({ ...limpo, criadoEm: Date.now() });
    setEdit(null);
    setConfirmando(null);
    toast('Técnica salva');
  }

  async function salvar() {
    if (!edit.nome?.trim()) return toast('Coloca o nome da técnica', 'err');
    // se a técnica não é legal na faixa do usuário, pede confirmação
    if (!podeUsar(settings.faixa, edit.faixaMin)) {
      setConfirmando({ ...edit });
      return;
    }
    await gravar(edit);
  }

  async function toggleRevisao(t) {
    const ex = reviews.find((r) => r.techniqueId === t.id);
    if (ex) { await db.reviews.delete(ex.id); toast('Removida da revisão'); }
    else { await db.reviews.add(novaRevisao(t.id)); toast('Entrou na fila de revisão'); }
  }

  const ilegal = (t) => !podeUsar(settings.faixa, t.faixaMin);
  const [ajuda, setAjuda] = useState(false);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">o que cabe na sua faixa agora</div>
          <h1 className="h-page row" style={{ gap: 9 }}>
            Técnicas
            <button className="ajuda" onClick={() => setAjuda(true)} aria-label="O que aparece aqui">?</button>
          </h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Btn icon={Settings2} onClick={() => setGerenciar(true)}>Listas</Btn>
          <Btn variant="primary" icon={Plus} onClick={() => setEdit(vazia())}>Nova técnica</Btn>
        </div>
      </div>

      <div className="tec-resumo">
        <div>
          <span className="num" style={{ fontSize: 19, fontWeight: 800, color: 'var(--accent)' }}>{resumoLista.minhas}</span>
          <span className="micro muted"> {resumoLista.minhas === 1 ? 'sua' : 'suas'}</span>
        </div>
        <span className="tec-resumo-sep" />
        <div>
          <span className="num" style={{ fontSize: 19, fontWeight: 800 }}>{resumoLista.daFaixa}</span>
          <span className="micro muted"> da sua faixa</span>
        </div>
        {resumoLista.escondidas > 0 && (
          <>
            <span className="spacer" />
            <span className="micro muted">
              mais {resumoLista.escondidas} na busca
            </span>
          </>
        )}
      </div>

      {/* busca e categoria sempre à vista; o resto dos filtros abre
          num botão, que mostra quantos estão ligados */}
      <Card style={{ marginBottom: 14 }}>
        <Busca value={busca} onChange={setBusca} placeholder="Buscar técnica, em português ou inglês" />
        <div className="chips-scroll tec-cats">
          <Chip on={cat === 'todas'} onClick={() => setCat('todas')}>Todas</Chip>
          {categories.map((c) => (
            <Chip key={c.id} on={cat === String(c.id)} onClick={() => setCat(String(c.id))}>{c.nome}</Chip>
          ))}
        </div>
        {(() => {
          const ligados = (modo !== 'todos') + (status !== 'todos') + (soLegais ? 1 : 0);
          return (
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <Btn size="sm" variant={ligados ? 'contorno' : ''} icon={SlidersHorizontal} onClick={() => setFiltrosAbertos(!filtrosAbertos)}>
                Filtros{ligados ? ` · ${ligados}` : ''}
              </Btn>
              <span className="spacer" />
              <Seg value={vista} onChange={setVista} options={[{ id: 'lista', nome: 'Lista' }, { id: 'arvore', nome: 'Árvore' }]} />
            </div>
          );
        })()}
        {filtrosAbertos && (
          <div className="tec-filtros">
            <div className="label">Kimono</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {MODOS.map((m) => <Chip key={m.id} on={modo === m.id} onClick={() => setModo(modo === m.id ? 'todos' : m.id)}>{m.nome}</Chip>)}
            </div>
            <div className="label">Onde você está com ela</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {STATUS.map((x) => <Chip key={x.id} on={status === x.id} onClick={() => setStatus(status === x.id ? 'todos' : x.id)}>{x.nome}</Chip>)}
            </div>
            <Chip on={soLegais} onClick={() => setSoLegais(!soLegais)}>
              <ShieldAlert size={12} /> Só as legais pra faixa {settings.faixa}
            </Chip>
          </div>
        )}
      </Card>

      {lista.length === 0 ? (
        <Card><Empty icon={Library} titulo="Nada encontrado" texto="Ajuste os filtros ou crie uma técnica nova." /></Card>
      ) : vista === 'lista' ? (
        <div className="grid g-wide">
          {lista.map((t) => (
            <TecnicaCard
              key={t.id} t={t} cat={catById[t.categoriaId]} origem={posById[t.origemId]} destino={posById[t.destinoId]}
              ilegal={ilegal(t)} emRevisao={emRevisao.has(t.id)} grau={grauDe(t.nome)}
              onEdit={() => setEdit({ ...t })} onDel={() => setExcluir(t)}
              onFav={() => db.techniques.update(t.id, { favorita: t.favorita ? 0 : 1 })}
              onNivel={(n) => db.techniques.update(t.id, { nivel: n, status: n > 0 && t.status === 'nao_iniciada' ? 'aprendendo' : t.status })}
              onRevisao={() => toggleRevisao(t)}
            />
          ))}
        </div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {porPosicao.map(({ pos, techs }) => (
            <Card key={pos?.id ?? 'sem'} className="pad-0">
              <div className="row" style={{ padding: '14px 16px', borderBottom: '1px solid var(--seam)', gap: 10 }}>
                <span className="stat-ico"><ListTree size={15} /></span>
                <div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--display)', letterSpacing: '-0.02em' }}>{pos?.nome || 'Sem posição definida'}</div>
                  <div className="micro muted">{pos?.nomeEn} {pos?.pts ? `· ${pos.pts} pts` : ''}</div>
                </div>
                <span className="spacer" />
                <Chip>{techs.length}</Chip>
              </div>
              <div style={{ padding: 10 }}>
                {techs.map((t) => (
                  <button key={t.id} className="tec-item" onClick={() => setEdit({ ...t })}>
                    <div className="tec-txt">
                      <div className="tec-nome">{t.nome}</div>
                      <div className="tec-sub">
                        {catById[t.categoriaId]?.nome}
                        {t.destinoId && posById[t.destinoId] && (
                          <> · leva pra {posById[t.destinoId].nome}</>
                        )}
                      </div>
                    </div>
                    {ilegal(t) && (
                      <span className="tec-aviso" title="Não permitida na sua faixa">
                        <ShieldAlert size={13} />
                      </span>
                    )}
                    <Ponteira n={grauDe(t.nome)} mini />
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* -------- editor -------- */}
      <Modal
        aberto={!!edit}
        onClose={() => setEdit(null)}
        titulo={edit?.id ? 'Editar técnica' : 'Nova técnica'}
        wide
        footer={
          <>
            {edit?.id && <Btn variant="danger" icon={Trash2} onClick={() => { setExcluir(edit); setEdit(null); }}>Excluir</Btn>}
            <span className="spacer" />
            <Btn variant="ghost" onClick={() => setEdit(null)}>Cancelar</Btn>
            <Btn variant="primary" icon={Check} onClick={salvar}>Salvar</Btn>
          </>
        }
      >
        {edit && <EditorTecnica t={edit} setT={setEdit} categories={categories} positions={positions} techniques={techniques} faixa={settings.faixa} toast={toast} />}
      </Modal>

      <Modal aberto={gerenciar} onClose={() => setGerenciar(false)} titulo="Gerenciar listas" wide>
        <GerenciarListas categories={categories} positions={positions} toast={toast} />
      </Modal>

      <ConfirmaFaixa
        t={confirmando}
        faixa={settings.faixa}
        onCancelar={() => { setConfirmando(null); setEdit(confirmando); }}
        onConfirmar={() => gravar(confirmando)}
      />

      <Confirmar
        aberto={!!excluir}
        onClose={() => setExcluir(null)}
        onConfirmar={async () => { await db.techniques.delete(excluir.id); toast('Técnica excluída'); }}
        titulo="Excluir técnica"
        texto={`"${excluir?.nome}" some da biblioteca. Os registros antigos de rola continuam intactos.`}
      />
      <Sheet aberto={ajuda} onClose={() => setAjuda(false)} titulo="O que aparece aqui" wide>
        <Guia
          inicial="filtro"
          topicos={[
            {
              id: 'filtro', icone: Filter, titulo: 'Por que não aparecem todas', resumo: `A biblioteca tem ${techniques.length}, e a tela mostra as da sua faixa`,
              conteudo: (
                <>
                  <p>Mostrar todas de uma vez é como abrir um dicionário pra aprender uma palavra.</p>
                  <p>Por padrão aparecem as que já saíram nos seus rolas e as permitidas na sua faixa. As outras continuam ali: é só buscar pelo nome.</p>
                </>
              ),
            },
            {
              id: 'ponteira', icone: Gauge, titulo: 'A ponteira ao lado de cada uma', resumo: 'Enche sozinha conforme você treina',
              conteudo: (
                <>
                  <div className="col" style={{ gap: 8 }}>
                    {[
                      [0, 'Nunca apareceu num rola seu.'],
                      [1, 'Conheço o movimento.'],
                      [2, 'Funciona no rola.'],
                      [3, 'Faz parte do meu jogo.'],
                      [4, 'Assinatura. É o seu golpe.'],
                    ].map(([n, d]) => (
                      <div key={n} className="row" style={{ gap: 11 }}>
                        <Ponteira n={n} mini />
                        <span className="tiny muted" style={{ flex: 1 }}>{d}</span>
                      </div>
                    ))}
                  </div>
                  <p>Não precisa marcar nada: ela sobe com os treinos que você registra.</p>
                </>
              ),
            },
            {
              id: 'aviso', icone: ShieldAlert, titulo: 'O aviso vermelho', resumo: 'Proibida na sua faixa em competição',
              conteudo: (
                <>
                  <p>A técnica não é permitida na sua faixa em competição de kimono. Pode aparecer no treino, e conhecer ajuda a se defender, mas numa luta oficial dá desclassificação.</p>
                  <p>A regra muda de federação pra federação. O app segue a tabela da IBJJF, que é a mais usada.</p>
                </>
              ),
            },
          ]}
        />
      </Sheet>

    </div>
  );
}

function NivelDots({ n = 0, onChange }) {
  return (
    <span className="row" style={{ gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          onClick={onChange ? (e) => { e.stopPropagation(); onChange(i === n ? 0 : i); } : undefined}
          style={{
            width: 7, height: 7, borderRadius: 99, cursor: onChange ? 'pointer' : 'default',
            background: i <= n ? 'var(--accent)' : 'var(--seam-hi)',
            boxShadow: i <= n ? '0 0 6px -1px var(--accent)' : 'none',
          }}
        />
      ))}
    </span>
  );
}

function TecnicaCard({ t, cat, origem, destino, ilegal, emRevisao, grau = 0, onEdit, onDel, onFav, onNivel, onRevisao }) {
  /* "Não iniciada" ao lado de uma técnica que já saiu no rola
     desmentia Minhas técnicas: sem status marcado, vale o grau */
  const st = t.status === 'nao_iniciada' && grau > 0
    ? { nome: grauPorN(grau).curto, tone: '' }
    : STATUS.find((s) => s.id === t.status);
  return (
    <Card className="hover" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {cat && (
              <span className="chip" style={{ background: cat.cor + '1f', borderColor: cat.cor + '55', color: cat.cor }}>{cat.nome}</span>
            )}
            {ilegal && <Chip tone="blood"><ShieldAlert size={11} /> ilegal na sua faixa</Chip>}
          </div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--display)', fontSize: 15.5, letterSpacing: '-0.02em', marginTop: 7 }}>{t.nome}</div>
          {t.nomeEn && <div className="micro muted">{t.nomeEn}</div>}
        </div>
        <button className="btn ghost icon sm" onClick={onFav} aria-label="Favoritar">
          <Star size={15} fill={t.favorita ? 'var(--accent)' : 'none'} color={t.favorita ? 'var(--accent)' : 'var(--dimmer)'} />
        </button>
      </div>

      {(origem || destino) && (
        <div className="row micro muted" style={{ gap: 5, flexWrap: 'wrap' }}>
          {origem?.nome} {destino && <ArrowRight size={11} />} {destino?.nome}
        </div>
      )}

      {t.restricao && (
        <p className="micro" style={{ color: 'var(--roar)', lineHeight: 1.45 }}>{t.restricao}</p>
      )}

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Chip tone={st?.tone}>{st?.nome}</Chip>
        <span className="spacer" />
        <NivelDots n={t.nivel} onChange={onNivel} />
      </div>

      <div className="row" style={{ gap: 6, borderTop: '1px solid var(--seam)', paddingTop: 10 }}>
        <button className={`btn xs ${emRevisao ? 'primary' : ''}`} onClick={onRevisao}>
          <Repeat size={12} /> {emRevisao ? 'Na revisão' : 'Revisar'}
        </button>
        <span className="spacer" />
        <button className="btn ghost icon sm" onClick={onEdit} aria-label="Editar"><Pencil size={14} /></button>
        <button className="btn ghost icon sm" onClick={onDel} aria-label="Excluir"><Trash2 size={14} /></button>
      </div>
    </Card>
  );
}

function EditorTecnica({ t, setT, categories, positions, techniques, faixa, toast }) {
  const set = (k, v) => setT({ ...t, [k]: v });
  const tags = useMemo(() => [...new Set(techniques.flatMap((x) => x.tags || []))], [techniques]);
  const [carregando, setCarregando] = useState(false);

  async function preencher() {
    if (!t.nome?.trim()) return toast('Digite o nome da técnica primeiro', 'err');
    setCarregando(true);
    try {
      const r = await autopreencherTecnica(t.nome, faixa);
      const d = r?.dados;
      if (!d) throw new Error('A IA não devolveu dados.');
      const cat = categories.find((c) => c.nome.toLowerCase() === String(d.categoria || '').toLowerCase());
      const ori = positions.find((p) => p.nome.toLowerCase().includes(String(d.origem || '').toLowerCase().slice(0, 8)));
      const des = positions.find((p) => p.nome.toLowerCase().includes(String(d.destino || '').toLowerCase().slice(0, 8)));
      setT({
        ...t,
        nome: d.nomePt || t.nome,
        nomeEn: d.nomeEn || t.nomeEn,
        categoriaId: cat?.id ?? t.categoriaId,
        origemId: ori?.id ?? t.origemId,
        destinoId: des?.id ?? t.destinoId,
        faixaMin: d.faixaMin || t.faixaMin,
        modo: d.modo || t.modo,
        restricao: d.restricao || t.restricao,
        detalhes: d.detalhes || t.detalhes,
      });
      toast('Preenchido pela IA, confira antes de salvar');
    } catch (e) {
      toast(String(e.message || e), 'err');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <div className="grid g2" style={{ gap: 12 }}>
        <Field label="Nome (PT)"><Input value={t.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Raspagem de tesoura" /></Field>
        <Field label="Nome (EN)"><Input value={t.nomeEn} onChange={(e) => set('nomeEn', e.target.value)} placeholder="Ex.: Scissor sweep" /></Field>
      </div>

      <Btn icon={carregando ? Loader : Sparkles} onClick={preencher} disabled={carregando}>
        {carregando ? 'Consultando…' : 'Preencher o resto com IA'}
      </Btn>

      <div className="grid g3" style={{ gap: 12 }}>
        <Field label="Categoria">
          <Select value={t.categoriaId || ''} onChange={(e) => set('categoriaId', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Qualquer posição</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Posição de origem">
          <Select value={t.origemId || ''} onChange={(e) => set('origemId', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Qualquer posição</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </Field>
        <Field label="Leva para">
          <Select value={t.destinoId || ''} onChange={(e) => set('destinoId', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Escolha</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid g3" style={{ gap: 12 }}>
        <Field label="Modo">
          <Select value={t.modo} onChange={(e) => set('modo', e.target.value)}>
            {MODOS.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        </Field>
        <Field label="Legal a partir da faixa" hint="Regra IBJJF">
          <Select value={t.faixaMin} onChange={(e) => set('faixaMin', e.target.value)}>
            {FAIXAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={t.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Aviso / restrição"><Input value={t.restricao} onChange={(e) => set('restricao', e.target.value)} placeholder="Ex.: proibida até a faixa marrom na IBJJF" /></Field>
      <Field label="Link de vídeo"><Input value={t.video} onChange={(e) => set('video', e.target.value)} placeholder="https://…" /></Field>
      <Field label="Tags"><TagsInput valor={t.tags || []} onChange={(v) => set('tags', v)} sugestoes={tags} /></Field>
      <Field label="Detalhes e pontos-chave"><Textarea value={t.detalhes} onChange={(e) => set('detalhes', e.target.value)} placeholder="Pegada, ângulo, timing, erro comum…" /></Field>

      <Field label={`Domínio manual (${t.nivel}/5)`} hint="A aba Domínio calcula o real a partir dos seus rolas.">
        <input type="range" min="0" max="5" value={t.nivel} onChange={(e) => set('nivel', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
      </Field>

      {t.id && (
        <>
          <div className="divider" />
          <div className="eyebrow" style={{ marginBottom: 4 }}>vídeos e fotos desta técnica</div>
          <Midia vinculoTipo="tecnica" vinculoId={t.id} compacto />
        </>
      )}
    </>
  );
}

/* ---------- confirmação quando a técnica não é legal na faixa ---------- */
function ConfirmaFaixa({ t, faixa, onCancelar, onConfirmar }) {
  const [checando, setChecando] = useState(false);
  const [parecer, setParecer] = useState(null);

  useEffect(() => { setParecer(null); }, [t]);
  if (!t) return null;

  async function checar() {
    setChecando(true);
    try {
      const r = await validarTecnica(t.nome, faixa, t.modo);
      setParecer(r?.texto || r?.dados?.texto || 'A IA não conseguiu responder agora.');
    } catch (e) {
      setParecer(String(e.message || e));
    } finally {
      setChecando(false);
    }
  }

  const nomeFaixa = FAIXAS.find((f) => f.id === t.faixaMin)?.nome || t.faixaMin;

  return (
    <Sheet
      aberto={!!t}
      onClose={onCancelar}
      titulo="Confere essa aí"
      footer={
        <>
          <Btn variant="ghost" onClick={onCancelar}>Voltar e ajustar</Btn>
          <Btn variant="primary" onClick={onConfirmar}>Salvar assim mesmo</Btn>
        </>
      }
    >
      <div className="valida ruim">
        <ShieldAlert size={16} className="valida-ico" style={{ color: 'var(--blood)' }} />
        <div>
          <div className="tiny" style={{ fontWeight: 600 }}>
            "{t.nome}" está marcada como legal só a partir da faixa {nomeFaixa}
          </div>
          <p className="micro muted" style={{ marginTop: 4 }}>
            Você é faixa {faixa}. Pode estudar e até drillar com o professor, mas <b style={{ color: 'var(--chalk)' }}>não pode aplicar em competição IBJJF</b>, e em rola, chave que você não domina machuca parceiro.
          </p>
        </div>
      </div>

      {t.restricao && <p className="micro muted">{t.restricao}</p>}

      <Btn icon={checando ? Loader : Sparkles} onClick={checar} disabled={checando}>
        {checando ? 'Consultando a regra atual…' : 'Checar a regra IBJJF agora (busca na web)'}
      </Btn>

      {parecer && (
        <div className="card" style={{ background: 'var(--void)' }}>
          <div className="eyebrow" style={{ marginBottom: 7 }}>parecer</div>
          <p className="tiny" style={{ whiteSpace: 'pre-wrap' }}>{parecer}</p>
          <p className="micro muted" style={{ marginTop: 10 }}>
            Regras mudam de temporada. Confirme no site oficial da IBJJF antes de competir.
          </p>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- gerenciar categorias e posições ---------- */
function GerenciarListas({ categories, positions, toast }) {
  const [aba, setAba] = useState('cat');
  const [novoCat, setNovoCat] = useState('');
  const [novaPos, setNovaPos] = useState('');

  return (
    <>
      <Seg value={aba} onChange={setAba} options={[{ id: 'cat', nome: 'Categorias' }, { id: 'pos', nome: 'Posições' }]} />

      {aba === 'cat' ? (
        <>
          <div className="row" style={{ gap: 8 }}>
            <Input value={novoCat} onChange={(e) => setNovoCat(e.target.value)} placeholder="Nova categoria" />
            <Btn
              variant="primary" icon={Plus}
              onClick={async () => {
                if (!novoCat.trim()) return;
                await db.categories.add({ nome: novoCat.trim(), slug: '', cor: '#8b9b95', ordem: categories.length, arquivada: 0 });
                setNovoCat(''); toast('Categoria criada');
              }}
            >Criar</Btn>
          </div>
          <div className="col" style={{ gap: 6 }}>
            {categories.map((c) => (
              <div key={c.id} className="row" style={{ gap: 8, padding: 8, background: 'var(--void)', borderRadius: 10 }}>
                <input type="color" value={c.cor || '#8b9b95'} onChange={(e) => db.categories.update(c.id, { cor: e.target.value })} style={{ width: 30, height: 30, border: 0, background: 'none', cursor: 'pointer' }} />
                <Input value={c.nome} onChange={(e) => db.categories.update(c.id, { nome: e.target.value })} />
                <button className="btn ghost icon sm" onClick={() => db.categories.update(c.id, { arquivada: 1 })} aria-label="Arquivar"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="row" style={{ gap: 8 }}>
            <Input value={novaPos} onChange={(e) => setNovaPos(e.target.value)} placeholder="Nova posição" />
            <Btn
              variant="primary" icon={Plus}
              onClick={async () => {
                if (!novaPos.trim()) return;
                await db.positions.add({ nome: novaPos.trim(), nomeEn: '', slug: '', familia: 'neutra', pts: 0, ordem: positions.length, arquivada: 0 });
                setNovaPos(''); toast('Posição criada');
              }}
            >Criar</Btn>
          </div>
          <div className="col" style={{ gap: 6 }}>
            {positions.map((p) => (
              <div key={p.id} className="row" style={{ gap: 8, padding: 8, background: 'var(--void)', borderRadius: 10, flexWrap: 'wrap' }}>
                <Input value={p.nome} onChange={(e) => db.positions.update(p.id, { nome: e.target.value })} style={{ flex: 2, minWidth: 140 }} />
                <Select value={p.familia} onChange={(e) => db.positions.update(p.id, { familia: e.target.value })} style={{ flex: 1, minWidth: 110 }}>
                  <option value="dominante">Dominante</option>
                  <option value="neutra">Neutra</option>
                  <option value="em_pe">Em pé</option>
                  <option value="guarda">Guarda</option>
                  <option value="perna">Pernas</option>
                  <option value="inferior">Inferior</option>
                </Select>
                <NumeroInput valor={p.pts} onChange={(v) => db.positions.update(p.id, { pts: v })} style={{ width: 70 }} />
                <button className="btn ghost icon sm" onClick={() => db.positions.update(p.id, { arquivada: 1 })} aria-label="Arquivar"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="micro muted">Arquivar não apaga o histórico, só tira da lista de escolhas.</p>
    </>
  );
}
