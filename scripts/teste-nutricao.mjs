import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   AS CONTAS DO DIA DE COMIDA

   A barra soma o que a pessoa marcou (os alimentos de casa e os
   dela), e o dia bate pela soma ou pelo "bati" marcado na mão. Dia
   sem nada não aparece em lugar nenhum.
   ============================================================ */
const { ALIMENTOS, todosOsAlimentos, somarDia, bateuODia, chaveDoAlimento } = await import('../src/lib/nutricao.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

const meus = [{ id: 7, nome: 'Iogurte proteico', p: '15', c: '6', arquivada: 0 }, { id: 8, nome: 'Apagado', p: 99, c: 0, arquivada: 1 }];
const todos = todosOsAlimentos(meus);
ok('os meus vêm primeiro, e o apagado some', todos.slice(0, 1).map((a) => a.nome), ['Iogurte proteico']);
ok('todos os de casa entram', todos.filter((a) => a.base).length, ALIMENTOS.length);
ok('chave do meu é c + id, do de casa é o id', [chaveDoAlimento(todos[0]), chaveDoAlimento(todos.find((a) => a.id === 'ovo'))], ['c7', 'ovo']);
ok('3 ovos e 1 iogurte meu somam proteína e carbo', somarDia({ ovo: 3, c7: 1 }, todos), { proteina: 33, carbo: 6 });
ok('alimento apagado não soma', somarDia({ c8: 2 }, todos), { proteina: 0, carbo: 0 });
ok('dia sem nada: não aparece', bateuODia(undefined), null);
ok('dia vazio anotado: não aparece', bateuODia({ comi: {}, proteina: 0, meta: 130, marcado: null }), null);
ok('passou da meta: bateu', bateuODia({ proteina: 140, meta: 130 }), true);
ok('abaixo da meta: não bateu', bateuODia({ proteina: 90, meta: 130 }), false);
ok('marcou "bati" sem anotar comida: bateu', bateuODia({ proteina: 0, meta: 130, marcado: 'bati' }), true);
ok('marcou "não bati" vale mais que a soma', bateuODia({ proteina: 200, meta: 130, marcado: 'nao' }), false);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
