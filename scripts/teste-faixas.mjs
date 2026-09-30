import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

const { FAIXAS, FAIXA_ORDEM, faixasDaIdade, faixaValidaNaIdade, faixaDeConteudo, proximaFaixa } = await import('../src/lib/faixas.js');
const { proximaGraduacao } = await import('../src/lib/milestones.js');
const { taxaPorFaixa } = await import('../src/lib/periodo.js');
const { avaliarTecnica } = await import('../src/lib/regras.js');

const ids = (idade) => faixasDaIdade(idade).map((f) => f.id);
assert.equal(new Set(FAIXAS.map((f) => f.id)).size, FAIXAS.length);
assert.deepEqual(ids(8).slice(0, 4), ['branca', 'cinza-branca', 'cinza', 'cinza-preta']);
assert.ok(ids(8).includes('amarela') && !ids(8).includes('laranja'));
assert.ok(ids(10).includes('laranja') && !ids(12).includes('verde'));
assert.ok(ids(13).includes('verde') && ids(15).includes('verde-preta'));
assert.deepEqual(ids(16), ['branca', 'azul', 'roxa']);
assert.deepEqual(ids(17), ['branca', 'azul', 'roxa']);
assert.deepEqual(ids(18), ['branca', 'azul', 'roxa', 'marrom']);
assert.ok(ids(19).includes('preta'));
assert.equal(faixaValidaNaIdade('verde', 16), false);
assert.equal(faixaDeConteudo('amarela-preta'), 'branca');
assert.equal(FAIXA_ORDEM.azul, 1);
assert.equal(FAIXA_ORDEM.preta, 4);
assert.equal(proximaFaixa('branca', 8), 'cinza-branca');
assert.equal(proximaFaixa('verde-preta', 16), 'azul');
assert.equal(proximaGraduacao('verde-preta', 4, 15).tipo, 'revisar');
assert.equal(proximaGraduacao('azul', 4, 17).label, 'Faixa roxa');
assert.ok(avaliarTecnica('Chave de punho', { faixa: 'verde-preta', idade: 15 }));

const faixa = taxaPorFaixa(
  [{ id: 1, data: '2026-09-29' }],
  [{ sessionId: 1, partnerId: 7, resultado: 'finalizei', subsAplicadas: ['armbar'] }],
  [{ id: 7, faixa: 'amarela-preta' }],
  { ini: '2026-09-29', fim: '2026-09-29' },
  'cinza',
);
assert.equal(faixa.total.n, 1);
assert.equal(faixa.linhas[0].faixa, 'amarela-preta');
assert.equal(faixa.contraAcima.n, 1);

console.log('ok: faixas por idade, graduação, regras e rolas infantis');
