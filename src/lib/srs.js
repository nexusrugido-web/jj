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

/* resultado: 'facil' | 'ok' | 'dificil' */
export function avancar(rev, resultado) {
  let box = rev.box ?? 0;
  if (resultado === 'facil') box = Math.min(box + 2, CAIXAS.length - 1);
  else if (resultado === 'ok') box = Math.min(box + 1, CAIXAS.length - 1);
  else box = 0;

  return {
    ...rev,
    box,
    proxima: proximaRevisao(box),
    ultimaEm: hoje(),
    acertos: (rev.acertos || 0) + (resultado === 'dificil' ? 0 : 1),
    erros: (rev.erros || 0) + (resultado === 'dificil' ? 1 : 0),
  };
}

export function devidas(reviews) {
  const h = hoje();
  return reviews.filter((r) => (r.proxima || h) <= h);
}

export function forcaMemoria(rev) {
  const box = rev.box ?? 0;
  return Math.round(((box + 1) / CAIXAS.length) * 100);
}
