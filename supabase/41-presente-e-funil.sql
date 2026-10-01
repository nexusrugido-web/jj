-- PREMIUM DE PRESENTE E FUNIL DA ASSINATURA. Aplicar depois do 40.
-- Pode reaplicar.
--
-- 1. Presente: 7 dias de Premium, uma vez por conta, pra quem nunca
--    assinou. O app pede no primeiro treino registrado (ganhar_presente);
--    meu_acesso passa a responder "presente" enquanto ele vale e
--    "presente_acabou" depois.
-- 2. Funil: o app marca cada passo (oferta vista, clique no mensal ou no
--    anual, presente, Premium liberado); funil_premium() soma pro admin,
--    junto com as compras e os assinantes ativos que o banco ja sabe.
begin;

create table if not exists public.presente_premium (
  user_id uuid primary key references auth.users(id) on delete cascade,
  inicio  timestamptz not null default now(),
  fim     timestamptz not null
);
alter table public.presente_premium enable row level security;
revoke all on public.presente_premium from anon, authenticated;

create table if not exists public.funil_evento (
  user_id   uuid not null references auth.users(id) on delete cascade,
  dia       date not null,
  passo     text not null,
  detalhe   text not null default '',
  criado_em timestamptz not null default now(),
  primary key (user_id, dia, passo, detalhe)
);
alter table public.funil_evento enable row level security;
revoke all on public.funil_evento from anon, authenticated;

/* o app marca um passo; repetir no mesmo dia nao conta de novo */
create or replace function public.marcar_funil(p_passo text, p_detalhe text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_passo not in ('primeiro_treino', 'terceiro_treino', 'oferta_vista', 'assinar_mensal',
                     'assinar_anual', 'presente', 'liberou') then return; end if;
  insert into public.funil_evento (user_id, dia, passo, detalhe)
  values (auth.uid(), public.hoje_br(), p_passo, left(coalesce(p_detalhe, ''), 40))
  on conflict do nothing;
end $$;
revoke all on function public.marcar_funil(text, text) from public, anon;
grant execute on function public.marcar_funil(text, text) to authenticated;

/* 7 dias de Premium, uma vez por conta, so pra quem nunca assinou */
create or replace function public.ganhar_presente()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_fim timestamptz;
begin
  if v_user is null then return null; end if;
  select fim into v_fim from public.presente_premium where user_id = v_user;
  if v_fim is not null then return jsonb_build_object('ganhou', false, 'fim', v_fim); end if;
  if exists (select 1 from public.assinatura where user_id = v_user) then return null; end if;
  insert into public.presente_premium (user_id, fim) values (v_user, now() + interval '7 days')
  returning fim into v_fim;
  insert into public.funil_evento (user_id, dia, passo) values (v_user, public.hoje_br(), 'presente')
  on conflict do nothing;
  return jsonb_build_object('ganhou', true, 'fim', v_fim);
end $$;
revoke all on function public.ganhar_presente() from public, anon;
grant execute on function public.ganhar_presente() to authenticated;

/* o meu_acesso do assinatura.sql, com o presente no lugar do "sem
   assinatura" e a consulta corrigida (a de antes falhava pra todo mundo
   logado, e o app ficava sempre no gratis) */
create or replace function public.meu_acesso()
returns table (
  premium      boolean,
  status       text,
  plano        text,
  vence_em     timestamptz,
  carencia_ate timestamptz,
  motivo       text
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_a public.assinatura%rowtype;
  v_p public.presente_premium%rowtype;
begin
  if v_user is null then
    return query select false, 'sem_conta'::text, null::text, null::timestamptz, null::timestamptz,
      'Entre com a sua conta pra liberar o premium.'::text;
    return;
  end if;

  /* as colunas vao com o nome da tabela: status e vence_em tambem sao
     nomes da saida da funcao, e sem o prefixo o Postgres recusa a consulta
     ("column reference is ambiguous") pra toda pessoa logada */
  select a.* into v_a from public.assinatura a
  where a.user_id = v_user
  order by (a.status = 'ativa') desc, a.vence_em desc nulls last
  limit 1;

  if v_a.id is null then
    select p.* into v_p from public.presente_premium p where p.user_id = v_user;
    if v_p.user_id is not null and v_p.fim > now() then
      return query select true, 'presente'::text, 'Presente de 7 dias'::text, v_p.fim, null::timestamptz, 'ok'::text;
      return;
    end if;
    if v_p.user_id is not null then
      return query select false, 'presente_acabou'::text, null::text, v_p.fim, null::timestamptz,
        'Seus 7 dias de Premium acabaram. Seus dados continuam aqui, inteiros.'::text;
      return;
    end if;
    return query select false, 'sem_assinatura'::text, null::text, null::timestamptz, null::timestamptz,
      'Voce esta no plano gratuito.'::text;
    return;
  end if;

  -- dentro do periodo pago
  if v_a.status = 'ativa' and (v_a.vence_em is null or v_a.vence_em > now()) then
    return query select true, v_a.status, v_a.plano, v_a.vence_em, v_a.carencia_ate, 'ok'::text;
    return;
  end if;

  -- atrasou o pagamento mas ainda esta na carencia
  if v_a.carencia_ate is not null and v_a.carencia_ate > now() then
    return query select true, 'carencia'::text, v_a.plano, v_a.vence_em, v_a.carencia_ate,
      'Seu pagamento nao entrou ainda. O acesso continua ate ' ||
      to_char(v_a.carencia_ate, 'DD/MM') || '.';
    return;
  end if;

  return query select false, v_a.status, v_a.plano, v_a.vence_em, v_a.carencia_ate,
    'Sua assinatura venceu. Seus dados continuam aqui, inteiros.'::text;
end $$;
revoke all on function public.meu_acesso() from public;
grant execute on function public.meu_acesso() to authenticated;

/* o funil pro admin: pessoas por passo, ofertas vistas por recurso,
   compras e assinantes ativos */
create or replace function public.funil_premium(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_desde date := public.hoje_br() - greatest(1, least(coalesce(p_dias, 30), 365));
begin
  if not public.sou_admin() then raise exception 'so administrador'; end if;
  return jsonb_build_object(
    'dias', greatest(1, least(coalesce(p_dias, 30), 365)),
    'passos', coalesce((
      select jsonb_object_agg(x.passo, x.pessoas) from (
        select passo, count(distinct user_id) as pessoas
        from public.funil_evento where dia > v_desde group by passo
      ) x), '{}'::jsonb),
    'ofertas', coalesce((
      select jsonb_agg(jsonb_build_object('recurso', x.detalhe, 'pessoas', x.pessoas) order by x.pessoas desc) from (
        select detalhe, count(distinct user_id) as pessoas
        from public.funil_evento where dia > v_desde and passo = 'oferta_vista' group by detalhe
      ) x), '[]'::jsonb),
    'compras', (select count(distinct user_id) from public.assinatura
                where criado_em::date > v_desde and user_id is not null),
    'ativos', (select count(distinct user_id) from public.assinatura
               where status = 'ativa' and (vence_em is null or vence_em > now()) and user_id is not null),
    'presentes_ativos', (select count(*) from public.presente_premium where fim > now())
  );
end $$;
revoke all on function public.funil_premium(int) from public, anon;
grant execute on function public.funil_premium(int) to authenticated;

commit;
