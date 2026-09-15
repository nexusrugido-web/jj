import Dexie from 'dexie';
import { SEED } from './seed';
import { PLANOS_ATAQUE } from './attackPlans';
import { uidEstavel, chaveNome } from '../lib/uid';

export const db = new Dexie('tatame_os');

/* tabelas que sincronizam com a nuvem */
export const TABELAS_SYNC = [
  'positions', 'categories', 'techniques', 'partners', 'sessions', 'rolls',
  'goals', 'reviews', 'gameplans',
  'injuries', 'competitions',
  'attackPlans', 'gradings', 'milestones', 'media',
  'academies', 'professors',
  'aulasVistas', 'quizRespostas', 'pontos',
  'recFeitas',
];

/* v1, original */
db.version(1).stores({
  meta: 'key',
  positions: '++id, nome, familia, ordem, arquivada',
  categories: '++id, nome, ordem, arquivada',
  techniques: '++id, nome, categoriaId, origemId, destinoId, status, favorita, arquivada',
  partners: '++id, nome, faixa, arquivada',
  sessions: '++id, data, tipo, arquivada',
  rolls: '++id, sessionId, partnerId, data',
  goals: '++id, status, tipo, prazo, ordem',
  reviews: '++id, techniqueId, proxima, box',
  gameplans: '++id, nome, posicaoId, ordem, arquivada',
  breathProtocols: '++id, nome, ordem, arquivada',
  breathLogs: '++id, data, protocoloId',
  exercises: '++id, nome, grupo, arquivada',
  physical: '++id, data, tipo',
  injuries: '++id, data, regiao, status',
  competitions: '++id, data',
  notes: '++id, data, pin',
  customFields: '++id, entidade, ordem',
});

/* v2, nuvem, mídia, nutrição, academia, graduação, marcos */
db.version(2).stores({
  meta: 'key',
  outbox: '++id, uid, tabela, criadoEm',

  positions: '++id, uid, nome, familia, ordem, arquivada, updatedAt',
  categories: '++id, uid, nome, ordem, arquivada, updatedAt',
  techniques: '++id, uid, nome, categoriaId, origemId, destinoId, status, favorita, arquivada, updatedAt',
  partners: '++id, uid, nome, faixa, arquivada, updatedAt',
  sessions: '++id, uid, data, tipo, arquivada, updatedAt',
  rolls: '++id, uid, sessionId, partnerId, data, updatedAt',
  goals: '++id, uid, status, tipo, escopo, prazo, ordem, updatedAt',
  reviews: '++id, uid, techniqueId, proxima, box, updatedAt',
  gameplans: '++id, uid, nome, posicaoId, ordem, arquivada, updatedAt',
  breathProtocols: '++id, uid, nome, ordem, arquivada, updatedAt',
  breathLogs: '++id, uid, data, protocoloId, updatedAt',
  exercises: '++id, uid, nome, grupo, arquivada, updatedAt',
  physical: '++id, uid, data, tipo, updatedAt',
  injuries: '++id, uid, data, regiao, status, updatedAt',
  competitions: '++id, uid, data, updatedAt',
  notes: '++id, uid, data, pin, updatedAt',
  customFields: '++id, uid, entidade, ordem, updatedAt',

  attackPlans: '++id, uid, nome, faixa, posicao, modo, favorito, arquivada, updatedAt',
  gradings: '++id, uid, data, tipo, faixa, updatedAt',
  milestones: '++id, uid, chave, data, updatedAt',
  media: '++id, uid, tipo, vinculoTipo, vinculoId, data, updatedAt',
  foods: '++id, uid, nome, grupo, arquivada, updatedAt',
  meals: '++id, uid, data, refeicao, updatedAt',
  dietPlans: '++id, uid, nome, ativo, arquivada, updatedAt',
  gymPrograms: '++id, uid, nome, ativo, arquivada, updatedAt',
  gymLogs: '++id, uid, data, programaId, updatedAt',
  supplements: '++id, uid, nome, ativo, updatedAt',
});

/* v3, academias e professores */
db.version(3).stores({
  academies: '++id, uid, nome, arquivada, updatedAt',
  professors: '++id, uid, nome, academiaId, arquivada, updatedAt',
});

/* v4: estudo, quiz e pontos */
db.version(4).stores({
  aulasVistas: '++id, uid, videoId, data, tipo, updatedAt',
  quizRespostas: '++id, uid, perguntaId, acertou, data, caixa, proxima, updatedAt',
  pontos: '++id, uid, evento, xp, refId, data, semana, updatedAt',
});

/* v5: musculação. As tabelas ficam declaradas porque apagar
   uma versão antiga quebraria a migração de quem instalou nessa
   época. Ninguém escreve nelas desde que o registro de treino
   de academia saiu, e por isso também não sincronizam. */
db.version(5).stores({
  mscTreinos: '++id, uid, data, updatedAt',
  mscSeries: '++id, uid, treinoId, exercicioId, data, updatedAt',
});

/* v6: fechar o laço da recomendação */
db.version(6).stores({
  recFeitas: '++id, uid, chave, intencao, alvo, data, resultado, updatedAt',
});

/* ---------- hooks: carimba uid/updatedAt e alimenta a fila de sync ---------- */
let enfileirarRef = null;
export function registrarSync(fn) { enfileirarRef = fn; }

for (const nome of TABELAS_SYNC) {
  const tabela = db.table(nome);

  tabela.hook('creating', function (pk, obj) {
    if (!obj.uid) obj.uid = crypto.randomUUID();
    if (!obj.updatedAt) obj.updatedAt = Date.now();
    const snap = { ...obj };
    this.onsuccess = (chave) => enfileirarRef?.(nome, 'upsert', { ...snap, id: chave });
  });

  tabela.hook('updating', function (mods, pk, obj) {
    if (mods.__local) return;
    const uid = obj.uid || crypto.randomUUID();
    const updatedAt = Date.now();
    const novo = { ...obj, ...mods, uid, updatedAt };
    this.onsuccess = () => enfileirarRef?.(nome, 'upsert', novo);
    return { ...mods, uid, updatedAt };
  });

  tabela.hook('deleting', function (pk, obj) {
    const uid = obj?.uid;
    if (uid) this.onsuccess = () => enfileirarRef?.(nome, 'delete', { uid, updatedAt: Date.now() });
  });
}

/* ---------- meta ---------- */
export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key);
  return row === undefined ? fallback : row.value;
}
export async function setMeta(key, value) {
  await db.meta.put({ key, value });
  return value;
}

export const DEFAULT_SETTINGS = {
  nome: '', faixa: 'branca', graus: 0, academia: '', professor: '',
  academiaPadraoId: null, professorPadraoId: null, estiloDeclarado: null, quizDispensado: 0,
  objetivo: 'lazer', sugestoesDispensadas: [], tourVisto: 0, onboardingFeito: 0,
  pesoKg: '', alturaCm: '', idade: '', sexo: 'm',
  atividade: 1.725, objetivo: 'manter',
  inicioTreino: '', acento: 'roar',
  metaSemanal: 4, metaAnualHoras: 200, duracaoRolaPadrao: 5,
  mostrarNoDash: {
    escada: true, heat: true, metas: true, revisao: true,
    finalizacoes: true, parceiros: true, dominio: true,
  },
  iaLigada: true, celebrar: true,
};

/* ---------- seed ---------- */
export async function ensureSeed() {
  const v1 = await getMeta('seeded_v1', false);
  if (!v1) {
    await db.transaction('rw',
      [db.positions, db.categories, db.techniques, db.breathProtocols, db.exercises, db.meta],
      async () => {
        const posMap = {};
        for (const p of SEED.positions) posMap[p.slug] = await db.positions.add({ ...p, uid: uidEstavel(chaveNome('positions', p.nome)), arquivada: 0, criadoEm: Date.now() });
        const catMap = {};
        for (const c of SEED.categories) catMap[c.slug] = await db.categories.add({ ...c, uid: uidEstavel(chaveNome('categories', c.nome)), arquivada: 0, criadoEm: Date.now() });
        for (const t of SEED.techniques) {
          await db.techniques.add({
            uid: uidEstavel(chaveNome('techniques', t.pt)),
            nome: t.pt, nomeEn: t.en || '',
            categoriaId: catMap[t.cat] ?? null,
            origemId: posMap[t.from] ?? null,
            destinoId: posMap[t.to] ?? null,
            modo: t.modo || 'ambos',
            faixaMin: t.faixaMin || 'branca',
            restricao: t.restricao || '',
            nomeJp: t.nomeJp || '',
            nivelSugerido: t.nivel_sugerido || '',
            status: 'nao_iniciada', nivel: 0, favorita: 0,
            tags: t.tags || [], video: '', detalhes: '',
            arquivada: 0, criadoEm: Date.now(),
          });
        }
        for (const b of SEED.breathProtocols) await db.breathProtocols.add({ ...b, uid: uidEstavel(chaveNome('breathProtocols', b.nome)), arquivada: 0, criadoEm: Date.now() });
        for (const e of SEED.exercises) await db.exercises.add({ ...e, uid: uidEstavel(chaveNome('exercises', e.nome)), arquivada: 0, criadoEm: Date.now() });
        await db.meta.put({ key: 'settings', value: DEFAULT_SETTINGS });
        await db.meta.put({ key: 'seeded_v1', value: true });
      });
  }

  /* v3: quem já tinha o app instalado ficou com a biblioteca antiga.
     Aqui completamos com as técnicas que faltam, sem tocar no que ele editou. */
  const v5 = await getMeta('seeded_v5', false);
  if (v5 !== true) {
    const existentes = new Set(
      (await db.techniques.toArray()).map((t) =>
        String(t.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase())
    );
    /* cria as categorias e posições que passaram a existir depois */
    const cats = await db.categories.toArray();
    const catPorSlug = Object.fromEntries(cats.filter((c) => c.slug).map((c) => [c.slug, c.id]));
    for (const c of SEED.categories) {
      if (catPorSlug[c.slug]) continue;
      catPorSlug[c.slug] = await db.categories.add({
        ...c, uid: uidEstavel(chaveNome('categories', c.nome)), arquivada: 0, criadoEm: Date.now(),
      });
    }

    const posicoes = await db.positions.toArray();
    const posPorSlug = Object.fromEntries(posicoes.filter((p) => p.slug).map((p) => [p.slug, p.id]));
    for (const p of SEED.positions) {
      if (posPorSlug[p.slug]) continue;
      posPorSlug[p.slug] = await db.positions.add({
        ...p, uid: uidEstavel(chaveNome('positions', p.nome)), arquivada: 0, criadoEm: Date.now(),
      });
    }

    let novas = 0;
    for (const t of SEED.techniques) {
      const chave = String(t.pt).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      if (existentes.has(chave)) continue;
      await db.techniques.add({
        uid: uidEstavel(chaveNome('techniques', t.pt)),
        nome: t.pt, nomeEn: t.en || '',
        categoriaId: catPorSlug[t.cat] ?? null,
        origemId: posPorSlug[t.from] ?? null,
        destinoId: posPorSlug[t.to] ?? null,
        modo: t.modo || 'ambos',
        faixaMin: t.faixaMin || 'branca',
        restricao: t.restricao || '',
        nomeJp: t.nomeJp || '',
        nivelSugerido: t.nivel_sugerido || '',
        status: 'nao_iniciada', nivel: 0, favorita: 0,
        tags: t.tags || [], video: '', detalhes: '',
        arquivada: 0, criadoEm: Date.now(),
      });
      novas++;
    }
    await db.meta.put({ key: 'seeded_v5', value: true });
    if (novas) console.info(`[seed] ${novas} técnicas novas adicionadas à biblioteca`);
  }

  const v2 = await getMeta('seeded_v2', false);
  if (!v2) {
    for (const p of PLANOS_ATAQUE) await db.attackPlans.add({ ...p, uid: uidEstavel(chaveNome('attackPlans', p.slug)), favorito: 0, arquivada: 0, pronto: 1, criadoEm: Date.now() });
    await db.meta.put({ key: 'seeded_v2', value: true });
  }
}

/* ---------- renomeia o que mudou de nome ----------
   O nome já foi corrigido no seed, mas quem instalou antes
   continua com o antigo gravado no banco. */
const RENOMEAR = [
  ['Cem quilos (por cima)', 'Controle lateral, 100kg'],   // lint-copy-ok
  ['Cem quilos (por baixo)', 'Controle lateral sofrido, 100kg'], // lint-copy-ok
  ['100kg (por cima)', 'Controle lateral, 100kg'],
  ['Sob os cem quilos', 'Controle lateral sofrido, 100kg'], // lint-copy-ok
  ['Sob os 100kg', 'Controle lateral sofrido, 100kg'],
  ['Pegada nas costas', 'Controle das costas'],
  ['Kesa gatame', 'Gravata, kesa gatame'],
  ['X-guard', 'Guarda X'],
  ['Single leg X', 'Guarda X simples'],
  ['Saddle / 411', 'Enrosco interno, 411'],
  ['Z-guard / knee shield', 'Escudo de joelho, z-guard'],
  ['Tartaruga (quatro apoios)', 'Tartaruga'],
  ['Combatendo a guarda (por cima)', 'Combatendo a guarda, por cima'],
  ['Meia-guarda por cima', 'Meia-guarda, por cima'],
  ['Clinch / pegada em pé', 'Clinch, pegada em pé'],
  ['Chave de braço (armlock)', 'Chave de braço, armlock'],
  ['Katagatame (braço-cabeça)', 'Katagatame, braço e cabeça'],
  ['Passagem em toureio', 'Passagem toureando'],
];

/* qualquer falha aqui custa o histórico da pessoa, então
   vale saber exatamente onde quebrou */
async function reportar(erro, onde) {
  try {
    const m = await import('../lib/monitor');
    m.registrarErro(erro, { tipo: 'banco', onde, versao: db.verno });
  } catch { console.error('[banco]', onde, erro); }
}

export async function renomearAntigos() {
  let n = 0;
  try {
  for (const tabela of ['positions', 'categories', 'techniques', 'attackPlans']) {
    if (!db[tabela]) continue;
    const linhas = await db[tabela].toArray();
    for (const l of linhas) {
      let nome = l.nome;
      let posicao = l.posicao;
      let mudou = false;
      for (const [de, para] of RENOMEAR) {
        /* só troca quando o nome inteiro bate. Trocar por pedaço
           estragaria "Chave de braço dos 100kg". */
        if (nome === de) { nome = para; mudou = true; }
        if (posicao === de) { posicao = para; mudou = true; }
      }
      if (mudou) {
        const patch = { nome };
        if (l.posicao !== undefined) patch.posicao = posicao;
        await db[tabela].update(l.id, patch);
        n++;
      }
    }
  }
    return n;
  } catch (e) {
    await reportar(e, 'renomearAntigos');
    return n;
  }
}

/* ---------- resgate dos game plans da v1 ----------
   A tela antiga de Game Plan virou "Planos de ataque" e mudou de tabela.
   Quem tinha planos criados na v1 ficaria com eles presos e invisíveis. */
export async function migrarGameplans() {
  const antigos = await db.gameplans.toArray();
  if (!antigos.length) return 0;

  const posicoes = await db.positions.toArray();
  const nomePos = Object.fromEntries(posicoes.map((p) => [p.id, p.nome]));
  const jaTem = new Set((await db.attackPlans.toArray()).map((p) => (p.nome || '').toLowerCase()));

  let n = 0;
  for (const g of antigos) {
    if (jaTem.has((g.nome || '').toLowerCase())) { await db.gameplans.delete(g.id); continue; }
    await db.attackPlans.add({
      nome: g.nome || 'Plano sem nome',
      faixa: 'branca',
      posicao: nomePos[g.posicaoId] || '',
      modo: 'ambos',
      tipo: g.tipo === 'defesa' ? 'defesa' : 'ataque',
      resumo: g.notas || '',
      aviso: '',
      legal: true,
      passos: (g.ramos || []).map((r) => ({
        gatilho: r.gatilho || '', acao: r.acao || '',
        seFalhar: r.seFalhar || '', proxima: '', detalhe: '',
      })),
      favorito: 0, arquivada: 0, pronto: 0,
      criadoEm: g.criadoEm || Date.now(),
    });
    await db.gameplans.delete(g.id);
    n++;
  }
  return n;
}

/* ---------- limpeza de duplicados ----------
   Conserta bibliotecas que duplicaram (celular semeou um conjunto,
   computador outro, e o sync baixou os dois). Roda no boot, é barato
   quando não há nada pra limpar. */
export async function limparDuplicados() {
  const chaveDe = (l) => String(l.slug || l.nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  async function dedupe(tabela) {
    if (!db[tabela]) return new Map();
    const linhas = (await db[tabela].toArray()).sort((a, b) => a.id - b.id);
    const vistos = new Map();
    const remap = new Map();
    const apagar = [];
    for (const l of linhas) {
      const k = chaveDe(l);
      if (!k) continue;
      if (vistos.has(k)) { remap.set(l.id, vistos.get(k)); apagar.push(l.id); }
      else vistos.set(k, l.id);
    }
    if (apagar.length) await db[tabela].bulkDelete(apagar);
    return remap;
  }

  const rePos = await dedupe('positions');
  const reCat = await dedupe('categories');
  await dedupe('techniques');
  await dedupe('attackPlans');
  await dedupe('gymPrograms');
  await dedupe('breathProtocols');
  await dedupe('exercises');

  const total = rePos.size + reCat.size;

  // aponta as referências antigas para o registro que sobreviveu
  if (rePos.size || reCat.size) {
    const tecs = await db.techniques.toArray();
    for (const t of tecs) {
      const patch = {};
      if (rePos.has(t.origemId)) patch.origemId = rePos.get(t.origemId);
      if (rePos.has(t.destinoId)) patch.destinoId = rePos.get(t.destinoId);
      if (reCat.has(t.categoriaId)) patch.categoriaId = reCat.get(t.categoriaId);
      if (Object.keys(patch).length) await db.techniques.update(t.id, patch);
    }
  }
  if (rePos.size) {
    const rls = await db.rolls.toArray();
    for (const r of rls) {
      const arruma = (arr) => [...new Set((arr || []).map((id) => rePos.get(id) ?? id))];
      const dom = arruma(r.posDominadas);
      const inf = arruma(r.posSofridas);
      const mudou = JSON.stringify(dom) !== JSON.stringify(r.posDominadas || []) ||
                    JSON.stringify(inf) !== JSON.stringify(r.posSofridas || []);
      if (mudou) await db.rolls.update(r.id, { posDominadas: dom, posSofridas: inf });
    }
  }
  return total;
}

/* ---------- export / import ---------- */
const TABLES = ['meta', ...TABELAS_SYNC];

export async function exportAll() {
  const dump = { app: 'tatame-os', versao: 2, exportadoEm: new Date().toISOString(), dados: {} };
  for (const t of TABLES) { if (db[t]) dump.dados[t] = await db[t].toArray(); }
  return dump;
}

export async function importAll(dump, { substituir = false } = {}) {
  if (!dump || !dump.dados) throw new Error('Arquivo inválido: não encontrei o campo "dados".');
  const tabelas = TABLES.filter((t) => db[t]);
  await db.transaction('rw', tabelas.map((t) => db[t]), async () => {
    for (const t of tabelas) {
      if (!dump.dados[t]) continue;
      if (substituir) await db[t].clear();
      await db[t].bulkPut(dump.dados[t]);
    }
  });
}

export async function wipeAll() {
  const tabelas = [...TABLES, 'outbox'].filter((t) => db[t]);
  await db.transaction('rw', tabelas.map((t) => db[t]), async () => {
    for (const t of tabelas) await db[t].clear();
  });
}

export function toCSV(rows, colunas) {
  if (!rows.length) return '';
  const cols = colunas || Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = Array.isArray(v) ? v.join('|') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
