-- ============================================================
-- TATAME OS, COMPRA AVULSA DE AULA
--
-- A assinatura libera a biblioteca. Um video pode ser vendido
-- separado dela, e ai precisa existir um lugar que diga quem
-- comprou o que. Sem esta tabela o terceiro nivel do plano,
-- o assinante que comprou um extra, nao tem como funcionar.
--
-- Quem grava aqui e o n8n, com a service_role, a partir do
-- webhook da Hotmart. O app so le, e so as proprias linhas.
--
-- Rode no SQL Editor do Supabase, depois de aulas.sql
-- ============================================================

create table if not exists public.compra_aula (
  user_id    uuid not null references auth.users(id) on delete cascade,
  aula_id    text not null references public.aula(id) on delete cascade,
  transacao  text,
  origem     text not null default 'hotmart',
  criado_em  timestamptz not null default now(),
  primary key (user_id, aula_id)
);

create index if not exists compra_aula_user on public.compra_aula (user_id);

alter table public.compra_aula enable row level security;

-- voce ve so o que voce comprou. Ninguem escreve pelo app.
drop policy if exists compra_leitura on public.compra_aula;
create policy compra_leitura on public.compra_aula
  for select to authenticated using (user_id = auth.uid());
-- sem policy de insert de proposito: so a service_role grava.


-- ------------------------------------------------------------
-- O QUE EU JA COMPREI
--
-- O app guarda esta lista no aparelho pra continuar sabendo o
-- que esta liberado quando faltar rede.
-- ------------------------------------------------------------
create or replace function public.minhas_compras()
returns setof text
language sql stable security definer set search_path = public as $$
  select aula_id from public.compra_aula where user_id = auth.uid();
$$;

grant execute on function public.minhas_compras() to authenticated;


-- ------------------------------------------------------------
-- REGISTRAR UMA COMPRA AVULSA
--
-- O n8n chama isto quando a Hotmart avisa que alguem comprou um
-- video. O produto da Hotmart precisa carregar o id do video do
-- YouTube, que e a chave que o app usa.
-- ------------------------------------------------------------
create or replace function public.registrar_compra_aula(
  p_email     text,
  p_aula_id   text,
  p_transacao text default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user is null then return false; end if;
  if not exists (select 1 from public.aula where id = p_aula_id) then return false; end if;

  insert into public.compra_aula (user_id, aula_id, transacao)
  values (v_user, p_aula_id, p_transacao)
  on conflict (user_id, aula_id) do nothing;

  return true;
end $$;

revoke all on function public.registrar_compra_aula(text, text, text) from public, authenticated;
-- so a service_role (o n8n) executa.


-- ------------------------------------------------------------
-- CONFERIR
--
-- select * from public.compra_aula;
-- select public.registrar_compra_aula('voce@email.com', 'ID_DO_VIDEO');
-- ------------------------------------------------------------
