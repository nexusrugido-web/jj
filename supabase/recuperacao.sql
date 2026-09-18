-- ============================================================
-- TATAME OS, O RECUPERADOR DE CARRINHO
--
-- Quem chegou no checkout e nao pagou recebe uma sequencia curta
-- de mensagens no WhatsApp, e a sequencia para sozinha quando:
--
--   a pessoa compra              (vira "recuperado")
--   a pessoa responde            (vira conversa de gente, nao de robo)
--   as mensagens acabam          (vira "esgotado")
--   voce para na mao pelo painel
--
-- Quem decide quem recebe o que e quando e o banco. O n8n so
-- pergunta "quem esta na vez?", manda, e conta como foi. Os
-- textos, os tempos e o liga/desliga ficam em tabela, e o painel
-- edita: mudou la, a proxima mensagem ja sai com o texto novo.
--
-- Chargeback fica de fora: quem contestou no banco nao quer ser
-- lembrado de comprar.
--
-- Rode no SQL Editor do Supabase, depois de webhook.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. O QUE LIGA A SEQUENCIA, E COMO CADA MOTIVO E CHAMADO
--
-- A frase entra no lugar de {motivo} no texto. Assim a mesma
-- mensagem serve pra quem abandonou e pra quem deixou o Pix
-- vencer, sem voce escrever tres versoes.
-- ------------------------------------------------------------
create table if not exists public.recuperacao_motivo (
  evento  text primary key,
  nome    text not null,
  frase   text not null,
  ativo   boolean not null default true
);

insert into public.recuperacao_motivo (evento, nome, frase) values
  ('PURCHASE_OUT_OF_SHOPPING_CART', 'Abandonou o checkout', 'você começou a compra e parou no meio'),
  ('PURCHASE_EXPIRED',              'Pix ou boleto venceu', 'o seu Pix ou boleto venceu antes do pagamento'),
  ('PURCHASE_CANCELED',             'Pagamento não passou', 'o pagamento não foi aprovado')
on conflict (evento) do nothing;


-- ------------------------------------------------------------
-- 2. AS MENSAGENS
--
-- O atraso conta a partir do abandono, nao da mensagem anterior.
-- {nome} {produto} {link} {motivo} sao trocados na hora do envio.
-- ------------------------------------------------------------
create table if not exists public.recuperacao_etapa (
  id          bigserial primary key,
  ordem       int  not null unique,
  atraso_min  int  not null check (atraso_min >= 5),
  texto       text not null,
  ativa       boolean not null default true
);

insert into public.recuperacao_etapa (ordem, atraso_min, texto)
select * from (values
  (1, 60,
   'Oi, {nome}! Aqui é do NeuroJitsu. Vi que {motivo}. Ficou alguma dúvida? Se quiser terminar, o link já vem com os seus dados:' || chr(10) || chr(10) || '{link}'),
  (2, 1440,
   '{nome}, passando só mais uma vez. O {produto} transforma o seu diário de rola em diagnóstico do seu jogo: onde você trava, o que treinar na semana. Seu acesso tá aqui:' || chr(10) || chr(10) || '{link}' || chr(10) || chr(10) || 'Se não fizer sentido agora, tudo bem, não te mando mais nada.')
) v(ordem, atraso_min, texto)
where not exists (select 1 from public.recuperacao_etapa);


-- ------------------------------------------------------------
-- 3. O LIGA E DESLIGA, E O HORARIO
--
-- Mensagem de venda as 3 da manha queima o numero e a marca.
-- Fora da janela a fila espera, e sai no comeco da proxima.
-- O ultimo_ciclo e o n8n batendo o ponto: se parar de mudar, o
-- painel avisa que o fluxo caiu.
-- ------------------------------------------------------------
create table if not exists public.recuperacao_ajuste (
  id            int primary key default 1 check (id = 1),
  ligado        boolean not null default false,
  hora_inicio   int not null default 8  check (hora_inicio between 0 and 23),
  hora_fim      int not null default 21 check (hora_fim between 1 and 24),
  ultimo_ciclo  timestamptz
);

insert into public.recuperacao_ajuste (id) values (1) on conflict (id) do nothing;


-- ------------------------------------------------------------
-- 4. CADA CARRINHO
--
-- status:
--   ativo            na sequencia
--   esgotado         recebeu tudo e nao comprou (ainda pode virar recuperado por 7 dias)
--   recuperado       comprou depois de receber pelo menos uma mensagem
--   comprou_sozinho  comprou antes da primeira mensagem sair
--   respondeu        respondeu no WhatsApp, a conversa e com gente agora
--   sem_telefone     nao veio numero que de pra usar
--   parado           voce parou pelo painel
-- ------------------------------------------------------------
create table if not exists public.recuperacao (
  id                bigserial primary key,
  email             text not null,
  nome              text,
  telefone          text,
  produto           text,
  produto_nome      text,
  evento            text not null references public.recuperacao_motivo(evento),
  transacao         text,
  link              text,
  valor             numeric,
  status            text not null default 'ativo',
  etapa             int  not null default 0,   -- ordem da ultima mensagem que saiu
  proximo_em        timestamptz,
  criado_em         timestamptz not null default now(),
  fechado_em        timestamptz,
  valor_recuperado  numeric,
  teste             boolean not null default false
);

-- uma sequencia viva por pessoa e produto: a Hotmart manda o
-- abandono mais de uma vez, e ninguem pode receber em dobro
create unique index if not exists recuperacao_uma_viva
  on public.recuperacao (lower(email), coalesce(produto, '')) where status = 'ativo';

create index if not exists recuperacao_fila
  on public.recuperacao (proximo_em) where status = 'ativo';

create index if not exists recuperacao_email on public.recuperacao (lower(email));

create table if not exists public.recuperacao_envio (
  id               bigserial primary key,
  recuperacao_id   bigint not null references public.recuperacao(id) on delete cascade,
  etapa            int  not null,
  telefone         text not null,
  texto            text not null,
  status           text not null default 'enviando',  -- enviando, enviado, falhou
  erro             text,
  criado_em        timestamptz not null default now()
);

create index if not exists recuperacao_envio_rec on public.recuperacao_envio (recuperacao_id);


-- ------------------------------------------------------------
-- 5. QUEM LE E QUEM MEXE
--
-- So o administrador, pelo painel. O n8n usa a service_role,
-- que passa por cima disto.
-- ------------------------------------------------------------
alter table public.recuperacao_motivo enable row level security;
alter table public.recuperacao_etapa  enable row level security;
alter table public.recuperacao_ajuste enable row level security;
alter table public.recuperacao        enable row level security;
alter table public.recuperacao_envio  enable row level security;

drop policy if exists rec_motivo_admin on public.recuperacao_motivo;
create policy rec_motivo_admin on public.recuperacao_motivo for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists rec_etapa_admin on public.recuperacao_etapa;
create policy rec_etapa_admin on public.recuperacao_etapa for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists rec_ajuste_admin on public.recuperacao_ajuste;
create policy rec_ajuste_admin on public.recuperacao_ajuste for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists rec_admin on public.recuperacao;
create policy rec_admin on public.recuperacao for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists rec_envio_admin on public.recuperacao_envio;
create policy rec_envio_admin on public.recuperacao_envio for select to authenticated
  using (public.sou_admin());


-- ------------------------------------------------------------
-- 6. O TELEFONE QUE DA PRA USAR
--
-- A Hotmart manda o numero de jeitos diferentes: com ou sem 55,
-- com o DDD num campo e o numero em outro. Aqui vira sempre
-- 55DDDNUMERO, ou null quando nao da pra confiar.
-- ------------------------------------------------------------
create or replace function public.telefone_br(p_numero text, p_ddd text default null)
returns text language plpgsql immutable as $$
declare
  n text := regexp_replace(coalesce(p_numero, ''), '\D', '', 'g');
  d text := regexp_replace(coalesce(p_ddd, ''), '\D', '', 'g');
begin
  if length(n) in (8, 9) and length(d) = 2 then n := d || n; end if;
  if length(n) in (10, 11) then return '55' || n; end if;
  if length(n) in (12, 13) and n like '55%' then return n; end if;
  return null;
end $$;


-- ------------------------------------------------------------
-- 7. QUANDO SAI A PROXIMA
--
-- A partir do abandono, mas nunca menos de 3 horas depois da
-- mensagem anterior. Sem isso, quem abandonou de madrugada
-- receberia as duas de manha, uma atras da outra.
-- ------------------------------------------------------------
create or replace function public.recuperacao_proxima_etapa(p_criado timestamptz, p_depois_de int, p_primeira boolean)
returns table (ordem int, quando timestamptz)
language sql stable set search_path = public as $$
  select e.ordem,
         greatest(p_criado + make_interval(mins => e.atraso_min),
                  case when p_primeira then now() else now() + interval '3 hours' end)
  from public.recuperacao_etapa e
  where e.ativa and e.ordem > p_depois_de
  order by e.ordem
  limit 1;
$$;


-- ------------------------------------------------------------
-- 7b. O LINK DE VOLTA
--
-- O checkout do video avulso, se o produto for um, senao o da
-- assinatura. Com e-mail e nome ja preenchidos. Quem chegou
-- enquanto o link estava vazio ganha o link na hora do envio.
-- ------------------------------------------------------------
create or replace function public.recuperacao_link(p_email text, p_nome text, p_produto text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_link text;
begin
  select coalesce(
    (select checkout_url from public.aula where produto_hotmart = p_produto and checkout_url is not null limit 1),
    (select nullif(url, '') from public.link where chave = 'assinatura_mensal')
  ) into v_link;

  if v_link is null then return null; end if;

  return v_link || case when v_link like '%?%' then '&' else '?' end
    || 'email=' || replace(lower(coalesce(p_email, '')), '+', '%2B')
    || coalesce('&name=' || replace(nullif(p_nome, ''), ' ', '%20'), '')
    || '&sck=recuperacao';
end $$;

revoke all on function public.recuperacao_link(text, text, text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 8. O QUE A HOTMART MANDOU
--
-- webhook_hotmart chama esta funcao em todo evento. Ela abre a
-- sequencia no abandono, e fecha quando a compra entra.
-- ------------------------------------------------------------
create or replace function public.recuperacao_hotmart(p_evento text, p_email text, p_produto text, p_bruto jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  d        jsonb := coalesce(p_bruto -> 'data', '{}'::jsonb);
  b        jsonb := coalesce(d -> 'buyer', '{}'::jsonb);
  v_tel    text;
  v_nome   text;
  v_link   text;
  v_prox   record;
  v_motivo public.recuperacao_motivo%rowtype;
  n        int;
begin
  -- ---------- comprou: fecha o que estiver aberto ----------
  if public.evento_libera(p_evento) then
    update public.recuperacao
    set status = case when etapa > 0 then 'recuperado' else 'comprou_sozinho' end,
        fechado_em = now(),
        proximo_em = null,
        valor_recuperado = nullif(d #>> '{purchase,price,value}', '')::numeric
    where lower(email) = lower(p_email)
      and not teste
      and (status = 'ativo' or (status = 'esgotado' and criado_em > now() - interval '7 days'));
    get diagnostics n = row_count;
    return case when n > 0 then 'fechou ' || n else 'nada aberto' end;
  end if;

  select * into v_motivo from public.recuperacao_motivo where evento = p_evento;
  if v_motivo.evento is null then return 'evento nao recupera'; end if;
  if not v_motivo.ativo then return 'motivo desligado no painel'; end if;

  -- ja comprou este produto: nao tem o que recuperar
  if exists (select 1 from public.assinatura
             where lower(email_compra) = lower(p_email) and status = 'ativa'
               and (p_produto is null or produto = p_produto)) then
    return 'ja e cliente';
  end if;

  -- uma sequencia por pessoa e produto a cada 7 dias, pra ninguem
  -- virar alvo de spam por abandonar tres vezes
  if exists (select 1 from public.recuperacao
             where lower(email) = lower(p_email) and coalesce(produto, '') = coalesce(p_produto, '')
               and not teste and criado_em > now() - interval '7 days') then
    return 'ja tem sequencia recente';
  end if;

  v_tel := coalesce(
    public.telefone_br(b ->> 'phone'),
    public.telefone_br(b ->> 'checkout_phone', b ->> 'checkout_phone_code')
  );
  v_nome := coalesce(nullif(b ->> 'first_name', ''), split_part(b ->> 'name', ' ', 1));

  v_link := public.recuperacao_link(p_email, b ->> 'name', p_produto);

  select * into v_prox from public.recuperacao_proxima_etapa(now(), 0, true);

  insert into public.recuperacao (
    email, nome, telefone, produto, produto_nome, evento, transacao, link, valor,
    status, proximo_em
  ) values (
    lower(p_email), v_nome, v_tel, p_produto, d #>> '{product,name}', p_evento,
    d #>> '{purchase,transaction}', v_link, nullif(d #>> '{purchase,price,value}', '')::numeric,
    case when v_tel is null then 'sem_telefone'
         when v_prox.ordem is null then 'esgotado'
         else 'ativo' end,
    case when v_tel is null then null else v_prox.quando end
  )
  on conflict do nothing;

  return case when v_tel is null then 'sem telefone' else 'sequencia aberta' end;
end $$;

revoke all on function public.recuperacao_hotmart(text, text, text, jsonb) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 9. QUEM ESTA NA VEZ
--
-- O n8n chama a cada 5 minutos. A funcao ja marca a mensagem
-- como saindo antes de devolver, entao duas rodadas do n8n ao
-- mesmo tempo nunca mandam a mesma coisa duas vezes.
-- ------------------------------------------------------------
create or replace function public.recuperacao_proximas(p_limite int default 20)
returns table (envio_id bigint, telefone text, texto text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  a      public.recuperacao_ajuste%rowtype;
  r      record;
  e      public.recuperacao_etapa%rowtype;
  v_prox record;
  v_txt  text;
  v_hora int := extract(hour from now() at time zone 'America/Sao_Paulo');
  v_id   bigint;
  v_link text;
begin
  update public.recuperacao_ajuste set ultimo_ciclo = now() where id = 1
  returning * into a;

  if not a.ligado then return; end if;
  if v_hora < a.hora_inicio or v_hora >= a.hora_fim then return; end if;

  for r in
    select rc.*, m.frase
    from public.recuperacao rc
    join public.recuperacao_motivo m on m.evento = rc.evento
    where rc.status = 'ativo' and rc.proximo_em <= now() and rc.telefone is not null
    order by rc.proximo_em
    limit p_limite
    for update of rc skip locked
  loop
    select * into e from public.recuperacao_etapa
    where ativa and ordem > r.etapa order by ordem limit 1;

    if e.id is null then
      update public.recuperacao set status = 'esgotado', proximo_em = null where id = r.id;
      continue;
    end if;

    /* sem link de checkout a mensagem sairia quebrada: espera na
       fila ate o link ser preenchido na aba Links do painel. Quem
       chegou antes disso ganha o link na hora do envio. */
    v_link := coalesce(r.link, public.recuperacao_link(r.email, r.nome, r.produto));
    if v_link is null and e.texto like '%{link}%' then
      continue;
    end if;

    v_txt := e.texto;
    v_txt := replace(v_txt, '{nome}',    coalesce(initcap(r.nome), ''));
    v_txt := replace(v_txt, '{produto}', coalesce(r.produto_nome, 'NeuroJitsu'));
    v_txt := replace(v_txt, '{link}',    coalesce(v_link, ''));
    v_txt := replace(v_txt, '{motivo}',  r.frase);
    -- sem nome, "Oi, !" vira "Oi!"
    v_txt := regexp_replace(v_txt, '\s*,\s*([!.?])', '\1', 'g');
    v_txt := regexp_replace(v_txt, '^\s*,\s*', '');

    insert into public.recuperacao_envio (recuperacao_id, etapa, telefone, texto)
    values (r.id, e.ordem, r.telefone, v_txt)
    returning id into v_id;

    select * into v_prox from public.recuperacao_proxima_etapa(r.criado_em, e.ordem, false);

    update public.recuperacao
    set etapa = e.ordem,
        proximo_em = v_prox.quando,
        status = case when v_prox.ordem is null then 'esgotado' else 'ativo' end,
        fechado_em = case when v_prox.ordem is null then now() else null end
    where id = r.id;

    envio_id := v_id; telefone := r.telefone; texto := v_txt;
    return next;
  end loop;
end $$;

revoke all on function public.recuperacao_proximas(int) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 10. COMO FOI O ENVIO
--
-- Falhou nao tenta de novo: melhor perder uma mensagem do que
-- mandar a mesma duas vezes. O erro fica no painel.
-- ------------------------------------------------------------
create or replace function public.recuperacao_resultado(p_envio bigint, p_ok boolean, p_erro text default null)
returns void language sql security definer set search_path = public as $$
  update public.recuperacao_envio
  set status = case when p_ok then 'enviado' else 'falhou' end,
      erro = case when p_ok then null else left(p_erro, 500) end
  where id = p_envio;
$$;

revoke all on function public.recuperacao_resultado(bigint, boolean, text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 11. A PESSOA RESPONDEU
--
-- Quem responde para de receber mensagem automatica. Se a
-- resposta foi "comprei" ou "para", robo nenhum deve insistir.
--
-- O WhatsApp as vezes guarda numero brasileiro sem o 9 da
-- frente, entao a comparacao usa 55 + DDD + os ultimos 8.
-- ------------------------------------------------------------
create or replace function public.recuperacao_resposta(p_jid text)
returns text language plpgsql security definer set search_path = public as $$
declare
  n   text := regexp_replace(split_part(split_part(coalesce(p_jid, ''), '@', 1), ':', 1), '\D', '', 'g');
  c   int;
begin
  if length(n) < 12 then return 'numero ilegivel'; end if;

  update public.recuperacao
  set status = 'respondeu', fechado_em = now(), proximo_em = null
  where status = 'ativo' and etapa > 0
    and left(telefone, 4) = left(n, 4)
    and right(telefone, 8) = right(n, 8);
  get diagnostics c = row_count;
  return case when c > 0 then 'parou ' || c else 'nada aberto' end;
end $$;

revoke all on function public.recuperacao_resposta(text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 12. O TESTE
--
-- Coloca o seu numero na fila como se fosse um abandono. Sai no
-- proximo ciclo do n8n, com o texto de agora. Nao entra nos
-- numeros do painel.
-- ------------------------------------------------------------
create or replace function public.recuperacao_teste(p_telefone text, p_nome text default 'Teste')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_tel text := public.telefone_br(p_telefone);
begin
  if not public.sou_admin() then raise exception 'so o administrador'; end if;
  if v_tel is null then return 'numero invalido, use DDD + numero'; end if;

  update public.recuperacao set status = 'parado', proximo_em = null
  where teste and status = 'ativo';

  insert into public.recuperacao (email, nome, telefone, produto_nome, evento, link, status, proximo_em, teste)
  values ('teste@teste', p_nome, v_tel, 'NeuroJitsu', 'PURCHASE_OUT_OF_SHOPPING_CART',
          null, 'ativo', now(), true);
  return 'na fila';
end $$;

grant execute on function public.recuperacao_teste(text, text) to authenticated;


-- ------------------------------------------------------------
-- 13. OS NUMEROS DO PAINEL
-- ------------------------------------------------------------
create or replace function public.recuperacao_numeros(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  desde timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
                       - make_interval(days => p_dias - 1);
  res   jsonb;
begin
  if not public.sou_admin() then raise exception 'so o administrador'; end if;

  with r as (
    select * from public.recuperacao where criado_em >= desde and not teste
  ), env as (
    select ev.* from public.recuperacao_envio ev join r on r.id = ev.recuperacao_id
  )
  select jsonb_build_object(
    'carrinhos',      (select count(*) from r),
    'com_telefone',   (select count(*) from r where telefone is not null),
    'contatados',     (select count(*) from r where etapa > 0),
    'recuperados',    (select count(*) from r where status = 'recuperado'),
    'sozinhos',       (select count(*) from r where status = 'comprou_sozinho'),
    'responderam',    (select count(*) from r where status = 'respondeu'),
    'na_fila',        (select count(*) from public.recuperacao where status = 'ativo' and not teste),
    'receita',        (select coalesce(sum(valor_recuperado), 0) from r where status = 'recuperado'),
    'enviadas',       (select count(*) from env where status = 'enviado'),
    'falharam',       (select count(*) from env where status = 'falhou'),
    'por_etapa', coalesce((
      select jsonb_agg(jsonb_build_object('etapa', etapa, 'enviadas', q) order by etapa)
      from (select etapa, count(*) q from env where status = 'enviado' group by etapa) x), '[]'::jsonb),
    'por_motivo', coalesce((
      select jsonb_agg(jsonb_build_object('nome', m.nome, 'total', x.q, 'recuperados', x.rec) order by x.q desc)
      from (select evento, count(*) q, count(*) filter (where status = 'recuperado') rec from r group by evento) x
      join public.recuperacao_motivo m on m.evento = x.evento), '[]'::jsonb),
    'por_dia', (
      select jsonb_agg(jsonb_build_object(
        'dia', to_char(dia, 'YYYY-MM-DD'),
        'carrinhos', (select count(*) from r where (r.criado_em at time zone 'America/Sao_Paulo')::date = dia),
        'recuperados', (select count(*) from r where r.status = 'recuperado'
                          and (r.fechado_em at time zone 'America/Sao_Paulo')::date = dia)
      ) order by dia)
      from generate_series((desde at time zone 'America/Sao_Paulo')::date,
                           (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') g(dia)
    )
  ) into res;

  return res;
end $$;

grant execute on function public.recuperacao_numeros(int) to authenticated;


-- ------------------------------------------------------------
-- 14. CONFERIR
--
-- simular um abandono (troque o telefone pelo seu):
-- select public.recuperacao_hotmart('PURCHASE_OUT_OF_SHOPPING_CART', 'voce@email.com', '123',
--   '{"data":{"buyer":{"name":"Voce Teste","phone":"75999999999"},"product":{"name":"NeuroJitsu"}}}');
--
-- ver a fila:
-- select id, email, telefone, status, etapa, proximo_em from public.recuperacao order by id desc;
--
-- simular a compra que fecha a sequencia:
-- select public.recuperacao_hotmart('PURCHASE_APPROVED', 'voce@email.com', '123',
--   '{"data":{"purchase":{"price":{"value":49.9}}}}');
-- ------------------------------------------------------------
