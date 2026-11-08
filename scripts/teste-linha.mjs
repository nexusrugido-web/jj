import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   LINHA DA LUTA (R7.5), a parte pura
   Objetivo (do plano), início real (onde a luta começou) e execução
   (a linha) separados. Cenário principal: plano "Armlock pela
   norte-sul", rola que começa em pé: finta em texto, Single Leg do
   catálogo, derrubou, onde a luta ficou, passagem, norte-sul, armlock.
   Também: tentativas, o que ele fez, r.plano tirado da linha (R7.3 lê
   igual), finalizações e pontos sem duplicar, rola antigo e desfazer.
   ============================================================ */
const L = await import('../src/lib/linha.js');
const { taxaPorEtapa, porPonto, alcancouObjetivo } = await import('../src/lib/planos.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

const b = { seFalhar: '', proxima: '', detalhe: '' };
/* plano da guarda: preparação, finta, armlock e as defesas */
const PLANO = {
  uid: 'pl1', nome: 'Guarda fechada', posicao: 'Guarda fechada', posicaoId: 2, objetivo: 'Finalizar', objetivoTipo: 'finalizar',
  passos: [
    { id: 'pre', lig: 'lPre', tipo: 'preparacao', descricao: 'Quebrar a postura', gatilho: '', pai: null, via: null },
    { id: 'fin', lig: 'lFin', tipo: 'finta', descricao: 'Simular armlock', gatilho: '', pai: 0, via: 'feita' },
    { id: 'arm', lig: 'lArm', acao: 'Armlock', gatilho: 'recolheu o braço', pai: 1, via: 'reagiu' },
    { id: 'tri', lig: 'lTri', acao: 'Triângulo', gatilho: 'empilhou', pai: 2, via: 'defendeu' },
    { id: 'kim', lig: 'lKim', acao: 'Kimura', gatilho: 'puxou o braço', pai: 2, via: 'defendeu' },
    { id: 'omo', lig: 'lOmo', acao: 'Omoplata', gatilho: 'tirou a cabeça', pai: 3, via: 'defendeu' },
    { id: 'sit', lig: 'lSit', tipo: 'situacao', acao: 'Meia-guarda', gatilho: 'girou pra fora', pai: 2, via: 'escapou' },
    { id: 'ras', lig: 'lRas', acao: 'Raspagem de tesoura', gatilho: '', pai: 6, via: 'retoma' },
    { id: 'pre2', lig: 'lPre2', tipo: 'preparacao', descricao: 'Pegar a gola', gatilho: 'afastou o quadril', pai: 0, via: 'impediu' },
  ].map((x) => ({ ...b, ...x })),
  ligacoes: [{ id: 'xVolta', de: 'arm', via: 'escapou', gatilho: 'abriu a guarda', para: null }],
};
/* plano do exemplo do dono: objetivo armlock pela norte-sul */
const NS = {
  uid: 'ns', nome: 'Armlock pela norte-sul', posicao: 'Norte-sul', posicaoId: 9, objetivo: 'Finalizar', objetivoTipo: 'finalizar', finalizacaoPreferida: 'Armlock da norte-sul',
  passos: [
    { id: 'nsArm', lig: 'lNsArm', acao: 'Armlock da norte-sul', gatilho: '', pai: null, via: null },
    { id: 'nsKim', lig: 'lNsKim', acao: 'Kimura da norte-sul', gatilho: 'escondeu o braço', pai: 0, via: 'defendeu' },
  ].map((x) => ({ ...b, ...x })),
};
const POSICOES = [
  { id: 1, slug: 'em_pe', nome: 'De pé', familia: 'em_pe' }, { id: 2, slug: 'guarda_fechada', nome: 'Guarda fechada', familia: 'guarda' },
  { id: 3, slug: 'meia_topo', nome: 'Meia-guarda, por cima', familia: 'dominante' }, { id: 4, slug: 'cem_quilos', nome: '100kg', familia: 'dominante' },
  { id: 5, slug: 'montada', nome: 'Montada', familia: 'dominante' }, { id: 6, slug: 'passando', nome: 'Combatendo a guarda, por cima', familia: 'neutra' },
  { id: 9, slug: 'norte_sul', nome: 'Norte-sul', familia: 'dominante' }, { id: 10, slug: 'meia_guarda', nome: 'Meia-guarda', familia: 'guarda' },
];
const FIN = new Set(['Armlock', 'Triângulo', 'Kimura', 'Omoplata', 'Americana', 'Mata-leão', 'Armlock da norte-sul', 'Kimura da norte-sul']);
const CAT = { 'Raspagem de tesoura': 'raspagem', 'Single Leg': 'queda', 'Passagem toreando': 'passagem' };
const DESTINO = { 'Single Leg': 'passando', 'Passagem toreando': 'cem_quilos', 'Raspagem de tesoura': 'montada' };
const ORIGEM = { 'Armlock da norte-sul': 'norte_sul', 'Kimura da norte-sul': 'norte_sul', 'Raspagem de tesoura': 'guarda_fechada' };
const destinoDe = Object.assign((nome) => (FIN.has(nome) ? { slug: 'finalizacao', nome: 'Finalização' } : DESTINO[nome] ? POSICOES.find((p) => p.slug === DESTINO[nome]) : null), {
  tecnicas: [], posicoes: POSICOES,
  categoriaDe: (nome) => CAT[nome] || (FIN.has(nome) ? 'articular' : null),
  origemDe: (nome) => ORIGEM[nome] || null,
  slugDoPlano: (p) => POSICOES.find((x) => x.id === p?.posicaoId)?.slug || '',
});
const PLANOS = { pl1: PLANO, ns: NS };
const planoDe = (uid) => PLANOS[uid] || null;
const perg = (l) => L.pergunta(l, planoDe, destinoDe);
const seq = (l) => l.seqs[l.seqs.length - 1];
const prox = (l, p = PLANO) => L.proximasDoPlano(p, seq(l), destinoDe).map((x) => `${x.golpe}|${x.lig}`);
const vazio = () => L.linhaVazia();
const doPlano = (l, id, p = PLANO) => { const x = L.proximasDoPlano(p, seq(l), destinoDe).find((y) => y.peca === id); return L.fazer(l, { peca: id, lig: x?.lig || '' }, p); };
const rola = (extra = {}) => ({ plano: { uid: 'pl1', peca: null, caminho: [], encaixou: false }, subsAplicadas: [], subsSofridas: [], ptsMeus: [], tecMeus: {}, ...extra });
const aplicar = (r, l) => L.aplicarLinha(r, l, { planoDe, destinoDe });
const nomesRes = (plano, p) => L.resultadosDe(plano, p, destinoDe).map((x) => x.nome);

/* a corrente até o armlock, começando na guarda (a posição do plano) */
const ateArmlock = () => {
  let l = L.iniciar(vazio(), { pos: 'guarda_fechada' }, 'pl1');
  l = doPlano(l, 'pre'); l = L.responder(l, 'feita');
  l = doPlano(l, 'fin'); l = L.responder(l, 'reagiu');
  return doPlano(l, 'arm');
};

/* 0. O CENÁRIO DO DONO: em pé até o armlock pela norte-sul */
{
  const r0 = rola({ plano: { uid: 'ns', peca: null, caminho: [], encaixou: false } });
  let l = vazio();
  ok('0 primeira pergunta: de onde começou (início real)', perg(l), { tipo: 'inicio', primeira: true });
  l = L.iniciar(l, { pos: 'em_pe' }, 'ns');
  ok('0 em pé não é a posição do plano: o plano não empurra a primeira peça', prox(l, NS), []);
  l = L.fazer(l, { tipo: 'finta', texto: 'Ameaçar puxar pra guarda' });
  ok('0 finta em texto livre: Ele reagiu / Ele não reagiu', nomesRes(NS, seq(l).passos[0]), ['Ele reagiu', 'Ele não reagiu']);
  l = L.responder(l, 'reagiu');
  ok('0 reagiu: a linha continua', perg(l).tipo, 'acao');
  l = L.fazer(l, { tec: 'Single Leg', tecUid: 'u-single' });
  ok('0 Single Leg é técnica do catálogo (uid), com respostas de queda', [seq(l).passos[1].tecUid, nomesRes(NS, seq(l).passos[1])],
    ['u-single', ['Consegui derrubar', 'Ele defendeu', 'Ele escapou', 'Ele puxou pra guarda']]);
  l = L.responder(l, 'encaixou');
  ok('0 derrubou: pergunta onde a luta ficou (não pula pra passagem)', perg(l).tipo, 'onde');
  ok('0 a queda pode valer 2, mas só com toque (nada entra sozinho)', [L.pontosDaLinha(l, planoDe, destinoDe).map((x) => x.ponto), aplicar(r0, l).ptsMeus], [['queda'], []]);
  l = L.ficou(l, 'meia_topo');
  ok('0 a posição vira um quadro, estabelecida por mim', [seq(l).passos[2].quem, seq(l).passos[2].pos, seq(l).passos[2].por, perg(l).tipo], ['lugar', 'meia_topo', 'eu', 'acao']);
  ok('0 de cima é ele que pode raspar; passar a guarda não aparece', L.ladoDe('meia_topo', destinoDe), 'cima');
  l = L.fazer(l, { tec: 'Passagem toreando' }); l = L.responder(l, 'encaixou');
  ok('0 passagem: "Passei a guarda" e pergunta onde ficou', [nomesRes(NS, seq(l).passos[3])[0], perg(l).tipo], ['Passei a guarda', 'onde']);
  l = L.ficou(l, 'cem_quilos');
  l = L.fuiPara(l, 'norte_sul');
  ok('0 chegou na norte-sul: o plano oferece o armlock (entrada do plano) e o que mais sai dali', prox(l, NS), ['Armlock da norte-sul|lNsArm', 'Kimura da norte-sul|']);
  l = doPlano(l, 'nsArm', NS); l = L.responder(l, 'encaixou');
  ok('0 finalizou: o rola continuou?', perg(l), { tipo: 'continuou', quem: 'eu' });
  const p = aplicar(r0, l);
  ok('0 r.plano: objetivo alcançado pelo armlock, caminho a partir da posição do plano', [p.plano.peca, p.plano.caminho, p.plano.encaixou, alcancouObjetivo(NS, { plano: p.plano }, destinoDe)], ['nsArm', ['lNsArm'], true, true]);
  ok('0 finalização em "Eu finalizei"', p.subsAplicadas, ['Armlock da norte-sul']);
  ok('0 a linha inteira, na ordem', seq(l).passos.map((x) => x.quem === 'lugar' ? `[${x.pos}]` : `${x.texto || x.tec || x.peca}:${x.res}`),
    ['Ameaçar puxar pra guarda:reagiu', 'Single Leg:encaixou', '[meia_topo]', 'Passagem toreando:encaixou', '[cem_quilos]', '[norte_sul]', 'nsArm:encaixou']);
  ok('0 chegar na norte-sul não dá ponto (nem a 100kg); a passagem e a queda sim, com toque', L.pontosDaLinha(l, planoDe, destinoDe).map((x) => x.ponto), ['queda', 'passagem']);
  /* outra luta: Single Leg defendido, voltou em pé, nova finta */
  let m = L.iniciar(vazio(), { pos: 'em_pe' }, 'ns');
  m = L.fazer(m, { tec: 'Single Leg' }); m = L.responder(m, 'defendeu');
  ok('0b defendeu: segue na mesma posição, sem perguntar onde', perg(m).tipo, 'acao');
  m = L.fazer(m, { tipo: 'finta', texto: 'Ameaçar a queda de novo' }); m = L.responder(m, 'naoReagiu');
  m = L.fazer(m, { tec: 'Single Leg' }); m = L.responder(m, 'puxou');
  ok('0b ele puxou pra guarda: pergunta onde ficou', perg(m).tipo, 'onde');
  m = L.ficou(m, 'passando');
  ok('0b a posição que ele escolheu é dele (não dá ponto)', [seq(m).passos[3].por, L.pontosDaLinha(m, planoDe, destinoDe)], ['ele', []]);
}

/* 1. sequência simples que termina em finalização (começando na posição do plano) */
{
  let l = L.iniciar(vazio(), { pos: 'guarda_fechada' }, 'pl1');
  ok('1 na posição do plano: a entrada do plano', prox(l), ['Quebrar a postura|lPre']);
  l = doPlano(l, 'pre');
  ok('1 preparação: Montou / Ele não deixou (nunca Ele escapou)', nomesRes(PLANO, seq(l).passos[0]), ['Montou', 'Ele não deixou']);
  l = L.responder(l, 'feita');
  ok('1 montou: o que vem depois é a finta', prox(l), ['Simular armlock|lFin']);
  l = doPlano(l, 'fin'); l = L.responder(l, 'reagiu');
  l = doPlano(l, 'arm');
  ok('1 golpe: Encaixou, Ele defendeu, Ele escapou', nomesRes(PLANO, seq(l).passos[2]), ['Encaixou', 'Ele defendeu', 'Ele escapou']);
  l = L.responder(l, 'encaixou');
  const p = aplicar(rola(), l);
  ok('1 o r.plano sai da linha', [p.plano.peca, p.plano.caminho, p.plano.encaixou, p.plano.parou], ['arm', ['lPre', 'lFin', 'lArm'], true, '']);
  ok('1 a finalização entra, marcada como da linha', [p.subsAplicadas, p.linha.entrou], [['Armlock'], ['Armlock']]);
  ok('1 não continuou: fim', perg(L.continuou(l, false)), { tipo: 'fim' });
  ok('1 posição do plano sem posição do catálogo: { plano: true } também vale', prox(L.iniciar(vazio(), { plano: true }, 'pl1')), ['Quebrar a postura|lPre']);
}

/* 2. ataque defendido seguido de outro; 11. defesa com várias saídas */
{
  let l = L.responder(ateArmlock(), 'defendeu');
  ok('2 defendeu: as continuações das defesas do plano', prox(l), ['Triângulo|lTri', 'Kimura|lKim']);
  ok('11 escolher como ele defendeu deixa só a continuação dela', prox(L.comoDefendeu(l, 'lKim')), ['Kimura|lKim']);
  ok('11 "Não sei" volta a mostrar todas', prox(L.comoDefendeu(L.comoDefendeu(l, 'lKim'), '')), ['Triângulo|lTri', 'Kimura|lKim']);
  l = doPlano(l, 'tri');
  ok('2 seguir pela defesa do plano diz como ele defendeu', seq(l).passos[2].saida, 'lTri');
  l = L.responder(l, 'encaixou');
  ok('2 o caminho passa pela defesa', aplicar(rola(), l).plano.caminho, ['lPre', 'lFin', 'lArm', 'lTri']);
}

/* 3. preparação que ele não deixa; 4. finta sem reação */
{
  let l = L.iniciar(vazio(), { pos: 'guarda_fechada' }, 'pl1');
  l = doPlano(l, 'pre'); l = L.responder(l, 'impediu');
  ok('3 não deixou: a outra preparação do plano, e a linha segue', [prox(l), perg(l).tipo], [['Pegar a gola|lPre2'], 'acao']);
  ok('3 r.plano: parou na preparação, "Ele não deixou"', [aplicar(rola(), l).plano.peca, aplicar(rola(), l).plano.parou], ['pre', 'impediu']);
  let m = L.iniciar(vazio(), { pos: 'guarda_fechada' }, 'pl1');
  m = doPlano(m, 'pre'); m = L.responder(m, 'feita');
  m = doPlano(m, 'fin'); m = L.responder(m, 'naoReagiu');
  ok('4 não reagiu: sem caminho no plano, a pergunta continua aberta', [prox(m), perg(m).tipo], [[], 'acao']);
  ok('4 r.plano: parou na finta', [aplicar(rola(), m).plano.peca, aplicar(rola(), m).plano.parou], ['fin', 'naoReagiu']);
}

/* 5. ele escapou: pra um lugar do plano, ou pra outro lugar */
{
  let l = L.responder(ateArmlock(), 'escapou');
  ok('5 escapou: pergunta onde a luta ficou, com as fugas do plano', [perg(l).tipo, L.fugasDe(PLANO, 'arm').map((f) => f.nome)], ['onde', ['Meia-guarda', 'Voltou pra Guarda fechada']]);
  l = L.fugir(l, 'lSit');
  ok('5 fuga do plano: o que o plano diz dali', [perg(l).tipo, prox(l)], ['acao', ['Raspagem de tesoura|lRas']]);
  l = doPlano(l, 'ras'); l = L.responder(l, 'encaixou');
  ok('5 "Raspei" e pergunta onde ficou', [nomesRes(PLANO, seq(l).passos[3])[0], perg(l).tipo], ['Raspei', 'onde']);
  l = L.ficou(l, 'montada');
  ok('5 caminho inteiro passando pela fuga', aplicar(rola(), l).plano.caminho, ['lPre', 'lFin', 'lArm', 'lSit', 'lRas']);
  ok('5 raspagem (no quadro dela) e montada (no quadro da posição), cada um com o passo', L.pontosDaLinha(l, planoDe, destinoDe).map((x) => [x.ponto, x.ev === seq(l).passos[x.ponto === 'montada' ? 4 : 3].id]), [['raspagem', true], ['montada', true]]);
  let v = L.fugir(L.responder(ateArmlock(), 'escapou'), 'xVolta');
  ok('5 voltou pra posição do plano: o plano recomeça dali, mesma sequência', [v.seqs.length, prox(v)], [1, ['Quebrar a postura|lPre']]);
  let o = L.ficou(L.responder(ateArmlock(), 'escapou'), 'meia_guarda');
  ok('5 outro lugar: quadro de posição dele, nada do plano', [seq(o).passos[3].por, prox(o)], ['ele', []]);
}

/* 6 e 7. três tentativas, o mesmo plano três vezes no mesmo rola */
let tres;
{
  let l = L.responder(ateArmlock(), 'escapou');
  l = L.fugir(l, 'xVolta');
  l = doPlano(l, 'pre'); l = L.responder(l, 'feita');
  l = doPlano(l, 'fin'); l = L.responder(l, 'reagiu');
  l = doPlano(l, 'arm'); l = L.responder(l, 'defendeu');
  l = doPlano(l, 'kim'); l = L.responder(l, 'defendeu');
  l = L.dele(l, 'escapou');
  ok('6 ele escapou: pergunta onde a luta ficou', [perg(l).tipo, perg(l).depois?.acao], ['onde', 'escapou']);
  l = L.ficou(l, 'em_pe');
  l = L.recomecar(l);
  ok('6 a luta recomeçou: outra tentativa, pergunta de onde', [l.seqs.length, perg(l).tipo], [2, 'inicio']);
  l = L.iniciar(l, { pos: 'guarda_fechada' });
  ok('6 a tentativa nova é do mesmo plano', seq(l).plano, 'pl1');
  l = doPlano(l, 'pre'); l = L.responder(l, 'feita');
  l = doPlano(l, 'fin'); l = L.responder(l, 'reagiu');
  l = doPlano(l, 'arm'); l = L.responder(l, 'encaixou');
  tres = l;
  const p = aplicar(rola(), l);
  ok('7 o r.plano é a tentativa que chegou no objetivo', [p.plano.peca, p.plano.encaixou, p.plano.caminho], ['arm', true, ['lPre', 'lFin', 'lArm']]);
  const t = L.tentativasPorPeca(PLANO, [{ linha: l, plano: p.plano }]);
  ok('7 tentativas: armlock em 1 rola, 3 tentativas, cada resultado', t.arm, { rolas: 1, tentativas: 3, res: { escapou: 1, defendeu: 1, encaixou: 1 } });
  const etapa = taxaPorEtapa(PLANO, [{ plano: p.plano }], destinoDe);
  ok('7 R7.3 continua contando 1 rola (não 3)', [etapa.usos, etapa.pecas.arm.tentativas, etapa.objetivo], [1, 1, 1]);
  let m = L.responder(ateArmlock(), 'encaixou');
  m = L.continuou(m, true); m = L.iniciar(m, { pos: 'guarda_fechada' });
  m = doPlano(m, 'pre'); m = L.responder(m, 'impediu');
  ok('7 chegou na 1ª, falhou na 2ª: o r.plano é a que chegou', [aplicar(rola(), m).plano.peca, aplicar(rola(), m).plano.encaixou], ['arm', true]);
}

/* 8. finalização, recomeço e nova finalização (duas iguais contam duas) */
{
  let l = L.responder(ateArmlock(), 'encaixou');
  l = L.continuou(l, true);
  ok('8 continuou: pergunta de onde recomeçou', [perg(l).tipo, perg(l).depois?.peca], ['inicio', 'arm']);
  l = L.iniciar(l, { pos: 'guarda_fechada' });
  l = doPlano(l, 'pre'); l = L.responder(l, 'feita');
  l = doPlano(l, 'fin'); l = L.responder(l, 'reagiu');
  l = doPlano(l, 'arm'); l = L.responder(l, 'encaixou');
  const p = aplicar(rola(), l);
  ok('8 dois armlocks: dois em "Eu finalizei"', [p.subsAplicadas, p.linha.entrou], [['Armlock', 'Armlock'], ['Armlock', 'Armlock']]);
  const de2 = aplicar({ ...rola(), ...p }, p.linha);
  ok('8/15 aplicar de novo não duplica (reabrir, sync)', [de2.subsAplicadas, de2.linha.entrou], [['Armlock', 'Armlock'], ['Armlock', 'Armlock']]);
  const p3 = aplicar({ ...rola(), ...p }, L.desfazer(p.linha));
  ok('8 desfazer o 2º encaixou tira só um', [p3.subsAplicadas, p3.linha.entrou], [['Armlock'], ['Armlock']]);
  const mao = aplicar(rola({ subsAplicadas: ['Armlock'] }), l);
  ok('16 um marcado na mão cobre um da linha: fica dois, não três', [mao.subsAplicadas, mao.linha.entrou], [['Armlock', 'Armlock'], ['Armlock']]);
}

/* 9. improviso seguido de outra ação */
{
  let l = L.responder(ateArmlock(), 'defendeu');
  l = L.fazer(l, { tec: 'Americana' }); l = L.responder(l, 'defendeu');
  ok('9 depois do improviso o plano continua de onde estava, sem ligação', prox(l), ['Triângulo|', 'Kimura|']);
  l = doPlano(l, 'tri'); l = L.responder(l, 'encaixou');
  const p = aplicar(rola(), l);
  ok('9 o improviso fica fora do plano e a peça seguinte não ganha caminho inventado', [p.plano.peca, p.plano.caminho, p.plano.improviso], ['tri', [], { nome: 'Americana', uid: null, encaixou: false }]);
  ok('9 o armlock não ganhou defesa sozinho', seq(l).passos[2].saida, '');
}

/* 10. ele raspou / passou / me finalizou */
{
  let l = L.iniciar(vazio(), { pos: 'guarda_fechada' }, 'pl1');
  l = L.dele(l, 'passou');
  ok('10 ele passou: pergunta onde a luta ficou', [perg(l).tipo, perg(l).depois?.acao], ['onde', 'passou']);
  l = L.ficou(l, 'cem_quilos');
  ok('10 a luta segue na mesma tentativa, posição dele', [l.seqs.length, seq(l).passos[1].por, perg(l).tipo], [1, 'ele', 'acao']);
  l = L.dele(l, 'finalizou', { tec: 'Mata-leão' });
  ok('10 ele me finalizou: pergunta se continuou', perg(l), { tipo: 'continuou', quem: 'ele' });
  ok('10/16 já marcada na mão: não entra de novo', aplicar(rola({ subsSofridas: ['Mata-leão'] }), l).subsSofridas, ['Mata-leão']);
  ok('10 sofrida entra em "Ele me finalizou"', [aplicar(rola(), l).subsSofridas, aplicar(rola(), l).linha.sofreu], [['Mata-leão'], ['Mata-leão']]);
}

/* 12. sem plano */
{
  let l = L.iniciar(vazio(), { pos: 'montada' }, '');
  ok('12 sem plano: nada do plano pra oferecer', L.proximasDoPlano(null, seq(l), destinoDe), []);
  l = L.fazer(l, { tec: 'Americana' }); l = L.responder(l, 'encaixou');
  const p = aplicar(rola({ plano: null }), l);
  ok('12 a finalização entra e o rola continua sem plano', [p.subsAplicadas, 'plano' in p], [['Americana'], false]);
}

/* 13. rola antigo sem linha: vira a linha sem inventar, e o r.plano volta igual */
{
  const casos = [
    { uid: 'pl1', peca: 'tri', caminho: ['lPre', 'lFin', 'lArm', 'lTri'], encaixou: false, parou: 'defendeu', saida: 'lOmo' },
    { uid: 'pl1', peca: 'ras', caminho: ['lPre', 'lFin', 'lArm', 'lSit', 'lRas'], encaixou: true, parou: '', saida: '' },
    { uid: 'pl1', peca: 'arm', caminho: [], encaixou: false, parou: 'escapou', saida: 'lSit' },
  ];
  for (const rp of casos) {
    const p = L.planoDaLinha(L.linhaDoPlanoAntigo(PLANO, rp), 'pl1', PLANO, destinoDe);
    ok(`13 antigo ${rp.peca}: mesma peça, caminho, encaixou, parou e saída`, [p.peca, p.caminho, p.encaixou, p.parou, p.saida], [rp.peca, rp.caminho, rp.encaixou, rp.parou, rp.saida]);
  }
  ok('13 antigo: cada peça do meio com a saída que a luta tomou', L.linhaDoPlanoAntigo(PLANO, casos[0]).seqs[0].passos.map((x) => `${x.peca}:${x.res}`), ['pre:feita', 'fin:reagiu', 'arm:defendeu', 'tri:defendeu']);
  const so = L.linhaDoPlanoAntigo(PLANO, { uid: 'pl1', peca: null, caminho: [], improviso: { nome: 'Americana', uid: null, encaixou: true }, entrou: ['Americana'] });
  ok('13 antigo só com improviso', [so.seqs[0].passos.map((x) => `${x.tec}:${x.res}`), so.entrou], [['Americana:encaixou'], ['Americana']]);
}

/* 14. interrompido e retomado (o que sobe no sync é JSON) */
{
  const l = L.responder(ateArmlock(), 'defendeu');
  const volta = JSON.parse(JSON.stringify(l));
  ok('14 reabrir: a mesma pergunta e as mesmas opções', [perg(volta), prox(volta)], [perg(l), prox(l)]);
}

/* 16. pontos: um toque por passo, sem duplicar */
{
  let l = L.iniciar(vazio(), { pos: 'em_pe' }, '');
  l = L.fazer(l, { tec: 'Single Leg' }); l = L.responder(l, 'encaixou'); l = L.ficou(l, 'passando');
  l = L.dele(l, 'raspou'); l = L.ficou(l, 'em_pe');
  l = L.fazer(l, { tec: 'Single Leg' }); l = L.responder(l, 'encaixou'); l = L.ficou(l, 'passando');
  const quer = L.pontosDaLinha(l, planoDe, destinoDe);
  ok('16 duas quedas, dois pontos possíveis', quer.map((x) => x.ponto), ['queda', 'queda']);
  ok('16 com uma queda sem nome na mão: só uma já está lá', L.estadoDosPontosDaLinha(quer, [], ['queda'], {}).map((x) => x.estado), ['ja', 'livre']);
  const dois = porPonto(porPonto({ ptsMeus: [], tecMeus: {}, pontuou: [] }, quer[0]), quer[1]);
  ok('16 tocar nas duas: dois pontos, cada um do seu passo', [dois.ptsMeus, L.estadoDosPontosDaLinha(quer, dois.pontuou, dois.ptsMeus, dois.tecMeus).map((x) => x.estado)], [['queda', 'queda'], ['meu', 'meu']]);
  const r = { ...rola({ plano: null }), ptsMeus: dois.ptsMeus, tecMeus: dois.tecMeus };
  let semUltima = L.desfazer(L.desfazer({ ...l, pontuou: dois.pontuou }));
  const p = aplicar(r, semUltima);
  ok('16 desfazer o 2º derrubou tira só o ponto dele', [p.ptsMeus, p.linha.pontuou.length], [['queda'], 1]);
  const camp = L.aplicarLinha(r, { ...l, pontuou: dois.pontuou }, { planoDe, destinoDe, pontos: false });
  ok('16 campeonato: a linha tira os pontos que ela pôs (o placar é do árbitro)', camp.ptsMeus.length, 0);
}

/* desfazer: um toque de cada vez, sem destruir o que veio antes */
{
  let l = L.comoDefendeu(L.responder(ateArmlock(), 'defendeu'), 'lKim');
  const passos = [];
  for (let k = 0; k < 4; k++) { l = L.desfazer(l); passos.push(seq(l).passos.map((x) => `${x.peca}:${x.res}${x.saida ? `/${x.saida}` : ''}`).join(' ')); }
  ok('desfazer: tira a defesa, o resultado, a peça, e o resultado de antes', passos,
    ['pre:feita fin:reagiu arm:defendeu', 'pre:feita fin:reagiu arm:', 'pre:feita fin:reagiu', 'pre:feita fin:']);
  let m = L.iniciar(vazio(), { pos: 'guarda_fechada' }, 'pl1');
  m = L.dele(m, 'raspou'); m = L.ficou(m, 'passando');
  m = L.desfazer(m);
  ok('desfazer o lugar: volta a perguntar onde', perg(m).tipo, 'onde');
  m = L.desfazer(m);
  ok('desfazer de novo: tira o "ele raspou"', [m.seqs[0].passos.length, perg(m).tipo], [0, 'acao']);
  let c = L.iniciar(L.recomecar(L.continuou(L.responder(ateArmlock(), 'encaixou'), true)), { pos: 'em_pe' });
  c = L.desfazer(c);
  ok('desfazer o lugar do recomeço: volta a perguntar de onde', [c.seqs.length, perg(c).tipo], [3, 'inicio']);
  ok('desfazer o fim', perg(L.desfazer(L.acabou(ateArmlock()))).tipo, 'resultado');
  ok('6 a linha de três tentativas desfaz só a última', L.desfazer(tres).seqs.length, 2);
}

/* trocar de plano não mexe na sequência que já usou peça */
{
  let l = L.iniciar(vazio(), { pos: 'guarda_fechada' }, 'pl1');
  l = doPlano(l, 'pre');
  l = L.recomecar(l);
  ok('mudar de plano: a sequência com peça continua do plano dela', L.mudarPlano(l, 'ns').seqs.map((s) => s.plano), ['pl1', 'ns']);
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
