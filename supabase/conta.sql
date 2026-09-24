-- ============================================================
-- APAGAR A PRÓPRIA CONTA
--
-- O aluno apaga a conta sozinho, pelo app (Ajustes > Conta). É
-- direito dele pela LGPD, e pedir por e-mail só atrasa.
--
-- O que some: o usuário e, em cascata, tudo que está ligado a ele
-- (registros, perfil, pontos, liga, amigos, sala, avisos, compras
-- de aula avulsa). Some também a fila de mensagens de recuperação
-- de compra do e-mail dele, pra ninguém receber WhatsApp depois
-- de ter saído.
--
-- O que fica: a assinatura, sem o vínculo com a pessoa (a coluna
-- é on delete set null). Registro de venda se guarda por lei.
-- O código de ativação também fica, sem dizer quem usou: a coluna
-- usado_por não tem cascata e, sem isto, travaria o resto.
--
-- Os arquivos (vídeos e foto) o app apaga antes de chamar isto,
-- porque o Storage não deixa apagar arquivo por SQL.
--
-- Cada tabela opcional é conferida antes: se o banco não tem a
-- tabela, a função segue sem ela em vez de falhar.
-- ============================================================

create or replace function public.apagar_minha_conta()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
begin
  if v_user is null then
    raise exception 'sem conta';
  end if;

  select email into v_email from auth.users where id = v_user;

  if to_regclass('public.ativacao') is not null then
    execute 'update public.ativacao set usado_por = null where usado_por = $1' using v_user;
  end if;

  if v_email is not null and to_regclass('public.recuperacao') is not null then
    execute 'delete from public.recuperacao where lower(email) = lower($1)' using v_email;
  end if;

  delete from auth.users where id = v_user;
end $$;

revoke all on function public.apagar_minha_conta() from public, anon;
grant execute on function public.apagar_minha_conta() to authenticated;
