import { AULAS } from '../db/aulas';
import { db, getMeta, setMeta } from '../db/db';
import { supabase } from './supabase';

/* ============================================================
   DE ONDE VÊM AS AULAS

   Antes o acervo era um arquivo dentro do código, e cada vídeo
   novo exigia um deploy. Agora ele é tabela no servidor, e o
   arquivo virou só o ponto de partida.

   A ordem importa, porque o app é offline primeiro:

   1. o que está gravado no aparelho, que abre na hora
   2. se não tiver nada gravado, o que veio no código
   3. em segundo plano, o que mudou no servidor desde a última vez

   Quem lê isto em tela precisa ser avisado quando a lista muda,
   senão o Estudo continua mostrando o acervo velho até alguém
   recarregar o app na mão. É a mesma conversa das chaves.
   ============================================================ */

const CHAVE_DATA = 'acervo_ate';

/* o formato curto que as telas usam desde sempre */
function daTabela(l) {
  return {
    id: l.id,
    t: l.titulo,
    d: l.duracao,
    k: l.tipo,
    tm: l.temas?.length ? l.temas : ['geral'],
    p: l.posicoes || [],
    f: l.faixa || undefined,
    premium: !!l.premium,
    checkout: l.checkout_url || null,
  };
}

let lista = AULAS;
const ouvintes = new Set();

export const acervo = () => lista;

export function observarAcervo(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function aplicar(nova) {
  if (!nova?.length) return lista;
  lista = nova;
  for (const fn of ouvintes) {
    try { fn(lista); } catch { /* ouvinte quebrado não derruba os outros */ }
  }
  return lista;
}

/* ---------- a cópia do aparelho ---------- */
export async function acervoLocal() {
  try {
    const guardado = await db.acervo.toArray();
    if (guardado.length) return aplicar(guardado.map(({ atualizadoEm: _a, ...v }) => v));
  } catch { /* banco ainda não abriu */ }
  return lista;
}

/* ---------- o que mudou no servidor ---------- */
export async function sincronizarAcervo() {
  if (!supabase) return lista;

  try {
    const desde = await getMeta(CHAVE_DATA, null);
    const { data, error } = await supabase.rpc('acervo_desde', { p_desde: desde });
    if (error) throw error;
    if (!data?.length) return lista;

    const linhas = data.map(daTabela);
    const carimbo = data.reduce(
      (a, x) => (x.atualizado_em > a ? x.atualizado_em : a),
      desde || ''
    );

    await db.acervo.bulkPut(linhas.map((v) => ({ ...v, atualizadoEm: carimbo })));
    await setMeta(CHAVE_DATA, carimbo || null);

    /* junta o que veio com o que já estava, porque a chamada
       devolve só a diferença */
    const mapa = new Map(lista.map((v) => [v.id, v]));
    for (const v of linhas) mapa.set(v.id, v);
    return aplicar([...mapa.values()]);
  } catch (e) {
    console.error('[acervo]', e);
    return lista;
  }
}

/* ---------- o que o app chama na abertura ---------- */
export async function carregarAcervo() {
  await acervoLocal();
  return sincronizarAcervo();
}
