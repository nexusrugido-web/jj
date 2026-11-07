import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   A ESTEIRA NÃO PODE CONFIAR NA IA DE OLHO FECHADO

   Cada caso aqui é um jeito de a IA errar sem avisar: inventar
   id, jurar certeza sobre título que não diz nada, discordar do
   que alguém etiquetou na mão, apagar o tema que já existia.
   ============================================================ */

const C = await import('../src/lib/classificar.js');
const { SEED } = await import('../src/db/seed.js');
const { uidEstavel, chaveNome } = await import('../src/lib/uid.js');
const { categorizar } = await import('../src/lib/categorizar.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

const catalogo = SEED.techniques.map((t) => ({ uid: uidEstavel(chaveNome('techniques', t.pt)), nome: t.pt, en: t.en }));
const indice = C.indiceDeTecnicas(catalogo);
const nomeDe = new Map(catalogo.map((t) => [t.uid, t.nome]));
const nomes = (lista) => C.acharTecnicas(lista, indice).map((u) => nomeDe.get(u));

/* ---------- só passa o que existe ---------- */
const limpa = C.limparDaIa({
  posicoes: ['cem:baixo', 'cem:neutro', 'cem:lado_errado', 'escape_do_100kg', 'montada:baixo'],
  habilidades: ['escapada', 'voar', 'escapada'],
  situacoes: ['contra_pesado', 'preguica'],
  formato: 'palestra',
  nivel: 'intermediario',
  certeza: 3,
}, indice);
ok('posição inventada some, e o neutro da mesma posição com lado também', limpa.posicaoLado, ['cem:baixo', 'montada:baixo']);
ok('habilidade inventada some, repetida conta uma vez', limpa.habilidades, ['escapada']);
ok('situação inventada some', limpa.situacoes, ['contra_pesado']);
ok('formato inventado vira nada', limpa.formato, null);
ok('nível válido passa', limpa.nivel, 'intermediario');
ok('certeza acima de 1 vira 1', limpa.certeza, 1);
ok('sem certeza é zero, não 100%', C.limparDaIa({}, indice).certeza, 0);
ok('resposta vazia não quebra', C.limparDaIa(null, indice).habilidades, []);

/* ---------- o nome que a IA deu vira técnica da biblioteca ---------- */
ok('nome exato', nomes(['Kimura']), ['Kimura']);
ok('sem acento e minúsculo', nomes(['triangulo']), ['Triângulo']);
ok('sem o parêntese', nomes(['fuga de quadril']), ['Fuga de quadril (shrimp)']);
ok('pelo nome em inglês', nomes(['double leg']), ['Baiana (double leg)']);
ok('pelo que está no parêntese', nomes(['shrimp']).every((n) => /^Fug.* de quadril \(shrimp\)$/.test(n)), true);
ok('nome solto fica com a técnica mais geral', nomes(['armlock']), ['Armlock da guarda fechada']);
ok('nome que não existe some', nomes(['golpe secreto do mestre']), []);
ok('nome curto demais não arrisca', nomes(['arm']), []);
ok('a mesma técnica por dois nomes conta uma vez', nomes(['Kimura', 'kimura']), ['Kimura']);

/* ---------- a decisão ---------- */
const ia = (x) => C.limparDaIa({ certeza: 0.85, ...x }, indice);

const antigo = {
  titulo: 'Como se comportar embaixo da 100kg - DIA 18 TIRANDO DÚVIDAS DE FAIXA BRANCA',
  temas: ['logica', 'controle', 'competicao'], posicoes: ['cem_quilos'], faixa: 'branca',
  yt_descricao: 'x'.repeat(200),
};
const concorda = C.decidir(antigo, ia({ posicoes: ['cem:baixo'], habilidades: ['escapada', 'controle'], formato: 'conceito', nivel: 'fundamento', situacoes: ['contra_pesado'] }));
ok('IA concorda com o que já existia: automática', concorda.classificacao, 'automatica');
ok('sem motivo quando é automática', concorda.classificacao_motivo, null);
ok('o lado da IA substitui o neutro antigo', concorda.posicao_lado, ['cem:baixo']);
ok('o que a IA trouxe soma com o que existia', concorda.habilidades, ['escapada', 'controle']);
ok('tema que alguém etiquetou continua, o novo entra', concorda.temas, ['logica', 'controle', 'competicao', 'defesa']);
ok('a situação vem da IA', concorda.situacoes, ['contra_pesado']);

const briga = C.decidir(antigo, ia({ habilidades: ['queda'], formato: 'tecnica' }));
ok('IA discorda do que alguém etiquetou: revisar', briga.classificacao, 'revisar');
ok('o motivo diz a briga', briga.classificacao_motivo, 'estava em controle e a IA disse queda');
ok('na briga nada que existia se perde', briga.habilidades, ['queda', 'controle']);

const familia = C.decidir({ ...antigo, temas: ['finalizacao'] }, ia({ habilidades: ['estrangulamento'] }));
ok('estrangulamento concorda com finalização', familia.classificacao, 'automatica');

const outroLado = C.decidir(antigo, ia({ posicoes: ['cem:baixo'], habilidades: ['escapada'] }));
ok('"controle" antigo e "escapada" da IA são os dois lados do 100kg: automática', outroLado.classificacao, 'automatica');

const passarMeia = C.decidir({ ...antigo, temas: ['guarda'], posicoes: ['meia_guarda'] }, ia({ posicoes: ['meia_guarda:cima'], habilidades: ['passagem'] }));
ok('"guarda" antigo e "passagem" da IA: automática', passarMeia.classificacao, 'automatica');

const duvida = C.decidir(antigo, ia({ habilidades: ['controle'], certeza: 0.4, duvida: 'não sei se é por cima ou por baixo' }));
ok('IA em dúvida: revisar, com a dúvida dela', [duvida.classificacao, duvida.classificacao_motivo],
  ['revisar', 'a IA ficou em dúvida: não sei se é por cima ou por baixo']);

const nada = C.decidir(antigo, ia({}));
ok('IA não achou nada: revisar', nada.classificacao_motivo, 'a IA não achou o que o vídeo ensina');
ok('e o que existia continua', nada.temas, ['logica', 'controle', 'competicao']);

/* os vídeos que chegam novos, sem etiqueta de ninguém */
const data = C.decidir({ titulo: '31 de agosto de 2026', temas: ['geral'], posicoes: [], yt_descricao: '#bjj' },
  ia({ habilidades: ['passagem'], formato: 'tecnica', certeza: 0.7 }));
ok('título que é uma data e sem descrição: revisar, mesmo a IA achando que sabe', [data.classificacao, data.classificacao_motivo],
  ['revisar', 'título genérico e quase sem descrição']);
ok('e o "geral" dá lugar ao tema que a IA achou', data.temas, ['passagem']);

const semPalavra = C.decidir({ titulo: 'Quem faz jiu precisa fazer musculação? #bjj', temas: ['geral'], posicoes: [] },
  ia({ habilidades: ['fisico'], formato: 'conceito', certeza: 0.85 }));
ok('título sem palavra da lista, mas a IA bem segura: automática', semPalavra.classificacao, 'automatica');

const genericoComDescricao = C.decidir({ titulo: '31 de agosto de 2026', temas: ['geral'], yt_descricao: 'Neste vídeo eu mostro como passar a guarda aberta controlando o quadril antes de passar a perna, com os três detalhes que mais erram.' },
  ia({ posicoes: ['guarda_aberta:cima'], habilidades: ['passagem'], formato: 'tecnica' }));
ok('título genérico, mas a descrição explica: automática', genericoComDescricao.classificacao, 'automatica');

/* como o cadastro grava um vídeo novo: com as regras do título */
const peloTitulo = (titulo) => ({ titulo, ...categorizar(titulo) });

const novoBom = C.decidir(peloTitulo('Como sair da 100kg #bjj #jiujitsu'),
  ia({ posicoes: ['cem:baixo'], habilidades: ['escapada'], formato: 'tecnica' }));
ok('título que diz o que é: automática mesmo sem descrição', novoBom.classificacao, 'automatica');
ok('e ganha o lado que o título não dizia', novoBom.posicao_lado, ['cem:baixo']);

const novoBriga = C.decidir(peloTitulo('Como controlar a meia guarda #bjj'),
  ia({ habilidades: ['queda'], formato: 'tecnica' }));
ok('IA discorda das regras do título: revisar', novoBriga.classificacao, 'revisar');

const semLegado = C.decidir({ titulo: 'Aprenda isso e fique impossível de passar', temas: [], posicoes: [], yt_descricao: 'Neste vídeo eu mostro a retenção de guarda com os pés no quadril, pra quem está sempre sendo passado e amassado no rola.' },
  ia({ posicoes: ['guarda_aberta:baixo'], habilidades: ['retencao'], formato: 'tecnica' }));
ok('vídeo novo sem etiqueta, descrição clara: automática', semLegado.classificacao, 'automatica');
ok('e ganha tema e posição pro Estudo', [semLegado.temas, semLegado.posicoes], [['guarda'], ['guarda_aberta']]);

/* ---------- o título fala de uma técnica e a IA marcou outra ---------- */
const uidDe = (pt) => uidEstavel(chaveNome('techniques', pt));
const tituloAmericana = 'Jiu-Jitsu Americana: Técnica Incrível Passo a Passo!';
const comTecnica = (titulo, tecnicas) => C.decidir(peloTitulo(titulo),
  ia({ posicoes: ['cem:cima'], habilidades: ['articular'], formato: 'tecnica', tecnicas: tecnicas.map((t) => nomeDe.get(uidDe(t))) }), { indice });
const trocada = comTecnica(tituloAmericana, ['Triângulo']);
ok('título de Americana marcado como Triângulo: revisar', trocada.classificacao, 'revisar');
ok('e diz por quê', trocada.classificacao_motivo, 'o título fala de americana e a técnica marcada é outra');
ok('marcado como Americana: sem conflito', comTecnica(tituloAmericana, ['Americana']).classificacao_motivo, null);
ok('sem técnica marcada: sem conflito', comTecnica(tituloAmericana, []).classificacao_motivo, null);
ok('grafia do título diferente do nome da técnica: sem conflito',
  comTecnica('Armlock da guarda fechada', ['Chave de braço, armlock']).classificacao_motivo, null);

/* ============================================================
   E1: GABARITO COM AS AULAS REAIS (relatório 2026-11-07-pertinencia-estudo)

   O catálogo de verdade, e o que a esteira faz com o nome que a IA
   manda: só nome inteiro grava técnica, aula de defesa grava a defesa.
   Cada linha: id, título, o que a IA manda (como o prompt pede: o nome
   citado no título), habilidades e o que tem que ficar gravado. As 10
   vagas ficam de fora: o título não deixa conferir.
   ============================================================ */
{
  const { INDICE_TECNICAS, TECNICA_POR_UID } = await import('../src/lib/tecnicas.js');
  const { defesaNoLugarDoGolpe } = await import('../src/lib/assuntos.js');
  const grava = (titulo, tecnicas, habilidades = []) => {
    const ia = C.limparDaIa({ tecnicas, habilidades }, INDICE_TECNICAS);
    const uids = C.aulaDeDefender(titulo, ia.habilidades) ? defesaNoLugarDoGolpe(ia.tecnicas) : ia.tecnicas;
    return uids.map((u) => TECNICA_POR_UID.get(u).nome);
  };

  /* palavra que serve pra várias técnicas não vira técnica nenhuma */
  for (const p of ['raspagem', 'passagem', 'queda', 'estrangulamento', 'chave de pé', 'pegada', 'guarda',
    'guarda fechada', 'montada', '100kg', 'costas', 'postura', 'finalização', 'posição', 'contra', 'tesoura']) {
    ok(`"${p}" sozinha não vira técnica`, grava('', [p]), []);
  }

  const AULAS = [
    /* as 13 erradas: não podem se repetir */
    ['84GMpycm-nQ', 'Jiu-Jitsu: Análise da Pontuação e Movimentos na Luta! #shorts', ['raspagem'], ['raspagem'], []],
    ['L3pAAUG23Gk', 'Raspagem no Jiu-Jitsu: Análise da Queda e Passagem #shorts', ['raspagem', 'queda', 'passagem'], ['raspagem'], []],
    ['XTWW1TSxBt8', 'Jiu-Jitsu: o Desequilíbrio! #shorts', ['raspagem'], ['raspagem'], []],
    ['knbV69KKEuE', 'Como raspar sendo leve e fraco - Dia 14 TIRANDO DÚVIDAS DE FAIXA BRANCA', ['raspagem'], ['raspagem'], []],
    ['tmOphqi2eN8', 'Guarda Fechada para Raspagem: Domine o Controle Total! #shorts', ['guarda fechada', 'raspagem'], ['raspagem'], []],
    ['ErBoV-DRQqs', 'Jiu-Jitsu Americana: Técnica Incrível Passo a Passo! #shorts', ['americana'], ['articular'], ['Americana']],
    ['g-xxfOE8V1Q', 'Domine a Chave de Pé: O Segredo do Jiu-Jitsu Revelado! #shorts', ['chave de pé'], ['articular'], []],
    ['sxpKGCuESj4', 'Domine a Pegada e Fuja da Mão de Vaca no Jiu-Jitsu! #shorts', ['mão de vaca'], ['defesa', 'pegada'], []],
    ['t8hstU33nGc', 'O que fazer quando pegam suas costas no jiu jitsu', ['mata-leão', 'chave de braço'], ['escapada', 'defesa'], ['Defesa de mata-leão (mão no queixo)']],
    ['00Z8B0MuFqI', 'Como DEFENDER o ESTRANGULAMENTO X | Estudando Jiu Jitsu 14', ['estrangulamento x'], ['defesa'], []],
    ['bw2ZBuDHz64', 'Raspagem de laço #bjj #jiujitsu', ['raspagem de laço'], ['raspagem'], []],
    ['qMr-tps8s70', 'Como raspar na guarda laço #bjj', ['raspagem', 'guarda laço'], ['raspagem'], []],
    ['ugbsLRYNcc0', 'Como estourar pegada #bjj', ['pegada'], ['pegada'], []],
    /* as 5 de defesa marcadas com o golpe: agora gravam a defesa */
    ['BPDueZf9yTw', 'Escape do Triângulo: Defesa e Contra-Ataque no Jiu-Jitsu #shorts', ['triângulo'], ['defesa', 'escapada'], ['Defesa de triângulo (postura)']],
    ['dJk_fHf8n00', 'TRIÂNGULO - como sair | Estudando Jiu Jitsu 31', ['triângulo'], ['escapada'], ['Defesa de triângulo (postura)']],
    ['fxEMhniS2E4', 'Defesa de Triângulo: A Técnica para NÃO Tomar! #shorts', ['triângulo'], ['defesa'], ['Defesa de triângulo (postura)']],
    ['QvtsIFHkNLI', 'Omoplata Jiu-Jitsu: Aprenda a Escapar e Vencer! #shorts', ['omoplata'], ['escapada'], ['Defesa de omoplata']],
    ['cZxSnNR1DqU', 'Técnica de Jiu-Jitsu: Domine a Perna e Evite a Omoplata #shorts', ['omoplata'], ['defesa'], ['Defesa de omoplata']],
    /* incompletas: com o nome inteiro, saem completas */
    ['9yfsu67OQhw', 'Estudando Jiu Jitsu - arm lock / triângulo / omoplata (parte 2)', ['arm lock', 'triângulo', 'omoplata'], ['articular'], ['Armlock da guarda fechada', 'Triângulo', 'Omoplata']],
    ['Fb3GwaR8K7M', 'Estudando jiu-jítsu / arm lock / triângulo / omoplata', ['arm lock', 'triângulo', 'omoplata'], ['articular'], ['Armlock da guarda fechada', 'Triângulo', 'Omoplata']],
    /* família certa e posição errada: o chute some, nunca vira outra técnica */
    ['i1H-YCombdA', 'Como fazer estrangulamento X na fechada #jiujitsu #bjj', ['estrangulamento x'], ['estrangulamento'], []],
    ['hfLhraVjF8Q', 'Jiu-Jitsu: Aprenda Chave de Braço e Panturrilha (Fácil!) #shorts', ['chave de braço', 'chave de panturrilha'], ['articular'], []],
    /* as certas continuam certas */
    ['7eiYOZVlfXI', 'TARIKOPLATA - como fazer  | Estudando Jiu Jitsu 30', ['tarikoplata'], ['articular'], ['Tarikoplata']],
    ['BmiTWuRbz1Y', 'Armlock da fechada #bjj #jiujitsu', ['armlock'], ['articular'], ['Armlock da guarda fechada']],
    ['ULWeNfDD8A0', '3 formas de fazer o ARM LOCK - ESTUDANDO JIU JITSU 46', ['arm lock'], ['articular'], ['Armlock da guarda fechada']],
    ['hoqDGYEVJRY', 'Armlock Surpreendente: A Técnica Inovadora Revelada! #shorts', ['armlock'], ['articular'], ['Armlock da guarda fechada']],
    ['CoaV7LorLrQ', 'Como fazer o TRIÂNGULO perfeito da guarda | Estudando Jiu Jitsu 38', ['triângulo'], ['estrangulamento'], ['Triângulo']],
    ['E4Cbr4o_bjo', 'Estudando TRIÂNGULO / Estudando Jiu Jitsu 10', ['triângulo'], ['estrangulamento'], ['Triângulo']],
    ['SYLVEhBVSQ0', 'A lógica do triângulo #bjj #jiujitsu', ['triângulo'], ['estrangulamento'], ['Triângulo']],
    ['qB9IId2sB-U', 'Triângulo Fechado: Finalização e Estratégias Incríveis #shorts', ['triângulo'], ['finalizacao'], ['Triângulo']],
    ['dNVPGN93cW0', 'Aprenda a fazer omoplata #bjj', ['omoplata'], ['articular'], ['Omoplata']],
    ['TkjTWJHVbhQ', 'Como fazer omoplata na guarda fechada #bjj #jiujitsu', ['omoplata', 'guarda fechada'], ['articular'], ['Omoplata']],
    ['zNb_9lyYd8k', 'Domine a Kimura: Técnica Essencial no Jiu Jitsu #shorts', ['kimura'], ['articular'], ['Kimura']],
    ['NCzLkp-N1yY', 'Jiu-Jitsu: Aprenda a Técnica da Americana Incrível! #shorts', ['americana'], ['articular'], ['Americana']],
    ['Mnu4Ofju6Uc', 'Estudando MÃO DE VACA / Estudando Jiu Jitsu 12', ['mão de vaca'], ['articular'], ['Mão de vaca (chave de pulso)']],
    ['gx401p_Dvs0', 'Estudando leg lock  chave de joelho | Estudando Jiu Jitsu 13', ['chave de joelho'], ['articular'], ['Chave de joelho (kneebar)']],
    ['T4M_8n-RBJQ', 'BOTINHA ou CHAVE DE PÉ reta / Estudando Jiu Jitsu 07', ['botinha'], ['articular'], ['Chave de pé reta (botinha)']],
    ['f88V688J4u0', 'A logica do jiu jitsu - PARTE 11: A lógica da raspagem tesourinha #bjj', ['raspagem de tesoura'], ['raspagem'], ['Raspagem de tesoura']],
    ['JlBS2JFn7DM', 'Ouchi Gari: Aprenda Jiu-Jitsu e Economize Agora! #shorts', ['ouchi gari'], ['queda'], ['Ouchi gari']],
    ['MuhhAAFbTGo', 'Tsuri-goshi: Domine a Técnica de Judô para Quedas! #shorts', ['tsuri-goshi'], ['queda'], ['Tsuri goshi']],
    /* aula de sair: a fuga é o que ela ensina, não é golpe pra trocar */
    ['dapGi8OiOE8', 'Fuga de Quadril: Detalhe Simples para Sair dos 100kg! #shorts', ['fuga de quadril'], ['escapada'], ['Fuga de quadril (shrimp)']],
  ];
  for (const [id, titulo, tecnicas, habilidades, esperado] of AULAS) {
    ok(`${id} ${titulo.slice(0, 50)}`, grava(titulo, tecnicas, habilidades), esperado);
  }

  /* o motor ainda acha pelo nome solto (até o R2) */
  ok('fora da esteira, o nome solto ainda acha', C.acharTecnicas(['ezequiel'], INDICE_TECNICAS).length, 1);
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
