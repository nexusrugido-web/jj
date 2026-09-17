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
