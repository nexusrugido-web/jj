# Remoção do módulo Gás

Pedido: retirar o módulo Gás, documentar e permitir reversão. Push, merge e deploy exigem autorização do usuário.

## Escopo confirmado após a revisão

Remover exclusivamente a seção/tela Gás e seus acessos diretos. Preservar onboarding, Estudo, recomendações, aulas, quiz, classificação, identificadores `gas`, `sem_gas` e `fisico`, banco e demais recursos independentes. As sugestões anteriores de revisão da descrição geral e limpeza de estruturas antigas não fazem parte desta tarefa e não foram aplicadas.

A revisão confirmou que a página anterior era informativa e só navegava para Estudo no tema físico. Menus desktop e celular usam a mesma lista. O registro de páginas também é compartilhado pelo acesso com parâmetros administrativos; não há uma entrada administrativa separada para Gás. Nenhuma chamada direta restante para a página foi encontrada no código do app. O link antigo é mantido apenas no teste de compatibilidade.

Antes desta atualização documental, foi preservado o estado atual (já com a remoção local) em `C:/Users/Batista/AppData/Local/Temp/neurojitsu-baseline-gas-H9VaRQ`: 239 caminhos versionados ou não ignorados, manifesto com hashes SHA-256 e diff. Arquivos ignorados, como dependências e configurações de ambiente, não estão nessa cópia. O estado anterior à remoção continua no commit abaixo e no patch reversível.

O diff da remoção foi comparado byte a byte com o patch anteriormente testado: idêntico. Nenhuma nova alteração de código foi necessária nesta revisão.

Reverificação: `npm run teste:telas` passou com saída 0, incluindo menus sem Gás, link antigo abrindo Painel, telas e abas com dados simulados. Log em `evidencias/remocao-gas/reverificacao-telas.txt`. O diff dos arquivos versionados dos recursos protegidos permaneceu vazio. A suíte completa e os testes no Chrome citados abaixo são da execução anterior, sobre o mesmo diff de código.

## Estado anterior

- Branch local: `main`.
- Commit local: `54c7bc506e922a540ba3cad5747ea1423c6ac0de`.
- Nenhum arquivo versionado modificado antes deste trabalho.
- Itens não versionados preexistentes: `.claude/`, `.vscode/`, `neurojitsu_shorts.txt` e `neurojitsu_videos_longos.txt`. Preservados.
- Não foi consultado o estado atual da produção nem atualizado o remoto nesta tarefa.

## Alteração

- `src/components/Layout.jsx`: retirada do item Gás e do import de seu ícone. A mesma lista atende desktop e celular.
- `src/App.jsx`: retirada da página do carregamento e das rotas. Links antigos `?go=respiracao` abrem o Painel usando o fallback existente.
- `src/pages/Respiracao.jsx`: removida a página informativa.
- `README.md`: atualizado o mapa de telas.
- `scripts/teste-telas.mjs`: retirada a tela da lista ativa; verificadas a ausência no menu e a abertura do Painel pelo link antigo.
- Corpo passa a conter Musculação, Nutrição e Lesões.
- Sem migração ou exclusão de dados. Tabelas históricas `breathProtocols` e `breathLogs` preservadas. Referências a fôlego em aulas, exercícios e diagnóstico permanecem, pois pertencem a outros recursos.

## Verificação

- `npm run check`: passou integralmente, saída 0 (lint, build e todas as suítes, inclusive telas, login, sincronização e campeonato). Log salvo em `evidencias/remocao-gas/check.txt`.
- Build emitiu aviso de chunk principal acima de 700 kB (939,86 kB); não é falha de compilação.
- Chrome via Playwright, build local: link antigo abre Painel; menus desktop e celular sem Gás; Musculação, Nutrição e Lesões abrem; nenhum erro JavaScript de página capturado.
- Navegador isolado, dados de teste locais, chamadas externas bloqueadas. Não valida Supabase, autenticação real nem produção.
- Capturas inspecionadas: [desktop](evidencias/remocao-gas/desktop.png) e [celular](evidencias/remocao-gas/mobile.png).
- `git diff --check`: passou.
- `git apply --reverse --check docs/evidencias/remocao-gas/alteracao.patch`: passou, sem efetuar reversão.

## Como reverter

O [patch](evidencias/remocao-gas/alteracao.patch) contém apenas as mudanças desta tarefa nos cinco arquivos existentes. Não inclui esta documentação ou as capturas.

Antes de reverter, conferir `git status` e mudanças posteriores, especialmente trabalho do Claude. Executar primeiro:

```sh
git apply --reverse --check docs/evidencias/remocao-gas/alteracao.patch
```

Se passar e a reversão for desejada:

```sh
git apply --reverse docs/evidencias/remocao-gas/alteracao.patch
npm run check
```

Se houver conflito, revisar os trechos manualmente; não usar reset geral ou forçar a aplicação. Depois de um commit próprio desta mudança, também será possível usar `git revert` desse commit, preservando o histórico.

Em 27/09/2026, o usuário autorizou o push desta remoção para o GitHub. A consulta ao remoto antes do envio confirmou `origin/main` em `54c7bc506e922a540ba3cad5747ea1423c6ac0de`, igual à base local. O push na main dispara o deploy automático descrito no README. Não foi consultada a identificação do deployment ativo na Vercel nem testado rollback em produção.

Para reverter após a publicação, usar `git revert` no commit específico da remoção, conferir o diff e executar `npm run check`; publicar a reversão somente com autorização. Isso restaura os arquivos removidos sem reescrever o histórico nem desfazer alterações posteriores de outras tarefas. O commit remoto anterior é a referência de código, não uma confirmação da versão que estava servida pela Vercel.
