import { CATALOGO_TECNICAS, TECNICA_POR_UID, origemDaTecnica } from './tecnicas';
import { nomeAtual } from '../db/renomeios';
import { semAcento } from './classificar';
import { ehFamilia } from './familias';

/* ============================================================
   A IDENTIDADE DA TÉCNICA NOS REGISTROS

   O uid é a identidade, o nome é o que aparece (docs/CONTRATO-TECNICAS.md).
   As listas de nomes do rola, do plano e da meta continuam como
   sempre; ao lado, o registro guarda o uid da técnica:
   - rola, meta e plano (objetivo, preferida, aceitas):
     tecUid = { "<uid>": "<nome na época>" };
   - peça do plano (golpe ou situação): golpeUid.

   Só liga com prova: o nome tem que bater com exatamente uma técnica
   (catálogo pelo nome de hoje, nome antigo, ou a própria do atleta).
   Ambíguo ou sem par fica sem uid e segue pelo nome, como hoje.
   O nome na época nunca é reescrito: renomear muda as listas.

   Tudo aqui é puro: recebe a lista de técnicas do aparelho.
   ============================================================ */

/* o mesmo jeito que o app compara nome digitado com a biblioteca */
const chave = (nome) => semAcento(nomeAtual(String(nome || '').trim()));
/* o uid de catálogo que juntou com outro aponta pro uid principal */
const principal = (uid) => TECNICA_POR_UID.get(uid)?.uid || uid;

/* a biblioteca é semeada de uma vez: centenas de técnicas no mesmo
   minuto. Pela tela, ninguém cria 20 técnicas num minuto. */
const JANELA_DA_SEMENTE = 60 * 1000;
const MINIMO_DA_SEMENTE = 20;

export function nascidasComABiblioteca(tecnicas) {
  const datas = tecnicas.map((t) => t.criadoEm).filter(Number.isFinite).sort((a, b) => a - b);
  const vizinhas = (d) => {
    let n = 0;
    for (const x of datas) if (Math.abs(x - d) <= JANELA_DA_SEMENTE) n++;
    return n;
  };
  const cache = new Map();
  return (t) => {
    if (!cache.has(t.criadoEm)) cache.set(t.criadoEm, vizinhas(t.criadoEm) >= MINIMO_DA_SEMENTE);
    return cache.get(t.criadoEm);
  };
}

/* Aparelho antigo tem o catálogo com uid aleatório (versão 1 do banco).
   Essa cópia responde pelo uid oficial só com as três provas: não é
   própria, o nome (exato, só sem acento e com o nome de hoje) é de uma
   técnica só do catálogo, e ela nasceu junto com a biblioteca. Sem
   prova, fica com o uid dela: o nome continua ambíguo, nada é chutado. */
function copiaDoCatalogo(t, porNome, daSemente) {
  if (t.propria || !Number.isFinite(t.criadoEm) || !daSemente(t)) return null;
  const oficiais = [...(porNome.get(chave(t.nome)) || [])].filter((u) => TECNICA_POR_UID.has(u));
  return oficiais.length === 1 ? oficiais[0] : null;
}

/* nome → uids que respondem por ele. Um índice por lista */
const INDICES = new WeakMap();
function indice(tecnicas) {
  const lista = Array.isArray(tecnicas) ? tecnicas : [];
  if (INDICES.has(lista)) return INDICES.get(lista);
  const porNome = new Map();
  const porUid = new Map();
  const legados = new Map(); // uid da cópia antiga → uid oficial
  const por = (nome, uid) => {
    const k = chave(nome);
    if (!k || !uid) return;
    if (!porNome.has(k)) porNome.set(k, new Set());
    porNome.get(k).add(uid);
  };
  for (const t of CATALOGO_TECNICAS) {
    por(t.nome, t.uid);
    if (t.antigo) por(t.antigo, t.uid);
    porUid.set(t.uid, t.nome);
  }
  /* o que está no aparelho: o catálogo de novo (sem duplicar) e as próprias.
     A linha do catálogo com uid de um nome antigo de RENOMEAR é do catálogo
     (origemDaTecnica): responde pelo uid da biblioteca, igual em todo aparelho */
  const doCatalogo = new Map(CATALOGO_TECNICAS.map((t) => [chave(t.nome), t.uid]));
  const daSemente = nascidasComABiblioteca(lista);
  for (const t of lista) {
    if (!t?.uid || !t.nome) continue;
    const u = TECNICA_POR_UID.has(t.uid) ? principal(t.uid)
      : origemDaTecnica(t.uid) === 'catalogo' ? doCatalogo.get(chave(t.nome)) || t.uid
      : copiaDoCatalogo(t, porNome, daSemente) || t.uid;
    por(t.nome, u);
    porUid.set(u, t.nome);
    /* o uid antigo da cópia continua achando o nome (referência legada) */
    if (u !== t.uid) { porUid.set(t.uid, t.nome); legados.set(t.uid, u); }
  }
  const ix = { porNome, porUid, legados };
  INDICES.set(lista, ix);
  return ix;
}

/* o que o nome é: { uid } com uma técnica só, { ambiguo } com mais de uma, { semPar } com nenhuma */
export function resolverNome(nome, tecnicas = []) {
  if (!String(nome || '').trim() || ehFamilia(nome)) return { semPar: true };
  const uids = indice(tecnicas).porNome.get(chave(nome));
  if (!uids || !uids.size) return { semPar: true };
  if (uids.size > 1) return { ambiguo: true };
  return { uid: [...uids][0] };
}

/* o uid oficial de um uid legado (cópia antiga do catálogo); os outros ficam como estão */
export const uidOficial = (uid, tecnicas = []) => indice(tecnicas).legados.get(uid) || uid;

export const uidDaTecnica = (nome, tecnicas = []) => resolverNome(nome, tecnicas).uid || null;

/* o nome de hoje da técnica daquele uid */
export const nomeDoUid = (uid, tecnicas = []) => indice(tecnicas).porUid.get(principal(uid)) || null;

/* o uid continua valendo pro nome: é o nome de hoje dele, ou o nome resolve nele */
function aindaE(uid, nome, tecnicas, naEpoca = null) {
  const k = chave(nome);
  if (!k) return false;
  return k === chave(nomeDoUid(uid, tecnicas)) || (naEpoca !== null && k === chave(naEpoca))
    || uidDaTecnica(nome, tecnicas) === uid;
}

/* o mapa { uid: nome na época } de um registro. O que já estava gravado e
   continua no registro fica como estava (o valor nunca é reescrito); o
   que saiu do registro sai do mapa; nome novo que resolve entra */
export function comTecUid(nomes = [], tecnicas = [], tecUidAntigo = {}) {
  const lista = [...new Set((nomes || []).map((n) => String(n || '').trim()).filter((n) => n && !ehFamilia(n)))];
  const antigo = tecUidAntigo && typeof tecUidAntigo === 'object' ? tecUidAntigo : {};
  const out = {};
  for (const [uid, naEpoca] of Object.entries(antigo)) {
    if (lista.some((n) => aindaE(uid, n, tecnicas, naEpoca))) out[uid] = naEpoca;
  }
  for (const n of lista) {
    const u = uidDaTecnica(n, tecnicas);
    if (u && !(u in out)) out[u] = n;
  }
  return out;
}

/* o uid da peça do plano: o que ela já tinha, se o golpe ainda é dele;
   senão, o que o nome resolve. Finta é texto do atleta: nunca tem uid */
export function uidDoGolpe(peca, tecnicas = []) {
  /* finta é texto e situação é posição (Montada é as duas coisas): só o golpe é técnica */
  if (peca?.tipo === 'finta' || peca?.tipo === 'situacao') return null;
  const nome = peca?.golpe ?? peca?.acao;
  if (peca?.golpeUid && aindaE(peca.golpeUid, nome, tecnicas)) return uidOficial(peca.golpeUid, tecnicas);
  return uidDaTecnica(nome, tecnicas);
}

/* ---------- os nomes de técnica de cada registro ---------- */
export const nomesDoRola = (r) => [
  ...(r?.subsAplicadas || []), ...(r?.subsSofridas || []),
  ...Object.values(r?.tecMeus || {}).flat(), ...Object.values(r?.tecDele || {}).flat(),
];

/* objetivo só quando é técnica (posição e Finalizar não são); preferida e
   aceitas só no finalizar; família já é id e não entra */
export function nomesDoPlano(p) {
  const tipo = p?.objetivoTipo || (p?.objetivo ? 'tecnica' : '');
  return [
    ...(tipo === 'tecnica' ? [p.objetivo] : []),
    ...(tipo === 'finalizar' ? [p.finalizacaoPreferida, ...(p.finalizacoesAceitas || [])] : []),
  ].filter((n) => n && !ehFamilia(n));
}

export const metaDeTecnica = (g) => (g?.tipo === 'tecnica' || g?.tipo === 'defesa') && typeof g.alvo === 'string';
export const nomesDaMeta = (g) => (metaDeTecnica(g) && g.alvo.trim() ? [g.alvo] : []);

/* ---------- renomear pelo uid ----------
   A técnica {uid} passou a se chamar nomeNovo. Nos registros que apontam
   pra ela pelo uid (não pelo nome), as listas trocam o nome; o tecUid
   fica com o nome na época. nomeAntigo é o nome que ela tinha até agora
   (o registro pode ter o nome de hoje ou o da época). Devolve os patches:
   [{ tabela, id, patch }]. Quem grava é quem chama. */
export function patchesDoRenomeio({ uid, nomeNovo, nomeAntigo = null }, { rolls = [], attackPlans = [], goals = [] } = {}) {
  const novo = String(nomeNovo || '').trim();
  if (!uid || !novo) return [];
  const out = [];
  const trocador = (naEpoca) => {
    const velhos = new Set([nomeAntigo, naEpoca].filter(Boolean).map(chave));
    return (n) => (typeof n === 'string' && velhos.has(chave(n)) ? novo : n);
  };
  const mudou = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

  for (const r of rolls) {
    if (!r?.tecUid || !(uid in r.tecUid)) continue;
    const troca = trocador(r.tecUid[uid]);
    const mapa = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, Array.isArray(v) ? v.map(troca) : v]));
    const patch = {};
    for (const campo of ['subsAplicadas', 'subsSofridas']) {
      const l = (r[campo] || []).map(troca);
      if (mudou(l, r[campo] || [])) patch[campo] = l;
    }
    for (const campo of ['tecMeus', 'tecDele']) {
      const m = mapa(r[campo]);
      if (mudou(m, r[campo] || {})) patch[campo] = m;
    }
    if (Object.keys(patch).length) out.push({ tabela: 'rolls', id: r.id, patch });
  }

  for (const p of attackPlans) {
    const patch = {};
    /* a peça com golpeUid é daquela técnica: o uid foi conferido ao salvar */
    const passos = (p?.passos || []).map((x) => (x?.golpeUid === uid && x.tipo !== 'finta' && x.acao !== novo
      ? { ...x, acao: novo } : x));
    if (mudou(passos, p?.passos || [])) patch.passos = passos;
    if (p?.tecUid && uid in p.tecUid) {
      const troca = trocador(p.tecUid[uid]);
      const tipo = p.objetivoTipo || (p.objetivo ? 'tecnica' : '');
      if (tipo === 'tecnica' && troca(p.objetivo) !== p.objetivo) patch.objetivo = troca(p.objetivo);
      if (troca(p.finalizacaoPreferida) !== p.finalizacaoPreferida) patch.finalizacaoPreferida = troca(p.finalizacaoPreferida);
      const aceitas = (p.finalizacoesAceitas || []).map(troca);
      if (mudou(aceitas, p.finalizacoesAceitas || [])) patch.finalizacoesAceitas = aceitas;
    }
    if (Object.keys(patch).length) out.push({ tabela: 'attackPlans', id: p.id, patch });
  }

  for (const g of goals) {
    if (!metaDeTecnica(g) || !g.tecUid || !(uid in g.tecUid)) continue;
    const alvo = trocador(g.tecUid[uid])(g.alvo);
    if (alvo !== g.alvo) out.push({ tabela: 'goals', id: g.id, patch: { alvo } });
  }
  return out;
}
