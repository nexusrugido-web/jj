import { FAIXA_ORDEM, hoje, diasEntre, addDias } from './utils';
import { periodoDeDados, dentroDoPeriodo } from './periodo';

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
    frase: 'Sai com regularidade, em gente diferente e em semanas diferentes. Já é jogo seu.',
    cor: 'roar',
  },
  {
    n: 4,
    nome: '4º grau',
    curto: 'Assinatura',
    frase: 'É o que você faz melhor, e há meses. Sai muito, e sai contra gente do seu nível ou acima.',
    cor: 'jade',
  },
];

export const grauPorN = (n) => GRAUS[Math.max(0, Math.min(4, n || 0))];

/* ---------- a régua sobe conforme a sua faixa ----------
   Um faixa branca que raspa um azul fez algo notável.
   Um faixa marrom que raspa um azul fez o esperado.
   Por isso os requisitos mudam. */
export function requisitosDaFaixa(faixa = 'branca', regra = 'v2') {
  if (regra === 'v1') return requisitosV1(faixa);
  const a = AJUSTE_DA_FAIXA[faixa] || AJUSTE_DA_FAIXA.branca;

  /* Os dois primeiros graus vêm rápido: é quando mais se apanha, e
     vitória cedo segura quem está começando. Do 3º em diante o tempo
     entra na conta, porque jogo de verdade é o que se sustenta: não
     dá pra chegar na Assinatura numa fase boa de três semanas.
     Pessoas diferentes têm mínimo baixo, pra academia pequena não
     travar, mas ninguém chega no 4º grau num parceiro só. */
  return {
    1: { usos: 1 },
    2: { usos: Math.round(5 * a.m) },
    3: { usos: Math.round(15 * a.m), transferencia: 2, semanas: 4, acima: faixa === 'branca' ? 0 : 1 },
    4: { usos: Math.round(35 * a.m), transferencia: 3, meses: 3, acima: a.acima4 },
  };
}

const AJUSTE_DA_FAIXA = {
  branca: { m: 1.0, acima4: 2 },
  azul: { m: 1.35, acima4: 4 },
  roxa: { m: 1.8, acima4: 6 },
  marrom: { m: 2.2, acima4: 8 },
  preta: { m: 2.6, acima4: 10 },
};

/* A régua até 24/09/2026. Fica só pra ninguém perder o grau que já
   tinha quando a régua mudou (ver grauGuardado). */
function requisitosV1(faixa = 'branca') {
  const base = {
    1: { usos: 1, ctx: 'qualquer' },
    2: { usos: 5, ctx: 'resistencia', transferencia: 0, refinamento: 0, acima: 0 },
    3: { usos: 15, ctx: 'resistencia', transferencia: 4, refinamento: 6, acima: 0 },
    4: { usos: 35, ctx: 'resistencia', transferencia: 7, refinamento: 10, acima: 2 },
  };

  const a = AJUSTE_DA_FAIXA[faixa] || AJUSTE_DA_FAIXA.branca;

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
export function calcularAtaque(usos, faixaUsuario = 'branca', { regra = 'v2', grauMinimo = 0 } = {}) {
  const req = requisitosDaFaixa(faixaUsuario, regra);
  const minhaOrdem = FAIXA_ORDEM[faixaUsuario] ?? 0;

  const comResistencia = usos.filter((u) => contextoPorId(u.contexto).evidencia === 'resistencia');
  const soDrill = usos.length > 0 && comResistencia.length === 0;

  /* volume ponderado: contexto, faixa e peso do parceiro */
  let volume = 0;
  const porParceiro = new Map();
  let contraAcima = 0;
  const parceirosAcima = new Set();

  const semanas = new Set();
  const meses = new Set();

  for (const u of comResistencia) {
    const ctx = contextoPorId(u.contexto).peso;
    /* parceiro não marcado conta como alguém da sua faixa */
    const f = u.faixaParceiro ? (PESO_FAIXA[u.faixaParceiro] || 1) / (PESO_FAIXA[faixaUsuario] || 1) : 1;
    const c = PESO_CORPO[u.pesoRel] || 1;
    volume += ctx * Math.min(2.2, Math.max(0.55, f)) * c;

    if (u.partnerId) {
      const lista = porParceiro.get(u.partnerId) || [];
      lista.push(u);
      porParceiro.set(u.partnerId, lista);
    }

    const of = FAIXA_ORDEM[u.faixaParceiro] ?? 0;
    const acima = u.faixaParceiro && (minhaOrdem >= 4 ? of >= 4 : of > minhaOrdem);
    if (acima) { contraAcima++; if (u.partnerId) parceirosAcima.add(u.partnerId); }

    if (u.data) {
      const dia = new Date(u.data + 'T00:00:00').getDay();
      semanas.add(addDias(u.data, -((dia + 6) % 7)));
      meses.add(u.data.slice(0, 7));
    }
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

  /* Na régua nova o uso vale pelo peso de verdade: encaixar em faixa
     acima ou em alguém mais pesado conta mais, posicional conta menos.
     A régua antiga contava cada uso igual. */
  const pontos = Math.round(volume * 10) / 10;
  const m = {
    usos: usos.length, pontos: regra === 'v1' ? usosResistencia : pontos,
    transferencia, refinamento, contraAcima, semanas: semanas.size, meses: meses.size,
  };

  /* qual grau isso alcança, e nunca menos do que já foi conquistado */
  const grau = Math.max(grauMinimo, grauPelaRegra(m, req, regra));

  const proximo = grau < 4 ? grau + 1 : null;
  const progresso = proximo ? calcularProgresso(m, req[proximo]) : 100;

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
    volume: pontos,
    semanas: semanas.size,
    meses: meses.size,
    grauGuardado: grauMinimo,
    requisitos: proximo ? req[proximo] : null,
    ultima: usos.map((u) => u.data).filter(Boolean).sort().pop() || null,
    historico: usos,
    tendencia: tendenciaDoUso(usos),
  };
}

function grauPelaRegra(m, req, regra) {
  let grau = 0;
  if (m.usos >= 1) grau = 1;
  if (m.pontos >= req[2].usos) grau = 2;

  if (regra === 'v1') {
    /* a régua antiga: variedade OU repetição na mesma pessoa, sem tempo */
    const jeito = (r) => m.transferencia >= r.transferencia || m.refinamento >= r.refinamento;
    if (grau >= 2 && m.pontos >= req[3].usos && jeito(req[3])) grau = 3;
    if (grau >= 3 && m.pontos >= req[4].usos && jeito(req[4]) && m.contraAcima >= req[4].acima) grau = 4;
    return grau;
  }

  const cumpre = (r) => m.pontos >= r.usos
    && m.transferencia >= (r.transferencia || 0)
    && m.contraAcima >= (r.acima || 0)
    && m.semanas >= (r.semanas || 0)
    && m.meses >= (r.meses || 0);
  if (grau >= 2 && cumpre(req[3])) grau = 3;
  if (grau >= 3 && cumpre(req[4])) grau = 4;
  return grau;
}

/* A barra é limitada pelo requisito mais atrasado.
   Nunca vai mostrar 90% quando falta um requisito inteiro. */
function calcularProgresso(tem, req) {
  if (!req) return 100;
  const partes = [];

  if (req.usos) partes.push(Math.min(1, tem.pontos / req.usos));
  if (req.transferencia) partes.push(Math.min(1, tem.transferencia / req.transferencia));
  if (req.semanas) partes.push(Math.min(1, tem.semanas / req.semanas));
  if (req.meses) partes.push(Math.min(1, tem.meses / req.meses));
  if (req.acima) partes.push(Math.min(1, tem.contraAcima / req.acima));

  if (!partes.length) return 100;
  const media = partes.reduce((a, b) => a + b, 0) / partes.length;
  const pior = Math.min(...partes);
  /* a média puxada para baixo pelo pior requisito */
  return Math.round(Math.min(media, pior * 0.4 + media * 0.6) * 100);
}

/* A tendência olha o calendário, não a lista. Antes ela cortava as
   datas na mediana, e as duas metades davam sempre o mesmo tamanho:
   ninguém nunca via "melhorando" nem "enferrujando".
   Últimos 30 dias contra a média mensal dos 60 antes deles. */
function tendenciaDoUso(usos, ref = hoje()) {
  const idades = usos.map((u) => u.data).filter(Boolean).map((d) => diasEntre(d, ref));
  if (idades.length < 5) return 'novo';
  if (Math.min(...idades) > 45) return 'enferrujando';
  const agora = idades.filter((x) => x <= 30).length;
  const antes = idades.filter((x) => x > 30 && x <= 90).length / 2;
  if (agora > Math.max(1, antes) * 1.4) return 'melhorando';
  if (agora * 1.4 < antes) return 'enferrujando';
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
    /* os mesmos "últimos 30 dias" que a meta de defesa escreve na tela */
    recente: dentroDoPeriodo(sofridas, periodoDeDados('ultimos-30')).length,
  };
}

/* ============================================================
   LEITURA DO HISTÓRICO
   Separa os eventos em duas listas que nunca se cruzam.
   ============================================================ */
export function lerHistorico(rolls, partners, sessions) {
  /* sem parceiro, ou parceiro sem faixa: fica sem faixa, e o cálculo
     trata como alguém da sua. Antes virava branca e quem é azul pra
     cima perdia peso em todo rola sem parceiro marcado. */
  const faixaDe = new Map(partners.map((p) => [p.id, p.faixa || null]));
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
      faixaParceiro: faixaDe.get(r.partnerId) || null,
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

/* ============================================================
   O GRAU CONQUISTADO NÃO VOLTA

   A régua muda com o tempo: fica mais alta quando você é graduado,
   e mudou de regra em 24/09/2026. Recalcular tudo com a régua de
   hoje faria a Kimura cair do 3º pro 2º grau no dia em que você
   pegou a faixa azul. O grau de uma técnica é o maior entre o de
   hoje e o que ela já tinha com a régua de cada época.
   ============================================================ */
export const REGRA_NOVA_DESDE = '2026-09-24';

/* a faixa que valia num dia, pelas graduações registradas */
export function faixaNaData(data, gradings = [], faixaAtual = 'branca') {
  const ordem = ['branca', 'azul', 'roxa', 'marrom', 'preta'];
  const lista = gradings.filter((g) => g.data && g.faixa).sort((a, b) => a.data.localeCompare(b.data));
  const ate = lista.filter((g) => g.data <= data);
  if (ate.length) return ate[ate.length - 1].faixa;
  /* antes da primeira graduação registrada: se ela foi de faixa, era a anterior */
  const primeira = lista[0];
  if (!primeira) return faixaAtual;
  return primeira.tipo === 'faixa' ? ordem[Math.max(0, ordem.indexOf(primeira.faixa) - 1)] : primeira.faixa;
}

export function grauGuardado(usos, faixaAtual = 'branca', gradings = []) {
  const antes = (d) => usos.filter((u) => u.data && u.data < d);
  let g = 0;
  const velhos = antes(REGRA_NOVA_DESDE);
  if (velhos.length) {
    g = calcularAtaque(velhos, faixaNaData(addDias(REGRA_NOVA_DESDE, -1), gradings, faixaAtual), { regra: 'v1' }).grau;
  }
  for (const gr of gradings.filter((x) => x.tipo === 'faixa' && x.data)) {
    const u = antes(gr.data);
    if (!u.length) continue;
    const faixaAntes = faixaNaData(addDias(gr.data, -1), gradings, faixaAtual);
    const regra = gr.data <= REGRA_NOVA_DESDE ? 'v1' : 'v2';
    g = Math.max(g, calcularAtaque(u, faixaAntes, { regra }).grau);
  }
  return g;
}

/* ---------- a lista completa das suas técnicas ---------- */
export function minhasTecnicas(rolls, partners, sessions, techniques, faixaUsuario = 'branca', gradings = []) {
  const { ataque, defesa } = lerHistorico(rolls, partners, sessions);
  const porNome = new Map(techniques.map((t) => [t.nome.toLowerCase(), t]));

  const linhas = [];
  for (const [nome, usos] of ataque.entries()) {
    const a = calcularAtaque(usos, faixaUsuario, { grauMinimo: grauGuardado(usos, faixaUsuario, gradings) });
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
  /* só o que te fez bater: "Onde você apanha", "o que mais te pega" e a
     recomendação de defesa falam a mesma coisa. Passagem sofrida com
     nome virava "você bateu 3 vezes de" uma passagem. */
  for (const [nome, sofridas] of defesa.entries()) {
    const taps = sofridas.filter((s) => s.tipo === 'finalizacao');
    if (taps.length) linhas.push({ nome, ...calcularDefesa(taps, faixaUsuario) });
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
  const mes = periodoDeDados('ultimos-30');
  const recente = (data) => data >= mes.ini && data <= mes.fim;
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
      if (recente(data)) c.recente += 1;
      conta.set(inicio, c);
    }

    /* e as posições que o parceiro alcançou em você */
    for (const p of r.ptsDele || []) {
      const chave = { montada: 'montada_baixo', costas: 'costas_sofridas', passagem: 'cem_baixo', joelho: 'joelho_sofrido' }[p];
      if (!chave) continue;
      const c = conta.get(chave) || { vezes: 0, recente: 0 };
      c.vezes += 1;
      if (recente(data)) c.recente += 1;
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
