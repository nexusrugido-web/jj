import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   GERA OS SQL QUE CONFEREM A RECLASSIFICAÇÃO (Trilha R, E2)

   66  resumo: quantas aulas ganharam, mudaram ou perderam técnica
   67  detalhe: cada aula do relatório e cada aula que ganhou
       técnica, com o nome da técnica antes e depois

   Os dois comparam a cópia do SQL 65 (copias.reclassificar_aulas)
   com public.aula. O nome da técnica sai do catálogo do app, que
   vai escrito dentro do SQL (o banco só tem o uid).

   SÓ LEITURA: um select cada, sem gravar nada.
   Uso: node scripts/gerar-sql-reclassificar.mjs
   ============================================================ */

const { CATALOGO_TECNICAS } = await import('../src/lib/tecnicas.js');

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const nomes = CATALOGO_TECNICAS.flatMap((t) => t.uids.map((u) => `(${q(u)}, ${q(t.nome)})`));

const comum = `with
nomes(uid, nome) as (values
  ${nomes.join(',\n  ')}
),
comparar as (
  select c.id, c.alvo, c.motivo,
         c.dados->>'titulo' as titulo,
         array(select jsonb_array_elements_text(c.dados->'tecnicas')) as antes,
         a.tecnicas as depois,
         a.classificacao,
         a.classificacao_motivo
  from copias.reclassificar_aulas c
  join public.aula a on a.id = c.id
)`;

const nomeDe = (col) => `coalesce((select string_agg(coalesce(n.nome, '(uid fora do catálogo)'), ' + ' order by u.ord)
           from unnest(${col}) with ordinality u(uid, ord)
           left join nomes n on n.uid = u.uid), '—')`;

const resumo = `-- ============================================================
-- 66  CONFERIR A RECLASSIFICAÇÃO: RESUMO  (Trilha R, E2)
--
-- SÓ LEITURA. Compara a cópia do SQL 65 com as aulas de agora.
-- Gerado por scripts/gerar-sql-reclassificar.mjs. Não editar à mão.
--
-- Rodar quando a fila da esteira zerar (Admin → Acervo). Se
-- "ainda na fila" não for zero, a esteira não terminou.
-- "fora da fila, mudou" tem que dar zero.
-- Colunas: aulas, automatica (a IA ficou segura), revisar (ficou
-- em dúvida e pede um olho humano).
-- Cole no SQL Editor do Supabase e rode.
-- ============================================================
${comum}
select situacao,
       count(*) as aulas,
       count(*) filter (where classificacao = 'automatica') as automatica,
       count(*) filter (where classificacao = 'revisar') as revisar
from (
  select classificacao, case
    when not alvo and antes is distinct from depois then '9 fora da fila, mudou'
    when not alvo then '8 fora da fila, igual'
    when classificacao = 'legado' then '1 ainda na fila'
    when motivo = 'sem técnica' and cardinality(depois) > 0 then '2 sem técnica, ganhou técnica'
    when motivo = 'sem técnica' then '3 sem técnica, continua sem'
    when cardinality(depois) = 0 then '6 do relatório, ficou sem técnica'
    when antes = depois then '5 do relatório, técnica igual'
    else '4 do relatório, técnica mudou'
  end as situacao
  from comparar
) s
group by 1 order by 1;
`;

const detalhe = `-- ============================================================
-- 67  CONFERIR A RECLASSIFICAÇÃO: AULA POR AULA  (Trilha R, E2)
--
-- SÓ LEITURA. Cada aula do relatório (as 27) e cada aula que
-- ganhou técnica, com a técnica antes e depois pelo nome.
-- Gerado por scripts/gerar-sql-reclassificar.mjs. Não editar à mão.
--
-- O Supabase mostra só 100 linhas se o seletor perto do botão Run
-- estiver no padrão: troque pra "No limit" antes de rodar.
-- Cole no SQL Editor do Supabase e rode.
-- ============================================================
${comum}
select id, titulo, motivo,
       ${nomeDe('antes')} as antes,
       ${nomeDe('depois')} as depois,
       classificacao,
       classificacao_motivo
from comparar
where alvo and (motivo <> 'sem técnica' or cardinality(depois) > 0)
order by motivo = 'sem técnica', motivo, titulo
limit 1000;
`;

writeFileSync('supabase/66-conferir-reclassificacao-resumo.sql', resumo);
writeFileSync('supabase/67-conferir-reclassificacao-aulas.sql', detalhe);
console.log(`66 e 67 gerados (${nomes.length} uids do catálogo)`);
