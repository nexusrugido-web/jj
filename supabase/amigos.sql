-- ============================================================
-- AMIGOS, E A FOTO QUE NÃO SUBIA
--
-- 1. A foto: o Supabase pede permissão de LEITURA pra trocar um
--    arquivo que já existe (upsert). foto.sql só dava gravar,
--    trocar e apagar, então a foto não subia.
--
-- 2. Amigos: pedir, aceitar, recusar e desfazer. Amigo vê o mesmo
--    que o grupo da liga vê (nome público, foto, faixa, ofensiva e
--    pontos da semana), mesmo quando vocês não estão no mesmo grupo.
--
-- 3. Chamar um amigo pra sua sala: o convite aparece pra ele no app,
--    sem precisar de link.
--
-- 4. O par da semana passa a dizer quem é a pessoa, pra dar pra
--    adicionar como amigo.
--
-- Rode depois de sala.sql (9-SUPABASE-SALA.sql). Pode rodar de novo.
-- ============================================================


-- ------------------------------------------------------------
-- 1. A FOTO
-- ------------------------------------------------------------
drop policy if exists "avatares_select" on storage.objects;
create policy "avatares_select" on storage.objects for select
  to authenticated
  using (bucket_id = 'avatares');


-- ------------------------------------------------------------
-- 2. AS TABELAS
--
-- Ninguém lê direto: tudo passa pelas funções.
-- ------------------------------------------------------------
create table if not exists public.amizade (
  de           uuid not null references auth.users(id) on delete cascade,
  para         uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pendente' check (status in ('pendente', 'aceita')),
  criada_em    timestamptz not null default now(),
  respondida_em timestamptz,
  primary key (de, para),
  check (de <> para)
);
create index if not exists amizade_para on public.amizade (para);
alter table public.amizade enable row level security;

create table if not exists public.convite_sala (
  sala_id   bigint not null references public.sala(id) on delete cascade,
  de        uuid not null references auth.users(id) on delete cascade,
  para      uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (sala_id, para)
);
alter table public.convite_sala enable row level security;

create or replace function public.sao_amigos(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.amizade
    where status = 'aceita' and ((de = a and para = b) or (de = b and para = a))
  );
$$;


-- ------------------------------------------------------------
-- 3. PEDIR, RESPONDER, DESFAZER
--
-- Se o outro já tinha pedido pra você, pedir de volta aceita.
-- Até 30 pedidos esperando resposta, pra ninguém sair pedindo
-- amizade pra liga inteira.
-- ------------------------------------------------------------
create or replace function public.pedir_amizade(p_user uuid)
returns table (ok boolean, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return query select false, 'Entre com a sua conta primeiro.'::text; return;
  end if;
  if p_user is null or p_user = v_user then
    return query select false, 'Não dá pra adicionar você mesmo.'::text; return;
  end if;
  if public.sao_amigos(v_user, p_user) then
    return query select true, 'Vocês já são amigos.'::text; return;
  end if;

  if exists (select 1 from public.amizade where de = p_user and para = v_user and status = 'pendente') then
    update public.amizade set status = 'aceita', respondida_em = now() where de = p_user and para = v_user;
    return query select true, 'Agora vocês são amigos.'::text; return;
  end if;

  if exists (select 1 from public.amizade where de = v_user and para = p_user) then
    return query select true, 'Pedido já enviado. Falta ele aceitar.'::text; return;
  end if;

  if (select count(*) from public.amizade where de = v_user and status = 'pendente') >= 30 then
    return query select false, 'Você tem muitos pedidos esperando resposta.'::text; return;
  end if;

  insert into public.amizade (de, para) values (v_user, p_user);
  return query select true, 'Pedido de amizade enviado.'::text;
end $$;

grant execute on function public.pedir_amizade(uuid) to authenticated;

create or replace function public.responder_amizade(p_user uuid, p_aceitar boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  if p_aceitar then
    update public.amizade set status = 'aceita', respondida_em = now()
    where de = p_user and para = v_user and status = 'pendente';
  else
    delete from public.amizade where de = p_user and para = v_user and status = 'pendente';
  end if;
  return found;
end $$;

grant execute on function public.responder_amizade(uuid, boolean) to authenticated;

create or replace function public.desfazer_amizade(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  delete from public.amizade where (de = v_user and para = p_user) or (de = p_user and para = v_user);
  return found;
end $$;

grant execute on function public.desfazer_amizade(uuid) to authenticated;


-- ------------------------------------------------------------
-- 4. A LISTA
--
-- status   amigo | recebido (ele pediu, falta você) | enviado
-- na_sala  ele já está na sua sala
-- chamado  você já chamou ele pra sua sala
-- ------------------------------------------------------------
create or replace function public.meus_amigos()
returns table (
  user_id   uuid,
  nome      text,
  foto      text,
  faixa     text,
  graus     int,
  sequencia int,
  xp_semana int,
  status    text,
  na_sala   boolean,
  chamado   boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_sala bigint;
  v_sem  date := public.semana_atual();
begin
  if v_user is null then return; end if;
  v_sala := public.minha_sala_id(v_user);

  return query
  with ligados as (
    select case when a.de = v_user then a.para else a.de end as outro,
           case when a.status = 'aceita' then 'amigo'
                when a.para = v_user then 'recebido'
                else 'enviado' end as st
    from public.amizade a
    where a.de = v_user or a.para = v_user
  )
  select
    p.user_id,
    public.nome_publico(p),
    public.foto_publica(p),
    p.faixa,
    p.graus,
    p.sequencia,
    coalesce((select sum(x.xp) from public.pontos x where x.user_id = p.user_id and x.semana = v_sem), 0)::int,
    l.st,
    v_sala is not null and public.minha_sala_id(p.user_id) = v_sala,
    v_sala is not null and exists (select 1 from public.convite_sala c where c.sala_id = v_sala and c.para = p.user_id)
  from ligados l
  join public.perfil p on p.user_id = l.outro
  order by (l.st = 'recebido') desc, (l.st = 'amigo') desc, 7 desc, 2;
end $$;

grant execute on function public.meus_amigos() to authenticated;


-- ------------------------------------------------------------
-- 5. CHAMAR UM AMIGO PRA SALA
--
-- Só amigo, só se você tem sala e ela tem vaga. O convite some
-- quando ele entra, recusa, ou quando a sala acaba.
-- ------------------------------------------------------------
create or replace function public.chamar_pra_sala(p_user uuid)
returns table (ok boolean, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_sala bigint;
begin
  if v_user is null then
    return query select false, 'Entre com a sua conta primeiro.'::text; return;
  end if;
  if not public.sao_amigos(v_user, p_user) then
    return query select false, 'Só dá pra chamar amigo.'::text; return;
  end if;
  v_sala := public.minha_sala_id(v_user);
  if v_sala is null then
    return query select false, 'Crie a sua sala primeiro.'::text; return;
  end if;
  if public.minha_sala_id(p_user) = v_sala then
    return query select true, 'Ele já está na sua sala.'::text; return;
  end if;
  if (select count(*) from public.sala_membro where sala_id = v_sala and saiu_em is null) >= public.sala_maximo() then
    return query select false, 'A sua sala já está cheia.'::text; return;
  end if;

  insert into public.convite_sala (sala_id, de, para) values (v_sala, v_user, p_user)
  on conflict (sala_id, para) do update set de = excluded.de, criado_em = now();
  return query select true, 'Convite enviado. Aparece pra ele na Liga.'::text;
end $$;

grant execute on function public.chamar_pra_sala(uuid) to authenticated;

create or replace function public.meus_convites_de_sala()
returns table (codigo text, quem_chamou text, foto text, pessoas int)
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;
  return query
  select s.codigo, public.nome_publico(p), public.foto_publica(p),
         (select count(*) from public.sala_membro m where m.sala_id = s.id and m.saiu_em is null)::int
  from public.convite_sala c
  join public.sala s on s.id = c.sala_id
  join public.perfil p on p.user_id = c.de
  where c.para = v_user
    and public.minha_sala_id(v_user) is distinct from s.id
    and (select count(*) from public.sala_membro m where m.sala_id = s.id and m.saiu_em is null) < public.sala_maximo()
  order by c.criado_em desc;
end $$;

grant execute on function public.meus_convites_de_sala() to authenticated;

create or replace function public.recusar_convite_de_sala(p_codigo text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  delete from public.convite_sala c using public.sala s
  where s.id = c.sala_id and s.codigo = upper(trim(p_codigo)) and c.para = v_user;
  return found;
end $$;

grant execute on function public.recusar_convite_de_sala(text) to authenticated;

-- entrou na sala: o convite dela some sozinho
create or replace function public.limpar_convite_ao_entrar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.convite_sala where sala_id = new.sala_id and para = new.user_id;
  return new;
end $$;

drop trigger if exists tg_limpar_convite on public.sala_membro;
create trigger tg_limpar_convite after insert or update on public.sala_membro
  for each row when (new.saiu_em is null) execute function public.limpar_convite_ao_entrar();


-- ------------------------------------------------------------
-- 6. O PAR DA SEMANA DIZ QUEM É
--
-- Igual ao de par.sql, com o id, a foto e se já são amigos.
-- ------------------------------------------------------------
drop function if exists public.meu_par();

create or replace function public.meu_par()
returns table (
  rival_nome      text,
  rival_ritmo     int,
  rival_pontos    int,
  meus_pontos     int,
  meu_ritmo       int,
  desde           date,
  rival_id        uuid,
  rival_foto      text,
  amizade         text
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_sem  date;
begin
  if v_user is null then return; end if;

  select max(semana) into v_sem
  from public.par where user_id = v_user and semana <= current_date;

  if v_sem is null then return; end if;

  return query
  select
    public.nome_publico(pr),
    pr.treinos_semana,
    coalesce(tr.xp_semana, 0),
    coalesce(tm.xp_semana, 0),
    pm.treinos_semana,
    pa.semana,
    pa.rival_id,
    public.foto_publica(pr),
    case
      when public.sao_amigos(v_user, pa.rival_id) then 'amigo'
      when exists (select 1 from public.amizade a where a.de = v_user and a.para = pa.rival_id) then 'enviado'
      when exists (select 1 from public.amizade a where a.de = pa.rival_id and a.para = v_user) then 'recebido'
      else null
    end
  from public.par pa
  join public.perfil pr on pr.user_id = pa.rival_id
  join public.perfil pm on pm.user_id = pa.user_id
  left join public.total_xp tr on tr.user_id = pa.rival_id
  left join public.total_xp tm on tm.user_id = pa.user_id
  where pa.user_id = v_user and pa.semana = v_sem;
end $$;

grant execute on function public.meu_par() to authenticated;
