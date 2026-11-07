-- ============================================================
-- 68  RESTAURAR AS AULAS COMO ESTAVAM ANTES DO SQL 65  (Trilha R, E2)
--
-- SÓ SE PRECISAR. Mexe em dado de produção: devolve a
-- classificação de cada aula que foi pra fila no SQL 65 ao que
-- estava na cópia (copias.reclassificar_aulas). Não toca em aula
-- conferida à mão ('revisada') depois do 65, nem em título,
-- duração, preço ou acesso.
--
-- Antes de restaurar, feche o Admin → Acervo em todo aparelho:
-- com a esteira rodando, ela reclassificaria de novo.
-- Cole no SQL Editor do Supabase e rode.
-- ============================================================

begin;

update public.aula a
set tecnicas             = v.tecnicas,
    habilidades          = v.habilidades,
    posicao_lado         = v.posicao_lado,
    situacoes            = v.situacoes,
    formato              = v.formato,
    nivel                = v.nivel,
    temas                = v.temas,
    posicoes             = v.posicoes,
    revisar              = v.revisar,
    classificacao        = v.classificacao,
    classificacao_motivo = v.classificacao_motivo,
    classificado_em      = v.classificado_em
from copias.reclassificar_aulas c
cross join lateral jsonb_populate_record(null::public.aula, c.dados) v
where c.id = a.id and c.alvo and a.classificacao <> 'revisada';

commit;

-- tem que dar zero: aula da fila que ainda difere da cópia (fora as revisadas à mão)
select count(*) as diferentes
from copias.reclassificar_aulas c
join public.aula a on a.id = c.id
where c.alvo and a.classificacao <> 'revisada'
  and (a.tecnicas, a.classificacao) is distinct from
      ((select array(select jsonb_array_elements_text(c.dados->'tecnicas'))), c.dados->>'classificacao');
