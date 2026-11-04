import React, { useMemo, useState } from 'react';
import { Plus, Play, Pencil, Trash2, Route, ChevronRight, RotateCcw, X, Repeat, ArrowDown, Check } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../contexto';
import { db } from '../db/db';
import {
  Card, Btn, Field, Input, Select, Sheet, Chip, Confirmar, useToast,
} from '../components/UI';
import Guia, { Passos } from '../components/Guia';
import { Vitrine } from '../components/Plano';
import { SeletorTecnica } from '../components/SeletorTecnica';
import { podeVer, pedirOferta } from '../lib/plano';
import {
  meusPlanos, planosProntos, exemplosDaFaixa, podeCriarPlano, correnteDoPlano, planoNovo, MAX_PASSOS, ALTURA_REL,
  taxaDoPlano, taxaPorTipo,
} from '../lib/planos';
import { FAIXAS } from '../lib/faixas';
import { PESO_REL } from '../db/scoring';

/* ============================================================
   PLANOS DE ATAQUE

   Da posição, a finta; ele reage; vem o golpe; se defender, o
   próximo. Cada um começa com 3 exemplos da faixa dele na lista
   (não contam no limite) e vai montando os seus: o grátis tem 1
   plano seu, o Premium não tem limite e abre a biblioteca inteira.
   ============================================================ */
export default function Planos() {
  const { positions = [], techniques = [], categories = [], settings, acesso, rolls = [], partners = [], irPara } = useApp();
  const toast = useToast();
  const todos = useLiveQuery(() => db.attackPlans.toArray(), [], []) || [];
  const meus = useMemo(() => meusPlanos(todos), [todos]);
  const exemplos = useMemo(() => exemplosDaFaixa(todos, settings?.faixa), [todos, settings?.faixa]);
  const biblioteca = useMemo(() => {
    const ja = new Set(exemplos.map((p) => p.slug));
    return planosProntos(todos).filter((p) => !ja.has(p.slug));
  }, [todos, exemplos]);
  const premium = podeVer(acesso, 'planos');

  const [edit, setEdit] = useState(null);
  const [assistindo, setAssistindo] = useState(null);
  const [apagar, setApagar] = useState(null);

  const liberado = () => {
    if (podeCriarPlano(todos, premium)) return true;
    pedirOferta('planos');
    return false;
  };
  /* ajustar um pronto ao jogo dele: abre o editor já preenchido e,
     ao salvar, vira plano dele (esse conta no limite) */
  const ajustar = (p) => liberado() && setEdit({ ...paraEditar(p), id: undefined, copiadoDe: p.slug || null });
  const acoesDoPronto = (p) => (
    <>
      <Btn size="sm" variant="ghost" icon={Repeat} onClick={() => irPara('treinos', { drillPlano: p.uid })}>Drill do plano</Btn>
      <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => ajustar(p)}>Ajustar ao meu jogo</Btn>
    </>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Planos de ataque</h1>
          <p className="tiny muted" style={{ marginTop: 4 }}>Da posição, a finta. Ele reage, você encaixa. Se defender, o próximo.</p>
        </div>
        <Btn variant="primary" icon={Plus} onClick={() => liberado() && setEdit(rascunho())}>Criar plano</Btn>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Guia topicos={[{
          id: 'como', icone: Route, titulo: 'Como funciona um plano de ataque',
          resumo: 'Uma corrente: cada defesa dele abre o seu próximo golpe',
          conteudo: (
            <>
              <LegendaDoMapa />
              <Passos itens={[
                'Posição: de onde a corrente começa (guarda fechada, montada, costas).',
                'Finta: o movimento que faz ele reagir do jeito que você quer.',
                'Reação dele: o que ele faz pra se defender da finta.',
                'Golpe: o que você encaixa em cima dessa reação.',
                'Se ele defender: a defesa dele abre o golpe seguinte. Até 4 golpes.',
              ]} />
              <p className="micro muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                Os 3 exemplos da sua faixa já estão na sua lista. Assiste, testa no rola e, quando quiser, ajusta um ao seu jogo ou monta o seu do zero.
              </p>
            </>
          ),
        }]} />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h2 className="h-sec">Meus planos</h2>
          {!premium && <span className="micro muted">{meus.length} de 1 seu no grátis</span>}
        </div>
        <div className="col" style={{ gap: 12 }}>
          {meus.map((p) => (
            <CartaoPlano key={p.id} p={p} onAssistir={() => setAssistindo(p)}
              acerto={<AcertoDoPlano p={p} rolls={rolls} partners={partners} porTipo={premium} />}>
              <Btn size="sm" variant="ghost" icon={Repeat} onClick={() => irPara('treinos', { drillPlano: p.uid })}>Drill do plano</Btn>
              <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => setEdit(paraEditar(p))}>Editar</Btn>
              <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => setApagar(p)} aria-label="Apagar" />
            </CartaoPlano>
          ))}
          {exemplos.map((p) => (
            <CartaoPlano key={p.id} p={p} exemplo onAssistir={() => setAssistindo(p)}
              acerto={<AcertoDoPlano p={p} rolls={rolls} partners={partners} porTipo={premium} />}>
              {acoesDoPronto(p)}
            </CartaoPlano>
          ))}
        </div>
      </Card>

      <Card>
        <div className="card-head">
          <h2 className="h-sec">Biblioteca de planos</h2>
          <span className="micro muted">{biblioteca.length} planos</span>
        </div>
        {premium ? (
          <div className="col" style={{ gap: 12 }}>
            {biblioteca.map((p) => (
              <CartaoPlano key={p.id} p={p} onAssistir={() => setAssistindo(p)}>{acoesDoPronto(p)}</CartaoPlano>
            ))}
          </div>
        ) : (
          <Vitrine
            recurso="planos"
            fundo={<div className="col" style={{ gap: 12 }}>{biblioteca.slice(0, 2).map((p) => <CartaoPlano key={p.id} p={p} />)}</div>}
            titulo="A biblioteca inteira de planos"
            texto={`Mais ${biblioteca.length} planos prontos, da branca à roxa, pra ver o mapa e ajustar ao seu jogo.`}
            itens={['Planos de todas as faixas, com finta e reação', 'Quantos planos seus você quiser', 'Taxa de acerto por tipo de adversário']}
            onAssinar={() => pedirOferta('planos')}
          />
        )}
      </Card>

      <EditorPlano
        edit={edit} setEdit={setEdit}
        positions={positions} techniques={techniques} categories={categories} faixa={settings?.faixa}
        onSalvar={async (e) => {
          const pos = positions.find((x) => String(x.id) === String(e.posicaoId));
          const dados = planoNovo({ ...e, posicao: pos?.nome || e.posicao });
          if (!dados.passos.length) { toast('Escolha pelo menos um golpe', 'err'); return; }
          if (e.id) await db.attackPlans.update(e.id, dados);
          else await db.attackPlans.add({ ...dados, criadoEm: Date.now() });
          setEdit(null);
          toast('Plano salvo');
        }}
      />

      <AssistirPlano plano={assistindo} onClose={() => setAssistindo(null)} />

      <Confirmar
        aberto={!!apagar} onClose={() => setApagar(null)}
        titulo="Apagar o plano?" texto={apagar ? `"${apagar.nome}" sai dos seus planos.` : ''}
        onConfirmar={async () => { await db.attackPlans.update(apagar.id, { arquivada: 1 }); setApagar(null); }}
      />
    </div>
  );
}

const rascunho = () => ({ nome: '', posicaoId: '', posicao: '', finta: '', paraAltura: [], paraPeso: [], passos: [{ reacao: '', golpe: '' }] });
const paraEditar = (p) => ({
  id: p.id, nome: p.nome, posicaoId: p.posicaoId || '', posicao: p.posicao || '', finta: p.finta || '',
  paraAltura: p.paraAltura || [], paraPeso: p.paraPeso || [],
  passos: correnteDoPlano(p).passos.map((x) => ({ reacao: x.reacao, golpe: x.golpe })),
});

/* a taxa de acerto do plano: de graça; contra que tipo de adversário, no Premium */
const NOME_TIPO = { leve: 'mais leve', similar: 'peso parecido', pesado: 'mais pesado', alto: 'mais alto', parecida: 'altura parecida', baixo: 'mais baixo' };
function AcertoDoPlano({ p, rolls, partners, porTipo }) {
  const t = taxaDoPlano(p, rolls);
  if (!t.usos) return <p className="micro muted" style={{ marginTop: 8 }}>Ainda sem rola com ele. Marque no registro do rola quando usar.</p>;
  const c = correnteDoPlano(p);
  const tipos = porTipo ? Object.entries(taxaPorTipo(p, rolls, partners)) : [];
  return (
    <div className="micro muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
      Encaixou em <b style={{ color: 'var(--chalk)' }}>{t.encaixes} de {t.usos}</b> {t.usos === 1 ? 'rola' : 'rolas'} ({t.taxa}%)
      {t.morreNo && c.passos[t.morreNo.passo] ? ` · para mais no ${c.passos[t.morreNo.passo].golpe}` : ''}
      {tipos.length > 0 && <div>{tipos.map(([k, v]) => `${NOME_TIPO[k] || k}: ${v.encaixes} de ${v.usos}`).join(' · ')}</div>}
    </div>
  );
}

const alternar = (lista, id) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

/* o cartão: nome, posição e a corrente em miniatura, cada peça na cor do seu tipo */
function CartaoPlano({ p, exemplo = false, onAssistir, acerto = null, children }) {
  const c = correnteDoPlano(p);
  const faixa = FAIXAS.find((f) => f.id === p.faixa);
  return (
    <div className="plano-cartao">
      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="tiny" style={{ fontWeight: 700 }}>{p.nome}</span>
            {exemplo && <span className="plano-selo">exemplo da sua faixa</span>}
          </div>
          <div className="micro muted" style={{ marginTop: 2 }}>
            {p.pronto && faixa ? `a partir da ${faixa.nome.toLowerCase()}` : 'seu plano'}
          </div>
        </div>
        {onAssistir && <Btn size="sm" variant="contorno" icon={Play} onClick={onAssistir}>Ver o mapa</Btn>}
      </div>
      <div className="plano-mini">
        <span className="plano-peca t-posicao">{c.posicao || 'Sem posição'}</span>
        {c.finta && <><ChevronRight size={13} className="muted" /><span className="plano-peca t-finta">{c.finta}</span></>}
        {c.passos.map((x, i) => (
          <React.Fragment key={i}>
            <ChevronRight size={13} className="muted" />
            <span className="plano-peca t-golpe">{x.golpe}</span>
          </React.Fragment>
        ))}
      </div>
      {acerto}
      {children && <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>{children}</div>}
    </div>
  );
}

/* ============================================================
   MONTAR A CORRENTE
   ============================================================ */
function EditorPlano({ edit, setEdit, positions, techniques, categories, faixa, onSalvar }) {
  /* qual campo o seletor de técnica preenche: 'finta' ou o índice do golpe */
  const [escolhendo, setEscolhendo] = useState(null);
  if (!edit) return null;
  const passos = edit.passos;
  const mudarPasso = (i, campo, v) => setEdit({ ...edit, passos: passos.map((x, k) => (k === i ? { ...x, [campo]: v } : x)) });

  return (
    <Sheet
      aberto={!!edit} onClose={() => setEdit(null)}
      titulo={edit.id ? 'Editar plano' : 'Novo plano'}
      footer={<Btn variant="primary" style={{ width: '100%' }} onClick={() => onSalvar(edit)}>Salvar plano</Btn>}
    >
      <Field label="Nome do plano">
        <Input value={edit.nome} placeholder="Ex.: finta da raspagem pra kimura" onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
      </Field>
      <Field label="De onde começa">
        <Select value={edit.posicaoId} onChange={(e) => setEdit({ ...edit, posicaoId: e.target.value })}>
          <option value="">{edit.posicao || 'Escolha a posição'}</option>
          {positions.filter((p) => p.slug !== 'finalizacao' && p.slug !== 'finalizado').map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Select>
      </Field>
      <Field label="A finta (opcional)" hint="O movimento que faz ele reagir do jeito que você quer.">
        <button type="button" className="input plano-escolher" onClick={() => setEscolhendo('finta')}>
          {edit.finta || 'Escolher a finta'}
        </button>
      </Field>

      <Field label="Pra quem serve (opcional)" hint="O parceiro com essa altura ou esse peso vê o plano na ficha dele.">
        <div className="row wrap" style={{ gap: 6 }}>
          {ALTURA_REL.map((o) => (
            <Chip key={o.id} on={edit.paraAltura.includes(o.id)} onClick={() => setEdit({ ...edit, paraAltura: alternar(edit.paraAltura, o.id) })}>{o.nome}</Chip>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
          {PESO_REL.map((o) => (
            <Chip key={o.id} on={edit.paraPeso.includes(o.id)} onClick={() => setEdit({ ...edit, paraPeso: alternar(edit.paraPeso, o.id) })}>{o.nome}</Chip>
          ))}
        </div>
      </Field>

      <div className="col" style={{ gap: 12, marginTop: 6 }}>
        {passos.map((x, i) => (
          <div key={i} className="plano-passo-edit">
            <div className="row" style={{ gap: 8 }}>
              <span className="eyebrow" style={{ flex: 1 }}>{i === 0 ? 'golpe' : `se defender, golpe ${i + 1}`}</span>
              {passos.length > 1 && (
                <button type="button" className="btn ghost xs" aria-label="Tirar este golpe"
                  onClick={() => setEdit({ ...edit, passos: passos.filter((_, k) => k !== i) })}><X size={13} /></button>
              )}
            </div>
            <Input value={x.reacao} placeholder="Como ele reage (ex.: baseia a mão no chão)" onChange={(e) => mudarPasso(i, 'reacao', e.target.value)} />
            <button type="button" className="input plano-escolher" onClick={() => setEscolhendo(i)}>
              {x.golpe || 'Escolher o golpe'}
            </button>
          </div>
        ))}
      </div>
      {passos.length < MAX_PASSOS && (
        <Btn size="sm" variant="ghost" icon={Plus} style={{ marginTop: 10 }}
          onClick={() => setEdit({ ...edit, passos: [...passos, { reacao: '', golpe: '' }] })}>
          Se ele defender, o próximo
        </Btn>
      )}

      <SeletorTecnica
        aberto={escolhendo !== null} onClose={() => setEscolhendo(null)}
        techniques={techniques} categories={categories} positions={positions} faixa={faixa}
        titulo={escolhendo === 'finta' ? 'Qual é a finta' : 'Qual é o golpe'}
        semPosicoes
        onEscolher={(t) => {
          if (escolhendo === 'finta') setEdit({ ...edit, finta: t.nome });
          else mudarPasso(escolhendo, 'golpe', t.nome);
          setEscolhendo(null);
        }}
      />
    </Sheet>
  );
}

/* ============================================================
   O MAPA DO PLANO
   Uma árvore que desce: posição, finta, reação, golpe. Em cada
   golpe a corrente se abre em duas: encaixou (acabou) ou ele
   defendeu (desce pro próximo). Cada tipo tem a sua cor.
   ============================================================ */
const TIPOS_DO_MAPA = [
  { id: 'posicao', nome: 'Posição' },
  { id: 'finta', nome: 'Finta' },
  { id: 'reacao', nome: 'Reação dele' },
  { id: 'golpe', nome: 'Golpe' },
  { id: 'defende', nome: 'Se ele defender' },
];
function LegendaDoMapa() {
  return (
    <div className="mapa-legenda">
      {TIPOS_DO_MAPA.map((t) => <span key={t.id} className={`mapa-tipo t-${t.id}`}><i />{t.nome}</span>)}
    </div>
  );
}

function nosDoMapa(plano) {
  const c = correnteDoPlano(plano);
  const nos = [{ tipo: 'posicao', rotulo: 'De onde começa', titulo: c.posicao || 'A posição' }];
  if (c.finta) nos.push({ tipo: 'finta', rotulo: 'A finta', titulo: c.finta });
  c.passos.forEach((x, i) => {
    if (i > 0) nos.push({ tipo: 'defende', rotulo: 'Se ele defender', titulo: '' });
    if (x.reacao) nos.push({ tipo: 'reacao', rotulo: i === 0 ? 'Ele reage' : 'A defesa dele', titulo: x.reacao });
    nos.push({ tipo: 'golpe', rotulo: c.passos.length > 1 ? `Golpe ${i + 1}` : 'O golpe', titulo: x.golpe, detalhe: x.detalhe });
  });
  nos.push({ tipo: 'fim', rotulo: 'Se ele defender tudo', titulo: c.fim || 'Volta pra posição e recomeça a corrente' });
  return nos;
}

function MapaDoPlano({ plano, ate = Infinity }) {
  const nos = nosDoMapa(plano).slice(0, ate + 1);
  return (
    <div className="mapa">
      {nos.map((n, i) => (n.tipo === 'defende' ? (
        <div key={i} className="mapa-defende t-defende" style={{ '--i': i }}>
          <ArrowDown size={13} /> {n.rotulo}
        </div>
      ) : (
        <div key={i} className={`mapa-no t-${n.tipo}`} style={{ '--i': i }}>
          <span className="mapa-rotulo">{n.rotulo}</span>
          <div className="mapa-titulo">{n.titulo}</div>
          {n.detalhe && <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.55 }}>{n.detalhe}</p>}
          {n.tipo === 'golpe' && <span className="mapa-encaixou"><Check size={12} /> Encaixou</span>}
        </div>
      )))}
    </div>
  );
}

function AssistirPlano({ plano, onClose }) {
  /* abre com o mapa inteiro, entrando em cascata; o passo a passo
     revela um nó por toque, pra ensaiar de cabeça */
  const [ate, setAte] = useState(Infinity);
  if (!plano) return null;
  const total = nosDoMapa(plano).length;
  const fechar = () => { setAte(Infinity); onClose(); };
  const passoAPasso = ate !== Infinity;
  const acabou = !passoAPasso || ate >= total - 1;

  return (
    <Sheet aberto onClose={fechar} titulo={plano.nome} subtitulo="o mapa do plano">
      <LegendaDoMapa />
      <MapaDoPlano key={passoAPasso ? 'passo' : 'tudo'} plano={plano} ate={ate} />
      <div className="row" style={{ gap: 8, marginTop: 14 }}>
        {acabou ? (
          <Btn variant="contorno" icon={RotateCcw} style={{ flex: 1 }} onClick={() => setAte(0)}>Ver passo a passo</Btn>
        ) : (
          <>
            <Btn variant="primary" icon={ChevronRight} style={{ flex: 1 }} onClick={() => setAte((n) => n + 1)}>Próximo</Btn>
            <Btn variant="ghost" onClick={() => setAte(Infinity)}>Ver tudo</Btn>
          </>
        )}
      </div>
    </Sheet>
  );
}
