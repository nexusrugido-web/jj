-- 48: AVISOS DE EVOLUÇÃO
--
-- O aviso do dia deixa de falar de liga e passa a falar do seu jogo,
-- com o que o app sabe de você (ele manda isso quando você abre o
-- Painel): a técnica perto do grau, o golpe que mais te pega, a
-- posição em que você só tem uma saída, a técnica que mais entra e a
-- aula da semana que ainda não chegou no rola. Um fato por dia,
-- rodando. Sem nada disso, sai uma frase de tatame por dia da semana.
-- Sai também o "a liga fecha hoje" de domingo de manhã.
-- Continua: no máximo 1 por dia, nada entre 22h e 8h, todo dia às 21h
-- se nada saiu. Pode rodar de novo sem problema.
--
-- Cole no SQL Editor do Supabase e rode.

begin;

/* qual fato vira o aviso hoje: os que existem, um por dia, rodando.
   Sem fato nenhum, o número do dia da semana (0 = segunda) */
create or replace function public.tema_do_aviso(p_evo jsonb, p_dia int)
returns text language sql immutable as $$
  with fatos as (
    select k, ordem from (values ('perto', 1), ('pega', 2), ('unica', 3), ('forte', 4), ('tema', 5)) v(k, ordem)
    where jsonb_typeof(p_evo -> k) = 'object' and coalesce(p_evo -> k ->> 'nome', '') <> ''
  ),
  numerados as (select k, row_number() over (order by ordem) - 1 as i, count(*) over () as n from fatos)
  select coalesce((select k from numerados where i = p_dia % n), p_dia::text);
$$;

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
      'titulo', '🫣 Esse golpe tá te caçando',
      'corpo', left(p_evo->'pega'->>'nome', 30) || ' te pegou ' || (p_evo->'pega'->>'vezes') || ' vezes. Bora ver a saída?',
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
      a.user_id in (select s.user_id from surdo s) as surdo,
      exists (
        select 1 from public.notificacao_envio n
        where n.user_id = a.user_id and n.dia = a.hoje_dele
      ) as avisado_hoje,
      /* o tema do aviso do dia: 0 = segunda ... 6 = domingo */
      (extract(isodow from a.hoje_dele)::int - 1) as tema_do_dia,
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
      (select r.dados->'avisosDoApp' from public.registros r
       where r.user_id = a.user_id and r.tabela = 'settings' and r.deleted_at is null limit 1) as evo,
      extract(isodow from public.hoje_br()) = 7
        and extract(hour from now() at time zone 'America/Sao_Paulo')::int between 21 and 23 as noite_de_domingo
    from aparelho a
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
        /* quem ignorou os ultimos avisos recebe so o aviso do dia */
        when c.surdo then
          case when c.hora_dele = 21 and not c.avisado_hoje then 'dia:' || public.tema_do_aviso(c.evo, c.tema_do_dia) end
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
        /* 2. (o "a liga fecha hoje" de domingo saiu: o aviso fala do tatame) */
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
        /* 9. a volta por cima, uma vez a cada 30 dias (a trava fica aqui
           dentro: travada, a hora fica livre pro aviso do dia) */
        when c.hora_dele = c.hora_boa
          and (c.ultimo_ponto is null or c.ultimo_ponto <= c.hoje_dele - 7)
          and not exists (
            select 1 from public.notificacao_envio n
            where n.user_id = c.user_id and n.tipo = 'volta'
              and n.enviado_em > now() - interval '30 days'
          )
          then 'volta'
        /* 10. o aviso do dia: 21h e nada saiu hoje. Todo dia tem aviso */
        when c.hora_dele = 21 and not c.avisado_hoje
          then 'dia:' || public.tema_do_aviso(c.evo, c.tema_do_dia)
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
        when e.tipo_dele like 'dia:%' then public.aviso_do_dia(split_part(e.tipo_dele, ':', 2), e.evo)->>'titulo'
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
        when e.tipo_dele like 'dia:%' then public.aviso_do_dia(split_part(e.tipo_dele, ':', 2), e.evo)->>'corpo'
        else e.meta->>'corpo'
      end as corpo,
      case
        when e.tipo_dele in ('ofensiva_semanal', 'ofensiva_reta_final', 'pos_treino') then '/?go=treinos'
        when e.tipo_dele in ('liga', 'liga_reta_final', 'resumo') or e.tipo_dele like 'amigo:%' then '/?go=liga'
        when e.tipo_dele = 'campeonato' then '/?go=metas'
        when e.tipo_dele like 'grau:%' then '/?go=dominio'
        when e.tipo_dele = 'volta' then '/?go=estudo'
        when e.tipo_dele like 'dia:%' then public.aviso_do_dia(split_part(e.tipo_dele, ':', 2), e.evo)->>'caminho'
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
