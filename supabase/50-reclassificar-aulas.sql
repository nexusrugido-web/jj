-- 50: RECLASSIFICAR AS AULAS COM AS REGRAS NOVAS
--
-- A IA que classifica as aulas ganhou regras de ataque × defesa, de lado
-- (por cima × por baixo) e de queda (dar × evitar). As aulas que ela já
-- classificou sozinha voltam pra fila e ela classifica de novo com as
-- regras novas. Exemplo do que conserta: "O que fazer quando pegam suas
-- costas" estava marcada com armlock; o certo é mata-leão.
--
-- O que você conferiu na mão ("revisada") NÃO muda.
-- Enquanto a fila anda, as aulas continuam aparecendo normalmente.
--
-- Depois de rodar: abra Admin → Acervo. A esteira começa sozinha e para
-- no limite diário da IA; no dia seguinte, abrindo de novo, ela continua.
--
-- Cole no SQL Editor do Supabase e rode.

update public.aula
set classificacao = 'legado',
    classificacao_motivo = 'reclassificar com as regras de ataque e defesa (SQL 50)'
where ativo and classificacao in ('automatica', 'revisar');

-- quantas ficaram na fila (legado) e quantas já estavam conferidas na mão (revisada)
select classificacao, count(*) as aulas from public.aula where ativo group by 1 order by 1;
