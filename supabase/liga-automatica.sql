-- ============================================================
-- TATAME OS, A LIGA AUTOMATICA
--
-- Do jeito do Duolingo, com o ritmo do jiu-jitsu:
--
--   ninguem precisa entrar   quem registra o primeiro treino da
--                            semana cai num grupo, sozinho. Quem
--                            nao treinou nao ocupa lugar.
--
--   ritmo parecido junto     o grupo prefere quem treina a mesma
--                            quantidade por semana (a pergunta do
--                            cadastro, de 1 a 7). Sem ninguem
--                            parecido, junta com quem tiver.
--
--   sozinho nao corre        grupo de uma pessoa fica esperando.
--                            A corrida comeca quando chega a
--                            segunda, e quem chega depois sempre
--                            vai primeiro pra quem esta esperando.
--
--   preso ate domingo        entrou no grupo, fica nele ate a
--                            semana fechar. Sair da liga vale a
--                            partir da semana seguinte.
--
--   a semana e a do Brasil   vira a meia-noite de Sao Paulo, e nao
--                            as 21h de domingo (meia-noite UTC).
--                            Fecha segunda ao meio-dia: treino de
--                            domingo registrado ate la ainda conta.
--
-- Rode no SQL Editor do Supabase, depois de estudo.sql.
-- Pode rodar de novo: nada aqui apaga ponto nem conta.
-- ============================================================


-- ------------------------------------------------------------
-- 1. A SEMANA DO BRASIL
-- ------------------------------------------------------------
create or replace function public.hoje_br()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- a segunda-feira da semana de uma data
create or replace function public.semana_de(p_data date)
returns date language sql immutable as $$
  select p_data - (extract(isodow from p_data)::int - 1);
$$;

create or replace function public.semana_atual()
returns date language sql stable as $$
  select public.semana_de(public.hoje_br());
$$;


-- ------------------------------------------------------------
-- 2. QUEM ESTA NA LIGA: TODO MUNDO, A MENOS QUE SAIA
--
-- participa_liga continua sendo o interruptor, mas agora nasce
-- ligado. Quem ja existia entra uma vez so, na primeira vez que
-- este arquivo roda. Quem sair depois nao e colocado de volta
-- quando o arquivo rodar de novo.
--
-- sequencia: as semanas seguidas de treino, a mesma conta que o
-- Painel mostra (src/lib/semana.js). O app manda.
-- ------------------------------------------------------------
alter table public.perfil alter column participa_liga set default true;
alter table public.perfil add column if not exists sequencia int not null default 0;

do $$
begin
  if public.ajuste_txt('liga_automatica_em') is null then
    update public.perfil set participa_liga = true;
    insert into public.ajuste (id, nome, descricao, valor, texto, grupo) values
      ('liga_automatica_em', 'Quando a liga virou automatica',
       'A partir desta data todo mundo entra na liga ao registrar treino. Quem sai fica fora.',
       null, now()::text, 'comunidade')
    on conflict (id) do update set texto = excluded.texto;
  end if;
end $$;

-- Os outros so enxergam o perfil pelas funcoes da liga, que
-- mostram o nome curto. A leitura direta da tabela deixava ver o
-- nome completo de quem escolheu aparecer com apelido.
drop policy if exists perfil_leitura on public.perfil;
create policy perfil_leitura on public.perfil
  for select to authenticated
  using (user_id = auth.uid());


-- ------------------------------------------------------------
-- 3. O NOME QUE APARECE PROS OUTROS
--
-- com o nome   primeiro nome e a inicial do sobrenome: "Batista V."
-- com apelido  o apelido
-- anonimo      "Anonimo"
--
-- O anonimo continua sendo o "nao mostre o meu nome": com
-- apelido, aparece o apelido; sem, aparece "Anonimo".
-- ------------------------------------------------------------
create or replace function public.nome_curto(p_nome text)
returns text language sql immutable as $$
  select case
    when coalesce(trim(p_nome), '') = '' then 'Praticante'
    when array_length(regexp_split_to_array(trim(p_nome), '\s+'), 1) = 1 then initcap(trim(p_nome))
    else initcap((regexp_split_to_array(trim(p_nome), '\s+'))[1]) || ' ' ||
         upper(left((regexp_split_to_array(trim(p_nome), '\s+'))[array_length(regexp_split_to_array(trim(p_nome), '\s+'), 1)], 1)) || '.'
  end;
$$;

create or replace function public.nome_publico(p public.perfil)
returns text language sql stable as $$
  select case
    when p.anonimo then coalesce(nullif(trim(p.apelido), ''), 'Anônimo')
    else public.nome_curto(p.nome)
  end;
$$;


-- ------------------------------------------------------------
-- 4. OS GRUPOS
--
-- frequencia  o ritmo de quem abriu o grupo, pra quem chega
--             depois achar gente parecida
-- comecou_em  quando chegou a segunda pessoa. Sem isso o grupo
--             esta esperando, e no fechamento ninguem sobe nem
--             desce
-- ------------------------------------------------------------
alter table public.liga add column if not exists frequencia int;
alter table public.liga add column if not exists comecou_em timestamptz;
alter table public.liga_membro add column if not exists entrou_em timestamptz not null default now();

create index if not exists liga_semana on public.liga (semana);
create index if not exists liga_membro_user on public.liga_membro (user_id);

-- a semana ja apurada nao e apurada de novo
create table if not exists public.liga_fechamento (
  semana     date primary key,
  fechado_em timestamptz not null default now(),
  subiram    int not null default 0,
  desceram   int not null default 0
);
alter table public.liga_fechamento enable row level security;

update public.ajuste
set minimo = 2,
    descricao = 'De 2 pra cima. Grupo pequeno deixa o ranking disputavel desde o comeco; grande so faz sentido com muita gente.'
where id = 'liga_tamanho';


-- ------------------------------------------------------------
-- 5. COLOCAR ALGUEM NUM GRUPO
--
-- A ordem de escolha, entre os grupos da semana que tem vaga:
--
--   1. quem esta esperando sozinho. Ninguem fica sem corrida se
--      mais alguem treinou na semana
--   2. a divisao mais perto da sua
--   3. o ritmo mais perto do seu
--   4. o grupo mais cheio, pra fechar um antes de abrir outro
--
-- So abre grupo novo quando todos os que existem estao cheios.
-- ------------------------------------------------------------
create or replace function public.colocar_na_liga(p_user uuid, p_semana date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_tam  int := greatest(2, public.ajuste_de('liga_tamanho', 10));
  v_div  text;
  v_freq int;
  v_liga bigint;
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

  select g.id into v_liga
  from (
    select l.id, l.divisao, l.frequencia,
           (select count(*) from public.liga_membro x where x.liga_id = l.id) as n
    from public.liga l
    where l.semana = p_semana
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
-- 6. CADA PONTO QUE CHEGA MEXE NA SOMA E NA LIGA
--
-- Ponto de uma semana ainda aberta (esta, ou a passada antes do
-- fechamento de segunda ao meio-dia) coloca a pessoa na corrida
-- daquela semana e atualiza o placar dela no grupo.
-- ------------------------------------------------------------
create or replace function public.atualiza_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sem    date := public.semana_atual();
  v_corte  timestamptz := coalesce(public.ajuste_txt('zerado_em')::timestamptz, '-infinity');
  v_total  int;
  v_sem_xp int;
begin
  select coalesce(sum(xp), 0) into v_total
  from public.pontos where user_id = new.user_id and criado_em > v_corte;

  select coalesce(sum(xp), 0) into v_sem_xp
  from public.pontos where user_id = new.user_id and semana = v_sem;

  insert into public.total_xp (user_id, total, semana, xp_semana, atualizado)
  values (new.user_id, v_total, v_sem, v_sem_xp, now())
  on conflict (user_id) do update set
    total = excluded.total,
    semana = excluded.semana,
    xp_semana = excluded.xp_semana,
    atualizado = now();

  if new.semana >= v_sem - 7
     and not exists (select 1 from public.liga_fechamento f where f.semana = new.semana) then
    perform public.colocar_na_liga(new.user_id, new.semana);

    update public.liga_membro m
    set xp_semana = (
      select coalesce(sum(p.xp), 0) from public.pontos p
      where p.user_id = new.user_id and p.semana = new.semana
    )
    where m.user_id = new.user_id
      and m.liga_id in (select l.id from public.liga l where l.semana = new.semana);
  end if;

  return new;
end $$;

-- o placar do grupo agora e mantido pelo gatilho acima
create or replace function public.subir_pontos(p_linhas jsonb)
returns table (gravados int, ignorados int)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_linha jsonb;
  v_ok int := 0;
  v_no int := 0;
  v_r record;
begin
  if v_user is null then
    return query select 0, 0; return;
  end if;

  for v_linha in select * from jsonb_array_elements(p_linhas) loop
    select * into v_r from public.dar_ponto(
      v_linha->>'evento',
      v_linha->>'refId',
      v_linha->>'detalhe',
      (v_linha->>'data')::date
    );
    if v_r.concedido then v_ok := v_ok + 1; else v_no := v_no + 1; end if;
  end loop;

  return query select v_ok, v_no;
end $$;

grant execute on function public.subir_pontos(jsonb) to authenticated;


-- ------------------------------------------------------------
-- 7. SAIR E VOLTAR
--
-- Sair vale a partir da semana que vem: quem ja esta num grupo
-- continua nele ate domingo, pra ninguem fugir de cair de
-- divisao no meio da corrida.
--
-- Voltar (ou o entrar antigo, que apps ainda nao atualizados
-- chamam) liga de novo e, se ja pontuou esta semana, ja coloca
-- na corrida.
-- ------------------------------------------------------------
create or replace function public.sair_da_liga()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  update public.perfil set participa_liga = false, atualizado_em = now() where user_id = v_user;
  return true;
end $$;

grant execute on function public.sair_da_liga() to authenticated;

create or replace function public.entrar_na_liga(p_apelido text default null, p_anonimo boolean default null)
returns table (ok boolean, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_sem  date := public.semana_atual();
begin
  if v_user is null then
    return query select false, 'Entre com a sua conta primeiro.'::text; return;
  end if;

  update public.perfil
  set participa_liga = true,
      anonimo = coalesce(p_anonimo, anonimo),
      apelido = coalesce(p_apelido, apelido),
      atualizado_em = now()
  where user_id = v_user;

  if exists (select 1 from public.pontos where user_id = v_user and semana = v_sem) then
    perform public.colocar_na_liga(v_user, v_sem);
    return query select true, 'Pronto, voce esta na corrida desta semana.'::text; return;
  end if;
  return query select true, 'Pronto. No proximo treino voce entra na corrida da semana.'::text;
end $$;

grant execute on function public.entrar_na_liga(text, boolean) to authenticated;


-- ------------------------------------------------------------
-- 8. O MEU GRUPO
--
-- Os mesmos campos de antes, e mais: a divisao de cada um (o
-- grupo pode juntar divisoes vizinhas quando falta gente), a
-- sequencia, o ritmo declarado, se a corrida ja comecou e se eu
-- estou saindo no fim da semana.
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
  saindo         boolean
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
    (p.user_id = v_user and not p.participa_liga)
  from public.liga_membro m
  join public.perfil p on p.user_id = m.user_id
  join public.liga l on l.id = m.liga_id
  left join public.total_xp t on t.user_id = m.user_id
  where m.liga_id = v_liga
  order by m.xp_semana desc, m.entrou_em;
end $$;

grant execute on function public.minha_liga() to authenticated;


-- ------------------------------------------------------------
-- 9. O PERFIL DE QUEM ESTA NO MEU GRUPO
--
-- So abre pra quem divide o grupo com voce nesta semana. Nada do
-- que a pessoa registrou nos treinos: so o que a liga ja mostra,
-- e o caminho dela no jogo.
-- ------------------------------------------------------------
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
  desde          date
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
     join public.liga l on l.id = m.liga_id where m.user_id = p_user)
  from public.perfil p
  left join public.total_xp t on t.user_id = p.user_id
  where p.user_id = p_user;
end $$;

grant execute on function public.perfil_na_liga(uuid) to authenticated;


-- ------------------------------------------------------------
-- 10. O FECHAMENTO DA SEMANA
--
-- Fecha toda semana que ja acabou e ainda nao foi apurada, da
-- mais antiga pra mais nova. Rodar de novo nao apura duas vezes.
--
-- Quantos sobem e descem depende do tamanho do grupo: o corte do
-- painel, mas nunca mais que um terco do grupo. Com 2 pessoas, o
-- primeiro sobe e ninguem desce. Com 3, um sobe e um desce. Grupo
-- que ficou sozinho a semana inteira nao correu: ninguem sobe.
--
-- Cada um sobe ou desce a partir da propria divisao, porque o
-- grupo pode juntar divisoes vizinhas quando falta gente.
-- ------------------------------------------------------------
drop function if exists public.fechar_semana();

create or replace function public.fechar_semana()
returns table (semana_fechada date, subiram int, desceram int, grupos int)
language plpgsql security definer set search_path = public as $$
declare
  v_corte int := public.ajuste_de('liga_corte', 3);
  v_sem   date;
  v_liga  bigint;
  v_n     int;
  v_c     int;
  v_sobe  int;
  v_desce int;
  v_g     int;
  v_linha record;
begin
  for v_sem in
    select distinct l.semana from public.liga l
    where l.semana < public.semana_atual()
      and not exists (select 1 from public.liga_fechamento f where f.semana = l.semana)
    order by 1
  loop
    v_sobe := 0; v_desce := 0; v_g := 0;

    for v_liga in select l.id from public.liga l where l.semana = v_sem loop
      select count(*) into v_n from public.liga_membro where liga_id = v_liga;
      continue when v_n < 2;
      v_g := v_g + 1;
      v_c := greatest(1, least(v_corte, v_n / 3));

      for v_linha in
        select m.user_id from public.liga_membro m
        where m.liga_id = v_liga and m.xp_semana > 0
        order by m.xp_semana desc, m.entrou_em, m.user_id
        limit v_c
      loop
        update public.total_xp set divisao = public.divisao_acima(divisao), atualizado = now()
        where user_id = v_linha.user_id and divisao <> 'preta';
        if found then v_sobe := v_sobe + 1; end if;
      end loop;

      if v_n >= v_c * 2 + 1 then
        for v_linha in
          select m.user_id from public.liga_membro m
          where m.liga_id = v_liga
          order by m.xp_semana asc, m.entrou_em desc, m.user_id
          limit v_c
        loop
          update public.total_xp set divisao = public.divisao_abaixo(divisao), atualizado = now()
          where user_id = v_linha.user_id and divisao <> 'branca';
          if found then v_desce := v_desce + 1; end if;
        end loop;
      end if;
    end loop;

    insert into public.liga_fechamento (semana, subiram, desceram) values (v_sem, v_sobe, v_desce);
    return query select v_sem, v_sobe, v_desce, v_g;
  end loop;

  /* quem ainda nao pontuou na semana nova comeca do zero */
  update public.total_xp set xp_semana = 0, semana = public.semana_atual()
  where total_xp.semana is distinct from public.semana_atual();
end $$;

revoke all on function public.fechar_semana() from public, anon, authenticated;


-- ------------------------------------------------------------
-- 11. O PAINEL DO ADMINISTRADOR
-- ------------------------------------------------------------
create or replace function public.pronto_pra_liga()
returns table (pronto boolean, participantes bigint, faltam bigint, recado text)
language plpgsql security definer set search_path = public as $$
declare
  v_n        bigint;
  v_grupos   bigint;
  v_sozinhos bigint;
begin
  if not public.sou_admin() then
    raise exception 'so administrador';
  end if;

  select count(distinct user_id) into v_n from public.pontos where semana = public.semana_atual();
  select count(*), count(*) filter (where comecou_em is null)
    into v_grupos, v_sozinhos
  from public.liga where semana = public.semana_atual();

  return query select
    v_n >= 2,
    v_n,
    greatest(0, 2 - v_n),
    (v_n || ' ' || case when v_n = 1 then 'pessoa treinou' else 'pessoas treinaram' end
      || ' esta semana, em ' || v_grupos || ' ' || case when v_grupos = 1 then 'grupo' else 'grupos' end
      || case when v_sozinhos > 0
           then '. ' || v_sozinhos || ' esperando adversario.'
           else '.' end)::text;
end $$;

grant execute on function public.pronto_pra_liga() to authenticated;

create or replace function public.numeros_do_produto()
returns table (
  contas              bigint,
  contas_semana       bigint,
  ativos_7d           bigint,
  ativos_30d          bigint,
  na_liga             bigint,
  assinantes          bigint,
  assinantes_atraso   bigint,
  xp_semana           bigint,
  aulas_vistas        bigint,
  grupos_liga         bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_admin() then
    raise exception 'so administrador';
  end if;

  return query
  select
    (select count(*) from auth.users),
    (select count(*) from auth.users where created_at > now() - interval '7 days'),
    (select count(distinct user_id) from public.pontos where data > public.hoje_br() - 7),
    (select count(distinct user_id) from public.pontos where data > public.hoje_br() - 30),
    (select count(*) from public.perfil where participa_liga),
    (select count(*) from public.assinatura where status = 'ativa'),
    (select count(*) from public.assinatura where status = 'atrasada'),
    (select coalesce(sum(xp), 0) from public.pontos where semana = public.semana_atual()),
    (select count(*) from public.pontos where evento in ('aula', 'short', 'revista', 'revistaShort')),
    (select count(*) from public.liga where semana = public.semana_atual());
end $$;

grant execute on function public.numeros_do_produto() to authenticated;


-- ------------------------------------------------------------
-- 12. ARRUMAR O QUE JA EXISTE
--
-- As semanas passadas contam como fechadas: elas foram montadas
-- pela regra antiga, e apurar agora subiria gente por semana
-- velha.
--
-- Os grupos desta semana ganham o ritmo de quem abriu, quem
-- estava sozinho e aparece de novo pela regra nova (e as duas
-- contas sozinhas viram um grupo so), e quem ja pontuou esta
-- semana mas nao estava em grupo entra na corrida.
-- ------------------------------------------------------------
insert into public.liga_fechamento (semana)
select distinct l.semana from public.liga l where l.semana < public.semana_atual()
on conflict (semana) do nothing;

update public.liga l
set frequencia = (
  select p.treinos_semana from public.liga_membro m
  join public.perfil p on p.user_id = m.user_id
  where m.liga_id = l.id
  order by m.entrou_em, m.user_id limit 1
)
where l.semana = public.semana_atual() and l.frequencia is null;

do $$
declare
  r record;
begin
  for r in
    select m.user_id, m.liga_id
    from public.liga_membro m join public.liga l on l.id = m.liga_id
    where l.semana = public.semana_atual()
      and (select count(*) from public.liga_membro x where x.liga_id = l.id) = 1
    order by l.id
  loop
    if (select count(*) from public.liga_membro where liga_id = r.liga_id) = 1 then
      delete from public.liga_membro where liga_id = r.liga_id and user_id = r.user_id;
      delete from public.liga where id = r.liga_id
        and not exists (select 1 from public.liga_membro where liga_id = r.liga_id);
      perform public.colocar_na_liga(r.user_id, public.semana_atual());
    end if;
  end loop;

  for r in
    select distinct p.user_id from public.pontos p
    where p.semana = public.semana_atual()
  loop
    perform public.colocar_na_liga(r.user_id, public.semana_atual());
  end loop;
end $$;

update public.liga set comecou_em = now()
where semana = public.semana_atual() and comecou_em is null
  and (select count(*) from public.liga_membro m where m.liga_id = liga.id) >= 2;

update public.liga_membro m
set xp_semana = (
  select coalesce(sum(p.xp), 0) from public.pontos p
  where p.user_id = m.user_id and p.semana = public.semana_atual()
)
where m.liga_id in (select id from public.liga where semana = public.semana_atual());


-- ------------------------------------------------------------
-- 13. O FECHAMENTO AGENDADO
--
-- Segunda-feira 15h UTC = meio-dia em Sao Paulo. Se um dia o
-- banco estiver parado nesse horario, a semana seguinte fecha as
-- duas, em ordem.
-- ------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  /* agendar com o mesmo nome substitui o agendamento antigo */
  execute $q$select cron.schedule('fechar-semana', '0 15 * * 1', 'select public.fechar_semana()')$q$;
exception when others then
  raise notice 'nao consegui agendar o fechamento: %', sqlerrm;
end $$;


-- ------------------------------------------------------------
-- 14. CONFERIR
--
-- select * from public.minha_liga();          -- logado no app
-- select id, semana, divisao, frequencia, comecou_em,
--        (select count(*) from public.liga_membro m where m.liga_id = liga.id) as pessoas
--   from public.liga order by id desc limit 10;
-- select jobname, schedule from cron.job;
-- ------------------------------------------------------------
