-- Diagnostico da entrega AUTOMATICA. Apenas SELECT; nao envia avisos nem altera dados.
-- Rodar no SQL Editor como administrador e copiar a coluna diagnostico.
-- A resposta nao inclui chaves, endpoints, e-mails ou nomes.
with
  job as (
    select jobid, jobname, schedule, active
    from cron.job
    where jobname = 'notificar'
  ),
  execucoes as (
    select r.status, r.start_time, left(r.return_message, 180) as mensagem
    from cron.job_run_details r
    where r.jobid in (select jobid from job)
    order by r.start_time desc
    limit 12
  ),
  respostas_http as (
    -- pg_net conserva respostas por poucas horas; aqui nao ha corpo nem segredo.
    select h.status_code, h.timed_out, left(h.error_msg, 180) as erro, h.created
    from net._http_response h
    where h.created > now() - interval '6 hours'
    order by h.created desc
    limit 12
  ),
  aparelhos as (
    select i.user_id, i.falhas, i.fuso, p.notificar,
           (now() at time zone i.fuso)::date as dia_local,
           extract(isodow from now() at time zone i.fuso)::int as dia_semana_local,
           extract(hour from now() at time zone i.fuso)::int as hora_local,
           public.hora_da_pessoa(i.user_id, i.fuso) as hora_prevista
    from public.push_inscricao i
    left join public.perfil p on p.user_id = i.user_id
  ),
  silencio as (
    select e.user_id
    from public.notificacao_envio e
    where e.enviado_em > now() - interval '60 days'
    group by e.user_id
    having count(*) filter (where not e.respondeu) >= 7
       and count(*) filter (where e.respondeu and e.enviado_em > now() - interval '30 days') = 0
  ),
  aparelhos_resumo as (
    select count(*) as total,
           count(*) filter (where notificar is true) as perfil_ligado,
           count(*) filter (where notificar is false) as perfil_desligado,
           count(*) filter (where notificar is null) as sem_perfil,
           count(*) filter (where falhas >= 5) as falhas_limite,
           count(*) filter (where user_id in (select user_id from silencio)) as silenciados,
           count(*) filter (where notificar is true and falhas < 5
                             and user_id not in (select user_id from silencio)) as elegiveis,
           count(*) filter (where notificar is true and falhas < 5
                             and user_id not in (select user_id from silencio)
                             and hora_local = hora_prevista) as na_hora_agora
    from aparelhos
  ),
  envios as (
    select tipo, count(*) as total,
           count(*) filter (where enviado_em > now() - interval '7 days') as ultimos_7_dias,
           max(enviado_em) as ultimo_envio
    from public.notificacao_envio
    group by tipo
  )
select jsonb_pretty(jsonb_build_object(
  'gerado_em_utc', now(),
  'domingo_em_brasilia', extract(isodow from now() at time zone 'America/Sao_Paulo') = 7,
  'job', coalesce((select jsonb_agg(to_jsonb(job)) from job), '[]'::jsonb),
  'cron_ultimas_execucoes', coalesce((select jsonb_agg(to_jsonb(execucoes)) from execucoes), '[]'::jsonb),
  'http_ultimas_respostas_todo_projeto', coalesce((select jsonb_agg(to_jsonb(respostas_http)) from respostas_http), '[]'::jsonb),
  'segredos_presentes', jsonb_build_object(
    'url_notificar', exists(select 1 from vault.secrets where name = 'url_notificar'),
    'chave_notificar', exists(select 1 from vault.secrets where name = 'chave_notificar')
  ),
  'aparelhos', (select to_jsonb(aparelhos_resumo) from aparelhos_resumo),
  'fila_agora', (select count(*) from public.fila_de_notificacao(null::uuid)),
  'envios_reais', coalesce((select jsonb_agg(to_jsonb(envios)) from envios), '[]'::jsonb),
  'metas_sincronizadas_ativas', (
    select count(*) from public.registros
    where tabela = 'goals' and deleted_at is null and dados->>'status' = 'ativa'
  )
)) as diagnostico;
