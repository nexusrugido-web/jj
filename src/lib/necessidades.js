import { SEED } from '../db/seed';
import { uidEstavel, chaveNome } from './uid';
import { indiceDeTecnicas, acharTecnicas } from './classificar';
import {
  DE_POSICAO_SOFRIDA, DE_POSICAO_BIBLIOTECA, HABILIDADES, SITUACOES, FORMATOS, nomeDe, nomePosicaoLado,
} from './vocab';

/* ============================================================
   O QUE O ALUNO PRECISA, NA LÍNGUA DOS VÍDEOS

   O app já sabe muita coisa: a posição em que você fica preso, a
   finalização que te pega, a técnica que você está tentando
   firmar, a dificuldade que você escolheu, o estilo que você
   marcou. Aqui cada uma vira um pedido pro motor
   (src/lib/motor.js), no mesmo vocabulário em que o vídeo foi
   classificado. É isso que faz o vídeo certo achar a pessoa certa.
   ============================================================ */

const CATALOGO = SEED.techniques.map((t) => ({
  uid: uidEstavel(chaveNome('techniques', t.pt)),
  nome: t.pt,
  en: t.en,
  cat: t.cat,
  de: DE_POSICAO_BIBLIOTECA[t.from] || null,
}));
const INDICE = indiceDeTecnicas(CATALOGO);
const porUid = new Map(CATALOGO.map((t) => [t.uid, t]));

/* o formato que cada momento pede, do mais útil pro menos */
const FORMATO_DA_INTENCAO = {
  corrigir: ['tecnica', 'conceito'],
  aprender: ['conceito', 'tecnica'],
  repetir: ['drill', 'tecnica'],
  consolidar: ['drill', 'tecnica'],
  testar: ['conceito', 'analise'],
  adaptar: ['tecnica', 'conceito'],
  conectar: ['conceito', 'tecnica'],
  refinar: ['tecnica', 'conceito'],
  explorar: ['conceito', 'tecnica'],
  validar: ['analise', 'conceito'],
};

/* ------------------------------------------------------------
   Uma recomendação (src/lib/recomendar.js) vira pedido.

   Preso numa posição: a posição com o lado de baixo, e escapada.
   Finalização que te pega: a técnica, e defesa.
   Técnica sua: a técnica, a habilidade dela e a posição de onde
   ela sai.
   ------------------------------------------------------------ */
export function pedidoDaRec(rec) {
  const formatos = FORMATO_DA_INTENCAO[rec.intencao] || ['conceito'];

  if (rec.situacao) return { situacoes: [rec.situacao], palavras: PALAVRAS_DA_SITUACAO[rec.situacao] || [], formatos };

  if (rec.posicao) {
    const pl = DE_POSICAO_SOFRIDA[rec.posicao];
    return { posicoes: pl ? [pl] : [], habilidades: ['escapada'], formatos };
  }

  if (rec.alvo) {
    const tecnicas = acharTecnicas([rec.alvo], INDICE);
    const t = porUid.get(tecnicas[0]);
    if (rec.intencao === 'corrigir') {
      return { tecnicas, nomes: [rec.alvo], habilidades: ['defesa'], formatos };
    }
    return {
      tecnicas,
      nomes: [rec.alvo],
      habilidades: t ? [t.cat] : [],
      posicoes: t?.de ? [t.de] : [],
      formatos,
    };
  }

  /* sem alvo (repertório concentrado, por exemplo): o porquê */
  return { formatos, formatoEhAssunto: true };
}

/* o assunto no título, enquanto a IA não classificou tudo */
const PALAVRAS_DA_SITUACAO = {
  perdido_no_rola: ['o que fazer', 'estrategia', 'pensar', 'perdido', 'conectar', 'plano de jogo'],
  esquece_tecnica: ['drill', 'repeticao', 'lembrar', 'esquecer', 'memorizar', 'fixar'],
  contra_pesado: ['pesado', 'pesados', 'leve', 'mais forte'],
  menos_forca: ['forca', 'sem forca'],
  sem_gas: ['gas', 'folego', 'cansar', 'respiracao'],
  competir: ['competicao', 'campeonato', 'competir'],
};

/* ------------------------------------------------------------
   AS DIFICULDADES

   As da aba "Por dificuldade". Saíram das respostas do formulário
   de entrada dos alunos: metade não é de posição. Peso e força
   (treinar com gente mais pesada, depender de força) apareceram
   em 14 das 81 respostas e não tinham lugar no app.
   ------------------------------------------------------------ */
export const DIFICULDADES = [
  { id: 'porque', nome: 'Entender o porquê das técnicas', pedido: { formatos: ['conceito'], formatoEhAssunto: true } },
  { id: 'travar', nome: 'Travar no rola, não saber o que fazer', pedido: { situacoes: ['perdido_no_rola'], palavras: PALAVRAS_DA_SITUACAO.perdido_no_rola, formatos: ['conceito'] } },
  { id: 'pesado', nome: 'Lutar contra quem é mais pesado', pedido: { situacoes: ['contra_pesado'], palavras: PALAVRAS_DA_SITUACAO.contra_pesado, formatos: ['conceito', 'tecnica'] } },
  { id: 'forca', nome: 'Usar força demais', pedido: { situacoes: ['menos_forca'], palavras: PALAVRAS_DA_SITUACAO.menos_forca, formatos: ['conceito'] } },
  { id: 'gas', nome: 'Cansar rápido, faltar gás', pedido: { situacoes: ['sem_gas'], habilidades: ['fisico'], palavras: PALAVRAS_DA_SITUACAO.sem_gas, formatos: ['conceito', 'drill'] } },
  { id: 'apanhar', nome: 'Apanhar muito, não conseguir sair', pedido: { posicoes: ['cem:baixo', 'montada:baixo', 'costas:baixo'], habilidades: ['escapada', 'defesa'], formatos: ['tecnica', 'conceito'] } },
  { id: 'guarda', nome: 'Não conseguir jogar de guarda', pedido: { habilidades: ['guarda', 'retencao', 'raspagem'], formatos: ['conceito', 'tecnica'] } },
  { id: 'passar', nome: 'Não conseguir passar a guarda', pedido: { habilidades: ['passagem'], formatos: ['conceito', 'tecnica'] } },
  { id: 'esquecer', nome: 'Esquecer a técnica na hora', pedido: { situacoes: ['esquece_tecnica'], palavras: PALAVRAS_DA_SITUACAO.esquece_tecnica, formatos: ['drill', 'conceito'] } },
  { id: 'corpo', nome: 'Idade, dor ou lesão atrapalhando', pedido: { habilidades: ['fisico'], palavras: ['lesao', 'lesoes', 'idade', 'mobilidade', 'alongamento', 'dor'], formatos: ['conceito'] } },
  { id: 'competir', nome: 'Me preparar pra competir', pedido: { situacoes: ['competir'], palavras: PALAVRAS_DA_SITUACAO.competir, formatos: ['conceito', 'analise'] } },
];

/* o estilo que a pessoa marcou puxa as habilidades dele */
export const PEDIDO_DO_ESTILO = {
  quedador: { habilidades: ['queda', 'pegada'], formatos: ['tecnica', 'conceito'] },
  passador: { habilidades: ['passagem'], formatos: ['tecnica', 'conceito'] },
  guardeiro: { habilidades: ['guarda', 'raspagem', 'retencao'], formatos: ['tecnica', 'conceito'] },
  finalizador: { habilidades: ['finalizacao'], formatos: ['tecnica', 'conceito'] },
  controlador: { habilidades: ['controle', 'transicao'], formatos: ['tecnica', 'conceito'] },
  defensor: { habilidades: ['escapada', 'defesa'], formatos: ['tecnica', 'conceito'] },
  completo: { formatos: ['conceito'], formatoEhAssunto: true },
};

/* ------------------------------------------------------------
   O pedido em palavras, pro painel mostrar onde falta vídeo:
   "100kg por baixo · Escapada", "Contra mais pesado".
   ------------------------------------------------------------ */
export function descreverPedido(pedido = {}) {
  const partes = [
    ...(pedido.nomes || []),
    ...(pedido.posicoes || []).map(nomePosicaoLado),
    ...(pedido.habilidades || []).map((h) => nomeDe(HABILIDADES, h)),
    ...(pedido.situacoes || []).map((x) => nomeDe(SITUACOES, x)),
    ...(pedido.formatoEhAssunto ? (pedido.formatos || []).slice(0, 1).map((f) => nomeDe(FORMATOS, f)) : []),
  ];
  return [...new Set(partes)].join(' · ') || 'geral';
}
