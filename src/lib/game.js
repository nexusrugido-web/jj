import {
  pontosPorId, somarPontos, ESTILOS, estiloPorId,
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

/* ---------- cada forma de pontuar, dos dois lados ----------
   A tela conta em quantos rolas cada coisa aconteceu: "derrubou em
   9 dos 18 rolas" se confere olhando a lista. Um rola com três
   raspagens conta uma vez. */
export const LANCES = [
  { id: 'queda', meu: 'Derrubou', dele: 'Te derrubaram', nenhum: 'Nenhuma queda',
    dica: 'Se o rola começa de joelhos, é normal. Se começa em pé, o jogo em pé ainda não entrou.' },
  { id: 'passagem', meu: 'Passou a guarda', dele: 'Passaram a sua guarda', nenhum: 'Nenhuma passagem de guarda',
    dica: 'Por cima, a guarda do parceiro ainda não abre.' },
  { id: 'raspagem', meu: 'Raspou', dele: 'Te rasparam', nenhum: 'Nenhuma raspagem',
    dica: 'Quando você cai por baixo, ainda não tem uma saída que funcione.' },
  { id: 'montada', meu: 'Montou', dele: 'Te montaram', nenhum: 'Nenhuma montada',
    dica: 'Depois de passar a guarda, o próximo passo ainda não saiu.' },
  { id: 'costas', meu: 'Pegou as costas', dele: 'Pegaram as suas costas', nenhum: 'Nenhuma pegada nas costas',
    dica: 'Vale 4 pontos e é de onde mais sai finalização.' },
  { id: 'joelho', meu: 'Joelho na barriga', dele: 'Joelho na barriga em você', nenhum: 'Nenhum joelho na barriga',
    dica: 'Transição rápida que vale 2 pontos e abre a montada.' },
  { id: 'finalizacao', meu: 'Finalizou', dele: 'Te finalizaram', nenhum: 'Nenhuma finalização',
    dica: 'Escolha um ataque de cada posição e busque só ele por umas semanas.' },
];

/* o que fazer com o que você mais cede */
const DICA_DO_QUE_CEDE = {
  queda: 'Postura e pegada vêm antes de qualquer defesa de queda.',
  passagem: 'A retenção de guarda é o ponto a trabalhar. Peça um treino de posição começando na guarda, com o parceiro já tentando passar.',
  raspagem: 'Quando você está por cima, te viram. Base e postura dentro da guarda resolvem a maior parte.',
  montada: 'Depois que passam a sua guarda, você não volta. A saída do 100kg antes de virar montada é o ponto a trabalhar.',
  costas: 'O giro pra fugir de baixo está entregando as costas. Vale treinar a saída de frente pro parceiro.',
  joelho: 'Frame no joelho e virar de lado cedo, antes de o parceiro estabilizar.',
  finalizacao: 'Saber defender a que mais te pega vale mais que aprender um ataque novo.',
};

/* ---------- resumo geral do jogo ---------- */
export function analisarJogo(rolls, partners, sessions, faixaUsuario = 'branca') {
  const faixaDe = new Map(partners.map((p) => [p.id, p.faixa || 'branca']));
  const minhaOrdem = FAIXA_ORDEM[faixaUsuario] ?? 0;

  /* Um rola 0x0 TAMBÉM é dado: significa que ninguém pontuou.
     Só ficam de fora os rolas antigos, registrados antes do placar existir,
     e o drill, que não é luta: a mesma regra do Painel e da Análise. */
  const comDados = rolls.filter((r) => (r.contexto || 'rola') !== 'drill' && (
    r.v2 ||
    (r.ptsMeus || []).length || (r.ptsDele || []).length ||
    (r.subsAplicadas || []).length || (r.subsSofridas || []).length ||
    r.posInicial || r.pesoRel
  ));

  let vitorias = 0, derrotas = 0, empates = 0;
  let ptsMeus = 0, ptsDele = 0;
  const porFaixa = new Map();
  const porPeso = new Map();
  const porPosicao = new Map();
  let vantMinhas = 0, vantDele = 0;

  /* em quantos rolas cada coisa aconteceu, e com qual técnica */
  const meuEm = {}, deleEm = {};
  const tecMeu = {}, tecDele = {};
  let controleEm = 0, limpos = 0;
  const marca = (alvo, ids) => { for (const id of new Set(ids)) alvo[id] = (alvo[id] || 0) + 1; };
  const contaTec = (alvo, id, nomes) => {
    for (const nome of nomes || []) {
      const k = String(nome).trim();
      if (!k) continue;
      alvo[id] = alvo[id] || new Map();
      alvo[id].set(k, (alvo[id].get(k) || 0) + 1);
    }
  };

  for (const r of comDados) {
    const p = placarDaRola(r);
    if (p.ganhou) vitorias++;
    else if (p.perdeu) derrotas++;
    else empates++;

    ptsMeus += p.meus;
    ptsDele += p.dele;
    vantMinhas += Number(r.vantMinhas) || 0;
    vantDele += Number(r.vantDele) || 0;

    const meus = r.ptsMeus || [];
    const dele = r.ptsDele || [];
    marca(meuEm, [...meus, ...(p.finMeus ? ['finalizacao'] : [])]);
    marca(deleEm, [...dele, ...(p.finDele ? ['finalizacao'] : [])]);
    if (meus.some((id) => pontosPorId[id]?.eixo === 'controle')) controleEm++;
    if (!dele.includes('passagem') && !p.finDele) limpos++;

    contaTec(tecMeu, 'finalizacao', r.subsAplicadas);
    contaTec(tecDele, 'finalizacao', r.subsSofridas);
    for (const [ponto, nomes] of Object.entries(r.tecMeus || {})) contaTec(tecMeu, ponto, nomes);
    for (const [ponto, nomes] of Object.entries(r.tecDele || {})) contaTec(tecDele, ponto, nomes);

    const faixa = faixaDe.get(r.partnerId) || 'branca';
    acumula(porFaixa, faixa, p);

    if (r.pesoRel) acumula(porPeso, r.pesoRel, p);
    if (r.posInicial) acumula(porPosicao, r.posInicial, p);
  }

  const n = comDados.length;
  const emQuantos = {
    queda: meuEm.queda || 0,
    passagem: meuEm.passagem || 0,
    raspagem: meuEm.raspagem || 0,
    controle: controleEm,
    finalizacao: meuEm.finalizacao || 0,
  };
  const estilo = detectarEstilo(emQuantos, limpos, n);

  return {
    rolas: n,
    suficiente: n >= MIN_ROLAS_ESTILO,
    faltam: Math.max(0, MIN_ROLAS_ESTILO - n),
    vitorias, derrotas, empates,
    taxaVitoria: pct(vitorias, n),
    ptsMeus, ptsDele,
    mediaMeus: n ? Number((ptsMeus / n).toFixed(1)) : 0,
    mediaDele: n ? Number((ptsDele / n).toFixed(1)) : 0,
    vantMinhas, vantDele,
    lances: LANCES.map((l) => ({
      ...l,
      meus: meuEm[l.id] || 0,
      deles: deleEm[l.id] || 0,
      tecMeu: maisUsada(tecMeu[l.id]),
      tecDele: maisUsada(tecDele[l.id]),
    })),
    limpos,
    porFaixa: [...porFaixa.entries()].map(([k, v]) => ({ chave: k, ...v })).sort((a, b) => (FAIXA_ORDEM[a.chave] ?? 0) - (FAIXA_ORDEM[b.chave] ?? 0)),
    porPeso: PESO_REL.map((p) => ({ chave: p.id, nome: p.nome, icone: p.icone, ...(porPeso.get(p.id) || vazio()) })).filter((x) => x.n > 0),
    porPosicao: [...porPosicao.entries()].map(([k, v]) => ({ chave: k, nome: posInicialPorId[k]?.nome || k, ...v })).sort((a, b) => b.n - a.n),
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

function maisUsada(mapa) {
  if (!mapa) return null;
  const [nome, vezes] = [...mapa.entries()].sort((a, b) => b[1] - a[1])[0];
  return { nome, vezes };
}

/* ---------- o estilo que os dados dizem ----------
   É o que aparece em mais rolas, a mesma conta que a tela mostra,
   pra dar pra conferir olhando a lista. */
const ESTILO_DO_EIXO = {
  queda: 'quedador', passagem: 'passador', raspagem: 'guardeiro',
  finalizacao: 'finalizador', controle: 'controlador',
};

function detectarEstilo(emQuantos, limpos, n) {
  if (n < MIN_ROLAS_ESTILO) return null;

  const ordem = Object.entries(emQuantos).sort((a, b) => b[1] - a[1]);
  const [topo, rolas] = ordem[0];
  const [segundo, rolasSegundo] = ordem[1];

  /* quase nada acontecendo: quem não pontua mas também não sofre é sobrevivente */
  if (rolas < n * 0.25) {
    if (limpos >= n * 0.6) return { id: 'defensor', dominante: null, rolas: limpos };
    return { id: 'completo', dominante: null, pouco: true };
  }

  /* passagem e controle são o mesmo jogo (por cima): quem manda é o maior dos dois */
  const porCima = ['passagem', 'controle'];
  if (porCima.includes(topo) && porCima.includes(segundo)) {
    return { id: ESTILO_DO_EIXO[topo], dominante: topo, rolas };
  }

  /* dois jogos diferentes quase empatados = completo */
  if (rolas - rolasSegundo < rolas * 0.18) {
    return { id: 'completo', dominante: null, topo, rolas, segundo, rolasSegundo };
  }
  return { id: ESTILO_DO_EIXO[topo], dominante: topo, rolas };
}

const FEZ = {
  queda: 'derrubou', passagem: 'passou a guarda', raspagem: 'raspou',
  controle: 'chegou na montada, nas costas ou no joelho na barriga', finalizacao: 'finalizou',
};

/* o porquê do estilo, com os números que estão na tela */
export function porqueDoEstilo(estilo, n) {
  if (!estilo) return '';
  if (estilo.id === 'defensor') {
    return `Você ainda pontua pouco, mas em ${estilo.rolas} dos ${n} rolas ninguém passou a sua guarda nem te finalizou.`;
  }
  if (estilo.pouco) {
    return 'Nenhuma forma de pontuar aparece em mais de 1 a cada 4 rolas ainda. Quando uma se destacar, o estilo muda sozinho.';
  }
  if (estilo.id === 'completo') {
    return `Você ${FEZ[estilo.topo]} em ${estilo.rolas} e ${FEZ[estilo.segundo]} em ${estilo.rolasSegundo} dos ${n} rolas. Nenhuma se destaca: você pontua de vários jeitos.`;
  }
  return `Você ${FEZ[estilo.dominante]} em ${estilo.rolas} dos ${n} rolas, mais do que qualquer outra forma de pontuar.`;
}

/* o que você mais cede, com o que fazer */
export function oQueMaisCede(a) {
  const pior = [...a.lances].filter((l) => l.deles > 0).sort((x, y) => y.deles - x.deles)[0];
  if (!pior) return null;
  const tec = pior.tecDele ? ` A que mais aparece: ${pior.tecDele.nome}.` : '';
  return { ...pior, texto: `${DICA_DO_QUE_CEDE[pior.id]}${tec}` };
}

/* ---------- leitura por situação: peso e posição inicial ---------- */
export function lerJogo(a) {
  const notas = [];
  if (!a.rolas) return notas;

  const pesado = a.porPeso.find((p) => p.chave === 'pesado');
  const leve = a.porPeso.find((p) => p.chave === 'leve');
  if (pesado && leve && pesado.n >= 4 && leve.n >= 4) {
    const tp = pct(pesado.v, pesado.n);
    const tl = pct(leve.v, leve.n);
    if (tl - tp >= 30) {
      notas.push({
        tom: 'warn',
        titulo: `Contra mais pesado você vence ${pesado.v} de ${pesado.n}. Contra mais leve, ${leve.v} de ${leve.n}`,
        texto: 'Diferença grande. Normalmente é alavanca e ângulo, não força. Vale investir em frames e em jogo de perna.',
      });
    }
  }

  const pior = [...a.porPosicao].filter((p) => p.n >= 3).sort((a2, b) => pct(a2.v, a2.n) - pct(b.v, b.n))[0];
  if (pior && pct(pior.v, pior.n) <= 25) {
    notas.push({
      tom: 'blood',
      titulo: `Começando em "${pior.nome}" você venceu ${pior.v} de ${pior.n}`,
      texto: 'É exatamente aí que o treino de posição resolve mais rápido: peça pra começar daí.',
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
      titulo: 'Bate com o seu teste',
      texto: `No teste você marcou ${estiloPorId(estiloDeclarado).nome}, e é isso que os seus rolas mostram.`,
    };
  }
  return {
    bate: false,
    titulo: 'Diferente do seu teste',
    texto: `No teste você marcou ${estiloPorId(estiloDeclarado).nome}. ${real === 'completo'
      ? 'Nos rolas, você pontua de vários jeitos, sem um que se destaque.'
      : `Nos rolas, o que mais aparece é ${estiloPorId(real).nome}.`} O app segue o que acontece no rola, e o jogo de todo mundo muda com o tempo.`,
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
