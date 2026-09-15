# Tatame OS, Jiu-Jitsu

Sistema pessoal de evolução em Jiu-Jitsu. PWA offline-first com nuvem opcional, IA e vídeo.

**v7.0**, a reforma grande. Ataque e defesa separados, graus por técnica, metas com origem explícita, recomendações por intenção e linguagem revisada de ponta a ponta.

## O que mudou na v7

**Ataque e defesa nunca mais se misturam.** Antes, levar uma americana derrubava o número da sua americana. Isso era errado: sofrer uma técnica não é uma tentativa falhada dela, é um buraco de defesa. Agora o que você aplica sobe o grau da técnica, e o que você leva vai pra uma lista própria.

**Graus em vez de nomes inventados.** Cada técnica tem uma ponteira de quatro graus, igual à da faixa. Sobe porque apareceu nos seus treinos, e a régua fica mais alta conforme a sua faixa.

**Drill não conta como domínio.** Cada rola agora carrega o contexto: drill, posicional, rola ou competição. Drilar coloca a técnica no 1º grau e para por aí. Encaixar contra resistência é o que faz ela subir.

**Dois caminhos pro 3º grau.** Funcionar em gente diferente prova que a técnica não depende de um corpo específico. Continuar funcionando em quem já conhece a sua entrada prova refinamento, porque a resistência subiu. O app aceita os dois e não exige um pelo outro.

**Sem taxa de acerto.** O app não sabe quantas vezes você tentou e não saiu. Então ele não inventa porcentagem, mostra quantas vezes funcionou e contra quem.

**Metas com origem.** Nada aparece como sua meta sem você aceitar. Sugestão fica na aba de sugestões, não conta progresso e não cobra nada.

**Linguagem revisada.** Sem travessão, sem jargão estatístico na tela, sem pergunta retórica. As mensagens mudam conforme a faixa: o mesmo dado gera texto diferente pra branca e pra marrom. Tem um linter no projeto que falha se algo escapar (`npm run lint:copy`).

## Deploy

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/nexusrugido-web/jj.git
git push -u origin main --force
```

Importe o repositório na Vercel. Ele detecta Vite sozinho.

### Nuvem (opcional)

1. Crie um projeto no supabase.com
2. SQL Editor, cole `supabase/schema.sql`, Run
3. Storage, confirme o bucket `tatame` privado
4. Authentication, Providers, ative Email e Google
5. Authentication, URL Configuration: Site URL do Vercel e Redirect URLs com `/**`
6. Vercel, Environment Variables:

| Nome | Onde achar |
|---|---|
| `VITE_SUPABASE_URL` | Supabase, Settings, API |
| `VITE_SUPABASE_ANON_KEY` | a chave anon public |
| `GROQ_API_KEY` | console.groq.com |

A `GROQ_API_KEY` não tem prefixo `VITE_` de propósito: ela fica no servidor, dentro de `/api/ia`, e o navegador nunca vê. A `service_role` do Supabase não é usada em lugar nenhum e nunca deve ir pro frontend.

## Antes de cada deploy

```bash
npm run check
```

Roda cinco verificações em sequência: copy sem jargão nem travessão, nenhuma importação circular
no código, build limpo, nenhum ciclo entre os arquivos gerados, e o app montando de verdade num
DOM simulado. Se qualquer uma falhar, não suba.

## Rodar local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sem `.env.local` funciona igual, só sem nuvem e sem IA.

## Os módulos

| Módulo | O que faz |
|---|---|
| Painel | Streak, tatame, o que treinar agora, calendário do mês, evolução |
| Treinos e rolas | Técnicas da aula com peguei/mais ou menos/não peguei, rolas com pontos IBJJF, contexto de resistência, parceiro, peso relativo, posição inicial e anotação |
| Técnicas | 626 técnicas com nome em português e inglês, busca, criação com IA |
| Planos de ataque | 16 planos prontos por faixa, com o grau de cada passo e o elo mais fraco apontado |
| Minhas técnicas | Os graus, o que falta pro próximo, onde você apanha, o que treinar agora |
| Meu jogo | Estilo detectado dos seus pontos, radar, taxa de vitória por faixa |
| Metas | Suas metas, sugestões separadas, concluídas |
| Análise | Calendário do ano, gráfico de evolução por período e métrica, escada posicional |
| Revisão | Repetição espaçada |
| Conquistas | Marcos reais e registro de graduação |
| Academia, Nutrição, Respiração, Físico, Lesões, Parceiros, Competições | Módulos de apoio |

## Como o grau é calculado

O que conta: encaixar no posicional, na rola ou em competição. Quanto mais resistência, mais peso. A faixa e o peso do parceiro entram como multiplicador.

O que conta só pro 1º grau: drill.

O que não conta: ter levado a técnica. Isso vai pra Onde você apanha e nunca derruba o seu grau.

| Grau | Significa |
|---|---|
| 1º | Você conhece o movimento |
| 2º | Funciona na rola |
| 3º | Faz parte do seu jogo |
| 4º | É a sua assinatura |

## Stack

React 18, Vite 6, Dexie, Supabase, Groq via Vercel Function, CSS puro com design tokens, service worker próprio. Gráficos em SVG escritos à mão.

## Aviso

Regras da IBJJF mudam de temporada, confirme no site oficial antes de competir. As orientações de treino, nutrição e recuperação são educativas e não substituem médico, nutricionista, educador físico ou o seu professor.
