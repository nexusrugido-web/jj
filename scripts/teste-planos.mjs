import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   PLANOS DE ATAQUE
   Árvore com até 12 golpes (encaixou segue, se defender abre outro
   plano), 1 plano seu no grátis, e o pronto copiado vira plano seu
   sem perder os passos.
   ============================================================ */
const {
  correnteDoPlano, copiaDoPronto, planoNovo, podeCriarPlano, meusPlanos, MAX_PASSOS,
} = await import('../src/lib/planos.js');
const { PLANOS_ATAQUE } = await import('../src/db/attackPlans.js');

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
ok('no máximo 16 peças', planoNovo({ passos: muitos }).passos.length, MAX_PASSOS);
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
ok('depois que encaixou vira o segue', correnteDoPlano({ passos: [{ acao: 'Gift wrap', proxima: 'Mata-leão' }] }), { posicao: '', objetivo: '', objetivoTipo: '', passos: [{ tipo: 'golpe', reacao: '', golpe: 'Gift wrap', detalhe: '', defesa: '', pai: null, via: null }], segue: 'Mata-leão' });
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

/* taxa de acerto, onde morre, por tipo e rodízio */
const { taxaDoPlano, taxaPorTipo, rodizio } = await import('../src/lib/planos.js');
const A = { uid: 'A', nome: 'A', pronto: 0 }, B = { uid: 'B', nome: 'B', pronto: 0 }, C = { uid: 'C', nome: 'C', pronto: 0 };
const sess = [{ id: 1, data: '2026-10-01' }, { id: 2, data: '2026-10-08' }];
const rs = [
  { sessionId: 1, partnerId: 7, plano: { uid: 'A', ate: 1, encaixou: false } },
  { sessionId: 1, partnerId: 7, plano: { uid: 'A', ate: 1, encaixou: false } },
  { sessionId: 2, partnerId: 7, plano: { uid: 'A', ate: 2, encaixou: true }, pesoRel: 'pesado' },
  { sessionId: 2, partnerId: 8, plano: { uid: 'B', ate: 0, encaixou: true } },
  { sessionId: 2, partnerId: 7, contexto: 'drill', plano: { uid: 'A', ate: 0, encaixou: true } },
];
const tA = taxaDoPlano(A, rs);
ok('taxa: 1 de 3, drill fora', [tA.usos, tA.encaixes, tA.taxa], [3, 1, 33]);
ok('morre mais no golpe 2 (índice 1)', tA.morreNo, { passo: 1, vezes: 2 });
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
ok('trindade: quebrou a postura, encaixou o armlock; defendeu, triângulo', trindade.passos.map((p) => p.via), [null, 'encaixou', 'defendeu', 'defendeu']);
ok('todo pronto vira árvore inteira', PLANOS_ATAQUE.every((p) => arvoreDoPlano(correnteDoPlano(p).passos).ordem.length === correnteDoPlano(p).passos.length), true);
ok('editar e salvar um pronto mantém o caminho', correnteDoPlano(planoNovo({ passos: trindade.passos })).passos.map((p) => p.via), [null, 'encaixou', 'defendeu', 'defendeu']);

/* ---------- finta em qualquer ponto ----------
   Golpe → encaixou → finta → finta → golpe; a reação à finta mora no
   passo de depois, a defesa do golpe no galho da defesa */
const { fintaAntes, semAFinta, moverPasso, vagaLivre, chegaNoObjetivo, pontasSoltas, LETRAS } = await import('../src/lib/planos.js');
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
ok('a finta segue no mesmo trilho; a defesa abre o B', af.ordem.map((i) => [cf.passos[i].golpe, LETRAS[af.trilho[i]]]),
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
ok('cada entrada e cada desvio é um plano com letra própria', ag.ordem.map((i) => `${LETRAS[ag.trilho[i]]}:${cg.passos[i].golpe}`),
  ['A:Guilhotina', 'A:Armlock', 'B:Raspagem de tesoura', 'B:Raspagem de quadril (hip bump)', 'C:Triângulo', 'C:Armlock',
    'D:Kimura', 'E:Triângulo', 'F:Omoplata', 'G:Kimura']);
ok('passa de 4 planos', ag.trilhos, 7);
ok('as três defesas saem do mesmo armlock, cada uma com o que ele fez', ag.filhos[3].map((k) => cg.passos[k].reacao), ['colou o cotovelo', 'girou o braço pra fora', 'levantou a postura']);
ok('golpe abre encaixou e defendeu; finta, reagiu e não reagiu', [viasDa(cg.passos[3]), viasDa(cg.passos[0])], [['encaixou', 'defendeu'], ['reagiu', 'naoReagiu']]);
ok('golpe aceita mais uma defesa', vagaLivre(cg.passos, 3, 'defendeu'), true);
ok('"não reagiu" é um só', vagaLivre(cg.passos, 0, 'naoReagiu'), false);
ok('defesa sem nome junto de outra é avisada', semGatilho([...cg.passos, { tipo: 'golpe', golpe: 'Mata-leão', reacao: '', pai: 3, via: 'defendeu' }]).map((x) => x.golpe), ['Mata-leão']);
ok('defesa sozinha sem nome não é avisada', semGatilho([{ golpe: 'Armlock', pai: null }, { golpe: 'Kimura', reacao: '', pai: 0, via: 'defendeu' }]), []);
ok('tirar a finta leva junto o "não reagiu" dela', semAFinta(cg.passos, 0).map((x) => x.golpe).includes('Kimura') && semAFinta(cg.passos, 0).filter((x) => x.tipo === 'finta').length, 2);
ok('arrastar a Omoplata pra defesa da raspagem', (() => { const m = moverPasso(cg.passos, 5, 8, 'defendeu'); return m && [m[5].pai, m[5].via]; })(), [8, 'defendeu']);
ok('não arrasta pra posição', moverPasso(cg.passos, 5, null, 'raiz'), null);
ok('finta só com "não reagiu" ainda é ponta solta (falta o que fazer quando ele reage)',
  pontasSoltas(planoNovo({ objetivo: 'Finalizar', objetivoTipo: 'finalizar', passos: [{ tipo: 'finta', golpe: 'Guilhotina', pai: null }, { tipo: 'golpe', golpe: 'Kimura', pai: 0, via: 'naoReagiu' }] }), destinoDe).map((x) => x.golpe),
  ['Guilhotina']);

ok('"meia guarda" acha Kimura da meia-guarda', casaApelido('Kimura da meia-guarda', 'meia guarda'), true);
ok('"triangulo" não acha Kimura', casaApelido('Kimura', 'triangulo'), false);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
