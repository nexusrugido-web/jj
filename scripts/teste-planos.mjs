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

const muitos = Array.from({ length: 15 }, (_, i) => ({ golpe: `G${i}` }));
ok('no máximo 12 golpes', planoNovo({ passos: muitos }).passos.length, MAX_PASSOS);
const c = correnteDoPlano(novo);
ok('a finta vem junto', c.finta, 'Raspagem de gancho');

const pronto = { ...PLANOS_ATAQUE[0], id: 7, uid: 'u', pronto: 1, criadoEm: 1 };
const copia = copiaDoPronto(pronto);
ok('a cópia é plano seu', [copia.pronto, copia.slug, copia.uid, copia.id], [0, undefined, undefined, undefined]);
ok('a cópia guarda de onde veio', copia.copiadoDe, PLANOS_ATAQUE[0].slug);
ok('a cópia mantém os golpes', copia.passos.map((p) => p.acao), pronto.passos.slice(0, 4).map((p) => p.acao));
ok('depois que falhou vira o fim', [correnteDoPlano(PLANOS_ATAQUE.find((p) => p.slug === 'cg-trindade')).fim !== '', correnteDoPlano(PLANOS_ATAQUE.find((p) => p.slug === 'cg-trindade')).segue], [true, '']);
ok('depois que encaixou vira o segue', correnteDoPlano({ passos: [{ acao: 'Gift wrap', proxima: 'Mata-leão' }] }), { posicao: '', finta: '', objetivo: '', passos: [{ reacao: '', golpe: 'Gift wrap', detalhe: '', defesa: '', pai: null, via: null }], fim: '', segue: 'Mata-leão' });
ok('"se ele escapar" é fim, mesmo sem seFalhar', correnteDoPlano({ passos: [{ acao: 'X', proxima: 'Se ele escapar, retomar' }] }).fim, 'Se ele escapar, retomar');
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

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
