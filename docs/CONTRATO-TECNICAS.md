# Contrato de dados: técnicas, referências e cota (07/11/2026)

Base: `NEUROJITSU-RELATORIOS/2026-11-06-mapa-de-conhecimento.md` (versão 3 vale sobre a 2).
Este arquivo é o que as frentes A, B e C seguem. Mudou aqui, muda nas três.

## 1. A técnica (Dexie `techniques`, nuvem `registros` com `tabela = 'techniques'`)

| Campo | Catálogo | Própria | Regra |
|---|---|---|---|
| `uid` | `uidEstavel(chaveNome('techniques', antigo \|\| pt))` | uuid do hook `creating` | nunca muda |
| `propria` | ausente | `1` (número, como `favorita` e `arquivada`) | nunca sai depois de posto |
| `nome` | do seed | do atleta | até `NOME_TECNICA_MAX` (80) |
| `detalhes` | do seed | "como você faz" | até `DETALHES_TECNICA_MAX` (2.000) |
| `versaoDe` | ausente | uid da origem (oficial ou própria) | opcional; o catálogo nunca é alterado |
| `fam` | do seed | `fam:*`, só se o atleta confirmar | opcional |
| `contra` | do seed (etapa futura) | lista de `fam:*` ou uid | opcional; só o confirmado |
| `arquivada` | — | `1` | some das listas, continua nos registros e na cota |

- Origem: `origemDaTecnica(uid)` em `src/lib/tecnicas.js` (`'catalogo'` ou `'propria'`). O campo `propria` existe para o servidor contar; no app a resposta é pelo uid.
- Na nuvem, linha do catálogo tem `id = hash(conta + uid)` (S2) e o uid de verdade em `dados->>'uid'`. Própria tem `id` = uuid da linha e `dados->>'uid'`.
- O app nunca apaga técnica de vez.

## 2. Limites (um lugar por lado)

| | App | Servidor |
|---|---|---|
| Próprias por conta, contando arquivadas e apagadas (`deleted_at`) | `LIMITE_TECNICAS_PROPRIAS` em `src/lib/limites.js` | `limite_tecnicas_proprias()` |
| Nome | `NOME_TECNICA_MAX` | mesmo número na trigger |
| Como você faz | `DETALHES_TECNICA_MAX` | mesmo número na trigger |

Um teste lê os dois lados e reprova se diferirem.

## 3. Referência a técnica em outros registros (Frente A)

Regra: o uid é a identidade, o nome é o que aparece. As listas de nomes continuam (muitos arquivos leem).

| Onde | Continua | Novo ao lado |
|---|---|---|
| Rola | `subsAplicadas`, `subsSofridas`, `tecMeus`, `tecDele` | `tecUid: { "<uid>": "<nome na época>" }` |
| Peça do plano (`tipo` golpe ou situação de técnica) | `golpe` / `acao` | `golpeUid` |
| Objetivo, preferida, aceitas do plano | nome ou `fam:*` | `tecUid` do plano, mesmo formato do rola (família já é id e não entra) |
| Meta que aponta técnica | o campo de nome que existir | `tecUid`, mesmo formato |
| Foco do treino | `nome` + `tecnicaId` | já sobe o uid (S3); não muda |

- O uid só é gravado quando o nome bate com **exatamente uma** técnica (catálogo por `nomeAtual`, ou própria). Senão fica sem uid e segue pelo nome.
- O valor de `tecUid` é o nome na época e nunca é reescrito. Renomear muda as listas de nomes, não o `tecUid`.
- Finta não tem uid nem `golpeUid` (é texto, etapa 3 da V3).
- Uid e `fam:*` são iguais em todo aparelho: sobem e descem sem tradução no `refs` do S3.
- Registros antigos: passada uma vez por aparelho, **simular primeiro**, números para o dono aprovar, só depois aplicar. Ambíguo ou sem par fica como está e é contado.

## 4. Cota no servidor (Frente C)

Migração SQL nova, não rodada em produção nesta fase.

| Desvio | Proteção |
|---|---|
| 101ª própria pelo app ou pela API | trigger `before insert or update` em `registros` (`tabela = 'techniques'`): conta linhas da conta com `propria`, incluindo `deleted_at` preenchido |
| Tirar `propria` de linha que tinha | o update recusa |
| Técnica sem `propria` fingindo ser do catálogo | a linha precisa ter uid do catálogo (lista gerada do seed, teste compara) ou `propria` |
| Outro valor em `tabela` | `check` com as tabelas que o app sincroniza, `not valid`; teste compara com `TABELAS_SYNC` e settings; `propria` só em `techniques` |
| Apagar de vez para liberar vaga | política de delete não deixa apagar própria |
| Nome > 80, detalhes > 2.000 | a mesma trigger recusa |
| RLS | as 4 políticas continuam `auth.uid() = user_id`; delete só fica mais restrito |

Recusa do servidor: o S1 deixa o registro na fila com o motivo (aparece em Ajustes). Nada some.

**Ordem de produção:** a migração só pode rodar depois que os aparelhos já marcam `propria` nas técnicas criadas (Frente B). Antes disso, a técnica própria antiga sem `propria` seria recusada ao ser editada.

## 5. Quem mexe em quê

| Frente | Arquivos (só estes) |
|---|---|
| A identidade | `src/lib/identidade.js` (novo), `src/lib/planos.js`, `src/pages/Planos.jsx`, `src/pages/Treinos.jsx`, `src/pages/Metas.jsx`, `src/lib/compatibilidade.js` (novo), `scripts/teste-identidade.mjs` (novo) |
| B própria | `src/db/db.js`, `src/components/SeletorTecnica.jsx`, `src/lib/familias.js`, `src/lib/proprias.js` (novo), `scripts/teste-proprias.mjs` (novo) |
| C cota | `supabase/56-cota-tecnicas-proprias.sql` (novo), `scripts/teste-cota-sql.mjs` (novo) |
| D assuntos | nada no repositório; relatório em `NEUROJITSU-RELATORIOS` |
| Integração (coordenador) | `package.json`, `README.md`, `PLANO.md`, este contrato, chamadas entre frentes |

Arquivo fora da lista: a frente para e avisa o coordenador.
