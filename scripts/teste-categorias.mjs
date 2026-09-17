import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

import 'fake-indexeddb/auto';

/* ============================================================
   A CATEGORIZACAO AUTOMATICA BATE COM A DA MAO?

   O acervo tem 680 videos etiquetados um por um. A regra por
   palavra-chave so presta se reproduzir esse trabalho. Este
   teste roda a regra em cima do acervo inteiro e compara.

   O que ele cobra:
     nenhum tema pode marcar errado mais de 20% das vezes
     nenhum tema pode deixar passar mais da metade do que e dele
     video que nao bate com nada tem que levantar a mao, e a
     maioria desses ja estava como "geral" no acervo
   ============================================================ */

const { AULAS } = await import('../src/db/aulas.js');
const { categorizar, lerLinha, lerDuracao, idDoYoutube } = await import('../src/lib/categorizar.js');

let falhas = 0;
const ok = (nome, cond, detalhe = '') => {
  if (!cond) falhas++;
  console.log(`${cond ? 'ok   ' : 'FALHA'} ${nome}${detalhe ? ': ' + detalhe : ''}`);
};

/* ---------- leitura da linha colada ---------- */
const a = lerLinha('Como raspar na guarda laço #bjj | https://www.youtube.com/watch?v=qMr-tps8s70 | [2:07]');
ok('le titulo, link e duracao', a.id === 'qMr-tps8s70' && a.d === 127, `${a.id}, ${a.d}s`);
ok('classifica 2:07 como short', a.tipo === 'short');
ok('acha raspagem e guarda no titulo', a.temas.includes('raspagem') && a.temas.includes('guarda'), a.temas.join(','));
ok('acha a guarda laco como posicao', a.posicoes.includes('guarda_aberta'), a.posicoes.join(','));

ok('duracao em horas', lerDuracao('1:04:37') === 3877);
ok('duracao em segundos crus', lerDuracao('45') === 45);
ok('id de link de short', idDoYoutube('https://www.youtube.com/shorts/abc123XYZ') === 'abc123XYZ');
ok('linha sem link reclama', !!lerLinha('so um titulo | 2:00').erro);
ok('linha sem duracao reclama', !!lerLinha('titulo | https://youtu.be/abc123XYZ').erro);

const longo = lerLinha('COMO ESTUDAR JIU JITSU E EVOLUIR RAPIDO | https://youtu.be/CttYs7JsTOI | 54:26');
ok('classifica 54 min como aula', longo.tipo === 'aula');

const nada = categorizar('Oss #bjj #jiujitsu');
ok('titulo sem assunto levanta a mao', nada.precisaRevisar && nada.temas.length === 0);

/* ---------- o acervo inteiro ---------- */
const stat = {};
let identico = 0, semTema = 0, semTemaEraGeral = 0;

for (const v of AULAS) {
  const r = categorizar(v.t, v.d);
  const real = new Set(v.tm.filter((x) => x !== 'geral'));
  const prev = new Set(r.temas);

  for (const tm of new Set([...real, ...prev])) {
    stat[tm] = stat[tm] || { vp: 0, fp: 0, fn: 0 };
    if (real.has(tm) && prev.has(tm)) stat[tm].vp++;
    else if (prev.has(tm)) stat[tm].fp++;
    else stat[tm].fn++;
  }

  if (real.size === prev.size && [...real].every((x) => prev.has(x))) identico++;
  if (!prev.size) { semTema++; if (v.tm.includes('geral')) semTemaEraGeral++; }
}

const n = AULAS.length;
const pct = (x) => Math.round((x / n) * 100);

console.log(`\n${n} videos do acervo, comparando a regra com a etiqueta da mao\n`);
console.log(`  conjunto de temas identico:        ${identico} (${pct(identico)}%)`);
console.log(`  a regra nao achou tema:            ${semTema} (${pct(semTema)}%)`);
console.log(`     destes, ja eram "geral":        ${semTemaEraGeral} de ${semTema}\n`);

for (const [tm, s] of Object.entries(stat).sort((x, y) => (y[1].vp + y[1].fn) - (x[1].vp + x[1].fn))) {
  const acerto = s.vp + s.fp ? s.vp / (s.vp + s.fp) : 1;
  const cobre = s.vp + s.fn ? s.vp / (s.vp + s.fn) : 1;
  console.log(`  ${tm.padEnd(12)} acerto ${String(Math.round(acerto * 100)).padStart(3)}%  cobertura ${String(Math.round(cobre * 100)).padStart(3)}%`);
  ok(`  ${tm} marca errado menos de 20% das vezes`, acerto >= 0.8, `${Math.round(acerto * 100)}%`);
  ok(`  ${tm} cobre mais da metade do que e dele`, cobre >= 0.5, `${Math.round(cobre * 100)}%`);
}

ok('a maioria do que nao bateu ja era geral', semTemaEraGeral / Math.max(1, semTema) >= 0.75,
  `${Math.round(semTemaEraGeral / Math.max(1, semTema) * 100)}%`);

/* ============================================================
   DE ONDE VEM O ACERVO

   O acervo saiu do codigo e virou tabela. O que nao pode
   acontecer: o app abrir sem rede e ficar sem aula nenhuma.
   ============================================================ */
console.log('');
const { db } = await import('../src/db/db.js');
const { acervo, acervoLocal } = await import('../src/lib/acervo.js');

await db.open();
ok('sem copia local, vale o acervo que veio no codigo', acervo().length === AULAS.length,
  `${acervo().length} videos`);

await db.acervo.bulkPut([
  { id: 'novo1', t: 'Aula cadastrada pelo painel', d: 900, k: 'aula', tm: ['guarda'], p: [], atualizadoEm: '2026-01-01' },
  { id: 'novo2', t: 'Short cadastrado pelo painel', d: 60, k: 'short', tm: ['defesa'], p: [], atualizadoEm: '2026-01-01' },
]);
await acervoLocal();
ok('com copia local, o app passa a ler dela', acervo().length === 2, `${acervo().length} videos`);
ok('o formato curto das telas foi mantido', acervo()[0].t && acervo()[0].k && Array.isArray(acervo()[0].tm));

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
