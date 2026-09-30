import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { ofensivaSemanal, somarDiasOfensiva as add } from '../src/lib/ofensivaSemanal.js';

const pg = new PGlite();
await pg.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users(id uuid,email text);
  create schema cron; create table cron.job(jobname text,schedule text);
  create schema vault; create table vault.secrets(name text);
  create function public.sou_admin() returns boolean language sql as $$ select true $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
  create function public.semana_de(d date) returns date language sql immutable as $$ select d-(extract(isodow from d)::int-1) $$;
  create function public.hoje_br() returns date language sql stable as $$ select '2026-09-27'::date $$;
  create function public.semana_atual() returns date language sql stable as $$ select public.semana_de(public.hoje_br()) $$;
  create table public.perfil(user_id uuid primary key,nome text,faixa text default 'branca',graus int default 0,sequencia int default 999,participa_liga boolean default true,notificar boolean default true,criado_em timestamptz default now());
  create table public.total_xp(user_id uuid,divisao text);
  create table public.registros(user_id uuid,tabela text,dados jsonb,deleted_at timestamptz);
  create table public.push_inscricao(user_id uuid,endpoint text,p256dh text,auth text,fuso text,falhas int default 0);
  create table public.notificacao_envio(user_id uuid,tipo text,dia date,enviado_em timestamptz,respondeu boolean);
  create table public.pontos(user_id uuid,data date,evento text);
  create table public.liga(id int,semana date,comecou_em timestamptz);
  create table public.liga_membro(user_id uuid,liga_id int);
  create table public.liga_fechamento(semana date);
  create function public.nome_publico(p public.perfil) returns text language sql as $$ select p.nome $$;
  create function public.ajuste_de(text,int) returns int language sql as $$ select $2 $$;
  create function public.hora_da_pessoa(uuid,text) returns int language sql as $$ select 18 $$;
  create function public.minha_liga() returns table(user_id uuid,sequencia int) language sql as $$ select user_id,sequencia from perfil where auth.uid() is not null $$;
  create function public.meus_amigos() returns table(user_id uuid,sequencia int) language sql as $$ select user_id,sequencia from perfil where auth.uid() is not null $$;
  create function public.perfil_na_liga(p_user uuid) returns table(nome text,sequencia int) language sql as $$ select nome,sequencia from perfil where user_id=p_user and p_user=auth.uid() $$;
`);
const sql = await fs.readFile(new URL('../supabase/26-ofensiva-semanal.sql', import.meta.url), 'utf8');
await pg.exec(sql);
await pg.exec(sql); // reexecução segura
await pg.exec('alter table public.registros add column id uuid default gen_random_uuid()');
const sqlMetas = await fs.readFile(new URL('../supabase/29-notificacoes-metas.sql', import.meta.url), 'utf8');
await pg.exec(sqlMetas);
await pg.exec(sqlMetas); // reexecução segura
const inicio='2026-06-01';
let casos=0;
async function comparar(sessoes,hoje,lesoes=[],max=2,rolls=[]) {
  const js=ofensivaSemanal(sessoes,hoje,lesoes,{maxEscudos:max,rolls});
  const {rows}=await pg.query('select public.calcular_ofensiva_semanal($1,$2,$3,$4) as valor',[JSON.stringify(sessoes),JSON.stringify(lesoes),hoje,max]);
  assert.deepEqual(rows[0].valor,js); casos++;
}
for(let n=0;n<=17;n++) {
  const sessoes=Array.from({length:n},(_,i)=>({id:i+1,data:add(inicio,i*7),tipo:'gi'}));
  for(const max of [2,3]) for(const buraco of [0,1,2,4]) {
    await comparar(sessoes,add(inicio,(Math.max(0,n-1)+buraco)*7),[],max);
    await comparar(sessoes,add(inicio,(Math.max(0,n-1)+buraco)*7),[{data:add(inicio,Math.max(0,n)*7),impacto:'parado'}],max);
  }
}
await comparar([{id:1,data:inicio,tipo:'competicao'}],inicio);
await comparar([{id:1,data:inicio,tipo:'competicao'}],inicio,[],2,[{sessionId:1,adversario:'Pessoa'}]);
await comparar([{data:'2026-02-30'},{data:'2027-01-01'},{data:inicio,evento:'aula'}],inicio);
await comparar([{data:inicio}],add(inicio,14),[{data:add(inicio,9),dataCura:add(inicio,10),impacto:'parado'}]);
const user='00000000-0000-0000-0000-000000000001';
await pg.query('insert into perfil(user_id,nome) values($1,$2)',[user,'Teste']);
await pg.query('insert into auth.users(id,email) values($1,$2)',[user,'teste@example.invalid']);
await pg.query('insert into registros(user_id,tabela,dados) values($1,$2,$3)',[user,'sessions',JSON.stringify({id:1,data:'2026-09-21',tipo:'gi'})]);
const metaFrequencia='00000000-0000-0000-0000-000000000101';
const metaManual='00000000-0000-0000-0000-000000000102';
await pg.query('insert into registros(id,user_id,tabela,dados) values($1,$2,$3,$4)',
  [metaFrequencia,user,'goals',JSON.stringify({tipo:'frequencia',titulo:'Treinar 3x',alvo:3,status:'ativa',origem:'usuario'})]);
let meta=(await pg.query('select public.proxima_meta_para_aviso($1,$2) as valor',[user,'2026-09-25'])).rows[0].valor;
assert.equal(meta.tipo,`meta:${metaFrequencia}`);
assert.match(meta.corpo,/1 de 3 treinos/);
assert.equal((await pg.query('select public.proxima_meta_para_aviso($1,$2) as valor',[user,'2026-09-22'])).rows[0].valor,null);
await pg.query('insert into registros(id,user_id,tabela,dados) values($1,$2,$3,$4)',
  [metaManual,user,'goals',JSON.stringify({tipo:'manual',titulo:'Alongar 5x',alvo:5,contador:2,status:'ativa',origem:'confirmada'})]);
await pg.query('insert into notificacao_envio(user_id,tipo,dia,enviado_em,respondeu) values($1,$2,$3,now(),false)',
  [user,`meta:${metaFrequencia}`,'2026-09-25']);
meta=(await pg.query('select public.proxima_meta_para_aviso($1,$2) as valor',[user,'2026-09-29'])).rows[0].valor;
assert.equal(meta.tipo,`meta:${metaManual}`);
assert.match(meta.corpo,/2 de 5/);
await pg.query("update registros set dados=jsonb_set(dados,'{status}','\"concluida\"'::jsonb) where id=$1",[metaManual]);
assert.equal((await pg.query('select public.proxima_meta_para_aviso($1,$2) as valor',[user,'2026-09-29'])).rows[0].valor,null);
await pg.exec(`set test.uid='${user}'`);
assert.equal((await pg.query('select public.minha_ofensiva_semanal() as o')).rows[0].o.semanas,1);
assert.equal((await pg.query('select * from public.ranking_ofensivas_semanais()')).rows[0].semanas,1);
assert.equal((await pg.query('select * from public.minha_liga_semanal()')).rows[0].minha_liga_semanal.sequencia,1);
assert.equal((await pg.query('select * from public.perfil_na_liga_semanal($1)',[user])).rows[0].perfil_na_liga_semanal.sequencia,1);
assert.equal((await pg.query('select * from public.perfil_na_liga_semanal($1)',['00000000-0000-0000-0000-000000000002'])).rows.length,0);
assert.equal((await pg.query('select sequencia from perfil')).rows[0].sequencia,999);
const diagnostico=(await pg.query('select * from public.diagnostico_de_aviso($1)',['teste@example.invalid'])).rows;
assert.equal(diagnostico.length,9);
assert.match(diagnostico.find(r=>r.elo.startsWith('4.')).detalhe,/1 semanas/);
await pg.exec("set test.uid='';");
assert.equal((await pg.query('select * from public.ranking_ofensivas_semanais()')).rows.length,0);
assert.equal((await pg.query('select public.minha_ofensiva_semanal() as o')).rows[0].o,null);
await pg.query('select * from public.fila_de_notificacao()');
for(const role of ['anon','authenticated']) {
  assert.equal((await pg.query("select has_function_privilege($1,'public.ofensiva_semanal_de(uuid)','EXECUTE') as pode",[role])).rows[0].pode,false);
}
// O registro excluído deixa de contar sem depender de abrir o aplicativo.
await pg.exec(`set test.uid='${user}'; update registros set deleted_at=now();`);
assert.equal((await pg.query('select public.minha_ofensiva_semanal() as o')).rows[0].o.semanas,0);
if (process.argv.includes('--gerar-verificacao')) {
  const { rows } = await pg.query(`select p.oid::regprocedure::text as assinatura,
    md5(replace(p.prosrc,chr(13),'')) as hash
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'data_ofensiva','calcular_ofensiva_semanal','ofensiva_semanal_de',
      'minha_ofensiva_semanal','minha_liga_semanal','meus_amigos_semanal',
      'perfil_na_liga_semanal','ranking_ofensivas_semanais','fila_de_notificacao','diagnostico_de_aviso')
    order by p.proname`);
  const valores=rows.map(r=>`  ('${r.assinatura}', '${r.hash}')`).join(',\n');
  const verificacao=`-- SOMENTE LEITURA. Execute depois do SQL 26 e envie as linhas do resultado.
-- Cada linha deve indicar ok=true. Confere a versão exata das funções instaladas.
with esperado(assinatura,hash) as (values
${valores}
)
select e.assinatura as verificacao,
  coalesce(md5(replace(p.prosrc,chr(13),''))=e.hash,false) as ok
from esperado e left join pg_proc p on p.oid=to_regprocedure(e.assinatura)
union all
select 'privacidade: calculo interno bloqueado ao cliente',
  not has_function_privilege('authenticated','public.ofensiva_semanal_de(uuid)','EXECUTE')
union all
select 'acesso: ranking semanal liberado a autenticados',
  has_function_privilege('authenticated','public.ranking_ofensivas_semanais()','EXECUTE')
union all
select 'acesso: ranking semanal bloqueado a anonimos',
  not has_function_privilege('anon','public.ranking_ofensivas_semanais()','EXECUTE')
order by 1;
`;
  await fs.writeFile(new URL('../supabase/27-verificar-ofensiva-semanal.sql',import.meta.url),verificacao);
}
await pg.close();
console.log(`${casos} comparações JS/PostgreSQL aprovadas; migração, reexecução, permissões e consultas verificadas.`);
