import { supabase } from './supabase';
import { getMeta, setMeta } from '../db/db';

/* ============================================================
   OS LINKS

   O app manda a pessoa pra fora em três momentos: assinar, ver o
   anual em vez de cancelar, e pedir suporte. Cada um desses
   endereços vivia num lugar diferente, e dois estavam escritos
   no meio do código.

   Agora todos saem daqui, e o painel edita. Ficam guardados no
   aparelho porque o botão de assinar não pode virar um botão
   morto quando falta rede.
   ============================================================ */

const CHAVE = 'links';

let cache = {};
const ouvintes = new Set();

export function observarLinks(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/* ------------------------------------------------------------
   O link pedido, e o plano B quando ele está vazio.

   O anual cai no mensal de propósito: enquanto você não criar o
   produto anual na Hotmart, quem clica em "ver o anual" ainda
   tem pra onde ir, em vez de apertar um botão que não faz nada.
   ------------------------------------------------------------ */
const RESERVA = { assinatura_anual: 'assinatura_mensal' };

export function linkDe(chave) {
  const direto = cache[chave];
  if (direto) return direto;
  const b = RESERVA[chave];
  return (b && cache[b]) || null;
}


export async function carregarLinks() {
  try {
    const guardado = await getMeta(CHAVE, null);
    if (guardado) cache = guardado;
  } catch { /* banco ainda não abriu */ }

  if (!supabase) return cache;

  try {
    const { data, error } = await supabase.from('link').select('chave, url');
    if (error) throw error;

    const mapa = {};
    for (const l of data || []) if (l.url) mapa[l.chave] = l.url;

    cache = mapa;
    setMeta(CHAVE, mapa).catch(() => {});
    for (const fn of ouvintes) {
      try { fn({ ...mapa }); } catch { /* ouvinte quebrado não derruba os outros */ }
    }
  } catch (e) {
    console.error('[links]', e);
  }

  return cache;
}

/* ------------------------------------------------------------
   Compra que sai de dentro do app vai marcada. A Hotmart devolve
   o sck e o src no aviso de venda, e é assim que o painel separa
   quem assinou pelo app de quem veio do Instagram ou do YouTube.
   ------------------------------------------------------------ */
export function comOrigemDoApp(url) {
  if (!url || !/hotmart\.com/i.test(url) || /[?&]sck=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}sck=app&src=app`;
}

/* abre o link, e não finge que abriu quando ele não existe */
export function abrirLink(chave) {
  const url = linkDe(chave);
  if (!url) return false;
  window.open(comOrigemDoApp(url), '_blank', 'noopener');
  return true;
}
