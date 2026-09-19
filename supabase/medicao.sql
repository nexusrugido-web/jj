-- ============================================================
-- TATAME OS, A MEDICAO DO ESTUDO
--
-- Responde, pro painel: a recomendacao vira video assistido?
--
--   exibiu    o app mostrou o video numa recomendacao (uma vez por
--             dia por lugar, nao a cada vez que a tela desenha)
--   abriu     a pessoa tocou e o video abriu
--   concluiu  terminou
--   barrado   tocou e nao abriu: o limite do dia ou video pago
--   faltou    o app precisava de um video pra aquela necessidade e
--             o acervo nao tinha: caiu no "porque das coisas". E a
--             pauta de gravacao
--
-- Cada medida diz de onde veio: a tela (estudo, painel, dominio),
-- o tipo (rec, dificuldade, estilo, entrada, tema...) e o alvo.
--
-- Fica numa tabela propria, e nao na sincronizacao dos registros,
-- porque aquela e baixada inteira em cada aparelho e isto cresce
-- rapido. Ninguem le a tabela: o painel recebe so os numeros
-- somados, nunca a linha de uma pessoa.
--
-- Rode no SQL Editor do Supabase, depois de liga-automatica.sql.
-- Pode rodar de novo.
-- ============================================================

create table if not exists public.estudo_medida (
  id        bigserial primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  dia       date not null,
  evento    text not null check (evento in ('exibiu', 'abriu', 'concluiu', 'barrado', 'faltou')),
  tela      text,
  tipo      text,
  alvo      text,
  video_id  text,
  detalhe   text,
  segundos  int,
  criado_em timestamptz not null default now()
);

create index if not exists estudo_medida_dia on public.estudo_medida (dia);
create index if not exists estudo_medida_video on public.estudo_medida (video_id, dia);

alter table public.estudo_medida enable row level security;
revoke all on public.estudo_medida from anon, authenticated;


-- ------------------------------------------------------------
-- 1. O APP MANDA EM LOTE
--
-- Ate 300 por chamada, texto cortado, data de no maximo uma
-- semana pra tras: medida velha ou gigante nao e medida, e erro
-- ou abuso.
-- ------------------------------------------------------------
create or replace function public.medir(p_linhas jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  n int;
begin
  if v_user is null or jsonb_typeof(p_linhas) <> 'array' then return 0; end if;

  insert into public.estudo_medida (user_id, dia, evento, tela, tipo, alvo, video_id, detalhe, segundos)
  select v_user,
         (x->>'dia')::date,
         x->>'evento',
         left(x->>'tela', 20),
         left(x->>'tipo', 30),
         left(x->>'alvo', 120),
         left(x->>'videoId', 40),
         left(x->>'detalhe', 160),
         case when (x->>'segundos') ~ '^\d{1,6}$' then (x->>'segundos')::int end
  from (select x from jsonb_array_elements(p_linhas) x limit 300) l
  where x->>'evento' in ('exibiu', 'abriu', 'concluiu', 'barrado', 'faltou')
    and (x->>'dia') ~ '^\d{4}-\d{2}-\d{2}$'
    and (x->>'dia')::date between public.hoje_br() - 7 and public.hoje_br() + 1;

  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.medir(jsonb) from public, anon;
grant execute on function public.medir(jsonb) to authenticated;


-- ------------------------------------------------------------
-- 2. O QUE O PAINEL VE
--
-- por_tipo   o funil de cada tipo de recomendacao
-- por_rec    as recomendacoes que vem dos rolas, por intencao
-- videos     os mais abertos a partir de recomendacao
-- abandono   aberto 3 vezes ou mais e terminado em menos de 30%
-- faltou     as necessidades sem video, por quantas pessoas
-- barrado    quantas vezes o limite e o video pago seguraram
-- feitas     o "Ja treinei isso": funcionou, mais ou menos, nao
-- ------------------------------------------------------------
create or replace function public.medicao_estudo(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_desde date := public.hoje_br() - greatest(1, least(coalesce(p_dias, 30), 365));
begin
  if not public.sou_admin() then raise exception 'so administrador'; end if;

  return jsonb_build_object(
    'dias', greatest(1, least(coalesce(p_dias, 30), 365)),

    'pessoas', (select count(distinct user_id) from public.estudo_medida where dia > v_desde),

    'por_tipo', coalesce((
      select jsonb_agg(t order by t.abriu desc, t.exibiu desc)
      from (
        select coalesce(tipo, 'outro') as tipo,
               count(*) filter (where evento = 'exibiu')   as exibiu,
               count(*) filter (where evento = 'abriu')    as abriu,
               count(*) filter (where evento = 'concluiu') as concluiu,
               count(*) filter (where evento = 'barrado')  as barrado,
               count(*) filter (where evento = 'faltou')   as faltou,
               count(distinct user_id) filter (where evento = 'abriu') as pessoas
        from public.estudo_medida
        where dia > v_desde
        group by 1
      ) t
    ), '[]'::jsonb),

    'por_rec', coalesce((
      select jsonb_agg(t order by t.exibiu desc)
      from (
        select split_part(alvo, ':', 1) as intencao,
               count(*) filter (where evento = 'exibiu')   as exibiu,
               count(*) filter (where evento = 'abriu')    as abriu,
               count(*) filter (where evento = 'concluiu') as concluiu,
               count(*) filter (where evento = 'faltou')   as faltou
        from public.estudo_medida
        where dia > v_desde and tipo = 'rec'
        group by 1
      ) t
    ), '[]'::jsonb),

    'videos', coalesce((
      select jsonb_agg(t order by t.abriu desc, t.concluiu desc)
      from (
        select m.video_id, coalesce(a.titulo, m.video_id) as titulo,
               count(*) filter (where evento = 'exibiu')   as exibiu,
               count(*) filter (where evento = 'abriu')    as abriu,
               count(*) filter (where evento = 'concluiu') as concluiu
        from public.estudo_medida m
        left join public.aula a on a.id = m.video_id
        where m.dia > v_desde and m.video_id is not null and coalesce(m.tipo, '') not in ('tema', 'vistas')
        group by m.video_id, a.titulo
        having count(*) filter (where evento = 'abriu') > 0
        order by 4 desc
        limit 15
      ) t
    ), '[]'::jsonb),

    'abandono', coalesce((
      select jsonb_agg(t order by t.abriu desc)
      from (
        select m.video_id, coalesce(a.titulo, m.video_id) as titulo,
               count(*) filter (where evento = 'abriu')    as abriu,
               count(*) filter (where evento = 'concluiu') as concluiu
        from public.estudo_medida m
        left join public.aula a on a.id = m.video_id
        where m.dia > v_desde and m.video_id is not null
        group by m.video_id, a.titulo
        having count(*) filter (where evento = 'abriu') >= 3
           and count(*) filter (where evento = 'concluiu')
               < 0.3 * count(*) filter (where evento = 'abriu')
        order by 3 desc
        limit 15
      ) t
    ), '[]'::jsonb),

    'faltou', coalesce((
      select jsonb_agg(t order by t.pessoas desc, t.vezes desc)
      from (
        select coalesce(detalhe, alvo) as pedido, tipo,
               count(*) as vezes,
               count(distinct user_id) as pessoas,
               max(dia) as ultimo
        from public.estudo_medida
        where dia > v_desde and evento = 'faltou'
        group by 1, 2
        order by 4 desc, 3 desc
        limit 20
      ) t
    ), '[]'::jsonb),

    'barrado', coalesce((
      select jsonb_object_agg(coalesce(detalhe, 'outro'), n)
      from (
        select detalhe, count(*) as n from public.estudo_medida
        where dia > v_desde and evento = 'barrado' group by 1
      ) t
    ), '{}'::jsonb),

    'feitas', coalesce((
      select jsonb_agg(t order by t.total desc)
      from (
        select r.dados->>'intencao' as intencao,
               count(*) as total,
               count(*) filter (where r.dados->>'resultado' = 'funcionou') as funcionou,
               count(*) filter (where r.dados->>'resultado' = 'meio')      as meio,
               count(*) filter (where r.dados->>'resultado' = 'nao')       as nao
        from public.registros r
        where r.tabela = 'recFeitas' and r.deleted_at is null
          and (r.dados->>'data') > v_desde::text
        group by 1
      ) t
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function public.medicao_estudo(int) from public, anon;
grant execute on function public.medicao_estudo(int) to authenticated;


-- ------------------------------------------------------------
-- 3. CONFERIR
--
-- select evento, tipo, count(*) from public.estudo_medida
--  where dia > current_date - 7 group by 1, 2 order by 1, 2;
-- ------------------------------------------------------------
