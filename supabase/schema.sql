-- ============================================================
-- TATAME OS — schema Supabase
-- Cole isto INTEIRO no SQL Editor do Supabase e rode uma vez.
-- Cada usuario so enxerga os proprios dados (RLS).
-- ============================================================

-- ---------- helper: updated_at automatico ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- tabela generica de sincronizacao ----------
-- Estrategia: cada "tabela" do app vira uma linha aqui com o
-- conteudo em jsonb. Isso mantem a flexibilidade total do app
-- (voce cria campos novos sem migration) e simplifica o sync.
create table if not exists public.registros (
  id           uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  tabela       text not null,
  dados        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists registros_user_idx        on public.registros (user_id);
create index if not exists registros_user_upd_idx    on public.registros (user_id, updated_at desc);
create index if not exists registros_user_tab_idx    on public.registros (user_id, tabela);
create index if not exists registros_dados_gin       on public.registros using gin (dados);

drop trigger if exists registros_touch on public.registros;
create trigger registros_touch before update on public.registros
  for each row execute function public.touch_updated_at();

alter table public.registros enable row level security;

drop policy if exists registros_select on public.registros;
create policy registros_select on public.registros for select
  to authenticated using ((select auth.uid()) = user_id);

drop policy if exists registros_insert on public.registros;
create policy registros_insert on public.registros for insert
  to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists registros_update on public.registros;
create policy registros_update on public.registros for update
  to authenticated using ((select auth.uid()) = user_id)
              with check ((select auth.uid()) = user_id);

drop policy if exists registros_delete on public.registros;
create policy registros_delete on public.registros for delete
  to authenticated using ((select auth.uid()) = user_id);


-- ---------- perfil ----------
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  faixa       text default 'branca',
  graus       int  default 0,
  academia    text,
  professor   text,
  peso_kg     numeric,
  altura_cm   numeric,
  nascimento  date,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists perfis_touch on public.perfis;
create trigger perfis_touch before update on public.perfis
  for each row execute function public.touch_updated_at();

alter table public.perfis enable row level security;

drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select
  to authenticated using ((select auth.uid()) = id);
drop policy if exists perfis_insert on public.perfis;
create policy perfis_insert on public.perfis for insert
  to authenticated with check ((select auth.uid()) = id);
drop policy if exists perfis_update on public.perfis;
create policy perfis_update on public.perfis for update
  to authenticated using ((select auth.uid()) = id)
              with check ((select auth.uid()) = id);

-- cria o perfil automaticamente ao cadastrar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------- midia (metadados; o arquivo vai pro Storage) ----------
create table if not exists public.midias (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  tipo        text not null default 'image',   -- image | video
  bucket      text not null default 'tatame',
  caminho     text not null,                    -- path dentro do bucket
  nome        text,
  tamanho     bigint,
  duracao_seg int,
  largura     int,
  altura      int,
  thumb       text,
  vinculo     jsonb not null default '{}'::jsonb, -- {tipo:'tecnica', id:'...'}
  marcas      jsonb not null default '[]'::jsonb, -- timestamps do video
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists midias_user_idx on public.midias (user_id);
drop trigger if exists midias_touch on public.midias;
create trigger midias_touch before update on public.midias
  for each row execute function public.touch_updated_at();

alter table public.midias enable row level security;
drop policy if exists midias_select on public.midias;
create policy midias_select on public.midias for select
  to authenticated using ((select auth.uid()) = user_id);
drop policy if exists midias_insert on public.midias;
create policy midias_insert on public.midias for insert
  to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists midias_update on public.midias;
create policy midias_update on public.midias for update
  to authenticated using ((select auth.uid()) = user_id)
              with check ((select auth.uid()) = user_id);
drop policy if exists midias_delete on public.midias;
create policy midias_delete on public.midias for delete
  to authenticated using ((select auth.uid()) = user_id);


-- ============================================================
-- STORAGE: bucket privado "tatame"
-- Rode isto DEPOIS de criar o bucket chamado "tatame" (privado)
-- no painel Storage. Cada usuario so acessa a pasta com o id dele.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('tatame', 'tatame', false)
on conflict (id) do nothing;

drop policy if exists "tatame_read" on storage.objects;
create policy "tatame_read" on storage.objects for select
  to authenticated
  using (bucket_id = 'tatame' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "tatame_insert" on storage.objects;
create policy "tatame_insert" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'tatame' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "tatame_update" on storage.objects;
create policy "tatame_update" on storage.objects for update
  to authenticated
  using (bucket_id = 'tatame' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "tatame_delete" on storage.objects;
create policy "tatame_delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'tatame' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============================================================
-- PRONTO. Depois disso:
-- 1) Authentication > Providers > ative Email e Google
-- 2) Authentication > URL Configuration:
--      Site URL: https://SEU-APP.vercel.app
--      Redirect URLs: https://SEU-APP.vercel.app/**  e  http://localhost:5173/**
-- ============================================================
