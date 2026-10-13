import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

/* ============================================================
   AULA PAGA NÃO VAZA

   A lista pública e a tabela não podem entregar o vídeo do YouTube
   de aula do Premium ou vendida à parte. O vídeo só sai pra quem
   pode ver. Roda o SQL 49 de verdade num Postgres em memória.
   ============================================================ */
const pg = new PGlite();
await pg.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
  create table public.aula (
    id text primary key, titulo text, duracao int, tipo text, temas text[] default '{}', posicoes text[] default '{}', faixa text,
    acesso text default 'todos', destaque boolean default false, ordem int, descricao text, capa_url text, checkout_url text,
    posicao_lado text[], habilidades text[], tecnicas text[], situacoes text[], formato text, nivel text, classificacao text,
    ativo boolean default true, atualizado_em timestamptz default now(), vertical boolean);
  alter table public.aula enable row level security;
  grant select on public.aula to anon, authenticated;
  create table public.compra_aula (user_id uuid, aula_id text);
  create table public.chave (id text primary key, ligada boolean);
  create table public.presente_premium (user_id uuid primary key, fim timestamptz);
  create table public.assinante (user_id uuid primary key);
  create function public.tem_premium(p uuid) returns boolean language sql stable as $$ select exists (select 1 from public.assinante where user_id = p) $$;
  create function public.sou_admin() returns boolean language sql stable as $$ select current_setting('teste.admin', true) = 'sim' $$;
  insert into public.chave values ('cobranca', true);
  insert into public.aula (id, titulo, duracao, tipo, acesso) values
    ('GRATIS12345', 'Aula grátis', 300, 'aula', 'todos'),
    ('PREMIUM1234', 'Aula do Premium', 600, 'aula', 'assinantes'),
    ('PARTICULAR1', 'Aula particular', 900, 'aula', 'avulso');
`);
const sql = await fs.readFile(new URL('../supabase/49-aulas-pagas-protegidas.sql', import.meta.url), 'utf8');
await pg.exec(sql);
await pg.exec(sql); // reexecução segura

const quem = async (uid) => pg.exec(`set teste.uid = '${uid || ''}'`);
const ASSINANTE = '00000000-0000-0000-0000-000000000001';
const COMPRADOR = '00000000-0000-0000-0000-000000000002';
const PRESENTE = '00000000-0000-0000-0000-000000000003';
const NINGUEM = '00000000-0000-0000-0000-000000000004';
await pg.query('insert into public.assinante values ($1)', [ASSINANTE]);
await pg.query("insert into public.compra_aula values ($1, 'PARTICULAR1')", [COMPRADOR]);
await pg.query("insert into public.presente_premium values ($1, now() + interval '3 days')", [PRESENTE]);

const lista = (await pg.query('select id, acesso from public.acervo_desde(null)')).rows;
const chave = (acesso) => lista.find((l) => l.acesso === acesso).id;
assert.equal(chave('todos'), 'GRATIS12345', 'a grátis continua com o id do YouTube');
assert.ok(!lista.some((l) => ['PREMIUM1234', 'PARTICULAR1'].includes(l.id)), 'a lista não entrega o vídeo de aula paga');
assert.match(chave('assinantes'), /^p[0-9a-f]{15}$/);

const abrir = async (uid, c) => { await quem(uid); return (await pg.query('select public.abrir_aula($1) as v', [c])).rows[0].v; };
assert.equal(await abrir(NINGUEM, chave('todos')), 'GRATIS12345', 'grátis abre pra todo mundo');
assert.equal(await abrir(NINGUEM, chave('assinantes')), null, 'sem Premium a aula do Premium não abre');
assert.equal(await abrir(null, chave('assinantes')), null, 'sem conta também não');
assert.equal(await abrir(ASSINANTE, chave('assinantes')), 'PREMIUM1234', 'assinante abre a do Premium');
assert.equal(await abrir(PRESENTE, chave('assinantes')), 'PREMIUM1234', 'o presente de 7 dias abre a do Premium');
assert.equal(await abrir(ASSINANTE, chave('avulso')), null, 'a vendida à parte não entra na assinatura');
assert.equal(await abrir(COMPRADOR, chave('avulso')), 'PARTICULAR1', 'quem comprou abre a dele');
await pg.exec("update public.presente_premium set fim = now() - interval '1 day'");
assert.equal(await abrir(PRESENTE, chave('assinantes')), null, 'presente vencido não abre');

await quem(COMPRADOR);
assert.deepEqual((await pg.query('select public.minhas_compras() as c')).rows.map((r) => r.c), [chave('avulso')], 'a compra volta na chave da lista');

await pg.exec("update public.chave set ligada = false");
assert.equal(await abrir(NINGUEM, chave('assinantes')), 'PREMIUM1234', 'cobrança desligada: nada é pago ainda');
await pg.exec("update public.chave set ligada = true");

/* a tabela direta */
await quem(NINGUEM);
await pg.exec('set role anon');
assert.deepEqual((await pg.query('select id from public.aula order by id')).rows.map((r) => r.id), ['GRATIS12345'], 'o visitante lê só a grátis na tabela');
await pg.exec('reset role');
await pg.exec("set teste.admin = 'sim'; set role authenticated");
assert.equal((await pg.query('select count(*)::int as n from public.aula')).rows[0].n, 3, 'quem administra vê tudo');
await pg.exec('reset role');

await pg.close();
console.log('aulas pagas protegidas: lista, abrir, compras e tabela conferidas');
