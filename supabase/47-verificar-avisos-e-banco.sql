-- 47: SOMENTE LEITURA. Confere o aviso de todo dia, a faxina e o tamanho
-- do banco. Rode e mande o resultado (as linhas da tabela).
select 'aviso do dia instalado (SQL 45)' as o_que,
       (select bool_or(p.prosrc like '%''dia:''%') from pg_proc p where p.proname = 'fila_de_notificacao')::text as resultado
union all
select 'faxina agendada (SQL 46)',
       coalesce((select j.schedule from cron.job j where j.jobname = 'faxina'), 'NÃO')
union all
select 'aparelhos com aviso ligado',
       (select count(distinct i.user_id) from public.push_inscricao i join public.perfil p on p.user_id = i.user_id
        where p.notificar and i.falhas < 5)::text
union all
select * from (
  select 'avisos em ' || to_char(n.dia, 'DD/MM') || ' (pessoas)',
         count(distinct n.user_id)::text || ' pessoas, ' || count(*) || ' avisos'
         || coalesce(', ' || count(*) filter (where n.tipo like 'dia:%') || ' do dia', '')
  from public.notificacao_envio n
  where n.dia >= current_date - 7
  group by n.dia
  order by n.dia desc
) dias
union all
select 'banco inteiro',
       pg_size_pretty(pg_database_size(current_database())) || ' (' ||
       round(100.0 * pg_database_size(current_database()) / (500 * 1024 * 1024), 1) || '% de 500 MB)'
union all
select 'histórico do agendador',
       pg_size_pretty(pg_total_relation_size('cron.job_run_details')) || ', ' ||
       (select count(*) from cron.job_run_details) || ' linhas';
