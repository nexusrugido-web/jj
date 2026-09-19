import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   O MOTOR TEM QUE ACHAR O VÍDEO CERTO PRA PESSOA CERTA

   Um acervo pequeno, montado pra cada regra: o lado da posição, a
   técnica pela classificação e pelo título, a técnica errada que
   não pode aparecer, o visto que vai pro fim, a faixa, a confiança
   da classificação, a situação do formulário, e o vídeo novo que
   passa na frente do antigo quando ensina melhor.
   ============================================================ */

const { aulasPara } = await import('../src/lib/motor.js');
const { pedidoDaRec, DIFICULDADES, PEDIDO_DO_ESTILO } = await import('../src/lib/necessidades.js');
const { gerarRecomendacoes, chaveDaRec, contraMaisPesado } = await import('../src/lib/recomendar.js');
const V = await import('../src/lib/vocab.js');
const { SEED } = await import('../src/db/seed.js');
const { uidEstavel, chaveNome } = await import('../src/lib/uid.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

const uid = (pt) => uidEstavel(chaveNome('techniques', pt));
const ARMLOCK = uid('Chave de braço, armlock');

const v = (id, extra = {}) => ({
  id, t: id, d: 400, k: 'aula', tm: ['geral'], p: [],
  posicaoLado: [], habilidades: [], tecnicas: [], situacoes: [],
  formato: null, nivel: null, classificacao: 'automatica', ...extra,
});
const ids = (lista) => lista.map((a) => a.id);

/* ---------- posição e lado ---------- */
const acervoPosicao = [
  v('segurar-100kg', { posicaoLado: ['cem:cima'], habilidades: ['controle'] }),
  v('sair-100kg', { posicaoLado: ['cem:baixo'], habilidades: ['escapada'] }),
  v('100kg-antigo', { posicaoLado: ['cem:neutro'], habilidades: ['escapada'], classificacao: 'legado' }),
  v('sair-montada', { posicaoLado: ['montada:baixo'], habilidades: ['escapada'] }),
  v('raspar', { posicaoLado: ['guarda_fechada:baixo'], habilidades: ['raspagem'] }),
];
const presoNo100kg = pedidoDaRec({ intencao: 'corrigir', posicao: 'cem_baixo' });
ok('preso embaixo do 100kg vira pedido com lado', presoNo100kg.posicoes, ['cem:baixo']);
const saiu = aulasPara(presoNo100kg, { lista: acervoPosicao, quantidade: 5 });
ok('o vídeo do lado certo vem primeiro, depois o antigo sem lado, depois outra posição de escapada', ids(saiu), ['sair-100kg', '100kg-antigo', 'sair-montada']);
ok('a aula de segurar por cima não entra pra quem quer sair de baixo', ids(saiu).includes('segurar-100kg'), false);
ok('cada vídeo diz por que foi escolhido', saiu[0].porque, ['100kg por baixo', 'Escapada']);

/* ---------- técnica ---------- */
const acervoTecnica = [
  v('defesa-classificada', { tecnicas: [ARMLOCK], habilidades: ['defesa'] }),
  v('Como defender o ARM LOCK', { habilidades: ['defesa'], classificacao: 'legado' }),
  v('Defesa de kimura na guarda', { habilidades: ['defesa'] }),
  v('defesa-geral', { habilidades: ['defesa'] }),
];
const tomaArmlock = pedidoDaRec({ intencao: 'corrigir', alvo: 'Chave de braço, armlock' });
ok('finalização que te pega vira técnica da biblioteca e defesa', [tomaArmlock.tecnicas, tomaArmlock.habilidades], [[ARMLOCK], ['defesa']]);
const achou = ids(aulasPara(tomaArmlock, { lista: acervoTecnica, quantidade: 5 }));
ok('classificado com a técnica vem antes do que só cita no título', achou.slice(0, 2), ['defesa-classificada', 'Como defender o ARM LOCK']);
ok('vídeo de outra técnica não aparece como resposta', achou.includes('Defesa de kimura na guarda'), false);
ok('defesa geral ainda entra, depois', achou[2], 'defesa-geral');

const minhaTecnica = pedidoDaRec({ intencao: 'repetir', alvo: 'Triângulo' });
ok('técnica sua puxa a habilidade e a posição de onde ela sai', [minhaTecnica.habilidades, minhaTecnica.posicoes.length > 0], [['estrangulamento'], true]);
ok('repetir pede drill primeiro', minhaTecnica.formatos[0], 'drill');

/* ---------- a Americana: técnica certa ou resposta geral, nunca outra técnica ---------- */
const AMERICANA = uid('Americana');
const ESTRANG_X = uid('Estrangulamento de braço em X');
const KIMURA = uid('Kimura');
const pedidoAmericana = pedidoDaRec({ intencao: 'corrigir', alvo: 'Americana' });
ok('o pedido leva a família da técnica', pedidoAmericana.familia, 'articular');

const acervoAmericana = [
  v('defesa-estrangulamento-x', { tecnicas: [ESTRANG_X], habilidades: ['defesa', 'escapada', 'finalizacao'] }),
  v('defesa-estrangulamento-legado', { habilidades: ['estrangulamento', 'defesa'], classificacao: 'legado' }),
  v('defesa-geral', { habilidades: ['defesa'] }),
  v('americana-short', { k: 'short', d: 60, tecnicas: [AMERICANA], habilidades: ['articular'] }),
];
const semAulaDaAmericana = aulasPara(pedidoAmericana, { lista: acervoAmericana, quantidade: 4, soAula: true });
ok('defesa de estrangulamento nunca responde defesa contra Americana',
  ids(semAulaDaAmericana).filter((x) => x.startsWith('defesa-estrang')), []);
ok('o short da Americana ganha da aula longa de defesa em geral', ids(semAulaDaAmericana)[0], 'americana-short');
ok('a defesa em geral entra depois, marcada como geral', semAulaDaAmericana.find((a) => a.id === 'defesa-geral')?.generico, true);
ok('o vídeo da técnica não é geral', semAulaDaAmericana[0].generico, false);

const comDefesaDaAmericana = [...acervoAmericana, v('defesa-americana', { tecnicas: [AMERICANA], habilidades: ['defesa'] })];
ok('com aula de defesa da própria técnica, ela vem primeiro',
  ids(aulasPara(pedidoAmericana, { lista: comDefesaDaAmericana, quantidade: 1, soAula: true })), ['defesa-americana']);

const mesmaFamilia = [
  v('Defesa de chaves no ombro', { tecnicas: [KIMURA], habilidades: ['defesa'] }),
  v('Proteja os braços', { habilidades: ['articular', 'defesa'], classificacao: 'legado' }),
  v('defesa-geral', { habilidades: ['defesa'] }),
];
const parente = aulasPara(pedidoAmericana, { lista: mesmaFamilia, quantidade: 3, soAula: true });
ok('defesa da mesma família (chave articular) vem antes da geral', ids(parente), ['Defesa de chaves no ombro', 'Proteja os braços', 'defesa-geral']);
ok('e diz a família', parente[0].porque.includes('Chave articular'), true);
ok('título que fala de outra técnica da família não responde',
  ids(aulasPara(pedidoAmericana, { lista: [v('Defesa de kimura', { tecnicas: [KIMURA], habilidades: ['defesa'] })], soAula: true })), []);

const soGeral = aulasPara(pedidoAmericana, { lista: [v('defesa-geral', { habilidades: ['defesa'] })], soAula: true });
ok('só com aula geral: ela vem, marcada, pra tela dizer que falta a da técnica', [ids(soGeral), soGeral[0].generico], [['defesa-geral'], true]);

const naoTecnico = aulasPara({ habilidades: ['passagem'] }, { lista: [v('p-short', { k: 'short', habilidades: ['passagem'] }), v('p-aula', { habilidades: ['passagem'] })], soAula: true });
ok('pedido que não é de técnica continua só com aula longa', ids(naoTecnico), ['p-aula']);

/* ---------- ordem ---------- */
const iguais = [v('visto', { habilidades: ['passagem'] }), v('novo', { habilidades: ['passagem'] })];
ok('visto vai pro fim', ids(aulasPara({ habilidades: ['passagem'] }, { lista: iguais, vistas: ['visto'] })), ['novo', 'visto']);

const confianca = [v('revisar', { habilidades: ['passagem'], classificacao: 'revisar' }), v('conferido', { habilidades: ['passagem'], classificacao: 'revisada' })];
ok('conferido na mão ganha do que a IA ficou em dúvida', ids(aulasPara({ habilidades: ['passagem'] }, { lista: confianca }))[0], 'conferido');

const niveis = [v('avancado', { habilidades: ['passagem'], nivel: 'avancado' }), v('fundamento', { habilidades: ['passagem'], nivel: 'fundamento' })];
ok('faixa branca recebe fundamento antes de avançado', ids(aulasPara({ habilidades: ['passagem'] }, { lista: niveis, faixa: 'branca' }))[0], 'fundamento');
ok('faixa preta recebe avançado antes de fundamento', ids(aulasPara({ habilidades: ['passagem'] }, { lista: niveis, faixa: 'preta' }))[0], 'avancado');

const formatos = [v('tecnica', { habilidades: ['passagem'], formato: 'tecnica' }), v('drill', { habilidades: ['passagem'], formato: 'drill' })];
ok('o formato que o momento pede vem antes', ids(aulasPara({ habilidades: ['passagem'], formatos: ['drill', 'tecnica'] }, { lista: formatos }))[0], 'drill');

/* o vídeo novo não tem vantagem nem desvantagem por ser novo:
   ganha quando ensina mais exatamente o que foi pedido */
const novoMelhor = [
  v('antigo', { posicaoLado: ['cem:neutro'], habilidades: ['escapada'], classificacao: 'legado' }),
  v('novo', { posicaoLado: ['cem:baixo'], habilidades: ['escapada'], situacoes: ['contra_pesado'] }),
];
ok('vídeo novo que ensina melhor passa na frente do antigo', ids(aulasPara({ posicoes: ['cem:baixo'], habilidades: ['escapada'] }, { lista: novoMelhor }))[0], 'novo');

/* ---------- curto e longo ---------- */
const duracoes = [v('forte-longo', { habilidades: ['passagem', 'controle'], d: 1500 }), v('fraco-curto', { habilidades: ['controle'], d: 200 }), v('forte-curto', { habilidades: ['passagem', 'controle'], d: 300 })];
const curto = ids(aulasPara({ habilidades: ['passagem', 'controle'] }, { lista: duracoes, faixa: 'branca', quantidade: 3 }));
ok('aula curta e fraca não passa na frente da certa', curto.indexOf('fraco-curto'), 2);

/* ---------- sem nada do assunto ---------- */
const semAssunto = [v('conceito', { formato: 'conceito' }), v('outra', { habilidades: ['queda'] })];
const reserva = aulasPara({ habilidades: ['passagem'] }, { lista: semAssunto });
ok('sem vídeo do assunto, cai no porquê das coisas', ids(reserva), ['conceito']);
ok('e não inventa motivo', reserva[0].porque, []);

const soShort = [v('short-certo', { habilidades: ['passagem'], k: 'short' })];
ok('sem aula longa do assunto, um short do assunto certo', ids(aulasPara({ habilidades: ['passagem'] }, { lista: soShort, soAula: true })), ['short-certo']);
ok('lista excluída não volta', ids(aulasPara({ habilidades: ['passagem'] }, { lista: iguais, excluir: ['novo'] })), ['visto']);

/* ---------- as dificuldades do formulário ---------- */
const acervoSituacao = [
  v('Como raspar sendo leve e fraco', { classificacao: 'legado' }),
  v('pesado-classificado', { situacoes: ['contra_pesado'] }),
  v('qualquer'),
];
const pesado = DIFICULDADES.find((d) => d.id === 'pesado');
ok('"contra mais pesado" acha o classificado e o do título antigo', ids(aulasPara(pesado.pedido, { lista: acervoSituacao, quantidade: 5 })), ['pesado-classificado', 'Como raspar sendo leve e fraco']);

const validas = {
  posicoes: new Set(V.POSICOES_LADO), habilidades: new Set(V.idsDe(V.HABILIDADES)),
  situacoes: new Set(V.idsDe(V.SITUACOES)), formatos: new Set(V.idsDe(V.FORMATOS)),
};
const foraDoVocab = (pedido) => Object.entries(validas)
  .flatMap(([campo, set]) => (pedido[campo] || []).filter((x) => !set.has(x)));
ok('toda dificuldade pede só o que existe no vocabulário', DIFICULDADES.flatMap((d) => foraDoVocab(d.pedido)), []);
ok('todo estilo pede só o que existe no vocabulário', Object.values(PEDIDO_DO_ESTILO).flatMap(foraDoVocab), []);
ok('as dificuldades novas do formulário estão lá', ['pesado', 'forca', 'competir'].every((id) => DIFICULDADES.some((d) => d.id === id)), true);

/* ---------- contra quem é mais pesado, pelos rolas ---------- */
const rola = (pesoRel, perdeu) => ({ pesoRel, ptsMeus: perdeu ? [] : ['passagem'], ptsDele: perdeu ? ['passagem'] : [] });
const rolasPesados = [
  ...[1, 1, 1, 0, 1].map((p) => rola('pesado', p)),
  ...[0, 0, 1, 0].map((p) => rola('similar', p)),
];
ok('perde bem mais contra mais pesado: aparece', contraMaisPesado(rolasPesados), { n: 5, perdas: 4, outros: 25 });
ok('poucos rolas contra pesado: não tira conclusão', contraMaisPesado(rolasPesados.slice(2)), null);
ok('perde igual contra todo mundo: não é o peso', contraMaisPesado([...[1, 1, 0, 1].map((p) => rola('pesado', p)), ...[1, 1, 1].map((p) => rola('similar', p))]), null);

const recs = gerarRecomendacoes({ rolls: rolasPesados, sessions: [], limite: 9 });
const recPesado = recs.find((r) => r.situacao === 'contra_pesado');
ok('vira recomendação com nome', recPesado?.titulo, 'Contra quem é mais pesado');
ok('com chave própria, que não se confunde com a da posição', chaveDaRec(recPesado), 'corrigir:contra_pesado');
ok('e puxa vídeo pela situação', pedidoDaRec(recPesado).situacoes, ['contra_pesado']);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
