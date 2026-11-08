import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   PLANOS DE ATAQUE
   Árvore sem teto de peças (encaixou segue, se defender abre outro
   plano), 1 plano seu no grátis, e o pronto copiado vira plano seu
   sem perder os passos.
   ============================================================ */
const {
  correnteDoPlano, copiaDoPronto, planoNovo, podeCriarPlano, meusPlanos, nomeDaPosicao,
} = await import('../src/lib/planos.js');
const { PLANOS_ATAQUE, VERSAO_DOS_PRONTOS } = await import('../src/db/attackPlans.js');
const { VIAS } = await import('../src/lib/planos.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

const novo = planoNovo({
  nome: '  Finta e armlock ', posicao: 'Guarda fechada', finta: 'Raspagem de gancho',
  passos: [
    { reacao: 'ele baseia a mão', golpe: 'Kimura' },
    { reacao: '', golpe: '' },
    { reacao: 'ele esconde o braço', golpe: 'Guilhotina' },
    { golpe: 'Triângulo' }, { golpe: 'Omoplata' }, { golpe: 'Armlock' },
  ],
});
ok('nome sem espaço sobrando', novo.nome, 'Finta e armlock');
ok('golpe vazio sai, o resto vira fila', novo.passos.map((p) => [p.acao, p.pai, p.via]), [['Kimura', null, null], ['Guilhotina', 0, 'defendeu'], ['Triângulo', 1, 'defendeu'], ['Omoplata', 2, 'defendeu'], ['Armlock', 3, 'defendeu']]);
ok('reação vira gatilho', novo.passos[0].gatilho, 'ele baseia a mão');

const muitos = Array.from({ length: 20 }, (_, i) => ({ golpe: `G${i}` }));
ok('sem teto de peças: as 20 ficam', planoNovo({ passos: muitos }).passos.length, 20);
const c = correnteDoPlano(novo);
ok('a finta de antes vira a peça de finta, no fim da lista, e o 1º golpe nasce dela',
  c.passos.map((x) => [x.tipo, x.golpe, x.pai, x.via]).filter((x) => x[0] === 'finta' || x[2] === 5),
  [['golpe', 'Kimura', 5, 'reagiu'], ['finta', 'Raspagem de gancho', null, null]]);

const pronto = { ...PLANOS_ATAQUE[0], id: 7, uid: 'u', pronto: 1, criadoEm: 1 };
const copia = copiaDoPronto(pronto);
ok('a cópia é plano seu', [copia.pronto, copia.slug, copia.uid, copia.id], [0, undefined, undefined, undefined]);
ok('a cópia guarda de onde veio', copia.copiadoDe, PLANOS_ATAQUE[0].slug);
ok('a cópia mantém os golpes', copia.passos.map((p) => p.acao), pronto.passos.slice(0, 4).map((p) => p.acao));
ok('o "se ele defender tudo" não vira peça', [correnteDoPlano(PLANOS_ATAQUE.find((p) => p.slug === 'cg-trindade')).fim, correnteDoPlano(PLANOS_ATAQUE.find((p) => p.slug === 'cg-trindade')).segue], [undefined, '']);
ok('depois que encaixou vira o segue', correnteDoPlano({ passos: [{ acao: 'Gift wrap', proxima: 'Mata-leão' }] }), { posicao: '', objetivo: '', objetivoTipo: '', passos: [{ id: 'p0', lig: 'l0', tipo: 'golpe', reacao: '', golpe: 'Gift wrap', detalhe: '', defesa: '', pai: null, via: null }], ligacoes: [], segue: 'Mata-leão' });
ok('"se ele escapar" não vira continuação', correnteDoPlano({ passos: [{ acao: 'X', proxima: 'Se ele escapar, retomar' }] }).segue, '');
ok('todo pronto vira corrente com golpe', PLANOS_ATAQUE.every((p) => correnteDoPlano(p).passos.length > 0), true);

const lista = [pronto, { nome: 'meu', pronto: 0, arquivada: 0 }];
ok('grátis com 1 plano seu não cria outro', podeCriarPlano(lista, false), false);
ok('Premium cria', podeCriarPlano(lista, true), true);
ok('arquivado não conta', podeCriarPlano([{ pronto: 0, arquivada: 1 }], false), true);
ok('pronto não conta como seu', meusPlanos(lista).length, 1);

/* pra quem serve: altura e peso dele em relação a você */
const { servePara, planosQueServem } = await import('../src/lib/planos.js');
const altoPesado = { alturaRel: 'alto', pesoRel: 'pesado' };
ok('plano pra alto e pesado serve', servePara({ paraAltura: ['alto'], paraPeso: ['pesado'] }, altoPesado), true);
ok('plano pra baixo não serve pra alto', servePara({ paraAltura: ['baixo'] }, altoPesado), false);
ok('plano sem etiqueta não entra na lista', servePara({}, altoPesado), false);
ok('parceiro sem altura: vale o peso', servePara({ paraAltura: ['alto'], paraPeso: ['pesado'] }, { pesoRel: 'pesado' }), true);
ok('a lista do parceiro junta meus e prontos', planosQueServem([
  { nome: 'a', pronto: 0, paraPeso: ['pesado'] }, { nome: 'b', pronto: 1, paraAltura: ['alto'] }, { nome: 'c', pronto: 1 },
], altoPesado).map((p) => p.nome), ['a', 'b']);

/* "qualquer" é escolha; lista vazia é "não informei" */
const { escolherPraQuem, QUALQUER } = await import('../src/lib/planos.js');
const { PESO_REL } = await import('../src/db/scoring.js');
const toques = (...ids) => ids.reduce((l, id) => escolherPraQuem(l, id), []);
ok('qualquer altura', toques(QUALQUER), ['qualquer']);
ok('qualquer desmarca as específicas', toques('alto', 'parecida', QUALQUER), ['qualquer']);
ok('específica depois de qualquer: tira o qualquer', toques(QUALQUER, 'baixo'), ['baixo']);
ok('específicas seguem somando', toques('leve', 'similar'), ['leve', 'similar']);
ok('tocar de novo no qualquer volta pro não informei', toques(QUALQUER, QUALQUER), []);
ok('sem lista (plano antigo): funciona igual', escolherPraQuem(undefined, QUALQUER), ['qualquer']);
ok('as duas dimensões não se misturam',
  (() => { let e = { paraAltura: [], paraPeso: ['leve'] };
    e = { ...e, paraAltura: escolherPraQuem(e.paraAltura, QUALQUER) };
    e = { ...e, paraAltura: escolherPraQuem(e.paraAltura, 'alto') };
    e = { ...e, paraPeso: escolherPraQuem(e.paraPeso, QUALQUER) };
    return [e.paraAltura, e.paraPeso]; })(), [['alto'], ['qualquer']]);
const semInfo = {}, soAltura = { alturaRel: 'baixo' };
ok('qualquer altura + qualquer peso: serve pra todo parceiro',
  [altoPesado, soAltura, semInfo].map((p) => servePara({ paraAltura: [QUALQUER], paraPeso: [QUALQUER] }, p)), [true, true, true]);
ok('qualquer altura + peso específico: o peso continua valendo',
  [altoPesado, { alturaRel: 'alto', pesoRel: 'leve' }].map((p) => servePara({ paraAltura: [QUALQUER], paraPeso: ['pesado'] }, p)), [true, false]);
ok('altura específica + qualquer peso: a altura continua valendo',
  [altoPesado, { alturaRel: 'baixo', pesoRel: 'pesado' }].map((p) => servePara({ paraAltura: ['alto'], paraPeso: [QUALQUER] }, p)), [true, false]);
ok('só qualquer peso, sem altura informada: serve', servePara({ paraPeso: [QUALQUER] }, soAltura), true);
ok('não informado continua fora da ficha (plano antigo)', [servePara({}, altoPesado), servePara({ paraAltura: [], paraPeso: [] }, altoPesado)], [false, false]);
ok('salvar, sincronizar (JSON) e reabrir mantém o qualquer',
  (() => { const p = JSON.parse(JSON.stringify(planoNovo({ objetivo: 'Montada', objetivoTipo: 'posicao', paraAltura: [QUALQUER], paraPeso: ['leve'] })));
    return [p.paraAltura, p.paraPeso]; })(), [['qualquer'], ['leve']]);
ok('a lista de peso do rola não ganhou o qualquer', PESO_REL.map((p) => p.id), ['leve', 'similar', 'pesado']);

/* taxa de acerto, onde morre, por tipo e rodízio */
const { taxaDoPlano, taxaPorTipo, rodizio } = await import('../src/lib/planos.js');
const A = { uid: 'A', nome: 'A', pronto: 0, passos: [{ id: 'q', acao: 'Queda', pai: null }, { id: 'a', acao: 'Armlock', pai: 0, via: 'encaixou' }, { id: 't', acao: 'Triângulo', pai: 1, via: 'defendeu' }] }, B = { uid: 'B', nome: 'B', pronto: 0 }, C = { uid: 'C', nome: 'C', pronto: 0 };
const sess = [{ id: 1, data: '2026-10-01' }, { id: 2, data: '2026-10-08' }];
const rs = [
  { sessionId: 1, partnerId: 7, plano: { uid: 'A', peca: 'a', encaixou: false } },
  { sessionId: 1, partnerId: 7, plano: { uid: 'A', peca: 'a', encaixou: false } },
  { sessionId: 2, partnerId: 7, plano: { uid: 'A', peca: 't', encaixou: true }, pesoRel: 'pesado' },
  { sessionId: 2, partnerId: 8, plano: { uid: 'B', ate: 0, encaixou: true } },
  { sessionId: 2, partnerId: 7, contexto: 'drill', plano: { uid: 'A', ate: 0, encaixou: true } },
];
const tA = taxaDoPlano(A, rs);
ok('taxa: 1 de 3, drill fora', [tA.usos, tA.encaixes, tA.taxa], [3, 1, 33]);
ok('morre mais no Armlock (pela peça)', tA.morreNo, { peca: 'a', golpe: 'Armlock', saiu: false, vezes: 2 });
ok('por tipo: contra pesado', taxaPorTipo(A, rs, [{ id: 7, alturaRel: 'alto' }]).pesado, { usos: 1, encaixes: 1 });
const rod = rodizio([A, B, C], rs, sess, { id: 7 });
ok('rodízio: último contra ele foi A', rod.ultimo?.uid, 'A');
ok('rodízio: o próximo é um que ele ainda não viu', ['B', 'C'].includes(rod.proximo?.uid), true);
ok('com 1 plano só, não tem próximo', rodizio([A], rs, sess, { id: 7 }).proximo, null);

/* exemplos da faixa: 3 na lista de cada um, fora do limite do grátis */
const { exemplosDaFaixa, planosDaPessoa } = await import('../src/lib/planos.js');
const semente = PLANOS_ATAQUE.map((p, i) => ({ ...p, id: i + 1, uid: p.slug, pronto: 1, arquivada: 0 }));
ok('branca recebe 3 exemplos de branca', exemplosDaFaixa(semente, 'branca').map((p) => p.faixa), ['branca', 'branca', 'branca']);
ok('azul recebe 3 exemplos de azul', exemplosDaFaixa(semente, 'azul').map((p) => p.faixa), ['azul', 'azul', 'azul']);
ok('preta recebe os da roxa', exemplosDaFaixa(semente, 'preta').length, 3);
ok('faixa infantil recebe os da branca', exemplosDaFaixa(semente, 'cinza').map((p) => p.slug), exemplosDaFaixa(semente, 'branca').map((p) => p.slug));
ok('exemplo não conta no limite do grátis', podeCriarPlano(semente, false), true);
const ajustado = [...semente, { ...planoNovo({ nome: 'Minha trindade', passos: [{ golpe: 'Armlock' }], copiadoDe: 'cg-trindade' }), id: 99 }];
ok('exemplo ajustado sai da lista e fica a versão dele', exemplosDaFaixa(ajustado, 'branca').some((p) => p.slug === 'cg-trindade'), false);
ok('a lista da pessoa junta os dela e os exemplos', planosDaPessoa(ajustado, 'branca').map((p) => p.nome)[0], 'Minha trindade');
ok('o ajustado conta no limite', podeCriarPlano(ajustado, false), false);

/* a árvore: encaixou segue no mesmo plano, se defender abre o próximo */
const { arvoreDoPlano, semOGolpe } = await import('../src/lib/planos.js');
const arvore = planoNovo({
  nome: 'Da queda ao armlock', objetivo: 'Armlock com triângulo',
  passos: [
    { golpe: 'Queda', pai: null, via: null },                 // 0
    { golpe: 'Passar a guarda', pai: 0, via: 'encaixou' },     // 1
    { golpe: 'Puxar pra guarda', pai: 0, via: 'defendeu' },    // 2
    { golpe: 'Norte-sul', pai: 1, via: 'encaixou' },           // 3
    { golpe: '', pai: 2, via: 'encaixou' },                    // 4 vazio: sai, e o filho dele também
    { golpe: 'Raspagem', pai: 4, via: 'encaixou' },            // 5
    { golpe: 'Armlock', pai: 3, via: 'encaixou' },             // 6
    { golpe: 'Triângulo', pai: 6, via: 'defendeu' },           // 7
  ],
});
ok('objetivo guardado', arvore.objetivo, 'Armlock com triângulo');
ok('golpe vazio leva junto o que nasce dele', arvore.passos.map((p) => p.acao), ['Queda', 'Passar a guarda', 'Puxar pra guarda', 'Norte-sul', 'Armlock', 'Triângulo']);
const ca = correnteDoPlano(arvore);
ok('os pais apontam pro índice novo', ca.passos.map((p) => p.pai), [null, 0, 0, 1, 3, 4]);
const av = arvoreDoPlano(ca.passos);
ok('Plano A inteiro primeiro, depois B e C', av.ordem.map((i) => ca.passos[i].golpe), ['Queda', 'Passar a guarda', 'Norte-sul', 'Armlock', 'Puxar pra guarda', 'Triângulo']);
ok('B é a defesa do primeiro golpe do A', av.trilho, [0, 0, 1, 0, 0, 2]);
ok('3 trilhos', av.trilhos, 3);
ok('tirar o Passar a guarda leva Norte-sul, Armlock e Triângulo', semOGolpe(ca.passos, 1).map((p) => [p.golpe, p.pai]), [['Queda', null], ['Puxar pra guarda', 0]]);

/* plano antigo: sem pai. Do aluno, era tudo "se defender"; nos
   prontos, o "seFalhar" do anterior diz que é defesa, sem ele é continuação */
const antigo = correnteDoPlano({ passos: [{ acao: 'Kimura' }, { acao: 'Guilhotina' }] });
ok('plano antigo do aluno: se defender', antigo.passos.map((p) => [p.pai, p.via]), [[null, null], [0, 'defendeu']]);
const trindade = correnteDoPlano(PLANOS_ATAQUE.find((p) => p.slug === 'cg-trindade'));
ok('trindade: quebrou a postura (preparação), armlock; defendeu, triângulo; defendeu, omoplata', trindade.passos.map((p) => [p.tipo, p.via]), [['preparacao', null], ['golpe', 'feita'], ['golpe', 'defendeu'], ['golpe', 'defendeu']]);
/* o formato antigo dos prontos (fila com seFalhar) continua lendo igual */
const prontoAntigo = correnteDoPlano({ passos: [{ acao: 'Quebrar a postura' }, { acao: 'Armlock', seFalhar: 'ele esconde o braço' }, { acao: 'Triângulo', seFalhar: 'ele posta' }, { acao: 'Omoplata' }] });
ok('pronto do formato antigo: encaixou, depois defendeu', prontoAntigo.passos.map((p) => p.via), [null, 'encaixou', 'defendeu', 'defendeu']);
ok('todo pronto vira árvore inteira', PLANOS_ATAQUE.every((p) => arvoreDoPlano(correnteDoPlano(p).passos).ordem.length === correnteDoPlano(p).passos.length), true);
ok('editar e salvar um pronto mantém o caminho', correnteDoPlano(planoNovo({ passos: trindade.passos })).passos.map((p) => p.via), [null, 'feita', 'defendeu', 'defendeu']);

/* ---------- finta em qualquer ponto ----------
   Golpe → encaixou → finta → finta → golpe; a reação à finta mora no
   passo de depois, a defesa do golpe no galho da defesa */
const { fintaAntes, semAFinta, moverPasso, vagaLivre, chegaNoObjetivo, pontasSoltas, letraDo } = await import('../src/lib/planos.js');
const fintas = planoNovo({
  nome: 'Finta atrás de finta', objetivo: 'Finalizar', objetivoTipo: 'finalizar',
  passos: [
    { tipo: 'golpe', golpe: 'Raspagem de quadril (hip bump)', pai: null, via: null },                  // 0
    { tipo: 'finta', golpe: 'Guilhotina', reacao: 'ele senta pra trás', pai: 0, via: 'encaixou' },      // 1
    { tipo: 'finta', golpe: 'Triângulo', reacao: 'ele levanta a cabeça', pai: 1, via: 'qualquer' },     // 2
    { tipo: 'golpe', golpe: 'Kimura', reacao: 'ele posta a mão no chão', pai: 2 },                      // 3
    { tipo: 'golpe', golpe: 'Guilhotina', reacao: 'ele esconde o braço', pai: 3, via: 'defendeu' },     // 4
  ],
});
ok('finta guarda o tipo, golpe não', fintas.passos.map((x) => x.tipo || 'golpe'), ['golpe', 'finta', 'finta', 'golpe', 'golpe']);
ok('depois da finta é sempre "ele reagiu"', fintas.passos.map((x) => x.via), [null, 'encaixou', 'reagiu', 'reagiu', 'defendeu']);
const cf = correnteDoPlano(fintas);
const af = arvoreDoPlano(cf.passos);
ok('a finta segue no mesmo trilho; a defesa abre o B', af.ordem.map((i) => [cf.passos[i].golpe, letraDo(af.trilho[i])]),
  [['Raspagem de quadril (hip bump)', 'A'], ['Guilhotina', 'A'], ['Triângulo', 'A'], ['Kimura', 'A'], ['Guilhotina', 'B']]);
ok('reação à finta e defesa do golpe ficam em passos diferentes', [cf.passos[3].reacao, cf.passos[4].reacao], ['ele posta a mão no chão', 'ele esconde o braço']);

const antes = fintaAntes(cf.passos, 4, 'Kimura');
ok('finta antes do golpe do B entra no fim, no lugar dele', antes.map((x) => [x.golpe, x.pai, x.via]).slice(4),
  [['Guilhotina', 5, 'reagiu'], ['Kimura', 3, 'defendeu']]);
ok('os índices de antes não mudam (o rola guarda o índice)', antes.slice(0, 4).map((x) => x.golpe), cf.passos.slice(0, 4).map((x) => x.golpe));
ok('tirar a finta devolve o golpe pro lugar dela', semAFinta(antes, 5).map((x) => [x.golpe, x.pai, x.via]).slice(4), [['Guilhotina', 3, 'defendeu']]);
ok('tirar a finta do meio religa o caminho', semAFinta(cf.passos, 2).map((x) => [x.golpe, x.pai, x.via]).slice(2, 3), [['Kimura', 1, 'reagiu']]);

ok('finta não tem defesa; aceita outra reação e o "não reagiu"', [vagaLivre(cf.passos, 2, 'defendeu'), vagaLivre(cf.passos, 2, 'reagiu'), vagaLivre(cf.passos, 2, 'naoReagiu')], [false, true, true]);
ok('golpe não tem vaga de "ele reagiu"', vagaLivre(cf.passos, 4, 'reagiu'), false);
ok('arrastar pra dentro do próprio galho não vale', moverPasso(cf.passos, 3, 4, 'encaixou'), null);
ok('a raiz não sai do lugar', moverPasso(cf.passos, 0, 4, 'encaixou'), null);
const movido = moverPasso(cf.passos, 4, 0, 'defendeu');
ok('arrastar a Guilhotina pra defesa do 1º golpe', movido && [movido[4].pai, movido[4].via], [0, 'defendeu']);
ok('depois de arrastar, a árvore continua inteira', arvoreDoPlano(correnteDoPlano(planoNovo({ passos: movido })).passos).ordem.length, 5);

/* ---------- objetivo ---------- */
const destinos = { Kimura: { slug: 'finalizacao', nome: 'Finalização' }, 'Raspagem de quadril (hip bump)': { slug: 'montada', nome: 'Montada' } };
const destinoDe = (n) => destinos[n] || null;
ok('finalizar: a Kimura chega lá', chegaNoObjetivo({ golpe: 'Kimura' }, { objetivo: 'Finalizar', objetivoTipo: 'finalizar' }, destinoDe), true);
ok('finta nunca chega', chegaNoObjetivo({ tipo: 'finta', golpe: 'Kimura' }, { objetivo: 'Finalizar', objetivoTipo: 'finalizar' }, destinoDe), false);
ok('posição: a raspagem chega na montada', chegaNoObjetivo({ golpe: 'Raspagem de quadril (hip bump)' }, { objetivo: 'Montada', objetivoTipo: 'posicao' }, destinoDe), true);
ok('golpe: só o próprio', [chegaNoObjetivo({ golpe: 'Kimura' }, { objetivo: 'Kimura' }), chegaNoObjetivo({ golpe: 'Guilhotina' }, { objetivo: 'Kimura' })], [true, false]);
ok('plano antigo sem tipo: objetivo é golpe', correnteDoPlano({ objetivo: 'Kimura', passos: [{ acao: 'Kimura' }] }).objetivoTipo, 'tecnica');
ok('ponta solta: a raspagem do B para antes do objetivo; a kimura não',
  pontasSoltas(planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos: [{ golpe: 'Kimura' }, { golpe: 'Raspagem de quadril (hip bump)', pai: 0, via: 'defendeu' }] }), destinoDe).map((x) => x.golpe),
  ['Raspagem de quadril (hip bump)']);
ok('finta sem golpe depois é ponta solta', pontasSoltas(planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos: [{ tipo: 'finta', golpe: 'Guilhotina' }] }), destinoDe).map((x) => x.tipo), ['finta']);

/* a busca do seletor: espaço, hífen e o nome em português não escondem o armlock */
const { casaApelido } = await import('../src/db/sinonimos.js');
for (const termo of ['arm l', 'arm lock', 'armlock', 'arm bar', 'chave de braço', 'chave de braço reta', 'Chave de braco']) {
  ok(`"${termo}" acha o Armlock da guarda fechada`, casaApelido('Armlock da guarda fechada', termo), true);
}
/* ---------- R1: várias saídas por peça ----------
   Da guarda fechada: Finta A, B e C como opções (não etapas). O
   armlock tem três defesas, cada uma com a sua continuação. A finta
   tem "reagiu" e "não reagiu" (troco a ameaça). */
const { semGatilho, viasDa } = await import('../src/lib/planos.js');
const grafo = planoNovo({
  nome: 'Guarda fechada, três entradas', objetivo: 'Finalizar', objetivoTipo: 'finalizar',
  passos: [
    { tipo: 'finta', golpe: 'Guilhotina', pai: null },                                                   // 0 Finta A
    { tipo: 'finta', golpe: 'Raspagem de tesoura', pai: null },                                          // 1 Finta B
    { tipo: 'finta', golpe: 'Triângulo', pai: null },                                                    // 2 Finta C
    { tipo: 'golpe', golpe: 'Armlock', reacao: 'levantou a cabeça', pai: 0, via: 'reagiu' },             // 3
    { tipo: 'golpe', golpe: 'Triângulo', reacao: 'colou o cotovelo', pai: 3, via: 'defendeu' },          // 4 defesa A
    { tipo: 'golpe', golpe: 'Omoplata', reacao: 'girou o braço pra fora', pai: 3, via: 'defendeu' },     // 5 defesa B
    { tipo: 'golpe', golpe: 'Kimura', reacao: 'levantou a postura', pai: 3, via: 'defendeu' },           // 6 defesa C
    { tipo: 'finta', golpe: 'Kimura', reacao: 'ficou parado na base', pai: 0, via: 'naoReagiu' },        // 7
    { tipo: 'golpe', golpe: 'Raspagem de quadril (hip bump)', reacao: 'apoiou a mão', pai: 1, via: 'reagiu' }, // 8
    { tipo: 'golpe', golpe: 'Armlock', reacao: 'puxou o braço', pai: 2, via: 'reagiu' },                 // 9
  ],
});
ok('três entradas da mesma posição ficam (várias raízes)', grafo.passos.filter((x) => x.pai === null).length, 3);
ok('o "não reagiu" é guardado', grafo.passos[7].via, 'naoReagiu');
const cg = correnteDoPlano(grafo);
const ag = arvoreDoPlano(cg.passos);
ok('cada entrada e cada desvio é um plano com letra própria', ag.ordem.map((i) => `${letraDo(ag.trilho[i])}:${cg.passos[i].golpe}`),
  ['A:Guilhotina', 'A:Armlock', 'B:Raspagem de tesoura', 'B:Raspagem de quadril (hip bump)', 'C:Triângulo', 'C:Armlock',
    'D:Kimura', 'E:Triângulo', 'F:Omoplata', 'G:Kimura']);
ok('passa de 4 planos', ag.trilhos, 7);
ok('as três defesas saem do mesmo armlock, cada uma com o que ele fez', ag.filhos[3].map((k) => cg.passos[k].reacao), ['colou o cotovelo', 'girou o braço pra fora', 'levantou a postura']);
ok('golpe abre encaixou, defendeu e escapou; finta, reagiu e não reagiu', [viasDa(cg.passos[3]), viasDa(cg.passos[0])], [['encaixou', 'defendeu', 'escapou'], ['reagiu', 'naoReagiu']]);
ok('golpe aceita mais uma defesa', vagaLivre(cg.passos, 3, 'defendeu'), true);
ok('"não reagiu" aceita outra ameaça', vagaLivre(cg.passos, 0, 'naoReagiu'), true);
ok('defesa sem nome junto de outra é avisada', semGatilho([...cg.passos, { tipo: 'golpe', golpe: 'Mata-leão', reacao: '', pai: 3, via: 'defendeu' }]).map((x) => x.golpe), ['Mata-leão']);
ok('defesa sozinha sem nome não é avisada', semGatilho([{ golpe: 'Armlock', pai: null }, { golpe: 'Kimura', reacao: '', pai: 0, via: 'defendeu' }]), []);
ok('tirar a finta leva junto o "não reagiu" dela', semAFinta(cg.passos, 0).map((x) => x.golpe).includes('Kimura') && semAFinta(cg.passos, 0).filter((x) => x.tipo === 'finta').length, 2);
ok('arrastar a Omoplata pra defesa da raspagem', (() => { const m = moverPasso(cg.passos, 5, 8, 'defendeu'); return m && [m[5].pai, m[5].via]; })(), [8, 'defendeu']);
ok('não arrasta pra posição', moverPasso(cg.passos, 5, null, 'raiz'), null);
ok('finta só com "não reagiu" ainda é ponta solta (falta o que fazer quando ele reage)',
  pontasSoltas(planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos: [{ tipo: 'finta', golpe: 'Guilhotina', pai: null }, { tipo: 'golpe', golpe: 'Kimura', pai: 0, via: 'naoReagiu' }] }), destinoDe).map((x) => x.golpe),
  ['Guilhotina']);

/* ---------- identidade: peça e ligação com id que não muda ----------
   O rola aponta pelo id. Apagar, arrastar, renomear ou pôr finta não
   pode fazer um rola antigo apontar pra outra peça. */
const { caminhoAte, ligacoesDo, removidosAoSalvar, pecaDoRola, planoDoRolaAntigo } = await import('../src/lib/planos.js');
const editar = (p) => correnteDoPlano(p).passos.map((x) => ({ ...x }));
const salvo = planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos: [
  { golpe: 'Armlock', pai: null },
  { golpe: 'Triângulo', reacao: 'colou o cotovelo', pai: 0, via: 'defendeu' },
  { golpe: 'Omoplata', reacao: 'girou o braço', pai: 0, via: 'defendeu' },
  { golpe: 'Kimura', pai: 2, via: 'defendeu' },
] });
const ids = salvo.passos.map((x) => x.id);
ok('toda peça e toda ligação ganham id', salvo.passos.every((x) => x.id && x.lig), true);
ok('ids não se repetem', new Set([...ids, ...salvo.passos.map((x) => x.lig)]).size, 8);
ok('salvar de novo não muda id', planoNovo({ passos: editar(salvo) }).passos.map((x) => x.id), ids);
const rolaNaKimura = { plano: { uid: 'X', peca: ids[3], encaixou: false } };
/* tirar o Triângulo: a Kimura muda de posição na lista (3 → 2) */
const semTri = planoNovo({ passos: semOGolpe(editar(salvo), 1) });
ok('tirar uma peça muda o índice mas não o id', [semTri.passos.findIndex((x) => x.id === ids[3]), pecaDoRola(semTri, rolaNaKimura)?.golpe], [2, 'Kimura']);
ok('as outras ligações ficam com o mesmo id', semTri.passos.map((x) => x.lig), salvo.passos.filter((_, k) => k !== 1).map((x) => x.lig));
const rem = removidosAoSalvar(salvo, semTri);
ok('o que saiu fica em removidos (peça e ligação)', [rem.pecas.map((x) => x.golpe), rem.ligacoes.map((x) => [x.id, x.de, x.via, x.gatilho])],
  [['Triângulo'], [[salvo.passos[1].lig, ids[0], 'defendeu', 'colou o cotovelo']]]);
const comHist = { ...semTri, removidos: rem };
ok('rola que parou na peça apagada ainda acha o nome', pecaDoRola(comHist, { plano: { peca: ids[1] } }), { id: ids[1], tipo: 'golpe', golpe: 'Triângulo', saiu: true });
ok('onde para: peça apagada aparece com o nome', taxaDoPlano({ ...comHist, uid: 'X' }, [{ plano: { uid: 'X', peca: ids[1], encaixou: false } }]).morreNo, { peca: ids[1], golpe: 'Triângulo', saiu: true, vezes: 1 });
ok('removidos somam a cada salvar', removidosAoSalvar(comHist, planoNovo({ passos: semOGolpe(editar(comHist), 2) })).pecas.map((x) => x.golpe), ['Triângulo', 'Kimura']);
/* renomear, arrastar e pôr finta */
const ren = editar(salvo).map((x, k) => (k === 3 ? { ...x, golpe: 'Kimura da guarda', reacao: 'puxou o braço' } : x));
ok('renomear e mudar o gatilho não mudam id nem ligação', [ren[3].id, ren[3].lig], [ids[3], salvo.passos[3].lig]);
const arr = moverPasso(editar(salvo), 3, 1, 'defendeu');
ok('arrastar: a peça fica com o id, a ligação é outra', [arr[3].id === ids[3], arr[3].lig !== salvo.passos[3].lig], [true, true]);
ok('a ligação de antes do arrasto vai pra removidos', removidosAoSalvar(salvo, planoNovo({ passos: arr })).ligacoes.map((x) => x.id), [salvo.passos[3].lig]);
const ft = fintaAntes(editar(salvo), 3, 'Guilhotina');
ok('finta no meio: o golpe fica com o id, ganha ligação nova, a finta tem id próprio', [ft[3].id === ids[3], ft[3].lig !== salvo.passos[3].lig, !ids.includes(ft[4].id)], [true, true, true]);
ok('tirar a finta: o golpe volta com o mesmo id', semAFinta(ft, 4).map((x) => x.id), ids);
/* o caminho que o rola guarda */
const cs = correnteDoPlano(salvo).passos;
ok('caminho: as ligações da posição até a peça', caminhoAte(cs, 3), [cs[0].lig, cs[2].lig, cs[3].lig]);
ok('ligações apontam pelo id da peça', ligacoesDo(cs)[3], { id: cs[3].lig, de: ids[2], via: 'defendeu', gatilho: '', para: ids[3] });
/* plano guardado antes dos ids */
const velho = { uid: 'V', updatedAt: 100, passos: [{ acao: 'Armlock' }, { acao: '' }, { acao: 'Triângulo' }, { acao: 'Kimura' }] };
ok('plano sem id: a peça leva a posição guardada', correnteDoPlano(velho).passos.map((x) => x.id), ['p0', 'p2', 'p3']);
ok('salvar o plano velho grava esses ids', planoNovo({ passos: editar(velho) }).passos.map((x) => x.id), ['p0', 'p2', 'p3']);
/* migração do rola de antes (ate = posição na lista do dia) */
ok('plano não mudou depois do rola: vira a peça e o caminho', planoDoRolaAntigo({ updatedAt: 200, plano: { uid: 'V', ate: 2, encaixou: true } }, velho),
  { uid: 'V', encaixou: true, peca: 'p3', caminho: ['l0', 'l2', 'l3'] });
ok('plano mudou depois do rola: não chuta, guarda o número', planoDoRolaAntigo({ updatedAt: 50, plano: { uid: 'V', ate: 2, encaixou: true } }, velho),
  { uid: 'V', encaixou: true, peca: null, caminho: [], ateAntigo: 2 });
ok('número que não existe mais: sem peça', planoDoRolaAntigo({ updatedAt: 200, plano: { uid: 'V', ate: 9 } }, velho).peca, null);
ok('plano apagado: sem peça', planoDoRolaAntigo({ updatedAt: 200, plano: { uid: 'Z', ate: 0 } }, undefined).peca, null);
ok('rola já migrado não muda', planoDoRolaAntigo({ plano: { uid: 'V', peca: 'p3' } }, velho), null);
ok('migrado com peça incerta não conta no "onde para"', taxaDoPlano(velho, [{ plano: { uid: 'V', peca: null, ateAntigo: 2, encaixou: false } }]), { usos: 1, encaixes: 0, taxa: 0, morreNo: null });
/* a letra é rótulo, não teto */
ok('letras: A, P, Q, Z, AA, AB, AZ, BA', [0, 15, 16, 25, 26, 27, 51, 52].map(letraDo), ['A', 'P', 'Q', 'Z', 'AA', 'AB', 'AZ', 'BA']);
/* "não reagiu" com mais de uma ameaça: cada uma abre o seu plano */
const nr = planoNovo({ passos: [
  { tipo: 'finta', golpe: 'Guilhotina', pai: null },
  { golpe: 'Armlock', pai: 0, via: 'reagiu' },
  { golpe: 'Kimura', pai: 0, via: 'naoReagiu' },
  { golpe: 'Omoplata', pai: 0, via: 'naoReagiu' },
] });
const anr = arvoreDoPlano(correnteDoPlano(nr).passos);
ok('duas ameaças no "não reagiu", cada uma com letra', anr.ordem.map((i) => `${letraDo(anr.trilho[i])}:${nr.passos[i].acao || nr.passos[i].descricao}`), ['A:Guilhotina', 'A:Armlock', 'B:Kimura', 'C:Omoplata']);
ok('"não reagiu" não pede gatilho (é escolha sua)', semGatilho(correnteDoPlano(nr).passos), []);

ok('"meia guarda" acha Kimura da meia-guarda', casaApelido('Kimura da meia-guarda', 'meia guarda'), true);
ok('"triangulo" não acha Kimura', casaApelido('Kimura', 'triangulo'), false);

/* ---------- plano grande: sem teto de peças ----------
   60 peças: 3 entradas, cada uma com finta, reagiu e não reagiu,
   cada golpe com 2 defesas, e um galho que desce 30 níveis. */
const gPassos = [];
const poe = (x) => { gPassos.push(x); return gPassos.length - 1; };
for (let e = 0; e < 3; e++) {
  const f = poe({ tipo: 'finta', golpe: `Finta ${e}`, pai: null });
  for (const via of ['reagiu', 'naoReagiu', 'naoReagiu']) {
    const g = poe({ golpe: `Golpe ${e}-${via}-${gPassos.length}`, reacao: 'ele mexeu', pai: f, via });
    poe({ golpe: `Defesa A ${g}`, reacao: 'colou', pai: g, via: 'defendeu' });
    poe({ golpe: `Defesa B ${g}`, reacao: 'girou', pai: g, via: 'defendeu' });
  }
}
let fundo = 10; /* o galho fundo nasce da finta da 2ª entrada */
for (let k = 0; gPassos.length < 60; k++) fundo = poe({ golpe: `Fundo ${k}`, reacao: 'defendeu de novo', pai: fundo, via: k % 3 ? 'defendeu' : 'encaixou' });
const gSalvo = planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos: gPassos });
ok('plano grande: as 60 peças salvam', gSalvo.passos.length, 60);
const gRecarregado = JSON.parse(JSON.stringify(gSalvo));
ok('recarregar (JSON do sync) volta com as 60, mesmos ids', JSON.stringify(editar(gRecarregado).map((x) => x.id)) === JSON.stringify(gSalvo.passos.map((x) => x.id)), true);
ok('salvar de novo não perde peça nem muda id', JSON.stringify(planoNovo({ passos: editar(gRecarregado) }).passos.map((x) => [x.id, x.lig, x.pai, x.via])) === JSON.stringify(gSalvo.passos.map((x) => [x.id, x.lig, x.pai, x.via])), true);
const ga = arvoreDoPlano(editar(gSalvo));
ok('a árvore lê as 60, cada uma uma vez', [ga.ordem.length, new Set(ga.ordem).size], [60, 60]);
ok('letra passa do Z sem quebrar', letraDo(ga.trilhos - 1).length >= 1 && ga.trilhos > 26, true);
const gFundo = editar(gSalvo).length - 1;
ok('caminho do galho fundo tem todas as ligações até a posição', caminhoAte(editar(gSalvo), gFundo).length > 30, true);
const rolaNoFundo = { plano: { uid: 'G', peca: gSalvo.passos[gFundo].id, caminho: caminhoAte(editar(gSalvo), gFundo), encaixou: true } };
const gComMais = planoNovo({ passos: [...editar(gSalvo), { golpe: 'Peça 61', pai: 10, via: 'naoReagiu' }] });
ok('peça nova entra no fim, o rola acha a mesma peça', [gComMais.passos.length, pecaDoRola(gComMais, rolaNoFundo)?.golpe], [61, gSalvo.passos[gFundo].acao]);
const gSemEntrada = planoNovo({ passos: semOGolpe(editar(gComMais), 0) });
ok('apagar a 1ª entrada leva a finta, os 3 golpes e as 6 defesas dela, e só', gSemEntrada.passos.length, 51);
ok('o rola do galho fundo sobrevive ao apagar outra entrada', pecaDoRola(gSemEntrada, rolaNoFundo)?.saiu, false);
const gHist = { ...gSemEntrada, removidos: removidosAoSalvar(gComMais, gSemEntrada) };
ok('o que saiu fica em removidos', gHist.removidos.pecas.length, gComMais.passos.length - gSemEntrada.passos.length);
const t0 = Date.now();
const gigante = planoNovo({ passos: Array.from({ length: 2000 }, (_, i) => ({ golpe: `G${i}`, pai: i ? Math.floor((i - 1) / 2) : null, via: i % 2 ? 'encaixou' : 'defendeu' })) });
const ag2 = arvoreDoPlano(correnteDoPlano(gigante).passos);
ok('2000 peças: salva e lê sem cortar', [gigante.passos.length, ag2.ordem.length], [2000, 2000]);
ok('2000 peças em menos de 1s', Date.now() - t0 < 1000, true);

/* ---------- R2: escapou não é defesa ----------
   Defendeu: continua na posição e emenda dali. Escapou: a luta mudou
   de lugar; a situação guarda onde ficou, e dela sai o "volto a
   atacar", atrás do mesmo objetivo. Situação sem caminho fecha, sem
   continuação inventada e sem aviso de ponta solta. */
const fuga = planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos: [
  { golpe: 'Armlock', pai: null },                                                                      // 0
  { golpe: 'Triângulo', reacao: 'colou o cotovelo', pai: 0, via: 'defendeu' },                          // 1
  { tipo: 'situacao', golpe: 'Guarda fechada', reacao: 'girou e recuperou a guarda', pai: 0, via: 'escapou' }, // 2
  { golpe: 'Raspagem de quadril (hip bump)', reacao: 'sentou pra trás', pai: 2, via: 'encaixou' },     // 3
  { golpe: 'Kimura', pai: 3, via: 'encaixou' },                                                         // 4
  { tipo: 'situacao', golpe: 'De pé', reacao: 'levantou e saiu', pai: 0, via: 'escapou' },             // 5
] });
ok('escapou guarda a situação com tipo próprio', fuga.passos.map((x) => x.tipo || 'golpe'), ['golpe', 'golpe', 'situacao', 'golpe', 'golpe', 'situacao']);
ok('vias: da situação sai "volto a atacar", seja qual for o que veio', fuga.passos.map((x) => x.via), [null, 'defendeu', 'escapou', 'retoma', 'encaixou', 'escapou']);
ok('como ele escapou vira o gatilho da situação', fuga.passos[2].gatilho, 'girou e recuperou a guarda');
const cfu = correnteDoPlano(fuga);
const afu = arvoreDoPlano(cfu.passos);
ok('a fuga abre plano próprio e a reconstrução segue nele', afu.ordem.map((i) => [cfu.passos[i].golpe, letraDo(afu.trilho[i])]),
  [['Armlock', 'A'], ['Triângulo', 'B'], ['Guarda fechada', 'C'], ['Raspagem de quadril (hip bump)', 'C'], ['Kimura', 'C'], ['De pé', 'D']]);
const destinoFim = (n) => (['Armlock', 'Triângulo', 'Kimura'].includes(n) ? { slug: 'finalizacao', nome: 'Finalização' } : destinoDe(n));
ok('situação sem caminho não é ponta solta; o caminho da fuga chega no objetivo', pontasSoltas(fuga, destinoFim).map((x) => x.golpe), []);
ok('reconstrução que para antes do objetivo é ponta solta',
  pontasSoltas(planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos: editar(fuga).slice(0, 4) }), destinoFim).map((x) => x.golpe),
  ['Raspagem de quadril (hip bump)']);
ok('situação nunca ganha a bandeira, nem quando a posição é o objetivo',
  [chegaNoObjetivo(cfu.passos[2], { objetivo: 'Guarda fechada', objetivoTipo: 'posicao' }, () => ({ slug: 'guarda-fechada', nome: 'Guarda fechada' })), chegaNoObjetivo(cfu.passos[4], cfu, destinoFim)], [false, true]);
ok('golpe abre encaixou, defendeu e escapou; situação, só volto a atacar', [viasDa(cfu.passos[0]), viasDa(cfu.passos[2])], [['encaixou', 'defendeu', 'escapou'], ['retoma']]);
ok('no escapou só entra situação, e situação só no escapou',
  [vagaLivre(cfu.passos, 0, 'escapou', 'situacao'), vagaLivre(cfu.passos, 0, 'escapou', 'golpe'), vagaLivre(cfu.passos, 1, 'defendeu', 'situacao'), vagaLivre(cfu.passos, 2, 'retoma'), vagaLivre(cfu.passos, 2, 'encaixou')],
  [true, false, false, true, false]);
ok('arrastar a situação pro escapou de outro golpe', (() => { const m = moverPasso(cfu.passos, 5, 1, 'escapou'); return m && [m[5].pai, m[5].via]; })(), [1, 'escapou']);
ok('golpe não vai pro escapou; situação não vai pra defesa', [moverPasso(cfu.passos, 1, 4, 'escapou'), moverPasso(cfu.passos, 5, 1, 'defendeu')], [null, null]);
ok('duas fugas pra mesma posição sem dizer como: aviso',
  semGatilho([...cfu.passos, { tipo: 'situacao', golpe: 'De pé', reacao: '', pai: 0, via: 'escapou' }].map((x, k) => (k === 5 ? { ...x, reacao: '' } : x))).map((x) => x.golpe), ['De pé', 'De pé']);
ok('fugas pra posições diferentes já se separam pela posição', semGatilho(cfu.passos.map((x) => ({ ...x, reacao: x.via === 'escapou' ? '' : x.reacao }))), []);
const fugaRec = JSON.parse(JSON.stringify(fuga));
ok('recarregar (JSON do sync): mesma situação, mesmos ids, mesmas vias',
  JSON.stringify(planoNovo({ ...fugaRec, passos: editar(fugaRec) }).passos.map((x) => [x.id, x.lig, x.tipo, x.pai, x.via])) === JSON.stringify(fuga.passos.map((x) => [x.id, x.lig, x.tipo, x.pai, x.via])), true);
const rolaFuga = { plano: { uid: 'F', peca: fuga.passos[4].id, caminho: caminhoAte(cfu.passos, 4), encaixou: true } };
ok('o rola guarda o caminho passando pela fuga', rolaFuga.plano.caminho, [0, 2, 3, 4].map((k) => fuga.passos[k].lig));
ok('tirar a situação leva a reconstrução junto', planoNovo({ passos: semOGolpe(editar(fuga), 2) }).passos.map((x) => x.acao), ['Armlock', 'Triângulo', 'De pé']);
const comFinta = fintaAntes(editar(fuga), 3, 'Guilhotina');
ok('finta antes do volto a atacar: a finta nasce da situação', [comFinta[6].pai, comFinta[6].via, comFinta[3].pai, comFinta[3].via], [2, 'retoma', 6, 'reagiu']);
ok('tirar essa finta devolve o golpe pra situação', (() => { const s = semAFinta(comFinta, 6); return [s[3].pai, s[3].via]; })(), [2, 'retoma']);
ok('o rola da Kimura sobrevive à finta nova', pecaDoRola(planoNovo({ passos: comFinta }), rolaFuga)?.golpe, 'Kimura');
ok('planos prontos só usam as saídas do modelo',
  PLANOS_ATAQUE.every((p) => correnteDoPlano(p).passos.every((x) => x.via === null || VIAS.includes(x.via))), true);
ok('plano antigo (fila sem pai) continua lendo igual', correnteDoPlano({ passos: [{ acao: 'A' }, { acao: 'B' }] }).passos.map((x) => [x.tipo, x.pai, x.via]), [['golpe', null, null], ['golpe', 0, 'defendeu']]);

/* ---------- R3: convergência ----------
   Uma saída liga numa peça que já existe: três fintas abrem o mesmo
   armlock com um cartão só, cada caminho com id e gatilho próprios. A
   fuga volta pra posição de onde começa ou pra uma situação que já
   existe. A árvore (arrumação, caminho do rola) não segue ligação extra,
   então o retorno não vira laço. */
const { convergenciasValidas, destinosDaLigacao, comLigacao, situacaoNoObjetivo } = await import('../src/lib/planos.js');
const conv = planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', posicao: 'Guarda fechada', passos: [
  { id: 'fA', lig: 'lA', tipo: 'finta', golpe: 'Guilhotina', pai: null },                                             // 0
  { id: 'fB', lig: 'lB', tipo: 'finta', golpe: 'Raspagem de tesoura', pai: null },                                    // 1
  { id: 'fC', lig: 'lC', tipo: 'finta', golpe: 'Kimura', pai: null },                                                 // 2
  { id: 'arm', lig: 'lArm', golpe: 'Armlock', reacao: 'levantou a cabeça', pai: 0, via: 'reagiu' },                   // 3
  { id: 'tri', lig: 'lTri', golpe: 'Triângulo', reacao: 'colou o cotovelo', pai: 3, via: 'defendeu' },                // 4
  { id: 'sit', lig: 'lSit', tipo: 'situacao', golpe: 'Meia-guarda', reacao: 'passou a perna', pai: 3, via: 'escapou' }, // 5
  { id: 'hip', lig: 'lHip', golpe: 'Raspagem de quadril (hip bump)', pai: 1, via: 'naoReagiu' },                      // 6
], ligacoes: [
  { id: 'cB', de: 'fB', via: 'reagiu', gatilho: ' apoiou a mão ', para: 'arm' },
  { id: 'cC', de: 'fC', via: 'reagiu', gatilho: 'escondeu o braço', para: 'arm' },
  { id: 'volta', de: 'tri', via: 'escapou', gatilho: 'girou e recuperou a guarda', para: null },
  { id: 'reat', de: 'sit', via: 'retoma', gatilho: '', para: 'arm' },
  { id: 'esc2', de: 'hip', via: 'escapou', gatilho: 'levantou', para: 'sit' },
  { id: 'x1', de: 'arm', via: 'encaixou', para: 'arm' },
  { id: 'x2', de: 'arm', via: 'escapou', para: 'tri' },
  { id: 'x3', de: 'arm', via: 'defendeu', para: 'sit' },
  { id: 'x4', de: 'arm', via: 'defendeu', para: 'tri' },
  { id: 'x5', de: 'fB', via: 'reagiu', para: 'arm' },
  { id: 'x6', de: 'zz', via: 'reagiu', para: 'arm' },
  { id: 'x7', de: 'fA', via: 'encaixou', para: 'tri' },
  { id: 'x8', de: null, via: null, para: 'arm' },
  { de: 'fC', via: 'naoReagiu', para: 'tri' },
  { id: 'x9', de: 'arm', via: 'encaixou', para: null },
] });
const ccv = correnteDoPlano(conv);
ok('ficam só as ligações que valem (sem laço na própria peça, tipo errado, fio da árvore repetido, repetida, ponta que não existe)',
  conv.ligacoes.map((l) => l.id), ['cB', 'cC', 'volta', 'reat', 'esc2']);
ok('o gatilho é da ligação, sem espaço sobrando', conv.ligacoes[0].gatilho, 'apoiou a mão');
ok('três fintas, um Armlock só', conv.passos.filter((x) => x.acao === 'Armlock').length, 1);
ok('cada caminho até o Armlock tem id e gatilho próprios',
  ligacoesDo(ccv.passos, ccv.ligacoes).filter((l) => l.para === 'arm').map((l) => [l.id, l.de, l.via, l.gatilho]),
  [['lArm', 'fA', 'reagiu', 'levantou a cabeça'], ['cB', 'fB', 'reagiu', 'apoiou a mão'], ['cC', 'fC', 'reagiu', 'escondeu o braço'], ['reat', 'sit', 'retoma', '']]);
ok('a fuga volta pra posição de onde começa (para null)', ccv.ligacoes.find((l) => l.id === 'volta').para, null);
ok('a fuga de outro caminho chega na situação que já existe', ccv.ligacoes.find((l) => l.id === 'esc2').para, 'sit');
const acv = arvoreDoPlano(ccv.passos);
ok('retorno não vira laço: a árvore passa uma vez em cada peça', [acv.ordem.length, new Set(acv.ordem).size], [7, 7]);
ok('a arrumação é a mesma com e sem ligação', JSON.stringify(arvoreDoPlano(correnteDoPlano({ ...conv, ligacoes: [] }).passos)) === JSON.stringify(acv), true);
ok('o caminho do rola segue a árvore, sem atalho', caminhoAte(ccv.passos, 4), ['lA', 'lArm', 'lTri']);
ok('finta que reage pelo atalho não é ponta solta; o golpe sem caminho é', pontasSoltas(conv, destinoFim).map((x) => x.golpe), ['Raspagem de quadril (hip bump)']);
ok('situação que volta a atacar por atalho não é ponta solta nem "fecha"', pontasSoltas(conv, destinoFim).some((x) => x.tipo === 'situacao'), false);
const iArm = ccv.passos.findIndex((x) => x.id === 'arm');
const iTri = ccv.passos.findIndex((x) => x.id === 'tri');
ok('destinos da defesa do Armlock: golpe ou finta, sem ele mesmo nem o fio que já existe',
  destinosDaLigacao(ccv.passos, ccv.ligacoes, iArm, 'defendeu'), ['fA', 'fB', 'fC', 'hip']);
ok('destinos da fuga do Triângulo: a situação (a posição já está ligada)', destinosDaLigacao(ccv.passos, ccv.ligacoes, iTri, 'escapou'), ['sit']);
ok('mudando a própria ligação, o destino dela volta pra lista', destinosDaLigacao(ccv.passos, ccv.ligacoes, iTri, 'escapou', 'volta'), [null, 'sit']);
const soGatilho = comLigacao(ccv.ligacoes, { id: 'cB', de: 'fB', via: 'reagiu', gatilho: 'apoiou as duas mãos', para: 'arm' });
ok('mudar só o gatilho: mesmo caminho, mesmo id', soGatilho.find((l) => l.de === 'fB').id, 'cB');
const outroDestino = comLigacao(ccv.ligacoes, { id: 'cB', de: 'fB', via: 'reagiu', gatilho: 'apoiou a mão', para: 'tri' });
ok('mudar o destino: outro caminho, id novo, o de antes sai', [outroDestino.some((l) => l.id === 'cB'), outroDestino.length, outroDestino.find((l) => l.de === 'fB').para], [false, 5, 'tri']);
ok('ligação nova entra com id', (() => { const n = comLigacao(ccv.ligacoes, { de: 'arm', via: 'defendeu', para: 'fA' }); return n.length === 6 && !!n[5].id; })(), true);
const recv = JSON.parse(JSON.stringify(conv));
ok('recarregar (JSON do sync): mesmas ligações, mesmos ids',
  JSON.stringify(planoNovo({ ...recv, passos: editar(recv), ligacoes: correnteDoPlano(recv).ligacoes }).ligacoes) === JSON.stringify(conv.ligacoes), true);
const movTri = moverPasso(editar(conv), iTri, ccv.passos.findIndex((x) => x.id === 'hip'), 'defendeu');
ok('arrastar a peça não mexe nas ligações dela nem nas que chegam',
  planoNovo({ ...conv, passos: movTri, ligacoes: ccv.ligacoes }).ligacoes.map((l) => l.id), ['cB', 'cC', 'volta', 'reat', 'esc2']);
ok('renomear o destino não muda nenhuma ligação',
  planoNovo({ ...conv, passos: editar(conv).map((x) => (x.id === 'arm' ? { ...x, golpe: 'Armlock da guarda fechada' } : x)), ligacoes: ccv.ligacoes }).ligacoes.map((l) => l.id),
  ['cB', 'cC', 'volta', 'reat', 'esc2']);
const semLig = planoNovo({ ...conv, passos: editar(conv), ligacoes: ccv.ligacoes.filter((l) => l.id !== 'cC') });
const remLig = removidosAoSalvar(conv, semLig);
ok('tirar uma ligação: a peça fica, a ligação vai pros removidos', [semLig.passos.length, remLig.pecas, remLig.ligacoes.map((l) => [l.id, l.de, l.para])], [7, [], [['cC', 'fC', 'arm']]]);
ok('ligação que voltou sai dos removidos', removidosAoSalvar({ ...semLig, removidos: remLig }, conv).ligacoes, []);
const semArm = planoNovo({ ...conv, passos: semOGolpe(editar(conv), iArm), ligacoes: ccv.ligacoes });
ok('tirar o Armlock leva junto as ligações que chegam nele e no galho dele', semArm.ligacoes.map((l) => l.id), []);
ok('e elas ficam nos removidos com as duas pontas', removidosAoSalvar(conv, semArm).ligacoes.filter((l) => ['cB', 'cC', 'reat', 'esc2', 'volta'].includes(l.id)).length, 5);
const semFB = planoNovo({ ...conv, passos: semAFinta(editar(conv), 1), ligacoes: ccv.ligacoes });
ok('tirar a finta B: sai o atalho dela e o que nascia do não reagiu', semFB.ligacoes.map((l) => l.id), ['cC', 'volta', 'reat']);
const rolaTri = { plano: { uid: 'C', peca: 'tri', caminho: caminhoAte(ccv.passos, iTri), encaixou: false } };
ok('rola antigo acha a peça depois de pôr e tirar ligações', [pecaDoRola(semLig, rolaTri)?.golpe, pecaDoRola(conv, rolaTri)?.golpe], ['Triângulo', 'Triângulo']);
const histArm = { ...semArm, removidos: removidosAoSalvar(conv, semArm) };
ok('rola que passou por um atalho apagado ainda acha as duas pontas (base do R7)',
  (() => { const l = histArm.removidos.ligacoes.find((x) => x.id === 'cB'); return [l.de, l.via, l.para, histArm.removidos.pecas.find((x) => x.id === l.para)?.golpe]; })(),
  ['fB', 'reagiu', 'arm', 'Armlock']);
ok('plano antigo sem ligações: lista vazia; as ligações dos prontos valem todas', [correnteDoPlano({ passos: [{ acao: 'A' }] }).ligacoes, PLANOS_ATAQUE.every((p) => correnteDoPlano(p).ligacoes.length === (p.ligacoes || []).length)], [[], true]);
ok('ligações malformadas não quebram a leitura', [correnteDoPlano({ passos: [{ acao: 'A' }], ligacoes: 'x' }).ligacoes, correnteDoPlano({ passos: [{ acao: 'A' }], ligacoes: [null, {}] }).ligacoes], [[], []]);

/* o objetivo é uma posição e a fuga deixa a luta nela: a situação é o
   momento, a posição é o lugar. Não conta: falta a ação que estabelece o controle. */
const costas = { objetivo: 'Costas', objetivoTipo: 'posicao' };
const destCostas = (n) => (n === 'Pegada das costas' ? { slug: 'costas', nome: 'Costas' } : null);
const fugaCostas = planoNovo({ ...costas, passos: [
  { id: 'a', golpe: 'Armlock', pai: null },
  { id: 's', tipo: 'situacao', golpe: 'Costas', reacao: 'virou de quatro', pai: 0, via: 'escapou' },
  { id: 'm', tipo: 'situacao', golpe: 'Meia-guarda', reacao: 'recuperou a guarda', pai: 0, via: 'escapou' },
] });
const cfc = correnteDoPlano(fugaCostas);
ok('fuga pra posição do objetivo: a situação está lá, mas não ganha bandeira', [situacaoNoObjetivo(cfc.passos[1], cfc), chegaNoObjetivo(cfc.passos[1], cfc, destCostas)], [true, false]);
ok('sem a ação que estabelece o controle, é ponta solta; a outra fuga só fecha', pontasSoltas(fugaCostas, destCostas).map((x) => x.golpe), ['Armlock', 'Costas']);
ok('com a ação que estabelece o controle da posição, chega', pontasSoltas(planoNovo({ ...costas, passos: [...editar(fugaCostas), { golpe: 'Pegada das costas', pai: 1, via: 'retoma' }] }), destCostas).map((x) => x.golpe), ['Armlock']);
ok('situação noutra posição não é do objetivo', [situacaoNoObjetivo(cfc.passos[2], cfc), situacaoNoObjetivo(cfc.passos[1], { objetivo: 'Finalizar', objetivoTipo: 'finalizar' })], [false, false]);

/* ---------- convergência e histórico: por qual entrada ele chegou ----------
   Três fintas levam ao mesmo Armlock e dele sai uma continuação comum
   (defendeu: Triângulo; defendeu: Omoplata). O rola guarda a lista de
   ligações, então mesmo com o fim igual dá pra saber se entrou pela
   finta A, B ou C. Salvar, recarregar e apagar uma das ligações não pode
   mudar o que o rola antigo diz. */
const { caminhoDoRola, alcancouObjetivo, finalizacoesDoObjetivo, ehPreferida, escolhaDaFinalizacao } = await import('../src/lib/planos.js');
const fimR = { slug: 'finalizacao', nome: 'Finalização' };
const destRota = (n) => (['Armlock', 'Triângulo', 'Kimura', 'Omoplata', 'Guilhotina'].includes(n) ? fimR : null);
const rota = planoNovo({ nome: 'Três fintas, um armlock', objetivo: 'Finalizar', objetivoTipo: 'finalizar', posicao: 'Guarda fechada', passos: [
  { id: 'fA', lig: 'lA', tipo: 'finta', golpe: 'Guilhotina', pai: null },
  { id: 'fB', lig: 'lB', tipo: 'finta', golpe: 'Raspagem de tesoura', pai: null },
  { id: 'fC', lig: 'lC', tipo: 'finta', golpe: 'Kimura', pai: null },
  { id: 'arm', lig: 'lArm', golpe: 'Armlock', reacao: 'levantou a cabeça', pai: 0, via: 'reagiu' },
  { id: 'tri', lig: 'lTri', golpe: 'Triângulo', reacao: 'puxou o braço', pai: 3, via: 'defendeu' },
  { id: 'omo', lig: 'lOmo', golpe: 'Omoplata', reacao: 'tirou a cabeça', pai: 4, via: 'defendeu' },
], ligacoes: [
  { id: 'cB', de: 'fB', via: 'reagiu', gatilho: 'apoiou a mão', para: 'arm' },
  { id: 'cC', de: 'fC', via: 'reagiu', gatilho: 'escondeu o braço', para: 'arm' },
] });
const rolaPor = (caminho, peca = 'omo', encaixou = true) => ({ plano: { uid: 'R', peca, caminho, encaixou } });
const rolasRota = [rolaPor(['lA', 'lArm', 'lTri', 'lOmo']), rolaPor(['lB', 'cB', 'lTri', 'lOmo']), rolaPor(['lC', 'cC', 'lTri', 'lOmo'])];
const lerRotas = (p, rs) => rs.map((r) => caminhoDoRola(p, r.plano.caminho)).map((k) => ({
  inteiro: k.inteiro, entrada: k.ligacoes[0]?.para, chega: k.ligacoes[1] && [k.ligacoes[1].id, k.ligacoes[1].para],
  resto: k.ligacoes.slice(2).map((l) => l.id), saiu: k.ligacoes.filter((l) => l?.saiu).map((l) => l.id),
}));
const lidas = lerRotas(rota, rolasRota);
ok('cada rola diz por qual finta entrou', lidas.map((x) => x.entrada), ['fA', 'fB', 'fC']);
ok('e por qual ligação chegou no mesmo Armlock', lidas.map((x) => x.chega), [['lArm', 'arm'], ['cB', 'arm'], ['cC', 'arm']]);
ok('depois da convergência, a mesma continuação até a finalização', lidas.map((x) => x.resto), [['lTri', 'lOmo'], ['lTri', 'lOmo'], ['lTri', 'lOmo']]);
ok('os três caminhos fecham da posição até a peça', lidas.map((x) => x.inteiro), [true, true, true]);
ok('caminho trocado (entra pela A e chega pela ligação da B) não fecha', caminhoDoRola(rota, ['lA', 'cB', 'lTri', 'lOmo']).inteiro, false);
ok('caminho vazio ou com id que não existe não fecha', [caminhoDoRola(rota, []).inteiro, caminhoDoRola(rota, ['lA', 'zz']).inteiro], [false, false]);
/* salvar e recarregar: o JSON do sync e o editor salvando de novo */
const viaSync = (x) => JSON.parse(JSON.stringify(x));
const rotaRecv = viaSync(rota);
const rotaResalva = planoNovo({ ...rotaRecv, passos: editar(rotaRecv), ligacoes: correnteDoPlano(rotaRecv).ligacoes });
ok('recarregar e salvar de novo: os três rolas dizem o mesmo', JSON.stringify(lerRotas(rotaResalva, viaSync(rolasRota))) === JSON.stringify(lidas), true);
/* apagar a ligação da finta B */
const semCB = planoNovo({ ...rotaResalva, passos: editar(rotaResalva), ligacoes: correnteDoPlano(rotaResalva).ligacoes.filter((l) => l.id !== 'cB') });
const histCB = viaSync({ ...semCB, removidos: removidosAoSalvar(rotaResalva, semCB) });
const depois = lerRotas(histCB, viaSync(rolasRota));
ok('apagar a ligação da B: a finta e o Armlock ficam', [histCB.passos.length, histCB.passos.some((x) => x.id === 'fB'), histCB.ligacoes.map((l) => l.id)], [6, true, ['cC']]);
ok('o rola que entrou pela B continua dizendo B, com a ligação marcada como saída', [depois[1].entrada, depois[1].chega, depois[1].saiu, depois[1].inteiro], ['fB', ['cB', 'arm'], ['cB'], true]);
ok('a ligação apagada guarda o gatilho daquele caminho', caminhoDoRola(histCB, rolasRota[1].plano.caminho).ligacoes[1].gatilho, 'apoiou a mão');
ok('os rolas da A e da C não mudam', [depois[0], depois[2]], [lidas[0], lidas[2]]);
/* mais um salvar (renomeia a finta B): o que saiu continua nos removidos */
const renB = planoNovo({ ...histCB, passos: editar(histCB).map((x) => (x.id === 'fB' ? { ...x, golpe: 'Raspagem de gancho' } : x)), ligacoes: correnteDoPlano(histCB).ligacoes });
const histRen = viaSync({ ...renB, removidos: removidosAoSalvar(histCB, renB) });
ok('outro salvar não perde a ligação apagada', [histRen.removidos.ligacoes.some((l) => l.id === 'cB'), lerRotas(histRen, rolasRota)[1].inteiro], [true, true]);
/* ligar a B no Armlock de novo: é outro caminho, com id novo; o rola antigo segue no de antes */
const religadas = comLigacao(correnteDoPlano(histRen).ligacoes, { de: 'fB', via: 'reagiu', gatilho: 'apoiou a mão', para: 'arm' });
const novaB = religadas.find((l) => l.de === 'fB').id;
const comNovaB = planoNovo({ ...histRen, passos: editar(histRen), ligacoes: religadas });
const histNova = viaSync({ ...comNovaB, removidos: removidosAoSalvar(histRen, comNovaB) });
ok('religar a B gera id novo e a de antes fica nos removidos', [novaB !== 'cB', histNova.removidos.ligacoes.some((l) => l.id === 'cB')], [true, true]);
ok('rola antigo pela B aponta pro caminho apagado; rola novo pela B, pro caminho novo',
  [lerRotas(histNova, [rolasRota[1]])[0].saiu, lerRotas(histNova, [rolaPor(['lB', novaB, 'lTri', 'lOmo'])])[0].saiu, lerRotas(histNova, [rolaPor(['lB', novaB, 'lTri', 'lOmo'])])[0].inteiro],
  [['cB'], [], true]);
/* tentativa x chegada: passar pelo cartão não é ter chegado */
ok('parou no Armlock sem encaixar: tentativa, não chegou', alcancouObjetivo(histNova, rolaPor(['lB', 'cB'], 'arm', false), destRota), false);
ok('passou pelo Armlock e encaixou na Omoplata: chegou', alcancouObjetivo(histNova, rolasRota[1], destRota), true);
ok('rola sem plano não chega', alcancouObjetivo(histNova, {}, destRota), false);

/* ---------- R4: finalizar, com preferida e aceitas ----------
   Objetivo principal: Finalizar. Preferida: Armlock. Aceitas: Triângulo,
   Kimura, Omoplata. A lista é preferência: qualquer finalização que
   encaixa alcança o objetivo Finalizar; a preferida tem destaque e a
   de fora da lista aparece como outra. Objetivo golpe: só ele conta. */
const r4 = planoNovo({
  objetivo: 'Finalizar', objetivoTipo: 'finalizar', finalizacaoPreferida: ' Armlock ',
  finalizacoesAceitas: ['Triângulo', 'Kimura', 'Omoplata', 'Armlock', 'Kimura', ''],
  passos: [
    { id: 'a', golpe: 'Armlock', pai: null },
    { id: 't', golpe: 'Triângulo', reacao: 'puxou o braço', pai: 0, via: 'defendeu' },
    { id: 'g', golpe: 'Guilhotina', reacao: 'subiu a cabeça', pai: 0, via: 'defendeu' },
    { id: 'r', golpe: 'Raspagem de quadril (hip bump)', reacao: 'levantou a postura', pai: 0, via: 'defendeu' },
  ],
});
const cr4 = correnteDoPlano(r4);
ok('o objetivo principal continua Finalizar', [r4.objetivo, r4.objetivoTipo], ['Finalizar', 'finalizar']);
ok('preferida sem espaço; aceitas sem repetida, sem vazia e sem a preferida', [r4.finalizacaoPreferida, r4.finalizacoesAceitas], ['Armlock', ['Triângulo', 'Kimura', 'Omoplata']]);
ok('a lista do objetivo: a preferida primeiro', finalizacoesDoObjetivo(cr4), ['Armlock', 'Triângulo', 'Kimura', 'Omoplata']);
ok('preferida, aceita e finalização fora da lista chegam; raspagem não', cr4.passos.map((x) => chegaNoObjetivo(x, cr4, destRota)), [true, true, true, false]);
ok('preferência: preferida, aceita, outra (Guilhotina) e nada na raspagem', cr4.passos.map((x) => escolhaDaFinalizacao(x, cr4, destRota)), ['preferida', 'aceita', 'outra', '']);
ok('objetivo golpe Armlock: só o Armlock conta, a Guilhotina e o Triângulo não',
  (() => { const k = correnteDoPlano({ ...r4, objetivo: 'Armlock', objetivoTipo: 'tecnica' }); return [k.passos.map((x) => chegaNoObjetivo(x, k, destRota)), k.passos.map((x) => escolhaDaFinalizacao(x, k, destRota))]; })(),
  [[true, false, false, false], ['', '', '', '']]);
ok('só a preferida tem destaque', cr4.passos.map((x) => ehPreferida(x, cr4)), [true, false, false, false]);
ok('finalização fora da lista alcança o objetivo (não é ponta solta); a raspagem é', pontasSoltas(r4, destRota).map((x) => x.golpe), ['Raspagem de quadril (hip bump)']);
ok('finta com o nome da preferida não chega', [chegaNoObjetivo({ tipo: 'finta', golpe: 'Armlock' }, cr4, destRota), ehPreferida({ tipo: 'finta', golpe: 'Armlock' }, cr4)], [false, false]);
const soFinalizar = planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos: editar(r4).map(({ reacao, ...x }) => x) });
ok('só "Finalizar": preferida e aceitas vazias e qualquer finalização serve',
  [soFinalizar.finalizacaoPreferida, soFinalizar.finalizacoesAceitas, correnteDoPlano(soFinalizar).passos.map((x) => chegaNoObjetivo(x, correnteDoPlano(soFinalizar), destRota))],
  ['', [], [true, true, true, false]]);
const soAceitas = correnteDoPlano(planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', finalizacoesAceitas: ['Guilhotina'], passos: editar(r4) }));
ok('só aceitas, sem preferida: chegam as aceitas, nenhuma com destaque',
  [soAceitas.passos.map((x) => chegaNoObjetivo(x, soAceitas, destRota)), soAceitas.passos.some((x) => ehPreferida(x, soAceitas)), soAceitas.passos.map((x) => escolhaDaFinalizacao(x, soAceitas, destRota))],
  [[true, true, true, false], false, ['outra', 'outra', 'aceita', '']]);
ok('sem lista: chega, sem marca de preferência', correnteDoPlano(soFinalizar).passos.map((x) => escolhaDaFinalizacao(x, correnteDoPlano(soFinalizar), destRota)), ['', '', '', '']);
ok('trocar o objetivo pra posição leva embora a preferida e as aceitas',
  (() => { const p = planoNovo({ ...r4, objetivo: 'Montada', objetivoTipo: 'posicao', passos: editar(r4) }); return [p.finalizacaoPreferida, p.finalizacoesAceitas, correnteDoPlano({ ...r4, objetivoTipo: 'posicao' }).finalizacoesAceitas]; })(),
  ['', [], undefined]);
const r4Recv = viaSync(r4);
ok('recarregar e salvar de novo mantém preferida e aceitas',
  (() => { const p = planoNovo({ ...r4Recv, passos: editar(r4Recv) }); return [p.finalizacaoPreferida, p.finalizacoesAceitas]; })(), ['Armlock', ['Triângulo', 'Kimura', 'Omoplata']]);
ok('plano antigo sem preferida e sem aceitas, nada muda; nos prontos, preferida só no finalizar',
  [correnteDoPlano({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos: [{ acao: 'Kimura' }] }).finalizacoesAceitas,
    PLANOS_ATAQUE.every((p) => { const k = correnteDoPlano(p); return k.objetivoTipo === 'finalizar' || (!k.finalizacaoPreferida && !(k.finalizacoesAceitas || []).length); })],
  [[], true]);
ok('campo malformado não quebra', correnteDoPlano({ objetivoTipo: 'finalizar', objetivo: 'Finalizar', finalizacoesAceitas: 'x', passos: [] }).finalizacoesAceitas, []);
/* com convergência: preferida Armlock, aceita Omoplata */
const rotaR4 = { ...histNova, finalizacaoPreferida: 'Armlock', finalizacoesAceitas: ['Omoplata'] };
ok('pela C, encaixou na Omoplata aceita, no Armlock preferido e no Triângulo fora da lista: os três alcançam',
  [alcancouObjetivo(rotaR4, rolasRota[2], destRota), alcancouObjetivo(rotaR4, rolaPor(['lC', 'cC'], 'arm'), destRota), alcancouObjetivo(rotaR4, rolaPor(['lC', 'cC', 'lTri'], 'tri'), destRota)],
  [true, true, true]);
ok('no rola, objetivo e preferência separados: aceita, preferida, outra',
  [rolasRota[2], rolaPor(['lC', 'cC'], 'arm'), rolaPor(['lC', 'cC', 'lTri'], 'tri')].map((r) => escolhaDaFinalizacao(pecaDoRola(rotaR4, r), correnteDoPlano(rotaR4), destRota)),
  ['aceita', 'preferida', 'outra']);
ok('objetivo golpe Armlock: encaixou no Triângulo não alcança, no Armlock alcança',
  [alcancouObjetivo({ ...rotaR4, objetivo: 'Armlock', objetivoTipo: 'tecnica' }, rolaPor(['lC', 'cC', 'lTri'], 'tri'), destRota), alcancouObjetivo({ ...rotaR4, objetivo: 'Armlock', objetivoTipo: 'tecnica' }, rolaPor(['lC', 'cC'], 'arm'), destRota)],
  [false, true]);
ok('a preferida tentada e defendida não é chegada', alcancouObjetivo(rotaR4, rolaPor(['lC', 'cC'], 'arm', false), destRota), false);

/* volume: 2000 peças e 1000 atalhos, muitos voltando pra trás */
const tE = Date.now();
const enorme = (() => {
  const passos = Array.from({ length: 2000 }, (_, i) => ({ id: `e${i}`, lig: `k${i}`, golpe: `G${i}`, pai: i ? Math.floor((i - 1) / 2) : null, via: i % 2 ? 'encaixou' : 'defendeu' }));
  const ligacoes = Array.from({ length: 1000 }, (_, i) => ({ id: `v${i}`, de: `e${1999 - i}`, via: 'defendeu', para: `e${i % 7}` }));
  return planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos, ligacoes });
})();
const cen = correnteDoPlano(JSON.parse(JSON.stringify(enorme)));
const aen = arvoreDoPlano(cen.passos);
pontasSoltas(enorme);
const ms = Date.now() - tE;
ok('2000 peças com 1000 atalhos voltando: tudo lido, árvore uma vez em cada peça', [cen.ligacoes.length, aen.ordem.length], [1000, 2000]);
ok(`e em menos de 1s (${ms}ms)`, ms < 1000, true);

/* ---------- R4.1: família de finalização ----------
   Objetivo, preferida e "também vale" aceitam a família inteira
   (fam:armlock): qualquer variação ligada a ela no catálogo conta.
   Família selecionada não deixa a variação entrar de novo, menos na
   combinação "prefiro o da montada, mas qualquer armlock vale". */
const { cobre, jaCoberta, limparAceitas } = await import('../src/lib/planos.js');
const { SEED: SEED41 } = await import('../src/db/seed.js');
const destCat = (nome) => { const t = SEED41.techniques.find((x) => x.pt === nome); return t ? { slug: t.to, nome: t.to } : null; };
const golpes41 = ['Armlock da guarda fechada', 'Armlock da montada', 'Armlock das costas', 'Kimura', 'Tarikoplata', 'Omoplata', 'Monoplata', 'Raspagem de tesoura'];
const p41 = (extra) => planoNovo({ passos: golpes41.map((g, i) => ({ id: `g${i}`, golpe: g, reacao: `r${i}`, pai: i ? 0 : null, via: i ? 'defendeu' : null })), ...extra });

const fam = correnteDoPlano(p41({ objetivo: 'fam:armlock', objetivoTipo: 'familia' }));
ok('objetivo família Armlock: os três armlocks chegam, Kimura e raspagem não',
  fam.passos.map((x) => chegaNoObjetivo(x, fam, destCat)), [true, true, true, false, false, false, false, false]);
const famK = correnteDoPlano(p41({ objetivo: 'fam:kimura', objetivoTipo: 'familia' }));
ok('família Kimura: Kimura e Tarikoplata chegam; Omoplata e Monoplata não',
  famK.passos.map((x) => chegaNoObjetivo(x, famK, destCat)), [false, false, false, true, true, false, false, false]);
const famO = correnteDoPlano(p41({ objetivo: 'fam:omoplata', objetivoTipo: 'familia' }));
ok('família Omoplata: a Monoplata é avulsa e não conta', famO.passos.map((x) => chegaNoObjetivo(x, famO, destCat)).slice(5, 7), [true, false]);
const tec = correnteDoPlano(p41({ objetivo: 'Armlock da montada', objetivoTipo: 'tecnica' }));
ok('objetivo técnica: só o Armlock da montada', tec.passos.map((x) => chegaNoObjetivo(x, tec, destCat)), [false, true, false, false, false, false, false, false]);
ok('família sem preferida e sem aceitas gravadas', [p41({ objetivo: 'fam:armlock', objetivoTipo: 'familia', finalizacaoPreferida: 'x' }).finalizacaoPreferida], ['']);

const pf = correnteDoPlano(p41({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', finalizacaoPreferida: 'fam:armlock', finalizacoesAceitas: ['fam:kimura'] }));
ok('preferida família: todo armlock é a preferida; a kimura e a tarikoplata são aceitas; omoplata é outra',
  pf.passos.map((x) => escolhaDaFinalizacao(x, pf, destCat)), ['preferida', 'preferida', 'preferida', 'aceita', 'aceita', 'outra', 'outra', '']);
const ex = correnteDoPlano(p41({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', finalizacaoPreferida: 'Armlock da montada', finalizacoesAceitas: ['fam:armlock'] }));
ok('prefiro o da montada, mas qualquer armlock vale: a família fica nas aceitas',
  [ex.finalizacoesAceitas, ex.passos.map((x) => escolhaDaFinalizacao(x, ex, destCat)).slice(0, 3)], [['fam:armlock'], ['aceita', 'preferida', 'aceita']]);

ok('cobre: família cobre a variação, nome antigo também, técnica de fora não',
  [cobre('fam:armlock', 'Armlock da montada'), cobre('fam:armlock', 'Chave de braço da montada'), cobre('fam:armlock', 'Kimura'), cobre('fam:armlock', 'Meu armlock inventado')],
  [true, true, false, false]);
ok('jaCoberta: variação de família já aceita não entra; a família com a preferida técnica entra',
  [jaCoberta('Armlock da montada', '', ['fam:armlock']), jaCoberta('Armlock da montada', 'fam:armlock', []), jaCoberta('fam:armlock', 'Armlock da montada', []), jaCoberta('Kimura', '', ['fam:armlock']), jaCoberta('fam:kimura', '', ['fam:kimura'])],
  ['fam:armlock', 'fam:armlock', '', '', 'fam:kimura']);
ok('a família que entra leva junto as variações dela; a de outra família fica',
  limparAceitas('', ['Armlock da montada', 'Kimura', 'Armlock das costas', 'fam:armlock']), ['Kimura', 'fam:armlock']);
ok('preferida família limpa as variações dela nas aceitas',
  limparAceitas('fam:armlock', ['Armlock da montada', 'fam:armlock', 'Kimura']), ['Kimura']);
ok('salvar o plano aplica a mesma limpeza',
  p41({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', finalizacaoPreferida: 'Armlock da montada', finalizacoesAceitas: ['Armlock das costas', 'fam:armlock', 'Armlock da montada', 'fam:armlock'] }).finalizacoesAceitas,
  ['fam:armlock']);
/* técnica da pessoa com a família confirmada entra no "qualquer armlock";
   sem confirmar, ou sem a lista do aparelho, fica de fora */
const minhas = [{ uid: crypto.randomUUID(), nome: 'Meu armlock inventado', fam: 'fam:armlock', propria: 1 },
  { uid: crypto.randomUUID(), nome: 'Meu armlock sem família', propria: 1 }];
const destMeu = Object.assign(destCat, { tecnicas: minhas });
const pm = (extra) => correnteDoPlano(planoNovo({ passos: [{ id: 'm0', golpe: 'Meu armlock inventado', reacao: 'r' }, { id: 'm1', golpe: 'Meu armlock sem família', reacao: 'r', pai: 0, via: 'defendeu' }], ...extra }));
const pmFam = pm({ objetivo: 'fam:armlock', objetivoTipo: 'familia' });
const pmFin = pm({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', finalizacaoPreferida: 'Kimura', finalizacoesAceitas: ['fam:armlock'] });
ok('técnica própria com família confirmada chega no qualquer armlock; sem família não',
  [pmFam.passos.map((x) => chegaNoObjetivo(x, pmFam, destMeu)), pmFin.passos.map((x) => escolhaDaFinalizacao(x, pmFin, destMeu))],
  [[true, false], ['aceita', '']]);
ok('sem a lista do aparelho a técnica própria não entra na família',
  [cobre('fam:armlock', 'Meu armlock inventado'), cobre('fam:armlock', 'Meu armlock inventado', minhas)], [false, true]);
ok('aceitas: a própria da família some quando a família entra',
  [limparAceitas('', ['Meu armlock inventado', 'fam:armlock'], minhas), jaCoberta('Meu armlock inventado', '', ['fam:armlock'], minhas)],
  [['fam:armlock'], 'fam:armlock']);
delete destCat.tecnicas;

const tirou = p41({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', finalizacaoPreferida: '', finalizacoesAceitas: ['Armlock das costas'] });
ok('tirar a família e voltar pra uma técnica: só ela conta como aceita',
  (() => { const k = correnteDoPlano(tirou); return k.passos.map((x) => escolhaDaFinalizacao(x, k, destCat)).slice(0, 3); })(), ['outra', 'outra', 'aceita']);
ok('trocar o objetivo de família pra posição limpa tudo',
  (() => { const p = p41({ objetivo: 'Montada', objetivoTipo: 'posicao', finalizacaoPreferida: 'fam:armlock' }); return [p.objetivoTipo, p.finalizacaoPreferida, p.finalizacoesAceitas]; })(), ['posicao', '', []]);
const famSync = viaSync(p41({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', finalizacaoPreferida: 'fam:armlock', finalizacoesAceitas: ['fam:kimura'] }));
ok('recarregar mantém os ids de família',
  (() => { const p = planoNovo({ ...famSync, passos: editar(famSync) }); return [p.finalizacaoPreferida, p.finalizacoesAceitas, p.passos.map((x) => x.id)]; })(),
  ['fam:armlock', ['fam:kimura'], golpes41.map((_, i) => `g${i}`)]);
ok('os 16 prontos seguem sem objetivo de família', PLANOS_ATAQUE.every((p) => correnteDoPlano(p).objetivoTipo !== 'familia'), true);

/* a posição de onde começa: a escolhida no formulário manda, antes de salvar */
const posicoes = [{ id: 1, nome: 'Em pé' }, { id: 2, nome: 'Sentado' }, { id: 3, nome: 'Guarda fechada' }];
const noMapa = (e) => correnteDoPlano(planoNovo({ ...e, posicao: nomeDaPosicao(e, posicoes) })).posicao;
const rasc = { nome: '', posicaoId: '', posicao: '', objetivo: 'Montada', objetivoTipo: 'posicao', passos: [{ id: 'g0', golpe: 'Single leg' }] };
ok('plano novo sem posição escolhida: fica vazio, sem nome inventado', noMapa(rasc), '');
ok('plano novo com Em pé: o mapa mostra Em pé', noMapa({ ...rasc, posicaoId: '1' }), 'Em pé');
ok('plano novo com Sentado: o mapa mostra Sentado', noMapa({ ...rasc, posicaoId: '2' }), 'Sentado');
ok('trocar a posição depois de preencher o resto: muda na hora e mantém os passos',
  (() => { const e = { ...rasc, posicaoId: '2' }; const c = correnteDoPlano(planoNovo({ ...e, posicao: nomeDaPosicao(e, posicoes) })); return [c.posicao, c.passos.map((x) => x.golpe), c.objetivo]; })(),
  ['Sentado', ['Single leg'], 'Montada']);
ok('editar plano salvo e trocar a posição: vale a nova, não o nome guardado',
  noMapa({ ...rasc, posicaoId: '3', posicao: 'Em pé' }), 'Guarda fechada');
ok('plano antigo sem posicaoId: mostra o nome guardado', noMapa({ ...rasc, posicaoId: undefined, posicao: 'Meia guarda' }), 'Meia guarda');
ok('plano com posição que não existe mais: mostra o nome guardado', noMapa({ ...rasc, posicaoId: '99', posicao: 'Meia guarda' }), 'Meia guarda');
ok('id numérico ou texto dá na mesma', [nomeDaPosicao({ posicaoId: 2 }, posicoes), nomeDaPosicao({ posicaoId: '2' }, posicoes)], ['Sentado', 'Sentado']);
ok('sem lista de posições (ainda carregando): cai no nome guardado', nomeDaPosicao({ posicaoId: '1', posicao: 'Em pé' }), 'Em pé');

/* a finta é o texto do atleta, nunca técnica */
const fintaTexto = planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos: [
  { id: 'f', tipo: 'finta', golpe: '  fingir que vou no armlock pra ele recolher o braço  ', pai: null },
  { id: 'g', golpe: 'Triângulo', pai: 0, via: 'reagiu', reacao: 'recolheu o braço' },
] });
ok('finta salva só o texto: descricao, sem acao', [fintaTexto.passos[0].descricao, 'acao' in fintaTexto.passos[0], fintaTexto.passos[0].tipo],
  ['fingir que vou no armlock pra ele recolher o braço', false, 'finta']);
ok('golpe segue com acao, sem descricao', [fintaTexto.passos[1].acao, 'descricao' in fintaTexto.passos[1]], ['Triângulo', false]);
ok('finta sem id de técnica, família ou categoria',
  Object.keys(fintaTexto.passos[0]).filter((k) => /uid|tecnica|familia|categoria|acao/i.test(k)), []);
ok('finta passa de 120: corta no 120', planoNovo({ passos: [{ tipo: 'finta', golpe: 'x'.repeat(130), pai: null }] }).passos[0].descricao.length, 120);
ok('finta só com espaço: sai, como golpe sem nome', planoNovo({ passos: [{ tipo: 'finta', golpe: '   ', pai: null }] }).passos.length, 0);
ok('o mapa lê a finta nova pelo texto', correnteDoPlano(fintaTexto).passos.map((x) => [x.tipo, x.golpe]),
  [['finta', 'fingir que vou no armlock pra ele recolher o braço'], ['golpe', 'Triângulo']]);
const fintaNomeAntigo = { passos: [{ id: 'f', tipo: 'finta', acao: 'Guilhotina', pai: null }, { id: 'g', acao: 'Armlock', pai: 0, via: 'reagiu' }] };
ok('finta antiga (nome de técnica em acao) aparece como texto, sem migrar', correnteDoPlano(fintaNomeAntigo).passos.map((x) => x.golpe), ['Guilhotina', 'Armlock']);
ok('finta antiga editada e salva vira descricao e perde o acao',
  (() => { const k = correnteDoPlano(fintaNomeAntigo); const s2 = planoNovo({ passos: k.passos }); return [s2.passos[0].descricao, 'acao' in s2.passos[0], s2.passos[1].acao]; })(),
  ['Guilhotina', false, 'Armlock']);
ok('finta do formato mais antigo (p.finta) continua aparecendo', correnteDoPlano({ finta: 'Raspagem de gancho', passos: [{ acao: 'Kimura' }] }).passos.map((x) => [x.tipo, x.golpe]),
  [['golpe', 'Kimura'], ['finta', 'Raspagem de gancho']]);
ok('salvar duas vezes não muda a finta',
  (() => { const k = correnteDoPlano(fintaTexto); return JSON.stringify(planoNovo({ ...fintaTexto, passos: k.passos }).passos) === JSON.stringify(fintaTexto.passos); })(), true);
ok('finta com nome de finalização não chega no objetivo', chegaNoObjetivo(correnteDoPlano({ passos: [{ tipo: 'finta', descricao: 'Armlock', pai: null }] }).passos[0], { objetivo: 'Armlock', objetivoTipo: 'tecnica' }, destinoDe), false);

/* ---------- R5: a preparação é peça própria, separada da finta ---------- */
{
  const { PREPARACOES, convergenciasValidas, caminhoAte } = await import('../src/lib/planos.js');
  const { uidDoGolpe } = await import('../src/lib/identidade.js');
  ok('os três jeitos de preparação', PREPARACOES.map((p) => p.id), ['pegada', 'desequilibrio', 'pressao']);
  ok('a preparação abre "montei" e "não deixou"', viasDa({ tipo: 'preparacao' }), ['feita', 'impediu']);
  /* pegada → raspagem; ele quebrou a pegada → outra pegada → raspagem */
  const passosP = [
    { id: 'p1', lig: 'l1', tipo: 'preparacao', prep: 'pegada', golpe: 'gola e manga do mesmo lado', reacao: '', pai: null, via: null },
    { id: 'g1', lig: 'l2', golpe: 'Raspagem de tesoura', reacao: 'pesou pra frente', pai: 0, via: 'feita' },
    { id: 'p2', lig: 'l3', tipo: 'preparacao', prep: 'desequilibrio', golpe: 'puxo a manga e empurro o joelho', reacao: 'quebrou a pegada da gola', pai: 0, via: 'impediu' },
    { id: 'g2', lig: 'l4', golpe: 'Raspagem de gancho', reacao: '', pai: 2, via: 'feita' },
  ];
  const salvoP = planoNovo({ nome: 'Preparação', objetivo: 'Montada', objetivoTipo: 'posicao', passos: passosP, tecnicas: [] });
  ok('salva a preparação com texto, jeito e sem acao', salvoP.passos.map((x) => [x.tipo || 'golpe', x.descricao || x.acao, x.prep || '', x.via]),
    [['preparacao', 'gola e manga do mesmo lado', 'pegada', null], ['golpe', 'Raspagem de tesoura', '', 'feita'],
      ['preparacao', 'puxo a manga e empurro o joelho', 'desequilibrio', 'impediu'], ['golpe', 'Raspagem de gancho', '', 'feita']]);
  ok('preparação nunca ganha uid de técnica', salvoP.passos.filter((x) => x.tipo === 'preparacao').every((x) => !x.golpeUid), true);
  ok('uidDoGolpe da preparação é nulo, mesmo com nome de técnica', uidDoGolpe({ tipo: 'preparacao', golpe: 'Raspagem de tesoura' }, []), null);
  const cp = correnteDoPlano(salvoP);
  ok('recarregar: tipo, jeito, ids e vias iguais', cp.passos.map((x) => [x.id, x.tipo, x.prep ?? null, x.via]),
    [['p1', 'preparacao', 'pegada', null], ['g1', 'golpe', null, 'feita'], ['p2', 'preparacao', 'desequilibrio', 'impediu'], ['g2', 'golpe', null, 'feita']]);
  ok('salvar de novo não muda nada', JSON.stringify(planoNovo({ ...salvoP, passos: cp.passos, tecnicas: [] }).passos), JSON.stringify(salvoP.passos));
  ok('jeito inválido não é guardado', planoNovo({ passos: [{ tipo: 'preparacao', golpe: 'x', prep: 'chute', pai: null }] }).passos[0].prep, undefined);
  const ap = arvoreDoPlano(cp.passos);
  ok('"montei" segue no mesmo plano, "não deixou" abre o B', [ap.trilho[1], ap.trilho[2], ap.trilho[3]], [0, 1, 1]);
  ok('a reação do "não deixou" fica guardada', cp.passos[2].reacao, 'quebrou a pegada da gola');
  ok('preparação sem golpe depois é ponta solta', pontasSoltas({ objetivo: 'Montada', objetivoTipo: 'posicao', passos: [{ tipo: 'preparacao', descricao: 'pegada', pai: null }] }, destinoDe).length, 1);
  ok('preparação com nome de técnica não chega no objetivo', chegaNoObjetivo({ tipo: 'preparacao', golpe: 'Montada' }, { objetivo: 'Montada', objetivoTipo: 'tecnica' }, destinoDe), false);
  /* pôr a preparação antes de um golpe: ele passa a nascer do "montei" */
  const antesP = fintaAntes(cp.passos, 1, 'pé no quadril', { tipo: 'preparacao', prep: 'pressao' });
  ok('preparação antes do golpe entra no lugar dele', antesP.slice(-1).map((x) => [x.tipo, x.prep, x.pai, x.via]), [['preparacao', 'pressao', 0, 'feita']]);
  ok('e o golpe passa a vir do "montei", com ligação nova', [antesP[1].pai, antesP[1].via, antesP[1].lig !== 'l2'], [4, 'feita', true]);
  ok('finta antes continua igual', fintaAntes(cp.passos, 1, 'ameaço o armlock').slice(-1).map((x) => [x.tipo, x.via, 'prep' in x]), [['finta', 'feita', false]]);
  /* tirar a preparação devolve o golpe pro lugar dela e leva o "não deixou" junto */
  const semP = semAFinta(cp.passos, 0);
  ok('tirar a preparação: o golpe volta pro lugar dela, o "não deixou" sai', semP.map((x) => [x.golpe, x.pai, x.via]), [['Raspagem de tesoura', null, null]]);
  ok('arrastar pra "não deixou" vale; pra "defendeu" de preparação não', [!!moverPasso(cp.passos, 3, 0, 'impediu'), moverPasso(cp.passos, 3, 0, 'defendeu')], [true, null]);
  ok('situação não entra no "não deixou"', vagaLivre(cp.passos, 0, 'impediu', 'situacao'), false);
  ok('dois "não deixou" sem dizer o que ele fez: avisa', semGatilho([...cp.passos, { tipo: 'golpe', golpe: 'Omoplata', reacao: '', pai: 0, via: 'impediu' }, { tipo: 'golpe', golpe: 'Triângulo', reacao: '', pai: 0, via: 'impediu' }]).map((x) => x.golpe), ['Omoplata', 'Triângulo']);
  /* convergência: o "não deixou" liga na raspagem que já está no mapa; a raspagem liga na preparação */
  const ligs = convergenciasValidas(cp.passos, [{ id: 'x1', de: 'p2', via: 'impediu', para: 'g1' }, { id: 'x2', de: 'g2', via: 'defendeu', para: 'p1' }, { id: 'x3', de: 'p1', via: 'escapou', para: null }]);
  ok('convergência: preparação liga e recebe ligação; escapou não é dela', ligs.map((l) => l.id), ['x1', 'x2']);
  ok('o caminho do rola passa pela preparação', caminhoAte(cp.passos, 3), ['l1', 'l3', 'l4']);
  ok('plano antigo sem preparação abre igual', JSON.stringify(correnteDoPlano(fintaTexto).passos.map((x) => x.tipo)), JSON.stringify(correnteDoPlano(fintaTexto).passos.map((x) => (x.tipo === 'preparacao' ? 'x' : x.tipo))));
}


/* ---------- R6: os 16 prontos no modelo do jogo do atleta ---------- */
{
  const { CATALOGO_TECNICAS } = await import('../src/lib/tecnicas.js');
  const { SEED } = await import('../src/db/seed.js');
  const { removidosAoSalvar, pecaDoRola, caminhoDoRola } = await import('../src/lib/planos.js');
  const tec = new Map(CATALOGO_TECNICAS.map((t) => [t.nome, t]));
  const posPorSlug = new Map(SEED.positions.map((p) => [p.slug, p]));
  const nomesDePosicao = new Set(SEED.positions.map((p) => p.nome));
  /* o destino de cada golpe pelo catálogo, como a tela faz */
  const destinoR6 = (n) => { const t = tec.get(n); const p = t && posPorSlug.get(t.to); return p ? { slug: p.slug, nome: p.nome } : null; };
  ok('são 16 prontos, com slug único', [PLANOS_ATAQUE.length, new Set(PLANOS_ATAQUE.map((p) => p.slug)).size], [16, 16]);
  ok('todos na versão nova', PLANOS_ATAQUE.every((p) => p.versao === VERSAO_DOS_PRONTOS && VERSAO_DOS_PRONTOS >= 2), true);
  ok('todo golpe tem o nome do catálogo', PLANOS_ATAQUE.flatMap((p) => correnteDoPlano(p).passos.filter((x) => x.tipo === 'golpe' && !tec.has(x.golpe)).map((x) => `${p.slug}: ${x.golpe}`)), []);
  ok('toda situação é uma posição do catálogo', PLANOS_ATAQUE.flatMap((p) => correnteDoPlano(p).passos.filter((x) => x.tipo === 'situacao' && !nomesDePosicao.has(x.golpe)).map((x) => x.golpe)), []);
  ok('a posição de onde começa existe', PLANOS_ATAQUE.filter((p) => !nomesDePosicao.has(p.posicao)).map((p) => p.posicao), []);
  ok('todo pronto tem objetivo', PLANOS_ATAQUE.filter((p) => !p.objetivo || !p.objetivoTipo).map((p) => p.slug), []);
  ok('objetivo posição é posição do catálogo; técnica é do catálogo', PLANOS_ATAQUE.filter((p) => (p.objetivoTipo === 'posicao' && !nomesDePosicao.has(p.objetivo)) || (p.objetivoTipo === 'tecnica' && !tec.has(p.objetivo))).map((p) => p.slug), []);
  ok('a preferida é uma finalização do catálogo', PLANOS_ATAQUE.filter((p) => p.finalizacaoPreferida && destinoR6(p.finalizacaoPreferida)?.slug !== 'finalizacao').map((p) => p.slug), []);
  ok('nenhum caminho fica solto (chega no objetivo, finaliza ou fecha numa situação)',
    PLANOS_ATAQUE.flatMap((p) => pontasSoltas(p, destinoR6).map((x) => `${p.slug}: ${x.golpe}`)), []);
  ok('todo pronto chega no objetivo por algum caminho',
    PLANOS_ATAQUE.filter((p) => { const k = correnteDoPlano(p); return !k.passos.some((x) => chegaNoObjetivo(x, k, destinoR6)); }).map((p) => p.slug), []);
  ok('toda peça diz o que ele fez quando tem irmã na mesma saída', PLANOS_ATAQUE.flatMap((p) => semGatilho(correnteDoPlano(p).passos).map((x) => `${p.slug}: ${x.golpe}`)), []);
  ok('ids de peça e de ligação únicos em cada pronto', PLANOS_ATAQUE.filter((p) => {
    const ids = [...p.passos.map((x) => x.id), ...p.passos.map((x) => x.lig), ...(p.ligacoes || []).map((l) => l.id)];
    return new Set(ids).size !== ids.length;
  }).map((p) => p.slug), []);
  ok('ids novos não repetem os de antes (p0, l0...)', PLANOS_ATAQUE.some((p) => p.passos.some((x) => /^[pl]\d+$/.test(x.id) || /^[pl]\d+$/.test(x.lig))), false);
  const campos = (l) => l.map((x) => [x.id, x.lig, x.tipo, x.acao || x.descricao, x.prep, x.pai, x.via]);
  ok('salvar um pronto não muda nada', PLANOS_ATAQUE.filter((p) => {
    const k = correnteDoPlano(p);
    return JSON.stringify(campos(planoNovo({ ...p, passos: k.passos, ligacoes: k.ligacoes }).passos)) !== JSON.stringify(campos(p.passos));
  }).map((p) => p.slug), []);
  ok('tem preparação, finta e volta pro começo entre os prontos', [
    PLANOS_ATAQUE.some((p) => p.passos.some((x) => x.tipo === 'preparacao')),
    PLANOS_ATAQUE.some((p) => p.passos.some((x) => x.tipo === 'finta')),
    PLANOS_ATAQUE.some((p) => (p.ligacoes || []).some((l) => l.para === null)),
  ], [true, true, true]);
  ok('o aviso da chave de pé e da queda continua', ['chave-pe-branca', 'quedas-branca'].map((sl) => !!PLANOS_ATAQUE.find((p) => p.slug === sl).aviso), [true, true]);

  /* quem já tem o pronto antigo: o conteúdo vira o novo, o rola antigo continua achando a peça */
  await import('fake-indexeddb/auto');
  const { db, atualizarProntos } = await import('../src/db/db.js');
  await db.open();
  const velho = {
    slug: 'cg-trindade', nome: 'Trindade da Guarda Fechada', posicao: 'Guarda fechada', pronto: 1, uid: 'u-trindade', favorito: 0, arquivada: 0, criadoEm: 1000, updatedAt: 1000,
    passos: [{ acao: 'Quebrar a postura' }, { acao: 'Armlock da guarda fechada', seFalhar: 'ele esconde o braço' }, { acao: 'Triângulo' }],
  };
  const favoritado = { ...velho, slug: 'montada-gi', uid: 'u-montada', favorito: 1, updatedAt: 99999, nome: 'Montada: Cruz na Lapela' };
  const id1 = await db.attackPlans.add({ ...velho, __local: 1 });
  const id2 = await db.attackPlans.add({ ...favoritado, __local: 1 });
  const meu = await db.attackPlans.add({ ...velho, slug: undefined, pronto: 0, nome: 'Meu plano', __local: 1 });
  ok('atualiza os dois prontos e não toca no plano do atleta', await atualizarProntos(), 2);
  const a1 = await db.attackPlans.get(id1);
  const a2 = await db.attackPlans.get(id2);
  ok('o pronto ganha o conteúdo novo e a versão', [a1.nome, a1.versao, a1.passos.length, a1.objetivoTipo], ['Trindade da guarda fechada', VERSAO_DOS_PRONTOS, 4, 'finalizar']);
  ok('id, uid e favorito ficam', [a1.uid, a2.uid, a2.favorito], ['u-trindade', 'u-montada', 1]);
  ok('pronto intacto continua intacto (não vai pra nuvem)', a1.updatedAt, 1000);
  ok('pronto favoritado sobe com a versão nova', a2.updatedAt > 99999, true);
  ok('as peças de antes vão pra removidos', a1.removidos.pecas.map((x) => [x.id, x.golpe]), [['p0', 'Quebrar a postura'], ['p1', 'Armlock da guarda fechada'], ['p2', 'Triângulo']]);
  const rolaVelho = { plano: { uid: 'u-trindade', peca: 'p1', caminho: ['l0', 'l1'], encaixou: true } };
  ok('o rola antigo continua achando a peça (que saiu)', [pecaDoRola(a1, rolaVelho)?.golpe, pecaDoRola(a1, rolaVelho)?.saiu], ['Armlock da guarda fechada', true]);
  ok('e o caminho dele', caminhoDoRola(a1, rolaVelho.plano.caminho).ligacoes.map((l) => l && l.saiu), [true, true]);
  ok('o plano do atleta não muda', (await db.attackPlans.get(meu)).nome, 'Meu plano');
  ok('rodar de novo não muda nada', await atualizarProntos(), 0);
  ok('removidos calculado igual pela regra do salvar', JSON.stringify(a1.removidos), JSON.stringify(removidosAoSalvar(velho, PLANOS_ATAQUE.find((p) => p.slug === 'cg-trindade'))));
}

/* ---------- R7.1: o rola pelo caminho ---------- */
{
  const { caminhosAte, rotuloDoCaminho, paradasDe, marcarPeca, subsDoPlano, juntarSubs } = await import('../src/lib/planos.js');
  ok('R7 três entradas até o Armlock, a da árvore primeiro', caminhosAte(rota, 'arm'), [['lA', 'lArm'], ['lB', 'cB'], ['lC', 'cC']]);
  ok('R7 depois da convergência, os três seguem iguais', caminhosAte(rota, 'omo').map((c) => c.slice(-2)), [['lTri', 'lOmo'], ['lTri', 'lOmo'], ['lTri', 'lOmo']]);
  ok('R7 peça com um caminho só', caminhosAte(rota, 'fA'), [['lA']]);
  ok('R7 cada caminho achado fecha da posição até a peça', caminhosAte(rota, 'omo').map((c) => caminhoDoRola(rota, c).inteiro), [true, true, true]);
  /* ciclo: a Omoplata defendida volta pro Armlock; e uma fuga que volta pra posição */
  const comVolta = planoNovo({ ...rota, passos: editar(rota), ligacoes: [...correnteDoPlano(rota).ligacoes,
    { id: 'vArm', de: 'omo', via: 'defendeu', gatilho: 'girou', para: 'arm' }] });
  ok('R7 ligação que volta (ciclo) não trava nem repete peça', caminhosAte(comVolta, 'arm').length, 3);
  ok('R7 o ciclo não cria caminho novo até o Triângulo', caminhosAte(comVolta, 'tri').length, 3);
  ok('R7 rótulo: as peças antes da última', [rotuloDoCaminho(rota, ['lB', 'cB']), rotuloDoCaminho(rota, ['lA', 'lArm', 'lTri', 'lOmo']), rotuloDoCaminho(rota, ['lA'])],
    ['Raspagem de tesoura', 'Guilhotina → Armlock → Triângulo', 'Direto da posição']);
  ok('R7 o que ele fez, pelo tipo da peça', ['golpe', 'finta', 'preparacao', 'situacao'].map((tipo) => paradasDe({ tipo }).map((p) => p.id)),
    [['defendeu', 'escapou'], ['naoReagiu'], ['impediu'], []]);
  const base = { uid: 'R', peca: null, caminho: [], encaixou: true, parou: 'escapou', improviso: { nome: 'Kimura', uid: null, encaixou: false } };
  ok('R7 marcar peça com várias entradas: caminho fica pra pessoa dizer', marcarPeca(rota, base, 'arm').caminho, []);
  ok('R7 marcar peça com um caminho: sai sozinho', marcarPeca(rota, base, 'fA').caminho, ['lA']);
  ok('R7 tocar de novo na mesma peça não apaga a entrada dita', marcarPeca(rota, { ...base, peca: 'arm', caminho: ['lB', 'cB'] }, 'arm').caminho, ['lB', 'cB']);
  ok('R7 finta não encaixa e o "escapou" de golpe sai', [marcarPeca(rota, base, 'fA').encaixou, marcarPeca(rota, base, 'fA').parou], [false, '']);
  ok('R7 golpe mantém encaixou, parou e o improviso', [marcarPeca(rota, base, 'tri').encaixou, marcarPeca(rota, base, 'tri').parou, marcarPeca(rota, base, 'tri').improviso.nome], [true, 'escapou', 'Kimura']);
  /* finalização entra sozinha, uma vez, e não é objetivo alcançado */
  const rp = (o) => ({ uid: 'R', peca: 'omo', caminho: ['lA', 'lArm', 'lTri', 'lOmo'], encaixou: false, ...o });
  ok('R7 a Omoplata que encaixou vai pra "Eu finalizei"', subsDoPlano(rota, rp({ encaixou: true }), destRota), ['Omoplata']);
  ok('R7 tentativa que não encaixou não entra', subsDoPlano(rota, rp({ parou: 'defendeu' }), destRota), []);
  ok('R7 finta marcada não entra', subsDoPlano(rota, rp({ peca: 'fA', caminho: ['lA'], encaixou: true }), destRota), []);
  ok('R7 improviso que é finalização e encaixou entra', subsDoPlano(rota, rp({ improviso: { nome: 'Kimura', uid: null, encaixou: true } }), destRota), ['Kimura']);
  ok('R7 improviso que não é finalização não entra', subsDoPlano(rota, rp({ improviso: { nome: 'Raspagem de tesoura', uid: null, encaixou: true } }), destRota), []);
  ok('R7 a mesma finalização pelo plano e pelo improviso entra uma vez', subsDoPlano(rota, rp({ encaixou: true, improviso: { nome: 'Omoplata', uid: null, encaixou: true } }), destRota), ['Omoplata']);
  ok('R7 finalizou no improviso: aplicada, mas o objetivo do plano não foi alcançado',
    alcancouObjetivo(rota, { plano: rp({ improviso: { nome: 'Kimura', uid: null, encaixou: true } }) }, destRota), false);
  const renomeado = viaSync(rota);
  renomeado.passos.find((x) => x.id === 'omo').golpeUid = 'u-teste-omo';
  const destU = Object.assign((n) => destRota(n), { tecnicas: [{ uid: 'u-teste-omo', nome: 'Omoplata nova' }] });
  ok('R7 peça com uid entra pelo nome de hoje da técnica', subsDoPlano(renomeado, rp({ encaixou: true }), destU), ['Omoplata nova']);
  ok('R7 entra o que não estava', juntarSubs([], [], ['Omoplata']), { subs: ['Omoplata'], entrou: ['Omoplata'] });
  ok('R7 já marcada na mão: não duplica e não vira do plano', juntarSubs(['Omoplata'], [], ['Omoplata']), { subs: ['Omoplata'], entrou: [] });
  ok('R7 desmarcar encaixou não tira a marcada na mão', juntarSubs(['Omoplata'], [], []), { subs: ['Omoplata'], entrou: [] });
  ok('R7 desmarcar encaixou tira só a que o plano pôs', juntarSubs(['Armlock', 'Omoplata'], ['Omoplata'], []), { subs: ['Armlock'], entrou: [] });
  ok('R7 repetir não muda nada', juntarSubs(['Armlock', 'Omoplata'], ['Omoplata'], ['Omoplata']), { subs: ['Armlock', 'Omoplata'], entrou: ['Omoplata'] });
  ok('R7 trocar a peça troca a finalização', juntarSubs(['Omoplata'], ['Omoplata'], ['Triângulo']), { subs: ['Triângulo'], entrou: ['Triângulo'] });
  ok('R7 finalizou duas vezes com a mesma: tira uma só', juntarSubs(['Omoplata', 'Omoplata'], ['Omoplata'], []), { subs: ['Omoplata'], entrou: [] });
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
