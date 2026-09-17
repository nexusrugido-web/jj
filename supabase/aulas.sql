-- ============================================================
-- TATAME OS, ACERVO DE AULAS
--
-- O acervo morava dentro do codigo, num arquivo de 680 linhas.
-- Cada video novo era um deploy. Aqui ele vira tabela: voce
-- cadastra pelo painel e vale na proxima vez que o app abrir.
--
-- Duas coisas so existem aqui e nao existiam no codigo:
--   premium por video, pra vender aula avulsa
--   link de checkout por video, porque preco e produto mudam
--
-- O app continua funcionando sem rede: ele guarda o acervo no
-- aparelho e so vai buscar o que mudou.
--
-- Rode no SQL Editor do Supabase, depois de xp.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. AJUSTE DE TEXTO
--
-- A tabela ajuste guardava so numero. O link da assinatura e
-- texto, e e um ajuste igual aos outros: voce troca quando o
-- produto na Hotmart mudar, sem deploy.
-- ------------------------------------------------------------
alter table public.ajuste add column if not exists texto text;
alter table public.ajuste alter column valor drop not null;

insert into public.ajuste (id, nome, descricao, valor, texto, grupo) values
  ('link_assinatura', 'Link da assinatura',
   'Para onde vai quem esta no plano gratuito e esbarrou num video pago.',
   null, null, 'venda')
on conflict (id) do nothing;

create or replace function public.ajuste_txt(p_id text)
returns text language sql stable set search_path = public as $$
  select texto from public.ajuste where id = p_id;
$$;


-- ------------------------------------------------------------
-- 2. O ACERVO
--
-- O id e o do YouTube, entao cadastrar o mesmo video duas vezes
-- nao cria linha repetida. Era assim que 109 shorts tinham
-- entrado duplicados no arquivo antigo.
-- ------------------------------------------------------------
create table if not exists public.aula (
  id            text primary key,              -- id do video no YouTube
  titulo        text not null,
  duracao       int  not null check (duracao > 0),
  tipo          text not null check (tipo in ('aula', 'short')),
  temas         text[] not null default '{}',
  posicoes      text[] not null default '{}',
  faixa         text,
  premium       boolean not null default false,
  checkout_url  text,                          -- compra avulsa deste video
  ativo         boolean not null default true,
  revisar       boolean not null default false, -- o titulo nao bateu com nenhuma categoria
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists aula_ativo on public.aula (ativo) where ativo;
create index if not exists aula_tipo  on public.aula (tipo);
create index if not exists aula_temas on public.aula using gin (temas);

alter table public.aula enable row level security;

-- todo mundo le o acervo, inclusive quem ainda nao entrou
drop policy if exists aula_leitura on public.aula;
create policy aula_leitura on public.aula
  for select to anon, authenticated using (ativo);

drop policy if exists aula_escrita on public.aula;
create policy aula_escrita on public.aula
  for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());


-- ------------------------------------------------------------
-- 3. O QUE MUDOU DESDE A ULTIMA VEZ
--
-- O app guarda o acervo no aparelho. Em vez de baixar 680 linhas
-- toda abertura, ele pergunta o que mudou depois de tal data.
-- ------------------------------------------------------------
create or replace function public.acervo_desde(p_desde timestamptz default null)
returns setof public.aula
language sql stable set search_path = public as $$
  select * from public.aula
  where ativo and (p_desde is null or atualizado_em > p_desde)
  order by atualizado_em;
$$;

grant execute on function public.acervo_desde(timestamptz) to anon, authenticated;


-- ------------------------------------------------------------
-- 4. A DATA DE ATUALIZACAO SE CUIDA SOZINHA
-- ------------------------------------------------------------
create or replace function public.tocar_aula()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists tg_tocar_aula on public.aula;
create trigger tg_tocar_aula before update on public.aula
  for each row execute function public.tocar_aula();


-- ------------------------------------------------------------
-- 5. CONFERIR
--
-- select count(*), tipo from public.aula group by tipo;
-- select count(*) from public.aula where revisar;
-- select count(*) from public.aula where premium;
-- select * from public.ajuste where grupo = 'venda';
-- ------------------------------------------------------------
