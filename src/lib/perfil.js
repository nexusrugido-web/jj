import { supabase } from './supabase';

/* ============================================================
   PERFIL PÚBLICO

   A sua faixa mora no aparelho, dentro das configurações. O
   ranking mora no servidor, numa tabela separada. Nada ligava
   as duas: o perfil nascia "branca" junto com a conta e nunca
   mais mudava, então a liga mostrava todo mundo de faixa branca
   mesmo depois de graduar.

   A frequência vem da pergunta do onboarding, aquela de quantas
   vezes por semana você treina, e é o que o pareamento usa pra
   achar alguém com o seu ritmo.

   Só sobe o que já ia aparecer pros outros de qualquer jeito.
   Treino, rola e anotação continuam sem sair do aparelho.
   ============================================================ */

/* os campos que, quando mudam, pedem uma subida */
export const CAMPOS_PUBLICOS = ['nome', 'faixa', 'graus', 'metaSemanal'];

export function mexeuNoPerfil(patch) {
  return !!patch && CAMPOS_PUBLICOS.some((c) => c in patch);
}

/* ============================================================
   A FOTO DE PERFIL

   Vai pro grupo da liga. O app corta no quadrado do meio e reduz
   pra 256 px antes de mandar: a foto do celular tem 4 MB, a da
   liga precisa de uns 20 KB. O endereço leva a hora, senão quem
   troca de foto continua vendo a antiga guardada no navegador.
   ============================================================ */
async function reduzirFoto(file, lado = 256) {
  const img = await createImageBitmap(file);
  const corte = Math.min(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = lado; canvas.height = lado;
  canvas.getContext('2d').drawImage(img, (img.width - corte) / 2, (img.height - corte) / 2, corte, corte, 0, 0, lado, lado);
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('foto'))), 'image/jpeg', 0.85));
}

export async function enviarFoto(file) {
  const { data } = await supabase.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) throw new Error('Entre na sua conta pra colocar foto.');
  const blob = await reduzirFoto(file);
  const caminho = `${uid}/foto.jpg`;
  const { error } = await supabase.storage.from('avatares').upload(caminho, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
  if (error) throw error;
  const url = `${supabase.storage.from('avatares').getPublicUrl(caminho).data.publicUrl}?v=${Date.now()}`;
  const { error: e2 } = await supabase.from('perfil').update({ avatar_url: url, atualizado_em: new Date().toISOString() }).eq('user_id', uid);
  if (e2) throw e2;
  return url;
}

export async function removerFoto() {
  const { data } = await supabase.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) return;
  await supabase.storage.from('avatares').remove([`${uid}/foto.jpg`]);
  await supabase.from('perfil').update({ avatar_url: null, atualizado_em: new Date().toISOString() }).eq('user_id', uid);
}

export async function subirPerfil(settings) {
  if (!supabase || !settings) return;

  try {
    const { data } = await supabase.auth.getSession();
    const uid = data?.session?.user?.id;
    if (!uid) return;

    const { error } = await supabase.from('perfil').upsert({
      user_id: uid,
      nome: String(settings.nome || '').trim() || 'Praticante',
      faixa: settings.faixa || 'branca',
      graus: Number(settings.graus) || 0,
      treinos_semana: Number(settings.metaSemanal) || null,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) throw error;
  } catch (e) {
    /* sem rede o perfil sobe na próxima abertura do app */
    console.error('[perfil]', e);
  }
}
