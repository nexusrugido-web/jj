import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   PLANOS DE ATAQUE
   Corrente com no máximo 4 golpes, 1 plano seu no grátis, e o
   pronto copiado vira plano seu sem perder os passos.
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
ok('golpe vazio sai, e no máximo 4', novo.passos.map((p) => p.acao), ['Kimura', 'Guilhotina', 'Triângulo', 'Omoplata']);
ok('reação vira gatilho', novo.passos[0].gatilho, 'ele baseia a mão');

const c = correnteDoPlano({ ...novo, passos: [...novo.passos, { gatilho: 'x', acao: 'Armlock' }] });
ok('a corrente corta em 4', c.passos.length, MAX_PASSOS);
ok('a finta vem junto', c.finta, 'Raspagem de gancho');

const pronto = { ...PLANOS_ATAQUE[0], id: 7, uid: 'u', pronto: 1, criadoEm: 1 };
const copia = copiaDoPronto(pronto);
ok('a cópia é plano seu', [copia.pronto, copia.slug, copia.uid, copia.id], [0, undefined, undefined, undefined]);
ok('a cópia guarda de onde veio', copia.copiadoDe, PLANOS_ATAQUE[0].slug);
ok('a cópia mantém os golpes', copia.passos.map((p) => p.acao), pronto.passos.slice(0, 4).map((p) => p.acao));
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

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
