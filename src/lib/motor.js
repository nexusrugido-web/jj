import { acervo } from './acervo';
import { palavrasFortes } from './aulas';
import { semAcento } from './classificar';
import {
  POSICOES, HABILIDADES, SITUACOES, FORMATOS, DE_FAIXA,
  separar, nomeDe, nomePosicaoLado, familiaDaHabilidade,
} from './vocab';

/* ============================================================
   O MOTOR DE RECOMENDAÇÃO

   Um só, pra toda tela. Recebe um pedido no vocabulário do app
   ("100kg por baixo, escapada", "armlock, defesa", "contra quem
   é mais pesado") e dá nota pra cada vídeo do acervo pelo que ele
   ENSINA, não pelas palavras do título.

   Antes a escolha era uma escada de buscas por palavra: "100kg",
   depois "saída", depois "escapar". Funcionava quando o título
   ajudava. Agora cada vídeo diz o que ensina (a esteira do painel
   classifica), e o vídeo novo concorre com os 680 no instante em
   que entra. Nada fica guardado: a nota é feita na hora, com o
   acervo inteiro.

   A nota tem duas partes:

   relevância   o vídeo tem a ver com o pedido? Técnica, posição
                com lado, habilidade, situação. Sem nada disso, o
                vídeo não entra, por melhor que seja.
   desempate    formato certo pro momento, nível da faixa, e o
                quanto a classificação é de confiança. O título
                citando a técnica continua valendo, porque ainda há
                vídeo que a IA não classificou.
   ============================================================ */

/* conferido na mão vale mais que o palpite da IA, que vale mais
   que a etiqueta antiga */
const PESO_DA_CLASSIFICACAO = { revisada: 1, automatica: 0.95, legado: 0.85, revisar: 0.8 };

const ORDEM_DO_NIVEL = { fundamento: 0, intermediario: 1, avancado: 2 };

/* aula acima do nível atrapalha mais que aula de base pra quem
   já é graduado: fundamento continua servindo pra faixa preta */
function ajusteDoNivel(nivelDoVideo, faixa) {
  if (!nivelDoVideo) return 0;
  const aluno = ORDEM_DO_NIVEL[DE_FAIXA[faixa] || 'fundamento'];
  const video = ORDEM_DO_NIVEL[nivelDoVideo];
  if (video === aluno) return 5;
  if (video > aluno) return video - aluno === 1 ? -2 : -6;
  return aluno - video === 1 ? 0 : -2;
}

/* ------------------------------------------------------------
   O TÍTULO CITANDO A TÉCNICA

   O mesmo golpe tem grafia diferente em cada título: "arm lock",
   "armlock", "chave de braço". E técnica diferente não serve de
   resposta: pedir armlock e receber vídeo de kimura é pior que
   não recomendar.
   ------------------------------------------------------------ */
const GRAFIAS = {
  'armlock': ['armlock', 'arm lock', 'chave de braco', 'juji'],
  'chave de braco': ['armlock', 'arm lock', 'chave de braco'],
  'americana': ['americana'],
  'kimura': ['kimura'],
  'omoplata': ['omoplata'],
  'triangulo': ['triangulo', 'sankaku'],
  'mata leao': ['mata leao', 'estrangulamento pelas costas'],
  'guilhotina': ['guilhotina'],
  'katagatame': ['katagatame', 'kata gatame', 'braco e cabeca'],
  'ezequiel': ['ezequiel', 'ezekiel'],
  'botinha': ['botinha', 'chave de pe'],
  'chave de pe': ['botinha', 'chave de pe'],
  'tesoura': ['tesoura', 'tesourinha'],
  'toureando': ['toureando', 'toreando', 'toureio'],
  'berimbolo': ['berimbolo'],
  'crucifixo': ['crucifixo'],
  'kesa': ['kesa', 'gravata'],
};

const TECNICAS_DISTINTAS = [
  'armlock', 'americana', 'kimura', 'omoplata', 'triangulo', 'mata leao',
  'guilhotina', 'ezequiel', 'katagatame', 'botinha', 'tesoura', 'berimbolo',
];

const temPalavra = (texto, termo) => new RegExp(`(^| )${termo}( |$)`).test(texto);

function grafiasDe(nome) {
  const n = semAcento(nome);
  const saida = new Set();
  for (const [chave, lista] of Object.entries(GRAFIAS)) {
    if (n.includes(chave)) for (const g of lista) saida.add(g);
  }
  return [...saida];
}

export function tituloCita(titulo, nome) {
  const t = semAcento(titulo);
  if (grafiasDe(nome).some((g) => temPalavra(t, g))) return true;
  /* a maioria das palavras que identificam a técnica: "Raspagem de
     gancho" pede "raspagem" e "gancho", não qualquer raspagem */
  const fortes = palavrasFortes(nome);
  const achadas = fortes.filter((w) => temPalavra(t, semAcento(w))).length;
  return fortes.length > 0 && achadas >= Math.ceil(fortes.length / 2);
}

/* o título anuncia outra técnica, que não é a pedida */
function tituloDeOutraTecnica(titulo, nomes) {
  const t = semAcento(titulo);
  const pedidas = nomes.map(semAcento).join(' ');
  return TECNICAS_DISTINTAS.some((x) => !pedidas.includes(x) && temPalavra(t, x));
}

/* ------------------------------------------------------------
   pedido:
     tecnicas   uids da biblioteca
     nomes      os mesmos, por nome, pra achar no título
     palavras   termos do assunto no título ("pesado", "força")
     posicoes   ['cem:baixo']
     habilidades, situacoes
     formatos   do mais desejado pro menos; com formatoEhAssunto,
                o formato conta como assunto ("entender o porquê")
   ------------------------------------------------------------ */
function relevancia(a, pedido) {
  const porque = [];
  let r = 0;

  const tecnicas = pedido.tecnicas || [];
  const nomes = pedido.nomes || [];
  if (tecnicas.some((u) => (a.tecnicas || []).includes(u))) {
    r += 30;
    porque.push(nomes[0] || 'a técnica');
  } else if (nomes.some((n) => tituloCita(a.t, n))) {
    r += 20;
    porque.push(nomes[0]);
  }
  if (nomes.length && tituloDeOutraTecnica(a.t, nomes)) return { r: 0, porque: [] };

  /* o assunto no título ainda conta, e o motivo é a situação que
     o pedido descreve ("Contra mais pesado") */
  const palavras = pedido.palavras || [];
  if (palavras.some((p) => temPalavra(semAcento(a.t), semAcento(p)))) {
    r += 12;
    if (pedido.situacoes?.length) porque.push(nomeDe(SITUACOES, pedido.situacoes[0]));
  }

  for (const pl of pedido.posicoes || []) {
    const { posicao, lado } = separar(pl);
    const doVideo = (a.posicaoLado || []).map(separar).filter((x) => x.posicao === posicao);
    if (!doVideo.length) continue;
    if (doVideo.some((x) => x.lado === lado)) {
      r += 14;
      porque.push(nomePosicaoLado(pl));
    } else if (lado === 'neutro' || doVideo.some((x) => x.lado === 'neutro')) {
      r += 8;
      porque.push(nomeDe(POSICOES, posicao));
    }
    /* o outro lado da mesma posição não conta: quem quer sair de
       baixo do 100kg não precisa da aula de segurar por cima */
  }

  const pedidas = new Set(pedido.habilidades || []);
  for (const h of a.habilidades || []) {
    if (pedidas.has(h)) {
      r += 10;
      porque.push(nomeDe(HABILIDADES, h));
    } else if (familiaDaHabilidade(h).some((x) => pedidas.has(x))) {
      r += 5;
    }
  }

  for (const s of a.situacoes || []) {
    if ((pedido.situacoes || []).includes(s)) {
      r += 12;
      porque.push(nomeDe(SITUACOES, s));
    }
  }

  if (pedido.formatoEhAssunto && a.formato && (pedido.formatos || []).includes(a.formato)) {
    r += 10;
    porque.push(nomeDe(FORMATOS, a.formato));
  }

  return { r, porque: [...new Set(porque)] };
}

/* embaralhamento estável da semana: dentro da mesma nota, a ordem
   muda toda semana, pra lista não virar sempre a mesma */
function semente(txt) {
  let h = 2166136261;
  const s = String(txt);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function semanaAtual() {
  const d = new Date();
  const ini = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}-${Math.ceil(((d - ini) / 86400000 + ini.getDay() + 1) / 7)}`;
}

/* ------------------------------------------------------------
   Os vídeos pra um pedido, do melhor pro pior, cada um com o
   motivo ("100kg por baixo", "Escapada").

   Não visto vem antes de visto. Branca e azul recebem aula curta
   primeiro depois da melhor, roxa pra cima o contrário. Sem nada
   relevante, cai no porquê das coisas, que serve pra qualquer
   situação; e sem aula longa do assunto, um short do assunto
   certo é melhor que nada.
   ------------------------------------------------------------ */
export function aulasPara(pedido, {
  faixa = 'branca',
  vistas = [],
  excluir = [],
  quantidade = 3,
  soAula = false,
  lista = acervo(),
} = {}) {
  const vistasSet = new Set(vistas);
  const fora = new Set(excluir);
  const chave = `${semanaAtual()}:${JSON.stringify(pedido)}`;
  const formatos = pedido.formatos || [];

  const notadas = lista
    .filter((a) => !fora.has(a.id) && (!soAula || a.k === 'aula'))
    .map((a) => {
      const { r, porque } = relevancia(a, pedido);
      if (r <= 0) return null;
      let nota = r * (PESO_DA_CLASSIFICACAO[a.classificacao] ?? 0.85);
      const i = formatos.indexOf(a.formato);
      if (i === 0) nota += 4;
      else if (i > 0) nota += 2;
      nota += ajusteDoNivel(a.nivel, faixa);
      if (a.ordem != null) nota += 1;
      return { ...a, nota, porque, sorteio: semente(`${a.id}:${chave}`) };
    })
    .filter(Boolean);

  if (!notadas.length) {
    if (soAula) return aulasPara(pedido, { faixa, vistas, excluir, quantidade, soAula: false, lista });
    if (pedido.reserva === false) return [];
    return aulasPara({ formatos: ['conceito'], formatoEhAssunto: true, reserva: false }, {
      faixa, vistas, excluir, quantidade, lista,
    }).map((a) => ({ ...a, porque: [], reserva: true }));
  }

  const ordenar = (l) => l.sort((a, b) => (b.nota - a.nota) || (a.sorteio - b.sorteio));
  const saida = [
    ...ordenar(notadas.filter((a) => !vistasSet.has(a.id))),
    ...ordenar(notadas.filter((a) => vistasSet.has(a.id))),
  ];

  /* a duração só desempata entre os que estão perto da melhor nota:
     aula curta e fraca não passa na frente da certa */
  const querCurto = ['branca', 'azul'].includes(faixa);
  const [melhor, ...resto] = saida;
  const mesmoGrupo = (a) => vistasSet.has(a.id) === vistasSet.has(melhor.id);
  const perto = resto.filter((a) => mesmoGrupo(a) && a.nota >= melhor.nota * 0.8)
    .sort((a, b) => (querCurto ? a.d - b.d : b.d - a.d));
  const longe = resto.filter((a) => !perto.includes(a));

  return [melhor, ...perto, ...longe].slice(0, quantidade)
    .map(({ nota: _n, sorteio: _s, ...a }) => a);
}
