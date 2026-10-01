-- SOMENTE LEITURA. Quanto o banco ocupa e o que mais pesa.
-- O plano gratis do Supabase vai ate 500 MB de banco. Rodar SQL (criar
-- funcao, tabela) quase nao ocupa nada: o que cresce sao os dados.
select 'banco inteiro' as o_que,
       pg_size_pretty(pg_database_size(current_database())) as tamanho,
       round(100.0 * pg_database_size(current_database()) / (500 * 1024 * 1024), 1) || '% de 500 MB' as uso,
       null::bigint as linhas
union all
select * from (
  select n.nspname || '.' || c.relname,
         pg_size_pretty(pg_total_relation_size(c.oid)),
         null,
         c.reltuples::bigint
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname in ('public', 'auth', 'cron', 'net', 'storage')
  order by pg_total_relation_size(c.oid) desc
  limit 15
) maiores;
