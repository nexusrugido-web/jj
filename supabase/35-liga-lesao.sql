-- ============================================================
-- LESAO NAO DERRUBA NINGUEM NA LIGA
--
-- Colar DEPOIS do 34 (precisa do 24). Pode rodar de novo sem estragar.
--
-- Decidido pelo usuario (auditoria de 30/09/2026): quem esta com
-- lesao impeditiva nao pode ser rebaixado por nao treinar, e
-- tambem nao sobe enquanto isso. Ninguem deve treinar machucado
-- pra salvar a divisao.
--
--   perfil.lesao_desde  o dia em que a lesao impeditiva aberta
--                       comecou. O app escreve e apaga sozinho
--                       (lesao curada = null). Ninguem mais le:
--                       e dado de saude.
--   no fechamento       quem tinha lesao marcada ate o domingo
--                       daquela semana fica com resultado
--                       'protegido': nao sobe nem desce. Os outros
--                       do grupo seguem a regra de sempre.
--
-- O fechamento abaixo e o mesmo do 24, com a protecao.
-- ============================================================

alter table public.perfil add column if not exists lesao_desde date;

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
        resultado = case when v_n < 2 then 'sozinho' when v_n < 3 then 'poucos'
                         when r.protegido then 'protegido' else 'ficou' end
      from (
        select x.user_id, coalesce(t.divisao, 'branca') as divisao,
               coalesce(p.lesao_desde <= v_sem + 6, false) as protegido,
               row_number() over (order by x.xp_semana desc, x.entrou_em, x.user_id) as pos
        from public.liga_membro x
        left join public.total_xp t on t.user_id = x.user_id
        left join public.perfil p on p.user_id = x.user_id
        where x.liga_id = v_liga
      ) r
      where m.liga_id = v_liga and m.user_id = r.user_id;

      continue when v_n < 3;
      v_g := v_g + 1;
      v_c := greatest(1, least(v_corte, v_n / 3));

      /* os que terminaram na frente, e so os que fizeram o minimo da divisao deles */
      for v_linha in
        select m.user_id from public.liga_membro m
        where m.liga_id = v_liga and m.xp_semana > 0
        order by m.xp_semana desc, m.entrou_em, m.user_id
        limit v_c
      loop
        update public.total_xp set divisao = public.divisao_acima(divisao), atualizado = now()
        where user_id = v_linha.user_id and divisao <> 'preta'
          and (select x.xp_semana from public.liga_membro x where x.liga_id = v_liga and x.user_id = v_linha.user_id)
              >= coalesce(public.minimo_pra_subir(divisao), 2147483647)
          /* com lesao impeditiva na semana, nao sobe */
          and not coalesce((select p.lesao_desde <= v_sem + 6 from public.perfil p where p.user_id = v_linha.user_id), false);
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
          where user_id = v_linha.user_id and divisao <> 'branca'
            /* nem desce: ninguem treina machucado pra salvar a divisao */
            and not coalesce((select p.lesao_desde <= v_sem + 6 from public.perfil p where p.user_id = v_linha.user_id), false);
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

    /* quem subiu ganha +30 no total. Entra depois do fechamento da
       semana, entao o gatilho dos pontos soma no total e nao mexe em
       corrida nenhuma. Rodar de novo nao da de novo (ref_id unico). */
    insert into public.pontos (user_id, evento, xp, ref_id, detalhe, data, semana, mes)
    select m.user_id, 'divisao', 30, 'divisao:' || v_sem, m.divisao_depois,
           v_sem + 6, v_sem, to_char(v_sem + 6, 'YYYY-MM')
    from public.liga_membro m join public.liga l on l.id = m.liga_id
    where l.semana = v_sem and m.resultado = 'subiu'
    on conflict (user_id, evento, ref_id) do nothing;
    return query select v_sem, v_sobe, v_desce, v_g;
  end loop;

  /* quem ainda nao pontuou na semana nova comeca do zero */
  update public.total_xp set xp_semana = 0, semana = public.semana_atual()
  where total_xp.semana is distinct from public.semana_atual();
end $$;

revoke all on function public.fechar_semana() from public, anon, authenticated;
