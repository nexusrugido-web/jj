# NeuroJitsu

PWA de treino de Jiu-Jitsu que transforma o histórico de rolas no diagnóstico do jogo do aluno. Público principal: faixas branca e azul, mas tudo tem que fazer sentido pra qualquer faixa.

Este arquivo é o **mapa vivo** do app: pra que serve cada parte, onde mora e quais regras não se quebram. Toda mudança que altera o que está aqui atualiza este arquivo na mesma hora, e o que deixou de existir sai daqui.

- No ar: `jj-theta-eight.vercel.app` (Vercel, deploy a cada push na `main`)
- Banco e contas: Supabase (plano grátis; ver "Custos")
- Automação de vendas e WhatsApp: n8n em `n8n.nexusrugido.com` (ver `n8n/README.md`)

---

## As telas e pra que cada uma existe

| Tela | Propósito | Grátis | Premium |
|---|---|---|---|
| **Painel** | O resumo do dia: ofensiva (toque abre "Sua ofensiva"), tatame, lutas, finalizações, metas e técnicas | números | gráficos e "o que treinar agora" |
| **Treinos e rolas** | O registro. Academia, professor e duração vêm do padrão; cada rola com parceiro, peso, posição inicial, pontos IBJJF e finalizações | tudo, sem limite | igual ao grátis |
| **Estudo** | Aulas e quiz. Por tema e Por dificuldade são livres; "Pra você" escolhe aula longa pelo jogo do aluno e tem as exclusivas de assinante | 1 aula completa + 1 rápida + 1 rodada de quiz por dia, quiz sorteado | Pra você, estudo sem limite, quiz que volta no que errou |
| **Liga** | Só a liga: o grupo da semana, pódio, sobe e desce de divisão. O ranking global abre por um link ("Os faixas-pretas da ofensiva") | tudo | igual ao grátis |
| **Amigos** | Pedidos de amizade e a sala (liga só de amigos, 3 a 5 pessoas) | tudo | igual ao grátis |
| **Meu jogo** | A faixa no topo, o estilo (o que aparece em mais rolas), onde ganha e onde cede | resumo | por situação (peso e posição inicial) |
| **Minhas técnicas** | O grau de cada técnica que apareceu nos rolas e o que falta pro próximo | tudo | o que treinar agora |
| **Análise** | Evolução, presença, contra quem luta, onde fica por cima | vitrine | tudo |
| **Metas** | Metas que o aluno assumiu; as que zeram (defesa, frequência) mostram quando e por quê | até 2, só as sugeridas | próprias e sem limite |
| **Conquistas** | Marcos e registro de graduação | tudo | igual ao grátis |
| **Musculação (Força pro jiu-jitsu)** | Os exercícios de força, resistência e prevenção de lesão (40 hoje; os que entram ganham a etiqueta "novo" por 30 dias) que mais ajudam no tatame, cada um com o plano pra encaixar no treino de academia que o aluno já faz (séries × repetições, vezes por semana, descanso, carga, onde entra, a regra de progressão sem fim e o erro comum; o como fazer é o botão de buscar o vídeo). Não registra academia | vitrine | tudo |
| **Nutrição (Combustível pro jiu-jitsu)** | Proteína, carboidrato e água pelo peso e pela semana de tatame, com a conta à vista (`src/lib/nutricao.js`, base ISSN); o dia de comida (toca no que comeu e a barra enche até a meta; "bati / não bati" pra quem não anota; navega pelos dias), os alimentos da pessoa (tabela `foods`, com proteína e carboidrato por porção) e as refeições salvas (`dietPlans`), o mês de proteína num calendário (`meals`, um registro por dia); o dia que bateu ganha um ponto verde no calendário de presença; suplementação fechada numa sanfona no fim | pede o peso e mostra as contas dele na vitrine | tudo |
| **Parceiros, Gás, Lesões** | Apoio | tudo | igual ao grátis |
| **Ajustes** | Lista que abre popups: Perfil, Aparência, Como usar, App no celular, Avisos, Seus dados, Conta (sair e apagar a conta) | tudo | igual ao grátis |
| **Painel do admin** | Chaves de recurso, acervo de vídeos, medição, contas, links, vendas e recuperação. "Ver o app como" grátis ou premium | só admin | igual ao grátis |

O que é grátis e o que é pago mora em `RECURSOS` (`src/lib/plano.js`) e só vale com a chave `cobranca` ligada. Toda trava usa `podeVer` e mostra a `Vitrine` (a seção real borrada) ou o `Convite` (popup).

---

## Regras que não se quebram

- **O registro nunca é pago.** Treino, rola e todos os campos são grátis pra sempre: é o dado que alimenta o diagnóstico pago.
- **Grau é habilidade, ponto é esforço.** Grau sai dos rolas, nunca desce e nunca vai pra ranking. Ponto (treino, aula, quiz) vai pra Liga e pra ofensiva. Os dois nunca aparecem na mesma linha.
- **Todo número com tempo** sai de `periodoDeDados` (`src/lib/periodo.js`) e mostra o rótulo do período.
- **Drill não é luta** em conta nenhuma.
- **"O rola"**, no masculino. `npm run lint:copy` barra o feminino e o travessão.
- **Nada de número que o aluno não consegue conferir na tela** (sem nota de 0 a 100, sem porcentagem de confiança).

---

## Onde os dados moram (e por que não se perdem)

- **No aparelho** (IndexedDB, via Dexie): tudo. O app funciona offline.
- **Na nuvem** (`registros`, uma linha por registro, em JSON): o que está em `TABELAS_SYNC` (`src/db/db.js`), pra quem tem conta. Cada gravação entra numa fila (`outbox`) e sobe sozinha.
- **O que não sobe:** a biblioteca que todo aparelho cria igual (posições, categorias, técnicas e planos prontos), enquanto o aluno não mexe. Mexeu, vira dado dele (`sementeIntacta`, `src/lib/sync.js`).
- **O que desce não volta a subir** (marca `__local`). Sem isso a sincronização entrava em ciclo.
- **Cada tabela sobe inteira uma vez por aparelho** (`garantirNuvem`), inclusive as que entram no sync depois.
- **Sair** só sai com a fila vazia. **Os pontos** também têm cópia no servidor da Liga e voltam sozinhos se o aparelho perder (`restaurarPontos`).
- **Apagar a conta** (Ajustes → Conta): apaga arquivos, depois o usuário, e o banco leva tudo em cascata (`supabase/conta.sql`). A assinatura fica sem dono, porque registro de venda é guardado por lei.

---

## Avisos (notificações)

- O servidor decide **quem** recebe e **quando** (`supabase/notificacoes.sql`, pg_cron de hora em hora chamando a Edge Function `notificar`). No máximo um por dia.
- **Testar:** Painel do admin → Visão → "Testar avisos" manda um aviso real pro celular (mesmo caminho dos avisos do aluno) e mostra o diagnóstico elo por elo (`testar_aviso` e `diagnostico_de_aviso`, só admin desde o SQL 14). Tem um botão pra cada aviso que existe (teste, ofensiva de 1 dia, ofensiva de vários dias, liga, resultado, volta); tocar de novo manda a próxima versão do texto (`testar_aviso(email, tipo, dias, versao)` desde o SQL 17b; a função usa o `versao` no lugar da versão do dia, só no teste). Aviso novo no `sw.js` precisa entrar também na lista `AVISOS` de `src/components/TesteAviso.jsx`.
- O **texto** que a pessoa lê mora em `public/sw.js` (função `aviso`): com a cara do tatame, com emoji e botões de ação, e se reveza por dia. Mudar texto é mexer lá, não no SQL.
- "Toque para copiar o URL desse app" **não é aviso nosso**: é o Chrome avisando que o app foi instalado como atalho. Resolve reinstalando por ⋮ → Instalar app (no Xiaomi, liberar "Atalhos na tela inicial" pro Chrome).

## Assinatura (Premium)

- Quem compra com o e-mail da conta é reconhecido sozinho. Quem compra com outro e-mail recebe no WhatsApp um link `?ativar=CODIGO` que libera com um toque (`registrar_compra`, `guardarCodigoDaUrl`/`usarCodigoGuardado` em `src/lib/plano.js`). Não existe mais o botão "Já assinei".
- O card do Premium (`src/components/Plano.jsx`) mostra se renova sozinho, os dias pagos numa barra, as faturas (`minha_assinatura()`, lendo `hotmart_evento`) e o botão de renovar quando a renovação foi cancelada. Pagamento que não entrou manda pra Hotmart (Minhas compras) atualizar o cartão.
- O aviso de renovar (`src/components/Renovacao.jsx`) aparece no máximo uma vez por dia, só com a cobrança ligada: renovação cancelada e faltando 7 dias ou menos, pagamento pendente, ou acabou há menos de uma semana. Quem renova sozinho nunca vê.
- "Premium" é sempre com maiúscula no texto; `npm run lint:copy` barra a minúscula.

## Compartilhar (figurinha do story)

- A imagem é desenhada no aparelho (`src/lib/figurinha.js`), com a folha em `src/components/Figurinha.jsx`. O NeuroJitsu e o @neuro_jitsu saem sempre: cada post é propaganda.
- A pessoa escolhe **fundo** (sem, pra colar por cima da foto, ou com), **frase de impacto** (com ou sem, e "outra frase") e **cor**. As frases ficam em `FRASES`, uma lista por tipo (graduacao, recorde, ofensiva, semana, meta, marco), e quem abre a folha diz o tipo.
- Tudo é de graça, menos as cores extras (cor da faixa e dourado, recurso `temasFigurinha`): a prévia mostra a cor, e no lugar dos botões aparece o convite.
- Onde abre: marcos e resumo (Conquistas), a comemoração de marco, a graduação (depois de registrar, "Postar no story", e em cada linha da linha do tempo, com a faixa desenhada), o card da semana (Conquistas), ofensiva e metas.
- **Recorde do dia** é marco (`tipo: 'recorde'`, `src/lib/milestones.js`): um por recorde batido, a partir de 5 rolas ou 3h de tatame num dia. Aparece sozinho na comemoração depois de salvar o treino. Teste: `npm run teste:marcos`.
- **Desenhos de jiu-jitsu** (`public/figurinhas/`, 8 PNGs sem fundo de ~30 KB, gerados com IA pelos prompts de `NEUROJITSU-COLAR/18-PROMPTS-DESENHOS-FIGURINHA.md`): vão no canto de cima à direita. Cada tipo tem um padrão (`DESENHO_PADRAO`) e a pessoa troca ou tira na fileira da folha. O desenho encolhe quando o texto precisa de espaço: o número nunca fica menor que 120 px por causa dele. Desenho novo entra em `DESENHOS` com o arquivo em 560×560.

---

## IA

`/api/ia` (Vercel Function) guarda a chave da Groq. Só atende conta logada (o token é conferido no Supabase). A Análise IA pede premium quando a cobrança está ligada; classificar vídeo é só do admin. Teste: `teste:ia`.

---

## Custos (Supabase grátis)

Limites: 500 MB de banco, 1 GB de arquivos, 5 GB de tráfego por mês. Em 24/09/2026: banco ~18 MB, 4 contas. Sem biblioteca na nuvem e sem o índice GIN (apagado), um aluno ativo ocupa ~0,5 a 0,8 MB por ano: o grátis aguenta algo como 500 a 700 alunos ativos por ano. O projeto não pausa (a vigia do pg_cron roda a cada 5 minutos). O grátis não tem backup: é o motivo pra ir pro Pro (US$ 25/mês) assim que tiver receita. Pra medir: `NEUROJITSU-COLAR/12-VERIFICAR-BANCO.sql`.

---

## Antes de subir

```bash
npm run check
```

Roda os linters (copy, símbolos, ciclos, chunks), o build e todos os testes, inclusive `teste:telas`, que abre todas as telas com cinco meses de dados falsos. Verde = pode subir.

Rodar local: `npm install`, `cp .env.example .env.local`, `npm run dev`. Sem `.env.local` funciona igual, só sem nuvem e sem IA.

SQL do Supabase: os arquivos de `supabase/` são a versão sem segredo; os prontos pra colar, com segredo, ficam em `Downloads/NEUROJITSU-COLAR` (fora do git).

---

## Mudanças recentes

Só as últimas, pra saber o estado atual. O detalhe de cada dia fica em `Downloads/NEUROJITSU-RELATORIOS`.

- **24/09/2026**
  - Assinatura: sai o "Já assinei" (link no WhatsApp libera sozinho), card com renovação, dias pagos e faturas, aviso de renovar. Nutrição: seu dia de comida com barra, alimentos e refeições próprios, mês de proteína, ponto verde no calendário de presença; sai o prato em volta do treino, suplementação vira sanfona. Sai o "Demorando?" da abertura.
  - Compartilhar: 8 desenhos de jiu-jitsu na figurinha (escolhe ou tira). Figurinha sem a pílula laranja, com frase de impacto (liga/desliga/troca), cores extras no premium, figurinha de graduação com a faixa desenhada, recorde do dia e card da semana. Sai o "desde o começo": o resumo mostra a faixa.
  - Admin: Testar avisos com um botão pra cada aviso.
  - Sincronização: acabou o ciclo infinito, a biblioteca não sobe mais, cada tabela sobe inteira, Sair não perde a fila, pontos voltam do servidor da Liga.
  - Salvar treino: trava contra toque duplo, grava tudo ou nada, e os repetidos antigos são limpos sozinhos.
  - IA fechada pra conta logada; Análise IA só premium.
  - Grátis x premium: gráficos, "o que treinar agora", "Pra você" (só aula longa e as exclusivas), Análise, metas próprias e Análise IA são do premium.
  - Saíram: módulo Técnicas (fica o seletor no treino e Minhas técnicas), envio de vídeo, revisão de técnica, código morto (~600 linhas).
  - Ofensiva em destaque no Painel com popup; Liga só com a liga.
  - Quiz: alternativas embaralhadas (a certa era sempre a segunda), rodada fixa, 33 perguntas.
  - Ajustes em lista de popups; apagar a própria conta.
  - Visual: fundo preto neutro de padrão; etiquetas não passam mais da borda das caixas.
  - App abre já com as regras certas (antes mostrava tudo liberado por uns segundos).
  - Musculação virou "Força pro jiu-jitsu", premium, com plano por exercício; Nutrição virou "Combustível pro jiu-jitsu", premium, com calculadora pelo peso.
  - Placar do Painel em quatro quadros; diamante (na cor de destaque) em tudo que é premium.
  - Copy: voz de gente de tatame; `lint:copy` barra palavras de IA (mergulhar, jornada, alavancar...).

---

Regras da IBJJF mudam de temporada: confirme no site oficial antes de competir. Orientações de treino, nutrição e recuperação são educativas e não substituem profissional nem o seu professor.
