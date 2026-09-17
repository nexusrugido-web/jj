-- ============================================================
-- TATAME OS, O PAR DA SEMANA
--
-- Cada pessoa ganha alguem de ritmo parecido pra medir forcas
-- durante a semana. O criterio e quantas vezes por semana cada
-- um treina, que sai da pergunta do onboarding.
--
-- Por que ritmo e nao pontos: quem treina 5x sempre vai fazer
-- mais pontos que quem treina 2x, e comparar os dois so diz o
-- obvio. Entre dois que treinam 3x, a comparacao vira jogo.
--
-- QUEM ENTRA: so quem aceitou participar da liga. E a mesma
-- informacao que ja aparece la, nome e pontos, entao e o mesmo
-- consentimento. Ninguem e exposto sem ter dito sim.
--
-- Rode no SQL Editor do Supabase, depois de liga.sql
-- ============================================================

create table if not exists public.par (
  semana    date not null,
  user_id   uuid not null references auth.users(id) on delete cascade,
  rival_id  uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (semana, user_id)
);

create index if not exists par_semana on public.par (semana);

alter table public.par enable row level security;

-- voce ve so o seu par. Ninguem escreve pelo app.
drop policy if exists par_leitura on public.par;
create policy par_leitura on public.par
  for select to authenticated using (user_id = auth.uid());


-- ------------------------------------------------------------
-- MONTAR OS PARES DA SEMANA
--
-- Ordena todo mundo por quantas vezes treina e junta os
-- vizinhos. Quem declarou 3x fica ao lado de outro 3x, e quando
-- nao houver outro 3x, fica com o mais proximo que existir.
--
-- Com gente em numero impar, o ultimo nao fica sozinho: ele
-- pega como rival o vizinho mais proximo, que ja esta pareado
-- com outra pessoa. Ficar sem par seria pior.
-- ------------------------------------------------------------
create or replace function public.parear_semana(p_semana date default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_sem   date := coalesce(p_semana, date_trunc('week', current_date)::date);
  v_ids   uuid[];
  v_n     int;
  v_i     int;
  v_pares int := 0;
begin
  /* refaz a semana inteira, entao rodar duas vezes nao duplica */
  delete from public.par where semana = v_sem;

  select array_agg(t.user_id order by coalesce(p.treinos_semana, 3), t.user_id)
    into v_ids
  from public.total_xp t
  join public.perfil p on p.user_id = t.user_id
  where p.participa_liga = true;

  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n < 2 then return 0; end if;

  v_i := 1;
  while v_i + 1 <= v_n loop
    insert into public.par (semana, user_id, rival_id)
    values (v_sem, v_ids[v_i], v_ids[v_i + 1]), (v_sem, v_ids[v_i + 1], v_ids[v_i])
    on conflict (semana, user_id) do nothing;
    v_pares := v_pares + 1;
    v_i := v_i + 2;
  end loop;

  /* sobrou um: ele olha pro vizinho, mesmo que o vizinho ja
     esteja olhando pra outra pessoa */
  if v_i = v_n then
    insert into public.par (semana, user_id, rival_id)
    values (v_sem, v_ids[v_n], v_ids[v_n - 1])
    on conflict (semana, user_id) do nothing;
  end if;

  return v_pares;
end $$;

revoke all on function public.parear_semana(date) from public, authenticated;


-- ------------------------------------------------------------
-- O MEU PAR
--
-- Devolve o rival com o mesmo cuidado da liga: o nome que a
-- pessoa escolheu mostrar, e mais nada do que ela registra.
-- ------------------------------------------------------------
create or replace function public.meu_par()
returns table (
  rival_nome      text,
  rival_ritmo     int,
  rival_pontos    int,
  meus_pontos     int,
  meu_ritmo       int,
  desde           date
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_sem  date := date_trunc('week', current_date)::date;
begin
  if v_user is null then return; end if;

  /* O par mais recente que ja comecou. O fechamento de domingo
     monta os pares da semana seguinte, entao no domingo ainda
     vale o par da semana corrente. */
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
    pa.semana
  from public.par pa
  join public.perfil pr on pr.user_id = pa.rival_id
  join public.perfil pm on pm.user_id = pa.user_id
  left join public.total_xp tr on tr.user_id = pa.rival_id
  left join public.total_xp tm on tm.user_id = pa.user_id
  where pa.user_id = v_user and pa.semana = v_sem;
end $$;

grant execute on function public.meu_par() to authenticated;


-- ------------------------------------------------------------
-- AGENDAR
--
-- Roda logo depois do fechamento da liga, no mesmo ciclo. Os
-- cinco minutos de diferenca existem pra a liga terminar de
-- montar os grupos antes.
--
--   select cron.schedule('parear-semana', '55 23 * * 0',
--     $$select public.parear_semana(
--         date_trunc('week', current_date + interval '1 week')::date)$$);
--
-- Repare na data passada de proposito: o domingo fecha a semana
-- que acabou e monta a que comeca. Sem isso o pareamento montaria
-- os pares da semana que esta terminando, que ninguem mais vai ver.
--
-- Mesmo aviso de fuso da liga: isto e UTC.
--
-- Pra montar os pares agora, sem esperar domingo:
--   select public.parear_semana();
--   select * from public.meu_par();
-- ------------------------------------------------------------
