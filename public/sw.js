/* Tatame OS — service worker
   Estrategia:
   - navegacoes: network-first com fallback pro app shell em cache (funciona offline)
   - assets estaticos: stale-while-revalidate
   - fontes externas: cache-first
   Os DADOS ficam no IndexedDB, entao o app inteiro funciona sem internet. */

const VERSION = 'neurojitsu-v12-9';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  /* Assume na hora. Antes ele esperava a aba fechar, e enquanto
     isso a versao com defeito continuava servindo. Assumir e
     seguro porque os dados moram no IndexedDB, nao no cache, e
     o app so recarrega quando a pessoa mandar. */
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ============================================================
   PUSH

   No iOS 18.4+ e no Safari 26 o sistema mostra a notificacao
   sozinho, pelo Declarative Web Push: este handler nem chega a
   ser chamado, e e por isso que a notificacao aparece mesmo se
   o codigo aqui quebrar.

   No Chrome, que ainda nao entende o formato, o payload chega
   cru aqui e a gente monta na mao. O mesmo JSON, dos dois lados.

   Nao existe push silencioso: todo push tem que virar
   notificacao visivel. Se este handler nao mostrar nada, o
   Chrome mostra "Este site foi atualizado em segundo plano" no
   nosso lugar, e repetir isso custa a permissao.
   ============================================================ */
self.addEventListener('push', (event) => {
  let n = {};
  try {
    n = (event.data?.json() || {}).notification || {};
  } catch {
    n = {};
  }

  const titulo = n.title || 'NeuroJitsu';
  const opcoes = {
    body: n.body || '',
    icon: '/icon-192.png',
    /* o ícone pequeno da barra de status: o Android só aceita silhueta
       branca em fundo transparente, a logo colorida vira um quadrado */
    badge: '/badge-96.png',
    lang: n.lang || 'pt-BR',
    tag: n.tag || 'neurojitsu',
    renotify: true,
    data: { navigate: n.navigate || '/' },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(titulo, opcoes);
      /* o numero na bolinha do icone. O formato declarativo faz
         isso sozinho pelo app_badge; aqui e na mao. */
      if (self.navigator.setAppBadge && n.app_badge) {
        await self.navigator.setAppBadge(Number(n.app_badge) || 1).catch(() => {});
      }
    })()
  );
});

/* Toque na notificacao: traz a aba que ja existe em vez de abrir
   outra. Quem toca duas vezes nao quer dois apps abertos. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = event.notification.data?.navigate || '/';

  event.waitUntil(
    (async () => {
      const abas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const aba of abas) {
        if (new URL(aba.url).origin === self.location.origin) {
          await aba.focus();
          if ('navigate' in aba) await aba.navigate(destino).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(destino);
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Qualquer coisa de fora passa direto, e isto vem ANTES de tudo.
  // Um iframe conta como navegacao, entao se esta regra ficasse
  // depois, o player do YouTube recebia o nosso index.html no
  // lugar do video e a tela ficava preta.
  const FORA = [
    'youtube.com', 'ytimg.com', 'youtube-nocookie.com', 'ggpht.com', 'ytimg.l.google.com',
    'googlevideo.com', 'gstatic.com', 'supabase.co', 'groq.com',
  ];
  if (FORA.some((d) => url.hostname.endsWith(d))) return;

  // O link curto (/r/...) responde com redirecionamento pra
  // Hotmart, e o card (/c/...) e uma pagina servida pelo
  // servidor. Se passassem pela regra de navegacao abaixo,
  // qualquer um dos dois seria guardado no lugar do app offline.
  if (url.origin === self.location.origin
      && (url.pathname.startsWith('/r/') || url.pathname.startsWith('/c/'))) return;

  // Navegacao do proprio app: tenta rede, cai pro shell
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Fontes e CDNs: cache-first, e so guarda o que da pra guardar
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((res) => {
              // resposta opaca nao serve de cache, e tentar quebra
              if (res && res.type !== 'opaque' && res.status === 200) {
                const copy = res.clone();
                caches.open(ASSETS).then((c) => c.put(request, copy)).catch(() => {});
              }
              return res;
            })
            .catch(() => cached)
      )
    );
    return;
  }

  // Assets locais: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
