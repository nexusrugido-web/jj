/* ============================================================
   PLANOS DE ATAQUE

   Um mapa de decisões que vai da posição até o objetivo. Três coisas
   separadas:
   - a peça é o que VOCÊ faz: golpe ou finta;
   - o gatilho é o que ELE fez pra você escolher esse caminho (mora
     na peça que vem depois: a reação à finta, a defesa do golpe);
   - a via é a condição: o golpe abre "encaixou" e "defendeu"; a
     finta abre "reagiu" e "não reagiu" (troco a ameaça).
   Toda saída aceita vários caminhos (três defesas diferentes do
   mesmo armlock, cada uma com a sua continuação), menos o "não
   reagiu", que é um só. A posição aceita várias entradas (Finta A, B
   ou C como opções, não etapas). O primeiro caminho que continua
   (encaixou ou reagiu) segue no mesmo plano; cada desvio abre um
   plano com letra própria.
   Pra frente (R2 a R7): "escapou" é mais uma via; a convergência
   entra como ligações extras do plano ({ de, via, gatilho, para })
   sem mexer na árvore; a preparação é mais um tipo de peça; o rola
   guarda o caminho como lista de índices.
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
export const LETRAS = 'ABCDEFGHIJKLMNOP'.split('');
/* as saídas, na ordem do mapa (de cima pra baixo) */
export const VIAS = ['encaixou', 'reagiu', 'naoReagiu', 'defendeu'];
const continua = (via) => via === 'encaixou' || via === 'reagiu';
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
  /* a posição abre várias entradas: toda peça sem pai é uma raiz */
  const chega = (i, ok) => {
    for (let k = i, n = 0; n <= brutos.length; k = pai[k], n++) {
      if (!ok(k)) return false;
      if (pai[k] === null) return true;
      if (pai[k] === undefined) return false;
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

/* por onde o passo nasce: depois da finta, "reagiu" ou "não reagiu";
   depois do golpe, "encaixou" ou "defendeu" */
function viaDe(brutos, i, pai) {
  if (pai === null) return null;
  if (brutos[pai].tipo === 'finta') return brutos[i].via === 'naoReagiu' ? 'naoReagiu' : 'reagiu';
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

/* a ordem de leitura: o Plano A inteiro (a primeira entrada e, em
   cada peça, o primeiro caminho que continua: encaixou ou reagiu),
   depois o B, e assim por diante. Cada plano é um trilho. Os outros
   caminhos (outra entrada, outra defesa, outra reação, não reagiu)
   abrem cada um o seu plano. filhos[i] é a lista dos que nascem de i,
   na ordem das VIAS; segue[i] é o que continua no mesmo plano. */
export function arvoreDoPlano(passos = []) {
  const filhos = passos.map(() => []);
  const raizes = [];
  passos.forEach((x, i) => {
    if (x.pai === null || x.pai === undefined) raizes.push(i);
    else filhos[x.pai].push(i);
  });
  const peso = (i) => VIAS.indexOf(passos[i].via);
  filhos.forEach((l) => l.sort((a, b) => peso(a) - peso(b) || a - b));
  const segue = filhos.map((l) => l.find((k) => continua(passos[k].via)));
  const ordem = [];
  const trilho = [];
  const fila = [...raizes];
  for (let t = 0; fila.length; t++) {
    for (let i = fila.shift(); i !== undefined; i = segue[i]) {
      trilho[i] = t;
      ordem.push(i);
      filhos[i].forEach((k) => { if (k !== segue[i]) fila.push(k); });
    }
  }
  return { ordem, trilho, filhos, segue, trilhos: ordem.length ? Math.max(...ordem.map((i) => trilho[i])) + 1 : 0 };
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

/* tirar a finta não leva o golpe: ele volta pro lugar dela. O que
   nascia do "não reagiu" sai junto: sem finta, não tem do que reagir. */
export function semAFinta(passos, i) {
  const f = passos[i];
  const fora = new Set([i]);
  passos.forEach((x, k) => { if (x.pai === i && x.via === 'naoReagiu') galhoDe(passos, k).forEach((g) => fora.add(g)); });
  const religado = passos.map((x) => (x.pai === i ? { ...x, pai: f.pai, via: f.via } : x));
  return semOs(religado, fora);
}

/* finta antes do passo i: entra no fim da lista, no lugar dele, e
   ele passa a nascer da reação à finta */
export function fintaAntes(passos, i, nome) {
  const x = passos[i];
  const nova = { tipo: 'finta', reacao: '', golpe: nome, pai: x.pai, via: x.via };
  return [...passos.map((y, k) => (k === i ? { ...y, pai: passos.length, via: 'reagiu' } : y)), nova];
}

/* as saídas de cada peça: o golpe tem encaixou e defendeu; a finta,
   reagiu e não reagiu. Todas aceitam mais de um caminho, menos o
   "não reagiu". */
export const viasDa = (peca) => (peca?.tipo === 'finta' ? ['reagiu', 'naoReagiu'] : ['encaixou', 'defendeu']);
export function vagaLivre(passos, pai, via) {
  if (!passos[pai] || !viasDa(passos[pai]).includes(via)) return false;
  return via !== 'naoReagiu' || !passos.some((x) => x.pai === pai && x.via === 'naoReagiu');
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
  const { segue } = arvoreDoPlano(c.passos);
  return c.passos.map((x, i) => ({ ...x, i })).filter((x) => segue[x.i] === undefined
    && (x.tipo === 'finta' || (!chegaNoObjetivo(x, c, destinoDe) && !finaliza(x, destinoDe))));
}

/* caminho sem motivo: quando duas defesas (ou duas reações) saem da
   mesma peça, cada uma precisa dizer o que ele fez, senão não dá pra
   saber qual escolher na hora */
export const semGatilho = (passos = []) => passos.map((x, i) => ({ ...x, i })).filter((x) => (x.via === 'defendeu' || x.via === 'reagiu')
  && !String(x.reacao || '').trim() && passos.filter((y) => y.pai === x.pai && y.via === x.via).length > 1);

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
      via: p === null ? null : passos[pai[i]].tipo === 'finta' ? (x.via === 'naoReagiu' ? 'naoReagiu' : 'reagiu') : x.via === 'encaixou' ? 'encaixou' : 'defendeu',
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
