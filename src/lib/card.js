import { supabase } from './supabase';

/* ============================================================
   COMPARTILHAR

   Tudo que o app faz hoje acontece dentro do app. O card é a
   única coisa que sai: um endereço curto que o WhatsApp e o
   Instagram leem pra montar a prévia, e que quem vê consegue
   clicar.

   Por que link e não imagem: imagem não tem pra onde clicar.
   Quem vê um print bonito no story não tem como chegar no app,
   e aí o compartilhamento vira vaidade em vez de gente nova.

   O servidor carimba nome, faixa e graus (supabase/card.sql).
   Daqui só sai o miolo, pra ninguém publicar card com o nome de
   outra pessoa.
   ============================================================ */

const SITE = typeof location !== 'undefined' ? location.origin : '';

export async function criarCard(tipo, dados) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('criar_card', { p_tipo: tipo, p_dados: dados });
  if (error || !data) {
    console.error('[card]', error);
    return null;
  }
  return `${SITE}/c/${data}`;
}

/* Chamar de dentro de um clique: o navigator.share exige gesto.

   Devolve 'compartilhado' | 'copiado' | 'erro'. Quem não tem a
   folha nativa de compartilhamento (quase todo desktop) recebe o
   link na área de transferência, que resolve a mesma coisa. */
export async function compartilhar(tipo, dados, texto) {
  const url = await criarCard(tipo, dados);
  if (!url) return 'erro';

  try {
    if (navigator.share) {
      await navigator.share({ title: 'NeuroJitsu', text: texto, url });
      return 'compartilhado';
    }
    await navigator.clipboard.writeText(url);
    return 'copiado';
  } catch (e) {
    /* fechar a folha de compartilhamento dispara AbortError, e
       isso não é erro: é a pessoa tendo desistido. */
    if (e?.name === 'AbortError') return 'compartilhado';
    try {
      await navigator.clipboard.writeText(url);
      return 'copiado';
    } catch {
      return 'erro';
    }
  }
}
