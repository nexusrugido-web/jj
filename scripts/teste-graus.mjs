import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   A RÉGUA DOS GRAUS

   O que foi decidido em 24/09/2026:
   - 1º e 2º graus rápidos: vitória cedo pra quem mais apanha
   - 3º grau: 2 pessoas e 4 semanas diferentes
   - 4º grau: 3 pessoas, 3 meses diferentes, faixa acima
   - o uso vale pelo peso: faixa acima e mais pesado contam mais
   - o grau conquistado nunca desce: nem com a regra nova,
     nem quando a faixa sobe e a régua fica mais alta
   ============================================================ */
const { calcularAtaque, grauGuardado, faixaNaData, minhasTecnicas, REGRA_NOVA_DESDE } = await import('../src/lib/graus.js');
const { faltaPara } = await import('../src/lib/recomendar.js');
const { addDias } = await import('../src/lib/utils.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

/* usos depois da regra nova, n por semana */
const depois = addDias(REGRA_NOVA_DESDE, 7);
const uso = (dia, pid, faixa = 'branca', pesoRel = 'similar') =>
  ({ data: addDias(depois, dia), partnerId: pid, faixaParceiro: faixa, pesoRel, contexto: 'rola' });
const grau = (usos, faixa = 'branca') => calcularAtaque(usos, faixa).grau;

/* ---------- 1º e 2º graus rápidos ---------- */
ok('1 uso: 1º grau', grau([uso(0, 1)]), 1);
ok('5 usos no mesmo dia e parceiro: 2º grau', grau(Array.from({ length: 5 }, () => uso(0, 1))), 2);

/* ---------- 3º grau: pessoas e semanas ---------- */
ok('15 usos, 1 pessoa, 5 semanas: fica no 2º (precisa de 2 pessoas)',
  grau(Array.from({ length: 15 }, (_, i) => uso(i * 2, 1))), 2);
ok('15 usos, 3 pessoas, 2 semanas: fica no 2º (precisa de 4 semanas)',
  grau(Array.from({ length: 15 }, (_, i) => uso(i % 10, 1 + (i % 3)))), 2);
ok('15 usos, 3 pessoas, 5 semanas: 3º grau',
  grau(Array.from({ length: 15 }, (_, i) => uso(i * 2, 1 + (i % 3)))), 3);
ok('academia pequena (2 parceiros) não trava no 3º',
  grau(Array.from({ length: 15 }, (_, i) => uso(i * 2, 1 + (i % 2)))), 3);
const travada = calcularAtaque(Array.from({ length: 15 }, (_, i) => uso(i % 10, 1 + (i % 3))));
ok('e o texto diz que faltam semanas', faltaPara(travada).resumo, 'Falta sair em mais 2 semanas diferentes pra subir pro 3º grau');

/* ---------- 4º grau: meses e faixa acima ---------- */
const meses3 = Array.from({ length: 35 }, (_, i) => uso(i * 3, 1 + (i % 3), i < 2 ? 'azul' : 'branca'));
ok('35 usos, 3 pessoas, 3 meses, 2 em faixa acima: 4º grau', grau(meses3), 4);
const semAcima = Array.from({ length: 35 }, (_, i) => uso(i * 3, 1 + (i % 3)));
ok('sem ninguém de faixa acima: fica no 3º', grau(semAcima), 3);
const rapido = Array.from({ length: 35 }, (_, i) => uso(i % 28, 1 + (i % 3), i < 2 ? 'azul' : 'branca'));
ok('tudo num mês só: fica no 3º (Assinatura pede meses)', grau(rapido), 3);

/* ---------- o peso de cada uso ---------- */
ok('4 usos contra roxa já valem o 2º grau', grau(Array.from({ length: 4 }, () => uso(0, 1, 'roxa'))), 2);
ok('4 usos contra branca ainda não', grau(Array.from({ length: 4 }, () => uso(0, 1, 'branca'))), 1);
ok('parceiro sem faixa marcada vale como a sua (azul não perde peso)',
  calcularAtaque(Array.from({ length: 7 }, () => uso(0, null, null)), 'azul').grau, 2);

/* ---------- o grau conquistado não volta ---------- */
const antes = (dia, pid) => ({ data: addDias(REGRA_NOVA_DESDE, -60 + dia), partnerId: pid, faixaParceiro: 'branca', contexto: 'rola' });
const velhos = Array.from({ length: 15 }, (_, i) => antes(i, 1));
ok('régua antiga dava 3º grau (15 no mesmo parceiro)', calcularAtaque(velhos, 'branca', { regra: 'v1' }).grau, 3);
ok('régua nova sozinha daria 2º', grau(velhos), 2);
ok('guardado: continua no 3º', grauGuardado(velhos, 'branca', []), 3);

/* graduação: 3º grau na branca, pegou azul depois, a régua subiu */
const gradAzul = [{ data: addDias(depois, 60), tipo: 'faixa', faixa: 'azul' }];
const naBranca = Array.from({ length: 16 }, (_, i) => uso(i * 3, 1 + (i % 2)));
ok('antes da graduação era faixa branca', faixaNaData(addDias(depois, 10), gradAzul, 'azul'), 'branca');
ok('régua da azul sozinha derrubaria pro 2º', grau(naBranca, 'azul'), 2);
ok('com a graduação registrada, fica no 3º', grauGuardado(naBranca, 'azul', gradAzul), 3);

/* ---------- o grau da faixa também sobe a régua ---------- */
const { requisitosDaFaixa } = await import('../src/lib/graus.js');
ok('branca sem grau: 2º grau pede 5', requisitosDaFaixa('branca', 'v2', 0)[2].usos, 5);
ok('branca com 2 graus: pede um pouco mais', requisitosDaFaixa('branca', 'v2', 2)[2].usos, 6);
ok('branca com 4 graus: já é a régua da azul', requisitosDaFaixa('branca', 'v2', 4)[3].usos, requisitosDaFaixa('azul', 'v2', 0)[3].usos);

/* recebeu o 3º grau depois de chegar no 3º grau da técnica */
const gradGrau = [{ data: addDias(depois, 60), tipo: 'grau', faixa: 'branca', graus: 3 }];
ok('régua da branca com 3 graus sozinha derrubaria pro 2º', calcularAtaque(naBranca, 'branca', { graus: 3 }).grau, 2);
ok('com o grau registrado, fica no 3º', grauGuardado(naBranca, 'branca', gradGrau, 3), 3);

/* e as telas veem o mesmo número */
const sessions = naBranca.map((u, i) => ({ id: i + 1, data: u.data }));
const rolls = naBranca.map((u, i) => ({ sessionId: i + 1, partnerId: u.partnerId, contexto: 'rola', subsAplicadas: ['Kimura'] }));
const partners = [{ id: 1, faixa: 'branca' }, { id: 2, faixa: 'branca' }];
ok('minhasTecnicas respeita a graduação', minhasTecnicas(rolls, partners, sessions, [], 'azul', gradAzul)[0].grau, 3);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
