/* ============================================================
   PONTUAÇÃO IBJJF
   Finalização é evento raro. Ponto acontece o tempo todo ,
   é por isso que registrar pontos dá dado em TODA rola,
   não só nas que terminam em tap.
   ============================================================ */

export const PONTOS = [
  { id: 'queda',        nome: 'Queda',              pts: 2, en: 'Takedown',      eixo: 'queda',      posicaoDestino: 'cem_quilos' },
  { id: 'raspagem',     nome: 'Raspagem',           pts: 2, en: 'Sweep',         eixo: 'raspagem',   posicaoDestino: 'cem_quilos' },
  { id: 'joelho',       nome: 'Joelho na barriga',  pts: 2, en: 'Knee on belly', eixo: 'controle',   posicaoDestino: 'joelho_barriga' },
  { id: 'passagem',     nome: 'Passagem de guarda', pts: 3, en: 'Guard pass',    eixo: 'passagem',   posicaoDestino: 'cem_quilos' },
  { id: 'montada',      nome: 'Montada',            pts: 4, en: 'Mount',         eixo: 'controle',   posicaoDestino: 'montada' },
  { id: 'costas',       nome: 'Pegada nas costas',  pts: 4, en: 'Back control',  eixo: 'controle',   posicaoDestino: 'costas' },
];

export const pontosPorId = Object.fromEntries(PONTOS.map((p) => [p.id, p]));

/* vantagem não vale ponto, mas decide luta, e é o melhor
   indicador de "quase lá" que existe */
export const VANTAGEM = { id: 'vantagem', nome: 'Vantagem', pts: 0 };
export const PUNICAO = { id: 'punicao', nome: 'Punição', pts: 0 };

export function somarPontos(lista) {
  return (lista || []).reduce((a, id) => a + (pontosPorId[id]?.pts || 0), 0);
}

export function agruparPontos(lista) {
  const m = new Map();
  for (const id of lista || []) m.set(id, (m.get(id) || 0) + 1);
  return [...m.entries()].map(([id, n]) => ({ ...pontosPorId[id], id, n, total: (pontosPorId[id]?.pts || 0) * n }));
}

/* ---------- posição inicial do rola ---------- */
export const POSICOES_INICIAIS = [
  { id: 'em_pe',        nome: 'Em pé',                 lado: 'neutro' },
  { id: 'de_joelhos',   nome: 'De joelhos',            lado: 'neutro' },
  { id: 'guarda_fechada_baixo', nome: 'Guarda fechada (por baixo)', lado: 'baixo' },
  { id: 'guarda_fechada_cima',  nome: 'Guarda fechada (por cima)',  lado: 'cima' },
  { id: 'guarda_aberta_baixo',  nome: 'Guarda aberta (por baixo)',  lado: 'baixo' },
  { id: 'guarda_aberta_cima',   nome: 'Guarda aberta (por cima)',   lado: 'cima' },
  { id: 'meia_baixo',   nome: 'Meia-guarda (por baixo)', lado: 'baixo' },
  { id: 'meia_cima',    nome: 'Meia-guarda (por cima)',  lado: 'cima' },
  { id: 'cem_baixo',    nome: '100kg (por baixo)',  lado: 'baixo' },
  { id: 'cem_cima',     nome: '100kg (por cima)',   lado: 'cima' },
  { id: 'montada_baixo', nome: 'Montada (por baixo)',    lado: 'baixo' },
  { id: 'montada_cima',  nome: 'Montada (por cima)',     lado: 'cima' },
  { id: 'costas_baixo',  nome: 'Costas entregues',       lado: 'baixo' },
  { id: 'costas_cima',   nome: 'Nas costas dele',        lado: 'cima' },
  { id: 'perna',        nome: 'Posição de perna (ashi, 50/50)', lado: 'neutro' },
];

export const posInicialPorId = Object.fromEntries(POSICOES_INICIAIS.map((p) => [p.id, p]));

/* ---------- peso do adversário em relação a você ---------- */
export const PESO_REL = [
  { id: 'leve',    nome: 'Mais leve que eu', peso: 0.85, icone: '↓' },
  { id: 'similar', nome: 'Peso parecido',    peso: 1.0,  icone: '=' },
  { id: 'pesado',  nome: 'Mais pesado que eu', peso: 1.25, icone: '↑' },
];

export const pesoRelPorId = Object.fromEntries(PESO_REL.map((p) => [p.id, p]));

/* ---------- estilos de jogo ---------- */
export const ESTILOS = [
  {
    id: 'quedador', nome: 'Wrestler / Quedador', lema: 'Eu decido onde a luta começa.',
    desc: 'Jogo em pé forte, busca queda. Evita puxar guarda e começa a luta já por cima.',
    eixos: { queda: 3, passagem: 1 },
  },
  {
    id: 'passador', nome: 'Passador de Pressão', lema: 'Eu chego e não saio mais.',
    desc: 'Vive por cima. Abre a guarda, passa e instala o peso até o cara ceder.',
    eixos: { passagem: 3, controle: 2 },
  },
  {
    id: 'guardeiro', nome: 'Guardeiro', lema: 'Deitado eu sou perigoso.',
    desc: 'Constrói o jogo por baixo. Raspa, ataca e prefere o cara vindo pra cima.',
    eixos: { raspagem: 3, finalizacao: 1 },
  },
  {
    id: 'finalizador', nome: 'Caçador de Finalização', lema: 'Ponto é consequência.',
    desc: 'Não joga pra pontuar, joga pra acabar. Aceita posição ruim se abrir ataque.',
    eixos: { finalizacao: 3 },
  },
  {
    id: 'controlador', nome: 'Controlador', lema: 'Primeiro eu prendo, depois eu penso.',
    desc: 'Domina posição e sufoca. Montada, costas e joelho na barriga são a casa dele.',
    eixos: { controle: 3, passagem: 1 },
  },
  {
    id: 'defensor', nome: 'Sobrevivente', lema: 'Ninguém me pega.',
    desc: 'Difícil de passar e de finalizar. Constrói o jogo em cima de não perder.',
    eixos: { defesa: 3 },
  },
  {
    id: 'completo', nome: 'Jogo Completo', lema: 'Eu me adapto.',
    desc: 'Sem um pico dominante, pontua de vários lugares e se ajusta ao adversário.',
    eixos: {},
  },
];

export const estiloPorId = (id) => ESTILOS.find((e) => e.id === id) || ESTILOS[6];

/* ---------- quiz do primeiro uso ---------- */
export const QUIZ = [
  {
    q: 'Quando o rola começa, qual é o seu primeiro instinto?',
    ops: [
      { t: 'Aplicar uma queda e ficar por cima', e: { queda: 3 } },
      { t: 'Puxar guarda e trabalhar por baixo', e: { raspagem: 3 } },
      { t: 'Avançar buscando finalização', e: { finalizacao: 3 } },
      { t: 'Trabalhar as pegadas e montar um plano', e: { controle: 2, passagem: 1 } },
      { t: 'Ler o cara e me adaptar', e: { defesa: 1, controle: 1 } },
    ],
  },
  {
    q: 'Em qual posição você se sente mais confortável?',
    ops: [
      { t: 'Em pé, buscando queda', e: { queda: 3 } },
      { t: 'Na guarda (fechada, meia, aberta)', e: { raspagem: 3 } },
      { t: 'Por cima pressionando (100kg, montada)', e: { passagem: 2, controle: 2 } },
      { t: 'Em posições de perna (ashi, 50/50)', e: { finalizacao: 2, raspagem: 1 } },
      { t: 'Me viro em qualquer uma', e: { defesa: 2 } },
    ],
  },
  {
    q: 'Contra um adversário difícil, qual é a sua estratégia?',
    ops: [
      { t: 'Pressão constante até ele errar', e: { passagem: 2, controle: 2 } },
      { t: 'Paciência e controle, esperar o momento', e: { controle: 3 } },
      { t: 'Atacar sem parar buscando a finalização', e: { finalizacao: 3 } },
      { t: 'Mudar de estratégia até achar o que funciona', e: { defesa: 1, controle: 1 } },
      { t: 'Usar minha guarda pra neutralizar e contra-atacar', e: { raspagem: 2, defesa: 2 } },
    ],
  },
  {
    q: 'O que mais te dá satisfação num rola?',
    ops: [
      { t: 'Derrubar o cara com uma queda limpa', e: { queda: 3 } },
      { t: 'Passar uma guarda que estava travada', e: { passagem: 3 } },
      { t: 'Raspar quem estava me pressionando', e: { raspagem: 3 } },
      { t: 'Encaixar a finalização', e: { finalizacao: 3 } },
      { t: 'Sobreviver a um round que eu ia perder', e: { defesa: 3 } },
    ],
  },
  {
    q: 'Quando você está por cima, o que faz primeiro?',
    ops: [
      { t: 'Estabilizo e instalo pressão', e: { controle: 3 } },
      { t: 'Já vou pra montada ou pras costas', e: { controle: 2, finalizacao: 1 } },
      { t: 'Ataco a finalização direto', e: { finalizacao: 3 } },
      { t: 'Circulo procurando a melhor passagem', e: { passagem: 3 } },
      { t: 'Fico atento pra ele não recuperar a guarda', e: { defesa: 2, controle: 1 } },
    ],
  },
  {
    q: 'Como você prefere ganhar?',
    ops: [
      { t: 'Passando a guarda e dominando por cima', e: { passagem: 3, controle: 1 } },
      { t: 'Raspando e atacando de baixo', e: { raspagem: 3 } },
      { t: 'Finalizando, do jeito que der', e: { finalizacao: 3 } },
      { t: 'Controlando e vencendo nos pontos', e: { controle: 3 } },
      { t: 'Cansando o outro até ele errar', e: { defesa: 2, controle: 1 } },
    ],
  },
  {
    q: 'No treino, onde você gasta mais tempo?',
    ops: [
      { t: 'Queda e jogo em pé', e: { queda: 3 } },
      { t: 'Raspagem e retenção de guarda', e: { raspagem: 3 } },
      { t: 'Passagem e pressão por cima', e: { passagem: 3 } },
      { t: 'Finalização e entrada de chave', e: { finalizacao: 3 } },
      { t: 'Controle e leitura de posição', e: { controle: 2, defesa: 1 } },
    ],
  },
  {
    q: 'E quando está por baixo?',
    ops: [
      { t: 'Monto a guarda e ataco', e: { raspagem: 2, finalizacao: 1 } },
      { t: 'Busco a raspagem pra inverter', e: { raspagem: 3 } },
      { t: 'Levanto e volto pro jogo em pé', e: { queda: 3 } },
      { t: 'Ataco a perna dele', e: { finalizacao: 2, raspagem: 1 } },
      { t: 'Seguro a posição e espero a brecha', e: { defesa: 3 } },
    ],
  },
];

export const EIXOS = [
  { id: 'queda', nome: 'Queda', cor: 'ice' },
  { id: 'passagem', nome: 'Passagem', cor: 'roar' },
  { id: 'raspagem', nome: 'Raspagem', cor: 'jade' },
  { id: 'controle', nome: 'Controle', cor: 'accent' },
  { id: 'finalizacao', nome: 'Finalização', cor: 'blood' },
  { id: 'defesa', nome: 'Defesa', cor: 'dim' },
];

export function estiloDoQuiz(respostas) {
  const soma = {};
  for (const r of respostas) {
    for (const [k, v] of Object.entries(r || {})) soma[k] = (soma[k] || 0) + v;
  }
  const ordenado = Object.entries(soma).sort((a, b) => b[1] - a[1]);
  if (!ordenado.length) return { estilo: 'completo', eixos: soma };

  const [topo, valor] = ordenado[0];
  const segundo = ordenado[1]?.[1] || 0;
  // sem pico claro = jogo completo
  if (valor - segundo <= 1 && ordenado.length > 2) return { estilo: 'completo', eixos: soma };

  const mapa = {
    queda: 'quedador', passagem: 'passador', raspagem: 'guardeiro',
    finalizacao: 'finalizador', controle: 'controlador', defesa: 'defensor',
  };
  return { estilo: mapa[topo] || 'completo', eixos: soma };
}
