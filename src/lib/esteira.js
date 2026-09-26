import { supabase } from './supabase';
import { cabecalhoIA } from './ai';
import { buscarNoYoutube } from './youtube';
import { limparDaIa, decidir } from './classificar';

/* ============================================================
   A ESTEIRA, RODANDO

   Todo vídeo que entra "pelo título" (os 680 antigos e qualquer
   um cadastrado depois) passa pelo mesmo caminho:

     YouTube   descrição, etiquetas, se ainda existe
     IA        o que ele ensina, no vocabulário do app
     decidir   automática ou revisar (src/lib/classificar.js)
     banco     grava, e o vídeo já aparece no tema certo

   Roda no navegador de quem administra, porque é lá que estão a
   chave do YouTube e a permissão de gravar. Cada vídeo é gravado
   assim que fica pronto: fechar o painel no meio não perde nada,
   e da próxima vez a esteira continua de onde parou.
   ============================================================ */

const LOTE = 6;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* a Groq tem cota por dia. Acabou, a esteira para e avisa. */
export class LimiteDoDia extends Error {}

/* quem ainda precisa passar pela IA */
export const naEsteira = (a) => a.classificacao === 'legado' && a.ativo !== false && a.yt_status !== 'sumiu';

/* ------------------------------------------------------------
   O que o YouTube diz, gravado no banco. Devolve o Map por id.
   ------------------------------------------------------------ */
export async function gravarYoutube(ids) {
  const yt = await buscarNoYoutube(ids);
  const linhas = ids.map((id) => {
    const v = yt.get(id) || { status: 'sumiu' };
    return { id, descricao: v.descricao || null, tags: v.tags || null, status: v.status, vertical: v.vertical ?? null };
  });
  for (let i = 0; i < linhas.length; i += 50) {
    const { error } = await supabase.rpc('aula_youtube', { p_lote: linhas.slice(i, i + 50) });
    if (error) throw error;
  }
  return new Map(linhas.map((l) => [l.id, l]));
}

/* "Please try again in 1m23.5s" -> 84 */
function segundosPraTentar(texto) {
  const m = /try again in (?:(\d+)m)?([\d.]+)s/i.exec(texto || '');
  return m ? Math.ceil(Number(m[1] || 0) * 60 + Number(m[2])) : 20;
}

async function perguntarIa(videos) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const r = await fetch('/api/ia', {
      method: 'POST',
      headers: await cabecalhoIA(),
      body: JSON.stringify({ acao: 'classificar_videos', videos }),
    });
    const corpo = await r.json().catch(() => ({}));
    if (r.status === 429) {
      if (/per day|\(tpd\)|\(rpd\)/i.test(corpo.detalhe || '')) throw new LimiteDoDia('A IA chegou no limite de hoje');
      await espera(Math.min(90, segundosPraTentar(corpo.detalhe) + 1) * 1000);
      continue;
    }
    if (!r.ok || !corpo.ok) throw new Error(corpo.erro || `a IA respondeu ${r.status}`);
    if (!Array.isArray(corpo.dados?.videos)) throw new Error('a IA não devolveu a lista');
    return corpo.dados.videos;
  }
  throw new Error('a IA ficou ocupada demais');
}

/* ------------------------------------------------------------
   videos   linhas da tabela aula, só as que naEsteira aceita
   indice   o das técnicas (indiceDeTecnicas)
   aoAndar  chamado a cada vídeo gravado, com a linha nova
   parar    () => true pra interromper entre um lote e outro
   ------------------------------------------------------------ */
export async function rodarEsteira(videos, { indice, aoAndar, parar }) {
  const conta = { feitos: 0, revisar: 0, erros: 0, semYoutube: false };

  for (let i = 0; i < videos.length; i += LOTE) {
    if (parar?.()) break;
    let lote = videos.slice(i, i + LOTE);

    /* sem a descrição a IA classifica pelo título, que é pior,
       mas não para: a regra de "título genérico" segura o chute */
    const semYt = lote.filter((v) => !v.yt_status).map((v) => v.id);
    if (semYt.length && !conta.semYoutube) {
      try {
        const yt = await gravarYoutube(semYt);
        lote = lote
          .map((v) => (yt.has(v.id)
            ? { ...v, yt_descricao: yt.get(v.id).descricao, yt_tags: yt.get(v.id).tags, yt_status: yt.get(v.id).status }
            : v))
          .filter((v) => v.yt_status !== 'sumiu');
      } catch {
        conta.semYoutube = true;
      }
    }
    if (!lote.length) continue;

    let respostas;
    try {
      respostas = await perguntarIa(lote.map((v) => ({
        id: v.id, titulo: v.titulo, descricao: v.yt_descricao, tags: v.yt_tags, duracao: v.duracao,
      })));
    } catch (e) {
      if (e instanceof LimiteDoDia) throw e;
      conta.erros += lote.length;
      await supabase.from('aula').update({ classificacao_motivo: `a IA falhou: ${e.message}` })
        .in('id', lote.map((v) => v.id)).eq('classificacao', 'legado');
      continue;
    }

    for (const v of lote) {
      const bruta = respostas.find((r) => r?.id === v.id);
      if (!bruta) { conta.erros++; continue; }
      const campos = { ...decidir(v, limparDaIa(bruta, indice), { indice }), classificado_em: new Date().toISOString() };
      /* só grava se ninguém conferiu na mão enquanto a IA pensava */
      const { data, error } = await supabase.from('aula').update(campos)
        .eq('id', v.id).eq('classificacao', 'legado').select('*');
      if (error) throw error;
      if (!data?.[0]) continue;
      conta.feitos++;
      if (campos.classificacao === 'revisar') conta.revisar++;
      aoAndar?.(data[0], conta);
    }
  }
  return conta;
}
