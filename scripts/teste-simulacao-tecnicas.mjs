import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

import 'fake-indexeddb/auto';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

/* ============================================================
   AS DUAS SIMULAÇÕES DA TRILHA T NO SERVIDOR (SQL 57, só leitura)

   1. marcar as técnicas antigas como próprias (marcarProprias)
   2. ligar rolas, planos e metas antigos ao uid (passadaDeIdentidade)

   As duas rodam no aparelho; o SQL repete as mesmas regras nos dados
   da nuvem, pra o dono ver os números antes de ligar. O catálogo vai
   dentro do SQL, gerado daqui. Este teste roda o SQL no PGlite com
   contas de mentira e confere que os números são os mesmos das
   funções do app com os mesmos dados.

   node scripts/teste-simulacao-tecnicas.mjs --gerar
     reescreve supabase/57-simulacao-tecnicas.sql
   ============================================================ */

const { CATALOGO_TECNICAS, TECNICA_POR_UID } = await import('../src/lib/tecnicas.js');
const { RENOMEAR, nomeAtual } = await import('../src/db/renomeios.js');
const { NOMES_ANTIGOS_DO_BANCO } = await import('../src/db/db.js');
const { semAcento } = await import('../src/lib/classificar.js');
const { uidEstavel, chaveNome } = await import('../src/lib/uid.js');
const { NOMES_DO_CATALOGO, nomeDoCatalogo, marcarProprias } = await import('../src/lib/proprias.js');
const { passadaDeIdentidade } = await import('../src/lib/compatibilidade.js');
const { uidOficial, resolverNome, nomesDoRola, nomesDoPlano, nomesDaMeta, metaDeTecnica, uidDoGolpe } = await import('../src/lib/identidade.js');
const { origemDaTecnica } = await import('../src/lib/tecnicas.js');

const ARQUIVO = new URL('../supabase/57-simulacao-tecnicas.sql', import.meta.url);

/* ---------- o SQL ---------- */
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const valores = (linhas) => linhas.map((l) => `(${l.map(q).join(', ')})`).join(',\n  ');

const ACENTOS = 'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑýÿÝ';
const SEM_ACENTO = [...ACENTOS].map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '')).join('');
const semMarca = (x) => `translate(${x}, '${ACENTOS}', '${SEM_ACENTO}')`;
const aparar = (x) => `regexp_replace(${x}, '^\\s+|\\s+$', '', 'g')`;
/* semAcento (classificar.js) e limpo (proprias.js) */
const sqlSemAcento = (x) => `btrim(regexp_replace(lower(${semMarca(x)}), '[^a-z0-9]+', ' ', 'g'))`;
const sqlLimpo = (x) => `regexp_replace(lower(${aparar(semMarca(x))}), '\\s+', ' ', 'g')`;
/* chave do identidade.js: semAcento(nomeAtual(trim(nome))) */
const sqlChave = (x) => sqlSemAcento(`coalesce((select para from renomear where de = ${aparar(x)}), ${aparar(x)})`);

const chave = (nome) => semAcento(nomeAtual(String(nome || '').trim()));

/* as CTEs comuns ao 57 (simulação), 58 (cópia) e 59 não usa: a mesma regra nos três */
function ctes() {
  const indice = new Set();
  const doCatalogo = new Map();
  for (const t of CATALOGO_TECNICAS) {
    indice.add(JSON.stringify([chave(t.nome), t.uid]));
    if (t.antigo) indice.add(JSON.stringify([chave(t.antigo), t.uid]));
    doCatalogo.set(chave(t.nome), t.uid);
  }
  const renomeados = [...new Set(Object.keys(RENOMEAR).map((n) => uidEstavel(chaveNome('techniques', n))))];
  const finais = [...new Set([...NOMES_ANTIGOS_DO_BANCO, ...Object.keys(RENOMEAR)])].filter((n) => nomeDoCatalogo(n));

  return `with
renomear(de, para) as (values
  ${valores(Object.entries(RENOMEAR))}
),
cat_indice(chave, uid) as (values
  ${valores([...indice].map((x) => JSON.parse(x)))}
),
do_catalogo(chave, uid) as (values
  ${valores([...doCatalogo])}
),
principal(uid, p) as (values
  ${valores([...TECNICA_POR_UID].map(([u, t]) => [u, t.uid]))}
),
renomeados(uid) as (values
  ${valores(renomeados.map((u) => [u]))}
),
nomes_catalogo(k) as (values
  ${valores([...NOMES_DO_CATALOGO.keys()].map((k) => [k]))}
),
final_do_catalogo(de) as (values
  ${valores(finais.map((n) => [n]))}
),
reg as (
  select id, user_id, tabela, dados from public.registros
  where deleted_at is null and tabela in ('techniques', 'rolls', 'attackPlans', 'goals')
),
tec as (
  select id, user_id, dados, dados->>'uid' as uid, dados->>'nome' as nome,
         case when jsonb_typeof(dados->'criadoEm') = 'number' then (dados->>'criadoEm')::numeric end as criado,
         case jsonb_typeof(dados->'propria')
           when 'number' then (dados->>'propria')::numeric <> 0
           when 'boolean' then (dados->>'propria')::boolean
           when 'string' then dados->>'propria' <> ''
           when 'object' then true when 'array' then true else false end as propria
  from reg where tabela = 'techniques'
),
tec_s as (
  select t.*, t.criado is not null and (select count(*) from tec v where v.user_id = t.user_id and v.criado is not null
          and abs(v.criado - t.criado) <= 60000) >= 20 as semente
  from tec t
),

/* ---------- parte 1: de onde vem cada técnica ---------- */
origem as (
  select t.id, t.user_id, case
    when t.propria then 'ja_marcada'
    when coalesce(t.uid, '') = '' then 'sem_uid'
    when t.uid in (select uid from principal) or t.uid in (select uid from renomeados) then 'catalogo'
    when ${sqlLimpo('t.nome')} in (select k from nomes_catalogo) or t.nome in (select de from final_do_catalogo) then 'nome_do_catalogo'
    when t.criado is null then 'sem_data'
    when t.semente then 'nasceu_com_a_biblioteca'
    else 'marcar' end as o
  from tec_s t
),

/* ---------- parte 2: o índice de nomes de cada conta ---------- */
/* cópia antiga do catálogo (uid aleatório): responde pelo uid oficial só
   com as três provas, não é própria, o nome é de uma técnica só do
   catálogo e nasceu junto com a biblioteca (copiaDoCatalogo, identidade.js) */
tec_k as (
  select t.*, ${sqlChave('t.nome')} as chave, p.p as principal,
         (select case when count(distinct ci.uid) = 1 then min(ci.uid) end from cat_indice ci where ci.chave = ${sqlChave('t.nome')}) as oficial_unico,
         ${sqlLimpo('t.nome')} in (select k from nomes_catalogo) or t.nome in (select de from final_do_catalogo) as nome_cat
  from tec_s t left join principal p on p.uid = t.uid
  where coalesce(t.uid, '') <> '' and coalesce(t.nome, '') <> ''
),
tec_indice as (
  select t.user_id, t.chave, t.uid as uid_antigo,
         case when t.principal is not null then t.principal
              when t.uid in (select uid from renomeados) then coalesce(
                (select dc.uid from do_catalogo dc where dc.chave = t.chave), t.uid)
              when not t.propria and t.semente and t.oficial_unico is not null then t.oficial_unico
              else t.uid end as uid,
         not t.propria and t.semente and t.oficial_unico is not null
           and t.principal is null and t.uid not in (select uid from renomeados) as copia,
         not t.propria and t.nome_cat and t.principal is null and t.uid not in (select uid from renomeados)
           and not (t.semente and t.oficial_unico is not null) as sem_prova
  from tec_k t
),
rolas as (select id, user_id, dados from reg where tabela = 'rolls'),
rola_itens as (
  select r.id, x from rolas r, jsonb_array_elements(case when jsonb_typeof(r.dados->'subsAplicadas') = 'array' then r.dados->'subsAplicadas' else '[]' end) x
  union all
  select r.id, x from rolas r, jsonb_array_elements(case when jsonb_typeof(r.dados->'subsSofridas') = 'array' then r.dados->'subsSofridas' else '[]' end) x
  union all
  select r.id, x from rolas r, jsonb_each(case when jsonb_typeof(r.dados->'tecMeus') = 'object' then r.dados->'tecMeus' else '{}' end) e(k, v),
    jsonb_array_elements(case when jsonb_typeof(e.v) = 'array' then e.v else jsonb_build_array(e.v) end) x
  union all
  select r.id, x from rolas r, jsonb_each(case when jsonb_typeof(r.dados->'tecDele') = 'object' then r.dados->'tecDele' else '{}' end) e(k, v),
    jsonb_array_elements(case when jsonb_typeof(e.v) = 'array' then e.v else jsonb_build_array(e.v) end) x
),
planos as (
  select id, user_id, dados,
         coalesce(nullif(dados->>'objetivoTipo', ''), case when coalesce(dados->>'objetivo', '') <> '' then 'tecnica' else '' end) as tipo
  from reg where tabela = 'attackPlans'
    and not coalesce(dados->'pronto' not in ('null', 'false', '0', '""'), false)
),
plano_nomes as (
  select p.id, p.dados->>'objetivo' as nome from planos p where p.tipo = 'tecnica'
  union all
  select p.id, p.dados->>'finalizacaoPreferida' from planos p where p.tipo = 'finalizar'
  union all
  select p.id, x #>> '{}' from planos p, jsonb_array_elements(case when jsonb_typeof(p.dados->'finalizacoesAceitas') = 'array' then p.dados->'finalizacoesAceitas' else '[]' end) x
  where p.tipo = 'finalizar'
),
plano_nomes_ok as (select id, nome from plano_nomes where coalesce(nome, '') <> '' and nome not like 'fam:%'),
pecas as (
  select p.id, p.user_id, x as peca from planos p,
    jsonb_array_elements(case when jsonb_typeof(p.dados->'passos') = 'array' then p.dados->'passos' else '[]' end) x
  where coalesce(x->>'tipo', '') <> 'finta' and ${aparar("coalesce(x->>'acao', '')")} <> ''
),
metas as (
  select id, user_id, dados from reg
  where tabela = 'goals' and dados->>'tipo' in ('tecnica', 'defesa') and jsonb_typeof(dados->'alvo') = 'string'
),

/* os registros que entram na conta e os nomes de cada um (cada nome uma vez) */
registros_t as (
  select 'rolls' as tabela, r.id, r.user_id, r.dados->'tecUid' as antes from rolas r where exists (select 1 from rola_itens i where i.id = r.id)
  union all
  select 'attackPlans', p.id, p.user_id, p.dados->'tecUid' from planos p
  where exists (select 1 from pecas c where c.id = p.id) or exists (select 1 from plano_nomes_ok n where n.id = p.id)
  union all
  select 'goals', m.id, m.user_id, m.dados->'tecUid' from metas m where ${aparar("m.dados->>'alvo'")} <> ''
),
nomes as (
  select distinct g.tabela, g.id, g.user_id, g.antes, n.nome from registros_t g
  join (
    select id, ${aparar("x #>> '{}'")} as nome from rola_itens
    union all select id, ${aparar('nome')} from plano_nomes_ok
    union all select id, ${aparar("dados->>'alvo'")} from metas
  ) n on n.id = g.id
  where coalesce(n.nome, '') <> ''
),
/* o que o nome resolve na conta: quantos uids e qual, se for um só */
resolvidos as (
  select n.*, case when n.nome like 'fam:%' then 0 else r.qtd end as qtd, r.u,
         (select count(distinct ci.uid) from cat_indice ci where ci.chave = ${sqlChave('n.nome')}) as n_oficiais
  from nomes n, lateral (
    select count(distinct a.uid) as qtd, min(a.uid) as u from (
      select ci.uid from cat_indice ci where ci.chave = ${sqlChave('n.nome')}
      union all
      select ti.uid from tec_indice ti where ti.user_id = n.user_id and ti.chave = ${sqlChave('n.nome')}
    ) a
  ) r
),
estado_nomes as (
  select tabela, id, user_id, nome, u, case
    when qtd = 1 and jsonb_typeof(antes) = 'object' and antes ? u then 'ja_ligado'
    when qtd = 1 then 'ligado'
    when qtd > 1 then 'ambiguo'
    else 'sem_par' end as e,
    case when n_oficiais > 1 then 'dois_oficiais' else 'copia_sem_prova' end as porque
  from resolvidos
),
/* a peça do plano: o golpe ganha uid; situação (posição) nunca */
estado_pecas as (
  select 'attackPlans' as tabela, c.id, c.user_id, c.peca->>'acao' as nome, g.u, case
    when coalesce(c.peca->>'golpeUid', '') <> '' and g.u = c.peca->>'golpeUid' then 'ja_ligado'
    when g.u is not null then 'ligado'
    when a.qtd > 1 then 'ambiguo'
    else 'sem_par' end as e,
    case when a.oficiais > 1 then 'dois_oficiais' else 'copia_sem_prova' end as porque
  from pecas c,
  lateral (
    select case when c.peca->>'tipo' = 'situacao' then null else (
      select case when count(distinct b.uid) = 1 and nm not like 'fam:%' then min(b.uid) end from (
        select ci.uid from cat_indice ci where ci.chave = ${sqlChave('nm')}
        union all
        select ti.uid from tec_indice ti where ti.user_id = c.user_id and ti.chave = ${sqlChave('nm')}
      ) b) end as u
    from (select coalesce(c.peca->>'golpe', c.peca->>'acao') as nm) z
  ) g,
  lateral (
    select case when (c.peca->>'acao') like 'fam:%' then 0 else count(distinct b.uid) end as qtd,
           (select count(distinct ci.uid) from cat_indice ci where ci.chave = ${sqlChave("(c.peca->>'acao')")}) as oficiais from (
      select ci.uid from cat_indice ci where ci.chave = ${sqlChave("(c.peca->>'acao')")}
      union all
      select ti.uid from tec_indice ti where ti.user_id = c.user_id and ti.chave = ${sqlChave("(c.peca->>'acao')")}
    ) b
  ) a
),
estados as (select * from estado_nomes union all select * from estado_pecas),
/* cada vez que um nome aparece no registro (com repetição), pra separar
   referência de nome: o mesmo nome duas vezes no rola é 1 nome e 2 referências */
ocorrencias as (
  select n.id, ${aparar("x #>> '{}'")} as nome from rola_itens n
  union all select id, ${aparar('nome')} from plano_nomes_ok
  union all select id, ${aparar("dados->>'alvo'")} from metas
),
partes(tabela, nome, ordem) as (values ('rolls', 'rolas', 10), ('attackPlans', 'planos', 20), ('goals', 'metas', 30))
`;
}

export function gerarSql() {
  return `-- 57: SIMULAÇÃO DAS TÉCNICAS PRÓPRIAS E DOS REGISTROS ANTIGOS (TRILHA T), SÓ LEITURA
--
-- Não grava nada: é um select. Não mostra nome de ninguém, só números.
-- Gerado por scripts/teste-simulacao-tecnicas.mjs --gerar (o catálogo vai
-- aqui dentro); o mesmo teste confere que dá os números do app.
--
-- Parte 1, marcar as próprias antigas: técnica de fora do catálogo só vira
-- própria com prova (uid de fora, nome que não é do catálogo, com data e
-- sem ter nascido junto com a biblioteca). O resto fica como está, contado
-- pelo motivo.
-- Parte 2, ligar os registros antigos: o nome que bate com exatamente uma
-- técnica ganha o uid; ambíguo ou sem par fica como está, contado.
--
-- A passada de verdade roda em cada aparelho, com a biblioteca inteira dele.
-- Aqui é a nuvem, que só tem as técnicas que já subiram: é a melhor prévia,
-- não a conta exata.
--
-- Cole no SQL Editor do Supabase e rode.

` + ctes() + `
select o_que, numero from (
  select 1 as ordem, 'técnicas: já marcadas como própria' as o_que, count(*) filter (where o = 'ja_marcada') as numero from origem
  union all select 2, 'técnicas: do catálogo', count(*) filter (where o = 'catalogo') from origem
  union all select 3, 'técnicas: viram própria (com prova)', count(*) filter (where o = 'marcar') from origem
  union all select 4, 'técnicas duvidosas: sem código', count(*) filter (where o = 'sem_uid') from origem
  union all select 5, 'técnicas duvidosas: nome do catálogo', count(*) filter (where o = 'nome_do_catalogo') from origem
  union all select 6, 'técnicas duvidosas: sem data', count(*) filter (where o = 'sem_data') from origem
  union all select 7, 'técnicas duvidosas: nasceram com a biblioteca', count(*) filter (where o = 'nasceu_com_a_biblioteca') from origem
  union all select 8, 'contas com técnica que vira própria', count(distinct user_id) filter (where o = 'marcar') from origem
  union all select 40, 'cópias antigas do catálogo que passam a responder pelo uid oficial', (select count(*) from tec_indice where copia)
  union all select 41, 'técnicas com nome do catálogo sem prova (ficam com o uid delas)',
    (select count(*) from tec_indice where sem_prova)
  union all select 42, 'pendentes: dois nomes oficiais iguais', (select count(*) from estados where e = 'ambiguo' and porque = 'dois_oficiais')
  union all select 43, 'pendentes: cópia sem prova de ser do catálogo', (select count(*) from estados where e = 'ambiguo' and porque = 'copia_sem_prova')
  union all select 44, 'uids oficiais com mais de uma técnica na mesma conta (nada é apagado)',
    (select count(*) from (select user_id, uid from tec_indice group by 1, 2 having count(*) > 1) d)
  union all select p.ordem + 1, p.nome || ': registros com técnica', (select count(*) from registros_t g where g.tabela = p.tabela) from partes p
  union all select p.ordem + 2, p.nome || ': registros que mudam', (select count(distinct e.id) from estados e where e.tabela = p.tabela and e.e = 'ligado') from partes p
  union all select p.ordem + 3, p.nome || ': nomes que ganham o uid', (select count(*) from estados e where e.tabela = p.tabela and e.e = 'ligado') from partes p
  union all select p.ordem + 4, p.nome || ': nomes já ligados', (select count(*) from estados e where e.tabela = p.tabela and e.e = 'ja_ligado') from partes p
  union all select p.ordem + 5, p.nome || ': nomes ambíguos (ficam como estão)', (select count(*) from estados e where e.tabela = p.tabela and e.e = 'ambiguo') from partes p
  union all select p.ordem + 6, p.nome || ': nomes sem par (ficam como estão)', (select count(*) from estados e where e.tabela = p.tabela and e.e = 'sem_par') from partes p
  union all select p.ordem + 7, p.nome || ': referências que ganham o uid (cada vez que o nome aparece)', (
    (select count(*) from estado_nomes e join ocorrencias o on o.id = e.id and o.nome = e.nome where e.tabela = p.tabela and e.e = 'ligado')
    + (select count(*) from estado_pecas e where e.tabela = p.tabela and e.e = 'ligado')) from partes p
  union all select p.ordem + 8, p.nome || ': técnicas diferentes que ganham o uid', (
    select count(distinct (e.user_id, e.u)) from estados e where e.tabela = p.tabela and e.e = 'ligado') from partes p
) x
order by ordem;
`;
}

/* ---------- 58: a cópia antes da passada ----------
   Escopo: todo registro que a passada PODE mexer, não só o que a nuvem
   prevê. A passada roda no aparelho, com a biblioteca inteira dele, e pode
   ligar um nome que aqui ficou ambíguo; por isso entra todo rola, plano e
   meta com nome de técnica, mais a técnica que vira própria. `previsto`
   diz o que a simulação da nuvem espera que mude. */
export function gerarCopia() {
  return `-- 58: CÓPIA DOS REGISTROS ANTES DA PASSADA DE IDENTIDADE (TRILHA T, T5c)
--
-- Rodar UMA VEZ, antes de ligar a passada nos aparelhos. Grava em
-- copias.passada_identidade a linha inteira de cada registro que a passada
-- pode mexer (id, conta, tabela, dados completos e as datas), pra conferir
-- depois (SQL 59) e, se precisar, restaurar.
--
-- Não mexe em public.registros. Não sobrescreve: se a cópia já existe, o
-- create table falha e nada é gravado (rode o 59, ou apague a cópia antiga
-- de propósito antes).
--
-- O que entra (e só isso):
--   - rola, plano (fora os prontos) e meta de técnica com nome de técnica,
--     vivos: todos, porque o aparelho pode ligar mais do que a nuvem prevê;
--   - técnica sem propria que a regra marca como própria.
-- previsto = a simulação da nuvem (SQL 57) diz que muda.
-- O schema copias não é exposto pela API e a tabela tem RLS sem política:
-- só o dono do banco lê.
--
-- Gerado por scripts/teste-simulacao-tecnicas.mjs --gerar.
-- Cole no SQL Editor do Supabase e rode.

begin;

create schema if not exists copias;
revoke all on schema copias from public;

create table copias.passada_identidade (
  id            uuid primary key,
  user_id       uuid not null,
  tabela        text not null,
  dados         jsonb not null,
  created_at    timestamptz,
  updated_at    timestamptz,
  deleted_at    timestamptz,
  previsto      boolean not null,
  iguais_no_uid integer not null,  -- linhas vivas com a mesma conta, tabela e uid na hora da cópia
  copiado_em    timestamptz not null default now()
);
alter table copias.passada_identidade enable row level security;

insert into copias.passada_identidade (id, user_id, tabela, dados, created_at, updated_at, deleted_at, previsto, iguais_no_uid)
` + ctes() + `,
escopo as (
  select g.id, coalesce(bool_or(e.e = 'ligado'), false) as previsto
    from registros_t g left join estados e on e.tabela = g.tabela and e.id = g.id
   group by g.id
  union all
  select o.id, true from origem o where o.o = 'marcar'
)
select r.id, r.user_id, r.tabela, r.dados, r.created_at, r.updated_at, r.deleted_at, s.previsto,
       (select count(*) from public.registros d
         where d.user_id = r.user_id and d.tabela = r.tabela and d.deleted_at is null
           and d.dados->>'uid' is not distinct from r.dados->>'uid')::int
  from escopo s join public.registros r on r.id = s.id;

commit;

-- o que foi copiado
select tabela, previsto, count(*) as registros from copias.passada_identidade group by 1, 2 order by 1, 2;
`;
}

const ARQUIVO_COPIA = new URL('../supabase/58-copia-antes-da-passada.sql', import.meta.url);
const sql = gerarSql();
const sqlCopia = gerarCopia();
if (process.argv.includes('--gerar')) {
  await fs.writeFile(ARQUIVO, sql);
  await fs.writeFile(ARQUIVO_COPIA, sqlCopia);
  console.log('supabase/57-simulacao-tecnicas.sql e 58-copia-antes-da-passada.sql gerados');
  process.exit(0);
}

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { falhas++; console.error('FALHOU:', msg); } };

const noArquivo = await fs.readFile(ARQUIVO, 'utf8').catch(() => '');
ok(noArquivo === sql, 'o SQL 57 está desatualizado com o catálogo: rode node scripts/teste-simulacao-tecnicas.mjs --gerar');
ok(await fs.readFile(ARQUIVO_COPIA, 'utf8').catch(() => '') === sqlCopia, 'o SQL 58 está desatualizado: rode node scripts/teste-simulacao-tecnicas.mjs --gerar');

/* ---------- as contas de mentira ---------- */
const cat = CATALOGO_TECNICAS;
const comAntigo = cat.find((t) => t.antigo);
const comJuntou = cat.find((t) => t.uids.length > 1);
const [nomeVelho, nomeNovo] = Object.entries(RENOMEAR).find(([, novo]) => cat.some((t) => t.nome === novo));
const uidVelho = uidEstavel(chaveNome('techniques', nomeVelho));
const antigoDoBanco = NOMES_ANTIGOS_DO_BANCO.find((n) => nomeDoCatalogo(n) && !NOMES_DO_CATALOGO.has(n.toLowerCase()));
const [a1, a2, a3] = cat;
const fin = cat.find((t) => t.cat === 'articular') || a3;
const T0 = 1_700_000_000_000;
/* nome que duas técnicas do catálogo usam (se houver): fica pendente sempre */
const doisOficiais = cat.flatMap((t) => [t.nome, t.antigo]).filter(Boolean).find((n) => resolverNome(n, []).ambiguo);

const ana = randomUUID();
const bia = randomUUID();
const tecAna = [
  { uid: randomUUID(), nome: 'Raspagem do Zé', criadoEm: T0 + 9e6 },                     // vira própria
  { uid: randomUUID(), nome: 'Pressão de ombro esquisita', criadoEm: T0 + 8e6 },         // vira própria
  { uid: randomUUID(), nome: 'Já marcada', criadoEm: T0, propria: 1 },
  { uid: a1.uid, nome: a1.nome, criadoEm: T0 },                                            // catálogo
  { uid: comJuntou.uids[1], nome: comJuntou.nome, criadoEm: T0 },                           // uid que juntou
  { uid: uidVelho, nome: nomeNovo, criadoEm: T0 },                                          // uid de nome antigo
  { uid: randomUUID(), nome: '  ' + a2.nome.toUpperCase() + ' ', criadoEm: T0 + 7e6 },      // aparelho velho: nome do catálogo
  { uid: randomUUID(), nome: antigoDoBanco || nomeVelho, criadoEm: T0 + 7e6 },
  { uid: randomUUID(), nome: 'Sem data nenhuma' },
  { nome: 'Sem código' },
  { uid: randomUUID(), nome: a3.nome, criadoEm: T0 + 6e6 },                                  // mesmo nome do catálogo: ambíguo
  ...Array.from({ length: 22 }, (_, i) => ({ uid: randomUUID(), nome: `Semente ${i}`, criadoEm: T0 + 1000 * i })),
  /* aparelho velho: a biblioteca com uid aleatório, nascida no mesmo minuto */
  { uid: randomUUID(), nome: comAntigo.nome, criadoEm: T0 + 30_000 },                          // cópia: vira o uid oficial
  { uid: randomUUID(), nome: a1.nome, criadoEm: T0 + 31_000 },                                  // cópia de uma que já está com o uid certo
  { uid: randomUUID(), nome: a3.nome, criadoEm: T0 + 32_000, propria: 1 },                      // própria: nunca vira catálogo
  ...(doisOficiais ? [{ uid: randomUUID(), nome: doisOficiais, criadoEm: T0 + 33_000 }] : []),
];
const tecBia = [
  { uid: randomUUID(), nome: 'Guarda da Bia', criadoEm: T0 + 5e6, arquivada: 1 },
  { uid: randomUUID(), nome: 'Outra da Bia', criadoEm: 'ontem' },
];

const rolasAna = [
  { subsAplicadas: [a1.nome, a1.nome, ' ' + a1.nome + ' '], subsSofridas: ['Raspagem do Zé'], tecMeus: { passagem: [a2.nome.toLowerCase()], raspagem: 'Inventada' } },
  { subsAplicadas: [comAntigo.antigo, nomeVelho, 'fam:armlock', ''], tecDele: { x: [a3.nome] } },
  { subsAplicadas: [a1.nome], tecUid: { [a1.uid]: a1.nome } },                               // já ligado
  { subsAplicadas: [] },
  { subsAplicadas: [''] },
  { subsAplicadas: [comAntigo.nome, comAntigo.nome.toUpperCase(), ...(doisOficiais ? [doisOficiais] : [])] },
];
const rolasBia = [{ subsAplicadas: ['Raspagem do Zé', 'Guarda da Bia', fin.nome] }];
const planosAna = [
  { pronto: 1, objetivo: a1.nome, passos: [{ acao: a1.nome }] },                              // pronto: fora
  {
    objetivoTipo: 'finalizar', finalizacaoPreferida: fin.nome, finalizacoesAceitas: ['fam:kimura', a1.nome, 'Nada'],
    passos: [
      { tipo: 'finta', acao: 'Finge que vai' },
      { tipo: 'golpe', acao: a1.nome },
      { tipo: 'golpe', acao: a3.nome },
      { tipo: 'golpe', acao: 'fam:armlock' },
      { tipo: 'situacao', acao: a2.nome },
      { tipo: 'golpe', acao: '   ' },
      { tipo: 'golpe', acao: 'Raspagem do Zé', golpeUid: 'x' },
    ],
  },
  { objetivo: 'Raspagem do Zé', passos: [{ acao: comAntigo.antigo }] },                        // formato antigo
  { objetivoTipo: 'posicao', objetivo: a2.nome, passos: [] },
];
const metasAna = [
  { tipo: 'tecnica', alvo: a1.nome }, { tipo: 'defesa', alvo: 'Raspagem do Zé' },
  { tipo: 'defesa', alvo: ' ' }, { tipo: 'frequencia', alvo: a1.nome }, { tipo: 'tecnica', alvo: 3 },
];

const contas = [
  { user: ana, techniques: tecAna, rolls: rolasAna, attackPlans: planosAna, goals: metasAna },
  { user: bia, techniques: tecBia, rolls: rolasBia, attackPlans: [], goals: [{ tipo: 'tecnica', alvo: fin.nome }] },
];

/* referências (cada vez que o nome aparece) e técnicas diferentes que ganham o uid,
   pela mesma regra da passada (contar e uidDoGolpe, compatibilidade.js) */
function referencias(tab, registros, tecnicas) {
  let refs = 0;
  const tecs = new Set();
  const ligado = (nome, antes) => {
    const r = resolverNome(nome, tecnicas);
    return r.uid && !(antes && r.uid in antes) ? r.uid : null;
  };
  for (const g of registros) {
    if (tab === 'attackPlans' && g.pronto) continue;
    if (tab === 'goals' && !metaDeTecnica(g)) continue;
    const nomes = tab === 'rolls' ? nomesDoRola(g) : tab === 'attackPlans' ? nomesDoPlano(g) : nomesDaMeta(g);
    for (const n of nomes.map((x) => String(x || '').trim()).filter(Boolean)) {
      const u = ligado(n, g.tecUid);
      if (u) { refs++; tecs.add(u); }
    }
    if (tab !== 'attackPlans') continue;
    for (const x of g.passos || []) {
      if (x?.tipo === 'finta' || !String(x?.acao || '').trim()) continue;
      const u = uidDoGolpe(x, tecnicas);
      if (u && !(x.golpeUid && u === x.golpeUid)) { refs++; tecs.add(u); }
    }
  }
  return { refs, tecnicas: tecs.size };
}

/* ---------- o que o app diz ---------- */
const esperado = new Map();
const soma = (k, n) => esperado.set(k, (esperado.get(k) || 0) + n);
for (const c of contas) {
  const m = await marcarProprias(c.techniques, { simular: true });
  soma('técnicas: já marcadas como própria', m.jaMarcadas);
  soma('técnicas: do catálogo', m.catalogo);
  soma('técnicas: viram própria (com prova)', m.marcadas);
  soma('técnicas duvidosas: sem código', m.motivos.sem_uid || 0);
  soma('técnicas duvidosas: nome do catálogo', m.motivos.nome_do_catalogo || 0);
  soma('técnicas duvidosas: sem data', m.motivos.sem_data || 0);
  soma('técnicas duvidosas: nasceram com a biblioteca', m.motivos.nasceu_com_a_biblioteca || 0);
  soma('contas com técnica que vira própria', m.marcadas ? 1 : 0);
  const dados = { ...c, rolls: c.rolls.map((r, i) => ({ id: i, ...r })) };
  const { numeros } = passadaDeIdentidade(dados, { simular: true });
  const soCatalogo = passadaDeIdentidade({ ...dados, techniques: [] }, { simular: true }).numeros;
  const ambiguos = (n) => n.rolls.ambiguos + n.attackPlans.ambiguos + n.goals.ambiguos;
  soma('pendentes: dois nomes oficiais iguais', ambiguos(soCatalogo));
  soma('pendentes: cópia sem prova de ser do catálogo', ambiguos(numeros) - ambiguos(soCatalogo));
  const comNome = c.techniques.filter((t) => t.uid && t.nome);
  const deFora = (t) => origemDaTecnica(t.uid) === 'propria';
  soma('cópias antigas do catálogo que passam a responder pelo uid oficial',
    comNome.filter((t) => deFora(t) && uidOficial(t.uid, c.techniques) !== t.uid).length);
  soma('técnicas com nome do catálogo sem prova (ficam com o uid delas)',
    comNome.filter((t) => deFora(t) && !t.propria && nomeDoCatalogo(t.nome) && uidOficial(t.uid, c.techniques) === t.uid).length);
  const porUid = new Map();
  for (const t of comNome) { const u = uidOficial(t.uid, c.techniques); porUid.set(u, (porUid.get(u) || 0) + 1); }
  soma('uids oficiais com mais de uma técnica na mesma conta (nada é apagado)', [...porUid.values()].filter((n) => n > 1).length);
  for (const [tab, nome] of [['rolls', 'rolas'], ['attackPlans', 'planos'], ['goals', 'metas']]) {
    const n = numeros[tab];
    soma(`${nome}: registros com técnica`, n.registros);
    soma(`${nome}: registros que mudam`, n.alterados);
    soma(`${nome}: nomes que ganham o uid`, n.ligados);
    soma(`${nome}: nomes já ligados`, n.jaLigados);
    soma(`${nome}: nomes ambíguos (ficam como estão)`, n.ambiguos);
    soma(`${nome}: nomes sem par (ficam como estão)`, n.semPar);
    const rt = referencias(tab, dados[tab], c.techniques);
    soma(`${nome}: referências que ganham o uid (cada vez que o nome aparece)`, rt.refs);
    soma(`${nome}: técnicas diferentes que ganham o uid`, rt.tecnicas);
  }
}

/* ---------- o que o SQL diz ---------- */
const pg = new PGlite();
await pg.exec(`create table public.registros (id uuid primary key, user_id uuid not null, tabela text not null,
  dados jsonb not null, created_at timestamptz default now(), updated_at timestamptz default now(), deleted_at timestamptz)`);
const inserir = (user, tabela, dados, deletado = false) => pg.query(
  'insert into public.registros (id, user_id, tabela, dados, deleted_at) values ($1, $2, $3, $4, $5)',
  [randomUUID(), user, tabela, tabela === 'techniques' || dados.uid ? dados : { uid: randomUUID(), ...dados }, deletado ? new Date().toISOString() : null],
);
for (const c of contas) {
  for (const tabela of ['techniques', 'rolls', 'attackPlans', 'goals']) {
    for (const d of c[tabela]) await inserir(c.user, tabela, d);
  }
}
/* apagadas e de outra tabela não entram */
await inserir(ana, 'techniques', { uid: randomUUID(), nome: 'Apagada', criadoEm: T0 + 4e6 }, true);
await inserir(ana, 'rolls', { subsAplicadas: [a1.nome] }, true);
await inserir(ana, 'sessions', { subsAplicadas: [a1.nome] });

const linhas = (await pg.query(sql)).rows;
const obtido = new Map(linhas.map((l) => [l.o_que, Number(l.numero)]));
ok(linhas.length === esperado.size, `o SQL devolve ${linhas.length} linhas, o app ${esperado.size}`);
for (const [k, v] of esperado) ok(obtido.get(k) === v, `${k}: app ${v}, SQL ${obtido.get(k)}`);

/* o teste só vale se os casos aparecem */
for (const k of ['técnicas: viram própria (com prova)', 'técnicas duvidosas: nome do catálogo', 'técnicas duvidosas: sem data',
  'técnicas duvidosas: nasceram com a biblioteca', 'técnicas duvidosas: sem código', 'técnicas: do catálogo',
  'rolas: nomes que ganham o uid', 'rolas: referências que ganham o uid (cada vez que o nome aparece)', 'rolas: nomes já ligados', 'rolas: nomes ambíguos (ficam como estão)', 'rolas: nomes sem par (ficam como estão)',
  'planos: nomes que ganham o uid', 'planos: nomes ambíguos (ficam como estão)', 'planos: nomes sem par (ficam como estão)', 'metas: nomes que ganham o uid',
  'cópias antigas do catálogo que passam a responder pelo uid oficial', 'técnicas com nome do catálogo sem prova (ficam com o uid delas)',
  'pendentes: cópia sem prova de ser do catálogo', 'uids oficiais com mais de uma técnica na mesma conta (nada é apagado)',
  ...(doisOficiais ? ['pendentes: dois nomes oficiais iguais'] : [])]) {
  ok(esperado.get(k) > 0, `caso sem exemplo no teste: ${k}`);
}

if (process.argv.includes("--ver")) console.table(Object.fromEntries(obtido));

/* ============================================================
   58 E 59 EM SIMULAÇÃO: cópia, passada (como o sync sobe), comparação
   ============================================================ */
const SQL59 = await fs.readFile(new URL('../supabase/59-comparar-depois-da-passada.sql', import.meta.url), 'utf8');
const comparar = async () => new Map((await pg.query(SQL59)).rows.map((l) => [Number(l.n), l]));
const ver59 = (m) => { if (process.argv.includes('--ver')) console.table([...m.values()].map(({ n, o_que, resultado, numero }) => ({ n, o_que: o_que.slice(0, 60), resultado, numero: Number(numero) }))); };
const r59 = (m, n) => [m.get(n).resultado, Number(m.get(n).numero)];
const ZERO = [3, 4, 5, 6, 11, 13, 14, 15, 19];
const previstos = ['rolas', 'planos', 'metas'].reduce((t, x) => t + esperado.get(`${x}: registros que mudam`), 0) + esperado.get('técnicas: viram própria (com prova)');
const noEscopo = ['rolas', 'planos', 'metas'].reduce((t, x) => t + esperado.get(`${x}: registros com técnica`), 0) + esperado.get('técnicas: viram própria (com prova)');

await pg.exec(sqlCopia);
const copia = (await pg.query('select c.*, r.dados = c.dados as igual from copias.passada_identidade c join public.registros r on r.id = c.id')).rows;
ok(copia.length === noEscopo, `58: copia ${copia.length}, o escopo (registros com técnica + técnicas que viram própria) é ${noEscopo}`);
ok(copia.filter((c) => c.previsto).length === previstos, `58: previstos ${copia.filter((c) => c.previsto).length}, o app diz ${previstos}`);
ok(copia.every((c) => c.igual && c.user_id && c.tabela && c.created_at && c.updated_at), '58: a linha inteira, igual à da tabela, com conta, tabela e datas');
const fora = (await pg.query(`select count(*)::int n from copias.passada_identidade c join public.registros r on r.id = c.id
  where r.deleted_at is not null or r.tabela not in ('rolls', 'attackPlans', 'goals', 'techniques')
     or (r.tabela = 'attackPlans' and r.dados ? 'pronto') or (r.tabela = 'goals' and r.dados->>'tipo' = 'frequencia')`)).rows[0].n;
ok(fora === 0, `58: ${fora} registro(s) fora do escopo copiados (apagado, outra tabela, plano pronto, meta de frequência)`);
let erro58 = '';
try { await pg.exec(sqlCopia); } catch (e) { erro58 = e.message; }
await pg.exec('rollback').catch(() => {});
ok(/already exists/.test(erro58), `58 de novo: tem que recusar (veio "${erro58}")`);
ok((await pg.query('select count(*)::int n from copias.passada_identidade')).rows[0].n === copia.length, '58 de novo: a cópia continua a mesma');

let m = await comparar();
ok(ZERO.every((n) => m.get(n).resultado === 'ok'), '59 antes da passada: nenhuma divergência');
ok(JSON.stringify([r59(m, 7), r59(m, 9)]) === JSON.stringify([['info', 0], ['ATENÇÃO', previstos]]), `59 antes: nada mudou e os ${previstos} previstos aparecem como "ainda não mudaram"`);

/* a passada do app em cada conta, gravada como o sync grava (dados inteiros, hora nova) */
const doBanco = async (user, tabela) => (await pg.query('select id, dados from public.registros where user_id = $1 and tabela = $2 and deleted_at is null', [user, tabela]))
  .rows.map((l) => ({ ...l.dados, id: l.id }));
let gravados = 0;
for (const c of contas) {
  const d = Object.fromEntries(await Promise.all(['rolls', 'attackPlans', 'goals', 'techniques'].map(async (t) => [t, await doBanco(c.user, t)])));
  const { patches } = passadaDeIdentidade(d, { simular: false });
  const marcas = (await marcarProprias(d.techniques, { simular: true })).patches.map((x) => ({ id: x.id, patch: x.patch }));
  for (const x of [...patches, ...marcas]) {
    await pg.query(`update public.registros set dados = dados || $2::jsonb || jsonb_build_object('updatedAt', $3::bigint), updated_at = now() where id = $1`,
      [x.id, JSON.stringify(x.patch), Date.now()]);
    gravados++;
  }
}
ok(gravados === previstos, `a passada do app mudou ${gravados} registros, a cópia previa ${previstos}`);

m = await comparar();
ver59(m);
ok(ZERO.every((n) => m.get(n).resultado === 'ok'), `59 depois da passada: nenhuma divergência (${ZERO.filter((n) => m.get(n).resultado !== 'ok').join(', ')})`);
ok(JSON.stringify([r59(m, 7), r59(m, 8), r59(m, 9), r59(m, 10), r59(m, 21)]) === JSON.stringify([['info', previstos], ['info', previstos], ['ok', 0], ['ok', 0], ['ok', 0]]), '59 depois: mudou exatamente o previsto, e nada mudou só a hora');
ok(Number(m.get(12).numero) > 0 && Number(m.get(17).numero) > 0, '59 depois: aparecem uids novos no tecUid e golpeUid novo nas peças');
ok(JSON.stringify(r59(m, 20)) === JSON.stringify(['info', esperado.get('técnicas: viram própria (com prova)')]), '59 depois: as técnicas que viram própria');
ok(JSON.stringify(r59(m, 18)) === JSON.stringify(['ATENÇÃO', 1]), '59 depois: a peça com golpeUid que não resolvia ganhou o uid certo (aparece pra conferir)');
const de57 = new Map((await pg.query(sql)).rows.map((l) => [l.o_que, Number(l.numero)]));
ok(['rolas', 'planos', 'metas'].every((x) => de57.get(`${x}: nomes que ganham o uid`) === 0 && de57.get(`${x}: registros que mudam`) === 0), '57 depois da passada: nada mais a ligar');
ok(['rolas', 'planos', 'metas'].every((x) => de57.get(`${x}: nomes já ligados`) === esperado.get(`${x}: nomes já ligados`) + esperado.get(`${x}: nomes que ganham o uid`)), '57 depois: os ligados viraram "já ligados"');

/* sabotagem: cada coisa que não podia acontecer aparece no 59, com o id */
const umDe = async (tabela, cond = 'true') => (await pg.query(`select c.id, r.dados from copias.passada_identidade c join public.registros r on r.id = c.id where c.tabela = $1 and c.previsto and ${cond} limit 1`, [tabela])).rows[0];
const rolaMudada = await umDe('rolls');
await pg.query(`update public.registros set dados = dados || '{"placar":"mexido"}' where id = $1`, [rolaMudada.id]);
const comAntigo59 = (await pg.query(`select c.id, c.dados from copias.passada_identidade c where c.tabela = 'rolls' and jsonb_typeof(c.dados->'tecUid') = 'object' and c.dados->'tecUid' <> '{}' limit 1`)).rows[0]; // tecUid que já existia antes
const k0 = Object.keys(comAntigo59.dados.tecUid)[0];
await pg.query(`update public.registros set dados = jsonb_set(dados, array['tecUid', $2], '"Outro nome"') where id = $1`, [comAntigo59.id, k0]);
const meta59 = await umDe('goals');
await pg.query(`update public.registros set dados = jsonb_set(dados, '{tecUid,nao-e-uid}', '"Nome que não está"') where id = $1`, [meta59.id]);
const plano59 = (await pg.query(`select c.id, r.dados from copias.passada_identidade c join public.registros r on r.id = c.id
  where c.tabela = 'attackPlans' and exists (select 1 from jsonb_array_elements(c.dados->'passos') x where coalesce(x->>'golpeUid', '') <> '') limit 1`)).rows[0]; // peça que já tinha golpeUid antes
const ip = (await pg.query('select dados from copias.passada_identidade where id = $1', [plano59.id])).rows[0].dados.passos.findIndex((x) => x.golpeUid);
await pg.query(`update public.registros set dados = dados #- array['passos', $2, 'golpeUid'] where id = $1`, [plano59.id, String(ip)]);
const tec59 = await umDe('techniques');
await pg.query(`update public.registros set dados = dados - 'propria' where id = $1`, [tec59.id]);
const dup = (await pg.query('select user_id, tabela, dados from public.registros where id = $1', [meta59.id])).rows[0];
await pg.query('insert into public.registros (id, user_id, tabela, dados) values ($1, $2, $3, $4)', [randomUUID(), dup.user_id, dup.tabela, dup.dados]);
const apagar = await umDe('goals', `r.id <> '${meta59.id}'`);
await pg.query('delete from public.registros where id = $1', [apagar.id]);
m = await comparar();
ver59(m);
const acusou = (n, quem) => m.get(n).resultado === 'DIVERGE' && (m.get(n).exemplos || []).includes(quem);
ok(acusou(11, rolaMudada.id), '59 acusa campo intacto que mudou (placar), com o id');
ok(acusou(15, comAntigo59.id), '59 acusa tecUid antigo com o nome reescrito');
ok(acusou(13, meta59.id) && acusou(14, meta59.id), '59 acusa uid novo sem o nome no registro e com formato errado');
ok(acusou(19, plano59.id), '59 acusa peça que perdeu o golpeUid');
ok(m.get(21).resultado === 'ATENÇÃO' && (m.get(21).exemplos || []).includes(tec59.id), '59 aponta a técnica que devia virar própria e só mudou a hora');
ok(acusou(6, meta59.id), '59 acusa duplicado (outra linha viva com o mesmo uid)');
ok(acusou(3, apagar.id), '59 acusa registro que sumiu');

if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1); }
console.log(`teste-simulacao-tecnicas: SQL 57 bate com o app (${esperado.size} números, ${linhas.length} linhas); 58 copia ${copia.length} (${previstos} previstos); 59 limpo depois da passada e acusa as 7 sabotagens`);
await pg.close();
