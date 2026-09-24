import { supabase } from './supabase';
import { ehStandalone, detectarPlataforma } from './pwa';

/* ============================================================
   NOTIFICACAO

   O que vale saber antes de mexer aqui:

   1. No iPhone so funciona com o app instalado na tela de
      inicio. Numa aba do Safari o PushManager nem existe. Nao e
      configuracao: e assim desde o iOS 16.4 e continua assim.

   2. A permissao tem que ser pedida dentro de um toque. Pedir
      no carregamento e o jeito classico de tomar "Bloquear" e
      nunca mais ter chance, porque negada nao se pede de novo.

   3. Quem manda a notificacao e o servidor
      (supabase/notificacoes.sql). Daqui so sai a inscricao do
      aparelho: endereco, as duas chaves e o fuso.

   NADA AQUI PODE FICAR PENDENTE PRA SEMPRE

   `navigator.serviceWorker.ready` nao rejeita quando algo da
   errado: ele fica pendente, calado, e o botao gira sem fim. O
   `subscribe` tambem pode demorar eternamente quando o servico
   de push do navegador esta inalcancavel.

   Por isso cada passo corre contra um relogio, e cada um devolve
   um motivo proprio. Um botao girando nao diz nada pra ninguem;
   "o service worker nao respondeu" diz.
   ============================================================ */

/* a publica pode ir no bundle, e pra isso que ela serve */
const VAPID = import.meta.env.VITE_VAPID_PUBLICA || '';

export function podeNotificar() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { pode: false, motivo: 'navegador' };
  }
  const { iOS } = detectarPlataforma();
  if (iOS && !ehStandalone()) {
    return { pode: false, motivo: 'instalar' };
  }
  if (!VAPID) return { pode: false, motivo: 'sem_chave' };
  if (Notification.permission === 'denied') return { pode: false, motivo: 'negada' };
  return { pode: true, motivo: Notification.permission === 'granted' ? 'ligada' : 'pedir' };
}

/* o passo ou o relogio, o que vier primeiro */
const comPrazo = (promessa, ms, nome) =>
  Promise.race([
    promessa,
    new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error(`demorou demais: ${nome}`)), ms)),
  ]);

/* base64url -> Uint8Array, que e o que o applicationServerKey quer */
function chaveBinaria(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const cru = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...cru].map((c) => c.charCodeAt(0)));
}

/* Chamar de dentro de um clique. Devolve { ok, motivo, detalhe }:
   `motivo` diz qual passo parou, pra tela poder explicar em vez
   de ficar girando. */
export async function ligarNotificacao(uid) {
  const { pode, motivo } = podeNotificar();
  if (!pode) return { ok: false, motivo };
  if (!supabase) return { ok: false, motivo: 'sem_servidor' };
  if (!uid) return { ok: false, motivo: 'sem_conta' };

  let passo = 'permissao';
  try {
    if (Notification.permission !== 'granted') {
      const r = await comPrazo(Notification.requestPermission(), 60000, 'permissão');
      if (r !== 'granted') return { ok: false, motivo: r === 'denied' ? 'negada' : 'ignorada' };
    }

    /* `ready` espera um service worker ATIVO. Se o registro falhou
       ou ficou preso, ele nunca resolve, entao o registro e
       tentado de novo antes de esperar. */
    passo = 'service worker';
    await navigator.serviceWorker.register('/sw.js').catch(() => {});
    const reg = await comPrazo(navigator.serviceWorker.ready, 15000, 'service worker');

    passo = 'assinatura';
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await comPrazo(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chaveBinaria(VAPID),
        }),
        30000,
        'assinatura'
      ));

    passo = 'servidor';
    const j = sub.toJSON();
    const { error } = await comPrazo(
      supabase.from('push_inscricao').upsert({
        endpoint: j.endpoint,
        user_id: uid,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth,
        fuso: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
      }, { onConflict: 'endpoint' }),
      20000,
      'servidor'
    );
    if (error) throw error;

    return { ok: true, motivo: 'ligada' };
  } catch (e) {
    console.error('[push]', passo, e);
    return { ok: false, motivo: 'falhou', detalhe: `${passo}: ${e?.message || e}` };
  }
}

export async function desligarNotificacao(uid) {
  try {
    const reg = await comPrazo(navigator.serviceWorker.ready, 10000, 'service worker');
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase?.from('push_inscricao').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    /* o interruptor tambem desce: a pessoa pode ter outro
       aparelho inscrito, e desligar num desliga em todos */
    if (uid) await supabase?.from('perfil').update({ notificar: false }).eq('user_id', uid);
    await navigator.clearAppBadge?.().catch(() => {});
    return true;
  } catch (e) {
    console.error('[push]', e);
    return false;
  }
}

export async function estaLigada() {
  try {
    if (!('serviceWorker' in navigator) || Notification?.permission !== 'granted') return false;
    const reg = await comPrazo(navigator.serviceWorker.getRegistration(), 8000, 'registro');
    return !!(await reg?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/* O estado cru de cada peca, pra tela mostrar quando algo falha.
   E o que transforma "nao funciona" em "o service worker nao
   registrou", que e uma frase que da pra agir em cima. */
export async function estadoDoPush() {
  const { motivo } = podeNotificar();
  const est = {
    plataforma: ehStandalone() ? 'instalado' : 'navegador',
    chave: VAPID ? `${VAPID.slice(0, 6)}…` : 'FALTA',
    permissao: typeof Notification !== 'undefined' ? Notification.permission : 'n/d',
    suporte: motivo,
    sw: 'n/d',
    inscricao: 'n/d',
  };
  try {
    const reg = await comPrazo(navigator.serviceWorker.getRegistration(), 8000, 'registro');
    est.sw = reg ? (reg.active ? 'ativo' : 'registrado, sem ativo') : 'nenhum';
    const sub = await reg?.pushManager.getSubscription();
    est.inscricao = sub ? 'sim' : 'não';
  } catch (e) {
    est.sw = `erro: ${e?.message || e}`;
  }
  return est;
}

/* ============================================================
   ABRIU O APP

   Duas coisas ao abrir: limpar a bolinha do icone, e avisar o
   servidor que a notificacao funcionou.

   O segundo e o que decide quando calar a boca. Sete avisos sem
   ninguem abrir e o servidor para de mandar pra essa pessoa,
   porque desde 2026 o Chrome cassa a permissao de quem manda
   muito e engaja pouco.
   ============================================================ */
export async function abriuOApp(uid) {
  await navigator.clearAppBadge?.().catch(() => {});
  if (supabase && uid) await supabase.rpc('notificacao_respondida').catch(() => {});
}
