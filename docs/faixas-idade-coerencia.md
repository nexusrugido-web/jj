# Faixas por idade e coerência dos dados — 29/09/2026

## Referência e decisão

Fonte primária: [sistema de graduação IBJJF](https://ibjjf.com/graduation-system), PDF de junho de 2026 disponível na página. A idade competitiva é o ano corrente menos o ano de nascimento. O NeuroJitsu continua aceitando contas a partir de **8 anos**, decisão de produto já presente em `src/lib/idade.js`; isso não altera o mínimo de 4 anos da tabela federativa.

| Idade competitiva | Faixas disponíveis |
| --- | --- |
| 8–9 | branca, cinza, amarela |
| 10–12 | branca, cinza, amarela, laranja |
| 13–15 | branca, cinza, amarela, laranja, verde |
| 16–17 | branca, azul, roxa |
| 18 | branca, azul, roxa, marrom |
| 19+ | branca, azul, roxa, marrom, preta |

Cinza, amarela, laranja e verde têm três variantes cada: com centro branco, lisa e com centro preto. A preta aos 18 é exceção restrita ao campeão mundial adulto de marrom no sistema IBJJF; o seletor comum começa aos 19. A academia/professor concede a graduação; o app não promove o aluno automaticamente nem reescreve graduações antigas quando a idade muda. Aos 16, a troca das faixas infantis por azul ou roxa depende da graduação efetivamente concedida.

## Fluxo implementado

- `src/lib/faixas.js` é a fonte única de nomes, cores, variantes, ordem relativa e idades. Os cinco IDs adultos permanecem iguais, preservando registros e integração com Supabase. `perfil.faixa` já é `text`; não há migração SQL para os novos IDs.
- O onboarding já perguntava o ano antes da faixa. Agora usa esse ano para filtrar as opções e validar a etapa. Ajustes também filtra, e avisa se um perfil antigo tiver faixa incompatível ou ano ausente. Nenhum dado antigo é convertido em segredo.
- Conquistas sugere a próxima faixa que cabe na idade, deixa registrar uma graduação histórica segundo a idade na data e só atualiza a faixa atual se o usuário marcar essa intenção. A figura da graduação representa o centro das faixas infantis.
- Faixa visual, selo, gráfico de rolas por faixa, pesos de parceiro nas técnicas, quiz, aula recomendada, sugestões, metas e texto da semana recebem o novo vocabulário. O conteúdo de estudo ainda é curado nos cinco níveis originais; para criança, o nível usado na seleção é o de fundamentos, preservando a faixa real no perfil e nos registros.
- Campeonato já usa a idade para divisão infantil/juvenil e duração; a Liga mantém sua divisão própria, separada da faixa esportiva. XP, patentes/divisões da Liga e ofensiva semanal não mudam.

## Varredura de coerência: limites reais

| Entrada | Consumo verificado | Observação |
| --- | --- | --- |
| Ano de nascimento | onboarding, Ajustes, regras de técnica, competição, faixa permitida e graduação datada | Fica no aparelho. O Supabase não recebe esse campo pelo perfil público; a faixa compartilhada é autodeclarada. |
| Faixa atual | perfil público, visual, régua técnica, rolas por faixa, estudo, quiz e regras | A faixa não é a divisão da Liga. Uma faixa infantil histórica aos 16 anos requer confirmação da nova graduação; o app avisa e preserva o registro. |
| Faixa do parceiro | rolas, estatísticas, peso da evidência técnica | Parceiros não têm ano de nascimento no cadastro. A lista oferece todas as faixas sem inferir a idade do parceiro. |
| Graduações | histórico, faixa atual opcional, régua das técnicas, figurinha | Uma graduação passada não deve sobrescrever a faixa atual. |

### Próximas verificações de produto

1. Decidir se o cadastro de parceiros deve ter ano de nascimento **opcional** para filtrar as faixas. Hoje faltam dados para isso, então filtrar automaticamente seria um palpite.
2. Fazer curadoria de aulas e perguntas próprias para crianças. O fallback de fundamentos evita lista vazia, mas não certifica que todo conteúdo do acervo seja adequado à idade. A classificação técnica legal permanece em `src/lib/regras.js`.
3. Se houver atletas de 18 anos na exceção da preta, permitir registro manual documentado; o seletor padrão segue o mínimo comum de 19. Faixas coral e vermelha exigem modelo separado de graus e tempo de faixa antes de serem adicionadas.
4. Revalidar periodicamente as regras de técnicas da IBJJF/CBJJ: são um conjunto diferente da tabela de graduação e o módulo atual informa fonte de 2025.

Validação automatizada: `npm run teste:faixas` cobre limites de idade, graduação, restrição técnica e rolas com faixa infantil. `npm run check` cobre o restante do app. `npm run teste:faixas-visual` usa Chrome para verificar a tela de 13 anos em Android emulado e desktop e salva capturas em `artifacts/faixas/`. A migração semanal do Supabase aprovada anteriormente não é alterada.
