import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

import 'fake-indexeddb/auto';

/* ============================================================
   OS LIMITES DO PLANO GRATUITO

   A conta de "quantos disto você já fez hoje" é o que decide se
   a tela trava. Errar essa conta é pior que não ter limite: ou
   trava quem pagou, ou não trava ninguém.

   O que este teste protege:
     o limite é do dia, então o de ontem não pode contar
     rever vídeo antigo ocupa o vídeo do dia do mesmo jeito
     aula e short contam separado
     ponto de treino não pode ser confundido com ponto de quiz
   ============================================================ */

const { db } = await import('../src/db/db.js');
const { usadoHoje, LIMITES } = await import('../src/lib/plano.js');

const hoje = new Date().toISOString().slice(0, 10);
const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = real === esperado;
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${real} (esperado ${esperado})`);
};

await db.open();

await db.rolls.add({ data: hoje, sessionId: 1 });
await db.rolls.add({ data: ontem, sessionId: 2 });
ok('rola de hoje conta, o de ontem nao', await usadoHoje('rola'), 1);

await db.aulasVistas.add({ videoId: 'a1', tipo: 'aula', data: hoje, ultima: hoje });
await db.aulasVistas.add({ videoId: 's1', tipo: 'short', data: hoje, ultima: hoje });
ok('aula vista hoje', await usadoHoje('aula'), 1);
ok('short nao entra na conta de aula', await usadoHoje('short'), 1);

await db.aulasVistas.add({ videoId: 'a2', tipo: 'aula', data: ontem, ultima: hoje });
ok('rever aula antiga hoje conta', await usadoHoje('aula'), 2);

await db.aulasVistas.add({ videoId: 'a3', tipo: 'aula', data: ontem, ultima: ontem });
ok('aula so de ontem nao conta', await usadoHoje('aula'), 2);

await db.pontos.add({ evento: 'quizAcerto', data: hoje, xp: 10 });
await db.pontos.add({ evento: 'quizErro', data: hoje, xp: 3 });
await db.pontos.add({ evento: 'treino', data: hoje, xp: 20 });
await db.pontos.add({ evento: 'quizAcerto', data: ontem, xp: 10 });
ok('quiz de hoje conta 2, treino nao entra', await usadoHoje('quiz'), 2);

console.log(
  `\nlimites do gratuito: rola ${LIMITES.rolasPorDia}, aula ${LIMITES.aulasPorDia}, ` +
  `short ${LIMITES.shortsPorDia}, quiz ${LIMITES.perguntasPorDia}, recomendacao ${LIMITES.recomendacoesAbertas}`
);
console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
