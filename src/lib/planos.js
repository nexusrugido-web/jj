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
   ESCAPOU não é defesa. Defendeu: ele parou o golpe e você continua
   na posição que sustenta o ataque. Escapou: ele saiu do controle e a
   luta mudou de lugar. O escapou leva a uma peça própria, a situação
   (tipo 'situacao'): o nome é a posição onde a luta ficou e o gatilho
   é como ele escapou. Dela saem os caminhos "volto a atacar" (via
   'retoma'), que a pessoa monta, atrás do mesmo objetivo do plano.
   Situação sem caminho fecha ali: sem continuação inventada e sem
   aviso de ponta solta.
   CONVERGÊNCIA (R3): uma saída pode apontar pra uma peça que já está
   no mapa, em vez de abrir um cartão novo (três preparações levam ao
   mesmo armlock). Isso é uma ligação extra do plano, em "ligacoes":
   { id, de, via, gatilho, para }, de e para pelo id da peça. A ligação
   é o caminho: tem id próprio e o gatilho dela (o que ele fez NESSE
   caminho); a peça de destino continua uma só. No escapou, o destino é
   um lugar: uma situação que já existe ou a posição de onde o plano
   começa (para null), que é como a luta volta pra um ponto anterior.
   Nas outras saídas, o destino é uma ação (golpe ou finta). A árvore
   (pai e via) continua sendo o primeiro caminho que o mapa desenha e
   arruma; a ligação extra não entra na arrumação, vira um atalho com
   fio tracejado até a peça. Por isso voltar pra trás (ciclo) não trava
   nada: quem anda pela árvore nunca segue ligação extra. Ligação que
   perdeu uma ponta (a peça saiu) cai na leitura e vai pra "removidos"
   ao salvar. Pra frente: a preparação é mais um tipo de peça.
   O objetivo (finalizar, uma posição ou um golpe) é obrigatório: o
   golpe que chega nele fecha o caminho com a bandeira.

   Guardado na mesma tabela dos 16 prontos (attackPlans): gatilho é
   o que ele fez pra chegar nesse passo, acao é o nome da técnica, e
   o passo diz de quem nasce (pai, índice de outro passo) e por onde
   (via). O índice é só arrumação interna e muda quando uma peça sai.

   IDENTIDADE: cada peça tem um id e a ligação que chega nela tem
   outro (lig). Arrastar, renomear, mudar o gatilho ou apagar outra
   peça não muda nenhum dos dois. A ligação ganha id novo quando muda
   de ponta (a peça foi arrastada pra outro lugar, entrou ou saiu uma
   finta no meio): é outro caminho, e o rola antigo tem que continuar
   dizendo o caminho de antes. O que sai do plano fica em "removidos"
   ({ pecas, ligacoes }), pro rola antigo ainda achar o nome.
   O rola guarda { uid, peca, caminho, encaixou }: a peça até onde
   chegou e a lista das ligações da posição até ela, como eram no dia.
   Plano guardado antes dos ids: a peça ganha "p" + a posição na lista
   guardada e a ligação "l" + a mesma posição, e isso vira o id
   dela na primeira vez que o plano é salvo.
   Passo sem pai é do formato antigo, que era uma fila.
   ============================================================ */

/* a letra é só o rótulo do plano: A a Z, depois AA, AB... sem teto */
export function letraDo(t) {
  let l = '';
  for (let n = t + 1; n > 0; n = Math.floor((n - 1) / 26)) l = String.fromCharCode(65 + ((n - 1) % 26)) + l;
  return l;
}
export const novoId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10);
/* as saídas, na ordem do mapa (de cima pra baixo) */
export const VIAS = ['encaixou', 'reagiu', 'retoma', 'naoReagiu', 'defendeu', 'escapou'];
export const continua = (via) => via === 'encaixou' || via === 'reagiu' || via === 'retoma';
const tipoDe = (x) => (x?.tipo === 'finta' || x?.tipo === 'situacao' ? x.tipo : 'golpe');
/* por onde o passo nasce, pelo tipo do pai: da finta, "reagiu" ou "não
   reagiu"; do golpe, "encaixou", "defendeu" ou "escapou" (só a
   situação nasce do escapou); da situação, "volto a atacar" */
function viaPeloPai(pai, x) {
  if (tipoDe(pai) === 'finta') return x.via === 'naoReagiu' ? 'naoReagiu' : 'reagiu';
  if (tipoDe(pai) === 'situacao') return 'retoma';
  if (tipoDe(x) === 'situacao') return 'escapou';
  return x.via === 'encaixou' ? 'encaixou' : 'defendeu';
}
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
   anterior que ficou. Sem teto de peças: o que perdeu o pai sai junto. */
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
  const lista = brutos.map((_, i) => i).filter((i) => chega(i, ver));
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
  if (tipoDe(brutos[pai]) === 'golpe' && !Number.isInteger(brutos[i].pai)) return viaAntiga(brutos, pai);
  return viaPeloPai(brutos[pai], brutos[i]);
}

/* o que a tela desenha, venha do pronto ou do aluno */
export function correnteDoPlano(p) {
  const brutos = p?.passos || [];
  const { lista, pai, novo } = podar(brutos, (x) => x.acao);
  const passos = lista.map((i) => ({
    id: brutos[i].id || `p${i}`, lig: brutos[i].lig || `l${i}`,
    tipo: tipoDe(brutos[i]),
    reacao: brutos[i].gatilho || '', golpe: brutos[i].acao, detalhe: brutos[i].detalhe || '', defesa: brutos[i].seFalhar || '',
    pai: pai[i] === null ? null : novo.get(pai[i]),
    via: viaDe(brutos, i, pai[i]),
  }));
  /* a finta do formato de antes era uma só, antes do 1º golpe: vira
     a peça de finta, no fim da lista, e o 1º golpe nasce dela */
  if (p?.finta && passos.length && !passos.some((x) => x.tipo === 'finta')) {
    const r = passos.findIndex((x) => x.pai === null);
    passos.push({ id: 'finta', lig: 'lfinta', tipo: 'finta', reacao: '', golpe: p.finta, detalhe: '', defesa: '', pai: null, via: null });
    passos[r] = { ...passos[r], pai: passos.length - 1, via: 'reagiu' };
  }
  const ultimo = brutos[brutos.length - 1];
  const objetivoTipo = p?.objetivoTipo || (p?.objetivo ? 'tecnica' : '');
  const fin = objetivoTipo === 'finalizar';
  return {
    posicao: p?.posicao || '',
    objetivo: p?.objetivo || '',
    objetivoTipo,
    /* R4: só existe no finalizar */
    ...(fin ? {
      finalizacaoPreferida: p?.finalizacaoPreferida || '',
      finalizacoesAceitas: Array.isArray(p?.finalizacoesAceitas) ? p.finalizacoesAceitas : [],
    } : {}),
    passos,
    ligacoes: convergenciasValidas(passos, p?.ligacoes),
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
  const religado = passos.map((x) => (x.pai === i ? { ...x, pai: f.pai, via: f.via, lig: novoId() } : x));
  return semOs(religado, fora);
}

/* finta antes do passo i: entra no fim da lista, no lugar dele, e
   ele passa a nascer da reação à finta */
export function fintaAntes(passos, i, nome) {
  const x = passos[i];
  const nova = { id: novoId(), lig: novoId(), tipo: 'finta', reacao: '', golpe: nome, pai: x.pai, via: x.via };
  return [...passos.map((y, k) => (k === i ? { ...y, pai: passos.length, via: 'reagiu', lig: novoId() } : y)), nova];
}

/* as saídas de cada peça: o golpe tem encaixou, defendeu e escapou; a
   finta, reagiu e não reagiu; a situação, volto a atacar. Todas aceitam
   mais de um caminho: no "não reagiu", cada um é outra ameaça pra
   trocar. No escapou só entra situação, e situação só entra no escapou. */
const VIAS_DO_TIPO = { golpe: ['encaixou', 'defendeu', 'escapou'], finta: ['reagiu', 'naoReagiu'], situacao: ['retoma'] };
export const viasDa = (peca) => VIAS_DO_TIPO[tipoDe(peca)];
export const vagaLivre = (passos, pai, via, tipo = 'golpe') => !!passos[pai] && viasDa(passos[pai]).includes(via)
  && (via === 'escapou') === (tipo === 'situacao');

/* arrastar o passo i (com o que nasce dele) pra vaga de outro. Não
   vale pra raiz, pra vaga ocupada nem pra dentro do próprio galho. */
export function moverPasso(passos, i, pai, via) {
  if (!passos[i] || passos[i].pai === null || galhoDe(passos, i).has(pai) || !vagaLivre(passos, pai, via, passos[i].tipo)) return null;
  return passos.map((x, k) => (k === i ? { ...x, pai, via, lig: novoId() } : x));
}

/* ---------- convergência ----------
   A ligação extra vale quando sai de uma peça que existe, por uma saída
   que essa peça tem, e chega num destino do tipo certo: no escapou, uma
   situação ou a posição de onde começa (para null); nas outras, um golpe
   ou uma finta. Não liga a peça nela mesma nem repete o fio da árvore
   (o mesmo destino pela mesma saída). Voltar pra uma peça de antes vale:
   é o retorno. */
function podeLigar(passos, i, via, para) {
  const de = passos[i];
  if (!de || !viasDa(de).includes(via)) return false;
  if (via === 'escapou' && para === null) return true;
  const k = passos.findIndex((x) => x.id === para);
  if (k < 0 || k === i) return false;
  if ((via === 'escapou') !== (tipoDe(passos[k]) === 'situacao')) return false;
  return !(passos[k].pai === i && passos[k].via === via);
}

/* as ligações extras que valem, sem repetida (mesma saída pro mesmo destino) */
export function convergenciasValidas(passos = [], ligacoes = []) {
  const idx = new Map(passos.map((x, i) => [x.id, i]));
  const vistas = new Set();
  return (Array.isArray(ligacoes) ? ligacoes : []).filter((l) => {
    const para = l?.para ?? null;
    const chave = `${l?.de}|${l?.via}|${para}`;
    if (!l?.id || !idx.has(l.de) || vistas.has(chave) || !podeLigar(passos, idx.get(l.de), l.via, para)) return false;
    vistas.add(chave);
    return true;
  }).map((l) => ({ id: l.id, de: l.de, via: l.via, gatilho: String(l.gatilho || '').trim(), para: l.para ?? null }));
}

/* pra onde a saída via da peça i pode ligar: ids das peças (null é a
   posição), na ordem da lista, sem os destinos que essa saída já liga
   (menos: a ligação que está sendo mudada) */
export function destinosDaLigacao(passos, ligacoes, i, via, menos = null) {
  const ja = new Set((ligacoes || []).filter((l) => l.id !== menos && l.de === passos[i]?.id && l.via === via).map((l) => l.para ?? null));
  return [null, ...passos.map((x) => x.id)].filter((para) => !ja.has(para) && podeLigar(passos, i, via, para));
}

/* pôr ou mudar uma ligação extra. Mudou de ponta (outro destino), é
   outro caminho: id novo, e a de antes sai (vai pra "removidos" ao
   salvar). Mudou só o gatilho, é o mesmo caminho: mesmo id. */
export function comLigacao(ligacoes = [], l) {
  const antes = ligacoes.find((x) => x.id === l.id);
  const mesmo = antes && antes.de === l.de && antes.via === l.via && (antes.para ?? null) === (l.para ?? null);
  const nova = { id: mesmo ? antes.id : novoId(), de: l.de, via: l.via, gatilho: String(l.gatilho || '').trim(), para: l.para ?? null };
  return antes ? ligacoes.map((x) => (x.id === l.id ? nova : x)) : [...ligacoes, nova];
}

/* ---------- objetivo ----------
   Finalizar: qualquer golpe que termina em finalização. Posição: o
   golpe que termina nela. Golpe: o próprio. destinoDe(nome) devolve
   a posição onde a técnica do catálogo termina ({ slug, nome }).
   R4: no finalizar, a pessoa pode (sem obrigação) dizer a preferida e
   as que também aceita, pelo nome do catálogo. Com a lista, só elas
   chegam no objetivo (a preferida com a bandeira forte); outra
   finalização ainda acaba a luta, mas sem bandeira. Sem lista, qualquer
   finalização serve, como antes. O cartão é a tentativa: o objetivo só
   conta quando encaixa. */
export const OBJETIVO_FINALIZAR = 'Finalizar';
export const finalizacoesDoObjetivo = (plano) => (plano?.objetivoTipo === 'finalizar'
  ? [plano.finalizacaoPreferida, ...(plano.finalizacoesAceitas || [])].filter(Boolean) : []);
export const ehPreferida = (passo, plano) => !!passo && tipoDe(passo) === 'golpe'
  && plano?.objetivoTipo === 'finalizar' && !!plano.finalizacaoPreferida && passo.golpe === plano.finalizacaoPreferida;
export function chegaNoObjetivo(passo, plano, destinoDe = () => null) {
  if (!passo || tipoDe(passo) !== 'golpe') return false;
  const tipo = plano?.objetivoTipo || (plano?.objetivo ? 'tecnica' : '');
  const destino = destinoDe(passo.golpe);
  if (tipo === 'finalizar') {
    const lista = finalizacoesDoObjetivo(plano);
    return lista.length ? lista.includes(passo.golpe) : destino?.slug === 'finalizacao';
  }
  if (tipo === 'posicao') return !!destino && destino.nome === plano.objetivo;
  if (tipo === 'tecnica') return passo.golpe === plano.objetivo;
  return false;
}
export const finaliza = (passo, destinoDe = () => null) => !!passo && tipoDe(passo) === 'golpe' && destinoDe(passo?.golpe)?.slug === 'finalizacao';

/* a fuga que deixa a luta na posição do objetivo. A situação é o
   momento (ele saiu do controle e a luta veio pra cá); a posição é o
   lugar. Estar no lugar porque ele fugiu não é ter chegado: o objetivo
   conta na ação que estabelece o controle da posição. Então a situação
   nunca ganha a bandeira, e ficar nela sem caminho é ponta solta (falta
   a ação que estabelece o controle), não "daqui não tem ataque". */
export const situacaoNoObjetivo = (passo, plano) => tipoDe(passo) === 'situacao'
  && plano?.objetivoTipo === 'posicao' && !!plano.objetivo && passo.golpe === plano.objetivo;

/* as pontas soltas: finta sem golpe depois e caminho que encaixa e
   para antes do objetivo (finalização que encaixa acaba a luta, não
   é ponta solta). Situação sem caminho não é ponta solta: daquela
   posição pode não ter ataque que faça sentido, e o caminho fecha
   (menos quando a posição é o objetivo: falta firmar). Peça que segue
   por uma ligação extra (encaixou, reagiu ou volto a atacar levando a
   uma peça que já existe) também não é ponta solta. */
export function pontasSoltas(plano, destinoDe = () => null) {
  const c = correnteDoPlano(plano);
  const { segue } = arvoreDoPlano(c.passos);
  const porLigacao = new Set(c.ligacoes.filter((l) => continua(l.via)).map((l) => l.de));
  return c.passos.map((x, i) => ({ ...x, i })).filter((x) => segue[x.i] === undefined && !porLigacao.has(x.id)
    && (x.tipo === 'situacao' ? situacaoNoObjetivo(x, c)
      : x.tipo === 'finta' || (!chegaNoObjetivo(x, c, destinoDe) && !finaliza(x, destinoDe))));
}

/* caminho sem motivo: quando duas defesas (ou duas reações) saem da
   mesma peça, cada uma precisa dizer o que ele fez, senão não dá pra
   saber qual escolher na hora. Duas fugas pra posições diferentes já
   se separam pela posição. */
export const semGatilho = (passos = []) => passos.map((x, i) => ({ ...x, i })).filter((x) => {
  if (String(x.reacao || '').trim()) return false;
  const irmaos = passos.filter((y) => y.pai === x.pai && y.via === x.via);
  if (x.via === 'escapou') return irmaos.filter((y) => y.golpe === x.golpe).length > 1;
  return (x.via === 'defendeu' || x.via === 'reagiu') && irmaos.length > 1;
});

/* ---------- identidade e histórico ---------- */

/* as ligações da posição até a peça i, na ordem: o caminho que o rola guarda */
export function caminhoAte(passos, i) {
  const ligs = [];
  for (let k = i, n = 0; passos[k] && n <= passos.length; k = passos[k].pai, n++) ligs.unshift(passos[k].lig);
  return ligs;
}

/* as ligações do plano: { id, de, via, gatilho, para }, de e para pelo
   id da peça (de null: a posição; para null: volta pra posição). As da
   árvore e, depois, as extras (convergência). */
export const ligacoesDo = (passos, extras = []) => [...passos.map((x) => ({
  id: x.lig, de: x.pai === null || x.pai === undefined ? null : passos[x.pai]?.id ?? null, via: x.via, gatilho: x.reacao || '', para: x.id,
})), ...extras];

/* ao salvar: o que existia no plano guardado e sumiu do novo entra em
   "removidos", somado ao que já estava lá. Peça ou ligação que voltou
   sai de lá. */
export function removidosAoSalvar(antigo, novo) {
  const cv = antigo ? correnteDoPlano(antigo) : { passos: [], ligacoes: [] };
  const velho = cv.passos;
  const cn = correnteDoPlano(novo);
  const atual = cn.passos;
  const pecas = new Set(atual.map((x) => x.id));
  const ligs = new Set(ligacoesDo(atual, cn.ligacoes).map((x) => x.id));
  const ja = antigo?.removidos || { pecas: [], ligacoes: [] };
  return {
    pecas: [...ja.pecas, ...velho.filter((x) => !pecas.has(x.id)).map((x) => ({ id: x.id, tipo: x.tipo, golpe: x.golpe }))]
      .filter((x, k, l) => !pecas.has(x.id) && l.findIndex((y) => y.id === x.id) === k),
    ligacoes: [...ja.ligacoes, ...ligacoesDo(velho, cv.ligacoes).filter((x) => !ligs.has(x.id))]
      .filter((x, k, l) => !ligs.has(x.id) && l.findIndex((y) => y.id === x.id) === k),
  };
}

/* a peça que o rola marcou, mesmo que já tenha saído do plano */
export function pecaDoRola(plano, r) {
  const id = r?.plano?.peca;
  if (!plano || !id) return null;
  const viva = correnteDoPlano(plano).passos.find((x) => x.id === id);
  if (viva) return { ...viva, saiu: false };
  const morta = (plano.removidos?.pecas || []).find((x) => x.id === id);
  return morta ? { ...morta, saiu: true } : null;
}

/* o caminho que o rola guardou, ligação por ligação, mesmo com peça ou
   ligação que já saiu do plano: { id, de, via, gatilho, para, saiu }.
   inteiro: começa na posição e cada ligação sai de onde a anterior
   chegou. É o que diz por qual entrada ele chegou numa peça onde vários
   caminhos convergem, mesmo que todos sigam iguais depois dela. */
export function caminhoDoRola(plano, caminho = []) {
  const c = correnteDoPlano(plano);
  const vivas = new Map(ligacoesDo(c.passos, c.ligacoes).map((l) => [l.id, l]));
  const mortas = new Map((plano?.removidos?.ligacoes || []).map((l) => [l.id, l]));
  const ligacoes = (caminho || []).map((id) => (vivas.has(id) ? { ...vivas.get(id), saiu: false }
    : mortas.has(id) ? { ...mortas.get(id), saiu: true } : null));
  const inteiro = ligacoes.length > 0 && ligacoes.every((l, k) => l && (l.de ?? null) === (k ? ligacoes[k - 1].para ?? null : null));
  return { ligacoes, inteiro };
}

/* tentativa x chegada: parar no cartão da finalização (ou passar por
   ele) é tentativa; o objetivo só conta quando o rola diz que encaixou
   na peça que chega nele */
export const alcancouObjetivo = (plano, r, destinoDe = () => null) => !!r?.plano?.encaixou
  && chegaNoObjetivo(pecaDoRola(plano, r), correnteDoPlano(plano), destinoDe);

/* o rola de antes guardava "ate": a posição do golpe na lista. Ela só
   aponta pra peça certa se o plano não mudou depois da última vez que
   o rola foi salvo (o registro mostrava a marca em cima desse plano).
   Se mudou, não chuta: guarda o número em ateAntigo, a peça fica sem
   marca e a pessoa marca de novo se quiser. O uso e o encaixou valem
   do mesmo jeito. Devolve o plano novo do rola, ou null se não tem o
   que mudar. */
export function planoDoRolaAntigo(r, plano) {
  const pr = r?.plano;
  if (!pr || pr.peca !== undefined) return null;
  const base = { uid: pr.uid, encaixou: !!pr.encaixou };
  const k = pr.ate;
  const passos = plano ? correnteDoPlano(plano).passos : [];
  const confia = plano && Number.isInteger(k) && passos[k]
    && Number(plano.updatedAt || 0) <= Number(r.updatedAt || 0);
  if (!confia) return { ...base, peca: null, caminho: [], ...(Number.isInteger(k) ? { ateAntigo: k } : {}) };
  return { ...base, peca: passos[k].id, caminho: caminhoAte(passos, k) };
}

/* copiar um pronto: vira plano seu, sem slug (o slug é da semente) */
export function copiaDoPronto(p) {
  const { id, uid, slug, pronto, favorito, criadoEm, updatedAt, __local, ...resto } = p; // eslint-disable-line no-unused-vars
  return {
    ...resto,
    nome: p.nome,
    passos: p.passos || [],
    copiadoDe: slug || null,
    pronto: 0, favorito: 0, arquivada: 0,
  };
}

/* o plano novo que a tela salva. Golpe sem nome sai, e o que nasce
   dele também; passo sem pai (formato de fila) nasce do último que ficou */
export function planoNovo({ nome, posicao, posicaoId = null, finta = '', objetivo = '', objetivoTipo = '', finalizacaoPreferida = '', finalizacoesAceitas = [], passos = [], ligacoes = [], paraAltura = [], paraPeso = [], copiadoDe = null, removidos }) {
  /* preferida e aceitas só no finalizar; a preferida não se repete nas aceitas */
  const fin = objetivoTipo === 'finalizar';
  const preferida = fin ? String(finalizacaoPreferida || '').trim() : '';
  const aceitas = fin ? [...new Set((Array.isArray(finalizacoesAceitas) ? finalizacoesAceitas : [])
    .map((n) => String(n || '').trim()))].filter((n) => n && n !== preferida) : [];
  const { lista, pai, novo } = podar(passos, (x) => x.golpe);
  const guardados = lista.map((i) => {
    const x = passos[i];
    const p = pai[i] === null ? null : novo.get(pai[i]);
    return {
      id: x.id || novoId(), lig: x.lig || novoId(),
      ...(tipoDe(x) !== 'golpe' ? { tipo: x.tipo } : {}),
      gatilho: String(x.reacao || '').trim(), acao: x.golpe, seFalhar: '', proxima: '', detalhe: x.detalhe || '',
      pai: p,
      via: p === null ? null : viaPeloPai(passos[pai[i]], x),
    };
  });
  return {
    paraAltura, paraPeso, copiadoDe,
    ...(removidos ? { removidos } : {}),
    nome: String(nome || '').trim() || 'Meu plano',
    posicao: posicao || '',
    posicaoId,
    finta: finta || '',
    objetivo: objetivo || '',
    objetivoTipo: objetivoTipo || (objetivo ? 'tecnica' : ''),
    /* sempre presentes: o update do banco mescla, e tirar a preferida tem que apagar a de antes */
    finalizacaoPreferida: preferida,
    finalizacoesAceitas: aceitas,
    passos: guardados,
    ligacoes: convergenciasValidas(guardados, ligacoes),
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
   que não encaixaram, pela peça (não pela posição na lista). */
const ehLuta = (r) => (r.contexto || 'rola') !== 'drill';
const usosDo = (plano, rolls) => rolls.filter((r) => ehLuta(r) && r.plano?.uid && r.plano.uid === plano.uid);

export function taxaDoPlano(plano, rolls = []) {
  const usos = usosDo(plano, rolls);
  const encaixes = usos.filter((r) => r.plano.encaixou).length;
  const morre = {};
  for (const r of usos) if (!r.plano.encaixou && r.plano.peca) morre[r.plano.peca] = (morre[r.plano.peca] || 0) + 1;
  const [peca, vezes] = Object.entries(morre).sort((a, b) => b[1] - a[1])[0] || [];
  const p = peca && pecaDoRola(plano, { plano: { peca } });
  return {
    usos: usos.length,
    encaixes,
    taxa: usos.length ? Math.round((encaixes / usos.length) * 100) : 0,
    morreNo: p ? { peca, golpe: p.golpe, saiu: p.saiu, vezes } : null,
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
