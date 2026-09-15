import { supabase } from './supabase';
import { getMeta, setMeta } from '../db/db';

/* ============================================================
   CHAVES DE RECURSO

   O que está ligado e o que não está vem do servidor. Assim dá
   pra abrir a liga pra todo mundo com um clique no painel, sem
   precisar de deploy.

   O app guarda a última resposta, porque ele funciona offline
   e não pode ficar sem saber o que mostrar quando falta rede.

   Quem lê isto em tela precisa ser avisado quando o valor muda.
   Sem aviso, o painel liga o recurso e a tela continua igual
   até alguém recarregar o app na mão.
   ============================================================ */

const PADRAO = {
  liga: false,
  liga_convite: false,
  voz: true,
  timer: true,
  ia: true,
  quiz: true,
  estudo: true,
  musculacao: true,
  cobranca: false,
  aviso_global: false,
};

let cache = null;

/* ---------- quem quer saber quando muda ---------- */
const ouvintes = new Set();

export function observarChaves(fn) {
  ouvintes.add(fn);
  if (cache) { try { fn({ ...cache }); } catch { /* ouvinte quebrado não derruba os outros */ } }
  return () => ouvintes.delete(fn);
}

function aplicar(mapa) {
  cache = mapa;
  for (const fn of ouvintes) {
    try { fn({ ...mapa }); } catch { /* segue avisando o resto */ }
  }
  return mapa;
}

export async function carregarChaves() {
  let base = cache;
  if (!base) {
    try {
      const guardado = await getMeta('chaves', null);
      if (guardado) base = { ...PADRAO, ...guardado };
    } catch { /* banco ainda não abriu, segue com o padrão */ }
  }

  if (!supabase) return aplicar(base || { ...PADRAO });

  try {
    const { data, error } = await supabase.from('chave').select('id, ligada, porcentagem');
    if (error) throw error;

    const mapa = { ...PADRAO };
    for (const c of data || []) {
      /* liberação parcial: a mesma pessoa sempre cai do mesmo lado */
      if (c.ligada && c.porcentagem < 100) mapa[c.id] = dentroDaFatia(c.id, c.porcentagem);
      else mapa[c.id] = !!c.ligada;
    }

    setMeta('chaves', mapa).catch(() => {});
    return aplicar(mapa);
  } catch {
    return aplicar(base || { ...PADRAO });
  }
}

/* o painel chama isto depois de salvar, e a tela inteira se
   ajusta sozinha */
export const recarregarChaves = carregarChaves;

export function ligada(id) {
  if (!cache) return PADRAO[id] ?? false;
  return cache[id] ?? PADRAO[id] ?? false;
}

export function todasAsChaves() {
  return cache ? { ...cache } : { ...PADRAO };
}

/* ---------- fatia estável por aparelho ---------- */
function dentroDaFatia(id, pct) {
  let semente = null;
  try { semente = localStorage.getItem('tatame:semente'); } catch { /* sem armazenamento */ }
  if (!semente) {
    semente = Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem('tatame:semente', semente); } catch { /* sem armazenamento */ }
  }
  const txt = `${id}:${semente}`;
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 100) < pct;
}

/* ---------- recado geral ---------- */
export async function carregarRecado() {
  if (!supabase || !ligada('aviso_global')) return null;
  try {
    const { data } = await supabase.from('recado').select('*').eq('id', 1).single();
    if (!data?.texto) return null;
    return data;
  } catch {
    return null;
  }
}

/* ============================================================
   SOU ADMINISTRADOR?

   Tem duas respostas diferentes, e misturar as duas é o que
   faz o painel parecer quebrado:

   - a do aparelho, que só abre a tela. Serve pra desenvolver.
   - a do servidor, que é a que deixa salvar de verdade.

   Quem entra por ?admin=1 vê a tela inteira, clica em tudo e
   não grava nada, porque a regra do banco não conhece ele.
   Por isso o painel pergunta as duas coisas e avisa quando as
   respostas são diferentes.
   ============================================================ */
const CHAVE_LOCAL = 'tatame:admin';

export function adminLocal() {
  try { return localStorage.getItem(CHAVE_LOCAL) === '1'; } catch { return false; }
}

export function ligarAdminLocal(ligado) {
  try {
    if (ligado) localStorage.setItem(CHAVE_LOCAL, '1');
    else localStorage.removeItem(CHAVE_LOCAL);
  } catch { /* sem armazenamento */ }
}

/* a resposta do servidor, sem atalho nenhum. É esta que diz se
   o que o painel salvar vai ficar salvo. */
export async function souAdminNoServidor() {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('sou_admin');
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

export async function souAdmin() {
  /* atalho de desenvolvimento pela URL */
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('admin') === '1') ligarAdminLocal(true);
    if (q.get('admin') === '0') ligarAdminLocal(false);
  } catch { /* sem URL */ }

  if (adminLocal()) return true;

  const real = await souAdminNoServidor();
  if (real) ligarAdminLocal(true);
  return real;
}
