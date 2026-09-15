-- ============================================================
-- TATAME OS, COMUNIDADE
--
-- Duas camadas separadas:
--   1. O que voce registra continua privado. Ninguem ve.
--   2. Pro ranking existe uma tabela so com nome e pontos,
--      e voce escolhe se quer aparecer.
--
-- Regra principal: o app NUNCA grava pontos. Ele avisa o
-- servidor o que aconteceu, o servidor confere e so entao
-- grava. Isso impede que alguem de pontos a si mesmo.
--
-- Rode isto no SQL Editor do Supabase, depois do schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. PERFIL PUBLICO
-- So o minimo que aparece num ranking. Nada de treino aqui.
-- Por padrao a pessoa NAO participa. LGPD: consentimento
-- tem que ser um ato, nao um descuido.
-- ------------------------------------------------------------
create table if not exists public.perfil (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  nome           text not null default 'Praticante',
  apelido        text,
  faixa          text not null default 'branca',
  graus          int  not null default 0,
  avatar_url     text,
  participa_liga boolean not null default false,   -- opt-in explicito
  anonimo        boolean not null default false,   -- aparece como apelido
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

alter table public.perfil enable row level security;

-- qualquer pessoa logada ve o perfil de quem aceitou participar,
-- e sempre ve o proprio
drop policy if exists perfil_leitura on public.perfil;
create policy perfil_leitura on public.perfil
  for select to authenticated
  using (participa_liga = true or user_id = auth.uid());

drop policy if exists perfil_escrita on public.perfil;
create policy perfil_escrita on public.perfil
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- o nome que aparece pros outros
create or replace function public.nome_publico(p public.perfil)
returns text language sql stable as $$
  select case when p.anonimo then coalesce(p.apelido, 'Praticante') else p.nome end;
$$;

-- ------------------------------------------------------------
-- 2. LIVRO DE PONTOS
-- Append-only. O cliente nao insere, nao edita e nao apaga.
-- ------------------------------------------------------------
create table if not exists public.pontos (
  id        bigserial primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  evento    text not null,
  xp        int  not null check (xp between 0 and 200),
  ref_id    text,
  detalhe   text,
  data      date not null default current_date,
  semana    date not null,
  mes       text not null,
  criado_em timestamptz not null default now(),
  unique (user_id, evento, ref_id)
);

create index if not exists pontos_user_semana on public.pontos (user_id, semana);
create index if not exists pontos_user_mes on public.pontos (user_id, mes);

alter table public.pontos enable row level security;

-- voce ve so os seus. Ninguem escreve direto, nem voce.
drop policy if exists pontos_leitura on public.pontos;
create policy pontos_leitura on public.pontos
  for select to authenticated using (user_id = auth.uid());
-- de proposito: nao existe policy de insert/update/delete.
-- so a funcao abaixo, que roda com privilegio, consegue gravar.

-- ------------------------------------------------------------
-- 3. QUANTO VALE CADA EVENTO
-- Fica no banco, nao no app. Se ficasse no app, bastava editar
-- o javascript pra valer 9999.
-- ------------------------------------------------------------
create table if not exists public.evento_valor (
  evento    text primary key,
  xp        int not null,
  teto_dia  int not null default 10
);

insert into public.evento_valor (evento, xp, teto_dia) values
  ('treino',       20, 1),
  ('rola',         12, 8),
  ('aula',         15, 4),
  ('short',         6, 8),
  ('quizAcerto',   10, 10),
  ('quizErro',      3, 10),
  ('revisao',       5, 12),
  ('consistencia', 25, 1),
  ('grau',         30, 3)
on conflict (evento) do update
  set xp = excluded.xp, teto_dia = excluded.teto_dia;

-- ------------------------------------------------------------
-- 4. A FUNCAO QUE CONCEDE PONTO
-- Unico caminho pra gravar. Confere o valor na tabela, checa
-- o teto do dia e ignora repeticao do mesmo item.
-- ------------------------------------------------------------
create or replace function public.dar_ponto(
  p_evento  text,
  p_ref_id  text default null,
  p_detalhe text default null,
  p_data    date default current_date
)
returns table (concedido boolean, xp int, motivo text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_xp   int;
  v_teto int;
  v_hoje int;
  v_sem  date;
begin
  if v_user is null then
    return query select false, 0, 'sem sessao'; return;
  end if;

  -- a data nao pode vir do futuro nem de um passado distante
  if p_data > current_date or p_data < current_date - interval '30 days' then
    return query select false, 0, 'data invalida'; return;
  end if;

  select ev.xp, ev.teto_dia into v_xp, v_teto
  from public.evento_valor ev where ev.evento = p_evento;

  if v_xp is null then
    return query select false, 0, 'evento desconhecido'; return;
  end if;

  -- ja ganhou ponto por esse item exato
  if p_ref_id is not null and exists (
    select 1 from public.pontos
    where user_id = v_user and evento = p_evento and ref_id = p_ref_id
  ) then
    return query select false, 0, 'ja concedido'; return;
  end if;

  -- teto do dia
  select count(*) into v_hoje from public.pontos
  where user_id = v_user and evento = p_evento and data = p_data;

  if v_hoje >= v_teto then
    return query select false, 0, 'teto do dia'; return;
  end if;

  v_sem := p_data - ((extract(isodow from p_data)::int - 1) || ' days')::interval;

  insert into public.pontos (user_id, evento, xp, ref_id, detalhe, data, semana, mes)
  values (v_user, p_evento, v_xp, p_ref_id, p_detalhe, p_data, v_sem, to_char(p_data, 'YYYY-MM'));

  return query select true, v_xp, 'ok';
end $$;

revoke all on function public.dar_ponto(text, text, text, date) from public;
grant execute on function public.dar_ponto(text, text, text, date) to authenticated;

-- ------------------------------------------------------------
-- 5. TOTAIS AGREGADOS
-- O ranking le daqui, nunca das tabelas de treino.
-- ------------------------------------------------------------
create table if not exists public.total_xp (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  total      int not null default 0,
  semana     date,
  xp_semana  int not null default 0,
  mes        text,
  xp_mes     int not null default 0,
  divisao    text not null default 'iniciante',
  atualizado timestamptz not null default now()
);

alter table public.total_xp enable row level security;

-- so aparece quem aceitou participar
drop policy if exists total_leitura on public.total_xp;
create policy total_leitura on public.total_xp
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.perfil p
      where p.user_id = total_xp.user_id and p.participa_liga = true
    )
  );

create or replace function public.divisao_de(p_total int)
returns text language sql immutable as $$
  select case
    when p_total >= 12000 then 'veterano'
    when p_total >= 3500  then 'competidor'
    when p_total >= 800   then 'praticante'
    else 'iniciante'
  end;
$$;

-- mantem o agregado em dia a cada ponto concedido
create or replace function public.atualiza_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sem date := date_trunc('week', current_date)::date;
  v_mes text := to_char(current_date, 'YYYY-MM');
  v_total int;
  v_sem_xp int;
  v_mes_xp int;
begin
  select coalesce(sum(xp), 0) into v_total from public.pontos where user_id = new.user_id;
  select coalesce(sum(xp), 0) into v_sem_xp from public.pontos where user_id = new.user_id and semana = v_sem;
  select coalesce(sum(xp), 0) into v_mes_xp from public.pontos where user_id = new.user_id and mes = v_mes;

  insert into public.total_xp (user_id, total, semana, xp_semana, mes, xp_mes, divisao, atualizado)
  values (new.user_id, v_total, v_sem, v_sem_xp, v_mes, v_mes_xp, public.divisao_de(v_total), now())
  on conflict (user_id) do update set
    total = excluded.total,
    semana = excluded.semana,
    xp_semana = excluded.xp_semana,
    mes = excluded.mes,
    xp_mes = excluded.xp_mes,
    divisao = excluded.divisao,
    atualizado = now();

  return new;
end $$;

drop trigger if exists tg_atualiza_total on public.pontos;
create trigger tg_atualiza_total after insert on public.pontos
  for each row execute function public.atualiza_total();

-- ------------------------------------------------------------
-- 6. GRUPOS DA LIGA
-- 30 pessoas de ritmo parecido, pra o ranking ser disputavel.
-- ------------------------------------------------------------
create table if not exists public.liga (
  id       bigserial primary key,
  semana   date not null,
  divisao  text not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.liga_membro (
  liga_id   bigint not null references public.liga(id) on delete cascade,
  user_id   uuid   not null references auth.users(id) on delete cascade,
  xp_semana int    not null default 0,
  primary key (liga_id, user_id)
);

alter table public.liga enable row level security;
alter table public.liga_membro enable row level security;

-- voce ve o seu grupo, e so ele
drop policy if exists liga_leitura on public.liga;
create policy liga_leitura on public.liga
  for select to authenticated
  using (exists (
    select 1 from public.liga_membro m
    where m.liga_id = liga.id and m.user_id = auth.uid()
  ));

drop policy if exists membro_leitura on public.liga_membro;
create policy membro_leitura on public.liga_membro
  for select to authenticated
  using (exists (
    select 1 from public.liga_membro meu
    where meu.liga_id = liga_membro.liga_id and meu.user_id = auth.uid()
  ));

-- o que o app mostra no ranking
create or replace view public.ranking_liga
with (security_invoker = true) as
select
  m.liga_id,
  m.user_id,
  public.nome_publico(p) as nome,
  p.faixa,
  p.graus,
  case when p.anonimo then null else p.avatar_url end as avatar_url,
  m.xp_semana,
  rank() over (partition by m.liga_id order by m.xp_semana desc) as posicao
from public.liga_membro m
join public.perfil p on p.user_id = m.user_id;

grant select on public.ranking_liga to authenticated;

-- ------------------------------------------------------------
-- 7. FECHAMENTO DA SEMANA
-- Monta os grupos da semana seguinte com quem aceitou
-- participar, em blocos de 30, agrupados por divisao.
-- Agende com pg_cron: domingo 23h50 em Sao Paulo.
-- ------------------------------------------------------------
create or replace function public.fechar_semana()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_sem date := date_trunc('week', current_date + interval '1 week')::date;
  v_criadas int := 0;
  v_div text;
  v_liga bigint;
  v_linha record;
  v_n int;
begin
  for v_div in select unnest(array['iniciante','praticante','competidor','veterano']) loop
    v_n := 0;
    v_liga := null;

    for v_linha in
      select t.user_id
      from public.total_xp t
      join public.perfil p on p.user_id = t.user_id
      where p.participa_liga = true and t.divisao = v_div
      order by t.xp_semana desc, t.user_id
    loop
      if v_liga is null or v_n >= 30 then
        insert into public.liga (semana, divisao) values (v_sem, v_div) returning id into v_liga;
        v_criadas := v_criadas + 1;
        v_n := 0;
      end if;

      insert into public.liga_membro (liga_id, user_id, xp_semana)
      values (v_liga, v_linha.user_id, 0)
      on conflict do nothing;

      v_n := v_n + 1;
    end loop;
  end loop;

  -- zera o acumulado da semana
  update public.total_xp set xp_semana = 0, semana = v_sem;

  return v_criadas;
end $$;

revoke all on function public.fechar_semana() from public, authenticated;

-- select cron.schedule('fechar-semana', '50 23 * * 0', $$select public.fechar_semana()$$);

-- ------------------------------------------------------------
-- 8. PERFIL NASCE JUNTO COM A CONTA
-- ------------------------------------------------------------
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfil (user_id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Praticante'))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists tg_criar_perfil on auth.users;
create trigger tg_criar_perfil after insert on auth.users
  for each row execute function public.criar_perfil();
