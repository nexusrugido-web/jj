import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   UMA TELA NÃO DESMENTE A OUTRA

   O mesmo número aparece em mais de um lugar. Quando cada tela
   conta do seu jeito, o aluno vê 99 lutas no Painel e 111 no
   Meu jogo, ou "faltam 3 vezes" numa tela e um requisito a mais
   na outra.
   ============================================================ */
const { faltaPara } = await import('../src/lib/recomendar.js');
const { analisarJogo } = await import('../src/lib/game.js');
const { resumo } = await import('../src/lib/stats.js');
const { tituloDaMeta } = await import('../src/lib/metas.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

/* ---------- o que falta pro próximo grau ---------- */
const base = { grau: 2, proximo: 3, progresso: 60, soDrill: false, contraAcima: 0, melhorParceiro: 1 };
ok('só falta volume: diz quantas vezes',
  faltaPara({ ...base, usosResistencia: 12, transferencia: 4, refinamento: 4 }).resumo,
  'Faltam 3 vezes no rola pra subir pro 3º grau');
ok('falta volume e gente diferente: avisa que tem mais',
  faltaPara({ ...base, usosResistencia: 12, transferencia: 3, refinamento: 4 }, 'branca', [{ id: 1, nome: 'Caio' }]).resumo,
  'Faltam 3 vezes no rola, e mais uma coisa, pra subir pro 3º grau');
ok('2º grau: uma vez no singular',
  faltaPara({ grau: 1, proximo: 2, progresso: 80, soDrill: false, usosResistencia: 4, transferencia: 1, refinamento: 4 }).resumo,
  'Falta 1 vez no rola pra subir pro 2º grau');

/* ---------- drill não é luta, em lugar nenhum ---------- */
const sessions = [{ id: 1, data: '2026-09-10' }];
const rolls = [
  { sessionId: 1, contexto: 'rola', ptsMeus: ['montada'] },
  { sessionId: 1, contexto: 'rola', subsSofridas: ['Americana'] },
  { sessionId: 1, contexto: 'drill', ptsMeus: ['montada'] },
];
ok('Meu jogo conta as mesmas lutas do Painel', analisarJogo(rolls, [], sessions).rolas, resumo(sessions, rolls).rolas);

/* ---------- título de meta sem código interno ---------- */
ok('meta de posição mostra o nome da posição', tituloDaMeta({ tipo: 'posicao', alvo: 'guarda_fechada_baixo' }), 'Trabalhar Guarda fechada (por baixo)');

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
