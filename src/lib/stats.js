import { hoje, addDias, diasEntre, pct, contar } from './utils';
import { placarDaRola } from './game';

/* ---------- streak ---------- */
export function calcStreak(datas) {
  const set = new Set(datas);
  if (!set.size) return { atual: 0, recorde: 0, ultimo: null };

  // streak atual: conta pra tras a partir de hoje (tolera 1 dia de folga? nao, dia exato)
  let atual = 0;
  let cursor = hoje();
  if (!set.has(cursor)) cursor = addDias(cursor, -1); // ontem ainda conta
  while (set.has(cursor)) {
    atual++;
    cursor = addDias(cursor, -1);
  }

  const ord = [...set].sort();
  let recorde = 0;
  let run = 0;
  let prev = null;
  for (const d of ord) {
    run = prev && diasEntre(prev, d) === 1 ? run + 1 : 1;
    recorde = Math.max(recorde, run);
    prev = d;
  }
  return { atual, recorde, ultimo: ord[ord.length - 1] };
}

/* ---------- semana ---------- */
export function inicioSemana(iso = hoje()) {
  const d = new Date(iso + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  return addDias(iso, -dow);
}

export function treinosNaSemana(sessions, ref = hoje()) {
  const ini = inicioSemana(ref);
  const fim = addDias(ini, 6);
  const dias = new Set(sessions.filter((s) => s.data >= ini && s.data <= fim).map((s) => s.data));
  return { qtd: dias.size, ini, fim };
}

/* ---------- resumo geral ---------- */
export function resumo(sessions, rolls) {
  const matMin = sessions.reduce((a, s) => a + (Number(s.duracao) || 0), 0);

  /* Drill não é luta. Quem treinou a técnica dez vezes com o
     parceiro colaborando não lutou dez vezes, e misturar as duas
     coisas infla o número e tira o sentido dele. */
  const lutas = rolls.filter((r) => (r.contexto || 'rola') !== 'drill');
  const total = lutas.length;
  const fin = lutas.filter((r) => r.resultado === 'finalizei' || r.resultado === 'ambos').length;
  const tap = lutas.filter((r) => r.resultado === 'fui_finalizado' || r.resultado === 'ambos').length;
  const placares = lutas.map(placarDaRola);
  const vitorias = placares.filter((p) => p.ganhou).length;

  const subsAplicadas = lutas.flatMap((r) => r.subsAplicadas || []);
  const subsSofridas = lutas.flatMap((r) => r.subsSofridas || []);

  return {
    sessoes: sessions.length,
    matMin,
    matHoras: Math.round(matMin / 60),
    rolas: total,
    drills: rolls.length - total,
    vitorias,
    derrotas: placares.filter((p) => p.perdeu).length,
    taxaVitoria: pct(vitorias, total),
    finalizacoes: subsAplicadas.length,
    taps: subsSofridas.length,
    subPct: pct(fin, total),
    tapPct: pct(tap, total),
    saldo: subsAplicadas.length - subsSofridas.length,
    streak: calcStreak([...new Set(sessions.map((s) => s.data))]),
    /* as listas inteiras, pro "Ver todas" */
    aplicadas: contar(subsAplicadas),
    sofridas: contar(subsSofridas),
    topAplicadas: contar(subsAplicadas).slice(0, 8),
    topSofridas: contar(subsSofridas).slice(0, 8),
  };
}

/* ---------- escada posicional (elemento assinatura) ---------- */
export function escadaPosicional(rolls, positions, opcoes = {}) {
  const { soComDado = true } = opcoes;
  const dom = new Map();
  const inf = new Map();
  for (const r of rolls) {
    for (const p of r.posDominadas || []) dom.set(p, (dom.get(p) || 0) + 1);
    for (const p of r.posSofridas || []) inf.set(p, (inf.get(p) || 0) + 1);
  }
  const max = Math.max(1, ...dom.values(), ...inf.values());

  const ordem = ['dominante', 'neutra', 'em_pe', 'guarda', 'perna', 'inferior'];
  let lista = positions
    .filter((p) => p.slug !== 'finalizacao' && p.slug !== 'finalizado')
    .map((p) => ({
      ...p,
      dom: dom.get(p.id) || 0,
      inf: inf.get(p.id) || 0,
      max,
    }));

  /* mostrar 37 posições zeradas não diz nada.
     Só aparece o que você já viveu no tatame. */
  if (soComDado) lista = lista.filter((p) => p.dom > 0 || p.inf > 0);

  return lista.sort((a, b) => {
    const oa = ordem.indexOf(a.familia);
    const ob = ordem.indexOf(b.familia);
    if (oa !== ob) return oa - ob;
    return (b.pts || 0) - (a.pts || 0) || (a.ordem || 0) - (b.ordem || 0);
  });
}

/* ---------- radar de habilidades ---------- */
/* ============================================================
   RADAR DE HABILIDADES

   Antes ele lia um campo que o usuário marcava na mão, e como
   ninguém marca, o radar ficava parado em zero pra sempre.

   Agora ele sai do que aconteceu nos treinos: cada técnica que
   você aplicou soma no eixo da categoria dela, com peso pelo
   grau. Se você registrar mais, o radar mexe.
   ============================================================ */
export function radarHabilidades(minhas, categories, techniques = []) {
  const catDaTecnica = new Map(techniques.map((t) => [t.nome.toLowerCase(), t.categoriaId]));

  const porCategoria = new Map();
  for (const t of minhas) {
    const catId = t.categoriaId ?? catDaTecnica.get(String(t.nome).toLowerCase());
    if (!catId) continue;
    const atual = porCategoria.get(catId) || { soma: 0, tecnicas: 0, usos: 0 };
    /* grau pesa mais que quantidade: uma técnica no 3º grau vale
       mais que três que você usou uma vez cada */
    atual.soma += (t.grau || 0) * 2 + Math.min(6, t.usosResistencia || 0);
    atual.tecnicas += 1;
    atual.usos += t.usosResistencia || 0;
    porCategoria.set(catId, atual);
  }

  const valores = [...porCategoria.values()].map((x) => x.soma);
  const teto = Math.max(14, ...valores);

  return categories
    .filter((c) => !c.arquivada)
    .slice(0, 8)
    .map((c) => {
      const d = porCategoria.get(c.id) || { soma: 0, tecnicas: 0, usos: 0 };
      return {
        nome: c.nome,
        cor: c.cor,
        valor: Math.round((d.soma / teto) * 100),
        total: d.tecnicas,
        usos: d.usos,
      };
    });
}

/* ---------- buracos no jogo ---------- */
export function buracosNoJogo(rolls, positions) {
  const sofridas = new Map();
  for (const r of rolls) {
    for (const s of r.subsSofridas || []) sofridas.set(s, (sofridas.get(s) || 0) + 1);
  }
  const posInf = new Map();
  for (const r of rolls) for (const p of r.posSofridas || []) posInf.set(p, (posInf.get(p) || 0) + 1);

  const nomePos = Object.fromEntries(positions.map((p) => [p.id, p.nome]));
  const alertas = [];

  const topSub = [...sofridas.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topSub && topSub[1] >= 3) {
    alertas.push({
      tipo: 'sub',
      titulo: `Você tá caindo em ${topSub[0]}`,
      texto: `${topSub[1]} vezes. Vale uma aula focada só na defesa disso.`,
      grave: topSub[1] >= 6,
    });
  }
  const topPos = [...posInf.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topPos && topPos[1] >= 3) {
    alertas.push({
      tipo: 'pos',
      titulo: `Preso em ${nomePos[topPos[0]] || 'posição inferior'}`,
      texto: `${topPos[1]} rolas. Treina escapada dessa posição em sparring posicional.`,
      grave: topPos[1] >= 8,
    });
  }
  return alertas;
}

/* ---------- parceiros ---------- */
export function statsParceiro(rolls, partnerId) {
  const r = rolls.filter((x) => x.partnerId === partnerId);
  const fin = r.filter((x) => x.resultado === 'finalizei' || x.resultado === 'ambos').length;
  const tap = r.filter((x) => x.resultado === 'fui_finalizado' || x.resultado === 'ambos').length;
  return { rolas: r.length, fin, tap, saldo: fin - tap };
}
