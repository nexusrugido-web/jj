import { hoje, addDias, diasEntre, pct, mesNome, fmtData, mesPorExtenso } from './utils';
import { placarDaRola } from './game';
import { somarPontos } from '../db/scoring';
import { FAIXA_ORDEM } from './utils';

/* ============================================================
   O PERÍODO DOS DADOS

   Um cadastro só de períodos com nome. Todo número que depende
   de tempo pede o período aqui, e o rótulo que aparece na tela
   sai do mesmo objeto que filtrou os dados: o que está escrito é
   o que foi contado.

   Início e fim inclusivos: "últimos 30 dias" é hoje e os 29 dias
   antes. A semana começa na segunda. As datas são o dia no
   calendário de quem usa, nunca o de Greenwich.

   desde   o primeiro dia de "desde o início" (o primeiro treino)
           e de "desde a meta" (o dia em que a meta foi criada)
   ============================================================ */
const CADASTRO_DE_PERIODOS = {
  'semana-atual': { rotulo: 'Esta semana', curto: 'Semana', grao: 'dia' },
  'ultimos-30': { rotulo: 'Últimos 30 dias', curto: '30 dias', dias: 30, grao: 'dia' },
  '3m': { rotulo: 'Últimos 3 meses', curto: '3 meses', dias: 90, grao: 'semana' },
  '6m': { rotulo: 'Últimos 6 meses', curto: '6 meses', dias: 182, grao: 'semana' },
  'ano-atual': { rotulo: 'Este ano' },
  'desde-inicio': { rotulo: 'Desde o início', curto: 'Tudo' },
  'desde-a-meta': { rotulo: 'Desde a meta', curto: 'Desde a meta' },
};

const segundaDa = (dia) => addDias(dia, -((new Date(dia + 'T00:00:00').getDay() + 6) % 7));

export function periodoDeDados(id, { hoje: dia = hoje(), desde = null } = {}) {
  const chave = CADASTRO_DE_PERIODOS[id] ? id : 'ultimos-30';
  const c = CADASTRO_DE_PERIODOS[chave];
  let ini = dia;
  let fim = dia;
  if (c.dias) ini = addDias(dia, -(c.dias - 1));
  else if (chave === 'semana-atual') { ini = segundaDa(dia); fim = addDias(ini, 6); }
  else if (chave === 'ano-atual') ini = `${dia.slice(0, 4)}-01-01`;
  else if (desde && desde < dia) ini = desde;
  const dias = diasEntre(ini, fim) + 1;
  const grao = c.grao || (dias > 400 ? 'mes' : dias > 120 ? 'semana' : 'dia');
  /* no botão, "este ano" é o próprio ano: cabe ao lado dos outros no celular */
  const rotuloCurto = chave === 'ano-atual' ? dia.slice(0, 4) : c.curto;
  return { id: chave, ini, fim, dias, grao, rotulo: c.rotulo, rotuloCurto };
}

/* os que dá pra escolher onde se analisa o jogo */
export const PRESETS = ['ultimos-30', '3m', '6m', 'ano-atual', 'desde-inicio'];

/* o primeiro treino, que é o começo de "desde o início" */
export const primeiroTreino = (sessions) =>
  sessions.reduce((a, s) => (s.data && (!a || s.data < a) ? s.data : a), null);

export const dentroDoPeriodo = (lista, periodo, campo = 'data') =>
  lista.filter((x) => x[campo] >= periodo.ini && x[campo] <= periodo.fim);

/* n dias até hoje, pra conta que não vai pra tela com nome
   (a carência de uma recomendação, o corte do plano grátis) */
export const ultimosDias = (n, { hoje: dia = hoje() } = {}) => ({ ini: addDias(dia, -(n - 1)), fim: dia, dias: n });

/* "Últimos 30 dias · 21/08 a 19/09", com o ano quando o intervalo vira o ano */
export function rotuloDoPeriodo(periodo) {
  const curto = periodo.ini.slice(0, 4) === periodo.fim.slice(0, 4);
  return `${periodo.rotulo} · ${fmtData(periodo.ini, { curto })} a ${fmtData(periodo.fim, { curto })}`;
}

export const METRICAS = [
  {
    id: 'vitorias',
    nome: 'Como você venceu',
    pergunta: 'Dos rolas que você ganhou, o que decidiu',
    desc: 'Só as vitórias: as que acabaram em tap e as que você ganhou no placar.',
    eixoY: 'rolas vencidos',
    /* as partes do mesmo todo vão empilhadas: a barra inteira é o total */
    empilhado: true,
    /* pontos e vantagem num balde só: vitória na vantagem é rara no
       treino, e a terceira linha ficava colada no zero, parecendo
       dado que faltou. A pergunta que importa é tap ou placar. */
    chaves: [
      { k: 'porFinalizacao', nome: 'Finalizei', cor: 'var(--jade)', explica: 'Você encaixou uma finalização e o parceiro bateu.' },
      { k: 'porPlacar', nome: 'No placar', cor: 'var(--jade-claro)', explica: 'Ninguém bateu: você terminou na frente nos pontos, ou empatou nos pontos e ganhou na vantagem.' },
    ],
  },
  {
    id: 'derrotas',
    nome: 'Como você perdeu',
    pergunta: 'Dos rolas que você perdeu, o que decidiu',
    desc: 'Só as derrotas, separadas do mesmo jeito. Serve pra ver se você está perdendo por tap ou por controle.',
    eixoY: 'rolas perdidos',
    empilhado: true,
    chaves: [
      { k: 'fuiFinalizado', nome: 'Fui finalizado', cor: 'var(--blood)', explica: 'Você bateu.' },
      { k: 'perdiPlacar', nome: 'No placar', cor: 'var(--blood-claro)', explica: 'Ninguém bateu: ele terminou na frente nos pontos, ou empatou nos pontos e ganhou na vantagem.' },
    ],
  },
  {
    id: 'balanco',
    nome: 'Ganhou e perdeu',
    pergunta: 'Quantos rolas você ganhou e quantos perdeu',
    desc: 'As vitórias sobem, as derrotas descem. A linha do meio é o zero a zero.',
    eixoY: 'rolas',
    divergente: true,
    chaves: [
      { k: 'vitorias', nome: 'Venci', cor: 'var(--jade)', explica: 'Rolas que terminaram a seu favor, por qualquer motivo.' },
      { k: 'derrotas', desce: true, nome: 'Perdi', cor: 'var(--blood)', explica: 'Rolas que terminaram contra você, por qualquer motivo.' },
    ],
  },
  {
    id: 'volume',
    nome: 'Volume de treino',
    pergunta: 'Quanto você treinou',
    desc: 'A coisa que mais prevê evolução. Nada supera tempo no tatame.',
    eixoY: 'rolas',
    /* rolas e horas no mesmo eixo não conversam (4 rolas, 1,5 hora):
       o gráfico conta rolas, e as horas ficam só no número de cima */
    chaves: [
      { k: 'rolas', nome: 'Rolas', cor: 'var(--accent)', explica: 'Quantos rolas você registrou.' },
    ],
    extras: [{ k: 'horas', nome: 'Horas', sufixo: 'h' }],
  },
  {
    id: 'finalizacoes',
    nome: 'Finalizações',
    pergunta: 'Quantas você deu e quantas você levou',
    desc: 'Só os taps, dos dois lados: os que você deu sobem, os que você levou descem.',
    eixoY: 'finalizações',
    divergente: true,
    chaves: [
      { k: 'subsFeitas', nome: 'Você aplicou', cor: 'var(--jade)', explica: 'Finalizações que você encaixou.' },
      { k: 'subsSofridas', desce: true, nome: 'Você levou', cor: 'var(--blood)', explica: 'Finalizações que aplicaram em você.' },
    ],
  },
  {
    id: 'pontos',
    nome: 'Pontos IBJJF',
    pergunta: 'Quantos pontos você fez e quantos sofreu',
    desc: 'Queda 2, raspagem 2, joelho na barriga 2, passagem 3, montada 4, costas 4.',
    eixoY: 'pontos',
    divergente: true,
    chaves: [
      { k: 'ptsFeitos', nome: 'Você fez', cor: 'var(--jade)', explica: 'Soma dos pontos que você conquistou.' },
      { k: 'ptsSofridos', desce: true, nome: 'Você sofreu', cor: 'var(--blood)', explica: 'Soma dos pontos que ele conquistou em você.' },
    ],
  },
];

/* ---------- monta os baldes de tempo ----------
   A granularidade vem do período: 30 dias por dia, 3 e 6 meses
   por semana, o resto pelo tamanho. O primeiro e o último balde
   são cortados nas pontas do período, pra semana ou o mês que
   começa antes (ou termina depois) não contar dia de fora. */
function baldes(p) {
  const { ini: inicio, fim, grao } = p;
  const dentro = (b) => ({ ...b, ini: b.ini < inicio ? inicio : b.ini, fim: b.fim > fim ? fim : b.fim });

  const out = [];
  if (grao === 'dia') {
    for (let d = inicio; d <= fim; d = addDias(d, 1)) {
      out.push({ chave: d, ini: d, fim: d, label: d.slice(8, 10) + '/' + d.slice(5, 7) });
    }
  } else if (grao === 'semana') {
    let cursor = segundaDa(inicio);
    while (cursor <= fim) {
      const b = dentro({ chave: cursor, ini: cursor, fim: addDias(cursor, 6) });
      out.push({ ...b, label: b.ini.slice(8, 10) + '/' + b.ini.slice(5, 7) });
      cursor = addDias(cursor, 7);
    }
  } else {
    const d0 = new Date(inicio + 'T00:00:00');
    const d1 = new Date(fim + 'T00:00:00');
    let y = d0.getFullYear(), m = d0.getMonth();
    while (y < d1.getFullYear() || (y === d1.getFullYear() && m <= d1.getMonth())) {
      const ini = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const ult = new Date(y, m + 1, 0).getDate();
      const f = `${y}-${String(m + 1).padStart(2, '0')}-${String(ult).padStart(2, '0')}`;
      out.push({ ...dentro({ chave: ini, ini, fim: f }), label: mesNome(m), ano: y });
      m++; if (m > 11) { m = 0; y++; }
    }
  }
  return { linhas: out, grao, inicio, fim };
}

/* Drill não é luta: a mesma regra do resumo, das metas e dos graus */
const ehLuta = (r) => (r.contexto || 'rola') !== 'drill';

/* ---------- a série completa ---------- */
export function serieDoPeriodo(sessions, rolls, partners, periodo) {
  const { linhas, grao, inicio, fim } = baldes(periodo);
  const lutas = rolls.filter(ehLuta);

  const dataDe = new Map(sessions.map((s) => [s.id, s.data]));
  const faixaDe = new Map(partners.map((p) => [p.id, p.faixa || 'branca']));

  const serie = linhas.map((b) => {
    const ses = sessions.filter((s) => s.data >= b.ini && s.data <= b.fim);
    const ids = new Set(ses.map((s) => s.id));
    const rs = lutas.filter((r) => ids.has(r.sessionId));

    let porFinalizacao = 0, porPontos = 0, porVantagem = 0, empates = 0;
    let fuiFinalizado = 0, perdiPontos = 0, perdiVantagem = 0;
    let ptsFeitos = 0, ptsSofridos = 0;

    for (const r of rs) {
      const pl = placarDaRola(r);
      if (pl.resultado === 'finalizei') porFinalizacao++;
      else if (pl.resultado === 'venci_pontos') porPontos++;
      else if (pl.resultado === 'venci_vantagem') porVantagem++;
      else if (pl.resultado === 'fui_finalizado') fuiFinalizado++;
      else if (pl.resultado === 'perdi_pontos') perdiPontos++;
      else if (pl.resultado === 'perdi_vantagem') perdiVantagem++;
      else empates++;

      ptsFeitos += somarPontos(r.ptsMeus);
      ptsSofridos += somarPontos(r.ptsDele);
    }

    const vitorias = porFinalizacao + porPontos + porVantagem;
    const derrotas = fuiFinalizado + perdiPontos + perdiVantagem;
    const minutos = ses.reduce((a, s) => a + (Number(s.duracao) || 0), 0);

    // nível médio dos parceiros, o número que impede a taxa de mentir
    const niveis = rs.map((r) => FAIXA_ORDEM[faixaDe.get(r.partnerId)] ?? null).filter((x) => x !== null);
    const nivelMedio = niveis.length ? niveis.reduce((a, b) => a + b, 0) / niveis.length : null;

    return {
      ...b,
      sessoes: ses.length,
      rolas: rs.length,
      minutos,
      horas: Number((minutos / 60).toFixed(1)),
      porFinalizacao, porPlacar: porPontos + porVantagem,
      fuiFinalizado, perdiPlacar: perdiPontos + perdiVantagem,
      derrotas, empates, vitorias,
      taxaVitoria: pct(vitorias, rs.length),
      ptsFeitos, ptsSofridos,
      saldo: ptsFeitos - ptsSofridos,
      subsFeitas: rs.flatMap((r) => r.subsAplicadas || []).length,
      subsSofridas: rs.flatMap((r) => r.subsSofridas || []).length,
      nivelMedio,
    };
  });

  return { serie, grao, inicio, fim };
}

const NOME_FAIXA = ['branca', 'azul', 'roxa', 'marrom', 'preta'];
export const faixaDoNivel = (n) => (n === null || n === undefined ? null : NOME_FAIXA[Math.round(n)] || 'branca');

/* ---------- totais + comparação com o período anterior ----------
   O anterior tem o mesmo tamanho e acaba na véspera do início.
   "Este ano" compara com o mesmo trecho do ano passado, e "desde
   o início" não tem com o que comparar. */
export function totaisComparados(sessions, rolls, partners, periodo) {
  const lutas = rolls.filter(ehLuta);

  const somar = (ini, f) => {
    const ses = sessions.filter((s) => s.data >= ini && s.data <= f);
    const ids = new Set(ses.map((s) => s.id));
    const rs = lutas.filter((r) => ids.has(r.sessionId));
    const faixaDe = new Map(partners.map((x) => [x.id, x.faixa || 'branca']));

    let v = 0, d = 0, fin = 0, pts = 0;
    const tecnicas = new Set();
    for (const r of rs) {
      const pl = placarDaRola(r);
      if (pl.ganhou) v++; else if (pl.perdeu) d++;
      if (pl.resultado === 'finalizei') fin++;
      pts += somarPontos(r.ptsMeus);
      for (const n of r.subsAplicadas || []) tecnicas.add(n);
      for (const nomes of Object.values(r.tecMeus || {})) for (const n of nomes) tecnicas.add(n);
    }
    const niveis = rs.map((r) => FAIXA_ORDEM[faixaDe.get(r.partnerId)] ?? null).filter((x) => x !== null);
    return {
      sessoes: ses.length,
      rolas: rs.length,
      horas: Math.round(ses.reduce((a, s) => a + (Number(s.duracao) || 0), 0) / 60),
      vitorias: v, derrotas: d,
      taxaVitoria: pct(v, rs.length),
      porFinalizacao: fin,
      pontos: pts,
      tecnicasUnicas: tecnicas.size,
      nivelMedio: niveis.length ? niveis.reduce((a, b) => a + b, 0) / niveis.length : null,
    };
  };

  const atual = somar(periodo.ini, periodo.fim);
  let anterior = null;
  if (periodo.id === 'ano-atual') {
    const ano = Number(periodo.ini.slice(0, 4)) - 1;
    anterior = somar(`${ano}-01-01`, `${ano}${periodo.fim.slice(4)}`);
  } else if (periodo.id !== 'desde-inicio') {
    anterior = somar(addDias(periodo.ini, -periodo.dias), addDias(periodo.ini, -1));
  }

  const variar = (a, b) => {
    if (!b) return a > 0 ? { pct: null, novo: true } : { pct: 0 };
    return { pct: Math.round(((a - b) / b) * 100) };
  };

  return {
    atual, anterior,
    variacao: !anterior ? {} : {
      sessoes: variar(atual.sessoes, anterior.sessoes),
      rolas: variar(atual.rolas, anterior.rolas),
      horas: variar(atual.horas, anterior.horas),
      taxaVitoria: variar(atual.taxaVitoria, anterior.taxaVitoria),
      pontos: variar(atual.pontos, anterior.pontos),
      tecnicasUnicas: variar(atual.tecnicasUnicas, anterior.tecnicasUnicas),
    },
  };
}

/* ---------- o aviso honesto sobre a taxa de vitória ---------- */
export function contextoDaVitoria(atual, anterior) {
  if (!atual.rolas) return null;

  const sobeTaxa = anterior?.rolas > 0 && atual.taxaVitoria > anterior.taxaVitoria + 8;
  const caiNivel = atual.nivelMedio !== null && anterior?.nivelMedio != null &&
    atual.nivelMedio < anterior.nivelMedio - 0.25;

  if (sobeTaxa && caiNivel) {
    return {
      tom: 'atencao',
      titulo: 'Sua taxa subiu, mas o nível dos parceiros caiu',
      texto: `Você venceu mais, só que rolando com faixas mais baixas que no período anterior. Taxa de vitória só significa alguma coisa comparada com quem estava do outro lado.`,
    };
  }
  if (atual.nivelMedio !== null && atual.nivelMedio >= 1 && atual.taxaVitoria < 40) {
    return {
      tom: 'bom',
      titulo: 'Perdendo para gente melhor, é assim que se evolui',
      texto: `Taxa de ${atual.taxaVitoria}%, mas a média dos seus parceiros é faixa ${faixaDoNivel(atual.nivelMedio)}. Rolar acima do seu nível é o caminho mais rápido, mesmo doendo no placar.`,
    };
  }
  if (atual.nivelMedio !== null && atual.nivelMedio < 0.3 && atual.rolas >= 8) {
    return {
      tom: 'atencao',
      titulo: 'Você está rolando quase só com faixa branca',
      texto: 'Procure os mais graduados. É desconfortável e é exatamente por isso que funciona.',
    };
  }
  return null;
}

/* ---------- marcadores de graduação na linha do tempo ---------- */
export function marcadoresGraduacao(gradings, serie) {
  if (!serie.length) return [];
  return (gradings || [])
    .filter((g) => g.data >= serie[0].ini && g.data <= serie[serie.length - 1].fim)
    .map((g) => {
      const idx = serie.findIndex((b) => g.data >= b.ini && g.data <= b.fim);
      if (idx < 0) return null;
      return {
        idx,
        data: g.data,
        label: g.tipo === 'faixa' ? `Faixa ${g.faixa}` : `${g.graus}º grau`,
      };
    })
    .filter(Boolean);
}

/* ---------- dados do calendário ---------- */
/* o que cada dia de ini a fim teve de treino */
function treinosPorDia(sessions, rolls, ini, fim) {
  const dataDe = new Map(sessions.map((s) => [s.id, s.data]));
  const porDia = new Map();

  for (const s of sessions) {
    if (!s.data || s.data < ini || s.data > fim) continue;
    const o = porDia.get(s.data) || { treinos: [], minutos: 0, rolas: 0, subsFeitas: 0, subsSofridas: 0 };
    o.treinos.push(s);
    o.minutos += Number(s.duracao) || 0;
    porDia.set(s.data, o);
  }
  for (const r of rolls.filter(ehLuta)) {
    const d = dataDe.get(r.sessionId);
    if (!d || !porDia.has(d)) continue;
    const o = porDia.get(d);
    o.rolas++;
    o.subsFeitas += (r.subsAplicadas || []).length;
    o.subsSofridas += (r.subsSofridas || []).length;
  }
  return porDia;
}

/* os dias de ini a fim, com o vazio antes pra semana começar na segunda */
function diasEmSemanas(ini, fim, porDia) {
  const agora = hoje();
  const offset = (new Date(ini + 'T00:00:00').getDay() + 6) % 7;
  const dias = Array(offset).fill(null);
  for (let iso = ini; iso <= fim; iso = addDias(iso, 1)) {
    const info = porDia.get(iso);
    const min = info?.minutos || 0;
    dias.push({
      dia: Number(iso.slice(8, 10)), iso, info,
      nivel: !min ? 0 : min < 45 ? 1 : min < 75 ? 2 : min < 120 ? 3 : 4,
      futuro: iso > agora,
      hoje: iso === agora,
    });
  }
  return dias;
}

function resumoDosDias(porDia, semanas) {
  const minutos = [...porDia.values()].reduce((a, o) => a + o.minutos, 0);
  const rolas = [...porDia.values()].reduce((a, o) => a + o.rolas, 0);

  // maior sequência
  const ord = [...porDia.keys()].sort();
  let maior = 0, run = 0, prev = null;
  for (const d of ord) {
    run = prev && diasEntre(prev, d) === 1 ? run + 1 : 1;
    maior = Math.max(maior, run);
    prev = d;
  }

  return {
    treinados: porDia.size,
    minutos,
    horas: Math.round(minutos / 60),
    rolas,
    maiorSequencia: maior,
    mediaSemana: Number((porDia.size / semanas).toFixed(1)),
  };
}

const pad2 = (n) => String(n).padStart(2, '0');
const fimDoMes = (ano, mes) => `${ano}-${pad2(mes + 1)}-${pad2(new Date(ano, mes + 1, 0).getDate())}`;

/* ---------- os últimos 30 dias, pro calendário da tela ----------
   A mesma janela de "últimos 30 dias" dos números, com o resumo
   só desses dias. */
export function janelaDoCalendario(sessions, rolls, { fim = hoje() } = {}) {
  const p = periodoDeDados('ultimos-30', { hoje: fim });
  const porDia = treinosPorDia(sessions, rolls, p.ini, p.fim);
  return {
    ini: p.ini,
    fim: p.fim,
    rotulo: p.rotulo,
    dias: diasEmSemanas(p.ini, p.fim, porDia),
    resumo: resumoDosDias(porDia, p.dias / 7),
  };
}

/* ============================================================
   TAXA DE VITÓRIA POR FAIXA
   O número total mente. Ganhar 80% de faixa branca não é a
   mesma coisa que ganhar 30% de roxa, e é justamente o
   segundo que mostra evolução.
   ============================================================ */
const FAIXAS_ORDEM = ['branca', 'azul', 'roxa', 'marrom', 'preta'];

export function taxaPorFaixa(sessions, rolls, partners, periodo, minhaFaixa = 'branca') {
  const { ini, fim } = periodo;
  const lutas = rolls.filter(ehLuta);

  const dataDe = new Map(sessions.map((s) => [s.id, s.data]));
  const faixaDe = new Map(partners.map((x) => [x.id, x.faixa || 'branca']));
  const graus = new Map(partners.map((x) => [x.id, x.graus || 0]));

  const zero = () => ({ n: 0, v: 0, d: 0, e: 0, fin: 0, pontos: 0, tap: 0, parceiros: new Set() });
  const mapa = Object.fromEntries(FAIXAS_ORDEM.map((f) => [f, zero()]));
  const total = zero();

  for (const r of lutas) {
    const d = dataDe.get(r.sessionId);
    if (!d || d < ini || d > fim) continue;
    if (!r.partnerId) continue;

    const f = faixaDe.get(r.partnerId) || 'branca';
    const o = mapa[f];
    if (!o) continue;

    const pl = placarDaRola(r);
    for (const alvo of [o, total]) {
      alvo.n++;
      if (pl.ganhou) alvo.v++;
      else if (pl.perdeu) alvo.d++;
      else alvo.e++;
      if (pl.resultado === 'finalizei') alvo.fin++;
      if (pl.resultado === 'venci_pontos' || pl.resultado === 'venci_vantagem') alvo.pontos++;
      alvo.tap += (r.subsSofridas || []).length;
      alvo.parceiros.add(r.partnerId);
    }
  }

  const minha = FAIXAS_ORDEM.indexOf(minhaFaixa);
  const linhas = FAIXAS_ORDEM.map((f, i) => {
    const o = mapa[f];
    return {
      faixa: f,
      ...o,
      parceiros: o.parceiros.size,
      taxa: pct(o.v, o.n),
      acima: i > minha,
      igual: i === minha,
      abaixo: i < minha,
    };
  }).filter((l) => l.n > 0);

  const contraAcima = linhas.filter((l) => l.acima).reduce((a, l) => ({ n: a.n + l.n, v: a.v + l.v }), { n: 0, v: 0 });
  const contraIgual = linhas.filter((l) => l.igual).reduce((a, l) => ({ n: a.n + l.n, v: a.v + l.v }), { n: 0, v: 0 });
  const contraAbaixo = linhas.filter((l) => l.abaixo).reduce((a, l) => ({ n: a.n + l.n, v: a.v + l.v }), { n: 0, v: 0 });

  return {
    linhas,
    total: { ...total, parceiros: total.parceiros.size, taxa: pct(total.v, total.n) },
    contraAcima: { ...contraAcima, taxa: pct(contraAcima.v, contraAcima.n) },
    contraIgual: { ...contraIgual, taxa: pct(contraIgual.v, contraIgual.n) },
    contraAbaixo: { ...contraAbaixo, taxa: pct(contraAbaixo.v, contraAbaixo.n) },
    semParceiro: lutas.filter((r) => {
      const d = dataDe.get(r.sessionId);
      return d && d >= ini && d <= fim && !r.partnerId;
    }).length,
  };
}

/* ---------- calendário de um mês só, pro histórico ----------
   O resumo é só desse mês, e a média por semana conta até hoje
   quando o mês ainda não acabou. */
export function mesDoCalendario(sessions, rolls, ano, mes) {
  const ini = `${ano}-${pad2(mes + 1)}-01`;
  const fim = fimDoMes(ano, mes);
  const porDia = treinosPorDia(sessions, rolls, ini, fim);
  const corridos = diasEntre(ini, fim < hoje() ? fim : hoje()) + 1;
  return {
    mes, ano, ini, fim,
    nome: mesNome(mes),
    rotulo: mesPorExtenso(ini),
    dias: diasEmSemanas(ini, fim, porDia),
    resumo: resumoDosDias(porDia, Math.max(1, corridos) / 7),
  };
}

/* ============================================================
   AS BARRAS DO GRÁFICO

   Cada dia (ou semana, ou mês) vira uma barra por série, na altura
   exata do valor. Balde vazio não tem barra: dia sem treino fica
   vazio. A curva que vinha antes se abria pros dias vizinhos e
   desenhava um morrinho em dia sem treino, e o toque ali dizia
   "sem treino registrado".
   ============================================================ */
export function barrasDoGrafico(serie, chaves) {
  const out = [];
  serie.forEach((s, i) => {
    for (const k of chaves) {
      const v = s[k] || 0;
      if (v > 0) out.push({ i, k, v });
    }
  });
  return out;
}
