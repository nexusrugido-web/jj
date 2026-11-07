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
| `contra` | do seed (feito em 07/11, só nas defesas) | lista de `fam:*` ou uid | opcional; só o confirmado |
| `pendente` | do seed (só defesa) | — | `{ motivo, candidatas: [uid] }`: o que ainda precisa de decisão do dono. **Nunca entra no `contra`** |
| `arquivada` | — | `1` | some das listas, continua nos registros e na cota |

- Origem: `origemDaTecnica(uid)` em `src/lib/tecnicas.js`, que conta como catálogo `TECNICA_POR_UID` e os nomes antigos de `RENOMEAR` (`'catalogo'` ou `'propria'`). O campo `propria` existe para o servidor contar; no app a resposta é pelo uid.
- Na nuvem, linha do catálogo tem `id = hash(conta + uid)` (S2) e o uid de verdade em `dados->>'uid'`. Própria tem `id` = uuid da linha e `dados->>'uid'`.
- O app nunca apaga técnica de vez.
- Aparelho muito antigo pode ter técnica do catálogo com uid aleatório (versão 1 do banco, `dedupe`). Por isso `origemDaTecnica` sozinha não basta para mostrar "criada por você": a tela usa a marca `propria`, e a marcação das antigas (`marcarProprias` em `src/lib/proprias.js`) só marca com prova (uid fora do catálogo, nome fora do catálogo, com `criadoEm` e sem ter nascido junto com a semente); o resto fica como duvidosa, contada, sem marca.

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
| Peça do plano (só `tipo` golpe; situação é posição, finta é texto) | `golpe` / `acao` | `golpeUid` |
| Objetivo, preferida, aceitas do plano | nome ou `fam:*` | `tecUid` do plano, mesmo formato do rola (família já é id e não entra) |
| Meta que aponta técnica | o campo de nome que existir | `tecUid`, mesmo formato |
| Foco do treino | `nome` + `tecnicaId` | já sobe o uid (S3); não muda |

- O uid só é gravado quando o nome bate com **exatamente uma** técnica (catálogo por `nomeAtual`, ou própria). Senão fica sem uid e segue pelo nome.
- Cópia antiga do catálogo (aparelho da versão 1, uid aleatório) responde pelo uid oficial só com três provas: não é `propria`, o nome (exato, só sem acento e com o nome de hoje) é de **uma** técnica do catálogo, e ela nasceu junto com a biblioteca (20 ou mais técnicas no mesmo minuto). Não ter `propria` sozinho não prova nada. Sem prova, a cópia fica com o uid dela e o nome continua ambíguo. Nada é apagado: o uid antigo continua achando o nome e `uidOficial(uid, tecnicas)` leva ao oficial (`copiaDoCatalogo` em `src/lib/identidade.js`).
- O valor de `tecUid` é o nome na época e nunca é reescrito. Renomear muda as listas de nomes, não o `tecUid`.
- Finta não tem uid nem `golpeUid` (é texto, etapa 3 da V3).
- Uid e `fam:*` são iguais em todo aparelho: sobem e descem sem tradução no `refs` do S3.
- Registros antigos: passada uma vez por aparelho, **simular primeiro**, números para o dono aprovar, só depois aplicar. Ambíguo ou sem par fica como está e é contado. A prévia na nuvem é o `supabase/57-simulacao-tecnicas.sql` (as duas passadas, mesmas regras do app, conferido por `teste:simulacao-tecnicas`).

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

## 4b. Assuntos e `contra` (07/11/2026)

- Os 14 assuntos estão em `src/lib/assuntos.js`: id permanente (`assunto:*`) e regra feita só de categoria, slug de posição, família e etiqueta. Nenhuma regra lê nome; `teste:assuntos` passa a técnica por um objeto que lança erro se alguém ler nome. 506 técnicas em algum assunto, 108 em nenhum (as guardas e posições, os movimentos base e 10 pegadas e transições), 73 em dois.
- `contra` das defesas (`seed.js`): 16 defesas, só o confirmado. Família (`fam:*`) ou uid permanente. As 5 defesas gerais ficam sem `contra` e sem `pendente`: o motor segue a regra de hoje (sair da posição, com aviso).
- `pendente`: o que ainda não foi conferido. Não vira `contra` até o dono confirmar um a um. Hoje está vazio: em 07/11 o dono confirmou High crotch, Single leg com running the pipe e Berimbolo invertido, e a defesa de lapela ganhou 4 técnicas pelas costas (lapela por trás, arco e flecha, single wing, Ezequiel de lapela por trás), sem família inteira.
- O lado "por cima/por baixo" de quem faz a técnica sai da categoria e da posição, nunca do nome (`deDaTecnica` em `tecnicas.js`): passagem e ataque à tartaruga (finalização, transição, pegada) saem de quem está por cima.
- Ainda não lê `contra` nem assunto: a tela e o motor continuam como estavam.

## 4c. Família de mecânica e a ponte pro motor (Trilha R, R1, 07/11/2026)

- **Fonte de verdade da família de mecânica:** o campo `fam` da técnica do **catálogo** (`seed.js`, exposto em `CATALOGO_TECNICAS[].fam`), com os ids de `FAMILIAS` (`src/lib/familias.js`). Nada mais conta como família de mecânica:
  - a categoria (`cat`: articular, estrangulamento, compressão...) nunca prova a mesma mecânica. O motor ainda chama a categoria de `familia` (`familiaDaTecnica` em `tecnicas.js`, `pedido.familia` em `necessidades.js`); isso muda no R2;
  - `FAMILIAS_DE_FINALIZACAO` (`tecnicas.js`) é um conjunto de **categorias**, apesar do nome;
  - o `fam` da técnica criada pelo atleta é decisão dele e fica fora do R1 (as funções abaixo respondem só pelo catálogo).
- `defende(defesa, tecnica)` (`assuntos.js`): verdadeiro quando o `contra` da defesa tem a `fam` da técnica ou um uid dela (qualquer uid, inclusive o de nome antigo). Lê só `contra`, `fam` e `uid`. Técnica sem `fam` (as 4 compressões, por exemplo) só pega defesa que a cita pelo uid.
- `defesasContra(uid)`: as defesas do catálogo que servem contra a técnica. Hoje 63 técnicas têm defesa; só os 15 armlocks têm duas. Uid fora do catálogo devolve lista vazia.
- `assuntosDaAula(aula)`: os assuntos das técnicas marcadas na aula (`aula.tecnicas`), na ordem dos 14, sem repetir. Aula sem técnica marcada não tem assunto: título, tema e posição não decidem. Lê só `tecnicas`.
- Contagem no servidor: `supabase/62-contar-aulas-por-assunto.sql`, só leitura, gerado por `node scripts/gerar-sql-assuntos.mjs` com o mapa uid → assunto do catálogo dentro (mesma regra do `assuntosDaAula`). Não rodado.

## 5. Quem mexe em quê

| Frente | Arquivos (só estes) |
|---|---|
| A identidade | `src/lib/identidade.js` (novo), `src/lib/planos.js`, `src/pages/Planos.jsx`, `src/pages/Treinos.jsx`, `src/pages/Metas.jsx`, `src/lib/compatibilidade.js` (novo), `scripts/teste-identidade.mjs` (novo) |
| B própria | `src/db/db.js`, `src/components/SeletorTecnica.jsx`, `src/lib/familias.js`, `src/lib/proprias.js` (novo), `scripts/teste-proprias.mjs` (novo) |
| C cota | `supabase/56-cota-tecnicas-proprias.sql` (novo), `scripts/teste-cota-sql.mjs` (novo) |
| D assuntos | nada no repositório; relatório em `NEUROJITSU-RELATORIOS` |
| Integração (coordenador) | `package.json`, `README.md`, `PLANO.md`, este contrato, chamadas entre frentes |

Arquivo fora da lista: a frente para e avisa o coordenador.
