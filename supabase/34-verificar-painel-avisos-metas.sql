-- Somente leitura. Rodar DEPOIS de 33-painel-avisos-por-meta.sql.
-- Nao testa entrega ao aparelho; essa parte se observa no painel admin.
select jsonb_pretty(jsonb_build_object(
  'gerador_normal', to_regprocedure('public.proxima_meta_para_aviso(uuid,date)') is not null,
  'gerador_por_meta', to_regprocedure('public.proxima_meta_para_aviso(uuid,date,uuid)') is not null,
  'inspecao_admin', to_regprocedure('public.inspecionar_avisos_metas(text)') is not null,
  'teste_admin', to_regprocedure('public.testar_aviso_meta(text,uuid)') is not null,
  'resposta_teste', to_regprocedure('public.estado_teste_aviso_meta(bigint)') is not null,
  'cliente_sem_acesso_ao_gerador',
    not has_function_privilege('authenticated',
      'public.proxima_meta_para_aviso(uuid,date,uuid)', 'EXECUTE'),
  'cliente_sem_acesso_direto_a_outros',
    not has_function_privilege('anon',
      'public.inspecionar_avisos_metas(text)', 'EXECUTE')
)) as verificacao_painel_metas;
