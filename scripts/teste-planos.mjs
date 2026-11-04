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

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
