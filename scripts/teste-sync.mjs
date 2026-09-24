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

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
