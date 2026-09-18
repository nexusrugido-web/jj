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
-> destaque.sql -> admin2.sql -> links.sql -> webhook.sql
```

Se você já rodou os anteriores, agora é só o `webhook.sql`.

## 2. Importar o fluxo

No n8n: **Workflows → Import from File →** `hotmart.json`.

## 3. As três variáveis

No n8n, em **Settings → Variables** (ou no `.env` se for n8n auto-hospedado):

| Nome | Onde achar |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE` | Supabase → Settings → API → `service_role` |
| `HOTMART_HOTTOK` | Hotmart → Ferramentas → Webhook → o token que ela te dá |

**A `service_role` passa por cima de todas as regras do banco.** Ela só pode
existir aqui dentro do n8n. Nunca no app, nunca no navegador, nunca commitada.

O `HOTMART_HOTTOK` é o que impede qualquer pessoa de mandar uma compra falsa
pro seu webhook e liberar acesso pra si mesma. Sem ele, a porta fica aberta.

## 4. Apontar a Hotmart

Ativa o fluxo no n8n e copia a URL de produção do nó de webhook. Ela termina
em `/webhook/hotmart`.

Na Hotmart: **Ferramentas → Webhook → Cadastrar**, cola a URL e marca os
eventos:

- `PURCHASE_APPROVED`
- `PURCHASE_COMPLETE`
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
