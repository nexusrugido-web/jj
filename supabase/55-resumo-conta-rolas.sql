-- 55: O RESUMO DA SEMANA PASSA A CONTAR OS ROLAS (S5)
--
-- O resumo de segunda-feira contava os rolas ligando o rola ao treino
-- por dados->>'id' do treino. Esse campo nunca sobe (o app tira o id
-- local antes de mandar), então a conta dava sempre zero e o título
-- nunca dizia quantos rolas foram.
--
-- Agora conta pela data do próprio rola: o app grava todo rola com a
-- data do treino dele, então "rolas da semana" é "rolas com data na
-- semana". Não depende de id nenhum e vale também pros registros antigos.
--
-- O QUE MUDA: só a contagem de rolas dentro de public.resumo_da_semana.
-- O resto da função é idêntico ao do SQL 51 (texto, liga, graus).
-- O QUE NÃO MUDA: nenhuma tabela, nenhum dado, nenhuma permissão
-- (create or replace mantém o revoke do SQL 40).
-- PODE RODAR DE NOVO: sim.
-- COMO VOLTAR: rodar de novo o trecho da função resumo_da_semana do
-- SQL 51 (51-avisos-sem-desanimo.sql).
--
-- Cole no SQL Editor do Supabase e rode.

begin;

create or replace function public.resumo_da_semana(p_user uuid, p_hoje date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_sem date := public.semana_de(p_hoje) - 7;
  v_treinos int; v_rolas int; v_res text; v_subiram int; v_corpo text := '';
begin
  select count(*) into v_treinos from public.registros r
  where r.user_id = p_user and r.tabela = 'sessions' and r.deleted_at is null
    and public.data_ofensiva(r.dados->>'data') between v_sem and v_sem + 6;
  select count(*) into v_rolas from public.registros r
  where r.user_id = p_user and r.tabela = 'rolls' and r.deleted_at is null
    and public.data_ofensiva(r.dados->>'data') between v_sem and v_sem + 6;
  select m.resultado into v_res from public.liga_membro m
  join public.liga l on l.id = m.liga_id
  where m.user_id = p_user and l.semana = v_sem limit 1;
  /* as tecnicas que subiram vem do app, que e quem calcula os graus */
  select case when r.dados->'avisosDoApp'->>'semana' = v_sem::text
              then nullif(r.dados->'avisosDoApp'->>'subiram', '')::int end
    into v_subiram
  from public.registros r
  where r.user_id = p_user and r.tabela = 'settings' and r.deleted_at is null
  limit 1;

  if v_treinos = 0 and v_res is null then return null; end if;

  v_corpo := case v_res
    when 'subiu' then 'Subiu de divisão na liga!'
    when 'desceu' then 'Divisão nova nesta semana: bora pontuar.'
    when 'protegido' then 'A lesão segurou sua divisão na liga.'
    when 'ficou' then 'Ficou na mesma divisão da liga.'
    else '' end;
  if coalesce(v_subiram, 0) > 0 then
    v_corpo := trim(v_corpo || ' ' || v_subiram ||
      case when v_subiram = 1 then ' técnica subiu de grau.' else ' técnicas subiram de grau.' end);
  end if;
  if v_corpo = '' then v_corpo := 'Vem ver como foi sua semana.'; end if;

  return jsonb_build_object(
    'titulo', case when v_treinos = 0 then '📊 Sua semana na liga' else
      '📊 Semana: ' || v_treinos || case when v_treinos = 1 then ' treino' else ' treinos' end
      || case when v_rolas > 0 then ', ' || v_rolas || case when v_rolas = 1 then ' rola' else ' rolas' end else '' end end,
    'corpo', v_corpo);
end $$;

commit;

-- Conferência (só leitura): o resumo da semana passada das 3 contas
-- com mais rolas. O título passa a trazer ", N rolas".
-- select user_id, public.resumo_da_semana(user_id, current_date)->>'titulo' as titulo
-- from public.registros where tabela = 'rolls' and deleted_at is null
-- group by user_id order by count(*) desc limit 3;
