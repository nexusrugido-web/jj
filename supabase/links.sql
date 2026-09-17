-- ============================================================
-- TATAME OS, OS LINKS
--
-- O app tinha link de compra em tres lugares diferentes e de
-- tres jeitos diferentes:
--
--   o da assinatura, num ajuste de texto
--   o de compra avulsa, numa coluna do video
--   e dois "https://hotmart.com" escritos no meio do codigo,
--   sendo que um deles era o botao do plano ANUAL apontando
--   pro mesmo lugar do mensal
--
-- Aqui eles viram tabela. Cada link tem chave, nome e para que
-- serve, e o painel lista todos pra editar. Dois nao podem ser
-- apagados porque o app chama eles pelo nome; o resto voce cria
-- e remove como quiser.
--
-- Rode no SQL Editor do Supabase, depois de admin2.sql
-- ============================================================

create table if not exists public.link (
  chave      text primary key,
  nome       text not null,
  descricao  text,
  url        text,
  grupo      text not null default 'venda',
  ordem      int  not null default 0,
  fixo       boolean not null default false,
  atualizado timestamptz not null default now()
);

comment on column public.link.fixo is
  'O app chama este link pelo nome, entao ele nao pode ser apagado.';

alter table public.link enable row level security;

-- todo mundo le, porque o app precisa dos links de compra
drop policy if exists link_leitura on public.link;
create policy link_leitura on public.link
  for select to anon, authenticated using (true);

drop policy if exists link_escrita on public.link;
create policy link_escrita on public.link
  for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());


-- ------------------------------------------------------------
-- OS QUE O APP CHAMA PELO NOME
-- ------------------------------------------------------------
insert into public.link (chave, nome, descricao, grupo, ordem, fixo) values
  ('assinatura_mensal', 'Assinatura mensal',
   'O botao Assinar, e para onde vai quem esta no gratuito e esbarrou num video da assinatura.',
   'venda', 1, true),

  ('assinatura_anual', 'Assinatura anual',
   'Aparece pra quem esta cancelando, como alternativa ao mensal. Deixar vazio faz o app mostrar o mensal no lugar.',
   'venda', 2, true),

  ('suporte', 'Suporte',
   'Para onde manda quem nao consegue ativar a compra. WhatsApp ou e-mail.',
   'ajuda', 3, false)
on conflict (chave) do nothing;

-- aproveita o link que ja estava no ajuste, se voce tiver preenchido
update public.link l
set url = a.texto, atualizado = now()
from public.ajuste a
where a.id = 'link_assinatura'
  and l.chave = 'assinatura_mensal'
  and l.url is null
  and a.texto is not null;

/* o ajuste de texto sai de cena: link agora tem tabela propria, e
   deixar os dois vivos daria duas verdades sobre o mesmo endereco */
delete from public.ajuste where id = 'link_assinatura';


-- ------------------------------------------------------------
-- A DATA SE CUIDA SOZINHA
-- ------------------------------------------------------------
create or replace function public.tocar_link()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado := now();
  return new;
end $$;

drop trigger if exists tg_tocar_link on public.link;
create trigger tg_tocar_link before update on public.link
  for each row execute function public.tocar_link();


-- ------------------------------------------------------------
-- CONFERIR
--
-- select chave, nome, url, fixo from public.link order by ordem;
-- ------------------------------------------------------------
