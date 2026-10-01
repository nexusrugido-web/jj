import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

/* ============================================================
   PREMIUM DE PRESENTE E FUNIL (SQL 41)

   7 dias, uma vez por conta, só pra quem nunca assinou; o
   meu_acesso responde "presente" enquanto vale e "presente_acabou"
   depois; assinatura de verdade passa na frente do presente.
   ============================================================ */
const pg = new PGlite();
await pg.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
  create function public.hoje_br() returns date language sql stable as $$ select current_date $$;
  create function public.sou_admin() returns boolean language sql as $$ select current_setting('test.admin',true)='on' $$;
  create table public.assinatura(id bigserial primary key, user_id uuid, email_compra text not null default 'x',
    plano text, status text not null default 'ativa', vence_em timestamptz, carencia_ate timestamptz,
    criado_em timestamptz not null default now());
`);
const sql = await fs.readFile(new URL('../supabase/41-presente-e-funil.sql', import.meta.url), 'utf8');
await pg.exec(sql);
await pg.exec(sql); // reexecução segura

const novo = '00000000-0000-0000-0000-00000000a001';
const assinante = '00000000-0000-0000-0000-00000000a002';
await pg.query('insert into auth.users values ($1),($2)', [novo, assinante]);
const como = (u) => pg.exec(`set test.uid='${u}'`);
const acesso = async () => (await pg.query('select * from public.meu_acesso()')).rows[0];
let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

await como(novo);
ok('conta nova começa no grátis', (await acesso()).status, 'sem_assinatura');
let r = (await pg.query('select public.ganhar_presente() as v')).rows[0].v;
ok('primeiro treino: ganha o presente', r.ganhou, true);
let a = await acesso();
ok('com o presente, é Premium', [a.premium, a.status, a.plano], [true, 'presente', 'Presente de 7 dias']);
ok('o presente vale 7 dias', Math.round((new Date(a.vence_em) - Date.now()) / 86400000), 7);
r = (await pg.query('select public.ganhar_presente() as v')).rows[0].v;
ok('pedir de novo não dá outro presente', r.ganhou, false);
await pg.exec("update presente_premium set fim = now() - interval '1 day'");
a = await acesso();
ok('acabou: volta pro grátis, avisando', [a.premium, a.status], [false, 'presente_acabou']);
await pg.query("insert into assinatura(user_id, plano, status, vence_em) values ($1, 'Mensal', 'ativa', now() + interval '30 days')", [novo]);
a = await acesso();
ok('assinou depois do presente: vale a assinatura', [a.premium, a.status], [true, 'ativa']);

await pg.query("insert into assinatura(user_id, plano, status, vence_em) values ($1, 'Mensal', 'expirada', now() - interval '3 days')", [assinante]);
await como(assinante);
ok('quem já assinou não ganha presente', (await pg.query('select public.ganhar_presente() as v')).rows[0].v, null);

await pg.query("select public.marcar_funil('oferta_vista', 'analise')");
await pg.query("select public.marcar_funil('oferta_vista', 'analise')");
await pg.query("select public.marcar_funil('passo_inventado', 'x')");
await pg.exec("set test.admin='on'");
const f = (await pg.query('select public.funil_premium(30) as v')).rows[0].v;
ok('funil: a mesma oferta no mesmo dia conta 1 vez', f.ofertas.map((x) => [x.recurso, x.pessoas]), [['analise', 1]]);
ok('funil: passo que não existe não entra', Object.keys(f.passos).sort(), ['oferta_vista', 'presente']);
ok('funil: compras e ativos', [f.compras, f.ativos], [2, 1]);
await pg.exec("set test.admin='off'");
await assert.rejects(pg.query('select public.funil_premium(30)'), /administrador/);
console.log('ok    funil só pro admin');

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
