# PLANO — Placar de conquistas, tirar o desânimo, planos de ataque, registro rápido

Ordem aprovada em 04/11/2026: Trilha A → B → C → D. Um commit por item.

Decidido em 04/11/2026. Uma tarefa por vez; cada uma termina com `npm run check` verde, README atualizado e push.

## Trilha H: Plano com objetivo, finta em qualquer ponto e montar no mapa (05/11/2026)
O que achei: o catálogo já tem 15 armlocks com origem no nome ("Armlock da guarda fechada"); a busca falhou só por causa do espaço ("arm l" não casa com "armlock"). Os 16 prontos usam texto livre fora do catálogo ("Triângulo", "Omoplata"), nenhum tem objetivo nem finta, e o último passo vira o "se ele defender tudo" automático. A finta hoje é uma só, do plano inteiro, e a "deixa" mistura reação à finta com defesa do golpe.
1. Busca sem espaço ("arm l", "arm lock") e "chave de braço reta" nos armlocks. Verificar: casos novos no teste. → FEITO.
2 a 4 (base) → FEITO em 05/11/2026: objetivo obrigatório (finalizar, posição, golpe) com bandeira, finta como peça em qualquer ponto, reação separada da defesa, sem desfecho inventado, editor no mapa com "+", alça pra arrastar e mapa que se arruma sozinho. Limite que fica pra reestruturação: cada golpe tem uma defesa só e cada peça um pai só (árvore).
2. Passo ganha tipo: golpe ou finta. Finta tem uma saída ("ele reagiu") e a reação dela; golpe tem encaixou e defendeu, e a defesa mora no galho do defendeu. Finta antes de qualquer golpe, finta atrás de finta. A finta antiga do plano vira o primeiro passo na leitura, sem migração. Verificar: teste-planos (plano antigo abre igual, finta → finta → golpe).
3. Objetivo obrigatório. Bandeira em todo golpe que chega nele, em qualquer plano (A, B, C); golpe que chega fecha o caminho. Caminho que acaba sem chegar não ganha desfecho inventado; o editor avisa. Some o "se ele defender tudo" automático. Verificar: teste-planos.
4. Montar no mapa: o mesmo mapa do "Ver", com "+" nos galhos, tocar edita, arrastar um golpe pra outro galho leva ele e o que vem depois; o mapa se realinha sozinho. Verificar: print 360px e computador, teste de telas.
5. Os 16 prontos reescritos: nome do catálogo, objetivo, finta onde faz sentido, descrição em português de tatame (a situação, o que você faz, o que abre). Atualiza os prontos intactos de quem já tem. Verificar: lint:copy, teste-planos.
6. (se aprovado) Nome com origem no catálogo: Triângulo, Omoplata, Kimura, Guilhotina ganham "da guarda fechada" pelo renomeios. Verificar: teste:renomeios.

### Reestruturação (05/11/2026): de árvore de golpes pra jogo do atleta
Princípio: provocar, reconhecer, explorar, adaptar, encadear, finalizar. Um objetivo claro, várias maneiras de criar a oportunidade, caminhos que continuam trabalhando pra vitória. O mapa não prevê a luta inteira.
O formato guardado (passos com pai e via) continua; ele só ganha saídas novas, então o que já foi salvo segue abrindo.
- R1. Várias saídas por peça: a posição abre várias entradas (Finta A, B, C como opções, não etapas); o golpe abre "encaixou" e quantas defesas específicas precisar, cada uma com o nome dela e a sua continuação; a finta abre "reagiu como eu queria" e "não reagiu, troco a ameaça". Cada defesa nova vira um plano com letra própria, sem o teto de 4. → FEITO em 05/11/2026. Peça = o que você faz; gatilho = o que ele fez; via = a condição. Toda saída aceita vários caminhos (menos "não reagiu"); duas defesas ou reações sem nome na mesma peça ganham aviso.
  Conferido pra frente: R2 é mais uma via ("escapou"); R3 entra como `ligacoes: [{ de, via, gatilho, para }]` no plano, sem mexer na árvore (a árvore continua sendo o "primeiro caminho" que o mapa desenha); R4 é campo do objetivo; R5 é mais um `tipo` de peça; R7 guarda no rola o caminho como lista de peças. Cuidado pro R3/R7: tirar uma peça hoje renumera as de depois, e o `ate` do rola aponta pelo número. Antes de ligar convergência ou registro por caminho, dar a cada peça um id fixo.
- R1.5. Identidade de cada peça e de cada ligação (base pro R3 e R7) → FEITO em 05/11/2026. Peça tem `id`, a ligação que chega nela tem `lig`; arrastar, renomear, mudar gatilho ou apagar outra peça não muda nenhum dos dois. Ligação que muda de ponta (arrastou, entrou ou saiu finta no meio) ganha id novo: é outro caminho. O que sai do plano fica em `removidos: { pecas, ligacoes }`. O rola guarda `{ uid, peca, caminho, encaixou }` (caminho = ligações da posição até a peça, como eram no dia). Rola antigo (`ate` = índice) migra no boot só quando o plano não mudou depois do rola; senão fica `peca: null` + `ateAntigo`. Letras sem teto (Z, AA, AB...). "Não reagiu" aceita várias ameaças. Teto de 16 peças: tirado em 05/11/2026 (ver R1.6). Teste visual: `scripts/teste-planos-visual.mjs` (precisa do `npm run dev`).
- R1.6. Plano sem teto de peças → FEITO em 05/11/2026. Saiu o `MAX_PASSOS` (poda da árvore, cópia de pronto, vagas e aviso do editor, "Pôr uma finta antes"). Sem número no lugar. O mapa já é árvore arrumada (cada galho ocupa a altura dos filhos), então não sobrepõe com tamanho nenhum. A legenda mostra as 8 cores e "Planos I a ...: as cores repetem" (antes listava todo plano e empurrava o mapa pra fora da tela). Medido: 2000 peças salvam e leem em menos de 1s; 42 peças abrem o mapa em ~0,6s no celular, 0 cartões sobrepostos. Proteção contra volume extremo: não precisou.
- R2. Escapou: saída "ele escapou, reconstruo" que leva a uma peça de reorganização ou de volta a um ponto anterior. Defesa que não deixa continuação fecha o caminho, sem frase inventada.
- R3. Convergência: uma saída pode apontar pra uma peça que já existe (três preparações levam ao mesmo ataque sem repetir o cartão); no mapa, fio tracejado até ela.
- R4. Objetivo em dois níveis: principal (finalizar, posição, raspagem, passagem) + finalização preferida + as aceitas. A bandeira forte vai na preferida, a fraca nas aceitas.
- R5. Preparação como peça própria (pegada, desequilíbrio, ajuste de pressão), separada da finta.
- R6. Os 16 prontos reescritos nesse modelo (itens 5 e 6 de cima): nome do catálogo, objetivo, descrição em português de tatame.
- R7. Registro no rola pelo caminho: finta usada, reação provocada, ataque, defesa, chegou ou não. Taxa por etapa, só com dado real do atleta, e com aviso quando há poucas tentativas.
- R8. Visão de competição: só os caminhos mais treinados e que mais funcionam, pra revisar antes da luta.

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
3. Mapa do plano em árvore de verdade: "se ele defender" sai pro lado, ramos que mudam de direção, no celular os textos quebram linha em vez de comer a tela. → FEITO (o "depois" dos prontos vira fim ou segue).
Depois: Trilha D (ok dado em 04/11/2026).

## Trilha G: Plano em árvore com plano B e C (04/11/2026)
1. Assuntos diferentes no mesmo campo ganham nome e fio entre eles (Altura | Peso no "Pra quem serve"). → FEITO.
2. Cada golpe abre dois caminhos: "Encaixou, e depois?" (segue no mesmo plano, verde) e "Se ele defender" (abre o Plano B, C, D). Até 12 golpes e 4 trilhos. Plano antigo vira trilho só de "se defender", sem conversão. → FEITO.
3. Campo "Onde quero chegar" (objetivo), com bandeira no fim do caminho todo verde. → FEITO.
4. Mapa em trilhos tipo metrô: cada plano uma cor, encaixou desce no trilho, se defender sai pro trilho do lado. → FEITO.
5. Editor: "Seu golpe" primeiro, a deixa dele embaixo com nome que muda conforme o caminho; botão "Entenda" com o guia (finta, golpe, deixa, plano B, objetivo). → FEITO.
Verificar: teste-planos (árvore, plano antigo, limpeza de golpe vazio), teste de telas, print em 360px.

## Trilha D: Registro do rola em 10 segundos (ok em 04/11/2026)
Medido em 04/11/2026 (`corpoDaRola` em `src/pages/Treinos.jsx`): **10 blocos em sequência** (parceiro, peso, duração + de onde começou, plano, anotação, placar, pontos meus + vantagens, pontos dele + vantagens, eu finalizei, ele me finalizou). Um rola comum (passou 1x, raspou 1x, levou 1 passagem) pede ~8 toques e rolar a tela inteira; "de onde começou" é um select (2 toques) e o peso só vem sozinho quando o parceiro tem peso no cadastro.

Proposta:
1. Topo: parceiro em chips (os 6 mais recentes, 1 toque); peso e altura vêm do cadastro.
2. Um bloco só, "O que rolou": grade de toques, os meus lances em verde e os dele em neutro; cada toque soma (2x passou = 2 toques). Finalização abre as mais usadas em chips.
3. Placar ao vivo embaixo da grade.
4. "Mais detalhes" recolhido: duração, de onde começou, vantagens, técnica de cada ponto, plano de ataque, anotação.
5. "Próximo rola" já abre o seguinte do mesmo jeito.
Meta: rola comum em ~4 toques, sem rolar a tela. Verificar: contar os toques antes e depois num teste, e o teste de telas continua verde.
→ FEITO (teste-campeonato conta 4 toques; placar e lances dele em neutro).

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


