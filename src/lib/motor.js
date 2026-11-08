import { acervo } from './acervo';
import { palavrasFortes } from './aulas';
import { semAcento, TECNICAS_DISTINTAS, grafiasDe, ehAulaDeDefesa, ehAulaDeAtaque } from './classificar';
import { familiaDaTecnica, FAMILIAS_DE_FINALIZACAO, TECNICA_POR_UID } from './tecnicas';
import { FAMILIA_POR_ID } from './familias';
import { faixaDeConteudo } from './faixas';
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
  const aluno = ORDEM_DO_NIVEL[DE_FAIXA[faixaDeConteudo(faixa)] || 'fundamento'];
  const video = ORDEM_DO_NIVEL[nivelDoVideo];
  if (video === aluno) return 5;
  if (video > aluno) return video - aluno === 1 ? -2 : -6;
  return aluno - video === 1 ? 0 : -2;
}

/* ------------------------------------------------------------
   O TÍTULO CITANDO A TÉCNICA

   O mesmo golpe tem grafia diferente em cada título: "arm lock",
   "armlock", "chave de braço" (as grafias moram em classificar.js,
   que a esteira também usa). E técnica diferente não serve de
   resposta: pedir armlock e receber vídeo de kimura é pior que
   não recomendar.
   ------------------------------------------------------------ */
const temPalavra = (texto, termo) => new RegExp(`(^| )${termo}( |$)`).test(texto);

/* palavra de categoria ou de posição: está no nome de muitas técnicas
   e sozinha não diz qual é ("raspagem", "montada", "guard") */
const DE_CATEGORIA = new Set([
  'raspagem', 'passagem', 'escapada', 'estrangulamento', 'retencao', 'finalizacao', 'queda',
  'montada', 'costas', 'tartaruga', 'meia', 'fechada', 'aberta', 'joelho', 'barriga', 'norte',
  'borboleta', 'aranha', 'lapela', 'contra', 'guard', 'pass', 'sweep', 'escape', 'choke',
]);

export function tituloCita(titulo, nome) {
  const t = semAcento(titulo);
  if (grafiasDe(nome).some((g) => temPalavra(t, g))) return true;
  /* a maioria das palavras que identificam a técnica, e ao menos uma
     que não seja de categoria quando o nome tem: "Raspagem de tesoura"
     pede "tesoura", não qualquer raspagem; "queda" pede "queda" */
  const fortes = palavrasFortes(nome);
  const achadas = fortes.filter((w) => temPalavra(t, semAcento(w)));
  const temPropria = fortes.some((w) => !DE_CATEGORIA.has(w));
  return fortes.length > 0 && achadas.length >= Math.ceil(fortes.length / 2)
    && (!temPropria || achadas.some((w) => !DE_CATEGORIA.has(w)));
}

/* o título anuncia outra técnica, que não é a pedida */
function tituloDeOutraTecnica(titulo, nomes) {
  const t = semAcento(titulo);
  const pedidas = nomes.map(semAcento).join(' ');
  return TECNICAS_DISTINTAS.some((x) => !pedidas.includes(x) && temPalavra(t, x));
}

/* ------------------------------------------------------------
   O VÍDEO DE OUTRA TÉCNICA

   "Defesa contra Americana" recebia a aula de defesa de
   estrangulamento em X: as duas são "defesa", e a trava só olhava
   o título. Agora vale o que o vídeo ensina: técnica marcada que
   não é a pedida e é de outra família, ou habilidade de outra
   família de finalização, é outra técnica e não entra. Aula de
   defesa em geral, sem técnica nem família, continua podendo
   entrar, marcada como geral.
   ------------------------------------------------------------ */
function familiasDoVideo(a) {
  const f = new Set();
  for (const u of a.tecnicas || []) {
    const c = familiaDaTecnica(u);
    if (c) f.add(c);
  }
  for (const h of a.habilidades || []) if (FAMILIAS_DE_FINALIZACAO.has(h)) f.add(h);
  return f;
}

/* a família de mecânica (fam:armlock...), a do catálogo, nunca a categoria */
const famsDoVideo = (a) => new Set((a.tecnicas || []).map((u) => TECNICA_POR_UID.get(u)?.fam).filter(Boolean));

function deOutroLugar(a, posicoes) {
  const pedidas = new Set(posicoes.map((pl) => separar(pl).posicao));
  if ((a.posicaoLado || []).some((pl) => pedidas.has(separar(pl).posicao))) return false;
  return (a.posicaoLado || []).length > 0 || (a.tecnicas || []).length > 0 || familiasDoVideo(a).size > 0;
}

function deOutraTecnica(a, pedido) {
  if (!pedido.familia) return false;
  if ((a.tecnicas || []).some((u) => (pedido.tecnicas || []).includes(u))) return false;
  const familias = familiasDoVideo(a);
  if (familias.has(pedido.familia)) return false;
  const temTecnica = (a.tecnicas || []).length > 0;
  const temOutraFinalizacao = [...familias].some((f) => FAMILIAS_DE_FINALIZACAO.has(f));
  return temTecnica || temOutraFinalizacao;
}

/* ------------------------------------------------------------
   pedido:
     tecnicas   uids da biblioteca
     nomes      os mesmos, por nome, pra achar no título
     familia    a categoria da técnica pedida (articular...)
     fam        a família de mecânica dela (fam:armlock), quando tem
     defesas    uids das defesas do catálogo contra ela (contra), no corrigir
     palavras   termos do assunto no título ("pesado", "força")
     posicoes   ['cem:baixo']
     habilidades, situacoes
     formatos   do mais desejado pro menos; com formatoEhAssunto,
                o formato conta como assunto ("entender o porquê")
   ------------------------------------------------------------ */
/* aula de defesa: marcada assim pela esteira, ou dizendo no título */
const PALAVRAS_DE_DEFESA = /(^| )(defesa|defender|defendendo|escapar|escapada|escape|sair|saida|fuga|fugir|evitar)( |$)/;
const ensinaDefesa = (a) => (a.habilidades || []).some((h) => h === 'defesa' || h === 'escapada')
  || PALAVRAS_DE_DEFESA.test(semAcento(a.t));

function relevancia(a, pedido) {
  const porque = [];
  let r = 0;

  const tecnicas = pedido.tecnicas || [];
  const nomes = pedido.nomes || [];
  const tecnico = tecnicas.length > 0 || nomes.length > 0;
  /* marcada com a defesa cujo contra aponta pro golpe: é a resposta
     certa, mesmo sendo de outra categoria (defesa) */
  const peloContra = (pedido.defesas || []).some((u) => (a.tecnicas || []).includes(u));
  if (tecnico && !peloContra && deOutraTecnica(a, pedido)) return { r: 0, porque: [] };
  if (nomes.length && tituloDeOutraTecnica(a.t, nomes)) return { r: 0, porque: [] };
  /* "Defesa contra Katagatame" não se responde com a aula de aplicar
     o katagatame: vídeo que não ensina defesa nem saída não entra */
  if (pedido.defesa && !peloContra && (!ensinaDefesa(a) || ehAulaDeAtaque(a))) return { r: 0, porque: [] };
  /* sair de uma posição ou evitar a queda: aula que é de outro lugar ou
     de outra técnica não completa a lista ("costas" não recebe 50/50) */
  if (!tecnicas.length && (pedido.posicoes || []).length && deOutroLugar(a, pedido.posicoes)) return { r: 0, porque: [] };
  /* e o contrário: quem quer aprender o golpe não recebe a aula de se
     defender dele (escapada e retenção são técnica de defesa, essas pode) */
  if (!pedido.defesa && tecnico && !['escapada', 'defesa', 'retencao'].includes(pedido.familia) && ehAulaDeDefesa(a)) return { r: 0, porque: [] };

  /* especifico: o vídeo é da técnica pedida, ou ao menos da família de
     mecânica dela (fam). Só a mesma categoria (Kimura pra quem pediu
     armlock) é resposta em geral, com nota menor. */
  let especifico = false;
  let saidaDe = null;
  if (peloContra) {
    r += 34;
    especifico = true;
    porque.push(nomes[0] || 'a técnica');
  } else if (tecnicas.some((u) => (a.tecnicas || []).includes(u))) {
    r += 30;
    especifico = true;
    porque.push(nomes[0] || 'a técnica');
  } else if (nomes.some((n) => tituloCita(a.t, n))) {
    r += 20;
    especifico = true;
    porque.push(nomes[0]);
  } else if (pedido.fam && famsDoVideo(a).has(pedido.fam)) {
    r += 8;
    especifico = true;
    porque.push(FAMILIA_POR_ID.get(pedido.fam)?.nome || nomeDe(HABILIDADES, pedido.familia));
  } else if (pedido.familia && familiasDoVideo(a).has(pedido.familia)) {
    r += 3;
    porque.push(nomeDe(HABILIDADES, pedido.familia));
  }

  /* o assunto no título ainda conta, e o motivo é a situação que
     o pedido descreve ("Contra mais pesado") */
  const palavras = pedido.palavras || [];
  if (palavras.some((p) => temPalavra(semAcento(a.t), semAcento(p)))) {
    r += 12;
    if (pedido.situacoes?.length) porque.push(nomeDe(SITUACOES, pedido.situacoes[0]));
  }

  /* pedido de sair de uma posição: aula que não trata dela é resposta em geral */
  let naPosicao = false;
  const posicional = !tecnico && (pedido.posicoes || []).length > 0 && (pedido.habilidades || []).includes('escapada');
  for (const pl of pedido.posicoes || []) {
    const { posicao, lado } = separar(pl);
    const doVideo = (a.posicaoLado || []).map(separar).filter((x) => x.posicao === posicao);
    if (!doVideo.length) continue;
    if (doVideo.some((x) => x.lado === lado)) {
      naPosicao = true;
      r += 14;
      porque.push(nomePosicaoLado(pl));
      if (pedido.defesa && !saidaDe) saidaDe = posicao;
    } else if (lado === 'neutro' || doVideo.some((x) => x.lado === 'neutro')) {
      naPosicao = true;
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

  return { r, porque: [...new Set(porque)], generico: (tecnico && !especifico) || (posicional && !naPosicao), saidaDe, peloContra };
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

   Num pedido de técnica, "só aula longa" vira preferência e não
   filtro: o short da Americana ganha da aula longa de defesa em
   geral. E o vídeo que só responde de forma geral vem marcado
   (generico), pra tela não dizer que ele ensina a técnica.
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
  const preferirAula = soAula && ((pedido.tecnicas || []).length > 0 || (pedido.nomes || []).length > 0);

  const notadas = lista
    .filter((a) => !fora.has(a.id) && (!soAula || preferirAula || a.k === 'aula'))
    .map((a) => {
      const { r, porque, generico, saidaDe, peloContra } = relevancia(a, pedido);
      if (r <= 0) return null;
      let nota = r * (PESO_DA_CLASSIFICACAO[a.classificacao] ?? 0.85);
      if (preferirAula && a.k !== 'aula') nota -= 6;
      const i = formatos.indexOf(a.formato);
      if (i === 0) nota += 4;
      else if (i > 0) nota += 2;
      nota += ajusteDoNivel(a.nivel, faixa);
      if (a.ordem != null) nota += 1;
      return { ...a, nota, porque, generico, saidaDe, peloContra, sorteio: semente(`${a.id}:${chave}`) };
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
  const querCurto = ['branca', 'azul'].includes(faixaDeConteudo(faixa));
  const [melhor, ...resto] = saida;
  const mesmoGrupo = (a) => vistasSet.has(a.id) === vistasSet.has(melhor.id);
  const perto = resto.filter((a) => mesmoGrupo(a) && a.nota >= melhor.nota * 0.8)
    .sort((a, b) => (querCurto ? a.d - b.d : b.d - a.d));
  const longe = resto.filter((a) => !perto.includes(a));

  /* na defesa: a defesa pelo contra, depois a aula de defesa marcada
     com o golpe, depois a saída da posição de onde ele sai, e por
     último a defesa em geral */
  const final = [melhor, ...perto, ...longe];
  if (pedido.defesa) {
    const lugar = (a) => (a.peloContra ? 0 : !a.generico ? 1 : a.saidaDe ? 2 : 3);
    final.sort((a, b) => lugar(a) - lugar(b));
  }
  return final.slice(0, quantidade)
    .map(({ nota: _n, sorteio: _s, ...a }) => a);
}
