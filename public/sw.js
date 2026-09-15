/* Tatame OS — service worker
   Estrategia:
   - navegacoes: network-first com fallback pro app shell em cache (funciona offline)
   - assets estaticos: stale-while-revalidate
   - fontes externas: cache-first
   Os DADOS ficam no IndexedDB, entao o app inteiro funciona sem internet. */

const VERSION = 'neurojitsu-v12-6';
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
