import { hoje, addDias } from './utils';

/* Leitner simplificado. Caixas com intervalos crescentes.
   Combate a curva de esquecimento sem virar burocracia. */
export const CAIXAS = [1, 3, 7, 16, 35, 75];

export function proximaRevisao(box) {
  const i = Math.min(Math.max(0, box), CAIXAS.length - 1);
  return addDias(hoje(), CAIXAS[i]);
}

export function novaRevisao(techniqueId) {
  return {
    techniqueId,
    box: 0,
    proxima: hoje(),
    acertos: 0,
    erros: 0,
    ultimaEm: null,
    criadoEm: Date.now(),
  };
}



