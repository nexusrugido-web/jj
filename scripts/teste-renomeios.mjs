import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

import 'fake-indexeddb/auto';

/* ============================================================
   OS NOMES NOVOS DAS TÉCNICAS

   "Solo (single leg)" virou "Single leg", "Estrangulamento de laço
   (bow and arrow)" virou "Arco e flecha". A troca não pode perder
   nada: o histórico passa pro nome novo, o uid não muda (as aulas
   do Estudo e a nuvem continuam ligadas) e o nome velho ainda acha
   a técnica.
   ============================================================ */
const { db, renomearTecnicas } = await import('../src/db/db.js');
const { RENOMEAR } = await import('../src/db/renomeios.js');
const { SEED } = await import('../src/db/seed.js');
const { CATALOGO_TECNICAS, INDICE_TECNICAS } = await import('../src/lib/tecnicas.js');
const { acharTecnicas } = await import('../src/lib/classificar.js');
const { uidEstavel, chaveNome } = await import('../src/lib/uid.js');
const { sementeIntacta } = await import('../src/lib/sync.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

/* ---------- a biblioteca ---------- */
const nomes = SEED.techniques.map((t) => t.pt);
ok('nenhum nome antigo sobrou na biblioteca', Object.keys(RENOMEAR).filter((k) => nomes.includes(k) && !Object.values(RENOMEAR).includes(k)), []);
ok('ninguém mais chama single leg de "Solo"', nomes.filter((n) => /^Solo\b|de solo/i.test(n)), []);
ok('arco e flecha com o nome do tatame', nomes.includes('Arco e flecha (bow and arrow)'), true);
const single = CATALOGO_TECNICAS.find((t) => t.nome === 'Single leg');
ok('o uid continua o do nome antigo (as aulas seguem ligadas)', single.uid, uidEstavel(chaveNome('techniques', 'Solo (single leg)')));
ok('o nome antigo ainda acha a técnica', acharTecnicas(['Solo (single leg)'], INDICE_TECNICAS), [single.uid]);
ok('o nome novo acha a mesma técnica', acharTecnicas(['Single leg'], INDICE_TECNICAS), [single.uid]);

/* ---------- o que já estava gravado no aparelho ---------- */
await db.techniques.add({ nome: 'Solo (single leg)', uid: uidEstavel(chaveNome('techniques', 'Solo (single leg)')), arquivada: 0, criadoEm: Date.now(), __local: 1 });
const sid = await db.sessions.add({ data: '2026-09-10', focoTecnicas: [{ nome: 'Estrangulamento de laço (bow and arrow)', aprendizado: 'peguei' }] });
await db.rolls.add({ sessionId: sid, subsAplicadas: ['Chave de braço, armlock', 'Americana'], subsSofridas: ['Katagatame, braço e cabeça'],
  tecMeus: { queda: ['Solo (single leg)'], raspagem: ['Raspagem de gancho (hip bump)'] }, tecDele: {} });
await db.goals.add({ tipo: 'tecnica', alvo: 'Chave de pé reta', status: 'ativa' });
await renomearTecnicas();

const tec = await db.techniques.where('uid').equals(uidEstavel(chaveNome('techniques', 'Solo (single leg)'))).first();
ok('a técnica guardada ganha o nome novo e mantém o uid', tec.nome, 'Single leg');
ok('a biblioteca renomeada continua sendo biblioteca (não sobe pra nuvem)', sementeIntacta('techniques', { ...tec, updatedAt: tec.criadoEm }), true);
ok('o treino troca o nome da técnica da aula', (await db.sessions.get(sid)).focoTecnicas[0].nome, 'Arco e flecha (bow and arrow)');
const rola = (await db.rolls.toArray())[0];
ok('as finalizações do rola trocam de nome', [rola.subsAplicadas, rola.subsSofridas], [['Chave de braço (armlock)', 'Americana'], ['Katagatame (triângulo de braço)']]);
ok('as técnicas dos pontos trocam de nome', rola.tecMeus, { queda: ['Single leg'], raspagem: ['Raspagem de sentar (hip bump)'] });
ok('a meta troca o alvo', (await db.goals.toArray())[0].alvo, 'Chave de pé reta (botinha)');

await db.techniques.update(tec.id, { nome: 'Solo (single leg)' });
await renomearTecnicas();
ok('roda uma vez só', (await db.techniques.get(tec.id)).nome, 'Solo (single leg)');

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
