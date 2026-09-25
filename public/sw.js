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
/* ------------------------------------------------------------
   COMO CADA AVISO APARECE

   O servidor diz o tipo (tag) e, na ofensiva, quantos dias. O texto
   que a pessoa lê mora aqui, com acento e emoji: sobe com o app,
   sem mexer no servidor. Tipo que não está aqui usa o texto dele.
   ------------------------------------------------------------ */
const ROTA = {
  estudar: '/?go=estudo',
  treino: '/?go=treinos',
  liga: '/?go=liga',
};

/* Com a cara do tatame: brinca, mas cobra. Cada tipo tem algumas
   versões, e o dia escolhe qual sai, pra não virar papel de parede. */
const doDia = (lista) => lista[Math.floor(Date.now() / 86400000) % lista.length];

function aviso(n) {
  const dias = Number(String(n.title || '').match(/^\d+/)?.[0]) || 0;
  const tipo = n.tag || '';
  if (tipo === 'ofensiva') {
    return {
      titulo: dias > 1
        ? doDia([
          `🔥 ${dias} dias sem bater. Não vai dar os três tapinhas justo hoje, né?`,
          `🥋 ${dias} dias seguidos. Faixa preta é só uma faixa branca que não faltou, lembra?`,
          `🔥 ${dias} dias de ofensiva. Não deixa ela te raspar logo agora.`,
          `💪 ${dias} dias seguidos. O tatame lembra de quem aparece, e ele tem boa memória.`,
        ])
        : doDia([
          '🔥 Sua ofensiva fecha hoje. Não deixa ela te bater, hein?',
          '🥋 O primeiro dia é o mais fácil de largar. Segura esse, que o segundo já fica leve.',
        ]),
      corpo: doDia([
        'Uma aula rápida de um minuto já segura a posição. Dá pra ver até na fila do mercado.',
        'Nem precisa rolar hoje: uma aula rápida já fecha o dia e mantém a sequência de pé.',
        'Disciplina é aparecer justo no dia em que o corpo pede pra bater. Um minuto resolve.',
      ]),
      acoes: [
        { acao: 'estudar', titulo: 'Aula rápida', rota: ROTA.estudar },
        { acao: 'treino', titulo: 'Registrar treino', rota: ROTA.treino },
      ],
    };
  }
  if (tipo === 'liga') {
    return {
      ...doDia([
        { titulo: '🏆 A liga fecha hoje. Ainda dá pra finalizar no último minuto.', corpo: 'Uns pontos a mais e você sobe no grupo antes da meia-noite. Um treino ou uma aula já mexem no placar.' },
        { titulo: '⏱️ Último round da liga. Hora de apertar o estrangulamento.', corpo: 'A semana fecha à meia-noite, e quem aparece hoje passa na frente de quem deixou pra amanhã.' },
      ]),
      acoes: [{ acao: 'liga', titulo: 'Ver meu grupo', rota: ROTA.liga }],
    };
  }
  if (tipo === 'resultado') {
    return {
      ...doDia([
        { titulo: '📊 O árbitro levantou a mão. Saiu o resultado da liga.', corpo: 'Vem ver onde você terminou e com quem você vai correr nesta semana.' },
        { titulo: '📊 A liga fechou. Foi pódio ou repescagem?', corpo: 'Entra pra ver onde você terminou e quem caiu no seu grupo agora.' },
      ]),
      acoes: [{ acao: 'liga', titulo: 'Ver resultado', rota: ROTA.liga }],
    };
  }
  if (tipo === 'volta') {
    return {
      ...doDia([
        { titulo: '🥋 Seu kimono tá sentindo sua falta (e ele já até secou).', corpo: 'Seu jogo está do jeito que você deixou. Volta com uma aula rápida, sem pressa e sem culpa.' },
        { titulo: '🥋 O tatame continua aí. Ninguém pegou o seu lugar, mas também ninguém guardou.', corpo: 'Uma aula rápida hoje, e amanhã voltar já fica bem mais fácil.' },
      ]),
      acoes: [{ acao: 'estudar', titulo: 'Aula rápida', rota: ROTA.estudar }],
    };
  }
  /* o botão "Testar avisos" do painel: mesmo visual dos avisos de verdade */
  if (tipo === 'teste') {
    return {
      titulo: '🥋 Teste do NeuroJitsu: é assim que o aviso chega',
      corpo: 'Se apareceu com o app fechado, a corrente inteira funciona. Toca nos botões pra ver se levam pro lugar certo.',
      acoes: [
        { acao: 'estudar', titulo: 'Aula rápida', rota: ROTA.estudar },
        { acao: 'treino', titulo: 'Registrar treino', rota: ROTA.treino },
      ],
    };
  }
  return { titulo: n.title || 'NeuroJitsu', corpo: n.body || '', acoes: [] };
}

self.addEventListener('push', (event) => {
  let n = {};
  try {
    n = (event.data?.json() || {}).notification || {};
  } catch {
    n = {};
  }

  const bonito = aviso(n);
  const titulo = bonito.titulo;
  const opcoes = {
    body: bonito.corpo,
    icon: '/icon-192.png',
    /* o ícone pequeno da barra de status: o Android só aceita silhueta
       branca em fundo transparente, a logo colorida vira um quadrado */
    badge: '/badge-96.png',
    lang: n.lang || 'pt-BR',
    tag: n.tag || 'neurojitsu',
    renotify: true,
    vibrate: [80, 40, 80],
    timestamp: Date.now(),
    /* os botões embaixo do aviso, como no Duolingo: o toque já leva
       pra ação, sem abrir o app e procurar */
    actions: bonito.acoes.map(({ acao, titulo: t }) => ({ action: acao, title: t })),
    data: { navigate: n.navigate || '/', rotas: Object.fromEntries(bonito.acoes.map((a) => [a.acao, a.rota])) },
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
  /* tocou num botão: vai pra ação dele; tocou no aviso: pra onde o servidor mandou */
  const dados = event.notification.data || {};
  const destino = (event.action && dados.rotas?.[event.action]) || dados.navigate || '/';

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
