import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

const { hoje, addDias } = await import('../src/lib/utils.js');
const { minhasTecnicas } = await import('../src/lib/graus.js');
const { tecnicaParaRevisar, gerarRecomendacoes, recomendacoesDoAluno } = await import('../src/lib/recomendar.js');
const { pedidoDaRec } = await import('../src/lib/necessidades.js');

const hojeIso = hoje();
const sessao = (id, dias, nome, aprendizado) => ({
  id, data: addDias(hojeIso, dias), criadoEm: id,
  focoTecnicas: [{ nome, aprendizado }],
});

const nao = sessao(1, -2, 'Chave de pé reta (botinha)', 'nao');
const meio = sessao(2, -1, 'Armlock', 'meio');
const entradas = [nao, meio];
assert.equal(tecnicaParaRevisar(entradas).nome, nao.focoTecnicas[0].nome);
assert.equal(minhasTecnicas([], [], [nao], []).length, 0);
assert.equal(minhasTecnicas([], [], [meio], [])[0].grau, 1);

const rec = gerarRecomendacoes({ sessions: entradas, limite: 9 }).find((r) => r.intencao === 'aprender');
assert.equal(rec.alvo, nao.focoTecnicas[0].nome);
assert.equal(pedidoDaRec(rec).nomes[0], rec.alvo);
assert.equal(recomendacoesDoAluno({ sessions: entradas, limite: 9 }).some((r) => r.alvo === rec.alvo), true);

const aprendeu = sessao(3, 0, nao.focoTecnicas[0].nome, 'peguei');
assert.equal(tecnicaParaRevisar([...entradas, aprendeu]).nome, 'Armlock');
assert.equal(tecnicaParaRevisar([aprendeu]), null);
assert.equal(tecnicaParaRevisar([sessao(4, -31, 'Armlock', 'nao')]), null);
assert.equal(tecnicaParaRevisar([sessao(5, 0, 'Armlock', null), meio]).nome, 'Armlock');

console.log('ok: aprendizado salvo alimenta domínio e revisão de estudo, sem XP ou grau indevido para não peguei');
