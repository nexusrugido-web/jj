/* ============================================================
   O PADRÃO DE CADA TIPO
   Cada tipo de treino tem o seu: a aula de Gi com o professor de
   sempre, o open mat na academia mas sem professor, a competição
   sem academia nenhuma. Quem salva um padrão pra um tipo muda só
   aquele tipo.
   ============================================================ */
export function padraoDoTipo(settings, tipo) {
  const salvo = settings.padroesTreino?.[tipo];
  if (salvo) return salvo;
  const geral = {
    academiaId: settings.academiaPadraoId || null,
    professorId: settings.professorPadraoId || null,
    duracao: settings.duracaoTreinoPadrao || 90,
  };
  if (tipo === 'competicao') return { academiaId: null, professorId: null, duracao: null };
  if (tipo === 'openmat') return { ...geral, professorId: null };
  return geral;
}

