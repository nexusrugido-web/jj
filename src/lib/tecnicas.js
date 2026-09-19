import { SEED } from '../db/seed';
import { uidEstavel, chaveNome } from './uid';
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
export const CATALOGO_TECNICAS = SEED.techniques.map((t) => ({
  uid: uidEstavel(chaveNome('techniques', t.pt)),
  nome: t.pt,
  en: t.en,
  cat: t.cat,
  de: DE_POSICAO_BIBLIOTECA[t.from] || null,
  posicao: separar(DE_POSICAO_BIBLIOTECA[t.from] || '').posicao || null,
  busca: semAcento(`${t.pt} ${t.en}`),
}));

export const TECNICA_POR_UID = new Map(CATALOGO_TECNICAS.map((t) => [t.uid, t]));
export const INDICE_TECNICAS = indiceDeTecnicas(CATALOGO_TECNICAS);

/* as três famílias de finalização da biblioteca */
export const FAMILIAS_DE_FINALIZACAO = new Set(['estrangulamento', 'articular', 'perna']);

export const familiaDaTecnica = (uid) => TECNICA_POR_UID.get(uid)?.cat || null;
