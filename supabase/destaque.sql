-- ============================================================
-- TATAME OS, OS VIDEOS DE ENTRADA
--
-- Quem acaba de criar conta nao tem historico, e sem historico
-- o app nao tem o que recomendar. Ate agora essa pessoa abria
-- o Estudo e via uma tela vazia pedindo pra ela registrar
-- treino primeiro, o que e o contrario do que ela precisa: ela
-- precisa de um motivo pra voltar amanha.
--
-- Esta coluna marca os videos que voce quer que o lead veja
-- antes de ter registrado qualquer coisa. Voce escolhe no
-- painel, um por um, sem deploy e sem SQL.
--
-- Rode no SQL Editor do Supabase, depois de par.sql
-- ============================================================

alter table public.aula add column if not exists destaque boolean not null default false;

create index if not exists aula_destaque on public.aula (destaque) where destaque;


-- ------------------------------------------------------------
-- CONFERIR
--
-- select id, titulo from public.aula where destaque;
-- ------------------------------------------------------------
