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
    acesso: l.acesso || 'todos',
    destaque: !!l.destaque,
    ordem: l.ordem ?? null,
    descricao: l.descricao || null,
    capa: l.capa_url || null,
    checkout: l.checkout_url || null,
    /* o que o vídeo ensina, no vocabulário de src/lib/vocab.js */
    posicaoLado: l.posicao_lado || [],
    habilidades: l.habilidades || [],
    tecnicas: l.tecnicas || [],
    formato: l.formato || null,
    nivel: l.nivel || null,
    classificacao: l.classificacao || 'legado',
  };
}

let lista = AULAS;
const ouvintes = new Set();

export const acervo = () => lista;

/* sem as aulas "só assinantes": essas aparecem só no Pra você, que é do
   premium e escolhe pelo que o aluno precisa. O resto do Estudo navega aqui. */
export const acervoAberto = () => lista.filter((a) => a.acesso !== 'assinantes');

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

/* ------------------------------------------------------------
   O QUE MUDOU NO SERVIDOR

   Sem data guardada, a resposta é o acervo inteiro que está no
   ar, e ela substitui a lista: nada que veio do código ou de um
   cache velho sobrevive se o servidor não tem mais.

   Com data, a resposta é só a diferença, e ela traz também o que
   saiu do ar (ativo = false). Esse sai do aparelho. Antes o app só
   somava e nunca tirava, e um vídeo tirado do ar continuava
   aparecendo pra todo mundo.

   O formato sobe de número quando a regra muda: quem tinha a
   lista antiga baixa tudo de novo uma vez, pra limpar o que ficou.
   ------------------------------------------------------------ */
const CHAVE_FORMATO = 'acervo_formato';
const FORMATO = 3;

/* a regra, sem banco nem rede: o que fica na lista depois de uma
   resposta do servidor. completa = a resposta é o acervo inteiro. */
export function mesclarAcervo(atual, linhas, { completa = false } = {}) {
  const fora = linhas.filter((x) => x.ativo === false).map((x) => x.id);
  const vivos = linhas.filter((x) => x.ativo !== false).map(daTabela);
  if (completa) return { lista: vivos, fora, vivos };

  const mapa = new Map(atual.map((v) => [v.id, v]));
  for (const id of fora) mapa.delete(id);
  for (const v of vivos) mapa.set(v.id, v);
  return { lista: [...mapa.values()], fora, vivos };
}

export async function sincronizarAcervo() {
  if (!supabase) return lista;

  try {
    if ((await getMeta(CHAVE_FORMATO, 0)) < FORMATO) await setMeta(CHAVE_DATA, null);

    const desde = await getMeta(CHAVE_DATA, null);
    const { data, error } = await supabase.rpc('acervo_desde', { p_desde: desde });
    if (error) throw error;
    if (!data?.length) return lista;

    const carimbo = data.reduce(
      (a, x) => (x.atualizado_em > a ? x.atualizado_em : a),
      desde || ''
    );
    const r = mesclarAcervo(lista, data, { completa: !desde });
    const guardar = r.vivos.map((v) => ({ ...v, atualizadoEm: carimbo }));

    if (!desde) {
      await db.acervo.clear();
      await db.acervo.bulkPut(guardar);
      await setMeta(CHAVE_DATA, carimbo || null);
      await setMeta(CHAVE_FORMATO, FORMATO);
      return aplicar(r.lista);
    }

    if (r.fora.length) await db.acervo.bulkDelete(r.fora);
    await db.acervo.bulkPut(guardar);
    await setMeta(CHAVE_DATA, carimbo || null);
    return aplicar(r.lista);
  } catch (e) {
    console.error('[acervo]', e);
    return lista;
  }
}

