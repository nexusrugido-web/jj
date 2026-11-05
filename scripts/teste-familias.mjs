import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   AS FAMÍLIAS DE FINALIZAÇÃO NO CATÁLOGO (R4.1)

   Família só por mecânica, escrita na técnica (campo "fam"), com id
   próprio que nunca é o nome de uma técnica. Avulsa não é erro. As
   duas técnicas que juntaram seguem achando pelo uid antigo, o
   Backside 50/50 é posição e as compressões têm categoria própria.
   ============================================================ */
const { SEED } = await import('../src/db/seed.js');
const { FAMILIAS, MEMBROS, familiaDoGolpe, nomeDoItem, quantasVariacoes, variacoesEmResumo } = await import('../src/lib/familias.js');
const { CATALOGO_TECNICAS, TECNICA_POR_UID, FAMILIAS_DE_FINALIZACAO } = await import('../src/lib/tecnicas.js');
const { uidEstavel, chaveNome } = await import('../src/lib/uid.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

const ids = new Set(FAMILIAS.map((f) => f.id));
const nomes = new Set(SEED.techniques.map((t) => t.pt));
const fin = SEED.techniques.filter((t) => FAMILIAS_DE_FINALIZACAO.has(t.cat));

ok('14 famílias, cada id começa com fam: e é único', [FAMILIAS.length, ids.size, FAMILIAS.every((f) => f.id.startsWith('fam:'))], [14, 14, true]);
ok('nenhum id de família é nome de técnica', FAMILIAS.filter((f) => nomes.has(f.id)).map((f) => f.id), []);
ok('todo "fam" do seed é uma família que existe', SEED.techniques.filter((t) => t.fam && !ids.has(t.fam)).map((t) => t.pt), []);
ok('só finalização tem família', SEED.techniques.filter((t) => t.fam && !FAMILIAS_DE_FINALIZACAO.has(t.cat)).map((t) => t.pt), []);
ok('toda família tem pelo menos duas variações', FAMILIAS.filter((f) => (MEMBROS.get(f.id) || []).length < 2).map((f) => f.id), []);
ok('111 finalizações no catálogo (113, menos as 2 que juntaram), 61 em família, 50 avulsas',
  [fin.length + 1, fin.filter((t) => t.fam).length, fin.filter((t) => !t.fam).length + 1], [111, 61, 50]);
/* o +1 é o Backside 50/50, que continua no catálogo como posição */

const fam = (n) => familiaDoGolpe(n);
ok('decididos: Marcelotine na Guilhotina, Tarikoplata na Kimura, triângulo pelas costas no Triângulo, chave do SLX na pé reta',
  ['Marcelotine', 'Tarikoplata', 'Estrangulamento de perna (leg choke)', 'Chave de tornozelo do single leg X'].map(fam),
  ['fam:guilhotina', 'fam:kimura', 'fam:triangulo', 'fam:pe_reta']);
ok('avulsas: Kimura trap, Monoplata, Baratoplata, Mir lock, Brabo, Anaconda',
  ['Kimura trap (sistema)', 'Monoplata', 'Baratoplata', 'Mir lock', "Brabo (D'arce)", 'Anaconda'].map(fam), [null, null, null, null, null, null]);
ok('pendentes ficam fora: Katagatame de lapela e Texas cloverleaf', ['Katagatame de lapela', 'Texas cloverleaf'].map(fam), [null, null]);
ok('Mir lock continua chave articular', SEED.techniques.find((t) => t.pt === 'Mir lock').cat, 'articular');
ok('o body triangle é controle: a família é a do mata-leão', fam('Mata-leão com body triangle'), 'fam:mata_leao');

/* ---------- as duas que juntaram ---------- */
ok('Short choke e Estrangulamento de braço em X saíram como técnica', ['Short choke', 'Estrangulamento de braço em X'].filter((n) => nomes.has(n)), []);
const curta = CATALOGO_TECNICAS.find((t) => t.nome === 'Mata-leão de uma mão só');
const cruz = CATALOGO_TECNICAS.find((t) => t.nome === 'Cruzada da montada');
ok('o uid do Short choke acha o Mata-leão de uma mão só', TECNICA_POR_UID.get(uidEstavel(chaveNome('techniques', 'Estrangulamento de calção (short choke)')))?.nome, 'Mata-leão de uma mão só');
ok('o uid do braço em X acha a Cruzada da montada', TECNICA_POR_UID.get(uidEstavel(chaveNome('techniques', 'Estrangulamento de braço em X')))?.nome, 'Cruzada da montada');
ok('os uids de antes continuam (o próprio de cada uma)',
  [curta.uid === uidEstavel(chaveNome('techniques', 'Mata-leão de mão única')), cruz.uid === uidEstavel(chaveNome('techniques', 'Cruzada da montada'))], [true, true]);
ok('a busca acha por "short choke" e "x choke"; "calção" não aparece em nome nenhum',
  [curta.busca.includes('short choke'), cruz.busca.includes('x choke'), SEED.techniques.some((t) => /calção/i.test(t.pt))], [true, true, false]);
ok('o nome gravado antes acha a família', [fam('Short choke'), fam('Estrangulamento de braço em X')], ['fam:mata_leao', 'fam:cruzada']);

/* ---------- posição e compressão ---------- */
const bs = SEED.techniques.find((t) => t.pt === 'Backside 50/50');
ok('Backside 50/50 é posição: Guardas e posições, da 50/50 pra 50/50, sem família', [bs.cat, bs.from, bs.to, (bs.tags || []).includes('posicao'), fam(bs.pt)], ['guarda', 'g50', 'g50', true, null]);
ok('o uid do Backside 50/50 não muda', CATALOGO_TECNICAS.find((t) => t.nome === 'Backside 50/50').uid, uidEstavel(chaveNome('techniques', 'Backside 50/50')));
ok('Compressões existe e é finalização', [SEED.categories.some((c) => c.slug === 'compressao' && c.nome === 'Compressões'), FAMILIAS_DE_FINALIZACAO.has('compressao')], [true, true]);
ok('nas compressões: Cadeira elétrica, Banana split e Calf slicer',
  SEED.techniques.filter((t) => t.cat === 'compressao').map((t) => t.pt).sort(),
  ['Banana split', 'Cadeira elétrica (finalização)', 'Compressão de panturrilha (calf slicer)']);
ok('a Cadeira elétrica (posição) continua posição', SEED.techniques.find((t) => t.pt === 'Cadeira elétrica (posição)').cat, 'guarda');

/* ---------- o que a pessoa lê ---------- */
ok('a família aparece como "qualquer armlock"', [nomeDoItem('fam:armlock'), nomeDoItem('fam:armlock', true), nomeDoItem('Kimura')], ['qualquer armlock', 'Qualquer armlock', 'Kimura']);
ok('o resumo das variações não repete o nome da família', [quantasVariacoes('fam:armlock'), variacoesEmResumo('fam:armlock')], [15, 'da guarda fechada, da montada, dos 100kg…']);
ok('a que tem só o nome da família conta mas não aparece', [quantasVariacoes('fam:kimura'), variacoesEmResumo('fam:kimura')], [8, 'dos 100kg, da meia-guarda, da tartaruga…']);
ok('família pequena mostra todas, sem reticências', variacoesEmResumo('fam:heel_hook'), 'interno (chave de calcanhar), externo (chave de calcanhar)');

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
