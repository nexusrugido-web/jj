-- ============================================================
-- TATAME OS, A LIGA POR DIVISAO
--
-- O que muda em relacao ao comunidade.sql:
--
-- 1. A divisao deixa de ser por XP acumulado e passa a ter nome
--    de faixa: branca, azul, roxa, marrom, preta. Todo mundo
--    comeca na branca.
--
--    A divisao NAO e a faixa da pessoa. Ela e o degrau em que a
--    pessoa esta no jogo, e usa o nome da faixa porque e a regua
--    que todo jiuziteiro entende. Um faixa branca que vai bem
--    chega na divisao Roxa, e continua sendo faixa branca.
--
-- 2. O fechamento da semana passa a subir e descer gente. Antes
--    ele so reagrupava, entao ninguem nunca saia do lugar.
--
-- 3. A temporada mensal sai. Ficam duas camadas: a liga, que
--    zera toda segunda e mede ritmo, e a jornada, que nunca
--    zera e mede o caminho.
--
-- 4. A jornada zera agora, uma vez. As linhas de ponto ficam,
--    porque sao elas que impedem alguem de ganhar ponto duas
--    vezes pelo mesmo video. O que zera e a soma.
--
-- Rode no SQL Editor do Supabase, depois de compra.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. OS NUMEROS QUE VOCE AJUSTA NO PAINEL
-- ------------------------------------------------------------
insert into public.ajuste (id, nome, descricao, valor, minimo, maximo, grupo) values
  ('liga_tamanho', 'Quantas pessoas por grupo',
   'Grupo pequeno deixa o ranking disputavel desde o comeco. Grupo grande so faz sentido com muita gente.',
   10, 5, 50, 'comunidade'),
  ('liga_corte', 'Quantos sobem e quantos descem',
   'No fim da semana, este tanto de cima sobe de divisao e este tanto de baixo desce.',
   3, 1, 10, 'comunidade'),
  ('recomendacoes', 'Recomendacoes na tela',
   'Quantas coisas o app aponta pra treinar. No plano gratuito so a primeira abre.',
   10, 1, 30, 'estudo')
on conflict (id) do nothing;

-- a data em que a jornada foi zerada, pra soma nenhuma olhar pra tras dela
insert into public.ajuste (id, nome, descricao, valor, texto, grupo) values
  ('zerado_em', 'Quando a jornada zerou',
   'Ponto registrado antes desta data nao entra na soma. As linhas continuam guardadas.',
   null, now()::text, 'comunidade')
on conflict (id) do nothing;


-- ------------------------------------------------------------
-- 2. AS DIVISOES
-- ------------------------------------------------------------
create or replace function public.divisoes()
returns text[] language sql immutable as $$
  select array['branca', 'azul', 'roxa', 'marrom', 'preta'];
$$;

create or replace function public.divisao_acima(p_div text)
returns text language sql immutable as $$
  select case p_div
    when 'branca' then 'azul'
    when 'azul'   then 'roxa'
    when 'roxa'   then 'marrom'
    when 'marrom' then 'preta'
    else 'preta'
  end;
$$;

create or replace function public.divisao_abaixo(p_div text)
returns text language sql immutable as $$
  select case p_div
    when 'preta'  then 'marrom'
    when 'marrom' then 'roxa'
    when 'roxa'   then 'azul'
    else 'branca'
  end;
$$;

-- todo mundo que ja existe comeca na branca
update public.total_xp set divisao = 'branca'
  where divisao is null or divisao not in ('branca', 'azul', 'roxa', 'marrom', 'preta');

alter table public.total_xp alter column divisao set default 'branca';


-- ------------------------------------------------------------
-- 3. A TEMPORADA MENSAL SAI
-- ------------------------------------------------------------
alter table public.total_xp drop column if exists mes;
alter table public.total_xp drop column if exists xp_mes;


-- ------------------------------------------------------------
-- 4. A SOMA, SEM O MES E SEM O QUE VEIO ANTES DO CORTE
-- ------------------------------------------------------------
create or replace function public.atualiza_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sem    date := date_trunc('week', current_date)::date;
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

  return new;
end $$;

-- zera a jornada de quem ja existe, sem apagar linha nenhuma
update public.total_xp set total = 0, xp_semana = 0, atualizado = now();
update public.liga_membro set xp_semana = 0;


-- ------------------------------------------------------------
-- 5. O FECHAMENTO DA SEMANA
--
-- O corte de cima sobe, o de baixo desce, e quem fica no meio
-- mantem a divisao. Grupo menor que o corte nao rebaixa
-- ninguem: com tres pessoas, todas seriam as tres ultimas.
--
-- Agende com pg_cron: domingo 23h50 em Sao Paulo.
--
-- A versao antiga devolvia so um numero. O Postgres nao troca o
-- tipo de retorno num create or replace, entao ela precisa cair
-- antes. Se houver um agendamento no pg_cron apontando pra ela,
-- ele continua valendo, porque o nome e o mesmo.
-- ------------------------------------------------------------
drop function if exists public.fechar_semana();

create or replace function public.fechar_semana()
returns table (subiram int, desceram int, grupos int)
language plpgsql security definer set search_path = public as $$
declare
  /* A semana que fecha e a ultima que tem grupo montado, e nao a
     de hoje. Sem isso, rodar depois da meia-noite de domingo ja
     cai na semana seguinte, nao acha grupo nenhum pra apurar e
     ninguem sobe nem desce, em silencio. O agendamento em UTC
     faz isso acontecer facil: domingo 23h50 de Sao Paulo ja e
     segunda de madrugada no servidor. */
  v_atual   date := (select max(semana) from public.liga where semana <= current_date);
  v_sem     date := date_trunc('week', current_date + interval '1 week')::date;
  v_tam     int  := public.ajuste_de('liga_tamanho', 10);
  v_corte   int  := public.ajuste_de('liga_corte', 3);
  v_sobe    int  := 0;
  v_desce   int  := 0;
  v_grupos  int  := 0;
  v_liga    bigint;
  v_div     text;
  v_linha   record;
  v_n       int;
  v_total   int;
begin
  /* Se os grupos da proxima semana ja existem, esta semana ja foi
     fechada. Rodar de novo promoveria a mesma gente duas vezes. */
  if exists (select 1 from public.liga where semana = v_sem) then
    return query select 0, 0, 0;
    return;
  end if;

  -- ---------- quem sobe e quem desce ----------
  for v_liga in select id from public.liga where semana = v_atual loop
    select count(*) into v_total from public.liga_membro where liga_id = v_liga;

    /* sobe: o corte de cima, e so quem pontuou. Subir de divisao
       sem ter feito nada na semana esvazia o sentido do degrau. */
    for v_linha in
      select m.user_id
      from public.liga_membro m
      where m.liga_id = v_liga and m.xp_semana > 0
      order by m.xp_semana desc, m.user_id
      limit v_corte
    loop
      update public.total_xp
      set divisao = public.divisao_acima(divisao), atualizado = now()
      where user_id = v_linha.user_id and divisao <> 'preta';
      if found then v_sobe := v_sobe + 1; end if;
    end loop;

    /* desce: so quando o grupo tem gente suficiente pra existir um
       fundo de verdade. O dobro do corte e o minimo pra o de cima
       e o de baixo nao serem a mesma gente. */
    if v_total >= v_corte * 2 then
      for v_linha in
        select m.user_id
        from public.liga_membro m
        where m.liga_id = v_liga
        order by m.xp_semana asc, m.user_id
        limit v_corte
      loop
        update public.total_xp
        set divisao = public.divisao_abaixo(divisao), atualizado = now()
        where user_id = v_linha.user_id and divisao <> 'branca';
        if found then v_desce := v_desce + 1; end if;
      end loop;
    end if;
  end loop;

  -- ---------- monta os grupos da semana que vem ----------
  foreach v_div in array public.divisoes() loop
    v_n := 0;
    v_liga := null;

    for v_linha in
      select t.user_id
      from public.total_xp t
      join public.perfil p on p.user_id = t.user_id
      where p.participa_liga = true and t.divisao = v_div
      order by t.xp_semana desc, t.user_id
    loop
      if v_liga is null or v_n >= v_tam then
        insert into public.liga (semana, divisao) values (v_sem, v_div) returning id into v_liga;
        v_grupos := v_grupos + 1;
        v_n := 0;
      end if;

      insert into public.liga_membro (liga_id, user_id, xp_semana)
      values (v_liga, v_linha.user_id, 0)
      on conflict do nothing;

      v_n := v_n + 1;
    end loop;
  end loop;

  -- ---------- zera o placar da semana ----------
  update public.total_xp set xp_semana = 0, semana = v_sem;

  return query select v_sobe, v_desce, v_grupos;
end $$;

revoke all on function public.fechar_semana() from public, authenticated;

-- ------------------------------------------------------------
-- AGENDAR O FECHAMENTO
--
-- O pg_cron nao vem ligado. Ligue uma vez, e so depois agende:
--
--   create extension if not exists pg_cron;
--   select cron.schedule('fechar-semana', '50 23 * * 0',
--                        $$select public.fechar_semana()$$);
--
-- ATENCAO AO FUSO: o pg_cron conta em UTC, nao no horario de
-- Sao Paulo. O '50 23 * * 0' acima e domingo 23h50 UTC, que da
-- domingo 20h50 em Sao Paulo. Serve, e e o mais seguro, porque
-- ainda esta dentro da semana que vai fechar.
--
-- Nao agende pra depois da meia-noite UTC de domingo achando que
-- esta pegando a noite de domingo no Brasil: la ja e segunda
-- pro banco.
--
-- Pra conferir o que esta agendado:
--   select * from cron.job;
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- 6. ENTRAR NA LIGA, JA NA DIVISAO CERTA
-- ------------------------------------------------------------
create or replace function public.entrar_na_liga(p_apelido text default null, p_anonimo boolean default false)
returns table (ok boolean, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_tam  int  := public.ajuste_de('liga_tamanho', 10);
  v_div  text;
  v_liga bigint;
begin
  if v_user is null then
    return query select false, 'Entre com a sua conta primeiro.'::text; return;
  end if;

  update public.perfil
  set participa_liga = true,
      anonimo = p_anonimo,
      apelido = coalesce(p_apelido, apelido),
      atualizado_em = now()
  where user_id = v_user;

  -- quem nunca pontuou ainda nao tem linha de total
  insert into public.total_xp (user_id, divisao) values (v_user, 'branca')
  on conflict (user_id) do nothing;

  if exists (
    select 1 from public.liga_membro m
    join public.liga l on l.id = m.liga_id
    where m.user_id = v_user and l.semana = date_trunc('week', current_date)::date
  ) then
    return query select true, 'Voce ja esta na liga.'::text; return;
  end if;

  select coalesce(divisao, 'branca') into v_div from public.total_xp where user_id = v_user;

  select l.id into v_liga from public.liga l
  where l.semana = date_trunc('week', current_date)::date and l.divisao = v_div
    and (select count(*) from public.liga_membro where liga_id = l.id) < v_tam
  limit 1;

  if v_liga is null then
    insert into public.liga (semana, divisao)
    values (date_trunc('week', current_date)::date, v_div) returning id into v_liga;
  end if;

  insert into public.liga_membro (liga_id, user_id, xp_semana)
  values (v_liga, v_user, coalesce((select xp_semana from public.total_xp where user_id = v_user), 0))
  on conflict do nothing;

  return query select true, 'Pronto, voce esta na liga.'::text;
end $$;

grant execute on function public.entrar_na_liga(text, boolean) to authenticated;


-- ------------------------------------------------------------
-- 7. VALE A PENA LIGAR A LIGA?
-- Agora a conta usa o tamanho de grupo que voce escolheu.
-- ------------------------------------------------------------
create or replace function public.pronto_pra_liga()
returns table (pronto boolean, participantes bigint, faltam bigint, recado text)
language plpgsql security definer set search_path = public as $$
declare
  v_n   bigint;
  v_min bigint;
begin
  if not public.sou_admin() then
    raise exception 'so administrador';
  end if;

  v_min := public.ajuste_de('liga_tamanho', 10);

  select count(*) into v_n
  from public.perfil p
  join public.total_xp t on t.user_id = p.user_id
  where p.participa_liga and t.xp_semana > 0;

  if v_n >= v_min then
    return query select true, v_n, 0::bigint,
      ('Da pra ligar. ' || v_n || ' pessoas pontuando esta semana, o suficiente pra montar grupo cheio.')::text;
  elsif v_n >= v_min / 2 then
    return query select false, v_n, (v_min - v_n),
      ('Quase la. ' || v_n || ' pessoas pontuando, e o grupo e de ' || v_min || '.')::text;
  else
    return query select false, v_n, (v_min - v_n),
      ('Ainda cedo. So ' || v_n || ' pessoas pontuando, e o grupo e de ' || v_min || '.')::text;
  end if;
end $$;

grant execute on function public.pronto_pra_liga() to authenticated;


-- ------------------------------------------------------------
-- 8. OS NUMEROS DO PAINEL, SEM O MES
-- ------------------------------------------------------------
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
    (select count(distinct user_id) from public.pontos where data > current_date - 7),
    (select count(distinct user_id) from public.pontos where data > current_date - 30),
    (select count(*) from public.perfil where participa_liga),
    (select count(*) from public.assinatura where status = 'ativa'),
    (select count(*) from public.assinatura where status = 'atrasada'),
    (select coalesce(sum(xp), 0) from public.pontos where semana = date_trunc('week', current_date)::date),
    (select count(*) from public.pontos where evento in ('aula', 'short', 'revista', 'revistaShort')),
    (select count(*) from public.liga where semana >= date_trunc('week', current_date)::date);
end $$;

grant execute on function public.numeros_do_produto() to authenticated;


-- ------------------------------------------------------------
-- 9. CONFERIR
--
-- select divisao, count(*) from public.total_xp group by divisao;
-- select * from public.ajuste where grupo = 'comunidade';
-- select total, xp_semana from public.total_xp;
--
-- pra testar o fechamento sem esperar domingo:
-- select * from public.fechar_semana();
-- ------------------------------------------------------------
