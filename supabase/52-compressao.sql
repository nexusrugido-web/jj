-- 52: COMPRESSÃO COMO HABILIDADE DE AULA
--
-- O catálogo ganhou a categoria Compressões (Cadeira elétrica, Banana
-- split, Calf slicer): finalização que esmaga ou abre à força, e não
-- chave de articulação. A aula agora pode ser marcada com "compressao",
-- e a recomendação de defesa contra essas técnicas não cai mais em
-- aula de chave de perna.
-- Só amplia a lista aceita: nenhuma aula muda. Pode rodar de novo.
--
-- Cole no SQL Editor do Supabase e rode.

alter table public.aula drop constraint if exists aula_habilidades_validas;
alter table public.aula add constraint aula_habilidades_validas check (habilidades <@ array[
    'queda', 'passagem', 'raspagem', 'guarda', 'retencao', 'controle',
    'transicao', 'pegada', 'base', 'escapada', 'defesa', 'finalizacao',
    'estrangulamento', 'articular', 'perna', 'compressao', 'fisico'
  ]::text[]);
