-- ============================================================
-- 63  EXPORTAR AS AULAS PRO RELATORIO DE PERTINENCIA  (Trilha R, 07/11/2026)
--
-- SO LEITURA. Um select so: nao cria, nao altera, nao apaga nada.
-- Traz as aulas ativas com o que o motor le de cada uma. O
-- resultado sai em CSV (botao de baixar do editor) e o relatorio
-- roda os casos de tatame nele, fora do banco.
-- ============================================================
select
  id,
  titulo,
  tipo,
  duracao,
  faixa,
  acesso,
  ordem,
  classificacao,
  formato,
  nivel,
  array_to_string(temas, ' ')        as temas,
  array_to_string(posicao_lado, ' ') as posicao_lado,
  array_to_string(habilidades, ' ')  as habilidades,
  array_to_string(situacoes, ' ')    as situacoes,
  array_to_string(tecnicas, ' ')     as tecnicas
from public.aula
where ativo
order by id;
