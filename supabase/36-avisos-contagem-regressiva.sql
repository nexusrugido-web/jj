-- CONTAGEM REGRESSIVA DOS AVISOS. Aplicar DEPOIS do 35.
-- Nao recria cron, segredos nem tabelas; troca so o gerador das metas e a fila.
--
-- Ofensiva semanal: alem do aviso de domingo na hora de costume, sai um
-- de reta final as 21h de Brasilia (3h antes da semana fechar), so pra
-- quem tem ofensiva viva e a semana sem treino, atualizado em silencio as
-- 22h e as 23h (3h, 2h, 1h). O celular mostra quanto falta na hora em que
-- o aviso aparece (public/sw.js). Pode reaplicar: e seguro.
--
-- Meta de treinos por semana: sai no dia em que nao sobra folga (os
-- treinos que faltam sao os dias que faltam ate domingo), uma vez por
-- semana, fora do limite de dois avisos de meta. Antes saia so na sexta,
-- e a regra de 14 dias fazia ela pular uma semana sim, outra nao.
begin;

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
          /* a semanal vence toda semana: o intervalo dela e a semana */
          and case when r.dados->>'tipo' = 'frequencia'
                   then n.dia >= public.semana_de(p_hoje)
                   else n.enviado_em > now() - interval '14 days' end
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
      /* a semanal avisa no dia em que nao sobra folga: os treinos que
         faltam sao os dias que faltam ate domingo. Antes disso ainda da
         pra respirar; depois disso ja nao fecha mais. */
      c.tipo = 'frequencia' and c.alvo_num between 1 and 7 and c.feito < c.alvo_num
        and c.alvo_num - c.feito = 8 - extract(isodow from p_hoje)::int
        and (extract(isodow from p_hoje) < 7 or c.feito > 0)
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
    'titulo', '🎯 ' || e.titulo,
    'corpo', case
      when e.tipo = 'frequencia' and e.alvo_num between 1 and 7
        and e.alvo_num - e.feito = 1 and extract(isodow from p_hoje) = 7 then
        'Último dia: 1 treino fecha a meta da semana.'
      when e.tipo = 'frequencia' and e.alvo_num between 1 and 7
        and e.alvo_num - e.feito between 2 and 8 - extract(isodow from p_hoje)::int then
        'Faltam ' || (8 - extract(isodow from p_hoje)::int) || ' dias e ' || (e.alvo_num - e.feito) ||
        ' treinos (' || e.feito || ' de ' || e.alvo_num || '). Cada dia conta.'
      when e.tipo = 'frequencia' and e.alvo_num between 1 and 7 then
        e.feito || ' de ' || e.alvo_num || ' treinos nesta semana. Treinou? Registra.'
      when e.tipo = 'treinos' and e.alvo_num is not null then
        e.feito || ' de ' || e.alvo_num || ' treinos registrados. Bora pro próximo.'
      when e.tipo = 'manual' and e.alvo_num is not null then
        'Contador em ' || e.feito || ' de ' || e.alvo_num || '. Atualiza quando quiser.'
      when e.tipo = 'competicao' and e.data_competicao > p_hoje then
        'Faltam ' || (e.data_competicao - p_hoje) || ' dias pro campeonato. Confere a preparação.'
      when e.tipo = 'tecnica' then 'Usou ela no treino? Registra pra ela subir de grau.'
      when e.tipo = 'defesa' then 'No próximo rola, registra se essa defesa funcionou.'
      when e.tipo = 'aulas' then '1 aula rápida já conta pra essa meta.'
      when e.tipo = 'quiz' then 'Revisa um conceito no quiz e soma acertos.'
      when e.tipo = 'rolas' then 'Registra os rolas de verdade pra meta andar.'
      when e.tipo = 'posicao' then 'Anota de onde começou o próximo rola.'
      when e.tipo = 'volume' then 'O tempo de treino registrado alimenta essa meta.'
      else 'Abre pra ver seu progresso.'
    end,
    'caminho', '/?go=metas'
  )
  from escolhido e
  /* a semanal nao entra no limite de dois por semana: ela e o prazo */
  where p_meta is not null or e.tipo = 'frequencia' or (select count(*) from public.notificacao_envio n
         where n.user_id = p_user and n.tipo like 'meta:%'
           and n.dia between public.semana_de(p_hoje) and p_hoje) < 2;
$$;

revoke all on function public.proxima_meta_para_aviso(uuid,date,uuid)
  from public, anon, authenticated;

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
     uma pessoa so. Serve pra ver a notificacao na mao sem esperar
     a hora certa, e pra saber se a corrente inteira (banco ->
     funcao -> servico de push -> aparelho) esta de pe. */
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
      public.hora_da_pessoa(a.user_id, a.fuso) as hora_boa
    from aparelho a
    where a.user_id not in (select s.user_id from surdo s)
  ),
  escolhido as (
    select
      c.*,
      case
        /* 0. a reta final: domingo das 21h a meia-noite de Brasilia, se a
           ofensiva esta viva e a semana ainda sem treino. As 21h sai com som;
           de 15 em 15 minutos o mesmo aviso e redesenhado em silencio (o cron
           notificar-reta-final chama nos quartos de hora); as 23h toca de novo */
        when extract(isodow from public.hoje_br()) = 7
          and extract(hour from now() at time zone 'America/Sao_Paulo')::int between 21 and 23
          and not c.fechou_hoje and c.sequencia > 0
          and not (c.ofensiva->>'congelada')::boolean
          then 'ofensiva_reta_final'
        /* 1. a ofensiva, na hora dela (depois das 21h quem fala e a reta final) */
        when c.hora_dele = c.hora_boa and c.hora_dele < 21 and not c.fechou_hoje and c.sequencia > 0
          and extract(isodow from public.hoje_br()) = 7
          and not (c.ofensiva->>'congelada')::boolean
          then 'ofensiva_semanal'
        /* 2. a reta final da liga, domingo de manha */
        when c.dia_semana = 7 and c.hora_dele = 10 and exists (
          select 1 from public.liga_membro m
          join public.liga l on l.id = m.liga_id
          where m.user_id = c.user_id
            and l.semana = public.semana_atual()
            and l.comecou_em is not null
        ) then 'liga'
        /* 3. o resultado, segunda depois do fechamento do meio-dia */
        when c.dia_semana = 1 and c.hora_dele = 14 and exists (
          select 1 from public.liga_fechamento f
          join public.liga l on l.semana = f.semana
          join public.liga_membro m on m.liga_id = l.id
          where f.semana = public.semana_atual() - 7
            and m.user_id = c.user_id
        ) then 'resultado'
        /* 4. uma meta pessoal por vez, no maximo duas por semana */
        when c.meta is not null and c.hora_dele = c.hora_boa
          and (c.meta->>'familia' = 'estudo'
            or not coalesce((c.ofensiva->>'congelada')::boolean, false))
          then c.meta->>'tipo'
        /* 5. a volta por cima, uma vez a cada 30 dias */
        when c.hora_dele = c.hora_boa
          and (c.ultimo_ponto is null or c.ultimo_ponto <= c.hoje_dele - 7)
          then 'volta'
        else null
      end as tipo_dele
    from candidato c
  ),
  texto as (
    select
      e.user_id,
      /* cada quarto de hora e um tipo (a trava e por tipo e dia):
         ofensiva_reta_final, :2115, :2130 ... :2345 */
      case when e.tipo_dele = 'ofensiva_reta_final' and to_char(now() at time zone 'America/Sao_Paulo', 'HH24MI') >= '2115'
           then e.tipo_dele || ':' || to_char(now() at time zone 'America/Sao_Paulo', 'HH24')
                || lpad(((extract(minute from now() at time zone 'America/Sao_Paulo')::int / 15) * 15)::text, 2, '0')
           else e.tipo_dele end as tipo,
      e.hoje_dele as dia,
      e.endpoint, e.p256dh, e.auth, e.sequencia,
      case e.tipo_dele
        when 'ofensiva_semanal' then
          e.sequencia || ' semanas de ofensiva em jogo'
        when 'ofensiva_reta_final' then
          '⏳ ' || to_char((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') - (now() at time zone 'America/Sao_Paulo'), 'FMHH24:MI') || ' pra fechar a semana'
        when 'liga'      then 'A semana da Liga fecha hoje'
        when 'resultado' then 'A liga fechou'
        when 'volta'     then 'O tatame continua aí'
        else e.meta->>'titulo'
      end as titulo,
      case e.tipo_dele
        when 'ofensiva_semanal' then case when (e.ofensiva->>'escudos')::int > 0 then 'Se você treinou, registre. Sem treino, um escudo protege esta semana sem somar semanas.' else 'Se você treinou nesta semana, registre para manter a sequência.' end
        when 'ofensiva_reta_final' then '1 treino registrado = ofensiva segura! ⚠️'
        when 'liga'     then 'Ainda dá para mudar sua posição antes do fechamento da semana.'
        when 'resultado' then 'Veja onde você terminou e como começa esta semana.'
        when 'volta'    then 'Seu jogo continua aqui. Volte por uma aula, no seu ritmo.'
        else e.meta->>'corpo'
      end as corpo,
      case e.tipo_dele
        when 'ofensiva_semanal' then '/?go=treinos'
        when 'ofensiva_reta_final' then '/?go=treinos'
        when 'liga'      then '/?go=jornada'
        when 'resultado' then '/?go=jornada'
        when 'volta'     then '/?go=estudo'
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
  /* e a volta por cima e uma vez a cada 30 dias, nao por dia */
  and not (t.tipo = 'volta' and exists (
    select 1 from public.notificacao_envio n
    where n.user_id = t.user_id and n.tipo = 'volta'
      and n.enviado_em > now() - interval '30 days'
  ));
end $$;



commit;
