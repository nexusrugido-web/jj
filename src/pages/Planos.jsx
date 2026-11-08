import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Play, Pencil, Trash2, Route, ChevronRight, RotateCcw, X, Repeat, Check, Ruler, Weight, Flag, CircleHelp,
  Sparkles, Target, Shield, Users, GripVertical, DoorOpen, CornerDownRight, Undo2, GitMerge, Hand, Ban,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../contexto';
import { db } from '../db/db';
import {
  Card, Btn, Field, Input, Select, Sheet, Chip, Confirmar, useToast,
} from '../components/UI';
import Guia, { Passos } from '../components/Guia';
import { Vitrine } from '../components/Plano';
import { SeletorTecnica, ListaDeFamilias } from '../components/SeletorTecnica';
import { FAMILIAS, FAMILIA_POR_ID, nomeDoItem, quantasVariacoes, variacoesEmResumo } from '../lib/familias';
import { nomeAtual } from '../db/renomeios';
import { podeVer, pedirOferta } from '../lib/plano';
import {
  meusPlanos, planosProntos, exemplosDaFaixa, podeCriarPlano, correnteDoPlano, planoNovo, ALTURA_REL,
  taxaDoPlano, taxaPorTipo, arvoreDoPlano, semOGolpe, letraDo, novoId, removidosAoSalvar, VIAS,
  semAFinta, fintaAntes, moverPasso, chegaNoObjetivo, finaliza, pontasSoltas, semGatilho, OBJETIVO_FINALIZAR,
  destinosDaLigacao, comLigacao, situacaoNoObjetivo, continua, escolhaDaFinalizacao, jaCoberta, limparAceitas,
  nomeDaPosicao, FINTA_MAX, QUALQUER, escolherPraQuem, PREPARACOES, ehTexto,
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
  /* onde cada técnica do catálogo termina: é o que diz se um golpe chega no objetivo */
  const destinoDe = useMemo(() => {
    const pos = new Map(positions.map((x) => [x.id, x]));
    const tec = new Map(techniques.map((t) => [t.nome, t]));
    /* o golpe gravado com um nome que mudou (técnicas que juntaram) acha a de hoje */
    /* .tecnicas: a família que a pessoa confirmou na técnica dela também conta */
    return Object.assign((nome) => pos.get((tec.get(nome) || tec.get(nomeAtual(nome)))?.destinoId) || null, { tecnicas: techniques });
  }, [positions, techniques]);

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
        positions={positions} techniques={techniques} categories={categories} faixa={settings?.faixa} destinoDe={destinoDe}
        onSalvar={async (e) => {
          if (!e.objetivo) { toast('Escolha onde você quer chegar', 'err'); return; }
          const dados = planoNovo({ ...e, posicao: nomeDaPosicao(e, positions), tecnicas: techniques });
          if (!dados.passos.length) { toast('Escolha pelo menos um golpe', 'err'); return; }
          if (e.id) await db.attackPlans.update(e.id, { ...dados, removidos: removidosAoSalvar(await db.attackPlans.get(e.id), dados) });
          else await db.attackPlans.add({ ...dados, criadoEm: Date.now() });
          setEdit(null);
          toast('Plano salvo');
        }}
      />

      <AssistirPlano plano={assistindo} destinoDe={destinoDe} onClose={() => setAssistindo(null)} />

      <Confirmar
        aberto={!!apagar} onClose={() => setApagar(null)}
        titulo="Apagar o plano?" texto={apagar ? `"${apagar.nome}" sai dos seus planos.` : ''}
        onConfirmar={async () => { await db.attackPlans.update(apagar.id, { arquivada: 1 }); setApagar(null); }}
      />
    </div>
  );
}

const rascunho = () => ({ nome: '', posicaoId: '', posicao: '', objetivo: '', objetivoTipo: '', finalizacaoPreferida: '', finalizacoesAceitas: [], paraAltura: [], paraPeso: [], passos: [], ligacoes: [] });
const paraEditar = (p) => {
  const c = correnteDoPlano(p);
  return {
    id: p.id, nome: p.nome, posicaoId: p.posicaoId || '', posicao: p.posicao || '', objetivo: c.objetivo, objetivoTipo: c.objetivoTipo,
    finalizacaoPreferida: c.finalizacaoPreferida || '', finalizacoesAceitas: c.finalizacoesAceitas || [],
    paraAltura: p.paraAltura || [], paraPeso: p.paraPeso || [], tecUid: p.tecUid || {},
    passos: c.passos.map((x) => ({
      id: x.id, lig: x.lig, tipo: x.tipo, golpe: x.golpe, detalhe: x.detalhe, pai: x.pai, via: x.via,
      ...(x.golpeUid ? { golpeUid: x.golpeUid } : {}),
      reacao: x.reacao || (x.via === 'defendeu' ? c.passos[x.pai].defesa : ''),
    })),
    ligacoes: c.ligacoes,
  };
};

const juntar = (l) => (l.length < 2 ? l[0] : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`);
/* o texto da peça fora do cartão: a finta é o que ele finge, a preparação é o que você monta, a situação é onde a luta foi */
const nomeDaPrep = (id) => PREPARACOES.find((p) => p.id === id)?.nome || 'Preparação';
const textoDaPeca = (x) => (x.tipo === 'finta' ? `Finta: ${x.golpe}` : x.tipo === 'preparacao' ? `${nomeDaPrep(x.prep)}: ${x.golpe}`
  : x.tipo === 'situacao' ? `A luta foi pra ${x.golpe}` : x.golpe);
/* finalizar: a preferida na frente, as aceitas depois; sem lista, qualquer uma serve */
const textoDoObjetivo = (c) => {
  if (c.objetivoTipo === 'familia') return nomeDoItem(c.objetivo, true);
  if (c.objetivoTipo !== 'finalizar') return c.objetivo;
  const aceitas = (c.finalizacoesAceitas || []).map((n) => nomeDoItem(n));
  if (c.finalizacaoPreferida) return `Finalizar, de preferência com ${nomeDoItem(c.finalizacaoPreferida)}${aceitas.length ? ` (também vale ${juntar(aceitas)})` : ''}`;
  return aceitas.length ? `Finalizar com ${aceitas.length < 2 ? aceitas[0] : `${aceitas.slice(0, -1).join(', ')} ou ${aceitas[aceitas.length - 1]}`}` : 'Finalizar (qualquer finalização serve)';
};

/* "Ainda não chega ..." */
const chegaEm = (c) => (c.objetivoTipo === 'finalizar' ? 'em uma finalização'
  : c.objetivoTipo === 'familia' ? FAMILIA_POR_ID.get(c.objetivo)?.num || 'na finalização' : `em ${c.objetivo}`);

/* o "?" do plano: cada pergunta abre a sua resposta */
const GUIA_DO_PLANO = [
  {
    id: 'como', icone: Route, titulo: 'Como montar um plano', resumo: 'De onde você está até onde quer chegar',
    conteudo: (
      <Passos itens={[
        'Onde quero chegar: finalizar, uma família de finalização (qualquer armlock, qualquer kimura...), uma posição ou um golpe. É o que o plano persegue do começo ao fim.',
        'De onde começa: em pé, guarda fechada, meia-guarda, montada...',
        'O primeiro golpe, ou uma finta ou uma preparação antes dele. Dá pra abrir outras entradas da mesma posição: Finta A, B ou C, você escolhe na hora.',
        'Encaixou, e depois? Vai somando golpe até chegar no objetivo. Esse caminho é o Plano A.',
        'Se ele defender: cada defesa dele abre o seu plano (B, C...), com a sua continuação pro mesmo objetivo.',
        'Se ele escapar: marque onde a luta ficou e monte dali como volta a atacar, atrás do mesmo objetivo.',
        'Cada caminho diz o que ele fez: reagiu, não reagiu, defendeu ou escapou de um jeito. É isso que você reconhece na hora.',
        'Dois caminhos levam pro mesmo golpe? Liga no que já está no mapa, sem repetir o cartão.',
        'Tudo no mapa: o + põe uma peça, tocar numa peça muda ela, e a alça leva a peça pra outro galho.',
      ]} />
    ),
  },
  {
    id: 'objetivo', icone: Flag, titulo: 'Onde quero chegar', resumo: 'O que o plano persegue',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        Todo plano tem um objetivo: finalizar, chegar numa posição, como as costas ou a montada, ou um
        golpe específico. O golpe que chega lá ganha a bandeira. Uma raspagem ou uma passagem que encaixa no meio do caminho ainda
        não é a chegada: é o que te deixa mais perto. E se ele defender e não tiver mais caminho, o plano fecha ali.
        No finalizar, se quiser, diga a sua preferida (tipo o armlock) e as que você também aceita (triângulo, kimura, omoplata).
        A preferida ganha a bandeira forte. A lista é o que você prioriza, não uma proibição: apareceu uma guilhotina e
        encaixou, o objetivo foi alcançado do mesmo jeito. Já se o objetivo é um golpe específico, só ele conta.
        E o cartão é a tentativa: o objetivo só é alcançado quando a finalização encaixa.
      </p>
    ),
  },
  {
    id: 'escapou', icone: DoorOpen, titulo: 'Defendeu ou escapou', resumo: 'Parar o golpe não é sair da posição',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        Defendeu: ele parou o golpe, mas você continua na posição que sustenta o ataque e emenda outro dali. Escapou: ele saiu do
        controle e a luta mudou de lugar, tipo tirou o braço do armlock e recuperou a guarda. Aí você marca onde a luta ficou e monta,
        a partir dali, como volta a atacar. O objetivo continua o mesmo: perder a posição não é perder o plano, é achar outro caminho
        até ele. E se daquela situação não tiver ataque que faça sentido, deixa sem continuação: o caminho fecha ali, sem jogada
        inventada. E se a fuga deixar a luta justo na posição que você quer? Ainda não conta: foi ele que saiu do controle. Falta a
        ação que estabelece o controle da posição, e é nela que a bandeira entra.
      </p>
    ),
  },
  {
    id: 'convergir', icone: GitMerge, titulo: 'Caminhos que se encontram', resumo: 'Ligar numa peça que já está no mapa',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        Três fintas diferentes podem abrir o mesmo armlock. Em vez de montar o armlock três vezes, monta uma vez e liga as outras
        nele: no +, escolhe "Ou segue numa peça que já está no mapa". O cartão é um só, mas cada caminho até ele guarda o que ele fez
        naquele caminho. Vale pra fuga também: se ele escapou e a luta voltou pra onde começou, ou pra uma posição que já está no
        mapa, liga nela. No mapa, a ligação aparece como um atalho com fio tracejado até a peça.
      </p>
    ),
  },
  {
    id: 'finta', icone: Sparkles, titulo: 'O que é a finta', resumo: 'A ameaça que faz ele reagir',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        A finta é uma peça própria, separada do golpe. Você ameaça uma coisa pra ele reagir, e a reação abre o golpe de verdade.
        Exemplo: ameaça a guilhotina, ele levanta a cabeça e apoia a mão no chão, e o braço fica no ponto pra kimura. Dá pra pôr
        finta antes de qualquer golpe, em qualquer plano, e uma finta atrás da outra. E se ele não reagir? A finta tem a saída
        "não reagiu": você troca a ameaça ou parte pra outra coisa. Não tem finta? Começa direto no golpe.
      </p>
    ),
  },
  {
    id: 'preparacao', icone: Hand, titulo: 'O que é a preparação', resumo: 'Pegada, desequilíbrio, ajuste de pressão',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        A preparação é o que você monta antes do golpe: a pegada, o desequilíbrio, o ajuste de pressão. Ela não é finta: não
        engana ninguém nem espera reação, é o que deixa o golpe possível. Exemplo: pega a gola e a manga, puxa ele pra frente,
        e só aí entra a raspagem. E se ele não deixar (quebrou a pegada, afastou o quadril)? A preparação tem a saída "não
        deixou": você monta de novo de outro jeito ou parte pra outra coisa.
      </p>
    ),
  },
  {
    id: 'reacao', icone: Target, titulo: 'Reação e defesa', resumo: 'O que ele faz, na ordem em que acontece',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        São duas coisas diferentes. A reação vem depois da finta: é o que ele faz porque acreditou nela ("levantou a cabeça",
        "apoiou a mão no chão"). A defesa vem depois do golpe: é como ele impede o golpe ("colou o cotovelo no corpo", "levantou
        a postura"). Cada uma fica escrita na peça que vem depois, do seu jeito, e é opcional.
      </p>
    ),
  },
  {
    id: 'encaixou', icone: Check, titulo: 'Encaixou, e depois?', resumo: 'Golpe atrás de golpe até o objetivo',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        O golpe deu certo, mas o rola não acaba ali. Queda, passou a guarda, estabilizou, foi pra norte-sul, armlock: cada um que
        encaixa puxa o próximo até chegar onde você quer. No mapa, esse caminho sai por cima.
      </p>
    ),
  },
  {
    id: 'defender', icone: Shield, titulo: 'Se ele defender', resumo: 'Cada defesa dele com o seu caminho',
    conteudo: (
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        Em qualquer golpe dá pra marcar o que fazer se ele defender, e quantas defesas precisar: ele colou o cotovelo abre um
        golpe, ele levantou a postura abre outro. Cada defesa vira um plano com cor e letra próprias, todos atrás do mesmo
        objetivo. Dê o nome de cada defesa: é por ela que você reconhece qual caminho seguir. No mapa, esses caminhos saem por baixo.
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
      {t.morreNo ? ` · para mais no ${t.morreNo.golpe}${t.morreNo.saiu ? ' (já saiu do plano)' : ''}` : ''}
      {tipos.length > 0 && <div>{tipos.map(([k, v]) => `${NOME_TIPO[k] || k}: ${v.encaixes} de ${v.usos}`).join(' · ')}</div>}
    </div>
  );
}


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
        {ordem.filter((i) => trilho[i] === 0).map((i) => (
          <React.Fragment key={i}>
            <ChevronRight size={13} className="muted" />
            <span className={`plano-peca ${ehTexto(c.passos[i]) ? `t-${c.passos[i].tipo}` : 't-golpe'}`}>
              {textoDaPeca(c.passos[i])}
            </span>
          </React.Fragment>
        ))}
        {trilhos > 1 && <span className="plano-peca t-defende">+ {trilhos === 2 ? 'Plano B' : `Planos ${juntar(Array.from({ length: trilhos - 1 }, (_, t) => letraDo(t + 1)))}`}</span>}
      </div>
      {c.objetivo && <div className="plano-objetivo micro"><Flag size={12} /> Onde quer chegar: <b>{textoDoObjetivo(c)}</b></div>}
      {acerto}
      {children && <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>{children}</div>}
    </div>
  );
}

/* ============================================================
   MONTAR O PLANO
   Em cima, o que o plano é: nome, de onde começa e onde quer chegar
   (obrigatório). Embaixo, o mesmo mapa do "Ver o mapa", montado no
   toque: o "+" de cada galho põe uma peça (golpe ou finta), tocar
   numa peça muda ela, e a alça arrasta a peça, com o que vem depois,
   pra outra vaga. O mapa se arruma sozinho.
   ============================================================ */
const OBJETIVO_TIPOS = [
  { id: 'finalizar', nome: 'Finalizar' },
  { id: 'familia', nome: 'Uma família de finalização' },
  { id: 'posicao', nome: 'Chegar numa posição' },
  { id: 'tecnica', nome: 'Um golpe específico' },
];
/* o que ele faz, com o nome de acordo com por onde a peça nasce */
const REACAO = {
  raiz: { nome: 'A deixa dele', exemplo: 'O que ele faz que abre o golpe (ex.: pôs a mão no seu peito)' },
  encaixou: { nome: 'O que ele faz agora', exemplo: 'Ex.: virou de lado, empurrou seu quadril' },
  defendeu: { nome: 'Como ele defendeu', exemplo: 'Ex.: colou o cotovelo no corpo' },
  reagiu: { nome: 'Como ele reagiu à finta', exemplo: 'Ex.: levantou a cabeça e apoiou a mão no chão' },
  naoReagiu: { nome: 'O que ele fez', exemplo: 'Ex.: ficou parado na base, não levantou a cabeça' },
  feita: { nome: 'O que ele faz agora', exemplo: 'Ex.: puxou o braço pra trás, pesou o quadril' },
  impediu: { nome: 'Como ele não deixou', exemplo: 'Ex.: quebrou a pegada da manga, afastou o quadril' },
  escapou: { nome: 'Como ele escapou', exemplo: 'Ex.: girou pra dentro, tirou o cotovelo e recuperou a guarda' },
  retoma: { nome: 'A deixa dele', exemplo: 'O que ele faz nessa posição que abre o ataque' },
};
const posicoesDoPlano = (positions) => positions.filter((p) => p.slug !== 'finalizacao' && p.slug !== 'finalizado');

function EditorPlano({ edit, setEdit, positions, techniques, categories, faixa, destinoDe, onSalvar }) {
  /* a peça aberta: com "i" é uma que existe; sem, é a vaga nova (pai e via) */
  const [peca, setPeca] = useState(null);
  /* qual campo o seletor de técnica preenche: 'objetivo' ou 'peca' */
  const [escolhendo, setEscolhendo] = useState(null);
  /* a finta ou a preparação que entra antes da peça aberta: { tipo, golpe, prep } (null: fechado) */
  const [antesNova, setAntesNova] = useState(null);
  useEffect(() => { setAntesNova(null); }, [peca?.i, !peca]);
  /* o mapa abre num popup em tela cheia, lendo o mesmo edit do formulário */
  const [mapaAberto, setMapaAberto] = useState(false);
  useEffect(() => { if (!edit) setMapaAberto(false); }, [edit]);
  const [ajuda, setAjuda] = useState(false);
  const plano = useMemo(() => (edit ? planoNovo({ ...edit, posicao: nomeDaPosicao(edit, positions) }) : null), [edit, positions]);
  if (!edit) return null;
  const passos = edit.passos;
  const mudar = (patch) => setEdit({ ...edit, ...patch });
  const c = correnteDoPlano(plano);
  const pontas = c.objetivo ? pontasSoltas(plano, destinoDe) : [];
  const soltas = pontas.filter((x) => x.tipo !== 'situacao');
  /* a fuga que deixou a luta na posição do objetivo: ainda falta firmar */
  const fugasNoObjetivo = pontas.filter((x) => x.tipo === 'situacao');
  const semMotivo = semGatilho(passos);
  const existe = peca && Number.isInteger(peca.i);
  /* a ligação com uma peça que já está no mapa: a que existe (lig) ou a vaga que vira ligação */
  const ligacao = peca?.tipo === 'ligacao';
  const podeLigar = !!peca && !existe && Number.isInteger(peca.pai);
  const destinos = podeLigar ? destinosDaLigacao(passos, c.ligacoes, peca.pai, peca.via, peca.lig) : [];
  const trilhoDe = arvoreDoPlano(passos).trilho;
  const nomeDoDestino = (para) => {
    if (para === null) return `${c.posicao || 'A posição'} · onde começa`;
    const k = passos.findIndex((x) => x.id === para);
    const x = passos[k];
    return `${textoDaPeca(x)} · Plano ${letraDo(trilhoDe[k])}`;
  };
  /* a peça nova com o nome de uma que já está no mapa: dá pra ligar nela em vez de repetir */
  const repetida = podeLigar && !ligacao && peca.golpe
    ? destinos.find((d) => (d === null ? c.posicao : passos.find((x) => x.id === d).golpe) === peca.golpe) : undefined;
  /* as ligações de outros caminhos que chegam no que sai junto com a peça */
  const chegamNaPeca = existe ? (() => {
    const fica = new Set((ehTexto(passos[peca.i]) ? semAFinta(passos, peca.i) : semOGolpe(passos, peca.i)).map((x) => x.id));
    return c.ligacoes.filter((l) => l.para !== null && !fica.has(l.para) && fica.has(l.de)).length;
  })() : 0;

  const escolherTipo = (tipo) => {
    if (tipo === edit.objetivoTipo) return;
    mudar({ objetivoTipo: tipo, objetivo: tipo === 'finalizar' ? OBJETIVO_FINALIZAR : '', finalizacaoPreferida: '', finalizacoesAceitas: [] });
    if (tipo === 'tecnica') setEscolhendo('objetivo');
    if (tipo === 'familia') setEscolhendo('familia');
  };
  const aceitas = edit.finalizacoesAceitas || [];
  const finalizacoes = techniques.filter((t) => destinoDe(t.nome)?.slug === 'finalizacao');
  const guardarPeca = () => {
    if (ligacao) {
      if (peca.para === undefined) return;
      mudar({ ligacoes: comLigacao(edit.ligacoes || [], { id: peca.lig, de: passos[peca.pai].id, via: peca.via, gatilho: peca.reacao, para: peca.para }) });
      setPeca(null);
      return;
    }
    if (!peca.golpe.trim()) return;
    if (existe) {
      mudar({ passos: passos.map((x, k) => (k === peca.i ? { ...x, golpe: peca.golpe, reacao: peca.reacao, ...(x.tipo === 'preparacao' ? { prep: peca.prep || '' } : {}) } : x)) });
    } else {
      mudar({ passos: [...passos, { id: novoId(), lig: novoId(), tipo: peca.tipo, golpe: peca.golpe, reacao: peca.reacao, detalhe: '', pai: peca.pai, via: peca.pai === null ? null : peca.via, ...(peca.tipo === 'preparacao' ? { prep: peca.prep || '' } : {}) }] });
    }
    setPeca(null);
  };
  const tirarPeca = () => {
    if (peca.lig) mudar({ ligacoes: (edit.ligacoes || []).filter((l) => l.id !== peca.lig) });
    else mudar({ passos: ehTexto(passos[peca.i]) ? semAFinta(passos, peca.i) : semOGolpe(passos, peca.i) });
    setPeca(null);
  };
  const viaDaPeca = peca ? (existe ? passos[peca.i].via || 'raiz' : peca.via || 'raiz') : 'raiz';
  const tituloSeletor = escolhendo === 'objetivo' ? 'Onde você quer chegar'
    : escolhendo === 'preferida' ? 'Sua finalização preferida' : escolhendo === 'aceita' ? 'Outra finalização que vale'
    : 'Qual é o golpe';

  return (
    <Sheet
      aberto={!!edit} onClose={() => setEdit(null)} wide
      titulo={edit.id ? 'Editar plano' : 'Novo plano'}
      footer={<Btn variant="primary" style={{ width: '100%' }} onClick={() => onSalvar(edit)}>Salvar plano</Btn>}
    >
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <p className="micro muted" style={{ flex: 1, lineHeight: 1.5 }}>Escolha onde quer chegar e monte no mapa os caminhos até lá.</p>
        <Btn size="sm" variant="ghost" icon={CircleHelp} onClick={() => setAjuda(true)}>Entenda</Btn>
      </div>

      <Field label="Nome do plano">
        <Input value={edit.nome} placeholder="Ex.: da queda até o armlock" onChange={(e) => mudar({ nome: e.target.value })} />
      </Field>
      <Field label="De onde começa">
        <Select value={edit.posicaoId} onChange={(e) => mudar({ posicaoId: e.target.value })}>
          <option value="">{edit.posicao || 'Escolha a posição'}</option>
          {positions.filter((p) => p.slug !== 'finalizacao' && p.slug !== 'finalizado').map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Select>
      </Field>
      <Field label="Onde quero chegar" hint="O que o plano persegue do começo ao fim. O golpe que chega lá ganha a bandeira.">
        <div className="row wrap" style={{ gap: 6 }}>
          {OBJETIVO_TIPOS.map((o) => <Chip key={o.id} on={edit.objetivoTipo === o.id} onClick={() => escolherTipo(o.id)}>{o.nome}</Chip>)}
        </div>
        {edit.objetivoTipo === 'posicao' && (
          <Select value={edit.objetivo} onChange={(e) => mudar({ objetivo: e.target.value })} style={{ marginTop: 8 }}>
            <option value="">Escolha a posição</option>
            {positions.filter((p) => p.slug !== 'finalizacao' && p.slug !== 'finalizado').map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
          </Select>
        )}
        {edit.objetivoTipo === 'familia' && (
          <>
            <button type="button" className="input plano-escolher" style={{ marginTop: 8 }} onClick={() => setEscolhendo('familia')}>
              {edit.objetivo ? nomeDoItem(edit.objetivo, true) : 'Escolher a família'}
            </button>
            <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              {edit.objetivo ? `Qualquer uma das ${quantasVariacoes(edit.objetivo)} variações conta: ${variacoesEmResumo(edit.objetivo, 4)}` : 'Qualquer variação da família conta: o armlock da guarda, o da montada, o das costas...'}
            </p>
          </>
        )}
        {edit.objetivoTipo === 'tecnica' && (
          <button type="button" className="input plano-escolher" style={{ marginTop: 8 }} onClick={() => setEscolhendo('objetivo')}>
            {edit.objetivo || 'Escolher o golpe'}
          </button>
        )}
        {edit.objetivoTipo === 'finalizar' && (
          <div className="plano-finalizacoes" style={{ marginTop: 10 }}>
            <p className="micro muted" style={{ lineHeight: 1.5 }}>Se quiser, diga a sua preferida e as que também valem: uma técnica ou a família inteira (qualquer armlock, por exemplo). Qualquer finalização que encaixar alcança o objetivo; a lista só mostra o que você prioriza.</p>
            <div className="micro" style={{ marginTop: 8, fontWeight: 700 }}>Preferida</div>
            <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
              <button type="button" className="input plano-escolher" style={{ flex: 1 }} onClick={() => setEscolhendo('preferida')}>
                {edit.finalizacaoPreferida ? nomeDoItem(edit.finalizacaoPreferida, true) : 'Escolher a preferida (opcional)'}
              </button>
              {edit.finalizacaoPreferida && <Btn size="sm" variant="ghost" icon={X} onClick={() => mudar({ finalizacaoPreferida: '' })}>Tirar</Btn>}
            </div>
            <div className="micro" style={{ marginTop: 10, fontWeight: 700 }}>Também vale</div>
            <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
              {aceitas.map((n) => (
                <Chip key={n} on onClick={() => mudar({ finalizacoesAceitas: aceitas.filter((x) => x !== n) })}>{nomeDoItem(n, true)} <X size={11} strokeWidth={3} /></Chip>
              ))}
              <Chip onClick={() => setEscolhendo('aceita')}><Plus size={11} strokeWidth={3} /> Outra finalização</Chip>
            </div>
          </div>
        )}
      </Field>

      <div style={{ marginTop: 18 }} />
      <Field label="Pra quem serve (opcional)" hint="O parceiro com essa altura ou esse peso vê o plano na ficha dele.">
        <div className="chips-grupo">
          <span className="chips-grupo-nome"><Ruler size={13} /> Altura dele</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {[...ALTURA_REL, { id: QUALQUER, nome: 'Qualquer altura' }].map((o) => (
              <Chip key={o.id} on={edit.paraAltura.includes(o.id)} onClick={() => mudar({ paraAltura: escolherPraQuem(edit.paraAltura, o.id) })}>{o.nome}</Chip>
            ))}
          </div>
        </div>
        <div className="chips-grupo">
          <span className="chips-grupo-nome"><Weight size={13} /> Peso dele</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {[...PESO_REL, { id: QUALQUER, nome: 'Qualquer peso' }].map((o) => (
              <Chip key={o.id} on={edit.paraPeso.includes(o.id)} onClick={() => mudar({ paraPeso: escolherPraQuem(edit.paraPeso, o.id) })}>{o.nome}</Chip>
            ))}
          </div>
        </div>
      </Field>

      <div className="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>O caminho</div>
      <Btn variant="contorno" icon={GitMerge} style={{ width: '100%' }} disabled={!edit.objetivo} onClick={() => setMapaAberto(true)}>Montar o caminho</Btn>
      {!edit.objetivo && <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.5 }}>Falta escolher onde você quer chegar. Depois disso, o caminho abre aqui.</p>}

      {/* o mapa: o mesmo edit do formulário, sem cópia; fechar não perde nada */}
      <Sheet
        aberto={mapaAberto} onClose={() => setMapaAberto(false)} cheia alturaMobile={100}
        titulo="O caminho" subtitulo={edit.nome || 'Novo plano'}
        footer={<Btn variant="primary" style={{ width: '100%' }} onClick={() => setMapaAberto(false)}>Voltar às respostas</Btn>}
      >
        <div className="mapa-cheio">
          <MapaDoPlano
            plano={plano} destinoDe={destinoDe}
            editar={{
              onVaga: (pai, via) => setPeca({ pai, via, tipo: via === 'escapou' ? 'situacao' : 'golpe', golpe: '', reacao: '' }),
              onPeca: (i) => setPeca({ i, tipo: passos[i].tipo, golpe: passos[i].golpe, reacao: passos[i].reacao || '', prep: passos[i].prep || '' }),
              onLigacao: (lig) => {
                const l = c.ligacoes.find((x) => x.id === lig);
                if (l) setPeca({ lig, tipo: 'ligacao', pai: passos.findIndex((x) => x.id === l.de), via: l.via, para: l.para, golpe: '', reacao: l.gatilho });
              },
              onMover: (i, pai, via) => {
                const movido = moverPasso(passos, i, pai, via);
                if (movido) mudar({ passos: movido });
              },
            }}
          />
          {soltas.length > 0 && (
            <p className="micro" style={{ marginTop: 8, lineHeight: 1.5, color: '#f5c542' }}>
              Ainda não chega {chegaEm(c)}: {juntar(soltas.map(textoDaPeca))}. Toque no + depois {soltas.length === 1 ? 'dele' : 'deles'} pra seguir até lá.
            </p>
          )}
          {fugasNoObjetivo.length > 0 && (
            <p className="micro" style={{ marginTop: 8, lineHeight: 1.5, color: '#f5c542' }}>
              A fuga deixou a luta em {c.objetivo}, onde você quer chegar, mas ainda não conta: foi ele que saiu do controle. Falta a ação que estabelece o controle da posição. Toque no + depois {fugasNoObjetivo.length === 1 ? 'dela' : 'delas'}.
            </p>
          )}
          {semMotivo.length > 0 && (
            <p className="micro" style={{ marginTop: 8, lineHeight: 1.5, color: '#f5c542' }}>
              Mais de um caminho sai do mesmo ponto: diga o que ele fez em {juntar(semMotivo.map(textoDaPeca))}. É por isso que você sabe qual escolher na hora.
            </p>
          )}
        </div>
      </Sheet>

      {/* a peça: golpe, finta ou preparação, o nome do catálogo e o que ele fez pra chegar aqui */}
      <Sheet
        aberto={!!peca} onClose={() => setPeca(null)}
        titulo={peca?.lig ? 'Caminho até uma peça do mapa' : peca?.tipo === 'situacao' || (!existe && peca?.via === 'escapou') ? 'Ele escapou' : existe ? (peca.tipo === 'finta' ? 'A finta' : peca.tipo === 'preparacao' ? 'A preparação' : 'O golpe') : 'O que vem aqui'}
        subtitulo={peca && (existe ? passos[peca.i].pai : peca.pai) !== null ? `vem de: ${passos[existe ? passos[peca.i].pai : peca.pai]?.golpe || ''}` : 'a primeira peça do plano'}
        footer={<Btn variant="primary" style={{ width: '100%' }} disabled={ligacao ? peca.para === undefined : !peca?.golpe?.trim()} onClick={guardarPeca}>Pronto</Btn>}
      >
        {peca && (
          <>
            {!existe && !peca.lig && peca.via !== 'escapou' && (
              <Field label="É golpe, finta ou preparação?">
                <div className="row wrap" style={{ gap: 6 }}>
                  <Chip on={peca.tipo === 'golpe'} onClick={() => peca.tipo !== 'golpe' && setPeca({ ...peca, tipo: 'golpe', golpe: '', para: undefined })}>Golpe de verdade</Chip>
                  <Chip on={peca.tipo === 'finta'} onClick={() => peca.tipo !== 'finta' && setPeca({ ...peca, tipo: 'finta', golpe: '', para: undefined })}>Finta</Chip>
                  <Chip on={peca.tipo === 'preparacao'} onClick={() => peca.tipo !== 'preparacao' && setPeca({ ...peca, tipo: 'preparacao', golpe: '', prep: '', para: undefined })}>Preparação</Chip>
                </div>
              </Field>
            )}
            {peca.lig ? null : peca.tipo === 'situacao' || (!existe && peca.via === 'escapou') ? (
              <Field label="Onde a luta ficou" hint="A posição depois que ele saiu. Daqui você monta como volta a atacar. Se não tiver ataque que faça sentido, deixa sem continuação: o caminho fecha aqui.">
                <Select value={ligacao ? '' : peca.golpe} onChange={(e) => setPeca({ ...peca, tipo: 'situacao', para: undefined, golpe: e.target.value })}>
                  <option value="">Escolha a posição</option>
                  {peca.golpe && !posicoesDoPlano(positions).some((p) => p.nome === peca.golpe) && <option value={peca.golpe}>{peca.golpe}</option>}
                  {posicoesDoPlano(positions).map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                </Select>
              </Field>
            ) : !ligacao && peca.tipo === 'preparacao' ? (
              <>
                <Field label="Que preparação?" hint="Opcional. Ajuda a ler o mapa.">
                  <div className="row wrap" style={{ gap: 6 }}>
                    {PREPARACOES.map((pr) => (
                      <Chip key={pr.id} on={peca.prep === pr.id} onClick={() => setPeca({ ...peca, prep: peca.prep === pr.id ? '' : pr.id })}>{pr.nome}</Chip>
                    ))}
                  </div>
                </Field>
                <Field label="O que você monta?" hint="Com as suas palavras. Não é finta: é o que deixa o golpe possível. O golpe vem na próxima peça.">
                  <Input value={peca.golpe} maxLength={FINTA_MAX} placeholder="Ex.: pegada na gola e na manga do mesmo lado" onChange={(e) => setPeca({ ...peca, golpe: e.target.value })} />
                </Field>
              </>
            ) : !ligacao && peca.tipo === 'finta' ? (
              <Field label="O que você vai fingir?" hint="A ameaça que faz ele reagir, com as suas palavras. O golpe de verdade vem na próxima peça.">
                <Input value={peca.golpe} maxLength={FINTA_MAX} placeholder="Ex.: fingir que vou no armlock pra ele recolher o braço" onChange={(e) => setPeca({ ...peca, golpe: e.target.value })} />
              </Field>
            ) : !ligacao && (
              <Field label="O golpe">
                <button type="button" className="input plano-escolher" onClick={() => setEscolhendo('peca')}>
                  {peca.golpe || 'Escolher o golpe'}
                </button>
              </Field>
            )}
            {repetida !== undefined && (
              <div className="plano-aviso micro">
                {peca.golpe} já está no mapa. Se é o mesmo ponto da luta, liga nele em vez de repetir o cartão.
                <Btn size="sm" variant="contorno" icon={GitMerge} onClick={() => setPeca({ ...peca, tipo: 'ligacao', para: repetida })}>Ligar no que já está</Btn>
              </div>
            )}
            {destinos.length > 0 && (
              <Field
                label={peca.lig ? 'Vai pra' : peca.via === 'escapou' ? 'Ou a luta voltou pra um ponto que já está no mapa' : 'Ou segue numa peça que já está no mapa'}
                hint="O cartão continua um só. Esse caminho até ele ganha nome próprio, com o que ele fez aqui."
              >
                <div className="row wrap" style={{ gap: 6 }}>
                  {destinos.map((d) => (
                    <Chip key={d ?? 'posicao'} on={ligacao && peca.para === d} onClick={() => setPeca({ ...peca, tipo: 'ligacao', para: d })}>
                      {nomeDoDestino(d)}
                    </Chip>
                  ))}
                </div>
              </Field>
            )}
            <Field label={`${REACAO[viaDaPeca].nome} (opcional)`}>
              <Input value={peca.reacao} placeholder={REACAO[viaDaPeca].exemplo} onChange={(e) => setPeca({ ...peca, reacao: e.target.value })} />
            </Field>
            {peca.lig && (
              <>
                <p className="micro muted" style={{ marginBottom: 8, lineHeight: 1.5 }}>Tirar a ligação não mexe na peça: ela continua no mapa, sai só esse caminho até ela.</p>
                <Btn size="sm" variant="ghost" icon={Trash2} onClick={tirarPeca}>Tirar essa ligação</Btn>
              </>
            )}
            {chegamNaPeca > 0 && (
              <p className="micro muted" style={{ marginBottom: 8, lineHeight: 1.5 }}>
                {chegamNaPeca === 1 ? 'Um caminho de outro ponto do mapa chega' : `${chegamNaPeca} caminhos de outros pontos do mapa chegam`} no que sai daqui.
                Se tirar, {chegamNaPeca === 1 ? 'ele sai' : 'eles saem'} junto. O rola que já passou por aqui continua no histórico.
              </p>
            )}
            {existe && antesNova?.tipo === 'finta' && (
              <Field label="O que você vai fingir antes?" hint="A finta entra antes desta peça, e ela passa a vir da reação dele.">
                <Input value={antesNova.golpe} maxLength={FINTA_MAX} placeholder="Ex.: fingir que vou no armlock pra ele recolher o braço" onChange={(e) => setAntesNova({ ...antesNova, golpe: e.target.value })} />
                <Btn size="sm" variant="contorno" icon={Sparkles} disabled={!antesNova.golpe.trim()} style={{ marginTop: 8 }}
                  onClick={() => { mudar({ passos: fintaAntes(passos, peca.i, antesNova.golpe.trim()) }); setPeca(null); }}>Pôr a finta</Btn>
              </Field>
            )}
            {existe && antesNova?.tipo === 'preparacao' && (
              <Field label="O que você monta antes?" hint="A preparação entra antes desta peça, e ela passa a vir do que você montou.">
                <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
                  {PREPARACOES.map((pr) => (
                    <Chip key={pr.id} on={antesNova.prep === pr.id} onClick={() => setAntesNova({ ...antesNova, prep: antesNova.prep === pr.id ? '' : pr.id })}>{pr.nome}</Chip>
                  ))}
                </div>
                <Input value={antesNova.golpe} maxLength={FINTA_MAX} placeholder="Ex.: pegada na gola e na manga do mesmo lado" onChange={(e) => setAntesNova({ ...antesNova, golpe: e.target.value })} />
                <Btn size="sm" variant="contorno" icon={Hand} disabled={!antesNova.golpe.trim()} style={{ marginTop: 8 }}
                  onClick={() => { mudar({ passos: fintaAntes(passos, peca.i, antesNova.golpe.trim(), { tipo: 'preparacao', prep: antesNova.prep }) }); setPeca(null); }}>Pôr a preparação</Btn>
              </Field>
            )}
            {existe && (
              <div className="row wrap" style={{ gap: 6 }}>
                {peca.tipo !== 'situacao' && antesNova === null && <Btn size="sm" variant="ghost" icon={Sparkles} onClick={() => setAntesNova({ tipo: 'finta', golpe: '', prep: '' })}>Pôr uma finta antes</Btn>}
                {peca.tipo !== 'situacao' && antesNova === null && <Btn size="sm" variant="ghost" icon={Hand} onClick={() => setAntesNova({ tipo: 'preparacao', golpe: '', prep: '' })}>Pôr uma preparação antes</Btn>}
                <Btn size="sm" variant="ghost" icon={Trash2} onClick={tirarPeca}>
                  {peca.tipo === 'finta' ? 'Tirar a finta' : peca.tipo === 'preparacao' ? 'Tirar a preparação' : 'Tirar, e o que vem depois'}
                </Btn>
              </div>
            )}
          </>
        )}
      </Sheet>

      <SeletorTecnica
        aberto={escolhendo !== null && escolhendo !== 'familia'} onClose={() => setEscolhendo(null)}
        techniques={escolhendo === 'preferida' || escolhendo === 'aceita' ? finalizacoes : techniques} categories={categories} positions={positions} faixa={faixa}
        titulo={tituloSeletor}
        semPosicoes
        familias={escolhendo === 'preferida' || escolhendo === 'aceita' ? FAMILIAS.map((f) => f.id) : null}
        jaConta={escolhendo === 'aceita' ? (n) => jaCoberta(n, edit.finalizacaoPreferida, aceitas, techniques)
          : escolhendo === 'preferida' ? (n) => (n === edit.finalizacaoPreferida ? n : '') : undefined}
        onEscolher={(t) => {
          if (escolhendo === 'objetivo') mudar({ objetivo: t.nome });
          /* a preferida não se repete nas aceitas */
          /* a família leva junto as variações dela que já estavam nas aceitas */
          else if (escolhendo === 'preferida') mudar({ finalizacaoPreferida: t.nome, finalizacoesAceitas: limparAceitas(t.nome, aceitas, techniques) });
          else if (escolhendo === 'aceita') { if (!jaCoberta(t.nome, edit.finalizacaoPreferida, aceitas, techniques)) mudar({ finalizacoesAceitas: limparAceitas(edit.finalizacaoPreferida, [...aceitas, t.nome], techniques) }); }
          else setPeca({ ...peca, golpe: t.nome });
          setEscolhendo(null);
        }}
      />

      <Sheet aberto={escolhendo === 'familia'} onClose={() => setEscolhendo(null)} titulo="Qual família" subtitulo="Qualquer variação dela conta como objetivo">
        <div className="col" style={{ gap: 5 }}>
          <ListaDeFamilias ids={FAMILIAS.map((f) => f.id)} jaConta={(id) => (id === edit.objetivo ? id : '')} onEscolher={(id) => { mudar({ objetivo: id }); setEscolhendo(null); }} />
        </div>
      </Sheet>

      <Sheet aberto={ajuda} onClose={() => setAjuda(false)} titulo="Como montar o plano">
        <LegendaDoMapa />
        <Guia topicos={GUIA_DO_PLANO} inicial="como" />
      </Sheet>
    </Sheet>
  );
}

/* ============================================================
   O MAPA DO PLANO
   Mapa mental: a posição na esquerda e as peças abrindo pra
   direita. Cada golpe abre dois galhos: encaixou em cima (segue no
   mesmo plano) e, se ele defender, embaixo (o plano seguinte, com
   outra cor). A finta tem um galho só: ele reagiu. Os cartões são
   medidos e a árvore é arrumada em cima dessas alturas; dá pra
   arrastar, dar zoom e tocar num golpe pra ler tudo dele. No editor,
   as vagas do "+" entram na árvore como folhas.
   ============================================================ */
/* no celular, cartão e vão mais estreitos pra caber a primeira bifurcação */
const medidas = () => (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 600px)').matches
  ? { larg: 148, vao: 40 } : { larg: 184, vao: 58 });
const VAO_Y = 18;
const MARGEM = 14;
/* 8 cores de plano; do I em diante, repete */
const cor = (t) => t % 8;

function LegendaDoMapa({ trilhos = 2, finta = true, preparacao = false }) {
  return (
    <div className="mapa-legenda">
      <span className="mapa-tipo t-posicao"><i />Posição</span>
      {preparacao && <span className="mapa-tipo t-preparacao"><i />Preparação</span>}
      {finta && <span className="mapa-tipo t-finta"><i />Finta</span>}
      {Array.from({ length: Math.min(trilhos, 8) }, (_, t) => letraDo(t)).map((l, t) => <span key={l} className={`mapa-tipo trilho-${cor(t)}`}><i />Plano {l}</span>)}
      {/* do I em diante a cor repete e a letra está na peça: a legenda não cresce com o plano */}
      {trilhos > 8 && <span className="mapa-tipo muted">Planos I a {letraDo(trilhos - 1)}: as cores repetem</span>}
      <span className="mapa-tipo" style={{ color: 'var(--jade)' }}><Check size={12} strokeWidth={3} />Encaixou</span>
      <span className="mapa-tipo" style={{ color: '#ff7a6b' }}><X size={12} strokeWidth={3} />Se ele defender</span>
      <span className="mapa-tipo" style={{ color: '#e2a76f' }}><DoorOpen size={12} />Se ele escapar</span>
      <span className="mapa-tipo" style={{ color: '#f5c542' }}><Flag size={12} />Objetivo alcançado</span>
      <span className="mapa-tipo"><CornerDownRight size={12} />Liga numa peça que já está no mapa</span>
    </div>
  );
}

/* cada peça do mapa: a posição e as peças na ordem de leitura; "de"
   é a peça de onde nasce o galho. O golpe sem continuação só ganha
   folha quando chega no objetivo ou finaliza: caminho que acaba sem
   chegar fica sem desfecho inventado. */
function linhasDoMapa(plano, destinoDe, editar = false) {
  const c = correnteDoPlano(plano);
  const { ordem, trilho, filhos, segue } = arvoreDoPlano(c.passos);
  const linhas = [{ tipo: 'posicao', trilho: 0, rotulo: 'De onde começa', titulo: c.posicao || 'A posição' }];
  /* mais: a saída já tem caminho, e o + abre outro */
  const vaga = (de, pai, via, t, mais = false) => linhas.push({ tipo: 'vaga', de, pai, via, trilho: t, mais });
  if (editar) vaga(0, null, 'raiz', 0, c.passos.length > 0);
  const linhaDoPasso = {};
  const ultimo = c.passos.length - 1;
  const idx = new Map(c.passos.map((x, i) => [x.id, i]));
  /* de onde vêm os caminhos extras que chegam em cada peça (null: a posição) */
  const chegamEm = (id) => c.ligacoes.filter((l) => l.para === id).map((l) => c.passos[idx.get(l.de)].golpe);
  linhas[0].chegam = chegamEm(null);
  ordem.forEach((i) => {
    const x = c.passos[i];
    const golpe = x.tipo === 'golpe';
    const situacao = x.tipo === 'situacao';
    const aqui = linhas.length;
    linhaDoPasso[i] = aqui;
    const extras = c.ligacoes.filter((l) => l.de === x.id);
    const tem = (via) => filhos[i].some((k) => c.passos[k].via === via) || extras.some((l) => l.via === via);
    const seguePorLigacao = extras.some((l) => continua(l.via));
    const g = {
      tipo: x.tipo, i, trilho: trilho[i], via: x.pai === null ? 'raiz' : x.via,
      /* começa um plano novo: mostra a letra dele */
      abre: x.pai === null ? trilho[i] > 0 : segue[x.pai] !== i,
      de: x.pai === null ? 0 : linhaDoPasso[x.pai],
      deixa: x.reacao || (x.via === 'defendeu' ? c.passos[x.pai].defesa : ''),
      titulo: x.golpe, detalhe: x.detalhe, prep: x.prep,
      chegou: chegaNoObjetivo(x, c, destinoDe),
      escolha: escolhaDaFinalizacao(x, c, destinoDe),
      finalizacao: finaliza(x, destinoDe),
      segue: golpe && i === ultimo ? c.segue : '',
      fecha: golpe && !tem('defendeu'),
      /* a situação depois da fuga: tem ou não tem como voltar a atacar */
      semVolta: situacao && segue[i] === undefined && !seguePorLigacao,
      /* a fuga deixou a luta onde ele quer chegar: ainda falta firmar */
      noObjetivo: situacaoNoObjetivo(x, c),
      chegam: chegamEm(x.id),
      /* a finta: as reações que ela busca, só as que o atleta escreveu */
      busca: x.tipo === 'finta' ? [...filhos[i].filter((k) => c.passos[k].via === 'reagiu').map((k) => c.passos[k].reacao),
        ...extras.filter((l) => l.via === 'reagiu').map((l) => l.gatilho)].filter(Boolean) : [],
    };
    linhas.push(g);
    /* os caminhos que ligam numa peça que já está no mapa: um atalho
       no galho, com o fio tracejado até ela. Volta: a peça vem antes
       desta no caminho (ou é a posição de onde começa). */
    const antes = new Set();
    for (let k = x.pai, n = 0; k !== null && k !== undefined && n <= c.passos.length; k = c.passos[k].pai, n++) antes.add(c.passos[k].id);
    extras.forEach((l) => {
      const k = l.para === null ? null : idx.get(l.para);
      linhas.push({
        tipo: 'atalho', de: aqui, pai: i, via: l.via, trilho: trilho[i], lig: l.id, deixa: l.gatilho, alvoPasso: k,
        alvoTipo: k === null ? 'posicao' : c.passos[k].tipo, alvoTrilho: k === null ? 0 : trilho[k],
        titulo: k === null ? c.posicao || 'A posição' : c.passos[k].golpe,
        volta: k === null || antes.has(l.para),
      });
    });
    const adiante = golpe ? 'encaixou' : situacao ? 'retoma' : x.tipo === 'preparacao' ? 'feita' : 'reagiu';
    if (segue[i] === undefined && seguePorLigacao && !g.chegou) {
      if (editar) vaga(aqui, i, adiante, trilho[i], true);
    } else if (segue[i] === undefined) {
      const folha = { tipo: 'folha', trilho: trilho[i], via: adiante, de: aqui };
      if (g.chegou) {
        linhas.push({
          ...folha, chegou: true, forte: g.escolha === 'preferida', titulo: c.objetivoTipo === 'finalizar' ? '' : c.objetivoTipo === 'familia' ? nomeDoItem(c.objetivo, true) : c.objetivo,
          rotulo: g.escolha === 'preferida' ? 'Finalizou com a preferida: objetivo alcançado'
            : g.escolha === 'outra' ? 'Objetivo alcançado com outra finalização'
              : c.objetivoTipo === 'finalizar' || c.objetivoTipo === 'familia' ? 'Finalizou: objetivo alcançado' : 'Encaixou: objetivo alcançado',
        });
      } else if (finaliza(x, destinoDe)) linhas.push({ ...folha, rotulo: 'Finalizou' });
      else if (editar) vaga(aqui, i, adiante, trilho[i]);
      else if (situacao && g.noObjetivo) linhas.push({ ...folha, fecha: true, rotulo: 'A luta ficou onde você quer chegar: falta a ação que estabelece o controle da posição' });
      else if (situacao) linhas.push({ ...folha, fecha: true, rotulo: 'Daqui não tem ataque: o caminho fecha' });
      else if (g.segue) linhas.push({ ...folha, rotulo: 'Encaixou, depois', titulo: g.segue });
    } else if (editar) vaga(aqui, i, adiante, trilho[i], true);
    if (editar && x.tipo === 'finta') vaga(aqui, i, 'naoReagiu', trilho[i], tem('naoReagiu'));
    if (editar && x.tipo === 'preparacao') vaga(aqui, i, 'impediu', trilho[i], tem('impediu'));
    if (editar && golpe) vaga(aqui, i, 'defendeu', trilho[i], tem('defendeu'));
    if (editar && golpe) vaga(aqui, i, 'escapou', trilho[i], tem('escapou'));
  });
  /* o atalho aponta pra linha da peça de destino (0: a posição) */
  linhas.forEach((l) => { if (l.tipo === 'atalho') l.alvo = l.alvoPasso === null ? 0 : linhaDoPasso[l.alvoPasso]; });
  return {
    objetivo: textoDoObjetivo(c), passos: c.passos, temFinta: c.passos.some((x) => x.tipo === 'finta'),
    temPreparacao: c.passos.some((x) => x.tipo === 'preparacao'),
    linhas: linhas.map((l, n) => ({ ...l, n })),
  };
}

/* a árvore arrumada: cada galho ocupa a altura dos seus filhos, e o
   pai fica no meio deles. Encaixou vem antes (em cima) da defesa. */
function arrumar(linhas, filhos, alturas, { larg, vao }) {
  const tam = [];
  const somaFilhos = (n) => filhos[n].reduce((s, f) => s + tam[f], 0) + Math.max(0, filhos[n].length - 1) * VAO_Y;
  const mede = (n) => { filhos[n].forEach(mede); tam[n] = Math.max(alturas[n], somaFilhos(n)); };
  mede(0);
  const pos = [];
  const coloca = (n, prof, topo) => {
    pos[n] = { x: MARGEM + prof * (larg + vao), y: topo + (tam[n] - alturas[n]) / 2 };
    let t = topo + (tam[n] - somaFilhos(n)) / 2;
    filhos[n].forEach((f) => { coloca(f, prof + 1, t); t += tam[f] + VAO_Y; });
  };
  coloca(0, 0, MARGEM);
  return {
    pos,
    largura: Math.max(...pos.map((p) => p.x)) + larg + MARGEM,
    altura: tam[0] + MARGEM * 2,
  };
}

/* o rótulo de cima da peça: por onde ela nasce */
function RotuloDaVia({ l }) {
  const letra = l.abre ? ` · Plano ${letraDo(l.trilho)}` : '';
  if (l.via === 'raiz') return `${l.tipo === 'finta' ? 'Começa com finta' : l.tipo === 'preparacao' ? 'Começa com preparação' : '1º golpe'}${letra}`;
  if (l.via === 'encaixou') return <><Check size={11} strokeWidth={3} /> Encaixou{letra}</>;
  if (l.via === 'reagiu') return <><Sparkles size={11} /> Ele reagiu{letra}</>;
  if (l.via === 'naoReagiu') return <><Repeat size={11} strokeWidth={3} /> Não reagiu{letra}</>;
  if (l.via === 'feita') return <><Hand size={11} /> Montou{letra}</>;
  if (l.via === 'impediu') return <><Ban size={11} strokeWidth={3} /> Não deixou{letra}</>;
  if (l.via === 'escapou') return <><DoorOpen size={11} /> Ele escapou{letra}</>;
  if (l.via === 'retoma') return <><RotateCcw size={11} strokeWidth={3} /> Volto a atacar{letra}</>;
  return <><X size={11} strokeWidth={3} /> Defendeu{letra}</>;
}
const TEXTO_DA_VAGA = {
  raiz: 'O 1º golpe ou uma finta', encaixou: 'Encaixou, e depois?', defendeu: 'Se ele defender', reagiu: 'Ele reagiu, e aí?',
  naoReagiu: 'Não reagiu? Troco a ameaça', escapou: 'Se ele escapar', retoma: 'Como volto a atacar daqui?',
  feita: 'Montou, e agora?', impediu: 'Se ele não deixar',
};
/* o atalho leva a cor da peça de destino */
const corDoAlvo = (l) => (l.alvoTipo === 'golpe' ? `trilho-${cor(l.alvoTrilho)}` : `t-${l.alvoTipo}`);
/* a saída que já tem caminho e ganha outro */
const TEXTO_DE_MAIS = { raiz: 'Outra entrada', encaixou: 'Outra opção daqui', defendeu: 'Outra defesa dele', reagiu: 'Reagiu de outro jeito', naoReagiu: 'Outra ameaça pra trocar', escapou: 'Escapou de outro jeito', retoma: 'Outro jeito de voltar', feita: 'Outra opção daqui', impediu: 'Não deixou de outro jeito' };

/* a saída que pede o que ele fez: sem texto, o mapa diz que falta, sem inventar */
const VIA_COM_REACAO = new Set(['reagiu', 'naoReagiu', 'defendeu', 'escapou', 'impediu']);

function NoDoMapa({ l, guardar, aberto, onTocar, pega, editar = false, vaga = '' }) {
  if (l.tipo === 'vaga') {
    return (
      <button type="button" ref={guardar(l.n)} data-vaga={l.n} className={`mente-vaga ${l.via}${l.mais ? ' mais' : ''}${vaga}`} onClick={onTocar}>
        <Plus size={13} strokeWidth={3} /> {(l.mais ? TEXTO_DE_MAIS : TEXTO_DA_VAGA)[l.via]}
      </button>
    );
  }
  if (l.tipo === 'atalho') {
    const Seta = l.volta ? Undo2 : CornerDownRight;
    return (
      <button type="button" ref={guardar(l.n)} data-lig={l.lig} className={`mente-atalho ${corDoAlvo(l)}${aberto ? ' aberto' : ''}`} onClick={onTocar}>
        <span className={`mapa-rotulo ${l.via}`}><RotuloDaVia l={l} /></span>
        <span className="mente-atalho-txt">
          <Seta size={12} strokeWidth={2.6} /> {l.volta ? 'Volta pra' : 'Segue no'} <b>{l.titulo}</b>
          {l.alvoTipo === 'posicao' ? ' (onde começa)' : ` · Plano ${letraDo(l.alvoTrilho)}`}
        </span>
        {l.deixa && <span className="mente-deixa">{l.deixa}</span>}
      </button>
    );
  }
  if (l.tipo === 'folha') {
    return (
      <div ref={guardar(l.n)} className={`mente-folha ${l.chegou ? `chegada${l.forte ? ' forte' : ''}` : l.fecha ? 'fecha' : 'ok'}`}>
        <span className="row" style={{ gap: 5 }}>{l.chegou ? <Flag size={12} /> : l.fecha ? <X size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />} {l.rotulo}</span>
        {l.titulo && <span className="mente-folha-txt">{l.titulo}</span>}
      </div>
    );
  }
  const classe = l.tipo === 'golpe' ? `trilho-${cor(l.trilho)}` : `t-${l.tipo}`;
  return (
    <button type="button" ref={guardar(l.n)} className={`mente-no ${classe}${l.tipo === 'finta' ? ' finta' : ''}${l.tipo === 'preparacao' ? ' preparacao' : ''}${l.tipo === 'situacao' ? ' situacao' : ''}${pega ? ' com-pega' : ''}${aberto ? ' aberto' : ''}`} onClick={onTocar}>
      {l.tipo === 'posicao' ? <span className="mapa-rotulo">{l.rotulo}</span> : <span className={`mapa-rotulo ${l.via}`}><RotuloDaVia l={l} /></span>}
      {l.escolha === 'preferida' && <span className="mente-tag preferida"><Flag size={9} /> preferida</span>}
      {l.escolha === 'outra' && <span className="mente-tag">fora da lista</span>}
      <span className="mente-titulo">{l.tipo === 'posicao' ? l.titulo : textoDaPeca({ tipo: l.tipo, golpe: l.titulo, prep: l.prep })}</span>
      {l.busca?.length > 0 && <span className="mente-deixa">A reação que você busca: {l.busca.join(' ou ')}</span>}
      {l.deixa ? <span className="mente-deixa">{l.deixa}</span>
        : editar && VIA_COM_REACAO.has(l.via) && <span className="mente-deixa mente-sem-reacao">reação não descrita</span>}
      {pega && <span className="mente-pega" aria-label="Arrastar pra outro galho" {...pega}><GripVertical size={14} /></span>}
    </button>
  );
}

/* o que abre embaixo do mapa quando toca num golpe */
function DetalheDoNo({ l, objetivo, onIr }) {
  if (l.tipo === 'atalho') {
    return (
      <div className={`mente-detalhe ${corDoAlvo(l)}`}>
        <span className={`mapa-rotulo ${l.via}`}><RotuloDaVia l={l} /></span>
        <div className="mapa-titulo">{l.volta ? 'Volta pra' : 'Segue no'} {l.titulo}</div>
        {l.deixa && <div className="mapa-deixa"><b>{REACAO[l.via]?.nome}:</b> {l.deixa}</div>}
        <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
          {l.alvoTipo === 'posicao'
            ? 'A luta voltou pra onde o plano começa. Dali, as mesmas entradas de antes.'
            : `Esse caminho chega numa peça que já está no mapa (Plano ${letraDo(l.alvoTrilho)}). O cartão é um só; daqui você segue o que vem depois dele.`}
        </p>
        <Btn size="sm" variant="contorno" icon={CornerDownRight} style={{ marginTop: 8 }} onClick={onIr}>Ver no mapa</Btn>
      </div>
    );
  }
  return (
    <div className={`mente-detalhe ${l.tipo === 'golpe' ? `trilho-${cor(l.trilho)}` : `t-${l.tipo}`}`}>
      <span className={`mapa-rotulo ${l.via || ''}`}>{l.tipo === 'posicao' ? l.rotulo : <RotuloDaVia l={l} />}</span>
      <div className="mapa-titulo">{l.tipo === 'posicao' ? l.titulo : textoDaPeca({ tipo: l.tipo, golpe: l.titulo, prep: l.prep })}</div>
      {l.busca?.length > 0 && <div className="mapa-deixa"><b>A reação que você busca:</b> {l.busca.join(' ou ')}</div>}
      {l.deixa && <div className="mapa-deixa"><b>{REACAO[l.via]?.nome}:</b> {l.deixa}</div>}
      {l.detalhe && <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.5 }}>{l.detalhe}</p>}
      {l.tipo === 'finta' && <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.5 }}>A ameaça que faz ele reagir. O golpe de verdade vem depois.</p>}
      {l.tipo === 'preparacao' && <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.5 }}>O que você monta antes do golpe. Não espera reação: é o que deixa o golpe possível.</p>}
      {l.chegou && (
        <p className="micro" style={{ marginTop: 6, lineHeight: 1.5, color: '#f5c542' }}>
          {l.escolha === 'preferida' ? 'Sua finalização preferida. ' : ''}
          {l.escolha === 'outra' ? 'Essa finalização não estava entre as que você escolheu, mas se encaixar o objetivo está alcançado.'
            : l.finalizacao ? 'O objetivo só é alcançado quando a finalização encaixa.' : `O objetivo (${objetivo}) só é alcançado quando o golpe encaixa.`}
        </p>
      )}
      {l.segue && <p className="micro" style={{ marginTop: 6, color: 'var(--jade)' }}>Depois que encaixa: {l.segue}</p>}
      {l.fecha && <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.5 }}>Se ele defender aqui, esse caminho fecha.</p>}
      {l.tipo === 'situacao' && (
        <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
          Ele saiu do controle e a luta veio pra cá.{' '}
          {l.noObjetivo ? 'É onde você quer chegar, mas ainda não conta: falta a ação que estabelece o controle da posição.'
            : l.semVolta ? 'Daqui o plano não tem ataque que faça sentido: esse caminho fecha.' : `Daqui você volta a atacar, atrás do mesmo objetivo: ${objetivo}.`}
        </p>
      )}
      {l.chegam?.length > 0 && (
        <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
          <GitMerge size={11} /> Também chega aqui por outro caminho: depois de {juntar(l.chegam)}.
        </p>
      )}
    </div>
  );
}

function MapaDoPlano({ plano, ate = Infinity, destinoDe, editar = null }) {
  const editando = !!editar;
  const { objetivo, passos, linhas } = useMemo(() => linhasDoMapa(plano, destinoDe, editando), [plano, destinoDe, editando]);
  const filhos = useMemo(() => {
    const f = linhas.map(() => []);
    linhas.forEach((l) => { if (l.de !== undefined) f[l.de].push(l.n); });
    /* na ordem das saídas (encaixou em cima, defesa embaixo); na mesma
       saída, os caminhos, depois os atalhos pra peças do mapa e o + por último */
    const ordem = (k) => VIAS.indexOf(linhas[k].via) * 3 + (linhas[k].tipo === 'atalho' ? 1 : linhas[k].tipo === 'vaga' ? 2 : 0);
    f.forEach((lista) => lista.sort((a, b) => ordem(a) - ordem(b) || a - b));
    return f;
  }, [linhas]);
  const tela = useRef(null);
  const pecas = useRef({});
  const arrasto = useRef(null);
  const centrou = useRef(false);
  const quantas = useRef(passos.length);
  const rolar = useRef(null);
  const [alturas, setAlturas] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [aberto, setAberto] = useState(null);
  /* a peça que vai junto do dedo: qual, onde está e a vaga embaixo dela */
  const [levando, setLevando] = useState(null);
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const guardar = (n) => (el) => { pecas.current[n] = el; };

  useLayoutEffect(() => {
    const medir = () => setAlturas((antes) => {
      const agora = linhas.map((l) => pecas.current[l.n]?.offsetHeight || 64);
      return antes && antes.length === agora.length && antes.every((h, k) => h === agora[k]) ? antes : agora;
    });
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir);
    linhas.forEach((l) => pecas.current[l.n] && ro.observe(pecas.current[l.n]));
    return () => ro.disconnect();
  }, [linhas]);

  /* peça nova ainda sem medida entra com a altura de um cartão */
  const alt = useMemo(() => alturas && linhas.map((_, k) => alturas[k] ?? 64), [alturas, linhas]);
  const tamanho = useMemo(medidas, []);
  const arv = useMemo(() => (alt ? arrumar(linhas, filhos, alt, tamanho) : null), [linhas, filhos, alt, tamanho]);
  const cabe = arv && tela.current ? Math.min(1, (tela.current.clientWidth - 2) / arv.largura) : 1;
  const z = zoom ?? Math.max(0.8, cabe);

  /* abre com o começo do mapa à vista */
  useLayoutEffect(() => {
    if (!arv || !tela.current || centrou.current) return;
    centrou.current = true;
    const p = arv.pos[0];
    tela.current.scrollTop = Math.max(0, (p.y + alt[0] / 2) * z - tela.current.clientHeight / 2);
  }, [arv, alt, z]);

  /* no passo a passo, a peça nova entra na tela */
  useEffect(() => {
    if (ate === Infinity) return;
    pecas.current[Math.min(ate, linhas.length - 1)]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [ate, linhas.length]);

  /* no editor, a peça que acabou de entrar (sempre a última da lista)
     aparece na tela depois que o mapa se arruma */
  useEffect(() => {
    if (editar && passos.length > quantas.current) rolar.current = passos.length - 1;
    quantas.current = passos.length;
  }, [editar, passos.length]);
  useEffect(() => {
    if (rolar.current === null || !alturas || alturas.length !== linhas.length) return;
    const n = linhas.findIndex((l) => l.i === rolar.current);
    rolar.current = null;
    pecas.current[n]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [arv, alturas, linhas]);

  const galhos = arv ? linhas.filter((l) => l.de !== undefined && l.n <= ate).map((l) => {
    const a = arv.pos[l.de];
    const b = arv.pos[l.n];
    const x1 = a.x + tamanho.larg;
    const y1 = a.y + alt[l.de] / 2;
    const x2 = b.x;
    const y2 = b.y + alt[l.n] / 2;
    const meio = tamanho.vao * 0.62;
    const corDe = (k) => (k.tipo === 'golpe' ? `var(--tr-${cor(k.trilho)})` : `var(--mp-${k.tipo})`);
    const corDaFolha = l.chegou ? '#f5c542' : l.fecha ? 'var(--dim)' : 'var(--jade)';
    return {
      n: l.n, x1, y1, x2, y2, via: l.via, vaga: l.tipo === 'vaga',
      selo: (l.tipo === 'golpe' || l.tipo === 'finta' || l.tipo === 'preparacao' || l.tipo === 'situacao') && l.via !== 'raiz',
      de: corDe(linhas[l.de]),
      para: l.tipo === 'folha' ? corDaFolha : l.tipo === 'vaga' ? 'var(--dim)' : l.tipo === 'atalho' ? corDe(linhas[l.alvo]) : corDe(l),
      d: `M${x1} ${y1} C${x1 + meio} ${y1} ${x2 - meio} ${y2} ${x2} ${y2}`,
    };
  }) : [];
  /* o fio tracejado do atalho até a peça que já está no mapa. Não entra
     na arrumação: a árvore é a mesma com ou sem ele, e voltar pra trás
     é só um fio que curva pra esquerda. */
  const pontes = arv ? linhas.filter((l) => l.tipo === 'atalho' && Math.max(l.n, l.alvo) <= ate).map((l) => {
    const a = arv.pos[l.n];
    const b = arv.pos[l.alvo];
    const x1 = a.x + tamanho.larg;
    const y1 = a.y + alt[l.n] / 2;
    const x2 = b.x;
    const y2 = b.y + alt[l.alvo] / 2;
    const k = Math.max(tamanho.vao, Math.abs(x2 - x1) / 2);
    const alvo = linhas[l.alvo];
    return {
      n: l.n, x2, y2, acesa: aberto === l.n || aberto === l.alvo,
      cor: alvo.tipo === 'golpe' ? `var(--tr-${cor(alvo.trilho)})` : `var(--mp-${alvo.tipo})`,
      d: `M${x1} ${y1} C${x1 + k} ${y1} ${x2 - k} ${y2} ${x2} ${y2}`,
    };
  }) : [];

  const arrastar = {
    onPointerDown: (e) => {
      if (e.pointerType !== 'mouse') return;
      arrasto.current = { x: e.clientX, y: e.clientY, l: tela.current.scrollLeft, t: tela.current.scrollTop, andou: false };
    },
    onPointerMove: (e) => {
      const a = arrasto.current;
      if (!a) return;
      if (Math.abs(e.clientX - a.x) + Math.abs(e.clientY - a.y) > 4) a.andou = true;
      tela.current.scrollLeft = a.l - (e.clientX - a.x);
      tela.current.scrollTop = a.t - (e.clientY - a.y);
    },
    onPointerUp: () => { setTimeout(() => { arrasto.current = null; }, 0); },
    onPointerLeave: () => { arrasto.current = null; },
  };
  const tocar = (l) => () => {
    if (arrasto.current?.andou) return;
    if (!editar) setAberto(aberto === l.n ? null : l.n);
    else if (l.tipo === 'vaga') editar.onVaga(l.pai, l.via);
    else if (l.tipo === 'atalho') editar.onLigacao(l.lig);
    else if (l.tipo === 'golpe' || l.tipo === 'finta' || l.tipo === 'preparacao') editar.onPeca(l.i);
  };
  /* do atalho pra peça: abre ela e traz pra tela */
  const irPara = (n) => {
    setAberto(n);
    pecas.current[n]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  };
  const mudarZoom = (d) => setZoom(Math.min(1.4, Math.max(0.35, Math.round((z + d) * 100) / 100)));

  /* arrastar uma peça pela alça: só solta em vaga que aceita ela */
  const aceita = (l, i) => l?.tipo === 'vaga' && l.pai !== null && !!moverPasso(passos, i, l.pai, l.via);
  const pega = (l) => ({
    onPointerDown: (e) => {
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setLevando({ i: l.i, n: l.n, titulo: l.titulo, x: e.clientX, y: e.clientY, alvo: null });
    },
    onPointerMove: (e) => {
      if (!levando) return;
      const r = tela.current.getBoundingClientRect();
      const borda = 36;
      if (e.clientX > r.right - borda) tela.current.scrollLeft += 12;
      else if (e.clientX < r.left + borda) tela.current.scrollLeft -= 12;
      if (e.clientY > r.bottom - borda) tela.current.scrollTop += 12;
      else if (e.clientY < r.top + borda) tela.current.scrollTop -= 12;
      const em = document.elementFromPoint?.(e.clientX, e.clientY)?.closest?.('[data-vaga]');
      const n = em ? Number(em.dataset.vaga) : null;
      setLevando({ ...levando, x: e.clientX, y: e.clientY, alvo: n !== null && aceita(linhas[n], levando.i) ? n : null });
    },
    onPointerUp: (e) => {
      e.stopPropagation();
      if (levando?.alvo !== null && levando?.alvo !== undefined) editar.onMover(levando.i, linhas[levando.alvo].pai, linhas[levando.alvo].via);
      setLevando(null);
    },
    onPointerCancel: () => setLevando(null),
    onClick: (e) => e.stopPropagation(),
  });

  return (
    <>
      {objetivo && <div className="mapa-objetivo"><Flag size={15} /> <span>Onde quer chegar: <b>{objetivo}</b></span></div>}
      <div className="mente-zoom">
        <button type="button" aria-label="Afastar" onClick={() => mudarZoom(-0.15)}>−</button>
        <button type="button" aria-label="Aproximar" onClick={() => mudarZoom(0.15)}>+</button>
        <button type="button" onClick={() => setZoom(cabe)}>Ver inteiro</button>
      </div>
      <div className="mente-quadro">
        <div className="mente-tela" ref={tela} {...arrastar}>
          <div className="mente-palco" style={arv ? { width: arv.largura * z, height: arv.altura * z } : undefined}>
            <div className={`mente-mundo mapa${arv ? ' pronto' : ''}${editar ? ' editando' : ''}`} style={arv ? { width: arv.largura, height: arv.altura, transform: `scale(${z})` } : undefined}>
              {arv && (
                <svg className="mapa-fios" width={arv.largura} height={arv.altura} aria-hidden="true">
                  <defs>
                    {galhos.map((g) => (
                      <linearGradient key={g.n} id={`${id}-${g.n}`} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
                        <stop offset="0" style={{ stopColor: g.de }} />
                        <stop offset="1" style={{ stopColor: g.para }} />
                      </linearGradient>
                    ))}
                  </defs>
                  {galhos.map((g) => (
                    <g key={g.n} className={`mapa-fio ${g.via}${g.vaga ? ' vaga' : ''}`} style={{ '--i': g.n }}>
                      <path d={g.d} pathLength="1" className="mapa-fio-traco" stroke={`url(#${id}-${g.n})`} />
                      <path d={g.d} pathLength="1" className="mapa-fio-luz" />
                    </g>
                  ))}
                  {pontes.map((p) => (
                    <g key={`p${p.n}`} className={`mapa-ponte${p.acesa ? ' acesa' : ''}`} style={{ '--i': p.n, color: p.cor }}>
                      <path d={p.d} />
                      <circle cx={p.x2} cy={p.y2} r="4" />
                    </g>
                  ))}
                </svg>
              )}
              {linhas.map((l) => {
                const p = arv?.pos[l.n];
                const visivel = l.n <= ate;
                const solta = levando && l.tipo === 'vaga' ? `${aceita(l, levando.i) ? ' pode' : ''}${levando.alvo === l.n ? ' alvo' : ''}` : '';
                return (
                  <div key={l.n} className={`mente-lugar${levando?.n === l.n ? ' levando' : ''}`} style={{
                    width: tamanho.larg, '--i': l.n,
                    transform: p ? `translate(${p.x}px, ${p.y}px)` : undefined,
                    visibility: p && visivel ? 'visible' : 'hidden',
                  }}>
                    <NoDoMapa
                      l={l} guardar={guardar} aberto={!editar && aberto === l.n} vaga={solta} editar={!!editar}
                      onTocar={l.tipo === 'folha' || (editar && l.tipo === 'posicao') ? undefined : tocar(l)}
                      pega={editar && (l.tipo === 'golpe' || l.tipo === 'finta' || l.tipo === 'preparacao' || l.tipo === 'situacao') && l.via !== 'raiz' ? pega(l) : null}
                    />
                  </div>
                );
              })}
              {galhos.filter((g) => g.selo).map((g) => (
                <span key={g.n} className={`mente-selo ${g.via}`} style={{ left: (g.x1 + g.x2) / 2, top: (g.y1 + g.y2) / 2, '--i': g.n }}>
                  {g.via === 'encaixou' && <Check size={11} strokeWidth={3.5} />}
                  {g.via === 'defendeu' && <X size={11} strokeWidth={3.5} />}
                  {g.via === 'reagiu' && <Sparkles size={11} />}
                  {g.via === 'naoReagiu' && <Repeat size={11} strokeWidth={3} />}
                  {g.via === 'feita' && <Hand size={11} />}
                  {g.via === 'impediu' && <Ban size={11} strokeWidth={3} />}
                  {g.via === 'escapou' && <DoorOpen size={11} />}
                  {g.via === 'retoma' && <RotateCcw size={11} strokeWidth={3} />}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
        {editar
          ? 'Toque no + pra pôr uma peça e numa peça pra mudar. Pra levar uma peça pra outro galho, segure a alça dela e solte num +.'
          : 'Arraste pra andar pelo mapa e toque num golpe pra ler tudo dele.'}
      </p>
      {levando && createPortal(<div className="mente-fantasma" style={{ left: levando.x, top: levando.y }}>{levando.titulo}</div>, document.body)}
      {!editar && aberto !== null && linhas[aberto] && <DetalheDoNo l={linhas[aberto]} objetivo={objetivo} onIr={() => irPara(linhas[aberto].alvo)} />}
    </>
  );
}

function AssistirPlano({ plano, destinoDe, onClose }) {
  /* abre com o mapa inteiro, entrando em cascata; o passo a passo
     revela uma peça por toque, pra ensaiar de cabeça */
  const [ate, setAte] = useState(Infinity);
  if (!plano) return null;
  const { linhas, temFinta, temPreparacao } = linhasDoMapa(plano, destinoDe);
  const total = linhas.length;
  const trilhos = Math.max(0, ...linhas.filter((l) => l.tipo === 'golpe' || l.tipo === 'finta' || l.tipo === 'preparacao').map((l) => l.trilho)) + 1;
  const fechar = () => { setAte(Infinity); onClose(); };
  const passoAPasso = ate !== Infinity;
  const acabou = !passoAPasso || ate >= total - 1;

  return (
    <Sheet aberto onClose={fechar} titulo={plano.nome} subtitulo="o mapa do plano" wide>
      <LegendaDoMapa trilhos={trilhos} finta={temFinta} preparacao={temPreparacao} />
      <MapaDoPlano key={passoAPasso ? 'passo' : 'tudo'} plano={plano} ate={ate} destinoDe={destinoDe} />
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
