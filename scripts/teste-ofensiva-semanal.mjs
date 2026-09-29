import assert from 'node:assert/strict';
import { ofensivaSemanal as calcular, hojeOfensiva, semanaOfensiva, somarDiasOfensiva as add } from '../src/lib/ofensivaSemanal.js';

const inicio = '2026-06-01';
const sessao = (data, extra = {}) => ({ id: data, data, tipo: 'gi', ...extra });
const seguidas = (n) => Array.from({ length: n }, (_, i) => sessao(add(inicio, i * 7)));
const casos = [];
function teste(nome, fn) { fn(); casos.push(nome); }
teste('meta e XP não entram na regra; A, B e C mantêm a mesma semana', () => {
  for (const n of [1, 3, 4]) {
    const o = calcular(Array.from({ length: n }, (_, i) => sessao(add(inicio, i))), add(inicio, 6));
    assert.equal(o.semanas, 1);
    assert.equal(o.treinouEstaSemana, true);
  }
});
teste('semana aberta não quebra nem consome escudo', () => {
  const o = calcular(seguidas(4), add(inicio, 28));
  assert.equal(o.semanas, 4); assert.equal(o.escudos, 1); assert.equal(o.estado, 'pendente');
});
teste('escudo protege uma semana encerrada sem somar semana', () => {
  const o = calcular(seguidas(4), add(inicio, 35));
  assert.equal(o.semanas, 4); assert.equal(o.escudos, 0); assert.equal(o.gastos, 1);
  assert.equal(o.faltaProEscudo, 4);
});
teste('retorno depois de escudo conta a quinta semana', () => {
  const o = calcular([...seguidas(4), sessao(add(inicio, 35))], add(inicio, 35));
  assert.equal(o.semanas, 5); assert.equal(o.faltaProEscudo, 3);
});
teste('sem proteção, quebra e preserva recorde', () => {
  const o = calcular(seguidas(4), add(inicio, 42));
  assert.equal(o.semanas, 0); assert.equal(o.recorde, 4);
  assert.equal(calcular([...seguidas(4), sessao(add(inicio, 42))], add(inicio, 42)).semanas, 1);
});
teste('tetos de dois e três escudos', () => {
  assert.equal(calcular(seguidas(16), add(inicio, 105)).escudos, 2);
  assert.equal(calcular(seguidas(16), add(inicio, 105), [], { maxEscudos: 3 }).escudos, 3);
});
teste('lesão preserva, não ganha semana ou escudo e não exige estudo', () => {
  const lesao = [{ impacto: 'parado', data: add(inicio, 28), dataCura: add(inicio, 41) }];
  const o = calcular(seguidas(4), add(inicio, 35), lesao);
  assert.equal(o.semanas, 4); assert.equal(o.escudos, 1); assert.equal(o.congelada, true);
  assert.equal(o.faltaProEscudo, 4);
  assert.equal(calcular([...seguidas(4), sessao(add(inicio, 42))], add(inicio, 42), lesao).semanas, 5);
});
teste('lesão parcial protege a semana; treino adaptado não congela', () => {
  const lesao = [{ impacto: 'parado', data: add(inicio, 9), dataCura: add(inicio, 10) }];
  assert.equal(calcular(seguidas(1), add(inicio, 14), lesao).semanas, 1);
  assert.equal(calcular(seguidas(1), add(inicio, 14), [{ ...lesao[0], impacto: 'adaptado' }]).semanas, 0);
});
teste('lesão sem treino prévio não inventa sequência', () => {
  const o = calcular([], inicio, [{ impacto: 'parado', data: inicio }]);
  assert.equal(o.semanas, 0); assert.equal(o.congelada, true);
});
teste('datas futuras e inválidas não contam; estudo não vira treino', () => {
  assert.equal(calcular([sessao('2026-02-30'), sessao(add(inicio, 1)), { data: inicio, evento: 'aula' }], inicio).semanas, 0);
});
teste('competição planejada não conta; participação concluída conta', () => {
  const c = sessao(inicio, { tipo: 'competicao', competicao: { andamento: true } });
  assert.equal(calcular([c], inicio).semanas, 0);
  assert.equal(calcular([{ ...c, competicao: { resultado: 'participou' } }], inicio).semanas, 1);
});
teste('drill, open mat, aula privada e no-gi contam', () => {
  for (const tipo of ['drill', 'openmat', 'privada', 'nogi']) assert.equal(calcular([sessao(inicio, { tipo })], inicio).semanas, 1);
});
teste('edição, exclusão e registro retroativo recompõem a mesma história', () => {
  const s = seguidas(4); const removida = s.filter((_, i) => i !== 2);
  assert.equal(calcular(removida, add(inicio, 21)).semanas, 1);
  assert.equal(calcular([...removida, s[2]], add(inicio, 21)).semanas, 4);
  assert.equal(calcular([...s].reverse(), add(inicio, 21)).escudos, 1);
  assert.equal(calcular([...s, s[0]], add(inicio, 21)).semanas, 4);
});
teste('virada semanal segue Brasília e atravessa o ano', () => {
  assert.equal(hojeOfensiva(new Date('2026-09-28T02:59:59Z')), '2026-09-27');
  assert.equal(hojeOfensiva(new Date('2026-09-28T03:00:00Z')), '2026-09-28');
  assert.equal(semanaOfensiva('2027-01-01'), '2026-12-28');
});
console.log(`${casos.length} cenários de ofensiva semanal aprovados.`);
