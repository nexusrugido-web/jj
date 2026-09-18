-- ============================================================
-- TATAME OS, ASSINATURA
--
-- Regra principal: o direito de acesso mora aqui, no servidor.
-- O app lê, nunca escreve. Mexer no navegador nao libera nada.
--
-- Como funciona: Hotmart manda o webhook, o n8n valida o
-- hottok, e grava aqui. O app consulta e guarda a data de
-- validade pra continuar funcionando offline ate ela vencer.
--
-- Rode no SQL Editor do Supabase, depois de comunidade.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. DIREITO DE ACESSO
-- Uma linha por compra. O vinculo com a conta pode vir depois,
-- porque o email da compra as vezes e diferente do cadastro.
-- ------------------------------------------------------------
create table if not exists public.assinatura (
  id                bigserial primary key,
  user_id           uuid references auth.users(id) on delete set null,
  email_compra      text not null,
  codigo_assinante  text,
  transacao         text,
  produto           text,
  plano             text,
  status            text not null default 'ativa',
  -- ativa | atrasada | cancelada | reembolsada | expirada
  vence_em          timestamptz,
  carencia_ate      timestamptz,
  cancelada_em      timestamptz,
  origem            text not null default 'hotmart',
  bruto             jsonb,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create unique index if not exists assinatura_transacao on public.assinatura (transacao)
  where transacao is not null;
create index if not exists assinatura_email on public.assinatura (lower(email_compra));
create index if not exists assinatura_user on public.assinatura (user_id);

alter table public.assinatura enable row level security;

-- voce enxerga so a sua. Ninguem escreve pelo app.
drop policy if exists assinatura_leitura on public.assinatura;
create policy assinatura_leitura on public.assinatura
  for select to authenticated using (user_id = auth.uid());
-- sem policy de insert/update/delete de proposito.

-- ------------------------------------------------------------
-- 2. CODIGO DE ATIVACAO
-- Pra quando o email da compra nao bate com o do cadastro.
-- ------------------------------------------------------------
create table if not exists public.ativacao (
  codigo        text primary key,
  assinatura_id bigint not null references public.assinatura(id) on delete cascade,
  usado_por     uuid references auth.users(id),
  usado_em      timestamptz,
  expira_em     timestamptz not null default (now() + interval '30 days'),
  criado_em     timestamptz not null default now()
);

alter table public.ativacao enable row level security;
-- ninguem le a tabela pelo app. So a funcao de resgate mexe.

-- ------------------------------------------------------------
-- 3. A CONSULTA QUE O APP FAZ
-- Devolve se tem acesso e ate quando, pra funcionar offline.
-- ------------------------------------------------------------
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
begin
  if v_user is null then
    return query select false, 'sem_conta'::text, null::text, null::timestamptz, null::timestamptz,
      'Entre com a sua conta pra liberar o premium.'::text;
    return;
  end if;

  select * into v_a from public.assinatura
  where user_id = v_user
  order by (status = 'ativa') desc, vence_em desc nulls last
  limit 1;

  if v_a.id is null then
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

-- ------------------------------------------------------------
-- 4. GRAVAR O QUE VEIO DA HOTMART
-- So o n8n chama, com a service_role. Nunca o app.
-- ------------------------------------------------------------
create or replace function public.registrar_compra(
  p_email      text,
  p_evento     text,
  p_transacao  text default null,
  p_assinante  text default null,
  p_produto    text default null,
  p_plano      text default null,
  p_vence_em   timestamptz default null,
  p_bruto      jsonb default null
)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_status text;
  v_user uuid;
  v_carencia timestamptz;
begin
  v_status := case p_evento
    when 'PURCHASE_APPROVED' then 'ativa'
    when 'PURCHASE_COMPLETE' then 'ativa'
    when 'PURCHASE_DELAYED' then 'atrasada'
    when 'PURCHASE_CANCELED' then 'cancelada'
    when 'PURCHASE_REFUNDED' then 'reembolsada'
    when 'PURCHASE_CHARGEBACK' then 'reembolsada'
    when 'PURCHASE_PROTEST' then 'atrasada'
    when 'SUBSCRIPTION_CANCELLATION' then 'cancelada'
    when 'SWITCH_PLAN' then 'ativa'
    else 'ativa'
  end;

  -- 7 dias de folga quando o pagamento atrasa, pra ninguem
  -- ficar sem acesso por causa de boleto ou de cartao recusado
  if v_status = 'atrasada' then
    v_carencia := now() + interval '7 days';
  end if;

  -- tenta achar a conta pelo email da compra
  select id into v_user from auth.users where lower(email) = lower(p_email) limit 1;

  insert into public.assinatura (
    user_id, email_compra, codigo_assinante, transacao, produto, plano,
    status, vence_em, carencia_ate, bruto, atualizado_em
  ) values (
    v_user, lower(p_email), p_assinante, p_transacao, p_produto, p_plano,
    v_status, p_vence_em, v_carencia, p_bruto, now()
  )
  on conflict (transacao) where transacao is not null
  do update set
    status = excluded.status,
    plano = coalesce(excluded.plano, assinatura.plano),
    vence_em = coalesce(excluded.vence_em, assinatura.vence_em),
    carencia_ate = excluded.carencia_ate,
    cancelada_em = case when excluded.status = 'cancelada' then now() else assinatura.cancelada_em end,
    user_id = coalesce(assinatura.user_id, excluded.user_id),
    bruto = excluded.bruto,
    atualizado_em = now()
  returning id into v_id;

  -- sem conta encontrada, gera codigo pra pessoa ativar depois
  if v_user is null then
    insert into public.ativacao (codigo, assinatura_id)
    values (upper(substr(md5(random()::text || v_id::text), 1, 8)), v_id)
    on conflict do nothing;
  end if;

  return v_id;
end $$;

revoke all on function public.registrar_compra(text, text, text, text, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
-- so a service_role (o n8n) executa.

-- ------------------------------------------------------------
-- 5. RESGATAR CODIGO DE ATIVACAO
-- Pra quem comprou com um email e se cadastrou com outro.
-- ------------------------------------------------------------
create or replace function public.ativar_codigo(p_codigo text)
returns table (ok boolean, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_at public.ativacao%rowtype;
begin
  if v_user is null then
    return query select false, 'Entre com a sua conta primeiro.'::text; return;
  end if;

  select * into v_at from public.ativacao
  where codigo = upper(trim(p_codigo)) limit 1;

  if v_at.codigo is null then
    return query select false, 'Codigo nao encontrado. Confira se digitou certo.'::text; return;
  end if;
  if v_at.usado_por is not null then
    return query select false, 'Esse codigo ja foi usado.'::text; return;
  end if;
  if v_at.expira_em < now() then
    return query select false, 'Esse codigo expirou. Fale com o suporte.'::text; return;
  end if;

  update public.assinatura set user_id = v_user, atualizado_em = now()
  where id = v_at.assinatura_id;

  update public.ativacao set usado_por = v_user, usado_em = now()
  where codigo = v_at.codigo;

  return query select true, 'Pronto, acesso liberado.'::text;
end $$;

revoke all on function public.ativar_codigo(text) from public;
grant execute on function public.ativar_codigo(text) to authenticated;

-- ------------------------------------------------------------
-- 6. LIGAR COMPRAS QUE CHEGARAM ANTES DO CADASTRO
-- Alguem compra, depois cria a conta com o mesmo email.
-- ------------------------------------------------------------
create or replace function public.ligar_compras_pendentes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.assinatura
  set user_id = new.id, atualizado_em = now()
  where user_id is null and lower(email_compra) = lower(new.email);
  return new;
end $$;

drop trigger if exists tg_ligar_compras on auth.users;
create trigger tg_ligar_compras after insert on auth.users
  for each row execute function public.ligar_compras_pendentes();

-- ------------------------------------------------------------
-- 7. EXPIRAR O QUE PASSOU DA DATA
-- Agende com pg_cron, uma vez por dia.
-- ------------------------------------------------------------
create or replace function public.expirar_assinaturas()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.assinatura
  set status = 'expirada', atualizado_em = now()
  where status in ('ativa', 'atrasada')
    and vence_em is not null and vence_em < now()
    and (carencia_ate is null or carencia_ate < now());
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.expirar_assinaturas() from public, anon, authenticated;

-- select cron.schedule('expirar-assinaturas', '0 5 * * *', $$select public.expirar_assinaturas()$$);
