/* Tatame OS — service worker
   Estrategia:
   - navegacoes: network-first com fallback pro app shell em cache (funciona offline)
   - assets estaticos: stale-while-revalidate
   - fontes externas: cache-first
   Os DADOS ficam no IndexedDB, entao o app inteiro funciona sem internet. */

const VERSION = 'neurojitsu-v12-15';
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
  /* Ajustes pergunta qual versão dos avisos está neste aparelho */
  if (event.data === 'VERSAO') event.ports?.[0]?.postMessage(VERSION);
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
  meta: '/?go=metas',
  painel: '/?go=painel',
  dominio: '/?go=dominio',
};

/* Com a cara do tatame: brinca, mas cobra. Cada tipo tem algumas
   versões, e o dia escolhe qual sai, pra não virar papel de parede. */
const doDia = (lista, versao) =>
  lista[(Number.isInteger(versao) ? versao : Math.floor(Date.now() / 86400000)) % lista.length];

/* a semana fecha na virada de domingo pra segunda, horário de Brasília
   (UTC-3 o ano todo desde 2019). Quanto falta é contado na hora em que o
   aviso aparece, não na hora em que o servidor mandou: se o celular
   estava sem sinal e recebeu atrasado, o número continua certo. */
function fimDaSemana(agora = Date.now()) {
  const br = new Date(agora - 3 * 3600000);
  const diasAteSegunda = ((8 - br.getUTCDay()) % 7) || 7;
  return Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() + diasAteSegunda) + 3 * 3600000;
}
/* curto pra caber no aviso fechado: "4 dias", "2h08", "35 min" */
function quantoFalta(agora = Date.now()) {
  const min = Math.max(0, Math.floor((fimDaSemana(agora) - agora) / 60000));
  if (min >= 24 * 60) { const d = Math.floor(min / (24 * 60)); return `${d} ${d === 1 ? 'dia' : 'dias'}`; }
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

/* o relógio do cartão, no formato do Duolingo: "2:08"; com mais de um
   dia, "4 dias" */
function relogio(agora = Date.now()) {
  const min = Math.max(0, Math.floor((fimDaSemana(agora) - agora) / 60000));
  if (min >= 24 * 60) { const d = Math.floor(min / (24 * 60)); return `${d} ${d === 1 ? 'dia' : 'dias'}`; }
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

/* ------------------------------------------------------------
   O CARTÃO DO RELÓGIO

   Aviso de site não tem o cronômetro nativo do Android (o do
   Duolingo é app da loja). O mais perto: o celular desenha, na
   hora em que o aviso chega, um cartão com o tempo que falta, e
   no domingo à noite o servidor manda de novo a cada 15 minutos
   pra redesenhar (3:00, 2:45, 2:30...). Aparece ao puxar o aviso.
   Se o aparelho não souber desenhar, o aviso sai só com o texto.
   ------------------------------------------------------------ */
async function emDataUrl(tela) {
  const png = new Uint8Array(await (await tela.convertToBlob({ type: 'image/png' })).arrayBuffer());
  let bin = '';
  for (let i = 0; i < png.length; i += 0x8000) bin += String.fromCharCode.apply(null, png.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(bin)}`;
}

/* ------------------------------------------------------------
   O RELÓGIO NO ÍCONE

   O cartão grande só aparece com o aviso aberto, e quem decide
   quando abrir é o celular (no HyperOS, segurando e arrastando).
   O ícone da direita aparece sempre, com o aviso fechado: o
   relógio vai nele, grande, como o número do Duolingo.
   ------------------------------------------------------------ */
async function iconeDoRelogio(tempo) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  try {
    const L = 192;
    const tela = new OffscreenCanvas(L, L);
    const g = tela.getContext('2d');
    g.beginPath();
    g.roundRect(0, 0, L, L, 44);
    g.clip();
    g.fillStyle = '#120d0c';
    g.fillRect(0, 0, L, L);
    const brilho = g.createRadialGradient(L / 2, L / 2, 10, L / 2, L / 2, 120);
    brilho.addColorStop(0, 'rgba(239, 90, 68, 0.38)');
    brilho.addColorStop(1, 'rgba(239, 90, 68, 0)');
    g.fillStyle = brilho;
    g.fillRect(0, 0, L, L);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    /* "3 dias" vira o número grande com "dias" embaixo; "2:08", o
       relógio grande com "faltam" embaixo */
    const [numero, legenda] = tempo.includes(' ') ? tempo.split(' ') : [tempo, 'faltam'];
    g.fillStyle = '#ef5a44';
    g.font = `800 ${numero.length > 3 ? 62 : 92}px system-ui, sans-serif`;
    g.fillText(numero, L / 2, numero.length > 3 ? 112 : 122);
    g.fillStyle = '#ff9b8a';
    g.font = '700 28px system-ui, sans-serif';
    g.fillText(legenda, L / 2, 158);
    return await emDataUrl(tela);
  } catch {
    return null;
  }
}

async function cartaoDoRelogio(tempo, { rotulo = 'PRA FECHAR A SEMANA', linhas = ['1 treino = ofensiva', 'segura! ⚠️'] } = {}) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  try {
    const L = 720, A = 360;
    const tela = new OffscreenCanvas(L, A);
    const g = tela.getContext('2d');
    g.fillStyle = '#120d0c';
    g.fillRect(0, 0, L, A);
    const brilho = g.createRadialGradient(585, 180, 10, 585, 180, 300);
    brilho.addColorStop(0, 'rgba(239, 90, 68, 0.42)');
    brilho.addColorStop(1, 'rgba(239, 90, 68, 0)');
    g.fillStyle = brilho;
    g.fillRect(0, 0, L, A);
    try {
      const marca = await createImageBitmap(await (await fetch('/icon-512.png')).blob());
      g.save();
      g.shadowColor = 'rgba(239, 90, 68, 0.6)';
      g.shadowBlur = 40;
      g.beginPath();
      g.roundRect(475, 70, 220, 220, 48);
      g.clip();
      g.drawImage(marca, 475, 70, 220, 220);
      g.restore();
    } catch { /* sem a marca, o relógio basta */ }
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#acacb0';
    g.font = '700 26px system-ui, sans-serif';
    g.fillText(rotulo, 44, 78);
    g.fillStyle = '#ef5a44';
    g.font = `800 ${tempo.length > 5 ? 112 : 138}px system-ui, sans-serif`;
    g.fillText(tempo, 38, 208);
    g.fillStyle = '#ff9b8a';
    g.font = '600 38px system-ui, sans-serif';
    g.fillText(linhas[0] || '', 44, 270);
    g.fillText(linhas[1] || '', 44, 318);
    return await emDataUrl(tela);
  } catch {
    return null;
  }
}

/* Com o aviso fechado, o Android mostra 1 linha de título (uns 30
   caracteres) e 2 de texto (uns 75). Passou disso, vira "...". Toda
   copy daqui cabe nesse espaço: frase inteira, sem ser comida. */
function aviso(n) {
  /* o teste do admin escolhe a versão; o aviso de verdade usa a do dia */
  const qual = (lista) => doDia(lista, n.versao);
  const dias = Number(String(n.title || '').match(/^\d+/)?.[0]) || 0;
  const tipo = n.tag || '';
  if (tipo === 'ofensiva_semanal') {
    return {
      titulo: dias > 0 ? `🔥 Ofensiva de ${dias} ${dias === 1 ? 'semana' : 'semanas'} em jogo` : '🔥 Sua semana ainda está aberta',
      corpo: 'Treinou e não registrou? 1 treino salva a semana.',
      acoes: [{ acao: 'treino', titulo: 'Registrar treino', rota: ROTA.treino }],
    };
  }
  /* domingo às 21h, como o do Duolingo: o tempo que falta no título e
     no cartão. De 15 em 15 minutos chega de novo (ofensiva_reta_final:2115,
     :2130...) e redesenha o mesmo aviso em silêncio. Toca às 21h e na
     última hora (:2300). */
  if (tipo.startsWith('ofensiva_reta_final')) {
    const quando = tipo.split(':')[1] || '';
    return {
      titulo: quando === '2300' ? `⏳ Última hora: faltam ${quantoFalta()}` : `⏳ ${quantoFalta()} pra fechar a semana`,
      corpo: '1 treino registrado = ofensiva segura! ⚠️',
      acoes: [{ acao: 'treino', titulo: 'Salvar ofensiva', rota: ROTA.treino }],
      tag: 'ofensiva_reta_final',
      silencioso: !!quando && quando !== '2300',
      relogio: relogio(),
    };
  }
  /* a reta final da liga: na zona de rebaixamento, com o mesmo relógio */
  if (tipo.startsWith('liga_reta_final')) {
    const quando = tipo.split(':')[1] || '';
    const pontos = String((n.versao == null && n.body) || 'Faltam 6 pontos').match(/Faltam (\d+) pontos/)?.[1];
    return {
      titulo: `⏳ ${quantoFalta()} pra liga fechar`,
      corpo: (n.versao == null && n.body) || 'Você tá na zona de rebaixamento. Faltam 6 pontos pra sair.',
      acoes: [{ acao: 'treino', titulo: 'Registrar treino', rota: ROTA.treino }],
      tag: 'liga_reta_final',
      silencioso: !!quando && quando !== '2300',
      relogio: relogio(),
      cartao: { rotulo: 'PRA LIGA FECHAR', linhas: pontos ? ['Faltam ' + pontos + ' pontos', 'pra sair da zona ⚠️'] : ['1 treino te tira', 'da zona ⚠️'] },
    };
  }
  /* os avisos que o servidor escreve com os números da pessoa: aqui só
     entra o botão de cada um */
  /* no teste do admin (vem com versao) não há números da pessoa: sai o exemplo */
  const EXEMPLO = {
    pos_treino: ['🥋 Treinou hoje?', 'Registra os rolas enquanto tá fresco na cabeça.'],
    resumo: ['📊 Semana: 3 treinos, 12 rolas', 'Subiu de divisão na liga! 1 técnica subiu de grau.'],
    amigo: ['🥊 Fulano te passou na liga', 'Bora dar o troco? Faltam 6 pontos pra passar de volta.'],
    grau: ['🥋 Falta pouco pro 2º grau', 'Mais 1 uso da Americana e ela sobe. Bora encaixar hoje?'],
    campeonato: ['🏆 Campeonato em 3 dias', 'Hora de pegar leve no treino e cuidar do peso.'],
  };
  const doServidor = (acoes) => {
    const ex = n.versao != null ? EXEMPLO[tipo.split(':')[0]] : null;
    return { titulo: ex ? ex[0] : n.title || 'NeuroJitsu', corpo: ex ? ex[1] : n.body || '', acoes };
  };
  if (tipo === 'pos_treino') return doServidor([{ acao: 'treino', titulo: 'Registrar treino', rota: ROTA.treino }]);
  if (tipo === 'resumo') return doServidor([{ acao: 'liga', titulo: 'Ver a liga', rota: ROTA.liga }]);
  if (tipo.startsWith('amigo:')) return doServidor([{ acao: 'liga', titulo: 'Ver a liga', rota: ROTA.liga }]);
  if (tipo.startsWith('grau:')) return doServidor([{ acao: 'dominio', titulo: 'Ver a técnica', rota: ROTA.dominio }]);
  if (tipo === 'campeonato') return doServidor([{ acao: 'meta', titulo: 'Ver a preparação', rota: ROTA.meta }]);
  if (tipo.startsWith('meta:')) {
    return {
      titulo: n.title || '🎯 Sua meta',
      corpo: n.body || 'Abre pra ver seu progresso.',
      acoes: [{ acao: 'meta', titulo: 'Ver minha meta', rota: ROTA.meta }],
    };
  }
  if (tipo === 'ofensiva') {
    return {
      titulo: dias > 1
        ? qual([
          `🔥 ${dias} dias sem bater`,
          `🥋 ${dias} dias seguidos`,
          `🔥 ${dias} dias de ofensiva`,
          `💪 ${dias} dias sem faltar`,
        ])
        : qual([
          '🔥 Sua ofensiva fecha hoje',
          '🥋 Segura o primeiro dia',
        ]),
      corpo: qual([
        '1 aula rápida já segura a posição. Dá pra ver até na fila do mercado.',
        'Nem precisa rolar hoje: 1 aula rápida já mantém a sequência de pé.',
        'Disciplina é aparecer no dia em que o corpo pede pra bater.',
      ]),
      acoes: [
        { acao: 'estudar', titulo: 'Aula rápida', rota: ROTA.estudar },
        { acao: 'treino', titulo: 'Registrar treino', rota: ROTA.treino },
      ],
    };
  }
  if (tipo === 'liga') {
    return {
      ...qual([
        { titulo: '🏆 A liga fecha hoje', corpo: '1 treino ou 1 aula ainda mexe no placar antes da meia-noite.' },
        { titulo: '⏱️ Último round da liga', corpo: 'Fecha à meia-noite. Quem aparece hoje passa na frente.' },
      ]),
      acoes: [{ acao: 'liga', titulo: 'Ver meu grupo', rota: ROTA.liga }],
    };
  }
  if (tipo === 'resultado') {
    return {
      ...qual([
        { titulo: '📊 Saiu o resultado da liga', corpo: 'O árbitro levantou a mão. Vem ver onde você terminou.' },
        { titulo: '📊 Pódio ou repescagem?', corpo: 'A liga fechou. Vem ver onde você terminou e quem caiu no seu grupo.' },
      ]),
      acoes: [{ acao: 'liga', titulo: 'Ver resultado', rota: ROTA.liga }],
    };
  }
  if (tipo === 'volta') {
    return {
      ...qual([
        { titulo: '🥋 Seu kimono já até secou', corpo: 'Seu jogo está do jeito que você deixou. Volta com 1 aula rápida.' },
        { titulo: '🥋 O tatame continua aí', corpo: '1 aula rápida hoje, e amanhã voltar fica bem mais fácil.' },
      ]),
      acoes: [{ acao: 'estudar', titulo: 'Aula rápida', rota: ROTA.estudar }],
    };
  }
  /* o botão "Testar avisos" do painel: mesmo visual dos avisos de verdade */
  if (tipo === 'teste') {
    return {
      titulo: '🥋 Teste do NeuroJitsu',
      corpo: 'Chegou com o app fechado? Então os avisos funcionam. Testa os botões.',
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
    tag: bonito.tag || n.tag || 'neurojitsu',
    /* a atualização da reta final troca o texto sem tocar de novo */
    renotify: !bonito.silencioso,
    silent: !!bonito.silencioso,
    /* silencioso não pode vibrar: o Chrome recusa o aviso inteiro */
    ...(bonito.silencioso ? {} : { vibrate: [80, 40, 80] }),
    timestamp: Date.now(),
    /* os botões embaixo do aviso, como no Duolingo: o toque já leva
       pra ação, sem abrir o app e procurar */
    actions: bonito.acoes.map(({ acao, titulo: t }) => ({ action: acao, title: t })),
    data: { navigate: n.navigate || '/', rotas: Object.fromEntries(bonito.acoes.map((a) => [a.acao, a.rota])) },
  };

  event.waitUntil(
    (async () => {
      if (bonito.relogio) {
        const [imagem, icone] = await Promise.all([cartaoDoRelogio(bonito.relogio, bonito.cartao), iconeDoRelogio(bonito.relogio)]);
        if (imagem) opcoes.image = imagem;
        if (icone) opcoes.icon = icone;
      }
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
