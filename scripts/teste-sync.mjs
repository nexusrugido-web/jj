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

/* ---------- trocar de celular: o aparelho A sobe, o B recupera ----------
   (a nuvem aqui é a lista de linhas que iria pra tabela registros) */
const { paraRegistros, aplicarLocal } = await import('../src/lib/sync.js');
const T = Date.parse('2026-09-30T20:00:00Z');
const doA = [
  { tabela: 'settings', op: 'upsert', uid: 'settings', updatedAt: T,
    dados: { nome: 'Batista', anoNascimento: 1995, metaSemanal: 5, metaAnualHorasModo: 'manual', metaAnualHoras: 150, onboardingFeito: 1, tecnicasLiberadas: ['Heel hook'], updatedAt: T } },
  { tabela: 'goals', op: 'upsert', uid: 'g-americana', updatedAt: T, dados: { uid: 'g-americana', tipo: 'defesa', alvo: 'Americana', status: 'ativa', origem: 'usuario' } },
  { tabela: 'injuries', op: 'upsert', uid: 'l-joelho', updatedAt: T, dados: { uid: 'l-joelho', regiao: 'Joelho', impacto: 'parado', status: 'ativa', data: '2026-09-28' } },
];
const nuvem = paraRegistros(doA, 'conta-1');
ok('as configurações vão num registro só, com o id da conta', nuvem.filter((l) => l.tabela === 'settings').map((l) => l.id), ['conta-1']);

/* o aparelho B, zerado */
await db.goals.clear(); await db.injuries.clear();
await db.meta.put({ key: 'settings', value: { nome: '', onboardingFeito: 0 } });
await aplicarLocal(nuvem);
const ajustesB = (await db.meta.get('settings')).value;
ok('o celular novo recupera as configurações (ano, meta de horas, liberadas, primeiro acesso feito)',
  [ajustesB.anoNascimento, ajustesB.metaAnualHorasModo, ajustesB.metaAnualHoras, ajustesB.tecnicasLiberadas, ajustesB.onboardingFeito], [1995, 'manual', 150, ['Heel hook'], 1]);
ok('o celular novo recupera a meta e a lesão', [(await db.goals.toArray()).map((g) => g.alvo), (await db.injuries.toArray()).map((l) => l.regiao)], [['Americana'], ['Joelho']]);
await aplicarLocal(nuvem);
ok('sincronizar de novo não duplica nada', [await db.goals.count(), await db.injuries.count()], [1, 1]);

/* celular novo que acabou de aceitar os termos (hora mais nova) ainda recebe a nuvem */
await db.meta.put({ key: 'settings', value: { aceite: { versao: 'nova' }, onboardingFeito: 0, updatedAt: T + 999999 } });
await aplicarLocal(nuvem);
const virgem = (await db.meta.get('settings')).value;
ok('celular novo no primeiro acesso recebe as configurações da nuvem e guarda o aceite que acabou de dar',
  [virgem.onboardingFeito, virgem.anoNascimento, virgem.aceite.versao], [1, 1995, 'nova']);

/* o aparelho mudou depois: a versão da nuvem, mais velha, não passa por cima */
await db.meta.put({ key: 'settings', value: { ...ajustesB, metaAnualHoras: 180, updatedAt: T + 60000 } });
await aplicarLocal(nuvem);
ok('configuração mais nova no aparelho não é sobrescrita pela mais velha da nuvem', (await db.meta.get('settings')).value.metaAnualHoras, 180);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
