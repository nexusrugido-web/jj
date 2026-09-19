import { grauPorN, contextoPorId, requisitosDaFaixa, posicoesSofridas, NOME_POSICAO_SOFRIDA, TITULO_POSICAO_SOFRIDA } from './graus';
import { diasEntre, hoje } from './utils';
import { placarDaRola } from './game';

/* ============================================================
   RECOMENDAÇÕES POR INTENÇÃO

   Nenhuma recomendação aparece sem motivo. Cada uma nasce de um
   estado específico dos dados, e a frase explica por que aquilo
   faz sentido agora, para quem está naquela faixa.

   Regras de escrita deste arquivo:
   sem travessão, sem pergunta retórica, sem número interno do
   app, sem frase motivacional genérica.
   ============================================================ */

export const INTENCOES = {
  aprender:   { nome: 'Aprender',   cor: 'ice',   ordem: 1 },
  repetir:    { nome: 'Repetir',    cor: 'dim',   ordem: 2 },
  consolidar: { nome: 'Consolidar', cor: 'roar',  ordem: 3 },
  testar:     { nome: 'Testar',     cor: 'accent',ordem: 4 },
  adaptar:    { nome: 'Adaptar',    cor: 'roar',  ordem: 5 },
  conectar:   { nome: 'Conectar',   cor: 'ice',   ordem: 6 },
  refinar:    { nome: 'Refinar',    cor: 'jade',  ordem: 7 },
  explorar:   { nome: 'Explorar',   cor: 'dim',   ordem: 8 },
  corrigir:   { nome: 'Corrigir',   cor: 'blood', ordem: 0 },
  validar:    { nome: 'Validar',    cor: 'jade',  ordem: 9 },
};

const NOME_PARCEIRO = (partners, id) => partners.find((p) => p.id === id)?.nome || 'ele';

/* ---------- frases por faixa ----------
   O mesmo estado de dados gera frases diferentes conforme quem lê.
   Faixa branca precisa de segurança e fundamento.
   Azul precisa de consistência e encadeamento.
   Roxa de leitura e adaptação.
   Marrom de timing e detalhe.
   Preta de eficiência e sistema. */
const FALA = {
  corrigir: {
    branca: (d) => [
      `${d.nome} te pegou ${d.vezes} vezes${d.ondeTxt}. Nessa fase, aprender a sair de posição ruim rende mais do que qualquer ataque novo. Pede pro professor um posicional começando daí.`,
      `Você bateu ${d.vezes} vezes de ${d.nome}${d.ondeTxt}. Antes de estudar defesa específica, vale garantir a base: proteger o pescoço, o cotovelo colado, e o quadril se mexendo.`,
      `${d.nome}, ${d.vezes} vezes${d.ondeTxt}. Não é vergonha nenhuma, é o que mais acontece no primeiro ano. Fala com o professor que ele te mostra a saída.`,
    ],
    azul: (d) => `${d.nome} continua te pegando, ${d.vezes} vezes${d.ondeTxt}. Já não é falta de conhecer a saída, é timing. Um posicional repetido começando nessa posição resolve mais rápido do que estudar defesa nova.`,
    roxa: (d) => `${d.nome} aparece ${d.vezes} vezes contra você${d.ondeTxt}. Nessa altura o furo costuma estar duas etapas antes, na hora que você deixa a pegada nascer. Vale filmar um rola e olhar o começo.`,
    marrom: (d) => `${d.nome} ainda passa, ${d.vezes} vezes${d.ondeTxt}. Provavelmente é um detalhe de quadril ou de mão, não de conceito. Testa uma variação de frame no posicional.`,
    preta: (d) => `${d.nome} segue entrando ${d.vezes} vezes${d.ondeTxt}. Vale mapear quem aplica e como, porque nesse nível costuma ser um estilo específico e não uma falha geral.`,
  },
  repetir: {
    branca: (d) => [
      `${d.nome} saiu ${d.usos} ${d.usos === 1 ? 'vez' : 'vezes'} até agora. É pouco pra tirar conclusão, e oscilar nessa fase é o esperado. Insiste nela nos treinos da semana.`,
      `Você encaixou ${d.nome} ${d.usos} ${d.usos === 1 ? 'vez' : 'vezes'}. Repetição é o que resolve agora, não técnica nova. Deixa ela como a sua tentativa padrão por um tempo.`,
      `${d.nome} apareceu ${d.usos} ${d.usos === 1 ? 'vez' : 'vezes'}. No começo tudo sai desengonçado, faz parte. O que muda o jogo é insistir na mesma coisa por algumas semanas.`,
    ],
    azul: (d) => [
      `${d.nome} saiu ${d.usos} vezes com resistência. Falta volume pra ela virar rotina. Escolhe ela como primeira opção por duas semanas.`,
      `${d.nome} tem ${d.usos} usos. Nessa faixa o salto vem de escolher pouca coisa e martelar, não de somar movimento novo.`,
      `Você aplicou ${d.nome} ${d.usos} vezes. Ainda depende de a situação cair no colo. Vale forçar a entrada em vez de esperar ela aparecer.`,
    ],
    roxa: (d) => [
      `${d.nome} apareceu ${d.usos} vezes. Pouco pra você considerar como parte do jogo. Um bloco de posicional em cima dela resolve rápido.`,
      `${d.nome} está com ${d.usos} usos. Se ela é adição recente, precisa de repetição concentrada, senão some do repertório.`,
      `Só ${d.usos} usos de ${d.nome}. Nessa altura o problema costuma ser a entrada, não o acabamento.`,
    ],
    marrom: (d) => [
      `${d.nome} tem ${d.usos} usos registrados. Se ela interessa pro seu sistema, vale um bloco dedicado.`,
      `${d.nome} aparece pouco, ${d.usos} vezes. Provavelmente falta o gatilho certo dentro do que você já joga.`,
    ],
    preta: (d) => [
      `${d.nome} aparece ${d.usos} vezes. Se é adição nova ao sistema, precisa de bloco dedicado pra sair sob pressão.`,
      `Só ${d.usos} usos de ${d.nome}. Vale decidir se ela entra de vez ou sai do plano.`,
    ],
  },
  consolidar: {
    branca: (d) => `${d.nome} já sai no drill mas ainda não apareceu no rola. Tenta ela num rola leve, mesmo que não funcione de primeira. É assim que sai da teoria.`,
    azul: (d) => `${d.nome} está no drill e não no rola. Enquanto não passar pelo teste da resistência, ela não conta como jogo.`,
    roxa: (d) => `Você domina a mecânica de ${d.nome} mas ela não aparece com resistência. Ou falta gatilho, ou falta oportunidade. Cria a situação no posicional.`,
    marrom: (d) => `${d.nome} está parada no drill. Nesse nível o que falta costuma ser a entrada, não o acabamento.`,
    preta: (d) => `${d.nome} não migrou do drill pro rola. Vale checar se a entrada existe dentro do seu sistema atual.`,
  },
  testar: {
    branca: (d) => `${d.nome} está saindo bem com o pessoal de sempre. Quando pintar alguém de fora no open mat, tenta ela lá também.`,
    azul: (d) => `${d.nome} funciona em ${d.transferencia} pessoas. Testar em quem nunca te viu rolar mostra se ela depende do corpo do parceiro ou não.`,
    roxa: (d) => `${d.nome} está consistente no grupo. Se você pensa em competir, precisa dela contra gente que não conhece seu jogo.`,
    marrom: (d) => `${d.nome} está madura dentro da academia. O open mat de fora é o único teste que sobra.`,
    preta: (d) => `${d.nome} funciona no ambiente conhecido. Contra estilo diferente é que se vê o que ainda falta.`,
  },
  adaptar: {
    branca: (d) => `${d.parceiro} já sabe que vem ${d.nome}. Isso é bom sinal, quer dizer que você repetiu bastante. Agora tenta fingir outra coisa antes de entrar.`,
    azul: (d) => `Você já encaixou ${d.nome} ${d.refinamento} vezes no ${d.parceiro}. Ele leu sua entrada, então agora é a versão difícil. Ameaça outra coisa primeiro pra abrir o espaço.`,
    roxa: (d) => `${d.parceiro} conhece sua entrada de ${d.nome}. Continuar encaixando aí vale mais do que estrear em alguém novo, porque a resistência já subiu. Trabalha a segunda ameaça.`,
    marrom: (d) => `${d.nome} contra ${d.parceiro} virou jogo de leitura. Nessa altura o ganho está no timing e na falsa intenção, não em força.`,
    preta: (d) => `${d.parceiro} já antecipa ${d.nome}. Esse é o laboratório ideal pra testar variação de ângulo e de ritmo.`,
  },
  conectar: {
    branca: (d) => `${d.nome} e ${d.par} saem das mesmas situações. Vale treinar as duas juntas, uma abre a outra.`,
    azul: (d) => `${d.nome} e ${d.par} vêm da mesma posição. Encadear as duas é o passo natural pra ter resposta quando a primeira falhar.`,
    roxa: (d) => `${d.nome} e ${d.par} podem virar uma sequência. Trabalhar a transição entre elas fecha as saídas do parceiro.`,
    marrom: (d) => `${d.nome} e ${d.par} já são suas. Amarrar as duas cria um sistema, não só duas técnicas soltas.`,
    preta: (d) => `${d.nome} e ${d.par} coexistem no seu jogo. Vale definir qual é a isca e qual é a real.`,
  },
  refinar: {
    branca: (d) => `${d.nome} já é sua melhor arma, com ${d.usos} usos. Continua nela, e presta atenção na pegada antes de entrar.`,
    azul: (d) => `${d.nome} está sólida, ${d.usos} usos. Agora o ganho vem de detalhe, ângulo do quadril, altura da pegada.`,
    roxa: (d) => `${d.nome} é jogo seu, ${d.usos} usos. Nesse ponto o trabalho é economia de movimento, gastar menos pra chegar no mesmo lugar.`,
    marrom: (d) => `${d.nome} com ${d.usos} usos já é assinatura. Refino aqui é milímetro de pegada e meio segundo de timing.`,
    preta: (d) => `${d.nome} tem ${d.usos} usos. Vale documentar os detalhes que fazem ela funcionar, porque é isso que você vai passar pros alunos.`,
  },
  explorar: {
    branca: (d) => `Seu jogo está concentrado em ${d.qtd} técnicas. Normal nessa fase, e não tem pressa pra ampliar.`,
    azul: (d) => `Você repete ${d.qtd} técnicas. Um repertório estreito trava quando alguém já sabe o que vem.`,
    roxa: (d) => `Seu repertório está em ${d.qtd} técnicas registradas. Vale abrir uma zona nova, principalmente onde você nunca pontua.`,
    marrom: (d) => `${d.qtd} técnicas no registro. Nesse nível vale explorar o que você evita, não o que você já gosta.`,
    preta: (d) => `${d.qtd} técnicas registradas. Explorar aqui é sobre completar o sistema, não colecionar movimento.`,
  },
  validar: {
    branca: (d) => `${d.nome} subiu pro ${d.grau}. Você encaixou ela ${d.usos} vezes com gente resistindo. Pode confiar.`,
    azul: (d) => `${d.nome} chegou no ${d.grau}, com ${d.usos} usos sob resistência. Já dá pra montar plano em cima dela.`,
    roxa: (d) => `${d.nome} está no ${d.grau}. Com ${d.usos} usos, é peça fixa do seu jogo.`,
    marrom: (d) => `${d.nome} no ${d.grau}, ${d.usos} usos. Consistência desse tipo é o que se espera pra fechar a faixa.`,
    preta: (d) => `${d.nome} no ${d.grau}. Com ${d.usos} usos e contra faixas altas, isso é assinatura no sentido real.`,
  },
  aprender: {
    branca: () => `Você ainda não registrou nenhuma saída de posição ruim. Antes de atacar, garantir que você sai de baixo é o que segura a evolução no primeiro ano.`,
    azul: () => `Não há registro de escapadas no seu histórico. Mesmo com jogo ofensivo formado, defesa não registrada é ponto cego.`,
    roxa: () => `Suas escapadas não aparecem no registro. Vale anotar, porque nessa faixa o padrão de fuga já é parte do estilo.`,
    marrom: () => `Sem registro de escapadas. Se é porque você não vai mais pra posição ruim, ótimo, mas vale confirmar.`,
    preta: () => `Escapadas não aparecem no histórico. Provavelmente falta registro, não falta a habilidade.`,
  },
};

/* escolhe uma variação de forma estável: a mesma técnica sempre
   recebe a mesma frase, mas técnicas diferentes recebem frases
   diferentes. Assim não vira disco riscado. */
function semente(txt) {
  let h = 0;
  for (let i = 0; i < String(txt).length; i++) h = (h * 31 + String(txt).charCodeAt(i)) >>> 0;
  return h;
}

function falar(intencao, faixa, dados) {
  const grupo = FALA[intencao];
  if (!grupo) return '';
  const fn = grupo[faixa] || grupo.branca;
  const saida = fn(dados);
  if (Array.isArray(saida)) {
    const i = semente(dados.nome || dados.alvo || intencao) % saida.length;
    return saida[i];
  }
  return saida;
}

/* ============================================================
   O MOTOR
   ============================================================ */
export function gerarRecomendacoes({
  tecnicas = [],
  buracos = [],
  partners = [],
  sessions = [],
  rolls = [],
  faixa = 'branca',
  limite = 3,
}) {
  const out = [];
  const req = requisitosDaFaixa(faixa);

  /* 1. CORRIGIR: o que te pega, tem prioridade sobre tudo */
  /* Ficar preso na mesma posição é queixa tão comum quanto
     tomar sempre a mesma finalização, e antes não gerava nada. */
  const presas = posicoesSofridas(rolls || [], sessions || []);
  const presa = presas[0];
  if (presa) {
    const nome = NOME_POSICAO_SOFRIDA[presa.posicao] || 'numa posição ruim';
    out.push({
      intencao: 'corrigir',
      alvo: null,
      posicao: presa.posicao,
      titulo: TITULO_POSICAO_SOFRIDA[presa.posicao] || 'Sair de posição ruim',
      texto: `Você ficou ${nome} em ${presa.vezes} ${presa.vezes === 1 ? 'rola' : 'rolas'}${presa.recente >= 2 ? ', sendo várias no último mês' : ''}. Saber sair daí vale mais que aprender técnica nova.`,
      evidencia: `${presa.vezes} vezes registradas`,
    });
  }

  const buracoQuente = buracos.find((b) => b.recente >= 2) || buracos.find((b) => b.vezes >= 2);
  if (buracoQuente) {
    out.push({
      intencao: 'corrigir',
      alvo: buracoQuente.nome,
      titulo: `Defesa contra ${buracoQuente.nome}`,
      texto: falar('corrigir', faixa, {
        nome: buracoQuente.nome,
        nomeCurto: `na ${buracoQuente.nome.toLowerCase()}`,
        vezes: buracoQuente.vezes,
        ondeTxt: buracoQuente.inicioComum ? ', quase sempre em rola que começou na mesma posição' : '',
      }),
      evidencia: `${buracoQuente.vezes} vezes sofrida, ${buracoQuente.recente} no último mês`,
    });
  }

  /* Lutar com gente mais pesada foi das dificuldades mais citadas
     no formulário de entrada dos alunos. Quando os rolas mostram
     isso, vira recomendação com nome. */
  const pesado = contraMaisPesado(rolls || []);
  if (pesado) {
    out.push({
      intencao: 'corrigir',
      alvo: null,
      situacao: 'contra_pesado',
      titulo: 'Contra quem é mais pesado',
      texto: `Contra gente mais pesada você perdeu ${pesado.perdas} de ${pesado.n} rolas${pesado.outros !== null ? `, e contra o resto do pessoal, ${pesado.outros}% das vezes` : ''}. Contra peso, posição e alavanca rendem mais que força.`,
      evidencia: `${pesado.perdas} de ${pesado.n} rolas contra mais pesados`,
    });
  }

  /* 2. ADAPTAR: o parceiro já leu a sua entrada */
  const paraAdaptar = tecnicas.find((t) =>
    t.refinamento >= 4 && t.transferencia <= 2 && t.grau >= 2 && t.melhorParceiro);
  if (paraAdaptar) {
    out.push({
      intencao: 'adaptar',
      alvo: paraAdaptar.nome,
      titulo: `Variação de ${paraAdaptar.nome}`,
      texto: falar('adaptar', faixa, {
        nome: paraAdaptar.nome,
        parceiro: NOME_PARCEIRO(partners, paraAdaptar.melhorParceiro),
        refinamento: paraAdaptar.refinamento,
      }),
      evidencia: `${paraAdaptar.refinamento} usos no mesmo parceiro`,
    });
  }

  /* 3. CONSOLIDAR: está no drill e não chegou no rola */
  const paraConsolidar = tecnicas.find((t) => t.soDrill && t.usos >= 2);
  if (paraConsolidar) {
    out.push({
      intencao: 'consolidar',
      alvo: paraConsolidar.nome,
      titulo: `Levar ${paraConsolidar.nome} pro rola`,
      texto: falar('consolidar', faixa, { nome: paraConsolidar.nome }),
      evidencia: `${paraConsolidar.usosDrill} vezes no drill, nenhuma no rola`,
    });
  }

  /* 4. VALIDAR: acabou de subir de grau */
  const recemSubiu = tecnicas.find((t) => t.grau >= 3 && t.progresso <= 15);
  if (recemSubiu) {
    out.push({
      intencao: 'validar',
      alvo: recemSubiu.nome,
      titulo: `${recemSubiu.nome} virou jogo`,
      texto: falar('validar', faixa, {
        nome: recemSubiu.nome,
        grau: grauPorN(recemSubiu.grau).nome,
        usos: recemSubiu.usosResistencia,
      }),
      evidencia: `${grauPorN(recemSubiu.grau).curto}`,
    });
  }

  /* 5. TESTAR: sólida no grupo, nunca testada fora */
  const paraTestar = tecnicas.find((t) =>
    t.grau >= 2 && t.usosResistencia >= req[3].usos && t.transferencia < req[3].transferencia && t.refinamento >= 4);
  if (paraTestar) {
    out.push({
      intencao: 'testar',
      alvo: paraTestar.nome,
      titulo: `Testar ${paraTestar.nome} fora do grupo`,
      texto: falar('testar', faixa, {
        nome: paraTestar.nome,
        transferencia: paraTestar.transferencia,
      }),
      evidencia: `${paraTestar.transferencia} parceiros diferentes até agora`,
    });
  }

  /* 6. REPETIR: pouca coisa ainda */
  const paraRepetir = tecnicas.find((t) => t.grau === 1 && t.usosResistencia >= 1 && t.usosResistencia < req[2].usos);
  if (paraRepetir) {
    out.push({
      intencao: 'repetir',
      alvo: paraRepetir.nome,
      titulo: `Insistir em ${paraRepetir.nome}`,
      texto: falar('repetir', faixa, { nome: paraRepetir.nome, usos: paraRepetir.usosResistencia }),
      evidencia: `${paraRepetir.usosResistencia} usos no rola`,
    });
  }

  /* 7. REFINAR: já é a melhor arma */
  const paraRefinar = tecnicas.find((t) => t.grau === 4);
  if (paraRefinar) {
    out.push({
      intencao: 'refinar',
      alvo: paraRefinar.nome,
      titulo: `Detalhe de ${paraRefinar.nome}`,
      texto: falar('refinar', faixa, { nome: paraRefinar.nome, usos: paraRefinar.usosResistencia }),
      evidencia: grauPorN(4).curto,
    });
  }

  /* 8. EXPLORAR: repertório estreito, e só a partir da azul */
  const comUso = tecnicas.filter((t) => t.usosResistencia > 0).length;
  if (comUso >= 3 && comUso <= 5 && faixa !== 'branca') {
    out.push({
      intencao: 'explorar',
      alvo: null,
      titulo: 'Repertório concentrado',
      texto: falar('explorar', faixa, { qtd: comUso }),
      evidencia: `${comUso} técnicas com uso registrado`,
    });
  }

  return out
    .sort((a, b) => INTENCOES[a.intencao].ordem - INTENCOES[b.intencao].ordem)
    .slice(0, limite);
}

/* Perde contra mais pesado bem mais do que contra o resto? Com
   pelo menos 4 rolas contra mais pesados, pra não tirar conclusão
   de um dia ruim. */
export function contraMaisPesado(rolls) {
  const comPeso = rolls.filter((r) => r.pesoRel);
  const pesados = comPeso.filter((r) => r.pesoRel === 'pesado');
  const outros = comPeso.filter((r) => r.pesoRel !== 'pesado');
  if (pesados.length < 4) return null;

  const perdas = (lista) => lista.filter((r) => placarDaRola(r).perdeu).length;
  const taxa = perdas(pesados) / pesados.length;
  if (taxa < 0.5) return null;

  const comparar = outros.length >= 3;
  const taxaOutros = comparar ? perdas(outros) / outros.length : null;
  if (comparar && taxa - taxaOutros < 0.2) return null;

  return {
    n: pesados.length,
    perdas: perdas(pesados),
    outros: comparar ? Math.round(taxaOutros * 100) : null,
  };
}

/* ============================================================
   AS RECOMENDAÇÕES DO ALUNO, IGUAIS EM TODA TELA

   Painel, Domínio e Estudo montavam a lista cada um do seu jeito.
   O Estudo não passava os rolas, então "sair de baixo do 100kg"
   nunca aparecia lá, e não tirava o que a pessoa já tinha marcado
   como feito. As três telas discordavam sobre a mesma pessoa.

   Agora a lista sai daqui. Cada tela só decide quantas mostra.
   ============================================================ */
export function recomendacoesDoAluno({
  tecnicas = [], buracos = [], partners = [], sessions = [], rolls = [],
  faixa = 'branca', feitas = [], limite = 10,
}) {
  return filtrarFeitas(
    gerarRecomendacoes({ tecnicas, buracos, partners, sessions, rolls, faixa, limite: 99 }),
    feitas
  ).slice(0, limite);
}

/* ============================================================
   O QUE FALTA PRO PRÓXIMO GRAU, em português
   ============================================================ */
export function faltaPara(t, faixa = 'branca', partners = []) {
  if (!t || t.grau >= 4) return null;
  const req = requisitosDaFaixa(faixa)[t.proximo];
  if (!req) return null;

  const g = grauPorN(t.proximo);
  const pecas = [];

  if (t.soDrill) {
    return {
      resumo: `Falta levar pro rola`,
      texto: `Você executou no drill mas ela ainda não apareceu com alguém resistindo. Enquanto isso não acontecer, ela fica no 1º grau.`,
      alvo: g,
    };
  }

  const faltamUsos = Math.max(0, req.usos - t.usosResistencia);
  if (faltamUsos > 0) {
    pecas.push(faltamUsos === 1
      ? `encaixar mais uma vez no rola`
      : `encaixar mais ${faltamUsos} vezes no rola`);
  }

  const okTransf = !req.transferencia || t.transferencia >= req.transferencia;
  const okRefino = !req.refinamento || t.refinamento >= req.refinamento;
  if (!okTransf && !okRefino) {
    const faltamPessoas = req.transferencia - t.transferencia;
    const faltamRepet = req.refinamento - t.refinamento;
    const nome = t.melhorParceiro ? NOME_PARCEIRO(partners, t.melhorParceiro) : 'no mesmo parceiro';
    pecas.push(
      faltamPessoas <= faltamRepet
        ? `usar em mais ${faltamPessoas} ${faltamPessoas === 1 ? 'pessoa' : 'pessoas'}, ou continuar encaixando no ${nome} mais ${faltamRepet} vezes`
        : `continuar encaixando no ${nome} mais ${faltamRepet} vezes, ou abrir pra mais ${faltamPessoas} ${faltamPessoas === 1 ? 'pessoa' : 'pessoas'}`
    );
  }

  if (req.acima && t.contraAcima < req.acima) {
    const f = req.acima - t.contraAcima;
    pecas.push(f === 1
      ? `encaixar uma vez em alguém de faixa acima da sua`
      : `encaixar ${f} vezes em gente de faixa acima da sua`);
  }

  if (!pecas.length) {
    return { resumo: 'Requisitos batidos', texto: `Ela sobe pro ${g.nome} no próximo cálculo.`, alvo: g };
  }

  const texto = pecas.length === 1
    ? `Falta ${pecas[0]}.`
    : `Falta ${pecas.slice(0, -1).join(', ')} e ${pecas[pecas.length - 1]}.`;

  const porque = t.proximo === 2
    ? 'O 2º grau só chega quando a técnica funciona com alguém tentando impedir.'
    : t.proximo === 3
      ? 'O 3º grau aceita dois caminhos, funcionar em gente diferente ou continuar funcionando em quem já conhece sua entrada.'
      : 'O 4º grau pede volume e uso contra quem está no seu nível ou acima.';

  return { resumo: `${t.progresso}% para o ${g.nome}`, texto: `${texto} ${porque}`, alvo: g };
}

/* ============================================================
   FECHAR O LAÇO

   O app sugere treinar defesa de americana. Você treina. E aí?
   Sem poder dizer "fiz isso", a sugestão volta igual amanhã e
   o app nunca aprende se ajudou.

   Aqui a sugestão vira algo que você marca como feito, e diz
   se funcionou ou não.
   ============================================================ */

export const RESULTADOS = [
  { id: 'funcionou', nome: 'Funcionou', cor: 'jade', peso: 1 },
  { id: 'meio', nome: 'Mais ou menos', cor: 'roar', peso: 0.5 },
  { id: 'nao', nome: 'Não saiu', cor: 'blood', peso: 0 },
];

/* a chave identifica a sugestão, pra ela não voltar igual */
export function chaveDaRec(r) {
  return `${r.intencao}:${r.alvo || r.situacao || 'geral'}`;
}

/* remove o que você já marcou como feito recentemente */
export function filtrarFeitas(recs, feitas, diasDeDescanso = 14) {
  const limite = new Date();
  limite.setDate(limite.getDate() - diasDeDescanso);
  const corte = limite.toISOString().slice(0, 10);

  const recentes = new Set(
    feitas.filter((f) => f.data >= corte && f.resultado !== 'nao').map((f) => f.chave)
  );

  return recs.filter((r) => !recentes.has(chaveDaRec(r)));
}

/* o que dizer depois que a pessoa marcou */
export function respostaAoMarcar(resultado, rec, faixa = 'branca') {
  if (resultado === 'funcionou') {
    return {
      titulo: 'Boa',
      texto: rec.alvo
        ? `Anotei. Quando ${rec.alvo} aparecer nas suas rolas, o app já conta como evolução.`
        : 'Anotei. Isso sai da lista por duas semanas.',
      tom: 'jade',
    };
  }
  if (resultado === 'meio') {
    return {
      titulo: 'Faz parte',
      texto: faixa === 'branca'
        ? 'Quase nada sai de primeira. Vou manter isso na lista pra você insistir.'
        : 'Vou manter na lista. Repetição é o que resolve esse tipo de coisa.',
      tom: 'roar',
    };
  }
  return {
    titulo: 'Anotado',
    texto: 'Vou continuar sugerindo enquanto o padrão aparecer nos seus registros. Se não fizer sentido pra você, ignore.',
    tom: '',
  };
}

/* quanto do que foi sugerido você realmente treinou */
export function aderencia(feitas, dias = 30) {
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  const corte = limite.toISOString().slice(0, 10);

  const doPeriodo = feitas.filter((f) => f.data >= corte);
  if (!doPeriodo.length) return null;

  const funcionou = doPeriodo.filter((f) => f.resultado === 'funcionou').length;
  const meio = doPeriodo.filter((f) => f.resultado === 'meio').length;

  return {
    total: doPeriodo.length,
    funcionou,
    meio,
    nao: doPeriodo.length - funcionou - meio,
    pct: Math.round(((funcionou + meio * 0.5) / doPeriodo.length) * 100),
  };
}
