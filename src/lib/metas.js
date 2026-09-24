import { hoje, diasEntre, pct, fmtData, addDias } from './utils';
import { periodoDeDados, dentroDoPeriodo } from './periodo';
import { grauPorN } from './graus';
import { posInicialPorId } from '../db/scoring';

/* ============================================================
   METAS COM ORIGEM EXPLÍCITA

   O app nunca inventa um compromisso. Uma sugestão é uma
   sugestão até você confirmar. Enquanto isso, ela não conta
   progresso, não aparece como pendência e não cobra nada.
   ============================================================ */

export const ORIGENS = {
  usuario:   { id: 'usuario',   nome: 'Você criou',        conta: true },
  confirmada:{ id: 'confirmada',nome: 'Você confirmou',    conta: true },
  sugerida:  { id: 'sugerida',  nome: 'Sugestão do app',   conta: false },
};

export const TIPOS_META = [
  {
    id: 'frequencia',
    nome: 'Treinar com regularidade',
    desc: 'Quantas vezes por semana você quer pisar no tatame.',
    processo: true,
    unidade: 'treinos por semana',
    familia: 'treino',
  },
  {
    id: 'tecnica',
    nome: 'Subir uma técnica de grau',
    desc: 'Escolhe uma técnica e o app acompanha sozinho pelos seus registros.',
    processo: true,
    unidade: 'grau',
    familia: 'treino',
  },
  {
    id: 'defesa',
    nome: 'Fechar um buraco na defesa',
    desc: 'Parar de ser pego por uma técnica específica.',
    processo: true,
    unidade: 'vezes sofridas',
    familia: 'treino',
  },
  {
    id: 'treinos',
    nome: 'Chegar a um total de treinos',
    desc: 'Conta todos os treinos que você já registrou, desde o começo. Bom pra marco grande, tipo cem treinos.',
    processo: true,
    unidade: 'treinos',
    familia: 'treino',
  },
  {
    id: 'manual',
    nome: 'Contar na mão',
    desc: 'Pra o que o app não consegue enxergar. Você mesmo soma e subtrai.',
    processo: true,
    unidade: 'vezes',
    familia: 'treino',
    manual: true,
  },
  {
    id: 'aulas',
    nome: 'Assistir aulas',
    desc: 'Quantas aulas você quer ver num período. O app conta sozinho.',
    processo: true,
    unidade: 'aulas',
    familia: 'estudo',
  },
  {
    id: 'quiz',
    nome: 'Responder o quiz',
    desc: 'Acertar perguntas de conceito. Serve pra fixar o porquê das coisas.',
    processo: true,
    unidade: 'acertos',
    familia: 'estudo',
  },
  {
    id: 'rolas',
    nome: 'Fazer um tanto de rolas',
    desc: 'Conta só rola de verdade, não treino técnico.',
    processo: true,
    unidade: 'rolas',
    familia: 'treino',
  },
  {
    id: 'posicao',
    nome: 'Trabalhar uma posição',
    desc: 'Escolhe uma posição e o app acompanha quantas vezes ela apareceu nos seus rolas.',
    processo: true,
    unidade: 'aparições',
    familia: 'treino',
  },
  {
    id: 'volume',
    nome: 'Tempo de tatame num período',
    desc: 'Horas acumuladas. Serve mais pra olhar depois do que pra perseguir.',
    processo: true,
    unidade: 'horas',
    familia: 'treino',
  },
  {
    id: 'competicao',
    nome: 'Competir',
    desc: 'Um campeonato específico. Depende de terceiros, então serve de norte, não de régua.',
    processo: false,
    unidade: 'campeonato',
    familia: 'treino',
  },
];

export const tipoPorId = (id) => TIPOS_META.find((t) => t.id === id) || TIPOS_META[0];

/* ============================================================
   SUGESTÕES: nascem do perfil, nunca viram meta sozinhas
   ============================================================ */
export function sugerirMetas({ faixa = 'branca', frequenciaTipica = 0, objetivo = 'lazer', tecnicas = [], buracos = [], sessions = [] }) {
  const out = [];

  /* frequência: só sugere se a pessoa disse quanto treina */
  if (frequenciaTipica >= 1) {
    out.push({
      tipo: 'frequencia',
      alvo: frequenciaTipica,
      titulo: `Treinar ${frequenciaTipica}x por semana`,
      porque: `Você contou que treina ${frequenciaTipica} vezes por semana. Manter isso registrado é o que faz o resto do app funcionar.`,
    });
  }

  /* defesa: o buraco mais quente vira sugestão prioritária */
  const b = buracos[0];
  if (b && b.vezes >= 2) {
    out.push({
      tipo: 'defesa',
      alvo: b.nome,
      titulo: `Parar de ser pego na ${b.nome.toLowerCase()}`,
      porque: faixa === 'branca'
        ? `Foi ${b.vezes} vezes até agora. No começo, aprender a sair vale mais do que aprender a atacar.`
        : `Foi ${b.vezes} vezes, e ${b.recente} só no último mês. É o furo mais caro do seu jogo agora.`,
    });
  }

  /* técnica: a que está mais perto de subir */
  const perto = tecnicas
    .filter((t) => t.proximo && t.progresso >= 30 && t.usosResistencia > 0)
    .sort((a, b2) => b2.progresso - a.progresso)[0];
  if (perto) {
    out.push({
      tipo: 'tecnica',
      alvo: perto.nome,
      grauAlvo: perto.proximo,
      titulo: `Levar ${perto.nome} pro ${grauPorN(perto.proximo).nome}`,
      porque: `Ela já está a caminho e o app acompanha sozinho, sem você precisar atualizar nada.`,
    });
  }

  /* competição só se a pessoa disse que quer competir */
  if (objetivo === 'competicao') {
    out.push({
      tipo: 'competicao',
      alvo: '',
      titulo: 'Escolher um campeonato',
      porque: 'Você marcou competição como objetivo. Data marcada muda a forma de treinar.',
    });
  }

  return out;
}

/* ============================================================
   PROGRESSO: só calcula o que o usuário assumiu
   ============================================================ */
/* ============================================================
   AJUSTE MANUAL

   O app conta sozinho o que consegue ver. Mas ele não viu o
   treino que você fez viajando, nem o rola do open mat que
   você esqueceu de anotar.

   Por isso toda meta aceita um ajuste: um número que soma ou
   subtrai do que foi calculado. O automático continua
   funcionando, e o ajuste anda junto.
   ============================================================ */
function comAjuste(r, meta) {
  const ajuste = Number(meta.ajuste) || 0;
  /* meta sem botão não tem ajuste: um antigo da defesa estava na conta invertida */
  if (!ajuste || !r.conta || r.semBotao) return r;

  const atual = Math.max(0, (r.atual || 0) + ajuste);
  const alvo = r.alvo || 1;
  const unidade = tipoPorId(meta.tipo)?.unidade || '';
  const falta = Math.max(0, alvo - atual);

  /* o texto é refeito, não remendado: trocar só o primeiro
     número deixava o "faltam" mentindo */
  const texto = atual >= alvo
    ? `${atual} de ${alvo}, meta batida.`
    : `${atual} de ${alvo}${unidade ? ` ${unidade}` : ''}. Faltam ${falta}.`;

  return { ...r, atual, ajuste, pct: pct(atual, alvo), valor: deAte(atual, alvo, r.horas), texto };
}

/* o número à direita da linha: "3 de 5", "17h de 200h" */
const deAte = (atual, alvo, horas = false) => (horas ? `${atual}h de ${alvo}h` : `${atual} de ${alvo}`);

/* metas de contagem valem desde que foram criadas; as antigas,
   sem data de início, nos últimos 30 dias (ou 3 meses, as de horas) */
const periodoDaMeta = (meta, senao) => (meta.inicio
  ? periodoDeDados('desde-a-meta', { desde: meta.inicio })
  : periodoDeDados(senao));

/* ============================================================
   O PROGRESSO DE UMA META

   Além de atual, alvo e pct, toda meta diz:
     valor    o número pra ler à direita ("3 de 5", "2 vezes")
     periodo  o objeto de periodoDeDados que contou, quando tem
     quando   de quando é a conta, escrito ("Esta semana · 14/09 a 20/09")
   ============================================================ */
/* quantos dias sem ser pego fecham a meta de defesa */
export const DIAS_SEM_SER_PEGO = 30;

export function progressoDaMeta(meta, dados) {
  return comAjuste(calcular(meta, dados), meta);
}

/* ============================================================
   QUANDO A META ZEROU, E POR QUÊ

   Duas metas voltam pro zero: a de defesa, toda vez que a técnica
   te pega, e a de frequência, toda segunda. Sem dizer quando e por
   quê, o zero parece defeito.

   A lista sai dos próprios registros, não fica guardada à parte:
   apagar o rola apaga a linha junto, e nada fica desencontrado.
   Vem da mais recente pra mais antiga.
   ============================================================ */
export const SEMANAS_NO_HISTORICO = 8;

export function historicoDaMeta(meta, { sessions = [], rolls = [], partners = [] } = {}) {
  if (meta?.tipo === 'defesa' && meta.alvo) {
    const alvo = String(meta.alvo).trim();
    const dataDe = new Map(sessions.map((s) => [s.id, s.data]));
    const nomeDe = new Map(partners.map((p) => [p.id, p.nome]));
    /* a mesma conta de "onde você apanha": o nome da finalização sofrida */
    const vezes = rolls
      .filter((r) => (r.subsSofridas || []).some((s) => String(s).trim() === alvo))
      .map((r) => ({ data: dataDe.get(r.sessionId) || r.data || null, parceiro: nomeDe.get(r.partnerId) || null }))
      .filter((v) => v.data)
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
    return vezes.map((v, i) => {
      const antes = vezes[i - 1];
      const dias = antes ? Math.min(DIAS_SEM_SER_PEGO, diasEntre(antes.data, v.data)) : null;
      return {
        data: v.data,
        zerou: true,
        texto: `${alvo} te pegou${v.parceiro ? ` no rola com ${v.parceiro}` : ''}.`,
        detalhe: dias === null ? 'A primeira vez registrada.'
          : dias === 0 ? 'De novo no mesmo dia.'
            : `A contagem estava em ${dias} ${dias === 1 ? 'dia' : 'dias'} e voltou pro zero.`,
      };
    }).reverse();
  }

  if (meta?.tipo === 'frequencia') {
    /* as semanas que já fecharam, desde a semana em que a meta nasceu */
    const alvo = Number(meta.alvo) || 1;
    const linhas = [];
    let dia = addDias(periodoDeDados('semana-atual').ini, -7);
    const desde = meta.inicio ? periodoDeDados('semana-atual', { hoje: meta.inicio }).ini : null;
    while (linhas.length < SEMANAS_NO_HISTORICO && (!desde || dia >= desde)) {
      const semana = periodoDeDados('semana-atual', { hoje: dia });
      const n = dentroDoPeriodo(sessions, semana).length;
      linhas.push({
        data: semana.ini,
        zerou: true,
        batida: n >= alvo,
        texto: `Semana de ${fmtData(semana.ini, { curto: true })} a ${fmtData(semana.fim, { curto: true })}: ${n} de ${alvo}.`,
        detalhe: n >= alvo ? 'Meta batida. Na segunda a contagem recomeçou.' : 'Na segunda a contagem recomeçou.',
      });
      dia = addDias(semana.ini, -7);
    }
    return linhas;
  }

  return [];
}

/* "Horas no ano" vem dos Ajustes, não de db.goals, mas é desenhada
   como qualquer outra meta */
export function metaDeHorasNoAno(sessions, alvo) {
  const periodo = periodoDeDados('ano-atual');
  const min = dentroDoPeriodo(sessions, periodo).reduce((a, s) => a + (Number(s.duracao) || 0), 0);
  const h = Math.round(min / 60);
  return {
    conta: true, atual: h, alvo, pct: pct(h, alvo), horas: true,
    valor: deAte(h, alvo, true), periodo, quando: periodo.rotulo,
    texto: h >= alvo ? `${h}h neste ano, meta batida.` : `${h}h de ${alvo}h neste ano.`,
  };
}

/* ============================================================
   O NOME DA META

   Ninguém deve ver uma barra sem saber do que ela é. Se a
   pessoa não escreveu título, a gente monta um a partir do
   que ela escolheu.
   ============================================================ */
export function tituloDaMeta(meta) {
  if (meta?.titulo?.trim()) return meta.titulo.trim();

  const t = tipoPorId(meta?.tipo);
  const alvo = meta?.alvo;

  switch (meta?.tipo) {
    case 'treinos': return `Chegar a ${alvo || '?'} treinos`;
    case 'frequencia': return `Treinar ${alvo || '?'}x por semana`;
    case 'aulas': return `Assistir ${alvo || '?'} aulas`;
    case 'quiz': return `Acertar ${alvo || '?'} no quiz`;
    case 'rolas': return `Fazer ${alvo || '?'} rolas`;
    case 'volume': return `${alvo || '?'} horas de tatame`;
    case 'tecnica': return `Subir ${alvo || 'uma técnica'} de grau`;
    case 'defesa': return `Parar de ser pego em ${alvo || 'alguma coisa'}`;
    case 'posicao': return `Trabalhar ${posInicialPorId[alvo]?.nome || alvo || 'uma posição'}`;
    case 'competicao': return alvo ? `Competir: ${alvo}` : 'Competir';
    case 'manual': return 'Contagem própria';
    default: return t?.nome || 'Meta';
  }
}

function calcular(meta, dados = {}) {
  const { sessions = [], tecnicas = [], buracos = [] } = dados;
  if (!meta || !ORIGENS[meta.origem]?.conta) {
    return { conta: false, pct: 0, texto: 'Sugestão ainda não confirmada.' };
  }

  if (meta.tipo === 'frequencia') {
    const periodo = periodoDeDados('semana-atual');
    const n = dentroDoPeriodo(sessions, periodo).length;
    const alvo = Number(meta.alvo) || 1;
    return {
      conta: true,
      atual: n,
      alvo,
      pct: pct(n, alvo),
      valor: deAte(n, alvo), periodo, quando: periodo.rotulo,
      texto: n >= alvo
        ? `${n} de ${alvo} nesta semana, meta batida.`
        : `${n} de ${alvo} nesta semana.`,
    };
  }

  if (meta.tipo === 'tecnica') {
    /* aqui o número é o grau, e o app calcula sozinho a partir
       dos rolas. Somar na mão não faria sentido. */
    const alvo = Number(meta.grauAlvo) || 3;
    const t = tecnicas.find((x) => x.nome === meta.alvo);
    const quando = 'o grau de hoje, pelos seus rolas';
    if (!t) {
      return {
        conta: true, atual: 0, alvo, semBotao: true, pct: 0, valor: `grau 0 de ${alvo}`, quando,
        texto: 'Essa técnica ainda não apareceu em nenhum registro seu.',
      };
    }
    if (t.grau >= alvo) {
      return {
        conta: true, atual: t.grau, alvo, semBotao: true, pct: 100, concluida: true, valor: `grau ${t.grau} de ${alvo}`, quando,
        texto: `Chegou no ${grauPorN(t.grau).nome}.`,
      };
    }
    return {
      conta: true, atual: t.grau, alvo, semBotao: true, valor: `grau ${t.grau} de ${alvo}`, quando,
      pct: t.proximo === alvo ? t.progresso : Math.round((t.grau / alvo) * 100),
      texto: `Hoje está no ${grauPorN(t.grau).nome}, indo pro ${grauPorN(alvo).nome}.`,
    };
  }

  if (meta.tipo === 'defesa') {
    /* Aqui menos é melhor: o número é quantas vezes te pegaram,
       o objetivo é nenhuma, e a barra enche quando o número cai.
       Antes a tela mostrava "1/4", um teto menos as vezes, que
       ninguém entendia. A conta vem dos rolas, sem botão. */
    /* a do onboarding nasce sem técnica: sem alvo não há o que
       contar, e zero vezes de nada virava "meta feita" */
    if (!meta.alvo) {
      return {
        conta: true, invertida: true, semBotao: true, atual: 0, alvo: 0, pct: 0,
        valor: 'sem técnica', quando: 'Edite a meta e escolha a técnica que mais te pega',
        texto: 'Falta escolher qual técnica acompanhar.',
      };
    }
    /* Dias sem ser pego, até 30. Antes a meta contava as vezes nos
       últimos 30 dias e só enchia quando chegava a zero: a barra ficava
       parada em 0% por semanas e parecia impossível. Contando dias, ela
       anda todo dia que você treina sem bater, e volta ao zero se bater. */
    const b = buracos.find((x) => x.nome === meta.alvo);
    const dias = b?.ultima ? Math.max(0, diasEntre(b.ultima, hoje())) : DIAS_SEM_SER_PEGO;
    const feito = Math.min(dias, DIAS_SEM_SER_PEGO);
    const nome = String(meta.alvo).toLowerCase();
    return {
      conta: true,
      invertida: true,
      semBotao: true,
      atual: feito,
      alvo: DIAS_SEM_SER_PEGO,
      pct: pct(feito, DIAS_SEM_SER_PEGO),
      valor: `${feito} de ${DIAS_SEM_SER_PEGO} dias`,
      quando: b?.ultima ? `Sem bater pra ${nome} desde ${fmtData(b.ultima)}` : 'Nenhuma vez registrada',
      texto: feito >= DIAS_SEM_SER_PEGO
        ? `${DIAS_SEM_SER_PEGO} dias sem ${nome} te pegar. Meta batida.`
        : `${feito} ${feito === 1 ? 'dia' : 'dias'} sem ${nome} te pegar. A meta é ${DIAS_SEM_SER_PEGO}; se pegar de novo, a contagem recomeça.`,
    };
  }

  if (meta.tipo === 'treinos') {
    /* Todos os treinos registrados, sem recorte de período.
       É meta de marco: cem treinos é cem treinos. */
    const n = sessions.length;
    const alvo = Number(meta.alvo) || 1;
    return {
      conta: true, atual: n, alvo, pct: pct(n, alvo), valor: deAte(n, alvo), quando: 'Desde o primeiro treino',
      texto: n >= alvo
        ? `${n} treinos registrados, meta batida.`
        : `${n} de ${alvo} treinos. Faltam ${alvo - n}.`,
    };
  }

  if (meta.tipo === 'manual') {
    /* Este é o único que não calcula sozinho, porque o app não
       tem como saber. O número vem do botão. */
    const n = Number(meta.contador) || 0;
    const alvo = Number(meta.alvo) || 1;
    return {
      conta: true, atual: n, alvo, pct: pct(n, alvo), manual: true, valor: deAte(n, alvo), quando: 'Contado na mão',
      texto: n >= alvo ? `${n} de ${alvo}, meta batida.` : `${n} de ${alvo}.`,
    };
  }

  if (meta.tipo === 'aulas') {
    const periodo = periodoDaMeta(meta, 'ultimos-30');
    const n = dentroDoPeriodo(dados.aulas || [], periodo).length;
    const alvo = Number(meta.alvo) || 1;
    return {
      conta: true, atual: n, alvo, pct: pct(n, alvo), valor: deAte(n, alvo), periodo, quando: periodo.rotulo,
      texto: n >= alvo ? `${n} de ${alvo} aulas, meta batida.` : `${n} de ${alvo} aulas assistidas.`,
    };
  }

  if (meta.tipo === 'quiz') {
    const periodo = periodoDaMeta(meta, 'ultimos-30');
    const n = dentroDoPeriodo(dados.quiz || [], periodo).filter((q) => q.acertou).length;
    const alvo = Number(meta.alvo) || 1;
    return {
      conta: true, atual: n, alvo, pct: pct(n, alvo), valor: deAte(n, alvo), periodo, quando: periodo.rotulo,
      texto: `${n} de ${alvo} acertos.`,
    };
  }

  if (meta.tipo === 'rolas') {
    const periodo = periodoDaMeta(meta, 'ultimos-30');
    const ids = new Set(dentroDoPeriodo(sessions, periodo).map((s2) => s2.id));
    const n = (dados.rolls || []).filter((r) => ids.has(r.sessionId) && (r.contexto || 'rola') !== 'drill').length;
    const alvo = Number(meta.alvo) || 1;
    return {
      conta: true, atual: n, alvo, pct: pct(n, alvo), valor: deAte(n, alvo), periodo, quando: periodo.rotulo,
      texto: `${n} de ${alvo} rolas.`,
    };
  }

  if (meta.tipo === 'posicao') {
    const periodo = periodoDaMeta(meta, 'ultimos-30');
    const ids = new Set(dentroDoPeriodo(sessions, periodo).map((s2) => s2.id));
    const n = (dados.rolls || []).filter((r) => ids.has(r.sessionId) && r.posInicial === meta.alvo).length;
    const alvo = Number(meta.quantidade) || 10;
    return {
      conta: true, atual: n, alvo, pct: pct(n, alvo), valor: deAte(n, alvo), periodo, quando: periodo.rotulo,
      texto: n ? `${n} de ${alvo} rolas começando daí.` : 'Nenhum rola começou dessa posição ainda.',
    };
  }

  if (meta.tipo === 'volume') {
    const periodo = periodoDaMeta(meta, '3m');
    const min = dentroDoPeriodo(sessions, periodo).reduce((a, s) => a + (Number(s.duracao) || 0), 0);
    const h = Math.round(min / 60);
    const alvo = Number(meta.alvo) || 1;
    return {
      conta: true, atual: h, alvo, pct: pct(h, alvo), horas: true,
      valor: deAte(h, alvo, true), periodo, quando: periodo.rotulo, texto: `${h}h de ${alvo}h.`,
    };
  }

  if (meta.tipo === 'competicao') {
    /* contagem regressiva, não progresso. O botão não aparece
       porque ninguém adianta um campeonato no dedo. */
    const dias = meta.data ? diasEntre(hoje(), meta.data) : null;
    const prazo = meta.data ? Math.max(1, diasEntre(meta.criadoEm || hoje(), meta.data)) : 1;
    return {
      conta: true, semBotao: true,
      atual: dias === null ? 0 : Math.max(0, prazo - dias),
      alvo: prazo,
      valor: dias === null ? 'sem data' : dias > 0 ? `${dias} ${dias === 1 ? 'dia' : 'dias'}` : 'passou',
      quando: meta.data ? `Campeonato em ${fmtData(meta.data)}` : 'Sem data definida',
      pct: dias === null ? 0 : dias <= 0 ? 100 : Math.round(((prazo - dias) / prazo) * 100),
      texto: dias === null
        ? 'Sem data definida. Preencha quando souber.'
        : dias > 0
          ? `Faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}.`
          : 'A data já passou. Registre como foi em Treinos, no tipo Competição.',
    };
  }

  return { conta: true, pct: 0, texto: '' };
}

/* ============================================================
   O QUE MOSTRAR QUANDO NÃO HÁ META
   Nunca inventar. Só convidar.
   ============================================================ */
export function estadoSemMeta(faixa = 'branca', temTreinos = false) {
  if (!temTreinos) {
    return {
      titulo: 'Nenhuma meta por enquanto',
      texto: 'Registre alguns treinos primeiro. Com os dados na mão, as sugestões param de ser chute.',
      acao: 'Registrar treino',
    };
  }
  return {
    titulo: 'Nenhuma meta por enquanto',
    texto: faixa === 'branca'
      ? 'Você não precisa de meta pra evoluir no começo, mas ter uma ajuda a não sumir do tatame.'
      : 'Definir uma meta de processo, do tipo que depende só de você, costuma render mais que meta de resultado.',
    acao: 'Criar meta',
  };
}
