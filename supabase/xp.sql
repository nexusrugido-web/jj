-- ============================================================
-- TATAME OS, XP E PERFIL
--
-- Conserta tres coisas que estavam quebradas entre o app e o
-- servidor, e prepara o terreno pro pareamento.
--
-- 1. O app e o banco tinham DUAS tabelas de XP com valores
--    diferentes. Short valia 1 no app e 6 aqui. O numero que
--    a pessoa via na tela nao era o que entrava na liga.
--
-- 2. O evento "revista" existia so no app. Quem revia uma aula
--    ganhava 5 pontos na tela, mandava pro servidor, e o
--    servidor respondia "evento desconhecido" e jogava fora.
--
-- 3. O teto semanal de estudo existia so no app. Aqui nao tinha
--    teto nenhum, entao dava pra liderar o ranking no sofa.
--
-- Rode no SQL Editor do Supabase, depois de admin.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. AJUSTES NUMERICOS
--
-- Numero que voce pode querer mexer sem fazer deploy mora aqui,
-- do mesmo jeito que a tabela chave guarda o que esta ligado.
-- ------------------------------------------------------------
create table if not exists public.ajuste (
  id         text primary key,
  nome       text not null,
  descricao  text,
  valor      int  not null,
  minimo     int  not null default 0,
  maximo     int  not null default 10000,
  grupo      text not null default 'geral',
  atualizado timestamptz not null default now()
);

alter table public.ajuste enable row level security;

-- todo mundo le, porque o app precisa saber os limites
drop policy if exists ajuste_leitura on public.ajuste;
create policy ajuste_leitura on public.ajuste
  for select to anon, authenticated using (true);

drop policy if exists ajuste_escrita on public.ajuste;
create policy ajuste_escrita on public.ajuste
  for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

insert into public.ajuste (id, nome, descricao, valor, minimo, maximo, grupo) values
  ('teto_estudo_semana', 'Teto de pontos de estudo por semana',
   'Video nao substitui tatame. Passou disto, estudar para de pontuar ate a semana virar.',
   140, 0, 2000, 'estudo')
on conflict (id) do nothing;

create or replace function public.ajuste_de(p_id text, p_padrao int)
returns int language sql stable set search_path = public as $$
  select coalesce((select valor from public.ajuste where id = p_id), p_padrao);
$$;


-- ------------------------------------------------------------
-- 2. A TABELA DE XP, AGORA UMA SO
--
-- Os valores do app (src/lib/xp.js) viraram a fonte da verdade,
-- porque sao os que tem razao escrita do lado.
--
-- A coluna familia existe pra o teto semanal saber o que conta
-- como estudo. A coluna so_premium marca o que o plano gratuito
-- nao pontua.
-- ------------------------------------------------------------
alter table public.evento_valor add column if not exists familia text;
alter table public.evento_valor add column if not exists so_premium boolean not null default false;

insert into public.evento_valor (evento, xp, teto_dia, familia, so_premium) values
  ('treino',        20,  1, null,     false),
  ('rola',          12,  8, null,     false),
  ('aula',          15,  2, 'estudo', false),
  ('revista',        5,  1, 'estudo', false),
  ('short',          1,  6, 'estudo', false),
  ('revistaShort',   1,  3, 'estudo', true),
  ('quizAcerto',    10,  6, 'estudo', false),
  ('quizErro',       3,  6, 'estudo', false),
  ('revisao',        5, 12, null,     false),
  ('consistencia',  25,  1, null,     false),
  ('grau',          30,  3, null,     false)
on conflict (evento) do update set
  xp = excluded.xp,
  teto_dia = excluded.teto_dia,
  familia = excluded.familia,
  so_premium = excluded.so_premium;


-- ------------------------------------------------------------
-- 3. QUEM TEM ACESSO PAGO AGORA
--
-- Mesma regra do meu_acesso(), mas como funcao simples, pra
-- dar_ponto conseguir consultar sem receber tabela de volta.
--
-- Com a chave cobranca desligada no painel, todo mundo conta
-- como pago, igual ao podeVer() do app. Sem isto, enquanto a
-- cobranca esta desligada o servidor recusaria ponto que o app
-- concedeu, que e exatamente o bug que este arquivo conserta.
-- ------------------------------------------------------------
create or replace function public.tem_premium(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    coalesce((select not ligada from public.chave where id = 'cobranca'), true)
    or exists (
      select 1 from public.assinatura a
      where a.user_id = p_user
        and (
          (a.status = 'ativa' and (a.vence_em is null or a.vence_em > now()))
          or (a.carencia_ate is not null and a.carencia_ate > now())
        )
    );
$$;

revoke all on function public.tem_premium(uuid) from public;
grant execute on function public.tem_premium(uuid) to authenticated;


-- ------------------------------------------------------------
-- 4. A FUNCAO QUE CONCEDE PONTO, COM AS TRAVAS QUE FALTAVAM
--
-- Mudou em relacao a versao do comunidade.sql:
--   respeita o teto semanal de estudo
--   recusa evento que so vale pra quem paga
--   devolve motivo legivel, pra o app conseguir explicar
-- ------------------------------------------------------------
create or replace function public.dar_ponto(
  p_evento  text,
  p_ref_id  text default null,
  p_detalhe text default null,
  p_data    date default current_date
)
returns table (concedido boolean, xp int, motivo text)
language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_xp      int;
  v_teto    int;
  v_familia text;
  v_pago    boolean;
  v_hoje    int;
  v_sem     date;
  v_estudo  int;
  v_limite  int;
begin
  if v_user is null then
    return query select false, 0, 'sem sessao'; return;
  end if;

  -- a data nao pode vir do futuro nem de um passado distante
  if p_data > current_date or p_data < current_date - interval '30 days' then
    return query select false, 0, 'data invalida'; return;
  end if;

  select ev.xp, ev.teto_dia, ev.familia, ev.so_premium
    into v_xp, v_teto, v_familia, v_pago
  from public.evento_valor ev where ev.evento = p_evento;

  if v_xp is null then
    return query select false, 0, 'evento desconhecido'; return;
  end if;

  -- evento que so vale pra assinante
  if v_pago and not public.tem_premium(v_user) then
    return query select false, 0, 'so no premium'; return;
  end if;

  -- ja ganhou ponto por esse item exato
  if p_ref_id is not null and exists (
    select 1 from public.pontos
    where user_id = v_user and evento = p_evento and ref_id = p_ref_id
  ) then
    return query select false, 0, 'ja concedido'; return;
  end if;

  -- teto do dia
  select count(*) into v_hoje from public.pontos
  where user_id = v_user and evento = p_evento and data = p_data;

  if v_hoje >= v_teto then
    return query select false, 0, 'teto do dia'; return;
  end if;

  v_sem := p_data - ((extract(isodow from p_data)::int - 1) || ' days')::interval;

  -- teto semanal do estudo: video nao substitui tatame
  if v_familia = 'estudo' then
    v_limite := public.ajuste_de('teto_estudo_semana', 140);

    select coalesce(sum(p.xp), 0) into v_estudo
    from public.pontos p
    join public.evento_valor ev on ev.evento = p.evento
    where p.user_id = v_user and p.semana = v_sem and ev.familia = 'estudo';

    if v_estudo + v_xp > v_limite then
      return query select false, 0, 'teto de estudo da semana'; return;
    end if;
  end if;

  insert into public.pontos (user_id, evento, xp, ref_id, detalhe, data, semana, mes)
  values (v_user, p_evento, v_xp, p_ref_id, p_detalhe, p_data, v_sem, to_char(p_data, 'YYYY-MM'));

  return query select true, v_xp, 'ok';
end $$;

revoke all on function public.dar_ponto(text, text, text, date) from public;
grant execute on function public.dar_ponto(text, text, text, date) to authenticated;


-- ------------------------------------------------------------
-- 5. QUANTAS VEZES A PESSOA TREINA POR SEMANA
--
-- Sai do onboarding, da tela "quantas vezes por semana voce
-- treina", e e o que o pareamento vai usar pra achar par.
--
-- Fica no perfil publico de proposito: quem participa da liga
-- ja aceitou aparecer, e sem isto o pareamento nao tem como
-- comparar duas pessoas.
-- ------------------------------------------------------------
alter table public.perfil add column if not exists treinos_semana int;

comment on column public.perfil.treinos_semana is
  'Frequencia declarada no onboarding. Vira a meta semanal e e o criterio do pareamento.';


-- ------------------------------------------------------------
-- 6. CONFERIR SE DEU CERTO
--
-- select evento, xp, teto_dia, familia, so_premium
--   from public.evento_valor order by evento;
--
-- select * from public.ajuste;
--
-- select column_name from information_schema.columns
--  where table_name = 'perfil' and column_name = 'treinos_semana';
-- ------------------------------------------------------------
