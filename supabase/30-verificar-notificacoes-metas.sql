-- Rodar DEPOIS de 29-notificacoes-metas.sql. Somente leitura; nao envia push.
-- Simula a proxima sexta para mostrar o texto de uma meta elegivel.
-- A fila real so devolve linhas quando chega a hora prevista no aparelho.
with amostra as (
  select i.user_id, i.fuso
  from public.push_inscricao i
  join public.perfil p on p.user_id = i.user_id and p.notificar
  where i.falhas < 5
  order by i.criado_em
  limit 1
), sexta as (
  select (now() at time zone 'America/Sao_Paulo')::date
    + ((5 - extract(isodow from now() at time zone 'America/Sao_Paulo')::int + 7) % 7) as dia
), exemplo as (
  select public.proxima_meta_para_aviso(a.user_id, s.dia) as aviso, s.dia
  from amostra a cross join sexta s
)
select jsonb_pretty(jsonb_build_object(
  'funcao_instalada', to_regprocedure('public.proxima_meta_para_aviso(uuid,date)') is not null,
  'cliente_bloqueado', not has_function_privilege('authenticated',
    'public.proxima_meta_para_aviso(uuid,date)', 'EXECUTE'),
  'fila_preservada', to_regprocedure('public.fila_de_notificacao(uuid)') is not null,
  'exemplo_para_sexta', (select jsonb_build_object(
    'dia', dia, 'titulo', aviso->>'titulo', 'corpo', aviso->>'corpo',
    'caminho', aviso->>'caminho') from exemplo),
  'avisos_reais_ate_agora', (select count(*) from public.notificacao_envio)
)) as verificacao;
