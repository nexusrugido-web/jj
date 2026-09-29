-- DIAGNOSTICO SOMENTE DE LEITURA. Nao altera dados nem executa SQLs antigos.
-- Execute no SQL Editor e envie o JSON da coluna diagnostico.
-- Nao consulta registros pessoais, tokens, endpoints de push ou segredos.
select jsonb_build_object(
  'gerado_em', now(),
  'colunas', (select jsonb_agg(to_jsonb(c)) from (
    select table_name, column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name in
      ('registros','perfil','pontos','liga','liga_membro','liga_fechamento','ajuste','evento_valor','notificacao_envio')
    order by table_name, ordinal_position
  ) c),
  'funcoes', (select jsonb_agg(jsonb_build_object(
    'nome', p.proname, 'argumentos', pg_get_function_identity_arguments(p.oid),
    'resultado', pg_get_function_result(p.oid), 'definicao', pg_get_functiondef(p.oid)))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in ('ranking_ofensivas','minha_liga','perfil_na_liga','meus_amigos',
        'minha_divisao','fechar_semana','colocar_na_liga','subir_pontos','atualiza_total',
        'nome_publico','ajuste_de','hoje_br','semana_de','semana_atual',
        'fila_de_notificacao','hora_da_pessoa','minimo_pra_subir')),
  'politicas', (select jsonb_agg(to_jsonb(r)) from (
    select tablename, policyname, roles, cmd, qual, with_check
    from pg_policies where schemaname = 'public'
      and tablename in ('registros','perfil','pontos','liga','liga_membro')
  ) r),
  'gatilhos', (select jsonb_agg(jsonb_build_object(
    'tabela', c.relname, 'nome', t.tgname, 'definicao', pg_get_triggerdef(t.oid)))
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname = 'public'
      and c.relname in ('registros','perfil','pontos','liga_membro'))
) as diagnostico;
