# Resposta sobre a técnica na aula — 30/09/2026

No formulário de treino, cada item em `focoTecnicas` já guarda `aprendizado: 'peguei' | 'meio' | 'nao' | null`. O campo é opcional. O estado marcado agora aparece como botão selecionado com borda, cor, check e explicação. Tocar de novo mantém a escolha; há um botão separado para limpar.

| Resposta | Efeito nos dados |
| --- | --- |
| Peguei | Entra no histórico da aula, conta como prática de drill na régua inicial de domínio e aparece como “pegou” na ficha da técnica. Não prova uso em rola. |
| Mais ou menos | Entra no histórico e na prática de drill inicial, mas não no contador “pegou”. A dificuldade recente passa a sugerir revisão em Estudo. |
| Não peguei | Entra no histórico, não conta como movimento conhecido na régua e sugere revisão em Estudo. |

A recomendação usa o **último retorno explícito** da técnica nos últimos 30 dias. Uma resposta posterior “Peguei” encerra a dificuldade antiga. Quando houver várias dificuldades, “Não peguei” tem prioridade. A recomendação leva o nome da técnica ao mesmo motor de seleção de aulas usado pelo restante do app. O app não concede XP por escolher uma resposta; os pontos de treino e rola seguem `Treinos.jsx`/`xp.js`. Nenhuma migração SQL é necessária, porque o campo já existia no registro local e na sincronização.

Validação: `npm run teste:aprendizado` cobre a conexão entre histórico, domínio e Estudo. `npm run teste:aprendizado-visual` confere no Android emulado o estado selecionado, a largura do formulário e a persistência depois de salvar; captura em `artifacts/aprendizado/android-selecionado.png`.
