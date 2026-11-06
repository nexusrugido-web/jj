import Dexie from 'dexie';
import { db, TABELAS_SYNC } from '../db/db';
import { RENOMEAR } from '../db/renomeios';
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
  // a contagem também roda por fora: ainda dentro do hook, ela caía na
  // transação que já tinha terminado (TransactionInactiveError solto no
  // console a cada gravação)
  Dexie.ignoreTransaction(() => contarPendentes()).catch(() => {});
  agendar();
}

/* ============================================================
   AS CONFIGURAÇÕES SOBEM TAMBÉM

   Treino, rola, meta e lesão sempre subiram; as configurações não
   (ficavam só no aparelho, menos nome, faixa e ritmo, que vão pro
   perfil da liga). Quem trocava de celular recuperava os treinos,
   mas perdia o ano de nascimento, a meta de horas, a academia e o
   professor padrão, a duração do treino, as técnicas liberadas, e
   ainda caía no primeiro acesso de novo.

   Agora elas vão pro mesmo lugar dos treinos (registros), num
   registro só por pessoa: o id dele é o id da conta. Vale a versão
   mais nova, igual ao resto.
   ============================================================ */
export const TABELA_AJUSTES = 'settings';

export async function enfileirarAjustes(settings) {
  /* aparelho que ainda não fez o primeiro acesso não sobe nada: num
     celular novo, ele subiria configurações em branco por cima das
     boas que estão na nuvem, antes de baixá-las */
  if (!supabaseConfigurado || !settings?.onboardingFeito) return;
  try {
    await db.outbox.add({
      tabela: TABELA_AJUSTES, op: 'upsert', uid: TABELA_AJUSTES,
      dados: settings, updatedAt: settings.updatedAt || Date.now(), criadoEm: Date.now(), tentativas: 0,
    });
  } catch {
    return;
  }
  contarPendentes().catch(() => {});
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
  if (o.uid === uidEstavel(chaveNome(tabela, o.nome))) return true;
  /* técnica que mudou de nome: o uid continua sendo o do nome antigo */
  return tabela === 'techniques' && Object.entries(RENOMEAR)
    .some(([antigo, novo]) => novo === o.nome && o.uid === uidEstavel(chaveNome(tabela, antigo)));
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
    for (let lote = 0; lote < 50; lote++) {
      if (!(await subirFila(sess.user.id)).subiram) break;
    }
    await baixar(sess.user.id);
    const agora = Date.now();
    await db.meta.put({ key: 'ultimo_sync', value: agora });
    /* registro recusado continua na fila: o ciclo terminou, mas não está
       tudo na nuvem enquanto houver pendente */
    const falhas = await db.outbox.filter((i) => !!i.erro).count();
    emitir({ rodando: false, ultimo: agora, falhas });
    const pendentes = await contarPendentes();
    return { ok: true, pendentes, falhas };
  } catch (e) {
    emitir({ rodando: false, erro: String(e?.message || e) });
    return { ok: false, motivo: 'erro', erro: e };
  }
}

/* ============================================================
   SUBIR (outbox -> nuvem), SEM TRAVAR A FILA

   Antes, um registro recusado derrubava o lote de 100 inteiro, nada
   saía da fila e a mesma recusa se repetia a cada ciclo: os treinos
   novos ficavam presos atrás dela pra sempre.

   Agora: o lote sobe junto; se for recusado, cada registro tenta
   sozinho. O que o banco aceitou sai da fila. O recusado fica, com
   o motivo, quantas tentativas e quando tentar de novo (espera que
   dobra, até 6 horas). Nada é descartado.

   Erro que vale pra tudo (sem internet, sessão vencida, servidor
   fora do ar) não é do registro: para o ciclo na hora, sem tentar
   um por um, e a fila fica como estava.
   ============================================================ */
export function erroGeral(error, status) {
  const st = Number(status ?? error?.status ?? 0);
  const code = String(error?.code || '');
  if (code === '42501' || /^2[23]/.test(code)) return false; // a regra de segurança ou o dado daquele registro
  if (!st || st === 401 || st === 408 || st === 429 || st >= 500) return true;
  return code.startsWith('PGRST');
}

const ESPERA_MAX = 6 * 60 * 60 * 1000;
export const esperaDaTentativa = (n) => Math.min(60 * 1000 * 2 ** Math.max(0, n - 1), ESPERA_MAX);

const enviarAoSupabase = (linhas) => supabase.from('registros').upsert(linhas, { onConflict: 'id' });

export async function subirFila(userId, enviar = enviarAoSupabase, agora = Date.now()) {
  const itens = await db.outbox.orderBy('criadoEm').filter((i) => !(i.proximaEm > agora)).limit(400).toArray();
  if (!itens.length) return { subiram: 0, falharam: 0 };

  // deduplica: só a última versão de cada uid importa; as anteriores saem
  // junto com ela. Biblioteca intocada que ficou na fila sai sem subir.
  const ultima = new Map();
  const intactas = [];
  for (const i of itens) {
    if (i.op === 'upsert' && sementeIntacta(i.tabela, i.dados)) { intactas.push(i.id); continue; }
    ultima.set(i.uid, i);
  }
  if (intactas.length) await db.outbox.bulkDelete(intactas);
  const finais = [...ultima.values()];
  /* sai a versão que subiu e todas as anteriores do mesmo registro,
     inclusive uma recusada antes que ainda esperava a vez: senão ela
     subiria depois por cima da mais nova */
  const ateEsta = (i, inclusive = true) => db.outbox.where('uid').equals(i.uid)
    .filter((x) => (inclusive ? x.id <= i.id : x.id < i.id)); // o id da fila só cresce
  const tirar = async (lista) => { for (const i of lista) await ateEsta(i).delete(); };

  let subiram = intactas.length;
  let falharam = 0;
  for (let k = 0; k < finais.length; k += 100) {
    const parte = finais.slice(k, k + 100);
    const r = await enviar(paraRegistros(parte, userId));
    if (!r.error) { await tirar(parte); subiram += parte.length; continue; }
    if (erroGeral(r.error, r.status)) throw r.error;
    for (const item of parte) {
      const s = await enviar(paraRegistros([item], userId));
      if (!s.error) { await tirar([item]); subiram++; continue; }
      if (erroGeral(s.error, s.status)) throw s.error;
      const tentativas = (item.tentativas || 0) + 1;
      /* as versões velhas saem: a última leva o registro inteiro */
      await ateEsta(item, false).delete();
      await db.outbox.update(item.id, {
        tentativas,
        erro: `${s.error.code || s.status || ''} ${s.error.message || ''}`.trim(),
        proximaEm: agora + esperaDaTentativa(tentativas),
      });
      falharam++;
    }
  }
  await contarPendentes();
  return { subiram, falharam };
}

/* ============================================================
   CADA CONTA COM A SUA CÓPIA DA BIBLIOTECA NA NUVEM

   Posição, categoria, técnica e plano pronto nascem com o mesmo uid
   em todo aparelho e em toda conta. O id da linha na nuvem era esse
   uid, e o id é único no banco inteiro: quando o atleta B marcava
   uma técnica que o atleta A já tinha marcado, a regra de segurança
   recusava (a linha era do A). Prova: SQL 53, 06/11/2026.

   Agora, nessas quatro tabelas, o id da linha é derivado da conta e
   do uid; o uid de verdade vai dentro dos dados e é ele que a
   descida usa. A regra de segurança não muda. As linhas antigas
   continuam valendo (são do próprio atleta e nada dessas tabelas é
   apagado, só arquivado): vence a versão mais nova, como sempre.
   ============================================================ */
const POR_CONTA = new Set(['positions', 'categories', 'techniques', 'attackPlans']);
export const idNaNuvem = (tabela, uid, userId) =>
  (tabela === TABELA_AJUSTES ? userId : POR_CONTA.has(tabela) ? uidEstavel(`registros:${userId}:${uid}`) : uid);

/* os itens da fila no formato da tabela registros. As configurações
   usam o id da conta como id do registro: um por pessoa. */
export function paraRegistros(itens, userId) {
  const idDe = (i) => idNaNuvem(i.tabela, i.uid, userId);
  const upserts = itens
    .filter((i) => i.op === 'upsert' && i.dados)
    .map((i) => ({
      id: idDe(i),
      user_id: userId,
      tabela: i.tabela,
      dados: limpar(i.dados),
      updated_at: new Date(i.updatedAt || Date.now()).toISOString(),
      deleted_at: null,
    }));
  const deletes = itens
    .filter((i) => i.op === 'delete')
    .map((i) => ({
      id: idDe(i),
      user_id: userId,
      tabela: i.tabela,
      dados: { uid: i.uid },
      updated_at: new Date(i.updatedAt || Date.now()).toISOString(),
      deleted_at: new Date().toISOString(),
    }));
  return [...upserts, ...deletes];
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

export async function aplicarLocal(linhas) {
  for (const linha of linhas) {
    const tabela = linha.tabela;
    if (tabela === TABELA_AJUSTES) { await aplicarAjustes(linha); continue; }
    if (!TABELAS_SYNC.includes(tabela) || !db[tabela]) continue;

    /* o uid do registro: o que veio nos dados (a linha da biblioteca tem
       id por conta); linha antiga sem ele usa o id */
    const uid = linha.dados?.uid || linha.id;
    const existente = await db[tabela].where('uid').equals(uid).first();

    if (linha.deleted_at) {
      if (existente) await db[tabela].delete(existente.id);
      continue;
    }

    const remotoEm = new Date(linha.updated_at).getTime();
    if (existente && (existente.updatedAt || 0) >= remotoEm) continue; // local é mais novo

    /* __local: grava sem voltar pra fila de envio (db.js). Sem isso,
       o que descia voltava a subir, e o ciclo não parava. */
    const registro = { ...linha.dados, uid, updatedAt: remotoEm, sincronizado: 1, __local: Math.random() };
    if (existente) {
      await db[tabela].update(existente.id, registro);
    } else {
      delete registro.id;
      await db[tabela].add(registro);
    }
  }
}

/* as configurações que vieram da nuvem: valem se forem mais novas que as
   do aparelho, e a tela é avisada pra recarregar (num celular novo, isso
   tira a pessoa do primeiro acesso) */
async function aplicarAjustes(linha) {
  if (linha.deleted_at) return;
  const local = (await db.meta.get('settings'))?.value || {};
  const remotoEm = new Date(linha.updated_at).getTime();
  /* aparelho virgem (ainda no primeiro acesso) aceita a nuvem mesmo com
     hora mais nova: ele só aceitou os termos, não configurou nada */
  const virgem = !local.onboardingFeito && linha.dados?.onboardingFeito;
  if (!virgem && (local.updatedAt || 0) >= remotoEm) return;
  const novo = { ...local, ...linha.dados, aceite: local.aceite || linha.dados?.aceite, updatedAt: Math.max(remotoEm, local.updatedAt || 0) };
  await db.meta.put({ key: 'settings', value: novo });
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('ajustes-da-nuvem', { detail: novo }));
  }
}

function limpar(obj) {
  const { id, sincronizado, __local, ...resto } = obj || {};
  return resto;
}

/* ---------- primeira migração: carimba tudo que já existe ---------- */
export async function migrarParaNuvem(tabelas = TABELAS_SYNC) {
  let total = 0;
  for (const tabela of tabelas) {
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

/* ============================================================
   SUBIR TUDO, TABELA POR TABELA

   A primeira subida corria uma vez por aparelho. Tabela que entrava
   no sync depois (pontos, em 14/09) nunca subia o que já existia,
   e quem reinstalava perdia. Agora o aparelho guarda quais tabelas
   já subiu inteiras e sobe as que faltam. Quem já tinha subido
   antes disto sobe tudo uma vez: é idempotente, o uid não duplica.
   ============================================================ */
export async function garantirNuvem() {
  /* as configurações de quem já usava o app sobem uma vez. Sem data de
     mudança, entram como mais antigas que qualquer outro aparelho, pra
     não passar por cima de configuração que já esteja na nuvem. */
  if (!(await db.meta.get('nuvem_ajustes'))?.value) {
    const s = (await db.meta.get('settings'))?.value;
    if (s) await enfileirarAjustes({ ...s, updatedAt: s.updatedAt || 1 });
    await db.meta.put({ key: 'nuvem_ajustes', value: true });
  }
  const feitas = new Set((await db.meta.get('nuvem_tabelas'))?.value || []);
  const faltam = TABELAS_SYNC.filter((t) => !feitas.has(t));
  if (!faltam.length) return sincronizar({ forcar: true });
  await migrarParaNuvem(faltam);
  await db.meta.put({ key: 'nuvem_tabelas', value: TABELAS_SYNC });
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
