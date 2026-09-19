import { supabase } from './supabase';
import { hoje } from './utils';

/* ============================================================
   A MEDIÇÃO DO ESTUDO

   Pra responder no painel se a recomendação vira vídeo assistido
   (supabase/medicao.sql). Cada medida diz de onde veio:

     tela   estudo, painel, dominio
     tipo   rec, dificuldade, estilo, entrada, tema, aba-dificuldade,
            vistas
     alvo   qual: a chave da recomendação, a dificuldade, o tema

   A origem viaja como texto "tela/tipo/alvo" junto com o vídeo
   aberto, do toque até a conclusão, pra conclusão saber de onde a
   pessoa veio.

   Medir nunca atrapalha: vai pra uma fila no aparelho e sobe em
   lote. Sem rede, sobe depois. "Exibiu" conta uma vez por dia por
   lugar e vídeo, e não a cada vez que a tela desenha.
   ============================================================ */

const FILA = 'medidas:fila';
const VISTOS = 'medidas:exibiu';
const MAX_FILA = 600;

export const origem = (tela, tipo, alvo = '-') => `${tela}/${tipo}/${alvo ?? '-'}`;

export function lerOrigem(txt) {
  const [tela = null, tipo = null, ...resto] = String(txt || '').split('/');
  return { tela: tela || null, tipo: tipo || null, alvo: resto.length ? resto.join('/') : null };
}

function ler(chave, padrao) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
}
function gravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento, perde a medida */ }
}

let espera = null;

export function medir(evento, { origem: o = null, videoId = null, detalhe = null, segundos = null } = {}) {
  const dia = hoje();
  if (evento === 'exibiu' || evento === 'faltou') {
    const vistos = ler(VISTOS, {});
    const chave = `${o}|${videoId || detalhe || ''}`;
    if (vistos.dia !== dia) { vistos.dia = dia; vistos.k = []; }
    if (vistos.k.includes(chave)) return;
    vistos.k.push(chave);
    gravar(VISTOS, vistos);
  }
  const fila = ler(FILA, []);
  fila.push({ evento, dia, ...lerOrigem(o), videoId, detalhe, segundos });
  gravar(FILA, fila.slice(-MAX_FILA));

  clearTimeout(espera);
  espera = setTimeout(() => { enviarMedidas().catch(() => {}); }, 5000);
}

let enviando = null;

export function enviarMedidas() {
  if (!supabase) return Promise.resolve(0);
  if (!enviando) enviando = enviar().finally(() => { enviando = null; });
  return enviando;
}

async function enviar() {
  const fila = ler(FILA, []);
  if (!fila.length) return 0;
  const { data } = await supabase.auth.getSession();
  if (!data?.session) return 0;

  const lote = fila.slice(0, 300);
  const { error } = await supabase.rpc('medir', { p_linhas: lote });
  if (error) throw error;
  /* só tira da fila o que subiu, e o que chegou no meio do caminho fica */
  gravar(FILA, ler(FILA, []).slice(lote.length));
  return lote.length;
}
