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

/* ============================================================
   ANTES DA PRIMEIRA TELA

   O app abria com o padrão (cobrança desligada) e só depois lia o
   que estava guardado: por uns segundos tudo aparecia liberado e
   depois travava na cara da pessoa. Agora a resposta guardada entra
   antes da tela. Aparelho que nunca abriu espera o servidor um
   pouco, porque o padrão pode estar errado.
   ============================================================ */
export async function chavesAntesDaTela(esperaMs = 3000) {
  try {
    const guardado = await getMeta('chaves', null);
    if (guardado) { aplicar({ ...PADRAO, ...guardado }); return true; }
  } catch { /* banco fechado: segue pro servidor */ }
  await Promise.race([carregarChaves(), new Promise((ok) => setTimeout(ok, esperaMs))]);
  return !!cache;
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

   Só o servidor responde isso. Antes existia um atalho que
   destravava a tela neste aparelho, e ele estava num botão
   dentro dos Ajustes, à vista de qualquer aluno. A tela abria,
   não salvava nada, e dava a impressão de app quebrado pra
   quem só estava curioso.

   Agora a resposta é uma só, e ela vem da tabela admin.
   ============================================================ */
export async function souAdmin() {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('sou_admin');
    if (error) return false;
    /* guardado só pra abrir a tela certa na próxima vez; quem decide
       o que o admin pode salvar continua sendo o servidor */
    setMeta('sou_admin', !!data).catch(() => {});
    return !!data;
  } catch {
    return false;
  }
}

/* o painel pergunta de novo antes de deixar salvar */
export const souAdminNoServidor = souAdmin;
