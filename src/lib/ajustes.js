import { supabase } from './supabase';
import { getMeta, setMeta } from '../db/db';

/* ============================================================
   AJUSTES NUMÉRICOS

   A tabela de chaves diz o que está ligado. Esta aqui diz de
   quanto. Tamanho do grupo da liga, quantos sobem e descem,
   quantas recomendações aparecem, teto de estudo da semana.

   Mesma lógica das chaves: o valor vem do servidor, fica
   guardado no aparelho pra funcionar sem rede, e quem lê em
   tela é avisado quando muda.
   ============================================================ */

const PADRAO = {
  liga_tamanho: 10,
  liga_corte: 3,
  recomendacoes: 10,
  teto_estudo_semana: 140,
};

let cache = null;
const ouvintes = new Set();

export function observarAjustes(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function aplicar(mapa) {
  cache = mapa;
  for (const fn of ouvintes) {
    try { fn({ ...mapa }); } catch { /* ouvinte quebrado não derruba os outros */ }
  }
  return mapa;
}

export function ajusteDe(id, padrao = null) {
  const v = cache?.[id];
  if (Number.isFinite(v)) return v;
  return padrao !== null ? padrao : (PADRAO[id] ?? null);
}

export function todosOsAjustes() {
  return cache ? { ...cache } : { ...PADRAO };
}

export async function carregarAjustes() {
  let base = cache;
  if (!base) {
    try {
      const guardado = await getMeta('ajustes', null);
      if (guardado) base = { ...PADRAO, ...guardado };
    } catch { /* banco ainda não abriu */ }
  }

  if (!supabase) return aplicar(base || { ...PADRAO });

  try {
    const { data, error } = await supabase.from('ajuste').select('id, valor');
    if (error) throw error;

    const mapa = { ...PADRAO };
    for (const a of data || []) {
      if (Number.isFinite(a.valor)) mapa[a.id] = a.valor;
    }

    setMeta('ajustes', mapa).catch(() => {});
    return aplicar(mapa);
  } catch {
    return aplicar(base || { ...PADRAO });
  }
}

export const recarregarAjustes = carregarAjustes;
