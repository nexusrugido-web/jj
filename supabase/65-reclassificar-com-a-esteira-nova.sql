-- ============================================================
-- 65  RECLASSIFICAR AS AULAS COM A ESTEIRA NOVA  (Trilha R, E2)
--
-- MEXE EM DADO DE PRODUÇÃO. Rodar UMA VEZ, e só depois que a
-- esteira nova (E1) estiver no ar na main: a esteira roda no
-- navegador de quem administra, com o código publicado. Com o
-- código antigo no ar, ela reclassificaria com a busca antiga.
--
-- O que faz, numa transação só:
--   1. Copia a linha inteira de TODAS as aulas ativas em
--      copias.reclassificar_aulas, marcando quais vão pra fila
--      (alvo) e por quê. É a "foto de antes" pro SQL 66 comparar
--      e pro SQL 67 restaurar, se precisar.
--   2. Põe na fila da esteira (classificacao = 'legado'):
--      - as aulas sem nenhuma técnica marcada (613 em 07/11);
--      - as 27 do relatório de pertinência: 13 com técnica
--        errada, 6 com a posição errada, 5 de defesa marcadas com
--        o golpe e 3 incompletas.
--   As outras 40 (30 certas e 10 vagas) não mudam.
--   Aula conferida à mão ('revisada') nunca entra na fila.
--
-- Não sobrescreve: se a cópia já existe, o create table falha e
-- nada é gravado. Enquanto a fila anda, as aulas continuam
-- aparecendo normalmente.
--
-- Depois de rodar: abra Admin → Acervo. A esteira começa sozinha
-- e para no limite diário da IA; no dia seguinte, abrindo de novo,
-- ela continua. Quando a fila zerar, rode o 66.
--
-- Cole no SQL Editor do Supabase e rode.
-- ============================================================

begin;

create schema if not exists copias;
revoke all on schema copias from public;

create table copias.reclassificar_aulas (
  id         text primary key,
  dados      jsonb not null,           -- a linha inteira de public.aula
  alvo       boolean not null,         -- foi pra fila da esteira
  motivo     text,                     -- por que foi pra fila
  copiado_em timestamptz not null default now()
);
alter table copias.reclassificar_aulas enable row level security;

insert into copias.reclassificar_aulas (id, dados, alvo, motivo)
with relatorio(id, motivo) as (values
  -- técnica errada (13)
  ('84GMpycm-nQ', 'técnica errada'), ('L3pAAUG23Gk', 'técnica errada'),
  ('XTWW1TSxBt8', 'técnica errada'), ('knbV69KKEuE', 'técnica errada'),
  ('tmOphqi2eN8', 'técnica errada'), ('ErBoV-DRQqs', 'técnica errada'),
  ('g-xxfOE8V1Q', 'técnica errada'), ('sxpKGCuESj4', 'técnica errada'),
  ('t8hstU33nGc', 'técnica errada'), ('00Z8B0MuFqI', 'técnica errada'),
  ('bw2ZBuDHz64', 'técnica errada'), ('qMr-tps8s70', 'técnica errada'),
  ('ugbsLRYNcc0', 'técnica errada'),
  -- família certa, posição errada (6)
  ('i1H-YCombdA', 'posição errada'), ('_yCW__mG4kU', 'posição errada'),
  ('UFoiblyQQUU', 'posição errada'), ('AFmdCqCVOBU', 'posição errada'),
  ('hfLhraVjF8Q', 'posição errada'), ('yBKu00OlcYw', 'posição errada'),
  -- aula de defesa marcada com o golpe (5)
  ('BPDueZf9yTw', 'defesa marcada com o golpe'), ('dJk_fHf8n00', 'defesa marcada com o golpe'),
  ('fxEMhniS2E4', 'defesa marcada com o golpe'), ('QvtsIFHkNLI', 'defesa marcada com o golpe'),
  ('cZxSnNR1DqU', 'defesa marcada com o golpe'),
  -- incompletas (2 pelo id; a terceira, "Chave de pé ou triângulo?", vai pelo título)
  ('9yfsu67OQhw', 'incompleta'), ('Fb3GwaR8K7M', 'incompleta')
)
select a.id,
       to_jsonb(a),
       a.classificacao <> 'revisada' and m.motivo is not null,
       m.motivo
from public.aula a
cross join lateral (
  select coalesce(
    (select r.motivo from relatorio r where r.id = a.id),
    case when a.titulo ilike '%chave de p_ ou tri%' then 'incompleta' end,
    case when cardinality(a.tecnicas) = 0 then 'sem técnica' end
  ) as motivo
) m
where a.ativo;

update public.aula a
set classificacao = 'legado',
    classificacao_motivo = 'reclassificar com a esteira nova (SQL 65): ' || c.motivo
from copias.reclassificar_aulas c
where c.id = a.id and c.alvo;

commit;

-- o que foi pra fila, por motivo (esperado em 07/11: 613 sem técnica e 27 do relatório)
select coalesce(motivo, 'fica como está') as motivo,
       count(*) filter (where alvo) as na_fila,
       count(*) filter (where not alvo) as fora_da_fila
from copias.reclassificar_aulas
group by 1 order by 1;
