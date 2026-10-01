import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   FASE 2 DO PREMIUM

   O treino de hoje, o relatório do mês, o raio-x do parceiro e o
   modo campeonato: a conta de cada um, com dado de mentira e
   resultado conferido na mão.
   ============================================================ */
const { treinoDeHoje, diasDeTreino, artigo } = await import('../src/lib/treinoDeHoje.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

/* ---------- o artigo de cada técnica ---------- */
ok('a Americana, o Armlock, a Kimura, o Triângulo, a Chave de pé, o Mata-leão, a Omoplata, o Estrangulamento',
  ['Americana', 'Armlock', 'Kimura', 'Triângulo', 'Chave de pé', 'Mata-leão', 'Omoplata', 'Estrangulamento de lapela'].map(artigo),
  ['a', 'o', 'a', 'o', 'a', 'o', 'a', 'o']);

/* ---------- o treino de hoje ---------- */
/* treina às terças: 15/09 e 22/09; hoje é terça 29/09 */
const sessoes = [{ data: '2026-09-15' }, { data: '2026-09-22' }, { data: '2026-09-28' }];
ok('terça é dia de treino (2 terças nas últimas 6 semanas)', diasDeTreino(sessoes, '2026-09-29'), [2]);
const esteira = [{ nome: 'Americana', grau: 1, proximo: 2, requisitos: { usos: 3 }, volume: 2.2 }];
const buracos = [{ nome: 'Triângulo', vezes: 6 }];
const jogo = { porPosicao: [{ nome: 'Em pé', n: 10, v: 7 }, { nome: 'Guarda fechada', n: 2, v: 2 }] };
let h = treinoDeHoje({ sessions: sessoes, esteira, buracos, jogo, metaSemanal: 5, hj: '2026-09-29' });
ok('mostra no dia de treino, antes de registrar', h.mostrar, true);
ok('as quatro linhas, na ordem', h.linhas.map((l) => l.id), ['grau', 'cuidado', 'comeco', 'semana']);
ok('a técnica perto do grau', h.linhas[0].texto, 'Tenta a Americana: falta 1 uso pro 2º grau');
ok('o que te pega', h.linhas[1].texto, 'Cuidado com o Triângulo: te pegou 6 vezes');
ok('de onde ganha (posição com poucos rolas não conta)', h.linhas[2].texto, 'Começa em pé: você ganha 7 de 10 rolas assim');
ok('o destaque de cada linha está dentro do texto dela', h.linhas.every((l) => l.texto.includes(l.forte)), true);
ok('a semana (segunda 28/09 já conta)', h.linhas[3].texto, '1 de 5 treinos na semana: hoje conta');
h = treinoDeHoje({ sessions: [...sessoes, { data: '2026-09-29' }], esteira, buracos, jogo, metaSemanal: 5, hj: '2026-09-29' });
ok('já registrou o treino de hoje: some', h.mostrar, false);
h = treinoDeHoje({ sessions: sessoes, esteira, buracos, jogo, metaSemanal: 5, hj: '2026-09-30' });
ok('quarta não é dia de treino dele: some', h.mostrar, false);
h = treinoDeHoje({ sessions: sessoes, hj: '2026-09-29' });
ok('sem nenhum dado que sustente, não aparece', h.mostrar, false);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
