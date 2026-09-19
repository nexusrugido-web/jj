/* ============================================================
   O VOCABULÁRIO DO JOGO

   Até aqui cada parte do app falava a sua língua. O vídeo dizia
   "cem_quilos", o rola dizia "cem_baixo", a biblioteca de técnicas
   dizia "sob_cem", e nada batia com nada: pra achar o vídeo de
   quem fica preso embaixo do 100kg, o app tinha que adivinhar pelo
   título.

   Aqui mora a língua única. O vídeo, o rola, a técnica e a
   recomendação falam estes ids, e os nomes antigos entram pelos
   mapas lá embaixo. Mudar esta lista é mudar o banco também
   (estudo.sql confere os ids), então ela muda devagar.
   ============================================================ */

/* ---------- onde a luta está ---------- */
export const POSICOES = [
  { id: 'em_pe', nome: 'Em pé' },
  { id: 'guarda_fechada', nome: 'Guarda fechada' },
  { id: 'guarda_aberta', nome: 'Guarda aberta' },
  { id: 'meia_guarda', nome: 'Meia-guarda' },
  { id: 'perna', nome: 'Jogo de perna' },
  { id: 'tartaruga', nome: 'Tartaruga' },
  { id: 'cem', nome: '100kg' },
  { id: 'norte_sul', nome: 'Norte-sul' },
  { id: 'joelho_barriga', nome: 'Joelho na barriga' },
  { id: 'montada', nome: 'Montada' },
  { id: 'costas', nome: 'Costas' },
];

/* de que lado. Na guarda, "baixo" é quem joga guarda e "cima" é
   quem passa. Nas posições de controle, "baixo" é quem está preso. */
export const LADOS = [
  { id: 'cima', nome: 'por cima' },
  { id: 'baixo', nome: 'por baixo' },
  { id: 'neutro', nome: 'neutro' },
];

/* ---------- o que se treina ----------
   Os ids são os das categorias da biblioteca de técnicas, pra a
   técnica e o vídeo se reconhecerem sem tradução. "controle",
   "finalizacao" e "fisico" não são categoria de técnica, mas são
   assunto de muita aula. "finalizacao" é o guarda-chuva das três
   de finalizar. */
export const HABILIDADES = [
  { id: 'queda', nome: 'Queda' },
  { id: 'passagem', nome: 'Passagem' },
  { id: 'raspagem', nome: 'Raspagem' },
  { id: 'guarda', nome: 'Montar a guarda' },
  { id: 'retencao', nome: 'Retenção de guarda' },
  { id: 'controle', nome: 'Controle e pressão' },
  { id: 'transicao', nome: 'Transição' },
  { id: 'pegada', nome: 'Pegada' },
  { id: 'base', nome: 'Base e movimento' },
  { id: 'escapada', nome: 'Escapada' },
  { id: 'defesa', nome: 'Defesa de finalização' },
  { id: 'finalizacao', nome: 'Finalização' },
  { id: 'estrangulamento', nome: 'Estrangulamento', dentroDe: 'finalizacao' },
  { id: 'articular', nome: 'Chave articular', dentroDe: 'finalizacao' },
  { id: 'perna', nome: 'Chave de perna', dentroDe: 'finalizacao' },
  { id: 'fisico', nome: 'Corpo e gás' },
];

/* ---------- que tipo de aula é ---------- */
export const FORMATOS = [
  { id: 'conceito', nome: 'Conceito', desc: 'Explica o porquê, não o passo a passo' },
  { id: 'tecnica', nome: 'Técnica', desc: 'Mostra como fazer' },
  { id: 'drill', nome: 'Drill', desc: 'Exercício pra repetir' },
  { id: 'analise', nome: 'Análise de luta', desc: 'Luta comentada' },
  { id: 'mentalidade', nome: 'Mentalidade', desc: 'Estudo, faixa, competição, rotina' },
];

/* ---------- pra quem ---------- */
export const NIVEIS = [
  { id: 'fundamento', nome: 'Fundamento', desc: 'Faixa branca, ou quem está revendo a base' },
  { id: 'intermediario', nome: 'Intermediário', desc: 'Faixa azul, jogo já montado' },
  { id: 'avancado', nome: 'Avançado', desc: 'Roxa pra cima, detalhe e sistema' },
];

/* ---------- a situação de quem assiste ----------
   Saiu das 81 respostas do formulário de entrada. Metade das
   dificuldades não é de posição: é não saber o que fazer, lutar
   com gente mais pesada, depender de força, cansar, esquecer. Sem
   isto, a aula "Como raspar sendo leve e fraco" nunca acharia
   quem escreveu "sou leve e todo mundo lá é mais pesado". */
export const SITUACOES = [
  { id: 'perdido_no_rola', nome: 'Perdido no rola', desc: 'Não sabe o que fazer, qual o próximo passo, como ligar uma posição na outra' },
  { id: 'contra_pesado', nome: 'Contra mais pesado', desc: 'Treina com gente mais pesada ou mais forte' },
  { id: 'menos_forca', nome: 'Menos força', desc: 'Usa força demais e quer trocar por técnica' },
  { id: 'sem_gas', nome: 'Sem gás', desc: 'Cansa rápido, perde o fôlego, esquece de respirar' },
  { id: 'esquece_tecnica', nome: 'Esquece a técnica', desc: 'Aprende na aula e não consegue lembrar ou aplicar no rola' },
  { id: 'competir', nome: 'Competição', desc: 'Compete ou quer competir' },
];

/* ---------- em que dado confiar ----------
   A esteira é automática: o vídeo entra "pelo título", a IA
   classifica, e só o que ela não tem certeza vai pra revisão. */
export const CLASSIFICACOES = [
  { id: 'legado', nome: 'pelo título', desc: 'Só as categorias antigas ou as regras do título. A IA ainda não passou' },
  { id: 'automatica', nome: 'automática', desc: 'A IA classificou e os sinais concordam' },
  { id: 'revisar', nome: 'revisar', desc: 'A IA classificou, mas ficou em dúvida ou discordou do que já existia' },
  { id: 'revisada', nome: 'conferida', desc: 'Alguém conferiu. Nada automático mexe mais' },
];

export const idsDe = (lista) => lista.map((x) => x.id);
export const nomeDe = (lista, id) => lista.find((x) => x.id === id)?.nome || id;

/* "cem:baixo" <-> { posicao: 'cem', lado: 'baixo' } */
export const juntar = (posicao, lado = 'neutro') => `${posicao}:${lado || 'neutro'}`;
export function separar(pl) {
  const [posicao, lado = 'neutro'] = String(pl || '').split(':');
  return { posicao, lado };
}

/* todas as combinações que o banco aceita */
export const POSICOES_LADO = POSICOES.flatMap((p) => LADOS.map((l) => juntar(p.id, l.id)));

export function nomePosicaoLado(pl) {
  const { posicao, lado } = separar(pl);
  const p = nomeDe(POSICOES, posicao);
  return lado === 'neutro' ? p : `${p} ${nomeDe(LADOS, lado)}`;
}

/* a habilidade e a família dela: pedir "finalização" acha
   estrangulamento, e pedir estrangulamento acha aula de finalização */
export function familiaDaHabilidade(id) {
  const h = HABILIDADES.find((x) => x.id === id);
  if (!h) return [id];
  if (h.dentroDe) return [h.id, h.dentroDe];
  return [h.id, ...HABILIDADES.filter((x) => x.dentroDe === h.id).map((x) => x.id)];
}

/* ============================================================
   OS MAPAS DOS NOMES ANTIGOS
   ============================================================ */

/* as posições que o cadastro de vídeo usava (sem lado) */
export const DE_POSICAO_VIDEO = {
  cem_quilos: 'cem',
  guarda_fechada: 'guarda_fechada',
  meia_guarda: 'meia_guarda',
  guarda_aberta: 'guarda_aberta',
  costas: 'costas',
  montada: 'montada',
  norte_sul: 'norte_sul',
  perna: 'perna',
  em_pe: 'em_pe',
};

/* a posição em que o rola começou */
export const DE_POSICAO_INICIAL = {
  em_pe: 'em_pe:neutro',
  de_joelhos: 'em_pe:neutro',
  guarda_fechada_baixo: 'guarda_fechada:baixo',
  guarda_fechada_cima: 'guarda_fechada:cima',
  guarda_aberta_baixo: 'guarda_aberta:baixo',
  guarda_aberta_cima: 'guarda_aberta:cima',
  meia_baixo: 'meia_guarda:baixo',
  meia_cima: 'meia_guarda:cima',
  cem_baixo: 'cem:baixo',
  cem_cima: 'cem:cima',
  montada_baixo: 'montada:baixo',
  montada_cima: 'montada:cima',
  costas_baixo: 'costas:baixo',
  costas_cima: 'costas:cima',
  perna: 'perna:neutro',
};

/* as posições da biblioteca (tabela positions do aparelho) */
export const DE_POSICAO_BIBLIOTECA = {
  em_pe: 'em_pe:neutro',
  clinch: 'em_pe:neutro',
  costas: 'costas:cima',
  montada: 'montada:cima',
  montada_tec: 'montada:cima',
  crucifixo: 'costas:cima',
  joelho_barriga: 'joelho_barriga:cima',
  cem_quilos: 'cem:cima',
  kesa: 'cem:cima',
  norte_sul: 'norte_sul:cima',
  meia_topo: 'meia_guarda:cima',
  passando: 'guarda_aberta:cima',
  guarda_fechada: 'guarda_fechada:baixo',
  guarda_aberta: 'guarda_aberta:baixo',
  meia_guarda: 'meia_guarda:baixo',
  meia_profunda: 'meia_guarda:baixo',
  borboleta: 'guarda_aberta:baixo',
  de_la_riva: 'guarda_aberta:baixo',
  dlr_invertida: 'guarda_aberta:baixo',
  aranha: 'guarda_aberta:baixo',
  lasso: 'guarda_aberta:baixo',
  x_guard: 'guarda_aberta:baixo',
  single_x: 'guarda_aberta:baixo',
  sentado: 'guarda_aberta:baixo',
  'laçada_z': 'guarda_aberta:baixo',
  g50: 'perna:neutro',
  ashi: 'perna:neutro',
  saddle: 'perna:neutro',
  tartaruga: 'tartaruga:baixo',
  sob_meia: 'meia_guarda:baixo',
  sob_cem: 'cem:baixo',
  sob_norte_sul: 'norte_sul:baixo',
  sob_joelho: 'joelho_barriga:baixo',
  sob_montada: 'montada:baixo',
  costas_tomadas: 'costas:baixo',
  finalizado: null,
  finalizacao: null,
};

/* as posições que a leitura do jogo chama de "ficou preso" */
export const DE_POSICAO_SOFRIDA = {
  cem_baixo: 'cem:baixo',
  sob_cem: 'cem:baixo',
  montada_baixo: 'montada:baixo',
  sob_montada: 'montada:baixo',
  costas_baixo: 'costas:baixo',
  costas_sofridas: 'costas:baixo',
  joelho_sofrido: 'joelho_barriga:baixo',
};

/* os temas antigos do vídeo. "competicao" e "geral" não viram
   nada: "competicao" marcava vídeo só porque o título dizia
   "faixa branca", e "geral" era a falta de categoria. */
export const DE_TEMA = {
  logica: { formato: 'conceito' },
  guarda: { habilidades: ['guarda'] },
  controle: { habilidades: ['controle'] },
  finalizacao: { habilidades: ['finalizacao'] },
  defesa: { habilidades: ['escapada', 'defesa'] },
  queda: { habilidades: ['queda'] },
  passagem: { habilidades: ['passagem'] },
  raspagem: { habilidades: ['raspagem'] },
  fisico: { habilidades: ['fisico'] },
  drill: { formato: 'drill' },
  competicao: {},
  geral: {},
};

export const DE_FAIXA = {
  branca: 'fundamento',
  azul: 'intermediario',
  roxa: 'avancado',
  marrom: 'avancado',
  preta: 'avancado',
};

/* ------------------------------------------------------------
   Dos campos antigos de um vídeo pros novos. É a mesma conta que
   o estudo.sql faz no banco; aqui ela serve pro vídeo cadastrado
   agora, antes de a IA passar, e pra a esteira saber o que já
   estava etiquetado.
   ------------------------------------------------------------ */
export function doLegado({ temas = [], posicoes = [], faixa = null } = {}) {
  const habilidades = new Set();
  let formato = null;
  for (const t of temas) {
    const m = DE_TEMA[t] || {};
    for (const h of m.habilidades || []) habilidades.add(h);
    /* conceito ganha de drill quando o vídeo tem os dois: drill com
       explicação ainda é aula de conceito */
    if (m.formato && (!formato || m.formato === 'conceito')) formato = m.formato;
  }
  const posicaoLado = [...new Set(posicoes.map((p) => DE_POSICAO_VIDEO[p]).filter(Boolean))]
    .map((p) => juntar(p, 'neutro'));

  return {
    posicaoLado,
    habilidades: [...habilidades],
    formato,
    nivel: DE_FAIXA[faixa] || null,
  };
}

/* ------------------------------------------------------------
   E o caminho de volta. Enquanto o Estudo ainda separa por tema,
   o vídeo classificado no vocabulário novo precisa continuar
   aparecendo no tema certo, sem ninguém classificar duas vezes.
   ------------------------------------------------------------ */
const TEMA_DA_HABILIDADE = {
  guarda: 'guarda', retencao: 'guarda',
  controle: 'controle', transicao: 'controle',
  finalizacao: 'finalizacao', estrangulamento: 'finalizacao', articular: 'finalizacao', perna: 'finalizacao',
  escapada: 'defesa', defesa: 'defesa',
  queda: 'queda', pegada: 'queda',
  passagem: 'passagem',
  raspagem: 'raspagem',
  fisico: 'fisico',
  base: 'drill',
};
const TEMA_DO_FORMATO = { conceito: 'logica', analise: 'logica', drill: 'drill', mentalidade: 'competicao' };
const TEMA_DA_SITUACAO = { competir: 'competicao' };
const POSICAO_VIDEO_DE = Object.fromEntries(Object.entries(DE_POSICAO_VIDEO).map(([velho, novo]) => [novo, velho]));

export function paraLegado({ posicaoLado = [], habilidades = [], formato = null, situacoes = [] } = {}) {
  const temas = new Set();
  if (TEMA_DO_FORMATO[formato]) temas.add(TEMA_DO_FORMATO[formato]);
  for (const h of habilidades) if (TEMA_DA_HABILIDADE[h]) temas.add(TEMA_DA_HABILIDADE[h]);
  for (const x of situacoes) if (TEMA_DA_SITUACAO[x]) temas.add(TEMA_DA_SITUACAO[x]);
  const posicoes = new Set(posicaoLado.map((pl) => POSICAO_VIDEO_DE[separar(pl).posicao]).filter(Boolean));
  return { temas: [...temas], posicoes: [...posicoes] };
}
