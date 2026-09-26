-- ============================================================
-- O RESULTADO DA SEMANA DA LIGA
--
-- Colar DEPOIS do 10 (amigos). Pode rodar de novo sem estragar.
--
-- Antes, o fechamento de segunda ao meio-dia subia e descia a
-- divisao de cada um e seguia em frente: nao ficava guardado em
-- que lugar a pessoa terminou nem se ela subiu. O app nao tinha
-- como mostrar "voce terminou em 2o e subiu pro Estadual".
--
-- Agora o fechamento guarda, pra cada um do grupo:
--   posicao_final   em que lugar terminou
--   resultado       subiu | desceu | ficou | sozinho (grupo de 1
--                   nao corre)
--   divisao_antes   a divisao com que entrou na semana
--   divisao_depois  a divisao com que sai
--
-- E minha_semana_passada() entrega isso pra tela, com o podio do
-- grupo. Segunda de manha, antes do fechamento, ela devolve a
-- semana ainda aberta (fechada = false) com a posicao parcial.
-- ============================================================

alter table public.liga_membro add column if not exists posicao_final  int;
alter table public.liga_membro add column if not exists resultado      text;
alter table public.liga_membro add column if not exists divisao_antes  text;
alter table public.liga_membro add column if not exists divisao_depois text;


-- ------------------------------------------------------------
-- O FECHAMENTO, igual ao de antes (liga-automatica.sql, secao
-- 10), e agora guardando o resultado de cada um.
-- ------------------------------------------------------------
drop function if exists public.fechar_semana();

create or replace function public.fechar_semana()
returns table (semana_fechada date, subiram int, desceram int, grupos int)
language plpgsql security definer set search_path = public as $$
declare
  v_corte int := public.ajuste_de('liga_corte', 3);
  v_sem   date;
  v_liga  bigint;
  v_n     int;
  v_c     int;
  v_sobe  int;
  v_desce int;
  v_g     int;
  v_linha record;
begin
  for v_sem in
    select distinct l.semana from public.liga l
    where l.semana < public.semana_atual()
      and not exists (select 1 from public.liga_fechamento f where f.semana = l.semana)
    order by 1
  loop
    v_sobe := 0; v_desce := 0; v_g := 0;

    for v_liga in select l.id from public.liga l where l.semana = v_sem loop
      select count(*) into v_n from public.liga_membro where liga_id = v_liga;

      /* a foto do grupo antes de mexer em qualquer divisao */
      update public.liga_membro m set
        posicao_final = r.pos,
        divisao_antes = r.divisao,
        divisao_depois = r.divisao,
        resultado = case when v_n < 2 then 'sozinho' else 'ficou' end
      from (
        select x.user_id, coalesce(t.divisao, 'branca') as divisao,
               row_number() over (order by x.xp_semana desc, x.entrou_em, x.user_id) as pos
        from public.liga_membro x
        left join public.total_xp t on t.user_id = x.user_id
        where x.liga_id = v_liga
      ) r
      where m.liga_id = v_liga and m.user_id = r.user_id;

      continue when v_n < 2;
      v_g := v_g + 1;
      v_c := greatest(1, least(v_corte, v_n / 3));

      for v_linha in
        select m.user_id from public.liga_membro m
        where m.liga_id = v_liga and m.xp_semana > 0
        order by m.xp_semana desc, m.entrou_em, m.user_id
        limit v_c
      loop
        update public.total_xp set divisao = public.divisao_acima(divisao), atualizado = now()
        where user_id = v_linha.user_id and divisao <> 'preta';
        if found then
          v_sobe := v_sobe + 1;
          update public.liga_membro set resultado = 'subiu' where liga_id = v_liga and user_id = v_linha.user_id;
        end if;
      end loop;

      if v_n >= v_c * 2 + 1 then
        for v_linha in
          select m.user_id from public.liga_membro m
          where m.liga_id = v_liga
          order by m.xp_semana asc, m.entrou_em desc, m.user_id
          limit v_c
        loop
          update public.total_xp set divisao = public.divisao_abaixo(divisao), atualizado = now()
          where user_id = v_linha.user_id and divisao <> 'branca';
          if found then
            v_desce := v_desce + 1;
            update public.liga_membro set resultado = 'desceu' where liga_id = v_liga and user_id = v_linha.user_id;
          end if;
        end loop;
      end if;

      /* a divisao com que cada um sai da semana */
      update public.liga_membro m set divisao_depois = coalesce(t.divisao, 'branca')
      from public.total_xp t
      where m.liga_id = v_liga and t.user_id = m.user_id;
    end loop;

    insert into public.liga_fechamento (semana, subiram, desceram) values (v_sem, v_sobe, v_desce);
    return query select v_sem, v_sobe, v_desce, v_g;
  end loop;

  /* quem ainda nao pontuou na semana nova comeca do zero */
  update public.total_xp set xp_semana = 0, semana = public.semana_atual()
  where total_xp.semana is distinct from public.semana_atual();
end $$;

revoke all on function public.fechar_semana() from public, anon, authenticated;


-- ------------------------------------------------------------
-- A MINHA SEMANA PASSADA
--
-- A ultima semana em que eu corri, antes da atual. Semana fechada
-- antes deste SQL nao tem resultado guardado: vem com a posicao
-- (pela ordem do grupo) e resultado vazio, e a tela mostra so o
-- lugar. O podio vem com o nome publico e a foto publica de cada
-- um, igual a liga mostra durante a semana.
-- ------------------------------------------------------------
drop function if exists public.minha_semana_passada();

create or replace function public.minha_semana_passada()
returns table (
  semana         date,
  fechada        boolean,
  posicao        int,
  total          int,
  xp             int,
  resultado      text,
  divisao_antes  text,
  divisao_depois text,
  em_sala        boolean,
  podio          jsonb
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_liga bigint;
  v_sem  date;
begin
  if v_user is null then return; end if;

  select l.id, l.semana into v_liga, v_sem
  from public.liga_membro m join public.liga l on l.id = m.liga_id
  where m.user_id = v_user and l.semana < public.semana_atual()
  order by l.semana desc
  limit 1;
  if v_liga is null then return; end if;

  return query
  with g as (
    select x.user_id, x.xp_semana, x.resultado, x.divisao_antes, x.divisao_depois,
           coalesce(x.posicao_final,
             row_number() over (order by x.xp_semana desc, x.entrou_em, x.user_id)::int) as pos
    from public.liga_membro x
    where x.liga_id = v_liga
  )
  select
    v_sem,
    exists (select 1 from public.liga_fechamento f where f.semana = v_sem),
    g.pos,
    (select count(*) from g)::int,
    g.xp_semana,
    g.resultado,
    g.divisao_antes,
    g.divisao_depois,
    (select l.sala_id is not null from public.liga l where l.id = v_liga),
    (select jsonb_agg(jsonb_build_object(
        'nome', public.nome_publico(p), 'xp', y.xp_semana, 'posicao', y.pos,
        'sou_eu', y.user_id = v_user, 'foto', public.foto_publica(p)) order by y.pos)
     from g y join public.perfil p on p.user_id = y.user_id
     where y.pos <= 3)
  from g
  where g.user_id = v_user;
end $$;

grant execute on function public.minha_semana_passada() to authenticated;
