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
const { pedidoDaRec, DIFICULDADES, PEDIDO_DO_ESTILO, rotuloDaAula } = await import('../src/lib/necessidades.js');
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
/* R3: a saída de outra posição não completa a lista (relatório de 07/11: costas recebia 50/50) */
ok('o vídeo do lado certo vem primeiro, depois o antigo sem lado, e a saída de outra posição não entra', ids(saiu), ['sair-100kg', '100kg-antigo']);
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
ok('finalização que te pega vira técnica da biblioteca e defesa', [tomaArmlock.tecnicas, tomaArmlock.habilidades, tomaArmlock.defesa], [[ARMLOCK], ['defesa', 'escapada'], true]);
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
ok('a aula de aplicar a Americana não responde "defesa contra Americana"', ids(semAulaDaAmericana).includes('americana-short'), false);
ok('sem defesa da técnica, a defesa em geral responde, marcada como geral', [ids(semAulaDaAmericana)[0], semAulaDaAmericana[0].generico], ['defesa-geral', true]);
ok('e a tela diz que falta a aula de defesa da técnica', rotuloDaAula(semAulaDaAmericana[0], pedidoAmericana, 'Americana'), 'ainda não há aula de defesa de Americana · esta é de defesa em geral');

const comDefesaDaAmericana = [...acervoAmericana, v('defesa-americana', { tecnicas: [AMERICANA], habilidades: ['defesa'] })];
const certa = aulasPara(pedidoAmericana, { lista: comDefesaDaAmericana, quantidade: 1, soAula: true });
ok('com aula de defesa da própria técnica, ela vem primeiro', ids(certa), ['defesa-americana']);
ok('e a tela diz que ela ensina a defesa', rotuloDaAula(certa[0], pedidoAmericana, 'Americana'), 'ensina a defesa de Americana');

/* ---------- compressão (R4.1): categoria própria ----------
   Quem precisa se defender da Cadeira elétrica não recebe aula de
   chave de perna nem de chave articular só porque envolve as pernas. */
const CADEIRA = uid('Cadeira elétrica (finalização)');
const pedidoCadeira = pedidoDaRec({ intencao: 'corrigir', alvo: 'Cadeira elétrica (finalização)' });
ok('o pedido da Cadeira elétrica leva a família compressão', pedidoCadeira.familia, 'compressao');
const acervoCadeira = [
  v('defesa-heel-hook', { tecnicas: [uid('Heel hook interno')], habilidades: ['defesa', 'perna'] }),
  v('defesa-chave-de-perna', { habilidades: ['defesa', 'perna'] }),
  v('defesa-articular', { habilidades: ['defesa', 'articular'] }),
  v('defesa-geral', { habilidades: ['defesa'] }),
];
ok('defesa de compressão nunca recebe a de chave de perna nem a articular',
  ids(aulasPara(pedidoCadeira, { lista: acervoCadeira, quantidade: 4, soAula: true })), ['defesa-geral']);
const comDefesaDaCadeira = [...acervoCadeira, v('defesa-banana-split', { tecnicas: [uid('Banana split')], habilidades: ['defesa'] }), v('defesa-cadeira', { tecnicas: [CADEIRA], habilidades: ['defesa'] })];
ok('com aula da própria técnica, ela vem primeiro; a de outra compressão (Banana split) também serve',
  ids(aulasPara(pedidoCadeira, { lista: comDefesaDaCadeira, quantidade: 2, soAula: true })), ['defesa-cadeira', 'defesa-banana-split']);

const pedidoBicep = pedidoDaRec({ intencao: 'corrigir', alvo: 'Chave de bíceps (bicep slicer)' });
ok('o pedido do Bicep slicer leva a família compressão', pedidoBicep.familia, 'compressao');
const bicepAulas = aulasPara(pedidoBicep, { lista: [...acervoCadeira, v('defesa-banana-split', { tecnicas: [uid('Banana split')], habilidades: ['defesa'] })], quantidade: 1, soAula: true });
ok('quem toma Bicep slicer recebe a defesa de outra compressão', ids(bicepAulas), ['defesa-banana-split']);
/* compressão não tem família de mecânica: a mesma categoria é só "em geral" (decisão do dono, 07/11) */
ok('e a tela não finge que a aula é do Bicep slicer', rotuloDaAula(bicepAulas[0], pedidoBicep, 'Chave de bíceps (bicep slicer)'),
  'ainda não há aula de defesa de Chave de bíceps (bicep slicer) · esta é de defesa em geral');

/* ---------- R2: família de mecânica (fam), nunca a categoria ---------- */
const { CATALOGO_TECNICAS } = await import('../src/lib/tecnicas.js');
const uidDe = (nome) => CATALOGO_TECNICAS.find((t) => t.nome === nome).uid;
const pedidoArm = pedidoDaRec({ intencao: 'repetir', alvo: 'Armlock da guarda fechada' });
ok('o pedido do armlock leva a família de mecânica', pedidoArm.fam, 'fam:armlock');
const acervoArm = [
  v('chave-de-ombro-da-guarda', { tecnicas: [uidDe('Kimura')], habilidades: ['articular'], classificacao: 'automatica' }),
  v('armlock-montada', { tecnicas: [uidDe('Armlock da montada')], habilidades: ['articular'] }),
];
const arm = aulasPara(pedidoArm, { lista: acervoArm });
ok('pedir Armlock da guarda fechada traz o da montada antes da Kimura', ids(arm), ['armlock-montada', 'chave-de-ombro-da-guarda']);
ok('o da montada é da família, a Kimura é em geral', arm.map((a) => !!a.generico), [false, true]);
ok('a tela diz que a Kimura é em geral', rotuloDaAula(arm[1], pedidoArm, 'Armlock da guarda fechada'),
  'ainda não há aula de Armlock da guarda fechada · esta é de chave articular em geral');
ok('a aula exclusiva não aceita a Kimura (só aula que não é em geral destrava)',
  aulasPara(pedidoArm, { lista: [acervoArm[0]], quantidade: 1 }).every((a) => a.generico), true);
const tesoura = pedidoDaRec({ intencao: 'repetir', alvo: 'Raspagem de tesoura' });
ok('título com "raspagem" e mais nada não é da Raspagem de tesoura',
  aulasPara(tesoura, { lista: [v('Raspagem simples da guarda', { habilidades: ['raspagem'] })] }).map((a) => !!a.generico), [true]);
ok('título com "tesoura" é',
  aulasPara(tesoura, { lista: [v('Raspagem de tesoura detalhada', { habilidades: ['raspagem'] })] }).map((a) => !!a.generico), [false]);

/* ---------- katagatame: o caso do Painel (25/09) ----------
   A sugestão "Defesa contra Katagatame" trazia "O katagatame que
   apaga", que ensina a aplicar. Sem aula de defesa dele, a resposta
   é sair da posição de onde ele sai (100kg, montada), com aviso. */
const KATA = CATALOGO_KATA();
function CATALOGO_KATA() { return uid('Katagatame, braço e cabeça'); }
const pedidoKata = pedidoDaRec({ intencao: 'corrigir', alvo: 'Katagatame dos 100kg' });
ok('a defesa do katagatame procura a saída de baixo da posição de onde ele sai', pedidoKata.posicoes.sort(), ['cem:baixo']);
const acervoKata = [
  v('O katagatame que apaga', { tecnicas: [KATA], habilidades: ['estrangulamento', 'finalizacao'] }),
  v('defesa-geral', { habilidades: ['defesa'] }),
  v('Como sair de baixo na 100kg', { posicaoLado: ['cem:baixo'], habilidades: ['escapada'] }),
  v('segurar-100kg', { posicaoLado: ['cem:cima'], habilidades: ['controle'] }),
];
const kata = aulasPara(pedidoKata, { lista: acervoKata, quantidade: 3, soAula: true });
ok('a aula de aplicar o katagatame não aparece', ids(kata).includes('O katagatame que apaga'), false);
ok('a saída do 100kg vem antes da defesa em geral', ids(kata), ['Como sair de baixo na 100kg', 'defesa-geral']);
ok('e a tela explica por que essa aula', rotuloDaAula(kata[0], pedidoKata, 'Katagatame dos 100kg'),
  'ainda não há aula de defesa de Katagatame dos 100kg · esta ensina a sair do 100kg, de onde ela costuma sair');
const comDefesaDoKata = aulasPara(pedidoKata, { lista: [...acervoKata, v('Defesa do katagatame', { tecnicas: [KATA], habilidades: ['defesa'] })], quantidade: 1, soAula: true });
ok('quando a aula de defesa do katagatame entrar, ela ganha', ids(comDefesaDoKata), ['Defesa do katagatame']);

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

/* ---------- posição que já chega no rola (o 100kg do Painel, 25/09) ---------- */
const { vezesNaPosicao } = await import('../src/lib/graus.js');
const rolasCom100kg = [{ sessionId: 1, contexto: 'rola', ptsMeus: ['passagem'] }, { sessionId: 1, contexto: 'rola', ptsMeus: ['queda'] }, { sessionId: 2, contexto: 'drill', ptsMeus: ['passagem'] }];
const treinosDoTeste = [{ id: 1, tipo: 'gi', data: '2026-09-20' }, { id: 2, tipo: 'drill', data: '2026-09-21' }];
ok('passagem e queda te levam pro 100kg: conta como rola, drill não', vezesNaPosicao('Controle lateral, 100kg', rolasCom100kg, treinosDoTeste), 2);
ok('técnica que não é posição fica fora dessa conta', vezesNaPosicao('Americana', rolasCom100kg, treinosDoTeste), null);
const soNoDrill = [{ nome: 'Controle lateral, 100kg', soDrill: true, usos: 3, usosDrill: 3, usosResistencia: 0, grau: 1, progresso: 50 }];
ok('100kg que já aparece no rola não vira "levar pro rola"',
  gerarRecomendacoes({ tecnicas: soNoDrill, rolls: rolasCom100kg, sessions: treinosDoTeste }).some((r) => r.intencao === 'consolidar'), false);
ok('sem chegar lá no rola, a sugestão continua', gerarRecomendacoes({ tecnicas: soNoDrill, rolls: [], sessions: [] }).some((r) => r.intencao === 'consolidar'), true);

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
ok('sem contar derrota no texto', /\d/.test(`${recPesado?.texto} ${recPesado?.evidencia}`), false);
ok('com chave própria, que não se confunde com a da posição', chaveDaRec(recPesado), 'corrigir:contra_pesado');
ok('e puxa vídeo pela situação', pedidoDaRec(recPesado).situacoes, ['contra_pesado']);

/* ---------- R3: defesa pelo contra ---------- */
const tomaArm = pedidoDaRec({ intencao: 'corrigir', alvo: 'Armlock da guarda fechada' });
const DEF_ARM = uidDe('Defesa de armlock (esconder o cotovelo)');
const DEF_TRI = uidDe('Defesa de triângulo (postura)');
ok('o pedido de quem toma armlock leva as defesas pelo contra', tomaArm.defesas.includes(DEF_ARM), true);
ok('e nunca a defesa de triângulo', tomaArm.defesas.includes(DEF_TRI), false);
const acervoDef = [
  v('defesa-em-geral', { habilidades: ['defesa'] }),
  v('sair-de-baixo-da-guarda', { posicaoLado: ['guarda_fechada:cima'], habilidades: ['escapada'] }),
  v('esconder-o-cotovelo', { tecnicas: [DEF_ARM] }),
  v('Aula completa de ataques da guarda fechada', { tecnicas: [uidDe('Armlock da guarda fechada')], habilidades: ['finalizacao', 'defesa'] }),
  v('postura-no-triangulo', { tecnicas: [DEF_TRI], habilidades: ['defesa'] }),
];
const defArm = aulasPara(tomaArm, { lista: acervoDef, quantidade: 5 });
ok('quem toma armlock recebe a defesa de armlock primeiro, depois a saída, depois a geral', ids(defArm), ['esconder-o-cotovelo', 'sair-de-baixo-da-guarda', 'defesa-em-geral']);
ok('a aula de ataques não entra num pedido de defesa', ids(defArm).includes('Aula completa de ataques da guarda fechada'), false);
ok('a tela diz que ensina a defesa do armlock', rotuloDaAula(defArm[0], tomaArm, 'Armlock da guarda fechada'), 'ensina a defesa de Armlock da guarda fechada');
const daMontada = v('defender-armlock-da-montada', { tecnicas: [uidDe('Armlock da montada')], habilidades: ['defesa'] });
ok('defesa de outro armlock (mesma família) não vira "defesa de outra chave"',
  rotuloDaAula(aulasPara(tomaArm, { lista: [daMontada], quantidade: 1 })[0], tomaArm, 'Armlock da guarda fechada'), 'ensina a defesa de Armlock da guarda fechada');
const tomaTri = pedidoDaRec({ intencao: 'corrigir', alvo: 'Triângulo' });
ok('quem toma triângulo não recebe a defesa de armlock', ids(aulasPara(tomaTri, { lista: acervoDef, quantidade: 5 })).includes('esconder-o-cotovelo'), false);
ok('e recebe a de triângulo primeiro', ids(aulasPara(tomaTri, { lista: acervoDef, quantidade: 5 }))[0], 'postura-no-triangulo');
const queda = pedidoDaRec({ intencao: 'corrigir', posicao: 'queda_sofrida' });
ok('quem leva queda não recebe defesa de finalização',
  ids(aulasPara(queda, { lista: [...acervoDef, v('sprawl-na-queda', { posicaoLado: ['em_pe:neutro'], habilidades: ['defesa'] })], quantidade: 5 })).includes('esconder-o-cotovelo'), false);

/* ---------- R4: a recomendação acha a técnica pelo uid do rola ---------- */
const { meusBuracos } = await import('../src/lib/graus.js');
const ARM_GF = uidDe('Armlock da guarda fechada');
const sessaoR4 = [{ id: 1, data: '2026-11-01', tipo: 'livre' }];
const rolaR4 = (nome, tecUid) => ({ id: Math.random(), sessionId: 1, subsSofridas: [nome], ...(tecUid ? { tecUid } : {}) });
/* nome que a busca não acha, mas o rola guardou o uid (renomeado na biblioteca do atleta) */
const renomeada = [{ uid: ARM_GF, nome: 'Armlock que o Zé me pega', criadoEm: 1 }];
const burR4 = meusBuracos([rolaR4('Armlock que o Zé me pega', { [ARM_GF]: 'Armlock da guarda fechada' }), rolaR4('Armlock que o Zé me pega', { [ARM_GF]: 'Armlock da guarda fechada' })], [], sessaoR4, 'branca', 8, renomeada);
ok('o buraco leva o uid que o rola guardou', burR4[0].uid, ARM_GF);
const recR4 = gerarRecomendacoes({ buracos: burR4 }).find((r) => r.intencao === 'corrigir' && r.alvo);
ok('a recomendação leva o uid do buraco', recR4.uid, ARM_GF);
ok('a chave da recomendação continua pelo nome (as já feitas valem)', chaveDaRec(recR4), 'corrigir:Armlock que o Zé me pega');
const pedR4 = pedidoDaRec(recR4, renomeada);
ok('técnica renomeada continua achando a técnica pelo uid', pedR4.tecnicas.includes(ARM_GF), true);
ok('e leva a família e as defesas dela', [pedR4.fam, pedR4.defesas.includes(DEF_ARM)], ['fam:armlock', true]);
ok('técnica renomeada continua achando a aula', ids(aulasPara(pedR4, { lista: acervoDef, quantidade: 1 })), ['esconder-o-cotovelo']);
ok('sem uid (rola antigo), o mesmo nome não acha técnica nenhuma', pedidoDaRec({ intencao: 'corrigir', alvo: 'Armlock que o Zé me pega' }).tecnicas, []);
ok('rola antigo sem tecUid: o buraco fica sem uid', meusBuracos([rolaR4('Armlock da guarda fechada'), rolaR4('Armlock da guarda fechada')], [], sessaoR4)[0].uid, null);
ok('sem uid, a busca pelo nome continua achando', pedidoDaRec({ intencao: 'corrigir', alvo: 'Armlock da guarda fechada' }).tecnicas.includes(ARM_GF), true);
/* técnica própria do atleta: só entra na família com a fam confirmada */
const PROP = 'propria-kimura-do-ze';
const comFam = [{ uid: PROP, nome: 'Kimura do Zé', propria: 1, fam: 'fam:kimura', criadoEm: 1 }];
const semFam = [{ uid: PROP, nome: 'Kimura do Zé', propria: 1, criadoEm: 1 }];
const acervoKim = [v('kimura-dos-100kg', { t: 'Chave de ombro por cima', tecnicas: [uidDe('Kimura dos 100kg')], habilidades: ['articular'] })];
const pedComFam = pedidoDaRec({ intencao: 'repetir', alvo: 'Kimura do Zé', uid: PROP }, comFam);
ok('própria com fam confirmada leva a família', [pedComFam.tecnicas, pedComFam.fam, pedComFam.familia], [[PROP], 'fam:kimura', 'articular']);
ok('e a aula da família vem como da família, não em geral', aulasPara(pedComFam, { lista: acervoKim, quantidade: 1 }).map((a) => [a.id, !!a.generico]), [['kimura-dos-100kg', false]]);
const pedSemFam = pedidoDaRec({ intencao: 'repetir', alvo: 'Kimura do Zé', uid: PROP }, semFam);
ok('própria sem fam não entra em família nenhuma', [pedSemFam.fam, pedSemFam.familia], [null, null]);
ok('e a aula de kimura não vem como da família', aulasPara(pedSemFam, { lista: acervoKim, quantidade: 1 }).every((a) => a.generico || a.reserva), true);
ok('defesa contra a própria com fam: pela família', pedidoDaRec({ intencao: 'corrigir', alvo: 'Kimura do Zé', uid: PROP }, comFam).defesas.length > 0, true);
ok('defesa contra a própria sem fam: nenhuma defesa do catálogo', pedidoDaRec({ intencao: 'corrigir', alvo: 'Kimura do Zé', uid: PROP }, semFam).defesas, []);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
