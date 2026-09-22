import webPush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

/* ============================================================
   NOTIFICAR

   Chamada de hora em hora pelo pg_cron. Nao decide nada: quem
   escolhe quem recebe e o que cada um le e a fila_de_notificacao
   no banco (supabase/notificacoes.sql). Aqui so assina e entrega.

   O MESMO JSON SERVE PROS DOIS MUNDOS

   O campo "web_push": 8030 liga o Declarative Web Push. No iOS
   18.4 pra cima e no Safari 26 o sistema monta a notificacao
   sozinho, sem passar pelo nosso service worker: se o sw.js
   tiver um erro, a notificacao aparece do mesmo jeito.

   O Chrome ainda nao entende esse campo. Ele entrega o payload
   cru no evento push, e o nosso sw.js le o mesmo objeto e monta
   a notificacao na mao. Um formato so, o melhor comportamento
   de cada lado.

   ISTO NAO E SQL. Nao cola no SQL Editor.

   Deploy pelo painel, sem instalar nada:
     Edge Functions -> Deploy a new function -> Via Editor
     nome: notificar, cola este arquivo inteiro, Deploy

   Os segredos ficam em Edge Functions -> Secrets:
     VAPID_PUBLICA, VAPID_PRIVADA, VAPID_CONTATO

   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nao precisam ser
   configurados: o Supabase injeta os dois sozinho.

   Pela CLI, se um dia preferir:
     supabase secrets set VAPID_PUBLICA=... VAPID_PRIVADA=...
     supabase functions deploy notificar
   ============================================================ */

const url = Deno.env.get('SUPABASE_URL')!;
const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publica = Deno.env.get('VAPID_PUBLICA')!;
const privada = Deno.env.get('VAPID_PRIVADA')!;
const contato = Deno.env.get('VAPID_CONTATO') ?? 'mailto:contato@neurojitsu.app';

webPush.setVapidDetails(contato, publica, privada);

const site = Deno.env.get('SITE_URL') ?? 'https://jj-theta-eight.vercel.app';

Deno.serve(async (req) => {
  const db = createClient(url, chave);

  /* {"teste": "<user_id>"} pula todas as regras e manda um aviso
     pros aparelhos daquela pessoa. E o que o testar_aviso() do
     banco usa pra a gente ver a notificacao sem esperar a hora. */
  let teste: string | null = null;
  try { teste = (await req.json())?.teste ?? null; } catch { teste = null; }

  const { data: fila, error } = await db.rpc('fila_de_notificacao', { p_teste: teste });
  if (error) {
    console.error('[notificar] fila', error);
    return new Response(JSON.stringify({ erro: error.message }), { status: 500 });
  }
  if (!fila?.length) {
    return Response.json({ enviados: 0, fila: 0 });
  }

  const resultados = await Promise.all(
    fila.map(async (l: Record<string, string | number>) => {
      const corpo = JSON.stringify({
        web_push: 8030,
        notification: {
          title: l.titulo,
          body: l.corpo,
          lang: 'pt-BR',
          dir: 'ltr',
          /* navigate e obrigatorio no formato declarativo, e e
             pra onde o toque leva */
          navigate: `${site}${l.caminho}`,
          silent: false,
          app_badge: String(l.emblema ?? 1),
          /* o tag faz a nova substituir a anterior do mesmo tipo
             em vez de empilhar duas na bandeja */
          tag: String(l.tipo),
        },
      });

      try {
        await webPush.sendNotification(
          {
            endpoint: String(l.endpoint),
            keys: { p256dh: String(l.p256dh), auth: String(l.auth) },
          },
          corpo,
          { TTL: 6 * 60 * 60, contentEncoding: 'aes128gcm' },
        );
        return { ok: true, user_id: l.user_id, tipo: l.tipo, dia: l.dia, endpoint: l.endpoint };
      } catch (e) {
        /* 404 e 410 sao aparelho que nao existe mais. O banco
           apaga a inscricao; qualquer outro erro so conta falha. */
        const codigo = (e as { statusCode?: number }).statusCode ?? 0;
        console.error('[notificar]', codigo, (e as Error).message);
        return { ok: false, codigo, user_id: l.user_id, tipo: l.tipo, dia: l.dia, endpoint: l.endpoint };
      }
    }),
  );

  /* o teste nao entra no historico: senao sujaria a conta de
     quantos avisos a pessoa ignorou, que e o que decide quando
     parar de mandar */
  if (!teste) {
    const { error: erroMarca } = await db.rpc('marcar_notificacao', { p_linhas: resultados });
    if (erroMarca) console.error('[notificar] marcar', erroMarca);
  }

  return Response.json({
    fila: fila.length,
    enviados: resultados.filter((r) => r.ok).length,
  });
});
