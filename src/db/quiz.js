import { hoje, addDias } from '../lib/utils';
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
  /* ---------- 24/09/2026: mais perguntas, e as difíceis (azul pra cima) ---------- */
  {
    id: 'r1',
    tema: 'competicao',
    faixa: ['branca', 'azul', 'roxa', 'marrom', 'preta'],
    q: 'Na IBJJF, quanto vale passar a guarda e estabilizar por cima?',
    ops: [
      { t: '2 pontos', ok: false, p: 'Dois é raspagem, queda e joelho na barriga. Passagem vale mais porque é mais difícil.' },
      { t: '4 pontos', ok: false, p: 'Quatro é montada e pegada nas costas.' },
      { t: '3 pontos', ok: true, p: 'Passar a guarda vale 3, desde que você estabilize a posição por três segundos.' },
      { t: 'Vantagem', ok: false, p: 'Vantagem é quando quase chega numa posição de ponto e não estabiliza.' },
    ],
  },
  {
    id: 'r2',
    tema: 'competicao',
    faixa: ['branca', 'azul', 'roxa', 'marrom', 'preta'],
    q: 'Por quanto tempo você precisa segurar uma posição pra ela valer ponto na IBJJF?',
    ops: [
      { t: 'Três segundos', ok: true, p: 'É a regra: chegou e controlou por três segundos, o árbitro dá os pontos.' },
      { t: 'Um segundo', ok: false, p: 'Um segundo é passagem de relance. Não estabilizou, no máximo vira vantagem.' },
      { t: 'Cinco segundos', ok: false, p: 'Cinco é mais do que a regra pede. Quem espera cinco às vezes perde a posição antes.' },
      { t: 'Até o árbitro levantar a mão', ok: false, p: 'O árbitro sinaliza depois dos três segundos. A regra é o tempo, não o gesto.' },
    ],
  },
  {
    id: 'r3',
    tema: 'competicao',
    faixa: ['azul', 'roxa', 'marrom', 'preta'],
    q: 'O que faz a pegada nas costas valer os 4 pontos na IBJJF?',
    ops: [
      { t: 'Um gancho dentro e o cinto de segurança fechado', ok: false, p: 'Com um gancho só é controle, mas não é a posição que a regra pontua.' },
      { t: 'Estar atrás dele segurando a gola', ok: false, p: 'Pegar a gola por trás ajuda o estrangulamento, mas sem os ganchos não vale os pontos.' },
      { t: 'Ele estar de quatro com você por cima', ok: false, p: 'Isso é a tartaruga. Ainda falta colocar os ganchos.' },
      { t: 'Os dois ganchos dentro das coxas dele, com o peito colado nas costas', ok: true, p: 'Dois ganchos por dentro, estabilizados por três segundos: aí são 4 pontos.' },
    ],
  },
  {
    id: 'n1',
    tema: 'finalizacao',
    faixa: ['branca', 'azul'],
    q: 'No armlock da guarda, pra onde deve apontar o polegar dele na hora de estender o braço?',
    ops: [
      { t: 'Pra baixo, pro tatame', ok: false, p: 'Com o polegar pra baixo o cotovelo gira pro lado e ele escapa girando o braço.' },
      { t: 'Pra cima, pro teto, com o cotovelo alinhado no seu quadril', ok: true, p: 'Polegar pro teto deixa a articulação do cotovelo contra o seu quadril. É daí que vem a alavanca.' },
      { t: 'Tanto faz, o que importa é a força das pernas', ok: false, p: 'Sem alinhar o braço, a força das pernas só cansa você. A técnica está no alinhamento.' },
      { t: 'Pra dentro, na direção da cabeça dele', ok: false, p: 'Apontando pra dentro, o cotovelo sai da linha do seu quadril e a chave some.' },
    ],
  },
  {
    id: 'n2',
    tema: 'finalizacao',
    faixa: ['branca', 'azul'],
    q: 'Qual a diferença entre a americana e a kimura?',
    ops: [
      { t: 'São a mesma chave com nomes diferentes', ok: false, p: 'As duas são chave de ombro com os braços trançados, mas giram pra lados opostos.' },
      { t: 'A americana é no cotovelo e a kimura no punho', ok: false, p: 'As duas atacam o ombro. O punho é só onde você segura.' },
      { t: 'Na americana o braço dele gira pra cima, perto da cabeça; na kimura gira pra trás, pras costas', ok: true, p: 'É o sentido do giro que muda. Saber isso te diz qual encaixa quando ele esconde o braço de um jeito ou de outro.' },
      { t: 'A kimura só funciona de pé', ok: false, p: 'A kimura sai da guarda, dos 100kg, da meia-guarda e até de pé. É uma das mais versáteis.' },
    ],
  },
  {
    id: 'n3',
    tema: 'queda',
    faixa: ['branca', 'azul'],
    q: 'Na baiana (double leg), o que precisa acontecer logo antes de entrar?',
    ops: [
      { t: 'Baixar o nível, dobrando os joelhos, e não a coluna', ok: true, p: 'Quem desce curvando as costas chega sem força e toma guilhotina. Desce com as pernas, costas retas.' },
      { t: 'Puxar a gola dele pra baixo', ok: false, p: 'Puxar a gola deixa ele de pé e alerta. A baiana entra por baixo das mãos dele.' },
      { t: 'Esperar ele dar um passo pra trás', ok: false, p: 'O melhor momento é quando ele vem pra frente, não quando se afasta.' },
      { t: 'Fechar os olhos e ir com tudo', ok: false, p: 'Sem ver o quadril dele, você erra o alvo e cai no sprawl.' },
    ],
  },
  {
    id: 'n4',
    tema: 'defesa',
    faixa: ['branca', 'azul'],
    q: 'Você está embaixo da montada. Qual é a fuga mais clássica usando a ponte?',
    ops: [
      { t: 'Empurrar o peito dele com os braços esticados', ok: false, p: 'Braço esticado embaixo da montada é convite pro armlock.' },
      { t: 'Virar de bruços pra fugir', ok: false, p: 'Virar entrega as costas, que é pior que a montada.' },
      { t: 'Esperar ele cansar', ok: false, p: 'Embaixo da montada quem cansa é você.' },
      { t: 'Prender o braço e a perna do mesmo lado e fazer a ponte pra esse lado (upa)', ok: true, p: 'Prendendo braço e perna do mesmo lado, ele não tem como apoiar e rola por cima do seu ombro.' },
    ],
  },
  {
    id: 'n5',
    tema: 'guarda',
    faixa: ['branca', 'azul'],
    q: 'Na guarda fechada por baixo, qual é o primeiro trabalho antes de atacar?',
    ops: [
      { t: 'Abrir a guarda pra ter mais movimento', ok: false, p: 'Abrir sem motivo dá a passagem de graça.' },
      { t: 'Quebrar a postura dele, puxando com as pernas e as pegadas', ok: true, p: 'Com ele ereto, nada entra. Com a postura quebrada, triângulo, armlock e raspagem aparecem.' },
      { t: 'Segurar a faixa dele e ficar parado', ok: false, p: 'Segurar não é atacar. Ele se ajeita e começa a abrir sua guarda.' },
      { t: 'Atacar o pé dele', ok: false, p: 'O pé está longe e você está de costas no chão. Primeiro é trazer ele pra perto.' },
    ],
  },
  {
    id: 'n6',
    tema: 'passagem',
    faixa: ['branca', 'azul'],
    q: 'Dentro da guarda fechada dele, o que vem primeiro pra passar?',
    ops: [
      { t: 'Ficar em pé na hora', ok: false, p: 'Levantar sem postura e sem controle das mãos dele é levar raspagem.' },
      { t: 'Tentar abrir a guarda com as mãos nas coxas dele', ok: false, p: 'Mão na coxa sem postura vira armlock ou triângulo.' },
      { t: 'Postura ereta e controle das mãos dele, antes de pensar em abrir', ok: true, p: 'Postura tira o ataque dele. Só depois disso abrir a guarda é seguro.' },
      { t: 'Deitar em cima dele pra ele não se mexer', ok: false, p: 'Deitado, ele controla sua cabeça e você fica parado dentro do jogo dele.' },
    ],
  },
  {
    id: 'n7',
    tema: 'logica',
    faixa: ['branca', 'azul'],
    q: 'O que quer dizer "posição antes de finalização"?',
    ops: [
      { t: 'Que finalizar não importa', ok: false, p: 'Importa, e muito. A questão é a ordem.' },
      { t: 'Que só dá pra finalizar de uma posição de ponto', ok: false, p: 'Dá pra finalizar de qualquer lugar. Só é mais arriscado quando você não controla.' },
      { t: 'Que é melhor ficar parado na posição pra ganhar nos pontos', ok: false, p: 'Não é sobre travar a luta. É sobre ter controle antes de arriscar.' },
      { t: 'Controlar a posição antes de atacar, porque ataque sem controle dá a chance de ele escapar e virar', ok: true, p: 'Se a finalização falhar com você controlando, você continua por cima. Sem controle, o erro vira raspagem.' },
    ],
  },
  {
    id: 'n8',
    tema: 'defesa',
    faixa: ['branca', 'azul'],
    q: 'Pra que serve o enquadramento (frame)?',
    ops: [
      { t: 'Criar distância usando a estrutura dos ossos, e não a força do braço', ok: true, p: 'Osso alinhado aguenta o peso dele sem gastar gás. Aí o quadril usa o espaço que o frame abriu.' },
      { t: 'Empurrar ele pra longe', ok: false, p: 'Frame não empurra. Ele segura a distância enquanto o seu quadril se mexe.' },
      { t: 'Bloquear a finalização no último segundo', ok: false, p: 'O frame trabalha antes, pra ele nem chegar na finalização.' },
      { t: 'Só serve pra quem é mais forte', ok: false, p: 'É o contrário: é o recurso de quem é mais leve e mais fraco.' },
    ],
  },
  {
    id: 'h1',
    tema: 'finalizacao',
    faixa: ['azul', 'roxa', 'marrom', 'preta'],
    q: 'O triângulo encaixou, mas não aperta. O ajuste que mais resolve é:',
    ops: [
      { t: 'Apertar mais os joelhos com força', ok: false, p: 'Força sem ângulo cansa suas pernas e ele respira. O aperto vem da geometria.' },
      { t: 'Girar o quadril pra ficar perpendicular a ele e puxar a cabeça pra baixo', ok: true, p: 'Com o ângulo, a coxa fecha na carótida e o braço dele deixa de fazer espaço.' },
      { t: 'Soltar o braço dele pra dentro', ok: false, p: 'Com os dois braços pra dentro vira só uma chave de pernas no pescoço, e ele se defende com os ombros.' },
      { t: 'Desfazer e tentar o armlock', ok: false, p: 'O armlock pode ser a transição boa, mas só se ele defender o triângulo. Antes, ajuste o ângulo.' },
    ],
  },
  {
    id: 'h2',
    tema: 'guarda',
    faixa: ['azul', 'roxa', 'marrom', 'preta'],
    q: 'Na meia-guarda por baixo, o que mais impede que ele passe?',
    ops: [
      { t: 'Ficar de costas no chão e segurar a cabeça dele', ok: false, p: 'De costas no chão, ele pega o crossface e esmaga. É a meia-guarda que perde.' },
      { t: 'Soltar a perna dele pra recomeçar', ok: false, p: 'Soltar dá a passagem de graça.' },
      { t: 'Ganhar o underhook e ficar de lado, com o ombro por baixo dele', ok: true, p: 'De lado, com o braço por baixo do sovaco dele, é você que ameaça ir pras costas ou raspar.' },
      { t: 'Cruzar os pés e apertar a perna dele', ok: false, p: 'Apertar a perna segura um pouco, mas sem underhook ele trabalha o crossface com calma.' },
    ],
  },
  {
    id: 'h3',
    tema: 'passagem',
    faixa: ['azul', 'roxa', 'marrom', 'preta'],
    q: 'Passando a guarda aberta, o que controlar primeiro pra neutralizar os ganchos dele?',
    ops: [
      { t: 'A gola dele', ok: false, p: 'Controlando a gola, os pés dele continuam livres no seu quadril.' },
      { t: 'A faixa dele', ok: false, p: 'Faixa é boa por cima, depois de passar. Antes, os pés e os joelhos dele mandam.' },
      { t: 'Os pés e os joelhos dele, tirando as pernas da frente do seu quadril', ok: true, p: 'A guarda aberta é feita de ganchos. Controlou as pernas, sobra passar.' },
      { t: 'As mãos dele, sempre as duas', ok: false, p: 'Mão importa na guarda fechada. Na aberta, o perigo são as pernas.' },
    ],
  },
  {
    id: 'h4',
    tema: 'raspagem',
    faixa: ['azul', 'roxa', 'marrom', 'preta'],
    q: 'Por que a raspagem funciona melhor quando ele está com o peso pra frente?',
    ops: [
      { t: 'Não faz diferença, raspagem é força', ok: false, p: 'Raspagem é timing e alavanca. Força sozinha raspa quem é mais leve, e só.' },
      { t: 'Porque ele fica mais cansado', ok: false, p: 'Cansaço ajuda, mas o motivo é mecânico: o apoio dele.' },
      { t: 'Porque é ilegal raspar quem está parado', ok: false, p: 'Não existe essa regra.' },
      { t: 'Porque sem base atrás ele não consegue apoiar pra onde você empurra', ok: true, p: 'Raspar é tirar o apoio do lado pra onde ele vai cair. Peso pra frente deixa esse lado vazio.' },
    ],
  },
  {
    id: 'h5',
    tema: 'controle',
    faixa: ['azul', 'roxa', 'marrom', 'preta'],
    q: 'Nos 100kg, ele começa a colocar o joelho pra recuperar a guarda. A melhor resposta é:',
    ops: [
      { t: 'Trocar pra joelho na barriga ou montada antes do joelho dele chegar', ok: true, p: 'Posição é movimento: quando ele recupera espaço de um lado, você muda pro lado que ele deixou.' },
      { t: 'Empurrar o joelho dele de volta com a mão', ok: false, p: 'Brigar com o joelho gasta a mão e ele recupera do mesmo jeito.' },
      { t: 'Levantar e recomeçar a passagem', ok: false, p: 'Você já tinha passado. Recomeçar é jogar fora 3 pontos.' },
      { t: 'Ficar mais pesado e parado', ok: false, p: 'Peso sem ajuste dá tempo pro joelho dele entrar.' },
    ],
  },
  {
    id: 'h6',
    tema: 'finalizacao',
    faixa: ['azul', 'roxa', 'marrom', 'preta'],
    q: 'No estrangulamento cruzado pela gola, o que realmente fecha a carótida?',
    ops: [
      { t: 'Puxar a gola com força pra você', ok: false, p: 'Puxar só aproxima. Ele aguenta enquanto as lâminas das mãos não entram.' },
      { t: 'A mão dentro o mais funda possível e os punhos girando, com os cotovelos abrindo', ok: true, p: 'Pegada funda põe o punho no pescoço, e o giro com os cotovelos pra fora corta as duas carótidas.' },
      { t: 'Apertar a traqueia com os polegares', ok: false, p: 'Traqueia dói e ele resiste. A carótida desliga em segundos, sem briga.' },
      { t: 'Levantar o corpo dele do chão', ok: false, p: 'Levantar gasta força e abre espaço pra ele girar.' },
    ],
  },
  {
    id: 'h7',
    tema: 'logica',
    faixa: ['roxa', 'marrom', 'preta'],
    q: 'O que é um jogo "de sistema", e por que ele vale mais que colecionar técnicas?',
    ops: [
      { t: 'É saber muitas técnicas de cada posição', ok: false, p: 'Quantidade sem ligação vira escolha demais na hora errada.' },
      { t: 'É ter uma técnica favorita e insistir nela', ok: false, p: 'Insistir numa só fica previsível contra quem já conhece.' },
      { t: 'É encadear técnicas em que a defesa de uma abre a próxima', ok: true, p: 'No sistema, ele sempre escolhe entre dois problemas. Cada defesa te leva pro próximo ataque.' },
      { t: 'É lutar só por pontos', ok: false, p: 'Sistema serve pra ponto e pra finalização. É sobre ligação, não sobre placar.' },
    ],
  },
  {
    id: 'h8',
    tema: 'fisico',
    faixa: ['azul', 'roxa', 'marrom', 'preta'],
    q: 'Rolando com alguém bem mais pesado, qual é a estratégia mais inteligente?',
    ops: [
      { t: 'Evitar ficar embaixo, parado, sob a pressão dele: trabalhar de lado e com ângulo', ok: true, p: 'Peso é vantagem quando cai em cima. De lado, com ângulo, o peso dele passa a trabalhar contra ele.' },
      { t: 'Puxar pra guarda fechada e esperar', ok: false, p: 'Esperar embaixo do pesado é deixar ele descansar em cima de você.' },
      { t: 'Ir pra força logo no começo, enquanto está com gás', ok: false, p: 'Contra quem é mais forte, a força é justamente onde você perde.' },
      { t: 'Deixar ele montar pra cansar', ok: false, p: 'Quem cansa embaixo da montada é você.' },
    ],
  },
  {
    id: 'h9',
    tema: 'competicao',
    faixa: ['azul', 'roxa', 'marrom', 'preta'],
    q: 'Empatado nos pontos e nas vantagens no fim da luta da IBJJF, o que decide?',
    ops: [
      { t: 'Quem pesou menos na balança', ok: false, p: 'Peso não decide luta empatada.' },
      { t: 'As punições: quem tomou menos ganha; se ainda empatar, decisão do árbitro', ok: true, p: 'A ordem é pontos, vantagens, punições e, por fim, a decisão do árbitro.' },
      { t: 'Uma prorrogação de dois minutos', ok: false, p: 'Na IBJJF adulto não tem prorrogação. Ela existe em outros regulamentos.' },
      { t: 'Quem finalizou mais vezes na chave', ok: false, p: 'Cada luta é decidida por ela mesma.' },
    ],
  },
];

/* intervalos do Leitner, em dias */
export const CAIXAS = [1, 3, 7, 14, 28];

/* sorteio: um número de 0 a 1. No grátis as perguntas vêm sorteadas da
   faixa, sem a revisão do que você errou, que é do premium. A mesma
   semente dá a mesma ordem, então a rodada não se embaralha no meio. */
/* ============================================================
   A ORDEM DAS ALTERNATIVAS

   As perguntas foram escritas com a certa quase sempre em segundo,
   e o aluno aprendia a posição, não o jiu-jitsu. Aqui elas saem
   embaralhadas pela pergunta e pelo dia: mudam de um dia pro outro,
   mas ficam paradas enquanto a pessoa responde.
   ============================================================ */
function numeroDe(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619) >>> 0;
  return h || 1;
}

export function embaralharOpcoes(p, dia = hoje()) {
  let s = numeroDe(`${p.id}:${dia}`);
  const proximo = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 2 ** 32; };
  return { ...p, ops: p.ops.map((o) => [proximo(), o]).sort((a, b) => a[0] - b[0]).map(([, o]) => o) };
}

export function perguntasPara({ faixa = 'branca', dor = null, tema = null, limite = 5, respondidas = [], sorteio = null }) {
  const agora = hoje();
  const porId = new Map(respondidas.map((r) => [r.perguntaId, r]));

  let lista = PERGUNTAS.filter((p) => !p.faixa || p.faixa.includes(faixa));
  if (dor) lista = lista.filter((p) => p.dor === dor);
  if (tema) lista = lista.filter((p) => p.tema === tema);

  if (sorteio !== null) {
    let s = Math.floor(sorteio * 2 ** 32) || 1;
    const proximo = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 2 ** 32; };
    return lista.map((p) => [proximo(), p]).sort((a, b) => a[0] - b[0]).map(([, p]) => embaralharOpcoes(p, agora)).slice(0, limite);
  }

  /* quem nunca viu vem primeiro, depois o que está vencido na revisão */
  const novas = lista.filter((p) => !porId.has(p.id));
  const vencidas = lista.filter((p) => {
    const r = porId.get(p.id);
    return r && (!r.proxima || r.proxima <= agora);
  });

  return [...novas, ...vencidas].slice(0, limite).map((p) => embaralharOpcoes(p, agora));
}

export function proximaRevisao(caixa, acertou) {
  const nova = acertou ? Math.min(CAIXAS.length - 1, (caixa ?? 0) + 1) : 0;
  return { caixa: nova, proxima: addDias(hoje(), CAIXAS[nova]) };
}
