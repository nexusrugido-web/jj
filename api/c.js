/* Vercel Function — /c/<codigo>
   A pagina publica do card. Duas coisas ao mesmo tempo:

   1. pro WhatsApp, Instagram, X e Discord: as meta tags og: que
      eles leem pra montar a previa. E a previa que faz alguem
      parar de rolar a tela.

   2. pra gente: uma pagina que abre bonita e tem um botao que
      leva pro app.

   Nao e uma rota do React. Tem que ser HTML servido pelo
   servidor, porque robo de previa nao roda JavaScript: se isso
   fosse uma tela do app, o WhatsApp mostraria o titulo generico
   do index.html e o card nao serviria pra nada.

   A chave abaixo e a publica, a mesma que ja vai no site.
*/

const URL_BANCO = process.env.VITE_SUPABASE_URL || 'https://ddtdnufgafwotgdchedr.supabase.co';
const ANON = process.env.VITE_SUPABASE_ANON_KEY || '';
const SITE = process.env.SITE_URL || 'https://jj-theta-eight.vercel.app';

/* previa de link e robo de busca. O navegador de dentro do
   Instagram e do Facebook e gente de verdade, entao nao entra. */
const ROBO = /^WhatsApp\/|facebookexternalhit|facebot|bot\b|bot\/|crawler|spider|preview|slack|discord|telegram|embedly|curl|wget|python|headless/i;

const CORES = {
  branca: '#dfe7e3', azul: '#4a8bf0', roxa: '#9b6ef8', marrom: '#b8783f', preta: '#dfe7e3',
};

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/* O que a previa diz. E a unica coisa que a maioria vai ler:
   no WhatsApp o card aparece como duas linhas de texto. */
function contar(tipo, d) {
  const nome = d.nome || 'Um praticante';
  if (tipo === 'ofensiva') {
    const n = Number(d.dias) || 0;
    return {
      titulo: `${n} ${n === 1 ? 'dia seguido' : 'dias seguidos'} no tatame`,
      texto: `${nome} não falha um dia${d.recorde > n ? ` — o recorde dele é ${d.recorde}` : ''}. E você, quantos dias tem?`,
      numero: n,
      rotulo: n === 1 ? 'dia seguido' : 'dias seguidos',
    };
  }
  if (tipo === 'resumo') {
    return {
      titulo: `${d.horas || 0}h no tatame${d.periodo ? ` — ${d.periodo}` : ''}`,
      texto: `${nome}: ${d.treinos || 0} treinos, ${d.rolas || 0} rolas registradas${
        d.subiram?.length ? ` e ${d.subiram.length} técnicas que subiram de grau` : ''}.`,
      numero: d.horas || 0,
      rotulo: 'horas no tatame',
    };
  }
  return {
    titulo: esc(d.titulo) || 'Nova conquista',
    texto: `${nome} desbloqueou: ${d.texto || d.titulo || ''}`,
    numero: null,
    rotulo: '',
  };
}

function pagina(tipo, d) {
  const c = contar(tipo, d);
  const cor = CORES[d.faixa] || CORES.branca;
  const graus = '•'.repeat(Math.min(4, Number(d.graus) || 0));

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.titulo)} — NeuroJitsu</title>
<meta name="description" content="${esc(c.texto)}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="NeuroJitsu">
<meta property="og:title" content="${esc(c.titulo)}">
<meta property="og:description" content="${esc(c.texto)}">
<meta property="og:image" content="${SITE}/icon-512.png">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(c.titulo)}">
<meta name="twitter:description" content="${esc(c.texto)}">
<meta name="twitter:image" content="${SITE}/icon-512.png">
<meta name="theme-color" content="#0B0C0E">
<link rel="icon" href="${SITE}/favicon.png">

<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    min-height:100dvh;display:grid;place-items:center;padding:24px 16px;
    background:#0b0c0e;color:#eceef1;
    font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  }
  .card{
    width:100%;max-width:400px;position:relative;overflow:hidden;
    border-radius:22px;padding:28px 24px;
    border:1px solid color-mix(in srgb, ${cor} 28%, #262b31);
    background:
      radial-gradient(130% 100% at 50% -20%, color-mix(in srgb, ${cor} 16%, transparent), transparent 62%),
      linear-gradient(180deg,#1d2126,#131518);
  }
  .card::before{
    content:'';position:absolute;inset:0;z-index:0;
    background-image:
      linear-gradient(to right, rgba(236,238,241,.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(236,238,241,.04) 1px, transparent 1px);
    background-size:42px 42px;
    -webkit-mask-image:radial-gradient(120% 100% at 50% 0%,#000 10%,transparent 75%);
    mask-image:radial-gradient(120% 100% at 50% 0%,#000 10%,transparent 75%);
  }
  .dentro{position:relative;z-index:1}
  .marca{
    font-family:ui-monospace,monospace;font-size:10.5px;letter-spacing:.14em;
    text-transform:uppercase;color:#858d98;margin-bottom:20px;
  }
  .num{font-size:72px;font-weight:800;line-height:.9;letter-spacing:-.03em;color:${cor}}
  .rot{
    font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.1em;
    text-transform:uppercase;color:#939aa3;margin-top:10px;
  }
  .tit{font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-.02em}
  .txt{font-size:14px;line-height:1.65;color:#939aa3;margin-top:14px}
  .pe{
    display:flex;align-items:center;gap:9px;margin-top:24px;
    padding-top:18px;border-top:1px solid #262b31;
  }
  .quem{font-size:13.5px;font-weight:600;flex:1}
  .faixa{
    font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.08em;
    text-transform:uppercase;padding:4px 9px;border-radius:99px;
    color:${cor};border:1px solid color-mix(in srgb, ${cor} 40%, transparent);
  }
  .cta{
    display:block;max-width:400px;width:100%;margin-top:16px;text-align:center;
    padding:15px;border-radius:14px;text-decoration:none;font-weight:700;font-size:15px;
    color:#121615;background:#f0a830;
  }
  .rodape{max-width:400px;font-size:12px;line-height:1.6;color:#858d98;text-align:center;margin-top:14px}
  @media(prefers-reduced-motion:no-preference){.card{animation:sobe .5s cubic-bezier(.22,1,.36,1)}}
  @keyframes sobe{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
</style>
</head>
<body>
<main>
  <div class="card">
    <div class="dentro">
      <div class="marca">NeuroJitsu</div>
      ${c.numero !== null
        ? `<div class="num">${esc(c.numero)}</div><div class="rot">${esc(c.rotulo)}</div>`
        : `<div class="tit">${esc(c.titulo)}</div>`}
      <p class="txt">${esc(d.texto || c.texto)}</p>
      <div class="pe">
        <span class="quem">${esc(d.nome)}</span>
        <span class="faixa">${esc(d.faixa)}${graus ? ` ${graus}` : ''}</span>
      </div>
    </div>
  </div>
  <a class="cta" href="${SITE}/?de=card">Começar a minha</a>
  <p class="rodape">O NeuroJitsu transforma o seu histórico de rolas em diagnóstico do seu jogo.</p>
</main>
</body>
</html>`;
}

export default async function handler(req, res) {
  const codigo = String(req.query.c || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  const robo = ROBO.test(String(req.headers['user-agent'] || ''));

  let card = null;
  if (codigo.length >= 4 && ANON) {
    try {
      const r = await fetch(`${URL_BANCO}/rest/v1/rpc/ler_card`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_codigo: codigo, p_contar: !robo }),
      });
      if (r.ok) card = (await r.json())?.[0] || null;
    } catch (e) {
      console.error('[c]', e);
    }
  }

  /* card que nao existe nao vira pagina de erro: cai no app, que
     e pra onde a pessoa ia querer ir de qualquer jeito */
  if (!card) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', `${SITE}/`);
    res.status(302).end();
    return;
  }

  /* o card e uma foto e nunca muda, entao pode ficar em cache. A
     previa do WhatsApp e buscada uma vez por link compartilhado. */
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400');
  res.status(200).send(pagina(card.tipo, card.dados || {}));
}
