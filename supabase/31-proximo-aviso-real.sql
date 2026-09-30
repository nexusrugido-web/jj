-- Somente leitura. Mostra quando o proximo lembrete de meta pode sair.
-- Nao dispara push e nao altera historico. A meta pode mudar ate a hora real.
with aparelho as (
  select i.user_id, i.fuso,
         public.hora_da_pessoa(i.user_id, i.fuso) as hora,
         (now() at time zone i.fuso)::date as hoje
  from public.push_inscricao i
  join public.perfil p on p.user_id = i.user_id and p.notificar
  where i.falhas < 5
  order by i.criado_em
  limit 1
), proximo as (
  select a.*,
         a.hoje + ((5 - extract(isodow from a.hoje)::int + 7) % 7) as sexta
  from aparelho a
), simulacao as (
  select p.fuso, p.sexta, p.hora,
         public.proxima_meta_para_aviso(p.user_id, p.sexta) as aviso,
         count(n.*) as envios_reais
  from proximo p
  left join public.notificacao_envio n on n.user_id = p.user_id
  group by p.user_id, p.fuso, p.sexta, p.hora
)
select jsonb_pretty(jsonb_build_object(
  'fuso', fuso,
  'sexta', sexta,
  'hora_local', lpad(hora::text, 2, '0') || ':00',
  'horario_utc', ((sexta::text || ' ' || lpad(hora::text, 2, '0') || ':00')::timestamp
                  at time zone fuso),
  'exemplo_de_meta', aviso->>'titulo',
  'envios_reais_ate_agora', envios_reais
)) as proximo_aviso
from simulacao;
