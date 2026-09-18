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
-- Recebe o corpo inteiro, confere o hottok e tira o que importa.
-- ------------------------------------------------------------
create or replace function public.n8n_hotmart(p_hottok text, p_corpo jsonb)
returns table (feito text, detalhe text)
language plpgsql security definer set search_path = public as $$
declare
  s  public.n8n_segredo%rowtype;
  d  jsonb := coalesce(p_corpo -> 'data', '{}'::jsonb);
begin
  select * into s from public.n8n_segredo where id = 1;
  if s.hottok is null or coalesce(nullif(p_hottok, ''), p_corpo ->> 'hottok') is distinct from s.hottok then
    raise exception 'hottok invalido' using errcode = '28000';
  end if;

  return query select * from public.webhook_hotmart(
    p_corpo ->> 'event',
    coalesce(d #>> '{buyer,email}', d #>> '{subscriber,email}'),
    nullif(d #>> '{product,id}', ''),
    coalesce(d #>> '{purchase,transaction}', d ->> 'transaction'),
    d #>> '{subscription,subscriber,code}',
    coalesce(d #>> '{subscription,plan,name}', d #>> '{product,name}'),
    case when d #>> '{purchase,date_next_charge}' is not null
         then to_timestamp((d #>> '{purchase,date_next_charge}')::numeric / 1000) end,
    p_corpo
  );
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

-- quem esta na vez, ja com o endereco do WhatsApp
create or replace function public.n8n_fila(p_chave text)
returns table (envio_id bigint, telefone text, texto text, evogo_url text, evogo_token text)
language plpgsql security definer set search_path = public as $$
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

grant execute on function public.n8n_hotmart(text, jsonb) to anon;
grant execute on function public.n8n_fila(text) to anon;
grant execute on function public.n8n_enviado(text, bigint, boolean, text) to anon;
grant execute on function public.n8n_whatsapp(text) to anon;
grant execute on function public.n8n_resposta(text, text) to anon;


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
