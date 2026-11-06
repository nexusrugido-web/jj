-- 54: SIMULAÇÃO DO REPARO DAS RELAÇÕES (S4), SÓ LEITURA
--
-- Não grava nada: é um select. Não mostra nome de ninguém, só números.
--
-- O reparo roda em cada aparelho e só corrige com prova. Aqui a gente
-- vê, nos dados da nuvem, quantos registros TÊM prova e quantos não:
--   com_prova     o reparo consegue conferir e, se estiver errado, corrigir
--   varios        mais de um candidato: se o atual não bater, fica incerto
--   sem_prova     nada para conferir: fica como está (incerto)
-- Quem usou um aparelho só não tem nada errado: no aparelho, esses
-- registros dão "conferido" e nada muda.
--
-- Cole no SQL Editor do Supabase e rode.

with
treinos_dia as (
  select user_id, dados->>'data' as data, count(*) as n
  from public.registros
  where tabela = 'sessions' and deleted_at is null
  group by 1, 2
),
rolas as (
  select r.user_id, r.dados, t.n
  from public.registros r
  left join treinos_dia t on t.user_id = r.user_id and t.data = r.dados->>'data'
  where r.tabela = 'rolls' and r.deleted_at is null and r.dados ? 'sessionId'
),
treinos as (
  select dados from public.registros where tabela = 'sessions' and deleted_at is null
),
foco as (
  select f from treinos, jsonb_array_elements(case when jsonb_typeof(dados->'focoTecnicas') = 'array' then dados->'focoTecnicas' else '[]'::jsonb end) f
  where f ? 'tecnicaId' and f->>'tecnicaId' is not null
),
pontos as (
  select p.dados, t.n
  from public.registros p
  left join treinos_dia t on t.user_id = p.user_id and t.data = p.dados->>'data'
  where p.tabela = 'pontos' and p.deleted_at is null and p.dados->>'refId' ~ '^(treino|competicao|rola):[0-9]+'
)
select 'rola → treino (pela data)' as o_que, count(*) as total,
       count(*) filter (where n = 1) as com_prova, count(*) filter (where n > 1) as varios, count(*) filter (where n is null) as sem_prova
from rolas
union all
select 'rola → parceiro', count(*), 0, 0, count(*) from rolas where dados->>'partnerId' is not null
union all
select 'treino → academia (pelo nome)', count(*),
       count(*) filter (where coalesce(trim(dados->>'academia'), '') <> ''), 0,
       count(*) filter (where coalesce(trim(dados->>'academia'), '') = '')
from treinos where dados->>'academiaId' is not null
union all
select 'treino → professor (pelo nome)', count(*),
       count(*) filter (where coalesce(trim(dados->>'professor'), '') <> ''), 0,
       count(*) filter (where coalesce(trim(dados->>'professor'), '') = '')
from treinos where dados->>'professorId' is not null
union all
select 'treino → técnica do foco (pelo nome)', count(*),
       count(*) filter (where coalesce(f->>'nome', '') <> ''), 0,
       count(*) filter (where coalesce(f->>'nome', '') = '')
from foco
union all
select 'ponto → treino (pela data)', count(*),
       count(*) filter (where n = 1), count(*) filter (where n > 1), count(*) filter (where n is null)
from pontos
union all
select 'contas com rola', count(distinct user_id), 0, 0, 0 from rolas;
