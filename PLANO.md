# PLANO — Placar de conquistas, tirar o desânimo, planos de ataque, registro rápido

Ordem aprovada em 04/11/2026: Trilha A → B → C → D. Um commit por item.

Decidido em 04/11/2026. Uma tarefa por vez; cada uma termina com `npm run check` verde, README atualizado e push.

## Trilha T: técnicas com identidade, próprias e cota (07/11/2026)
Contrato em `docs/CONTRATO-TECNICAS.md`. Cada frente numa branch própria, integração na `frentes/base`, main só depois da revisão do dono.
- A. uid ao lado do nome em rola, plano e meta; passada antiga só em simulação. → verificar: `teste-identidade`.
- B. técnica própria nos dados: `propria`, `versaoDe`, `fam`, cota no app; marcar as antigas só em simulação. → verificar: `teste-proprias`.
- C. SQL 56 da cota (não rodar). → verificar: `teste-cota-sql` com PGlite.
- D. lista dos 14 assuntos para aprovação, sem implementar.
- Família própria no plano: técnica própria com `fam` confirmado conta no "qualquer armlock" (objetivo, preferida, aceitas). → FEITO, `teste-planos`.
- Telas de técnica própria (decidido 07/11: na ficha de Minhas técnicas; renomear propaga pelo uid só na própria):
  - T1. Dados: `editarPropria` (nome, como você faz, família; nome repetido barra, ela mesma não conta; renomear aplica `patchesDoRenomeio` em rolas, planos e metas), `arquivarPropria` (liga e desliga), versão de técnica do catálogo (`versaoDe`, já preenchida com a da origem). → verificar: `teste-proprias`. → FEITO.
  - T2. Ficha: própria mostra Editar e Arquivar; do catálogo mostra "Criar minha versão". → verificar: print 360px, `teste:telas`, `lint:copy`. → FEITO (`teste:proprias-visual`).
  - T3. "Criadas por você, ainda sem rola" em Minhas técnicas, com as arquivadas. → FEITO.
  - T4. Simulações das duas passadas (marcar as próprias antigas; ligar rolas, planos e metas ao uid) no servidor: SQL 57, só leitura. → verificar: `teste:simulacao-tecnicas` (mesmos números do app). → FEITO; falta o dono colar e aprovar os números.
  - T5. Antes de ligar a passada (revisão de 07/11 em NEUROJITSU-RELATORIOS/2026-11-07-revisao-passada-identidade.md): SQL 56 aceitar a técnica antiga sem `propria` que já existe na nuvem (hoje recusaria 454); ligar com marca `identidade_t` e transação única (teste fechando no meio); SQL da cópia e da comparação. Ligar só com autorização do dono.
    - T5a. SQL 56 aceita a técnica antiga já na nuvem (viva, sem `propria`, uid igual ao que já tem); linha nova, apagada que volta, outra tabela e uid trocado continuam recusadas. → verificar: `teste:cota` (50 verificações, 4 brechas). → FEITO.
    - T5b. Passada de identidade tudo-ou-nada: `aplicarIdentidadeUmaVez` (`src/lib/passada-identidade.js`), registros + marca de pessoal + fila + marca `identidade_t` numa transação; hooks quietos por `semFila`. → verificar: `teste:passada-atomica` (fecha no meio, na fila, tenta de novo, duas abas, rodar de novo). → FEITO, NÃO LIGADA.
    - T5c. SQL 58 (cópia antes, em `copias.passada_identidade`, recusa rodar duas vezes) e SQL 59 (comparação, só leitura, 21 verificações com ok/DIVERGE/ATENÇÃO e ids de exemplo); SQL 57 separa nomes, referências e técnicas diferentes. → verificar: `teste:simulacao-tecnicas` (58 e 59 no PGlite com a passada do app, 7 sabotagens acusadas). → FEITO, nada rodado em produção.
    - T5d. 07/11: dono rodou o 57 (22 rolas, 1 plano, 4 metas; 31/3/4 nomes = referências; 9/3/4 técnicas) e o 58 (27 registros copiados, todos previstos); passada ligada no sync e publicada na main (`1dfed80`). → FEITO.
    - T5e. Falta: em 2 a 3 dias, rodar o 59 e o 57 (NEUROJITSU-COLAR); só depois, o SQL 56. Decidir à parte o S4 (janela de perda em `repararUmaVez`).
- Depois: `contra` no seed, assuntos.

## Trilha S: sync confiável entre aparelhos e entre contas (06/11/2026, antes das técnicas próprias)
Decidido em 06/11: corrigir antes de técnicas próprias. Causas e provas no relatório de 06/11 (técnicas próprias) e na resposta da sessão.
- S0. Reproduzir P2 com duas contas reais (SQL 53, rollback) → FEITO 06/11: conta B recusada pela RLS.
- S1. Fila que não trava: upsert em lote; se o lote falhar, um por um; o que falhou fica na fila com erro, tentativas e próxima tentativa; o resto sobe. Verificar: teste com um registro recusado no meio de vários. → FEITO (1c7443a).
- S2. Id por conta na nuvem para o que nasce igual em todo aparelho (posições, categorias, técnicas e planos prontos): id da linha = hash(conta + uid); o uid de verdade vai em dados.uid; a descida lê dados.uid. Linhas antigas continuam valendo. Sem SQL e sem afrouxar RLS. Verificar: duas contas marcando a mesma técnica, as duas sobem e cada uma só vê a sua. → FEITO (0f0b2fd).
- S3. Referência por uid na fronteira do sync: ao subir, cada campo de número local ganha o uid do registro apontado (sessionId → sessionUid, partnerId, academiaId, professorId, categoriaId, origemId, destinoId, techniqueId, posicaoId, vinculoId, focoTecnicas[].tecnicaId, settings academiaPadraoId e professorPadraoId); ao descer, o uid vira o número local daquele aparelho; o que chegar antes do registro apontado fica pendente e liga quando ele chegar. Verificar: cenário A (3 treinos, edita um, aparelho B com outra ordem) e categoria nova no meio da lista. → FEITO (dc58187); de quebra: biblioteca intocada do celular novo não ganha mais do progresso que vem da nuvem.
- S4. Reparo do que já está nos aparelhos, sem chute: rola fica no treino se a data bate; se não bate e há um só treino naquela data, liga nele; senão fica como está e é contado como incerto. Técnica da biblioteca volta à categoria e às posições do catálogo pelo uid. Parceiro sem prova fica como está (contado). Depois do reparo o aparelho sobe de novo o que consertou, já com os uids. → FEITO: simulação aprovada em 06/11 (12 rolas e 4 pontos com treino único; 19 rolas e 16 pontos com mais de um treino na data ficam como estão; 23 parceiros sem prova intocados). Ligado no sync, uma vez por aparelho.
- S5. Resumo semanal no servidor contando rolas pelo sessionUid (hoje compara com dados->>'id', que nunca sobe, e dá sempre zero). SQL com create or replace, sem apagar nada. → FEITO: SQL 55 rodado no Supabase em 06/11 (conferido: a função em produção já conta pela data do rola).
- Fora daqui: telas de técnica própria. Mas a técnica passa a ser referenciável pelo uid (S3), o que prepara referência permanente em plano, rola e meta.

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
- R2. Escapou: saída "ele escapou, reconstruo" que leva a uma peça de reorganização ou de volta a um ponto anterior. Defesa que não deixa continuação fecha o caminho, sem frase inventada. → FEITO em 05/11/2026. Escapou não é defesa. Defendeu: ele parou o golpe e você segue na posição que sustenta o ataque. Escapou: ele saiu do controle e a luta mudou de lugar. O golpe ganhou a terceira saída (`escapou`), que leva a uma peça nova, a situação (`tipo: 'situacao'`). O nome dela é a posição do catálogo onde a luta ficou (obrigatório: é o que separa fuga de defesa), e o gatilho dela é como ele escapou. Da situação sai "volto a atacar" (via `retoma`, golpe ou finta, quantos quiser), que é o primeiro continua no mesmo plano, atrás do mesmo objetivo; o que para antes do objetivo vira ponta solta como qualquer caminho. Situação sem caminho mostra "Daqui não tem ataque: o caminho fecha" e não é ponta solta: nada é inventado nem cobrado pra manter o mapa ligado. Situação nunca ganha bandeira, não entra no registro do rola (lá só golpe) nem no drill. "Voltar a um ponto anterior" (ligar a fuga a uma peça que já existe) ficou pro R3: hoje a situação aponta pra posição pelo nome, sem fio até a peça antiga. Testes: 22 casos novos em `scripts/teste-planos.mjs`; `scripts/teste-planos-visual.mjs` abre um plano com duas fugas em 360px e 700px, monta uma fuga nova pelo editor e guarda a captura do mapa inteiro.
- R3. Convergência: uma saída pode apontar pra uma peça que já existe (três preparações levam ao mesmo ataque sem repetir o cartão); no mapa, fio tracejado até ela. → FEITO em 05/11/2026. Ligação extra do plano: `ligacoes: [{ id, de, via, gatilho, para }]`, de e para pelo id da peça. Peça, ligação, gatilho e condição seguem separados: a peça de destino é uma só; a ligação é o caminho, com id permanente e o gatilho daquele caminho; a via é a condição da saída. No escapou o destino é um lugar (situação que já existe, ou a posição de onde começa com `para: null`: é o "voltar a um ponto anterior" que ficou do R2); nas outras saídas, golpe ou finta. A árvore continua sendo a arrumação e o caminho do rola; a ligação extra não entra nela, então retorno não vira laço na arrumação nem na leitura. Mudar o destino dá id novo (outro caminho); mudar o gatilho, arrastar ou renomear peça não muda id. Ligação que perde uma ponta vai pra `removidos.ligacoes`. Objetivo x fuga: a situação é o momento (ele saiu do controle e a luta veio pra cá), a posição é o lugar. Fuga que deixa a luta na posição do objetivo não conta: o objetivo é chegar com controle, então a bandeira fica na ação que estabelece o controle da posição; sem ela, a situação vira ponta solta com aviso próprio (e não "daqui não tem ataque"). Pro R7: o caminho do rola vai poder listar id de ligação extra; `ligacoesDo(passos, ligacoes)` e `removidos.ligacoes` já resolvem as duas pontas de qualquer id. Testes: 35 casos novos em `scripts/teste-planos.mjs` (3 entradas num golpe, retorno pra posição e pra situação, ciclo, inválidas, exclusão, finta tirada, arrastar, renomear, recarregar, rola antigo, plano antigo, objetivo, 2000 peças com 1000 atalhos em ~30ms); `scripts/teste-planos-visual.mjs` abre o plano de convergência em 360px e 700px, liga e desliga um caminho pelo editor, transforma uma fuga repetida em ligação e confere os ids salvos.
- R4. Objetivo em dois níveis: principal (finalizar, posição, raspagem, passagem) + finalização preferida + as aceitas. A bandeira forte vai na preferida, a fraca nas aceitas. → FEITO em 05/11/2026. No finalizar: `finalizacaoPreferida` e `finalizacoesAceitas` (nomes do catálogo, opcionais). Sem lista, qualquer finalização serve; com lista, só elas chegam, a preferida com bandeira forte; outra finalização acaba a luta sem bandeira. O cartão é a tentativa; chegada é `encaixou` na peça (`alcancouObjetivo`, pro R7). Antes, o teste pedido do R3: `caminhoDoRola` distingue a entrada (finta A, B ou C) depois da convergência, com salvar, recarregar, apagar e religar a ligação. Ficou de fora: agrupar variações ("Armlock" valendo pra qualquer armlock do catálogo); hoje cada variação é uma técnica e entra na lista uma por uma.
  Ajuste de 05/11/2026: a lista é preferência, não proibição. No Finalizar, qualquer finalização que encaixa alcança o objetivo; `escolhaDaFinalizacao` separa preferida, aceita e outra (bandeira forte só na preferida; a de fora com etiqueta "fora da lista"). Objetivo golpe específico: só ele conta.
- R4.1. Famílias de finalização → FEITO em 05/11/2026 (tarefas 1 a 4; falta colar o SQL 52). Pendentes sem dado no catálogo: Katagatame de lapela, Texas cloverleaf. Levantamento em NEUROJITSU-RELATORIOS/2026-11-05-r4-1-familias-levantamento.md. Critério: sinônimo, variação, família (mesma mecânica, id `fam:*` permanente), relacionada (só anotada) e posição (sai da finalização). Objetivo pode ser Finalizar, Família ou Técnica; preferida e "Também vale" aceitam família, sem repetir variação já coberta. Levantamento: 113 finalizações no seed (41+ estrangulamentos, 39 articulares, 11 de perna), cada uma com `pt`, `en`, `antigo`, `from` (posição de origem) e `cat`; a busca já usa pt + en + antigo como sinônimos. Não existe ligação entre variações. Estrutura proposta: tabela `FAMILIAS` à mão (id, nome, sinônimos, mecanismo) e um campo `familia` explícito em cada técnica do seed que pertence a ela; nada por palavra parecida. No plano, preferida e aceitas aceitam técnica ou família; família grava com id próprio (`fam:armlock`), porque "Kimura", "Triângulo", "Omoplata", "Guilhotina" e "Mata-leão" já são nomes de técnica (a variação da guarda fechada ou das costas) e não podem virar família pelo nome.
  Decisões de 05/11 (2ª rodada): Short choke e Estrangulamento de braço em X têm os dados iguais aos de Mata-leão de uma mão só e Cruzada da montada: juntam (uid antigo segue achando). Tarikoplata na Kimura. Katagatame de lapela e Texas cloverleaf pendentes. Backside 50/50 vira posição (Guardas e posições, 50/50 pra 50/50). Categoria nova Compressões: Cadeira elétrica (finalização), Banana split, Calf slicer.
  Tarefas:
  1. Catálogo: `src/lib/familias.js` (14 famílias, id `fam:*`), campo `fam` no seed, juntar as 2 duplicatas (juntou + RENOMEAR + renomeou_v6), arrumarBiblioteca v2 (Compressões, Backside 50/50). → verificar: teste-familias (todo `fam` existe, só em finalização, uids antigos acham), teste-renomeios.
  2. Compressões no app: lista única de categorias de finalização (rola, metas, domínio, regras, vocab/IA, motor). → verificar: teste-motor (defesa de compressão não recebe aula de chave de perna), teste-vocab.
  3. Plano: objetivo Família, preferida e "Também vale" com família, sem repetição (exceção: preferida técnica + família aceita). → verificar: teste-planos (R4.1), planos antigos e 16 prontos.
  4. Tela: seletor com "Família inteira", chips "Qualquer armlock", textos. → verificar: lint:copy, check, prints 360/700.
  Famílias confiáveis (mecanismo igual, só muda a posição):
  - Armlock (extensão do cotovelo; sinônimos chave de braço, armbar, juji gatame): da guarda fechada, da montada, dos 100kg, das costas, invertido, voador em pé, do triângulo, do crucifixo, da guarda aberta, da borboleta, da tartaruga, do joelho na barriga, giratório, sentado, Helicóptero.
  - Kimura (ombro, rotação interna): Kimura, dos 100kg, da meia-guarda, da tartaruga, do norte-sul, em pé, de lapela.
  - Americana (ombro, rotação externa; keylock): Americana, da montada, da guarda.
  - Omoplata (ombro com a perna): Omoplata, da borboleta, em pé.
  - Triângulo (estrangulamento com as pernas): Triângulo, da montada, invertido.
  - Guilhotina: Guilhotina, de braço dentro, alta, de dez dedos, em pé.
  - Mata-leão: Mata-leão, com body triangle.
  - Katagatame (braço e cabeça; arm triangle): dos 100kg, da montada, da meia-guarda.
  - Ezequiel: Estrangulamento Ezequiel, de baixo, de lapela por trás.
  - Cruzada (cross collar): Estrangulamento cruzado, Cruzada da montada, de lapela cruzada por baixo.
  - Chave de pé reta: botinha, da 50/50.
  - Heel hook: interno, externo.
  - Kneebar: Chave de joelho, da meia-guarda.
  - Chave de pulso: da guarda, por cima, Mão de vaca.
  Casos ambíguos (ficam fora até decidir): Marcelotine (guilhotina de cotovelo alto, entra na Guilhotina?); Mata-leão de uma mão só (en "Short choke") x "Short choke" (outra técnica com o mesmo nome em inglês: duplicada ou diferente?); Katagatame de lapela (usa a lapela, é katagatame?); Estrangulamento de braço em X (cruzada?); Chave de tornozelo do single leg X (chave de pé reta?); Backside 50/50 (é posição; a finalização é heel hook?); Kimura trap (é sistema de controle, não uma finalização); Monoplata, Baratoplata, Tarikoplata (nome parecido com omoplata, mecânica diferente: avulsas); Mir lock (americana ou chave de pulso?); Estrangulamento de perna das costas (triângulo?); Cadeira elétrica (está como articular, mas é finalização de perna/virilha). Brabo e Anaconda: mecânica parecida, ficam avulsas.
  Pergunta aberta: o objetivo "golpe específico" também pode ser uma família (objetivo Armlock = qualquer armlock), ou só técnica?
- R5. Preparação como peça própria (pegada, desequilíbrio, ajuste de pressão), separada da finta.
- R6. Os 16 prontos reescritos nesse modelo (itens 5 e 6 de cima): nome do catálogo, objetivo, descrição em português de tatame.
- R7. Registro no rola pelo caminho: finta usada, reação provocada, ataque, defesa, chegou ou não. Taxa por etapa, só com dado real do atleta, e com aviso quando há poucas tentativas.
  Decisão de 05/11/2026: plano e registro de treinos/rolas são dois sistemas distintos; o registro já existia e não se recria campo, estatística nem registro. Até o R6, nenhuma integração nova, só preservar ids de peça e ligação, `removidos` e histórico. No R7, ANTES de codar: levantamento completo do registro de rola atual e proposta de integração pra aprovar. A integração precisa separar planejado × executado, reações, caminho percorrido, improviso (oportunidade fora do plano) e objetivo alcançado. Duas entradas (escolher o plano no registro do rola; "registrar uso" a partir do mapa) gravam no mesmo registro, sem duplicar. Já existe hoje: `r.plano = { uid, peca, caminho, encaixou }` no rola, `taxaDoPlano`, `taxaPorTipo`, `rodizio` e o drill do plano.
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


