-- ============================================================
-- TATAME OS, O RECUPERADOR
--
-- Quem chegou perto de pagar e nao pagou recebe uma sequencia
-- curta de mensagens no WhatsApp. Sao tres fluxos, cada um com
-- as suas mensagens:
--
--   carrinho     abandonou o checkout, o Pix venceu, o cartao nao passou
--   pix          gerou o Pix ou o boleto e ainda nao pagou (vai o codigo)
--   renovacao    ja era assinante e a renovacao nao passou
--
-- A sequencia para sozinha quando:
--
--   a pessoa compra              (vira "recuperado")
--   a pessoa responde            (vira lead quente, e voce e avisado)
--   a pessoa pede pra sair       (o numero nunca mais recebe nada)
--   as mensagens acabam          (vira "esgotado")
--   voce para na mao pelo painel
--
-- Quem decide quem recebe o que e quando e o banco. O n8n so
-- pergunta "quem esta na vez?", manda, e conta como foi. Textos,
-- tempos, cupom, limite por dia e liga/desliga ficam em tabela, e
-- o painel edita.
--
-- Chargeback fica de fora: quem contestou no banco nao quer ser
-- lembrado de comprar.
--
-- Rode no SQL Editor do Supabase, depois de webhook.sql.
-- Pode rodar de novo: nada aqui apaga o que ja existe.
-- ============================================================


-- ------------------------------------------------------------
-- 1. O QUE LIGA CADA FLUXO, E COMO O MOTIVO E CHAMADO
--
-- A frase entra no lugar de {motivo} no texto. Assim a mesma
-- mensagem serve pra quem abandonou e pra quem deixou o Pix
-- vencer, sem voce escrever uma versao pra cada.
-- ------------------------------------------------------------
create table if not exists public.recuperacao_motivo (
  evento  text primary key,
  nome    text not null,
  frase   text not null,
  ativo   boolean not null default true
);

alter table public.recuperacao_motivo add column if not exists fluxo text not null default 'carrinho';

insert into public.recuperacao_motivo (evento, nome, frase, fluxo) values
  ('PURCHASE_OUT_OF_SHOPPING_CART', 'Abandonou o checkout', 'você começou a compra e parou no meio', 'carrinho'),
  ('PURCHASE_EXPIRED',              'Pix ou boleto venceu', 'o seu Pix ou boleto venceu antes do pagamento', 'carrinho'),
  ('PURCHASE_CANCELED',             'Pagamento não passou', 'o pagamento não foi aprovado', 'carrinho'),
  ('PURCHASE_BILLET_PRINTED',       'Pix ou boleto gerado', 'o seu pagamento ainda não caiu', 'pix'),
  ('PURCHASE_DELAYED',              'Renovação não passou', 'a renovação da sua assinatura não passou', 'renovacao')
on conflict (evento) do nothing;


-- ------------------------------------------------------------
-- 2. AS MENSAGENS
--
-- O atraso conta a partir do evento, nao da mensagem anterior.
-- Campos trocados na hora do envio:
--   {nome} {produto} {link} {motivo} {cupom} {pix}
-- ------------------------------------------------------------
create table if not exists public.recuperacao_etapa (
  id          bigserial primary key,
  ordem       int  not null,
  atraso_min  int  not null check (atraso_min >= 5),
  texto       text not null,
  ativa       boolean not null default true
);

alter table public.recuperacao_etapa add column if not exists fluxo text not null default 'carrinho';
alter table public.recuperacao_etapa drop constraint if exists recuperacao_etapa_ordem_key;
create unique index if not exists recuperacao_etapa_fluxo_ordem on public.recuperacao_etapa (fluxo, ordem);

insert into public.recuperacao_etapa (fluxo, ordem, atraso_min, texto)
select 'carrinho', * from (values
  (1, 60,
   'Oi, {nome}! Aqui é do NeuroJitsu. Vi que {motivo}. Ficou alguma dúvida? Se quiser terminar, o link já vem com os seus dados:' || chr(10) || chr(10) || '{link}'),
  (2, 1440,
   '{nome}, passando só mais uma vez. O {produto} transforma o seu diário de rola em diagnóstico do seu jogo: onde você trava, o que treinar na semana. Seu acesso tá aqui:' || chr(10) || chr(10) || '{link}' || chr(10) || chr(10) || 'Se não fizer sentido agora, tudo bem, não te mando mais nada.')
) v(ordem, atraso_min, texto)
where not exists (select 1 from public.recuperacao_etapa where fluxo = 'carrinho');

insert into public.recuperacao_etapa (fluxo, ordem, atraso_min, texto)
select 'pix', * from (values
  (1, 15,
   'Oi, {nome}! Aqui é do NeuroJitsu. Vi que {motivo}. Se quiser pagar agora, é só copiar o código abaixo e colar no app do seu banco, na parte de Pix copia e cola:' || chr(10) || chr(10) || '{pix}'),
  (2, 1200,
   '{nome}, o seu Pix do {produto} vence em breve. Se ainda quiser, o código é este:' || chr(10) || chr(10) || '{pix}')
) v(ordem, atraso_min, texto)
where not exists (select 1 from public.recuperacao_etapa where fluxo = 'pix');

insert into public.recuperacao_etapa (fluxo, ordem, atraso_min, texto)
select 'renovacao', * from (values
  (1, 60,
   'Oi, {nome}! Aqui é do NeuroJitsu. Vi que {motivo}. Pra não perder o seu acesso nem o seu histórico, dá pra resolver por aqui:' || chr(10) || chr(10) || '{link}' || chr(10) || chr(10) || 'Se já resolveu, pode ignorar.'),
  (2, 2880,
   '{nome}, o seu acesso ao {produto} está em risco porque o pagamento não passou. Seus treinos continuam salvos. Se quiser manter, é por aqui:' || chr(10) || chr(10) || '{link}')
) v(ordem, atraso_min, texto)
where not exists (select 1 from public.recuperacao_etapa where fluxo = 'renovacao');


-- ------------------------------------------------------------
-- 3. O LIGA E DESLIGA, O HORARIO E OS FREIOS
--
-- Mensagem de venda as 3 da manha queima o numero e a marca.
-- Fora da janela a fila espera, e sai no comeco da proxima.
-- O limite por dia e o freio contra banimento: WhatsApp que
-- dispara demais de uma vez chama atencao da Meta.
-- O ultimo_ciclo e o n8n batendo o ponto. O whatsapp_ok e a
-- vigia do banco conferindo se a instancia esta conectada.
-- ------------------------------------------------------------
create table if not exists public.recuperacao_ajuste (
  id            int primary key default 1 check (id = 1),
  ligado        boolean not null default false,
  hora_inicio   int not null default 8  check (hora_inicio between 0 and 23),
  hora_fim      int not null default 21 check (hora_fim between 1 and 24),
  ultimo_ciclo  timestamptz
);

alter table public.recuperacao_ajuste add column if not exists cupom          text;
alter table public.recuperacao_ajuste add column if not exists limite_dia     int not null default 80;
alter table public.recuperacao_ajuste add column if not exists encurtar       boolean not null default true;
alter table public.recuperacao_ajuste add column if not exists whatsapp_ok    boolean;
alter table public.recuperacao_ajuste add column if not exists whatsapp_visto timestamptz;
alter table public.recuperacao_ajuste add column if not exists vigia_req      bigint;

insert into public.recuperacao_ajuste (id) values (1) on conflict (id) do nothing;


-- ------------------------------------------------------------
-- 4. CADA SEQUENCIA
--
-- status:
--   ativo            na sequencia
--   esgotado         recebeu tudo e nao comprou (ainda pode virar recuperado por 7 dias)
--   recuperado       comprou depois de receber pelo menos uma mensagem
--   comprou_sozinho  comprou antes da primeira mensagem sair
--   respondeu        respondeu no WhatsApp: lead quente, conversa de gente
--   bloqueado        pediu pra sair, ou o numero ja tinha pedido antes
--   venceu           o Pix venceu antes de pagar (abre a de carrinho)
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

alter table public.recuperacao add column if not exists fluxo         text not null default 'carrinho';
alter table public.recuperacao add column if not exists nome_completo text;
alter table public.recuperacao add column if not exists origem        text;          -- de onde a pessoa veio (sck/src)
alter table public.recuperacao add column if not exists pix           text;          -- codigo copia e cola, ou linha do boleto
alter table public.recuperacao add column if not exists expira_em     timestamptz;   -- quando o Pix vence
alter table public.recuperacao add column if not exists clicou_em     timestamptz;
alter table public.recuperacao add column if not exists resposta      text;
alter table public.recuperacao add column if not exists respondeu_em  timestamptz;

-- uma sequencia viva por pessoa, produto e fluxo: a Hotmart manda
-- o mesmo evento mais de uma vez, e ninguem pode receber em dobro
drop index if exists public.recuperacao_uma_viva;
create unique index if not exists recuperacao_uma_viva_fluxo
  on public.recuperacao (lower(email), coalesce(produto, ''), fluxo) where status = 'ativo';

create index if not exists recuperacao_fila
  on public.recuperacao (proximo_em) where status = 'ativo';

create index if not exists recuperacao_email on public.recuperacao (lower(email));

-- tudo que sai pelo WhatsApp: mensagem de recuperacao, aviso pra
-- voce e resposta automatica. So a de recuperacao entra nos numeros.
create table if not exists public.recuperacao_envio (
  id               bigserial primary key,
  recuperacao_id   bigint not null references public.recuperacao(id) on delete cascade,
  etapa            int  not null,
  telefone         text not null,
  texto            text not null,
  status           text not null default 'enviando',  -- fila, enviando, enviado, falhou
  erro             text,
  criado_em        timestamptz not null default now()
);

alter table public.recuperacao_envio alter column recuperacao_id drop not null;
alter table public.recuperacao_envio add column if not exists tipo      text not null default 'recuperacao';
alter table public.recuperacao_envio add column if not exists codigo    text;   -- o link curto desta mensagem
alter table public.recuperacao_envio add column if not exists destino   text;   -- pra onde o link curto leva
alter table public.recuperacao_envio add column if not exists clicou_em timestamptz;

create index if not exists recuperacao_envio_rec on public.recuperacao_envio (recuperacao_id);
create unique index if not exists recuperacao_envio_codigo on public.recuperacao_envio (codigo) where codigo is not null;
create index if not exists recuperacao_envio_fila on public.recuperacao_envio (id) where status = 'fila';

-- o que as pessoas responderam, pra voce ler e fechar a venda na mao
create table if not exists public.recuperacao_resposta (
  id              bigserial primary key,
  recuperacao_id  bigint references public.recuperacao(id) on delete cascade,
  telefone        text not null,
  texto           text,
  criado_em       timestamptz not null default now()
);

-- quem pediu pra sair. A chave e 55 + DDD + os ultimos 8 digitos,
-- porque o WhatsApp as vezes guarda numero brasileiro sem o 9.
create table if not exists public.recuperacao_bloqueio (
  chave      text primary key,
  telefone   text,
  motivo     text,
  criado_em  timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 5. OS AVISOS PRA VOCE
--
-- Cada numero escolhe o que recebe: lead quente (alguem
-- respondeu), alarme (algo parou) e venda nova.
-- ------------------------------------------------------------
create table if not exists public.aviso_destino (
  id         bigserial primary key,
  nome       text not null,
  telefone   text not null,
  leads      boolean not null default true,
  alarmes    boolean not null default true,
  vendas     boolean not null default true,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- quando cada aviso saiu por ultimo, pra nao repetir o mesmo alarme
create table if not exists public.aviso_controle (
  chave   text primary key,
  ultimo  timestamptz not null
);


-- ------------------------------------------------------------
-- 6. QUEM LE E QUEM MEXE
--
-- So o administrador, pelo painel. O n8n entra pelas funcoes do
-- n8n.sql, que conferem uma chave.
-- ------------------------------------------------------------
alter table public.recuperacao_motivo   enable row level security;
alter table public.recuperacao_etapa    enable row level security;
alter table public.recuperacao_ajuste   enable row level security;
alter table public.recuperacao          enable row level security;
alter table public.recuperacao_envio    enable row level security;
alter table public.recuperacao_resposta enable row level security;
alter table public.recuperacao_bloqueio enable row level security;
alter table public.aviso_destino        enable row level security;
alter table public.aviso_controle       enable row level security;

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

drop policy if exists rec_resposta_admin on public.recuperacao_resposta;
create policy rec_resposta_admin on public.recuperacao_resposta for select to authenticated
  using (public.sou_admin());

drop policy if exists rec_bloqueio_admin on public.recuperacao_bloqueio;
create policy rec_bloqueio_admin on public.recuperacao_bloqueio for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists aviso_destino_admin on public.aviso_destino;
create policy aviso_destino_admin on public.aviso_destino for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());


-- ------------------------------------------------------------
-- 7. PEQUENAS FERRAMENTAS
-- ------------------------------------------------------------

-- o telefone que da pra usar: sempre 55DDDNUMERO, ou null
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

-- 55 + DDD + ultimos 8: o mesmo numero com ou sem o 9 da frente
create or replace function public.telefone_chave(p_tel text)
returns text language sql immutable as $$
  select case when length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) >= 12
    then left(regexp_replace(p_tel, '\D', '', 'g'), 4) || right(regexp_replace(p_tel, '\D', '', 'g'), 8)
  end;
$$;

-- texto seguro pra ir dentro de um link
create or replace function public.uri(p text)
returns text language plpgsql immutable as $$
declare
  r text := '';
  c text;
  b bytea;
  i int;
begin
  if p is null then return null; end if;
  foreach c in array regexp_split_to_array(p, '') loop
    if c ~ '^[A-Za-z0-9._~-]$' then
      r := r || c;
    else
      b := convert_to(c, 'UTF8');
      for i in 0 .. length(b) - 1 loop
        r := r || '%' || upper(lpad(to_hex(get_byte(b, i)), 2, '0'));
      end loop;
    end if;
  end loop;
  return r;
end $$;


-- ------------------------------------------------------------
-- 8. AVISAR
--
-- O aviso entra na mesma fila das mensagens e sai no proximo
-- ciclo do n8n, fora do limite por dia e do horario: se alguem
-- respondeu as 22h, voce quer saber.
-- ------------------------------------------------------------
create or replace function public.avisar(p_tipo text, p_texto text)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  insert into public.recuperacao_envio (recuperacao_id, etapa, telefone, texto, tipo, status)
  select null, 0, d.telefone, p_texto, 'aviso', 'fila'
  from public.aviso_destino d
  where d.ativo
    and ((p_tipo = 'leads' and d.leads) or (p_tipo = 'alarmes' and d.alarmes) or (p_tipo = 'vendas' and d.vendas));
  get diagnostics n = row_count;
  return n;
end $$;

-- o mesmo aviso no maximo uma vez por intervalo
create or replace function public.avisar_uma_vez(p_tipo text, p_chave text, p_texto text, p_intervalo interval default interval '1 hour')
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.aviso_controle where chave = p_chave and ultimo > now() - p_intervalo) then
    return false;
  end if;
  insert into public.aviso_controle (chave, ultimo) values (p_chave, now())
  on conflict (chave) do update set ultimo = now();
  perform public.avisar(p_tipo, p_texto);
  return true;
end $$;

-- resposta automatica pra um numero so (a confirmacao de saida)
create or replace function public.responder_para(p_tel text, p_texto text)
returns void language sql security definer set search_path = public as $$
  insert into public.recuperacao_envio (recuperacao_id, etapa, telefone, texto, tipo, status)
  values (null, 0, p_tel, p_texto, 'resposta', 'fila');
$$;

revoke all on function public.avisar(text, text) from public, anon, authenticated;
revoke all on function public.avisar_uma_vez(text, text, text, interval) from public, anon, authenticated;
revoke all on function public.responder_para(text, text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 9. QUANDO SAI A PROXIMA
--
-- A partir do evento, mas nunca menos de 3 horas depois da
-- mensagem anterior. Sem isso, quem abandonou de madrugada
-- receberia as duas de manha, uma atras da outra.
-- ------------------------------------------------------------
drop function if exists public.recuperacao_proxima_etapa(timestamptz, int, boolean);

create or replace function public.recuperacao_proxima_etapa(p_criado timestamptz, p_depois_de int, p_primeira boolean, p_fluxo text)
returns table (ordem int, quando timestamptz)
language sql stable set search_path = public as $$
  select e.ordem,
         greatest(p_criado + make_interval(mins => e.atraso_min),
                  case when p_primeira then now() else now() + interval '3 hours' end)
  from public.recuperacao_etapa e
  where e.ativa and e.fluxo = p_fluxo and e.ordem > p_depois_de
  order by e.ordem
  limit 1;
$$;


-- ------------------------------------------------------------
-- 10. O LINK DE VOLTA
--
-- Renovacao vai pro link de atualizar o pagamento, se existir.
-- O resto vai pro checkout do video avulso, se o produto for um,
-- ou pro da assinatura. Sempre com e-mail e nome preenchidos, e
-- marcado: sck=recuperacao diz que fechou pela recuperacao, e o
-- src guarda de onde a pessoa tinha vindo antes, pra origem
-- original (o Reels, o YouTube) nao perder o credito.
-- ------------------------------------------------------------
drop function if exists public.recuperacao_link(text, text, text);

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


-- ------------------------------------------------------------
-- 11. O QUE A HOTMART MANDOU
--
-- webhook_hotmart chama esta funcao em todo evento de produto do
-- NeuroJitsu. Ela abre a sequencia certa, e fecha quando a
-- compra entra.
-- ------------------------------------------------------------
create or replace function public.recuperacao_hotmart(p_evento text, p_email text, p_produto text, p_bruto jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  d        jsonb := coalesce(p_bruto -> 'data', '{}'::jsonb);
  b        jsonb := coalesce(d -> 'buyer', d -> 'subscriber', '{}'::jsonb);
  pay      jsonb := coalesce(d #> '{purchase,payment}', '{}'::jsonb);
  v_tel    text;
  v_prox   record;
  v_motivo public.recuperacao_motivo%rowtype;
  v_status text;
  v_exp    timestamptz;
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
      and (status = 'ativo' or (status in ('esgotado', 'venceu') and criado_em > now() - interval '7 days'));
    get diagnostics n = row_count;
    return case when n > 0 then 'fechou ' || n else 'nada aberto' end;
  end if;

  -- ---------- o Pix venceu: fecha a do Pix e abre a de carrinho ----------
  if p_evento = 'PURCHASE_EXPIRED' then
    update public.recuperacao set status = 'venceu', fechado_em = now(), proximo_em = null
    where lower(email) = lower(p_email) and fluxo = 'pix' and status = 'ativo'
      and coalesce(produto, '') = coalesce(p_produto, '');
  end if;

  select * into v_motivo from public.recuperacao_motivo where evento = p_evento;
  if v_motivo.evento is null then return 'evento nao recupera'; end if;
  if not v_motivo.ativo then return 'motivo desligado no painel'; end if;

  if v_motivo.fluxo = 'renovacao' then
    -- renovacao so existe pra quem ja pagou alguma vez
    if not exists (select 1 from public.assinatura
                   where lower(email_compra) = lower(p_email)
                     and status in ('ativa', 'atrasada', 'cancelada', 'expirada')) then
      return 'atraso de quem nunca pagou';
    end if;
  elsif exists (select 1 from public.assinatura
                where lower(email_compra) = lower(p_email) and status = 'ativa'
                  and (p_produto is null or produto = p_produto)) then
    return 'ja e cliente';
  end if;

  -- uma sequencia por pessoa, produto e fluxo a cada 7 dias, pra
  -- ninguem virar alvo de spam por abandonar tres vezes
  if exists (select 1 from public.recuperacao
             where lower(email) = lower(p_email) and coalesce(produto, '') = coalesce(p_produto, '')
               and fluxo = v_motivo.fluxo and not teste and criado_em > now() - interval '7 days') then
    return 'ja tem sequencia recente';
  end if;

  v_tel := coalesce(
    public.telefone_br(b ->> 'phone'),
    public.telefone_br(b ->> 'checkout_phone', b ->> 'checkout_phone_code'),
    public.telefone_br(b #>> '{phone,cell}', b #>> '{phone,dddCell}')
  );

  if (pay ->> 'pix_expiration_date') ~ '^\d+$' then
    v_exp := to_timestamp((pay ->> 'pix_expiration_date')::numeric / 1000);
  end if;

  select * into v_prox from public.recuperacao_proxima_etapa(now(), 0, true, v_motivo.fluxo);

  v_status := case
    when v_tel is null then 'sem_telefone'
    when exists (select 1 from public.recuperacao_bloqueio where chave = public.telefone_chave(v_tel)) then 'bloqueado'
    when v_prox.ordem is null then 'esgotado'
    else 'ativo'
  end;

  insert into public.recuperacao (
    email, nome, nome_completo, telefone, produto, produto_nome, evento, fluxo, transacao, valor,
    origem, pix, expira_em, status, proximo_em
  ) values (
    lower(p_email),
    coalesce(nullif(b ->> 'first_name', ''), nullif(split_part(b ->> 'name', ' ', 1), '')),
    nullif(b ->> 'name', ''),
    v_tel, p_produto, coalesce(d #>> '{product,name}', d #>> '{subscription,product,name}'),
    p_evento, v_motivo.fluxo,
    d #>> '{purchase,transaction}', nullif(d #>> '{purchase,price,value}', '')::numeric,
    coalesce(nullif(d #>> '{purchase,origin,sck}', ''), nullif(d #>> '{purchase,origin,src}', '')),
    coalesce(nullif(pay ->> 'pix_code', ''), nullif(pay ->> 'billet_barcode', ''), nullif(pay ->> 'billet_digitable_line', '')),
    v_exp,
    v_status,
    case when v_status = 'ativo' then v_prox.quando end
  )
  on conflict do nothing;

  return case v_status
    when 'ativo' then 'sequencia aberta (' || v_motivo.fluxo || ')'
    when 'sem_telefone' then 'sem telefone'
    when 'bloqueado' then 'numero pediu pra sair'
    else v_status end;
end $$;

revoke all on function public.recuperacao_hotmart(text, text, text, jsonb) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 12. QUEM ESTA NA VEZ
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
  a       public.recuperacao_ajuste%rowtype;
  r       record;
  e       public.recuperacao_etapa%rowtype;
  v_prox  record;
  v_txt   text;
  v_dest  text;
  v_link  text;
  v_cod   text;
  v_base  text;
  v_hoje  int;
  v_hora  int := extract(hour from now() at time zone 'America/Sao_Paulo');
  v_id    bigint;
  v_id2   bigint;
begin
  update public.recuperacao_ajuste set ultimo_ciclo = now() where id = 1
  returning * into a;

  if not a.ligado then return; end if;
  if v_hora < a.hora_inicio or v_hora >= a.hora_fim then return; end if;

  select count(*) into v_hoje from public.recuperacao_envio ev
  where ev.tipo = 'recuperacao'
    and ev.criado_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
  if v_hoje >= a.limite_dia then return; end if;

  if to_regclass('public.vendas_ajuste') is not null then
    execute 'select nullif(rtrim(link_base, ''/''), '''') from public.vendas_ajuste where id = 1' into v_base;
  end if;

  for r in
    select rc.*, m.frase
    from public.recuperacao rc
    join public.recuperacao_motivo m on m.evento = rc.evento
    where rc.status = 'ativo' and rc.proximo_em <= now() and rc.telefone is not null
    order by rc.proximo_em
    limit p_limite
    for update of rc skip locked
  loop
    exit when v_hoje >= a.limite_dia;

    if exists (select 1 from public.recuperacao_bloqueio where chave = public.telefone_chave(r.telefone)) then
      update public.recuperacao set status = 'bloqueado', proximo_em = null, fechado_em = now() where id = r.id;
      continue;
    end if;

    if r.fluxo = 'pix' and r.expira_em is not null and r.expira_em < now() then
      update public.recuperacao set status = 'venceu', proximo_em = null, fechado_em = now() where id = r.id;
      continue;
    end if;

    select * into e from public.recuperacao_etapa
    where ativa and fluxo = r.fluxo and ordem > r.etapa order by ordem limit 1;

    if e.id is null then
      update public.recuperacao set status = 'esgotado', proximo_em = null, fechado_em = now() where id = r.id;
      continue;
    end if;

    v_dest := public.recuperacao_link(
      r.email, coalesce(r.nome_completo, r.nome), r.produto, r.fluxo, r.origem,
      case when e.texto like '%{cupom}%' then nullif(a.cupom, '') end
    );

    /* sem link de checkout a mensagem sairia quebrada: espera na
       fila ate o link ser preenchido na aba Links do painel */
    if v_dest is null and (e.texto like '%{link}%' or (e.texto like '%{pix}%' and r.pix is null)) then
      continue;
    end if;

    -- link curto: conta o clique e deixa trocar o destino depois
    v_cod := null;
    v_link := v_dest;
    if a.encurtar and v_base is not null and v_dest is not null
       and (e.texto like '%{link}%' or (e.texto like '%{pix}%' and r.pix is null)) then
      v_cod := substr(md5(random()::text || clock_timestamp()::text || r.id::text), 1, 10);
      v_link := v_base || '/r/' || v_cod;
    end if;

    v_txt := e.texto;
    v_txt := replace(v_txt, '{nome}',    coalesce(initcap(r.nome), ''));
    v_txt := replace(v_txt, '{produto}', coalesce(r.produto_nome, 'NeuroJitsu'));
    v_txt := replace(v_txt, '{link}',    coalesce(v_link, ''));
    v_txt := replace(v_txt, '{motivo}',  r.frase);
    v_txt := replace(v_txt, '{cupom}',   coalesce(a.cupom, ''));
    v_txt := replace(v_txt, '{pix}',     coalesce(r.pix, v_link, ''));
    -- sem nome, "Oi, !" vira "Oi!"
    v_txt := regexp_replace(v_txt, '\s*,\s*([!.?])', '\1', 'g');
    v_txt := regexp_replace(v_txt, '^\s*,\s*', '');

    /* o codigo do Pix sai sozinho numa segunda mensagem: no
       celular, segurar a mensagem copia ela inteira, e a pessoa
       precisa copiar so o codigo */
    v_id2 := null;
    if r.pix is not null and position(r.pix in v_txt) > 0 and length(trim(replace(v_txt, r.pix, ''))) > 0 then
      insert into public.recuperacao_envio (recuperacao_id, etapa, telefone, texto, tipo, codigo, destino)
      values (r.id, e.ordem, r.telefone, btrim(replace(v_txt, r.pix, ''), ' ' || chr(10) || chr(13)),
              'recuperacao', v_cod, v_dest)
      returning id into v_id;
      insert into public.recuperacao_envio (recuperacao_id, etapa, telefone, texto, tipo)
      values (r.id, e.ordem, r.telefone, r.pix, 'pix')
      returning id into v_id2;
    else
      insert into public.recuperacao_envio (recuperacao_id, etapa, telefone, texto, tipo, codigo, destino)
      values (r.id, e.ordem, r.telefone, v_txt, 'recuperacao', v_cod, v_dest)
      returning id into v_id;
    end if;

    select * into v_prox from public.recuperacao_proxima_etapa(r.criado_em, e.ordem, false, r.fluxo);

    update public.recuperacao
    set etapa = e.ordem,
        proximo_em = v_prox.quando,
        status = case when v_prox.ordem is null then 'esgotado' else 'ativo' end,
        fechado_em = case when v_prox.ordem is null then now() else null end
    where id = r.id;

    v_hoje := v_hoje + 1;
    select ev.id, ev.telefone, ev.texto into envio_id, telefone, texto from public.recuperacao_envio ev where ev.id = v_id;
    return next;
    if v_id2 is not null then
      envio_id := v_id2; telefone := r.telefone; texto := r.pix;
      return next;
    end if;
  end loop;
end $$;

revoke all on function public.recuperacao_proximas(int) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 13. COMO FOI O ENVIO
--
-- Falhou nao tenta de novo: melhor perder uma mensagem do que
-- mandar a mesma duas vezes. O erro fica no painel, e se varias
-- falharem seguidas voce recebe um alarme.
-- ------------------------------------------------------------
create or replace function public.recuperacao_resultado(p_envio bigint, p_ok boolean, p_erro text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.recuperacao_envio
  set status = case when p_ok then 'enviado' else 'falhou' end,
      erro = case when p_ok then null else left(p_erro, 500) end
  where id = p_envio;

  if not p_ok and (select count(*) from public.recuperacao_envio
                   where status = 'falhou' and criado_em > now() - interval '1 hour') >= 3 then
    perform public.avisar_uma_vez('alarmes', 'falha_envio',
      '⚠️ NeuroJitsu: 3 ou mais mensagens do WhatsApp falharam na última hora. Confira se a instância do Evolution Go está conectada.',
      interval '3 hours');
  end if;
end $$;

revoke all on function public.recuperacao_resultado(bigint, boolean, text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 14. CHEGOU MENSAGEM NO WHATSAPP
--
-- So conta quem esta numa sequencia (recebeu alguma mensagem
-- nos ultimos 14 dias). Mensagem pessoal que chega no mesmo
-- numero passa reto e nunca vira aviso.
--
-- "sair", "parar", "nao quero" e parecidos, em mensagem curta,
-- bloqueiam o numero pra sempre e a pessoa recebe a confirmacao.
-- Qualquer outra resposta para a sequencia e vira lead quente.
-- ------------------------------------------------------------
create or replace function public.recuperacao_chegou(p_jid text, p_texto text default null, p_nome text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  n      text := regexp_replace(split_part(split_part(coalesce(p_jid, ''), '@', 1), ':', 1), '\D', '', 'g');
  k      text;
  r      record;
  t      text := nullif(trim(coalesce(p_texto, '')), '');
  limpo  text;
  c      int;
begin
  if length(n) < 12 then return 'numero ilegivel'; end if;
  k := public.telefone_chave(n);

  select rc.* into r from public.recuperacao rc
  where public.telefone_chave(rc.telefone) = k and rc.etapa > 0
    and rc.criado_em > now() - interval '14 days'
  order by rc.id desc limit 1;

  if r.id is null then return 'nao e de recuperacao'; end if;

  insert into public.recuperacao_resposta (recuperacao_id, telefone, texto) values (r.id, n, t);

  limpo := translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');

  if length(limpo) <= 60 and limpo ~ '(^|[^a-z])(sair|parar|pare|para de mandar|stop|cancelar|descadastrar|remover|nao quero|nao me mande|me tira)([^a-z]|$)' then
    insert into public.recuperacao_bloqueio (chave, telefone, motivo)
    values (k, r.telefone, 'pediu pra sair: ' || left(t, 80))
    on conflict (chave) do nothing;

    update public.recuperacao set status = 'bloqueado', proximo_em = null, fechado_em = now(),
      resposta = t, respondeu_em = now()
    where public.telefone_chave(telefone) = k and status = 'ativo';

    perform public.responder_para(r.telefone, 'Pronto, não te mando mais mensagens. Se um dia precisar, é só chamar aqui.');
    return 'bloqueou';
  end if;

  update public.recuperacao set status = 'respondeu', proximo_em = null, fechado_em = now()
  where public.telefone_chave(telefone) = k and status = 'ativo';
  get diagnostics c = row_count;

  update public.recuperacao set resposta = t, respondeu_em = now() where id = r.id;

  perform public.avisar_uma_vez('leads', 'lead:' || k,
    '🔥 Lead quente no NeuroJitsu' || chr(10) || chr(10)
    || coalesce(initcap(coalesce(r.nome_completo, r.nome)), 'Alguém') || ' respondeu a recuperação'
    || coalesce(' (' || r.produto_nome || ')', '') || ':' || chr(10)
    || '"' || coalesce(left(t, 300), '[mídia]') || '"' || chr(10) || chr(10)
    || 'Responder: https://wa.me/' || r.telefone,
    interval '10 minutes');

  return case when c > 0 then 'parou ' || c || ' e avisou' else 'avisou' end;
end $$;

revoke all on function public.recuperacao_chegou(text, text, text) from public, anon, authenticated;

-- a versao antiga, que o fluxo do n8n de antes ainda chama
create or replace function public.recuperacao_resposta(p_jid text)
returns text language sql security definer set search_path = public as $$
  select public.recuperacao_chegou(p_jid, null, null);
$$;

revoke all on function public.recuperacao_resposta(text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 15. O TESTE
--
-- Coloca o seu numero na fila, no fluxo que voce escolher. Sai
-- no proximo ciclo do n8n, com o texto de agora. Nao entra nos
-- numeros do painel.
-- ------------------------------------------------------------
drop function if exists public.recuperacao_teste(text, text);

create or replace function public.recuperacao_teste(p_telefone text, p_nome text default 'Teste', p_fluxo text default 'carrinho')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_tel text := public.telefone_br(p_telefone);
  v_ev  text;
begin
  if not public.sou_admin() then raise exception 'so o administrador'; end if;
  if v_tel is null then return 'numero invalido, use DDD + numero'; end if;

  select evento into v_ev from public.recuperacao_motivo where fluxo = p_fluxo order by evento limit 1;
  if v_ev is null then return 'fluxo desconhecido'; end if;

  update public.recuperacao set status = 'parado', proximo_em = null
  where teste and status = 'ativo';

  insert into public.recuperacao (email, nome, nome_completo, telefone, produto_nome, evento, fluxo, pix, status, proximo_em, teste)
  values ('teste@teste.com', p_nome, p_nome, v_tel, 'NeuroJitsu', v_ev, p_fluxo,
          case when p_fluxo = 'pix' then '00020101021226900014br.gov.bcb.pix-ESTE-E-UM-CODIGO-DE-TESTE' end,
          'ativo', now(), true);
  return 'na fila';
end $$;

grant execute on function public.recuperacao_teste(text, text, text) to authenticated;


-- ------------------------------------------------------------
-- 16. OS NUMEROS DO PAINEL
-- ------------------------------------------------------------
drop function if exists public.recuperacao_numeros(int);

create or replace function public.recuperacao_numeros(p_dias int default 30, p_fluxo text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  desde timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
                       - make_interval(days => p_dias - 1);
  res   jsonb;
begin
  if not public.sou_admin() then raise exception 'so o administrador'; end if;

  with r as (
    select * from public.recuperacao
    where criado_em >= desde and not teste and (p_fluxo is null or fluxo = p_fluxo)
  ), env as (
    select ev.* from public.recuperacao_envio ev join r on r.id = ev.recuperacao_id
    where ev.tipo = 'recuperacao'
  )
  select jsonb_build_object(
    'carrinhos',      (select count(*) from r),
    'com_telefone',   (select count(*) from r where telefone is not null),
    'contatados',     (select count(*) from r where etapa > 0),
    'clicaram',       (select count(*) from r where clicou_em is not null),
    'recuperados',    (select count(*) from r where status = 'recuperado'),
    'sozinhos',       (select count(*) from r where status = 'comprou_sozinho'),
    'responderam',    (select count(*) from r where status = 'respondeu' or respondeu_em is not null),
    'bloqueados',     (select count(*) from r where status = 'bloqueado'),
    'na_fila',        (select count(*) from public.recuperacao where status = 'ativo' and not teste),
    'receita',        (select coalesce(sum(valor_recuperado), 0) from r where status = 'recuperado'),
    'enviadas',       (select count(*) from env where status = 'enviado'),
    'falharam',       (select count(*) from env where status = 'falhou'),
    'hoje',           (select count(*) from public.recuperacao_envio
                       where tipo = 'recuperacao'
                         and criado_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')),
    'por_etapa', coalesce((
      select jsonb_agg(jsonb_build_object('fluxo', fluxo, 'etapa', etapa, 'enviadas', q) order by fluxo, etapa)
      from (select r.fluxo, env.etapa, count(*) q from env join r on r.id = env.recuperacao_id
            where env.status = 'enviado' group by r.fluxo, env.etapa) x), '[]'::jsonb),
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

grant execute on function public.recuperacao_numeros(int, text) to authenticated;


-- ------------------------------------------------------------
-- 17. CONFERIR
--
-- select id, email, telefone, fluxo, status, etapa, proximo_em from public.recuperacao order by id desc;
-- select * from public.recuperacao_envio order by id desc limit 20;
-- select * from public.recuperacao_bloqueio;
-- ------------------------------------------------------------
