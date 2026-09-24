import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   O QUIZ NÃO TEM PADRÃO

   A certa era sempre a segunda, e o aluno aprendia a posição, não
   o jiu-jitsu. Aqui: toda pergunta tem uma certa só, as alternativas
   mudam de lugar entre perguntas e entre dias, e dentro do mesmo
   dia ficam paradas (a rodada não se embaralha enquanto responde).
   ============================================================ */
const { PERGUNTAS, embaralharOpcoes } = await import('../src/db/quiz.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

const ids = PERGUNTAS.map((p) => p.id);
ok('nenhum id repetido', ids.filter((x, i) => ids.indexOf(x) !== i), []);
ok('toda pergunta tem exatamente uma certa', PERGUNTAS.filter((p) => p.ops.filter((o) => o.ok).length !== 1).map((p) => p.id), []);
ok('toda alternativa explica o porquê', PERGUNTAS.filter((p) => p.ops.some((o) => !o.p)).map((p) => p.id), []);

const posicoes = new Set(PERGUNTAS.map((p) => embaralharOpcoes(p, '2026-09-24').ops.findIndex((o) => o.ok)));
ok('no mesmo dia, a certa aparece em pelo menos 3 posições diferentes', posicoes.size >= 3, true);
const p = PERGUNTAS[0];
ok('mesma pergunta, mesmo dia: mesma ordem', embaralharOpcoes(p, '2026-09-24').ops.map((o) => o.t), embaralharOpcoes(p, '2026-09-24').ops.map((o) => o.t));
const dias = new Set(['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28']
  .map((d) => embaralharOpcoes(p, d).ops.findIndex((o) => o.ok)));
ok('a mesma pergunta muda de ordem ao longo dos dias', dias.size > 1, true);
ok('embaralhar não perde nem inventa alternativa', embaralharOpcoes(p).ops.map((o) => o.t).sort(), p.ops.map((o) => o.t).sort());
ok('tem pergunta pra roxa em diante', PERGUNTAS.filter((q) => q.faixa?.includes('roxa')).length >= 10, true);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
