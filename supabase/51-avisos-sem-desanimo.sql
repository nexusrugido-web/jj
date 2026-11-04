-- 51: AVISOS SEM NÚMERO QUE DESANIMA
--
-- O aviso não conta mais quantas vezes te pegaram nem fala em cair:
--  * "Mata-leão te pegou 4 vezes" vira "Mata-leão tá aparecendo nos
--    rolas. Bora ver a saída?" (o app reconhece e manda pra aula).
--  * no resumo de segunda, "Caiu de divisão" vira "Divisão nova
--    nesta semana: bora pontuar." e sai o "Semana sem treino.";
--    semana sem treino tem o título "Sua semana na liga".
-- Só troca texto: mesmas regras, mesmo horário, mesmo limite de 1 por
-- dia. Pode rodar de novo sem problema.
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
    and r.dados->>'sessionId' in (
      select s.dados->>'id' from public.registros s
      where s.user_id = p_user and s.tabela = 'sessions' and s.deleted_at is null
        and public.data_ofensiva(s.dados->>'data') between v_sem and v_sem + 6);
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

/* o texto de cada fato, no jeito do tatame */
create or replace function public.aviso_do_dia(p_tema text, p_evo jsonb)
returns jsonb language sql immutable as $$
  select case p_tema
    when 'perto' then jsonb_build_object(
      'titulo', '🎯 Falta pouco pro grau',
      'corpo', 'Mais ' || (p_evo->'perto'->>'usos') || case when (p_evo->'perto'->>'usos') = '1' then ' uso' else ' usos' end
               || ' de ' || left(p_evo->'perto'->>'nome', 30) || ' e ela sobe. Bora caçar hoje?',
      'caminho', '/?go=dominio')
    when 'pega' then jsonb_build_object(
      'titulo', '🛡️ Bora fechar essa porta',
      'corpo', left(p_evo->'pega'->>'nome', 30) || ' tá aparecendo nos rolas. Bora ver a saída?',
      'caminho', '/?go=estudo')
    when 'unica' then jsonb_build_object(
      'titulo', '🧩 Uma saída só é previsível',
      'corpo', 'Da posição ' || left(p_evo->'unica'->>'nome', 22) || ' só sai uma. Quem te leu já tá esperando.',
      'caminho', '/?go=meujogo')
    when 'forte' then jsonb_build_object(
      'titulo', '💪 Sua arma tá afiada',
      'corpo', left(p_evo->'forte'->>'nome', 30) || ' é a que mais entra. Monta o rola nela.',
      'caminho', '/?go=meujogo')
    when 'tema' then jsonb_build_object(
      'titulo', '📚 A aula foi pro caderno?',
      'corpo', 'Treinou ' || left(p_evo->'tema'->>'nome', 26) || ' na aula. Hoje é dia de testar no rola.',
      'caminho', '/?go=treinos')
    else case p_tema
    when '0' then jsonb_build_object('titulo', '🥋 Segunda é dia de tatame', 'corpo', 'Kimono na mochila? Registra o treino depois e vê o que evoluiu.', 'caminho', '/?go=treinos')
    when '1' then jsonb_build_object('titulo', '🧠 O rola começa na cabeça', 'corpo', '3 minutos de aula rápida e você chega no treino com uma ideia nova.', 'caminho', '/?go=estudo')
    when '2' then jsonb_build_object('titulo', '🎯 Meio da semana', 'corpo', 'Confere a sua meta. Quem anota evolui mais rápido que quem só sua.', 'caminho', '/?go=metas')
    when '3' then jsonb_build_object('titulo', '🐢 Guarda viva ou tartaruga?', 'corpo', 'Marca o que entrou no rola de hoje: é assim que o app lê o seu jogo.', 'caminho', '/?go=treinos')
    when '4' then jsonb_build_object('titulo', '🎬 Sexta de aula rápida', 'corpo', 'Uma ideia nova pro rola do fim de semana. Prometo que é curta.', 'caminho', '/?go=estudo')
    when '5' then jsonb_build_object('titulo', '🍖 Sábado: treino e churrasco', 'corpo', 'Teve aula ou luta hoje? Registra antes da picanha, que depois esquece.', 'caminho', '/?go=treinos')
    when '6' then jsonb_build_object('titulo', '😴 Domingo é recuperação', 'corpo', 'Mas 1 aula rápida no sofá conta. O jogo evolui até deitado.', 'caminho', '/?go=estudo')
    end
  end;
$$;

commit;
