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
   OS ALIMENTOS DE CASA

   Porções de casa, com proteína (p) e carboidrato (c) aproximados
   (tabela TACO e rótulos comuns). A pessoa ainda cria os dela, que
   moram na tabela foods: { nome, porcao, p, c }.
   ============================================================ */
export const ALIMENTOS = [
  { id: 'frango', nome: 'Filé de frango', porcao: '1 filé médio (120 g)', p: 36, c: 0 },
  { id: 'carne', nome: 'Bife ou carne moída', porcao: '100 g, um bife médio', p: 26, c: 0 },
  { id: 'ovo', nome: 'Ovo', porcao: '1 unidade', p: 6, c: 0 },
  { id: 'atum', nome: 'Atum', porcao: '1 lata escorrida', p: 28, c: 0 },
  { id: 'peixe', nome: 'Peixe', porcao: '1 filé (120 g)', p: 25, c: 0 },
  { id: 'whey', nome: 'Whey', porcao: '1 scoop (30 g)', p: 24, c: 3 },
  { id: 'feijao', nome: 'Feijão', porcao: '1 concha cheia', p: 7, c: 19 },
  { id: 'leite', nome: 'Leite ou kefir', porcao: '1 copo (200 ml)', p: 7, c: 10 },
  { id: 'iogurte', nome: 'Iogurte natural', porcao: '1 pote', p: 7, c: 8 },
  { id: 'queijo', nome: 'Queijo minas', porcao: '2 fatias', p: 10, c: 2 },
  { id: 'arroz', nome: 'Arroz', porcao: '4 colheres de sopa (100 g)', p: 3, c: 28 },
  { id: 'macarrao', nome: 'Macarrão', porcao: '1 prato (150 g cozido)', p: 6, c: 42 },
  { id: 'batatadoce', nome: 'Batata-doce', porcao: '1 média cozida (150 g)', p: 2, c: 28 },
  { id: 'pao', nome: 'Pão francês', porcao: '1 unidade', p: 4, c: 29 },
  { id: 'cuscuz', nome: 'Cuscuz', porcao: '1 fatia (100 g)', p: 2, c: 25 },
  { id: 'tapioca', nome: 'Tapioca', porcao: '1 média', p: 0, c: 30 },
  { id: 'aveia', nome: 'Aveia', porcao: '2 colheres de sopa (30 g)', p: 4, c: 17 },
  { id: 'banana', nome: 'Banana', porcao: '1 média', p: 1, c: 22 },
];

/* a chave de cada alimento no registro do dia: o de casa pelo id,
   o que a pessoa criou por "c" + o id da tabela */
export const chaveDoAlimento = (a) => (a.base ? a.id : `c${a.id}`);

/* os dois juntos, os da pessoa primeiro */
export const todosOsAlimentos = (meus = []) => [
  ...meus.filter((f) => !f.arquivada).map((f) => ({ ...f, p: Number(f.p) || 0, c: Number(f.c) || 0 })),
  ...ALIMENTOS.map((a) => ({ ...a, base: true })),
];

/* quanto deu o que está marcado: { chave: quantidade } */
export function somarDia(comi = {}, alimentos = []) {
  let p = 0;
  let c = 0;
  for (const a of alimentos) {
    const n = Number(comi[chaveDoAlimento(a)]) || 0;
    p += n * a.p;
    c += n * a.c;
  }
  return { proteina: Math.round(p), carbo: Math.round(c) };
}

/* O dia bateu? O que a pessoa marcou na mão vale mais que a soma:
   quem não anota comida marca "bati" e pronto. Sem nada, o dia não
   aparece em lugar nenhum. */
export function bateuODia(reg) {
  if (!reg) return null;
  if (reg.marcado === 'bati') return true;
  if (reg.marcado === 'nao') return false;
  if (!reg.proteina) return null;
  return reg.proteina >= (reg.meta || Infinity);
}

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
