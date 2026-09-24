import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   QUEM GANHOU O ROLA

   No treino o rola recomeça depois do tap, então dá pra pegar e
   ser pego no mesmo rola. Quem finalizou mais vezes ganhou.
   Empatou nas finalizações (ou ninguém finalizou), decidem os
   pontos, depois a vantagem. Troca de taps só empatando em tudo.
   ============================================================ */
const { placarDaRola } = await import('../src/lib/game.js');
const { resumo } = await import('../src/lib/stats.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};
const res = (r) => placarDaRola(r).resultado;

ok('finalizei 2, levei 1: venci por finalização', res({ subsAplicadas: ['Armlock', 'Americana'], subsSofridas: ['Americana'] }), 'finalizei');
ok('finalizei 1, levei 2: fui finalizado', res({ subsAplicadas: ['Armlock'], subsSofridas: ['Americana', 'Mata-leão'] }), 'fui_finalizado');
ok('1 a 1 sem mais nada: trocamos taps', res({ subsAplicadas: ['Armlock'], subsSofridas: ['Americana'] }), 'ambos');
ok('1 a 1, mais pontos meus: venci nos pontos', res({ subsAplicadas: ['Armlock'], subsSofridas: ['Americana'], ptsMeus: ['montada'] }), 'venci_pontos');
ok('1 a 1, mais pontos dele: perdi nos pontos', res({ subsAplicadas: ['Armlock'], subsSofridas: ['Americana'], ptsDele: ['montada'] }), 'perdi_pontos');
ok('1 a 1, pontos iguais, vantagem minha: venci na vantagem', res({ subsAplicadas: ['a'], subsSofridas: ['b'], vantMinhas: 1 }), 'venci_vantagem');
ok('finalização vale mais que ponto', res({ subsAplicadas: ['Armlock'], ptsDele: ['montada'] }), 'finalizei');
ok('sem finalização, pontos decidem', res({ ptsMeus: ['montada'] }), 'venci_pontos');
ok('sem ponto, vantagem decide', res({ vantMinhas: 1 }), 'venci_vantagem');
ok('nada: empate', res({}), 'empate');
ok('2 a 1 conta como vitória', placarDaRola({ subsAplicadas: ['a', 'b'], subsSofridas: ['c'] }).ganhou, true);

/* "rolas com tap sofrido" continua contando o 2 a 1: você bateu nele */
const r = resumo([{ id: 1, data: '2026-09-10' }], [
  { sessionId: 1, subsAplicadas: ['a', 'b'], subsSofridas: ['c'], resultado: 'finalizei' },
]);
ok('2 a 1 entra em rolas com finalização', r.subPct, 100);
ok('2 a 1 entra em rolas com tap sofrido', r.tapPct, 100);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
