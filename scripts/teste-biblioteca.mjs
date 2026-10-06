import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

import 'fake-indexeddb/auto';

/* ============================================================
   A BIBLIOTECA SEM INCOERÊNCIA

   O app guarda a técnica pelo nome. Nome repetido mistura a conta
   de duas técnicas; categoria errada põe "Entrada no 50/50" na
   lista de finalização do rola. Este teste trava os dois e confere
   a arrumação no aparelho de quem já usa o app.
   ============================================================ */
const { SEED } = await import('../src/db/seed.js');
const { CATALOGO_TECNICAS, TECNICA_POR_UID } = await import('../src/lib/tecnicas.js');
const { uidEstavel, chaveNome } = await import('../src/lib/uid.js');
const { nomeAtual } = await import('../src/db/renomeios.js');
const { db, arrumarBiblioteca, renomearTecnicas, registrarSync } = await import('../src/db/db.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

/* ---------- o seed ---------- */
const chave = (n) => String(n).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const vistos = new Map();
const repetidos = [];
for (const t of SEED.techniques) {
  const k = chave(t.pt);
  if (vistos.has(k)) repetidos.push(t.pt);
  vistos.set(k, t);
}
ok('nenhum nome de técnica repetido', repetidos, []);

const slugs = new Set(SEED.positions.map((p) => p.slug));
ok('toda técnica sai e chega numa posição que existe',
  SEED.techniques.filter((t) => !slugs.has(t.from) || !slugs.has(t.to)).map((t) => t.pt), []);

const FINALIZACAO = new Set(['estrangulamento', 'articular', 'perna']);
ok('toda finalização termina em finalização (entrada e passagem não são chave)',
  SEED.techniques.filter((t) => FINALIZACAO.has(t.cat) && t.to !== 'finalizacao').map((t) => t.pt), []);

const cats = new Set(SEED.categories.map((c) => c.slug));
ok('toda técnica tem categoria que existe', SEED.techniques.filter((t) => !cats.has(t.cat)).map((t) => t.pt), []);

/* ---------- o uid de quem saiu ---------- */
const todos = CATALOGO_TECNICAS.flatMap((t) => t.uids);
ok('nenhum uid aponta pra duas técnicas', todos.length, new Set(todos).size);
ok('a cópia que saiu continua achando a técnica que ficou', TECNICA_POR_UID.get(uidEstavel(chaveNome('techniques', 'Blast double')))?.nome, 'Baiana com blast');
ok('o katagatame da montada antigo acha o da montada', TECNICA_POR_UID.get(uidEstavel(chaveNome('techniques', 'Triângulo de braço')))?.nome, 'Katagatame da montada');

/* ---------- os nomes do katagatame ---------- */
ok('o nome que servia pros dois vai pro 100kg', nomeAtual('Katagatame (triângulo de braço)'), 'Katagatame dos 100kg');
ok('o nome antigo da montada vai pra montada', nomeAtual('Triângulo de braço'), 'Katagatame da montada');

/* ---------- o aparelho de quem já usa ---------- */
const subiu = [];
registrarSync((tabela, op, dados) => subiu.push(dados.nome));

const catId = {};
for (const c of SEED.categories) catId[c.slug] = await db.categories.add({ ...c, __local: 1 });
const posId = {};
for (const p of SEED.positions) posId[p.slug] = await db.positions.add({ ...p, __local: 1 });
const entrada = await db.techniques.add({ nome: 'Entrada no 50/50', categoriaId: catId.perna, origemId: posId.guarda_aberta, __local: 1 });
const legDrag = await db.techniques.add({ nome: 'Leg drag da 50/50', categoriaId: catId.perna, origemId: posId.g50, __local: 1 });
const levantada = await db.techniques.add({ nome: 'Levantada técnica', categoriaId: catId.queda, origemId: posId.sentado, __local: 1 });
const kata = await db.techniques.add({ nome: 'Katagatame (triângulo de braço)', categoriaId: catId.estrangulamento, origemId: posId.montada, __local: 1 });
const heel = await db.techniques.add({ nome: 'Heel hook externo (chave de calcanhar)', categoriaId: catId.perna, origemId: posId.ashi, __local: 1 });
const sid = await db.sessions.add({ data: '2026-09-10', focoTecnicas: [{ nome: 'Katagatame (triângulo de braço)', aprendizado: 'peguei' }], __local: 1 });
const rid = await db.rolls.add({ sessionId: sid, subsAplicadas: ['Katagatame (triângulo de braço)'], subsSofridas: ['Triângulo de braço'], tecMeus: {}, tecDele: {}, __local: 1 });

await renomearTecnicas();
await arrumarBiblioteca();

ok('a entrada no 50/50 vira transição', (await db.techniques.get(entrada)).categoriaId, catId.transicao);
ok('o leg drag da 50/50 vira passagem', (await db.techniques.get(legDrag)).categoriaId, catId.passagem);
ok('a levantada técnica vira escapada', (await db.techniques.get(levantada)).categoriaId, catId.escapada);
const k = await db.techniques.get(kata);
ok('o katagatame gravado vira o dos 100kg e sai do 100kg', [k.nome, k.origemId], ['Katagatame dos 100kg', posId.cem_quilos]);
ok('a chave de perna de verdade continua chave de perna', (await db.techniques.get(heel)).categoriaId, catId.perna);
const r = await db.rolls.get(rid);
ok('o rola troca o nome das finalizações', [r.subsAplicadas, r.subsSofridas], [['Katagatame dos 100kg'], ['Katagatame da montada']]);
ok('a aula troca o nome', (await db.sessions.get(sid)).focoTecnicas[0].nome, 'Katagatame dos 100kg');
ok('a arrumação da biblioteca não sobe pra nuvem', subiu.filter((n) => ['Entrada no 50/50', 'Leg drag da 50/50', 'Levantada técnica'].includes(n)), []);

await db.techniques.update(entrada, { categoriaId: catId.perna, __local: Math.random() });
await arrumarBiblioteca();
ok('roda uma vez só', (await db.techniques.get(entrada)).categoriaId, catId.perna);

/* ---------- a aula pela posição ---------- */
const { tecnicasDaPosicao, posicoesRecentes, ehPosicao } = await import('../src/lib/posicoes.js');
const categorias = await db.categories.toArray();
const posicoes = await db.positions.toArray();
const pId = Object.fromEntries(posicoes.map((p) => [p.slug, p.id]));
const cId = Object.fromEntries(categorias.map((c) => [c.slug, c.id]));
const biblioteca = SEED.techniques.map((t, i) => ({ id: 1000 + i, nome: t.pt, tags: t.tags || [], categoriaId: cId[t.cat], origemId: pId[t.from], arquivada: 0 }));
const base = { techniques: biblioteca, categories: categorias, positions: posicoes };
const daX = tecnicasDaPosicao('x_guard', base).map((t) => t.nome);
ok('da Guarda X aparecem as variações dela', ['Raspagem de X-guard para trás', 'Raspagem de X-guard para o lado'].every((n) => daX.includes(n)), true);
ok('a posição não aparece como técnica dela mesma', daX.includes('X-guard'), false);
ok('"De La Riva" da biblioteca é posição', ehPosicao(biblioteca.find((t) => t.nome === 'De La Riva')), true);
const passando = tecnicasDaPosicao('passando', base);
ok('o tema "Combatendo a guarda" traz as passagens', passando.some((t) => t.nome === 'Passagem toureando'), true);
ok('o que você já usou vem primeiro', tecnicasDaPosicao('x_guard', { ...base, usadas: ['Retenção da X-guard'] })[0].nome, 'Retenção da X-guard');
ok('a posição da aula mais recente vem primeiro',
  posicoesRecentes([{ data: '2026-09-01', focoPosicoes: ['montada'] }, { data: '2026-09-20', focoPosicoes: ['de_la_riva', 'montada'] }]), ['de_la_riva', 'montada']);

/* ---------- o rola: golpe e de onde saiu ---------- */
const { golpeDe, GOLPES, variacaoProvavel, posicoesDoRola, golpesDoRola, variacoes } = await import('../src/lib/golpes.js');
const finais = SEED.techniques.filter((t) => FINALIZACAO.has(t.cat)).map((t) => ({ nome: t.pt, de: t.from }));
ok('todo golpe tem o jeito padrão na biblioteca', GOLPES.filter((g) => !finais.some((t) => t.nome === g.padrao)).map((g) => g.id), []);
ok('armlock da montada e dos 100kg são o mesmo golpe', [golpeDe('Chave de braço da montada'), golpeDe('Chave de braço dos 100kg')], ['armlock', 'armlock']);
ok('o katagatame não vira triângulo', golpeDe('Katagatame da montada'), 'katagatame');
ok('a raspagem de kimura não é finalização (fica fora do catálogo do rola)', finais.some((t) => t.nome === 'Raspagem de kimura (guarda)'), false);

const rolaMontada = { ptsMeus: ['passagem', 'montada'], posInicial: 'em_pe' };
ok('o último ponto vem primeiro', posicoesDoRola(rolaMontada, 'meu'), ['montada', 'cem_quilos', 'em_pe']);
ok('chegou na montada: o armlock é o da montada',
  variacaoProvavel('armlock', { catalogo: finais, posicoes: posicoesDoRola(rolaMontada, 'meu') }), 'Chave de braço da montada');
ok('sem ponto nem histórico: o armlock da guarda (o padrão)', variacaoProvavel('armlock', { catalogo: finais }), 'Chave de braço (armlock)');
ok('sem ponto: o que você já registrou ganha do padrão',
  variacaoProvavel('kimura', { catalogo: finais, historico: ['Kimura dos 100kg'] }), 'Kimura dos 100kg');
ok('da guarda fechada com 4 guilhotinas: a que você usa',
  variacaoProvavel('guilhotina', { catalogo: finais, posicoes: ['guarda_fechada'], historico: ['Marcelotine'] }), 'Marcelotine');
const sofri = { ptsDele: ['costas'], posInicial: 'guarda_fechada_cima' };
ok('finalização sofrida: a posição dele', posicoesDoRola(sofri, 'dele'), ['costas', 'guarda_fechada']);
ok('ele pegou as costas: o mata-leão é das costas', variacaoProvavel('mata_leao', { catalogo: finais, posicoes: posicoesDoRola(sofri, 'dele') }), 'Mata-leão');
ok('os seus golpes aparecem primeiro', golpesDoRola(['Omoplata', 'Kimura dos 100kg']).slice(0, 3), ['omoplata', 'kimura', 'armlock']);
ok('trocar a origem mostra só o mesmo golpe', variacoes('Americana', finais).map((t) => t.nome), ['Americana', 'Americana da montada', 'Americana da guarda']);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
