-- SOMENTE LEITURA. Separa as respostas guardadas pelo banco (ultimas ~6h)
-- pelo formato: a funcao de avisos responde {"fila":..,"enviados":..} ou
-- {"erro":"chave invalida"}; qualquer outra coisa vem de outra chamada
-- (webhook de vendas, n8n...). Mostra tambem o que a fila mandaria agora.
select 'resposta' as o_que,
       case when h.content like '%"fila"%' then 'funcao de avisos: ok'
            when h.content like '%chave invalida%' then 'funcao de avisos: chave recusada'
            else 'outra chamada' end as origem,
       h.status_code, left(coalesce(h.error_msg, h.content), 90) as exemplo,
       count(*) as quantas,
       to_char(max(h.created) at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as ultima
from net._http_response h
group by 2, 3, 4
union all
select 'cron notificar: ultimas chamadas', left(r.status, 20), null,
       left(r.return_message, 90), count(*),
       to_char(max(r.start_time) at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
from cron.job_run_details r join cron.job j on j.jobid = r.jobid and j.jobname = 'notificar'
where r.start_time > now() - interval '1 day'
group by 2, 4
union all
select 'outros crons que chamam a internet', j.jobname, null, left(j.command, 90), null, j.schedule
from cron.job j where j.command ilike '%http%' and j.jobname <> 'notificar'
order by 1, 5 desc nulls last;
