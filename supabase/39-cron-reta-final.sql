-- O RELOGIO DA RETA FINAL. Aplicar DEPOIS do 36.
-- O cron "notificar" ja chama a funcao de hora em hora. Este chama tambem
-- nos quartos de hora (:15, :30, :45) da noite de domingo em Brasilia
-- (00h-02h de segunda em UTC), pra o aviso da reta final ser redesenhado
-- de 15 em 15 minutos: 3:00, 2:45, 2:30... Fora desse horario a fila nao
-- tem nada novo e a chamada volta vazia. Mesmo segredo do cron notificar.
select cron.schedule('notificar-reta-final', '15,30,45 0-2 * * 1', $c$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'url_notificar'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey',       (select decrypted_secret from vault.decrypted_secrets where name = 'chave_notificar')
    ),
    body    := '{}'::jsonb
  )
$c$);

-- confere: as duas linhas tem que aparecer
select jobname, schedule from cron.job where jobname in ('notificar', 'notificar-reta-final');
