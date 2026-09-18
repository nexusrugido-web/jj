/* Vercel Function — /r/<codigo>
   O link curto que vai na bio, no Reels, na descricao do video e
   na mensagem de recuperacao. Conta o clique e manda a pessoa pro
   checkout da Hotmart ja com a origem marcada (sck, src, UTMs).

   Quem decide pra onde vai e o banco (link_destino, vendas.sql).
   Aqui so pergunta, e nao conta clique de robo: o WhatsApp, o
   Instagram e o Facebook abrem o link sozinhos pra montar a
   previa, e isso nao e gente clicando.

   A chave abaixo e a publica do app, a mesma que ja vai no site.
*/

const URL_BANCO = process.env.VITE_SUPABASE_URL || 'https://ddtdnufgafwotgdchedr.supabase.co';
const ANON = process.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdGRudWZnYWZ3b3RnZGNoZWRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Nzg1NDMsImV4cCI6MjEwMjU1NDU0M30.jiXwzxgWgjSsXm08LUexakM_pPiDkpDsqTv__zz9xvg';

/* previa de link e robo de busca. O navegador de dentro do
   Instagram e do Facebook e gente de verdade, entao nao entra. */
const ROBO = /^WhatsApp\/|facebookexternalhit|facebot|bot\b|bot\/|crawler|spider|preview|slack|discord|telegram|embedly|curl|wget|python|headless/i;

export default async function handler(req, res) {
  const codigo = String(req.query.c || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 48);
  const robo = ROBO.test(String(req.headers['user-agent'] || ''));

  let destino = null;
  if (codigo.length >= 2) {
    try {
      const r = await fetch(`${URL_BANCO}/rest/v1/rpc/link_destino`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_codigo: codigo, p_contar: !robo }),
      });
      if (r.ok) destino = await r.json();
    } catch (e) {
      console.error('[r]', e);
    }
  }

  /* so manda pra endereco seguro. Link que nao existe cai no app. */
  const ok = typeof destino === 'string' && /^https:\/\//.test(destino);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', ok ? destino : '/');
  res.status(302).end();
}
