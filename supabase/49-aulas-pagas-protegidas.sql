-- 49: AULAS PAGAS PROTEGIDAS
--
-- O id de uma aula é o id do vídeo no YouTube. Até aqui a lista pública
-- (acervo_desde) e a leitura direta da tabela entregavam esse id de
-- toda aula, inclusive as do Premium e as vendidas à parte: quem
-- soubesse olhar pegava o vídeo e assistia no YouTube sem pagar.
--
-- Agora:
-- 1. Aula paga aparece na lista com uma chave interna ("p" + 15
--    letras), não com o id do YouTube. A capa do YouTube também não
--    vai (ela carrega o id); vale só a capa própria, se tiver.
-- 2. O vídeo de aula paga só sai por abrir_aula(), que confere se a
--    pessoa é Premium (assinatura, presente ou cobrança desligada) ou
--    comprou aquela aula.
-- 3. A tabela pública mostra só as aulas grátis. Quem administra
--    continua vendo e editando tudo.
-- 4. minhas_compras() devolve a mesma chave que a lista usa.
--
-- Pode rodar de novo sem problema. Cole no SQL Editor do Supabase e rode.

begin;

/* a chave que o app vê: a grátis continua com o id do YouTube (as
   aulas vistas e o histórico seguem ligados); a paga ganha uma
   chave que não leva ao vídeo */
create or replace function public.chave_da_aula(p_id text, p_acesso text)
returns text language sql immutable as $$
  select case when coalesce(p_acesso, 'todos') = 'todos' then p_id
              else 'p' || left(md5('neurojitsu:' || p_id), 15) end;
$$;

/* a lista que o aparelho baixa: igual à de aula-vertical.sql, com a chave */
drop function if exists public.acervo_desde(timestamptz);
create or replace function public.acervo_desde(p_desde timestamptz default null)
returns table (
  id            text,
  titulo        text,
  duracao       int,
  tipo          text,
  temas         text[],
  posicoes      text[],
  faixa         text,
  acesso        text,
  destaque      boolean,
  ordem         int,
  descricao     text,
  capa_url      text,
  checkout_url  text,
  posicao_lado  text[],
  habilidades   text[],
  tecnicas      text[],
  situacoes     text[],
  formato       text,
  nivel         text,
  classificacao text,
  ativo         boolean,
  atualizado_em timestamptz,
  vertical      boolean
)
language sql stable security definer set search_path = public as $$
  select public.chave_da_aula(a.id, a.acesso), a.titulo, a.duracao, a.tipo, a.temas, a.posicoes, a.faixa,
         a.acesso, a.destaque, a.ordem, a.descricao, a.capa_url, a.checkout_url,
         a.posicao_lado, a.habilidades, a.tecnicas, a.situacoes, a.formato, a.nivel, a.classificacao,
         a.ativo, a.atualizado_em, a.vertical
  from public.aula a
  where (p_desde is null and a.ativo)
     or (p_desde is not null and a.atualizado_em > p_desde)
  order by a.atualizado_em;
$$;
grant execute on function public.acervo_desde(timestamptz) to anon, authenticated;

/* o vídeo de uma aula, pra quem pode ver */
create or replace function public.abrir_aula(p_chave text)
returns text language sql stable security definer set search_path = public as $$
  select a.id
  from public.aula a
  where a.ativo
    and public.chave_da_aula(a.id, a.acesso) = p_chave
    and (
      coalesce(a.acesso, 'todos') = 'todos'
      /* cobrança desligada no painel: nada é pago ainda */
      or coalesce((select not c.ligada from public.chave c where c.id = 'cobranca'), true)
      or exists (select 1 from public.compra_aula ca where ca.user_id = auth.uid() and ca.aula_id = a.id)
      or (a.acesso = 'assinantes' and (
        public.tem_premium(auth.uid())
        or exists (select 1 from public.presente_premium pp where pp.user_id = auth.uid() and pp.fim > now())
      ))
    );
$$;
revoke all on function public.abrir_aula(text) from public;
grant execute on function public.abrir_aula(text) to anon, authenticated;

/* o que eu comprei, na chave que a lista usa */
create or replace function public.minhas_compras()
returns setof text
language sql stable security definer set search_path = public as $$
  select public.chave_da_aula(c.aula_id, a.acesso)
  from public.compra_aula c join public.aula a on a.id = c.aula_id
  where c.user_id = auth.uid();
$$;
grant execute on function public.minhas_compras() to authenticated;

/* a tabela: o público lê só a grátis; quem administra lê tudo */
drop policy if exists aula_leitura on public.aula;
create policy aula_leitura on public.aula
  for select to anon, authenticated
  using (ativo and (coalesce(acesso, 'todos') = 'todos' or public.sou_admin()));

commit;

-- conferência: quantas pagas a lista pública ainda entrega com o id do YouTube (tem que ser 0)
select count(*) as pagas_com_id_exposto
from public.acervo_desde(null) l
where l.acesso <> 'todos' and exists (select 1 from public.aula a where a.id = l.id);
