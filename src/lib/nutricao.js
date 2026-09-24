/* ============================================================
   AS CONTAS DA NUTRIÇÃO

   Tudo sai do peso e de quantas vezes a pessoa treina por semana,
   e a tela mostra a conta junto do número, pra ela conferir.

   Base: posição da ISSN pra esportes de combate (2025): proteína
   de 1,2 a 2,0 g/kg e carboidrato nunca abaixo de 3 a 4 g/kg no dia
   a dia; depois do treino, carboidrato de 0,6 a 1,0 g/kg e proteína
   de 0,2 a 0,5 g/kg. Creatina: 3 a 5 g por dia (ISSN). Água: 5 a
   7 ml/kg nas 4 horas antes do treino; perder mais de 2% do peso
   em suor já derruba o desempenho.
   ============================================================ */

const umaCasa = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const redondo = (x, passo = 5) => Math.round(x / passo) * passo;

export function contasDaNutricao(pesoKg, treinosSemana = 3) {
  const peso = Number(String(pesoKg).replace(',', '.'));
  if (!peso || peso < 30 || peso > 250) return null;

  /* quem treina mais gasta mais: o carboidrato sobe com a semana de tatame */
  const carbo = treinosSemana >= 5 ? [5, 7] : treinosSemana >= 3 ? [4, 5] : [3, 4];

  const proteina = [redondo(peso * 1.6), redondo(peso * 2.0)];
  const porRefeicao = redondo((peso * 1.8) / 4);

  return {
    peso,
    proteina: { min: proteina[0], max: proteina[1], conta: `${umaCasa(peso)} kg × 1,6 a 2,0 g`, porRefeicao,
      /* 100 g de frango cozido tem uns 30 g de proteína; um ovo, uns 6 g */
      exemplo: `Em 4 refeições, uns ${porRefeicao} g em cada: é mais ou menos ${redondo((porRefeicao / 30) * 100, 10)} g de frango, ou ${Math.round(porRefeicao / 6)} ovos.` },
    carboidrato: { min: redondo(peso * carbo[0], 10), max: redondo(peso * carbo[1], 10), conta: `${umaCasa(peso)} kg × ${carbo[0]} a ${carbo[1]} g`,
      porque: treinosSemana >= 5 ? 'Cinco treinos ou mais por semana: o tanque esvazia rápido.'
        : treinosSemana >= 3 ? 'Três a quatro treinos por semana.'
          : 'Até dois treinos por semana. Mesmo assim, nunca abaixo disso.' },
    agua: { litros: umaCasa(peso * 0.035), antes: [redondo(peso * 5, 50), redondo(peso * 7, 50)], limite2: umaCasa(peso * 0.02) },
    posTreino: { carbo: [redondo(peso * 0.6), redondo(peso * 1.0)], proteina: [redondo(peso * 0.25), redondo(peso * 0.4)] },
    creatina: '3 a 5 g',
    /* ISSN: 3 a 6 mg/kg uns 60 min antes; começa pela menor. Uma xícara de
       café coado tem perto de 90 mg */
    cafeina: { mg: redondo(peso * 3, 10), xicaras: Math.max(1, Math.round((peso * 3) / 90)) },
  };
}

/* ============================================================
   A PROTEÍNA DO DIA A DIA

   Porções de casa, com o valor aproximado de proteína (tabela TACO
   e rótulos comuns). É o que o contador "bateu a proteína hoje?" usa.
   ============================================================ */
export const ALIMENTOS_PROTEINA = [
  { id: 'frango', nome: 'Filé de frango', porcao: '1 filé médio (120 g)', g: 36 },
  { id: 'carne', nome: 'Bife ou carne moída', porcao: '100 g, um bife médio', g: 26 },
  { id: 'atum', nome: 'Atum', porcao: '1 lata escorrida', g: 28 },
  { id: 'peixe', nome: 'Peixe', porcao: '1 filé (120 g)', g: 25 },
  { id: 'ovo', nome: 'Ovo', porcao: '1 unidade', g: 6 },
  { id: 'whey', nome: 'Whey', porcao: '1 scoop (30 g)', g: 24 },
  { id: 'feijao', nome: 'Feijão', porcao: '1 concha', g: 7 },
  { id: 'leite', nome: 'Leite ou kefir', porcao: '1 copo (200 ml)', g: 7 },
  { id: 'iogurte', nome: 'Iogurte natural', porcao: '1 pote', g: 7 },
  { id: 'queijo', nome: 'Queijo minas', porcao: '2 fatias', g: 10 },
];

/* o que comer pra fechar o que falta, com comida de verdade */
export function paraFechar(falta) {
  if (falta <= 0) return 'Bateu a meta de hoje. O músculo agradece, e o próximo rola também.';
  if (falta <= 8) return `Faltam ${falta} g: um ovo ou um copo de leite já fecham.`;
  if (falta <= 30) return `Faltam ${falta} g: uma lata de atum ou um scoop de whey resolvem.`;
  /* filé inteiro onde couber, e ovo pra fechar o resto: sem mandar comer a mais */
  const files = Math.floor(falta / 36);
  const ovos = Math.ceil((falta - files * 36) / 6);
  const partes = [
    files && `${files} ${files === 1 ? 'filé' : 'filés'} de frango`,
    ovos && `${ovos} ${ovos === 1 ? 'ovo' : 'ovos'}`,
  ].filter(Boolean);
  return `Faltam ${falta} g: ${partes.join(' e ')} fecham a conta. Dá pra dividir entre as próximas refeições.`;
}
