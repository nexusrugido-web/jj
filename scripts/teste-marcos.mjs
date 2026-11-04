import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   O RECORDE DO DIA

   Um marco por recorde batido (5 rolas, depois 6...), com piso:
   sem ele o primeiro treino de todo mundo seria "recorde". E a
   figurinha de cada recorde pega as frases de recorde.
   ============================================================ */
const { definirMarcos } = await import('../src/lib/milestones.js');
const { FRASES } = await import('../src/lib/figurinha.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

const base = { matHoras: 0, rolas: 0, sessoes: 1, dominadas: 0, primeiraFinalizacao: null, streakRecorde: 0, pontos: 0, rolasComPontos: 0, taxaVitoria: 0 };
const recordes = (extra) => definirMarcos({ ...base, ...extra }).filter((m) => m.tipo === 'recorde');

ok('4 rolas num dia ainda não é recorde', recordes({ recordeRolasDia: 4 }).length, 0);
ok('5 rolas num dia vira marco', recordes({ recordeRolasDia: 5 }).map((m) => m.titulo), ['5 rolas num dia']);
ok('bater o recorde de novo gera outra chave', recordes({ recordeRolasDia: 7 }).map((m) => m.chave), ['recorde_rolas_dia_7']);
ok('2h59 de tatame num dia ainda não conta', recordes({ recordeTatameDia: 179 }).length, 0);
ok('3h de tatame num dia vira marco', recordes({ recordeTatameDia: 180 }).map((m) => m.titulo), ['3h de tatame num dia']);
ok('sem os números novos, nada quebra', recordes({}).length, 0);
ok('todo tipo de frase tem pelo menos 3 opções', Object.entries(FRASES).filter(([, l]) => l.length < 3).map(([k]) => k), []);

/* primeiras vezes: a primeira de cada lance, num faixa acima e em cada parceiro, drill fora */
const { primeirasVezes } = await import('../src/lib/milestones.js');
const pv = primeirasVezes([
  { sessionId: 2, partnerId: 'b', ptsMeus: ['raspagem', 'raspagem'], subsAplicadas: ['Armlock'] },
  { sessionId: 1, partnerId: 'a', ptsMeus: ['passagem'] },
  { sessionId: 1, partnerId: 'a', contexto: 'drill', ptsMeus: ['costas'] },
], [{ id: 'a', nome: 'Léo', faixa: 'branca' }, { id: 'b', nome: 'Rafa', faixa: 'azul' }],
[{ id: 1, data: '2026-10-01' }, { id: 2, data: '2026-10-08' }], 'branca').map((m) => m.chave);
ok('primeiras vezes na ordem do treino', pv, [
  'primeira_passagem', 'primeira_passagem_parceiro_a',
  'primeira_raspagem', 'primeira_raspagem_faixa_azul', 'primeira_raspagem_parceiro_b',
  'primeira_finalizacao_faixa_azul', 'primeira_finalizacao_parceiro_b',
]);
ok('primeira finalização não duplica o marco antigo', pv.includes('primeira_finalizacao'), false);
ok('primeiras entram nos marcos', definirMarcos({ ...base, primeiras: [{ chave: 'x', tipo: 'primeira' }] }).some((m) => m.chave === 'x'), true);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
