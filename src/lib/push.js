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
  if (!VAPID) return { pode: false, motivo: 'navegador' };
  if (Notification.permission === 'denied') return { pode: false, motivo: 'negada' };
  return { pode: true, motivo: Notification.permission === 'granted' ? 'ligada' : 'pedir' };
}

/* base64url -> Uint8Array, que e o que o applicationServerKey quer */
function chaveBinaria(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const cru = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...cru].map((c) => c.charCodeAt(0)));
}

const guardar = (sub, uid) => {
  const j = sub.toJSON();
  return supabase.from('push_inscricao').upsert({
    endpoint: j.endpoint,
    user_id: uid,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    fuso: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
  }, { onConflict: 'endpoint' });
};

/* Chamar de dentro de um clique. Devolve 'ligada' | 'negada' |
   'erro' | o motivo de nao dar. */
export async function ligarNotificacao(uid) {
  const { pode, motivo } = podeNotificar();
  if (!pode) return motivo;
  if (!supabase || !uid) return 'erro';

  try {
    if (Notification.permission !== 'granted') {
      if ((await Notification.requestPermission()) !== 'granted') return 'negada';
    }

    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveBinaria(VAPID),
      }));

    const { error } = await guardar(sub, uid);
    if (error) throw error;
    return 'ligada';
  } catch (e) {
    console.error('[push]', e);
    return 'erro';
  }
}

export async function desligarNotificacao(uid) {
  try {
    const reg = await navigator.serviceWorker.ready;
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
  if (!('serviceWorker' in navigator) || Notification?.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
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
