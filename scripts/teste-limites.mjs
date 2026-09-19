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
const { trechoValido, ondePodeVoltar } = await import('../src/lib/aulas.js');

const { hoje: diaDeHoje, addDias } = await import('../src/lib/utils.js');
const hoje = diaDeHoje();
const ontem = addDias(hoje, -1);

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

/* ============================================================
   ARRASTAR A BARRA NAO CONTA COMO ASSISTIR

   Sem isto, dava pra abrir uma aula de meia hora, jogar a barra
   pro fim e marcar como vista. O ponto de estudo viraria um
   ponto de clique.
   ============================================================ */
console.log('');
ok('um segundo normal soma um segundo', trechoValido(10, 11, 1), 1);
ok('assistir em 2x soma os dois segundos', trechoValido(10, 12, 2), 2);
ok('rede travada, passo de 1.5s ainda soma', trechoValido(10, 11.5, 1), 1.5);
ok('pulo de 5 minutos pra frente nao soma', trechoValido(10, 310, 1), 0);
ok('pulo curto pra frente nao soma', trechoValido(10, 14, 1), 0);
ok('voltar a barra nao soma', trechoValido(300, 10, 1), 0);
ok('parado no mesmo lugar nao soma', trechoValido(10, 10, 1), 0);
ok('em 2x, pulo de 10s continua sem somar', trechoValido(10, 20, 2), 0);

/* a cola de verdade: abrir e arrastar direto pro fim */
const aulaDe30min = 1800;
let somado = 0;
somado += trechoValido(0, 1, 1);          // tocou um segundo
somado += trechoValido(1, aulaDe30min - 5, 1);  // arrastou pro fim
ok('abrir e arrastar pro fim nao conclui', Math.round((somado / aulaDe30min) * 100), 0);

console.log(
  `\nlimites do gratuito: rola ${LIMITES.rolasPorDia}, aula ${LIMITES.aulasPorDia}, ` +
  `short ${LIMITES.shortsPorDia}, quiz ${LIMITES.perguntasPorDia}, recomendacao ${LIMITES.recomendacoesAbertas}`
);
/* ============================================================
   VOLTAR SIM, ADIANTAR NAO

   A barra existe pra rever o pedaco que nao entrou. Se ela
   deixasse adiantar, seria a mesma cola de arrastar pro fim,
   so que com outro nome.
   ============================================================ */
console.log('');
ok('volta pro comeco', ondePodeVoltar(0, 300), 0);
ok('volta pra um ponto ja assistido', ondePodeVoltar(120, 300), 120);
ok('para na marca do que ja foi assistido', ondePodeVoltar(900, 300), 300);
ok('nao aceita numero negativo', ondePodeVoltar(-50, 300), 0);
ok('sem nada assistido, nao sai do lugar', ondePodeVoltar(100, 0), 0);
ok('lixo no lugar do numero nao move a agulha', ondePodeVoltar('abc', 300), 0);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
