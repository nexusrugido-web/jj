import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   NENHUM ERRO DE LOGIN EM INGLÊS

   O Supabase responde em inglês. Quem está preso fora da conta
   precisa ler o que fazer, e "Auth session missing!" não diz nada.
   ============================================================ */
const { traduzErro } = await import('../src/lib/supabase.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = real === esperado;
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}`);
};
const emPortugues = (nome, msg) => {
  const t = traduzErro(new Error(msg));
  const bom = t !== msg;
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(t)}`);
};

emPortugues('senha errada', 'Invalid login credentials');
emPortugues('e-mail não confirmado', 'Email not confirmed');
emPortugues('já tem conta', 'User already registered');
emPortugues('link de senha vencido', 'Auth session missing!');
emPortugues('link vencido (código)', 'Email link is invalid or has expired');
emPortugues('senha nova igual à antiga', 'New password should be different from the old password.');
emPortugues('e-mail mal escrito', 'Unable to validate email address: invalid format');
emPortugues('pediu de novo rápido demais', 'For security purposes, you can only request this after 37 seconds.');
emPortugues('muitas tentativas', 'Email rate limit exceeded');
emPortugues('sem internet', 'Failed to fetch');
ok('link vencido manda pedir outro', traduzErro(new Error('Auth session missing!')).includes('Esqueci a senha'), true);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
