-- ============================================================
-- 59: COMPARAÇÃO DEPOIS DA PASSADA DE IDENTIDADE (TRILHA T, T5c)
--
-- Só leitura. Compara a cópia do SQL 58 (copias.passada_identidade) com
-- public.registros, registro por registro (pelo id). Pode rodar quantas
-- vezes quiser: antes de ligar (tudo "previsto que não mudou"), no meio e
-- depois. Rode também o SQL 57 de novo: "nomes que ganham o uid" tem que
-- cair a zero nos registros que já passaram.
--
-- Resultado de cada linha:
--   ok        deu o esperado
--   DIVERGE   não podia acontecer: olhe os exemplos (ids) antes de seguir
--   ATENÇÃO   pode ser normal, mas precisa de explicação (ver a linha)
--   info      só a contagem
--
-- O que a passada pode mudar: tecUid (rola, plano, meta), golpeUid (peça
-- do plano), propria (técnica) e a hora (updatedAt). Todo o resto do
-- registro tem que estar igual ao da cópia.
--
-- Uma edição do aluno depois da cópia também aparece como "campos que
-- deviam ficar intactos mudaram": confira os ids antes de concluir.
--
-- Cole no SQL Editor do Supabase e rode.
-- ============================================================

with
par as (
  select c.id, c.tabela, c.user_id, c.previsto, c.iguais_no_uid,
         c.dados as antes, r.dados as depois, r.id is not null as existe,
         r.deleted_at, r.user_id as user_depois, r.tabela as tabela_depois
    from copias.passada_identidade c
    left join public.registros r on r.id = c.id
),
vivos as (
  select * from par
   where existe and deleted_at is null and user_depois = user_id and tabela_depois = tabela
),

/* o registro sem os campos que a passada pode mudar */
lados as (
  select v.id, l.lado, case
    when v.tabela = 'techniques' then l.d - 'propria' - 'updatedAt'
    when v.tabela = 'attackPlans' and jsonb_typeof(l.d->'passos') = 'array' then
      (l.d - 'tecUid' - 'updatedAt' - 'passos') || jsonb_build_object('passos', coalesce((
        select jsonb_agg(case when jsonb_typeof(x) = 'object' then x - 'golpeUid' else x end order by i)
          from jsonb_array_elements(l.d->'passos') with ordinality t(x, i)), '[]'::jsonb))
    else l.d - 'tecUid' - 'updatedAt' end as fixo
  from vivos v, lateral (values ('antes', v.antes), ('depois', v.depois)) l(lado, d)
),
fixos as (
  select a.id, a.fixo as antes, d.fixo as depois
    from lados a join lados d on d.id = a.id and d.lado = 'depois'
   where a.lado = 'antes'
),

/* tecUid: o mapa { uid: nome na época } */
tec as (
  select v.id, v.depois,
         case when jsonb_typeof(v.antes->'tecUid') = 'object' then v.antes->'tecUid' else '{}'::jsonb end as ta,
         case when jsonb_typeof(v.depois->'tecUid') = 'object' then v.depois->'tecUid' else '{}'::jsonb end as td
    from vivos v
),
tec_novos as (
  select t.id, k, t.td->>k as nome, t.depois
    from tec t, jsonb_object_keys(t.td) k
   where not t.ta ? k
),

/* peças do plano, pela posição */
pecas as (
  select v.id, i,
         nullif(v.antes->'passos'->(i::int - 1)->>'golpeUid', '') as ga,
         nullif(x->>'golpeUid', '') as gd
    from vivos v, jsonb_array_elements(case when jsonb_typeof(v.depois->'passos') = 'array' then v.depois->'passos' else '[]' end)
         with ordinality t(x, i)
   where v.tabela = 'attackPlans'
),

/* propria: 1 / true / '1' */
prop as (
  select v.id,
         coalesce(v.antes->>'propria', '') in ('1', 'true') as pa,
         coalesce(v.depois->>'propria', '') in ('1', 'true') as pd
    from vivos v where v.tabela = 'techniques'
),

achados(chk, id) as (
  select 1, id from par
  union all select 2, id from par where previsto
  union all select 3, id from par where not existe
  union all select 4, id from par where existe and deleted_at is not null
  union all select 5, id from par where existe and (user_depois <> user_id or tabela_depois <> tabela)
  union all select 6, v.id from vivos v
   where (select count(*) from public.registros d
           where d.user_id = v.user_id and d.tabela = v.tabela and d.deleted_at is null
             and d.dados->>'uid' is not distinct from v.depois->>'uid') > v.iguais_no_uid
  union all select 7, id from vivos where antes <> depois
  union all select 8, id from vivos where antes <> depois and previsto
  union all select 9, id from vivos where antes = depois and previsto
  union all select 10, id from vivos where antes <> depois and not previsto
  union all select 11, id from fixos where antes <> depois
  union all select 12, id from tec_novos
  union all select 13, n.id from tec_novos n
   where not exists (
     select 1 from jsonb_path_query(n.depois - 'tecUid', '$.**') j
      where jsonb_typeof(j) = 'string' and regexp_replace(j #>> '{}', '^\s+|\s+$', '', 'g') = n.nome)
  union all select 14, id from tec_novos
   where k !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  union all select 15, t.id from tec t, jsonb_object_keys(t.ta) k
   where t.td ? k and (t.td->k) <> (t.ta->k)
  union all select 16, t.id from tec t, jsonb_object_keys(t.ta) k
   where not t.td ? k
  union all select 17, id from pecas where ga is null and gd is not null
  union all select 18, id from pecas where ga is not null and gd is not null and ga <> gd
  union all select 19, id from pecas where ga is not null and gd is null
  union all select 20, id from prop where pd and not pa
  union all select 21, id from vivos where antes <> depois and (antes - 'updatedAt') = (depois - 'updatedAt')
),
verificacoes(chk, tipo, o_que) as (values
  (1,  'info',    'registros na cópia'),
  (2,  'info',    'previstos para mudar (simulação da nuvem)'),
  (3,  'zero',    'sumiram da tabela (apagados de vez)'),
  (4,  'zero',    'apagados depois da cópia (deleted_at)'),
  (5,  'zero',    'mudaram de conta ou de tabela'),
  (6,  'zero',    'duplicados: mais linhas vivas com o mesmo uid do que na cópia'),
  (7,  'info',    'registros que mudaram'),
  (8,  'info',    'previstos que mudaram'),
  (9,  'atencao', 'previstos que ainda não mudaram (aparelho que ainda não rodou a passada?)'),
  (10, 'atencao', 'mudaram sem estar previstos (o aparelho ligou mais do que a nuvem previa; ok se a linha 11 deu zero)'),
  (11, 'zero',    'campos que deviam ficar intactos mudaram'),
  (12, 'info',    'uids novos no tecUid (cada par registro e uid)'),
  (13, 'zero',    'uid novo cujo nome não está no registro'),
  (14, 'zero',    'uid novo com formato que não é de uid'),
  (15, 'zero',    'tecUid antigo com o nome reescrito'),
  (16, 'atencao', 'tecUid antigo removido (só se o nome saiu do registro)'),
  (17, 'info',    'peças de plano que ganharam golpeUid'),
  (18, 'atencao', 'peças com golpeUid trocado (cópia antiga virou o uid oficial)'),
  (19, 'zero',    'peças que perderam o golpeUid'),
  (20, 'info',    'técnicas que ganharam propria'),
  (21, 'atencao', 'mudou só a hora (sem uid novo, sem propria): a passada devia ter mudado algo mais')
)
select v.chk as n, v.o_que,
       case when v.tipo = 'info' then 'info'
            when count(a.id) = 0 then 'ok'
            when v.tipo = 'zero' then 'DIVERGE'
            else 'ATENÇÃO' end as resultado,
       count(a.id) as numero,
       case when v.tipo = 'info' then null
            else (array_agg(distinct a.id::text) filter (where a.id is not null))[1:5] end as exemplos
  from verificacoes v left join achados a on a.chk = v.chk
 group by v.chk, v.tipo, v.o_que
 order by v.chk;

-- ============================================================
-- RESTAURAR (não rode sem decidir antes; está comentado de propósito)
-- A cópia tem a linha inteira. Restaurar na nuvem não basta: o aparelho só
-- aceita a versão da nuvem se o updatedAt dela for mais novo, e o aparelho
-- que já rodou a passada não roda de novo (marca identidade_t). Por isso o
-- updatedAt vai com a hora de agora. Filtre pelos ids que precisam voltar.
--
-- update public.registros r
--    set dados = c.dados || jsonb_build_object('updatedAt', (extract(epoch from now()) * 1000)::bigint),
--        updated_at = now()
--   from copias.passada_identidade c
--  where r.id = c.id and r.id in ( /* ids */ );
-- ============================================================
