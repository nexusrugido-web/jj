import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   A LINHA DO GRÁFICO NÃO PODE MENTIR A ALTURA

   Ela se abre pros lados pra não virar espinho, mas o pico de um
   dia tem que ficar na altura do valor dele, e dia vazio longe de
   treino tem que ficar no zero.
   ============================================================ */
const { contornoSuave, larguraDoSino } = await import('../src/lib/periodo.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};
const r2 = (x) => Math.round(x * 100) / 100;
const noBalde = (curva, i, amostras = 8) => r2(curva[i * amostras][1]);

const umDia = Array(30).fill(0);
umDia[15] = 2;
const c = contornoSuave(umDia, { largura: larguraDoSino(30) });
ok('um treino sozinho: o pico fica na altura exata', noBalde(c, 15), 2);
ok('e se abre pros dias vizinhos, em vez de voltar ao zero', noBalde(c, 14) > 1 && noBalde(c, 16) > 1, true);
ok('bem longe do treino a linha é zero', [noBalde(c, 5), noBalde(c, 25)], [0, 0]);
ok('a curva nunca passa do maior valor', r2(Math.max(...c.map((p) => p[1]))), 2);

const platô = [0, 0, 3, 3, 3, 3, 0, 0];
const cp = contornoSuave(platô, { largura: 1 });
ok('dias seguidos iguais viram platô na mesma altura, sem inflar', [2, 3, 4, 5].every((i) => noBalde(cp, i) >= 3 && noBalde(cp, i) <= 3.1), true);

ok('tudo zero é tudo zero', contornoSuave([0, 0, 0]).every((p) => p[1] === 0), true);
ok('um balde só vira um ponto só', contornoSuave([4]), [[0, 4]]);
ok('amostras suficientes pra curva lisa', contornoSuave(umDia).length, 29 * 8 + 1);
ok('sino mais largo quando há mais pontos, com limite', [larguraDoSino(7), larguraDoSino(30), larguraDoSino(90)], [0.8, 30 / 22, 1.6]);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
