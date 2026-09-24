/* ============================================================
   FIGURINHA PRO STORY

   Igual à do Strava: um PNG sem fundo que a pessoa cola por cima
   da foto dela no Instagram, com o @ do app embaixo. Também sai
   com fundo, pra quem quer postar a imagem sozinha.

   Tudo desenhado aqui no aparelho, num canvas: nada vai pro
   servidor e funciona sem internet.
   ============================================================ */
export const INSTAGRAM = '@neuro_jitsu';

const LADO = 1080;
const MARGEM = 96;
const LARGURA = LADO - MARGEM * 2;

function cor(variavel, reserva) {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(variavel).trim() || reserva;
  } catch {
    return reserva;
  }
}

function carregarImagem(src) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

/* quebra o texto em linhas que cabem na largura */
function linhas(ctx, texto, largura, max) {
  const palavras = String(texto || '').split(/\s+/).filter(Boolean);
  const saida = [];
  let atual = '';
  for (const p of palavras) {
    const tenta = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(tenta).width <= largura || !atual) atual = tenta;
    else { saida.push(atual); atual = p; }
  }
  if (atual) saida.push(atual);
  if (saida.length > max) {
    saida.length = max;
    saida[max - 1] = `${saida[max - 1].replace(/\s+\S*$/, '')}…`;
  }
  return saida;
}

/**
 * selo    a linha pequena de cima ("marco atingido", "meta", "ofensiva")
 * grande  o que aparece enorme ("100 horas de tatame", "12 dias")
 * sub     uma ou duas linhas embaixo
 * pct     0 a 100, desenha a barra (meta em andamento)
 * fundo   false = PNG transparente, true = cartão escuro
 */
export async function desenharFigurinha({ selo, grande, sub = '', pct = null, fundo = false }) {
  /* fonte que só o canvas usa o navegador não baixa sozinho */
  try {
    await Promise.all([
      '800 100px "Bricolage Grotesque"', '700 52px "Bricolage Grotesque"',
      '600 50px "Inter Tight"', '700 34px "JetBrains Mono"',
    ].map((x) => document.fonts.load(x)));
  } catch { /* fonte do sistema serve */ }

  const canvas = document.createElement('canvas');
  canvas.width = LADO;
  canvas.height = LADO;
  const ctx = canvas.getContext('2d');
  const acento = cor('--accent', '#e8664a');
  const DISPLAY = '"Bricolage Grotesque", "Archivo", system-ui, sans-serif';
  const CORPO = '"Inter Tight", system-ui, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, monospace';

  if (fundo) {
    const g = ctx.createLinearGradient(0, 0, 0, LADO);
    g.addColorStop(0, '#1d2326');
    g.addColorStop(1, '#0b0e0f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(24, 24, LADO - 48, LADO - 48, 64);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    /* sem fundo, a sombra segura a leitura em cima de qualquer foto */
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 3;
  }

  /* o meio fica entre a marca (em cima) e o @ (embaixo): o texto
     grande encolhe até tudo caber nesse espaço, sem encostar no @ */
  const TOPO = 250;
  const FUNDO = LADO - 190;
  ctx.font = `600 50px ${CORPO}`;
  const lSub = sub ? linhas(ctx, sub, LARGURA, 2) : [];
  const alturaDe = (t, n) => 64 + 28 + n * t * 1.02 + (lSub.length ? 30 + lSub.length * 62 : 0) + (pct != null ? 64 : 0);
  let tGrande = 190;
  let lGrande = [];
  for (; tGrande >= 72; tGrande -= 6) {
    ctx.font = `800 ${tGrande}px ${DISPLAY}`;
    lGrande = linhas(ctx, grande, LARGURA, 3);
    const cabe = lGrande.every((x) => ctx.measureText(x).width <= LARGURA) && !lGrande.at(-1).endsWith('…');
    if (cabe && alturaDe(tGrande, lGrande.length) <= FUNDO - TOPO) break;
  }
  let y = TOPO + Math.max(0, (FUNDO - TOPO - alturaDe(tGrande, lGrande.length)) / 2);

  /* a marca, em cima */
  const logo = await carregarImagem('/icon-192.png');
  if (logo) ctx.drawImage(logo, MARGEM, 110, 88, 88);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 52px ${DISPLAY}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('NeuroJitsu', MARGEM + (logo ? 110 : 0), 156);
  ctx.textBaseline = 'alphabetic';

  /* o selo, numa pílula: lê em cima de foto clara ou escura */
  ctx.font = `700 30px ${MONO}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  const textoSelo = String(selo || '').toUpperCase();
  const larguraSelo = ctx.measureText(textoSelo).width + 44;
  ctx.fillStyle = acento;
  ctx.beginPath(); ctx.roundRect(MARGEM, y, larguraSelo, 60, 30); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(textoSelo, MARGEM + 22, y + 31);
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  y += 64 + 28;

  /* o número / título grande */
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${tGrande}px ${DISPLAY}`;
  for (const l of lGrande) {
    y += tGrande * 1.02;
    ctx.fillText(l, MARGEM, y - tGrande * 0.18);
  }

  /* a linha de baixo */
  if (lSub.length) {
    y += 30;
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.font = `600 50px ${CORPO}`;
    for (const l of lSub) { y += 62; ctx.fillText(l, MARGEM, y - 12); }
  }

  /* a barra da meta */
  if (pct != null) {
    y += 40;
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.roundRect(MARGEM, y, LARGURA, 22, 11); ctx.fill();
    ctx.fillStyle = acento;
    ctx.beginPath(); ctx.roundRect(MARGEM, y, Math.max(22, LARGURA * Math.min(100, pct) / 100), 22, 11); ctx.fill();
    if (!fundo) ctx.shadowColor = 'rgba(0,0,0,0.55)';
  }

  /* o @, embaixo */
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 40px ${MONO}`;
  ctx.fillText(INSTAGRAM, MARGEM, LADO - 104);

  return canvas;
}

export const paraPNG = (canvas) => new Promise((ok) => canvas.toBlob(ok, 'image/png'));
