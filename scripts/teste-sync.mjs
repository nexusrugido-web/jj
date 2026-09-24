import { register } from 'node:module';
import 'fake-indexeddb/auto';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   O QUE VAI PRA NUVEM, E O QUE NÃO VAI

   Três regras da sincronização, que se quebradas gastam o plano
   grátis do Supabase e podem apagar dado de aluno:

   1. o que veio da nuvem não volta pra fila de envio. Antes, todo
      registro baixado era reenviado, o servidor carimbava a hora,
      o aparelho baixava de novo, e o ciclo não parava nunca;
   2. a biblioteca que o próprio aparelho cria (posições, categorias,
      técnicas) não sobe: ela é igual em todo aparelho. Antes, um
      aparelho novo subia as 626 técnicas "zeradas" com hora de
      agora, por cima do que o aluno tinha marcado no outro;
   3. o que o aluno cria ou muda sobe, sempre.
   ============================================================ */

const { db, ensureSeed, registrarSync } = await import('../src/db/db.js');
const { sementeIntacta } = await import('../src/lib/sync.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

const fila = [];
registrarSync((tabela, op, reg) => fila.push({ tabela, op, uid: reg.uid }));

await ensureSeed();
ok('a biblioteca criada no aparelho não entra na fila', fila.filter((x) => ['positions', 'categories', 'techniques', 'attackPlans'].includes(x.tabela)).length, 0);

/* a atualização que completa a biblioteca (seeded_v5) também não sobe */
const umaTecnica = await db.techniques.orderBy('id').last();
await db.techniques.delete(umaTecnica.id);
await db.meta.put({ key: 'seeded_v5', value: false });
fila.length = 0;
await ensureSeed();
ok('técnica que a atualização repõe não entra na fila', fila.filter((x) => x.op === 'upsert').length, 0);
const plano = await db.attackPlans.orderBy('id').first();
ok('plano de ataque que vem pronto é semente', sementeIntacta('attackPlans', plano), true);

const tec = await db.techniques.orderBy('id').first();
ok('técnica da biblioteca, intocada, é reconhecida como semente', sementeIntacta('techniques', tec), true);

/* o que vem da nuvem: grava sem voltar pra fila */
fila.length = 0;
await db.techniques.update(tec.id, { status: 'aprendendo', updatedAt: Date.now() + 5000, sincronizado: 1, __local: Math.random() });
await db.partners.add({ nome: 'Veio da nuvem', uid: 'p-nuvem', updatedAt: Date.now(), sincronizado: 1, __local: Math.random() });
ok('registro baixado não volta pra fila (nem editado, nem novo)', fila.length, 0);
const gravada = await db.techniques.get(tec.id);
ok('o que veio da nuvem fica gravado', gravada.status, 'aprendendo');
const parceiroNuvem = await db.partners.where('uid').equals('p-nuvem').first();
ok('registro novo que veio da nuvem não guarda a marca', '__local' in parceiroNuvem, false);

/* o que o aluno faz: sobe */
fila.length = 0;
await db.techniques.update(tec.id, { favorita: 1 });
await db.partners.add({ nome: 'Brabo' });
await db.partners.update(parceiroNuvem.id, { ...parceiroNuvem, nome: 'Renomeado' });
/* editar copiando o registro inteiro, marca junto, ainda sobe */
await db.techniques.update(tec.id, { ...(await db.techniques.get(tec.id)), detalhes: 'anotei' });
ok('edição e criação do aluno entram na fila', fila.map((x) => x.tabela), ['techniques', 'partners', 'partners', 'techniques']);
ok('técnica que o aluno mexeu deixa de ser semente', sementeIntacta('techniques', await db.techniques.get(tec.id)), false);

/* ---------- treinos repetidos pelo toque duplo no salvar ---------- */
const { limparTreinosRepetidos } = await import('../src/db/db.js');
await db.sessions.clear(); await db.rolls.clear(); await db.pontos.clear();
const t0 = Date.now() - 86400000;
const treino = { data: '2026-09-24', tipo: 'gi', duracao: 60, academiaId: 1, professorId: 1, nota: '' };
const criar = async (criadoEm, extra = {}) => {
  const id = await db.sessions.add({ ...treino, ...extra, criadoEm });
  await db.rolls.add({ sessionId: id, partnerId: 2, subsSofridas: ['Americana'], data: treino.data });
  await db.pontos.add({ evento: 'rola', xp: 12, refId: `rola:${id}:0`, data: treino.data });
  return id;
};
const primeiro = await criar(t0);
await criar(t0 + 60000);
await criar(t0 + 120000);
const tarde = await criar(t0 + 3 * 3600000);
const outro = await criar(t0 + 180000, { duracao: 90 });
const apagados = await limparTreinosRepetidos();
ok('toque duplo: sai só o repetido em minutos', [apagados, (await db.sessions.toArray()).map((s) => s.id)], [2, [primeiro, tarde, outro]]);
ok('os rolas e os pontos dos repetidos saem junto', [await db.rolls.count(), await db.pontos.count()], [3, 3]);
ok('rodar de novo não apaga mais nada', await limparTreinosRepetidos(), 0);

/* ---------- subir tudo, tabela por tabela ----------
   (sem Supabase no teste, a fila fica vazia: o que se confere é o registro
   de quais tabelas o aparelho já subiu inteiras) */
const { garantirNuvem } = await import('../src/lib/sync.js');
const { TABELAS_SYNC } = await import('../src/db/db.js');
await db.meta.put({ key: 'nuvem_tabelas', value: ['sessions'] });
await garantirNuvem();
ok('aparelho que subiu só parte das tabelas passa a ter todas', (await db.meta.get('nuvem_tabelas')).value, TABELAS_SYNC);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
