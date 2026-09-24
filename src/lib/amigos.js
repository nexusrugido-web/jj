import { supabase } from './supabase';

/* ============================================================
   AMIGOS

   Quem manda é o servidor (supabase/amigos.sql). Amigo vê o que o
   grupo da liga vê: nome público, foto, faixa, ofensiva e pontos
   da semana. Chamar pra sala só funciona com amigo.
   ============================================================ */
const primeira = (data) => (Array.isArray(data) ? data[0] : data);

async function rpc(nome, args) {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw error;
  return data;
}

export const meusAmigos = async () => (supabase ? (await rpc('meus_amigos')) || [] : []);
export const meusConvitesDeSala = async () => (supabase ? (await rpc('meus_convites_de_sala')) || [] : []);
export const meuPar = async () => (supabase ? primeira(await rpc('meu_par')) || null : null);

export const pedirAmizade = async (id) => primeira(await rpc('pedir_amizade', { p_user: id })) || { ok: false, mensagem: 'Não deu agora.' };
export const responderAmizade = (id, aceitar) => rpc('responder_amizade', { p_user: id, p_aceitar: aceitar });
export const chamarPraSala = async (id) => primeira(await rpc('chamar_pra_sala', { p_user: id })) || { ok: false, mensagem: 'Não deu agora.' };
export const recusarConviteDeSala = (codigo) => rpc('recusar_convite_de_sala', { p_codigo: codigo });
