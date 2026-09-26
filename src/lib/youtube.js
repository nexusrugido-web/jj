import { supabase } from './supabase';

/* ============================================================
   O QUE O YOUTUBE DIZ DE CADA VÍDEO

   Só o painel usa isto. A chave fica no banco (admin_segredo) e
   só a conta de administrador consegue ler, então nada disto
   funciona no aparelho do aluno, nem precisa.

   Cada pergunta ao YouTube leva até 50 vídeos e gasta 1 ponto da
   cota de 10 mil por dia. O acervo inteiro custa 14.
   ============================================================ */

let chave = null;

async function chaveDoYoutube() {
  if (chave) return chave;
  const { data, error } = await supabase.rpc('segredo_admin', { p_nome: 'youtube' });
  if (error) throw error;
  if (!data) throw new Error('A chave do YouTube não está no banco');
  chave = data;
  return chave;
}

/* "PT1H4M37S" -> 3877 */
export function segundosDaIso(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso || '');
  if (!m) return 0;
  const [, d = 0, h = 0, min = 0, s = 0] = m.map((x) => Number(x) || 0);
  return d * 86400 + h * 3600 + min * 60 + s;
}

/* ------------------------------------------------------------
   Devolve um Map id -> { titulo, duracao, descricao, tags, status }.

   status  ok         existe e toca dentro do app
           sem_embed  existe, mas o dono proibiu tocar fora do YouTube
           sumiu      o YouTube não devolveu: apagado ou privado.
                      Não listado continua voltando normal.
   ------------------------------------------------------------ */
export async function buscarNoYoutube(ids) {
  const k = await chaveDoYoutube();
  const unicos = [...new Set(ids.filter(Boolean))];
  const r = new Map();

  for (let i = 0; i < unicos.length; i += 50) {
    const lote = unicos.slice(i, i + 50);
    const url = 'https://www.googleapis.com/youtube/v3/videos'
      /* o player com altura máxima volta na proporção do vídeo: é assim
         que se sabe se ele é em pé (o short e a aula gravada em pé) */
      + `?part=snippet,contentDetails,status,player&maxHeight=360&id=${lote.join(',')}&key=${encodeURIComponent(k)}`;
    const resp = await fetch(url);
    const corpo = await resp.json();
    if (!resp.ok) throw new Error(corpo?.error?.message || `YouTube respondeu ${resp.status}`);

    for (const it of corpo.items || []) {
      r.set(it.id, {
        titulo: it.snippet?.title || '',
        duracao: segundosDaIso(it.contentDetails?.duration),
        descricao: it.snippet?.description || '',
        tags: it.snippet?.tags || [],
        status: it.status?.embeddable === false ? 'sem_embed' : 'ok',
        vertical: it.player?.embedHeight && it.player?.embedWidth
          ? Number(it.player.embedHeight) > Number(it.player.embedWidth) : null,
      });
    }
    for (const id of lote) if (!r.has(id)) r.set(id, { status: 'sumiu' });
  }
  return r;
}
