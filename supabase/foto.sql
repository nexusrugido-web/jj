-- ============================================================
-- A FOTO DE PERFIL NA LIGA
--
-- Cada um pode subir a própria foto. Ela aparece pro grupo da
-- liga no pódio, na lista e no perfil. Sem foto, o app desenha as
-- iniciais do nome ou do apelido.
--
-- Quem escolheu aparecer como "Anônimo" (sem apelido) não mostra
-- foto: a foto entregaria quem é.
--
-- A coluna perfil.avatar_url já existe (comunidade.sql). Aqui entram
-- o lugar das fotos e as duas funções da liga devolvendo a foto.
-- Pode rodar de novo sem estragar nada.
-- ============================================================


-- ------------------------------------------------------------
-- 1. ONDE AS FOTOS MORAM
--
-- Público pra leitura, porque a foto é pra ser vista pelo grupo e
-- o endereço já é o que vai pro perfil. Cada um só grava, troca e
-- apaga dentro da pasta com o próprio id. Até 2 MB, só imagem (o
-- app já reduz pra 256 px antes de mandar).
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatares_insert" on storage.objects;
create policy "avatares_insert" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatares_update" on storage.objects;
create policy "avatares_update" on storage.objects for update
  to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatares_delete" on storage.objects;
create policy "avatares_delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- ------------------------------------------------------------
-- 2. A FOTO QUE PODE APARECER
-- ------------------------------------------------------------
create or replace function public.foto_publica(p public.perfil)
returns text language sql stable as $$
  select case
    when p.anonimo and nullif(trim(p.apelido), '') is null then null
    else nullif(trim(p.avatar_url), '')
  end;
$$;


-- ------------------------------------------------------------
-- 3. O MEU GRUPO, AGORA COM A FOTO
--
-- Igual ao de liga-automatica.sql, com a coluna foto no fim. Mudar
-- o que a função devolve exige apagar e criar de novo.
-- ------------------------------------------------------------
drop function if exists public.minha_liga();

create or replace function public.minha_liga()
returns table (
  posicao        bigint,
  user_id        uuid,
  nome           text,
  faixa          text,
  graus          int,
  xp_semana      int,
  sou_eu         boolean,
  divisao        text,
  total          bigint,
  divisao_pessoa text,
  sequencia      int,
  treinos_semana int,
  comecou        boolean,
  saindo         boolean,
  foto           text
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_liga bigint;
begin
  if v_user is null then return; end if;

  select m.liga_id into v_liga
  from public.liga_membro m join public.liga l on l.id = m.liga_id
  where m.user_id = v_user and l.semana = public.semana_atual()
  limit 1;

  if v_liga is null then return; end if;

  return query
  select
    rank() over (order by m.xp_semana desc, m.entrou_em)::bigint,
    p.user_id,
    public.nome_publico(p),
    p.faixa,
    p.graus,
    m.xp_semana,
    (p.user_id = v_user),
    l.divisao,
    (select count(*) from public.liga_membro where liga_id = v_liga)::bigint,
    coalesce(t.divisao, 'branca'),
    p.sequencia,
    p.treinos_semana,
    l.comecou_em is not null,
    (p.user_id = v_user and not p.participa_liga),
    public.foto_publica(p)
  from public.liga_membro m
  join public.perfil p on p.user_id = m.user_id
  join public.liga l on l.id = m.liga_id
  left join public.total_xp t on t.user_id = m.user_id
  where m.liga_id = v_liga
  order by m.xp_semana desc, m.entrou_em;
end $$;

grant execute on function public.minha_liga() to authenticated;


-- ------------------------------------------------------------
-- 4. O PERFIL DE QUEM ESTÁ NO MEU GRUPO, COM A FOTO
-- ------------------------------------------------------------
drop function if exists public.perfil_na_liga(uuid);

create or replace function public.perfil_na_liga(p_user uuid)
returns table (
  nome           text,
  faixa          text,
  graus          int,
  divisao        text,
  sequencia      int,
  treinos_semana int,
  xp_semana      int,
  total          int,
  semanas        bigint,
  desde          date,
  foto           text
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;

  if p_user <> v_user and not exists (
    select 1
    from public.liga_membro eu
    join public.liga l on l.id = eu.liga_id and l.semana = public.semana_atual()
    join public.liga_membro ele on ele.liga_id = eu.liga_id and ele.user_id = p_user
    where eu.user_id = v_user
  ) then
    return;
  end if;

  return query
  select
    public.nome_publico(p),
    p.faixa,
    p.graus,
    coalesce(t.divisao, 'branca'),
    p.sequencia,
    p.treinos_semana,
    coalesce((
      select m.xp_semana from public.liga_membro m
      join public.liga l on l.id = m.liga_id
      where m.user_id = p_user and l.semana = public.semana_atual() limit 1
    ), 0),
    coalesce(t.total, 0),
    (select count(distinct l.semana) from public.liga_membro m
     join public.liga l on l.id = m.liga_id where m.user_id = p_user),
    (select min(l.semana) from public.liga_membro m
     join public.liga l on l.id = m.liga_id where m.user_id = p_user),
    public.foto_publica(p)
  from public.perfil p
  left join public.total_xp t on t.user_id = p.user_id
  where p.user_id = p_user;
end $$;

grant execute on function public.perfil_na_liga(uuid) to authenticated;
