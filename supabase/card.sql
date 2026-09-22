-- ============================================================
-- TATAME OS, O CARD QUE SAI DO APP
--
-- Tudo que o app faz hoje acontece dentro do app. Ninguem no
-- Instagram ve a ofensiva de 40 dias de ninguem, e por isso o
-- app so retem quem ja entrou: nao tem por onde chegar gente
-- nova.
--
-- O card e uma pagina publica num endereco curto (/c/<codigo>)
-- que o WhatsApp e o Instagram conseguem ler pra montar a
-- previa. Quem ve o print CLICA e cai no app. Imagem solta nao
-- tem pra onde clicar, e e por isso que ela nao traz ninguem.
--
-- O QUE VAI NO CARD, E O QUE NUNCA VAI
--
-- O card e uma FOTO do momento, gravada no jsonb. Ele nao le o
-- perfil de novo quando alguem abre: se a pessoa sair da liga ou
-- trocar de apelido amanha, o card de ontem continua o mesmo, e
-- nada novo dela vaza por um link que ela ja mandou.
--
-- O nome e sempre o nome_publico, igual ao da liga. Nada de
-- treino, rola, parceiro ou lesao entra aqui.
--
-- Rode no SQL Editor do Supabase, depois de ofensiva.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. A TABELA
--
-- codigo: curto, sem ambiguidade e sem sequencia. Sem o 0/O e o
-- 1/l, porque card e feito pra ser lido em print e digitado na
-- mao. E sorteado, e nao um contador, senao daria pra andar pelos
-- cards dos outros somando um.
-- ------------------------------------------------------------
create table if not exists public.card (
  codigo    text primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  tipo      text not null check (tipo in ('ofensiva', 'resumo', 'marco')),
  dados     jsonb not null,
  aberturas int not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists card_user on public.card (user_id, criado_em desc);

alter table public.card enable row level security;

-- a pessoa enxerga e apaga os proprios. Quem abre pelo link nao
-- passa por aqui: passa pela funcao ler_card, que e a porta.
drop policy if exists card_meu on public.card;
create policy card_meu on public.card
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ------------------------------------------------------------
-- 2. O CODIGO
-- ------------------------------------------------------------
create or replace function public.codigo_de_card()
returns text language plpgsql volatile set search_path = public as $$
declare
  v_letras text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_cod    text;
  v_i      int;
begin
  for v_i in 1..20 loop
    v_cod := '';
    for v_i in 1..8 loop
      v_cod := v_cod || substr(v_letras, 1 + floor(random() * length(v_letras))::int, 1);
    end loop;
    exit when not exists (select 1 from public.card where codigo = v_cod);
  end loop;
  return v_cod;
end $$;


-- ------------------------------------------------------------
-- 3. CRIAR
--
-- O app manda so o miolo. Nome, faixa e graus o servidor carimba
-- sozinho, pra ninguem publicar card com o nome de outra pessoa.
--
-- Um card igual no mesmo dia devolve o mesmo codigo: quem toca
-- em compartilhar tres vezes nao deixa tres links soltos por ai.
-- ------------------------------------------------------------
create or replace function public.criar_card(p_tipo text, p_dados jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_p    public.perfil;
  v_cod  text;
  v_full jsonb;
begin
  if v_user is null then return null; end if;
  if p_tipo not in ('ofensiva', 'resumo', 'marco') then return null; end if;

  select * into v_p from public.perfil where user_id = v_user;

  v_full := coalesce(p_dados, '{}'::jsonb) || jsonb_build_object(
    'nome',  public.nome_publico(v_p),
    'faixa', coalesce(v_p.faixa, 'branca'),
    'graus', coalesce(v_p.graus, 0)
  );

  select c.codigo into v_cod
  from public.card c
  where c.user_id = v_user and c.tipo = p_tipo and c.dados = v_full
    and c.criado_em > now() - interval '1 day'
  limit 1;
  if v_cod is not null then return v_cod; end if;

  v_cod := public.codigo_de_card();
  insert into public.card (codigo, user_id, tipo, dados) values (v_cod, v_user, p_tipo, v_full);
  return v_cod;
end $$;

grant execute on function public.criar_card(text, jsonb) to authenticated;


-- ------------------------------------------------------------
-- 4. LER
--
-- Aberta pro anon, porque e ela que serve a pagina publica. So
-- devolve o jsonb que foi gravado: nem o user_id sai daqui.
--
-- p_contar separa gente de robo. O WhatsApp e o Instagram abrem
-- o link sozinhos pra montar a previa, e isso nao e alguem
-- vendo o card. Mesma regra do /r/<codigo> (api/r.js).
-- ------------------------------------------------------------
create or replace function public.ler_card(p_codigo text, p_contar boolean default false)
returns table (tipo text, dados jsonb, criado_em timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_contar then
    update public.card set aberturas = aberturas + 1 where codigo = p_codigo;
  end if;

  return query
  select c.tipo, c.dados, c.criado_em
  from public.card c where c.codigo = p_codigo;
end $$;

grant execute on function public.ler_card(text, boolean) to anon, authenticated;


-- ------------------------------------------------------------
-- 5. CONFERIR
--
-- select codigo, tipo, aberturas, criado_em from public.card
--   order by criado_em desc limit 20;
--
-- quantos cards viraram visita:
-- select tipo, count(*) as cards, sum(aberturas) as aberturas
--   from public.card group by tipo;
-- ------------------------------------------------------------
