import { hoje, addDias, diasEntre } from './utils';

/* ============================================================
   LESÃO

   Existe uma diferença que o app precisava enxergar: tem
   professor treinando com o joelho torado há anos, e tem gente
   que torceu o dedo e ficou três semanas fora.

   Não é o tipo da lesão que decide, é o que ela te impede de
   fazer. Por isso a pergunta não é "quão grave", é "dá pra
   treinar?".
   ============================================================ */

export const IMPACTOS = [
  {
    id: 'adaptado',
    nome: 'Dá pra treinar adaptando',
    desc: 'Você vai, mas evita certas posições ou avisa o parceiro antes.',
    tone: 'warn',
    treina: true,
  },
  {
    id: 'leve',
    nome: 'Treino normal, só incomoda',
    desc: 'Dói de vez em quando mas não muda o que você faz no tatame.',
    tone: 'jade',
    treina: true,
  },
  {
    id: 'parado',
    nome: 'Fora do tatame',
    desc: 'Não dá pra treinar até melhorar.',
    tone: 'blood',
    treina: false,
  },
];

export const impactoPorId = (id) => IMPACTOS.find((x) => x.id === id) || IMPACTOS[0];

/* ---------- quanto tempo fora ---------- */
export const PRAZOS = [
  { id: '1s', nome: 'Uma semana', dias: 7 },
  { id: '2s', nome: 'Duas semanas', dias: 14 },
  { id: '1m', nome: 'Um mês', dias: 30 },
  { id: '3m', nome: 'Três meses ou mais', dias: 90 },
  { id: 'nsei', nome: 'Não sei ainda', dias: null },
];

export const prazoPorId = (id) => PRAZOS.find((x) => x.id === id) || PRAZOS[4];

export function previsaoDeVolta(lesao) {
  if (!lesao?.prazo || lesao.prazo === 'nsei') return null;
  const p = prazoPorId(lesao.prazo);
  return addDias(lesao.data, p.dias);
}

/* ---------- o que dizer sobre uma lesão aberta ---------- */
export function situacao(lesao) {
  if (!lesao || lesao.status === 'curada') return null;

  const imp = impactoPorId(lesao.impacto);
  const dias = diasEntre(lesao.data, hoje());
  const volta = previsaoDeVolta(lesao);

  if (imp.treina) {
    return {
      titulo: imp.id === 'adaptado' ? 'Treinando adaptado' : 'Treinando normal',
      texto: `${lesao.regiao}${lesao.lado ? `, ${lesao.lado.toLowerCase()}` : ''}, há ${dias} ${dias === 1 ? 'dia' : 'dias'}.`,
      tone: imp.tone,
      parado: false,
    };
  }

  if (!volta) {
    return {
      titulo: 'Fora do tatame',
      texto: `${lesao.regiao} há ${dias} ${dias === 1 ? 'dia' : 'dias'}, sem prazo definido. Quando você registrar um treino, o app entende que você voltou.`,
      tone: 'blood',
      parado: true,
      semPrazo: true,
    };
  }

  const faltam = diasEntre(hoje(), volta);
  if (faltam > 0) {
    return {
      titulo: `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}`,
      texto: `Você marcou ${lesao.regiao} com previsão de voltar em ${prazoPorId(lesao.prazo).nome.toLowerCase()}.`,
      tone: 'blood',
      parado: true,
      faltam,
    };
  }

  return {
    titulo: 'O prazo já passou',
    texto: `Se já está treinando, registre um treino que a lesão fecha sozinha. Se ainda dói, vale procurar alguém que entenda.`,
    tone: 'warn',
    parado: true,
    vencido: true,
  };
}

/* ============================================================
   O QUE ESTUDAR ENQUANTO ESTÁ FORA

   Quem está parado tem tempo e não tem tatame. É a melhor
   janela do ano pra entender o porquê das coisas, e é também
   quando a pessoa mais some do app.
   ============================================================ */
export const ESTUDO_POR_REGIAO = {
  Joelho: {
    porque: 'Joelho costuma machucar em raspagem, em guarda aberta com o pé preso e em queda mal amortecida.',
    busque: ['guarda', 'raspagem', 'queda'],
    evitar: 'Quando voltar, evite deixar o pé preso no tatame enquanto o quadril gira. É assim que a maioria dos joelhos vai embora.',
  },
  Ombro: {
    porque: 'Ombro machuca em kimura, americana e omoplata, quase sempre por reagir tarde demais.',
    busque: ['articular', 'defesa', 'finalizacao'],
    evitar: 'Bater cedo não é fraqueza. Ombro não avisa duas vezes.',
  },
  Cotovelo: {
    porque: 'Cotovelo vai embora na chave de braço, e normalmente porque a pessoa tentou aguentar um pouco mais.',
    busque: ['articular', 'defesa'],
    evitar: 'Aprender a defender cedo vale mais que aprender a escapar tarde.',
  },
  Costas: {
    porque: 'Lombar sofre quando a guarda é aberta à força e quando se levanta peso com a coluna em vez do quadril.',
    busque: ['guarda', 'passagem', 'fisico'],
    evitar: 'Fortalecer o core e aprender a usar quadril em vez de lombar resolve a maior parte.',
  },
  Pescoço: {
    porque: 'Pescoço sofre com pressão de cross-face e com queda amortecida errado.',
    busque: ['defesa', 'queda', 'fisico'],
    evitar: 'Fortalecimento de pescoço é o trabalho mais subestimado do jiu-jitsu.',
  },
  Costela: {
    porque: 'Costela machuca embaixo de pressão, principalmente no 100kg e na montada.',
    busque: ['defesa', 'controle'],
    evitar: 'Enquadramento certo tira a pressão do osso. Quase sempre é isso que falta.',
  },
  Dedo: {
    porque: 'Dedo de faixa branca sofre por pegada errada na lapela e por insistir numa pegada perdida.',
    busque: ['controle', 'guarda'],
    evitar: 'Pegada de quatro dedos, nunca com o polegar dentro. E solte quando a pegada acabar.',
  },
  Pé: {
    porque: 'Pé e tornozelo sofrem em chave de pé e em guarda onde o pé fica preso.',
    busque: ['botinha', 'perna', 'defesa'],
    evitar: 'Saber reconhecer quando a chave de pé está entrando vale mais que qualquer defesa.',
  },
};

export function guiaDeEstudo(regiao) {
  return ESTUDO_POR_REGIAO[regiao] || {
    porque: 'Enquanto você está fora, dá pra estudar o jogo que você não consegue treinar agora.',
    busque: ['logica'],
    evitar: 'Voltar devagar é mais rápido que voltar e machucar de novo.',
  };
}
