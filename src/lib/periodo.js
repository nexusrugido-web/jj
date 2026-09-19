import { hoje, addDias, diasEntre, pct, mesNome } from './utils';
import { placarDaRola } from './game';
import { somarPontos } from '../db/scoring';
import { FAIXA_ORDEM } from './utils';

/* ============================================================
   SÉRIES POR PERÍODO
   A granularidade se ajusta sozinha: 30 dias vira gráfico por
   dia, 6 meses por semana, 1 ano por mês. Sem isso, "30 dias"
   em barra mensal viraria um gráfico de dois pontos.
   ============================================================ */

export const PERIODOS = [
  { id: '30d', nome: '30 dias', dias: 30, grao: 'dia' },
  { id: '3m', nome: '3 meses', dias: 90, grao: 'semana' },
  { id: '6m', nome: '6 meses', dias: 182, grao: 'semana' },
  { id: '1a', nome: '1 ano', dias: 365, grao: 'mes' },
  { id: 'tudo', nome: 'Tudo', dias: null, grao: 'mes' },
];

export const METRICAS = [
  {
    id: 'vitorias',
    nome: 'Como você venceu',
    pergunta: 'Dos rolas que você ganhou, o que decidiu',
    desc: 'Só as vitórias. Cada cor é a forma como o rola terminou a seu favor.',
    eixoY: 'rolas vencidas',
    chaves: [
      { k: 'porFinalizacao', nome: 'Finalizei', cor: 'var(--jade)', explica: 'Você encaixou uma finalização e o parceiro bateu.' },
      { k: 'porPontos', nome: 'Venci nos pontos', cor: 'var(--roar)', explica: 'Ninguém finalizou, você terminou com mais pontos.' },
      { k: 'porVantagem', nome: 'Venci na vantagem', cor: 'var(--ice)', explica: 'Empate nos pontos, decidido na vantagem.' },
    ],
  },
  {
    id: 'derrotas',
    nome: 'Como você perdeu',
    pergunta: 'Dos rolas que você perdeu, o que decidiu',
    desc: 'Só as derrotas, separadas do mesmo jeito. Serve pra ver se você está perdendo por tap ou por controle.',
    eixoY: 'rolas perdidas',
    chaves: [
      { k: 'fuiFinalizado', nome: 'Fui finalizado', cor: 'var(--blood)', explica: 'Você bateu.' },
      { k: 'perdiPontos', nome: 'Perdi nos pontos', cor: 'var(--roar)', explica: 'Ninguém finalizou, ele terminou com mais pontos.' },
      { k: 'perdiVantagem', nome: 'Perdi na vantagem', cor: 'var(--dim)', explica: 'Empate nos pontos, decidido na vantagem.' },
    ],
  },
  {
    id: 'balanco',
    nome: 'Ganhou e perdeu',
    pergunta: 'Quantos rolas você ganhou e quantas perdeu',
    desc: 'As vitórias sobem, as derrotas descem. A linha do meio é o zero a zero.',
    eixoY: 'rolas',
    divergente: true,
    chaves: [
      { k: 'vitorias', nome: 'Venci', cor: 'var(--jade)', explica: 'Rolas que terminaram a seu favor, por qualquer motivo.' },
      { k: 'derrotas', nome: 'Perdi', cor: 'var(--blood)', explica: 'Rolas que terminaram contra você, por qualquer motivo.' },
    ],
  },
  {
    id: 'volume',
    nome: 'Volume de treino',
    pergunta: 'Quanto você treinou',
    desc: 'A coisa que mais prevê evolução. Nada supera tempo no tatame.',
    eixoY: 'quantidade',
    chaves: [
      { k: 'rolas', nome: 'Rolas', cor: 'var(--accent)', explica: 'Quantos rolas você registrou no período.' },
      { k: 'horas', nome: 'Horas', cor: 'var(--jade)', explica: 'Tempo total de treino somado.' },
    ],
  },
  {
    id: 'finalizacoes',
    nome: 'Finalizações',
    pergunta: 'Quantas você deu e quantas você levou',
    desc: 'Só os taps, dos dois lados.',
    eixoY: 'finalizações',
    chaves: [
      { k: 'subsFeitas', nome: 'Você aplicou', cor: 'var(--jade)', explica: 'Finalizações que você encaixou.' },
      { k: 'subsSofridas', nome: 'Você levou', cor: 'var(--blood)', explica: 'Finalizações que aplicaram em você.' },
    ],
  },
  {
    id: 'pontos',
    nome: 'Pontos IBJJF',
    pergunta: 'Quantos pontos você fez e quantos sofreu',
    desc: 'Queda 2, raspagem 2, joelho na barriga 2, passagem 3, montada 4, costas 4.',
    eixoY: 'pontos',
    chaves: [
      { k: 'ptsFeitos', nome: 'Você fez', cor: 'var(--jade)', explica: 'Soma dos pontos que você conquistou.' },
      { k: 'ptsSofridos', nome: 'Você sofreu', cor: 'var(--blood)', explica: 'Soma dos pontos que ele conquistou em você.' },
    ],
  },
  {
    id: 'diversidade',
    nome: 'Variedade técnica',
    pergunta: 'Quantas técnicas diferentes você usou',
    desc: 'Jogo de duas técnicas trava quando alguém já sabe o que vem.',
    eixoY: 'técnicas diferentes',
    chaves: [
      { k: 'tecnicasUnicas', nome: 'Técnicas diferentes', cor: 'var(--accent)', explica: 'Quantas técnicas distintas apareceram nas suas rolas.' },
    ],
  },
];

/* ---------- monta os baldes de tempo ---------- */
function baldes(periodo, primeiraData) {
  const fim = hoje();
  const p = PERIODOS.find((x) => x.id === periodo) || PERIODOS[2];

  let inicio;
  if (p.dias) inicio = addDias(fim, -(p.dias - 1));
  else inicio = primeiraData || addDias(fim, -365);

  const total = Math.max(1, diasEntre(inicio, fim) + 1);
  let grao = p.grao;
  if (!p.dias) grao = total > 400 ? 'mes' : total > 120 ? 'semana' : 'dia';

  const out = [];
  if (grao === 'dia') {
    for (let i = 0; i < total; i++) {
      const d = addDias(inicio, i);
      out.push({ chave: d, ini: d, fim: d, label: d.slice(8, 10) + '/' + d.slice(5, 7) });
    }
  } else if (grao === 'semana') {
    let cursor = inicio;
    const dow = (new Date(cursor + 'T00:00:00').getDay() + 6) % 7;
    cursor = addDias(cursor, -dow);
    while (cursor <= fim) {
      const f = addDias(cursor, 6);
      out.push({ chave: cursor, ini: cursor, fim: f, label: cursor.slice(8, 10) + '/' + cursor.slice(5, 7) });
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
      out.push({ chave: ini, ini, fim: f, label: mesNome(m), ano: y });
      m++; if (m > 11) { m = 0; y++; }
    }
  }
  return { linhas: out, grao, inicio, fim };
}

/* ---------- a série completa ---------- */
export function serieDoPeriodo(sessions, rolls, partners, periodo) {
  const datas = sessions.map((s) => s.data).filter(Boolean).sort();
  const { linhas, grao, inicio, fim } = baldes(periodo, datas[0]);

  const dataDe = new Map(sessions.map((s) => [s.id, s.data]));
  const faixaDe = new Map(partners.map((p) => [p.id, p.faixa || 'branca']));

  const serie = linhas.map((b) => {
    const ses = sessions.filter((s) => s.data >= b.ini && s.data <= b.fim);
    const ids = new Set(ses.map((s) => s.id));
    const rs = rolls.filter((r) => ids.has(r.sessionId));

    let porFinalizacao = 0, porPontos = 0, porVantagem = 0, empates = 0;
    let fuiFinalizado = 0, perdiPontos = 0, perdiVantagem = 0;
    let ptsFeitos = 0, ptsSofridos = 0;
    const tecnicas = new Set();

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

      for (const n of r.subsAplicadas || []) tecnicas.add(n);
      for (const nomes of Object.values(r.tecMeus || {})) for (const n of nomes) tecnicas.add(n);
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
      porFinalizacao, porPontos, porVantagem,
      fuiFinalizado, perdiPontos, perdiVantagem,
      derrotas, empates, vitorias,
      taxaVitoria: pct(vitorias, rs.length),
      ptsFeitos, ptsSofridos,
      saldo: ptsFeitos - ptsSofridos,
      subsFeitas: rs.flatMap((r) => r.subsAplicadas || []).length,
      subsSofridas: rs.flatMap((r) => r.subsSofridas || []).length,
      tecnicasUnicas: tecnicas.size,
      nivelMedio,
    };
  });

  return { serie, grao, inicio, fim };
}

const NOME_FAIXA = ['branca', 'azul', 'roxa', 'marrom', 'preta'];
export const faixaDoNivel = (n) => (n === null || n === undefined ? null : NOME_FAIXA[Math.round(n)] || 'branca');

/* ---------- totais + comparação com o período anterior ---------- */
export function totaisComparados(sessions, rolls, partners, periodo) {
  const p = PERIODOS.find((x) => x.id === periodo) || PERIODOS[2];
  const fim = hoje();

  const somar = (ini, f) => {
    const ses = sessions.filter((s) => s.data >= ini && s.data <= f);
    const ids = new Set(ses.map((s) => s.id));
    const rs = rolls.filter((r) => ids.has(r.sessionId));
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

  const dias = p.dias || 365;
  const iniAtual = addDias(fim, -(dias - 1));
  const atual = somar(iniAtual, fim);
  const anterior = somar(addDias(iniAtual, -dias), addDias(iniAtual, -1));

  const variar = (a, b) => {
    if (!b) return a > 0 ? { pct: null, novo: true } : { pct: 0 };
    return { pct: Math.round(((a - b) / b) * 100) };
  };

  return {
    atual, anterior,
    variacao: {
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

  const sobeTaxa = anterior.rolas > 0 && atual.taxaVitoria > anterior.taxaVitoria + 8;
  const caiNivel = atual.nivelMedio !== null && anterior.nivelMedio !== null &&
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
export function calendarioDoAno(sessions, rolls, ano) {
  const dataDe = new Map(sessions.map((s) => [s.id, s.data]));
  const porDia = new Map();

  for (const s of sessions) {
    if (!s.data || !s.data.startsWith(String(ano))) continue;
    const o = porDia.get(s.data) || { treinos: [], minutos: 0, rolas: 0, subsFeitas: 0, subsSofridas: 0 };
    o.treinos.push(s);
    o.minutos += Number(s.duracao) || 0;
    porDia.set(s.data, o);
  }
  for (const r of rolls) {
    const d = dataDe.get(r.sessionId);
    if (!d || !porDia.has(d)) continue;
    const o = porDia.get(d);
    o.rolas++;
    o.subsFeitas += (r.subsAplicadas || []).length;
    o.subsSofridas += (r.subsSofridas || []).length;
  }

  const meses = [];
  for (let m = 0; m < 12; m++) {
    const primeiro = new Date(ano, m, 1);
    const ultimo = new Date(ano, m + 1, 0).getDate();
    const offset = (primeiro.getDay() + 6) % 7; // segunda = 0
    const dias = [];
    for (let i = 0; i < offset; i++) dias.push(null);
    for (let d = 1; d <= ultimo; d++) {
      const iso = `${ano}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const info = porDia.get(iso);
      const min = info?.minutos || 0;
      dias.push({
        dia: d, iso, info,
        nivel: !min ? 0 : min < 45 ? 1 : min < 75 ? 2 : min < 120 ? 3 : 4,
        futuro: iso > hoje(),
        hoje: iso === hoje(),
      });
    }
    meses.push({ mes: m, nome: mesNome(m), dias });
  }

  const treinados = [...porDia.keys()].length;
  const minutos = [...porDia.values()].reduce((a, o) => a + o.minutos, 0);
  const rolasTotal = [...porDia.values()].reduce((a, o) => a + o.rolas, 0);

  // maior sequência do ano
  const ord = [...porDia.keys()].sort();
  let maior = 0, run = 0, prev = null;
  for (const d of ord) {
    run = prev && diasEntre(prev, d) === 1 ? run + 1 : 1;
    maior = Math.max(maior, run);
    prev = d;
  }

  // melhor mês
  const porMes = {};
  for (const [d, o] of porDia) {
    const m = Number(d.slice(5, 7)) - 1;
    porMes[m] = (porMes[m] || 0) + o.minutos;
  }
  const melhor = Object.entries(porMes).sort((a, b) => b[1] - a[1])[0];

  return {
    meses,
    resumo: {
      treinados,
      horas: Math.round(minutos / 60),
      rolas: rolasTotal,
      maiorSequencia: maior,
      mediaSemana: Number((treinados / 52).toFixed(1)),
      melhorMes: melhor ? { nome: mesNome(Number(melhor[0])), horas: Math.round(melhor[1] / 60) } : null,
    },
  };
}

export function anosComTreino(sessions) {
  const anos = [...new Set(sessions.map((s) => Number((s.data || '').slice(0, 4))).filter(Boolean))].sort((a, b) => b - a);
  const atual = new Date().getFullYear();
  if (!anos.includes(atual)) anos.unshift(atual);
  return anos;
}

/* ============================================================
   TAXA DE VITÓRIA POR FAIXA
   O número total mente. Ganhar 80% de faixa branca não é a
   mesma coisa que ganhar 30% de roxa, e é justamente o
   segundo que mostra evolução.
   ============================================================ */
const FAIXAS_ORDEM = ['branca', 'azul', 'roxa', 'marrom', 'preta'];

export function taxaPorFaixa(sessions, rolls, partners, periodo = 'tudo', minhaFaixa = 'branca') {
  const p = PERIODOS.find((x) => x.id === periodo) || PERIODOS[4];
  const fim = hoje();
  const ini = p.dias ? addDias(fim, -(p.dias - 1)) : '0000-01-01';

  const dataDe = new Map(sessions.map((s) => [s.id, s.data]));
  const faixaDe = new Map(partners.map((x) => [x.id, x.faixa || 'branca']));
  const graus = new Map(partners.map((x) => [x.id, x.graus || 0]));

  const zero = () => ({ n: 0, v: 0, d: 0, e: 0, fin: 0, pontos: 0, tap: 0, parceiros: new Set() });
  const mapa = Object.fromEntries(FAIXAS_ORDEM.map((f) => [f, zero()]));
  const total = zero();

  for (const r of rolls) {
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
    semParceiro: rolls.filter((r) => {
      const d = dataDe.get(r.sessionId);
      return d && d >= ini && d <= fim && !r.partnerId;
    }).length,
  };
}

/* ---------- calendário de um mês só ---------- */
export function mesDoCalendario(sessions, rolls, ano, mes) {
  const { meses } = calendarioDoAno(sessions, rolls, ano);
  return meses[mes];
}

export function mesesDisponiveis(sessions) {
  const set = new Set();
  for (const s of sessions) if (s.data) set.add(s.data.slice(0, 7));
  const agora = hoje().slice(0, 7);
  set.add(agora);
  return [...set].sort().reverse();
}

/* ============================================================
   A LINHA QUE SE ABRE PROS LADOS

   Um dia de treino entre dias vazios virava um espinho: a curva
   tinha que sair do zero no dia anterior e voltar ao zero no dia
   seguinte. Aqui cada valor vira um sino (uma gaussiana) que se
   abre pros baldes vizinhos, e a linha é o contorno dos sinos.

   O contorno é quase o máximo dos sinos, e não a soma: o pico de
   um dia continua na altura do valor dele, e dias seguidos com o
   mesmo valor viram um platô na mesma altura, sem inflar. O número
   exato de cada dia continua no toque.

   largura  em baldes: 1 quer dizer que o sino chega a 60% da
            altura no dia vizinho
   amostras quantos pontos por balde, pra curva sair lisa
   ============================================================ */
const EXPOENTE_DO_CONTORNO = 8;

export function contornoSuave(valores, { largura = 1, amostras = 8 } = {}) {
  const n = valores.length;
  if (!n) return [];
  const alcance = Math.ceil(largura * 3);
  const total = (n - 1) * amostras;
  const out = [];
  for (let k = 0; k <= total; k++) {
    const t = n === 1 ? 0 : k / amostras;
    let soma = 0;
    const de = Math.max(0, Math.floor(t) - alcance);
    const ate = Math.min(n - 1, Math.ceil(t) + alcance);
    for (let j = de; j <= ate; j++) {
      const v = Number(valores[j]) || 0;
      if (v <= 0) continue;
      const sino = v * Math.exp(-((t - j) ** 2) / (2 * largura * largura));
      soma += sino ** EXPOENTE_DO_CONTORNO;
    }
    out.push([t, soma ** (1 / EXPOENTE_DO_CONTORNO)]);
  }
  return out;
}

/* quanto o sino se abre: mais pontos no gráfico, sino mais largo
   em baldes, pra ele ocupar um pedaço parecido da tela */
export const larguraDoSino = (n) => Math.min(1.6, Math.max(0.8, n / 22));
