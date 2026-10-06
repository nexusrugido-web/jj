-- 46: FAXINA DIÁRIA DO BANCO
--
-- Duas coisas crescem sozinhas e ninguém lê o velho:
-- 1. O histórico do agendador (cron.job_run_details): uma linha a cada
--    execução. Só a vigia roda a cada 5 minutos, quase 300 linhas por dia.
--    Fica a última semana, que é o que os diagnósticos olham.
-- 2. Os avisos enviados (notificacao_envio): uma linha por aviso. As
--    regras dos avisos olham no máximo 60 dias pra trás. Ficam 120.
--
-- Roda todo dia às 4h30 de Brasília (7h30 UTC). Pode rodar de novo sem
-- problema. Cole no SQL Editor do Supabase e rode: a última linha mostra
-- quanto a primeira faxina já tirou.

begin;

create or replace function public.faxina()
returns text language plpgsql security definer set search_path = public as $$
declare
  agendador int := 0;
  avisos    int := 0;
begin
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  get diagnostics agendador = row_count;
  delete from public.notificacao_envio where enviado_em < now() - interval '120 days';
  get diagnostics avisos = row_count;
  return agendador || ' linhas do agendador e ' || avisos || ' avisos antigos apagados';
end $$;

revoke all on function public.faxina() from public, anon, authenticated;

select cron.schedule('faxina', '30 7 * * *', 'select public.faxina()');

commit;

select public.faxina() as primeira_faxina;
