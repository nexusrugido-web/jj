import { AULAS, TEMA_POR_INTENCAO, TEMA_POR_ESTILO, TEMA_POR_DOR, capa, embed, duracaoTexto, SERVIDORES_CAPA } from '../db/aulas';
import { hoje } from './utils';

/* ============================================================
   ESCOLHA DE AULAS

   Regras:
   1. Aula que você ainda não viu vem primeiro.
   2. Quando acabar o que é novo, rotaciona o resto numa ordem
      que muda toda semana, pra nunca virar a mesma lista.
   3. Nunca mostra a mesma aula duas vezes seguidas.
   4. Faixa branca e azul recebem aula curta primeiro. Roxa pra
      cima aguenta e prefere aula longa.
   ============================================================ */

const semAcento = (s) => String(s).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* Palavras genéricas demais pra identificar uma técnica.
   "chave de braço" tem que casar por "braço", não por "chave",
   senão qualquer vídeo com "a chave do sucesso" entra na lista. */
const GENERICAS = new Set([
  'chave', 'de', 'da', 'do', 'dos', 'das', 'com', 'para', 'por', 'no', 'na',
  'guarda', 'posicao', 'jiu', 'jitsu', 'tecnica', 'golpe', 'sem', 'como',
  'pegada', 'controle', 'entrada', 'saida', 'defesa', 'ataque', 'reta',
]);

function palavrasFortes(nome) {
  return semAcento(nome)
    .split(/[\s(),/+.-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !GENERICAS.has(w));
}

/* embaralhamento estável: mesma semente, mesma ordem sempre */
function semente(txt) {
  let h = 2166136261;
  const s = String(txt);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function embaralhar(lista, chave) {
  const s = semente(chave);
  return lista
    .map((v, i) => ({ v, ord: (semente(v.id + ':' + s + ':' + i)) }))
    .sort((a, b) => a.ord - b.ord)
    .map((x) => x.v);
}

function semanaAtual() {
  const d = new Date();
  const ini = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}-${Math.ceil(((d - ini) / 86400000 + ini.getDay() + 1) / 7)}`;
}

/* faixa branca e azul preferem aula curta; roxa pra cima aguenta longa */
function ordemPorFaixa(faixa) {
  return ['branca', 'azul'].includes(faixa)
    ? (a, b) => a.d - b.d
    : (a, b) => b.d - a.d;
}

/* ---------- o seletor principal ---------- */
export function escolherAulas({
  temas = [],
  posicoes = [],
  tecnica = null,
  faixa = 'branca',
  vistas = [],
  excluir = [],
  quantidade = 3,
  preferirCurto = null,
  soAula = false,
}) {
  const vistasSet = new Set(vistas);
  const fora = new Set(excluir);

  /* pontua cada aula pela aderência ao que a pessoa precisa agora */
  const candidatas = AULAS
    .filter((a) => !fora.has(a.id))
    .map((a) => {
      /* Primeiro: a aula tem alguma coisa a ver com o que foi
         pedido? Só quem passa aqui entra na lista. Antes o bônus
         de faixa entrava sozinho, e aí qualquer aula de faixa
         branca virava resposta pra qualquer pergunta. */
      let relevancia = 0;

      for (const t of temas) {
        const i = temas.indexOf(t);
        if (a.tm.includes(t)) relevancia += 10 - i * 2;
      }
      for (const p of posicoes) {
        if ((a.p || []).includes(p)) relevancia += 8;
      }
      /* título citando a técnica é o sinal mais forte que existe.
         Mas só vale palavra que identifica a técnica de verdade:
         "chave" sozinho casaria com "a chave do sucesso". */
      if (tecnica) {
        const fortes = palavrasFortes(tecnica);
        const titulo = semAcento(a.t);
        /* palavra inteira, não pedaço. "mata" de mata-leão casava
           com "matar qualquer guarda", e a aula vinha errada. */
        for (const w of fortes) {
          if (new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(titulo)) relevancia += 16;
        }
      }

      /* nada a ver, fica de fora */
      if (relevancia <= 0) return { ...a, nota: 0 };

      /* agora sim os desempates */
      let nota = relevancia;
      if (a.f === faixa) nota += 12;
      else if (a.f && a.f !== faixa) nota -= 4;
      if (a.tm.includes('logica')) nota += 3;

      return { ...a, nota };
    })
    .filter((a) => a.nota > 0)
    .filter((a) => !soAula || a.k === 'aula');

  if (!candidatas.length) return [];

  const novas = candidatas.filter((a) => !vistasSet.has(a.id));
  const revisitas = candidatas.filter((a) => vistasSet.has(a.id));

  const chave = `${semanaAtual()}:${temas.join(',')}:${tecnica || ''}`;
  const ordenar = (lista) => {
    /* mistura: primeiro a nota, e dentro da mesma nota a rotação
       da semana desempata, pra a lista mudar sem ficar aleatória */
    const misturada = embaralhar(lista, chave);
    return misturada.sort((a, b) => b.nota - a.nota);
  };

  let saida = [...ordenar(novas), ...ordenar(revisitas)];

  /* uma aula nunca aparece duas vezes na mesma lista */
  const jaTem = new Set();
  saida = saida.filter((a) => (jaTem.has(a.id) ? false : jaTem.add(a.id)));
  if (!saida.length) return [];

  /* curto primeiro pra branca e azul, longo primeiro pra roxa acima */
  const querCurto = preferirCurto !== null ? preferirCurto : ['branca', 'azul'].includes(faixa);
  const melhor = saida[0];
  const resto = saida.slice(1, quantidade * 3)
    .sort((a, b) => (querCurto ? a.d - b.d : b.d - a.d));

  return [melhor, ...resto].slice(0, quantidade);
}

/* ---------- atalhos por contexto ---------- */
export function aulasParaIntencao(intencao, { tecnica, faixa, vistas, quantidade = 2 } = {}) {
  return escolherAulas({
    temas: TEMA_POR_INTENCAO[intencao] || ['logica'],
    tecnica,
    faixa,
    vistas,
    quantidade,
  });
}

export function aulasParaEstilo(estilo, { faixa, vistas, quantidade = 6 } = {}) {
  return escolherAulas({
    temas: TEMA_POR_ESTILO[estilo] || ['logica'],
    faixa,
    vistas,
    quantidade,
  });
}

export function aulasParaDor(dor, { faixa, vistas, quantidade = 5 } = {}) {
  const d = TEMA_POR_DOR[dor];
  return escolherAulas({ temas: d ? d.temas : ['logica'], faixa, vistas, quantidade });
}

export function aulasParaTecnica(nome, { faixa, vistas, quantidade = 3 } = {}) {
  return aulaParaSituacao({ tecnica: nome, intencao: 'repetir', faixa, vistas, quantidade });
}

export function aulasParaBuraco(nomeTecnica, { faixa, vistas, quantidade = 2 } = {}) {
  return aulaParaSituacao({
    tecnica: nomeTecnica, intencao: 'corrigir',
    temas: ['defesa', 'logica'], faixa, vistas, quantidade,
  });
}

/* ---------- navegação por tema ---------- */
export function aulasDoTema(tema, { faixa, vistas = [], busca = '', tipo = 'todos', pagina = 0, porPagina = 24 } = {}) {
  const vistasSet = new Set(vistas);
  let lista = AULAS.filter((a) => a.tm.includes(tema));

  if (tipo !== 'todos') lista = lista.filter((a) => a.k === tipo);
  if (busca) {
    const b = busca.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    lista = lista.filter((a) =>
      a.t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(b));
  }

  lista = lista.map((a) => ({
    ...a,
    vista: vistasSet.has(a.id),
    peso: (a.f === faixa ? 10 : 0) + (a.f && a.f !== faixa ? -5 : 0),
  }));

  lista = embaralhar(lista, `${semanaAtual()}:${tema}`)
    .sort((a, b) => (a.vista === b.vista ? b.peso - a.peso : a.vista ? 1 : -1));

  const visto = new Set();
  lista = lista.filter((a) => (visto.has(a.id) ? false : visto.add(a.id)));

  return {
    itens: lista.slice(pagina * porPagina, (pagina + 1) * porPagina),
    total: lista.length,
    temMais: (pagina + 1) * porPagina < lista.length,
  };
}

export { capa, embed, duracaoTexto, SERVIDORES_CAPA };

/* ---------- estatística do acervo ---------- */
export function resumoAcervo(vistas = []) {
  const v = new Set(vistas);
  const seg = AULAS.reduce((a, x) => a + x.d, 0);
  const vistoSeg = AULAS.filter((x) => v.has(x.id)).reduce((a, x) => a + x.d, 0);
  return {
    total: AULAS.length,
    aulas: AULAS.filter((a) => a.k === 'aula').length,
    shorts: AULAS.filter((a) => a.k === 'short').length,
    horas: Math.round(seg / 3600),
    vistas: v.size,
    horasVistas: Math.round((vistoSeg / 3600) * 10) / 10,
    pct: Math.round((v.size / AULAS.length) * 100),
  };
}


/* ============================================================
   SEMPRE ACHAR UMA AULA

   O problema antes: a recomendação de defesa contra americana
   vinha com vídeo, mas a de sair do 100kg não vinha, porque
   não existe vídeo com aquele nome exato. A recomendação
   aparecia pela metade e parecia quebrada.

   Agora existe uma escada. Se o degrau de cima não achar, cai
   pro de baixo, e assim por diante. Chegando no fim, entrega
   uma aula de lógica, que serve pra qualquer situação.
   ============================================================ */

/* apelidos de posição, pra achar vídeo mesmo quando o nome
   do app e o nome do vídeo não batem */
const APELIDO_POSICAO = {
  cem_quilos: ['100kg', 'lateral'],
  sob_cem: ['100kg', 'saida', 'escapar', 'sair'],
  montada: ['montada'],
  sob_montada: ['montada', 'saida', 'escapar'],
  costas: ['costas'],
  costas_sofridas: ['costas', 'estrangulamento', 'defesa'],
  joelho_barriga: ['joelho'],
  norte_sul: ['norte'],
  guarda_fechada: ['fechada'],
  guarda_fechada_baixo: ['fechada', 'abrir'],
  guarda_fechada_cima: ['fechada', 'abrir', 'passagem'],
  guarda_aberta: ['aberta', 'laco', 'aranha', 'riva'],
  guarda_aberta_baixo: ['aberta', 'laco', 'aranha'],
  guarda_aberta_cima: ['passagem', 'passar', 'passador'],
  meia_baixo: ['meia'],
  meia_cima: ['meia', 'passagem'],
  cem_baixo: ['100kg', 'saida', 'escapar'],
  cem_cima: ['100kg', 'lateral'],
  montada_baixo: ['montada', 'saida'],
  montada_cima: ['montada'],
  tartaruga: ['tartaruga', 'quatro'],
  em_pe: ['queda', 'clinch', 'pe'],
  de_joelhos: ['joelhos', 'queda'],
};

/* Quando não existe vídeo da técnica exata, o assunto mais
   próximo é a família dela. Não ter aula de mata-leão não
   significa não ter aula de estrangulamento. */
/* Cada família busca o CONCEITO, nunca o nome de outra técnica.
   Antes "armlock" caía em "braco" e trazia omoplata, que é outra
   coisa. Recomendar a técnica errada é pior que não recomendar. */
const FAMILIA_DA_TECNICA = [
  { quando: ['mata-leao', 'mata leao', 'guilhotina', 'ezequiel', 'gravata', 'katagatame', 'triangulo'],
    busque: ['estrangulamento', 'gola'] },
  { quando: ['armlock', 'chave de braco', 'americana', 'kimura', 'omoplata', 'chave de ombro', 'mao de vaca'],
    busque: ['articular', 'finalizacao'] },
  { quando: ['chave de pe', 'botinha', 'calcanhar', 'ankle'],
    busque: ['botinha', 'perna'] },
  { quando: ['raspagem', 'tesoura', 'balanco', 'pendulo'],
    busque: ['raspagem', 'raspar'] },
  { quando: ['passagem', 'toureando', 'flechando', 'leg drag'],
    busque: ['passagem', 'passar'] },
  { quando: ['queda', 'baiana', 'dupla', 'ippon'],
    busque: ['queda', 'derrubar'] },
];

/* nomes de técnica que não podem aparecer como resposta pra
   outra técnica: são golpes distintos, não sinônimos */
const TECNICAS_DISTINTAS = [
  'armlock', 'americana', 'kimura', 'omoplata', 'triangulo', 'mata-leao',
  'guilhotina', 'ezequiel', 'katagatame', 'botinha', 'tesoura', 'berimbolo',
];

function conflita(titulo, tecnicaPedida) {
  const t = semAcento(titulo);
  const pedida = semAcento(tecnicaPedida || '');
  for (const nome of TECNICAS_DISTINTAS) {
    if (pedida.includes(nome)) continue;
    /* o título anuncia outra técnica no nome */
    if (new RegExp(`(^|[^a-z])${nome}([^a-z]|$)`).test(t)) return true;
  }
  return false;
}

/* O mesmo golpe tem grafia diferente em cada título: "arm lock",
   "armlock", "chave de braço". Sem isto, a aula certa existe no
   acervo e a busca não acha. */
const GRAFIAS = {
  'armlock': ['armlock', 'arm lock', 'chave de braco', 'juji'],
  'chave de braco': ['armlock', 'arm lock', 'chave de braco'],
  'americana': ['americana'],
  'kimura': ['kimura'],
  'omoplata': ['omoplata'],
  'triangulo': ['triangulo', 'sankaku'],
  'mata-leao': ['mata leao', 'mata-leao', 'estrangulamento pelas costas'],
  'guilhotina': ['guilhotina'],
  'katagatame': ['katagatame', 'kata gatame', 'braco e cabeca', 'braco cabeca'],
  'ezequiel': ['ezequiel', 'ezekiel'],
  'botinha': ['botinha', 'chave de pe'],
  'chave de pe': ['botinha', 'chave de pe'],
  'tesoura': ['tesoura', 'tesourinha'],
  'toureando': ['toureando', 'toreando', 'toureio'],
  'berimbolo': ['berimbolo'],
  'crucifixo': ['crucifixo'],
  'kesa': ['kesa', 'gravata'],
  '100kg': ['100kg', 'cem quilos', 'lateral'],
};

function grafiasDe(nome) {
  const n = semAcento(nome);
  const saida = new Set();
  for (const [chave, lista] of Object.entries(GRAFIAS)) {
    if (n.includes(semAcento(chave))) for (const g of lista) saida.add(g);
  }
  return [...saida];
}

function familiaDe(nome) {
  const n = semAcento(nome);
  for (const f of FAMILIA_DA_TECNICA) {
    if (f.quando.some((q) => n.includes(semAcento(q)))) return f.busque;
  }
  return null;
}

/* o problema por trás de cada intenção, em palavras que
   aparecem em título de vídeo */
const PALAVRA_DO_PROBLEMA = {
  corrigir: ['defesa', 'defender', 'escapar', 'saida', 'sair'],
  repetir: ['detalhes', 'manual', 'completo'],
  consolidar: ['drill', 'treinar', 'estudando'],
  testar: ['rola', 'competicao', 'campeonato'],
  adaptar: ['variacao', 'quando', 'contra'],
  conectar: ['sequencia', 'combinacao', 'ligacao'],
  refinar: ['detalhes', 'manual'],
  explorar: ['aprenda', 'comecando', 'branca'],
  validar: ['evolucao', 'faixa'],
  aprender: ['fundamentos', 'basico', 'branca', 'comecando'],
};

/* sem tema de propósito: o nome da técnica tem que decidir
   sozinho, senão qualquer aula de lógica ganha da aula certa */
function buscarPorTexto(termos, { faixa, vistas, quantidade, soAula }) {
  for (const t of termos) {
    const achadas = escolherAulas({ temas: [], tecnica: t, faixa, vistas, quantidade, soAula });
    if (achadas.length) return achadas;
  }
  return [];
}

/* a escada, do mais específico pro mais geral */
export function aulaParaSituacao({
  tecnica = null,
  posicao = null,
  intencao = 'repetir',
  temas = [],
  faixa = 'branca',
  vistas = [],
  quantidade = 1,
  soAula = false,
}) {
  const tentativas = [];

  /* 1. o nome da técnica, em todas as grafias que ela tem */
  if (tecnica) {
    const grafias = grafiasDe(tecnica);
    if (grafias.length) {
      tentativas.push(() => buscarPorTexto(grafias, { faixa, vistas, quantidade, soAula })
        .filter((a) => !conflita(a.t, tecnica)));
    }
    tentativas.push(() => escolherAulas({ temas: [], tecnica, faixa, vistas, quantidade, soAula }));
  }

  /* 2. a posição envolvida, pelo nome e pelos apelidos */
  if (posicao) {
    tentativas.push(() => escolherAulas({ temas: [], posicoes: [posicao], faixa, vistas, quantidade, soAula }));
    const apelidos = APELIDO_POSICAO[posicao];
    if (apelidos) tentativas.push(() => buscarPorTexto(apelidos, { faixa, vistas, quantidade, soAula }));
  }

  /* 3. a família da técnica: sem aula de mata-leão, serve aula
     de estrangulamento */
  if (tecnica) {
    const fam = familiaDe(tecnica);
    if (fam) {
      tentativas.push(() => buscarPorTexto(fam, { faixa, vistas, quantidade, soAula })
        .filter((a) => !conflita(a.t, tecnica)));
    }
  }

  /* 4. o problema que a intenção descreve */
  const palavras = PALAVRA_DO_PROBLEMA[intencao];
  if (palavras) {
    tentativas.push(() => buscarPorTexto(palavras, { faixa, vistas, quantidade, soAula })
      .filter((a) => !conflita(a.t, tecnica)));
  }

  /* 5. o tema geral da intenção */
  tentativas.push(() => escolherAulas({
    temas: temas.length ? temas : (TEMA_POR_INTENCAO[intencao] || ['logica']),
    faixa, vistas, quantidade, soAula,
  }).filter((a) => !conflita(a.t, tecnica)));

  /* 6. o porquê das coisas, que serve pra qualquer situação */
  tentativas.push(() => escolherAulas({ temas: ['logica'], faixa, vistas, quantidade, soAula }));

  for (const tentar of tentativas) {
    const achadas = tentar();
    if (achadas.length) return achadas;
  }

  /* Esgotou tudo só com aula longa. Melhor um short do assunto
     certo que recomendação sem vídeo nenhum. */
  if (soAula) {
    return aulaParaSituacao({
      tecnica, posicao, intencao, temas, faixa, vistas, quantidade, soAula: false,
    });
  }
  return [];
}

/* ============================================================
   MARCAR AULA COMO VISTA

   Uma função só, usada no Estudo e no Painel. Antes o Painel
   abria o vídeo e não registrava nada, então quem estudava
   pela recomendação não ganhava ponto nem via a aula sumir
   da lista de não vistas.
   ============================================================ */
export async function registrarAulaVista(aula, segundos = 0) {
  const { db } = await import('../db/db');
  const { darXp } = await import('./xp');
  const hoje = new Date().toISOString().slice(0, 10);

  const ja = await db.aulasVistas.where('videoId').equals(aula.id).first();

  if (ja) {
    await db.aulasVistas.update(ja.id, {
      vezes: (ja.vezes || 1) + 1,
      ultima: hoje,
      segundosVistos: Math.max(ja.segundosVistos || 0, segundos || aula.d),
    });

    /* Rever aula longa paga menos que ver pela primeira vez, e
       só uma vez por dia. Rever short não paga: trinta segundos
       de vídeo repetido não ensinam nada novo, e pagar por isso
       transformaria o ranking numa competição de quem toca o
       play mais vezes. */
    if (aula.k !== 'aula') return { xp: 0, revisao: true };

    const p = await darXp('revista', {
      refId: `revista:${aula.id}:${hoje}`,
      detalhe: aula.t,
    });
    return { xp: p?.xp || 0, revisao: true };
  }

  await db.aulasVistas.add({
    videoId: aula.id,
    titulo: aula.t,
    duracao: aula.d,
    tipo: aula.k,
    segundosVistos: segundos || aula.d,
    vezes: 1,
    data: hoje,
    ultima: hoje,
    criadoEm: Date.now(),
  });

  const p = await darXp(aula.k === 'aula' ? 'aula' : 'short', {
    refId: `aula:${aula.id}:${hoje.slice(0, 4)}`,
    detalhe: aula.t,
  });

  return { xp: p?.xp || 0, revisao: false };
}
