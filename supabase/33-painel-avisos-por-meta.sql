-- Painel admin: previsualizar e testar o aviso de cada meta de uma conta.
-- Aplicar DEPOIS de 29-notificacoes-metas.sql. Nao altera cron nem historico.
begin;

-- O corpo da versao de tres argumentos e o mesmo gerador da migracao 29,
-- com selecao forcada apenas para previsualizacao/teste. A versao de dois
-- argumentos continua escolhendo uma meta pela regra normal de producao.
create or replace function public.proxima_meta_para_aviso(p_user uuid, p_hoje date, p_meta uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with metas as (
    select r.id, r.dados,
           coalesce(nullif(left(trim(r.dados->>'titulo'), 75), ''),
             case r.dados->>'tipo'
               when 'frequencia' then 'Treinar com regularidade'
               when 'tecnica' then 'Subir uma técnica de grau'
               when 'defesa' then 'Fechar um buraco na defesa'
               when 'treinos' then 'Chegar a um total de treinos'
               when 'manual' then 'Minha meta pessoal'
               when 'aulas' then 'Assistir aulas'
               when 'quiz' then 'Responder o quiz'
               when 'rolas' then 'Fazer mais rolas'
               when 'posicao' then 'Trabalhar uma posição'
               when 'volume' then 'Tempo de tatame'
               when 'competicao' then 'Competir'
               else 'Minha meta' end) as titulo,
           case when r.dados->>'alvo' ~ '^[0-9]{1,5}$'
                then (r.dados->>'alvo')::int else null end as alvo_num,
           case when r.dados->>'contador' ~ '^[0-9]{1,7}$'
                then (r.dados->>'contador')::int else 0 end as contador,
           case when r.dados->>'ajuste' ~ '^-?[0-9]{1,5}$'
                then (r.dados->>'ajuste')::int else 0 end as ajuste
    from public.registros r
    where r.user_id = p_user and r.tabela = 'goals' and r.deleted_at is null
      and (p_meta is null or r.id = p_meta)
      and r.dados->>'status' = 'ativa'
      and coalesce(r.dados->>'origem', 'usuario') in ('usuario', 'confirmada')
      and r.dados->>'tipo' in ('frequencia','tecnica','defesa','treinos','manual',
                             'aulas','quiz','rolas','posicao','volume','competicao')
      and (p_meta is not null or not exists (
        select 1 from public.notificacao_envio n
        where n.user_id = p_user and n.tipo = 'meta:' || r.id::text
          and n.enviado_em > now() - interval '14 days'
      ))
  ),
  treinos as (
    select count(*)::int as todos,
           count(*) filter (where public.data_ofensiva(s.dados->>'data')
             between public.semana_de(p_hoje) and p_hoje)::int as semana
    from public.registros s
    where s.user_id = p_user and s.tabela = 'sessions' and s.deleted_at is null
      and public.data_ofensiva(s.dados->>'data') <= p_hoje
  ),
  candidatos as (
    select m.id, m.titulo, m.dados->>'tipo' as tipo, m.alvo_num,
           case m.dados->>'tipo'
             when 'frequencia' then greatest(0, t.semana + m.ajuste)
             when 'treinos' then greatest(0, t.todos + m.ajuste)
             when 'manual' then greatest(0, m.contador)
             else null end as feito,
           public.data_ofensiva(m.dados->>'data') as data_competicao,
           (select max(n.enviado_em) from public.notificacao_envio n
            where n.user_id = p_user and n.tipo = 'meta:' || m.id::text) as ultimo_aviso
    from metas m cross join treinos t
  ),
  escolhido as (
    select c.* from candidatos c
    where (p_meta is not null or (
      c.tipo = 'frequencia' and extract(isodow from p_hoje) = 5
        and c.alvo_num between 1 and 7 and c.feito < c.alvo_num
      or c.tipo = 'competicao' and extract(isodow from p_hoje) in (2,5)
        and c.data_competicao between p_hoje + 1 and p_hoje + 14
      or c.tipo not in ('frequencia','competicao') and extract(isodow from p_hoje) in (2,5)
        and (c.feito is null or c.alvo_num is null or c.feito < c.alvo_num)
    ))
    order by case
      when c.tipo = 'competicao' and c.data_competicao - p_hoje <= 3 then 0
      when c.tipo = 'frequencia' then 1
      else 2 end,
      c.ultimo_aviso nulls first, c.id
    limit 1
  )
  select jsonb_build_object(
    'id', e.id,
    'tipo', 'meta:' || e.id::text,
    'familia', case when e.tipo in ('aulas','quiz') then 'estudo' else 'treino' end,
    'titulo', 'Sua meta: ' || e.titulo,
    'corpo', case
      when e.tipo = 'frequencia' and e.alvo_num between 1 and 7 then
        'Nesta semana: ' || e.feito || ' de ' || e.alvo_num ||
        ' treinos. Se já treinou, registre quando puder.'
      when e.tipo = 'treinos' and e.alvo_num is not null then
        'Você registrou ' || e.feito || ' de ' || e.alvo_num ||
        ' treinos. Veja o proximo passo.'
      when e.tipo = 'manual' and e.alvo_num is not null then
        'Seu contador esta em ' || e.feito || ' de ' || e.alvo_num ||
        '. Atualize quando quiser.'
      when e.tipo = 'competicao' and e.data_competicao > p_hoje then
        'Faltam ' || (e.data_competicao - p_hoje) ||
        ' dias para a competição. Confira sua preparação.'
      when e.tipo = 'tecnica' then
        'Veja o grau da técnica e registre como ela apareceu no treino.'
      when e.tipo = 'defesa' then
        'Depois do próximo rola, registre se essa defesa funcionou.'
      when e.tipo = 'aulas' then
        'Uma aula assistida ajuda nesta meta. Veja o que falta.'
      when e.tipo = 'quiz' then
        'Revise um conceito no quiz e acompanhe seus acertos.'
      when e.tipo = 'rolas' then
        'Registre seus rolas reais para acompanhar esta meta.'
      when e.tipo = 'posicao' then
        'Anote a posição inicial do próximo rola para acompanhar esta meta.'
      when e.tipo = 'volume' then
        'O tempo de treino registrado alimenta esta meta.'
      else 'Abra para conferir seu progresso e escolher o proximo passo.'
    end,
    'caminho', '/?go=metas'
  )
  from escolhido e
  where p_meta is not null or (select count(*) from public.notificacao_envio n
         where n.user_id = p_user and n.tipo like 'meta:%'
           and n.dia between public.semana_de(p_hoje) and p_hoje) < 2;
$$;

revoke all on function public.proxima_meta_para_aviso(uuid,date,uuid)
  from public, anon, authenticated;

create or replace function public.proxima_meta_para_aviso(p_user uuid, p_hoje date)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.proxima_meta_para_aviso(p_user, p_hoje, null::uuid);
$$;
revoke all on function public.proxima_meta_para_aviso(uuid,date)
  from public, anon, authenticated;

-- Os dados de outra pessoa so saem para quem e admin no servidor.
create or replace function public.inspecionar_avisos_metas(p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_fuso text;
  v_hoje date;
  v_metas jsonb;
  v_notificar boolean;
  v_aparelhos int;
  v_elegiveis int;
begin
  if not public.sou_admin() then raise exception 'so o administrador inspeciona avisos'; end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user is null then return jsonb_build_object('erro', 'Conta nao encontrada'); end if;

  select coalesce(min(i.fuso), 'America/Sao_Paulo'), count(*)::int,
         count(*) filter (where i.falhas < 5)::int
  into v_fuso, v_aparelhos, v_elegiveis
  from public.push_inscricao i where i.user_id = v_user;
  v_hoje := (now() at time zone v_fuso)::date;
  select p.notificar into v_notificar from public.perfil p where p.user_id = v_user;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'titulo', coalesce(nullif(r.dados->>'titulo', ''), 'Meta sem titulo'),
    'tipo', r.dados->>'tipo', 'aviso', x.aviso,
    'ultimo_envio', n.enviado_em, 'ultimo_respondeu', n.respondeu
  ) order by r.created_at desc, r.id), '[]'::jsonb)
  into v_metas
  from public.registros r
  cross join lateral (select public.proxima_meta_para_aviso(v_user, v_hoje, r.id) as aviso) x
  left join lateral (
    select e.enviado_em, e.respondeu from public.notificacao_envio e
    where e.user_id = v_user and e.tipo = 'meta:' || r.id::text
    order by e.enviado_em desc limit 1
  ) n on true
  where r.user_id = v_user and r.tabela = 'goals' and r.deleted_at is null
    and r.dados->>'status' = 'ativa'
    and coalesce(r.dados->>'origem', 'usuario') in ('usuario', 'confirmada');

  return jsonb_build_object(
    'email', lower(trim(p_email)), 'fuso', v_fuso,
    'hora_local', public.hora_da_pessoa(v_user, v_fuso),
    'notificar', coalesce(v_notificar, false),
    'aparelhos', v_aparelhos, 'aparelhos_elegiveis', v_elegiveis,
    'metas', v_metas
  );
end $$;

revoke all on function public.inspecionar_avisos_metas(text) from public, anon;
grant execute on function public.inspecionar_avisos_metas(text) to authenticated;

-- Teste deliberado: texto identico ao gerador da meta, mas nao escreve no
-- historico de avisos reais e nao altera cooldown ou limite semanal.
create or replace function public.testar_aviso_meta(p_email text, p_meta uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_fuso text;
  v_n int;
  v_aviso jsonb;
  v_request_id bigint;
begin
  if not public.sou_admin() then raise exception 'so o administrador testa avisos'; end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user is null then raise exception 'Conta nao encontrada'; end if;
  select count(*)::int, coalesce(min(i.fuso), 'America/Sao_Paulo')
    into v_n, v_fuso from public.push_inscricao i where i.user_id = v_user;
  if v_n = 0 then raise exception 'Conta sem aparelho inscrito'; end if;

  v_aviso := public.proxima_meta_para_aviso(
    v_user, (now() at time zone v_fuso)::date, p_meta);
  if v_aviso is null then raise exception 'Meta ativa nao encontrada ou sem aviso'; end if;
  if (select count(*) from vault.secrets
      where name in ('url_notificar', 'chave_notificar')) < 2 then
    raise exception 'Faltam os segredos da funcao de notificacao';
  end if;

  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'url_notificar'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'chave_notificar')),
    body := jsonb_build_object(
      'teste', v_user, 'tipo', v_aviso->>'tipo',
      'titulo', v_aviso->>'titulo', 'corpo', v_aviso->>'corpo',
      'caminho', v_aviso->>'caminho')
  ) into v_request_id;
  return jsonb_build_object('request_id', v_request_id, 'aparelhos', v_n,
                            'aviso', v_aviso, 'estado', 'solicitado');
end $$;

revoke all on function public.testar_aviso_meta(text,uuid) from public, anon;
grant execute on function public.testar_aviso_meta(text,uuid) to authenticated;

-- O pg_net e assincrono: confirma resposta da Edge Function, nao que o
-- sistema operacional mostrou a notificacao na tela do aluno.
create or replace function public.estado_teste_aviso_meta(p_request_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_resposta record;
begin
  if not public.sou_admin() then raise exception 'so o administrador consulta avisos'; end if;
  select h.status_code, h.timed_out, h.error_msg, h.content
    into v_resposta from net._http_response h where h.id = p_request_id;
  if not found then return jsonb_build_object('estado', 'aguardando'); end if;
  return jsonb_build_object(
    'estado', case when v_resposta.status_code = 200 then 'respondido'
                   else 'erro' end,
    'status_http', v_resposta.status_code,
    'timeout', v_resposta.timed_out,
    'erro', left(v_resposta.error_msg, 200),
    'fila', substring(v_resposta.content from '"fila"[[:space:]]*:[[:space:]]*([0-9]+)')::int,
    'enviados', substring(v_resposta.content from '"enviados"[[:space:]]*:[[:space:]]*([0-9]+)')::int
  );
end $$;

revoke all on function public.estado_teste_aviso_meta(bigint) from public, anon;
grant execute on function public.estado_teste_aviso_meta(bigint) to authenticated;

commit;
