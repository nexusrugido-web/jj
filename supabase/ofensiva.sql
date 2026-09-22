-- ============================================================
-- TATAME OS, O RANKING DE OFENSIVAS
--
-- A ofensiva sao dias seguidos aparecendo no app: qualquer
-- coisa que da ponto fecha o dia. Quem calcula e o aparelho
-- (src/lib/ofensiva.js), e o numero sobe pra perfil.sequencia
-- junto com os pontos (src/lib/liga.js).
--
-- A coluna se chama sequencia porque ja existia, guardando
-- semanas seguidas. O conteudo mudou pra dias; o nome ficou,
-- pra nao quebrar o app antigo de quem ainda nao atualizou.
--
-- Por que o ranking e por perfil.sequencia e nao por uma conta
-- em SQL sobre public.pontos: o escudo. Ele e gasto em silencio
-- conforme a ofensiva anda, e refazer essa simulacao aqui seria
-- manter a mesma regra escrita em dois lugares. Um dia os dois
-- discordariam, e o numero da tela brigaria com o do ranking.
--
-- Rode no SQL Editor do Supabase, depois de liga-automatica.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. O QUANTO O RANKING MOSTRA
-- ------------------------------------------------------------
insert into public.ajuste (id, nome, descricao, valor, minimo, maximo, grupo) values
  ('ranking_tamanho', 'Quantos aparecem no ranking de ofensivas',
   'As maiores ofensivas do app. Quem fica de fora ve a propria posicao no fim da lista.',
   20, 5, 100, 'comunidade')
on conflict (id) do nothing;

create index if not exists perfil_sequencia on public.perfil (sequencia desc)
  where participa_liga;


-- ------------------------------------------------------------
-- 2. O RANKING
--
-- So entra quem participa da liga, que e o mesmo opt-in que ja
-- vale pro resto: quem saiu da liga nao aparece pros outros.
--
-- O nome e sempre o nome_publico, igual ao da liga. Nada do que
-- a pessoa registra no treino vaza por aqui.
--
-- Quem esta fora do corte recebe a propria linha no fim, com a
-- posicao de verdade. Ver "voce e o 34o" e melhor que nao ver
-- nada, e e o que faz a pessoa querer subir.
-- ------------------------------------------------------------
create or replace function public.ranking_ofensivas()
returns table (
  posicao bigint,
  nome    text,
  faixa   text,
  graus   int,
  dias    int,
  sou_eu  boolean,
  de_fora boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_tam  int  := public.ajuste_de('ranking_tamanho', 20);
begin
  if v_user is null then return; end if;

  return query
  with todos as (
    select
      rank() over (order by p.sequencia desc, p.criado_em, p.user_id) as pos,
      p.user_id,
      public.nome_publico(p) as nome,
      p.faixa,
      p.graus,
      p.sequencia
    from public.perfil p
    where p.participa_liga and p.sequencia > 0
  )
  select t.pos, t.nome, t.faixa, t.graus, t.sequencia, (t.user_id = v_user), false
  from todos t
  where t.pos <= v_tam
  union all
  /* a minha linha, so quando eu nao couber no corte */
  select t.pos, t.nome, t.faixa, t.graus, t.sequencia, true, true
  from todos t
  where t.user_id = v_user and t.pos > v_tam
  order by 7, 1;
end $$;

grant execute on function public.ranking_ofensivas() to authenticated;


-- ------------------------------------------------------------
-- 3. CONFERIR
--
-- select * from public.ranking_ofensivas();   -- logado no app
-- select nome, sequencia from public.perfil
--   where participa_liga order by sequencia desc limit 20;
-- ------------------------------------------------------------
