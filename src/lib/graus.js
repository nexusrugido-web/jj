import { FAIXA_ORDEM } from './utils';

/* ============================================================
   GRAUS POR TÉCNICA

   Regra número um deste arquivo: o que você APLICA e o que você
   SOFRE nunca se misturam. Levar uma americana não é uma tentativa
   falhada de americana, é um buraco na sua defesa. São dois
   registros separados, com dois cálculos separados.

   Regra número dois: o app não sabe quantas vezes você tentou e
   não saiu. Ele só sabe quando saiu. Então aqui não existe taxa
   de acerto, existe volume sob resistência.
   ============================================================ */

/* Onde a técnica aconteceu muda o peso da evidência.
   Drilar constrói o movimento, mas não prova nada contra
   quem está resistindo de verdade. */
export const CONTEXTOS = [
  { id: 'drill', nome: 'Drill', desc: 'Repetição com o parceiro colaborando', peso: 0, evidencia: 'movimento' },
  { id: 'posicional', nome: 'Posicional', desc: 'Começa numa posição fixa, com resistência real', peso: 0.6, evidencia: 'resistencia' },
  { id: 'rola', nome: 'Rola', desc: 'Rola livre, resistência total', peso: 1, evidencia: 'resistencia' },
  { id: 'competicao', nome: 'Competição', desc: 'Valendo, com adrenalina e regra', peso: 1.3, evidencia: 'resistencia' },
];

export const contextoPorId = (id) => CONTEXTOS.find((c) => c.id === id) || CONTEXTOS[2];

/* Quem estava do outro lado pesa. Contra faixa mais alta vale mais,
   contra quem é mais pesado também. */
const PESO_FAIXA = { branca: 1.0, azul: 1.35, roxa: 1.7, marrom: 2.1, preta: 2.6 };
const PESO_CORPO = { leve: 0.85, similar: 1.0, pesado: 1.2 };

/* ---------- os quatro graus ---------- */
export const GRAUS = [
  {
    n: 0,
    nome: 'Nunca usei',
    curto: 'Nunca usei',
    frase: 'Essa ainda não apareceu em nenhum treino seu.',
    cor: 'dimmer',
  },
  {
    n: 1,
    nome: '1º grau',
    curto: 'Conheço o movimento',
    frase: 'Você já executou. O corpo sabe o caminho, falta a prova contra quem resiste.',
    cor: 'dim',
  },
  {
    n: 2,
    nome: '2º grau',
    curto: 'Funciona no rola',
    frase: 'Já saiu com alguém resistindo de verdade. Deixou de ser teoria.',
    cor: 'ice',
  },
  {
    n: 3,
    nome: '3º grau',
    curto: 'Faz parte do meu jogo',
    frase: 'Sai com regularidade, seja em gente diferente, seja em quem já conhece sua entrada.',
    cor: 'roar',
  },
  {
    n: 4,
    nome: '4º grau',
    curto: 'Assinatura',
    frase: 'É o que você faz melhor. Volume alto, contra gente do seu nível ou acima.',
    cor: 'jade',
  },
];

export const grauPorN = (n) => GRAUS[Math.max(0, Math.min(4, n || 0))];

/* ---------- a régua sobe conforme a sua faixa ----------
   Um faixa branca que raspa um azul fez algo notável.
   Um faixa marrom que raspa um azul fez o esperado.
   Por isso os requisitos mudam. */
export function requisitosDaFaixa(faixa = 'branca') {
  /* a régua é dura de propósito. Subir de grau tem que custar,
     senão o número não significa nada. */
  const base = {
    1: { usos: 1, ctx: 'qualquer' },
    2: { usos: 5, ctx: 'resistencia', transferencia: 0, refinamento: 0, acima: 0 },
    3: { usos: 15, ctx: 'resistencia', transferencia: 4, refinamento: 6, acima: 0 },
    4: { usos: 35, ctx: 'resistencia', transferencia: 7, refinamento: 10, acima: 2 },
  };

  const ajustes = {
    branca: { m: 1.0, acima4: 2 },
    azul: { m: 1.35, acima4: 4 },
    roxa: { m: 1.8, acima4: 6 },
    marrom: { m: 2.2, acima4: 8 },
    preta: { m: 2.6, acima4: 10 },
  };
  const a = ajustes[faixa] || ajustes.branca;

  return {
    1: { ...base[1] },
    2: { ...base[2], usos: Math.round(base[2].usos * a.m) },
    3: {
      ...base[3],
      usos: Math.round(base[3].usos * a.m),
      transferencia: base[3].transferencia + (faixa === 'branca' ? 0 : 1),
      refinamento: base[3].refinamento + (faixa === 'branca' ? 0 : 2),
      acima: faixa === 'branca' ? 0 : 1,
    },
    4: {
      ...base[4],
      usos: Math.round(base[4].usos * a.m),
      transferencia: base[4].transferencia + (faixa === 'branca' ? 0 : 1),
      refinamento: base[4].refinamento + (faixa === 'branca' ? 0 : 2),
      acima: a.acima4,
    },
  };
}

/* ============================================================
   ATAQUE: o que você aplicou
   ============================================================ */
export function calcularAtaque(usos, faixaUsuario = 'branca') {
  const req = requisitosDaFaixa(faixaUsuario);
  const minhaOrdem = FAIXA_ORDEM[faixaUsuario] ?? 0;

  const comResistencia = usos.filter((u) => contextoPorId(u.contexto).evidencia === 'resistencia');
  const soDrill = usos.length > 0 && comResistencia.length === 0;

  /* volume ponderado: contexto, faixa e peso do parceiro */
  let volume = 0;
  const porParceiro = new Map();
  let contraAcima = 0;
  const parceirosAcima = new Set();

  for (const u of comResistencia) {
    const ctx = contextoPorId(u.contexto).peso;
    const f = (PESO_FAIXA[u.faixaParceiro] || 1) / (PESO_FAIXA[faixaUsuario] || 1);
    const c = PESO_CORPO[u.pesoRel] || 1;
    volume += ctx * Math.min(2.2, Math.max(0.55, f)) * c;

    if (u.partnerId) {
      const lista = porParceiro.get(u.partnerId) || [];
      lista.push(u);
      porParceiro.set(u.partnerId, lista);
    }

    const of = FAIXA_ORDEM[u.faixaParceiro] ?? 0;
    const acima = minhaOrdem >= 4 ? of >= 4 : of > minhaOrdem;
    if (acima) { contraAcima++; if (u.partnerId) parceirosAcima.add(u.partnerId); }
  }

  const usosResistencia = comResistencia.length;
  const transferencia = porParceiro.size;

  /* refinamento: continuar encaixando na mesma pessoa depois que
     ela já viu a técnica algumas vezes. Isso é mais difícil que
     estrear em alguém novo, e o app precisa reconhecer isso. */
  let refinamento = 0;
  let melhorParceiro = null;
  for (const [pid, lista] of porParceiro.entries()) {
    if (lista.length > refinamento) { refinamento = lista.length; melhorParceiro = pid; }
  }

  /* qual grau isso alcança */
  let grau = 0;
  if (usos.length >= 1) grau = 1;
  if (usosResistencia >= req[2].usos) grau = 2;
  if (grau >= 2
    && usosResistencia >= req[3].usos
    && (transferencia >= req[3].transferencia || refinamento >= req[3].refinamento)) grau = 3;
  if (grau >= 3
    && usosResistencia >= req[4].usos
    && (transferencia >= req[4].transferencia || refinamento >= req[4].refinamento)
    && contraAcima >= req[4].acima) grau = 4;

  const proximo = grau < 4 ? grau + 1 : null;
  const progresso = proximo ? calcularProgresso({ usosResistencia, transferencia, refinamento, contraAcima }, req[proximo], grau) : 100;

  return {
    grau,
    proximo,
    progresso,
    usos: usos.length,
    usosResistencia,
    usosDrill: usos.length - usosResistencia,
    soDrill,
    transferencia,
    refinamento,
    melhorParceiro,
    contraAcima,
    parceirosAcima: parceirosAcima.size,
    volume: Math.round(volume * 10) / 10,
    requisitos: proximo ? req[proximo] : null,
    ultima: usos.map((u) => u.data).filter(Boolean).sort().pop() || null,
    historico: usos,
    tendencia: tendenciaDoUso(usos),
  };
}

/* A barra é limitada pelo requisito mais atrasado.
   Nunca vai mostrar 90% quando falta um requisito inteiro. */
function calcularProgresso(tem, req, grauAtual) {
  if (!req) return 100;
  const partes = [];

  if (req.usos) partes.push(Math.min(1, tem.usosResistencia / req.usos));

  if (req.transferencia || req.refinamento) {
    /* aqui vale o melhor dos dois caminhos, porque são duas
       formas legítimas de provar a mesma coisa */
    const t = req.transferencia ? tem.transferencia / req.transferencia : 0;
    const r = req.refinamento ? tem.refinamento / req.refinamento : 0;
    partes.push(Math.min(1, Math.max(t, r)));
  }

  if (req.acima) partes.push(Math.min(1, tem.contraAcima / req.acima));

  if (!partes.length) return 100;
  const media = partes.reduce((a, b) => a + b, 0) / partes.length;
  const pior = Math.min(...partes);
  /* a média puxada para baixo pelo pior requisito */
  return Math.round(Math.min(media, pior * 0.4 + media * 0.6) * 100);
}

function tendenciaDoUso(usos) {
  const datas = usos.map((u) => u.data).filter(Boolean).sort();
  if (datas.length < 5) return 'novo';
  const corte = datas[Math.floor(datas.length / 2)];
  const antes = datas.filter((d) => d < corte).length;
  const depois = datas.filter((d) => d >= corte).length;
  if (depois > antes * 1.4) return 'melhorando';
  if (depois * 1.4 < antes) return 'enferrujando';
  return 'estavel';
}

export const TENDENCIAS = {
  melhorando: { nome: 'Melhorando', seta: '↗', cor: 'jade' },
  estavel: { nome: 'Estável', seta: '→', cor: 'dim' },
  enferrujando: { nome: 'Enferrujando', seta: '↘', cor: 'blood' },
  novo: { nome: 'Pouco uso ainda', seta: '', cor: 'dimmer' },
};

/* ============================================================
   DEFESA: o que estão aplicando em você
   Isto NUNCA toca no grau das suas técnicas.
   ============================================================ */
export function calcularDefesa(sofridas, faixaUsuario = 'branca') {
  const minhaOrdem = FAIXA_ORDEM[faixaUsuario] ?? 0;
  const porFaixa = {};
  const posicoes = new Map();
  let deAcima = 0;

  for (const s of sofridas) {
    const f = s.faixaParceiro || 'branca';
    porFaixa[f] = (porFaixa[f] || 0) + 1;
    if ((FAIXA_ORDEM[f] ?? 0) > minhaOrdem) deAcima++;
    if (s.posInicial) posicoes.set(s.posInicial, (posicoes.get(s.posInicial) || 0) + 1);
  }

  const datas = sofridas.map((s) => s.data).filter(Boolean).sort();
  const ultima = datas[datas.length - 1] || null;

  const posicaoComum = [...posicoes.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  return {
    vezes: sofridas.length,
    deAcima,
    porFaixa,
    ultima,
    /* onde o rola COMEÇOU, não onde a técnica pegou.
       Só vale mencionar se for um padrão bem forte. */
    inicioComum: posicaoComum && posicaoComum[1] >= 3 && posicaoComum[1] / Math.max(1, sofridas.length) >= 0.7
      ? { id: posicaoComum[0], n: posicaoComum[1] }
      : null,
    recente: datas.filter((d) => {
      const dt = new Date(d);
      const trintaDias = new Date();
      trintaDias.setDate(trintaDias.getDate() - 30);
      return dt >= trintaDias;
    }).length,
  };
}

/* ============================================================
   LEITURA DO HISTÓRICO
   Separa os eventos em duas listas que nunca se cruzam.
   ============================================================ */
export function lerHistorico(rolls, partners, sessions) {
  const faixaDe = new Map(partners.map((p) => [p.id, p.faixa || 'branca']));
  const dataDe = new Map(sessions.map((s) => [s.id, s.data]));
  const tipoDe = new Map(sessions.map((s) => [s.id, s.tipo]));

  const ataque = new Map();
  const defesa = new Map();

  const addAtaque = (nome, ev) => {
    const k = String(nome).trim();
    if (!k) return;
    if (!ataque.has(k)) ataque.set(k, []);
    ataque.get(k).push(ev);
  };
  const addDefesa = (nome, ev) => {
    const k = String(nome).trim();
    if (!k) return;
    if (!defesa.has(k)) defesa.set(k, []);
    defesa.get(k).push(ev);
  };

  for (const r of rolls) {
    const base = {
      partnerId: r.partnerId || null,
      faixaParceiro: faixaDe.get(r.partnerId) || 'branca',
      pesoRel: r.pesoRel || 'similar',
      posInicial: r.posInicial || null,
      data: dataDe.get(r.sessionId) || r.data || null,
      contexto: r.contexto || (tipoDe.get(r.sessionId) === 'drill' ? 'drill' : 'rola'),
      sessionId: r.sessionId,
    };

    for (const s of r.subsAplicadas || []) addAtaque(s, { ...base, tipo: 'finalizacao' });
    for (const s of r.subsSofridas || []) addDefesa(s, { ...base, tipo: 'finalizacao' });

    for (const [ponto, nomes] of Object.entries(r.tecMeus || {})) {
      for (const n of nomes) addAtaque(n, { ...base, tipo: 'ponto', ponto });
    }
    for (const [ponto, nomes] of Object.entries(r.tecDele || {})) {
      for (const n of nomes) addDefesa(n, { ...base, tipo: 'ponto', ponto });
    }
  }

  /* técnicas treinadas em aula entram como drill, com peso zero
     para o grau, mas contam para "você conhece o movimento" */
  for (const s of sessions) {
    for (const f of s.focoTecnicas || []) {
      if (f.aprendizado === 'nao') continue;
      addAtaque(f.nome, {
        partnerId: null,
        faixaParceiro: 'branca',
        pesoRel: 'similar',
        posInicial: null,
        data: s.data,
        contexto: 'drill',
        sessionId: s.id,
        tipo: 'aula',
      });
    }
  }

  return { ataque, defesa };
}

/* ---------- a lista completa das suas técnicas ---------- */
export function minhasTecnicas(rolls, partners, sessions, techniques, faixaUsuario = 'branca') {
  const { ataque, defesa } = lerHistorico(rolls, partners, sessions);
  const porNome = new Map(techniques.map((t) => [t.nome.toLowerCase(), t]));

  const linhas = [];
  for (const [nome, usos] of ataque.entries()) {
    const a = calcularAtaque(usos, faixaUsuario);
    const tec = porNome.get(nome.toLowerCase());
    linhas.push({
      nome,
      tecnicaId: tec?.id ?? null,
      nomeEn: tec?.nomeEn || '',
      categoriaId: tec?.categoriaId ?? null,
      ...a,
      /* quantas vezes essa mesma técnica foi usada CONTRA você.
         fica ao lado, nunca dentro do cálculo */
      sofriTambem: (defesa.get(nome) || []).length,
    });
  }

  return linhas.sort((a, b) => b.grau - a.grau || b.usosResistencia - a.usosResistencia);
}

/* ---------- onde você apanha ---------- */
export function meusBuracos(rolls, partners, sessions, faixaUsuario = 'branca', limite = 8) {
  const { defesa } = lerHistorico(rolls, partners, sessions);
  const linhas = [];
  for (const [nome, sofridas] of defesa.entries()) {
    linhas.push({ nome, ...calcularDefesa(sofridas, faixaUsuario) });
  }
  return linhas.sort((a, b) => b.recente - a.recente || b.vezes - a.vezes).slice(0, limite);
}

/* ---------- resumo ---------- */
export function resumoGraus(lista) {
  const conta = (n) => lista.filter((t) => t.grau === n).length;
  return {
    g4: conta(4), g3: conta(3), g2: conta(2), g1: conta(1),
    total: lista.length,
    melhorando: lista.filter((t) => t.tendencia === 'melhorando').length,
    enferrujando: lista.filter((t) => t.tendencia === 'enferrujando').length,
    soDrill: lista.filter((t) => t.soDrill).length,
  };
}

/* ---------- o que você mais usa ---------- */
export function jogoPrincipal(lista, limite = 6) {
  return lista
    .filter((t) => t.usosResistencia > 0)
    .sort((a, b) => b.grau - a.grau || b.usosResistencia - a.usosResistencia)
    .slice(0, limite);
}

/* ============================================================
   ONDE VOCÊ APANHA DE POSIÇÃO

   Diferente de "que técnica te finaliza". Aqui é a posição em
   que você fica preso, que é o que o aluno sente como "não
   consigo sair dali".
   ============================================================ */
export function posicoesSofridas(rolls, sessions, limite = 6) {
  const trinta = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })();
  const dataDa = new Map(sessions.map((s) => [s.id, s.data]));

  const conta = new Map();
  for (const r of rolls) {
    if ((r.contexto || 'rola') === 'drill') continue;
    const data = dataDa.get(r.sessionId) || '';

    /* a posição em que o rola começou, quando é desvantagem. Guarda
       por baixo não entra: começar na própria guarda é o jogo de quem
       joga guarda, não é estar preso. */
    const inicio = r.posInicial || '';
    if (POSICAO_RUIM.has(inicio)) {
      const c = conta.get(inicio) || { vezes: 0, recente: 0 };
      c.vezes += 1;
      if (data >= trinta) c.recente += 1;
      conta.set(inicio, c);
    }

    /* e as posições que o parceiro alcançou em você */
    for (const p of r.ptsDele || []) {
      const chave = { montada: 'montada_baixo', costas: 'costas_sofridas', passagem: 'cem_baixo', joelho: 'joelho_sofrido' }[p];
      if (!chave) continue;
      const c = conta.get(chave) || { vezes: 0, recente: 0 };
      c.vezes += 1;
      if (data >= trinta) c.recente += 1;
      conta.set(chave, c);
    }
  }

  return [...conta.entries()]
    .map(([posicao, d]) => ({ posicao, ...d }))
    .filter((x) => x.vezes >= 2)
    .sort((a, b) => b.recente - a.recente || b.vezes - a.vezes)
    .slice(0, limite);
}

/* posições de início de rola que são desvantagem de verdade */
const POSICAO_RUIM = new Set(['cem_baixo', 'montada_baixo', 'costas_baixo', 'sob_cem', 'sob_montada']);

/* como a posição entra no meio da frase: "você ficou ___" */
export const NOME_POSICAO_SOFRIDA = {
  cem_baixo: 'embaixo do 100kg',
  sob_cem: 'embaixo do 100kg',
  montada_baixo: 'embaixo da montada',
  sob_montada: 'embaixo da montada',
  costas_baixo: 'com as costas entregues',
  costas_sofridas: 'com as costas entregues',
  joelho_sofrido: 'com o joelho na barriga',
};

/* e como vira título de recomendação */
export const TITULO_POSICAO_SOFRIDA = {
  cem_baixo: 'Sair de baixo do 100kg',
  sob_cem: 'Sair de baixo do 100kg',
  montada_baixo: 'Sair de baixo da montada',
  sob_montada: 'Sair de baixo da montada',
  costas_baixo: 'Defender as costas',
  costas_sofridas: 'Defender as costas',
  joelho_sofrido: 'Sair do joelho na barriga',
};
