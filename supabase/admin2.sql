-- ============================================================
-- TATAME OS, O ACERVO COM CARA DE ADMINISTRACAO
--
-- O problema que isto resolve: olhando a lista de videos, nao
-- dava pra saber de quem era cada um. Se e gratuito, se e pago,
-- se pertence a um curso, quem consegue abrir. Tudo isso estava
-- num booleano premium e no resto da imaginacao.
--
-- A mudanca principal e trocar esse booleano por uma coluna que
-- diz de quem o video e:
--
--   todos       qualquer conta abre, dentro do limite do dia
--   assinantes  so quem assina, e nao vende separado
--   avulso      vendido a parte, com checkout proprio
--
-- Rode no SQL Editor do Supabase, depois de destaque.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. DE QUEM E O VIDEO
-- ------------------------------------------------------------
alter table public.aula add column if not exists acesso text not null default 'todos';

update public.aula
set acesso = case when premium then 'avulso' else 'todos' end
where acesso = 'todos';

alter table public.aula drop constraint if exists aula_acesso_valido;
alter table public.aula add constraint aula_acesso_valido
  check (acesso in ('todos', 'assinantes', 'avulso'));

create index if not exists aula_acesso on public.aula (acesso);

/* o booleano sai de cena: quem manda agora e a coluna acesso, e
   deixar os dois vivos criaria duas verdades sobre o mesmo video */
alter table public.aula drop column if exists premium;


-- ------------------------------------------------------------
-- 2. O QUE FALTAVA PRA ADMINISTRAR DE VERDADE
-- ------------------------------------------------------------
alter table public.aula add column if not exists descricao text;
alter table public.aula add column if not exists capa_url text;
alter table public.aula add column if not exists ordem int;
alter table public.aula add column if not exists tags text[] not null default '{}';

comment on column public.aula.capa_url is
  'Miniatura propria. Vazio significa usar a do YouTube.';
comment on column public.aula.ordem is
  'Menor aparece primeiro. Vazio deixa o app ordenar como sempre.';
comment on column public.aula.tags is
  'Etiqueta livre do administrador, separada das categorias do app.';

create index if not exists aula_ordem on public.aula (ordem) where ordem is not null;


-- ------------------------------------------------------------
-- 3. O GANCHO PRO CURSO
--
-- A tabela do curso em si ainda nao existe. A coluna entra agora
-- pra o cadastro de video nao precisar mudar de novo depois, e
-- fica nula ate o curso existir.
-- ------------------------------------------------------------
alter table public.aula add column if not exists curso_id bigint;

comment on column public.aula.curso_id is
  'A qual curso este video pertence. Nulo significa video solto no acervo.';

create index if not exists aula_curso on public.aula (curso_id) where curso_id is not null;


-- ------------------------------------------------------------
-- 4. QUEM SAO AS CONTAS
--
-- O painel precisa de uma lista de gente, e essa lista mistura
-- coisa de tres tabelas mais o auth. Sai por funcao, com a
-- checagem de administrador dentro, porque e a unica tela do app
-- que tem motivo pra ver conta de outra pessoa.
-- ------------------------------------------------------------
create or replace function public.contas_do_app(p_busca text default null, p_limite int default 100)
returns table (
  user_id        uuid,
  email          text,
  nome           text,
  faixa          text,
  graus          int,
  treinos_semana int,
  na_liga        boolean,
  divisao        text,
  total_xp       int,
  xp_semana      int,
  assinatura     text,
  vence_em       timestamptz,
  compras        bigint,
  criado_em      timestamptz,
  ultimo_ponto   date
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_admin() then
    raise exception 'so administrador';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.nome, 'Praticante'),
    coalesce(p.faixa, 'branca'),
    coalesce(p.graus, 0),
    p.treinos_semana,
    coalesce(p.participa_liga, false),
    t.divisao,
    coalesce(t.total, 0),
    coalesce(t.xp_semana, 0),
    (select a.status from public.assinatura a
      where a.user_id = u.id order by (a.status = 'ativa') desc, a.vence_em desc nulls last limit 1),
    (select a.vence_em from public.assinatura a
      where a.user_id = u.id order by (a.status = 'ativa') desc, a.vence_em desc nulls last limit 1),
    (select count(*) from public.compra_aula ca where ca.user_id = u.id),
    u.created_at,
    (select max(pt.data) from public.pontos pt where pt.user_id = u.id)
  from auth.users u
  left join public.perfil p on p.user_id = u.id
  left join public.total_xp t on t.user_id = u.id
  where p_busca is null
     or u.email ilike '%' || p_busca || '%'
     or coalesce(p.nome, '') ilike '%' || p_busca || '%'
  order by u.created_at desc
  limit greatest(1, least(coalesce(p_limite, 100), 500));
end $$;

grant execute on function public.contas_do_app(text, int) to authenticated;


-- ------------------------------------------------------------
-- 5. CONFERIR
--
-- select acesso, count(*) from public.aula group by acesso;
-- select * from public.contas_do_app();
-- ------------------------------------------------------------
