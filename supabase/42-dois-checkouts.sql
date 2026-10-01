-- DOIS CHECKOUTS: HOTMART E GETFY. Aplicar depois do 41. Pode reaplicar.
--
-- O banco continua decidindo tudo. A porta da Hotmart (n8n_hotmart) foi
-- separada em duas: conferir o hottok (so dela) e processar a venda
-- (processar_venda, igual pros dois). A porta nova da Getfy (n8n_getfy)
-- confere o token dela, traduz o evento pro formato da Hotmart e chama o
-- mesmo processamento. Liberar e desfazer o Premium, o livro de vendas, a
-- classificacao do produto no painel e a recuperacao de carrinho no
-- WhatsApp valem pros dois checkouts.
--
-- Os eventos da Getfy (webhook_events.php da Getfy 2.0.4):
--   pedido_pago            -> PURCHASE_APPROVED (vence pelo plano + 2 dias)
--   assinatura_renovada    -> SUBSCRIPTION_REACTIVATION (vence em access_until)
--   assinatura_em_atraso   -> PURCHASE_DELAYED (carencia)
--   assinatura_cancelada   -> SUBSCRIPTION_CANCELLATION
--   reembolso              -> PURCHASE_REFUNDED
--   carrinho_abandonado    -> PURCHASE_OUT_OF_SHOPPING_CART (recuperacao)
--   pix_gerado, boleto_gerado -> PURCHASE_BILLET_PRINTED (recuperacao do Pix)
--   pagamento_recusado, pedido_cancelado -> PURCHASE_EXPIRED (recuperacao)
--   pedido_pendente, assinatura_criada, envio_acesso -> so anota
-- Produto da Getfy entra no painel como "getfy:<id>" e e classificado igual.
begin;

alter table public.n8n_segredo add column if not exists getfy text;

insert into public.link (chave, nome, descricao, grupo, ordem, fixo) values
  ('checkout_getfy', 'Checkout da Getfy',
   'Pra onde a recuperacao de carrinho manda quem abandonou um checkout da Getfy.', 'venda', 4, true),
  ('gerenciar_getfy', 'Minhas compras na Getfy',
   'Onde o assinante da Getfy gerencia ou cancela a assinatura (o app mostra no lugar da Hotmart).', 'venda', 5, true)
on conflict (chave) do nothing;

create or replace function public.processar_venda(p_corpo jsonb)
returns table (feito text, detalhe text)
language plpgsql security definer set search_path = public as $$
declare
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
    return query select 'duplicado'::text, ('o checkout reenviou o evento ' || v_id)::text; return;
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
      '💰 Venda no NeuroJitsu' || case when p_corpo ->> 'origem' = 'getfy' then ' (Getfy)' else '' end || chr(10) || chr(10)
      || coalesce(v_pnome, 'produto')
      || coalesce(' · R$ ' || replace(to_char(v_valor, 'FM999999990.00'), '.', ','), '') || chr(10)
      || coalesce(b ->> 'name', v_email, '')
      || coalesce(chr(10) || 'Origem: ' || nullif(concat_ws(' / ', nullif(pur #>> '{origin,src}', ''), nullif(pur #>> '{origin,sck}', '')), ''), ''));
  end if;

  return query select res.feito, res.detalhe;
end $$;
revoke all on function public.processar_venda(jsonb) from public, anon, authenticated;

/* a porta da Hotmart: confere o hottok e processa */
create or replace function public.n8n_hotmart(p_hottok text, p_corpo jsonb)
returns table (feito text, detalhe text)
language plpgsql security definer set search_path = public as $$
declare
  s public.n8n_segredo%rowtype;
begin
  select * into s from public.n8n_segredo where id = 1;
  if s.hottok is null or coalesce(nullif(p_hottok, ''), p_corpo ->> 'hottok') is distinct from s.hottok then
    raise exception 'hottok invalido' using errcode = '28000';
  end if;
  return query select * from public.processar_venda(p_corpo);
end $$;

/* a porta da Getfy: confere o token, traduz e processa */
create or replace function public.n8n_getfy(p_token text, p_corpo jsonb)
returns table (feito text, detalhe text)
language plpgsql security definer set search_path = public as $$
declare
  s      public.n8n_segredo%rowtype;
  ev     text := p_corpo ->> 'event';
  p      jsonb := coalesce(p_corpo -> 'payload', '{}'::jsonb);
  o      jsonb := coalesce(p_corpo #> '{payload,order}', '{}'::jsonb);
  sub    jsonb := coalesce(p_corpo #> '{payload,subscription}', '{}'::jsonb);
  cli    jsonb := coalesce(p_corpo #> '{payload,customer}', '{}'::jsonb);
  plano  jsonb := coalesce(p_corpo #> '{payload,subscription_plan}', '{}'::jsonb);
  v_ev   text;
  v_ref  text;
  v_vence timestamptz;
  v_int  text;
  r      record;
begin
  select * into s from public.n8n_segredo where id = 1;
  if s.getfy is null or regexp_replace(coalesce(p_token, ''), '^Bearer\s+', '', 'i') is distinct from s.getfy then
    raise exception 'token da getfy invalido' using errcode = '28000';
  end if;

  /* o botao Testar da Getfy manda um evento de verdade (pedido_pago com
     cliente e produto de exemplo) marcado com payload.test: nao processa */
  if ev = 'webhook.test' or p_corpo #>> '{payload,test}' = 'true' then
    return query select 'teste'::text, 'a Getfy chegou no banco'::text; return;
  end if;

  v_ev := case ev
    when 'pedido_pago' then 'PURCHASE_APPROVED'
    when 'assinatura_renovada' then 'SUBSCRIPTION_REACTIVATION'
    when 'assinatura_em_atraso' then 'PURCHASE_DELAYED'
    when 'assinatura_cancelada' then 'SUBSCRIPTION_CANCELLATION'
    when 'reembolso' then 'PURCHASE_REFUNDED'
    when 'carrinho_abandonado' then 'PURCHASE_OUT_OF_SHOPPING_CART'
    when 'pix_gerado' then 'PURCHASE_BILLET_PRINTED'
    when 'boleto_gerado' then 'PURCHASE_BILLET_PRINTED'
    when 'pagamento_recusado' then 'PURCHASE_EXPIRED'
    when 'pedido_cancelado' then 'PURCHASE_EXPIRED'
    else 'GETFY_' || upper(coalesce(ev, 'sem_evento'))
  end;

  /* o que identifica o acontecimento: o pedido, a assinatura (com o
     periodo, porque cada renovacao e uma) ou a sessao do carrinho */
  v_ref := coalesce(o ->> 'id',
    case when sub ->> 'id' is not null then (sub ->> 'id') || ':' || coalesce(sub ->> 'current_period_end', sub ->> 'status', '') end,
    p #>> '{checkout_session,id}', md5(p_corpo::text));

  /* ate quando vale: a assinatura diz; o pedido pago vence pelo plano,
     com 2 dias de folga pra renovacao chegar */
  v_int := lower(coalesce(plano ->> 'interval', ''));
  v_vence := case
    when nullif(sub ->> 'access_until', '') is not null then (sub ->> 'access_until')::date + interval '1 day'
    when nullif(sub ->> 'current_period_end', '') is not null then (sub ->> 'current_period_end')::date + interval '1 day'
    when ev = 'pedido_pago' then now() + case v_int
      when 'annual' then interval '1 year'
      when 'semi_annual' then interval '6 months'
      when 'quarterly' then interval '3 months'
      when 'weekly' then interval '7 days'
      when 'lifetime' then interval '100 years'
      else interval '1 month' end + interval '2 days'
  end;

  select * into r from public.processar_venda(jsonb_build_object(
    'id', 'getfy:' || coalesce(ev, '?') || ':' || v_ref,
    'event', v_ev,
    'origem', 'getfy',
    'creation_date', (extract(epoch from now()) * 1000)::bigint::text,
    'getfy', p_corpo,
    'data', jsonb_build_object(
      'buyer', jsonb_build_object('email', lower(cli ->> 'email'), 'name', cli ->> 'name',
                                  'phone', coalesce(cli ->> 'phone', cli ->> 'phone_number')),
      'product', jsonb_build_object('id', 'getfy:' || coalesce(p #>> '{product,id}', '?'), 'name', p #>> '{product,name}'),
      'purchase', jsonb_strip_nulls(jsonb_build_object(
        'transaction', 'getfy:' || coalesce(o ->> 'id', 'assinatura:' || (sub ->> 'id'), v_ref),
        'status', coalesce(o ->> 'status', sub ->> 'status'),
        'price', jsonb_build_object('value', o ->> 'amount', 'currency_value', coalesce(o ->> 'currency', 'BRL')),
        'payment', jsonb_build_object('type', p #>> '{payment,method}'),
        'origin', jsonb_build_object('src', p #>> '{tracking,utm_source}', 'sck', p #>> '{tracking,utm_campaign}'),
        'offer', jsonb_build_object('code', p #>> '{offer,public_id}', 'coupon_code', o ->> 'coupon_code'),
        'date_next_charge', case when v_vence is not null then ((extract(epoch from v_vence) * 1000)::bigint)::text end
      )),
      'subscription', jsonb_build_object(
        'subscriber', jsonb_build_object('code', case when sub ->> 'id' is not null then 'getfy:' || (sub ->> 'id') end),
        'plan', jsonb_build_object('name', coalesce(plano ->> 'name', p #>> '{offer,name}', p #>> '{product,name}')))
    )
  ));

  /* a assinatura sabe de onde veio: o app manda gerenciar no lugar certo */
  update public.assinatura set origem = 'getfy'
  where origem is distinct from 'getfy'
    and (transacao like 'getfy:%' or codigo_assinante like 'getfy:%');

  return query select r.feito, r.detalhe;
end $$;
revoke all on function public.n8n_getfy(text, jsonb) from public;
grant execute on function public.n8n_getfy(text, jsonb) to anon;

create or replace function public.recuperacao_link(
  p_email text, p_nome text, p_produto text, p_fluxo text, p_origem text, p_cupom text
)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_link text;
begin
  select coalesce(
    case when p_fluxo = 'renovacao'
         then (select nullif(url, '') from public.link where chave = 'atualizar_pagamento') end,
    (select checkout_url from public.aula where produto_hotmart = p_produto and checkout_url is not null limit 1),
    /* carrinho que veio da Getfy volta pro checkout da Getfy */
    case when p_produto like 'getfy:%'
         then (select nullif(url, '') from public.link where chave = 'checkout_getfy') end,
    (select nullif(url, '') from public.link where chave = 'assinatura_mensal')
  ) into v_link;

  if v_link is null then return null; end if;

  -- a pagina de atualizar pagamento nao e checkout: vai limpa
  if p_fluxo = 'renovacao' and v_link = (select url from public.link where chave = 'atualizar_pagamento') then
    return v_link;
  end if;

  return v_link || case when v_link like '%?%' then '&' else '?' end
    || 'email=' || public.uri(lower(coalesce(p_email, '')))
    || coalesce('&name=' || public.uri(nullif(p_nome, '')), '')
    || '&sck=recuperacao'
    || coalesce('&src=' || public.uri(nullif(p_origem, '')), '')
    || coalesce('&offDiscount=' || public.uri(nullif(p_cupom, '')), '');
end $$;
revoke all on function public.recuperacao_link(text, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.minha_assinatura()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_ultima public.assinatura%rowtype;
  v_faturas jsonb := '[]'::jsonb;
begin
  if v_user is null then return null; end if;

  select * into v_ultima from public.assinatura
  where user_id = v_user
  order by criado_em desc, id desc
  limit 1;

  if v_ultima.id is null then
    return jsonb_build_object('renova', false, 'faturas', '[]'::jsonb);
  end if;

  if to_regclass('public.hotmart_evento') is not null then
    select coalesce(jsonb_agg(f order by f->>'data' desc), '[]'::jsonb) into v_faturas
    from (
      select jsonb_build_object(
        'data', e.criado_em,
        'valor', e.valor,
        'moeda', e.moeda,
        'pagamento', e.pagamento,
        'parcelas', e.parcelas,
        'recorrencia', e.recorrencia,
        'produto', e.produto_nome,
        'reembolsada', exists (
          select 1 from public.hotmart_evento r
          where r.transacao = e.transacao
            and r.evento in ('PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK'))
      ) as f
      from public.hotmart_evento e
      where e.evento = 'PURCHASE_APPROVED'
        and (e.produto is null or e.produto not in (
              select id from public.produto_hotmart where tipo = 'fora'))
        and (e.transacao in (select a.transacao from public.assinatura a
                             where a.user_id = v_user and a.transacao is not null)
             or e.assinante in (select a.codigo_assinante from public.assinatura a
                                where a.user_id = v_user and a.codigo_assinante is not null)
             or lower(e.email) in (select lower(a.email_compra) from public.assinatura a
                                   where a.user_id = v_user))
      order by e.criado_em desc
      limit 36
    ) x;
  end if;

  return jsonb_build_object(
    'renova',       v_ultima.status = 'ativa',
    'origem',       v_ultima.origem,
    'cancelada_em', v_ultima.cancelada_em,
    'faturas',      v_faturas
  );
end $$;

commit;

-- O segredo da Getfy: o mesmo token Bearer configurado no webhook da Getfy
-- (arquivo de colar 42b, fora do git).
