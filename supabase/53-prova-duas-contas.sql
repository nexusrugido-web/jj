-- 53: PROVA, DUAS CONTAS MARCANDO A MESMA TÉCNICA DA BIBLIOTECA
--
-- Não grava nada: tudo roda dentro de uma transação que termina em
-- rollback. Usa as duas contas mais antigas do projeto só como
-- identidade (nenhum dado delas é lido nem alterado).
--
-- Faz o que o app faz quando dois atletas marcam a mesma técnica da
-- biblioteca: as duas contas mandam o mesmo id para a tabela
-- registros, com a regra de segurança (RLS) ligada, como no celular.
--
-- Resultado esperado se o problema existe:
--   conta A: subiu | conta B: recusado: new row violates row-level security policy ...
--
-- Cole no SQL Editor do Supabase e rode.

begin;

create function pg_temp.marcar(conta uuid) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', conta::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.registros (id, user_id, tabela, dados)
  values ('5e5e5e5e-0053-4053-a053-000000000053', conta, 'techniques', '{"nome": "Prova 53", "status": "aprendendo"}')
  on conflict (id) do update set dados = excluded.dados;
  execute 'reset role';
  return 'subiu';
exception when others then
  return 'recusado: ' || sqlerrm;
end $$;

create function pg_temp.prova() returns text language plpgsql as $$
declare
  a uuid := (select id from auth.users order by created_at limit 1);
  b uuid := (select id from auth.users order by created_at offset 1 limit 1);
  ra text; rb text;
begin
  if b is null then return 'precisa de pelo menos duas contas no projeto'; end if;
  ra := pg_temp.marcar(a);
  rb := pg_temp.marcar(b);
  return 'conta A: ' || ra || ' | conta B: ' || rb;
end $$;

select pg_temp.prova() as resultado;

rollback;
