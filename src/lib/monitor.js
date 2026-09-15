
/* ============================================================
   MONITORAMENTO

   O app funciona sem internet, então erro que acontece offline
   precisa esperar a conexão voltar em vez de sumir. O Sentry
   já guarda na fila sozinho, e aqui a gente configura pra isso
   funcionar do jeito certo.

   Nada de dado pessoal vai junto. Só o que aconteceu e onde.
   ============================================================ */

const DSN = import.meta.env.VITE_SENTRY_DSN || '';
const VERSAO = import.meta.env.VITE_APP_VERSION || 'dev';

let ligado = false;
let Sentry = null;

/* 450KB de biblioteca não desce no celular de ninguém sem motivo.
   Só baixa se você configurou o monitoramento de verdade. */
export async function iniciarMonitor() {
  if (!DSN || ligado) return;
  ligado = true;

  Sentry = await import('@sentry/react');

  Sentry.init({
    dsn: DSN,
    release: `tatame@${VERSAO}`,
    environment: import.meta.env.MODE,

    /* fila offline: guarda o erro e manda quando a rede voltar */
    transportOptions: {
      maxQueueSize: 40,
    },

    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    /* limpa qualquer coisa que possa identificar a pessoa */
    beforeSend(evento) {
      if (evento.request?.url) {
        try {
          const u = new URL(evento.request.url);
          u.search = '';
          evento.request.url = u.toString();
        } catch { /* url estranha, deixa como está */ }
      }
      delete evento.user;
      if (evento.extra) {
        delete evento.extra.email;
        delete evento.extra.nome;
      }
      return evento;
    },

    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error promise rejection',
      'AbortError',
      'NetworkError when attempting to fetch',
      'Failed to fetch',
      'Load failed',
    ],
  });

  Sentry.setTag('pwa', window.matchMedia('(display-mode: standalone)').matches ? 'instalado' : 'navegador');
}

/* ---------- o que interessa acompanhar ---------- */
export function registrarErro(erro, contexto = {}) {
  console.error('[erro]', erro, contexto);
  if (!ligado || !Sentry) return;
  Sentry.withScope((s) => {
    for (const [k, v] of Object.entries(contexto)) s.setExtra(k, v);
    Sentry.captureException(erro);
  });
}

export function marcarPasso(mensagem, dados = {}) {
  if (!ligado || !Sentry) return;
  Sentry.addBreadcrumb({ message: mensagem, data: dados, level: 'info' });
}

/* migração do banco é o ponto mais crítico do app.
   Se quebrar aqui, a pessoa perde o histórico. */
export function erroDeMigracao(erro, de, para) {
  registrarErro(erro, { tipo: 'migracao', versaoDe: de, versaoPara: para });
}

export function erroDeSync(erro, detalhe = {}) {
  registrarErro(erro, { tipo: 'sync', ...detalhe });
}

export function erroDeAcesso(erro) {
  registrarErro(erro, { tipo: 'acesso' });
}


