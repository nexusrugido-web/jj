-- O BOTAO TESTAR DA GETFY NAO VIRA VENDA. Aplicar depois do 42. Pode reaplicar.
-- O teste da Getfy manda um pedido_pago de exemplo com payload.test = true:
-- a porta responde "teste" e nao processa nada.
begin;

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

commit;
