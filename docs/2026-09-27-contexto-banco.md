# Contexto local e histórico do banco

Levantamento de 27/09/2026, baseado nos arquivos locais. Não é uma auditoria do Supabase em produção. Nenhum SQL foi executado no banco.

Confirmação do usuário em 27/09/2026: todos os SQLs até o 24 foram executados. Essa informação atual substitui as pendências de execução dos SQLs nos relatórios antigos. Não reaplicar esses scripts. A publicação de versões de Edge Functions é uma operação distinta e não foi confirmada separadamente nesta mensagem.

## Fontes

- `../NEUROJITSU-COLAR`: scripts numerados até 24, workflow n8n, versões da Edge Function notificar e prompts de imagens. São instruções e implementações, não comprovantes de execução. Há versões com segredos; não copiar essa pasta para o Git.
- `../NEUROJITSU-RELATORIOS`: auditoria de 24/09, relatório evolutivo de 25/09 com atualização em 26/09, CSV de técnicas e imagens.
- `supabase/`: definições SQL versionadas, com funções que são substituídas por scripts posteriores.
- `README.md`, `n8n/README.md`, `src/db/db.js` e `src/lib/sync.js`: arquitetura e ligação com o app.

## Inventário declarado nos SQLs

Foram identificados 45 nomes distintos em declarações CREATE TABLE de `supabase/*.sql`. O número não comprova a existência atual dessas tabelas no servidor e não inclui todo o esquema interno de Auth, Storage, Vault ou cron.

| Área | Tabelas declaradas |
|---|---|
| Dados e perfis | registros, perfis, midias, perfil |
| Administração | admin, chave, recado, ajuste, link, card, admin_segredo |
| Aulas | aula, compra_aula, estudo_medida |
| Liga e pontos | pontos, evento_valor, total_xp, liga, liga_membro, liga_fechamento, par |
| Social | sala, sala_membro, amizade, convite_sala |
| Assinatura | assinatura, ativacao, compra_pendente |
| Vendas | vendas_ajuste, produto_hotmart, hotmart_evento, campanha, clique |
| Automação | n8n_segredo, recuperacao_motivo, recuperacao_etapa, recuperacao_ajuste, recuperacao, recuperacao_envio, recuperacao_resposta, recuperacao_bloqueio, aviso_destino, aviso_controle |
| Push | push_inscricao, notificacao_envio |

`perfil` e `perfis` são nomes diferentes presentes nos scripts. Não unificar ou excluir por parecerem duplicados sem examinar usos e estado real.

## Banco local e nuvem

O IndexedDB `tatame_os` contém as tabelas locais. `TABELAS_SYNC` lista 25 coleções que sincronizam: positions, categories, techniques, partners, sessions, rolls, goals, reviews, gameplans, injuries, competitions, attackPlans, gradings, milestones, media, academies, professors, aulasVistas, quizRespostas, pontos, recFeitas, videoEventos, foods, meals e dietPlans.

O sincronizador grava essas coleções na tabela genérica `public.registros`, com `user_id`, `tabela`, `dados` JSONB, timestamps e exclusão lógica. Não são 25 tabelas SQL equivalentes. A Liga também tem sua própria tabela SQL `pontos`.

Isso significa cópia local E cópia na nuvem, após sincronização com a conta. `subir` envia para `registros`; `baixar` consulta os registros do usuário e `aplicarLocal` recompõe as tabelas locais. Sem cursor local, a busca começa em 1970. `App.jsx` chama `garantirNuvem` e `restaurarPontos` na abertura com sessão e no login. Portanto, reinstalar e entrar na mesma conta pode restaurar os dados enviados ao servidor. Dados ainda não enviados (por exemplo, registrados offline antes de perder o armazenamento) não podem ser recuperados da nuvem. O código foi inspecionado; não foi realizado nesta sessão um teste de reinstalação com conta real.

As políticas de `registros` no código restringem acesso ao proprietário. A biblioteca intocada não deve subir nem sobrescrever mudanças do aluno; registros recebidos não podem voltar à fila. O histórico relata correções nesses dois pontos, no envio inicial por tabela e na restauração dos pontos.

## O que os relatórios dizem ter sido feito

- SQL 11: apagar conta, registrado como executado.
- SQL 12: resultados de diagnóstico recebidos no histórico.
- SQL 13: limpeza registrada, com redução reportada de registros de 28 MB para 1,8 MB.
- SQL 16b e ajuste da Edge Function: histórico relata aviso recebido no celular em 24/09.
- SQL 19: registrado explicitamente como executado pelo usuário em 25/09.
- Auditoria antiga relata 45 tabelas verificadas e 47 funções chamadas pelo app presentes naquele momento. Isso não é uma verificação feita nesta sessão.

## Pontos sem confirmação atual

- As antigas pendências dos SQLs 17b, 20, 21, 22, 23 e 24 foram superadas pela confirmação do usuário de execução até o 24. Não tratá-las como tarefas em aberto.
- Links de assinatura/suporte, compra completa Hotmart, chaves legadas e testes de voz aparecem como pendências históricas. Conferir o estado atual antes de propor correção.
- Não reaplicar scripts antigos em lote: funções como `fechar_semana` têm várias versões; `schema.sql` ainda contém a criação do índice GIN que a limpeza posterior remove.

Para confirmar produção, o próximo passo é uma consulta somente de leitura ao catálogo do banco: tabelas, colunas, políticas, assinaturas/definições de funções, índices e agendamentos; comparar as versões e os ajustes relevantes com os scripts. Arquivo local existente e teste local aprovado não comprovam instalação no servidor.

A remoção local de Gás não precisou alterar o Supabase. `breathProtocols` e `breathLogs` foram preservadas no banco local e não constam de `TABELAS_SYNC`.
