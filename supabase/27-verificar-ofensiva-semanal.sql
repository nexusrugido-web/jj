-- SOMENTE LEITURA. Execute depois do SQL 26 e envie as linhas do resultado.
-- Cada linha deve indicar ok=true. Confere a versão exata das funções instaladas.
with esperado(assinatura,hash) as (values
  ('calcular_ofensiva_semanal(jsonb,jsonb,date,integer)', 'c22e64d394b834779a6346869925d3eb'),
  ('data_ofensiva(text)', '817b5a8b27ffd8ce10d128e67f9ffc97'),
  ('diagnostico_de_aviso(text)', '2bdaf5e3adf7e4f000fb2e6ae9bce7b8'),
  ('fila_de_notificacao(uuid)', '3d86192de57772dba3f51f55d11fb4cd'),
  ('meus_amigos_semanal()', '0b964af1dd319982a4dce41fea63bd35'),
  ('minha_liga_semanal()', '21689f2de4a2fdf4d6f19d8bfe88c627'),
  ('minha_ofensiva_semanal()', 'a851e3712c78e291f81a6047de60d68f'),
  ('ofensiva_semanal_de(uuid)', '621685552b43a233653ca95e511ccff4'),
  ('perfil_na_liga_semanal(uuid)', '1d69b44eb0d3075ca58187bae6ccfe88'),
  ('ranking_ofensivas_semanais()', 'f89e3cf101f3b2e2db3df05874a73858')
)
select e.assinatura as verificacao,
  coalesce(md5(replace(p.prosrc,chr(13),''))=e.hash,false) as ok
from esperado e left join pg_proc p on p.oid=to_regprocedure(e.assinatura)
union all
select 'privacidade: calculo interno bloqueado ao cliente',
  not has_function_privilege('authenticated','public.ofensiva_semanal_de(uuid)','EXECUTE')
union all
select 'acesso: ranking semanal liberado a autenticados',
  has_function_privilege('authenticated','public.ranking_ofensivas_semanais()','EXECUTE')
union all
select 'acesso: ranking semanal bloqueado a anonimos',
  not has_function_privilege('anon','public.ranking_ofensivas_semanais()','EXECUTE')
order by 1;
