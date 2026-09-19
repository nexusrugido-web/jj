-- ============================================================
-- TATAME OS, O ACERVO QUE CHEGA NO ALUNO
--
--   o que o video ensina        cada video ganha a posicao com o
--                               lado, as habilidades, as tecnicas,
--                               o formato e o nivel, no mesmo
--                               vocabulario do rola e da biblioteca
--                               (src/lib/vocab.js). O que ja existia
--                               e convertido uma vez, marcado como
--                               "legado", e o painel mostra o que
--                               ainda falta conferir.
--
--   tirar do ar passa a tirar   a diferenca que desce pro aparelho
--                               inclui os que sairam, com ativo =
--                               false, e o app remove.
--
--   so o que e publico desce    vai so o que o app usa pra mostrar
--                               e recomendar o video.
--
--   o que o YouTube diz         descricao, etiquetas e se o video
--                               ainda existe e toca dentro do app,
--                               buscados pelo painel com uma chave
--                               que so a conta de administrador le.
--
-- Rode no SQL Editor do Supabase, depois de vendas.sql.
-- Pode rodar de novo: nada aqui apaga dado.
-- ============================================================


-- ------------------------------------------------------------
-- 1. O QUE CADA VIDEO ENSINA
--
-- posicao_lado   'cem:baixo', 'guarda_fechada:cima'... O lado e o
--                de quem assiste: "cem:baixo" ensina quem esta
--                embaixo do 100kg.
-- habilidades    as categorias da biblioteca de tecnicas, mais
--                controle, finalizacao e fisico
-- tecnicas       o uid estavel da tecnica na biblioteca, o mesmo
--                em todo aparelho
-- situacoes      a situacao de quem assiste (perdido no rola,
--                contra mais pesado...), tirada do formulario de
--                entrada dos alunos
-- classificacao  legado      so as categorias antigas ou o titulo;
--                            a IA ainda nao passou
--                automatica  a IA classificou e os sinais concordam
--                revisar     a IA ficou em duvida ou discordou do
--                            que ja existia; o motivo fica ao lado
--                revisada    alguem conferiu; nada automatico mexe
--
-- As listas abaixo sao as mesmas de src/lib/vocab.js, e o
-- teste-vocab confere uma contra a outra.
-- ------------------------------------------------------------
alter table public.aula add column if not exists posicao_lado    text[] not null default '{}';
alter table public.aula add column if not exists habilidades     text[] not null default '{}';
alter table public.aula add column if not exists tecnicas        text[] not null default '{}';
alter table public.aula add column if not exists formato         text;
alter table public.aula add column if not exists nivel           text;
alter table public.aula add column if not exists classificacao   text not null default 'legado';
alter table public.aula add column if not exists situacoes       text[] not null default '{}';
alter table public.aula add column if not exists classificado_em timestamptz;
alter table public.aula add column if not exists classificacao_motivo text;
alter table public.aula add column if not exists yt_descricao    text;
alter table public.aula add column if not exists yt_tags         text[];
alter table public.aula add column if not exists yt_status       text;

alter table public.aula drop constraint if exists aula_posicao_lado_valida;
alter table public.aula add constraint aula_posicao_lado_valida check (posicao_lado <@ array[
    'em_pe:cima', 'em_pe:baixo', 'em_pe:neutro',
    'guarda_fechada:cima', 'guarda_fechada:baixo', 'guarda_fechada:neutro',
    'guarda_aberta:cima', 'guarda_aberta:baixo', 'guarda_aberta:neutro',
    'meia_guarda:cima', 'meia_guarda:baixo', 'meia_guarda:neutro',
    'perna:cima', 'perna:baixo', 'perna:neutro',
    'tartaruga:cima', 'tartaruga:baixo', 'tartaruga:neutro',
    'cem:cima', 'cem:baixo', 'cem:neutro',
    'norte_sul:cima', 'norte_sul:baixo', 'norte_sul:neutro',
    'joelho_barriga:cima', 'joelho_barriga:baixo', 'joelho_barriga:neutro',
    'montada:cima', 'montada:baixo', 'montada:neutro',
    'costas:cima', 'costas:baixo', 'costas:neutro'
  ]::text[]);

alter table public.aula drop constraint if exists aula_habilidades_validas;
alter table public.aula add constraint aula_habilidades_validas check (habilidades <@ array[
    'queda', 'passagem', 'raspagem', 'guarda', 'retencao', 'controle',
    'transicao', 'pegada', 'base', 'escapada', 'defesa', 'finalizacao',
    'estrangulamento', 'articular', 'perna', 'fisico'
  ]::text[]);

alter table public.aula drop constraint if exists aula_situacoes_validas;
alter table public.aula add constraint aula_situacoes_validas check (situacoes <@ array[
    'perdido_no_rola', 'contra_pesado', 'menos_forca', 'sem_gas', 'esquece_tecnica', 'competir'
  ]::text[]);

alter table public.aula drop constraint if exists aula_formato_valido;
alter table public.aula add constraint aula_formato_valido
  check (formato is null or formato = any (array['conceito', 'tecnica', 'drill', 'analise', 'mentalidade']));

alter table public.aula drop constraint if exists aula_nivel_valido;
alter table public.aula add constraint aula_nivel_valido
  check (nivel is null or nivel = any (array['fundamento', 'intermediario', 'avancado']));

alter table public.aula drop constraint if exists aula_classificacao_valida;
alter table public.aula add constraint aula_classificacao_valida
  check (classificacao = any (array['legado', 'automatica', 'revisar', 'revisada']));

-- ok        existe e toca dentro do app
-- sumiu     o YouTube nao devolve mais (apagado ou privado)
-- sem_embed existe, mas o dono proibiu tocar fora do YouTube
alter table public.aula drop constraint if exists aula_yt_status_valido;
alter table public.aula add constraint aula_yt_status_valido
  check (yt_status is null or yt_status = any (array['ok', 'sumiu', 'sem_embed']));

create index if not exists aula_posicao_lado on public.aula using gin (posicao_lado);
create index if not exists aula_habilidades  on public.aula using gin (habilidades);


-- ------------------------------------------------------------
-- 2. A DATA DE ATUALIZACAO SO ANDA QUANDO O ALUNO VE DIFERENCA
--
-- E por ela que o aparelho sabe o que baixar de novo. Buscar a
-- descricao no YouTube pros 680 videos nao muda nada do que o
-- aluno ve, e nao pode fazer todo aparelho baixar tudo de novo.
-- (Substitui a de aulas.sql.)
-- ------------------------------------------------------------
create or replace function public.tocar_aula()
returns trigger language plpgsql set search_path = public as $$
declare
  so_admin text[] := array['yt_descricao', 'yt_tags', 'yt_status', 'atualizado_em'];
begin
  if (to_jsonb(new) - so_admin) is distinct from (to_jsonb(old) - so_admin) then
    new.atualizado_em := now();
  else
    new.atualizado_em := old.atualizado_em;
  end if;
  return new;
end $$;


-- ------------------------------------------------------------
-- 3. A CONVERSAO DO QUE JA EXISTIA
--
-- A mesma conta de doLegado() em src/lib/vocab.js. So mexe no que
-- ainda e "legado": o que alguem ja conferiu nao volta atras.
-- Rodar de novo recalcula o legado, e isso e de proposito: video
-- cadastrado pelo caminho antigo entra convertido.
-- ------------------------------------------------------------
update public.aula a set
  posicao_lado = array(
    select distinct m.novo || ':neutro'
    from unnest(a.posicoes) p
    join (values ('cem_quilos', 'cem'), ('guarda_fechada', 'guarda_fechada'),
                 ('meia_guarda', 'meia_guarda'), ('guarda_aberta', 'guarda_aberta'),
                 ('costas', 'costas'), ('montada', 'montada'), ('norte_sul', 'norte_sul'),
                 ('perna', 'perna'), ('em_pe', 'em_pe')) m(velho, novo) on m.velho = p
    order by 1
  ),
  habilidades = array(
    select distinct m.novo
    from unnest(a.temas) t
    join (values ('guarda', 'guarda'), ('controle', 'controle'), ('finalizacao', 'finalizacao'),
                 ('defesa', 'escapada'), ('defesa', 'defesa'), ('queda', 'queda'),
                 ('passagem', 'passagem'), ('raspagem', 'raspagem'), ('fisico', 'fisico')) m(velho, novo)
      on m.velho = t
    order by 1
  ),
  formato = case when 'logica' = any (a.temas) then 'conceito'
                 when 'drill'  = any (a.temas) then 'drill' end,
  nivel = case a.faixa when 'branca' then 'fundamento'
                       when 'azul'   then 'intermediario'
                       when 'roxa'   then 'avancado'
                       when 'marrom' then 'avancado'
                       when 'preta'  then 'avancado' end
where a.classificacao = 'legado';


-- ------------------------------------------------------------
-- 4. O QUE MUDOU DESDE A ULTIMA VEZ
--
-- Sem data (primeira carga): so os videos no ar, e o app troca a
-- lista inteira por esta.
-- Com data: tudo que mudou depois dela, no ar ou nao. O que vier
-- com ativo = false sai do aparelho.
-- ------------------------------------------------------------
drop function if exists public.acervo_desde(timestamptz);

create or replace function public.acervo_desde(p_desde timestamptz default null)
returns table (
  id            text,
  titulo        text,
  duracao       int,
  tipo          text,
  temas         text[],
  posicoes      text[],
  faixa         text,
  acesso        text,
  destaque      boolean,
  ordem         int,
  descricao     text,
  capa_url      text,
  checkout_url  text,
  posicao_lado  text[],
  habilidades   text[],
  tecnicas      text[],
  situacoes     text[],
  formato       text,
  nivel         text,
  classificacao text,
  ativo         boolean,
  atualizado_em timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, a.titulo, a.duracao, a.tipo, a.temas, a.posicoes, a.faixa,
         a.acesso, a.destaque, a.ordem, a.descricao, a.capa_url, a.checkout_url,
         a.posicao_lado, a.habilidades, a.tecnicas, a.situacoes, a.formato, a.nivel, a.classificacao,
         a.ativo, a.atualizado_em
  from public.aula a
  where (p_desde is null and a.ativo)
     or (p_desde is not null and a.atualizado_em > p_desde)
  order by a.atualizado_em;
$$;

grant execute on function public.acervo_desde(timestamptz) to anon, authenticated;


-- ------------------------------------------------------------
-- 5. O QUE O VISITANTE SEM CONTA CONSEGUE LER DIRETO NA TABELA
--
-- A leitura publica (regra aula_leitura) continua, mas so nas
-- colunas que o app mostra. Etiqueta, produto da Hotmart e o
-- marcador de revisar ficam pra conta logada.
-- ------------------------------------------------------------
revoke select on public.aula from anon;
grant select (
  id, titulo, duracao, tipo, temas, posicoes, faixa, acesso, destaque, ordem,
  descricao, capa_url, checkout_url, ativo, curso_id, criado_em, atualizado_em
) on public.aula to anon;


-- ------------------------------------------------------------
-- 6. A CHAVE DO YOUTUBE
--
-- O painel busca titulo, duracao e descricao direto do YouTube,
-- do navegador de quem administra. A chave fica aqui, e so a
-- conta de administrador consegue ler. Nao vai pro codigo nem
-- pra Vercel.
-- ------------------------------------------------------------
create table if not exists public.admin_segredo (
  nome  text primary key,
  valor text not null
);

alter table public.admin_segredo enable row level security;
revoke all on public.admin_segredo from anon, authenticated;

create or replace function public.segredo_admin(p_nome text)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not public.sou_admin() then
    raise exception 'so administrador';
  end if;
  return (select valor from public.admin_segredo where nome = p_nome);
end $$;

revoke execute on function public.segredo_admin(text) from public, anon;
grant execute on function public.segredo_admin(text) to authenticated;

-- A chave entra uma vez (o arquivo de colar ja vem com ela):
--
-- insert into public.admin_segredo (nome, valor) values ('youtube', 'AIza...')
--   on conflict (nome) do update set valor = excluded.valor;


-- ------------------------------------------------------------
-- 7. O QUE O YOUTUBE DISSE, DE UMA VEZ
--
-- O painel manda de 50 em 50: [{ id, descricao, tags, status }].
-- Uma chamada por lote em vez de uma por video.
-- ------------------------------------------------------------
create or replace function public.aula_youtube(p_lote jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not public.sou_admin() then
    raise exception 'so administrador';
  end if;

  update public.aula a set
    yt_descricao = nullif(x->>'descricao', ''),
    yt_tags = case when jsonb_typeof(x->'tags') = 'array'
                   then array(select jsonb_array_elements_text(x->'tags')) end,
    yt_status = x->>'status'
  from jsonb_array_elements(p_lote) x
  where a.id = x->>'id';

  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.aula_youtube(jsonb) from public, anon;
grant execute on function public.aula_youtube(jsonb) to authenticated;


-- ------------------------------------------------------------
-- 8. CONFERIR
--
-- select classificacao, count(*) from public.aula group by 1;
-- select yt_status, count(*) from public.aula group by 1;
-- select count(*), count(*) filter (where not ativo) from public.acervo_desde('2000-01-01');
-- ------------------------------------------------------------
