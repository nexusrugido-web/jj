/* ============================================================
   FIGURINHA PRO STORY

   Igual à do Strava: um PNG sem fundo que a pessoa cola por cima
   da foto dela no Instagram, com o @ do app embaixo. Também sai
   com fundo, pra quem quer postar a imagem sozinha.

   Tudo desenhado aqui no aparelho, num canvas: nada vai pro
   servidor e funciona sem internet.
   ============================================================ */
export const INSTAGRAM = '@neuro_jitsu';

/* A frase de impacto, por tipo de conquista. A pessoa liga ou
   desliga, e troca por outra com um toque. Na primeira pessoa:
   quem posta é o aluno, não o app. */
export const FRASES = {
  graduacao: [
    'Faixa preta é só uma faixa branca que não desistiu.',
    'Grau não se compra. Se paga em treino.',
    'O professor amarrou, mas quem conquistou foi o tatame.',
    'Cada grau veio de um rola em que eu quis bater e não bati.',
    'Mais um grau, e a mesma vontade de voltar amanhã.',
  ],
  recorde: [
    'Hoje o gás acabou antes da vontade.',
    'O corpo pediu pra parar. Eu pedi mais um rola.',
    'Recorde batido. Amanhã eu ando que nem pinguim.',
    'Dia bom de tatame não se explica, se registra.',
  ],
  ofensiva: [
    'Disciplina é aparecer no dia em que a vontade não aparece.',
    'Não é motivação. É hábito de kimono.',
    'Um dia de cada vez, sem dar os três tapinhas.',
    'A sequência não para porque eu não paro.',
  ],
  semana: [
    'Semana fechada. O tatame sabe quem apareceu.',
    'Não foi perfeita. Foi feita.',
    'Kimono lavado, semana cumprida.',
    'Treino a treino, a semana foi minha.',
  ],
  meta: [
    'Meta dita, meta treinada.',
    'Plano no papel, suor no tatame.',
    'Prometi e estou cumprindo, um treino de cada vez.',
  ],
  marco: [
    'Hora no tatame é a única moeda que o jiu-jitsu aceita.',
    'Ninguém vê o treino. Todo mundo vê o resultado.',
    'Cada rola desses fui eu escolhendo voltar.',
    'Devagar e sempre. No jiu-jitsu, devagar e por baixo, raspando.',
  ],
};

/* As cores da figurinha. A do app é de graça; as outras são do
   premium. A cor da faixa vem de quem chama (settings.faixa). */
export const TEMAS = [
  { id: 'app', nome: 'Cor do app', premium: false },
  { id: 'faixa', nome: 'Cor da faixa', premium: true },
  { id: 'ouro', nome: 'Dourado', premium: true },
];
const OURO = '#e3b04b';

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

/* A faixa desenhada, pra graduação: a cor da faixa, a ponteira
   preta (vermelha na preta) e um risco branco por grau. */
const ALTURA_FAIXA = 116;
function desenharFaixa(ctx, x, y, largura, { cor: corFaixa, graus = 0, preta = false }) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, largura, ALTURA_FAIXA, 14);
  ctx.fillStyle = corFaixa; ctx.fill();
  ctx.clip();
  /* as costuras que atravessam a faixa */
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 3;
  for (let i = 1; i <= 5; i++) {
    const ly = y + (ALTURA_FAIXA / 6) * i;
    ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + largura, ly); ctx.stroke();
  }
  /* luz em cima, sombra embaixo: parece pano, não retângulo */
  const luz = ctx.createLinearGradient(0, y, 0, y + ALTURA_FAIXA);
  luz.addColorStop(0, 'rgba(255,255,255,0.22)');
  luz.addColorStop(0.5, 'rgba(255,255,255,0)');
  luz.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = luz;
  ctx.fillRect(x, y, largura, ALTURA_FAIXA);
  /* a ponteira, perto da ponta direita */
  const larguraPonta = largura * 0.3;
  const xPonta = x + largura * 0.62;
  ctx.fillStyle = preta ? '#c1272d' : '#111111';
  ctx.fillRect(xPonta, y, larguraPonta, ALTURA_FAIXA);
  ctx.fillStyle = '#f4f4f2';
  const risco = 18;
  const vao = 16;
  const total = graus * risco + Math.max(0, graus - 1) * vao;
  for (let i = 0; i < graus; i++) {
    ctx.fillRect(xPonta + (larguraPonta - total) / 2 + i * (risco + vao), y, risco, ALTURA_FAIXA);
  }
  ctx.restore();
  /* o contorno segura a faixa branca em cima de foto clara */
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x, y, largura, ALTURA_FAIXA, 14); ctx.stroke();
  ctx.restore();
}

/**
 * selo    a linha pequena de cima ("marco atingido", "minha semana")
 * grande  o que aparece enorme ("100 horas de tatame", "12 dias")
 * sub     uma ou duas linhas embaixo
 * pct     0 a 100, desenha a barra (meta em andamento)
 * frase   a frase de impacto, ou vazio pra sair sem
 * faixa   { cor, graus, preta }: desenha a faixa (graduação)
 * tema    'app', 'faixa' ou 'ouro': a cor de destaque
 * corFaixa a cor da faixa da pessoa, pro tema 'faixa'
 * fundo   false = PNG transparente, true = cartão escuro
 */
export async function desenharFigurinha({ selo, grande, sub = '', pct = null, frase = '', faixa = null, tema = 'app', corFaixa = null, fundo = false }) {
  /* fonte que só o canvas usa o navegador não baixa sozinho */
  try {
    await Promise.all([
      '800 100px "Bricolage Grotesque"', '700 52px "Bricolage Grotesque"',
      '600 50px "Inter Tight"', 'italic 600 46px "Inter Tight"', '700 34px "JetBrains Mono"',
    ].map((x) => document.fonts.load(x)));
  } catch { /* fonte do sistema serve */ }

  const canvas = document.createElement('canvas');
  canvas.width = LADO;
  canvas.height = LADO;
  const ctx = canvas.getContext('2d');
  const acento = tema === 'ouro' ? OURO : tema === 'faixa' && corFaixa ? corFaixa : cor('--accent', '#e8664a');
  const DISPLAY = '"Bricolage Grotesque", "Archivo", system-ui, sans-serif';
  const CORPO = '"Inter Tight", system-ui, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, monospace';
  const sombra = () => {
    if (fundo) return;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 3;
  };

  if (fundo) {
    const g = ctx.createLinearGradient(0, 0, 0, LADO);
    g.addColorStop(0, '#1d2326');
    g.addColorStop(1, '#0b0e0f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(24, 24, LADO - 48, LADO - 48, 64);
    ctx.fill();
    /* no tema pago, a borda pega a cor dele */
    ctx.strokeStyle = tema === 'app' ? 'rgba(255,255,255,0.09)' : acento;
    ctx.globalAlpha = tema === 'app' ? 1 : 0.55;
    ctx.lineWidth = tema === 'app' ? 3 : 5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    /* sem fundo, a sombra segura a leitura em cima de qualquer foto */
    sombra();
  }

  /* o meio fica entre a marca (em cima) e o @ (embaixo): o texto
     grande encolhe até tudo caber nesse espaço, sem encostar no @ */
  const TOPO = 250;
  const FUNDO = LADO - 190;
  ctx.font = `600 50px ${CORPO}`;
  const lSub = sub ? linhas(ctx, sub, LARGURA, 2) : [];
  ctx.font = `italic 600 46px ${CORPO}`;
  const lFrase = frase ? linhas(ctx, frase, LARGURA - 34, 3) : [];
  const alturaDe = (t, n) => 66 + n * t * 1.02
    + (faixa ? 40 + ALTURA_FAIXA : 0)
    + (lSub.length ? 30 + lSub.length * 62 : 0)
    + (pct != null ? 64 : 0)
    + (lFrase.length ? 44 + lFrase.length * 58 : 0);
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

  /* o selo, em texto: sem pílula, pra não ter cara de print de app */
  ctx.font = `700 32px ${MONO}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
  ctx.fillStyle = acento;
  ctx.fillText(String(selo || '').toUpperCase(), MARGEM, y + 22);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.textBaseline = 'alphabetic';
  y += 66;

  /* o número / título grande */
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${tGrande}px ${DISPLAY}`;
  for (const l of lGrande) {
    y += tGrande * 1.02;
    ctx.fillText(l, MARGEM, y - tGrande * 0.18);
  }

  /* a faixa, na graduação */
  if (faixa) {
    y += 40;
    desenharFaixa(ctx, MARGEM, y, LARGURA, faixa);
    sombra();
    y += ALTURA_FAIXA;
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
    sombra();
    y += 24;
  }

  /* a frase, com um traço na cor de destaque do lado, como citação */
  if (lFrase.length) {
    y += 44;
    ctx.fillStyle = acento;
    ctx.fillRect(MARGEM, y + 6, 8, lFrase.length * 58 - 6);
    ctx.fillStyle = '#ffffff';
    ctx.font = `italic 600 46px ${CORPO}`;
    for (const l of lFrase) { y += 58; ctx.fillText(l, MARGEM + 34, y - 10); }
  }

  /* o @, embaixo */
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 40px ${MONO}`;
  ctx.fillText(INSTAGRAM, MARGEM, LADO - 104);

  return canvas;
}

export const paraPNG = (canvas) => new Promise((ok) => canvas.toBlob(ok, 'image/png'));
