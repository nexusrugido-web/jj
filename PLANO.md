# PLANO — Planos de ataque + tirar o desânimo

Decidido em 04/11/2026. Uma tarefa por vez; cada uma termina com `npm run check` verde, README atualizado e push.

## O que já existe (não refazer)
- Tabela local `attackPlans` com sync (`src/db/db.js:69`, `src/lib/sync.js:109`) e 16 planos prontos em `src/db/attackPlans.js` (passos `gatilho → acao → seFalhar → proxima`). Nenhuma tela usa.
- Parceiro já tem `pesoRel`, `pesoKg`, `estilo`. Falta altura.
- Raio-X do parceiro (`components/RaioXParceiro.jsx`, premium) já fala do "plano pro próximo rola".

## Regras decididas
- Nome: **finta** (nunca "fake tap"/"isca").
- Corrente: Posição → **Finta** → reação dele → **Golpe** → se defender → próximo. Máx. 4 passos. Técnica e posição saem do catálogo, nunca texto livre.
- **Grátis**: 1 plano ativo (próprio ou copiado dos prontos), vê todos os prontos, vê a taxa de acerto do plano dele. Rodízio: vê "o último que você usou contra o Fulano"; a sugestão do próximo fica borrada (Vitrine).
- **Premium** (`RECURSOS.planos`): planos sem limite, rodízio por parceiro ("hoje vai de B"), taxa por tipo de adversário.
- Visual: sequência de cartões com profundidade e entrada em cascata, só CSS no SISTEMA NEURO. Sem three.js, sem MCP de design. Respeita `prefers-reduced-motion`.

## Tarefas
1. **Placar da semana na home** → FEITO. Finalizei/Fui finalizado e a barra contam só a semana atual; total na Análise.
2. **Tela Planos de ataque** (menu, lista: Meus planos + Prontos; criar/editar a corrente; trava de 1 no grátis). Verificar: criar, editar, copiar pronto, segundo plano no grátis abre a oferta.
3. **Modo assistir** (o plano em cena, passo a passo, animado). Verificar: print headless e reduced-motion.
4. **Pra quem serve**: altura no parceiro (alto/médio/baixo) + etiquetas no plano (altura, peso, estilo); no parceiro, "planos que servem pra ele". Verificar: parceiro alto e pesado lista o plano marcado.
5. **No registro do rola**: "usou qual plano?" e "chegou até qual passo?" (opcional, 1 toque). Antes, conferir como `rolls` sobe pro Supabase (coluna ou json) → se precisar, SQL numerado novo.
6. **Taxa de acerto + rodízio** (lib pura com teste em `scripts/`): por plano, por passo onde morre, por tipo de adversário; sugestão do próximo plano por parceiro.
7. **Competição e drill**: escolher o plano pro adversário da chave; "drill do plano" registra como drill (não conta como luta).

## Tirar o desânimo (achados da varredura, decidir com o usuário)
Ver a resposta do chat de 04/11/2026; itens aprovados entram aqui como tarefas.
