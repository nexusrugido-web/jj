import { register } from 'node:module';
import 'fake-indexeddb/auto';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   TÉCNICAS PRÓPRIAS, CAMADA DE DADOS (Frente B, 07/11/2026)

   Contrato em docs/CONTRATO-TECNICAS.md:
   - criar grava propria 1 e uid uuid; nome até 80, "como você faz"
     até 2.000; nome do catálogo ou repetido não passa;
   - a cota de 100 conta as arquivadas e barra a 101ª;
   - versaoDe, fam e contra ficam no registro, sobem e descem sem
     tradução;
   - marcar as próprias antigas: só com prova, simula, não toca no
     catálogo (nome antigo e "juntou" incluídos), rodar de novo não
     muda nada;
   - família: a própria entra só com fam confirmado.
   ============================================================ */

const { db, ensureSeed, registrarSync } = await import('../src/db/db.js');
const P = await import('../src/lib/proprias.js');
const { familiaDoGolpe } = await import('../src/lib/familias.js');
const { TECNICA_POR_UID } = await import('../src/lib/tecnicas.js');
const { uidEstavel, chaveNome } = await import('../src/lib/uid.js');
const { paraRegistros, aplicarLocal, sementeIntacta } = await import('../src/lib/sync.js');
const { LIMITE_TECNICAS_PROPRIAS } = await import('../src/lib/limites.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

const fila = [];
registrarSync((tabela, op, r) => fila.push({ tabela, op, r }));
await ensureSeed();
const catalogoNoAparelho = await db.techniques.count();

/* ---------- criar ---------- */
let r = await P.criarTecnicaPropria({ nome: '  Raspagem do Zé  ' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
ok('criar grava propria 1, uid uuid fora do catálogo e o nome sem espaço sobrando',
  [r.tecnica.propria, UUID.test(r.tecnica.uid), TECNICA_POR_UID.has(r.tecnica.uid), r.tecnica.nome], [1, true, false, 'Raspagem do Zé']);
const subiu = fila.find((f) => f.op === 'upsert' && f.r.uid === r.tecnica.uid);
ok('a criação entra na fila de envio com propria', [!!subiu, subiu?.r.propria], [true, 1]);
ok('a própria nunca é biblioteca intacta (sobe sempre)', sementeIntacta('techniques', r.tecnica), false);

ok('sem nome não cria', (await P.criarTecnicaPropria({ nome: '   ' })).erro, 'Coloca o nome');

r = await P.criarTecnicaPropria({ nome: 'x'.repeat(81), detalhes: 'y'.repeat(2001) });
ok('nome com 81 é cortado em 80 e detalhes com 2.001 em 2.000', [r.tecnica.nome.length, r.tecnica.detalhes.length], [80, 2000]);

/* ---------- nome repetido ---------- */
const erroDe = async (nome) => (await P.criarTecnicaPropria({ nome })).erro || null;
ok('nome do catálogo não passa', await erroDe('Armlock da montada'), 'Já existe "Armlock da montada" no app. Escolha ela na lista.');
ok('nome antigo do catálogo não passa', await erroDe('Chave de braço da montada'), 'Já existe "Armlock da montada" no app. Escolha ela na lista.');
ok('sem acento e com caixa diferente também não', await erroDe('ARMLOCK DA  MONTADA'), 'Já existe "Armlock da montada" no app. Escolha ela na lista.');
ok('nome em inglês do catálogo (sinônimo) não passa', await erroDe('Mounted armbar'), 'Já existe "Armlock da montada" no app. Escolha ela na lista.');
ok('nome de outra técnica que ela criou não passa', await erroDe('raspagem do ze'), 'Você já criou "Raspagem do Zé". Escolha ela na lista.');

/* ---------- versaoDe, fam e contra ---------- */
const origem = [...TECNICA_POR_UID.keys()][0];
r = await P.criarTecnicaPropria({ nome: 'Meu armlock voador', versaoDe: origem, fam: 'fam:armlock', contra: ['fam:kimura'] });
await db.techniques.update(r.tecnica.id, { status: 'dominada', favorita: 1 });
let t = await db.techniques.get(r.tecnica.id);
ok('versaoDe, fam e contra ficam depois de um update', [t.versaoDe, t.fam, t.contra, t.propria], [origem, 'fam:armlock', ['fam:kimura'], 1]);
ok('família que não existe não é gravada', P.novaPropria({ nome: 'a', fam: 'fam:inventada' }).fam, undefined);

/* sync: os campos sobem e descem como estão (uid e fam:* não traduzem) */
const [linha] = paraRegistros([{ tabela: 'techniques', op: 'upsert', uid: t.uid, dados: t, updatedAt: t.updatedAt }], 'conta-1');
ok('sobe com propria, versaoDe, fam e contra iguais', [linha.dados.propria, linha.dados.versaoDe, linha.dados.fam, linha.dados.contra], [1, origem, 'fam:armlock', ['fam:kimura']]);
const outroUid = crypto.randomUUID();
await aplicarLocal([{ ...linha, dados: { ...linha.dados, uid: outroUid, nome: 'Minha de outro celular' }, updated_at: new Date(Date.now() + 1000).toISOString() }]);
const desceu = await db.techniques.where('uid').equals(outroUid).first();
ok('desce com os mesmos valores no outro aparelho', [desceu.propria, desceu.versaoDe, desceu.fam, desceu.contra], [1, origem, 'fam:armlock', ['fam:kimura']]);

/* ---------- família ---------- */
const lista = await db.techniques.toArray();
await P.criarTecnicaPropria({ nome: 'Armlock do Zé' });
const lista2 = await db.techniques.toArray();
ok('a própria com fam confirmado entra na família (com a lista)', familiaDoGolpe('Meu armlock voador', lista), 'fam:armlock');
ok('sem a lista, só o catálogo (quem chama hoje não muda)', familiaDoGolpe('Meu armlock voador'), null);
ok('nome parecido sem fam não entra', familiaDoGolpe('Armlock do Zé', lista2), null);
ok('o catálogo continua igual', [familiaDoGolpe('Armlock da montada'), familiaDoGolpe('Chave de braço da montada', lista2)], ['fam:armlock', 'fam:armlock']);

/* ---------- cota ---------- */
let todas = await db.techniques.toArray();
let criadas = P.contarProprias(todas);
ok('o catálogo semeado não conta na cota', criadas, 5);
ok('texto da cota', P.textoDaCota(87), 'Você criou 87 de 100 técnicas.');
for (let i = criadas; i < LIMITE_TECNICAS_PROPRIAS - 1; i++) await P.criarTecnicaPropria({ nome: `Própria número ${i}` });
const arquivar = await db.techniques.where('nome').equals('Raspagem do Zé').first();
await db.techniques.update(arquivar.id, { arquivada: 1 });
ok('99 criadas, uma arquivada: ainda pode', [P.contarProprias(await db.techniques.toArray()), P.podeCriarPropria(await db.techniques.toArray())], [99, true]);
r = await P.criarTecnicaPropria({ nome: 'A centésima' });
ok('a 100ª passa', !!r.tecnica, true);
r = await P.criarTecnicaPropria({ nome: 'A centésima primeira' });
ok('a 101ª é barrada com o texto da cota (a arquivada conta)', r.erro, 'Chegou nas 100. Pra criar outra, edite uma que você não usa mais.');
ok('nada foi gravado na 101ª', await db.techniques.where('nome').equals('A centésima primeira').count(), 0);
ok('nome da arquivada continua bloqueado', P.nomeRepetido('Raspagem do Zé', await db.techniques.toArray()), 'Você já criou "Raspagem do Zé". Ela está arquivada.');

/* ---------- marcar as próprias antigas ---------- */
const H = Date.parse('2026-10-01T12:00:00Z');
const uidDe = (n) => uidEstavel(chaveNome('techniques', n));
const semente = Array.from({ length: 25 }, (_, i) => ({ id: 1000 + i, uid: crypto.randomUUID(), nome: `Semeada sem uid fixo ${i}`, criadoEm: H + i * 10 }));
const antigas = [
  { id: 1, uid: uidDe('Baiana com blast'), nome: 'Baiana com blast', criadoEm: H },
  { id: 2, uid: uidDe('Chave de braço da montada'), nome: 'Armlock da montada', criadoEm: H },        // uid do nome antigo
  { id: 3, uid: uidDe('Blast double'), nome: 'Baiana com blast', criadoEm: H },                       // juntou
  { id: 4, uid: crypto.randomUUID(), nome: 'Passagem toureando', criadoEm: H },                       // catálogo sem uid fixo
  { id: 5, uid: crypto.randomUUID(), nome: 'Passagem em toureio', criadoEm: H },                      // nome de antes da varredura
  { id: 6, nome: 'Sem uid nenhum', criadoEm: H + 9e6 },
  { id: 7, uid: crypto.randomUUID(), nome: 'Sem data' },
  { id: 8, uid: crypto.randomUUID(), nome: 'Criada pelo atleta', criadoEm: H + 5e8 },
  { id: 9, uid: crypto.randomUUID(), nome: 'Outra dele, arquivada', criadoEm: H + 6e8, arquivada: 1 },
  { id: 10, uid: crypto.randomUUID(), nome: 'Já marcada', criadoEm: H + 7e8, propria: 1 },
  ...semente,
];
const sim = await P.marcarProprias(antigas, { simular: true });
ok('simulado: conta certo', { m: sim.marcadas, j: sim.jaMarcadas, c: sim.catalogo, d: sim.duvidosas, mot: sim.motivos },
  { m: 2, j: 1, c: 3, d: 29, mot: { nome_do_catalogo: 2, sem_uid: 1, sem_data: 1, nasceu_com_a_biblioteca: 25 } });
ok('simulado: só as duas com prova nos patches', sim.patches.map((p) => [p.id, p.patch]), [[8, { propria: 1 }], [9, { propria: 1 }]]);
ok('a cota conta as mesmas (catálogo e duvidosa fora)', P.contarProprias(antigas), 3);

/* no aparelho: aplica, e rodar de novo não muda nada */
const antes = await db.techniques.count();
const velha = await db.techniques.add({ nome: 'Criada antes da marca', uid: crypto.randomUUID(), criadoEm: H + 9e8, arquivada: 0 });
let real = await P.marcarProprias(await db.techniques.toArray(), { simular: true });
ok('no aparelho semeado, o catálogo inteiro fica de fora e só a antiga é marcada', [real.marcadas, real.catalogo, real.duvidosas], [1, catalogoNoAparelho, 0]);
ok('simular não grava', (await db.techniques.get(velha)).propria, undefined);
fila.length = 0;
real = await P.marcarProprias(await db.techniques.toArray(), { simular: false });
ok('aplicado: marca e sobe pela fila', [(await db.techniques.get(velha)).propria, fila.filter((f) => f.op === 'upsert').length], [1, 1]);
real = await P.marcarProprias(await db.techniques.toArray(), { simular: false });
ok('rodar de novo não muda nada', [real.marcadas, real.patches.length, await db.techniques.count()], [0, 0, antes + 1]);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
