# Ofensiva semanal v2

Implementação autorizada em 29/09/2026. Objetivo: reconhecer semanas com treino, mantendo o registro e a análise dos rolas como núcleo do app. Meta pessoal, XP e Liga são medidas independentes.

## Regras

- Calendário de Brasília, segunda a domingo; a data realizada do treino define a semana.
- Um treino salvo de gi, no-gi, drill, open mat ou aula privada garante a semana, sem exigir reflexão, finalização ou XP.
- Competições entram quando a participação é concluída no registro (resultado, inclusive sem pódio). Evento apenas planejado não conta. O sync não preserva IDs numéricos de sessões na nuvem, portanto a regra usa a participação na própria sessão e não tenta vincular rolas por IDs de aparelhos diferentes.
- Mais treinos na mesma semana não aumentam a sequência. Estudo e ajuste manual de meta não criam presença.
- Semana aberta sem treino fica pendente. Só uma semana encerrada pode consumir escudo ou interromper a sequência.
- Cada quatro semanas treinadas dentro da sequência geram um escudo; limite de dois, ou três do Nacional em diante. Ao atingir o limite, não se acumulam créditos extras de escudo.
- Escudo protege uma semana sem somar semanas. Pausa por lesão de impacto `parado` protege as semanas que ela atravessa, sem gastar escudos nem exigir estudo. Lesão adaptada não pausa. Treino realizado durante uma semana parcialmente lesionada conta normalmente.
- Edição, exclusão e registro retroativo recompõem sequência e escudos. Quebra reinicia o progresso para o próximo escudo.
- A divisão atual define o limite de escudos do cálculo, como já acontecia na regra anterior.

## Dados e compatibilidade

`ofensivaSemanal.js` é o cálculo local. O servidor aplica a mesma regra em `calcular_ofensiva_semanal`, lendo somente sessões e lesões ativas de `registros`. A comparação automatizada usa PostgreSQL local via PGlite e verifica paridade com o JavaScript.

As novas consultas têm nomes próprios. `perfil.sequencia`, as consultas diárias e os cartões compartilhados antigos permanecem na unidade antiga. Clientes anteriores não escrevem semanas nesses campos. O novo ranking é calculado ao consultar, inclusive para quem deixou de abrir o app.

A regra diária fica disponível para reconstruir o recorde até 29/09/2026. O maior recorde diário encontrado é preservado localmente e exibido como histórico. Conquistas diárias existentes permanecem; novos marcos semanais usam chaves próprias (4, 8, 12, 26 e 52 semanas). Não há conversão de dias ou escudos diários em semanas: o histórico de sessões recompõe os valores semanais.

XP, limites de estudo, entrada automática, bônus de promoção e fechamento da Liga não foram alterados. A barra de progresso e a ajuda passam a refletir a zona de classificados que o fechamento já usa, inclusive grupos com mais de cinco pessoas.

## Publicação

1. O diagnóstico 25 foi recebido do usuário e comparado com as funções vigentes em produção.
2. Executar `supabase/26-ofensiva-semanal.sql` no SQL Editor. A transação adiciona as consultas semanais e atualiza fila e diagnóstico dos avisos. Não reaplicar SQLs antigos.
3. Executar `supabase/27-verificar-ofensiva-semanal.sql`. Todas as linhas devem indicar `ok=true`; o arquivo compara assinaturas, conteúdo e permissões das funções.
4. Concluir testes e publicar o código pelo GitHub após a confirmação do banco.

O usuário enviou o resultado do SQL 27 em 29/09/2026: as 13 verificações retornaram `true`. A instalação das funções semanais e as permissões foram confirmadas antes da publicação.

O aviso semanal usa a tag nova `ofensiva_semanal`, aceita pelo encaminhamento genérico da Edge Function atual. O service worker antigo exibe o título/corpo enviados pelo servidor; o novo também oferece ação para registrar treino. A fila avisa no domingo, apenas com sequência ativa, semana sem treino e sem pausa. Não exige republicação da Edge Function.

## Validação

- `npm run teste:ofensiva-semanal`: casos de produto, calendário, paridade com PostgreSQL, reexecução da migração, consultas e permissões.
- `npm run check`: validações existentes do projeto e a nova regra.
- Com Vite em `127.0.0.1:5173`, `node scripts/teste-ofensiva-visual.mjs`: Chrome em desktop e Android emulado, dados sintéticos, chamadas externas bloqueadas; capturas em `artifacts/ofensiva-semanal`.
- Emulação verifica a interface responsiva; instalação PWA, entrega de push e uso em um Android físico requerem conferência no aparelho.

As alterações locais preexistentes em Nutrição, CSS e suplementos são preservadas e não integram esta entrega.
