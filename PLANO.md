# PLANO — Placar de conquistas, tirar o desânimo, planos de ataque, registro rápido

Ordem aprovada em 04/11/2026: Trilha A → B → C → D. Um commit por item.

Decidido em 04/11/2026. Uma tarefa por vez; cada uma termina com `npm run check` verde, README atualizado e push.

## Trilha A: Placar de conquistas
1. Home mostra "O que você conquistou esta semana" (só o que fez, cada lance contado, rola sem bater conta); "Fui finalizado" sai da home → FEITO.
2. Cor neutra pra derrota no histórico → FEITO.
3. Análise: "Conquistas por rola" ao longo dos meses; vitória × derrota num botão → FEITO.
4. Primeiras vezes (marcos automáticos) com figurinha → FEITO.

## Trilha B: Tirar o desânimo
- 2 Meta que zerou · 3 Volta depois de sumir · 4 Liga, "você desceu" · 7 Campeonato vencido → FEITO
- 8 "Você cai em" sai da home → Meu Jogo, últimos 30 dias, com aula de defesa → FEITO
- 9 "Por cima e por baixo" → últimos 90 dias → FEITO
- 10 Home com 4 coisas (conquistas, o que fazer hoje, metas, ofensiva); resto em "Ver mais", explicação no "?" → FEITO
- 11 No máximo 1 vitrine Premium por tela → FEITO

## Trilha E: Guiar o toque e tirar o número que desanima (04/11/2026)
1. Onboarding: faixa e graus viram 2 telas; toda escolha de um toque avança sozinha e o "Continuar" some nelas. Verificar: teste de telas, contador "X de 11". → FEITO.
2. Botão selecionado verde em todas as telas (chip, opção, seletor, quiz). Menu lateral continua na cor da marca. Verificar: print. → FEITO.
3. Brilho pulsando no que falta cadastrar: adicionar parceiro, academia, professor. Respeita reduced-motion. → FEITO.
4. Parceiro só entra com academia cadastrada pelo cadastro completo (nome, cidade, equipe); some o campo de nome solto no registro do treino. → FEITO.
5. Análise sem contagem de derrota: saem "Como você perdeu", "Ganhou e perdeu" e "Finalizações" (você levou); entram "Seus lances" (o que você faz, por tipo) e "Rolas sem bater". "O que te pega" vira o golpe da vez + aula de defesa, sem número. Faixa: sai "vezes que você bateu". → FEITO.
6. Avisos (SQL 51): "te pegou N vezes" vira "anda aparecendo, tem aula de saída"; "Caiu de divisão" vira divisão nova; "Semana sem treino" sai. → FEITO (falta colar o 51 no Supabase).
7. Planos de ataque como mapa: cada tipo com cor própria (posição, finta, reação, golpe, se defender), ramos mostrando as saídas, brilho e profundidade; sai o "Copiar pra mim": o faixa-branca começa com 1 a 3 exemplos já na lista dele e vai montando o próprio; os outros prontos ficam no Premium. → FEITO (exemplos fora do limite, 3 da faixa, árvore descendo).

## Trilha F: Ajustes do mapa e do registro (04/11/2026)
1. "De onde começou" sem "Não anotei": padrão "Em pé", trocável em Ajustes; o rola novo já vem com ele. → FEITO.
2. Recomendação contra mais pesado sem contar derrota: o número só decide se aparece; o texto fala do rola mais duro e manda pra aula. → FEITO.
3. Mapa do plano em árvore de verdade: "se ele defender" sai pro lado, ramos que mudam de direção, no celular os textos quebram linha em vez de comer a tela.
Depois: Trilha D (ok dado em 04/11/2026).

## Trilha D: Registro do rola em 10 segundos (ok em 04/11/2026)
Medido em 04/11/2026 (`corpoDaRola` em `src/pages/Treinos.jsx`): **10 blocos em sequência** (parceiro, peso, duração + de onde começou, plano, anotação, placar, pontos meus + vantagens, pontos dele + vantagens, eu finalizei, ele me finalizou). Um rola comum (passou 1x, raspou 1x, levou 1 passagem) pede ~8 toques e rolar a tela inteira; "de onde começou" é um select (2 toques) e o peso só vem sozinho quando o parceiro tem peso no cadastro.

Proposta:
1. Topo: parceiro em chips (os 6 mais recentes, 1 toque); peso e altura vêm do cadastro.
2. Um bloco só, "O que rolou": grade de toques, os meus lances em verde e os dele em neutro; cada toque soma (2x passou = 2 toques). Finalização abre as mais usadas em chips.
3. Placar ao vivo embaixo da grade.
4. "Mais detalhes" recolhido: duração, de onde começou, vantagens, técnica de cada ponto, plano de ataque, anotação.
5. "Próximo rola" já abre o seguinte do mesmo jeito.
Meta: rola comum em ~4 toques, sem rolar a tela. Verificar: contar os toques antes e depois num teste, e o teste de telas continua verde.

## Planos de ataque: o que já existe (não refazer)
- Tabela local `attackPlans` com sync (`src/db/db.js:69`, `src/lib/sync.js:109`) e 16 planos prontos em `src/db/attackPlans.js` (passos `gatilho → acao → seFalhar → proxima`). Nenhuma tela usa.
- Parceiro já tem `pesoRel`, `pesoKg`, `estilo`. Falta altura.
- Raio-X do parceiro (`components/RaioXParceiro.jsx`, premium) já fala do "plano pro próximo rola".

## Regras decididas
- Nome: **finta** (nunca "fake tap"/"isca").
- Corrente: Posição → **Finta** → reação dele → **Golpe** → se defender → próximo. Máx. 4 passos. Técnica e posição saem do catálogo, nunca texto livre.
- **Grátis**: 1 plano ativo (próprio ou copiado dos prontos), vê todos os prontos, vê a taxa de acerto do plano dele. Rodízio: vê "o último que você usou contra o Fulano"; a sugestão do próximo fica borrada (Vitrine).
- **Premium** (`RECURSOS.planos`): planos sem limite, rodízio por parceiro ("hoje vai de B"), taxa por tipo de adversário.
- Visual: sequência de cartões com profundidade e entrada em cascata, só CSS no SISTEMA NEURO. Sem three.js, sem MCP de design. Respeita `prefers-reduced-motion`.

## Trilha C: Planos de ataque com finta
1. **Placar da semana na home** → FEITO. Finalizei/Fui finalizado e a barra contam só a semana atual; total na Análise.
2. → FEITO. **Tela Planos de ataque** (menu, lista: Meus planos + Prontos; criar/editar a corrente; trava de 1 no grátis). Verificar: criar, editar, copiar pronto, segundo plano no grátis abre a oferta.
3. → FEITO (print headless não tirado). **Modo assistir** (o plano em cena, passo a passo, animado). Verificar: print headless e reduced-motion.
4. → FEITO. **Pra quem serve**: altura no parceiro (alto/médio/baixo) + etiquetas no plano (altura, peso, estilo); no parceiro, "planos que servem pra ele". Verificar: parceiro alto e pesado lista o plano marcado.
5. → FEITO. **No registro do rola**: "usou qual plano?" e "chegou até qual passo?" (opcional, 1 toque). Antes, conferir como `rolls` sobe pro Supabase (coluna ou json) → se precisar, SQL numerado novo.
6. → FEITO. **Taxa de acerto + rodízio** (lib pura com teste em `scripts/`): por plano, por passo onde morre, por tipo de adversário; sugestão do próximo plano por parceiro.
7. → FEITO. **Competição e drill**: escolher o plano pro adversário da chave; "drill do plano" registra como drill (não conta como luta).


