-- ============================================================
-- 64  EXPORTAR A DESCRICAO DAS AULAS  (Trilha R, 07/11/2026)
--
-- SO LEITURA. Um select so: nao cria, nao altera, nao apaga nada.
-- Complementa o 63: o texto do YouTube e o motivo de cada aula
-- estar em "revisar", pra conferir as marcacoes vagas e o que as
-- 613 aulas sem tecnica ensinam. Baixar em CSV.
-- ============================================================
select
  id,
  titulo,
  classificacao,
  classificacao_motivo,
  classificado_em,
  yt_status,
  descricao,
  yt_descricao,
  array_to_string(yt_tags, ' | ') as yt_tags
from public.aula
where ativo
order by id;
