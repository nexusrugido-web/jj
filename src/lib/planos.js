/* ============================================================
   PLANOS DE ATAQUE

   A corrente: da posição, a finta; ele reage; vem o golpe; se ele
   defender, o próximo. Máximo de 4 golpes. Posição, finta e golpe
   saem do catálogo; a reação dele é uma frase curta.

   Guardado na mesma tabela dos 16 prontos (attackPlans), no mesmo
   formato de passo: gatilho é a reação dele, acao é o golpe. Assim
   o pronto copiado vira plano seu sem conversão.
   ============================================================ */

export const MAX_PASSOS = 4;
export const PLANOS_NO_GRATIS = 1;

export const meusPlanos = (planos = []) => planos.filter((p) => !p.pronto && !p.arquivada);
export const planosProntos = (planos = []) => planos.filter((p) => p.pronto && !p.arquivada);

/* o grátis tem 1 plano seu (próprio ou copiado de um pronto) */
export const podeCriarPlano = (planos, premium) => premium || meusPlanos(planos).length < PLANOS_NO_GRATIS;

/* o que a tela desenha, venha do pronto ou do aluno */
export function correnteDoPlano(p) {
  const passos = (p?.passos || []).filter((x) => String(x.acao || '').trim()).slice(0, MAX_PASSOS);
  return {
    posicao: p?.posicao || '',
    finta: p?.finta || '',
    passos: passos.map((x) => ({ reacao: x.gatilho || '', golpe: x.acao, detalhe: x.detalhe || '' })),
    /* o fim da corrente nos prontos: pra onde voltar se tudo falhar */
    fim: passos[passos.length - 1]?.proxima || '',
  };
}

/* copiar um pronto: vira plano seu, sem slug (o slug é da semente) */
export function copiaDoPronto(p) {
  const { id, uid, slug, pronto, favorito, criadoEm, updatedAt, __local, ...resto } = p; // eslint-disable-line no-unused-vars
  return {
    ...resto,
    nome: p.nome,
    passos: (p.passos || []).slice(0, MAX_PASSOS),
    copiadoDe: slug || null,
    pronto: 0, favorito: 0, arquivada: 0,
  };
}

/* o plano novo que a tela salva */
export function planoNovo({ nome, posicao, posicaoId = null, finta = '', passos = [], paraAltura = [], paraPeso = [] }) {
  return {
    paraAltura, paraPeso,
    nome: String(nome || '').trim() || 'Meu plano',
    posicao: posicao || '',
    posicaoId,
    finta: finta || '',
    passos: passos
      .filter((x) => String(x.golpe || '').trim())
      .slice(0, MAX_PASSOS)
      .map((x) => ({ gatilho: String(x.reacao || '').trim(), acao: x.golpe, seFalhar: '', proxima: '', detalhe: '' })),
    tipo: 'ataque', modo: 'ambos', faixa: 'branca', legal: true, aviso: '', resumo: '',
    pronto: 0, favorito: 0, arquivada: 0,
  };
}

/* ---------- pra quem serve ----------
   Altura e peso dele em relação a você. Plano sem etiqueta serve pra
   qualquer um e não entra na lista do parceiro: a lista é dos que
   foram pensados pra gente daquele tamanho. */
export const ALTURA_REL = [
  { id: 'alto', nome: 'Mais alto que eu', icone: '↑' },
  { id: 'parecida', nome: 'Altura parecida', icone: '=' },
  { id: 'baixo', nome: 'Mais baixo que eu', icone: '↓' },
];
export const alturaRelPorId = Object.fromEntries(ALTURA_REL.map((a) => [a.id, a]));

export function servePara(plano, parceiro) {
  const dims = [['paraAltura', 'alturaRel'], ['paraPeso', 'pesoRel']];
  let bateu = 0;
  for (const [tag, campo] of dims) {
    const tags = plano?.[tag] || [];
    if (!tags.length) continue;
    if (!parceiro?.[campo]) continue;
    if (!tags.includes(parceiro[campo])) return false;
    bateu++;
  }
  return bateu > 0;
}

export const planosQueServem = (planos, parceiro) =>
  [...meusPlanos(planos), ...planosProntos(planos)].filter((p) => servePara(p, parceiro));
