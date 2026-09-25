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
   quem posta é o aluno, não o app. Frase de gente conhecida leva o
   nome, e só entra a que tem fonte: "Não é quem é bom, é quem fica"
   é do Chris Haueter no documentário Roll. Ditado que cada site dá
   pra um autor diferente entra sem nome. */
export const FRASES = {
  graduacao: [
    'Faixa preta é uma faixa branca que nunca desistiu.',
    'Grau não se compra no balcão. Se paga no tatame, um rola de cada vez.',
    { t: 'Não é quem é bom, é quem fica.', autor: 'Chris Haueter' },
    'Cada listra dessa custou suor, tapinha e segunda-feira de manhã.',
    'O professor amarrou a faixa. Quem apertou o nó foram os treinos que ninguém viu.',
    'Subi de faixa, não de ego. Amanhã eu volto como aluno.',
  ],
  recorde: [
    'O gás acabou antes da vontade.',
    'O corpo pediu arrego. A cabeça pediu mais um.',
    'Hoje eu fui o último a sair do tatame.',
    'Recorde batido. Amanhã eu ando igual pinguim, mas valeu cada round.',
    '"Só mais um rola", eu disse. Várias vezes.',
  ],
  ofensiva: [
    { t: 'Não é quem é bom, é quem fica.', autor: 'Chris Haueter' },
    'Motivação some. Disciplina bate o ponto.',
    'Constância finaliza mais que talento.',
    'Treino não depende do humor. Depende de aparecer.',
    'Dia após dia, sem dar os três tapinhas.',
    'Minha sequência é a minha guarda fechada: ninguém passa.',
  ],
  semana: [
    'Semana fechada. O tatame sabe quem apareceu.',
    'Não foi perfeita. Foi feita.',
    'Kimono lavado, semana cumprida, ego no lugar.',
    'Enquanto uns planejam, eu fui treinar.',
    'A semana cansou. Eu não parei.',
  ],
  meta: [
    'Meta falada em voz alta já é meio caminho da finalização.',
    'Plano no papel, suor no tatame.',
    'Não quero ser o melhor da academia. Quero ser melhor que eu no mês passado.',
    'Um treino de cada vez, até a meta bater.',
  ],
  marco: [
    { t: 'Assuma que o oponente é maior, mais forte e mais rápido. Aí você aprende a vencer com técnica.', autor: 'Hélio Gracie' },
    'Hora no tatame é a única moeda que o jiu-jitsu aceita.',
    'Ninguém vê o treino. Todo mundo vê o resultado.',
    'No jiu-jitsu não existe perder: ou você ganha, ou você aprende.',
    'Técnica vence força. Constância vence as duas.',
    'Devagar se vai longe. No jiu-jitsu, devagar se chega nas costas.',
  ],
};

/* frase simples ou com autor: sempre { t, autor } */
export const lerFrase = (f) => (typeof f === 'string' ? { t: f, autor: '' } : f);

/* Os desenhos de jiu-jitsu (public/figurinhas), um padrão por tipo
   de conquista. A pessoa troca ou tira na folha. */
export const DESENHOS = [
  { id: 'queda', nome: 'Queda' },
  { id: 'raspagem', nome: 'Raspagem' },
  { id: 'passagem', nome: 'Passagem' },
  { id: 'montada', nome: 'Montada' },
  { id: 'chave-de-braco', nome: 'Chave de braço' },
  { id: 'mata-leao', nome: 'Mata-leão' },
  { id: 'cumprimento', nome: 'Cumprimento' },
  { id: 'comemoracao', nome: 'Comemoração' },
];
export const DESENHO_PADRAO = {
  graduacao: 'comemoracao', recorde: 'queda', ofensiva: 'raspagem',
  semana: 'cumprimento', meta: 'montada', marco: 'chave-de-braco',
};
export const urlDoDesenho = (id) => `/figurinhas/${id}.png`;

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
 * selo    a linha pequena de cima ("marco atingido", "minha semana"), ou vazio
 * grande  o que aparece enorme ("100 horas de tatame", "12 dias")
 * sub     uma ou duas linhas embaixo
 * pct     0 a 100, desenha a barra (meta em andamento)
 * frase   a frase de impacto, ou vazio pra sair sem
 * autor   quem disse a frase, quando é de alguém
 * faixa   { cor, graus, preta }: desenha a faixa (graduação)
 * tema    'app', 'faixa' ou 'ouro': a cor de destaque
 * corFaixa a cor da faixa da pessoa, pro tema 'faixa'
 * desenho id de DESENHOS, ou vazio: vai no canto de cima, à direita
 * fundo   false = PNG transparente, true = cartão escuro
 */
export async function desenharFigurinha({ selo, grande, sub = '', pct = null, frase = '', autor = '', faixa = null, tema = 'app', corFaixa = null, desenho = '', fundo = false }) {
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

  /* o meio fica entre a marca (em cima) e a margem de baixo: o texto
     grande encolhe até tudo caber nesse espaço. O @ saiu: quem posta
     marca o perfil no próprio Instagram. */
  const FUNDO = LADO - 110;

  /* A arrumação: o desenho (quando tem) no canto de cima, o texto
     embaixo dele. Procura, nesta ordem de preferência:
       1. o desenho grande (até 560 px) com o número em 120 px ou mais;
       2. o desenho de pelo menos 400 px, mesmo com o número menor;
       3. a descrição e a frase um pouco menores (escala), pra o
          desenho não encolher;
       4. só no fim, o desenho menor.
     O número nunca desce de 84 px. */
  const img = desenho ? await carregarImagem(urlDoDesenho(desenho)) : null;
  const medir = (e) => {
    ctx.font = `600 ${Math.round(50 * e)}px ${CORPO}`;
    const lSub = sub ? linhas(ctx, sub, LARGURA, 2) : [];
    ctx.font = `italic 600 ${Math.round(46 * e)}px ${CORPO}`;
    const lFrase = frase ? linhas(ctx, frase, LARGURA - 34, 3) : [];
    const alt = (tg, n) => (selo ? 66 : 0) + n * tg * 1.02
      + (faixa ? 40 + ALTURA_FAIXA : 0)
      + (lSub.length ? 30 + lSub.length * 62 * e : 0)
      + (pct != null ? 64 : 0)
      + (lFrase.length ? 44 + lFrase.length * 58 * e + (autor ? 48 * e : 0) : 0);
    return { e, lSub, lFrase, alt };
  };
  /* o maior número que cabe entre TOPO e FUNDO, ou null */
  const numero = (m, topo, piso) => {
    for (let tg = 190; tg >= piso; tg -= 6) {
      ctx.font = `800 ${tg}px ${DISPLAY}`;
      const l = linhas(ctx, grande, LARGURA, 3);
      const cabe = l.every((x) => ctx.measureText(x).width <= LARGURA) && !l.at(-1).endsWith('…');
      if (cabe && m.alt(tg, l.length) <= FUNDO - topo) return { tg, l };
    }
    return null;
  };
  const tentativas = img
    ? [[560, 1, 120], [480, 1, 108], [400, 1, 96], [400, 0.88, 96], [400, 0.78, 90], [320, 0.78, 84], [240, 0.78, 84], [180, 0.78, 84]]
    : [[0, 1, 84], [0, 0.88, 84], [0, 0.78, 84]];
  let arrumo = null;
  for (const [tam, e, piso] of tentativas) {
    const m = medir(e);
    const topo = img ? Math.max(250, tam + 40) : 250;
    const n = numero(m, topo, piso);
    if (n) { arrumo = { ...m, ...n, topo, tam }; break; }
  }
  /* nada coube (texto enorme): o menor de tudo, e o texto que sobrar fica cortado */
  if (!arrumo) {
    const m = medir(0.78);
    ctx.font = `800 84px ${DISPLAY}`;
    arrumo = { ...m, tg: 84, l: linhas(ctx, grande, LARGURA, 3), topo: 250, tam: 180 };
  }
  const { lSub, lFrase, e: escala } = arrumo;
  const alturaDe = arrumo.alt;
  const TOPO = arrumo.topo;
  /* o desenho cresce até onde o texto deixa, até 560 */
  const tamDesenho = img ? Math.min(560, TOPO - 40) : 0;
  const tGrande = arrumo.tg;
  const lGrande = arrumo.l;
  let y = TOPO + Math.max(0, (FUNDO - TOPO - alturaDe(tGrande, lGrande.length)) / 2);

  /* a marca, em cima */
  const logo = await carregarImagem('/icon-192.png');
  if (logo) ctx.drawImage(logo, MARGEM, 110, 88, 88);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 52px ${DISPLAY}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('NeuroJitsu', MARGEM + (logo ? 110 : 0), 156);

  /* o desenho, no canto de cima à direita, sem sombra (o contorno
     preto dele já segura a leitura em cima de foto) */
  if (img) {
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.drawImage(img, LADO - tamDesenho - 36, 28, tamDesenho, tamDesenho);
    ctx.restore();
  }

  /* o selo, em texto: sem pílula, pra não ter cara de print de app */
  if (selo) {
    ctx.font = `700 32px ${MONO}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    ctx.fillStyle = acento;
    ctx.fillText(String(selo).toUpperCase(), MARGEM, y + 22);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    y += 66;
  }
  ctx.textBaseline = 'alphabetic';

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
    ctx.font = `600 ${Math.round(50 * escala)}px ${CORPO}`;
    for (const l of lSub) { y += 62 * escala; ctx.fillText(l, MARGEM, y - 12 * escala); }
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
    ctx.fillRect(MARGEM, y + 6, 8, lFrase.length * 58 * escala - 6);
    ctx.fillStyle = '#ffffff';
    ctx.font = `italic 600 ${Math.round(46 * escala)}px ${CORPO}`;
    for (const l of lFrase) { y += 58 * escala; ctx.fillText(l, MARGEM + 34, y - 10 * escala); }
    if (autor) {
      y += 48 * escala;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `600 ${Math.round(34 * escala)}px ${CORPO}`;
      ctx.fillText(autor, MARGEM + 34, y - 8 * escala);
    }
  }

  return canvas;
}

export const paraPNG = (canvas) => new Promise((ok) => canvas.toBlob(ok, 'image/png'));
