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
};

const PLANOS = {
  pesado: {
    series: '3 séries de 4 a 6 repetições',
    descanso: '2 a 3 minutos entre as séries',
    carga: 'Pesada, mas parando com umas 2 repetições sobrando. Falhar não deixa mais forte, só mais cansado pro tatame.',
    semanas: [
      'Semana 1: carga média, 3 × 5, só pra acertar o movimento.',
      'Semana 2: mesma carga, 3 × 6.',
      'Semana 3: sobe um pouco a carga e volta pra 3 × 4.',
      'Semana 4: tenta 3 × 6 com a carga nova. Conseguiu, repete o ciclo daqui.',
    ],
  },
  pesadoLado: {
    series: '3 séries de 6 a 8 repetições de cada lado',
    descanso: '90 segundos a 2 minutos',
    carga: 'Pesada o suficiente pra última repetição sair devagar, mas sem perder a postura. Comece pelo lado mais fraco.',
    semanas: [
      'Semana 1: 3 × 6 de cada lado, carga média.',
      'Semana 2: 3 × 8 de cada lado.',
      'Semana 3: sobe a carga e volta pra 3 × 6.',
      'Semana 4: 3 × 8 com a carga nova.',
    ],
  },
  explosivo: {
    series: '4 séries de 8 a 10 repetições rápidas',
    descanso: '90 segundos',
    carga: 'Moderada. O que importa é a velocidade de cada repetição: ficou lento, a série acabou.',
    semanas: [
      'Semana 1: 4 × 8, aprendendo a jogar o quadril e não levantar com o braço.',
      'Semana 2: 4 × 10.',
      'Semana 3: carga um pouco maior, 4 × 8.',
      'Semana 4: 4 × 10 com a carga nova, todas rápidas.',
    ],
  },
  corpo: {
    series: '3 séries, parando umas 2 repetições antes de falhar',
    descanso: '90 segundos',
    carga: 'O próprio peso. Ficou fácil (mais de 12 repetições), coloca peso ou passa pra uma versão mais difícil.',
    semanas: [
      'Semana 1: anota quantas saem em cada série, parando 2 antes de falhar.',
      'Semana 2: uma repetição a mais em cada série.',
      'Semana 3: mais uma.',
      'Semana 4: passou de 12? Coloca peso, ou troca por uma versão mais difícil.',
    ],
  },
  isometria: {
    series: '3 séries de 20 a 40 segundos',
    descanso: '60 a 90 segundos',
    carga: 'Segurar parado, com a postura certa, até o fim do tempo. A última série tem que ser difícil de terminar.',
    semanas: [
      'Semana 1: 3 × 20 segundos.',
      'Semana 2: 3 × 30 segundos.',
      'Semana 3: 3 × 40 segundos.',
      'Semana 4: volta pros 20 segundos com mais carga ou numa versão mais difícil.',
    ],
  },
  leve: {
    series: '3 séries de 12 a 15 repetições',
    descanso: '60 segundos',
    carga: 'Leve e controlada. É exercício de qualidade de movimento, não de carga: se precisar roubar, tá pesado.',
    semanas: [
      'Semana 1: 3 × 15, carga leve.',
      'Semana 2: 3 × 15 com uma pausa de 1 segundo no fim de cada repetição.',
      'Semana 3: sobe um pouco a carga, 3 × 12.',
      'Semana 4: 3 × 15 com a carga nova.',
    ],
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
};

/* como fazer e o erro que mais aparece, exercício por exercício */
const DETALHE = {
  'dead-hang': ['Pendura com as mãos na largura dos ombros, braços estendidos e ombros ativos (sem deixar o corpo afundar entre eles).', 'Soltar os ombros e ficar só pendurado nas articulações.'],
  farmer: ['Um peso pesado em cada mão, peito aberto, e anda devagar, sem deixar o peso balançar.', 'Usar peso leve e andar rápido. Tem que ser pesado a ponto de a mão querer abrir.'],
  'barra-toalha': ['Passa duas toalhas pela barra e puxa segurando nelas, como se fosse a gola do kimono.', 'Começar com a barra inteira de toalha. Comece pendurado na toalha antes de puxar.'],
  pinca: ['Segura duas anilhas lisas juntas só com os dedos e o polegar, braço estendido ao lado do corpo.', 'Usar anilha com borda, que vira pegada de mão fechada e não trabalha o polegar.'],
  'rosca-punho': ['Antebraço apoiado no banco, só o punho sobe e desce com a barra ou o halter.', 'Mexer o cotovelo junto. Só o punho se move.'],
  barra: ['Pega na largura dos ombros, puxa até o queixo passar a barra e desce até esticar o braço.', 'Meia repetição, sem esticar o braço embaixo. É o fim do movimento que mais vale no jiu-jitsu.'],
  'remada-curvada': ['Tronco inclinado uns 45 graus, costas retas, puxa a barra até o umbigo.', 'Levantar o tronco pra ajudar a subir o peso. Aí vira outro exercício.'],
  'remada-unilateral': ['Um joelho e uma mão no banco, puxa o halter até o quadril com o cotovelo colado.', 'Girar o tronco pra puxar mais peso. O tronco fica parado.'],
  puxada: ['Puxa a barra até a parte de cima do peito, com o peito aberto e os ombros pra trás.', 'Puxar atrás da nuca. Não ajuda em nada e força o ombro.'],
  'face-pull': ['Corda na polia na altura do rosto, puxa na direção da testa abrindo os cotovelos.', 'Puxar com o corpo e peso demais. É exercício de ombro, leve e controlado.'],
  'levantamento-terra': ['Barra colada na canela, costas retas, empurra o chão com as pernas até ficar em pé.', 'Arredondar a lombar pra tirar a barra do chão. Carga menor e costas retas.'],
  'terra-romeno': ['Joelho levemente dobrado, leva o quadril pra trás descendo a barra rente à perna até sentir o posterior da coxa.', 'Dobrar demais o joelho e virar agachamento.'],
  'kettlebell-swing': ['O quadril joga o peso pra frente, como um salto parado; o braço só acompanha.', 'Levantar o peso com o braço e o ombro.'],
  'elevacao-pelvica': ['Costas apoiadas no banco, barra no quadril, sobe o quadril até alinhar com o tronco e aperta o glúteo em cima.', 'Arquear a lombar pra subir mais. O movimento para quando o quadril alinha.'],
  'ponte-gluteo': ['Deitado, pés no chão perto do quadril, sobe o quadril apertando o glúteo e desce devagar.', 'Empurrar com a lombar em vez do glúteo.'],
  supino: ['Pés firmes no chão, escápulas juntas, desce a barra até o peito e empurra de volta.', 'Quicar a barra no peito pra ajudar a subir.'],
  desenvolvimento: ['Em pé ou sentado, empurra o peso acima da cabeça sem arquear as costas.', 'Arquear a lombar pra empurrar mais peso.'],
  flexao: ['Corpo reto da cabeça ao pé, desce o peito até perto do chão e empurra.', 'Deixar o quadril cair e fazer meia repetição.'],
  paralela: ['Nas barras paralelas, desce até o ombro ficar na altura do cotovelo e sobe.', 'Descer demais e forçar o ombro. Na altura do cotovelo já está bom.'],
  agachamento: ['Barra nas costas, desce empurrando o quadril pra trás até a coxa ficar paralela ao chão, joelho na direção do pé.', 'Deixar o joelho cair pra dentro na subida.'],
  'agachamento-frontal': ['Barra na frente dos ombros, cotovelos altos, desce com o tronco bem reto.', 'Deixar o cotovelo cair e a barra rolar pra frente.'],
  afundo: ['Um passo à frente, desce até o joelho de trás quase encostar no chão e volta.', 'Passo curto demais, que joga todo o peso no joelho da frente.'],
  'levantada-tecnica': ['Sentado, apoia uma mão atrás e o pé do lado oposto, levanta o quadril e passa a perna pra trás, ficando de base.', 'Levantar de frente, entregando a cabeça e as costas.'],
  pallof: ['De lado pra polia, segura o cabo no peito e estica os braços à frente sem deixar o tronco girar.', 'Deixar o corpo girar junto. O trabalho é justamente não girar.'],
  prancha: ['Antebraços no chão, corpo reto, aperta o abdômen e o glúteo.', 'Deixar o quadril cair ou subir demais.'],
  hollow: ['Deitado, lombar colada no chão, levanta os ombros e as pernas esticadas.', 'Deixar a lombar desgrudar do chão. Dobra os joelhos até conseguir.'],
  'ab-roda': ['De joelhos, rola a roda pra frente com o abdômen travado e volta puxando com o abdômen.', 'Ir longe demais e deixar a lombar afundar.'],
  'giro-russo': ['Sentado, pés fora do chão, gira o tronco levando o peso de um lado pro outro.', 'Mexer só os braços. Quem gira é o tronco.'],
  'rotacao-externa': ['Cotovelo colado no corpo dobrado a 90 graus, gira o antebraço pra fora com elástico ou halter leve.', 'Descolar o cotovelo do corpo pra ajudar.'],
  'band-walk': ['Elástico acima do joelho, meio agachado, anda de lado sem deixar os joelhos se juntarem.', 'Ficar em pé demais e andar balançando o tronco.'],
  pescoco: ['Deitado ou em pé, empurra a cabeça contra a mão (frente, trás e lados) sem deixar a cabeça se mexer.', 'Começar com movimento e peso. No começo é só isometria, contra a própria mão.'],
  'extensao-lombar': ['No banco de lombar, desce o tronco e sobe até alinhar com as pernas.', 'Subir além da linha do corpo, arqueando a lombar.'],
  'mobilidade-quadril': ['Posição do 90/90: as duas pernas dobradas no chão, gira o quadril de um lado pro outro devagar.', 'Forçar a amplitude com dor. Mobilidade se ganha com frequência, não com força.'],
};

export function planoDoExercicio(e) {
  const p = PLANOS[TIPO_DO_PLANO[e.id]] || PLANOS.leve;
  const [como, erro] = DETALHE[e.id] || ['', ''];
  return { ...p, ondeEncaixa: ONDE_ENCAIXA[e.g] || '', como, erro };
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
