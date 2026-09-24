import { supabase } from './supabase';

/* ============================================================
   A SALA: A LIGA COM OS SEUS AMIGOS

   Quem manda é o servidor (supabase/sala.sql): de 3 a 5 pessoas,
   começa na segunda seguinte, corre no lugar da liga automática e
   continua toda semana. Aqui só chamamos as funções e montamos o
   convite.
   ============================================================ */
const primeira = (data) => (Array.isArray(data) ? data[0] : data);

export async function minhaSala() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('minha_sala');
  if (error) throw error;
  return data || [];
}

export async function criarSala() {
  const { data, error } = await supabase.rpc('criar_sala');
  if (error) throw error;
  return primeira(data) || { ok: false, mensagem: 'Não deu pra criar agora.' };
}

export async function entrarNaSala(codigo) {
  const { data, error } = await supabase.rpc('entrar_na_sala', { p_codigo: codigo });
  if (error) throw error;
  return primeira(data) || { ok: false, mensagem: 'Não deu pra entrar agora.' };
}

export async function sairDaSala() {
  const { error } = await supabase.rpc('sair_da_sala');
  if (error) throw error;
}

export async function verSala(codigo) {
  const { data, error } = await supabase.rpc('ver_sala', { p_codigo: codigo });
  if (error) throw error;
  return primeira(data) || null;
}

/* o convite que chega pelo link fica guardado até a pessoa estar
   logada e na tela da liga pra responder */
const CHAVE = 'convite:sala';

export function conviteDaURL() {
  try {
    const cod = new URLSearchParams(location.search).get('sala');
    if (cod) {
      sessionStorage.setItem(CHAVE, cod.toUpperCase());
      const url = new URL(location.href);
      url.searchParams.delete('sala');
      history.replaceState({}, '', url.pathname + url.search);
    }
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function esquecerConvite() {
  try { sessionStorage.removeItem(CHAVE); } catch { /* sem armazenamento, some ao fechar */ }
}

export const linkDaSala = (codigo) => `${location.origin}/?go=liga&sala=${codigo}`;

/* no celular abre a folha de compartilhar; no computador, o WhatsApp */
export async function convidar(codigo) {
  const texto = `Bora competir na minha sala do NeuroJitsu? A semana vale pontos de treino, aula e quiz. Entra por aqui: ${linkDaSala(codigo)}`;
  try {
    if (navigator.share) { await navigator.share({ text: texto }); return 'compartilhado'; }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelado';
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  return 'whatsapp';
}
