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

## Trilha D: Registro do rola em 10 segundos
Medir o registro de verdade, mostrar como ficaria antes de mexer.

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
7. **Competição e drill**: escolher o plano pro adversário da chave; "drill do plano" registra como drill (não conta como luta).


