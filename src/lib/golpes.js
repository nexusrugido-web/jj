/* ============================================================
   O GOLPE E DE ONDE ELE SAIU

   "Chave de braço da montada" e "Chave de braço dos 100kg" são o
   mesmo golpe (armlock) saindo de posições diferentes. Na
   biblioteca cada origem é uma técnica, com grau próprio; no rola a
   pessoa toca o golpe e o app escolhe a origem mais provável:

   1. a posição que ela dominou nesse rola (na finalização sofrida,
      a posição em que ela ficou por baixo, vista de quem atacou);
   2. a última vez que ela registrou esse golpe;
   3. o jeito mais comum dele.

   Errou? Um toque troca. O golpe sai do nome, por regra: técnica
   nova que entrar na biblioteca já cai no golpe certo.
   ============================================================ */

export const GOLPES = [
  { id: 'armlock', nome: 'Armlock', re: /chave de bra[cç]o|armlock|arm lock/, padrao: 'Chave de braço (armlock)' },
  { id: 'katagatame', nome: 'Katagatame', re: /katagatame/, padrao: 'Katagatame dos 100kg' },
  { id: 'triangulo', nome: 'Triângulo', re: /tri[aâ]ngulo/, padrao: 'Triângulo' },
  { id: 'mata_leao', nome: 'Mata-leão', re: /mata-le[aã]o/, padrao: 'Mata-leão' },
  { id: 'guilhotina', nome: 'Guilhotina', re: /guilhotina|marcelotine/, padrao: 'Guilhotina' },
  { id: 'kimura', nome: 'Kimura', re: /kimura/, padrao: 'Kimura' },
  { id: 'americana', nome: 'Americana', re: /americana/, padrao: 'Americana' },
  { id: 'omoplata', nome: 'Omoplata', re: /^omoplata/, padrao: 'Omoplata' },
  { id: 'ezequiel', nome: 'Ezequiel', re: /ezequiel/, padrao: 'Estrangulamento Ezequiel' },
  { id: 'cruzada', nome: 'Estrangulamento cruzado', re: /cruzad[oa]/, padrao: 'Estrangulamento cruzado (cruzada)' },
  { id: 'botinha', nome: 'Botinha', re: /chave de p[eé] reta/, padrao: 'Chave de pé reta (botinha)' },
  { id: 'heel_hook', nome: 'Heel hook', re: /heel hook/, padrao: 'Heel hook externo (chave de calcanhar)' },
  { id: 'kneebar', nome: 'Kneebar', re: /kneebar|chave de joelho/, padrao: 'Chave de joelho (kneebar)' },
  { id: 'pulso', nome: 'Chave de pulso', re: /chave de pulso|m[aã]o de vaca/, padrao: 'Chave de pulso (da guarda)' },
];

const porId = Object.fromEntries(GOLPES.map((g) => [g.id, g]));

/* o golpe de uma técnica; a que não é de nenhum é golpe sozinha */
export function golpeDe(nome) {
  const n = String(nome || '').toLowerCase();
  return GOLPES.find((g) => g.re.test(n))?.id || null;
}

export const nomeDoGolpe = (id) => porId[id]?.nome || id;

/* quem atacou estava por cima de onde você ficou por baixo */
const DE_QUEM_ATACOU = {
  sob_montada: 'montada', sob_cem: 'cem_quilos', costas_tomadas: 'costas',
  sob_norte_sul: 'norte_sul', sob_joelho: 'joelho_barriga', sob_meia: 'meia_topo',
};
export const posicaoDeQuemAtacou = (slug) => DE_QUEM_ATACOU[slug] || null;

/* as técnicas do mesmo golpe que esta (ela inclusive) */
export function variacoes(nome, catalogo) {
  const g = golpeDe(nome);
  if (!g) return [];
  return catalogo.filter((t) => golpeDe(t.nome) === g);
}

/* catalogo: [{ nome, de }] (de = slug da posição de origem)
   posicoes: slugs de onde a finalização pode ter saído nesse rola
   historico: nomes já registrados, do mais recente pro mais antigo */
export function variacaoProvavel(golpe, { catalogo, posicoes = [], historico = [] }) {
  const doGolpe = catalogo.filter((t) => golpeDe(t.nome) === golpe);
  if (!doGolpe.length) return null;
  const jaUsou = (l) => l.find((t) => historico.includes(t.nome))
    && [...l].sort((a, b) => historico.indexOf(a.nome) - historico.indexOf(b.nome)).find((t) => historico.includes(t.nome));
  const padrao = doGolpe.find((t) => t.nome === porId[golpe]?.padrao);
  for (const slug of posicoes) {
    const daqui = doGolpe.filter((t) => t.de === slug);
    if (daqui.length) return (jaUsou(daqui) || (daqui.includes(padrao) ? padrao : daqui[0])).nome;
  }
  return (jaUsou(doGolpe) || padrao || doGolpe[0]).nome;
}

/* os golpes pra tocar no rola: os seus primeiro, depois os mais comuns */
export function golpesDoRola(historico = []) {
  const seus = [];
  for (const n of historico) {
    const g = golpeDe(n);
    if (g && !seus.includes(g)) seus.push(g);
  }
  return [...seus, ...GOLPES.map((g) => g.id).filter((g) => !seus.includes(g))];
}

/* ------------------------------------------------------------
   De onde a finalização pode ter saído nesse rola, da mais provável
   pra menos: o último ponto marcado (a posição que ele deixou), a
   posição em que o rola começou e a posição da aula. Na sofrida,
   os pontos dele e a posição dele no começo.
   ------------------------------------------------------------ */
const DESTINO_DO_PONTO = {
  queda: 'cem_quilos', raspagem: 'cem_quilos', passagem: 'cem_quilos',
  joelho: 'joelho_barriga', montada: 'montada', costas: 'costas',
};
const INICIO_MEU = {
  em_pe: 'em_pe', guarda_fechada_baixo: 'guarda_fechada', guarda_aberta_baixo: 'guarda_aberta',
  meia_baixo: 'meia_guarda', cem_cima: 'cem_quilos', montada_cima: 'montada', costas_cima: 'costas', perna: 'ashi',
};
const INICIO_DELE = {
  em_pe: 'em_pe', guarda_fechada_cima: 'guarda_fechada', guarda_aberta_cima: 'guarda_aberta',
  meia_cima: 'meia_guarda', cem_baixo: 'cem_quilos', montada_baixo: 'montada', costas_baixo: 'costas', perna: 'ashi',
};

export function posicoesDoRola(r, lado = 'meu', focoPosicoes = []) {
  const pts = (lado === 'meu' ? r?.ptsMeus : r?.ptsDele) || [];
  const inicio = (lado === 'meu' ? INICIO_MEU : INICIO_DELE)[r?.posInicial];
  const l = [...pts].reverse().map((p) => DESTINO_DO_PONTO[p]);
  if (inicio) l.push(inicio);
  if (lado === 'meu') l.push(...focoPosicoes);
  return [...new Set(l.filter(Boolean))];
}
