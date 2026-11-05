/* ============================================================
   PLANOS DE ATAQUE

   Uma árvore que vai da posição até o objetivo. Cada peça é um golpe
   ou uma finta:
   - a finta engana: tem uma saída só, "ele reagiu", e a reação dela
     mora no passo que vem depois;
   - o golpe é pra valer: abre "encaixou, e depois" (segue no mesmo
     plano) e "se ele defender" (abre o Plano B, C, D), e a defesa
     dele mora no passo do galho de defesa.
   O objetivo (finalizar, uma posição ou um golpe) é obrigatório: o
   golpe que chega nele fecha o caminho com a bandeira.

   Guardado na mesma tabela dos 16 prontos (attackPlans): gatilho é
   o que ele fez pra chegar nesse passo, acao é o nome da técnica, e
   o passo diz de quem nasce (pai, índice de outro passo) e por onde
   (via). Os índices nunca mudam de lugar, porque o rola guarda "até
   qual golpe chegou" pelo índice: peça nova entra no fim da lista.
   Passo sem pai é do formato antigo, que era uma fila.
   ============================================================ */

export const MAX_PASSOS = 16;
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

/* quem fica na árvore: passo com nome, cujo pai também fica, e que
   sobe até a raiz. Pai número: aponta pra qualquer passo (pode estar
   depois). Pai null: a raiz. Sem pai: formato de fila, nasce do
   anterior que ficou. Passa de MAX_PASSOS, sai na ordem guardada, e
   o que perdeu o pai sai junto. */
function podar(brutos, nomeDe) {
  const pai = [];
  const fica = [];
  const ver = (i) => {
    if (fica[i] !== undefined) return fica[i];
    fica[i] = false; /* enquanto olha: um ciclo não fica */
    const x = brutos[i];
    if (!String(nomeDe(x) || '').trim()) return false;
    if (Number.isInteger(x.pai)) {
      if (!brutos[x.pai] || !ver(x.pai)) return false;
      pai[i] = x.pai;
    } else if (x.pai === null) {
      pai[i] = null;
    } else {
      let k = i - 1;
      while (k >= 0 && !ver(k)) k--;
      pai[i] = k >= 0 ? k : null;
    }
    fica[i] = true;
    return true;
  };
  const raiz = brutos.findIndex((_, i) => ver(i) && pai[i] === null);
  const chega = (i, ok) => {
    for (let k = i, n = 0; n <= brutos.length; k = pai[k], n++) {
      if (!ok(k)) return false;
      if (k === raiz) return true;
      if (pai[k] === null || pai[k] === undefined) return false;
    }
    return false;
  };
  let n = 0;
  const cabe = brutos.map((_, i) => chega(i, ver) && ++n <= MAX_PASSOS);
  const lista = brutos.map((_, i) => i).filter((i) => chega(i, (k) => cabe[k]));
  return { lista, pai, novo: new Map(lista.map((i, k) => [i, k])) };
}

/* passo do formato antigo: nos prontos, o pai com "seFalhar" quer
   dizer que este é a resposta à defesa; sem ele, é a continuação.
   Plano antigo do aluno era só "se defender". */
function viaAntiga(brutos, pai) {
  const pronto = brutos.some((x) => x.seFalhar);
  return brutos[pai].seFalhar || !pronto ? 'defendeu' : 'encaixou';
}

/* por onde o passo nasce: depois da finta é sempre "ele reagiu" */
function viaDe(brutos, i, pai) {
  if (pai === null) return null;
  if (brutos[pai].tipo === 'finta') return 'reagiu';
  if (!Number.isInteger(brutos[i].pai)) return viaAntiga(brutos, pai);
  return brutos[i].via === 'encaixou' ? 'encaixou' : 'defendeu';
}

/* o que a tela desenha, venha do pronto ou do aluno */
export function correnteDoPlano(p) {
  const brutos = p?.passos || [];
  const { lista, pai, novo } = podar(brutos, (x) => x.acao);
  const passos = lista.map((i) => ({
    tipo: brutos[i].tipo === 'finta' ? 'finta' : 'golpe',
    reacao: brutos[i].gatilho || '', golpe: brutos[i].acao, detalhe: brutos[i].detalhe || '', defesa: brutos[i].seFalhar || '',
    pai: pai[i] === null ? null : novo.get(pai[i]),
    via: viaDe(brutos, i, pai[i]),
  }));
  /* a finta do formato de antes era uma só, antes do 1º golpe: vira
     a peça de finta, no fim da lista, e o 1º golpe nasce dela */
  if (p?.finta && passos.length && !passos.some((x) => x.tipo === 'finta')) {
    const r = passos.findIndex((x) => x.pai === null);
    passos.push({ tipo: 'finta', reacao: '', golpe: p.finta, detalhe: '', defesa: '', pai: null, via: null });
    passos[r] = { ...passos[r], pai: passos.length - 1, via: 'reagiu' };
  }
  const ultimo = brutos[brutos.length - 1];
  return {
    posicao: p?.posicao || '',
    objetivo: p?.objetivo || '',
    objetivoTipo: p?.objetivoTipo || (p?.objetivo ? 'tecnica' : ''),
    passos,
    /* o "depois" dos prontos quando o último golpe encaixa. O "se ele
       defender tudo" não vira peça: o caminho fecha ali. */
    segue: ultimo?.seFalhar || /^(se |volta)|se ele/i.test(ultimo?.proxima || '') ? '' : ultimo?.proxima || '',
  };
}

/* a ordem de leitura: o Plano A inteiro (o caminho do encaixou desde
   a raiz), depois o B (a defesa do primeiro golpe do A que tem
   defesa), e assim por diante. Cada plano é um trilho. Depois da
   finta, o "ele reagiu" segue no mesmo trilho. */
export function arvoreDoPlano(passos = []) {
  const filhos = passos.map(() => ({}));
  passos.forEach((x, i) => {
    if (x.pai !== null && x.pai !== undefined) filhos[x.pai][x.via === 'defendeu' ? 'defendeu' : 'encaixou'] = i;
  });
  const raiz = passos.findIndex((x) => x.pai === null || x.pai === undefined);
  const ordem = [];
  const trilho = [];
  const fila = raiz >= 0 ? [raiz] : [];
  for (let t = 0; fila.length; t++) {
    for (let i = fila.shift(); i !== undefined; i = filhos[i].encaixou) {
      trilho[i] = t;
      ordem.push(i);
      if (filhos[i].defendeu !== undefined) fila.push(filhos[i].defendeu);
    }
  }
  return { ordem, trilho, filhos, trilhos: Math.max(0, ...trilho.filter((t) => t !== undefined)) + (ordem.length ? 1 : 0) };
}

/* tudo o que nasce do passo i, ele junto */
function galhoDe(passos, i) {
  const dentro = new Set([i]);
  for (let mudou = true; mudou;) {
    mudou = false;
    passos.forEach((x, k) => { if (!dentro.has(k) && dentro.has(x.pai)) { dentro.add(k); mudou = true; } });
  }
  return dentro;
}

/* tira os passos de fora sem mudar a ordem dos que ficam */
function semOs(passos, fora) {
  const novo = new Map();
  passos.forEach((_, k) => { if (!fora.has(k)) novo.set(k, novo.size); });
  return passos.filter((_, k) => !fora.has(k)).map((x) => ({
    ...x, pai: x.pai === null || x.pai === undefined ? x.pai : novo.get(x.pai),
  }));
}

/* tirar um golpe leva junto tudo o que nasce dele */
export const semOGolpe = (passos, i) => semOs(passos, galhoDe(passos, i));

/* tirar a finta não leva o golpe: ele volta pro lugar dela */
export function semAFinta(passos, i) {
  const f = passos[i];
  const religado = passos.map((x) => (x.pai === i ? { ...x, pai: f.pai, via: f.via } : x));
  return semOs(religado, new Set([i]));
}

/* finta antes do passo i: entra no fim da lista, no lugar dele, e
   ele passa a nascer da reação à finta */
export function fintaAntes(passos, i, nome) {
  const x = passos[i];
  const nova = { tipo: 'finta', reacao: '', golpe: nome, pai: x.pai, via: x.via };
  return [...passos.map((y, k) => (k === i ? { ...y, pai: passos.length, via: 'reagiu' } : y)), nova];
}

/* a vaga de um passo: o golpe tem a do encaixou e a da defesa; a
   finta, só a do "ele reagiu" */
export function vagaLivre(passos, pai, via) {
  if (!passos[pai]) return false;
  const finta = passos[pai].tipo === 'finta';
  if (finta ? via !== 'reagiu' : via === 'reagiu') return false;
  const chave = (v) => (v === 'defendeu' ? 'defendeu' : 'encaixou');
  return !passos.some((x) => x.pai === pai && chave(x.via) === chave(via));
}

/* arrastar o passo i (com o que nasce dele) pra vaga de outro. Não
   vale pra raiz, pra vaga ocupada nem pra dentro do próprio galho. */
export function moverPasso(passos, i, pai, via) {
  if (!passos[i] || passos[i].pai === null || galhoDe(passos, i).has(pai) || !vagaLivre(passos, pai, via)) return null;
  return passos.map((x, k) => (k === i ? { ...x, pai, via } : x));
}

/* ---------- objetivo ----------
   Finalizar: qualquer golpe que termina em finalização. Posição: o
   golpe que termina nela. Golpe: o próprio. destinoDe(nome) devolve
   a posição onde a técnica do catálogo termina ({ slug, nome }). */
export const OBJETIVO_FINALIZAR = 'Finalizar';
export function chegaNoObjetivo(passo, plano, destinoDe = () => null) {
  if (!passo || passo.tipo === 'finta') return false;
  const tipo = plano?.objetivoTipo || (plano?.objetivo ? 'tecnica' : '');
  const destino = destinoDe(passo.golpe);
  if (tipo === 'finalizar') return destino?.slug === 'finalizacao';
  if (tipo === 'posicao') return !!destino && destino.nome === plano.objetivo;
  if (tipo === 'tecnica') return passo.golpe === plano.objetivo;
  return false;
}
export const finaliza = (passo, destinoDe = () => null) => passo?.tipo !== 'finta' && destinoDe(passo?.golpe)?.slug === 'finalizacao';

/* as pontas soltas: finta sem golpe depois e caminho que encaixa e
   para antes do objetivo (finalização que encaixa acaba a luta, não
   é ponta solta) */
export function pontasSoltas(plano, destinoDe = () => null) {
  const c = correnteDoPlano(plano);
  const { filhos } = arvoreDoPlano(c.passos);
  return c.passos.map((x, i) => ({ ...x, i })).filter((x) => filhos[x.i].encaixou === undefined
    && (x.tipo === 'finta' || (!chegaNoObjetivo(x, c, destinoDe) && !finaliza(x, destinoDe))));
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

/* o plano novo que a tela salva. Golpe sem nome sai, e o que nasce
   dele também; passo sem pai (formato de fila) nasce do último que ficou */
export function planoNovo({ nome, posicao, posicaoId = null, finta = '', objetivo = '', objetivoTipo = '', passos = [], paraAltura = [], paraPeso = [], copiadoDe = null }) {
  const { lista, pai, novo } = podar(passos, (x) => x.golpe);
  const guardados = lista.map((i) => {
    const x = passos[i];
    const p = pai[i] === null ? null : novo.get(pai[i]);
    return {
      ...(x.tipo === 'finta' ? { tipo: 'finta' } : {}),
      gatilho: String(x.reacao || '').trim(), acao: x.golpe, seFalhar: '', proxima: '', detalhe: x.detalhe || '',
      pai: p,
      via: p === null ? null : passos[pai[i]].tipo === 'finta' ? 'reagiu' : x.via === 'encaixou' ? 'encaixou' : 'defendeu',
    };
  });
  return {
    paraAltura, paraPeso, copiadoDe,
    nome: String(nome || '').trim() || 'Meu plano',
    posicao: posicao || '',
    posicaoId,
    finta: finta || '',
    objetivo: objetivo || '',
    objetivoTipo: objetivoTipo || (objetivo ? 'tecnica' : ''),
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
