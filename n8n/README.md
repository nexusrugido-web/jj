# Hotmart, WhatsApp, banco e app

```
Hotmart  ->  n8n  ->  Supabase  ->  app
                        |
Evolution Go  <-  n8n  -+   (mensagens e avisos no WhatsApp)
```

O n8n só leva recado. **Quem decide tudo é o banco**: se a venda gera acesso,
quem recebe mensagem, quando, com qual texto, e de onde a venda veio.

Isso é de propósito. Regra de negócio dentro de ferramenta visual não tem teste,
não tem histórico e quebra calada. No banco, cada regra tem nome, comentário e
pode ser testada.

---

## O que roda onde

| Arquivo | O que faz |
|---|---|
| `supabase/webhook.sql` | A porta da Hotmart: libera, renova e desfaz acesso |
| `supabase/recuperacao.sql` | As sequências de WhatsApp: carrinho, Pix pendente e renovação |
| `supabase/n8n.sql` | As portas que o n8n usa, cada uma conferindo um segredo |
| `supabase/vendas.sql` | O livro de eventos, os produtos, os links rastreados e a vigia |
| `n8n/neurojitsu.json` | O fluxo do n8n, com três entradas |
| `api/r.js` | O link curto `/r/<codigo>`, que conta o clique e manda pra Hotmart |

## 1. Rodar o SQL

No SQL Editor do Supabase, na ordem:

```
schema.sql -> comunidade.sql -> assinatura.sql -> admin.sql -> xp.sql
-> aulas.sql -> aulas-carga.sql -> compra.sql -> liga.sql -> par.sql
-> destaque.sql -> admin2.sql -> links.sql -> webhook.sql
-> recuperacao.sql -> n8n.sql -> vendas.sql -> estudo.sql
```

Todos podem rodar de novo sem apagar nada.

Depois, uma vez, os segredos (o fim do `n8n.sql` mostra o comando):

| Segredo | O que é |
|---|---|
| `hottok` | Hotmart → Ferramentas → Webhook |
| `chave` | Uma senha longa qualquer. A mesma vai no lugar de `__CHAVE_N8N__` no `neurojitsu.json` |
| `evogo_url` | O endereço do Evolution Go |
| `evogo_token` | Evolution Go → a instância → Token da Instância |

E pelo menos um número em `aviso_destino` (ou pelo painel, em Recuperação →
Ajustes) pra receber lead quente, alarme e venda.

## 2. O fluxo do n8n

Importe `neurojitsu.json` e ative. Ele não usa variável de ambiente: chama o
banco com a chave pública do app, e cada função confere o próprio segredo.

As três entradas:

- **Hotmart chama aqui** (`/webhook/hotmart`): manda o aviso inteiro pro banco.
- **A cada 5 minutos**: pega a fila (avisos pra você e mensagens de
  recuperação) e manda pelo Evolution Go, uma a cada 8 segundos.
- **WhatsApp chama aqui** (`/webhook/evogo`): manda a mensagem que chegou pro
  banco. Se for resposta de alguém em recuperação, a sequência para e você é
  avisado. "Sair", "parar" e parecidos bloqueiam o número pra sempre.

A instância do Evolution Go precisa apontar o webhook dela pro
`/webhook/evogo`, com o evento `MESSAGE`:

```bash
curl -X POST "$EVOGO_URL/instance/connect" \
  -H "Content-Type: application/json" \
  -H "apikey: TOKEN_DA_INSTANCIA" \
  -d '{ "webhookUrl": "https://n8n.nexusrugido.com/webhook/evogo", "subscribe": ["MESSAGE"], "immediate": true }'
```

Com a instância já conectada, isso só troca o webhook, não derruba a conexão.

## 3. Os eventos da Hotmart

Em **Ferramentas → Webhook**, a URL `https://n8n.nexusrugido.com/webhook/hotmart`
(sem `-test`) e todos estes eventos:

```
PURCHASE_APPROVED  PURCHASE_COMPLETE  PURCHASE_BILLET_PRINTED
PURCHASE_OUT_OF_SHOPPING_CART  PURCHASE_EXPIRED  PURCHASE_CANCELED
PURCHASE_DELAYED  PURCHASE_REFUNDED  PURCHASE_CHARGEBACK  PURCHASE_PROTEST
SUBSCRIPTION_CANCELLATION  SWITCH_PLAN
```

## 4. Os produtos

A Hotmart manda aviso de **todos os produtos da conta**, inclusive coprodução.
Só gera acesso ao app o que estiver marcado como NeuroJitsu em **Painel →
Vendas → Produtos**.

Produto novo chega como "esperando você": o aviso fica guardado, ninguém ganha
acesso, e você recebe um alarme no WhatsApp. Quando você classifica, o que
estava esperando é processado na hora, em ordem.

## 5. De onde vem a venda

A Hotmart **não devolve os UTMs** no aviso de venda. Devolve só `src`, `sck` e
`xcod`, em `data.purchase.origin`. Por isso todo link divulgado sai de
**Painel → Vendas → Links rastreados**: cada um leva a campanha no `sck`, o canal
no `src`, e os UTMs também (pro Analytics da Hotmart).

| Origem | sck | src |
|---|---|---|
| Link rastreado | o código da campanha | o canal (`instagram_reels`...) |
| Botão de assinar dentro do app | `app` | `app` |
| Mensagem de recuperação | `recuperacao` | de onde a pessoa tinha vindo antes |

O link curto (`/r/codigo`) conta o clique, menos os de robô: o WhatsApp e o
Instagram abrem o link sozinhos pra montar a prévia.

## 6. Acesso

- Pix ou boleto gerado **não** libera acesso. Só o pagamento.
- Renovação atrasada ganha 7 dias de folga, **só** pra quem já pagou antes.
- Evento que não mexe em acesso (troca de data de cobrança, abandono) fica só
  registrado.
- A mesma notificação chegando duas vezes conta uma vez só (pelo `id` do
  aviso).

## A vigia

A cada 5 minutos o próprio banco (pg_cron + pg_net) pergunta ao Evolution Go se
o WhatsApp está conectado, e confere se o n8n está passando. Se o n8n parar, o
aviso sai direto do banco pro Evolution Go, sem depender dele. O painel mostra
o estado do WhatsApp no topo da Recuperação.

## Conferir

```sql
select evento, email, valor, src, sck, processado from public.hotmart_evento order by criado_em desc limit 20;
select id, nome, tipo, eventos from public.produto_hotmart;
select email, fluxo, status, etapa, proximo_em from public.recuperacao order by id desc limit 20;
select * from cron.job;
```
