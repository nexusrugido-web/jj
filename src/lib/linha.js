import {
  correnteDoPlano, ligacoesDo, arvoreDoPlano, letraDo, chegaNoObjetivo, finaliza, paradasDe, pecaDoRola,
  caminhoDoRola, fugasDe, defesasDe, pontosDoPlano, pontuouValido, tirarPontos, novoId,
} from './planos';
import { nomeDoUid } from './identidade';

/* ============================================================
   LINHA DA LUTA (R7.5)

   O rola contado de cima pra baixo, um acontecimento por vez. Três
   camadas que não se misturam:
   - o OBJETIVO é do plano (o que quero alcançar);
   - o INÍCIO é real (onde a luta começou: em pé, na guarda...), que
     pode não ser a posição de onde o plano começa;
   - a EXECUÇÃO é a linha: finta, técnica, resultado, posição, o que
     ele fez, na ordem em que aconteceu.
   Nada é presumido: depois da técnica que deu certo, o app pergunta
   onde a luta ficou, e a posição vira um quadro da linha. Só daí vêm
   as sugestões (do plano e do catálogo) que fazem sentido ali.

   Mora no mesmo registro do rola (r.linha, o JSON que já sobe no sync):
   linha = { seqs: [{ id, inicio, plano, passos }], fim, entrou, sofreu, pontuou }
   - seqs: uma por tentativa; a luta recomeçar (depois de finalizar ou
     quando a pessoa diz) abre outra, sem apagar a de antes;
   - entrou / sofreu: finalizações que a linha pôs em "Eu finalizei" e
     "Ele me finalizou" (como o entrou do R7.1, contando repetida);
   - pontuou: pontos que a linha pôs em "Meus lances", com o passo (ev).
   inicio: { pos: slug } (posição do catálogo) ou { plano: true } (a
   posição do plano, quando ele não tem uma do catálogo); null = a
   pergunta da vez.
   passos:
   - peça do plano: { id, quem: 'eu', peca, lig, res, saida }
     lig: a ligação por onde chegou (só quando o passo de antes foi a
     peça de onde ela sai; senão '', nada é deduzido);
     saida: no defendeu, a defesa do plano; no escapou, a fuga;
   - técnica fora do plano: { id, quem: 'eu', tec, tecUid, res } (uid do catálogo);
   - finta ou preparação fora do plano: { id, quem: 'eu', tipo, texto, res } (texto livre);
   - posição: { id, quem: 'lugar', pos, por } (por: 'eu' quando eu
     estabeleci, 'ele' quando foi ele, '' sem dizer);
   - o que ele fez: { id, quem: 'ele', acao, tec?, tecUid? }.
   res pelo tipo: golpe encaixou, defendeu, escapou (e puxou, na
   queda); finta reagiu, naoReagiu; preparação feita, impediu; naoSei.

   O r.plano de sempre sai da linha (planoDaLinha): a tentativa que
   chegou no objetivo, senão a última peça do plano. A taxa por etapa
   (R7.3), o "Objetivo alcançado" e o rodízio continuam contando um rola
   como um rola. Por tentativa é outra medida (tentativasPorPeca).

   cat (o catálogo, opcional): { categoriaDe(nome), origemDe(nome),
   tecnicas, posicoes, slugDoPlano(plano) } vem pendurado no destinoDe.
   ============================================================ */

export const NAO_SEI = 'naoSei';
/* o nome do resultado bom muda com o tipo da técnica */
const ENCAIXOU = { queda: 'Consegui derrubar', raspagem: 'Raspei', passagem: 'Passei a guarda', transicao: 'Consegui' };
export const RESULTADOS = {
  golpe: [{ id: 'encaixou', nome: 'Encaixou' }, { id: 'defendeu', nome: 'Ele defendeu' }, { id: 'escapou', nome: 'Ele escapou' }],
  finta: [{ id: 'reagiu', nome: 'Ele reagiu' }, { id: 'naoReagiu', nome: 'Ele não reagiu' }],
  preparacao: [{ id: 'feita', nome: 'Montou' }, { id: 'impediu', nome: 'Ele não deixou' }],
};
/* o que ele fez, sem ser resposta a uma ação minha; lado: onde faz sentido */
export const ACOES_DELE = [
  { id: 'escapou', nome: 'Ele escapou' },
  { id: 'raspou', nome: 'Ele me raspou', lado: 'cima' },
  { id: 'passou', nome: 'Ele passou minha guarda', lado: 'baixo' },
  { id: 'derrubou', nome: 'Ele me derrubou', lado: 'em_pe' },
  { id: 'puxou', nome: 'Ele puxou pra guarda', lado: 'em_pe' },
  { id: 'posicao', nome: 'Ele mudou a posição' },
  { id: 'finalizou', nome: 'Ele me finalizou' },
];
const LADO_DA_FAMILIA = { dominante: 'cima', neutra: 'cima', guarda: 'baixo', perna: 'baixo', inferior: 'baixo', em_pe: 'em_pe' };
/* posição que vale ponto quando estabilizada 3 segundos (o mesmo do R7.4b) */
const PONTO_DA_POSICAO = { montada: 'montada', costas: 'costas', joelho_barriga: 'joelho' };
const BOM = new Set(['encaixou', 'reagiu', 'feita']);
const MUDA_LUGAR = new Set(['escapou', 'puxou']);
const tipoDaPeca = (x) => (x?.tipo === 'finta' || x?.tipo === 'preparacao' || x?.tipo === 'situacao' ? x.tipo : 'golpe');

export const linhaVazia = () => ({ seqs: [], fim: false, entrou: [], sofreu: [], pontuou: [] });
export const temLinha = (r) => Array.isArray(r?.linha?.seqs) && r.linha.seqs.length > 0;
const doPlano = (p) => p?.quem === 'eu' && !!p.peca;
const ultimoDe = (l) => l[l.length - 1];

/* ---------- leitura do plano e do passo ---------- */

function mapaDoPlano(plano) {
  const c = correnteDoPlano(plano);
  const vivas = new Map(ligacoesDo(c.passos, c.ligacoes).map((l) => [l.id, l]));
  const mortas = new Map((plano?.removidos?.ligacoes || []).map((l) => [l.id, l]));
  return { c, lig: (id) => vivas.get(id) || mortas.get(id) || null, vivas: [...vivas.values()] };
}
export const pecaDoPasso = (plano, p) => (plano && p?.peca ? pecaDoRola(plano, { plano: { peca: p.peca } }) : null);
export function tipoDoPasso(plano, p) {
  if (p?.peca) return tipoDaPeca(pecaDoPasso(plano, p));
  return p?.tipo === 'finta' || p?.tipo === 'preparacao' ? p.tipo : 'golpe';
}
/* o nome de hoje: a peça pelo uid da técnica, a técnica fora do plano pelo uid dela, a finta pelo texto */
export function nomeDoPasso(plano, p, tecnicas = []) {
  if (!p) return '';
  if (p.peca) {
    const x = pecaDoPasso(plano, p);
    return (x?.golpeUid && nomeDoUid(x.golpeUid, tecnicas)) || x?.golpe || '';
  }
  if (p.texto) return p.texto;
  return (p.tecUid && nomeDoUid(p.tecUid, tecnicas)) || p.tec || '';
}
/* as respostas pelo tipo do que eu fiz; no golpe, pela categoria da técnica */
export function resultadosDe(plano, p, cat = {}) {
  const tipo = tipoDoPasso(plano, p);
  if (tipo !== 'golpe') return RESULTADOS[tipo];
  const categoria = cat.categoriaDe?.(nomeDoPasso(plano, p, cat.tecnicas || [])) || '';
  const lista = RESULTADOS.golpe.map((x) => (x.id === 'encaixou' && ENCAIXOU[categoria] ? { ...x, nome: ENCAIXOU[categoria] } : x));
  return categoria === 'queda' ? [...lista, { id: 'puxou', nome: 'Ele puxou pra guarda' }] : lista;
}

/* finalizou: o golpe (do plano ou fora dele) que encaixou e termina em finalização */
export function finalizouNoPasso(plano, p, destinoDe = () => null) {
  if (p?.quem !== 'eu' || p.res !== 'encaixou' || p.texto) return false;
  if (p.peca) return finaliza(pecaDoPasso(plano, p), destinoDe);
  return destinoDe(p.tec)?.slug === 'finalizacao';
}
export function chegouNoObjetivo(plano, p, destinoDe = () => null) {
  if (!plano || !doPlano(p) || p.res !== 'encaixou') return false;
  return chegaNoObjetivo(pecaDoPasso(plano, p), correnteDoPlano(plano), destinoDe);
}

/* ---------- onde a luta está ---------- */

/* a posição de agora: o último quadro de posição, senão o começo da sequência */
export function posicaoAtual(seq) {
  const lugar = [...(seq?.passos || [])].reverse().find((p) => p.quem === 'lugar');
  if (lugar) return { pos: lugar.pos };
  return seq?.inicio || null;
}
export function ladoDe(pos, cat = {}) {
  if (!pos) return '';
  if (pos === 'em_pe') return 'em_pe';
  return LADO_DA_FAMILIA[(cat.posicoes || []).find((x) => x.slug === pos)?.familia] || '';
}
const slugDoPlano = (plano, cat) => cat.slugDoPlano?.(plano) || '';
/* a luta está na posição de onde o plano começa */
const naPosicaoDoPlano = (onde, plano, cat) => !!onde && (onde.plano || (!!onde.pos && onde.pos === slugDoPlano(plano, cat)));

/* de onde o plano continua: a última peça do plano e por quais saídas.
   adjacente: entre ela e agora só tem a posição que eu estabeleci com
   ela, então a ligação pode ser guardada. Com o que ele fez ou um
   improviso no meio, o caminho do plano quebrou. */
function ondeEsta(plano, seq, cat = {}) {
  const ps = seq?.passos || [];
  let k = ps.length - 1;
  /* a posição que eu estabeleci com a peça que encaixou não quebra o caminho */
  const transparente = (j) => ps[j]?.quem === 'lugar' && ps[j].por === 'eu' && doPlano(ps[j - 1]) && ps[j - 1].res === 'encaixou';
  while (k >= 0 && transparente(k)) k--;
  /* improviso meu no meio (técnica ou finta fora do plano): o plano continua de onde estava, sem ligação */
  let adjacente = true;
  while (k >= 0 && ps[k].quem === 'eu' && !ps[k].peca) { k--; adjacente = false; }
  const base = doPlano(ps[k]) ? ps[k] : null;
  if (base && !adjacente) {
    if (base.res === 'escapou' || base.res === 'puxou') return null;
    const vias = base.res === 'defendeu' ? ['defendeu'] : !base.res || base.res === NAO_SEI ? ['encaixou', 'reagiu', 'feita', 'defendeu', 'naoReagiu', 'impediu'] : [base.res];
    return { de: base.peca, vias, adjacente: false };
  }
  if (!base) {
    /* sem peça do plano: o plano só entra pela posição em que a luta está */
    const onde = k < 0 || ps[k].quem === 'lugar' ? posicaoAtual(seq) : null;
    return naPosicaoDoPlano(onde, plano, cat) ? { de: null, vias: [null], adjacente } : null;
  }
  if (base.res === 'escapou' || base.res === 'puxou') {
    const l = base.saida ? mapaDoPlano(plano).lig(base.saida) : null;
    if (l && l.para) return { de: l.para, vias: ['retoma'], adjacente: true };
    if (l) return { de: null, vias: [null], adjacente: true };
    return null;
  }
  if (base.res === 'defendeu') return { de: base.peca, vias: ['defendeu'], so: base.saida || '', adjacente: true };
  if (!base.res || base.res === NAO_SEI) return { de: base.peca, vias: ['encaixou', 'reagiu', 'feita', 'defendeu', 'naoReagiu', 'impediu'], adjacente: true };
  return { de: base.peca, vias: [base.res], adjacente: true };
}

/* o que o plano oferece agora: as peças pra onde a luta pode ir pelo
   caminho do plano (com o gatilho) e, na posição em que a luta está, as
   peças do plano que saem dela (sem ligação: o caminho não é deduzido).
   Situação não entra: ela é lugar, não ação. */
export function proximasDoPlano(plano, seq, cat = {}) {
  if (!plano) return [];
  const { c, vivas } = mapaDoPlano(plano);
  const pecas = new Map(c.passos.map((x) => [x.id, x]));
  const { trilho } = arvoreDoPlano(c.passos);
  const idx = new Map(c.passos.map((x, k) => [x.id, k]));
  const item = (x, l = null) => ({ peca: x.id, lig: l?.id || '', via: l ? l.via ?? null : null, gatilho: l?.gatilho || '', golpe: x.golpe, tipo: x.tipo, letra: letraDo(trilho[idx.get(x.id)] || 0) });
  const onde = ondeEsta(plano, seq, cat);
  const out = onde ? vivas
    .filter((l) => (l.de ?? null) === onde.de && onde.vias.includes(l.via ?? null) && l.para != null
      && pecas.has(l.para) && pecas.get(l.para).tipo !== 'situacao' && (!onde.so || l.id === onde.so))
    .map((l) => item(pecas.get(l.para), onde.adjacente ? l : { ...l, id: '' })) : [];
  const pos = posicaoAtual(seq)?.pos;
  if (pos && cat.origemDe && ultimoDe(seq?.passos || [])?.quem === 'lugar') {
    for (const x of c.passos) {
      if (x.tipo === 'golpe' && !out.some((y) => y.peca === x.id) && cat.origemDe(x.golpe) === pos) out.push(item(x));
    }
  }
  return out;
}

/* todas as peças do plano que dá pra fazer (não a situação), na ordem de leitura */
export function pecasDoPlano(plano) {
  if (!plano) return [];
  const c = correnteDoPlano(plano);
  const { ordem, trilho } = arvoreDoPlano(c.passos);
  return ordem.map((k) => ({ ...c.passos[k], letra: letraDo(trilho[k]) })).filter((x) => x.tipo !== 'situacao');
}

/* ---------- a pergunta da vez ----------
   inicio: de onde começou (ou recomeçou); acao: o que aconteceu;
   resultado: como foi o que eu fiz; onde: onde a luta ficou (depois
   do que deu certo, da fuga dele ou do que ele fez); continuou: depois
   de uma finalização; fim. */
export function pergunta(linha, planoDe = () => null, destinoDe = () => null) {
  const l = linha || linhaVazia();
  if (l.fim) return { tipo: 'fim' };
  const seqs = l.seqs || [];
  const seq = ultimoDe(seqs);
  if (!seq) return { tipo: 'inicio', primeira: true };
  if (!seq.inicio) {
    const antes = seqs[seqs.length - 2];
    return { tipo: 'inicio', primeira: seqs.length === 1, depois: antes ? ultimoDe(antes.passos || []) || null : null };
  }
  const p = ultimoDe(seq.passos || []);
  if (!p) return { tipo: 'acao' };
  const plano = planoDe(seq.plano);
  if (p.quem === 'lugar') return { tipo: 'acao', depois: p };
  if (p.quem === 'ele') return p.acao === 'finalizou' ? { tipo: 'continuou', quem: 'ele' } : { tipo: 'onde', depois: p };
  if (!p.res) return { tipo: 'resultado', passo: p };
  if (finalizouNoPasso(plano, p, destinoDe)) return { tipo: 'continuou', quem: 'eu' };
  const tipo = tipoDoPasso(plano, p);
  /* a fuga pra um lugar do plano já diz onde a luta ficou */
  if (MUDA_LUGAR.has(p.res) && !(p.peca && p.saida && mapaDoPlano(plano).lig(p.saida))) return { tipo: 'onde', depois: p };
  if (tipo === 'golpe' && p.res === 'encaixou') return { tipo: 'onde', depois: p };
  return { tipo: 'acao', depois: p };
}

/* ---------- as mudanças (cada uma devolve uma linha nova) ---------- */

const comSeqs = (l, seqs) => ({ ...linhaVazia(), ...l, seqs });
const mudarUltima = (l, f) => {
  const seqs = [...(l.seqs || [])];
  seqs[seqs.length - 1] = f(seqs[seqs.length - 1]);
  return comSeqs(l, seqs);
};
const novaSeq = (inicio, plano) => ({ id: novoId(), inicio, plano: plano || '', passos: [] });

/* de onde começou: preenche a sequência que espera o lugar, ou abre a primeira */
export function iniciar(linha, inicio, uid = '') {
  const l = linha || linhaVazia();
  const seq = ultimoDe(l.seqs || []);
  if (seq && !seq.inicio) return mudarUltima(l, (s) => ({ ...s, inicio, plano: s.plano || uid }));
  return comSeqs(l, [...(l.seqs || []), novaSeq(inicio, uid)]);
}

/* o que eu fiz: peça do plano ({ peca, lig }), técnica fora ({ tec, tecUid })
   ou finta/preparação em texto ({ tipo, texto }). Seguir pela ligação de
   uma defesa do plano diz como ele defendeu. */
export function fazer(linha, { peca = '', lig = '', tec = '', tecUid = null, tipo = '', texto = '' }, plano = null) {
  return mudarUltima(linha, (s) => {
    const passos = [...s.passos];
    const antes = ultimoDe(passos);
    if (lig && doPlano(antes) && antes.res === 'defendeu' && !antes.saida && plano) {
      const l = mapaDoPlano(plano).lig(lig);
      if (l?.via === 'defendeu' && l.de === antes.peca) passos[passos.length - 1] = { ...antes, saida: lig };
    }
    const id = novoId();
    if (peca) passos.push({ id, quem: 'eu', peca, lig: lig || '', res: '', saida: '' });
    else if (texto) passos.push({ id, quem: 'eu', tipo: tipo === 'preparacao' ? 'preparacao' : 'finta', texto: String(texto).trim().slice(0, 120), res: '' });
    else passos.push({ id, quem: 'eu', tec, tecUid: tecUid || null, res: '' });
    return { ...s, passos };
  });
}

/* como foi: trocar o resultado tira o "como" que era do resultado de antes */
export function responder(linha, res) {
  return mudarUltima(linha, (s) => {
    const passos = [...s.passos];
    const p = ultimoDe(passos);
    passos[passos.length - 1] = { ...p, res, ...(p.peca ? { saida: p.res === res ? p.saida || '' : '' } : {}) };
    return { ...s, passos };
  });
}

/* como ele defendeu (a defesa do plano) ou '' pra "não sei" */
export function comoDefendeu(linha, lig) {
  return mudarUltima(linha, (s) => {
    const passos = [...s.passos];
    let k = passos.length - 1;
    while (k >= 0 && !doPlano(passos[k])) k--;
    if (k >= 0 && passos[k].res === 'defendeu') passos[k] = { ...passos[k], saida: lig || '' };
    return { ...s, passos };
  });
}

/* ele escapou pra um lugar que o plano tem (uma situação ou a posição
   de onde o plano começa): a fuga diz onde a luta ficou */
export function fugir(linha, lig) {
  return mudarUltima(linha, (s) => {
    const passos = [...s.passos];
    passos[passos.length - 1] = { ...ultimoDe(passos), saida: lig };
    return { ...s, passos };
  });
}

/* onde a luta ficou: um quadro de posição. "por" diz quem estabeleceu */
export function ficou(linha, pos) {
  return mudarUltima(linha, (s) => {
    const antes = ultimoDe(s.passos);
    const por = antes?.quem === 'ele' || MUDA_LUGAR.has(antes?.res) ? 'ele' : antes?.quem === 'eu' && antes.res === 'encaixou' ? 'eu' : '';
    return { ...s, passos: [...s.passos, { id: novoId(), quem: 'lugar', pos, por }] };
  });
}
/* eu fui pra outra posição sem dizer a técnica (estabilizei, transição) */
export const fuiPara = (linha, pos) => mudarUltima(linha, (s) => ({ ...s, passos: [...s.passos, { id: novoId(), quem: 'lugar', pos, por: 'eu' }] }));

/* a luta recomeçou: outra tentativa, esperando dizer onde */
export const recomecar = (linha, uid = '') => comSeqs(linha, [...(linha.seqs || []), novaSeq(null, uid || ultimoDe(linha.seqs || [])?.plano || '')]);

/* o que ele fez: finalizar pergunta se o rola continuou; o resto pergunta onde a luta ficou */
export const dele = (linha, acao, { tec = '', tecUid = null } = {}) =>
  mudarUltima(linha, (s) => ({ ...s, passos: [...s.passos, { id: novoId(), quem: 'ele', acao, ...(tec ? { tec, tecUid: tecUid || null } : {}) }] }));

export const continuou = (linha, sim) => (sim ? recomecar(linha) : { ...linha, fim: true });
export const acabou = (linha) => ({ ...linha, fim: true });

/* voltar um toque, sem mexer no que veio antes */
export function desfazer(linha) {
  const l = linha || linhaVazia();
  if (l.fim) return { ...l, fim: false };
  const seqs = [...(l.seqs || [])];
  const seq = ultimoDe(seqs);
  if (!seq) return l;
  /* o recomeço que já disse onde: volta a perguntar onde */
  if (seq.inicio && !seq.passos.length && seqs.length > 1) {
    seqs[seqs.length - 1] = { ...seq, inicio: null };
    return comSeqs(l, seqs);
  }
  if (!seq.inicio || !seq.passos.length) { seqs.pop(); return comSeqs(l, seqs); }
  const passos = [...seq.passos];
  const p = ultimoDe(passos);
  if (p.quem === 'eu' && p.saida) passos[passos.length - 1] = { ...p, saida: '' };
  else if (p.quem === 'eu' && p.res) passos[passos.length - 1] = { ...p, res: '', ...(p.peca ? { saida: '' } : {}) };
  else passos.pop();
  seqs[seqs.length - 1] = { ...seq, passos };
  return comSeqs(l, seqs);
}

/* o plano do rola mudou: as sequências que ainda não usaram peça de
   nenhum plano passam a ser dele; as que usaram continuam com o delas */
export const mudarPlano = (linha, uid) => (linha ? {
  ...linha,
  seqs: (linha.seqs || []).map((s) => (s.passos.some(doPlano) || s.plano === (uid || '') ? s : {
    ...s, plano: uid || '', inicio: s.inicio?.pos || (s.inicio?.plano && uid) ? s.inicio : null,
  })),
} : linha);

/* ---------- o que a linha diz pro resto do rola ---------- */

/* o caminho do plano até o passo k: as ligações, andando pra trás
   enquanto o passo de antes é a peça de onde a ligação sai (ou a fuga
   que levou até o lugar de onde ela sai). A posição que eu estabeleci
   com a peça que encaixou não quebra. Quebrou, para ali. */
function caminhoDoPasso(plano, seq, k) {
  const { lig } = mapaDoPlano(plano);
  const out = [];
  for (let j = k; j >= 0;) {
    const p = seq.passos[j];
    const L = p?.lig ? lig(p.lig) : null;
    if (!L) break;
    out.unshift(L.id);
    if (L.de == null) break;
    let a = j - 1;
    while (a >= 0 && seq.passos[a].quem === 'lugar' && seq.passos[a].por === 'eu') a--;
    const antes = seq.passos[a];
    if (!doPlano(antes)) break;
    if (antes.peca === L.de) { j = a; continue; }
    const F = antes.res === 'escapou' && antes.saida ? lig(antes.saida) : null;
    if (F && F.de === antes.peca && F.para === L.de) { out.unshift(F.id); j = a; continue; }
    break;
  }
  return out;
}

/* o r.plano de sempre, tirado da linha: a tentativa que chegou no
   objetivo (a primeira), senão a última peça do plano da última
   sequência que usou o plano */
export function planoDaLinha(linha, uid, plano, destinoDe = () => null, tecnicas = []) {
  const seqs = (linha?.seqs || []).filter((s) => s.plano === uid);
  const tentativas = seqs.map((seq) => {
    const ks = seq.passos.map((p, k) => (doPlano(p) ? k : -1)).filter((k) => k >= 0);
    if (!ks.length) return null;
    const alvo = ks.find((k) => chegouNoObjetivo(plano, seq.passos[k], destinoDe));
    return { seq, k: alvo ?? ks[ks.length - 1], chegou: alvo !== undefined };
  }).filter(Boolean);
  const t = tentativas.find((x) => x.chegou) || ultimoDe(tentativas);
  const fora = (linha?.seqs || []).flatMap((s) => s.passos).filter((p) => p.quem === 'eu' && !p.peca && p.tec);
  const im = fora.find((p) => p.res === 'encaixou') || fora[0];
  const improviso = im ? { nome: nomeDoPasso(null, im, tecnicas), uid: im.tecUid || null, encaixou: im.res === 'encaixou' } : null;
  if (!t) return { uid, peca: null, caminho: [], encaixou: false, ...(improviso ? { improviso } : {}) };
  const p = t.seq.passos[t.k];
  const peca = pecaDoPasso(plano, p);
  const golpe = tipoDaPeca(peca) === 'golpe';
  const parou = paradasDe(peca).some((x) => x.id === p.res) ? p.res : '';
  return {
    uid, peca: p.peca, caminho: caminhoDoPasso(plano, t.seq, t.k),
    encaixou: golpe && p.res === 'encaixou', parou,
    saida: parou === 'escapou' || parou === 'defendeu' ? p.saida || '' : '',
    ...(improviso ? { improviso } : {}),
  };
}

/* as finalizações da linha: minhas (o que encaixou e finaliza) e dele, uma por acontecimento */
export function subsDaLinha(linha, planoDe = () => null, destinoDe = () => null) {
  const tecnicas = destinoDe.tecnicas || [];
  const minhas = [];
  const dele = [];
  for (const seq of linha?.seqs || []) {
    const plano = planoDe(seq.plano);
    for (const p of seq.passos) {
      if (finalizouNoPasso(plano, p, destinoDe)) minhas.push(nomeDoPasso(plano, p, tecnicas));
      if (p.quem === 'ele' && p.acao === 'finalizou' && p.tec) dele.push(nomeDoPasso(null, p, tecnicas));
    }
  }
  return { minhas: minhas.filter(Boolean), dele: dele.filter(Boolean) };
}

/* os pontos que podem ter saído (a mesma regra do R7.4b), sempre com
   confirmação: a técnica que encaixou dá o ponto da categoria (queda,
   raspagem, passagem) no quadro dela; a posição que EU estabeleci dá o
   ponto da posição (montada, costas, joelho na barriga) no quadro da
   posição. Chegar numa posição não presume a técnica, e a técnica não
   presume onde a luta ficou. */
export function pontosDaLinha(linha, planoDe = () => null, destinoDe = () => null) {
  const out = [];
  for (const seq of linha?.seqs || []) {
    const plano = planoDe(seq.plano);
    for (const p of seq.passos) {
      if (p.quem === 'lugar' && p.por === 'eu' && PONTO_DA_POSICAO[p.pos]) out.push({ ponto: PONTO_DA_POSICAO[p.pos], nome: '', ev: p.id });
      if (p.quem !== 'eu' || p.res !== 'encaixou' || tipoDoPasso(plano, p) !== 'golpe') continue;
      const nome = nomeDoPasso(plano, p, destinoDe.tecnicas || []);
      const so = Object.assign((n) => (n === nome ? null : destinoDe(n)), destinoDe);
      for (const x of pontosDoPlano(null, { improviso: { nome, encaixou: true } }, so)) out.push({ ...x, ev: p.id });
    }
  }
  return out;
}

/* como cada ponto possível aparece: 'meu' (a linha pôs), 'ja' (tem um
   igual marcado na mão que ainda não foi contado pra outro passo) ou 'livre' */
const chave = (x) => `${x.ponto}|${x.nome || ''}|${x.ev || ''}`;
export function estadoDosPontosDaLinha(quer = [], pontuou = [], ptsMeus = [], tecMeus = {}) {
  const meus = pontuouValido(pontuou, ptsMeus, tecMeus);
  const livres = {};
  const vagas = (ponto) => {
    if (!livres[ponto]) {
      const nomes = [...(tecMeus?.[ponto] || [])];
      const daLinha = meus.filter((y) => y.ponto === ponto);
      for (const y of daLinha) if (y.nome) { const k = nomes.indexOf(y.nome); if (k >= 0) nomes.splice(k, 1); }
      const total = (ptsMeus || []).filter((x) => x === ponto).length - daLinha.length;
      livres[ponto] = { nomes, semNome: Math.max(0, total - nomes.length) };
    }
    return livres[ponto];
  };
  return quer.map((x) => {
    if (meus.some((y) => chave(y) === chave(x))) return { ...x, estado: 'meu' };
    const v = vagas(x.ponto);
    const k = x.nome ? v.nomes.indexOf(x.nome) : -1;
    if (k >= 0) { v.nomes.splice(k, 1); return { ...x, estado: 'ja' }; }
    if (v.semNome > 0) { v.semNome--; return { ...x, estado: 'ja' }; }
    if (!x.nome && v.nomes.length) { v.nomes.shift(); return { ...x, estado: 'ja' }; }
    return { ...x, estado: 'livre' };
  });
}

/* a lista do rola (finalizações) com o que a linha quer: igual ao
   juntarSubs do R7.1, mas contando repetida (duas cruzadas no mesmo
   rola são duas). A marcada na mão cobre a da linha e nunca sai. */
const tirar = (l, n) => { const k = l.lastIndexOf(n); if (k >= 0) l.splice(k, 1); return k >= 0; };
export function validosNaLista(entrou = [], lista = []) {
  const sobra = [...lista];
  return entrou.filter((n) => tirar(sobra, n));
}
export function juntarLista(lista = [], entrou = [], quer = []) {
  const validos = validosNaLista(entrou, lista);
  const mao = [...lista];
  validos.forEach((n) => tirar(mao, n));
  const precisa = [...quer];
  mao.forEach((n) => tirar(precisa, n));
  const out = [...lista];
  const fica = [];
  for (const n of validos) { if (tirar(precisa, n)) fica.push(n); else tirar(out, n); }
  return { lista: [...out, ...precisa], entrou: [...fica, ...precisa] };
}

/* aplica a linha no rola: devolve o que muda nele. O r.plano sai da
   linha; as finalizações e os pontos que a linha tinha posto e não
   valem mais saem; o que foi marcado na mão fica. */
export function aplicarLinha(r, linha, { planoDe = () => null, destinoDe = () => null, pontos = true } = {}) {
  const tecnicas = destinoDe.tecnicas || [];
  const { minhas, dele: sofridas } = subsDaLinha(linha, planoDe, destinoDe);
  const a = juntarLista(r.subsAplicadas || [], linha.entrou || [], minhas);
  const b = juntarLista(r.subsSofridas || [], linha.sofreu || [], sofridas);
  const pts = tirarPontos({ ptsMeus: r.ptsMeus, tecMeus: r.tecMeus, pontuou: linha.pontuou }, pontos ? pontosDaLinha(linha, planoDe, destinoDe) : []);
  const uid = r.plano?.uid || '';
  const plano = uid ? planoDe(uid) : null;
  return {
    linha: { ...linhaVazia(), ...linha, entrou: a.entrou, sofreu: b.entrou, pontuou: pts.pontuou },
    subsAplicadas: a.lista, subsSofridas: b.lista, ptsMeus: pts.ptsMeus, tecMeus: pts.tecMeus,
    ...(uid ? { plano: { ...(plano ? planoDaLinha(linha, uid, plano, destinoDe, tecnicas) : r.plano), entrou: [], pontuou: [] } } : {}),
  };
}

/* ---------- rola de antes da linha ----------
   O que ele já dizia vira a linha, sem inventar: as peças do caminho
   (quando ele é inteiro, cada uma com a saída que a luta tomou), a
   última com o resultado e o improviso no fim. "Não sei" o caminho:
   só a última peça. Começa na posição do plano (era o que o registro
   antigo perguntava). */
export function linhaDoPlanoAntigo(plano, rp) {
  const l = linhaVazia();
  if (!rp?.uid || (!rp.peca && !rp.improviso?.nome)) return l;
  const passos = [];
  if (rp.peca && plano) {
    const { ligacoes, inteiro } = caminhoDoRola(plano, rp.caminho || []);
    const ok = inteiro && ultimoDe(ligacoes)?.para === rp.peca;
    for (const L of ok ? ligacoes : []) {
      const antes = ultimoDe(passos);
      if (L.via === 'escapou') { if (antes) passos[passos.length - 1] = { ...antes, res: 'escapou', saida: L.id }; continue; }
      if (antes && !antes.res && L.via !== 'retoma') passos[passos.length - 1] = { ...antes, res: L.via, saida: L.via === 'defendeu' ? L.id : '' };
      passos.push({ id: novoId(), quem: 'eu', peca: L.para, lig: L.id, res: '', saida: '' });
    }
    if (!ok) passos.push({ id: novoId(), quem: 'eu', peca: rp.peca, lig: '', res: '', saida: '' });
    const ult = ultimoDe(passos);
    const res = rp.encaixou ? 'encaixou' : rp.parou || '';
    passos[passos.length - 1] = { ...ult, res, saida: res === 'escapou' || res === 'defendeu' ? rp.saida || '' : '' };
  }
  const im = rp.improviso;
  if (im?.nome) passos.push({ id: novoId(), quem: 'eu', tec: im.nome, tecUid: im.uid || null, res: im.encaixou ? 'encaixou' : '' });
  return { ...l, seqs: [{ id: novoId(), inicio: { plano: true }, plano: rp.uid, passos }], entrou: [...(rp.entrou || [])] };
}

/* ---------- tentativas (medida nova, ao lado da do R7.3) ----------
   Por peça do plano: em quantos rolas ela apareceu, quantas vezes foi
   tentada (três armlocks no mesmo rola são três tentativas e um rola) e
   o resultado de cada tentativa. Rola sem linha conta pelo que ele
   dizia. Drill fora: o parceiro colabora. */
export function tentativasPorPeca(plano, rolls = []) {
  const pecas = {};
  for (const r of rolls) {
    if ((r.contexto || 'rola') === 'drill') continue;
    const l = temLinha(r) ? r.linha : r.plano?.uid === plano?.uid ? linhaDoPlanoAntigo(plano, r.plano) : null;
    if (!l) continue;
    const vistas = new Set();
    for (const seq of l.seqs) {
      if (seq.plano !== plano.uid) continue;
      for (const p of seq.passos) {
        if (!doPlano(p)) continue;
        const t = pecas[p.peca] || (pecas[p.peca] = { rolas: 0, tentativas: 0, res: {} });
        if (!vistas.has(p.peca)) { vistas.add(p.peca); t.rolas++; }
        t.tentativas++;
        const res = p.res || NAO_SEI;
        t.res[res] = (t.res[res] || 0) + 1;
      }
    }
  }
  return pecas;
}

export const ehBom = (res) => BOM.has(res);
export { fugasDe, defesasDe };
