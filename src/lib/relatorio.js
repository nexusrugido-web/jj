import { placarDaRola } from './game';
import { calcularAtaque } from './graus';
import { mesCompleto } from './utils';

/* ============================================================
   O RELATÓRIO DO MÊS (e a retrospectiva do ano)

   O mês que fechou numa tela: treinos, horas e rolas (e quanto
   mudou do mês anterior), as técnicas que subiram de grau dentro
   dele, quantos rolas você ganhou, o que ainda te pega e o foco
   pro mês seguinte. A mesma conta, com um ano no lugar do mês, é a
   retrospectiva de dezembro.

   "Subiu de grau no período": o grau com os usos até o último dia
   do período contra o grau com os usos de antes dele.
   ============================================================ */
const pad = (n) => String(n).padStart(2, '0');

/* o período de um mês: '2026-09' vira 01/09 a 30/09 */
export function periodoDoMes(ano, mes) {
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  return { ini: `${ano}-${pad(mes + 1)}-01`, fim: `${ano}-${pad(mes + 1)}-${pad(ultimo)}`, nome: mesCompleto(mes), ano, mes };
}

/* o mês que acabou de fechar, olhando de hoje */
export function mesPassado(hj) {
  const [a, m] = hj.split('-').map(Number);
  return m === 1 ? periodoDoMes(a - 1, 11) : periodoDoMes(a, m - 2);
}

function numeros(sessions, rolls, ini, fim) {
  const doPeriodo = sessions.filter((s) => s.data >= ini && s.data <= fim && s.tipo !== 'competicao');
  const ids = new Set(doPeriodo.map((s) => s.id));
  const rs = rolls.filter((r) => ids.has(r.sessionId));
  let venceu = 0;
  const sofridas = new Map();
  for (const r of rs) {
    if (placarDaRola(r).ganhou) venceu++;
    for (const n of r.subsSofridas || []) sofridas.set(n, (sofridas.get(n) || 0) + 1);
  }
  const minutos = doPeriodo.reduce((a, s) => a + (Number(s.duracao) || 0), 0);
  const cede = [...sofridas.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  return {
    treinos: doPeriodo.length,
    horas: Math.round(minutos / 60),
    rolas: rs.length,
    venceu,
    taxa: rs.length ? Math.round((venceu / rs.length) * 100) : null,
    cede: cede ? { nome: cede[0], vezes: cede[1] } : null,
  };
}

export function relatorio({ sessions = [], rolls = [], esteira = [], faixa = 'branca', ini, fim, anteriorIni, anteriorFim }) {
  const agora = numeros(sessions, rolls, ini, fim);
  const antes = anteriorIni ? numeros(sessions, rolls, anteriorIni, anteriorFim) : null;

  const subiram = esteira
    .filter((t) => (t.historico || []).some((u) => u.data >= ini && u.data <= fim))
    .map((t) => {
      const ate = (t.historico || []).filter((u) => u.data && u.data <= fim);
      const antesDele = (t.historico || []).filter((u) => u.data && u.data < ini);
      /* o grau de cada momento pelos usos daquele momento (o grau guardado
         da régua antiga conta usos de qualquer data e esconderia a subida) */
      const g1 = calcularAtaque(antesDele, faixa).grau;
      const g2 = calcularAtaque(ate, faixa).grau;
      return { nome: t.nome, de: g1, para: g2 };
    })
    .filter((t) => t.para > t.de)
    .sort((a, b) => b.para - a.para);

  return {
    ...agora,
    vazio: agora.treinos === 0,
    variacao: antes ? { rolas: agora.rolas - antes.rolas, treinos: agora.treinos - antes.treinos } : null,
    taxaAntes: antes?.taxa ?? null,
    subiram,
    /* o foco do mês seguinte: sair do que mais te pegou */
    foco: agora.cede && agora.cede.vezes >= 2 ? agora.cede.nome : null,
  };
}

export function relatorioDoMes({ hj, ...dados }) {
  const p = mesPassado(hj);
  const a = mesPassado(p.ini);
  return { periodo: p, ...relatorio({ ...dados, ini: p.ini, fim: p.fim, anteriorIni: a.ini, anteriorFim: a.fim }) };
}

export function retrospectivaDoAno({ ano, ...dados }) {
  return {
    periodo: { ini: `${ano}-01-01`, fim: `${ano}-12-31`, nome: String(ano), ano },
    ...relatorio({ ...dados, ini: `${ano}-01-01`, fim: `${ano}-12-31`, anteriorIni: `${ano - 1}-01-01`, anteriorFim: `${ano - 1}-12-31` }),
  };
}
