/* ============================================================
   QUIZ CONCEITUAL

   As perguntas nasceram do que os alunos escreveram na pesquisa.
   38% disseram que o que falta na academia é entender o porquê,
   então nenhuma pergunta aqui é de decoreba. Todas apresentam
   uma situação e pedem o princípio.

   Cada alternativa errada é um erro comum de verdade, e a
   explicação ensina o motivo, não só a resposta.
   ============================================================ */

export const PERGUNTAS = [
  /* ---------- defesa e sair de posição ruim ---------- */
  {
    id: 'd1',
    tema: 'defesa',
    faixa: ['branca', 'azul'],
    dor: 'apanhar',
    q: 'Você está embaixo dos 100kg e ele encosta o peito no seu esterno. O que fazer primeiro?',
    ops: [
      { t: 'Empurrar o peito dele com os dois braços', ok: false, p: 'Empurrar de baixo gasta o braço e o gás, e ele é mais forte nessa alavanca. É o erro que mais cansa faixa branca.' },
      { t: 'Criar enquadramento e mexer o quadril pra recuperar o ângulo', ok: true, p: 'Enquadramento devolve espaço sem força. O quadril é o que te tira de baixo, não o braço.' },
      { t: 'Virar de barriga pra baixo o mais rápido possível', ok: false, p: 'Virar entrega as costas, que valem 4 pontos e abrem o mata-leão. Só vale como último recurso.' },
      { t: 'Ficar parado esperando ele se mexer', ok: false, p: 'Esperar funciona por trinta segundos. Depois disso você só cansou e ele melhorou a pegada.' },
    ],
  },
  {
    id: 'd2',
    tema: 'defesa',
    faixa: ['branca'],
    dor: 'apanhar',
    q: 'Ele está montado em você. Qual a ordem certa de prioridade?',
    ops: [
      { t: 'Tentar a ponte imediatamente com toda a força', ok: false, p: 'Ponte sem bloquear o braço dele só te vira de novo. Ele apoia a mão no tatame e você gastou tudo.' },
      { t: 'Proteger o pescoço, colar os cotovelos, e só então buscar a ponte ou a fuga de quadril', ok: true, p: 'Sobreviver vem antes de sair. Pescoço e cotovelos primeiro, movimento depois. É essa ordem que muda o jogo no primeiro ano.' },
      { t: 'Empurrar o joelho dele pra baixo com as duas mãos', ok: false, p: 'Isso solta os cotovelos e abre a chave de braço. Você troca um problema por outro pior.' },
      { t: 'Girar pra qualquer lado até algo acontecer', ok: false, p: 'Girar sem bloquear o lado que você quer fugir só ajuda ele a estabilizar.' },
    ],
  },

  /* ---------- o gás, a segunda maior dor ---------- */
  {
    id: 'g1',
    tema: 'fisico',
    faixa: ['branca', 'azul'],
    dor: 'gas',
    q: 'Você cansa nos primeiros três minutos do rola. Qual é a causa mais provável?',
    ops: [
      { t: 'Falta de preparo físico, precisa correr mais', ok: false, p: 'Quase nunca é isso. Gente que corre maratona também cansa no rola quando está começando.' },
      { t: 'Você está usando força onde dava pra usar posição, e provavelmente prendendo a respiração', ok: true, p: 'O gás no jiu-jitsu é técnico antes de ser físico. Pegada tensa o tempo todo e apneia na hora do aperto derrubam qualquer condicionamento.' },
      { t: 'Está rolando com gente muito melhor', ok: false, p: 'Ajuda a cansar, mas não é a causa. Faixa preta rola com faixa preta e não fica sem ar.' },
      { t: 'Precisa comer mais antes do treino', ok: false, p: 'Alimentação importa, mas não explica cansar em três minutos.' },
    ],
  },
  {
    id: 'g2',
    tema: 'fisico',
    faixa: ['branca', 'azul'],
    dor: 'gas',
    q: 'Qual momento do rola mais desperdiça o seu fôlego?',
    ops: [
      { t: 'A hora de tentar a finalização', ok: false, p: 'Finalização é rápida. Não é ela que te esvazia.' },
      { t: 'Segurar pegada com força máxima o tempo todo, mesmo quando nada está acontecendo', ok: true, p: 'A mão fechada com toda a força é o maior ralo de gás que existe. Pegada tem que ter momento de aperto e momento de descanso.' },
      { t: 'Fazer a ponte', ok: false, p: 'Ponte é explosiva e curta. Custa, mas não é o principal.' },
      { t: 'Levantar da posição entre um rola e outro', ok: false, p: 'Isso é recuperação, não gasto.' },
    ],
  },

  /* ---------- travar no rola ---------- */
  {
    id: 't1',
    tema: 'logica',
    faixa: ['branca', 'azul'],
    dor: 'travar',
    q: 'Você trava no rola e não sabe o que fazer. Qual pergunta te destrava mais rápido?',
    ops: [
      { t: '"Qual técnica eu aprendi essa semana?"', ok: false, p: 'Procurar a técnica na memória é o que causa o branco. A técnica aparece sozinha quando a posição está clara.' },
      { t: '"Estou por cima ou por baixo, e qual é o meu próximo degrau daqui?"', ok: true, p: 'Posição primeiro, técnica depois. Saber se você está subindo ou sobrevivendo já responde metade do que fazer.' },
      { t: '"O que ele vai fazer agora?"', ok: false, p: 'Ler o outro é faixa roxa pra cima. No começo, ler a própria posição já resolve.' },
      { t: '"Como eu finalizo esse cara?"', ok: false, p: 'Pensar em finalização de uma posição ruim é o atalho pra apanhar mais.' },
    ],
  },
  {
    id: 't2',
    tema: 'logica',
    faixa: ['branca', 'azul', 'roxa'],
    dor: 'porque',
    q: 'Por que a passagem de guarda vale 3 pontos e a raspagem vale 2?',
    ops: [
      { t: 'Porque a passagem é mais difícil de executar', ok: false, p: 'Dificuldade não é o critério. Tem raspagem muito mais difícil que passagem.' },
      { t: 'Porque a pontuação segue a hierarquia de controle: quanto mais dominante a posição conquistada, mais ela vale', ok: true, p: 'A tabela inteira é uma escada de controle. Raspagem te tira de baixo, passagem te coloca em cima estabilizado, montada e costas valem 4 porque são as melhores posições pra finalizar.' },
      { t: 'Porque foi decidido assim historicamente, sem critério', ok: false, p: 'Tem critério, e entender ele faz você jogar melhor mesmo sem competir.' },
      { t: 'Porque a passagem gasta mais energia', ok: false, p: 'Energia não entra na conta da regra.' },
    ],
  },

  /* ---------- guarda ---------- */
  {
    id: 'gu1',
    tema: 'guarda',
    faixa: ['branca'],
    dor: 'guarda',
    q: 'Sua guarda fechada abre toda hora. Qual é o problema mais provável?',
    ops: [
      { t: 'Falta de força nas pernas', ok: false, p: 'Guarda fechada não se segura com força de perna. Se fosse assim, ninguém leve teria guarda.' },
      { t: 'Você está deixando ele levantar a postura e enfiar o joelho no meio', ok: true, p: 'Guarda fechada se mantém quebrando a postura dele. Postura ereta abre qualquer guarda, por mais apertada que seja a perna.' },
      { t: 'Suas pernas são curtas demais', ok: false, p: 'Atrapalha, mas não é a causa. O que abre guarda é postura, não antropometria.' },
      { t: 'Você precisa cruzar os tornozelos mais forte', ok: false, p: 'Cruzar mais forte só cansa. E pode virar chave de pé contra você em alguns cenários.' },
    ],
  },
  {
    id: 'gu2',
    tema: 'guarda',
    faixa: ['azul', 'roxa'],
    dor: 'guarda',
    q: 'Qual é a função principal de uma pegada na guarda aberta?',
    ops: [
      { t: 'Puxar ele pra perto de você', ok: false, p: 'Às vezes sim, às vezes o oposto. Puxar não é a função, é uma das consequências.' },
      { t: 'Controlar a distância e a direção em que ele pode se mover', ok: true, p: 'Pegada é direção. Ela não segura o cara, ela limita pra onde ele pode ir, e é isso que cria o tempo da raspagem.' },
      { t: 'Cansar o braço dele', ok: false, p: 'Efeito colateral, não objetivo. Quem joga pra cansar geralmente cansa primeiro.' },
      { t: 'Impedir que ele levante', ok: false, p: 'Guarda aberta convive com ele em pé. Impedir de levantar é outro jogo.' },
    ],
  },

  /* ---------- passagem ---------- */
  {
    id: 'p1',
    tema: 'passagem',
    faixa: ['branca', 'azul'],
    dor: 'passar',
    q: 'Você passa a guarda mas ele recompõe antes de você estabilizar. O que está faltando?',
    ops: [
      { t: 'Passar mais rápido', ok: false, p: 'Velocidade sem controle passa e volta. O problema não é a passagem, é o que vem depois dela.' },
      { t: 'Matar a perna de baixo e fixar a cabeça e o quadril antes de comemorar a passagem', ok: true, p: 'Passagem só conta quando estabiliza 3 segundos. Se a perna dele ainda tem espaço pra voltar, você não passou, você visitou.' },
      { t: 'Usar mais força no ombro', ok: false, p: 'Força no ombro sem controlar o quadril dele só te deixa cansado em cima.' },
      { t: 'Tentar finalizar imediatamente', ok: false, p: 'Atacar antes de estabilizar é o jeito mais comum de perder a posição que você acabou de ganhar.' },
    ],
  },

  /* ---------- memorização ---------- */
  {
    id: 'm1',
    tema: 'drill',
    faixa: ['branca', 'azul'],
    dor: 'esquecer',
    q: 'Você aprende a técnica na aula e não consegue usar no rola. Por quê?',
    ops: [
      { t: 'Precisa decorar melhor os passos', ok: false, p: 'Decorar passo funciona no drill e falha no rola, porque o rola não avisa qual passo é a hora.' },
      { t: 'Você aprendeu o movimento mas não o momento em que ele aparece', ok: true, p: 'Técnica sem gatilho não sai. O que falta é reconhecer a situação que pede aquela técnica, e isso só vem de posicional com resistência.' },
      { t: 'A técnica é avançada demais pra sua faixa', ok: false, p: 'Às vezes, mas o problema aparece igual com técnica básica.' },
      { t: 'Precisa repetir mais vezes no drill', ok: false, p: 'Mais drill melhora a execução, não o reconhecimento. Os dois são treinos diferentes.' },
    ],
  },

  /* ---------- finalização ---------- */
  {
    id: 'f1',
    tema: 'finalizacao',
    faixa: ['branca', 'azul'],
    q: 'Sua chave de braço escapa na hora de estender. O detalhe que mais costuma faltar é:',
    ops: [
      { t: 'Puxar o braço com mais força', ok: false, p: 'Puxar mais forte contra o bíceps dele é uma briga que você perde. A chave não é de força.' },
      { t: 'Controlar o polegar apontando pra cima e colar o joelho pra fechar o espaço', ok: true, p: 'A chave de braço vive do alinhamento do cotovelo e da ausência de espaço. Polegar pra cima alinha, joelho colado tira o espaço de girar.' },
      { t: 'Sentar mais rápido', ok: false, p: 'Velocidade sem controle só entrega a posição.' },
      { t: 'Jogar as duas pernas pra cima ao mesmo tempo', ok: false, p: 'Soltar as duas pernas juntas abre espaço pra ele sair pela cabeça.' },
    ],
  },

  /* ---------- corpo, idade e lesão ---------- */
  {
    id: 'c1',
    tema: 'fisico',
    faixa: ['branca', 'azul', 'roxa', 'marrom', 'preta'],
    dor: 'corpo',
    q: 'Você treina com mais de 35 anos e sente o corpo cobrar. Qual ajuste rende mais?',
    ops: [
      { t: 'Treinar menos vezes por semana', ok: false, p: 'Frequência é o que mais faz evoluir. Cortar frequência é o último recurso, não o primeiro.' },
      { t: 'Escolher melhor com quem rola e usar posicional em vez de rola livre em parte do treino', ok: true, p: 'A carga vem mais de quem está do outro lado e do tipo de rola do que da quantidade. Posicional dá o mesmo aprendizado com menos desgaste.' },
      { t: 'Usar mais força pra compensar a idade', ok: false, p: 'É o caminho direto pra lesão. Idade pede mais técnica, não mais força.' },
      { t: 'Só treinar drill e evitar rola', ok: false, p: 'Sem resistência a técnica não amadurece. O ajuste é na dose, não na eliminação.' },
    ],
  },

  /* ---------- em pé ---------- */
  {
    id: 'q1',
    tema: 'queda',
    faixa: ['branca', 'azul'],
    q: 'Qual é a condição pra qualquer queda funcionar?',
    ops: [
      { t: 'Ser mais forte que o outro', ok: false, p: 'Judoca leve derruba pesado o tempo todo. Não é força.' },
      { t: 'Tirar o equilíbrio dele antes de entrar', ok: true, p: 'Sem desequilíbrio não existe queda, existe empurrão. O kuzushi é a queda, o resto é só o acabamento.' },
      { t: 'Entrar muito rápido', ok: false, p: 'Rápido contra alguém equilibrado é rápido pra lugar nenhum.' },
      { t: 'Pegar a pegada certa', ok: false, p: 'Pegada ajuda a desequilibrar, mas sozinha não derruba ninguém.' },
    ],
  },
];

/* intervalos do Leitner, em dias */
export const CAIXAS = [1, 3, 7, 14, 28];

export function perguntasPara({ faixa = 'branca', dor = null, tema = null, limite = 5, respondidas = [] }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const porId = new Map(respondidas.map((r) => [r.perguntaId, r]));

  let lista = PERGUNTAS.filter((p) => !p.faixa || p.faixa.includes(faixa));
  if (dor) lista = lista.filter((p) => p.dor === dor);
  if (tema) lista = lista.filter((p) => p.tema === tema);

  /* quem nunca viu vem primeiro, depois o que está vencido na revisão */
  const novas = lista.filter((p) => !porId.has(p.id));
  const vencidas = lista.filter((p) => {
    const r = porId.get(p.id);
    return r && (!r.proxima || r.proxima <= hoje);
  });

  return [...novas, ...vencidas].slice(0, limite);
}

export function proximaRevisao(caixa, acertou) {
  const nova = acertou ? Math.min(CAIXAS.length - 1, (caixa ?? 0) + 1) : 0;
  const d = new Date();
  d.setDate(d.getDate() + CAIXAS[nova]);
  return { caixa: nova, proxima: d.toISOString().slice(0, 10) };
}
