import { supabase } from './supabase';
import { getMeta, setMeta } from '../db/db';
import { ligada } from './chaves';

/* ============================================================
   VÍDEO VENDIDO À PARTE

   A assinatura abre a biblioteca. Alguns vídeos são vendidos
   separado dela, e aí quem decide não é o plano, é a compra.

   O link que aparece muda conforme quem está olhando, e essa é
   a parte que importa pro negócio:

   quem está no grátis vê o link da assinatura, porque o passo
   que falta pra ele é assinar, não comprar uma aula solta;

   quem já assina vê o link de compra daquele vídeo, porque pra
   ele a assinatura não resolve e a única porta é o avulso.

   As duas listas ficam guardadas no aparelho, senão o app sem
   rede acharia que ninguém comprou nada e trancaria o que já
   foi pago.
   ============================================================ */

const CHAVE_COMPRAS = 'aulas_compradas';
const CHAVE_LINK = 'link_assinatura';

let comprados = new Set();
let linkAssinatura = null;

export const jaComprou = (id) => comprados.has(id);
export const linkDeAssinatura = () => linkAssinatura;

export async function carregarCompras() {
  try {
    const guardado = await getMeta(CHAVE_COMPRAS, null);
    if (Array.isArray(guardado)) comprados = new Set(guardado);
    const link = await getMeta(CHAVE_LINK, null);
    if (link) linkAssinatura = link;
  } catch { /* banco ainda não abriu */ }

  if (!supabase) return;

  try {
    const [compras, ajuste] = await Promise.all([
      supabase.rpc('minhas_compras'),
      supabase.from('ajuste').select('texto').eq('id', CHAVE_LINK).single(),
    ]);

    if (!compras.error) {
      const ids = (compras.data || []).map((x) => (typeof x === 'string' ? x : x?.minhas_compras)).filter(Boolean);
      comprados = new Set(ids);
      await setMeta(CHAVE_COMPRAS, ids);
    }

    if (!ajuste.error && ajuste.data?.texto) {
      linkAssinatura = ajuste.data.texto;
      await setMeta(CHAVE_LINK, linkAssinatura);
    }
  } catch (e) {
    console.error('[pago]', e);
  }
}

/* ------------------------------------------------------------
   O que fazer com este vídeo agora

   Devolve { pode } quando é pra tocar, e quando não é devolve
   pra onde mandar a pessoa e o que dizer pra ela.
   ------------------------------------------------------------ */
export function rotaDoVideo(aula, acesso, { cobrando, comprado, link }) {
  if (!aula?.premium) return { pode: true };

  /* com a cobrança desligada no painel, nada é pago ainda */
  if (!cobrando) return { pode: true };

  if (comprado) return { pode: true, comprado: true };

  if (acesso?.premium) {
    return {
      pode: false,
      motivo: 'avulso',
      link: aula.checkout || null,
      titulo: 'Esta aula é vendida à parte',
      texto: 'Ela não entra na assinatura. É uma compra única, e depois fica sua pra sempre.',
      acao: 'Comprar esta aula',
    };
  }

  return {
    pode: false,
    motivo: 'assinatura',
    link: link || null,
    titulo: 'Esta aula é do premium',
    texto: 'Assinando, a biblioteca abre inteira e você para de esbarrar no limite do dia.',
    acao: 'Ver o premium',
  };
}

export function estadoDoVideo(aula, acesso) {
  return rotaDoVideo(aula, acesso, {
    cobrando: ligada('cobranca'),
    comprado: comprados.has(aula?.id),
    link: linkAssinatura,
  });
}
