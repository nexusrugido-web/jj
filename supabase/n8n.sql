-- ============================================================
-- TATAME OS, A PORTA DO N8N
--
-- O n8n chamava o banco com a service_role, lida de variavel de
-- ambiente. No n8n auto-hospedado isso esbarra no bloqueio de
-- $env, e ainda obriga a copiar a chave mais perigosa do projeto
-- pra dentro de outra ferramenta.
--
-- Agora o n8n usa a chave publica do app (a mesma que ja esta no
-- site) e cada funcao abaixo confere um segredo guardado aqui:
--
--   hottok       a Hotmart manda em toda chamada
--   chave        so o fluxo de recuperacao conhece
--   evogo_token  o Evolution Go manda em toda resposta
--
-- A tabela nao tem regra de leitura, entao ninguem de fora le.
--
-- Rode no SQL Editor do Supabase, depois de recuperacao.sql
-- ============================================================

create table if not exists public.n8n_segredo (
  id           int primary key default 1 check (id = 1),
  hottok       text,
  chave        text,
  evogo_url    text,
  evogo_token  text
);

alter table public.n8n_segredo enable row level security;
revoke all on public.n8n_segredo from anon, authenticated;

insert into public.n8n_segredo (id) values (1) on conflict (id) do nothing;


-- ------------------------------------------------------------
-- 1. A HOTMART
--
-- Recebe o corpo inteiro, confere o hottok, anota no livro de
-- eventos (vendas.sql) e so depois decide.
--
--   evento repetido           a Hotmart reenviou: nao faz nada
--   produto nao classificado  fica guardado e voce e avisado
--   produto de fora           fica so anotado
--   produto do NeuroJitsu     segue pro webhook_hotmart
-- ------------------------------------------------------------
create or replace function public.n8n_hotmart(p_hottok text, p_corpo jsonb)
returns table (feito text, detalhe text)
language plpgsql security definer set search_path = public as $$
declare
  s        public.n8n_segredo%rowtype;
  d        jsonb := coalesce(p_corpo -> 'data', '{}'::jsonb);
  pur      jsonb := coalesce(p_corpo #> '{data,purchase}', '{}'::jsonb);
  b        jsonb := coalesce(p_corpo #> '{data,buyer}', p_corpo #> '{data,subscriber}', p_corpo #> '{data,purchase,shopper}', '{}'::jsonb);
  v_id     text := coalesce(nullif(p_corpo ->> 'id', ''), md5(p_corpo::text));
  v_ev     text := p_corpo ->> 'event';
  v_email  text;
  v_prod   text;
  v_pnome  text;
  v_tipo   text;
  v_quando timestamptz;
  v_valor  numeric;
  v_n      int;
  res      record;
begin
  select * into s from public.n8n_segredo where id = 1;
  if s.hottok is null or coalesce(nullif(p_hottok, ''), p_corpo ->> 'hottok') is distinct from s.hottok then
    raise exception 'hottok invalido' using errcode = '28000';
  end if;

  -- o mesmo acontecimento com outro nome
  if v_ev = 'PURCHASE_WAITING_PAYMENT' then v_ev := 'PURCHASE_BILLET_PRINTED'; end if;

  v_email  := lower(b ->> 'email');
  v_prod   := nullif(coalesce(d #>> '{product,id}', d #>> '{subscription,product,id}'), '');
  v_pnome  := coalesce(d #>> '{product,name}', d #>> '{subscription,product,name}');
  v_quando := case when coalesce(p_corpo ->> 'creation_date', p_corpo ->> 'creationDate') ~ '^\d+$'
                   then to_timestamp(coalesce(p_corpo ->> 'creation_date', p_corpo ->> 'creationDate')::numeric / 1000)
                   else now() end;
  v_valor  := coalesce(nullif(pur #>> '{price,value}', ''), nullif(d ->> 'actual_recurrence_value', ''))::numeric;

  insert into public.hotmart_evento (
    id, evento, criado_em, transacao, email, nome, telefone, produto, produto_nome, oferta,
    valor, moeda, pagamento, parcelas, status, src, sck, xcod, cupom, assinante, recorrencia, bruto
  ) values (
    v_id, coalesce(v_ev, '?'), v_quando,
    coalesce(pur ->> 'transaction', d ->> 'transaction'),
    v_email, b ->> 'name',
    coalesce(public.telefone_br(b ->> 'phone'), public.telefone_br(b ->> 'checkout_phone', b ->> 'checkout_phone_code')),
    v_prod, v_pnome, pur #>> '{offer,code}',
    v_valor, coalesce(pur #>> '{price,currency_value}', pur #>> '{price,currency_code}'),
    pur #>> '{payment,type}',
    case when pur #>> '{payment,installments_number}' ~ '^\d+$' then (pur #>> '{payment,installments_number}')::int end,
    pur ->> 'status',
    nullif(pur #>> '{origin,src}', ''), nullif(pur #>> '{origin,sck}', ''), nullif(pur #>> '{origin,xcod}', ''),
    nullif(pur #>> '{offer,coupon_code}', ''),
    coalesce(d #>> '{subscription,subscriber,code}', d #>> '{subscriber,code}'),
    case when coalesce(pur ->> 'recurrence_number', d #>> '{subscription,recurrence_number}') ~ '^\d+$'
         then coalesce(pur ->> 'recurrence_number', d #>> '{subscription,recurrence_number}')::int end,
    p_corpo
  )
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return query select 'duplicado'::text, ('a Hotmart reenviou o evento ' || v_id)::text; return;
  end if;

  -- produto: anota e descobre se e do app
  if v_prod is not null then
    insert into public.produto_hotmart (id, nome, eventos) values (v_prod, v_pnome, 1)
    on conflict (id) do update set
      nome = coalesce(excluded.nome, produto_hotmart.nome),
      eventos = produto_hotmart.eventos + 1,
      ultimo_em = now();

    -- produto que ja vende um video avulso e do app, sem perguntar
    update public.produto_hotmart set tipo = 'neurojitsu'
    where id = v_prod and tipo is null
      and exists (select 1 from public.aula where produto_hotmart = v_prod);

    select tipo into v_tipo from public.produto_hotmart where id = v_prod;
  end if;

  if v_prod is null or v_tipo is null then
    update public.hotmart_evento set processado = 'produto_nao_classificado' where id = v_id;
    if v_prod is not null then
      perform public.avisar_uma_vez('alarmes', 'produto:' || v_prod,
        '🔎 NeuroJitsu: chegou evento de um produto que o painel ainda não conhece:' || chr(10)
        || coalesce(v_pnome, '?') || ' (id ' || v_prod || ')' || chr(10) || chr(10)
        || 'Ninguém ganhou acesso. Abra Painel → Vendas → Produtos e diga se ele é do NeuroJitsu. '
        || 'O que estiver esperando é processado na hora.',
        interval '1 day');
    end if;
    return query select 'esperando'::text, 'produto ainda nao classificado no painel'::text; return;
  end if;

  if v_tipo = 'fora' then
    update public.hotmart_evento set processado = 'fora' where id = v_id;
    return query select 'fora'::text, 'produto de fora do app'::text; return;
  end if;

  select * into res from public.webhook_hotmart(
    v_ev, v_email, v_prod,
    coalesce(pur ->> 'transaction', d ->> 'transaction'),
    coalesce(d #>> '{subscription,subscriber,code}', d #>> '{subscriber,code}'),
    coalesce(d #>> '{subscription,plan,name}', v_pnome),
    case when pur ->> 'date_next_charge' ~ '^\d+$' then to_timestamp((pur ->> 'date_next_charge')::numeric / 1000) end,
    p_corpo
  );

  update public.hotmart_evento set processado = coalesce(res.feito || ': ' || res.detalhe, 'processado') where id = v_id;

  if v_ev = 'PURCHASE_APPROVED' then
    perform public.avisar('vendas',
      '💰 Venda no NeuroJitsu' || chr(10) || chr(10)
      || coalesce(v_pnome, 'produto')
      || coalesce(' · R$ ' || replace(to_char(v_valor, 'FM999999990.00'), '.', ','), '') || chr(10)
      || coalesce(b ->> 'name', v_email, '')
      || coalesce(chr(10) || 'Origem: ' || nullif(concat_ws(' / ', nullif(pur #>> '{origin,src}', ''), nullif(pur #>> '{origin,sck}', '')), ''), ''));
  end if;

  return query select res.feito, res.detalhe;
end $$;


-- ------------------------------------------------------------
-- 2. A RECUPERACAO
-- ------------------------------------------------------------
create or replace function public.n8n_confere(p_chave text)
returns public.n8n_segredo language plpgsql stable security definer set search_path = public as $$
declare
  s public.n8n_segredo%rowtype;
begin
  select * into s from public.n8n_segredo where id = 1;
  if s.chave is null or p_chave is distinct from s.chave then
    raise exception 'chave invalida' using errcode = '28000';
  end if;
  return s;
end $$;

revoke all on function public.n8n_confere(text) from public, anon, authenticated;

-- quem esta na vez, ja com o endereco do WhatsApp. Primeiro os
-- avisos pra voce e as respostas automaticas, depois a recuperacao.
create or replace function public.n8n_fila(p_chave text)
returns table (envio_id bigint, telefone text, texto text, evogo_url text, evogo_token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  s public.n8n_segredo;
begin
  s := public.n8n_confere(p_chave);
  -- sem o endereco do WhatsApp nao tira ninguem da fila
  if s.evogo_url is null or s.evogo_token is null then
    update public.recuperacao_ajuste set ultimo_ciclo = now() where id = 1;
    return;
  end if;

  return query
    with pega as (
      update public.recuperacao_envio ev set status = 'enviando'
      where ev.id in (select x.id from public.recuperacao_envio x
                      where x.status = 'fila' order by x.id limit 20
                      for update skip locked)
      returning ev.id, ev.telefone, ev.texto
    )
    select pega.id, pega.telefone, pega.texto, rtrim(s.evogo_url, '/'), s.evogo_token
    from pega order by pega.id;

  return query
    select f.envio_id, f.telefone, f.texto, rtrim(s.evogo_url, '/'), s.evogo_token
    from public.recuperacao_proximas(20) f;
end $$;

create or replace function public.n8n_enviado(p_chave text, p_envio bigint, p_ok boolean, p_erro text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.n8n_confere(p_chave);
  perform public.recuperacao_resultado(p_envio, p_ok, p_erro);
end $$;

-- pra ligar as respostas do WhatsApp no n8n, uma vez so
create or replace function public.n8n_whatsapp(p_chave text)
returns table (evogo_url text, evogo_token text)
language plpgsql security definer set search_path = public as $$
declare
  s public.n8n_segredo;
begin
  s := public.n8n_confere(p_chave);
  return query select rtrim(s.evogo_url, '/'), s.evogo_token;
end $$;

-- o Evolution Go avisa que alguem respondeu
create or replace function public.n8n_resposta(p_token text, p_jid text)
returns text language plpgsql security definer set search_path = public as $$
declare
  s public.n8n_segredo%rowtype;
begin
  select * into s from public.n8n_segredo where id = 1;
  if s.evogo_token is null or p_token is distinct from s.evogo_token then
    raise exception 'token invalido' using errcode = '28000';
  end if;
  return public.recuperacao_resposta(p_jid);
end $$;

-- o Evolution Go manda o evento inteiro, e o banco decide. Assim
-- o fluxo do n8n nunca mais precisa mudar pra ler campo novo.
create or replace function public.n8n_whatsapp_evento(p_corpo jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  s    public.n8n_segredo%rowtype;
  i    jsonb := coalesce(p_corpo #> '{data,Info}', '{}'::jsonb);
  m    jsonb := coalesce(p_corpo #> '{data,Message}', '{}'::jsonb);
  jid  text;
begin
  select * into s from public.n8n_segredo where id = 1;
  if s.evogo_token is null or (p_corpo ->> 'instanceToken') is distinct from s.evogo_token then
    raise exception 'token invalido' using errcode = '28000';
  end if;

  if (p_corpo ->> 'event') is distinct from 'Message' then return 'nao e mensagem'; end if;
  if coalesce((i ->> 'IsFromMe')::boolean, false) or coalesce((i ->> 'IsGroup')::boolean, false) then
    return 'mensagem minha ou de grupo';
  end if;

  select j into jid from unnest(array[i ->> 'Chat', i ->> 'SenderAlt', i ->> 'Sender']) j
  where j like '%@s.whatsapp.net' limit 1;

  return public.recuperacao_chegou(
    jid,
    coalesce(m ->> 'conversation', m #>> '{extendedTextMessage,text}', m #>> '{imageMessage,caption}',
             m #>> '{videoMessage,caption}', m #>> '{buttonsResponseMessage,selectedDisplayText}',
             m #>> '{listResponseMessage,title}'),
    i ->> 'PushName'
  );
end $$;

grant execute on function public.n8n_hotmart(text, jsonb) to anon;
grant execute on function public.n8n_fila(text) to anon;
grant execute on function public.n8n_enviado(text, bigint, boolean, text) to anon;
grant execute on function public.n8n_whatsapp(text) to anon;
grant execute on function public.n8n_resposta(text, text) to anon;
grant execute on function public.n8n_whatsapp_evento(jsonb) to anon;


-- ------------------------------------------------------------
-- 3. OS SEGREDOS
--
-- Preencha e rode uma vez (o arquivo pronto pra colar ja vem
-- com isto preenchido):
--
-- update public.n8n_segredo set
--   hottok      = 'o hottok da Hotmart',
--   chave       = 'a mesma chave que esta no recuperacao.json',
--   evogo_url   = 'https://endereco-do-evolution-go',
--   evogo_token = 'o token da instancia'
-- where id = 1;
-- ------------------------------------------------------------
