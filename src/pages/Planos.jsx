import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Play, Pencil, Trash2, Route, ChevronRight, RotateCcw, X, Repeat, Check, Ruler, Weight, Flag, CircleHelp,
  Sparkles, Target, Shield, Users,
} from 'lucide-react';
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
  taxaDoPlano, taxaPorTipo, arvoreDoPlano, semOGolpe, MAX_TRILHOS, LETRAS,
} from '../lib/planos';
import { FAIXAS } from '../lib/faixas';
import { PESO_REL } from '../db/scoring';

/* ============================================================
   PLANOS DE ATAQUE

   Da posição, a finta; vem o golpe; encaixou, o próximo; se ele
   defender, o Plano B. Cada um começa com 3 exemplos da faixa dele na lista
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
          <p className="tiny muted" style={{ marginTop: 4 }}>Do primeiro golpe até onde você quer chegar. Se ele defender, tem o Plano B.</p>
        </div>
        <Btn variant="primary" icon={Plus} onClick={() => liberado() && setEdit(rascunho())}>Criar plano</Btn>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Guia topicos={[{
          id: 'como', icone: Route, titulo: 'Como funciona um plano de ataque',
          resumo: 'Golpe atrás de golpe, com Plano B se ele defender',
          conteudo: (
            <>
              <LegendaDoMapa />
              {GUIA_DO_PLANO[0].conteudo}
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

const passoVazio = (pai = null, via = null) => ({ reacao: '', golpe: '', pai, via });
const rascunho = () => ({ nome: '', posicaoId: '', posicao: '', finta: '', objetivo: '', paraAltura: [], paraPeso: [], passos: [passoVazio()] });
const paraEditar = (p) => ({
  id: p.id, nome: p.nome, posicaoId: p.posicaoId || '', posicao: p.posicao || '', finta: p.finta || '', objetivo: p.objetivo || '',
  paraAltura: p.paraAltura || [], paraPeso: p.paraPeso || [],
  passos: correnteDoPlano(p).passos.map((x) => ({ reacao: x.reacao, golpe: x.golpe, pai: x.pai, via: x.via })),
});

const juntar = (l) => (l.length < 2 ? l[0] : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`);

/* o "?" do plano: cada pergunta abre a sua resposta */
const GUIA_DO_PLANO = [
  {
    id: 'como', icone: Route, titulo: 'Como montar um plano', resumo: 'Do primeiro golpe até onde você quer chegar',
    conteudo: (
      <Passos itens={[
        'De onde começa: em pé, guarda fechada, meia-guarda, montada...',
        'Onde quero chegar: a finalização ou a posição que você busca desde o começo.',
        'A finta, se tiver: o movimento que engana ele e abre o seu golpe.',
        'O primeiro golpe: o que você quer fazer de verdade.',
        'Encaixou, e depois? Vai somando golpe atrás de golpe. Esse caminho todo verde é o Plano A.',
        'Se ele defender: abre o Plano B, que pode ir por outro caminho até chegar lá.',
      ]} />
    ),
  },
  {
    id: 'finta', icone: Sparkles, titulo: 'O que é a finta', resumo: 'O golpe de mentira que faz ele reagir',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        Você ameaça uma coisa pra ele defender, e a defesa dele abre o que você quer de verdade. Exemplo: ameaça a raspagem de
        gancho, ele baseia a mão no chão, e o braço fica no ponto pra kimura. Não tem finta? Deixa em branco e começa direto no golpe.
      </p>
    ),
  },
  {
    id: 'golpe', icone: Target, titulo: 'Seu golpe e a deixa dele', resumo: 'O que você faz e o que ele faz antes',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        Seu golpe é o que você faz, e sai da lista. A deixa é o que ele faz que abre esse golpe, escrito do seu jeito: "baseia a mão
        no chão", "vira de lado", "esconde o braço". A deixa é opcional, mas ajuda a lembrar a hora certa no meio do rola.
      </p>
    ),
  },
  {
    id: 'encaixou', icone: Check, titulo: 'Encaixou, e depois?', resumo: 'Golpe atrás de golpe, tudo verde',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        O golpe deu certo, mas o rola não acaba ali. Queda, passou a guarda, estabilizou, foi pra norte-sul, armlock: cada um que
        encaixa puxa o próximo. No mapa, esse caminho desce reto no mesmo trilho.
      </p>
    ),
  },
  {
    id: 'defender', icone: Shield, titulo: 'Se ele defender', resumo: 'Plano B, C e D no mesmo mapa',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        Em qualquer golpe dá pra marcar o que fazer se ele defender. Não saiu a queda? Puxa pra guarda, raspa, e o caminho volta
        pra cima dele. Cada desvio vira um trilho com cor própria no mapa: Plano B, C e D.
      </p>
    ),
  },
  {
    id: 'serve', icone: Users, titulo: 'Pra quem serve', resumo: 'Altura e peso dele, separados',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        Marca pra que tipo de parceiro o plano funciona. Quem tiver essa altura ou esse peso vê o plano na ficha dele. Dá pra
        marcar só a altura, só o peso ou os dois.
      </p>
    ),
  },
];

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

/* o cartão: nome, posição e o Plano A em miniatura; os outros planos num selo */
function CartaoPlano({ p, exemplo = false, onAssistir, acerto = null, children }) {
  const c = correnteDoPlano(p);
  const { ordem, trilho, trilhos } = arvoreDoPlano(c.passos);
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
        {ordem.filter((i) => trilho[i] === 0).map((i) => (
          <React.Fragment key={i}>
            <ChevronRight size={13} className="muted" />
            <span className="plano-peca t-golpe">{c.passos[i].golpe}</span>
          </React.Fragment>
        ))}
        {trilhos > 1 && <span className="plano-peca t-defende">+ {trilhos === 2 ? 'Plano B' : `Planos ${juntar(LETRAS.slice(1, trilhos))}`}</span>}
      </div>
      {c.objetivo && <div className="plano-objetivo micro"><Flag size={12} /> Onde quer chegar: <b>{c.objetivo}</b></div>}
      {acerto}
      {children && <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>{children}</div>}
    </div>
  );
}

/* ============================================================
   MONTAR A ÁRVORE
   Os golpes aparecem na ordem do mapa (Plano A, depois B...). Cada
   um diz de onde vem e abre os seus dois caminhos.
   ============================================================ */
const DEIXA = {
  raiz: { label: 'A deixa dele (opcional)', exemplo: 'O que ele faz que abre o golpe (ex.: baseia a mão no chão)' },
  encaixou: { label: 'O que ele faz agora (opcional)', exemplo: 'Ex.: vira de lado, empurra seu quadril' },
  defendeu: { label: 'Como ele defendeu (opcional)', exemplo: 'Ex.: esconde o braço, posta a mão' },
};

function EditorPlano({ edit, setEdit, positions, techniques, categories, faixa, onSalvar }) {
  /* qual campo o seletor de técnica preenche: 'finta', 'objetivo' ou o índice do golpe */
  const [escolhendo, setEscolhendo] = useState(null);
  const [ajuda, setAjuda] = useState(false);
  if (!edit) return null;
  const passos = edit.passos;
  const { ordem, trilho, filhos, trilhos } = arvoreDoPlano(passos);
  const cabe = passos.length < MAX_PASSOS;
  const mudarPasso = (i, campo, v) => setEdit({ ...edit, passos: passos.map((x, k) => (k === i ? { ...x, [campo]: v } : x)) });
  const abrir = (pai, via) => setEdit({ ...edit, passos: [...passos, passoVazio(pai, via)] });

  return (
    <Sheet
      aberto={!!edit} onClose={() => setEdit(null)}
      titulo={edit.id ? 'Editar plano' : 'Novo plano'}
      footer={<Btn variant="primary" style={{ width: '100%' }} onClick={() => onSalvar(edit)}>Salvar plano</Btn>}
    >
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <p className="micro muted" style={{ flex: 1, lineHeight: 1.5 }}>Monte o caminho golpe a golpe: o que fazer quando encaixa e quando ele defende.</p>
        <Btn size="sm" variant="ghost" icon={CircleHelp} onClick={() => setAjuda(true)}>Entenda</Btn>
      </div>

      <Field label="Nome do plano">
        <Input value={edit.nome} placeholder="Ex.: da queda até o armlock" onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
      </Field>
      <Field label="De onde começa">
        <Select value={edit.posicaoId} onChange={(e) => setEdit({ ...edit, posicaoId: e.target.value })}>
          <option value="">{edit.posicao || 'Escolha a posição'}</option>
          {positions.filter((p) => p.slug !== 'finalizacao' && p.slug !== 'finalizado').map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Select>
      </Field>
      <Field label="Onde quero chegar (opcional)" hint="A finalização ou a posição que você busca desde o começo.">
        <button type="button" className="input plano-escolher" onClick={() => setEscolhendo('objetivo')}>
          {edit.objetivo || 'Escolher o objetivo'}
        </button>
      </Field>
      <Field label="A finta (opcional)" hint="O golpe de mentira que faz ele reagir do jeito que você quer.">
        <button type="button" className="input plano-escolher" onClick={() => setEscolhendo('finta')}>
          {edit.finta || 'Escolher a finta'}
        </button>
      </Field>

      <Field label="Pra quem serve (opcional)" hint="O parceiro com essa altura ou esse peso vê o plano na ficha dele.">
        <div className="chips-grupo">
          <span className="chips-grupo-nome"><Ruler size={13} /> Altura dele</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {ALTURA_REL.map((o) => (
              <Chip key={o.id} on={edit.paraAltura.includes(o.id)} onClick={() => setEdit({ ...edit, paraAltura: alternar(edit.paraAltura, o.id) })}>{o.nome}</Chip>
            ))}
          </div>
        </div>
        <div className="chips-grupo">
          <span className="chips-grupo-nome"><Weight size={13} /> Peso dele</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {PESO_REL.map((o) => (
              <Chip key={o.id} on={edit.paraPeso.includes(o.id)} onClick={() => setEdit({ ...edit, paraPeso: alternar(edit.paraPeso, o.id) })}>{o.nome}</Chip>
            ))}
          </div>
        </div>
      </Field>

      <div className="eyebrow" style={{ marginTop: 18 }}>O caminho</div>
      <div className="col" style={{ gap: 12, marginTop: 8 }}>
        {ordem.map((i) => {
          const x = passos[i];
          const tipo = x.pai === null ? 'raiz' : x.via;
          const plano = LETRAS[trilho[i]];
          return (
            <div key={i} className={`plano-passo-edit trilho-${trilho[i]}`}>
              <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className={`plano-via ${tipo}`}>
                    {tipo === 'raiz' && '1º golpe'}
                    {tipo === 'encaixou' && <><Check size={13} strokeWidth={3} /> Encaixou, e depois?</>}
                    {tipo === 'defendeu' && <><X size={13} strokeWidth={3} /> Se ele defender</>}
                  </span>
                  {x.pai !== null && <div className="micro muted" style={{ marginTop: 2 }}>vem de: {passos[x.pai].golpe || 'o golpe de cima'}</div>}
                </div>
                <span className="plano-trilho-selo">Plano {plano}</span>
                {x.pai !== null && (
                  <button type="button" className="btn ghost xs" aria-label="Tirar este golpe e o que vem depois dele"
                    onClick={() => setEdit({ ...edit, passos: semOGolpe(passos, i) })}><X size={13} /></button>
                )}
              </div>
              <Field label="Seu golpe">
                <button type="button" className="input plano-escolher" onClick={() => setEscolhendo(i)}>
                  {x.golpe || 'Escolher o golpe'}
                </button>
              </Field>
              <Field label={DEIXA[tipo].label}>
                <Input value={x.reacao}
                  placeholder={tipo === 'raiz' && edit.finta ? 'Como ele reage à finta (ex.: baseia a mão no chão)' : DEIXA[tipo].exemplo}
                  onChange={(e) => mudarPasso(i, 'reacao', e.target.value)} />
              </Field>
              {cabe && (filhos[i].encaixou === undefined || (filhos[i].defendeu === undefined && trilhos < MAX_TRILHOS)) && (
                <div className="row wrap" style={{ gap: 6 }}>
                  {filhos[i].encaixou === undefined && (
                    <Btn size="sm" variant="ghost" icon={Plus} className="plano-mais encaixou" onClick={() => abrir(i, 'encaixou')}>Encaixou, e depois?</Btn>
                  )}
                  {filhos[i].defendeu === undefined && trilhos < MAX_TRILHOS && (
                    <Btn size="sm" variant="ghost" icon={Plus} className="plano-mais defendeu" onClick={() => abrir(i, 'defendeu')}>Se ele defender</Btn>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!cabe && <p className="micro muted" style={{ marginTop: 10 }}>Chegou nos {MAX_PASSOS} golpes, o máximo de um plano.</p>}

      <SeletorTecnica
        aberto={escolhendo !== null} onClose={() => setEscolhendo(null)}
        techniques={techniques} categories={categories} positions={positions} faixa={faixa}
        titulo={escolhendo === 'finta' ? 'Qual é a finta' : escolhendo === 'objetivo' ? 'Onde você quer chegar' : 'Qual é o golpe'}
        semPosicoes
        onEscolher={(t) => {
          if (escolhendo === 'finta' || escolhendo === 'objetivo') setEdit({ ...edit, [escolhendo]: t.nome });
          else mudarPasso(escolhendo, 'golpe', t.nome);
          setEscolhendo(null);
        }}
      />

      <Sheet aberto={ajuda} onClose={() => setAjuda(false)} titulo="Como montar o plano">
        <LegendaDoMapa />
        <Guia topicos={GUIA_DO_PLANO} inicial="como" />
      </Sheet>
    </Sheet>
  );
}

/* ============================================================
   O MAPA DO PLANO
   Trilhos, tipo mapa de metrô: cada plano (A, B, C, D) é um trilho
   com cor própria. Encaixou desce no mesmo trilho; se ele defender,
   o fio faz a curva pro trilho do plano seguinte. As linhas são
   desenhadas por cima, medindo onde cada peça caiu.
   ============================================================ */
const LARGURA_TRILHO = 18;
const xDoTrilho = (t) => 9 + t * LARGURA_TRILHO;

function LegendaDoMapa({ trilhos = 2, finta = true }) {
  return (
    <div className="mapa-legenda">
      <span className="mapa-tipo t-posicao"><i />Posição</span>
      {finta && <span className="mapa-tipo t-finta"><i />Finta</span>}
      {LETRAS.slice(0, trilhos).map((l, t) => <span key={l} className={`mapa-tipo trilho-${t}`}><i />Plano {l}</span>)}
      <span className="mapa-tipo" style={{ color: 'var(--jade)' }}><Check size={12} strokeWidth={3} />Encaixou</span>
      <span className="mapa-tipo" style={{ color: 'var(--mp-defende, #ff7a6b)' }}><X size={12} strokeWidth={3} />Se ele defender</span>
    </div>
  );
}

/* cada linha do mapa: posição, finta e os golpes na ordem de leitura;
   "de" é a linha de onde nasce o fio */
function linhasDoMapa(plano) {
  const c = correnteDoPlano(plano);
  const { ordem, trilho, filhos } = arvoreDoPlano(c.passos);
  const linhas = [{ tipo: 'posicao', trilho: 0, rotulo: 'De onde começa', titulo: c.posicao || 'A posição' }];
  if (c.finta) linhas.push({ tipo: 'finta', trilho: 0, rotulo: 'A finta', titulo: c.finta, de: 0 });
  const antesDoGolpe = linhas.length - 1;
  const linhaDoPasso = {};
  const fimDoA = ordem.filter((i) => trilho[i] === 0).pop();
  const ultimo = c.passos.length - 1;
  ordem.forEach((i) => {
    const x = c.passos[i];
    linhaDoPasso[i] = linhas.length;
    linhas.push({
      tipo: 'golpe', trilho: trilho[i], via: x.pai === null ? 'raiz' : x.via,
      de: x.pai === null ? antesDoGolpe : linhaDoPasso[x.pai],
      deixa: x.reacao || (x.via === 'defendeu' ? c.passos[x.pai].defesa : ''),
      titulo: x.golpe, detalhe: x.detalhe,
      encaixouFim: filhos[i].encaixou === undefined,
      segue: i === ultimo ? c.segue : '',
      fim: i === ultimo && filhos[i].defendeu === undefined ? c.fim : '',
      objetivo: i === fimDoA ? c.objetivo : '',
    });
  });
  return { objetivo: c.objetivo, finta: !!c.finta, linhas: linhas.map((l, n) => ({ ...l, n })) };
}

function NoDoMapa({ l, guardar }) {
  const classe = l.tipo === 'golpe' ? `trilho-${l.trilho}` : `t-${l.tipo}`;
  return (
    <div ref={guardar(l.n)} className={`mapa-no ${classe}`} style={{ '--i': l.n }}>
      {l.tipo !== 'golpe' ? (
        <span className="mapa-rotulo">{l.rotulo}</span>
      ) : (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className={`mapa-rotulo ${l.via}`}>
            {l.via === 'raiz' && '1º golpe'}
            {l.via === 'encaixou' && <><Check size={12} strokeWidth={3} /> Encaixou, e depois</>}
            {l.via === 'defendeu' && <><X size={12} strokeWidth={3} /> Se ele defender</>}
          </span>
          {l.via === 'defendeu' && <span className="plano-trilho-selo">Plano {LETRAS[l.trilho]}</span>}
        </div>
      )}
      {l.deixa && <div className="mapa-deixa">{l.deixa}</div>}
      <div className="mapa-titulo">{l.titulo}</div>
      {l.detalhe && <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.5 }}>{l.detalhe}</p>}
      {l.tipo === 'golpe' && l.encaixouFim && (
        <div className="row wrap" style={{ gap: 6, marginTop: 9 }}>
          {l.objetivo ? (
            <span className="mapa-folha segue mapa-chegada"><span className="row" style={{ gap: 5 }}><Flag size={13} /> Encaixou: chegou lá</span><span className="mapa-segue">{l.objetivo}</span></span>
          ) : (
            <span className={`mapa-folha${l.segue ? ' segue' : ''}`}>
              <span className="row" style={{ gap: 5 }}><Check size={13} /> Encaixou</span>
              {l.segue && <span className="mapa-segue">depois: {l.segue.replace(/-/g, '‑')}</span>}
            </span>
          )}
        </div>
      )}
      {l.fim && <p className="micro" style={{ marginTop: 8, color: 'var(--mp-defende)', lineHeight: 1.5 }}>Se ele defender tudo: {l.fim}</p>}
    </div>
  );
}

function MapaDoPlano({ plano, ate = Infinity }) {
  const { objetivo, linhas: todas } = useMemo(() => linhasDoMapa(plano), [plano]);
  const linhas = useMemo(() => todas.filter((l) => l.n <= ate), [todas, ate]);
  const trilhos = Math.max(...todas.map((l) => l.trilho)) + 1;
  const caixa = useRef(null);
  const pecas = useRef({});
  const [fios, setFios] = useState({ fios: [], pontos: [] });
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const guardar = (n) => (el) => { pecas.current[n] = el; };

  useLayoutEffect(() => {
    const onde = (n) => {
      const el = pecas.current[n];
      return el && el.offsetHeight ? { y: el.offsetTop + Math.min(22, el.offsetHeight / 2), x: el.offsetLeft } : null;
    };
    const medir = () => {
      const pontos = linhas.map((l) => ({ l, p: onde(l.n) })).filter((o) => o.p);
      const lista = linhas.filter((l) => l.de !== undefined).map((l) => {
        const a = onde(l.de);
        const b = onde(l.n);
        if (!a || !b) return null;
        const t1 = todas[l.de].trilho;
        const x1 = xDoTrilho(t1);
        const x2 = xDoTrilho(l.trilho);
        const curva = Math.min(34, (b.y - a.y) * 0.6);
        const d = t1 === l.trilho
          ? `M${x1} ${a.y} L${x2} ${b.y}`
          : `M${x1} ${a.y} C${x1} ${a.y + curva * 0.7} ${x2} ${a.y + curva * 0.3} ${x2} ${a.y + curva} L${x2} ${b.y}`;
        return { n: l.n, de: t1, para: l.trilho, x1, y1: a.y, x2, y2: b.y, d };
      }).filter(Boolean);
      setFios({ fios: lista, pontos: pontos.map(({ l, p }) => ({ n: l.n, x: xDoTrilho(l.trilho), y: p.y, ate: p.x, l })) });
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(caixa.current);
    return () => ro.disconnect();
  }, [linhas, todas]);

  const corDoPonto = (l) => (l.tipo === 'golpe' ? `var(--tr-${l.trilho})` : `var(--mp-${l.tipo})`);

  return (
    <>
      {objetivo && <div className="mapa-objetivo"><Flag size={15} /> <span>Onde quer chegar: <b>{objetivo}</b></span></div>}
      <div className="mapa trilhos" ref={caixa} style={{ '--nt': trilhos }}>
        <svg className="mapa-fios" aria-hidden="true">
          <defs>
            {fios.fios.map((f) => (
              <linearGradient key={f.n} id={`${id}-${f.n}`} gradientUnits="userSpaceOnUse" x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2}>
                <stop offset="0" style={{ stopColor: `var(--tr-${f.de})` }} />
                <stop offset="1" style={{ stopColor: `var(--tr-${f.para})` }} />
              </linearGradient>
            ))}
          </defs>
          {fios.fios.map((f) => (
            <g key={f.n} className="mapa-fio" style={{ '--i': f.n }}>
              <path d={f.d} pathLength="1" className="mapa-fio-traco" stroke={`url(#${id}-${f.n})`} />
              <path d={f.d} pathLength="1" className="mapa-fio-luz" />
            </g>
          ))}
          {fios.pontos.map((p) => (
            <g key={p.n} className="mapa-fio-ponta" style={{ '--i': p.n }}>
              <path d={`M${p.x} ${p.y} H${p.ate}`} className="mapa-ramal" style={{ stroke: corDoPonto(p.l) }} />
              <circle cx={p.x} cy={p.y} r="5" className="mapa-estacao" style={{ fill: corDoPonto(p.l) }} />
            </g>
          ))}
        </svg>
        {linhas.map((l) => <NoDoMapa key={l.n} l={l} guardar={guardar} />)}
      </div>
    </>
  );
}

function AssistirPlano({ plano, onClose }) {
  /* abre com o mapa inteiro, entrando em cascata; o passo a passo
     revela uma peça por toque, pra ensaiar de cabeça */
  const [ate, setAte] = useState(Infinity);
  if (!plano) return null;
  const { linhas, finta } = linhasDoMapa(plano);
  const total = linhas.length;
  const trilhos = Math.max(...linhas.map((l) => l.trilho)) + 1;
  const fechar = () => { setAte(Infinity); onClose(); };
  const passoAPasso = ate !== Infinity;
  const acabou = !passoAPasso || ate >= total - 1;

  return (
    <Sheet aberto onClose={fechar} titulo={plano.nome} subtitulo="o mapa do plano">
      <LegendaDoMapa trilhos={trilhos} finta={finta} />
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
