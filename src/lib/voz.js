/* ============================================================
   FALAR O TREINO (a parte que não depende de tela)

   O app grava o áudio e o Whisper (na Groq, a mesma conta da IA)
   transcreve. Antes era o reconhecimento do navegador, que no
   Android para sozinho no primeiro silêncio e reentrega a frase
   inteira a cada pedaço ("treinei com, treinei com o professor,
   treinei com o professor Felipe..."). Gravar e mandar o áudio
   resolve os dois e ainda funciona no iPhone.

   Este arquivo é usado pelo app e pelo servidor (api/ia.js).
   ============================================================ */

/* o máximo de uma gravação: um relato de treino cabe folgado, e o
   áudio do iPhone (que pode ignorar a taxa pedida) fica bem abaixo
   do limite de envio da Vercel. Precisa de mais? Grava de novo e soma. */
export const MAX_SEGUNDOS = 120;

/* o formato que o aparelho grava, na ordem de preferência. O
   iPhone só grava mp4; o Chrome e o Firefox, webm ou ogg. */
const FORMATOS = [
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/webm', ext: 'webm' },
  { mime: 'audio/mp4', ext: 'mp4' },
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
];
export function formatoDeGravacao(MR) {
  const pode = (m) => { try { return !!MR?.isTypeSupported?.(m); } catch { return false; } };
  return FORMATOS.find((f) => pode(f.mime)) || { mime: '', ext: 'mp4' };
}

const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- a dica pro Whisper ----------
   O Whisper aceita um texto curto (até 224 tokens) que ensina a
   grafia das palavras. Vai no jeito de quem fala: os nomes da
   pessoa primeiro (professor, academia, parceiros) e as palavras
   do tatame depois. */
const DO_TATAME = 'Raspagem, passagem de guarda, montada, pegada nas costas, joelho na barriga, cem quilos, meia-guarda, guarda fechada, De La Riva, mata-leão, armlock, triângulo, kimura, americana, omoplata, guilhotina, estrangulamento, single leg, double leg, vantagem, finalizei, bati.';
export function dicaDaTranscricao({ professores = [], academias = [], parceiros = [] } = {}, limite = 600) {
  const lista = (xs) => xs.map((x) => String(x || '').trim()).filter(Boolean);
  const partes = ['Treino de jiu-jitsu.'];
  const prof = lista(professores).slice(0, 4);
  const acad = lista(academias).slice(0, 3);
  if (prof.length) partes.push(`Professor ${prof.join(', ')}.`);
  if (acad.length) partes.push(`Academia ${acad.join(', ')}.`);
  let texto = partes.join(' ');
  const gente = lista(parceiros);
  if (gente.length) {
    const cabem = [];
    for (const g of gente) {
      if (`${texto} Rolei com ${[...cabem, g].join(', ')}. ${DO_TATAME}`.length > limite) break;
      cabem.push(g);
    }
    if (cabem.length) texto += ` Rolei com ${cabem.join(', ')}.`;
  }
  return `${texto} ${DO_TATAME}`.slice(0, limite).trim();
}

/* ---------- o que o Whisper inventa ----------
   Em silêncio ou barulho, o Whisper escreve frase de legenda de
   vídeo em português ("Legendas pela comunidade Amara.org",
   "Obrigado por assistir") ou devolve a própria dica. E às vezes
   repete o mesmo trecho em loop. Aqui sai tudo isso. */
const INVENTADAS = [
  /amara\.?org/i, /legendas? (pela|por)/i, /obrigad[oa] por assistir/i, /inscreva-?se/i,
  /deixe (o )?seu like/i, /ative o sininho/i, /at[eé] o pr[oó]ximo v[ií]deo/i, /tchau,? tchau/i,
  /^\s*(\.|,|!|\?|…|m[uú]sica|aplausos|risos)\s*$/i,
];

export function textoDaTranscricao(segmentos, textoInteiro = '', dica = '') {
  const dicaNorm = normal(dica);
  const lista = Array.isArray(segmentos) && segmentos.length ? segmentos : [{ text: textoInteiro }];
  const bons = [];
  for (const s of lista) {
    const t = String(s?.text || '').trim();
    if (!t) continue;
    /* o critério do próprio Whisper: provável silêncio e baixa confiança */
    if (Number(s.no_speech_prob) > 0.6 && Number(s.avg_logprob) < -1) continue;
    if (INVENTADAS.some((re) => re.test(t))) continue;
    const n = normal(t);
    if (dicaNorm && n.length > 15 && dicaNorm.includes(n)) continue;
    /* o mesmo trecho em seguida é loop */
    if (bons.length && normal(bons[bons.length - 1]) === n) continue;
    bons.push(t);
  }
  return limparRepeticao(bons.join(' '));
}

/* bloco de palavras repetido coladinho ("fiz um rola fiz um rola") */
export function limparRepeticao(txt) {
  const palavras = String(txt || '').trim().split(/\s+/).filter(Boolean);
  const saida = [];
  for (let i = 0; i < palavras.length; i++) {
    let pulou = false;
    for (let n = Math.min(12, palavras.length - i); n >= 2; n--) {
      const bloco = normal(palavras.slice(i, i + n).join(' '));
      if (bloco && bloco === normal(saida.slice(-n).join(' '))) { i += n - 1; pulou = true; break; }
    }
    if (!pulou) saida.push(palavras[i]);
  }
  return saida.join(' ');
}

/* ---------- achar o cadastro pelo nome falado ----------
   Nome igual (sem acento) primeiro; depois o primeiro nome, só se
   ele for de uma pessoa só ("Maurício" acha "Maurício Souza", mas
   "Ana" não vira "Mariana"). Sem achar, é cadastro novo. */
export function acharPorNome(lista, nome) {
  const n = normal(nome);
  if (!n) return null;
  const igual = lista.find((x) => normal(x.nome) === n);
  if (igual) return igual;
  const primeiro = (s) => normal(s).split(' ')[0];
  const mesmos = lista.filter((x) => primeiro(x.nome) === primeiro(n));
  return mesmos.length === 1 && (n.split(' ').length === 1 || normal(mesmos[0].nome).split(' ').length === 1) ? mesmos[0] : null;
}
