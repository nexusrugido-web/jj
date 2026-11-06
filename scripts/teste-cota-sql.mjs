import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

import 'fake-indexeddb/auto';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';

/* ============================================================
   COTA DE TÉCNICAS PRÓPRIAS NO SERVIDOR (SQL 56)

   Roda a tabela registros de verdade (o pedaço do schema.sql, com
   as 4 políticas) e o SQL 56 por cima, como o usuário logado
   (role authenticated, RLS ligada). Confere a cota de 100, o
   propria que não sai, o catálogo, os tamanhos, as tabelas, o
   delete e o isolamento entre contas. E confere que os números,
   as tabelas e os uids do SQL são os mesmos do código do app.

   node scripts/teste-cota-sql.mjs --gerar
     imprime a lista de uids do catálogo pra colar no SQL 56
   ============================================================ */

const { LIMITE_TECNICAS_PROPRIAS, NOME_TECNICA_MAX, DETALHES_TECNICA_MAX } = await import('../src/lib/limites.js');
const { CATALOGO_TECNICAS } = await import('../src/lib/tecnicas.js');
const { RENOMEAR } = await import('../src/db/renomeios.js');
const { uidEstavel, chaveNome } = await import('../src/lib/uid.js');
const { TABELAS_SYNC } = await import('../src/db/db.js');
const { TABELA_AJUSTES, idNaNuvem } = await import('../src/lib/sync.js');

/* o que o app trata como técnica da biblioteca: o uid do seed, os das
   cópias juntadas e os dos nomes antigos (sementeIntacta, em sync.js) */
const uidsDoCatalogo = () => [...new Set([
  ...CATALOGO_TECNICAS.flatMap((t) => t.uids),
  ...Object.keys(RENOMEAR).map((n) => uidEstavel(chaveNome('techniques', n))),
])].sort();

if (process.argv.includes('--gerar')) {
  const u = uidsDoCatalogo();
  const linhas = [];
  for (let i = 0; i < u.length; i += 4) linhas.push(u.slice(i, i + 4).map((x) => `'${x}'`).join(', '));
  console.log(linhas.join(',\n'));
  process.exit(0);
}

const arquivoSql = await fs.readFile(new URL('../supabase/56-cota-tecnicas-proprias.sql', import.meta.url), 'utf8');
const schema = await fs.readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const registros = schema.slice(schema.indexOf('-- ---------- helper'), schema.indexOf('-- ---------- perfil'));

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

/* ---------- contrato: o SQL e o código dizem a mesma coisa ---------- */
const bloco = arquivoSql.slice(arquivoSql.indexOf('-- uids: início'), arquivoSql.indexOf('-- uids: fim'));
const uidsNoSql = [...bloco.matchAll(/'([0-9a-f-]{36})'/g)].map((m) => m[1]).sort();
ok('a lista de uids do SQL é a gerada do seed (regenerar: --gerar)', uidsNoSql, uidsDoCatalogo());
const check = arquivoSql.match(/check \(tabela in \(([\s\S]*?)\)\) not valid/)[1];
const tabelasNoSql = [...check.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
ok('as tabelas do check são TABELAS_SYNC + settings', tabelasNoSql, [...TABELAS_SYNC, TABELA_AJUSTES].sort());

/* ---------- o banco ---------- */
const pg = new PGlite();
await pg.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
  grant usage on schema auth to authenticated;
`);
await pg.exec(registros);
await pg.exec('grant select, insert, update, delete on public.registros to authenticated');
await pg.exec(arquivoSql);
await pg.exec(arquivoSql); // reexecução segura

const numeros = (await pg.query('select public.limite_tecnicas_proprias() a, public.nome_tecnica_max() b, public.detalhes_tecnica_max() c')).rows[0];
ok('os números do SQL são os de src/lib/limites.js', [numeros.a, numeros.b, numeros.c],
  [LIMITE_TECNICAS_PROPRIAS, NOME_TECNICA_MAX, DETALHES_TECNICA_MAX]);

const ana = '00000000-0000-0000-0000-00000000a001';
const bia = '00000000-0000-0000-0000-00000000a002';
await pg.query('insert into auth.users values ($1),($2)', [ana, bia]);
await pg.exec('set role authenticated');
const como = (u) => pg.exec(`set test.uid='${u}'`);

/* grava como o sync grava: upsert pelo id, todas as colunas */
const upsert = (id, user, tabela, dados, deletado = false) => pg.query(
  `insert into public.registros (id, user_id, tabela, dados, deleted_at) values ($1, $2, $3, $4, $5)
   on conflict (id) do update set user_id = excluded.user_id, tabela = excluded.tabela,
     dados = excluded.dados, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
  [id, user, tabela, JSON.stringify(dados), deletado ? new Date().toISOString() : null]);
const tenta = async (fn) => { try { await fn(); return 'aceito'; } catch (e) { return String(e.message).split(':')[0]; } };
const uuid = () => crypto.randomUUID();
const propria = (n, extra = {}) => ({ uid: uuid(), nome: `Minha ${n}`, propria: 1, ...extra });
const contar = async (user) => (await pg.query(
  "select count(*)::int n from public.registros where user_id = $1 and tabela = 'techniques' and public.tecnica_e_propria(dados)", [user])).rows[0].n;

await como(ana);
/* 97 vivas + 1 arquivada + 1 apagada */
const ids = [];
for (let i = 0; i < 97; i++) { const id = uuid(); ids.push(id); await upsert(id, ana, 'techniques', propria(i)); }
await upsert(uuid(), ana, 'techniques', propria('arquivada', { arquivada: 1 }));
await upsert(uuid(), ana, 'techniques', propria('apagada'), true);
ok('a 100ª (com uma arquivada e uma apagada no meio) passa', await tenta(() => upsert(uuid(), ana, 'techniques', propria(100))), 'aceito');
ok('a 101ª é recusada (arquivada e apagada contam)', await tenta(() => upsert(uuid(), ana, 'techniques', propria(101))), 'limite_tecnicas');
ok('a conta fica com 100', await contar(ana), 100);

ok('editar uma própria com a conta cheia passa', await tenta(() => upsert(ids[0], ana, 'techniques', propria('editada'))), 'aceito');
ok('o upsert do mesmo id não conta duas vezes', await contar(ana), 100);
ok('tirar o propria é recusado', await tenta(() => upsert(ids[1], ana, 'techniques', { uid: uuid(), nome: 'x' })), 'tecnica_propria_fixa');
ok('propria = 0 também é recusado', await tenta(() => upsert(ids[1], ana, 'techniques', { uid: uuid(), nome: 'x', propria: 0 })), 'tecnica_propria_fixa');
ok('mudar a própria de tabela é recusado', await tenta(() => upsert(ids[1], ana, 'rolls', { uid: uuid() })), 'tecnica_propria_fixa');
await upsert(ids[2], ana, 'techniques', { uid: 'x' }, true); // como o sync apaga: dados só com o uid
const apagada = (await pg.query('select dados from public.registros where id = $1', [ids[2]])).rows[0].dados;
ok('apagar pelo sync mantém o propria (continua contando)', [apagada.propria, await contar(ana)], [1, 100]);
ok('desapagar sem propria é recusado', await tenta(() => upsert(ids[2], ana, 'techniques', { uid: 'x', nome: 'x' })), 'tecnica_propria_fixa');

/* lote de uma vez (o sync manda até 100 num upsert só) */
await como(bia);
const lote = (n) => pg.query(
  `insert into public.registros (id, user_id, tabela, dados)
   select gen_random_uuid(), $1, 'techniques', jsonb_build_object('uid', gen_random_uuid()::text, 'nome', 'L' || i, 'propria', 1)
   from generate_series(1, $2) i`, [bia, n]);
ok('outra conta não é afetada pela cota cheia da primeira', await tenta(() => lote(LIMITE_TECNICAS_PROPRIAS)), 'aceito');
await pg.exec("delete from public.registros where tabela = 'techniques' and dados->>'nome' like 'L%'"); // não apaga: própria
ok('delete de técnica própria não apaga nada', await contar(bia), 100);
await pg.exec('reset role');
await pg.query("delete from public.registros where user_id = $1", [bia]); // limpa como dono (fora da RLS)
await pg.exec('set role authenticated');
ok('um lote de 101 num comando só é recusado inteiro', [await tenta(() => lote(101)), await contar(bia)], ['limite_tecnicas', 0]);

/* catálogo */
const doCatalogo = CATALOGO_TECNICAS[0];
const idS2 = idNaNuvem('techniques', doCatalogo.uid, bia);
ok('técnica do catálogo sem propria passa (S2: id da linha ≠ uid)',
  [idS2 !== doCatalogo.uid, await tenta(() => upsert(idS2, bia, 'techniques', { uid: doCatalogo.uid, nome: doCatalogo.nome, favorita: 1 }))], [true, 'aceito']);
ok('linha antiga do catálogo (id = uid) passa', await tenta(() => upsert(CATALOGO_TECNICAS[1].uid, bia, 'techniques', { uid: CATALOGO_TECNICAS[1].uid, nome: 'x' })), 'aceito');
ok('uid de nome antigo (renomeios) passa', await tenta(() => upsert(uuid(), bia, 'techniques', { uid: uidEstavel(chaveNome('techniques', 'Short choke')), nome: 'x' })), 'aceito');
ok('técnica sem propria e fora do catálogo é recusada', await tenta(() => upsert(uuid(), bia, 'techniques', { uid: uuid(), nome: 'Falsa' })), 'tecnica_fora_do_catalogo');
ok('técnica sem uid e sem propria é recusada', await tenta(() => upsert(uuid(), bia, 'techniques', { nome: 'Falsa' })), 'tecnica_fora_do_catalogo');
ok('apagar uma técnica que nunca subiu passa (o sync manda só o uid)', await tenta(() => upsert(uuid(), bia, 'techniques', { uid: uuid() }, true)), 'aceito');

/* tamanhos */
const nome = (n) => 'a'.repeat(n);
ok(`nome com ${NOME_TECNICA_MAX} passa`, await tenta(() => upsert(uuid(), bia, 'techniques', propria(0, { nome: nome(NOME_TECNICA_MAX) }))), 'aceito');
ok(`nome com ${NOME_TECNICA_MAX + 1} é recusado`, await tenta(() => upsert(uuid(), bia, 'techniques', propria(0, { nome: nome(NOME_TECNICA_MAX + 1) }))), 'tecnica_nome_longo');
ok(`detalhes com ${DETALHES_TECNICA_MAX} passa`, await tenta(() => upsert(uuid(), bia, 'techniques', propria(0, { detalhes: nome(DETALHES_TECNICA_MAX) }))), 'aceito');
ok(`detalhes com ${DETALHES_TECNICA_MAX + 1} é recusado`, await tenta(() => upsert(uuid(), bia, 'techniques', propria(0, { detalhes: nome(DETALHES_TECNICA_MAX + 1) }))), 'tecnica_detalhes_longo');
ok('nome com acento conta letra, não byte', await tenta(() => upsert(uuid(), bia, 'techniques', propria(0, { nome: 'ã'.repeat(NOME_TECNICA_MAX) }))), 'aceito');
/* linha antiga longa (gravada antes da regra) não trava a edição de outro campo */
await pg.exec('reset role');
const longa = uuid();
await pg.exec('alter table public.registros disable trigger registros_cota_tecnicas');
await upsert(longa, bia, 'techniques', propria(0, { detalhes: nome(DETALHES_TECNICA_MAX + 50) }));
await pg.exec('alter table public.registros enable trigger registros_cota_tecnicas');
await pg.exec('set role authenticated');
const velha = (await pg.query('select dados from public.registros where id = $1', [longa])).rows[0].dados;
ok('linha antiga longa: editar outro campo passa', await tenta(() => upsert(longa, bia, 'techniques', { ...velha, favorita: 1 })), 'aceito');

/* tabelas */
ok('tabela fora da lista é recusada em linha nova', await tenta(() => upsert(uuid(), bia, 'inventada', { uid: uuid() })), 'new row for relation "registros" violates check constraint "registros_tabela_valida"');
ok('settings passa (id = conta)', await tenta(() => upsert(bia, bia, TABELA_AJUSTES, { nome: 'Bia' })), 'aceito');
ok('propria em outra tabela é recusado', await tenta(() => upsert(uuid(), bia, 'rolls', { uid: uuid(), propria: 1 })), 'propria_fora_de_techniques');

/* delete e RLS */
const rola = uuid();
await upsert(rola, bia, 'rolls', { uid: uuid() });
await pg.query('delete from public.registros where id = $1', [rola]);
ok('delete de outra tabela continua valendo', (await pg.query('select count(*)::int n from public.registros where id = $1', [rola])).rows[0].n, 0);
await pg.query('delete from public.registros where id = $1', [idS2]);
ok('delete de técnica do catálogo continua valendo', (await pg.query('select count(*)::int n from public.registros where id = $1', [idS2])).rows[0].n, 0);

const rolaBia = uuid();
await upsert(rolaBia, bia, 'rolls', { uid: uuid() });
await como(ana);
ok('RLS: a Ana não vê nada da Bia', (await pg.query('select count(*)::int n from public.registros where user_id = $1', [bia])).rows[0].n, 0);
ok('RLS: a Ana não grava em nome da Bia', await tenta(() => upsert(uuid(), bia, 'rolls', { uid: uuid() })), 'new row violates row-level security policy for table "registros"');
ok('RLS: a Ana não sobrescreve a linha da Bia pelo id', await tenta(() => upsert(rolaBia, ana, 'rolls', { uid: uuid() })), 'new row violates row-level security policy (USING expression) for table "registros"');
await pg.query('delete from public.registros where id = $1', [longa]);
await pg.exec('reset role');
ok('RLS: a Ana não apaga a linha da Bia', (await pg.query('select count(*)::int n from public.registros where id = $1', [longa])).rows[0].n, 1);
ok('a Ana continua com 100', await contar(ana), 100);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
