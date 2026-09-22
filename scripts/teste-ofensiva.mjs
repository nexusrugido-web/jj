import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   A OFENSIVA SEGUE A REGRA COMBINADA

   Quinze dias seguidos dão um escudo, mais quinze dão o
   segundo, e dois é o teto. Quem parou em catorze perde tudo.
   Quem passou dos quinze volta, porque tinha escudo guardado.

   E o dia de hoje não conta como perdido enquanto ele não
   acabar: quem estudou ontem e ainda não estudou hoje está em
   risco, não quebrado.
   ============================================================ */
const { ofensiva, DIAS_POR_ESCUDO, MAX_ESCUDOS } = await import('../src/lib/ofensiva.js');
const { addDias } = await import('../src/lib/utils.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

const HOJE = '2026-09-21';
/* n dias seguidos terminando em `fim` */
const seguidos = (n, fim = HOJE) =>
  Array.from({ length: n }, (_, i) => ({ data: addDias(fim, -(n - 1 - i)), xp: 1 }));
const o = (pontos) => ofensiva(pontos, HOJE);

/* ---------- o básico ---------- */
ok('sem ponto nenhum', o([]).dias, 0);
ok('um dia hoje', o(seguidos(1)).dias, 1);
ok('fechou hoje', o(seguidos(1)).fechouHoje, true);
ok('dois eventos no mesmo dia contam um', o([{ data: HOJE, xp: 1 }, { data: HOJE, xp: 15 }]).dias, 1);

/* ---------- hoje ainda está aberto ---------- */
const ontem = o(seguidos(5, addDias(HOJE, -1)));
ok('parou ontem: a ofensiva está viva', ontem.viva, true);
ok('parou ontem: mas em risco', ontem.emRisco, true);
ok('parou ontem: os dias continuam', ontem.dias, 5);
ok('fechou hoje: não está em risco', o(seguidos(5)).emRisco, false);

/* ---------- o escudo ---------- */
ok('14 dias não dão escudo', o(seguidos(14)).escudos, 0);
ok('15 dias dão um escudo', o(seguidos(DIAS_POR_ESCUDO)).escudos, 1);
ok('29 dias, ainda um', o(seguidos(29)).escudos, 1);
ok('30 dias dão o segundo', o(seguidos(30)).escudos, 2);
ok('45 dias: dois é o teto', o(seguidos(45)).escudos, MAX_ESCUDOS);
ok('300 dias: continua dois', o(seguidos(300)).escudos, MAX_ESCUDOS);
ok('falta pro primeiro escudo', o(seguidos(1)).faltaProEscudo, 14);
ok('no teto, não falta nada', o(seguidos(45)).faltaProEscudo, 0);

/* ---------- a regra que você pediu ----------
   14 dias e some: perde tudo, porque não chegou a ganhar escudo.
   15 dias e some: o escudo segura. */
const quebrou = o(seguidos(14, addDias(HOJE, -2)));
ok('14 dias e sumiu um dia: quebrou', quebrou.viva, false);
ok('14 dias e sumiu um dia: zerou', quebrou.dias, 0);
ok('mas o recorde fica registrado', quebrou.recorde, 14);

const salvou = o(seguidos(15, addDias(HOJE, -2)));
ok('15 dias e sumiu um dia: o escudo segurou', salvou.viva, true);
ok('15 dias e sumiu um dia: não zerou', salvou.dias, 15);
ok('e o escudo foi gasto', salvou.escudos, 0);
ok('gasto sozinho, sem perguntar', salvou.gastos, 1);

/* ---------- o escudo cobre um dia, não uma semana ---------- */
ok('15 dias e sumiu 3 dias: um escudo não cobre', o(seguidos(15, addDias(HOJE, -4))).viva, false);
ok('30 dias e sumiu 2 dias: os dois escudos cobrem', o(seguidos(30, addDias(HOJE, -3))).viva, true);
ok('30 dias e sumiu 3 dias: não cobrem', o(seguidos(30, addDias(HOJE, -4))).viva, false);

/* ---------- o escudo só cobre o que veio depois dele ---------- */
const cedoDemais = o([...seguidos(5, '2026-01-10'), ...seguidos(20, HOJE)]);
ok('buraco antes de ter escudo não é coberto', cedoDemais.dias, 20);

/* ---------- o dia coberto não vira ponto de graça ---------- */
const comBuraco = o([...seguidos(15, addDias(HOJE, -2)), { data: HOJE, xp: 1 }]);
ok('dia coberto não conta na ofensiva', comBuraco.dias, 16);
ok('e ela fechou hoje', comBuraco.fechouHoje, true);

/* ---------- qualquer evento que dê ponto fecha o dia ---------- */
const misto = o([
  { data: addDias(HOJE, -2), evento: 'short', xp: 1 },
  { data: addDias(HOJE, -1), evento: 'quizAcerto', xp: 10 },
  { data: HOJE, evento: 'treino', xp: 20 },
]);
ok('aula rápida, quiz e treino fecham igual', misto.dias, 3);

/* ---------- a lesao congela, e nao gasta escudo ----------
   Quem esta operado nao devia competir por ofensiva com quem
   esta treinando. A contagem para e continua de onde estava. */
const machucado = (de, ate) => [{ impacto: 'parado', data: de, dataCura: ate }];
const oL = (pontos, lesoes) => ofensiva(pontos, HOJE, lesoes);

/* 10 dias, parou 5 por lesao, voltou hoje */
const comLesao = [...seguidos(10, addDias(HOJE, -6)), { data: HOJE, xp: 1 }];
const lesao5 = machucado(addDias(HOJE, -5), addDias(HOJE, -1));

/* viva so diz se esta viva HOJE. Quem quebrou no meio e voltou
   hoje esta viva com 1 dia: o que separa os dois casos e `dias`. */
ok('sem lesao registrada: zerou e recomecou hoje', o(comLesao).dias, 1);
ok('com lesao registrada: nao quebrou', oL(comLesao, lesao5).viva, true);
ok('congelou: 10 dias mais o de hoje', oL(comLesao, lesao5).dias, 11);
ok('e nao gastou escudo (nem tinha)', oL(comLesao, lesao5).gastos, 0);

/* quem tinha escudo tambem nao gasta: a lesao cobre antes */
const comEscudo = [...seguidos(20, addDias(HOJE, -6)), { data: HOJE, xp: 1 }];
ok('lesao cobre sem gastar escudo', oL(comEscudo, lesao5).gastos, 0);
ok('e o escudo continua guardado', oL(comEscudo, lesao5).escudos, 1);

/* lesao aberta (sem cura) congela ate hoje */
const aberta = [{ impacto: 'parado', data: addDias(HOJE, -5) }];
const paradoAgora = seguidos(10, addDias(HOJE, -6));
ok('lesao aberta segura a ofensiva', oL(paradoAgora, aberta).viva, true);
ok('e ela aparece como congelada', oL(paradoAgora, aberta).congelada, true);
ok('congelada nao e "em risco"', oL(paradoAgora, aberta).emRisco, false);

/* lesao que deixa treinar adaptado nao congela nada */
const adaptado = [{ impacto: 'adaptado', data: addDias(HOJE, -5), dataCura: addDias(HOJE, -1) }];
ok('lesao adaptada nao congela', oL(comLesao, adaptado).dias, 1);

/* estudar durante a lesao faz a ofensiva crescer */
const estudou = [...seguidos(10, addDias(HOJE, -6)), { data: addDias(HOJE, -3), xp: 1 }, { data: HOJE, xp: 1 }];
ok('estudar machucado conta o dia', oL(estudou, lesao5).dias, 12);

/* ---------- o treino paga o dia seguinte ----------
   Quem rolou duas horas na terca nao pode ver "ofensiva zerada"
   na quarta. Quem treina 3x por semana para de quebrar sempre. */
const treino = (d) => ({ data: d, evento: 'treino', xp: 20 });
const aula = (d) => ({ data: d, evento: 'short', xp: 1 });

ok('treinou ontem: hoje ja esta fechado', o([treino(addDias(HOJE, -1))]).fechouHoje, true);
ok('e nao esta em risco', o([treino(addDias(HOJE, -1))]).emRisco, false);
ok('treinou ontem vale 2 dias', o([treino(addDias(HOJE, -1))]).dias, 2);
ok('treinou anteontem: hoje ainda pago', o([treino(addDias(HOJE, -2))]).fechouHoje, true);
ok('treinou ha 3 dias: hoje ja nao', o([treino(addDias(HOJE, -3))]).fechouHoje, false);
ok('so aula ontem: hoje continua aberto', o([aula(addDias(HOJE, -1))]).fechouHoje, false);
ok('e esta em risco', o([aula(addDias(HOJE, -1))]).emRisco, true);

/* seg/qua/sex por 3 semanas: antes quebrava toda semana */
const tresPorSemana = [];
for (let i = 20; i >= 0; i -= 1) {
  const d = addDias(HOJE, -i);
  const dow = new Date(d + 'T00:00:00').getDay();
  if (dow === 1 || dow === 3 || dow === 5) tresPorSemana.push(treino(d));
}
/* 20 e nao 21: a janela abre numa terca e o primeiro treino
   e so na quarta. Do primeiro treino em diante nao ha buraco. */
ok('3x (seg/qua/sex) sem estudar nada: sem buraco nenhum', o(tresPorSemana).dias, 20);

/* 5x por semana nunca quebra */
const cincoPorSemana = [];
for (let i = 20; i >= 0; i -= 1) {
  const d = addDias(HOJE, -i);
  const dow = new Date(d + 'T00:00:00').getDay();
  if (dow >= 1 && dow <= 5) cincoPorSemana.push(treino(d));
}
ok('5x por semana: 21 dias corridos, domingo incluso', o(cincoPorSemana).dias, 21);

/* aula nao paga o dia seguinte, senao um video compraria a semana */
ok('aula anteontem nao cobre ontem', o([aula(addDias(HOJE, -2)), aula(HOJE)]).dias, 1);

/* treinar hoje nao adianta amanha, que ainda nao chegou */
ok('treino de hoje nao conta o amanha', o([treino(HOJE)]).dias, 1);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
