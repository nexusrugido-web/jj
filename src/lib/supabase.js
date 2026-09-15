import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL || '';
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigurado = !!(URL && ANON);

export const supabase = supabaseConfigurado
  ? createClient(URL, ANON, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

/* ---------- auth ---------- */
export async function entrarComSenha(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

export async function cadastrar(email, senha, nome) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { full_name: nome || '' },
      emailRedirectTo: `${location.origin}/`,
    },
  });
  if (error) throw error;
  return data;
}

export async function entrarComGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${location.origin}/`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
  return data;
}

export async function recuperarSenha(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/?recuperar=1`,
  });
  if (error) throw error;
}

export async function trocarSenha(nova) {
  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) throw error;
}

export async function sair() {
  await supabase.auth.signOut();
}

export async function sessaoAtual() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

/* ---------- storage ---------- */
export async function enviarArquivo(file, { pasta = 'geral', onProgresso } = {}) {
  const sess = await sessaoAtual();
  if (!sess) throw new Error('Você precisa estar logado para enviar arquivos.');
  const uid = sess.user.id;
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const caminho = `${uid}/${pasta}/${nome}`;

  const { error } = await supabase.storage.from('tatame').upload(caminho, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  onProgresso?.(100);
  return { caminho, bucket: 'tatame' };
}

export async function urlAssinada(caminho, segundos = 3600) {
  const { data, error } = await supabase.storage.from('tatame').createSignedUrl(caminho, segundos);
  if (error) throw error;
  return data.signedUrl;
}

export async function apagarArquivo(caminho) {
  await supabase.storage.from('tatame').remove([caminho]);
}

/* mensagens de erro em português */
export function traduzErro(e) {
  const m = String(e?.message || e || '');
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar (olhe a caixa de entrada).';
  if (/User already registered/i.test(m)) return 'Esse e-mail já tem conta. Tente entrar.';
  if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Espera um pouco e tenta de novo.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Seus dados continuam salvos no aparelho.';
  if (/exceeded the maximum allowed size/i.test(m)) return 'Arquivo grande demais para o plano atual do Supabase.';
  return m || 'Deu ruim aqui. Tenta de novo.';
}
