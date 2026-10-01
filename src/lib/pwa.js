/* Instalacao do PWA, dois caminhos, porque o iOS nao implementa
   `beforeinstallprompt`. Android/Chrome ganha o prompt nativo;
   iOS/Safari ganha instrucoes de "Compartilhar -> Adicionar a Tela de Inicio". */

let deferred = null;
const ouvintes = new Set();

export const ehStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  window.navigator.standalone === true ||
  document.referrer.startsWith('android-app://');

export function detectarPlataforma() {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  const androide = /Android/i.test(ua);
  const navegadorIOSSemInstalar = iOS && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return { iOS, safari, androide, navegadorIOSSemInstalar, desktop: !iOS && !androide };
}

export function iniciarPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    localStorage.setItem('tatame_instalado', '1');
    avisar();
  });

  if ('serviceWorker' in navigator) {
    const registrar = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    /* este arquivo carrega depois que a página já carregou: esperar o
       evento "load" deixava a primeira visita sem modo offline */
    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar);
  }

  /* pede pro navegador não apagar os dados quando faltar espaço. O
     Safari do iPhone ainda apaga tudo após 7 dias sem abrir, se o app
     não estiver instalado: aí só conta ou tela de início protegem. */
  navigator.storage?.persist?.().catch(() => {});
}

function avisar() {
  ouvintes.forEach((fn) => fn(temPromptNativo()));
}

export function onMudanca(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export const temPromptNativo = () => !!deferred;

/* O evento so pode ser consumido uma vez. Retorna 'accepted' | 'dismissed' | 'indisponivel'. */
export async function instalar() {
  if (!deferred) return 'indisponivel';
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  avisar();
  return outcome;
}

/* --- controle de quando mostrar o convite --- */
const CHAVE_DISPENSA = 'tatame_install_dispensado_em';
const CHAVE_ENGAJOU = 'tatame_engajou';

export function marcarEngajamento() {
  const n = Number(localStorage.getItem(CHAVE_ENGAJOU) || 0) + 1;
  localStorage.setItem(CHAVE_ENGAJOU, String(n));
  return n;
}

export const engajamento = () => Number(localStorage.getItem(CHAVE_ENGAJOU) || 0);

export function dispensar(dias = 14) {
  localStorage.setItem(CHAVE_DISPENSA, String(Date.now() + dias * 86400000));
}

export function estaDispensado() {
  const ate = Number(localStorage.getItem(CHAVE_DISPENSA) || 0);
  return Date.now() < ate;
}

export function podeConvidar() {
  if (ehStandalone()) return false;
  if (localStorage.getItem('tatame_instalado') === '1') return false;
  if (estaDispensado()) return false;
  const p = detectarPlataforma();
  if (p.desktop && !temPromptNativo()) return false;
  return engajamento() >= 1;
}


/* ============================================================
   AVISO DE ATUALIZAÇÃO

   O app não recarrega sozinho de propósito. Se recarregasse no
   meio de um registro de treino, o cara perderia o que digitou.
   Então ele avisa e espera você mandar.
   ============================================================ */
export function vigiarAtualizacao(aoEncontrar) {
  if (!('serviceWorker' in navigator)) return () => {};

  let reg = null;

  /* O controlador trocou: só recarrega se foi a pessoa que pediu
     (tocou em Atualizar). Sozinho, derrubaria um treino sendo digitado. */
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pediuAtualizar) window.location.reload();
  });

  navigator.serviceWorker.getRegistration().then((r) => {
    if (!r) return;
    reg = r;

    if (r.waiting) aoEncontrar(() => aplicar(r));

    r.addEventListener('updatefound', () => {
      const novo = r.installing;
      if (!novo) return;
      novo.addEventListener('statechange', () => {
        if (novo.state === 'installed' && navigator.serviceWorker.controller) {
          aoEncontrar(() => aplicar(r));
        }
      });
    });
  });

  /* confere de hora em hora, sem incomodar */
    /* de quinze em quinze minutos, e também toda vez que o app
     volta pro primeiro plano. Correção de bug parada esperando
     não conserta ninguém. */
  const conferir = () => reg?.update?.().catch(() => {});
  const t = setInterval(conferir, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') conferir();
  });
  return () => clearInterval(t);
}

let pediuAtualizar = false;
/* a versão do service worker que está mandando neste aparelho: é ela
   que monta os avisos. Sem resposta em 2 s, null. */
export function versaoDoAparelho() {
  const ativo = navigator.serviceWorker?.controller;
  if (!ativo) return Promise.resolve(null);
  return new Promise((ok) => {
    const canal = new MessageChannel();
    const t = setTimeout(() => ok(null), 2000);
    canal.port1.onmessage = (e) => { clearTimeout(t); ok(String(e.data || '').replace('neurojitsu-', '') || null); };
    ativo.postMessage('VERSAO', [canal.port2]);
  });
}

/* busca a versão nova agora e espera ela assumir: devolve a versão que
   ficou valendo neste aparelho */
export async function buscarVersaoNova() {
  if (!('serviceWorker' in navigator)) return null;
  const antes = await versaoDoAparelho();
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.update().catch(() => {})));
  /* a nova assume sozinha (skipWaiting); dá um tempo pra ela entrar */
  for (let i = 0; i < 8; i++) {
    const agora = await versaoDoAparelho();
    if (agora && agora !== antes) return { antes, agora };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { antes, agora: await versaoDoAparelho() };
}

function aplicar(reg) {
  pediuAtualizar = true;
  /* a tela seguinte diz que deu certo */
  try { sessionStorage.setItem('acabou-de-atualizar', '1'); } catch { /* sem armazenamento, só não avisa */ }
  if (reg.waiting) {
    /* a versão nova assume e o controllerchange recarrega; se ele não
       vier, recarrega do mesmo jeito */
    reg.waiting.postMessage('SKIP_WAITING');
    setTimeout(() => window.location.reload(), 1500);
  } else window.location.reload();
}
