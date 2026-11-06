import { SEED } from '../db/seed';
import { uidEstavel, chaveNome } from './uid';
import { RENOMEAR } from '../db/renomeios';
import { DE_POSICAO_BIBLIOTECA, separar } from './vocab';
import { indiceDeTecnicas, semAcento } from './classificar';

/* ============================================================
   O CATÁLOGO DE TÉCNICAS

   As técnicas da biblioteca, cada uma com o uid estável que ela
   tem em todo aparelho e a família dela (a categoria: articular,
   estrangulamento, perna, raspagem...). Um lugar só: o cadastro
   de vídeo, as necessidades do aluno e o motor de recomendação
   leem daqui.

   A família é o que impede o motor de responder "defesa contra
   Americana" com a aula de defesa de estrangulamento.
   ============================================================ */
/* O lado de quem faz a técnica. O mapa das posições (DE_POSICAO_BIBLIOTECA)
   diz o lado de quem ESTÁ naquela posição, e duas famílias de técnica saem
   dela do lado oposto, pela categoria:
   - passagem: quem passa está por cima, a posição é da guarda de quem está
     por baixo (guarda_aberta:baixo → guarda_aberta:cima);
   - atacar a tartaruga (finalização, transição, pegada): quem ataca está por
     cima. Escapada, defesa, queda e movimento base saem de quem está por baixo.
   Só troca o lado "baixo"; neutro e cima ficam como estão. Nunca pelo nome. */
const ATACA_A_TARTARUGA = new Set(['estrangulamento', 'articular', 'perna', 'compressao', 'transicao', 'pegada']);
export function deDaTecnica(t) {
  const de = DE_POSICAO_BIBLIOTECA[t.from] || null;
  if (!de || separar(de).lado !== 'baixo') return de;
  const topo = t.cat === 'passagem' || (t.from === 'tartaruga' && ATACA_A_TARTARUGA.has(t.cat));
  return topo ? `${separar(de).posicao}:cima` : de;
}

export const CATALOGO_TECNICAS = SEED.techniques.map((t) => ({
  /* o uid sai do nome antigo, quando teve: as aulas marcadas antes da troca continuam ligadas */
  uid: uidEstavel(chaveNome('techniques', t.antigo || t.pt)),
  nome: t.pt,
  antigo: t.antigo || null,
  en: t.en,
  cat: t.cat,
  de: deDaTecnica(t),
  posicao: separar(deDaTecnica(t) || '').posicao || null,
  /* o que as regras dos assuntos leem (assuntos.js): slug de posição, família e etiquetas.
     contra: o que a defesa defende, só o confirmado (fam:* ou uid); pendente: o que ainda
     precisa de decisão do dono e por isso NÃO entra no contra */
  from: t.from,
  to: t.to,
  fam: t.fam || null,
  tags: t.tags || [],
  contra: t.contra || [],
  pendente: t.pendente || null,
  busca: semAcento(`${t.pt} ${t.en} ${t.antigo || ''}`),
  /* a cópia repetida que saiu da biblioteca tinha uid próprio: a aula
     marcada com ele continua achando esta */
  uids: [uidEstavel(chaveNome('techniques', t.antigo || t.pt)), ...(t.juntou || []).map((n) => uidEstavel(chaveNome('techniques', n)))],
}));

export const TECNICA_POR_UID = new Map(CATALOGO_TECNICAS.flatMap((t) => t.uids.map((u) => [u, t])));
export const INDICE_TECNICAS = indiceDeTecnicas(CATALOGO_TECNICAS);

/* as categorias de finalização da biblioteca (compressão desde 05/11/2026) */
export const FAMILIAS_DE_FINALIZACAO = new Set(['estrangulamento', 'articular', 'perna', 'compressao']);

export const familiaDaTecnica = (uid) => TECNICA_POR_UID.get(uid)?.cat || null;

/* de onde a técnica vem, só pelo uid: no catálogo (inclui os uids de nome
   antigo e das que juntaram, e os nomes antigos de RENOMEAR, que o sync
   também trata como biblioteca) é oficial; fora dele é a que o atleta criou */
const UIDS_RENOMEADOS = new Set(Object.keys(RENOMEAR).map((n) => uidEstavel(chaveNome('techniques', n))));
export const origemDaTecnica = (uid) => (TECNICA_POR_UID.has(uid) || UIDS_RENOMEADOS.has(uid) ? 'catalogo' : 'propria');
