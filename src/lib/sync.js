import Dexie from 'dexie';
import { db, TABELAS_SYNC } from '../db/db';
import { uidEstavel, chaveNome } from './uid';
import { supabase, supabaseConfigurado, sessaoAtual } from './supabase';

/* ============================================================
   SYNC OFFLINE-FIRST
   - O IndexedDB continua sendo a fonte de verdade LOCAL.
   - Toda gravação entra numa fila (outbox).
   - Quando tem internet + login, a fila sobe e o que mudou desce.
   - Conflito: vence quem tem updated_at maior (last-write-wins).
   O app funciona 100% sem nada disso configurado.
   ============================================================ */

const ouvintes = new Set();
let estado = { rodando: false, ultimo: null, pendentes: 0, erro: null, ligado: false };

export function onSync(fn) {
  ouvintes.add(fn);
  fn(estado);
  return () => ouvintes.delete(fn);
}
function emitir(patch) {
  estado = { ...estado, ...patch };
  ouvintes.forEach((f) => f(estado));
}

export async function contarPendentes() {
  const n = await db.outbox.count();
  emitir({ pendentes: n });
  return n;
}

/* ---------- enfileirar ---------- */
export async function enfileirar(tabela, op, registro) {
  if (!supabaseConfigurado) return;          // nuvem desligada: nada de fila
  if (!TABELAS_SYNC.includes(tabela)) return;

  // Os hooks do Dexie disparam DENTRO da transação da tabela que mudou.
  // Gravar no outbox ali de dentro estoura NotFoundError, porque essa
  // tabela não está no escopo. ignoreTransaction faz a gravação sair
  // da transação atual e rodar por fora.
  try {
    await Dexie.ignoreTransaction(() => db.outbox.add({
      tabela,
      op, // upsert | delete
      uid: registro.uid,
      dados: op === 'delete' ? null : registro,
      updatedAt: registro.updatedAt || Date.now(),
      criadoEm: Date.now(),
      tentativas: 0,
    }));
  } catch (e) {
    // fila é best-effort: nunca pode derrubar a gravação principal
    return;
  }
  contarPendentes();
  agendar();
}

/* ============================================================
   A BIBLIOTECA NÃO SOBE

   Posições, categorias e técnicas da biblioteca nascem iguais em
   todo aparelho, com o mesmo uid. Enquanto o aluno não mexe, subir
   não serve pra nada: só ocupa o banco grátis e, pior, uma cópia
   zerada de um aparelho novo sobrescrevia na nuvem o que ele tinha
   marcado no outro. Mexeu (status, favorita, nota), vira dado dele
   e sobe como qualquer outro.
   ============================================================ */
/* os planos de ataque que vêm prontos também: a chave deles é o slug */
const SEMENTES = ['positions', 'categories', 'techniques', 'attackPlans'];

export function sementeIntacta(tabela, o) {
  if (!SEMENTES.includes(tabela) || !o?.nome || !o.uid || o.arquivada) return false;
  if (tabela === 'attackPlans') {
    if (!o.pronto || o.favorito || !o.slug || (o.updatedAt || 0) - (o.criadoEm || 0) > 5000) return false;
    return o.uid === uidEstavel(chaveNome(tabela, o.slug));
  }
  if ((o.updatedAt || 0) - (o.criadoEm || 0) > 5000) return false;
  if (tabela === 'techniques' && ((o.status || 'nao_iniciada') !== 'nao_iniciada' || o.favorita || o.nivel || o.detalhes || o.video)) return false;
  return o.uid === uidEstavel(chaveNome(tabela, o.nome));
}

let timer = null;
function agendar(ms = 1200) {
  clearTimeout(timer);
  timer = setTimeout(() => sincronizar().catch(() => {}), ms);
}

/* ---------- ciclo completo ---------- */
export async function sincronizar({ forcar = false } = {}) {
  if (!supabaseConfigurado) return { ok: false, motivo: 'nao_configurado' };
  if (estado.rodando && !forcar) return { ok: false, motivo: 'ja_rodando' };
  if (!navigator.onLine) return { ok: false, motivo: 'offline' };

  const sess = await sessaoAtual();
  if (!sess) return { ok: false, motivo: 'sem_login' };

  emitir({ rodando: true, erro: null, ligado: true });
  try {
    /* sobe em lotes até a fila esvaziar: antes subia 400 e esperava o
       próximo ciclo, e a fila de quem reenviava tudo ficava horas em "pendentes" */
    for (let lote = 0; lote < 50 && (await subir(sess.user.id)) > 0; lote++);
    await baixar(sess.user.id);
    const agora = Date.now();
    await db.meta.put({ key: 'ultimo_sync', value: agora });
    emitir({ rodando: false, ultimo: agora });
    await contarPendentes();
    return { ok: true };
  } catch (e) {
    emitir({ rodando: false, erro: String(e?.message || e) });
    return { ok: false, motivo: 'erro', erro: e };
  }
}

/* ---------- SUBIR (outbox -> nuvem) ---------- */
async function subir(userId) {
  const itens = await db.outbox.orderBy('criadoEm').limit(400).toArray();
  if (!itens.length) return 0;

  // deduplica: só a última versão de cada uid importa. Biblioteca intocada
  // que ficou na fila de antes sai da fila sem subir.
  const mapa = new Map();
  for (const i of itens) if (!(i.op === 'upsert' && sementeIntacta(i.tabela, i.dados))) mapa.set(i.uid, i);
  const finais = [...mapa.values()];

  const upserts = finais
    .filter((i) => i.op === 'upsert' && i.dados)
    .map((i) => ({
      id: i.uid,
      user_id: userId,
      tabela: i.tabela,
      dados: limpar(i.dados),
      updated_at: new Date(i.updatedAt || Date.now()).toISOString(),
      deleted_at: null,
    }));

  const deletes = finais
    .filter((i) => i.op === 'delete')
    .map((i) => ({
      id: i.uid,
      user_id: userId,
      tabela: i.tabela,
      dados: {},
      updated_at: new Date(i.updatedAt || Date.now()).toISOString(),
      deleted_at: new Date().toISOString(),
    }));

  const lote = [...upserts, ...deletes];
  for (let i = 0; i < lote.length; i += 100) {
    const parte = lote.slice(i, i + 100);
    const { error } = await supabase.from('registros').upsert(parte, { onConflict: 'id' });
    if (error) throw error;
  }

  await db.outbox.bulkDelete(itens.map((i) => i.id));
  await contarPendentes();
  return itens.length;
}

/* ---------- BAIXAR (nuvem -> local) ---------- */
async function baixar(userId) {
  const cursorRow = await db.meta.get('sync_cursor');
  const cursor = cursorRow?.value || '1970-01-01T00:00:00.000Z';

  let maior = cursor;
  let pagina = 0;
  while (pagina < 20) {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', maior)
      .order('updated_at', { ascending: true })
      .limit(500);
    if (error) throw error;
    if (!data || !data.length) break;

    await aplicarLocal(data);
    maior = data[data.length - 1].updated_at;
    if (data.length < 500) break;
    pagina++;
  }

  if (maior !== cursor) await db.meta.put({ key: 'sync_cursor', value: maior });
}

async function aplicarLocal(linhas) {
  for (const linha of linhas) {
    const tabela = linha.tabela;
    if (!TABELAS_SYNC.includes(tabela) || !db[tabela]) continue;

    const existente = await db[tabela].where('uid').equals(linha.id).first();

    if (linha.deleted_at) {
      if (existente) await db[tabela].delete(existente.id);
      continue;
    }

    const remotoEm = new Date(linha.updated_at).getTime();
    if (existente && (existente.updatedAt || 0) >= remotoEm) continue; // local é mais novo

    /* __local: grava sem voltar pra fila de envio (db.js). Sem isso,
       o que descia voltava a subir, e o ciclo não parava. */
    const registro = { ...linha.dados, uid: linha.id, updatedAt: remotoEm, sincronizado: 1, __local: Math.random() };
    if (existente) {
      await db[tabela].update(existente.id, registro);
    } else {
      delete registro.id;
      await db[tabela].add(registro);
    }
  }
}

function limpar(obj) {
  const { id, sincronizado, __local, ...resto } = obj || {};
  return resto;
}

/* ---------- primeira migração: carimba tudo que já existe ---------- */
export async function migrarParaNuvem() {
  let total = 0;
  for (const tabela of TABELAS_SYNC) {
    if (!db[tabela]) continue;
    const linhas = await db[tabela].toArray();
    for (const l of linhas) {
      if (sementeIntacta(tabela, l)) continue;
      const uid = l.uid || crypto.randomUUID();
      const updatedAt = l.updatedAt || l.criadoEm || Date.now();
      if (!l.uid || !l.updatedAt) await db[tabela].update(l.id, { uid, updatedAt });
      await enfileirar(tabela, 'upsert', { ...l, uid, updatedAt });
      total++;
    }
  }
  await sincronizar({ forcar: true });
  return total;
}

/* ---------- limpar vínculo local (logout) ---------- */
export async function limparCursor() {
  await db.meta.delete('sync_cursor');
  await db.outbox.clear();
  emitir({ ligado: false, pendentes: 0, ultimo: null });
}

/* ---------- start ---------- */
export function iniciarSync() {
  if (!supabaseConfigurado) return;
  window.addEventListener('online', () => agendar(500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') agendar(800);
  });
  setInterval(() => { if (navigator.onLine) sincronizar().catch(() => {}); }, 5 * 60 * 1000);
  agendar(2500);
}
