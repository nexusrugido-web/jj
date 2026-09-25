import { capa, embed, duracaoTexto, SERVIDORES_CAPA } from '../db/aulas';
import { hoje, hoje as diaDeHoje } from './utils';
import { acervo, acervoAberto } from './acervo';

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

export function palavrasFortes(nome) {
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
  const candidatas = acervoAberto()
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

/* ---------- navegação por tema ---------- */
export function aulasDoTema(tema, { faixa, vistas = [], busca = '', tipo = 'todos', pagina = 0, porPagina = 24 } = {}) {
  const vistasSet = new Set(vistas);
  let lista = acervoAberto().filter((a) => a.tm.includes(tema));

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

  /* não vista primeiro; entre elas, a ordem que o administrador
     escolheu no painel; sem ordem, a faixa desempata */
  lista = embaralhar(lista, `${semanaAtual()}:${tema}`)
    .sort((a, b) => {
      if (a.vista !== b.vista) return a.vista ? 1 : -1;
      const oa = a.ordem ?? Infinity;
      const ob = b.ordem ?? Infinity;
      if (oa !== ob) return oa - ob;
      return b.peso - a.peso;
    });

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
  const seg = acervo().reduce((a, x) => a + x.d, 0);
  const vistoSeg = acervo().filter((x) => v.has(x.id)).reduce((a, x) => a + x.d, 0);
  return {
    total: acervo().length,
    aulas: acervo().filter((a) => a.k === 'aula').length,
    shorts: acervo().filter((a) => a.k === 'short').length,
    horas: Math.round(seg / 3600),
    vistas: v.size,
    horasVistas: Math.round((vistoSeg / 3600) * 10) / 10,
    pct: Math.round((v.size / acervo().length) * 100),
  };
}


/* ============================================================
   O PEDAÇO QUE CONTA COMO ASSISTIDO

   O player confere onde a agulha está uma vez por segundo. A
   diferença entre duas conferidas é o que passou de aula, e é
   isso que soma. Mas só quando ela cabe num segundo: passo
   grande é a pessoa arrastando a barra pra frente, e passo
   negativo é ela voltando. Nenhum dos dois é aula assistida.

   A folga em cima da velocidade cobre duas coisas reais: quem
   assiste em 2x está assistindo, e rede travada faz a conferida
   atrasar e o passo sair maior que um segundo.
   ============================================================ */
/* Até onde a barra deixa voltar.

   Voltar é parte de estudar: o pedaço que não entrou a pessoa
   precisa rever. Adiantar não é, porque adiantar é não assistir.
   Então a agulha anda livre dentro do que já passou e para na
   marca do ponto mais longe que a aula chegou. */
export function ondePodeVoltar(pedido, limite) {
  const p = Number(pedido);
  const l = Number(limite);
  if (!(l > 0) || !Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(p, l));
}

export function trechoValido(de, para, velocidade = 1) {
  const passo = Number(para) - Number(de);
  if (!(passo > 0)) return 0;
  if (passo > (Number(velocidade) || 1) * 1.6) return 0;
  return passo;
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
  const hoje = diaDeHoje();

  /* só número entra. Quem chamar errado não estraga o registro */
  const seg = Number(segundos) > 0 ? Math.round(Number(segundos)) : aula.d;
  await registrarEventoVideo(aula, 'concluiu', { segundos: seg, origem: aula.origem || null });
  const { medir } = await import('./medir');
  medir('concluiu', { origem: aula.origem || null, videoId: aula.id, segundos: seg });

  const ja = await db.aulasVistas.where('videoId').equals(aula.id).first();

  if (ja) {
    const antes = Number(ja.segundosVistos);
    await db.aulasVistas.update(ja.id, {
      vezes: (ja.vezes || 1) + 1,
      ultima: hoje,
      segundosVistos: Math.max(Number.isFinite(antes) ? antes : 0, seg),
    });

    /* Rever vale o mesmo que ver pela primeira vez: quem volta num
       assunto quer dominar ele, e assiste até o fim do mesmo jeito.
       O ranking não vira competição de play porque rever divide o
       teto do dia (e o da semana) com as aulas novas, e o mesmo
       vídeo só paga uma vez por dia. */
    const evento = aula.k === 'aula' ? 'aula' : 'short';

    const p = await darXp(evento, {
      refId: `rever:${aula.id}:${hoje}`,
      detalhe: aula.t,
    });
    return { xp: p?.xp || 0, revisao: true };
  }

  await db.aulasVistas.add({
    videoId: aula.id,
    titulo: aula.t,
    duracao: aula.d,
    tipo: aula.k,
    segundosVistos: seg,
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

/* ============================================================
   O QUE ACONTECE COM CADA VÍDEO

   Abrir e concluir viram registro. Abrir é o que conta pro limite
   do dia no plano grátis: antes contava só aula concluída, e quem
   não apertava "marcar como vista" assistia sem limite. A origem
   diz de onde a pessoa veio, que é o que vai permitir saber se uma
   recomendação foi aberta ou ignorada.
   ============================================================ */
export async function registrarEventoVideo(aula, evento, { origem = null, segundos = null } = {}) {
  if (!aula?.id) return;
  try {
    const { db } = await import('../db/db');
    await db.videoEventos.add({
      videoId: aula.id,
      tipo: aula.k,
      evento,
      origem,
      segundos,
      data: hoje(),
      criadoEm: Date.now(),
    });
  } catch (e) {
    /* registro de evento nunca pode impedir a aula de abrir */
    console.error('[video]', e);
  }
}

/* os vídeos de um tipo abertos hoje, sem repetir: reabrir o mesmo
   vídeo no mesmo dia não gasta outra vez */
export async function abertosHoje(tipo) {
  const { db } = await import('../db/db');
  const d = hoje();
  const ids = new Set();
  try {
    for (const e of await db.videoEventos.where('data').equals(d).toArray()) {
      if (e.evento === 'abriu' && e.tipo === tipo) ids.add(e.videoId);
    }
    /* quem concluiu antes deste registro existir continua contando */
    for (const v of await db.aulasVistas.toArray()) {
      if (v.tipo === tipo && (v.ultima || v.data) === d) ids.add(v.videoId);
    }
  } catch { /* banco fechado, não trava a tela */ }
  return ids;
}

/* ============================================================
   OS VÍDEOS DE QUEM ACABOU DE CHEGAR

   Sem registro nenhum, o app não tem o que recomendar. Mas é
   justamente aí que a pessoa mais precisa de um motivo pra
   voltar amanhã, então tela vazia é o pior desfecho possível.

   A lista sai dos vídeos que o administrador marcou no painel.
   Quando ele ainda não marcou nada, o app escolhe sozinho:
   aula que explica o porquê, mirando a faixa de quem chegou, e
   nunca a mais longa do acervo, porque uma hora de vídeo no
   primeiro dia não é convite, é muro.
   ============================================================ */
export function aulasDeEntrada({ faixa = 'branca', vistas = [], quantidade = 10 } = {}) {
  const escolhidas = acervoAberto().filter((a) => a.destaque);

  if (escolhidas.length) {
    const vistasSet = new Set(vistas);
    return [...escolhidas]
      .sort((a, b) => {
        const va = vistasSet.has(a.id);
        const vb = vistasSet.has(b.id);
        if (va !== vb) return va ? 1 : -1;
        return (a.ordem ?? Infinity) - (b.ordem ?? Infinity);
      })
      .slice(0, quantidade);
  }

  return escolherAulas({
    temas: ['logica', 'guarda', 'defesa'],
    faixa,
    vistas,
    quantidade,
    preferirCurto: true,
    soAula: true,
  }).filter((a) => a.d <= 1800);
}
