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
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
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
  let recarregando = false;

  /* O controlador trocou, e isso basta: da proxima vez que algo
     for buscado, quem responde e a versao nova. Recarregar aqui
     derrubaria um treino sendo digitado, entao o app so recarrega
     quando a pessoa toca em atualizar. */
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
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

function aplicar(reg) {
  if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
  else window.location.reload();
}
