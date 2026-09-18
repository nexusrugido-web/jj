-- ============================================================
-- TATAME OS, AS VENDAS E DE ONDE ELAS VEM
--
-- Tres coisas moram aqui:
--
--   o livro de eventos    tudo que a Hotmart mandou, uma vez so,
--                         do jeito que chegou. Nada e apagado.
--   os produtos           a Hotmart manda evento de TODOS os
--                         produtos da conta, inclusive coproducao.
--                         So gera acesso o que estiver marcado
--                         como NeuroJitsu. O resto so fica anotado.
--   a origem              links rastreados por canal e campanha,
--                         com clique contado, e a venda chegando
--                         com o sck e o src que voltam da Hotmart.
--
-- A Hotmart nao devolve os UTMs no webhook. Devolve so src, sck
-- e xcod, em data.purchase.origin. Por isso todo link gerado aqui
-- leva a campanha no sck e o canal no src (e os UTMs tambem, pra
-- quem olhar pelo Analytics da Hotmart).
--
-- Rode no SQL Editor do Supabase, depois de n8n.sql.
-- Pode rodar de novo: nada aqui apaga o que ja existe.
-- ============================================================


-- ------------------------------------------------------------
-- 1. AJUSTES
--
-- link_base e o endereco dos links curtos. Quando o dominio
-- proprio chegar, troca aqui (ou no painel) e todo link novo ja
-- sai com ele.
-- ------------------------------------------------------------
create table if not exists public.vendas_ajuste (
  id         int primary key default 1 check (id = 1),
  link_base  text not null default 'https://jj-theta-eight.vercel.app'
);

insert into public.vendas_ajuste (id) values (1) on conflict (id) do nothing;


-- ------------------------------------------------------------
-- 2. OS PRODUTOS
--
-- tipo:
--   null         ainda nao classificado: o evento fica guardado,
--                ninguem ganha acesso, e voce recebe um aviso
--   neurojitsu   e do app: gera acesso e entra na recuperacao
--   fora         outro produto da conta: so fica anotado
--
-- Quando voce classifica, os eventos que estavam esperando sao
-- processados na hora, em ordem. Nenhuma venda se perde.
-- ------------------------------------------------------------
create table if not exists public.produto_hotmart (
  id          text primary key,
  nome        text,
  tipo        text check (tipo in ('neurojitsu', 'fora')),
  eventos     int not null default 0,
  primeiro_em timestamptz not null default now(),
  ultimo_em   timestamptz not null default now()
);

/* os produtos que ja viraram assinatura antes deste arquivo
   existir entram na lista pra voce classificar. Se algum for de
   fora (uma coproducao, por exemplo), marcar "nao e" tira o
   acesso que ele deu ao app sem querer. */
insert into public.produto_hotmart (id, nome, eventos)
select produto, max(plano), count(*) from public.assinatura
where produto is not null and produto <> ''
group by produto
on conflict (id) do nothing;

-- produto que vende um video avulso e do app, sem perguntar
insert into public.produto_hotmart (id, nome, tipo)
select produto_hotmart, titulo, 'neurojitsu' from public.aula where produto_hotmart is not null
on conflict (id) do update set tipo = coalesce(produto_hotmart.tipo, 'neurojitsu');


-- ------------------------------------------------------------
-- 3. O LIVRO DE EVENTOS
--
-- O id e o que a Hotmart manda em cada aviso. Se ela mandar o
-- mesmo aviso de novo (ela reenvia quando demora), a segunda vez
-- bate no id e nao faz nada: nenhuma venda conta em dobro.
-- ------------------------------------------------------------
create table if not exists public.hotmart_evento (
  id           text primary key,
  evento       text not null,
  criado_em    timestamptz not null,
  recebido_em  timestamptz not null default now(),
  transacao    text,
  email        text,
  nome         text,
  telefone     text,
  produto      text,
  produto_nome text,
  oferta       text,
  valor        numeric,
  moeda        text,
  pagamento    text,
  parcelas     int,
  status       text,
  src          text,
  sck          text,
  xcod         text,
  cupom        text,
  assinante    text,
  recorrencia  int,
  processado   text,
  bruto        jsonb not null
);

create index if not exists hotmart_evento_criado on public.hotmart_evento (criado_em desc);
create index if not exists hotmart_evento_transacao on public.hotmart_evento (transacao);
create index if not exists hotmart_evento_produto on public.hotmart_evento (produto);
create index if not exists hotmart_evento_email on public.hotmart_evento (lower(email));
create index if not exists hotmart_evento_sck on public.hotmart_evento (sck);


-- ------------------------------------------------------------
-- 4. OS LINKS RASTREADOS
--
-- canal: instagram_bio, instagram_reels, instagram_stories,
-- youtube_video, youtube_shorts, tiktok_video, whatsapp_grupo...
-- A parte antes do _ vira utm_source, a de depois utm_medium.
--
-- destino: 'assinatura', 'anual', 'url' (usa o campo url) ou o id
-- de um video avulso.
-- ------------------------------------------------------------
create table if not exists public.campanha (
  codigo     text primary key check (codigo ~ '^[a-z0-9][a-z0-9_-]{1,40}$'),
  nome       text not null,
  canal      text not null default 'outro',
  destino    text not null default 'assinatura',
  url        text,
  cupom      text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table if not exists public.clique (
  id         bigserial primary key,
  codigo     text not null,
  tipo       text not null,           -- campanha, recuperacao
  criado_em  timestamptz not null default now()
);

create index if not exists clique_codigo on public.clique (codigo, criado_em);


-- ------------------------------------------------------------
-- 5. QUEM LE E QUEM MEXE
-- ------------------------------------------------------------
alter table public.vendas_ajuste   enable row level security;
alter table public.produto_hotmart enable row level security;
alter table public.hotmart_evento  enable row level security;
alter table public.campanha        enable row level security;
alter table public.clique          enable row level security;

drop policy if exists vendas_ajuste_admin on public.vendas_ajuste;
create policy vendas_ajuste_admin on public.vendas_ajuste for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

-- produto: o admin le. Classificar passa pela funcao, que reprocessa.
drop policy if exists produto_hotmart_admin on public.produto_hotmart;
create policy produto_hotmart_admin on public.produto_hotmart for select to authenticated
  using (public.sou_admin());

-- o livro so e lido. Ninguem edita nem apaga pelo app.
drop policy if exists hotmart_evento_admin on public.hotmart_evento;
create policy hotmart_evento_admin on public.hotmart_evento for select to authenticated
  using (public.sou_admin());

drop policy if exists campanha_admin on public.campanha;
create policy campanha_admin on public.campanha for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists clique_admin on public.clique;
create policy clique_admin on public.clique for select to authenticated
  using (public.sou_admin());


-- ------------------------------------------------------------
-- 6. O LINK DE ATUALIZAR O PAGAMENTO
--
-- Pra onde vai quem ja era assinante e teve a renovacao recusada.
-- Vazio, a recuperacao usa o link da assinatura.
-- ------------------------------------------------------------
insert into public.link (chave, nome, descricao, grupo, ordem, fixo) values
  ('atualizar_pagamento', 'Atualizar pagamento',
   'Pra onde vai o assinante cuja renovacao nao passou. Vazio, a recuperacao manda o link da assinatura.',
   'ajuda', 4, false)
on conflict (chave) do nothing;


-- ------------------------------------------------------------
-- 7. O CLIQUE NO LINK CURTO
--
-- A Vercel chama esta funcao em /r/<codigo> e manda a pessoa pro
-- endereco que ela devolver. Robo de previa de link (o WhatsApp
-- abre o link sozinho pra montar a previa) nao conta como clique.
-- ------------------------------------------------------------
create or replace function public.link_destino(p_codigo text, p_contar boolean default true)
returns text language plpgsql security definer set search_path = public as $$
declare
  c     public.campanha%rowtype;
  ev    record;
  cod   text := lower(trim(coalesce(p_codigo, '')));
  base  text;
  fonte text;
  meio  text;
begin
  if cod !~ '^[a-z0-9_-]{2,48}$' then return null; end if;

  select * into c from public.campanha where codigo = cod and ativo;
  if c.codigo is not null then
    base := case c.destino
      when 'assinatura' then (select nullif(url, '') from public.link where chave = 'assinatura_mensal')
      when 'anual' then coalesce((select nullif(url, '') from public.link where chave = 'assinatura_anual'),
                                 (select nullif(url, '') from public.link where chave = 'assinatura_mensal'))
      when 'url' then nullif(c.url, '')
      else (select checkout_url from public.aula where id = c.destino)
    end;
    if base is null then return null; end if;

    if p_contar then
      insert into public.clique (codigo, tipo) values (cod, 'campanha');
    end if;

    fonte := split_part(c.canal, '_', 1);
    meio := coalesce(nullif(substr(c.canal, length(fonte) + 2), ''), 'organico');

    return base || case when base like '%?%' then '&' else '?' end
      || 'sck=' || public.uri(c.codigo)
      || '&src=' || public.uri(c.canal)
      || '&utm_source=' || public.uri(fonte)
      || '&utm_medium=' || public.uri(meio)
      || '&utm_campaign=' || public.uri(c.codigo)
      || coalesce('&offDiscount=' || public.uri(nullif(c.cupom, '')), '');
  end if;

  select id, destino, recuperacao_id into ev from public.recuperacao_envio where codigo = cod;
  if ev.id is not null then
    if p_contar then
      update public.recuperacao_envio set clicou_em = coalesce(clicou_em, now()) where id = ev.id;
      update public.recuperacao set clicou_em = coalesce(clicou_em, now()) where id = ev.recuperacao_id;
      insert into public.clique (codigo, tipo) values (cod, 'recuperacao');
    end if;
    return ev.destino;
  end if;

  return null;
end $$;

revoke all on function public.link_destino(text, boolean) from public;
-- o painel usa pra mostrar o link completo, sem contar clique
grant execute on function public.link_destino(text, boolean) to anon, authenticated;


-- ------------------------------------------------------------
-- 8. CLASSIFICAR UM PRODUTO
--
-- neurojitsu: os eventos que estavam esperando sao processados
-- agora, em ordem. Abandono e Pix gerado com mais de um dia nao
-- abrem recuperacao: mandar mensagem de coisa velha e pior que
-- nao mandar.
--
-- fora: se alguma venda desse produto tinha virado assinatura do
-- app antes de existir esta separacao, ela perde o acesso aqui.
-- ------------------------------------------------------------
create or replace function public.produto_classificar(p_id text, p_tipo text)
returns text language plpgsql security definer set search_path = public as $$
declare
  ev  public.hotmart_evento%rowtype;
  res record;
  n   int := 0;
  c   int := 0;
begin
  if not public.sou_admin() then raise exception 'so o administrador'; end if;
  if p_tipo not in ('neurojitsu', 'fora') then raise exception 'tipo invalido'; end if;

  update public.produto_hotmart set tipo = p_tipo where id = p_id;
  if not found then return 'produto nao encontrado'; end if;

  if p_tipo = 'fora' then
    update public.assinatura set status = 'fora', carencia_ate = null, atualizado_em = now()
    where produto = p_id and status <> 'fora';
    get diagnostics c = row_count;

    update public.recuperacao set status = 'parado', proximo_em = null, fechado_em = now()
    where produto = p_id and status = 'ativo';

    update public.hotmart_evento set processado = 'fora'
    where produto = p_id and processado = 'produto_nao_classificado';

    return case when c > 0 then c || ' assinatura(s) desse produto perderam o acesso ao app' else 'ok' end;
  end if;

  for ev in
    select * from public.hotmart_evento
    where produto = p_id and processado = 'produto_nao_classificado'
    order by criado_em, recebido_em
  loop
    if ev.evento in ('PURCHASE_OUT_OF_SHOPPING_CART', 'PURCHASE_BILLET_PRINTED', 'PURCHASE_EXPIRED')
       and ev.criado_em < now() - interval '1 day' then
      update public.hotmart_evento set processado = 'antigo demais pra recuperar' where id = ev.id;
      continue;
    end if;

    select * into res from public.webhook_hotmart(
      ev.evento, ev.email, ev.produto, ev.transacao, ev.assinante,
      coalesce(ev.bruto #>> '{data,subscription,plan,name}', ev.produto_nome),
      case when ev.bruto #>> '{data,purchase,date_next_charge}' ~ '^\d+$'
           then to_timestamp((ev.bruto #>> '{data,purchase,date_next_charge}')::numeric / 1000) end,
      ev.bruto
    );
    update public.hotmart_evento set processado = coalesce(res.feito || ': ' || res.detalhe, 'processado')
    where id = ev.id;
    n := n + 1;
  end loop;

  return n || ' evento(s) processado(s)';
end $$;

grant execute on function public.produto_classificar(text, text) to authenticated;


-- ------------------------------------------------------------
-- 9. OS NUMEROS DE VENDA
--
-- So produtos do NeuroJitsu. Uma venda e uma transacao: aprovado
-- e completo da mesma transacao contam uma vez. Reembolso e
-- chargeback descontam.
--
-- MRR: soma do ultimo valor pago de cada assinatura ativa. Plano
-- com "anual" no nome entra dividido por 12. So conta assinatura
-- que teve pagamento registrado neste livro.
-- ------------------------------------------------------------
create or replace function public.vendas_numeros(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  desde timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
                       - make_interval(days => p_dias - 1);
  res   jsonb;
begin
  if not public.sou_admin() then raise exception 'so o administrador'; end if;

  with ev as (
    select e.* from public.hotmart_evento e
    join public.produto_hotmart p on p.id = e.produto and p.tipo = 'neurojitsu'
    where e.criado_em >= desde
  ), venda as (
    select distinct on (transacao) transacao, valor, src, sck, criado_em
    from ev where evento in ('PURCHASE_APPROVED', 'PURCHASE_COMPLETE') and transacao is not null
    order by transacao, criado_em
  ), reembolso as (
    select distinct on (transacao) transacao, valor
    from ev where evento in ('PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK') and transacao is not null
    order by transacao, criado_em
  ), cliques as (
    select codigo, count(*) q from public.clique
    where tipo = 'campanha' and criado_em >= desde group by codigo
  )
  select jsonb_build_object(
    'vendas',        (select count(*) from venda),
    'receita',       (select coalesce(sum(valor), 0) from venda),
    'reembolsos',    (select count(*) from reembolso),
    'reembolsado',   (select coalesce(sum(valor), 0) from reembolso),
    'cancelamentos', (select count(*) from ev where evento = 'SUBSCRIPTION_CANCELLATION'),
    'cliques',       (select coalesce(sum(q), 0) from cliques),
    'assinantes',    (select count(*) from public.assinatura
                      where status = 'ativa' and (vence_em is null or vence_em > now())
                        and produto in (select id from public.produto_hotmart where tipo = 'neurojitsu')),
    'mrr', (
      select coalesce(sum(case when a.plano ilike '%anual%' then v.valor / 12 else v.valor end), 0)
      from public.assinatura a
      cross join lateral (
        select e.valor from public.hotmart_evento e
        where e.evento in ('PURCHASE_APPROVED', 'PURCHASE_COMPLETE')
          and (e.transacao = a.transacao or (a.codigo_assinante is not null and e.assinante = a.codigo_assinante))
        order by e.criado_em desc limit 1
      ) v
      where a.status = 'ativa' and (a.vence_em is null or a.vence_em > now())
    ),
    'sem_classificar', (select count(*) from public.produto_hotmart where tipo is null),
    'por_canal', coalesce((
      select jsonb_agg(jsonb_build_object('canal', canal, 'vendas', q, 'receita', rec) order by rec desc)
      from (select coalesce(nullif(src, ''), 'sem origem') canal, count(*) q, sum(valor) rec
            from venda group by 1) x), '[]'::jsonb),
    'por_campanha', coalesce((
      select jsonb_agg(jsonb_build_object(
        'codigo', codigo, 'nome', nome, 'canal', canal, 'cliques', cliques, 'vendas', vendas, 'receita', receita
      ) order by receita desc, cliques desc)
      from (
        select k.codigo,
               coalesce(c.nome, k.codigo) nome,
               c.canal,
               coalesce((select q from cliques where cliques.codigo = k.codigo), 0) cliques,
               (select count(*) from venda where venda.sck = k.codigo) vendas,
               (select coalesce(sum(valor), 0) from venda where venda.sck = k.codigo) receita
        from (select codigo from public.campanha
              union select sck from venda where sck is not null and sck <> '') k
        left join public.campanha c on c.codigo = k.codigo
      ) x where cliques > 0 or vendas > 0), '[]'::jsonb),
    'por_dia', (
      select jsonb_agg(jsonb_build_object(
        'dia', to_char(dia, 'YYYY-MM-DD'),
        'vendas', (select count(*) from venda where (venda.criado_em at time zone 'America/Sao_Paulo')::date = dia),
        'receita', (select coalesce(sum(valor), 0) from venda where (venda.criado_em at time zone 'America/Sao_Paulo')::date = dia)
      ) order by dia)
      from generate_series((desde at time zone 'America/Sao_Paulo')::date,
                           (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') g(dia)
    )
  ) into res;

  return res;
end $$;

grant execute on function public.vendas_numeros(int) to authenticated;


-- ------------------------------------------------------------
-- 10. A VIGIA
--
-- O banco confere sozinho, a cada 5 minutos:
--
--   o WhatsApp esta conectado?   pergunta direto ao Evolution Go
--   o n8n esta passando?          olha o ultimo ciclo da fila
--
-- Se o n8n parou, o aviso nao pode sair pelo n8n. Entao a vigia
-- manda direto pro Evolution Go, sem passar por ele. Se foi o
-- WhatsApp que caiu, nao tem por onde avisar no WhatsApp: o
-- painel mostra em vermelho.
--
-- Usa duas extensoes do Supabase: pg_net (fazer chamada pra fora)
-- e pg_cron (rodar de tempos em tempos). Se o seu plano nao
-- tiver alguma delas, o resto funciona igual, so sem a vigia.
-- ------------------------------------------------------------
create or replace function public.vigia()
returns text language plpgsql security definer set search_path = public as $$
declare
  a    public.recuperacao_ajuste%rowtype;
  s    public.n8n_segredo%rowtype;
  resp record;
  d    record;
  ok   boolean;
begin
  select * into a from public.recuperacao_ajuste where id = 1;
  select * into s from public.n8n_segredo where id = 1;
  if s.evogo_url is null or s.evogo_token is null then return 'sem whatsapp configurado'; end if;

  -- o que o Evolution Go respondeu na rodada anterior
  if a.vigia_req is not null then
    begin
      execute 'select status_code, content from net._http_response where id = $1'
        into resp using a.vigia_req;
      if resp.status_code is not null then
        ok := resp.status_code = 200 and coalesce((resp.content::jsonb #>> '{data,Connected}')::boolean, false);
        update public.recuperacao_ajuste set whatsapp_ok = ok, whatsapp_visto = now() where id = 1;
      end if;
    exception when others then null;
    end;
  end if;

  -- pergunta de novo, a resposta chega na proxima rodada
  execute 'select net.http_get(url := $1, headers := $2)'
    into a.vigia_req
    using rtrim(s.evogo_url, '/') || '/instance/status', jsonb_build_object('apikey', s.evogo_token);
  update public.recuperacao_ajuste set vigia_req = a.vigia_req where id = 1;

  -- o n8n parou de passar
  if a.ligado and a.ultimo_ciclo is not null and a.ultimo_ciclo < now() - interval '15 minutes'
     and not exists (select 1 from public.aviso_controle where chave = 'n8n_parado' and ultimo > now() - interval '2 hours') then
    insert into public.aviso_controle (chave, ultimo) values ('n8n_parado', now())
    on conflict (chave) do update set ultimo = now();

    for d in select telefone from public.aviso_destino where ativo and alarmes loop
      execute 'select net.http_post(url := $1, body := $2, headers := $3)'
        using rtrim(s.evogo_url, '/') || '/send/text',
              jsonb_build_object('number', d.telefone, 'text',
                '⚠️ NeuroJitsu: o n8n não confere a fila de mensagens desde '
                || to_char(a.ultimo_ciclo at time zone 'America/Sao_Paulo', 'HH24:MI')
                || '. Abra o n8n e veja se o fluxo está ativo.'),
              jsonb_build_object('apikey', s.evogo_token, 'Content-Type', 'application/json');
    end loop;
  end if;

  return 'ok';
end $$;

revoke all on function public.vigia() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
  perform cron.schedule('neurojitsu-vigia', '*/5 * * * *', 'select public.vigia()');
exception when others then
  raise notice 'a vigia ficou sem agendamento: %', sqlerrm;
end $$;


-- ------------------------------------------------------------
-- 11. CONFERIR
--
-- select id, nome, tipo, eventos from public.produto_hotmart order by ultimo_em desc;
-- select evento, email, valor, src, sck, processado from public.hotmart_evento order by criado_em desc limit 20;
-- select * from cron.job;
-- ------------------------------------------------------------
