-- Rodar DEPOIS de 02/10/2026 20h na Bahia. Somente leitura; nao envia push.
-- Compara cron, resposta HTTP e historico do aparelho, sem expor chaves.
with aparelho as (
  select i.user_id, i.fuso, p.notificar, i.falhas,
         ('2026-10-02 20:00'::timestamp at time zone i.fuso) as previsto_em
  from public.push_inscricao i
  left join public.perfil p on p.user_id = i.user_id
  order by i.criado_em
  limit 1
), cron_exec as (
  select r.start_time, r.status, left(r.return_message, 180) as mensagem
  from cron.job_run_details r
  join cron.job j on j.jobid = r.jobid and j.jobname = 'notificar'
  cross join aparelho a
  where r.start_time between a.previsto_em - interval '1 minute'
                         and a.previsto_em + interval '5 minutes'
  order by r.start_time
), respostas as (
  select h.created, h.status_code, h.timed_out,
         left(h.error_msg, 180) as erro,
         substring(h.content from '"fila"[[:space:]]*:[[:space:]]*([0-9]+)')::int as fila,
         substring(h.content from '"enviados"[[:space:]]*:[[:space:]]*([0-9]+)')::int as enviados
  from net._http_response h cross join aparelho a
  where h.created between a.previsto_em - interval '1 minute'
                      and a.previsto_em + interval '5 minutes'
  order by h.created
), envios as (
  select count(*) as todos,
         count(*) filter (where n.tipo like 'meta:%') as metas,
         max(n.enviado_em) as ultimo_envio
  from public.notificacao_envio n cross join aparelho a
  where n.user_id = a.user_id
    and n.enviado_em between a.previsto_em - interval '1 minute'
                         and a.previsto_em + interval '5 minutes'
)
select jsonb_pretty(jsonb_build_object(
  'horario_previsto_utc', to_char(a.previsto_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'situacao', case when now() < a.previsto_em then 'aguardando horario'
                   else 'horario ja passou' end,
  'perfil_notificar', a.notificar,
  'falhas_aparelho', a.falhas,
  'cron', coalesce((select jsonb_agg(to_jsonb(c)) from cron_exec c), '[]'::jsonb),
  'respostas_http_na_janela', coalesce((select jsonb_agg(to_jsonb(h)) from respostas h), '[]'::jsonb),
  'envios_na_janela', (select to_jsonb(e) from envios e)
)) as entrega_real
from aparelho a;
