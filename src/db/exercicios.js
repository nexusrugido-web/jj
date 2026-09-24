/* ============================================================
   EXERCÍCIOS

   Sem plano prescrito. O app não vai te dizer o que treinar,
   vai te dar onde anotar e mostrar o que cada exercício entrega
   pro seu jiu-jitsu, em uma frase honesta.

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
