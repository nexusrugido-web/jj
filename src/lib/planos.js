/* ============================================================
   PLANOS DE ATAQUE

   Uma árvore: da posição, a finta; vem o primeiro golpe; cada golpe
   abre dois caminhos, "encaixou, e depois" (segue no mesmo plano) e
   "se ele defender" (abre o Plano B, C, D). Posição, finta, golpe e
   objetivo saem do catálogo; a deixa dele é uma frase curta.

   Guardado na mesma tabela dos 16 prontos (attackPlans), no mesmo
   formato de passo: gatilho é a deixa dele, acao é o golpe, e o
   passo diz de quem nasce (pai, índice de um passo anterior) e por
   onde (via). Passo sem pai é do formato antigo, que era uma fila.
   ============================================================ */

export const MAX_PASSOS = 12;
export const MAX_TRILHOS = 4;
export const LETRAS = ['A', 'B', 'C', 'D'];
export const PLANOS_NO_GRATIS = 1;

export const meusPlanos = (planos = []) => planos.filter((p) => !p.pronto && !p.arquivada);
export const planosProntos = (planos = []) => planos.filter((p) => p.pronto && !p.arquivada);

/* o grátis tem 1 plano seu (próprio ou ajustado de um pronto) */
export const podeCriarPlano = (planos, premium) => premium || meusPlanos(planos).length < PLANOS_NO_GRATIS;

/* os exemplos que já vêm na lista de cada um: 3 da faixa dele.
   São prontos, então não contam no limite do grátis. Marrom e preta
   recebem os da roxa; faixa infantil, os da branca. O exemplo que a
   pessoa ajustou pro jogo dela sai da lista (fica a versão dela). */
const EXEMPLOS = {
  branca: ['cg-trindade', 'cg-hipbump-kimura', 'montada-gi'],
  azul: ['passagem-meia', 'meia-oldschool', 'borboleta'],
  roxa: ['dlr', 'montada-ezequiel', 'aranha'],
};
export function exemplosDaFaixa(planos = [], faixa = 'branca') {
  const slugs = EXEMPLOS[faixa] || (faixa === 'marrom' || faixa === 'preta' ? EXEMPLOS.roxa : EXEMPLOS.branca);
  const prontos = planosProntos(planos);
  const ajustados = new Set(meusPlanos(planos).map((p) => p.copiadoDe).filter(Boolean));
  return slugs.map((s) => prontos.find((p) => p.slug === s)).filter((p) => p && !ajustados.has(p.slug));
}
/* a lista da pessoa: os planos dela e os exemplos da faixa */
export const planosDaPessoa = (planos, faixa) => [...meusPlanos(planos), ...exemplosDaFaixa(planos, faixa)];

/* passo do formato antigo (sem pai): nasce do anterior. Nos prontos,
   o anterior com "seFalhar" quer dizer que este é a resposta à defesa;
   sem ele, é a continuação. Plano antigo do aluno era só "se defender". */
function viaAntiga(passos, i) {
  const pronto = passos.some((x) => x.seFalhar);
  return passos[i - 1].seFalhar || !pronto ? 'defendeu' : 'encaixou';
}

/* o que a tela desenha, venha do pronto ou do aluno */
export function correnteDoPlano(p) {
  const brutos = p?.passos || [];
  const novoIndice = new Map();
  const passos = [];
  brutos.forEach((x, i) => {
    if (passos.length >= MAX_PASSOS || !String(x.acao || '').trim()) return;
    const antigo = !Number.isInteger(x.pai) && i > 0;
    const pai = passos.length === 0 ? null : novoIndice.get(antigo ? i - 1 : x.pai);
    if (passos.length > 0 && pai === undefined) return;
    novoIndice.set(i, passos.length);
    passos.push({
      reacao: x.gatilho || '', golpe: x.acao, detalhe: x.detalhe || '', defesa: x.seFalhar || '',
      pai, via: pai === null ? null : antigo ? viaAntiga(brutos, i) : x.via,
    });
  });
  return {
    posicao: p?.posicao || '',
    finta: p?.finta || '',
    objetivo: p?.objetivo || '',
    passos,
    /* o "depois" dos prontos: pra onde voltar se tudo falhar (fim) ou
       como segue quando o último golpe encaixa (segue) */
    ...depoisDoPlano(brutos[brutos.length - 1]),
  };
}

/* a ordem de leitura: o Plano A inteiro (o caminho do encaixou desde
   o primeiro golpe), depois o B (a defesa do primeiro golpe do A que
   tem defesa), e assim por diante. Cada plano é um trilho. */
export function arvoreDoPlano(passos = []) {
  const filhos = passos.map(() => ({}));
  passos.forEach((x, i) => { if (x.pai !== null && x.pai !== undefined) filhos[x.pai][x.via] = i; });
  const ordem = [];
  const trilho = [];
  const fila = passos.length ? [0] : [];
  for (let t = 0; fila.length; t++) {
    for (let i = fila.shift(); i !== undefined; i = filhos[i].encaixou) {
      trilho[i] = t;
      ordem.push(i);
      if (filhos[i].defendeu !== undefined) fila.push(filhos[i].defendeu);
    }
  }
  return { ordem, trilho, filhos, trilhos: Math.max(0, ...trilho) + (passos.length ? 1 : 0) };
}

/* tirar um golpe leva junto tudo o que nasce dele */
export function semOGolpe(passos, i) {
  const fora = new Set([i]);
  passos.forEach((x, k) => { if (fora.has(x.pai)) fora.add(k); });
  const novoIndice = new Map();
  const resto = [];
  passos.forEach((x, k) => {
    if (fora.has(k)) return;
    novoIndice.set(k, resto.length);
    resto.push({ ...x, pai: x.pai === null || x.pai === undefined ? x.pai : novoIndice.get(x.pai) });
  });
  return resto;
}

function depoisDoPlano(ultimo) {
  const depois = ultimo?.proxima || '';
  const seFalhou = !!ultimo?.seFalhar || /^(se |volta)|se ele/i.test(depois);
  return { fim: seFalhou ? depois : '', segue: seFalhou ? '' : depois };
}

/* copiar um pronto: vira plano seu, sem slug (o slug é da semente) */
export function copiaDoPronto(p) {
  const { id, uid, slug, pronto, favorito, criadoEm, updatedAt, __local, ...resto } = p; // eslint-disable-line no-unused-vars
  return {
    ...resto,
    nome: p.nome,
    passos: (p.passos || []).slice(0, MAX_PASSOS),
    copiadoDe: slug || null,
    pronto: 0, favorito: 0, arquivada: 0,
  };
}

/* o plano novo que a tela salva */
export function planoNovo({ nome, posicao, posicaoId = null, finta = '', objetivo = '', passos = [], paraAltura = [], paraPeso = [], copiadoDe = null }) {
  /* golpe sem nome sai, e o que nasce dele também; passo sem pai
     (formato de fila) nasce do último que ficou */
  const novoIndice = new Map();
  const guardados = [];
  passos.forEach((x, i) => {
    if (guardados.length >= MAX_PASSOS || !String(x.golpe || '').trim()) return;
    const raiz = guardados.length === 0;
    const pai = raiz ? null : x.pai === undefined ? guardados.length - 1 : novoIndice.get(x.pai);
    if (!raiz && (pai === undefined || pai === null)) return;
    novoIndice.set(i, guardados.length);
    guardados.push({
      gatilho: String(x.reacao || '').trim(), acao: x.golpe, seFalhar: '', proxima: '', detalhe: '',
      pai, via: raiz ? null : x.via || 'defendeu',
    });
  });
  return {
    paraAltura, paraPeso, copiadoDe,
    nome: String(nome || '').trim() || 'Meu plano',
    posicao: posicao || '',
    posicaoId,
    finta: finta || '',
    objetivo: objetivo || '',
    passos: guardados,
    tipo: 'ataque', modo: 'ambos', faixa: 'branca', legal: true, aviso: '', resumo: '',
    pronto: 0, favorito: 0, arquivada: 0,
  };
}

/* ---------- pra quem serve ----------
   Altura e peso dele em relação a você. Plano sem etiqueta serve pra
   qualquer um e não entra na lista do parceiro: a lista é dos que
   foram pensados pra gente daquele tamanho. */
export const ALTURA_REL = [
  { id: 'alto', nome: 'Mais alto que eu', icone: '↑' },
  { id: 'parecida', nome: 'Altura parecida', icone: '=' },
  { id: 'baixo', nome: 'Mais baixo que eu', icone: '↓' },
];
export const alturaRelPorId = Object.fromEntries(ALTURA_REL.map((a) => [a.id, a]));

export function servePara(plano, parceiro) {
  const dims = [['paraAltura', 'alturaRel'], ['paraPeso', 'pesoRel']];
  let bateu = 0;
  for (const [tag, campo] of dims) {
    const tags = plano?.[tag] || [];
    if (!tags.length) continue;
    if (!parceiro?.[campo]) continue;
    if (!tags.includes(parceiro[campo])) return false;
    bateu++;
  }
  return bateu > 0;
}

export const planosQueServem = (planos, parceiro) =>
  [...meusPlanos(planos), ...planosProntos(planos)].filter((p) => servePara(p, parceiro));

/* ---------- taxa de acerto ----------
   Sai do "usou qual plano?" do rola. Drill não conta: o parceiro
   colabora. Onde morre: o golpe em que a corrente parou nos rolas
   que não encaixaram. */
const ehLuta = (r) => (r.contexto || 'rola') !== 'drill';
const usosDo = (plano, rolls) => rolls.filter((r) => ehLuta(r) && r.plano?.uid && r.plano.uid === plano.uid);

export function taxaDoPlano(plano, rolls = []) {
  const usos = usosDo(plano, rolls);
  const encaixes = usos.filter((r) => r.plano.encaixou).length;
  const morre = {};
  for (const r of usos) if (!r.plano.encaixou) morre[r.plano.ate || 0] = (morre[r.plano.ate || 0] || 0) + 1;
  const [passo, vezes] = Object.entries(morre).sort((a, b) => b[1] - a[1])[0] || [];
  return {
    usos: usos.length,
    encaixes,
    taxa: usos.length ? Math.round((encaixes / usos.length) * 100) : 0,
    morreNo: passo === undefined ? null : { passo: Number(passo), vezes },
  };
}

/* contra que tipo de adversário: pelo peso e pela altura do parceiro */
export function taxaPorTipo(plano, rolls = [], partners = []) {
  const parceiro = new Map(partners.map((p) => [p.id, p]));
  const conta = {};
  for (const r of usosDo(plano, rolls)) {
    const p = parceiro.get(r.partnerId);
    for (const chave of [r.pesoRel || p?.pesoRel, p?.alturaRel].filter(Boolean)) {
      conta[chave] = conta[chave] || { usos: 0, encaixes: 0 };
      conta[chave].usos++;
      if (r.plano.encaixou) conta[chave].encaixes++;
    }
  }
  return conta;
}

/* ---------- rodízio por parceiro ----------
   O último plano que você usou contra ele, e o próximo: o seu plano
   usado há mais tempo contra ele (nunca usado vem primeiro), com
   preferência pro que serve pro tamanho dele e, no empate, o que mais
   encaixa. Repetir sempre o mesmo ensina o parceiro a defender. */
export function rodizio(planos = [], rolls = [], sessions = [], parceiro = null) {
  const meus = meusPlanos(planos);
  if (!parceiro || !meus.length) return { ultimo: null, proximo: null };
  const dataDe = new Map(sessions.map((s) => [s.id, s.data || '']));
  const contra = rolls
    .filter((r) => ehLuta(r) && r.partnerId === parceiro.id && r.plano?.uid)
    .sort((a, b) => (dataDe.get(a.sessionId) || '').localeCompare(dataDe.get(b.sessionId) || ''));
  const ultimaVez = new Map();
  contra.forEach((r, i) => ultimaVez.set(r.plano.uid, i));
  const ultimoUid = contra[contra.length - 1]?.plano.uid || null;
  const ultimo = meus.find((p) => p.uid === ultimoUid) || null;
  const candidatos = meus.length > 1 ? meus.filter((p) => p.uid !== ultimoUid) : meus;
  const proximo = [...candidatos].sort((a, b) =>
    (ultimaVez.get(a.uid) ?? -1) - (ultimaVez.get(b.uid) ?? -1)
    || Number(servePara(b, parceiro)) - Number(servePara(a, parceiro))
    || taxaDoPlano(b, rolls).taxa - taxaDoPlano(a, rolls).taxa)[0] || null;
  return { ultimo, proximo: proximo && proximo.uid !== ultimoUid ? proximo : null };
}
