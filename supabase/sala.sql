-- ============================================================
-- A SALA: A LIGA COM OS SEUS AMIGOS
--
-- Um cria a sala e convida pelo link. Quem entra também pode
-- convidar. De 3 a 5 pessoas.
--
--   começa na segunda      a sala só vale numa semana se tiver 3
--                          pessoas que entraram ANTES daquela
--                          segunda. Montou na quarta, corre a partir
--                          da segunda seguinte.
--
--   no lugar da liga       na semana em que a sala vale, quem está
--                          nela corre no grupo da sala, e não num
--                          grupo automático. Sobe e desce igual, cada
--                          um a partir da própria divisão.
--
--   continua sozinha       toda segunda a sala corre de novo. Sair
--                          vale a partir da semana seguinte. Ficou
--                          com menos de 3, ela para e cada um volta
--                          pra liga automática.
--
-- Rode depois de foto.sql (8-SUPABASE-FOTO.sql). Pode rodar de novo.
-- ============================================================


-- ------------------------------------------------------------
-- 1. AS TABELAS
--
-- Ninguém lê as tabelas direto: tudo passa pelas funções abaixo,
-- que só mostram o que a liga já mostra.
-- ------------------------------------------------------------
create table if not exists public.sala (
  id        bigserial primary key,
  codigo    text not null unique,
  dono      uuid not null references auth.users(id) on delete cascade,
  criada_em timestamptz not null default now()
);

create table if not exists public.sala_membro (
  sala_id   bigint not null references public.sala(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  entrou_em timestamptz not null default now(),
  saiu_em   timestamptz,
  primary key (sala_id, user_id)
);
create index if not exists sala_membro_user on public.sala_membro (user_id);

alter table public.sala enable row level security;
alter table public.sala_membro enable row level security;

-- o grupo da semana que nasceu de uma sala
alter table public.liga add column if not exists sala_id bigint references public.sala(id) on delete set null;
create index if not exists liga_sala on public.liga (sala_id, semana);

create or replace function public.sala_minimo() returns int language sql immutable as $$ select 3 $$;
create or replace function public.sala_maximo() returns int language sql immutable as $$ select 5 $$;

-- a meia-noite de segunda em São Paulo, pra comparar com entrou_em
create or replace function public.inicio_da_semana(p_semana date)
returns timestamptz language sql immutable as $$
  select (p_semana::timestamp at time zone 'America/Sao_Paulo');
$$;


-- ------------------------------------------------------------
-- 2. A SALA DE ALGUÉM NUMA SEMANA
--
-- Devolve a sala só se a pessoa já estava nela antes daquela
-- segunda e se a sala tinha pelo menos 3 assim. Senão, null, e a
-- pessoa vai pra liga automática.
-- ------------------------------------------------------------
create or replace function public.sala_da_semana(p_user uuid, p_semana date)
returns bigint language sql stable security definer set search_path = public as $$
  with vale as (
    select m.sala_id, m.user_id
    from public.sala_membro m
    where m.entrou_em < public.inicio_da_semana(p_semana)
      and (m.saiu_em is null or m.saiu_em >= public.inicio_da_semana(p_semana))
  )
  select v.sala_id from vale v
  where v.user_id = p_user
    and (select count(*) from vale x where x.sala_id = v.sala_id) >= public.sala_minimo()
  limit 1;
$$;


-- ------------------------------------------------------------
-- 3. COLOCAR ALGUÉM NUM GRUPO, AGORA OLHANDO A SALA
--
-- Igual ao de liga-automatica.sql, com duas mudanças: quem tem
-- sala valendo vai pro grupo da sala, e os grupos de sala ficam
-- fora da escolha automática.
-- ------------------------------------------------------------
create or replace function public.colocar_na_liga(p_user uuid, p_semana date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_tam  int := greatest(2, public.ajuste_de('liga_tamanho', 10));
  v_div  text;
  v_freq int;
  v_liga bigint;
  v_sala bigint;
begin
  if not exists (select 1 from public.perfil where user_id = p_user and participa_liga) then
    return null;
  end if;
  if exists (select 1 from public.liga_fechamento where semana = p_semana) then
    return null;
  end if;

  select m.liga_id into v_liga
  from public.liga_membro m join public.liga l on l.id = m.liga_id
  where m.user_id = p_user and l.semana = p_semana
  limit 1;
  if v_liga is not null then return v_liga; end if;

  /* duas pessoas pontuando no mesmo instante nao podem abrir dois
     grupos sozinhos: uma espera a outra terminar */
  perform pg_advisory_xact_lock(hashtext('liga:' || p_semana::text));

  insert into public.total_xp (user_id) values (p_user) on conflict (user_id) do nothing;
  select coalesce(t.divisao, 'branca') into v_div from public.total_xp t where t.user_id = p_user;
  select p.treinos_semana into v_freq from public.perfil p where p.user_id = p_user;

  v_sala := public.sala_da_semana(p_user, p_semana);

  if v_sala is not null then
    select l.id into v_liga from public.liga l where l.semana = p_semana and l.sala_id = v_sala limit 1;
    if v_liga is null then
      insert into public.liga (semana, divisao, frequencia, sala_id)
      values (p_semana, v_div, v_freq, v_sala)
      returning id into v_liga;
    end if;
  else
    select g.id into v_liga
    from (
      select l.id, l.divisao, l.frequencia,
             (select count(*) from public.liga_membro x where x.liga_id = l.id) as n
      from public.liga l
      where l.semana = p_semana and l.sala_id is null
    ) g
    where g.n < v_tam
    order by
      (g.n = 1) desc,
      abs(coalesce(array_position(public.divisoes(), g.divisao), 1)
        - coalesce(array_position(public.divisoes(), v_div), 1)),
      case when v_freq is null or g.frequencia is null then 99 else abs(g.frequencia - v_freq) end,
      g.n desc,
      g.id
    limit 1;

    if v_liga is null then
      insert into public.liga (semana, divisao, frequencia)
      values (p_semana, v_div, v_freq)
      returning id into v_liga;
    end if;
  end if;

  insert into public.liga_membro (liga_id, user_id, xp_semana)
  values (v_liga, p_user, (
    select coalesce(sum(xp), 0) from public.pontos where user_id = p_user and semana = p_semana
  ))
  on conflict do nothing;

  update public.liga set comecou_em = now()
  where id = v_liga and comecou_em is null
    and (select count(*) from public.liga_membro where liga_id = v_liga) >= 2;

  return v_liga;
end $$;

revoke all on function public.colocar_na_liga(uuid, date) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4. CRIAR, ENTRAR E SAIR
--
-- Uma sala por pessoa. Entrar na sala liga a participação na
-- liga: quem aceitou convite quer correr.
-- ------------------------------------------------------------
create or replace function public.minha_sala_id(p_user uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select sala_id from public.sala_membro where user_id = p_user and saiu_em is null limit 1;
$$;

create or replace function public.criar_sala()
returns table (ok boolean, mensagem text, codigo text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_cod  text;
  v_sala bigint;
begin
  if v_user is null then
    return query select false, 'Entre com a sua conta primeiro.'::text, null::text; return;
  end if;
  if public.minha_sala_id(v_user) is not null then
    return query select false, 'Você já está numa sala. Saia dela pra criar outra.'::text, null::text; return;
  end if;

  loop
    v_cod := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
              from generate_series(1, 6));
    exit when not exists (select 1 from public.sala s where s.codigo = v_cod);
  end loop;

  insert into public.sala (codigo, dono) values (v_cod, v_user) returning id into v_sala;
  insert into public.sala_membro (sala_id, user_id) values (v_sala, v_user);
  update public.perfil set participa_liga = true, atualizado_em = now() where user_id = v_user;

  return query select true, 'Sala criada. Agora é convidar a turma.'::text, v_cod;
end $$;

grant execute on function public.criar_sala() to authenticated;

create or replace function public.entrar_na_sala(p_codigo text)
returns table (ok boolean, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_sala bigint;
  v_atual bigint;
begin
  if v_user is null then
    return query select false, 'Entre com a sua conta primeiro.'::text; return;
  end if;

  select s.id into v_sala from public.sala s where s.codigo = upper(trim(p_codigo));
  if v_sala is null then
    return query select false, 'Esse convite não existe mais.'::text; return;
  end if;

  v_atual := public.minha_sala_id(v_user);
  if v_atual = v_sala then
    return query select true, 'Você já está nessa sala.'::text; return;
  end if;
  if v_atual is not null then
    return query select false, 'Você já está em outra sala. Saia dela primeiro.'::text; return;
  end if;

  /* duas pessoas aceitando ao mesmo tempo não passam de 5 */
  perform pg_advisory_xact_lock(hashtext('sala:' || v_sala::text));
  if (select count(*) from public.sala_membro where sala_id = v_sala and saiu_em is null) >= public.sala_maximo() then
    return query select false, 'A sala já está cheia (5 pessoas).'::text; return;
  end if;

  insert into public.sala_membro (sala_id, user_id) values (v_sala, v_user)
  on conflict (sala_id, user_id) do update set entrou_em = now(), saiu_em = null;
  update public.perfil set participa_liga = true, atualizado_em = now() where user_id = v_user;

  return query select true, 'Você entrou na sala. Ela corre a partir da próxima segunda.'::text;
end $$;

grant execute on function public.entrar_na_sala(text) to authenticated;

create or replace function public.sair_da_sala()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  update public.sala_membro set saiu_em = now() where user_id = v_user and saiu_em is null;
  return found;
end $$;

grant execute on function public.sair_da_sala() to authenticated;


-- ------------------------------------------------------------
-- 5. VER A SALA
--
-- minha_sala   quem está na minha sala, com o que a liga mostra
--              (nome público, foto, faixa) e desde quando vale
-- ver_sala     o convite antes de aceitar: só o nome de quem
--              convidou e quantos já estão
-- ------------------------------------------------------------
create or replace function public.minha_sala()
returns table (
  codigo       text,
  sou_dono     boolean,
  user_id      uuid,
  nome         text,
  foto         text,
  faixa        text,
  graus        int,
  sou_eu       boolean,
  dono         boolean,
  vale_desde   date,
  valendo      boolean,
  proxima      boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_sala bigint;
  v_sem  date := public.semana_atual();
begin
  if v_user is null then return; end if;
  v_sala := public.minha_sala_id(v_user);
  if v_sala is null then return; end if;

  return query
  select
    s.codigo,
    (s.dono = v_user),
    p.user_id,
    public.nome_publico(p),
    public.foto_publica(p),
    p.faixa,
    p.graus,
    (p.user_id = v_user),
    (p.user_id = s.dono),
    public.semana_de((m.entrou_em at time zone 'America/Sao_Paulo')::date) + 7,
    public.sala_da_semana(v_user, v_sem) = v_sala,
    (select count(*) from public.sala_membro x where x.sala_id = v_sala and x.saiu_em is null) >= public.sala_minimo()
  from public.sala_membro m
  join public.sala s on s.id = m.sala_id
  join public.perfil p on p.user_id = m.user_id
  where m.sala_id = v_sala and m.saiu_em is null
  order by (p.user_id = s.dono) desc, m.entrou_em;
end $$;

grant execute on function public.minha_sala() to authenticated;

create or replace function public.ver_sala(p_codigo text)
returns table (quem_convidou text, pessoas int, cheia boolean)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  return query
  select public.nome_publico(p),
         (select count(*) from public.sala_membro m where m.sala_id = s.id and m.saiu_em is null)::int,
         (select count(*) from public.sala_membro m where m.sala_id = s.id and m.saiu_em is null) >= public.sala_maximo()
  from public.sala s join public.perfil p on p.user_id = s.dono
  where s.codigo = upper(trim(p_codigo));
end $$;

grant execute on function public.ver_sala(text) to authenticated;


-- ------------------------------------------------------------
-- 6. O MEU GRUPO SABE SE É DA SALA
--
-- Igual ao de foto.sql, com em_sala no fim.
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
  foto           text,
  em_sala        boolean
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
    public.foto_publica(p),
    l.sala_id is not null
  from public.liga_membro m
  join public.perfil p on p.user_id = m.user_id
  join public.liga l on l.id = m.liga_id
  left join public.total_xp t on t.user_id = m.user_id
  where m.liga_id = v_liga
  order by m.xp_semana desc, m.entrou_em;
end $$;

grant execute on function public.minha_liga() to authenticated;
