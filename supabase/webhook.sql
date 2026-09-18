-- ============================================================
-- TATAME OS, A PORTA DA HOTMART
--
-- O n8n recebe o aviso de compra e chama UMA funcao aqui. Quem
-- decide o que aquilo significa e o banco, e nao uma sequencia
-- de nos no n8n.
--
-- O motivo e simples: regra de negocio dentro de ferramenta
-- visual nao tem teste, nao tem historico e quebra calada. Se
-- alguem mexer num no sem querer, ninguem descobre ate um
-- cliente reclamar que pagou e nao liberou.
--
-- A funcao sabe distinguir tres coisas:
--
--   compra de video avulso     libera aquele video pra pessoa
--   compra ou renovacao        liga ou renova a assinatura
--   reembolso e chargeback     desfaz o que precisa ser desfeito
--
-- Rode no SQL Editor do Supabase, depois de links.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. QUAL PRODUTO DA HOTMART E QUAL VIDEO
--
-- Sem isto o n8n teria que adivinhar se a compra e de assinatura
-- ou de video avulso. Com isto e uma consulta: se o produto que
-- veio bate com algum video, a compra e daquele video.
-- ------------------------------------------------------------
alter table public.aula add column if not exists produto_hotmart text;

comment on column public.aula.produto_hotmart is
  'O id do produto na Hotmart que vende este video. E por ele que a compra chega no video certo.';

create unique index if not exists aula_produto_hotmart
  on public.aula (produto_hotmart) where produto_hotmart is not null;


-- ------------------------------------------------------------
-- 2. O QUE CADA EVENTO DA HOTMART SIGNIFICA
-- ------------------------------------------------------------
create or replace function public.evento_libera(p_evento text)
returns boolean language sql immutable as $$
  select p_evento in (
    'PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'SWITCH_PLAN',
    'SUBSCRIPTION_REACTIVATION'
  );
$$;

create or replace function public.evento_desfaz(p_evento text)
returns boolean language sql immutable as $$
  select p_evento in ('PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK');
$$;


-- ------------------------------------------------------------
-- 3. A PORTA
--
-- Devolve o que fez, pra o n8n registrar no historico dele e pra
-- voce conseguir depurar sem abrir o banco.
-- ------------------------------------------------------------
create or replace function public.webhook_hotmart(
  p_evento     text,
  p_email      text,
  p_produto    text default null,
  p_transacao  text default null,
  p_assinante  text default null,
  p_plano      text default null,
  p_vence_em   timestamptz default null,
  p_bruto      jsonb default null
)
returns table (feito text, detalhe text)
language plpgsql security definer set search_path = public as $$
declare
  v_aula  text;
  v_user  uuid;
  v_id    bigint;
begin
  if p_email is null or trim(p_email) = '' then
    return query select 'ignorado'::text, 'veio sem e-mail'::text; return;
  end if;

  if p_evento is null then
    return query select 'ignorado'::text, 'veio sem evento'::text; return;
  end if;

  -- ---------- e compra de video avulso? ----------
  select id into v_aula from public.aula
  where produto_hotmart is not null and produto_hotmart = p_produto
  limit 1;

  if v_aula is not null then
    if public.evento_desfaz(p_evento) then
      delete from public.compra_aula
      where aula_id = v_aula
        and (transacao = p_transacao
             or user_id = (select id from auth.users where lower(email) = lower(p_email) limit 1));
      return query select 'avulso_desfeito'::text, ('video ' || v_aula)::text; return;
    end if;

    if not public.evento_libera(p_evento) then
      return query select 'ignorado'::text, ('evento ' || p_evento || ' nao libera video')::text; return;
    end if;

    if public.registrar_compra_aula(p_email, v_aula, p_transacao) then
      return query select 'avulso_liberado'::text, ('video ' || v_aula)::text;
    else
      /* a conta ainda nao existe. A pessoa compra, depois se
         cadastra, e ai o acesso precisa estar esperando por ela. */
      insert into public.compra_pendente (email, aula_id, transacao)
      values (lower(p_email), v_aula, p_transacao)
      on conflict (email, aula_id) do nothing;
      return query select 'avulso_pendente'::text, ('sem conta ainda, video ' || v_aula)::text;
    end if;
    return;
  end if;

  -- ---------- entao e assinatura ----------
  v_id := public.registrar_compra(
    p_email, p_evento, p_transacao, p_assinante, p_produto, p_plano, p_vence_em, p_bruto
  );

  return query select 'assinatura'::text, ('linha ' || coalesce(v_id::text, 'nenhuma'))::text;
end $$;

revoke all on function public.webhook_hotmart(text, text, text, text, text, text, timestamptz, jsonb)
  from public, authenticated;
-- so a service_role (o n8n) executa.


-- ------------------------------------------------------------
-- 4. COMPRA QUE CHEGOU ANTES DA CONTA
--
-- Alguem compra o video avulso e so depois cria a conta no app.
-- A compra fica esperando aqui e e aplicada quando a conta
-- nascer com aquele e-mail.
-- ------------------------------------------------------------
create table if not exists public.compra_pendente (
  email     text not null,
  aula_id   text not null references public.aula(id) on delete cascade,
  transacao text,
  criado_em timestamptz not null default now(),
  primary key (email, aula_id)
);

alter table public.compra_pendente enable row level security;
-- ninguem le pelo app. So o gatilho abaixo e a service_role mexem.

create or replace function public.aplicar_compras_pendentes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.compra_aula (user_id, aula_id, transacao)
  select new.id, cp.aula_id, cp.transacao
  from public.compra_pendente cp
  where lower(cp.email) = lower(new.email)
  on conflict (user_id, aula_id) do nothing;

  delete from public.compra_pendente where lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists tg_compras_pendentes on auth.users;
create trigger tg_compras_pendentes after insert on auth.users
  for each row execute function public.aplicar_compras_pendentes();


-- ------------------------------------------------------------
-- 5. CONFERIR
--
-- select id, titulo, produto_hotmart from public.aula
--   where produto_hotmart is not null;
--
-- simular uma compra de assinatura:
-- select * from public.webhook_hotmart(
--   'PURCHASE_APPROVED', 'voce@email.com', 'PRODUTO_DA_ASSINATURA', 'TX123');
--
-- simular uma compra de video avulso (depois de preencher o
-- produto_hotmart naquele video, pelo painel):
-- select * from public.webhook_hotmart(
--   'PURCHASE_APPROVED', 'voce@email.com', 'ID_DO_PRODUTO_DO_VIDEO', 'TX124');
--
-- select * from public.compra_aula;
-- select * from public.compra_pendente;
-- ------------------------------------------------------------
