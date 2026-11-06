import { SEED } from '../db/seed';
import { CATALOGO_TECNICAS, TECNICA_POR_UID, FAMILIAS_DE_FINALIZACAO } from './tecnicas';
import { ehFamilia } from './familias';

/* ============================================================
   OS 14 ASSUNTOS DO MAPA DE CONHECIMENTO (07/11/2026)

   Lista aprovada pelo dono em 07/11 (relatório
   NEUROJITSU-RELATORIOS/2026-11-07-assuntos-lista-final.md, seções 5 e 8).
   Cada assunto tem um id permanente e uma regra feita só de:
   categoria, slug de posição (de onde sai, onde termina), família
   (fam:*) e etiqueta. NENHUMA regra lê nome. O teste (teste:assuntos)
   passa cada técnica por um objeto que recusa ler nome, inglês e busca.

   Um assunto é uma INTENÇÃO (raspar, finalizar, pegar as costas). A
   posição vira filtro dentro do assunto. Uma técnica pode estar em dois
   assuntos (o Berimbolo raspa e termina nas costas): é certo.

   Só dado e regra. Nenhuma tela lê isto ainda.
   ============================================================ */

/* os grupos de posição vêm da tabela de posições do seed, não de nome */
const GRUPO_DA_POSICAO = new Map(SEED.positions.map((p) => [p.slug, p.familia]));
const daGuarda = (slug) => GRUPO_DA_POSICAO.get(slug) === 'guarda';
const daPerna = (slug) => GRUPO_DA_POSICAO.get(slug) === 'perna';
const MEIA = ['meia_guarda', 'meia_profunda'];
/* posições de quem está por cima mais a tartaruga (quem ataca a tartaruga está por cima) */
const DE_CONTROLE = ['montada', 'montada_tec', 'cem_quilos', 'joelho_barriga', 'norte_sul', 'kesa', 'crucifixo', 'meia_topo', 'tartaruga'];
const FAMILIAS_DE_BRACO = ['fam:armlock', 'fam:kimura', 'fam:americana', 'fam:omoplata', 'fam:pulso'];
const FAMILIAS_DE_PERNA = ['fam:pe_reta', 'fam:kneebar', 'fam:heel_hook'];
const ATAQUE = new Set([...FAMILIAS_DE_FINALIZACAO, 'raspagem', 'transicao']);
const ATAQUE_OU_PEGADA = (t) => ATAQUE.has(t.cat) || t.cat === 'pegada';
const SAI_DAS_COSTAS = new Set([...FAMILIAS_DE_FINALIZACAO, 'transicao', 'pegada']);

/* ---------- de onde a defesa defende ----------
   Sempre pelo `contra` confirmado. Sem contra: pendente fica pendente; a
   defesa de queda sem alvo único entra pela etiqueta wrestling; o resto é
   geral. Nada é deduzido por nome. */
const GRUPO_DO_ALVO = { queda: 'queda', raspagem: 'raspagem' };
export function grupoDaDefesa(t) {
  if (t.contra.length) {
    const alvo = t.contra[0];
    if (ehFamilia(alvo)) return 'finalizacao';
    const cat = TECNICA_POR_UID.get(alvo)?.cat;
    return GRUPO_DO_ALVO[cat] || (FAMILIAS_DE_FINALIZACAO.has(cat) ? 'finalizacao' : 'geral');
  }
  if (t.pendente) return 'pendente';
  return t.tags.includes('wrestling') ? 'queda' : 'geral';
}

export const ASSUNTOS = [
  {
    id: 'assunto:finalizacoes_braco', nome: 'Finalizações de braço',
    regra: 'família armlock, kimura, americana, omoplata ou chave de pulso; ou chave articular sem família que não sai das costas nem de posição de perna',
    entra: (t) => FAMILIAS_DE_BRACO.includes(t.fam) || (t.cat === 'articular' && !t.fam && t.from !== 'costas' && !daPerna(t.from)),
  },
  {
    id: 'assunto:estrangulamentos', nome: 'Estrangulamentos',
    regra: 'categoria estrangulamento',
    entra: (t) => t.cat === 'estrangulamento',
  },
  {
    id: 'assunto:pernas', nome: 'Chaves de pé e entradas na perna',
    regra: 'categoria perna; família pé reta, kneebar ou heel hook; transição que termina em posição de perna; chave articular ou compressão que sai de posição de perna',
    entra: (t) => t.cat === 'perna' || FAMILIAS_DE_PERNA.includes(t.fam) || (t.cat === 'transicao' && daPerna(t.to))
      || ((t.cat === 'articular' || t.cat === 'compressao') && daPerna(t.from)),
  },
  {
    id: 'assunto:guarda_fechada', nome: 'Ataques da guarda fechada',
    regra: 'sai da guarda fechada e é finalização, raspagem, transição ou pegada',
    entra: (t) => t.from === 'guarda_fechada' && ATAQUE_OU_PEGADA(t),
  },
  {
    id: 'assunto:meia_guarda', nome: 'Jogo da meia-guarda',
    regra: 'sai da meia ou da meia profunda e é finalização, raspagem, transição ou pegada',
    entra: (t) => MEIA.includes(t.from) && ATAQUE_OU_PEGADA(t),
  },
  {
    id: 'assunto:raspagens', nome: 'Raspagens',
    regra: 'categoria raspagem',
    entra: (t) => t.cat === 'raspagem',
    filtros: [
      { id: 'fechada', nome: 'Da guarda fechada', entra: (t) => t.from === 'guarda_fechada' },
      { id: 'meia', nome: 'Da meia-guarda', entra: (t) => MEIA.includes(t.from) },
      { id: 'aberta', nome: 'Da guarda aberta', entra: (t) => daGuarda(t.from) && t.from !== 'guarda_fechada' && !MEIA.includes(t.from) },
      { id: 'perna', nome: 'De posição de perna', entra: (t) => daPerna(t.from) },
    ],
  },
  {
    id: 'assunto:passagens', nome: 'Passagens de guarda',
    regra: 'categoria passagem',
    entra: (t) => t.cat === 'passagem',
  },
  {
    id: 'assunto:retencao', nome: 'Retenção de guarda',
    regra: 'categoria retenção',
    entra: (t) => t.cat === 'retencao',
  },
  {
    id: 'assunto:saidas', nome: 'Saídas de posição ruim',
    regra: 'categoria escapada',
    entra: (t) => t.cat === 'escapada',
  },
  {
    id: 'assunto:controle_por_cima', nome: 'Controle por cima',
    regra: 'sai de posição dominante (sem as costas) ou da tartaruga, por cima, e é transição ou pegada',
    entra: (t) => DE_CONTROLE.includes(t.from) && (t.cat === 'transicao' || t.cat === 'pegada'),
  },
  {
    id: 'assunto:costas', nome: 'Pegar e atacar as costas',
    regra: 'termina nas costas vindo de outra posição; ou sai das costas e é finalização, transição ou pegada',
    entra: (t) => (t.to === 'costas' && t.from !== 'costas') || (t.from === 'costas' && SAI_DAS_COSTAS.has(t.cat)),
  },
  {
    id: 'assunto:defesas', nome: 'Defesas de finalização e de queda',
    regra: 'toda a categoria defesa (o contra serve ao filtro e à recomendação, não para entrar)',
    entra: (t) => t.cat === 'defesa',
    filtros: [
      { id: 'finalizacao', nome: 'Contra finalização', entra: (t) => grupoDaDefesa(t) === 'finalizacao' },
      { id: 'queda', nome: 'Contra queda', entra: (t) => grupoDaDefesa(t) === 'queda' },
      { id: 'raspagem', nome: 'Contra raspagem', entra: (t) => grupoDaDefesa(t) === 'raspagem' },
      { id: 'geral', nome: 'Geral, sem alvo', entra: (t) => grupoDaDefesa(t) === 'geral' },
      { id: 'pendente', nome: 'Alvo ainda a confirmar', entra: (t) => grupoDaDefesa(t) === 'pendente' },
    ],
  },
  {
    id: 'assunto:troca_de_guarda', nome: 'Trocar de guarda',
    regra: 'transição que sai de uma guarda e termina em outra guarda',
    entra: (t) => t.cat === 'transicao' && daGuarda(t.from) && daGuarda(t.to) && t.from !== t.to,
  },
  {
    id: 'assunto:jogo_em_pe', nome: 'Jogo em pé',
    regra: 'categoria queda; pegada que sai de em pé ou do clinch',
    entra: (t) => t.cat === 'queda' || (t.cat === 'pegada' && (t.from === 'em_pe' || t.from === 'clinch')),
    filtros: [
      { id: 'wrestling', nome: 'Wrestling', entra: (t) => t.tags.includes('wrestling') },
      { id: 'judo', nome: 'Judô', entra: (t) => t.tags.includes('judo') },
      { id: 'puxada', nome: 'Puxada de guarda', entra: (t) => t.cat === 'queda' && daGuarda(t.to) },
      { id: 'pegada', nome: 'Pegadas', entra: (t) => t.cat === 'pegada' || t.tags.includes('pegada') },
    ],
  },
];

export const ASSUNTO_POR_ID = new Map(ASSUNTOS.map((a) => [a.id, a]));

/* o catálogo por assunto, calculado uma vez. A chave é o uid permanente. */
const DO_ASSUNTO = new Map(ASSUNTOS.map((a) => [a.id, CATALOGO_TECNICAS.filter((t) => a.entra(t))]));
const ASSUNTOS_DO_UID = new Map(CATALOGO_TECNICAS.map((t) => [t.uid, ASSUNTOS.filter((a) => a.entra(t)).map((a) => a.id)]));

/* as técnicas do assunto, com o filtro de dentro se pedir */
export function tecnicasDoAssunto(id, filtro = null) {
  const lista = DO_ASSUNTO.get(id) || [];
  if (!filtro) return lista;
  const f = ASSUNTO_POR_ID.get(id)?.filtros?.find((x) => x.id === filtro);
  return f ? lista.filter((t) => f.entra(t)) : [];
}

/* os assuntos da técnica, pelo uid (qualquer um dos uids dela vale) */
export const assuntosDaTecnica = (uid) => ASSUNTOS_DO_UID.get(TECNICA_POR_UID.get(uid)?.uid) || [];

/* o que a defesa defende: confirmado (contra) e o que ainda precisa de decisão (pendente) */
export function contraDaTecnica(uid) {
  const t = TECNICA_POR_UID.get(uid);
  return { contra: t?.contra || [], pendente: t?.pendente || null };
}
