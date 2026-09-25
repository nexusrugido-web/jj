/* ============================================================
   QUEM PODE USAR A IA

   O /api/ia paga a Groq. Sem conta, ninguém usa; a Análise IA é
   do premium quando a cobrança está ligada; classificar vídeo é
   de quem administra. O Supabase e a Groq são de mentira aqui:
   o que se testa é a porta, não a resposta da IA.
   ============================================================ */
process.env.GROQ_API_KEY = 'teste';
process.env.VITE_SUPABASE_URL = 'https://supa.teste';
process.env.VITE_SUPABASE_ANON_KEY = 'anon';

let cobranca = false;
let enviado = null; /* o que foi pro Whisper */
globalThis.fetch = async (url, opts = {}) => {
  const token = String(opts.headers?.Authorization || '').replace('Bearer ', '');
  const json = (corpo, ok = true) => ({ ok, status: ok ? 200 : 401, json: async () => corpo, text: async () => JSON.stringify(corpo) });
  if (url.includes('/auth/v1/user')) return json({}, ['aluno', 'premium', 'admin'].includes(token));
  if (url.includes('/rpc/sou_admin')) return json(token === 'admin');
  if (url.includes('/rest/v1/chave')) return json([{ ligada: cobranca }]);
  if (url.includes('/rpc/meu_acesso')) return json([{ premium: token === 'premium' }]);
  if (url.includes('audio/transcriptions')) {
    enviado = opts.body;
    return json({ text: 'x', segments: [{ text: ' Rolei com o Maurício.' }, { text: ' Legendas pela comunidade Amara.org' }] });
  }
  if (url.includes('groq.com')) return json({ choices: [{ message: { content: '{"ok":1}' } }] });
  throw new Error(`fetch inesperado: ${url}`);
};

const { default: handler } = await import('../api/ia.js');

let ip = 0;
let corpo = null;
async function chamar(acao, token, extra = {}) {
  let status = 0;
  const res = { status(s) { status = s; return this; }, json(c) { corpo = c; return this; }, end() { return this; } };
  ip++; /* cada chamada de um "IP" diferente, pra não esbarrar no limite por minuto */
  await handler({
    method: 'POST',
    headers: { 'x-forwarded-for': `10.0.0.${ip}`, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: { acao, texto: 'x', nome: 'x', resumo: {}, videos: [], ...extra },
  }, res);
  return status;
}

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = real === esperado;
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : ` (veio ${real}, esperava ${esperado})`}`);
};

ok('o teste de "IA ligada" continua respondendo 400', await chamar('__ping'), 400);
ok('sem conta, a IA não atende', await chamar('ler_treino'), 401);
ok('token inventado não passa', await chamar('ler_treino', 'falso'), 401);
ok('aluno logado lê o treino falado', await chamar('ler_treino', 'aluno'), 200);
ok('ação que saiu do app não existe mais', await chamar('revisar_dieta', 'aluno'), 400);

cobranca = false;
ok('cobrança desligada: Análise IA pra quem tem conta', await chamar('analisar', 'aluno'), 200);
cobranca = true;
ok('cobrança ligada: Análise IA barra quem não assina', await chamar('analisar', 'aluno'), 402);
ok('cobrança ligada: assinante usa', await chamar('analisar', 'premium'), 200);
ok('cobrança ligada: admin usa', await chamar('analisar', 'admin'), 200);

/* registrar falando é do Premium, a transcrição e a leitura */
cobranca = true;
const audio = Buffer.alloc(4000, 7).toString('base64');
ok('cobrança ligada: transcrever barra quem não assina', await chamar('transcrever', 'aluno', { audio }), 402);
ok('cobrança ligada: ler o treino falado barra quem não assina', await chamar('ler_treino', 'aluno'), 402);
ok('cobrança ligada: assinante transcreve', await chamar('transcrever', 'premium', { audio, ext: 'mp4', tipo: 'audio/mp4', dica: 'Treino de jiu-jitsu.' }), 200);
ok('o áudio vai pro Whisper grande, em português, com a dica', [enviado?.get('model'), enviado?.get('language'), enviado?.get('prompt'), enviado?.get('file')?.name].join('|'),
  'whisper-large-v3|pt|Treino de jiu-jitsu.|treino.mp4');
ok('a legenda que o Whisper inventa não chega no app', corpo?.texto, 'Rolei com o Maurício.');
ok('gravação vazia não vai pra Groq', await chamar('transcrever', 'premium', { audio: '' }), 400);
cobranca = false;
ok('cobrança desligada: quem tem conta transcreve', await chamar('transcrever', 'aluno', { audio }), 200);
ok('sem conta, não transcreve', await chamar('transcrever', null, { audio }), 401);

ok('classificar vídeo: aluno não', await chamar('classificar_videos', 'aluno'), 403);
ok('classificar vídeo: admin sim', await chamar('classificar_videos', 'admin'), 200);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
