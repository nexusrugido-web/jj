-- ============================================================
-- VÍDEO EM PÉ OU DEITADO
--
-- Colar DEPOIS do 22. Pode rodar de novo sem estragar.
--
-- O player deitava todo vídeo em tela cheia, menos o que estava
-- marcado como aula rápida. Mas tem aula longa gravada em pé (a
-- lógica da norte-sul, 3:53), e ela virava uma tira no meio da
-- tela deitada. Agora cada vídeo sabe se é vertical: a esteira do
-- painel pergunta ao YouTube o tamanho do player (a proporção real
-- do vídeo) e grava aqui. Quem administra abre o Acervo uma vez e
-- os 680 se completam sozinhos (umas 14 perguntas ao YouTube).
--
-- Mudar "vertical" faz os aparelhos baixarem o vídeo de novo
-- (tocar_aula só ignora o que é do YouTube e o atualizado_em).
-- ============================================================

alter table public.aula add column if not exists vertical boolean;


-- ------------------------------------------------------------
-- O que o YouTube diz, gravado. Igual ao de estudo.sql, e agora
-- com a proporção. Sem ela no lote, fica a que já estava.
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
    yt_status = x->>'status',
    vertical = coalesce((x->>'vertical')::boolean, a.vertical)
  from jsonb_array_elements(p_lote) x
  where a.id = x->>'id';

  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.aula_youtube(jsonb) from public, anon;
grant execute on function public.aula_youtube(jsonb) to authenticated;


-- ------------------------------------------------------------
-- O acervo que o aparelho baixa, igual ao de estudo.sql, com a
-- proporção no fim.
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
  atualizado_em timestamptz,
  vertical      boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.titulo, a.duracao, a.tipo, a.temas, a.posicoes, a.faixa,
         a.acesso, a.destaque, a.ordem, a.descricao, a.capa_url, a.checkout_url,
         a.posicao_lado, a.habilidades, a.tecnicas, a.situacoes, a.formato, a.nivel, a.classificacao,
         a.ativo, a.atualizado_em, a.vertical
  from public.aula a
  where (p_desde is null and a.ativo)
     or (p_desde is not null and a.atualizado_em > p_desde)
  order by a.atualizado_em;
$$;

grant execute on function public.acervo_desde(timestamptz) to anon, authenticated;

grant select (vertical) on public.aula to anon;


-- ------------------------------------------------------------
-- CONFERIR (depois de abrir o Acervo no painel)
--
-- select vertical, count(*) from public.aula group by 1;
-- ------------------------------------------------------------
