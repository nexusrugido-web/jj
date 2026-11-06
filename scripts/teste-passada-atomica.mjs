import { register } from 'node:module';
import 'fake-indexeddb/auto';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   PASSADA DE IDENTIDADE: TUDO OU NADA (T5, 07/11/2026)

   O app fecha no meio da passada. O que o aparelho tem depois?
   Prova que os registros corrigidos, a marca de pessoal, a fila de
   subida e a marca "já rodou" entram numa transação só:
   - falha na última gravação (marca) ou na fila: nada mudou, nem
     registro corrigido sem a fila, nem fila sem registro;
   - tentar de novo depois da falha dá o mesmo resultado de uma
     rodada limpa;
   - a fila tem 1 item por registro alterado e os hooks do banco
     não enfileiram por fora (nada em dobro);
   - duas rodadas ao mesmo tempo (duas abas) aplicam uma vez só;
   - rodar de novo não muda nada;
   - só mudam tecUid, golpeUid, propria e a hora.
   Não liga nada no app.
   ============================================================ */

const { db, ensureSeed, registrarSync } = await import('../src/db/db.js');
const { aplicarIdentidadeUmaVez, MARCA_IDENTIDADE } = await import('../src/lib/passada-identidade.js');
const { CATALOGO_TECNICAS } = await import('../src/lib/tecnicas.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

let porFora = 0; /* quantas vezes um hook tentou enfileirar por fora */
registrarSync(() => { porFora++; });
await ensureSeed();

/* o aparelho antigo: rolas e meta com nome, uma técnica criada sem a marca */
const H = Date.parse('2026-10-01T12:00:00Z');
const [a, b] = CATALOGO_TECNICAS;
await db.rolls.bulkAdd([
  { data: '2026-10-02', subsAplicadas: [a.nome], subsSofridas: [], placar: 'ganhei' },
  { data: '2026-10-03', subsAplicadas: [b.nome], subsSofridas: [a.nome], placar: 'perdi' },
  { data: '2026-10-04', subsAplicadas: [], subsSofridas: [], placar: 'empate' },
]);
await db.techniques.add({ nome: 'Criada antes da marca', uid: crypto.randomUUID(), criadoEm: H + 9e8, arquivada: 0 });

const tudo = async () => ({
  rolls: await db.rolls.toArray(), techniques: await db.techniques.toArray(),
  attackPlans: await db.attackPlans.toArray(), goals: await db.goals.toArray(),
  outbox: await db.outbox.count(), marca: await db.meta.get(MARCA_IDENTIDADE),
});
const antes = await tudo();
porFora = 0; /* a montagem do cenário passou pelos hooks; a conta começa agora */
const quebrar = (tabela, metodo) => {
  tabela[metodo] = async () => { throw new Error('o app fechou'); };
  return () => { delete tabela[metodo]; };
};
const tenta = async (fn) => { try { await fn(); return 'gravou'; } catch (e) { return e.message; } };

/* ---------- o app fecha no meio ---------- */
let volta = quebrar(db.meta, 'put');
ok('fecha na última gravação (a marca): a passada falha', await tenta(() => aplicarIdentidadeUmaVez({ comFila: true })), 'o app fechou');
volta();
ok('e nada mudou: registros, técnicas, fila e marca iguais ao de antes', await tudo(), antes);

volta = quebrar(db.outbox, 'bulkAdd');
ok('fecha ao gravar a fila: a passada falha', await tenta(() => aplicarIdentidadeUmaVez({ comFila: true })), 'o app fechou');
volta();
ok('e nada mudou: nenhum registro corrigido sem a fila', await tudo(), antes);
ok('os hooks não enfileiraram nada por fora, nem nas falhas', porFora, 0);

/* ---------- tentar de novo: duas abas ao mesmo tempo ---------- */
const [r1, r2] = await Promise.all([aplicarIdentidadeUmaVez({ comFila: true }), aplicarIdentidadeUmaVez({ comFila: true })]);
const quem = [r1, r2].sort((x, y) => Number(x.jaFeita) - Number(y.jaFeita));
ok('duas rodadas juntas: uma aplica, a outra vê a marca', [quem[0].jaFeita, quem[1].jaFeita], [false, true]);
const depois = await tudo();
ok('a passada achou o que ligar (o teste não é vazio)', [quem[0].alterados > 0, quem[0].marcadas > 0], [true, true]);
ok('a fila tem 1 item por registro alterado, nada em dobro',
  [depois.outbox, porFora], [quem[0].alterados + quem[0].marcadas, 0]);
ok('a marca guarda o relatório', [depois.marca.value.alterados, depois.marca.value.naFila], [quem[0].alterados, quem[0].alterados + quem[0].marcadas]);

/* a fila leva o registro como ficou, no formato do enfileirar */
const itens = await db.outbox.toArray();
const noAparelho = new Map([...depois.rolls, ...depois.techniques].map((x) => [x.uid, x]));
ok('cada item da fila é o registro gravado (mesmo uid, mesmo conteúdo, hora igual)',
  itens.every((i) => i.op === 'upsert' && i.tentativas === 0 && JSON.stringify(i.dados) === JSON.stringify(noAparelho.get(i.uid)) && i.updatedAt === i.dados.updatedAt), true);
ok('a fila só tem as tabelas que mudaram', [...new Set(itens.map((i) => i.tabela))].sort(), ['rolls', 'techniques']);

/* ---------- só muda o que deveria ---------- */
const sem = (o, campos) => { const c = { ...o }; for (const k of campos) delete c[k]; return c; };
const ANTES = new Map(antes.rolls.map((x) => [x.id, x]));
ok('rolas: fora tecUid e a hora, tudo igual',
  depois.rolls.every((x) => JSON.stringify(sem(x, ['tecUid', 'updatedAt'])) === JSON.stringify(sem(ANTES.get(x.id), ['tecUid', 'updatedAt']))), true);
ok('rolas: as duas com nome ganharam tecUid, a vazia não', depois.rolls.map((x) => !!x.tecUid), [true, true, false]);
const TANTES = new Map(antes.techniques.map((x) => [x.id, x]));
ok('técnicas: fora propria e a hora, tudo igual; mesmo número, nenhuma criada ou apagada',
  [depois.techniques.length === antes.techniques.length, depois.techniques.every((x) => JSON.stringify(sem(x, ['propria', 'updatedAt'])) === JSON.stringify(sem(TANTES.get(x.id), ['propria', 'updatedAt'])))], [true, true]);
ok('técnicas: só a criada sem a marca ganhou propria', depois.techniques.filter((x) => x.propria).map((x) => x.nome), ['Criada antes da marca']);

/* ---------- rodar de novo ---------- */
const filaAntes = depois.outbox;
const de = await aplicarIdentidadeUmaVez({ comFila: true });
const final = await tudo();
ok('rodar de novo não faz nada', [de.jaFeita, final.outbox === filaAntes, JSON.stringify(final.rolls) === JSON.stringify(depois.rolls), JSON.stringify(final.techniques) === JSON.stringify(depois.techniques)], [true, true, true, true]);

/* ---------- nuvem desligada: grava no aparelho, sem fila ---------- */
await db.meta.delete(MARCA_IDENTIDADE);
await db.outbox.clear();
await db.rolls.add({ data: '2026-10-05', subsAplicadas: [a.nome], subsSofridas: [], placar: 'ganhei', __local: 1 });
const semNuvem = await aplicarIdentidadeUmaVez({ comFila: false });
ok('sem nuvem: corrige o aparelho e não grava fila', [semNuvem.alterados > 0, await db.outbox.count(), semNuvem.naFila], [true, 0, 0]);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
