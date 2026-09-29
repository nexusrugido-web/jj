-- OFENSIVA SEMANAL v2. Aplicar uma vez, antes de publicar o app novo.
-- Não altera XP, divisão, registros pessoais ou a coluna diária perfil.sequencia.
-- Funções novas convivem com as antigas. Tudo é aplicado na mesma transação.
begin;

create or replace function public.data_ofensiva(p_texto text)
returns date language plpgsql immutable set search_path = public as $$
declare v_data date;
begin
  if p_texto is null or p_texto !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  v_data := p_texto::date;
  return v_data;
exception when others then return null;
end $$;

-- Função pura, também usada pelos testes de paridade com o app offline.
create or replace function public.calcular_ofensiva_semanal(
  p_sessions jsonb, p_lesoes jsonb, p_hoje date, p_max int default 2
) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_semanas date[]; v_sem date; v_atual date := public.semana_de(p_hoje);
  v_corrente int := 0; v_recorde int := 0; v_escudos int := 0;
  v_progresso int := 0; v_gastos int := 0; v_pausa boolean;
  v_treinou boolean; v_estado text; v_hist jsonb := '[]';
  v_desde date; v_ultimo date; v_limite int := case when p_max = 3 then 3 else 2 end;
begin
  select array_agg(distinct public.semana_de(public.data_ofensiva(s->>'data'))),
         max(public.data_ofensiva(s->>'data'))
    into v_semanas, v_ultimo
  from jsonb_array_elements(coalesce(p_sessions, '[]')) s
  where public.data_ofensiva(s->>'data') <= p_hoje
    and coalesce(s->>'evento', '') = ''
    and coalesce(nullif(s->>'tipo', ''), 'gi') in ('gi','nogi','drill','openmat','privada','competicao')
    and (coalesce(s->>'tipo', '') <> 'competicao'
      or s->'competicao'->>'resultado' in ('ouro','prata','bronze','participou')
);
  select min(x) into v_sem from unnest(v_semanas) x;
  while v_sem <= v_atual loop
    select exists (
      select 1 from jsonb_array_elements(coalesce(p_lesoes,'[]')) l
      where l->>'impacto' = 'parado'
        and public.data_ofensiva(l->>'data') <= least(p_hoje, v_sem + 6)
        and public.data_ofensiva(coalesce(nullif(l->>'dataCura',''),nullif(l->>'fechadaEm',''),p_hoje::text))
            >= greatest(v_sem, public.data_ofensiva(l->>'data'))
    ) into v_pausa;
    if v_sem = any(v_semanas) then
      if v_corrente = 0 then v_desde := v_sem; end if;
      v_corrente := v_corrente + 1;
      v_recorde := greatest(v_recorde,v_corrente);
      v_progresso := v_progresso + 1;
      if v_progresso = 4 then
        v_escudos := least(v_limite,v_escudos+1); v_progresso := 0;
      end if;
      v_estado := 'treinada';
    elsif v_pausa then v_estado := 'pausada';
    elsif v_sem = v_atual then v_estado := 'pendente';
    elsif v_corrente > 0 and v_escudos > 0 then
      v_escudos := v_escudos-1; v_gastos := v_gastos+1; v_estado := 'protegida';
    else
      v_corrente := 0; v_progresso := 0; v_desde := null; v_estado := 'sem_treino';
    end if;
    v_hist := v_hist || jsonb_build_array(jsonb_build_object('semana',v_sem,'estado',v_estado));
    v_sem := v_sem + 7;
  end loop;
  v_treinou := coalesce(v_atual = any(v_semanas),false);
  select not v_treinou and exists (
    select 1 from jsonb_array_elements(coalesce(p_lesoes,'[]')) l
    where l->>'impacto' = 'parado' and public.data_ofensiva(l->>'data') <= p_hoje
      and public.data_ofensiva(coalesce(nullif(l->>'dataCura',''),nullif(l->>'fechadaEm',''),p_hoje::text))
          >= greatest(v_atual,public.data_ofensiva(l->>'data'))
  ) into v_pausa;
  return jsonb_build_object('versao',2,'unidade','semanas','semanaAtual',v_atual,'calculadaEm',p_hoje,
    'semanas',v_corrente,'recorde',v_recorde,'viva',v_corrente>0,
    'treinouEstaSemana',v_treinou,'congelada',v_pausa,
    'estado',case when v_treinou then 'treinada' when v_pausa then 'pausada' else 'pendente' end,
    'escudos',v_escudos,'maxEscudos',v_limite,'gastos',v_gastos,
    'faltaProEscudo',case when v_escudos>=v_limite then 0 else 4-v_progresso end,
    'desde',v_desde,'historico',v_hist,'ultimoTreino',v_ultimo);
end $$;

-- Interna: não aceita leitura arbitrária de lesões/treinos pelo cliente.
create or replace function public.ofensiva_semanal_de(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.calcular_ofensiva_semanal(
    coalesce(jsonb_agg(r.dados) filter (where r.tabela='sessions'),'[]'),
    coalesce(jsonb_agg(r.dados) filter (where r.tabela='injuries'),'[]'),
    public.hoje_br(),
    case when (select t.divisao from public.total_xp t where t.user_id=p_user) in ('roxa','marrom','preta') then 3 else 2 end)
  from public.registros r where r.user_id=p_user and r.deleted_at is null
    and r.tabela in ('sessions','injuries');
$$;
revoke all on function public.ofensiva_semanal_de(uuid) from public, anon, authenticated;
revoke all on function public.calcular_ofensiva_semanal(jsonb,jsonb,date,int) from public, anon, authenticated;
revoke all on function public.data_ofensiva(text) from public, anon, authenticated;

create or replace function public.minha_ofensiva_semanal()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when auth.uid() is not null then public.ofensiva_semanal_de(auth.uid()) else null end;
$$;

-- Reaproveitam a autorização e os campos das funções já instaladas.
-- Só os clientes novos chamam essas versões, com unidade semanal explícita.
create or replace function public.minha_liga_semanal()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(l) || jsonb_build_object('sequencia',(public.ofensiva_semanal_de(l.user_id)->>'semanas')::int,'ofensiva_unidade','semanas')
  from public.minha_liga() l;
$$;
create or replace function public.meus_amigos_semanal()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(a) || jsonb_build_object('sequencia',(public.ofensiva_semanal_de(a.user_id)->>'semanas')::int,'ofensiva_unidade','semanas')
  from public.meus_amigos() a;
$$;
create or replace function public.perfil_na_liga_semanal(p_user uuid)
returns setof jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(p) || jsonb_build_object('sequencia',(public.ofensiva_semanal_de(p_user)->>'semanas')::int,'ofensiva_unidade','semanas')
  from public.perfil_na_liga(p_user) p;
$$;
create or replace function public.ranking_ofensivas_semanais()
returns table(posicao bigint,nome text,faixa text,graus int,semanas int,sou_eu boolean,de_fora boolean)
language sql stable security definer set search_path = public as $$
  with valores as materialized (
    select p.*, (public.ofensiva_semanal_de(p.user_id)->>'semanas')::int as semanas
    from public.perfil p where p.participa_liga and auth.uid() is not null
  ), ranking as (
    select row_number() over(order by p.semanas desc,p.criado_em,p.user_id) as pos,p.*
    from valores p where p.semanas>0
  )
  select r.pos,public.nome_publico(p),r.faixa,r.graus,r.semanas,r.user_id=auth.uid(),
         r.pos>public.ajuste_de('ranking_tamanho',20)
  from ranking r join public.perfil p on p.user_id=r.user_id
  where r.pos<=public.ajuste_de('ranking_tamanho',20) or r.user_id=auth.uid()
  order by 7,1;
$$;

revoke all on function public.minha_ofensiva_semanal() from public, anon;
revoke all on function public.minha_liga_semanal() from public, anon;
revoke all on function public.meus_amigos_semanal() from public, anon;
revoke all on function public.perfil_na_liga_semanal(uuid) from public, anon;
revoke all on function public.ranking_ofensivas_semanais() from public, anon;
grant execute on function public.minha_ofensiva_semanal() to authenticated;
grant execute on function public.minha_liga_semanal() to authenticated;
grant execute on function public.meus_amigos_semanal() to authenticated;
grant execute on function public.perfil_na_liga_semanal(uuid) to authenticated;
grant execute on function public.ranking_ofensivas_semanais() to authenticated;

-- A atualização da fila de notificações vem abaixo, na mesma transação.

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
      i.user_id, i.endpoint, i.p256dh, i.auth, i.fuso, (o.valor->>'semanas')::int as sequencia, o.valor as ofensiva,
      (now() at time zone i.fuso)::date            as hoje_dele,
      extract(hour from now() at time zone i.fuso)::int as hora_dele,
      extract(isodow from now() at time zone i.fuso)::int as dia_semana
    from public.push_inscricao i
    join public.perfil p on p.user_id = i.user_id
    cross join lateral (select public.ofensiva_semanal_de(i.user_id) as valor) o
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
        /* 1. a ofensiva, na hora dela */
        when c.hora_dele = c.hora_boa and not c.fechou_hoje and c.sequencia > 0
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
          where f.semana = public.semana_atual() - 7
        ) then 'resultado'
        /* 4. a volta por cima, uma vez so */
        when c.hora_dele = c.hora_boa
          and (c.ultimo_ponto is null or c.ultimo_ponto <= c.hoje_dele - 7)
          then 'volta'
        else null
      end as tipo_dele
    from candidato c
  ),
  texto as (
    select
      e.user_id, e.tipo_dele as tipo, e.hoje_dele as dia,
      e.endpoint, e.p256dh, e.auth, e.sequencia,
      case e.tipo_dele
        when 'ofensiva_semanal' then
          e.sequencia || ' semanas de ofensiva: sua semana ainda esta aberta'
        when 'liga'      then 'A semana da liga fecha hoje'
        when 'resultado' then 'A liga fechou'
        when 'volta'     then 'O tatame continua ai'
      end as titulo,
      case e.tipo_dele
        when 'ofensiva_semanal' then case when (e.ofensiva->>'escudos')::int > 0 then 'Se voce treinou, registre. Sem treino, um escudo protege esta semana sem somar semanas.' else 'Se voce treinou nesta semana, registre seu treino para manter a sequencia.' end
        when 'liga'     then 'Ainda da pra mexer na sua posicao antes da meia-noite.'
        when 'resultado' then 'Veja onde voce parou e com quem voce corre esta semana.'
        when 'volta'    then 'Seu jogo esta do mesmo jeito que voce deixou. Da pra voltar por uma aula.'
      end as corpo,
      case e.tipo_dele
        when 'ofensiva_semanal' then '/?go=treinos'
        when 'liga'      then '/?go=jornada'
        when 'resultado' then '/?go=jornada'
        when 'volta'     then '/?go=estudo'
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

create or replace function public.diagnostico_de_aviso(p_email text)
returns table (elo text, situacao text, detalhe text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_n    int;
  v_fuso text;
  v_hoje date;
  v_ofensiva jsonb;
begin
  /* só quem administra: aberta, qualquer visitante descobria se um
     e-mail tem conta e mandava aviso pro celular de qualquer aluno */
  if not public.sou_admin() then
    raise exception 'so o administrador testa avisos';
  end if;
  select id into v_user from auth.users where email = lower(trim(p_email));
  if v_user is null then
    return query select '1. conta'::text, 'NAO'::text, ('nenhuma conta com o email ' || p_email)::text;
    return;
  end if;
  v_ofensiva := public.ofensiva_semanal_de(v_user);
  return query select '1. conta'::text, 'ok'::text, v_user::text;

  select count(*), max(fuso) into v_n, v_fuso from public.push_inscricao where user_id = v_user;
  v_fuso := coalesce(v_fuso, 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;

  return query select '2. aparelho inscrito'::text,
    case when v_n > 0 then 'ok' else 'NAO' end::text,
    case when v_n > 0 then v_n || ' aparelho(s), fuso ' || v_fuso
         else 'ninguem tocou em Ligar avisos. No iPhone so funciona com o app instalado na tela de inicio.' end::text;

  return query select '3. interruptor'::text,
    case when coalesce((select notificar from public.perfil where user_id = v_user), false)
      then 'ok' else 'NAO' end::text,
    'perfil.notificar'::text;

  return query select '4. ofensiva semanal'::text, 'info'::text,
    ((v_ofensiva->>'semanas') || ' semanas; ' || (v_ofensiva->>'escudos') || ' escudos; estado: ' || (v_ofensiva->>'estado'))::text;

  return query select '5. hora do aviso'::text, 'info'::text,
    ('sai as ' || public.hora_da_pessoa(v_user, v_fuso) || 'h; agora sao '
      || extract(hour from now() at time zone v_fuso)::int || 'h no fuso ' || v_fuso)::text;

  return query select '6. treino nesta semana?'::text,
    case when (v_ofensiva->>'treinouEstaSemana')::boolean then 'SIM' else 'nao' end::text,
    'O aviso semanal sai no domingo, apenas com sequencia ativa, sem treino e sem pausa por lesao.'::text;

  return query select '7. cron agendado'::text,
    case when exists (select 1 from cron.job where jobname = 'notificar') then 'ok' else 'NAO' end::text,
    coalesce((select schedule from cron.job where jobname = 'notificar'), 'rode a secao 8 deste arquivo')::text;

  return query select '8. segredos do vault'::text,
    case when (select count(*) from vault.secrets where name in ('url_notificar', 'chave_notificar')) = 2
      then 'ok' else 'NAO' end::text,
    'precisa de url_notificar e chave_notificar'::text;

  return query select '9. ja saiu alguma?'::text, 'info'::text,
    coalesce((select count(*)::text || ' aviso(s), ultimo em ' || max(enviado_em)::text
      from public.notificacao_envio where user_id = v_user), 'nenhum ainda')::text;
end $$;

commit;
