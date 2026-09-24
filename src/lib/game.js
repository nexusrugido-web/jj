import {
  PONTOS, pontosPorId, somarPontos, EIXOS, ESTILOS, estiloPorId,
  posInicialPorId, pesoRelPorId, PESO_REL,
} from '../db/scoring';
import { FAIXA_ORDEM, pct } from './utils';

/* ============================================================
   MEU JOGO
   Tudo aqui sai dos pontos e finalizações que você registrou.
   Nada de "eu acho que sou guardeiro", os números decidem.
   ============================================================ */

export const MIN_ROLAS_ESTILO = 15; // abaixo disso é chute, não dado

/* placar de um rola */
export function placarDaRola(r) {
  const meus = somarPontos(r.ptsMeus);
  const dele = somarPontos(r.ptsDele);
  const finMeus = (r.subsAplicadas || []).length;
  const finDele = (r.subsSofridas || []).length;

  /* no treino o rola recomeça depois do tap: quem finalizou mais
     vezes ganhou. Empatou nas finalizações, decidem os pontos e
     depois a vantagem; troca de taps é só quando empata em tudo */
  let resultado = finMeus > 0 ? 'ambos' : 'empate';
  if (finMeus > finDele) resultado = 'finalizei';
  else if (finDele > finMeus) resultado = 'fui_finalizado';
  else if (meus > dele) resultado = 'venci_pontos';
  else if (dele > meus) resultado = 'perdi_pontos';
  else if ((r.vantMinhas || 0) > (r.vantDele || 0)) resultado = 'venci_vantagem';
  else if ((r.vantDele || 0) > (r.vantMinhas || 0)) resultado = 'perdi_vantagem';

  const ganhou = ['finalizei', 'venci_pontos', 'venci_vantagem'].includes(resultado);
  const perdeu = ['fui_finalizado', 'perdi_pontos', 'perdi_vantagem'].includes(resultado);

  return { meus, dele, saldo: meus - dele, finMeus, finDele, resultado, ganhou, perdeu };
}

export const ROTULO_RESULTADO = {
  finalizei: 'Finalizei',
  fui_finalizado: 'Fui finalizado',
  ambos: 'Trocamos taps',
  venci_pontos: 'Venci nos pontos',
  perdi_pontos: 'Perdi nos pontos',
  venci_vantagem: 'Venci na vantagem',
  perdi_vantagem: 'Perdi na vantagem',
  empate: 'Empate',
};

export const TOM_RESULTADO = {
  finalizei: 'jade', venci_pontos: 'jade', venci_vantagem: 'jade',
  fui_finalizado: 'blood', perdi_pontos: 'blood', perdi_vantagem: 'blood',
  ambos: 'warn', empate: '',
};

/* ---------- resumo geral do jogo ---------- */
export function analisarJogo(rolls, partners, sessions, faixaUsuario = 'branca') {
  const faixaDe = new Map(partners.map((p) => [p.id, p.faixa || 'branca']));
  const minhaOrdem = FAIXA_ORDEM[faixaUsuario] ?? 0;

  /* Um rola 0x0 TAMBÉM é dado: significa que ninguém pontuou.
     Só ficam de fora os rolas antigas, registradas antes do placar existir,
     e o drill, que não é luta: a mesma regra do Painel e da Análise. */
  const comDados = rolls.filter((r) => (r.contexto || 'rola') !== 'drill' && (
    r.v2 ||
    (r.ptsMeus || []).length || (r.ptsDele || []).length ||
    (r.subsAplicadas || []).length || (r.subsSofridas || []).length ||
    r.posInicial || r.pesoRel
  ));

  let vitorias = 0, derrotas = 0, empates = 0;
  let ptsMeus = 0, ptsDele = 0, minutos = 0;
  const conquistei = {};
  const sofri = {};
  const porFaixa = new Map();
  const porPeso = new Map();
  const porPosicao = new Map();
  let vantMinhas = 0, vantDele = 0;

  for (const r of comDados) {
    const p = placarDaRola(r);
    if (p.ganhou) vitorias++;
    else if (p.perdeu) derrotas++;
    else empates++;

    ptsMeus += p.meus;
    ptsDele += p.dele;
    minutos += Number(r.duracao) || 0;
    vantMinhas += Number(r.vantMinhas) || 0;
    vantDele += Number(r.vantDele) || 0;

    for (const id of r.ptsMeus || []) conquistei[id] = (conquistei[id] || 0) + 1;
    for (const id of r.ptsDele || []) sofri[id] = (sofri[id] || 0) + 1;

    const faixa = faixaDe.get(r.partnerId) || 'branca';
    acumula(porFaixa, faixa, p);

    if (r.pesoRel) acumula(porPeso, r.pesoRel, p);
    if (r.posInicial) acumula(porPosicao, r.posInicial, p);
  }

  const n = comDados.length;
  const { eixos, bruto } = calcularEixos(conquistei, sofri, comDados);
  const estilo = detectarEstilo(bruto, n);

  return {
    rolas: n,
    suficiente: n >= MIN_ROLAS_ESTILO,
    faltam: Math.max(0, MIN_ROLAS_ESTILO - n),
    vitorias, derrotas, empates,
    taxaVitoria: pct(vitorias, n),
    ptsMeus, ptsDele,
    saldo: ptsMeus - ptsDele,
    mediaMeus: n ? Number((ptsMeus / n).toFixed(1)) : 0,
    mediaDele: n ? Number((ptsDele / n).toFixed(1)) : 0,
    porMinuto: minutos ? Number((ptsMeus / minutos).toFixed(2)) : 0,
    vantMinhas, vantDele,
    conquistei: distribuir(conquistei),
    sofri: distribuir(sofri),
    porFaixa: [...porFaixa.entries()].map(([k, v]) => ({ chave: k, ...v })).sort((a, b) => (FAIXA_ORDEM[a.chave] ?? 0) - (FAIXA_ORDEM[b.chave] ?? 0)),
    porPeso: PESO_REL.map((p) => ({ chave: p.id, nome: p.nome, icone: p.icone, ...(porPeso.get(p.id) || vazio()) })).filter((x) => x.n > 0),
    porPosicao: [...porPosicao.entries()].map(([k, v]) => ({ chave: k, nome: posInicialPorId[k]?.nome || k, ...v })).sort((a, b) => b.n - a.n),
    eixos,
    estilo,
  };
}

const vazio = () => ({ n: 0, v: 0, d: 0, meus: 0, dele: 0 });

function acumula(mapa, chave, p) {
  const o = mapa.get(chave) || vazio();
  o.n++;
  if (p.ganhou) o.v++;
  else if (p.perdeu) o.d++;
  o.meus += p.meus;
  o.dele += p.dele;
  mapa.set(chave, o);
}

function distribuir(obj) {
  const total = Object.values(obj).reduce((a, b) => a + b, 0);
  return PONTOS
    .map((p) => ({ ...p, n: obj[p.id] || 0, pct: pct(obj[p.id] || 0, total), total: (obj[p.id] || 0) * p.pts }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
}

/* ---------- os seis eixos, de 0 a 100 ---------- */
function calcularEixos(conquistei, sofri, rolls) {
  const n = Math.max(1, rolls.length);
  const porRola = (v) => v / n;

  const finalizacoes = rolls.flatMap((r) => r.subsAplicadas || []).length;
  const sofridas = rolls.flatMap((r) => r.subsSofridas || []).length;
  const passagensSofridas = sofri.passagem || 0;

  // bruto = quantas vezes por rola, normalizado pelo alvo. Pode passar de 1.
  const bruto = {
    queda: porRola(conquistei.queda || 0) / 0.5,
    passagem: porRola(conquistei.passagem || 0) / 0.6,
    raspagem: porRola(conquistei.raspagem || 0) / 0.6,
    controle: porRola((conquistei.montada || 0) + (conquistei.costas || 0) + (conquistei.joelho || 0)) / 0.7,
    finalizacao: porRola(finalizacoes) / 0.5,
    defesa: Math.max(0, 1 - porRola(passagensSofridas + sofridas) / 1.0),
  };

  // exibido = fatiado em 0-100
  const eixos = {};
  for (const [k, v] of Object.entries(bruto)) eixos[k] = Math.min(100, Math.round(v * 100));

  return { eixos, bruto };
}

/* ---------- o estilo que os dados dizem ---------- */
function detectarEstilo(bruto, n) {
  if (n < MIN_ROLAS_ESTILO) return null;

  // a defesa não deve ganhar de um jogo ofensivo: só conta se o resto for fraco
  const ofensivos = ['queda', 'passagem', 'raspagem', 'controle', 'finalizacao'];
  const picoOfensivo = Math.max(...ofensivos.map((k) => bruto[k] || 0));

  const ordenado = ofensivos
    .map((k) => [k, bruto[k] || 0])
    .sort((a, b) => b[1] - a[1]);

  const [topo, valor] = ordenado[0];
  const [segundoNome, segundo] = ordenado[1] || [null, 0];

  // quase nada acontecendo: quem não pontua mas também não sofre é sobrevivente
  if (picoOfensivo < 0.25) {
    if ((bruto.defesa || 0) >= 0.6) {
      return { id: 'defensor', confianca: 60 + Math.min(20, n - MIN_ROLAS_ESTILO), dominante: 'defesa', valor: Math.round((bruto.defesa || 0) * 100) };
    }
    return { id: 'completo', confianca: 40, dominante: null, valor: Math.round(valor * 100) };
  }

  // combinações: passagem e controle são o mesmo jogo (por cima)
  const porCima = (bruto.passagem || 0) + (bruto.controle || 0);
  const porBaixo = (bruto.raspagem || 0) + (bruto.finalizacao || 0) * 0.5;
  const emPe = bruto.queda || 0;

  let id = null;
  let dominante = topo;

  if ((topo === 'passagem' || topo === 'controle') && (segundoNome === 'passagem' || segundoNome === 'controle')) {
    // os dois no topo: quem manda é o maior dos dois
    id = (bruto.passagem || 0) >= (bruto.controle || 0) ? 'passador' : 'controlador';
    dominante = (bruto.passagem || 0) >= (bruto.controle || 0) ? 'passagem' : 'controle';
  } else if (emPe >= porCima * 0.8 && emPe >= porBaixo * 0.8 && topo === 'queda') {
    id = 'quedador';
  } else {
    const mapa = {
      queda: 'quedador', passagem: 'passador', raspagem: 'guardeiro',
      finalizacao: 'finalizador', controle: 'controlador',
    };
    id = mapa[topo];
  }

  // sem pico claro entre eixos de jogos DIFERENTES = completo
  const mesmaFamilia = new Set(['passagem', 'controle']);
  const familiaIgual = mesmaFamilia.has(topo) && mesmaFamilia.has(segundoNome);
  if (!familiaIgual && valor > 0 && (valor - segundo) / valor < 0.18) {
    return { id: 'completo', confianca: 55, dominante: null, valor: Math.round(valor * 100) };
  }

  const gap = valor > 0 ? ((valor - segundo) / valor) * 100 : 0;
  const confianca = Math.min(95, Math.round(50 + gap * 0.5 + Math.min(20, n - MIN_ROLAS_ESTILO)));
  return { id, confianca, dominante, valor: Math.round(valor * 100) };
}

/* ---------- leitura em texto: o que os números gritam ---------- */
export function lerJogo(a) {
  const notas = [];
  if (!a.rolas) return notas;

  const topoConq = a.conquistei[0];
  const topoSofri = a.sofri[0];

  if (topoConq && topoConq.pct >= 40) {
    notas.push({
      tom: 'jade',
      titulo: `${topoConq.pct}% do que você conquista vem de ${topoConq.nome.toLowerCase()}`,
      texto: 'Esse é o seu caminho natural pra pontuar. Vale afiar mais ainda, e ter um plano B pra quando fecharem essa porta.',
    });
  }
  if (topoSofri && topoSofri.pct >= 40) {
    notas.push({
      tom: 'blood',
      titulo: `${topoSofri.pct}% do que você concede é ${topoSofri.nome.toLowerCase()}`,
      texto: topoSofri.id === 'passagem'
        ? 'Sua retenção de guarda é o buraco. Peça sparring posicional começando na guarda aberta com o cara já pressionando.'
        : 'Isso é o furo mais caro do seu jogo agora. Uma aula focada só na defesa disso muda seu mês.',
    });
  }

  const semQueda = !a.conquistei.find((c) => c.id === 'queda');
  if (semQueda && a.rolas >= 10) {
    notas.push({
      tom: 'warn',
      titulo: 'Você nunca pontuou em pé',
      texto: 'Ou você puxa guarda sempre, ou o jogo em pé está fora do radar. Em competição isso custa 2 pontos de graça.',
    });
  }

  const pesado = a.porPeso.find((p) => p.chave === 'pesado');
  const leve = a.porPeso.find((p) => p.chave === 'leve');
  if (pesado && leve && pesado.n >= 4 && leve.n >= 4) {
    const tp = pct(pesado.v, pesado.n);
    const tl = pct(leve.v, leve.n);
    if (tl - tp >= 30) {
      notas.push({
        tom: 'warn',
        titulo: `Contra mais pesado você cai de ${tl}% para ${tp}% de vitória`,
        texto: 'Diferença grande. Normalmente é alavanca e ângulo, não força. Vale investir em frames e em jogo de perna.',
      });
    }
  }

  const pior = [...a.porPosicao].filter((p) => p.n >= 3).sort((a2, b) => pct(a2.v, a2.n) - pct(b.v, b.n))[0];
  if (pior && pct(pior.v, pior.n) <= 25) {
    notas.push({
      tom: 'blood',
      titulo: `Começando em "${pior.nome}" você quase não sai vivo`,
      texto: `${pior.v} ${pior.v === 1 ? 'vitória' : 'vitórias'} em ${pior.n} rolas. É exatamente aí que o sparring posicional resolve mais rápido.`,
    });
  }

  if (a.vantMinhas >= 3) {
    notas.push({
      tom: 'warn',
      titulo: `${a.vantMinhas} vantagens conquistadas`,
      texto: 'Vantagem é "quase". Você chegou lá e não estabilizou os 3 segundos. Trabalhar a estabilização vira ponto direto.',
    });
  }

  return notas;
}

/* ---------- comparar o quiz com a realidade ---------- */
export function compararEstilo(estiloDeclarado, analise) {
  if (!estiloDeclarado || !analise?.estilo) return null;
  const real = analise.estilo.id;
  if (real === estiloDeclarado) {
    return {
      bate: true,
      titulo: 'Seus dados confirmam',
      texto: `Você se declarou ${estiloPorId(estiloDeclarado).nome} e é exatamente isso que os seus pontos mostram.`,
    };
  }
  return {
    bate: false,
    titulo: 'Seus dados discordam de você',
    texto: `Você se declarou ${estiloPorId(estiloDeclarado).nome}, mas os seus pontos dizem ${estiloPorId(real).nome}. Não é erro, é o que acontece de verdade quando tem alguém resistindo.`,
  };
}

/* ---------- posições que os pontos implicam (alimenta a escada) ---------- */
export function posicoesImplicadas(r, positions) {
  const porSlug = new Map(positions.map((p) => [p.slug, p.id]));
  const dom = new Set(r.posDominadas || []);
  const inf = new Set(r.posSofridas || []);

  for (const id of r.ptsMeus || []) {
    const slug = pontosPorId[id]?.posicaoDestino;
    if (slug && porSlug.has(slug)) dom.add(porSlug.get(slug));
  }
  for (const id of r.ptsDele || []) {
    const slug = pontosPorId[id]?.posicaoDestino;
    const inverso = { cem_quilos: 'sob_cem', montada: 'sob_montada', costas: 'costas_tomadas', joelho_barriga: 'sob_joelho' }[slug];
    if (inverso && porSlug.has(inverso)) inf.add(porSlug.get(inverso));
  }
  return { posDominadas: [...dom], posSofridas: [...inf] };
}
