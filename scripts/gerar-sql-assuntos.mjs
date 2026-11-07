import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   GERA O SQL QUE CONTA AS AULAS DE CADA ASSUNTO (Trilha R, R1)

   A regra dos assuntos mora no app (src/lib/assuntos.js), não no
   banco. Então o SQL leva escrito dentro dele o mapa uid → assunto
   tirado do catálogo, e o banco só cruza com public.aula.tecnicas.
   Mesma regra do assuntosDaAula: a aula entra pelo uid marcado,
   nunca pelo título nem pelo tema.

   SÓ LEITURA: um select, sem tabela, sem função, sem gravar nada.
   Uso: node scripts/gerar-sql-assuntos.mjs [arquivo de saída]
   ============================================================ */

const { CATALOGO_TECNICAS } = await import('../src/lib/tecnicas.js');
const { ASSUNTOS, tecnicasDoAssunto } = await import('../src/lib/assuntos.js');

const saida = process.argv[2] || 'supabase/62-contar-aulas-por-assunto.sql';
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

/* as linhas do relatório: os 14 assuntos e, logo abaixo de cada um, os filtros dele */
const linhas = [];
for (const a of ASSUNTOS) {
  linhas.push({ chave: a.id, nome: a.nome, tecnicas: tecnicasDoAssunto(a.id) });
  for (const f of a.filtros || []) linhas.push({ chave: `${a.id}/${f.id}`, nome: `   ${f.nome}`, tecnicas: tecnicasDoAssunto(a.id, f.id) });
}

const mapa = linhas.flatMap((l) => l.tecnicas.flatMap((t) => t.uids.map((u) => `(${q(u)}, ${q(l.chave)})`)));
const nomes = linhas.map((l, i) => `(${i + 1}, ${q(l.chave)}, ${q(l.nome)})`);
const catalogo = [...new Set(CATALOGO_TECNICAS.flatMap((t) => t.uids))].map((u) => `(${q(u)})`);

/* os temas que não são de técnica continuam na tela (decisão de 07/11) */
const TEMAS_FORA = [['logica', 'Tema: Entender o porquê'], ['fisico', 'Tema: Corpo e gás'], ['drill', 'Tema: Drill e timing'], ['competicao', 'Tema: Faixa e competição']];

const sql = `-- ============================================================
-- 62  CONTAR AS AULAS DE CADA ASSUNTO  (Trilha R, R1, 07/11/2026)
--
-- SÓ LEITURA. Um select só: não cria, não altera, não apaga nada.
-- Gerado por scripts/gerar-sql-assuntos.mjs a partir do catálogo
-- do app (${CATALOGO_TECNICAS.length} técnicas, 14 assuntos). Não editar à mão.
--
-- A aula entra no assunto pelo uid de técnica marcado nela
-- (coluna tecnicas), nunca pelo título nem pelo tema. Só aulas
-- ativas. Uma aula pode contar em dois assuntos.
--
-- Colunas: aulas (total), completas, rapidas, premium (só
-- assinantes), conferidas (classificação revisada à mão).
-- ============================================================
with
mapa(uid, chave) as (values
  ${mapa.join(',\n  ')}
),
nomes(ordem, chave, nome) as (values
  ${nomes.join(',\n  ')}
),
catalogo(uid) as (values
  ${catalogo.join(',\n  ')}
),
ativas as (
  select id, tipo, acesso, classificacao, coalesce(tecnicas, '{}') as tecnicas, coalesce(temas, '{}') as temas
  from public.aula
  where ativo
),
ligadas as (
  select distinct a.id, a.tipo, a.acesso, a.classificacao, m.chave
  from ativas a
  cross join lateral unnest(a.tecnicas) as u(uid)
  join mapa m on m.uid = u.uid
),
contas as (
  select chave, count(*) as aulas,
    count(*) filter (where tipo = 'aula') as completas,
    count(*) filter (where tipo = 'short') as rapidas,
    count(*) filter (where acesso = 'assinantes') as premium,
    count(*) filter (where classificacao = 'revisada') as conferidas
  from ligadas group by chave
),
extras(ordem, nome, aulas, completas, rapidas, premium, conferidas) as (
${TEMAS_FORA.map(([tema, nome], i) => `  select ${200 + i}, ${q(nome)}, count(*), count(*) filter (where tipo = 'aula'), count(*) filter (where tipo = 'short'),
    count(*) filter (where acesso = 'assinantes'), count(*) filter (where classificacao = 'revisada')
  from ativas where ${q(tema)} = any(temas)
  union all`).join('\n')}
  select 300, 'Total de aulas ativas', count(*), count(*) filter (where tipo = 'aula'), count(*) filter (where tipo = 'short'),
    count(*) filter (where acesso = 'assinantes'), count(*) filter (where classificacao = 'revisada')
  from ativas
  union all
  select 301, 'Sem nenhuma técnica marcada', count(*), count(*) filter (where tipo = 'aula'), count(*) filter (where tipo = 'short'),
    count(*) filter (where acesso = 'assinantes'), count(*) filter (where classificacao = 'revisada')
  from ativas where cardinality(tecnicas) = 0
  union all
  select 302, 'Com técnica, mas em nenhum assunto', count(*), count(*) filter (where tipo = 'aula'), count(*) filter (where tipo = 'short'),
    count(*) filter (where acesso = 'assinantes'), count(*) filter (where classificacao = 'revisada')
  from ativas a where cardinality(a.tecnicas) > 0 and not exists (select 1 from ligadas l where l.id = a.id)
  union all
  select 303, 'Com uid fora do catálogo', count(*), count(*) filter (where tipo = 'aula'), count(*) filter (where tipo = 'short'),
    count(*) filter (where acesso = 'assinantes'), count(*) filter (where classificacao = 'revisada')
  from ativas a where exists (select 1 from unnest(a.tecnicas) u(uid) where u.uid not in (select uid from catalogo))
)
select n.ordem, n.nome as assunto, coalesce(c.aulas, 0) as aulas, coalesce(c.completas, 0) as completas,
  coalesce(c.rapidas, 0) as rapidas, coalesce(c.premium, 0) as premium, coalesce(c.conferidas, 0) as conferidas
from nomes n left join contas c on c.chave = n.chave
union all
select ordem, nome, aulas, completas, rapidas, premium, conferidas from extras
order by 1;
`;

writeFileSync(saida, sql);
console.log(`${saida}: ${linhas.length} linhas de assunto e filtro, ${mapa.length} pares uid → assunto, ${catalogo.length} uids no catálogo`);
