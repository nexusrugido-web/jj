-- ============================================================
-- TATAME OS, AS NOTIFICACOES
--
-- Nao existe agendar notificacao no aparelho. A Notification
-- Triggers API do Chrome nunca saiu do origin trial e o iOS
-- nunca teve nada parecido. Entao toda notificacao com hora
-- marcada sai daqui, do servidor.
--
-- O pg_cron acorda de hora em hora, pergunta pra este arquivo
-- quem merece ser avisado agora, e a Edge Function "notificar"
-- assina e entrega.
--
-- TRES REGRAS QUE VIERAM DA PESQUISA, E NENHUMA E ENFEITE:
--
--   a hora e a da pessoa   o Duolingo notifica na janela em que
--                          ela costuma usar o app, e nao num
--                          horario fixo. Aqui a hora sai da
--                          media dos proprios pontos dela.
--
--   nunca duas vezes       cada tipo sai uma vez por dia, por
--                          pessoa. A trava e uma chave primaria,
--                          e nao um if: rodar o cron duas vezes
--                          nao manda duas.
--
--   cala a boca em 7 dias  quem nao responde a sete avisos para
--                          de receber. Nao e educacao: desde
--                          2026 o Chrome cassa a permissao de
--                          quem manda muito e engaja pouco, e
--                          permissao cassada nao volta.
--
-- Rode no SQL Editor do Supabase, depois de ofensiva.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. A INSCRICAO DE CADA APARELHO
--
-- Uma pessoa pode ter varios: o celular, o tablet, o desktop.
-- A chave e o endpoint porque e ele que identifica o aparelho
-- pro servico de push do navegador.
--
-- fuso: o IANA do aparelho (America/Sao_Paulo). Sem ele, "as
-- 19h" viraria 19h de Greenwich e chegaria as 16h aqui.
-- ------------------------------------------------------------
create table if not exists public.push_inscricao (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  fuso       text not null default 'America/Sao_Paulo',
  criado_em  timestamptz not null default now(),
  falhas     int not null default 0
);

create index if not exists push_inscricao_user on public.push_inscricao (user_id);

alter table public.push_inscricao enable row level security;

drop policy if exists push_minha on public.push_inscricao;
create policy push_minha on public.push_inscricao
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ------------------------------------------------------------
-- 2. O QUE JA FOI MANDADO
--
-- A chave primaria e a trava: (pessoa, tipo, dia). Tentar
-- gravar de novo da conflito, e a fila nao devolve a pessoa.
--
-- respondeu: se ela abriu o app depois de receber. E o que
-- decide se continua valendo a pena avisar.
-- ------------------------------------------------------------
create table if not exists public.notificacao_envio (
  user_id    uuid not null references auth.users(id) on delete cascade,
  tipo       text not null,
  dia        date not null,
  enviado_em timestamptz not null default now(),
  respondeu  boolean not null default false,
  primary key (user_id, tipo, dia)
);

alter table public.notificacao_envio enable row level security;

create index if not exists notificacao_envio_user on public.notificacao_envio (user_id, enviado_em desc);


-- ------------------------------------------------------------
-- 3. O INTERRUPTOR
--
-- Nasce ligado, mas a inscricao e que manda: sem aparelho
-- inscrito nao sai nada, e inscrever exige a pessoa tocar num
-- botao e aceitar a permissao do sistema.
-- ------------------------------------------------------------
alter table public.perfil add column if not exists notificar boolean not null default true;


-- ------------------------------------------------------------
-- 4. A HORA DA PESSOA
--
-- A janela em que ela costuma usar o app, tirada dos ultimos 30
-- dias de ponto, no fuso dela. Sem historico, 19h: fim de tarde,
-- antes do treino da noite.
--
-- Uma hora antes do costume, porque avisar na hora exata chega
-- quando ela ja abriu. O Duolingo faz igual.
-- ------------------------------------------------------------
create or replace function public.hora_da_pessoa(p_user uuid, p_fuso text)
returns int language sql stable set search_path = public as $$
  select coalesce(
    (
      select (((mode() within group (order by extract(hour from p.criado_em at time zone p_fuso)))::int + 23) % 24)
      from public.pontos p
      where p.user_id = p_user and p.criado_em > now() - interval '30 days'
    ),
    19
  );
$$;


-- ------------------------------------------------------------
-- 5. A FILA
--
-- Devolve quem deve ser avisado NESTE momento, ja com o texto
-- pronto. A Edge Function so assina e entrega: nenhuma regra de
-- produto mora la.
--
-- Os quatro tipos, e quando cada um sai:
--
--   ofensiva   na hora da pessoa, quando o dia ainda nao fechou
--              e ela tem ofensiva pra perder
--   liga       domingo de manha, quando ela esta num grupo que
--              correu e nao esta em primeiro
--   resultado  segunda de tarde, depois do fechar_semana do
--              meio-dia, so pra quem subiu ou desceu
--   volta      sumiu faz 7 dias ou mais. Uma vez, e so.
--
-- A ordem importa: se dois tipos batem na mesma hora, o de cima
-- ganha. Duas notificacoes no mesmo minuto e o caminho mais
-- rapido pra pessoa desligar tudo.
-- ------------------------------------------------------------
/* a versao antiga nao tinha argumento. Sem derrubar ela, o
   Postgres fica com as duas e a chamada sem argumento cai na
   velha, que nao sabe testar. */
drop function if exists public.fila_de_notificacao();

create or replace function public.fila_de_notificacao(p_teste uuid default null)
returns table (
  user_id  uuid,
  tipo     text,
  dia      date,
  titulo   text,
  corpo    text,
  caminho  text,
  emblema  int,
  endpoint text,
  p256dh   text,
  auth     text
)
language plpgsql security definer set search_path = public as $$
begin
  /* TESTE: pula todas as regras e manda pra todos os aparelhos de
     uma pessoa so. Serve pra ver a notificacao na mao sem esperar
     a hora certa, e pra saber se a corrente inteira (banco ->
     funcao -> servico de push -> aparelho) esta de pe. */
  if p_teste is not null then
    return query
    select i.user_id, 'teste'::text, (now() at time zone i.fuso)::date,
           'Testando os avisos'::text,
           'Se voce esta vendo isto no celular, a corrente inteira funciona.'::text,
           '/?go=jornada'::text, 1, i.endpoint, i.p256dh, i.auth
    from public.push_inscricao i
    where i.user_id = p_teste;
    return;
  end if;

  return query
  with aparelho as (
    select
      i.user_id, i.endpoint, i.p256dh, i.auth, i.fuso, p.sequencia,
      (now() at time zone i.fuso)::date            as hoje_dele,
      extract(hour from now() at time zone i.fuso)::int as hora_dele,
      extract(isodow from now() at time zone i.fuso)::int as dia_semana
    from public.push_inscricao i
    join public.perfil p on p.user_id = i.user_id
    where p.notificar and i.falhas < 5
  ),
  /* quem ignorou os ultimos 7 avisos para de receber. Mandar pra
     quem nunca abre e o que faz o Chrome cassar a permissao. */
  surdo as (
    select e.user_id
    from public.notificacao_envio e
    where e.enviado_em > now() - interval '60 days'
    group by e.user_id
    having count(*) filter (where not e.respondeu) >= 7
       and count(*) filter (where e.respondeu and e.enviado_em > now() - interval '30 days') = 0
  ),
  candidato as (
    select
      a.*,
      (select max(p.data) from public.pontos p where p.user_id = a.user_id) as ultimo_ponto,
      /* o dia fechado e o de hoje com ponto, ou o dia pago por um
         treino de ate dois dias atras. A mesma regra do aparelho
         (src/lib/ofensiva.js): se discordar, o app diz que esta
         tudo certo e a notificacao cobra assim mesmo. */
      exists (
        select 1 from public.pontos p
        where p.user_id = a.user_id
          and (p.data = a.hoje_dele
            or (p.evento = 'treino' and p.data >= a.hoje_dele - 2 and p.data < a.hoje_dele))
      ) as fechou_hoje,
      public.hora_da_pessoa(a.user_id, a.fuso) as hora_boa
    from aparelho a
    where a.user_id not in (select user_id from surdo)
  ),
  escolhido as (
    select
      c.*,
      case
        /* 1. a ofensiva, na hora dela */
        when c.hora_dele = c.hora_boa and not c.fechou_hoje and c.sequencia > 0
          then 'ofensiva'
        /* 2. a reta final da liga, domingo de manha */
        when c.dia_semana = 7 and c.hora_dele = 10 and exists (
          select 1 from public.liga_membro m
          join public.liga l on l.id = m.liga_id
          where m.user_id = c.user_id
            and l.semana = public.semana_atual()
            and l.comecou_em is not null
        ) then 'liga'
        /* 3. o resultado, segunda depois do fechamento do meio-dia */
        when c.dia_semana = 1 and c.hora_dele = 14 and exists (
          select 1 from public.liga_fechamento f
          where f.semana = public.semana_atual() - 7
        ) then 'resultado'
        /* 4. a volta por cima, uma vez so */
        when c.hora_dele = c.hora_boa
          and (c.ultimo_ponto is null or c.ultimo_ponto <= c.hoje_dele - 7)
          then 'volta'
        else null
      end as tipo_dele
    from candidato c
  ),
  texto as (
    select
      e.user_id, e.tipo_dele as tipo, e.hoje_dele as dia,
      e.endpoint, e.p256dh, e.auth, e.sequencia,
      case e.tipo_dele
        when 'ofensiva' then
          case when e.sequencia = 1
            then 'Sua ofensiva fecha hoje'
            else e.sequencia || ' dias seguidos, e hoje ainda esta aberto' end
        when 'liga'      then 'A semana da liga fecha hoje'
        when 'resultado' then 'A liga fechou'
        when 'volta'     then 'O tatame continua ai'
      end as titulo,
      case e.tipo_dele
        when 'ofensiva' then 'Uma aula rapida custa trinta segundos e mantem ela de pe.'
        when 'liga'     then 'Ainda da pra mexer na sua posicao antes da meia-noite.'
        when 'resultado' then 'Veja onde voce parou e com quem voce corre esta semana.'
        when 'volta'    then 'Seu jogo esta do mesmo jeito que voce deixou. Da pra voltar por uma aula.'
      end as corpo,
      case e.tipo_dele
        when 'ofensiva' then '/?go=estudo'
        when 'liga'      then '/?go=jornada'
        when 'resultado' then '/?go=jornada'
        when 'volta'     then '/?go=estudo'
      end as caminho
    from escolhido e
    where e.tipo_dele is not null
  )
  select t.user_id, t.tipo, t.dia, t.titulo, t.corpo, t.caminho, 1,
         t.endpoint, t.p256dh, t.auth
  from texto t
  /* a trava: se ja saiu hoje, nao sai de novo */
  where not exists (
    select 1 from public.notificacao_envio n
    where n.user_id = t.user_id and n.tipo = t.tipo and n.dia = t.dia
  )
  /* e a volta por cima e uma vez a cada 30 dias, nao por dia */
  and not (t.tipo = 'volta' and exists (
    select 1 from public.notificacao_envio n
    where n.user_id = t.user_id and n.tipo = 'volta'
      and n.enviado_em > now() - interval '30 days'
  ));
end $$;

revoke all on function public.fila_de_notificacao(uuid) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 5b. O DIAGNOSTICO E O TESTE
--
-- Notificacao que nao chega quase nunca e uma coisa so: e um elo
-- da corrente que arrebentou. Estas duas funcoes dizem qual.
--
--   select * from public.diagnostico_de_aviso('seu@email.com');
--   select public.testar_aviso('seu@email.com');
-- ------------------------------------------------------------
create or replace function public.diagnostico_de_aviso(p_email text)
returns table (elo text, situacao text, detalhe text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_n    int;
  v_fuso text;
  v_hoje date;
begin
  /* só quem administra: aberta, qualquer visitante descobria se um
     e-mail tem conta e mandava aviso pro celular de qualquer aluno */
  if not public.sou_admin() then
    raise exception 'so o administrador testa avisos';
  end if;
  select id into v_user from auth.users where email = lower(trim(p_email));
  if v_user is null then
    return query select '1. conta'::text, 'NAO'::text, ('nenhuma conta com o email ' || p_email)::text;
    return;
  end if;
  return query select '1. conta'::text, 'ok'::text, v_user::text;

  select count(*), max(fuso) into v_n, v_fuso from public.push_inscricao where user_id = v_user;
  v_fuso := coalesce(v_fuso, 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;

  return query select '2. aparelho inscrito'::text,
    case when v_n > 0 then 'ok' else 'NAO' end::text,
    case when v_n > 0 then v_n || ' aparelho(s), fuso ' || v_fuso
         else 'ninguem tocou em Ligar avisos. No iPhone so funciona com o app instalado na tela de inicio.' end::text;

  return query select '3. interruptor'::text,
    case when coalesce((select notificar from public.perfil where user_id = v_user), false)
      then 'ok' else 'NAO' end::text,
    'perfil.notificar'::text;

  return query select '4. ofensiva no servidor'::text,
    case when coalesce((select sequencia from public.perfil where user_id = v_user), 0) > 0
      then 'ok' else 'NAO' end::text,
    ('perfil.sequencia = ' || coalesce((select sequencia from public.perfil where user_id = v_user), 0)
      || '. Se for 0, o app ainda nao subiu a ofensiva: abra o app logado.')::text;

  return query select '5. hora do aviso'::text, 'info'::text,
    ('sai as ' || public.hora_da_pessoa(v_user, v_fuso) || 'h; agora sao '
      || extract(hour from now() at time zone v_fuso)::int || 'h no fuso ' || v_fuso)::text;

  return query select '6. ja fechou o dia?'::text,
    case when exists (
      select 1 from public.pontos p
      where p.user_id = v_user
        and (p.data = v_hoje or (p.evento = 'treino' and p.data >= v_hoje - 2 and p.data < v_hoje))
    ) then 'SIM' else 'nao' end::text,
    'quem ja fechou o dia nao recebe cobranca de ofensiva, e isso esta certo'::text;

  return query select '7. cron agendado'::text,
    case when exists (select 1 from cron.job where jobname = 'notificar') then 'ok' else 'NAO' end::text,
    coalesce((select schedule from cron.job where jobname = 'notificar'), 'rode a secao 8 deste arquivo')::text;

  return query select '8. segredos do vault'::text,
    case when (select count(*) from vault.secrets where name in ('url_notificar', 'chave_notificar')) = 2
      then 'ok' else 'NAO' end::text,
    'precisa de url_notificar e chave_notificar'::text;

  return query select '9. ja saiu alguma?'::text, 'info'::text,
    coalesce((select count(*)::text || ' aviso(s), ultimo em ' || max(enviado_em)::text
      from public.notificacao_envio where user_id = v_user), 'nenhum ainda')::text;
end $$;


create or replace function public.testar_aviso(p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_n    int;
begin
  /* só quem administra: aberta, qualquer visitante descobria se um
     e-mail tem conta e mandava aviso pro celular de qualquer aluno */
  if not public.sou_admin() then
    raise exception 'so o administrador testa avisos';
  end if;
  select id into v_user from auth.users where email = lower(trim(p_email));
  if v_user is null then return 'nenhuma conta com esse email'; end if;

  select count(*) into v_n from public.push_inscricao where user_id = v_user;
  if v_n = 0 then
    return 'nenhum aparelho inscrito. Abra o app logado: Ajustes -> Avisos -> Ligar avisos.';
  end if;

  if (select count(*) from vault.secrets where name in ('url_notificar', 'chave_notificar')) < 2 then
    return 'faltam os segredos url_notificar e/ou chave_notificar no vault.';
  end if;

  perform net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'url_notificar'),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        (select decrypted_secret from vault.decrypted_secrets where name = 'chave_notificar')
    ),
    body    := jsonb_build_object('teste', v_user)
  );

  return 'mandei pra ' || v_n || ' aparelho(s). Chega em segundos. Se nao chegar, veja os logs da funcao notificar no painel.';
end $$;



revoke all on function public.diagnostico_de_aviso(text) from public, anon;
revoke all on function public.testar_aviso(text) from public, anon;
grant execute on function public.diagnostico_de_aviso(text) to authenticated;
grant execute on function public.testar_aviso(text) to authenticated;

-- ------------------------------------------------------------
-- 6. MARCAR O QUE SAIU, E LIMPAR O QUE MORREU
--
-- 404 e 410 do servico de push querem dizer que o aparelho nao
-- existe mais: desinstalou, limpou os dados, trocou de celular.
-- Insistir nesses e o que enche a fila de lixo.
-- ------------------------------------------------------------
create or replace function public.marcar_notificacao(p_linhas jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_linha jsonb;
  v_n int := 0;
begin
  for v_linha in select * from jsonb_array_elements(p_linhas) loop
    if (v_linha->>'ok')::boolean then
      insert into public.notificacao_envio (user_id, tipo, dia)
      values ((v_linha->>'user_id')::uuid, v_linha->>'tipo', (v_linha->>'dia')::date)
      on conflict do nothing;
      update public.push_inscricao set falhas = 0 where endpoint = v_linha->>'endpoint';
      v_n := v_n + 1;
    elsif (v_linha->>'codigo')::int in (404, 410) then
      delete from public.push_inscricao where endpoint = v_linha->>'endpoint';
    else
      update public.push_inscricao set falhas = falhas + 1 where endpoint = v_linha->>'endpoint';
    end if;
  end loop;
  return v_n;
end $$;

revoke all on function public.marcar_notificacao(jsonb) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 7. ELA ABRIU DEPOIS DE RECEBER
--
-- O app chama isto ao abrir. E o que diz se a notificacao
-- funcionou, e e o que decide quando parar de mandar.
-- ------------------------------------------------------------
create or replace function public.notificacao_respondida()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  update public.notificacao_envio
  set respondeu = true
  where user_id = v_user and not respondeu and enviado_em > now() - interval '24 hours';
  return true;
end $$;

grant execute on function public.notificacao_respondida() to authenticated;


-- ------------------------------------------------------------
-- 8. AGENDAR
--
-- De hora em hora, cheia. A fila ja sabe filtrar por hora local
-- de cada pessoa, entao o cron nao precisa saber de fuso nenhum.
--
-- Troque a URL e a chave pelos seus antes de rodar:
--   select vault.create_secret('https://SEUPROJETO.supabase.co/functions/v1/notificar', 'url_notificar');
--   select vault.create_secret('SUA_CHAVE_sb_secret', 'chave_notificar');
--
-- A chave vai no header apikey (as chaves novas sb_secret_ nao sao JWT
-- e o Authorization: Bearer recusa). A funcao notificar confere ela.
--
-- Precisa das duas extensoes ligadas:
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
-- ------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  execute $q$
    select cron.schedule('notificar', '0 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'url_notificar'),
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'apikey',        (select decrypted_secret from vault.decrypted_secrets where name = 'chave_notificar')
        ),
        body    := '{}'::jsonb
      )
    $c$)
  $q$;
exception when others then
  raise notice 'nao consegui agendar as notificacoes: %', sqlerrm;
end $$;


-- ------------------------------------------------------------
-- 9. CONFERIR
--
-- select * from public.fila_de_notificacao();     -- quem sairia agora
-- select count(*) from public.push_inscricao;     -- aparelhos inscritos
-- select tipo, count(*), count(*) filter (where respondeu) as abriram
--   from public.notificacao_envio group by tipo;  -- o que funciona
-- select jobname, schedule from cron.job;
--
-- pra testar sem esperar a hora cheia:
-- select net.http_post(url := '.../functions/v1/notificar', ...);
-- ------------------------------------------------------------
