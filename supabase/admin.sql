-- ============================================================
-- TATAME OS, PAINEL DO ADMINISTRADOR
--
-- Serve pra ligar e desligar recurso sem mexer em codigo e
-- sem fazer deploy. Voce clica, e vale pra todo mundo na
-- proxima vez que o app abrir.
--
-- Rode depois de comunidade.sql e assinatura.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. QUEM E ADMINISTRADOR
-- ------------------------------------------------------------
create table if not exists public.admin (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table public.admin enable row level security;

drop policy if exists admin_leitura on public.admin;
create policy admin_leitura on public.admin
  for select to authenticated using (user_id = auth.uid());

create or replace function public.sou_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin where user_id = auth.uid());
$$;

grant execute on function public.sou_admin() to authenticated;

-- ------------------------------------------------------------
-- IMPORTANTE, O PASSO QUE FALTA
--
-- Abrir o painel com ?admin=1 destrava so a TELA, no aparelho.
-- Salvar chave, fatia e recado passa pela regra abaixo, que
-- so conhece quem esta nesta tabela.
--
-- Enquanto a sua conta nao estiver aqui, o update roda, acerta
-- zero linhas e volta sem erro nenhum: o interruptor vira na
-- tela e desvira no proximo Atualizar.
--
-- Troque o email pelo da conta que voce usa no app e rode uma
-- vez. Depois recarregue o app.
--
-- insert into public.admin (user_id)
-- select id from auth.users where email = 'seu@email.com'
-- on conflict do nothing;
--
-- Pra conferir:
-- select * from public.admin;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 2. CHAVES DE RECURSO
-- Liga ou desliga pedaco do app sem deploy.
-- ------------------------------------------------------------
create table if not exists public.chave (
  id          text primary key,
  nome        text not null,
  descricao   text,
  ligada      boolean not null default false,
  porcentagem int not null default 100 check (porcentagem between 0 and 100),
  grupo       text not null default 'geral',
  atualizado  timestamptz not null default now()
);

alter table public.chave enable row level security;

-- todo mundo le, porque o app precisa saber o que esta ligado
drop policy if exists chave_leitura on public.chave;
create policy chave_leitura on public.chave for select to anon, authenticated using (true);

drop policy if exists chave_escrita on public.chave;
create policy chave_escrita on public.chave
  for all to authenticated using (public.sou_admin()) with check (public.sou_admin());

insert into public.chave (id, nome, descricao, ligada, grupo) values
  ('liga', 'Liga entre praticantes',
   'Ranking semanal em grupos de 30. So vale a pena ligar com gente suficiente participando.', false, 'comunidade'),
  ('liga_convite', 'Convidar pra liga no painel',
   'Mostra o convite pra entrar na liga na tela inicial de quem ainda nao participa.', false, 'comunidade'),
  ('voz', 'Registrar treino por voz',
   'O aluno fala e o app preenche. Depende do navegador dele aceitar.', true, 'registro'),
  ('timer', 'Cronometro de rola',
   'Timer com apito de inicio e fim, e convite pra registrar no final.', true, 'registro'),
  ('ia', 'Leitura da IA',
   'Insights em cima dos numeros. Cada uso custa, entao da pra desligar se apertar.', true, 'custo'),
  ('quiz', 'Quiz de conceito', 'As perguntas de principio dentro do Estudo.', true, 'estudo'),
  ('estudo', 'Aulas em video', 'A aba de Estudo inteira.', true, 'estudo'),
  ('musculacao', 'Musculacao', 'O modulo de registro de treino de forca.', true, 'geral'),
  ('cobranca', 'Cobranca ligada',
   'Com isto desligado, todo mundo usa tudo de graca. Util antes de comecar a vender.', false, 'venda'),
  ('aviso_global', 'Aviso no topo do app',
   'Mostra um recado pra todo mundo. O texto fica no campo de recado.', false, 'geral')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3. RECADO PRA TODO MUNDO
-- ------------------------------------------------------------
create table if not exists public.recado (
  id         int primary key default 1,
  titulo     text,
  texto      text,
  tom        text not null default 'info',   -- info | atencao | bom
  link       text,
  atualizado timestamptz not null default now(),
  constraint so_uma_linha check (id = 1)
);

insert into public.recado (id, titulo, texto) values (1, '', '') on conflict do nothing;

alter table public.recado enable row level security;
drop policy if exists recado_leitura on public.recado;
create policy recado_leitura on public.recado for select to anon, authenticated using (true);
drop policy if exists recado_escrita on public.recado;
create policy recado_escrita on public.recado
  for all to authenticated using (public.sou_admin()) with check (public.sou_admin());

-- ------------------------------------------------------------
-- 4. OS NUMEROS DO PRODUTO
-- So o administrador ve.
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
    (select count(*) from public.pontos where evento in ('aula', 'short')),
    (select count(*) from public.liga where semana >= date_trunc('week', current_date)::date);
end $$;

grant execute on function public.numeros_do_produto() to authenticated;

-- ------------------------------------------------------------
-- 5. VALE A PENA LIGAR A LIGA?
-- Responde com base em quanta gente tem participando.
-- ------------------------------------------------------------
create or replace function public.pronto_pra_liga()
returns table (pronto boolean, participantes bigint, faltam bigint, recado text)
language plpgsql security definer set search_path = public as $$
declare
  v_n bigint;
  v_min constant bigint := 30;
begin
  if not public.sou_admin() then
    raise exception 'so administrador';
  end if;

  select count(*) into v_n
  from public.perfil p
  join public.total_xp t on t.user_id = p.user_id
  where p.participa_liga and t.xp_semana > 0;

  if v_n >= v_min then
    return query select true, v_n, 0::bigint,
      ('Da pra ligar. ' || v_n || ' pessoas pontuando esta semana, o suficiente pra montar grupo cheio.')::text;
  elsif v_n >= 10 then
    return query select false, v_n, (v_min - v_n),
      ('Ainda cedo. ' || v_n || ' pessoas pontuando. Com menos de 30 o grupo fica vazio e desanima quem entra.')::text;
  else
    return query select false, v_n, (v_min - v_n),
      ('Muito cedo. So ' || v_n || ' pessoas pontuando. Ligar agora seria constrangedor pra quem entrar.')::text;
  end if;
end $$;

grant execute on function public.pronto_pra_liga() to authenticated;

-- ------------------------------------------------------------
-- 6. ENVIAR OS PONTOS PRO SERVIDOR
-- O app manda o que registrou, o servidor confere e grava.
-- ------------------------------------------------------------
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

  -- atualiza o grupo da semana, se a pessoa estiver em algum
  update public.liga_membro m
  set xp_semana = (
    select coalesce(sum(xp), 0) from public.pontos
    where user_id = v_user and semana = date_trunc('week', current_date)::date
  )
  where m.user_id = v_user
    and m.liga_id in (select id from public.liga where semana = date_trunc('week', current_date)::date);

  return query select v_ok, v_no;
end $$;

grant execute on function public.subir_pontos(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 7. ENTRAR OU SAIR DA LIGA
-- ------------------------------------------------------------
create or replace function public.entrar_na_liga(p_apelido text default null, p_anonimo boolean default false)
returns table (ok boolean, mensagem text)
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
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

  -- entra num grupo desta semana, ou cria um se nao houver vaga
  if not exists (
    select 1 from public.liga_membro m
    join public.liga l on l.id = m.liga_id
    where m.user_id = v_user and l.semana = date_trunc('week', current_date)::date
  ) then
    declare
      v_div text;
      v_liga bigint;
    begin
      select coalesce(divisao, 'iniciante') into v_div from public.total_xp where user_id = v_user;
      if v_div is null then v_div := 'iniciante'; end if;

      select l.id into v_liga from public.liga l
      where l.semana = date_trunc('week', current_date)::date and l.divisao = v_div
        and (select count(*) from public.liga_membro where liga_id = l.id) < 30
      limit 1;

      if v_liga is null then
        insert into public.liga (semana, divisao)
        values (date_trunc('week', current_date)::date, v_div) returning id into v_liga;
      end if;

      insert into public.liga_membro (liga_id, user_id, xp_semana)
      values (v_liga, v_user, coalesce((select xp_semana from public.total_xp where user_id = v_user), 0))
      on conflict do nothing;
    end;
  end if;

  return query select true, 'Pronto, voce esta na liga.'::text;
end $$;

grant execute on function public.entrar_na_liga(text, boolean) to authenticated;

create or replace function public.sair_da_liga()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  update public.perfil set participa_liga = false, atualizado_em = now() where user_id = v_user;
  delete from public.liga_membro where user_id = v_user;
  return true;
end $$;

grant execute on function public.sair_da_liga() to authenticated;

-- ------------------------------------------------------------
-- 8. O MEU GRUPO
-- ------------------------------------------------------------
create or replace function public.minha_liga()
returns table (
  posicao   bigint,
  user_id   uuid,
  nome      text,
  faixa     text,
  graus     int,
  xp_semana int,
  sou_eu    boolean,
  divisao   text,
  total     bigint
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_liga bigint;
begin
  if v_user is null then return; end if;

  select m.liga_id into v_liga from public.liga_membro m
  join public.liga l on l.id = m.liga_id
  where m.user_id = v_user and l.semana = date_trunc('week', current_date)::date
  limit 1;

  if v_liga is null then return; end if;

  return query
  select
    rank() over (order by m.xp_semana desc, p.user_id)::bigint,
    p.user_id,
    public.nome_publico(p),
    p.faixa, p.graus, m.xp_semana,
    (p.user_id = v_user),
    l.divisao,
    (select count(*) from public.liga_membro where liga_id = v_liga)::bigint
  from public.liga_membro m
  join public.perfil p on p.user_id = m.user_id
  join public.liga l on l.id = m.liga_id
  where m.liga_id = v_liga
  order by m.xp_semana desc, p.user_id;
end $$;

grant execute on function public.minha_liga() to authenticated;
