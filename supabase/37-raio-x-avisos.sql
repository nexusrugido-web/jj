-- SOMENTE LEITURA. Nao manda push, nao muda nada.
-- Responde "os avisos automaticos estao saindo de verdade?" olhando os
-- quatro elos: o relogio (cron), a chamada da funcao (resposta HTTP), o
-- historico de envios e os aparelhos inscritos. Cole e mande o resultado.
select jsonb_pretty(jsonb_build_object(
  'agora_em_brasilia', to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
  '1_cron_ultimos_7_dias', (
    select jsonb_build_object(
      'agendado', (select schedule from cron.job where jobname = 'notificar'),
      'rodou', count(*),
      'com_erro', count(*) filter (where r.status <> 'succeeded'),
      'ultima_vez', to_char(max(r.start_time) at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      'ultimo_erro', (select left(x.return_message, 160) from cron.job_run_details x
                      where x.jobid = j.jobid and x.status <> 'succeeded'
                      order by x.start_time desc limit 1))
    from cron.job j left join cron.job_run_details r
      on r.jobid = j.jobid and r.start_time > now() - interval '7 days'
    where j.jobname = 'notificar' group by j.jobid),
  '2_respostas_da_funcao', (
    select jsonb_build_object(
      'respostas_guardadas', count(*),
      'ok_200', count(*) filter (where h.status_code = 200),
      'erro', count(*) filter (where h.status_code <> 200 or h.timed_out),
      'ultimo_erro', (select left(coalesce(e.error_msg, e.content), 160) from net._http_response e
                      where e.status_code <> 200 or e.timed_out order by e.created desc limit 1),
      'avisos_enviados_nessas_chamadas', sum(substring(h.content from '"enviados"[[:space:]]*:[[:space:]]*([0-9]+)')::int))
    from net._http_response h),
  '3_envios_reais_30_dias', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'tipo', case when x.tipo like 'meta:%' then 'meta' else x.tipo end,
      'quantos', x.n, 'ultimo', x.ultimo)), '[]'::jsonb)
    from (select case when tipo like 'meta:%' then 'meta' else tipo end as tipo, count(*) as n,
                 to_char(max(enviado_em) at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as ultimo
          from public.notificacao_envio where enviado_em > now() - interval '30 days'
          group by 1) x),
  '4_aparelhos', (
    select jsonb_build_object(
      'inscritos', count(*),
      'aptos', count(*) filter (where i.falhas < 5 and p.notificar),
      'com_falha', count(*) filter (where i.falhas > 0))
    from public.push_inscricao i left join public.perfil p on p.user_id = i.user_id)
)) as raio_x_dos_avisos;
