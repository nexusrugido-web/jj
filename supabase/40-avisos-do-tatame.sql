-- AVISOS DO TATAME. Aplicar DEPOIS do 39 (36 + cron da reta final).
-- Seis avisos novos, sempre no maximo 1 por dia por pessoa e nada entre
-- 22h e 8h; so as retas finais de domingo ficam fora dessas duas regras.
--
--   pos_treino        no dia em que a pessoa costuma treinar (2+ treinos
--                     naquele dia da semana nas ultimas 6 semanas), 1h
--                     depois da hora em que ela costuma registrar, se o
--                     treino de hoje ainda nao entrou
--   liga_reta_final   domingo das 21h a meia-noite, so pra quem esta na
--                     zona de rebaixamento (a mesma conta do fechamento) e
--                     ja nao recebe a reta final da ofensiva; com o relogio
--   amigo:<id>        um amigo passou voce nos pontos da semana na ultima
--                     hora; uma vez por amigo por semana
--   resumo            segunda as 14h, no lugar do "resultado": treinos e
--                     rolas da semana, o que aconteceu na liga e quantas
--                     tecnicas subiram de grau
--   grau:<tecnica>    ao meio-dia de um dia de treino: falta pouco pra uma
--                     tecnica subir de grau (o app calcula e manda junto com
--                     as configuracoes, em avisosDoApp); uma vez por semana
--   campeonato        faltando 7, 3, 2 e 1 dia pro campeonato da meta
--
-- Nao recria cron, segredos nem tabelas. Pode reaplicar.
begin;

/* os dias da semana em que a pessoa costuma treinar (1 = segunda) */
create or replace function public.dias_de_treino(p_user uuid, p_hoje date)
returns int[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(x.d order by x.d), '{}'::int[]) from (
    select extract(isodow from public.data_ofensiva(r.dados->>'data'))::int as d
    from public.registros r
    where r.user_id = p_user and r.tabela = 'sessions' and r.deleted_at is null
      and public.data_ofensiva(r.dados->>'data') between p_hoje - 42 and p_hoje - 1
      and coalesce(r.dados->>'tipo', 'gi') <> 'competicao'
    group by 1 having count(*) >= 2
  ) x;
$$;
revoke all on function public.dias_de_treino(uuid, date) from public, anon, authenticated;

/* na zona de rebaixamento agora? Mesma conta do fechar_semana: grupo de
   3+, corte de n/3 (no maximo liga_corte), so desce se sobrar gente no
   meio, branca nao desce, lesao impeditiva protege. Devolve quantos
   pontos faltam pra sair da zona, ou null. */
create or replace function public.zona_da_liga(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_liga bigint; v_div text; v_n int; v_c int; v_pos int; v_meu int; v_acima int;
begin
  select l.id, l.divisao into v_liga, v_div
  from public.liga_membro m join public.liga l on l.id = m.liga_id
  where m.user_id = p_user and l.semana = public.semana_atual()
  limit 1;
  if v_liga is null or v_div = 'branca' then return null; end if;
  select count(*) into v_n from public.liga_membro where liga_id = v_liga;
  if v_n < 3 then return null; end if;
  v_c := greatest(1, least(public.ajuste_de('liga_corte', 3), v_n / 3));
  if v_n < v_c * 2 + 1 then return null; end if;
  if coalesce((select p.lesao_desde <= public.semana_atual() + 6 from public.perfil p where p.user_id = p_user), false) then
    return null;
  end if;
  select x.pos, x.xp_semana into v_pos, v_meu from (
    select m.user_id, m.xp_semana,
           row_number() over (order by m.xp_semana asc, m.entrou_em desc, m.user_id) as pos
    from public.liga_membro m where m.liga_id = v_liga
  ) x where x.user_id = p_user;
  if v_pos is null or v_pos > v_c then return null; end if;
  select x.xp_semana into v_acima from (
    select m.xp_semana,
           row_number() over (order by m.xp_semana asc, m.entrou_em desc, m.user_id) as pos
    from public.liga_membro m where m.liga_id = v_liga
  ) x where x.pos = v_c + 1;
  return jsonb_build_object('falta', greatest(1, coalesce(v_acima, 0) - v_meu + 1));
end $$;
revoke all on function public.zona_da_liga(uuid) from public, anon, authenticated;

/* o amigo que passou voce nos pontos da semana na ultima hora */
create or replace function public.amigo_que_passou(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with amigos as (
    select case when a.de = p_user then a.para else a.de end as id
    from public.amizade a
    where a.status = 'aceita' and (a.de = p_user or a.para = p_user)
  ),
  xp as (
    select u.id,
           coalesce(sum(p.xp), 0)::int as agora,
           coalesce(sum(p.xp) filter (where p.criado_em < now() - interval '1 hour'), 0)::int as antes
    from (select id from amigos union select p_user) u
    left join public.pontos p on p.user_id = u.id and p.semana = public.semana_atual()
    group by u.id
  )
  select jsonb_build_object('id', a.id, 'nome', public.nome_publico(pf), 'falta', a.agora - eu.agora + 1)
  from xp a
  join xp eu on eu.id = p_user
  join public.perfil pf on pf.user_id = a.id
  where a.id <> p_user and a.agora > eu.agora and a.antes <= eu.antes
    and not exists (
      select 1 from public.notificacao_envio n
      where n.user_id = p_user and n.tipo = 'amigo:' || a.id::text
        and n.dia >= public.semana_atual()
    )
  order by a.agora - eu.agora
  limit 1;
$$;
revoke all on function public.amigo_que_passou(uuid) from public, anon, authenticated;

/* o resumo da semana que fechou, pra segunda-feira */
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
    when 'desceu' then 'Caiu de divisão: bora voltar nesta semana.'
    when 'protegido' then 'A lesão segurou sua divisão na liga.'
    when 'ficou' then 'Ficou na mesma divisão da liga.'
    else '' end;
  if coalesce(v_subiram, 0) > 0 then
    v_corpo := trim(v_corpo || ' ' || v_subiram ||
      case when v_subiram = 1 then ' técnica subiu de grau.' else ' técnicas subiram de grau.' end);
  end if;
  if v_treinos = 0 then v_corpo := trim('Semana sem treino. ' || v_corpo); end if;
  if v_corpo = '' then v_corpo := 'Vem ver como foi sua semana.'; end if;

  return jsonb_build_object(
    'titulo', '📊 Semana: ' || v_treinos || case when v_treinos = 1 then ' treino' else ' treinos' end
      || case when v_rolas > 0 then ', ' || v_rolas || case when v_rolas = 1 then ' rola' else ' rolas' end else '' end,
    'corpo', v_corpo);
end $$;
revoke all on function public.resumo_da_semana(uuid, date) from public, anon, authenticated;

/* o campeonato da meta, faltando 7, 3, 2 ou 1 dia */
create or replace function public.campeonato_chegando(p_user uuid, p_hoje date)
returns int language sql stable security definer set search_path = public as $$
  select min(public.data_ofensiva(r.dados->>'data') - p_hoje)
  from public.registros r
  where r.user_id = p_user and r.tabela = 'goals' and r.deleted_at is null
    and r.dados->>'tipo' = 'competicao' and r.dados->>'status' = 'ativa'
    and public.data_ofensiva(r.dados->>'data') - p_hoje in (1, 2, 3, 7);
$$;
revoke all on function public.campeonato_chegando(uuid, date) from public, anon, authenticated;

create or replace function public.fila_de_notificacao(p_teste uuid default null)
returns table (
  user_id  uuid,
  tipo     text,
  dia      date,
  titulo   text,
  corpo    text,
  caminho  text,
  emblema  int,
  endpoint text,
  p256dh   text,
  auth     text
)
language plpgsql security definer set search_path = public as $$
begin
  /* TESTE: pula todas as regras e manda pra todos os aparelhos de
     uma pessoa so. */
  if p_teste is not null then
    return query
    select i.user_id, 'teste'::text, (now() at time zone i.fuso)::date,
           'Testando os avisos'::text,
           'Se voce esta vendo isto no celular, a corrente inteira funciona.'::text,
           '/?go=jornada'::text, 1, i.endpoint, i.p256dh, i.auth
    from public.push_inscricao i
    where i.user_id = p_teste;
    return;
  end if;

  return query
  with aparelho as (
    select
      i.user_id, i.endpoint, i.p256dh, i.auth, i.fuso, (o.valor->>'semanas')::int as sequencia, o.valor as ofensiva, m.valor as meta,
      (now() at time zone i.fuso)::date            as hoje_dele,
      extract(hour from now() at time zone i.fuso)::int as hora_dele,
      extract(isodow from now() at time zone i.fuso)::int as dia_semana
    from public.push_inscricao i
    join public.perfil p on p.user_id = i.user_id
    cross join lateral (select public.ofensiva_semanal_de(i.user_id) as valor) o
    cross join lateral (select public.proxima_meta_para_aviso(i.user_id, (now() at time zone i.fuso)::date) as valor) m
    where p.notificar and i.falhas < 5
  ),
  /* quem ignorou os ultimos 7 avisos para de receber. Mandar pra
     quem nunca abre e o que faz o Chrome cassar a permissao. */
  surdo as (
    select e.user_id
    from public.notificacao_envio e
    where e.enviado_em > now() - interval '60 days'
    group by e.user_id
    having count(*) filter (where not e.respondeu) >= 7
       and count(*) filter (where e.respondeu and e.enviado_em > now() - interval '30 days') = 0
  ),
  candidato as (
    select
      a.*,
      (select max(p.data) from public.pontos p where p.user_id = a.user_id) as ultimo_ponto,
      (a.ofensiva->>'treinouEstaSemana')::boolean as fechou_hoje,
      coalesce((a.ofensiva->>'congelada')::boolean, false) as parado,
      public.hora_da_pessoa(a.user_id, a.fuso) as hora_boa,
      a.dia_semana = any(public.dias_de_treino(a.user_id, a.hoje_dele)) as dia_de_treino,
      exists (
        select 1 from public.registros s
        where s.user_id = a.user_id and s.tabela = 'sessions' and s.deleted_at is null
          and public.data_ofensiva(s.dados->>'data') = a.hoje_dele
      ) as treinou_hoje,
      (select r.dados->'avisosDoApp'->'perto' from public.registros r
       where r.user_id = a.user_id and r.tabela = 'settings' and r.deleted_at is null limit 1) as perto,
      extract(isodow from public.hoje_br()) = 7
        and extract(hour from now() at time zone 'America/Sao_Paulo')::int between 21 and 23 as noite_de_domingo
    from aparelho a
    where a.user_id not in (select s.user_id from surdo s)
  ),
  com_extra as (
    select c.*,
      case when c.noite_de_domingo then public.zona_da_liga(c.user_id) end as zona,
      case when c.hora_dele between 8 and 21 then public.amigo_que_passou(c.user_id) end as amigo,
      case when c.dia_semana = 1 and c.hora_dele = 14 then public.resumo_da_semana(c.user_id, c.hoje_dele) end as resumo,
      case when c.hora_dele = c.hora_boa then public.campeonato_chegando(c.user_id, c.hoje_dele) end as faltam_camp
    from candidato c
  ),
  escolhido as (
    select
      c.*,
      case
        /* 0. a reta final da ofensiva: domingo das 21h a meia-noite de
           Brasilia, ofensiva viva e semana sem treino. De 15 em 15 minutos
           o mesmo aviso e redesenhado (cron notificar-reta-final) */
        when c.noite_de_domingo and not c.fechou_hoje and c.sequencia > 0 and not c.parado
          then 'ofensiva_reta_final'
        /* 0b. a reta final da liga: na zona de rebaixamento, pra quem nao
           esta recebendo a da ofensiva (1 treino resolveria as duas) */
        when c.noite_de_domingo and c.zona is not null
          then 'liga_reta_final'
        /* 1. a ofensiva, domingo na hora dela (antes das 21h) */
        when c.hora_dele = c.hora_boa and c.hora_dele < 21 and not c.fechou_hoje and c.sequencia > 0
          and extract(isodow from public.hoje_br()) = 7 and not c.parado
          then 'ofensiva_semanal'
        /* 2. a liga fecha hoje, domingo de manha: so pra quem ja treinou na
           semana (pra quem nao treinou, quem fala e a ofensiva) */
        when c.dia_semana = 7 and c.hora_dele = 10 and c.fechou_hoje and exists (
          select 1 from public.liga_membro m
          join public.liga l on l.id = m.liga_id
          where m.user_id = c.user_id
            and l.semana = public.semana_atual()
            and l.comecou_em is not null
        ) then 'liga'
        /* 3. o resumo da semana, segunda as 14h (depois do fechamento) */
        when c.resumo is not null then 'resumo'
        /* 4. o campeonato chegando */
        when c.faltam_camp is not null and not c.parado then 'campeonato'
        /* 5. um amigo te passou na liga */
        when c.amigo is not null then 'amigo:' || (c.amigo->>'id')
        /* 6. uma meta pessoal por vez */
        when c.meta is not null and c.hora_dele = c.hora_boa
          and (c.meta->>'familia' = 'estudo' or not c.parado)
          then c.meta->>'tipo'
        /* 7. depois do treino: dia de treino, 1h depois da hora de registrar */
        when c.dia_de_treino and not c.treinou_hoje and not c.parado
          and c.hora_dele = c.hora_boa + 2
          then 'pos_treino'
        /* 8. tecnica perto do grau, meio-dia de um dia de treino */
        when c.perto is not null and c.dia_de_treino and not c.treinou_hoje and not c.parado
          and c.hora_dele = 12 and coalesce(c.perto->>'nome', '') <> ''
          then 'grau:' || (c.perto->>'nome')
        /* 9. a volta por cima, uma vez a cada 30 dias */
        when c.hora_dele = c.hora_boa
          and (c.ultimo_ponto is null or c.ultimo_ponto <= c.hoje_dele - 7)
          then 'volta'
        else null
      end as tipo_dele
    from com_extra c
  ),
  texto as (
    select
      e.user_id,
      /* nas retas finais, cada quarto de hora e um tipo (a trava e por
         tipo e dia): ofensiva_reta_final, :2115, :2130 ... :2345 */
      case when e.tipo_dele in ('ofensiva_reta_final', 'liga_reta_final')
             and to_char(now() at time zone 'America/Sao_Paulo', 'HH24MI') >= '2115'
           then e.tipo_dele || ':' || to_char(now() at time zone 'America/Sao_Paulo', 'HH24')
                || lpad(((extract(minute from now() at time zone 'America/Sao_Paulo')::int / 15) * 15)::text, 2, '0')
           else e.tipo_dele end as tipo,
      e.tipo_dele,
      e.hoje_dele as dia,
      e.hora_dele as hora,
      e.endpoint, e.p256dh, e.auth,
      case
        when e.tipo_dele = 'ofensiva_semanal' then e.sequencia || ' semanas de ofensiva em jogo'
        when e.tipo_dele in ('ofensiva_reta_final', 'liga_reta_final') then
          '⏳ ' || to_char((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') - (now() at time zone 'America/Sao_Paulo'), 'FMHH24:MI')
          || case when e.tipo_dele = 'liga_reta_final' then ' pra liga fechar' else ' pra fechar a semana' end
        when e.tipo_dele = 'liga' then 'A semana da Liga fecha hoje'
        when e.tipo_dele = 'resumo' then e.resumo->>'titulo'
        when e.tipo_dele = 'campeonato' then
          case when e.faltam_camp = 1 then '🏆 Amanhã é dia de campeonato' else '🏆 Campeonato em ' || e.faltam_camp || ' dias' end
        when e.tipo_dele like 'amigo:%' then '🥊 ' || left(e.amigo->>'nome', 18) || ' te passou na liga'
        when e.tipo_dele = 'pos_treino' then '🥋 Treinou hoje?'
        when e.tipo_dele like 'grau:%' then '🥋 Falta pouco pro ' || (e.perto->>'grau') || 'º grau'
        when e.tipo_dele = 'volta' then 'O tatame continua aí'
        else e.meta->>'titulo'
      end as titulo,
      case
        when e.tipo_dele = 'ofensiva_semanal' then 'Treinou e não registrou? 1 treino salva a semana.'
        when e.tipo_dele = 'ofensiva_reta_final' then '1 treino registrado = ofensiva segura! ⚠️'
        when e.tipo_dele = 'liga_reta_final' then
          'Você tá na zona de rebaixamento. Faltam ' || (e.zona->>'falta') || ' pontos pra sair.'
        when e.tipo_dele = 'liga' then 'Ainda dá para mudar sua posição antes do fechamento da semana.'
        when e.tipo_dele = 'resumo' then e.resumo->>'corpo'
        when e.tipo_dele = 'campeonato' then
          case when e.faltam_camp = 1 then 'Dorme cedo, confere a pesagem e o horário da luta.'
               when e.faltam_camp = 7 then 'Semana de afiar o jogo: treina o que já funciona.'
               else 'Hora de pegar leve no treino e cuidar do peso.' end
        when e.tipo_dele like 'amigo:%' then
          'Bora dar o troco? Faltam ' || (e.amigo->>'falta') || ' pontos pra passar de volta.'
        when e.tipo_dele = 'pos_treino' then 'Registra os rolas enquanto tá fresco na cabeça.'
        when e.tipo_dele like 'grau:%' then
          'Mais ' || (e.perto->>'usos') || case when (e.perto->>'usos') = '1' then ' uso' else ' usos' end
          || ' da ' || left(e.perto->>'nome', 30) || ' e ela sobe. Bora encaixar hoje?'
        when e.tipo_dele = 'volta' then 'Seu jogo continua aqui. Volte por uma aula, no seu ritmo.'
        else e.meta->>'corpo'
      end as corpo,
      case
        when e.tipo_dele in ('ofensiva_semanal', 'ofensiva_reta_final', 'pos_treino') then '/?go=treinos'
        when e.tipo_dele in ('liga', 'liga_reta_final', 'resumo') or e.tipo_dele like 'amigo:%' then '/?go=liga'
        when e.tipo_dele = 'campeonato' then '/?go=metas'
        when e.tipo_dele like 'grau:%' then '/?go=dominio'
        when e.tipo_dele = 'volta' then '/?go=estudo'
        else e.meta->>'caminho'
      end as caminho
    from escolhido e
    where e.tipo_dele is not null
  )
  select t.user_id, t.tipo, t.dia, t.titulo, t.corpo, t.caminho, 1,
         t.endpoint, t.p256dh, t.auth
  from texto t
  /* a trava: se ja saiu hoje, nao sai de novo */
  where not exists (
    select 1 from public.notificacao_envio n
    where n.user_id = t.user_id and n.tipo = t.tipo and n.dia = t.dia
  )
  /* as retas finais e a ofensiva de domingo sao a excecao; o resto: nada
     entre 22h e 8h, e no maximo 1 aviso por dia */
  and (t.tipo_dele like '%reta_final' or t.tipo_dele = 'ofensiva_semanal' or (
    t.hora between 8 and 21
    and not exists (
      select 1 from public.notificacao_envio n
      where n.user_id = t.user_id and n.dia = t.dia
        and n.tipo not like '%reta_final%' and n.tipo <> 'ofensiva_semanal'
    )
  ))
  /* a volta por cima e uma vez a cada 30 dias, nao por dia */
  and not (t.tipo = 'volta' and exists (
    select 1 from public.notificacao_envio n
    where n.user_id = t.user_id and n.tipo = 'volta'
      and n.enviado_em > now() - interval '30 days'
  ))
  /* a tecnica perto do grau, no maximo uma vez por semana */
  and not (t.tipo like 'grau:%' and exists (
    select 1 from public.notificacao_envio n
    where n.user_id = t.user_id and n.tipo = t.tipo
      and n.enviado_em > now() - interval '7 days'
  ));
end $$;

commit;
