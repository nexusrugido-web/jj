-- ============================================================
-- TATAME OS, O ACERVO QUE CHEGA NO ALUNO
--
-- Duas correcoes na porta por onde o acervo desce pro aparelho:
--
--   tirar do ar passa a tirar   antes a funcao so devolvia video
--                               ativo, entao o aparelho nunca ficava
--                               sabendo que um video saiu. Agora a
--                               diferenca inclui os que sairam, com
--                               ativo = false, e o app remove.
--
--   so o que e publico desce    antes ia a linha inteira, com as
--                               etiquetas internas e o produto da
--                               Hotmart. Agora vai so o que o app
--                               usa pra mostrar o video.
--
-- Rode no SQL Editor do Supabase, depois de vendas.sql.
-- Pode rodar de novo: nada aqui apaga dado.
-- ============================================================


-- ------------------------------------------------------------
-- 1. O QUE MUDOU DESDE A ULTIMA VEZ
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
  ativo         boolean,
  atualizado_em timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, a.titulo, a.duracao, a.tipo, a.temas, a.posicoes, a.faixa,
         a.acesso, a.destaque, a.ordem, a.descricao, a.capa_url, a.checkout_url,
         a.ativo, a.atualizado_em
  from public.aula a
  where (p_desde is null and a.ativo)
     or (p_desde is not null and a.atualizado_em > p_desde)
  order by a.atualizado_em;
$$;

grant execute on function public.acervo_desde(timestamptz) to anon, authenticated;


-- ------------------------------------------------------------
-- 2. O QUE O VISITANTE SEM CONTA CONSEGUE LER DIRETO NA TABELA
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
-- 3. CONFERIR
--
-- select count(*), count(*) filter (where not ativo) from public.acervo_desde('2000-01-01');
-- ------------------------------------------------------------
