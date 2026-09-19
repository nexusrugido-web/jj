import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

import 'fake-indexeddb/auto';

/* ============================================================
   O ESTUDO NAO PODE MENTIR PRO ALUNO

   Cada caso aqui era um defeito real encontrado na auditoria:

     video tirado do ar continuava aparecendo pra todo mundo
     o Estudo nao via "sair de baixo do 100kg", o Painel via
     o Estudo mostrava o que a pessoa ja tinha marcado como feito
     comecar o rola na propria guarda virava "posicao ruim"
     a recomendacao virava o titulo "Sair de nessa posicao"
     o limite do gratis contava video concluido, nao aberto
     concluir pela recomendacao gravava um objeto no lugar dos segundos
   ============================================================ */

const { db, consertarAulasVistas } = await import('../src/db/db.js');
const { mesclarAcervo } = await import('../src/lib/acervo.js');
const { recomendacoesDoAluno, chaveDaRec } = await import('../src/lib/recomendar.js');
const { registrarEventoVideo, registrarAulaVista, abertosHoje } = await import('../src/lib/aulas.js');
const { usadoHoje } = await import('../src/lib/plano.js');
const { AULAS } = await import('../src/db/aulas.js');

const { hoje: diaDeHoje, addDias } = await import('../src/lib/utils.js');
const hoje = diaDeHoje();
const ontem = addDias(hoje, -1);

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

await db.open();

/* ---------- o acervo que chega no aparelho ---------- */
const linha = (id, extra = {}) => ({ id, titulo: id, duracao: 300, tipo: 'aula', temas: ['guarda'], ...extra });

const completa = mesclarAcervo(AULAS, [linha('n1'), linha('n2')], { completa: true });
ok('carga completa substitui a lista inteira, nada do codigo sobra', completa.lista.map((x) => x.id), ['n1', 'n2']);

const atual = [linha('a'), linha('b'), linha('c')].map((l) => mesclarAcervo([], [l]).lista[0]);
const delta = mesclarAcervo(atual, [linha('b', { ativo: false }), linha('d', { ativo: true })]);
ok('video tirado do ar sai, video novo entra', delta.lista.map((x) => x.id).sort(), ['a', 'c', 'd']);
ok('o que saiu vem listado pra apagar do aparelho', delta.fora, ['b']);

const antigo = mesclarAcervo(atual, [linha('e')]);
ok('resposta do servidor antigo, sem o campo ativo, conta como no ar', antigo.lista.some((x) => x.id === 'e'), true);

/* ---------- a posicao ruim ---------- */
const sessions = [1, 2, 3].map((i) => ({ id: i, data: hoje }));
const rolasDe = (pos) => [1, 2, 3].map((i) => ({ sessionId: i, posInicial: pos, contexto: 'rola' }));
const titulos = (rolls, feitas = []) =>
  recomendacoesDoAluno({ sessions, rolls, feitas, faixa: 'branca' }).map((r) => r.titulo);

ok('embaixo do 100kg vira recomendacao com nome de verdade', titulos(rolasDe('cem_baixo')).includes('Sair de baixo do 100kg'), true);
ok('costas entregues tem titulo', titulos(rolasDe('costas_baixo')).includes('Defender as costas'), true);
ok('comecar na propria guarda nao e posicao ruim', titulos(rolasDe('guarda_fechada_baixo')).some((t) => t.startsWith('Sair')), false);
ok('nenhum titulo "Sair de nessa posicao"', titulos(rolasDe('costas_baixo')).some((t) => t.includes('nessa posi')), false);

const rec = recomendacoesDoAluno({ sessions, rolls: rolasDe('cem_baixo'), faixa: 'branca' })[0];
const feita = [{ chave: chaveDaRec(rec), data: hoje, resultado: 'funcionou' }];
ok('o que foi marcado como feito sai da lista', titulos(rolasDe('cem_baixo'), feita).includes('Sair de baixo do 100kg'), false);
ok('marcado como "nao saiu" continua', titulos(rolasDe('cem_baixo'), [{ ...feita[0], resultado: 'nao' }]).includes('Sair de baixo do 100kg'), true);

/* ---------- o limite do dia conta video aberto ---------- */
const a1 = { id: 'a1', t: 'aula 1', d: 600, k: 'aula' };
const a2 = { id: 'a2', t: 'aula 2', d: 600, k: 'aula' };
const s1 = { id: 's1', t: 'short 1', d: 40, k: 'short' };

await registrarEventoVideo(a1, 'abriu', { origem: 'estudo:temas' });
ok('abrir sem concluir ja conta no limite', await usadoHoje('aula'), 1);
await registrarEventoVideo(a1, 'abriu', { origem: 'estudo:temas' });
ok('reabrir o mesmo video no mesmo dia nao gasta de novo', await usadoHoje('aula'), 1);
await registrarEventoVideo(a2, 'abriu');
await registrarEventoVideo(s1, 'abriu');
ok('aula e short contam separado', [await usadoHoje('aula'), await usadoHoje('short')], [2, 1]);
await db.videoEventos.add({ videoId: 'a9', tipo: 'aula', evento: 'abriu', data: ontem });
ok('o aberto ontem nao conta hoje', (await abertosHoje('aula')).has('a9'), false);
const origem = (await db.videoEventos.where('videoId').equals('a1').first()).origem;
ok('a abertura guarda de onde a pessoa veio', origem, 'estudo:temas');

/* ---------- os segundos assistidos ---------- */
await registrarAulaVista(a1, a1);
ok('chamada errada nao grava objeto nos segundos', (await db.aulasVistas.where('videoId').equals('a1').first()).segundosVistos, 600);
await registrarAulaVista(a1, 900);
ok('rever guarda o maior numero', (await db.aulasVistas.where('videoId').equals('a1').first()).segundosVistos, 900);
ok('concluir vira evento', (await db.videoEventos.where('videoId').equals('a1').toArray()).some((e) => e.evento === 'concluiu'), true);

await db.aulasVistas.add({ videoId: 'x1', tipo: 'aula', duracao: 420, segundosVistos: { id: 'x1' }, data: ontem });
await db.aulasVistas.add({ videoId: 'x2', tipo: 'aula', duracao: 300, segundosVistos: 250, data: ontem });
await consertarAulasVistas();
ok('registro antigo com objeto vira a duracao da aula', (await db.aulasVistas.where('videoId').equals('x1').first()).segundosVistos, 420);
ok('registro certo nao e mexido', (await db.aulasVistas.where('videoId').equals('x2').first()).segundosVistos, 250);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
