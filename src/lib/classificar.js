import {
  POSICOES_LADO, HABILIDADES, FORMATOS, NIVEIS, SITUACOES,
  idsDe, separar, familiaDaHabilidade, doLegado, paraLegado,
} from './vocab';
import { categorizar } from './categorizar';

/* ============================================================
   A ESTEIRA DOS VÍDEOS

   Vídeo entra no acervo -> a IA diz o que ele ensina -> esta
   função decide se dá pra confiar.

   A IA não decide sozinha, por dois motivos:

   1. Ela inventa. Pedimos ids de uma lista fechada e ela devolve
      "escape_do_100kg". Aqui só passa o que está no vocabulário,
      e o resto é jogado fora, calado.

   2. Ela diz "90% de certeza" até quando chuta. Então a confiança
      não é a que ela declara: é a concordância entre sinais que
      não dependem dela. O que já estava etiquetado (os 680 foram
      etiquetados na mão), as regras do título e o tamanho da
      descrição do YouTube. Quando eles brigam, o vídeo vai pra
      revisão com o motivo escrito, e continua no ar.

   O que alguém já etiquetou nunca é apagado: o que a IA traz
   soma, não substitui. Quem conferiu na mão (revisada) nem passa
   por aqui.
   ============================================================ */

const conjunto = (lista) => new Set(idsDe(lista));
const VALIDAS = {
  posicao: new Set(POSICOES_LADO),
  habilidade: conjunto(HABILIDADES),
  formato: conjunto(FORMATOS),
  nivel: conjunto(NIVEIS),
  situacao: conjunto(SITUACOES),
};

const so = (lista, validos) =>
  [...new Set((Array.isArray(lista) ? lista : []).map((x) => String(x).trim()).filter((x) => validos.has(x)))];

const uniao = (...listas) => [...new Set(listas.flat().filter(Boolean))];

export const semAcento = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* "cem:neutro" sobra quando a mesma posição já veio com lado */
function limparNeutras(lista) {
  const comLado = new Set(lista.filter((pl) => separar(pl).lado !== 'neutro').map((pl) => separar(pl).posicao));
  return lista.filter((pl) => separar(pl).lado !== 'neutro' || !comLado.has(separar(pl).posicao));
}

/* ------------------------------------------------------------
   O nome que a IA deu -> a técnica da biblioteca.

   catalogo: [{ uid, nome, en }]. Casa primeiro pelo nome inteiro
   (em português, sem o parêntese, cada parte separada por
   vírgula, em inglês, ou o que está dentro do parêntese). Se não
   casar, procura a técnica que tem todas as palavras do nome e
   fica com a mais curta, que é a mais geral. Nome curto demais
   não arrisca.
   ------------------------------------------------------------ */
export function indiceDeTecnicas(catalogo) {
  const exato = new Map();
  const itens = catalogo.map((t) => {
    const nome = semAcento(t.nome);
    const variantes = [
      nome,
      semAcento(String(t.nome).replace(/\(.*?\)/g, '')),
      /* "Chave de braço, armlock": depois da vírgula é apelido */
      ...String(t.nome).replace(/\(.*?\)/g, '').split(',').map(semAcento),
      ...String(t.en || '').split('/').map(semAcento),
      ...[...String(t.nome).matchAll(/\(([^)]+)\)/g)].map((m) => semAcento(m[1])),
    ].filter(Boolean);
    for (const v of variantes) if (!exato.has(v)) exato.set(v, t.uid);
    return { uid: t.uid, tamanho: nome.length, palavras: new Set(variantes.join(' ').split(' ')) };
  });
  return { exato, itens };
}

export function acharTecnicas(nomes, indice) {
  if (!indice) return [];
  const achadas = [];
  for (const bruto of Array.isArray(nomes) ? nomes : []) {
    const n = semAcento(bruto);
    if (n.length < 4) continue;
    let uid = indice.exato.get(n);
    if (!uid) {
      const palavras = n.split(' ');
      uid = indice.itens
        .filter((t) => palavras.every((p) => t.palavras.has(p)))
        .sort((a, b) => a.tamanho - b.tamanho)[0]?.uid;
    }
    if (uid && !achadas.includes(uid)) achadas.push(uid);
  }
  return achadas;
}

/* o que a IA mandou, só com o que existe */
export function limparDaIa(bruta, indice) {
  const certeza = Number(bruta?.certeza);
  return {
    posicaoLado: limparNeutras(so(bruta?.posicoes, VALIDAS.posicao)),
    habilidades: so(bruta?.habilidades, VALIDAS.habilidade),
    situacoes: so(bruta?.situacoes, VALIDAS.situacao),
    formato: VALIDAS.formato.has(bruta?.formato) ? bruta.formato : null,
    nivel: VALIDAS.nivel.has(bruta?.nivel) ? bruta.nivel : null,
    tecnicas: acharTecnicas(bruta?.tecnicas, indice),
    certeza: Number.isFinite(certeza) ? Math.min(1, Math.max(0, certeza)) : 0,
    duvida: String(bruta?.duvida || '').trim().slice(0, 200),
  };
}

export const CERTEZA_MINIMA = 0.6;
const DESCRICAO_MINIMA = 80;

/* ------------------------------------------------------------
   Os dois lados da mesma briga. O tema antigo "controle" marcava
   todo vídeo de 100kg, montada e costas, inclusive o de quem está
   embaixo tentando sair; "guarda" marcava todo vídeo com "meia" ou
   "fechada" no título, inclusive o de passar. A IA dizer "escapada"
   num vídeo que era "controle" não é discordância.

   Discordância é o que não tem nada a ver: "queda" num vídeo que
   era de finalização.
   ------------------------------------------------------------ */
const PARES = [
  ['controle', 'escapada'], ['controle', 'transicao'], ['controle', 'finalizacao'],
  ['escapada', 'defesa'], ['defesa', 'finalizacao'],
  ['guarda', 'raspagem'], ['guarda', 'retencao'], ['guarda', 'passagem'], ['guarda', 'finalizacao'],
  ['retencao', 'passagem'], ['pegada', 'guarda'],
  ['queda', 'pegada'], ['queda', 'base'], ['base', 'fisico'],
];
const VIZINHAS = PARES.reduce((m, [a, b]) => {
  (m[a] = m[a] || []).push(b);
  (m[b] = m[b] || []).push(a);
  return m;
}, {});

/* a habilidade, a família dela e o outro lado da briga */
const parentes = (h) => familiaDaHabilidade(h).flatMap((x) => [x, ...(VIZINHAS[x] || [])]);

/* ------------------------------------------------------------
   video: a linha da tabela aula (titulo, temas, posicoes, faixa,
          yt_descricao). ia: o que limparDaIa devolveu.

   Devolve os campos pra gravar, já com o estado e o motivo.
   ------------------------------------------------------------ */
export function decidir(video, ia) {
  const antes = doLegado({ temas: video.temas || [], posicoes: video.posicoes || [], faixa: video.faixa });
  const motivos = [];

  if (!ia.habilidades.length && !ia.formato) {
    motivos.push('a IA não achou o que o vídeo ensina');
  }
  if (ia.certeza < CERTEZA_MINIMA) {
    motivos.push(ia.duvida ? `a IA ficou em dúvida: ${ia.duvida}` : 'a IA ficou em dúvida');
  }

  /* a família conta ("estrangulamento" concorda com "finalização"),
     e o outro lado da briga também */
  const daIa = new Set(ia.habilidades.flatMap(parentes));
  if (antes.habilidades.length && ia.habilidades.length && !antes.habilidades.some((h) => daIa.has(h))) {
    motivos.push(`estava em ${antes.habilidades.join(', ')} e a IA disse ${ia.habilidades.join(', ')}`);
  }

  /* título que não diz nada e descrição vazia: qualquer resposta
     é chute, por mais segura que a IA pareça */
  const tituloDiz = categorizar(video.titulo).temas.length > 0;
  const descricaoDiz = String(video.yt_descricao || '').trim().length >= DESCRICAO_MINIMA;
  if (!tituloDiz && !descricaoDiz) {
    motivos.push('título genérico e quase sem descrição');
  }

  const novo = {
    posicaoLado: limparNeutras(uniao(ia.posicaoLado, antes.posicaoLado)),
    habilidades: uniao(ia.habilidades, antes.habilidades),
    formato: ia.formato || antes.formato,
  };
  const volta = paraLegado({ ...novo, situacoes: ia.situacoes });
  const temas = uniao((video.temas || []).filter((t) => t !== 'geral'), volta.temas);

  return {
    posicao_lado: novo.posicaoLado,
    habilidades: novo.habilidades,
    formato: novo.formato,
    nivel: ia.nivel || antes.nivel,
    situacoes: ia.situacoes,
    tecnicas: ia.tecnicas,
    classificacao: motivos.length ? 'revisar' : 'automatica',
    classificacao_motivo: motivos.join(' · ') || null,
    /* o Estudo ainda separa por tema: o vídeo novo já aparece no
       tema certo, e o que alguém tinha etiquetado continua lá */
    temas: temas.length ? temas : ['geral'],
    posicoes: uniao(video.posicoes || [], volta.posicoes),
    revisar: false,
  };
}
