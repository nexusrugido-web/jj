/* ============================================================
   OS NOMES DAS TÉCNICAS QUE MUDARAM

   Nome antigo → nome novo. A regra: o nome que se usa no tatame
   brasileiro vem primeiro ("Arco e flecha", "botinha", "tesoura
   voadora"); onde o tatame fala inglês, fica o inglês ("Single
   leg", "Short choke"). Nome que estava errado (o flower não é
   balão, o hip bump não é gancho) foi corrigido, e a mesma técnica
   com dois nomes virou uma só.

   O nome antigo continua valendo em dois lugares:
   - na técnica da biblioteca (campo "antigo" no seed): é dele que
     sai o uid, então as aulas do Estudo marcadas com essa técnica
     continuam ligadas;
   - na busca e na leitura de vídeo: quem escrever o nome velho
     ainda acha a técnica.

   No aparelho, a migração (renomearTecnicas, em db.js) troca o
   nome nos treinos, nos rolas e nas metas, uma vez só.
   ============================================================ */
export const RENOMEAR = {
  /* quedas */
  'Baiana (duplo)': 'Baiana (double leg)',
  'Solo (single leg)': 'Single leg',
  'Solo alto (high crotch)': 'High crotch (single leg alto)',
  'Solo com running the pipe': 'Single leg com running the pipe',
  'Arrastão (arm drag) em pé': 'Arm drag em pé (arrastão)',
  'Foot sweep de wrestling': 'Rasteira (foot sweep)',
  'Ogoshi': 'O goshi',
  'Oguruma': 'O guruma',
  'Uchi mata sukashi': 'Uchi mata sukashi (contra)',
  'Blast double': 'Baiana com blast',
  'Kani basami': 'Kani basami (tesoura voadora)',
  'Granby de pé (stand-up)': 'Levantada técnica',
  /* passagens */
  'Passagem de joelho na barriga (knee cut)': 'Passagem de joelho cortando (knee cut)',
  'Toureio com joelho cortando': 'Toreando para o knee cut',
  'Passagem folclore (over-under)': 'Passagem over-under',
  'Passagem por baixo (folfa)': 'Passagem por baixo (underpass)',
  'Passagem de joelho no meio (knee shield kill)': 'Passagem matando o knee shield',
  'Torreando com pegada de tornozelo': 'Toreando com pegada no tornozelo',
  'Passagem de joelho na barriga (transição)': 'Passagem direto pro joelho na barriga',
  'Passagem em toureio invertido': 'Toreando invertido',
  'Passagem de esmagamento de perna': 'Passagem leg smash',
  /* raspagens */
  'Raspagem de gancho (hip bump)': 'Raspagem de sentar (hip bump)',
  'Raspagem de sentar (sit-up sweep)': 'Raspagem de sentar (hip bump)',
  'Raspagem de balão (flower)': 'Raspagem de pêndulo (flower sweep)',
  'Raspagem de gravata (lumberjack)': 'Raspagem lumberjack',
  'Raspagem do velho (old school)': 'Old school (raspagem da meia-guarda)',
  'Raspagem de laço de calça': 'Raspagem com pegada na calça',
  'Raspagem da tomada de costa (arrastão)': 'Arm drag pras costas (da guarda sentada)',
  'Raspagem de gravata de braço (whizzer)': 'Raspagem de whizzer (overhook)',
  'Raspagem da De La Riva (berimbolo)': 'Berimbolo',
  /* estrangulamentos */
  'Mata-leão de mão única': 'Mata-leão de uma mão só',
  'Estrangulamento de laço (bow and arrow)': 'Arco e flecha (bow and arrow)',
  'Triângulo de braço': 'Katagatame (triângulo de braço)',
  'Katagatame, braço e cabeça': 'Katagatame (triângulo de braço)',
  'Head and arm da montada (super pressure)': 'Katagatame da montada',
  'Estrangulamento de braço da meia-guarda': 'Katagatame da meia-guarda',
  'Kata gatame de lapela': 'Katagatame de lapela',
  'Brabo choke': "Brabo (D'arce)",
  'Peruano (Peruvian necktie)': 'Gravata peruana (peruvian necktie)',
  'Japonês (Japanese necktie)': 'Gravata japonesa (japanese necktie)',
  'Norte-sul choke': 'Estrangulamento do norte-sul',
  'Estrangulamento de papel-cortante': 'Paper cutter',
  'Estrangulamento de baseball': 'Baseball choke (taco de beisebol)',
  'Estrangulamento de lapela nas costas (bulldog)': 'Bulldog choke',
  'Estrangulamento de calção (short choke)': 'Short choke',
  'Estrangulamento em pé (standing guillotine)': 'Guilhotina em pé',
  'Estrangulamento de dez dedos (guilhotina)': 'Guilhotina de dez dedos',
  'Marceline': 'Marcelotine',
  'Estrangulamento de lapela sentado (worm)': 'Estrangulamento da worm guard',
  'Estrangulamento de trás com body triangle': 'Mata-leão com body triangle',
  /* articulares e pernas */
  'Chave de braço, armlock': 'Chave de braço (armlock)',
  'Estica-braço do joelho na barriga': 'Chave de braço do joelho na barriga',
  'Chave de ombro do norte-sul': 'Kimura do norte-sul',
  'Chave de pé reta': 'Chave de pé reta (botinha)',
  'Chave de dedão do pé (toe hold)': 'Toe hold (chave de dedão)',
  'Heel hook interno': 'Heel hook interno (chave de calcanhar)',
  'Heel hook externo': 'Heel hook externo (chave de calcanhar)',
  'Estica-perna do 50/50': 'Leg drag da 50/50',
  'Estica-perna de tesoura (Estima lock)': 'Estima lock',
  /* escapadas, defesas, base e pegadas */
  'Defesa de solo (limp leg)': 'Defesa de single leg (limp leg)',
  'Fugir de quadril (shrimp)': 'Fuga de quadril (shrimp)',
  'Ponte (bridge / upa)': 'Ponte (upa)',
  'Pendulum de retenção': 'Pêndulo (retenção)',
  'Seat belt (cinto de segurança)': 'Pegada de cinto (seat belt)',
  'Cross face': 'Crossface',
  'Gola-manga (collar sleeve)': 'Guarda gola-manga',
};

/* o nome de hoje de uma técnica, pelo nome que estiver gravado */
export const nomeAtual = (nome) => RENOMEAR[nome] || nome;
