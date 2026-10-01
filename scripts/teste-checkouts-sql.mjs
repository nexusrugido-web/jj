import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';

/* ============================================================
   DOIS CHECKOUTS (SQL 42)

   A porta da Getfy confere o token, traduz cada evento pro formato
   da Hotmart e entrega pro mesmo processamento. Aqui o
   processamento é trocado por um gravador, pra conferir a tradução:
   o processamento em si é o mesmo código que já roda pra Hotmart.
   ============================================================ */
const pg = new PGlite();
await pg.exec(`
  create role anon; create role authenticated;
  create schema auth; create table auth.users(id uuid primary key, email text);
  create table public.n8n_segredo(id int primary key default 1, hottok text, chave text, evogo_url text, evogo_token text);
  insert into public.n8n_segredo(id, hottok) values (1, 'hot-123');
  create table public.link(chave text primary key, nome text, descricao text, grupo text, ordem int, fixo boolean, url text);
  insert into public.link(chave, url) values ('assinatura_mensal', 'https://pay.hotmart.com/X');
  create table public.aula(id text, produto_hotmart text, checkout_url text);
  create table public.assinatura(id bigserial primary key, user_id uuid, email_compra text, transacao text,
    codigo_assinante text, plano text, status text default 'ativa', vence_em timestamptz, cancelada_em timestamptz,
    origem text default 'hotmart', criado_em timestamptz default now());
  create function public.uri(p text) returns text language sql immutable as $$ select replace(p, ' ', '%20') $$;
`);
const sql = await fs.readFile(new URL('../supabase/42-dois-checkouts.sql', import.meta.url), 'utf8');
await pg.exec(sql);
await pg.exec(sql); // reexecução segura

/* o processamento vira um gravador */
await pg.exec(`
  create table public.recebido(corpo jsonb);
  create or replace function public.processar_venda(p_corpo jsonb)
  returns table (feito text, detalhe text) language plpgsql as $$
  begin
    insert into public.recebido values (p_corpo);
    if p_corpo ->> 'event' = 'PURCHASE_APPROVED' then
      insert into public.assinatura(email_compra, transacao, codigo_assinante)
      values (p_corpo #>> '{data,buyer,email}', p_corpo #>> '{data,purchase,transaction}', p_corpo #>> '{data,subscription,subscriber,code}');
    end if;
    return query select 'processado'::text, (p_corpo ->> 'event')::text;
  end $$;
  update public.n8n_segredo set getfy = 'getfy-segredo' where id = 1;
`);

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};
const getfy = async (token, corpo) => (await pg.query('select * from public.n8n_getfy($1, $2)', [token, JSON.stringify(corpo)])).rows[0];
const ultimo = async () => (await pg.query('select corpo from public.recebido order by ctid desc limit 1')).rows[0].corpo;

const cliente = { email: 'Aluno@Teste.com', name: 'Aluno Teste', phone: '5571999998888' };
const produto = { id: 7, name: 'NeuroJitsu Premium' };

let erro = null;
try { await getfy('Bearer errado', { event: 'pedido_pago', payload: {} }); } catch (e) { erro = e.message; }
ok('token errado: recusa', /token da getfy invalido/.test(erro || ''), true);

ok('evento de teste da Getfy', (await getfy('Bearer getfy-segredo', { event: 'webhook.test', payload: {} })).feito, 'teste');

await getfy('Bearer getfy-segredo', {
  event: 'pedido_pago',
  payload: { order: { id: 501, amount: 29.9, currency: 'BRL', status: 'completed' }, customer: cliente, product: produto,
    subscription_plan: { name: 'Mensal', interval: 'monthly' }, payment: { method: 'pix_auto' }, tracking: { utm_source: 'instagram' } },
});
let c = await ultimo();
ok('pedido pago vira compra aprovada', c.event, 'PURCHASE_APPROVED');
ok('com e-mail, produto e transação da Getfy', [c.data.buyer.email, c.data.product.id, c.data.purchase.transaction], ['aluno@teste.com', 'getfy:7', 'getfy:501']);
const dias = Math.round((Number(c.data.purchase.date_next_charge) - Date.now()) / 86400000);
ok('mensal vence em ~1 mês + 2 dias de folga', dias >= 30 && dias <= 34, true);
ok('a origem do link conta (utm)', c.data.purchase.origin.src, 'instagram');
ok('a assinatura fica marcada como da Getfy', (await pg.query("select origem from assinatura where transacao = 'getfy:501'")).rows[0].origem, 'getfy');

await getfy('Bearer getfy-segredo', {
  event: 'pedido_pago',
  payload: { order: { id: 502, amount: 297 }, customer: cliente, product: produto, subscription_plan: { name: 'Anual', interval: 'annual' } },
});
c = await ultimo();
const diasAnual = Math.round((Number(c.data.purchase.date_next_charge) - Date.now()) / 86400000);
ok('anual vence em ~1 ano', diasAnual >= 365 && diasAnual <= 369, true);

await getfy('Bearer getfy-segredo', {
  event: 'assinatura_renovada',
  payload: { subscription: { id: 90, status: 'active', current_period_end: '2026-11-30', access_until: '2026-11-30' }, customer: cliente, product: produto },
});
c = await ultimo();
ok('renovação: reativa até o fim do período', [c.event, new Date(Number(c.data.purchase.date_next_charge)).toISOString().slice(0, 10)], ['SUBSCRIPTION_REACTIVATION', '2026-12-01']);
ok('renovação tem id próprio por período', c.id, 'getfy:assinatura_renovada:90:2026-11-30');

const mapa = {
  assinatura_cancelada: 'SUBSCRIPTION_CANCELLATION', assinatura_em_atraso: 'PURCHASE_DELAYED', reembolso: 'PURCHASE_REFUNDED',
  carrinho_abandonado: 'PURCHASE_OUT_OF_SHOPPING_CART', pix_gerado: 'PURCHASE_BILLET_PRINTED', pagamento_recusado: 'PURCHASE_EXPIRED',
  pedido_cancelado: 'PURCHASE_EXPIRED', pedido_pendente: 'GETFY_PEDIDO_PENDENTE',
};
const vistos = {};
for (const [ev, esperado] of Object.entries(mapa)) {
  await getfy('Bearer getfy-segredo', { event: ev, payload: { order: { id: 600 }, checkout_session: { id: 3 }, customer: cliente, product: produto } });
  vistos[ev] = (await ultimo()).event;
}
ok('cada evento da Getfy vira o da Hotmart', vistos, mapa);

ok('carrinho da Getfy volta pro checkout da Getfy (sem link: assinatura)',
  (await pg.query("select public.recuperacao_link('a@b.com', 'A', 'getfy:7', 'carrinho', null, null) as l")).rows[0].l.startsWith('https://pay.hotmart.com/X'), true);
await pg.exec("update public.link set url = 'https://app.uselumnis.com/c/neuro' where chave = 'checkout_getfy'");
ok('com o link da Getfy no painel, volta pra ele',
  (await pg.query("select public.recuperacao_link('a@b.com', 'A', 'getfy:7', 'carrinho', null, null) as l")).rows[0].l.startsWith('https://app.uselumnis.com/c/neuro?email=a%40b.com'.replace('%40', '@')), true);
ok('carrinho da Hotmart continua indo pra Hotmart',
  (await pg.query("select public.recuperacao_link('a@b.com', 'A', '12345', 'carrinho', null, null) as l")).rows[0].l.startsWith('https://pay.hotmart.com/X'), true);

let erroHot = null;
try { await pg.query("select * from public.n8n_hotmart('errado', '{}')"); } catch (e) { erroHot = e.message; }
ok('a porta da Hotmart continua conferindo o hottok', /hottok invalido/.test(erroHot || ''), true);
ok('e com o hottok certo, processa igual', (await pg.query("select * from public.n8n_hotmart('hot-123', '{\"event\":\"PURCHASE_APPROVED\",\"data\":{}}')")).rows[0].feito, 'processado');

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
