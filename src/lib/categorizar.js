/* ============================================================
   CATEGORIZAR VÍDEO PELO TÍTULO

   Isto não inventa taxonomia. As palavras daqui saíram dos 680
   vídeos que já estavam etiquetados na mão: pra cada tema, foram
   escolhidas as palavras que aparecem no título e que, no acervo
   existente, apontam aquele tema quase sempre.

   Palavra que apontava pra todo lado ficou de fora, mesmo sendo
   comum. "Domine" aparece em 49 títulos e não diz nada, porque é
   o verbo de chamada dos shorts: domine a guarda, domine a queda,
   domine o equilíbrio. "Postura" e "peso" também caíram por isso.

   Quando nenhuma palavra bate, a função não chuta e não cria
   categoria nova. Ela devolve a lista vazia e levanta a mão, e
   quem cadastrou decide.
   ============================================================ */

const norm = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const REGRAS_TEMA = {
  logica: ['logica', 'logico', 'estrategia', 'estrategias', 'pensar', 'pense',
    'dominar', 'comportar', 'entenda', 'entender', 'fundamento', 'fundamentos',
    'estrutura', 'estudando', 'por tras', 'ciencia', 'conceito', 'conceitos'],

  competicao: ['faixa', 'faixas', 'luta', 'lutar', 'lutando', 'branca', 'azul', 'roxa',
    'marrom', 'preta', 'duvidas', 'curso', 'campeonato', 'competicao', 'competir',
    'graduacao', 'graduar', 'regras', 'arbitragem', 'pontuacao', 'absoluto', 'podio',
    'brasileiro', 'inteligencia'],

  guarda: ['guarda', 'guardas', 'guardeiro', 'fechada', 'laco', 'meia', 'aranha',
    'la riva', 'lariva', 'borboleta', 'diamante', 'amasso', 'amassado'],

  controle: ['100kg', 'cem quilos', 'controle', 'controlar', 'controlando', 'costas',
    'pegada', 'pegadas', 'pressao', 'montada', 'norte sul', 'imobilizar', 'prender'],

  finalizacao: ['finalizacao', 'finalizacoes', 'finalizar', 'finalizando', 'triangulo',
    'omoplata', 'estrangulamento', 'estrangulamentos', 'estrangular', 'armlock',
    'arm lock', 'kimura', 'americana', 'katagatame', 'kata gatame', 'ezequiel',
    'tarikoplata', 'panturrilha', 'gola', 'leglock', 'leg lock', 'botinha',
    'garami', 'sanguineo'],

  fisico: ['forca', 'desequilibrio', 'desequilibrar', 'desequilibrando', 'equilibrio',
    'quadril', 'mobilidade', 'gas', 'respirar', 'respiracao', 'fisiologia',
    'cansar', 'cansa', 'flexibilidade'],

  queda: ['judo', 'queda', 'quedas', 'quedar', 'desequilibrio', 'sasae', 'osotogari',
    'ouchi', 'uchi', 'deashi', 'koshiguruma', 'ogoshi', 'tsuri', 'ashi',
    'derrubar', 'projecao', 'sumo'],

  defesa: ['defesa', 'defender', 'defensiva', 'pessoal', 'sair', 'escapar',
    'escapando', 'sobrevivencia', 'fuga', 'apanha', 'apanhar'],

  passagem: ['passar', 'passagem', 'passador', 'passando'],

  raspagem: ['raspagem', 'raspar', 'raspou', 'sweep'],

  /* drill quase nunca tem a palavra "drill" no título. O que ele
     tem é o assunto do drill: distância, tempo, movimentação. Foi
     assim que os vídeos de drill do acervo foram etiquetados. */
  drill: ['drill', 'drills', 'repeticao', 'timing', 'transicoes',
    'distancia', 'exercicio', 'movimentacao', 'sincronia', 'tempo', 'pisada'],
};

export const REGRAS_POSICAO = {
  cem_quilos: ['100kg', 'cem quilos', '100 kilos'],
  guarda_fechada: ['guarda fechada', 'fechada'],
  meia_guarda: ['meia guarda', 'meia'],
  guarda_aberta: ['guarda aberta', 'laco', 'aranha', 'la riva', 'lariva', 'borboleta'],
  costas: ['costas'],
  montada: ['montada'],
  norte_sul: ['norte sul'],
  perna: ['panturrilha', 'botinha', 'leglock', 'leg lock', 'ashi'],
  em_pe: ['em pe', 'judo', 'queda', 'quedas', 'sasae', 'osotogari', 'ouchi',
    'deashi', 'koshiguruma', 'ogoshi', 'tsuri', 'sumo'],
};

export const REGRAS_FAIXA = {
  branca: ['faixa branca', 'faixas brancas', 'iniciantes', 'iniciante'],
  azul: ['faixa azul'],
  roxa: ['faixa roxa'],
  marrom: ['faixa marrom'],
  preta: ['faixa preta'],
};

/* palavra inteira, nunca pedaço. Sem isto "meia" casaria dentro
   de "meiada" e "gas" dentro de "gasto". */
function tem(titulo, termo) {
  const t = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^| )' + t + '( |$)').test(titulo);
}

const casa = (titulo, regras) => Object.entries(regras)
  .filter(([, termos]) => termos.some((x) => tem(titulo, x)))
  .map(([id]) => id);

/* ------------------------------------------------------------
   O short longo demais e a aula curta demais

   O YouTube chama de short qualquer coisa até três minutos. É a
   régua dele e serve pra cá também, porque é ela que separa o
   vídeo que se vê na fila do mercado do vídeo que se senta pra
   estudar.
   ------------------------------------------------------------ */
export const SEGUNDOS_DE_SHORT = 180;

export const tipoPorDuracao = (segundos) =>
  (Number(segundos) || 0) <= SEGUNDOS_DE_SHORT ? 'short' : 'aula';

export function categorizar(titulo, duracao = null) {
  const t = norm(titulo);

  const temas = casa(t, REGRAS_TEMA);
  const posicoes = casa(t, REGRAS_POSICAO);
  const faixa = Object.entries(REGRAS_FAIXA)
    .find(([, termos]) => termos.some((x) => tem(t, x)))?.[0] || null;

  return {
    temas,
    posicoes,
    faixa,
    tipo: duracao == null ? null : tipoPorDuracao(duracao),
    /* nenhuma palavra do título bateu com as categorias que já
       existem. Não é pra forçar numa nem pra criar outra: é pra
       perguntar. */
    precisaRevisar: temas.length === 0,
  };
}

/* ============================================================
   LER O QUE FOI COLADO

   Uma linha por vídeo, no formato: título | link | duração.
   A duração aceita 12:34, 1:02:03 ou o número de segundos.
   ============================================================ */

export function idDoYoutube(texto) {
  const s = String(texto || '').trim();
  const m = s.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  /* alguém pode colar só o id */
  return /^[A-Za-z0-9_-]{6,15}$/.test(s) ? s : null;
}

export function lerDuracao(texto) {
  const s = String(texto || '').replace(/[[\]\s]/g, '');
  if (!s) return 0;
  if (!s.includes(':')) return Number(s) || 0;
  const p = s.split(':').map(Number);
  if (p.some((x) => Number.isNaN(x))) return 0;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}

export function lerLinha(linha) {
  const partes = String(linha || '').split('|').map((x) => x.trim()).filter(Boolean);
  if (partes.length < 2) return { erro: 'faltou parte. O formato é: titulo | link | duracao' };

  /* o link é a parte que tem um id dentro, venha em que ordem vier */
  const iLink = partes.findIndex((p) => idDoYoutube(p));
  if (iLink < 0) return { erro: 'não achei o link do YouTube nesta linha' };

  const id = idDoYoutube(partes[iLink]);
  const resto = partes.filter((_, i) => i !== iLink);

  /* a duração é a parte que é só número ou relógio */
  const iDur = resto.findIndex((p) => /^\[?[\d:]+\]?$/.test(p));
  const d = iDur >= 0 ? lerDuracao(resto[iDur]) : 0;
  const titulo = resto.filter((_, i) => i !== iDur).join(' ').trim();

  if (!titulo) return { erro: 'faltou o título' };
  if (!d) return { erro: 'faltou a duração, ou não entendi o formato dela' };

  return { id, t: titulo, d, ...categorizar(titulo, d) };
}

export function lerColado(texto) {
  const linhas = String(texto || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return linhas.map((l, i) => ({ linha: i + 1, original: l, ...lerLinha(l) }));
}
