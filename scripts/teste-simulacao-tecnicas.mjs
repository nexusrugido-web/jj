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

export function gerarSql() {
  const indice = new Set();
  const doCatalogo = new Map();
  for (const t of CATALOGO_TECNICAS) {
    indice.add(JSON.stringify([chave(t.nome), t.uid]));
    if (t.antigo) indice.add(JSON.stringify([chave(t.antigo), t.uid]));
    doCatalogo.set(chave(t.nome), t.uid);
  }
  const renomeados = [...new Set(Object.keys(RENOMEAR).map((n) => uidEstavel(chaveNome('techniques', n))))];
  const finais = [...new Set([...NOMES_ANTIGOS_DO_BANCO, ...Object.keys(RENOMEAR)])].filter((n) => nomeDoCatalogo(n));

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

with
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
  select user_id, dados, dados->>'uid' as uid, dados->>'nome' as nome,
         case when jsonb_typeof(dados->'criadoEm') = 'number' then (dados->>'criadoEm')::numeric end as criado,
         case jsonb_typeof(dados->'propria')
           when 'number' then (dados->>'propria')::numeric <> 0
           when 'boolean' then (dados->>'propria')::boolean
           when 'string' then dados->>'propria' <> ''
           when 'object' then true when 'array' then true else false end as propria
  from reg where tabela = 'techniques'
),

/* ---------- parte 1: de onde vem cada técnica ---------- */
origem as (
  select t.user_id, case
    when t.propria then 'ja_marcada'
    when coalesce(t.uid, '') = '' then 'sem_uid'
    when t.uid in (select uid from principal) or t.uid in (select uid from renomeados) then 'catalogo'
    when ${sqlLimpo('t.nome')} in (select k from nomes_catalogo) or t.nome in (select de from final_do_catalogo) then 'nome_do_catalogo'
    when t.criado is null then 'sem_data'
    when (select count(*) from tec v where v.user_id = t.user_id and v.criado is not null
          and abs(v.criado - t.criado) <= 60000) >= 20 then 'nasceu_com_a_biblioteca'
    else 'marcar' end as o
  from tec t
),

/* ---------- parte 2: o índice de nomes de cada conta ---------- */
tec_indice as (
  select t.user_id, ${sqlChave('t.nome')} as chave,
         case when p.p is not null then p.p
              when t.uid in (select uid from renomeados) then coalesce(
                (select dc.uid from do_catalogo dc where dc.chave = ${sqlChave('t.nome')}), t.uid)
              else t.uid end as uid
  from tec t left join principal p on p.uid = t.uid
  where coalesce(t.uid, '') <> '' and coalesce(t.nome, '') <> ''
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
  select n.*, case when n.nome like 'fam:%' then 0 else r.qtd end as qtd, r.u
  from nomes n, lateral (
    select count(distinct a.uid) as qtd, min(a.uid) as u from (
      select ci.uid from cat_indice ci where ci.chave = ${sqlChave('n.nome')}
      union all
      select ti.uid from tec_indice ti where ti.user_id = n.user_id and ti.chave = ${sqlChave('n.nome')}
    ) a
  ) r
),
estado_nomes as (
  select tabela, id, case
    when qtd = 1 and jsonb_typeof(antes) = 'object' and antes ? u then 'ja_ligado'
    when qtd = 1 then 'ligado'
    when qtd > 1 then 'ambiguo'
    else 'sem_par' end as e
  from resolvidos
),
/* a peça do plano: o golpe ganha uid; situação (posição) nunca */
estado_pecas as (
  select 'attackPlans' as tabela, c.id, case
    when coalesce(c.peca->>'golpeUid', '') <> '' and g.u = c.peca->>'golpeUid' then 'ja_ligado'
    when g.u is not null then 'ligado'
    when a.qtd > 1 then 'ambiguo'
    else 'sem_par' end as e
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
    select case when (c.peca->>'acao') like 'fam:%' then 0 else count(distinct b.uid) end as qtd from (
      select ci.uid from cat_indice ci where ci.chave = ${sqlChave("(c.peca->>'acao')")}
      union all
      select ti.uid from tec_indice ti where ti.user_id = c.user_id and ti.chave = ${sqlChave("(c.peca->>'acao')")}
    ) b
  ) a
),
estados as (select * from estado_nomes union all select * from estado_pecas),
partes(tabela, nome, ordem) as (values ('rolls', 'rolas', 10), ('attackPlans', 'planos', 20), ('goals', 'metas', 30))

select o_que, numero from (
  select 1 as ordem, 'técnicas: já marcadas como própria' as o_que, count(*) filter (where o = 'ja_marcada') as numero from origem
  union all select 2, 'técnicas: do catálogo', count(*) filter (where o = 'catalogo') from origem
  union all select 3, 'técnicas: viram própria (com prova)', count(*) filter (where o = 'marcar') from origem
  union all select 4, 'técnicas duvidosas: sem código', count(*) filter (where o = 'sem_uid') from origem
  union all select 5, 'técnicas duvidosas: nome do catálogo', count(*) filter (where o = 'nome_do_catalogo') from origem
  union all select 6, 'técnicas duvidosas: sem data', count(*) filter (where o = 'sem_data') from origem
  union all select 7, 'técnicas duvidosas: nasceram com a biblioteca', count(*) filter (where o = 'nasceu_com_a_biblioteca') from origem
  union all select 8, 'contas com técnica que vira própria', count(distinct user_id) filter (where o = 'marcar') from origem
  union all select p.ordem + 1, p.nome || ': registros com técnica', (select count(*) from registros_t g where g.tabela = p.tabela) from partes p
  union all select p.ordem + 2, p.nome || ': registros que mudam', (select count(distinct e.id) from estados e where e.tabela = p.tabela and e.e = 'ligado') from partes p
  union all select p.ordem + 3, p.nome || ': nomes que ganham o uid', (select count(*) from estados e where e.tabela = p.tabela and e.e = 'ligado') from partes p
  union all select p.ordem + 4, p.nome || ': nomes já ligados', (select count(*) from estados e where e.tabela = p.tabela and e.e = 'ja_ligado') from partes p
  union all select p.ordem + 5, p.nome || ': nomes ambíguos (ficam como estão)', (select count(*) from estados e where e.tabela = p.tabela and e.e = 'ambiguo') from partes p
  union all select p.ordem + 6, p.nome || ': nomes sem par (ficam como estão)', (select count(*) from estados e where e.tabela = p.tabela and e.e = 'sem_par') from partes p
) x
order by ordem;
`;
}

const sql = gerarSql();
if (process.argv.includes('--gerar')) {
  await fs.writeFile(ARQUIVO, sql);
  console.log('supabase/57-simulacao-tecnicas.sql gerado');
  process.exit(0);
}

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { falhas++; console.error('FALHOU:', msg); } };

const noArquivo = await fs.readFile(ARQUIVO, 'utf8').catch(() => '');
ok(noArquivo === sql, 'o SQL 57 está desatualizado com o catálogo: rode node scripts/teste-simulacao-tecnicas.mjs --gerar');

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
  const { numeros } = passadaDeIdentidade({ ...c, rolls: c.rolls.map((r, i) => ({ id: i, ...r })) }, { simular: true });
  for (const [tab, nome] of [['rolls', 'rolas'], ['attackPlans', 'planos'], ['goals', 'metas']]) {
    const n = numeros[tab];
    soma(`${nome}: registros com técnica`, n.registros);
    soma(`${nome}: registros que mudam`, n.alterados);
    soma(`${nome}: nomes que ganham o uid`, n.ligados);
    soma(`${nome}: nomes já ligados`, n.jaLigados);
    soma(`${nome}: nomes ambíguos (ficam como estão)`, n.ambiguos);
    soma(`${nome}: nomes sem par (ficam como estão)`, n.semPar);
  }
}

/* ---------- o que o SQL diz ---------- */
const pg = new PGlite();
await pg.exec(`create table public.registros (id text primary key, user_id uuid not null, tabela text not null,
  dados jsonb not null, updated_at timestamptz default now(), deleted_at timestamptz)`);
const inserir = (user, tabela, dados, deletado = false) => pg.query(
  'insert into public.registros (id, user_id, tabela, dados, deleted_at) values ($1, $2, $3, $4, $5)',
  [randomUUID(), user, tabela, dados, deletado ? new Date().toISOString() : null],
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
  'rolas: nomes que ganham o uid', 'rolas: nomes já ligados', 'rolas: nomes ambíguos (ficam como estão)', 'rolas: nomes sem par (ficam como estão)',
  'planos: nomes que ganham o uid', 'planos: nomes ambíguos (ficam como estão)', 'planos: nomes sem par (ficam como estão)', 'metas: nomes que ganham o uid']) {
  ok(esperado.get(k) > 0, `caso sem exemplo no teste: ${k}`);
}

if (process.argv.includes("--ver")) console.table(Object.fromEntries(obtido));
if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1); }
console.log(`teste-simulacao-tecnicas: SQL 57 bate com o app (${esperado.size} números, ${linhas.length} linhas)`);
await pg.close();
