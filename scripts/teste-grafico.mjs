import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   A BARRA DO GRÁFICO NÃO PODE MENTIR

   Cada barra fica na altura exata do valor do dia (ou da semana),
   e dia sem treino não tem barra nenhuma. A curva que vinha antes
   desenhava morrinho em dia vazio.
   ============================================================ */
const { barrasDoGrafico, METRICAS } = await import('../src/lib/periodo.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

const serie = Array.from({ length: 10 }, () => ({ vitorias: 0, derrotas: 0 }));
serie[3] = { vitorias: 2, derrotas: 1 };
serie[7] = { vitorias: 0, derrotas: 3 };
const b = barrasDoGrafico(serie, ['vitorias', 'derrotas']);

ok('uma barra por valor que existe', b.length, 3);
ok('a barra fica na altura exata', b.map((x) => [x.i, x.k, x.v]), [[3, 'vitorias', 2], [3, 'derrotas', 1], [7, 'derrotas', 3]]);
ok('dia sem treino não tem barra', b.some((x) => x.i === 2 || x.i === 4 || x.i === 6), false);
ok('valor zero não vira barra', b.some((x) => x.i === 7 && x.k === 'vitorias'), false);
ok('série vazia, nenhuma barra', barrasDoGrafico([{}, {}], ['vitorias']).length, 0);

/* o que saiu dos gráficos: variedade técnica, e horas no eixo do volume */
ok('variedade técnica saiu', METRICAS.some((m) => m.id === 'diversidade'), false);
const volume = METRICAS.find((m) => m.id === 'volume');
ok('volume desenha só rolas', volume.chaves.map((c) => c.k), ['rolas']);
ok('as horas ficam no número de cima', volume.extras.map((c) => c.k), ['horas']);
ok('toda série de gráfico tem cor', METRICAS.every((m) => m.chaves.every((c) => c.cor)), true);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
