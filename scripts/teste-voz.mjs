import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   FALAR O TREINO

   O que dava errado na voz: o eco do Android, a frase de legenda
   que o Whisper inventa no silêncio, a dica que volta como texto e
   o parceiro que virava outra pessoa pelo pedaço do nome.
   ============================================================ */
const { textoDaTranscricao, limparRepeticao, dicaDaTranscricao, acharPorNome, formatoDeGravacao } = await import('../src/lib/voz.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

/* transcrição */
ok('trecho normal passa', textoDaTranscricao([{ text: ' Treinei com o professor Felipe.' }, { text: ' Fiz um rola com o Maurício.' }]),
  'Treinei com o professor Felipe. Fiz um rola com o Maurício.');
ok('legenda inventada no silêncio sai', textoDaTranscricao([{ text: 'Rolei com o Ismael.' }, { text: 'Legendas pela comunidade Amara.org' }]), 'Rolei com o Ismael.');
ok('"obrigado por assistir" sai', textoDaTranscricao([{ text: 'Obrigado por assistir!' }]), '');
ok('silêncio de baixa confiança sai', textoDaTranscricao([{ text: 'Passei a guarda.' }, { text: 'Ah.', no_speech_prob: 0.9, avg_logprob: -1.4 }]), 'Passei a guarda.');
ok('fala com confiança fica mesmo com no_speech alto', textoDaTranscricao([{ text: 'Bati de triângulo.', no_speech_prob: 0.7, avg_logprob: -0.3 }]), 'Bati de triângulo.');
ok('trecho repetido em loop sai', textoDaTranscricao([{ text: 'Fiz duas quedas.' }, { text: 'Fiz duas quedas.' }, { text: 'Fiz duas quedas.' }]), 'Fiz duas quedas.');
const dica = dicaDaTranscricao({ professores: ['Felipe'], parceiros: ['Maurício', 'Ismael'] });
ok('a dica que volta como texto sai', textoDaTranscricao([{ text: 'Raspagem, passagem de guarda, montada, pegada nas costas.' }], '', dica), '');
ok('sem segmentos, usa o texto inteiro', textoDaTranscricao(null, 'Open mat de uma hora.'), 'Open mat de uma hora.');
ok('bloco repetido coladinho sai', limparRepeticao('fiz um rola fiz um rola com o Maurício'), 'fiz um rola com o Maurício');

/* a dica */
ok('a dica traz os nomes da pessoa', /Professor Felipe\. .*Rolei com Maurício, Ismael\./.test(dica), true);
const muitos = Array.from({ length: 200 }, (_, i) => `Parceiro${i}`);
ok('a dica cabe no limite do Whisper', dicaDaTranscricao({ parceiros: muitos }).length <= 600, true);
ok('com muita gente, as palavras do tatame continuam', dicaDaTranscricao({ parceiros: muitos }).includes('mata-leão'), true);

/* o cadastro pelo nome */
const gente = [{ id: 1, nome: 'Maurício Souza' }, { id: 2, nome: 'Mariana' }, { id: 3, nome: 'Ismael' }, { id: 4, nome: 'João Pedro' }, { id: 5, nome: 'João Paulo' }];
ok('nome sem acento acha', acharPorNome(gente, 'ismael')?.id, 3);
ok('primeiro nome acha quando é de uma pessoa só', acharPorNome(gente, 'Mauricio')?.id, 1);
ok('pedaço do nome não vira outra pessoa', acharPorNome(gente, 'Ana'), null);
ok('primeiro nome de duas pessoas não chuta', acharPorNome(gente, 'João'), null);
ok('sobrenome diferente é gente nova', acharPorNome(gente, 'Maurício Lima'), null);
ok('nome vazio não acha', acharPorNome(gente, ''), null);

/* o formato */
ok('iPhone grava mp4', formatoDeGravacao({ isTypeSupported: (m) => m === 'audio/mp4' }).ext, 'mp4');
ok('Chrome grava webm com opus', formatoDeGravacao({ isTypeSupported: (m) => m.startsWith('audio/webm') }).mime, 'audio/webm;codecs=opus');

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
