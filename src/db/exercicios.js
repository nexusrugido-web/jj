/* ============================================================
   EXERCÍCIOS

   O que cada exercício entrega pro jiu-jitsu, em uma frase honesta,
   e o plano pra encaixar ele no treino de academia que a pessoa já
   faz (planoDoExercicio, mais abaixo).

   A seleção segue o que a literatura de preparação física pra
   grappling repete: pegada, cadeia posterior, puxada, core
   anti-rotação e prevenção de ombro, joelho e coluna.
   ============================================================ */

export const GRUPOS = [
  { id: 'pegada', nome: 'Pegada', desc: 'A mão que não abre no fim do rola' },
  { id: 'puxar', nome: 'Puxar', desc: 'Trazer o outro pra onde você quer' },
  { id: 'quadril', nome: 'Quadril e posterior', desc: 'Ponte, queda, raspagem' },
  { id: 'empurrar', nome: 'Empurrar', desc: 'Enquadramento e pressão' },
  { id: 'pernas', nome: 'Pernas', desc: 'Base pra não cair e pra derrubar' },
  { id: 'core', nome: 'Core', desc: 'Resistir a ser girado' },
  { id: 'resistencia', nome: 'Resistência', desc: 'O gás que aguenta o rola até o fim' },
  { id: 'prevencao', nome: 'Prevenção', desc: 'Ombro, joelho, coluna e pescoço' },
];

export const EXERCICIOS = [
  /* ---------- pegada ---------- */
  { id: 'dead-hang', nome: 'Pendurado na barra', g: 'pegada', tipo: 'tempo',
    entrega: 'Pegada que aguenta o rola inteiro. É o exercício mais direto pra quem solta a lapela no terceiro minuto.' },
  { id: 'farmer', nome: 'Caminhada do fazendeiro', g: 'pegada', tipo: 'peso_tempo',
    entrega: 'Pegada sob fadiga, que é quando ela falha de verdade. Também segura a postura com carga.' },
  { id: 'barra-toalha', nome: 'Barra com toalha', g: 'pegada', tipo: 'reps',
    entrega: 'Pegada de gi, na medida. A toalha imita a lapela e o punho do kimono melhor que a barra lisa.' },
  { id: 'pinca', nome: 'Pinça de anilha', g: 'pegada', tipo: 'tempo',
    entrega: 'Força de polegar, que é o que segura a pegada cruzada e a gola.' },
  { id: 'rosca-punho', nome: 'Rosca de punho', g: 'pegada', tipo: 'peso',
    entrega: 'Antebraço mais resistente, menos dor de cotovelo de tanto puxar.' },

  /* ---------- puxar ---------- */
  { id: 'barra', nome: 'Barra fixa', g: 'puxar', tipo: 'reps',
    entrega: 'Puxar o outro pra dentro da sua guarda e sustentar o próprio peso na hora do scramble.' },
  { id: 'remada-curvada', nome: 'Remada curvada', g: 'puxar', tipo: 'peso',
    entrega: 'Costas que seguram a postura e puxam. Base de quase todo controle de cima.' },
  { id: 'remada-unilateral', nome: 'Remada unilateral', g: 'puxar', tipo: 'peso',
    entrega: 'Corrige o lado mais fraco, que no jiu-jitsu aparece rápido porque todo mundo tem um lado preferido.' },
  { id: 'puxada', nome: 'Puxada na polia', g: 'puxar', tipo: 'peso',
    entrega: 'Mesma função da barra, com carga ajustável. Boa pra quem ainda não faz barra.' },
  { id: 'face-pull', nome: 'Face pull', g: 'puxar', tipo: 'peso',
    entrega: 'Ombro saudável e postura. Compensa o tanto de empurrar que o jiu-jitsu já faz.' },

  /* ---------- quadril e posterior ---------- */
  { id: 'levantamento-terra', nome: 'Levantamento terra', g: 'quadril', tipo: 'peso',
    entrega: 'Força de quadril e pegada juntas. É o que sustenta queda, levantada com o outro em cima e ponte forte.' },
  { id: 'terra-romeno', nome: 'Terra romeno', g: 'quadril', tipo: 'peso',
    entrega: 'Posterior de coxa forte, que protege o joelho e melhora a explosão do quadril.' },
  { id: 'kettlebell-swing', nome: 'Balanço com kettlebell', g: 'quadril', tipo: 'peso',
    entrega: 'Explosão de quadril, que é o motor da ponte e da raspagem.' },
  { id: 'elevacao-pelvica', nome: 'Elevação pélvica', g: 'quadril', tipo: 'peso',
    entrega: 'Glúteo forte pra ponte. A saída de montada melhora sozinha.' },
  { id: 'ponte-gluteo', nome: 'Ponte de glúteo no chão', g: 'quadril', tipo: 'reps',
    entrega: 'Versão sem equipamento. Serve de aquecimento e de trabalho pra quem tá começando.' },

  /* ---------- empurrar ---------- */
  { id: 'supino', nome: 'Supino', g: 'empurrar', tipo: 'peso',
    entrega: 'Força de empurrar, que segura o enquadramento e a pressão de cima.' },
  { id: 'desenvolvimento', nome: 'Desenvolvimento', g: 'empurrar', tipo: 'peso',
    entrega: 'Ombro forte pra empurrar acima da linha do peito, como no enquadramento de baixo.' },
  { id: 'flexao', nome: 'Flexão de braço', g: 'empurrar', tipo: 'reps',
    entrega: 'Resistência de empurrar sem equipamento nenhum.' },
  { id: 'paralela', nome: 'Paralelas', g: 'empurrar', tipo: 'reps',
    entrega: 'Tríceps e peito com o próprio peso. Ajuda a sustentar a postura na guarda.' },

  /* ---------- pernas ---------- */
  { id: 'agachamento', nome: 'Agachamento', g: 'pernas', tipo: 'peso',
    entrega: 'Base pra não ser derrubado e força pra entrar na queda.' },
  { id: 'agachamento-frontal', nome: 'Agachamento frontal', g: 'pernas', tipo: 'peso',
    entrega: 'Postura ereta com carga na frente, parecido com segurar alguém no clinch.' },
  { id: 'afundo', nome: 'Afundo', g: 'pernas', tipo: 'peso',
    entrega: 'Perna forte de um lado só, que é como você entra na queda de verdade.' },
  { id: 'levantada-tecnica', nome: 'Levantada técnica', g: 'pernas', tipo: 'reps',
    entrega: 'O movimento em si, treinado fora do rola. Levantar sem entregar as costas.' },

  /* ---------- core ---------- */
  { id: 'pallof', nome: 'Pallof press', g: 'core', tipo: 'peso',
    entrega: 'Resistir a ser girado. É o que impede a raspagem e a passagem em você.' },
  { id: 'prancha', nome: 'Prancha', g: 'core', tipo: 'tempo',
    entrega: 'Core que aguenta pressão parado, que é metade do jiu-jitsu.' },
  { id: 'hollow', nome: 'Hollow hold', g: 'core', tipo: 'tempo',
    entrega: 'Abdômen em tensão com as pernas no ar, igualzinho à guarda fechada apertada.' },
  { id: 'ab-roda', nome: 'Roda abdominal', g: 'core', tipo: 'reps',
    entrega: 'Core anti-extensão. Protege a lombar quando alguém abre a sua guarda à força.' },
  { id: 'giro-russo', nome: 'Giro russo', g: 'core', tipo: 'peso',
    entrega: 'Rotação com carga, que aparece em toda virada de quadril.' },

  /* ---------- prevenção ---------- */
  { id: 'rotacao-externa', nome: 'Rotação externa de ombro', g: 'prevencao', tipo: 'peso',
    entrega: 'Manguito rotador. É o que segura o ombro quando pega uma kimura e você reage tarde.' },
  { id: 'band-walk', nome: 'Caminhada lateral com elástico', g: 'prevencao', tipo: 'tempo',
    entrega: 'Glúteo médio, que controla o joelho. Evidência boa de reduzir lesão de joelho.' },
  { id: 'pescoco', nome: 'Fortalecimento de pescoço', g: 'prevencao', tipo: 'tempo',
    entrega: 'Pescoço forte aguenta a pressão do cross-face e protege a coluna cervical.' },
  { id: 'extensao-lombar', nome: 'Extensão lombar', g: 'prevencao', tipo: 'reps',
    entrega: 'Lombar resistente, que é a queixa número um de quem passa dos trinta e cinco.' },
  { id: 'mobilidade-quadril', nome: 'Mobilidade de quadril', g: 'prevencao', tipo: 'tempo',
    entrega: 'Quadril que abre. Guarda melhor e menos dor depois do treino.' },
  { id: 'nordico', nome: 'Nórdico (posterior de coxa)', g: 'prevencao', tipo: 'reps', novo: '2026-09-24',
    entrega: 'O exercício com mais prova de que reduz lesão de posterior de coxa. Protege a perna na queda e na passagem em pé.' },
  { id: 'copenhagen', nome: 'Prancha Copenhagen (virilha)', g: 'prevencao', tipo: 'tempo', novo: '2026-09-24',
    entrega: 'Adutor forte, que é a virilha que estira quando alguém abre a sua guarda à força ou na chave de pé.' },

  /* ---------- resistência ---------- */
  { id: 'remo-intervalado', nome: 'Remo ergométrico intervalado', g: 'resistencia', tipo: 'tempo', novo: '2026-09-24',
    entrega: 'Gás de rola de verdade: forte, pausa curta, forte de novo. E puxa com as costas, igual no tatame.' },
  { id: 'bike-intervalada', nome: 'Bike intervalada', g: 'resistencia', tipo: 'tempo', novo: '2026-09-24',
    entrega: 'Condicionamento sem impacto no joelho, bom pra quem já sente a articulação depois do treino.' },
  { id: 'sprawl-circuito', nome: 'Circuito de sprawl e levantada', g: 'resistencia', tipo: 'tempo', novo: '2026-09-24',
    entrega: 'O movimento do jiu-jitsu com o coração lá em cima: defender a queda cansado e levantar sem entregar as costas.' },
  { id: 'complexo-kettlebell', nome: 'Complexo de kettlebell', g: 'resistencia', tipo: 'tempo', novo: '2026-09-24',
    entrega: 'Força e fôlego juntos: balanço, agachamento e remada sem largar o peso, como segurar uma posição cansado.' },
  { id: 'kimono-barra', nome: 'Pegada no kimono pendurado', g: 'resistencia', tipo: 'tempo', novo: '2026-09-24',
    entrega: 'Resistência de pegada no próprio pano: é a mão que ainda fecha no último minuto do rola.' },
];

export const exerciciosDoGrupo = (g) => EXERCICIOS.filter((e) => e.g === g);

/* ============================================================
   O PLANO DE CADA EXERCÍCIO

   Não é um treino completo: é como encaixar ESTE exercício no
   treino de academia que a pessoa já faz. O plano sai do tipo do
   exercício (força pesada, explosivo, peso do corpo, isometria ou
   leve de prevenção) e o grupo diz em que dia ele entra.

   Base: força máxima em 3 a 6 repetições, parando antes de falhar
   (a ciência de força pra grappling); isometria de pegada e de
   pescoço 2 a 3 vezes por semana; o que é pesado longe do rola
   forte, porque perna morta no tatame é técnica pior e lesão.
   ============================================================ */
const TIPO_DO_PLANO = {
  'levantamento-terra': 'pesado', 'terra-romeno': 'pesado', agachamento: 'pesado', 'agachamento-frontal': 'pesado',
  supino: 'pesado', desenvolvimento: 'pesado', 'remada-curvada': 'pesado', puxada: 'pesado',
  'remada-unilateral': 'pesadoLado', afundo: 'pesadoLado', 'elevacao-pelvica': 'pesado',
  'kettlebell-swing': 'explosivo',
  barra: 'corpo', 'barra-toalha': 'corpo', flexao: 'corpo', paralela: 'corpo', 'ponte-gluteo': 'corpo',
  'levantada-tecnica': 'corpo', 'ab-roda': 'corpo', 'extensao-lombar': 'corpo',
  'dead-hang': 'isometria', farmer: 'isometria', pinca: 'isometria', prancha: 'isometria', hollow: 'isometria',
  pescoco: 'isometria', 'band-walk': 'isometria', 'mobilidade-quadril': 'isometria',
  'face-pull': 'leve', 'rotacao-externa': 'leve', 'rosca-punho': 'leve', pallof: 'leve', 'giro-russo': 'leve',
  nordico: 'corpo', copenhagen: 'isometria',
  'remo-intervalado': 'intervalo', 'bike-intervalada': 'intervalo', 'sprawl-circuito': 'intervalo',
  'complexo-kettlebell': 'intervalo', 'kimono-barra': 'isometria',
};

/* Dupla progressão: uma faixa de repetições; sobe uma repetição por
   vez e, quando fizer o topo da faixa em todas as séries, aumenta a
   carga e volta pro começo. Não acaba nunca e qualquer um entende.
   Frequência: 2 a 3 vezes por semana é o que as diretrizes de força
   recomendam (ACSM) e o que cabe junto com o tatame. */
const PLANOS = {
  pesado: {
    dose: '3 × 5 a 8',
    series: '3 séries de 5 a 8 repetições',
    vezes: '2 vezes por semana',
    descanso: '2 a 3 minutos entre as séries',
    carga: 'A mais pesada que você consegue fazer 5 repetições bem feitas, parando antes de falhar.',
    progressao: 'Começa com 3 × 5. A cada treino, tenta uma repetição a mais numa das séries. Quando fizer 3 × 8 com a mesma carga, sobe o mínimo possível (2 a 5 kg) e volta pra 3 × 5.',
    exemplo: 'Ex.: 3 × 5 com 60 kg → 5, 6, 5 → 6, 6, 6 → … → 8, 8, 8 → 62,5 kg e volta pra 3 × 5.',
  },
  pesadoLado: {
    dose: '3 × 8 a 12 cada lado',
    series: '3 séries de 8 a 12 repetições de cada lado',
    vezes: '2 vezes por semana',
    descanso: '90 segundos a 2 minutos',
    carga: 'A que dá 8 repetições de cada lado sem perder a postura. Começa pelo lado mais fraco.',
    progressao: 'Começa com 3 × 8 de cada lado. A cada treino, uma repetição a mais. Quando fizer 3 × 12 dos dois lados, sobe o peso (o próximo halter) e volta pra 3 × 8.',
    exemplo: 'Ex.: 3 × 8 com 16 kg → 3 × 9 → … → 3 × 12 → 18 kg e volta pra 3 × 8.',
  },
  explosivo: {
    dose: '4 × 8 a 12',
    series: '4 séries de 8 a 12 repetições rápidas',
    vezes: '2 vezes por semana',
    descanso: '90 segundos',
    carga: 'Moderada. Cada repetição tem que sair rápida: ficou lenta, a série acabou.',
    progressao: 'Começa com 4 × 8. Quando fizer 4 × 12 com todas rápidas, pega o próximo peso (uns 4 kg a mais) e volta pra 4 × 8.',
    exemplo: 'Ex.: 4 × 8 com 16 kg → 4 × 10 → 4 × 12 → 20 kg e volta pra 4 × 8.',
  },
  corpo: {
    dose: '3 × 6 a 12',
    series: '3 séries de 6 a 12 repetições',
    vezes: '2 a 3 vezes por semana',
    descanso: '90 segundos',
    carga: 'O próprio peso. Não chegou em 6? Usa uma versão mais fácil (elástico, joelho no chão) até chegar.',
    progressao: 'A cada treino, uma repetição a mais numa das séries. Quando fizer 3 × 12, coloca peso (mochila, cinto, colete) de 2,5 a 5 kg e volta pra 3 × 6.',
    exemplo: 'Ex.: 6, 5, 5 → 6, 6, 5 → … → 12, 12, 12 → com 5 kg de mochila e volta pra 3 × 6.',
  },
  isometria: {
    dose: '3 × 20 a 45 s',
    series: '3 séries de 20 a 45 segundos',
    vezes: '3 vezes por semana (pegada e pescoço respondem bem a mais vezes)',
    descanso: '60 a 90 segundos',
    carga: 'Segurar parado, com a postura certa. A última série tem que ser difícil de terminar.',
    progressao: 'Começa com 3 × 20 segundos. A cada treino, 5 segundos a mais. Quando fizer 3 × 45, aumenta a carga (ou uma versão mais difícil) e volta pros 20.',
    exemplo: 'Ex.: 3 × 20 s → 3 × 25 s → … → 3 × 45 s → mais peso e volta pra 3 × 20 s.',
  },
  leve: {
    dose: '3 × 12 a 20',
    series: '3 séries de 12 a 20 repetições',
    vezes: '2 a 3 vezes por semana',
    descanso: '60 segundos',
    carga: 'Leve e controlada. Se precisa roubar no movimento, está pesado.',
    progressao: 'Começa com 3 × 12. A cada treino, uma repetição a mais. Quando fizer 3 × 20, sobe o mínimo de carga e volta pra 3 × 12.',
    exemplo: 'Ex.: 3 × 12 com o elástico fraco → … → 3 × 20 → elástico médio e volta pra 3 × 12.',
  },
  /* o rola é esforço forte em rajadas, com pausa curta: o treino de gás copia isso */
  intervalo: {
    dose: '6 a 10 tiros',
    series: '6 a 10 tiros de 30 segundos forte, com 30 segundos leve entre eles',
    vezes: '1 a 2 vezes por semana, em dia sem rola forte',
    descanso: 'O leve entre os tiros já é o descanso: não para de vez',
    carga: 'Forte a ponto de ficar ofegante, como o fim de um rola. Conseguiu conversar no tiro, está leve.',
    progressao: 'Começa com 6 tiros. A cada treino, um tiro a mais. Quando fizer 10, o tiro passa a ter 40 segundos forte e 20 leve, e volta pra 6.',
    exemplo: 'Ex.: 6 tiros → 7 → … → 10 → 6 tiros de 40/20.',
  },
};

const ONDE_ENCAIXA = {
  pegada: 'No fim do seu treino de costas, com a mão já cansada: é exatamente assim que ela falha no rola.',
  puxar: 'No dia de costas, no lugar de um exercício parecido que você já faz.',
  quadril: 'No dia de perna, antes dos exercícios de máquina.',
  empurrar: 'No dia de peito ou de ombro.',
  pernas: 'No dia de perna, como primeiro exercício, com a perna ainda descansada.',
  core: 'No fim de qualquer treino. Cinco a dez minutos já resolvem.',
  prevencao: 'No aquecimento, antes da academia ou antes do tatame.',
  resistencia: 'Num dia sem rola forte: no fim do treino de academia ou sozinho, de 15 a 20 minutos.',
};

/* o erro que mais aparece, exercício por exercício */
const ERRO_COMUM = {
  'dead-hang': 'Soltar os ombros e ficar só pendurado nas articulações.',
  farmer: 'Usar peso leve e andar rápido. Tem que ser pesado a ponto de a mão querer abrir.',
  'barra-toalha': 'Começar com a barra inteira de toalha. Comece pendurado na toalha antes de puxar.',
  pinca: 'Usar anilha com borda, que vira pegada de mão fechada e não trabalha o polegar.',
  'rosca-punho': 'Mexer o cotovelo junto. Só o punho se move.',
  barra: 'Meia repetição, sem esticar o braço embaixo. É o fim do movimento que mais vale no jiu-jitsu.',
  'remada-curvada': 'Levantar o tronco pra ajudar a subir o peso. Aí vira outro exercício.',
  'remada-unilateral': 'Girar o tronco pra puxar mais peso. O tronco fica parado.',
  puxada: 'Puxar atrás da nuca. Não ajuda em nada e força o ombro.',
  'face-pull': 'Puxar com o corpo e peso demais. É exercício de ombro, leve e controlado.',
  'levantamento-terra': 'Arredondar a lombar pra tirar a barra do chão. Carga menor e costas retas.',
  'terra-romeno': 'Dobrar demais o joelho e virar agachamento.',
  'kettlebell-swing': 'Levantar o peso com o braço e o ombro.',
  'elevacao-pelvica': 'Arquear a lombar pra subir mais. O movimento para quando o quadril alinha.',
  'ponte-gluteo': 'Empurrar com a lombar em vez do glúteo.',
  supino: 'Quicar a barra no peito pra ajudar a subir.',
  desenvolvimento: 'Arquear a lombar pra empurrar mais peso.',
  flexao: 'Deixar o quadril cair e fazer meia repetição.',
  paralela: 'Descer demais e forçar o ombro. Na altura do cotovelo já está bom.',
  agachamento: 'Deixar o joelho cair pra dentro na subida.',
  'agachamento-frontal': 'Deixar o cotovelo cair e a barra rolar pra frente.',
  afundo: 'Passo curto demais, que joga todo o peso no joelho da frente.',
  'levantada-tecnica': 'Levantar de frente, entregando a cabeça e as costas.',
  pallof: 'Deixar o corpo girar junto. O trabalho é justamente não girar.',
  prancha: 'Deixar o quadril cair ou subir demais.',
  hollow: 'Deixar a lombar desgrudar do chão. Dobra os joelhos até conseguir.',
  'ab-roda': 'Ir longe demais e deixar a lombar afundar.',
  'giro-russo': 'Mexer só os braços. Quem gira é o tronco.',
  'rotacao-externa': 'Descolar o cotovelo do corpo pra ajudar.',
  'band-walk': 'Ficar em pé demais e andar balançando o tronco.',
  pescoco: 'Começar com movimento e peso. No começo é só isometria, contra a própria mão.',
  'extensao-lombar': 'Subir além da linha do corpo, arqueando a lombar.',
  nordico: 'Dobrar o quadril pra descer. O corpo desce reto, como uma tábua, e quem segura é o posterior da coxa.',
  copenhagen: 'Deixar o quadril cair. Se estiver difícil demais, apoia o joelho no banco em vez do pé.',
  'remo-intervalado': 'Puxar só com os braços, que cansam antes de o coração subir.',
  'bike-intervalada': 'Carga tão pesada que a perna trava e o tiro vira força, não fôlego.',
  'sprawl-circuito': 'Cair de joelho no chão no sprawl. O quadril desce, o joelho fica fora.',
  'complexo-kettlebell': 'Peso pesado demais, que obriga a parar no meio. O certo é terminar o tiro sem largar.',
  'kimono-barra': 'Segurar com a ponta dos dedos. Pega com a mão inteira, como numa pegada de verdade.',
  'mobilidade-quadril': 'Forçar a amplitude com dor. Mobilidade se ganha com frequência, não com força.',
};

/* exercício que entrou há menos de 30 dias ganha a etiqueta de novo */
export const ehNovo = (e, hojeIso = new Date().toISOString().slice(0, 10)) =>
  !!e.novo && (Date.parse(hojeIso) - Date.parse(e.novo)) / 86400000 <= 30;

export function planoDoExercicio(e) {
  const p = PLANOS[TIPO_DO_PLANO[e.id]] || PLANOS.leve;
  return { ...p, ondeEncaixa: ONDE_ENCAIXA[e.g] || '', erro: ERRO_COMUM[e.id] || '' };
}

/* ---------- quanto de musculação faz sentido ---------- */
export function orientacaoDeCarga(treinosTatameSemana = 0, idade = null) {
  if (treinosTatameSemana >= 5) {
    return {
      recomendado: 2,
      texto: 'Com cinco ou mais treinos de tatame por semana, duas sessões curtas de força bastam. Mais que isso disputa recuperação com o jiu-jitsu e o rola é que vai piorar.',
    };
  }
  if (treinosTatameSemana >= 3) {
    return {
      recomendado: 2,
      texto: 'Duas a três sessões de força por semana cabem bem no seu volume de tatame. Deixe os levantamentos mais pesados pros dias sem rola forte.',
    };
  }
  return {
    recomendado: 3,
    texto: 'Com pouco tatame na semana, dá pra puxar até três sessões de força. Mesmo assim, o que mais faz diferença no jiu-jitsu continua sendo tempo no tatame.',
  };
}
