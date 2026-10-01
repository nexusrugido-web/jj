import { placarDaRola } from './game';
import { pontosPorId, posInicialPorId } from '../db/scoring';
import { artigo } from './treinoDeHoje';

/* ============================================================
   O RAIO-X DO PARCEIRO

   Só os rolas com aquela pessoa: o placar entre vocês, de onde você
   vai bem (a posição em que o rola começou), o que você encaixa
   nele, o que ele faz em você (finalização e ponto) e um plano pro
   próximo rola, montado com essas duas pontas. Nada aparece sem
   rola que sustente: posição só com 2+ rolas, e o plano só com 3+.
   ============================================================ */
const contar = (lista) => {
  const m = new Map();
  for (const x of lista) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([nome, vezes]) => ({ nome, vezes }));
};

export function raioX(partnerId, rolls = []) {
  const rs = rolls.filter((r) => r.partnerId === partnerId);
  let venceu = 0, perdeu = 0;
  const porPosicao = new Map();
  for (const r of rs) {
    const p = placarDaRola(r);
    if (p.ganhou) venceu++; else if (p.perdeu) perdeu++;
    if (r.posInicial) {
      const o = porPosicao.get(r.posInicial) || { n: 0, v: 0 };
      o.n++; if (p.ganhou) o.v++;
      porPosicao.set(r.posInicial, o);
    }
  }
  const posicoes = [...porPosicao.entries()]
    .map(([id, o]) => ({ id, nome: posInicialPorId[id]?.nome || id, ...o }))
    .filter((p) => p.n >= 2);
  const melhor = posicoes.filter((p) => p.v / p.n > 0.5).sort((a, b) => b.v / b.n - a.v / a.n || b.n - a.n)[0] || null;
  const pior = posicoes.filter((p) => p.v / p.n < 0.5).sort((a, b) => a.v / a.n - b.v / b.n || b.n - a.n)[0] || null;

  const minhas = contar(rs.flatMap((r) => r.subsAplicadas || []));
  const dele = contar(rs.flatMap((r) => r.subsSofridas || []));
  const pontosDele = contar(rs.flatMap((r) => r.ptsDele || [])).map((x) => ({ ...x, nome: pontosPorId[x.nome]?.nome || x.nome }));

  /* o plano: começar de onde você ganha e fechar a porta do que ele faz */
  let plano = null;
  if (rs.length >= 3) {
    const partes = [];
    if (melhor) partes.push(`começa ${melhor.nome.toLowerCase()}`);
    if (dele[0]) partes.push(`fica esperto com ${artigo(dele[0].nome)} ${dele[0].nome}`);
    else if (pontosDele[0]) partes.push(`não deixa sair ${artigo(pontosDele[0].nome)} ${pontosDele[0].nome.toLowerCase()}`);
    if (minhas[0]) partes.push(`procura ${artigo(minhas[0].nome)} ${minhas[0].nome}, que já entrou nele`);
    if (partes.length) plano = partes.join('; ');
  }

  return {
    rolas: rs.length,
    venceu, perdeu, empate: rs.length - venceu - perdeu,
    melhor, pior, minhas: minhas.slice(0, 3), dele: dele.slice(0, 3), pontosDele: pontosDele.slice(0, 2), plano,
  };
}
