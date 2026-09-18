# O fluxo da Hotmart

Este é o caminho que uma compra faz até virar acesso dentro do app:

```
Hotmart  ->  n8n  ->  Supabase  ->  app
```

O n8n faz duas coisas só: confere se quem chamou é mesmo a Hotmart, e entrega
o recado ao banco. **Quem decide o que a compra significa é o banco.**

Isso é de propósito. Regra de negócio dentro de ferramenta visual não tem teste,
não tem histórico e quebra calada: alguém arrasta um nó sem querer e ninguém
descobre até um cliente reclamar que pagou e não liberou.

---

## 1. Rodar o SQL

No SQL Editor do Supabase, na ordem:

```
schema.sql -> comunidade.sql -> assinatura.sql -> admin.sql -> xp.sql
-> aulas.sql -> aulas-carga.sql -> compra.sql -> liga.sql -> par.sql
-> destaque.sql -> admin2.sql -> links.sql -> webhook.sql -> recuperacao.sql -> n8n.sql
```

Se você já rodou os anteriores, agora é só o `webhook.sql`, o `recuperacao.sql` e o `n8n.sql`.

## 2. Importar o fluxo

No n8n: **Workflows → Import from File →** `hotmart.json`.

## 3. Os segredos

O n8n não usa variável de ambiente nenhuma. Ele chama o banco com a chave
pública do app, e cada função do `n8n.sql` confere um segredo guardado na
tabela `n8n_segredo`, que ninguém de fora consegue ler:

| Segredo | Quem manda |
|---|---|
| `hottok` | a Hotmart, em toda chamada |
| `chave` | o fluxo de recuperação (está dentro do `recuperacao.json`) |
| `evogo_url` e `evogo_token` | o endereço e o token da instância do Evolution Go |

No repositório o `recuperacao.json` vem com `__CHAVE_N8N__` no lugar da chave.
Gere uma, coloque nos dois lugares e rode o `update` do fim do `n8n.sql`.

## 4. Apontar a Hotmart

Ativa o fluxo no n8n e copia a URL de produção do nó de webhook. Ela termina
em `/webhook/hotmart`.

Na Hotmart: **Ferramentas → Webhook → Cadastrar**, cola a URL e marca os
eventos:

- `PURCHASE_APPROVED`
- `PURCHASE_COMPLETE`
- `PURCHASE_OUT_OF_SHOPPING_CART` (abandono de carrinho)
- `PURCHASE_EXPIRED`
- `PURCHASE_REFUNDED`
- `PURCHASE_CHARGEBACK`
- `PURCHASE_DELAYED`
- `PURCHASE_CANCELED`
- `SUBSCRIPTION_CANCELLATION`
- `SWITCH_PLAN`

## 5. Ligar cada vídeo avulso ao produto dele

É este passo que faz a compra chegar no vídeo certo, e é o mais fácil de
esquecer.

No app: **Painel → Vídeos →** abre o vídeo → marca **Vendido à parte** →
preenche os dois campos:

- **Link de compra**: o checkout, que é pra onde a pessoa vai
- **Produto na Hotmart**: o id do produto, que é por onde a compra volta

Um sem o outro não funciona, e a lista do painel marca em vermelho qual está
faltando.

---

## Testar sem esperar uma venda

No SQL Editor, simulando uma assinatura:

```sql
select * from public.webhook_hotmart(
  'PURCHASE_APPROVED', 'seu@email.com', 'PRODUTO_DA_ASSINATURA', 'TESTE1');

select status, vence_em from public.assinatura where email_compra = 'seu@email.com';
```

E uma compra de vídeo avulso, depois de preencher o produto naquele vídeo:

```sql
select * from public.webhook_hotmart(
  'PURCHASE_APPROVED', 'seu@email.com', 'ID_DO_PRODUTO_DO_VIDEO', 'TESTE2');

select * from public.compra_aula;
```

A função devolve o que fez: `assinatura`, `avulso_liberado`, `avulso_pendente`
ou `ignorado`, com o motivo. É por aí que você descobre o que aconteceu sem
abrir o banco.

---

## O caso que quase todo mundo esquece

**A pessoa compra e só depois cria a conta.** Nesse momento o e-mail da compra
ainda não tem dono, e um sistema ingênuo simplesmente perde a venda.

Aqui a compra fica esperando na tabela `compra_pendente`, e é aplicada sozinha
no instante em que alguém cria conta com aquele e-mail. A função devolve
`avulso_pendente` quando isso acontece, então dá pra saber que é isso e não um
erro.

O mesmo já valia pra assinatura, pelo `ligar_compras_pendentes`.

---

# A recuperação de carrinho

Quem parou no checkout, deixou o Pix ou boleto vencer ou teve o cartão
recusado recebe mensagens no WhatsApp pelo Evolution Go. A sequência para
sozinha quando a pessoa compra, quando responde, ou quando as mensagens acabam.
Chargeback fica de fora.

Os textos, os tempos, o horário e o liga/desliga ficam no **Painel →
Recuperação**. O n8n não guarda texto nenhum: a cada 5 minutos ele pergunta ao
banco quem está na vez, manda e conta como foi. Mudou no painel, o próximo
envio já sai com o texto novo.

## 1. Importar e ativar

**Workflows → Import from File →** `recuperacao.json`, e ativa.

O fluxo tem duas portas:

- **A cada 5 minutos**: pega a fila e manda, uma mensagem a cada 8 segundos
  pra não parecer disparo em massa.
- **WhatsApp chama aqui** (`/webhook/evogo`): quando alguém responde, a
  sequência daquela pessoa para. Conversa com gente não pode levar mensagem de
  robô no meio.

## 2. Ligar as respostas

No fluxo, clique em **Clique aqui 1 vez** e execute. Ele aponta o webhook da
instância pro n8n, sem desconectar o WhatsApp.

## 3. Ligar

No **Painel → Recuperação**, coloque o seu número em **Testar**. Com a
recuperação ligada, a primeira mensagem chega em até 5 minutos, dentro do
horário configurado. O teste não entra nos números.

O cartão do topo mostra quando o n8n passou por último. Se passar de 15
minutos, ele avisa que o fluxo pode ter caído.

## Regras que o banco segue

- Uma sequência por pessoa e produto a cada 7 dias, por mais que a Hotmart
  mande o abandono várias vezes.
- Quem já é assinante ativo daquele produto não recebe.
- O atraso conta a partir do abandono, mas entre duas mensagens passam pelo
  menos 3 horas.
- Mensagem que falhou não é reenviada. O erro fica registrado.
- Comprou depois de receber pelo menos uma mensagem, conta como recuperado.
  Comprou antes, conta como "comprou antes" e fica fora da taxa.
- O link volta pro checkout do vídeo avulso, se o produto for um, ou pro link
  `assinatura_mensal` da aba Links, já com e-mail e nome preenchidos e
  `sck=recuperacao` pra venda aparecer marcada na Hotmart.
