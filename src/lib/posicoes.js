/* ============================================================
   POSIÇÃO, TÉCNICA E VARIAÇÃO

   A posição é a do mapa (36, com slug). A técnica sai de uma
   posição (origemId) e a variação é a própria técnica: "Raspagem
   de X-guard para trás" e "para o lado" são duas técnicas da
   Guarda X. As 82 entradas da biblioteca com a etiqueta "posicao"
   (De La Riva, Lockdown, Montada...) são posição, não golpe: não
   entram na lista de técnicas.

   Passagem e queda não saem de uma posição sua (a passagem sai da
   guarda do outro): o tema "Combatendo a guarda" lista as
   passagens, e "De pé" e "Clinch" listam as quedas.
   ============================================================ */

export const ehPosicao = (t) => (t?.tags || []).includes('posicao');

const TEMA_POR_CATEGORIA = {
  passando: ['passagem'],
  em_pe: ['queda'],
  clinch: ['queda'],
};

/* as posições que aparecem primeiro quando a pessoa ainda não tem aula registrada */
export const POSICOES_COMUNS = ['guarda_fechada', 'meia_guarda', 'guarda_aberta', 'passando', 'cem_quilos', 'montada', 'costas', 'em_pe'];

/* as que não são tema de aula */
const FORA_DO_TEMA = new Set(['finalizado', 'finalizacao']);

export const GRUPOS_DE_POSICAO = [
  ['guarda', 'Guardas'],
  ['perna', 'Jogo de pernas'],
  ['neutra', 'Passagem'],
  ['dominante', 'Por cima'],
  ['inferior', 'Por baixo'],
  ['em_pe', 'Em pé'],
];

export const posicoesDoTema = (positions) =>
  positions.filter((p) => p.slug && !p.arquivada && !FORA_DO_TEMA.has(p.slug));

/* as posições das aulas, da mais recente pra mais antiga, sem repetir */
export function posicoesRecentes(sessions) {
  const out = [];
  const ordenadas = [...(sessions || [])].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  for (const s of ordenadas) for (const slug of s.focoPosicoes || []) if (!out.includes(slug)) out.push(slug);
  return out;
}

/* as técnicas de uma posição: as que você já usou primeiro, depois
   as de fundamento, depois o resto em ordem alfabética */
export function tecnicasDaPosicao(slug, { techniques, categories, positions, usadas = [] }) {
  const pos = positions.find((p) => p.slug === slug);
  if (!pos) return [];
  const cats = new Set(categories.filter((c) => (TEMA_POR_CATEGORIA[slug] || []).includes(c.slug)).map((c) => c.id));
  const lista = techniques.filter((t) => !t.arquivada && !ehPosicao(t)
    && (t.origemId === pos.id || cats.has(t.categoriaId)));
  const ordem = (t) => {
    const u = usadas.indexOf(t.nome);
    if (u >= 0) return u;
    return (t.tags || []).includes('fundamento') ? 1000 : 2000;
  };
  return lista.sort((a, b) => (ordem(a) - ordem(b)) || a.nome.localeCompare(b.nome));
}

/* ------------------------------------------------------------
   O REPERTÓRIO DE CADA POSIÇÃO

   Quantas técnicas diferentes de cada posição já entraram em rola
   (ponto com técnica e finalização aplicada), e quantas vezes. A
   técnica conta na posição de onde ela sai; passagem conta em
   "Combatendo a guarda" e queda em "De pé" (a origem dela é a
   guarda do outro, não a sua). Rola de drill não conta.
   ------------------------------------------------------------ */
const POSICAO_DA_CATEGORIA = { passagem: 'passando', queda: 'em_pe' };

export function repertorioPorPosicao({ rolls = [], sessions = [], techniques = [], categories = [], positions = [] }) {
  const drill = new Set(sessions.filter((s) => s.tipo === 'drill').map((s) => s.id));
  const catSlug = Object.fromEntries(categories.map((c) => [c.id, c.slug]));
  const posPorId = Object.fromEntries(positions.map((p) => [p.id, p]));
  const posPorSlug = Object.fromEntries(positions.filter((p) => p.slug).map((p) => [p.slug, p]));
  const porNome = new Map(techniques.filter((t) => !ehPosicao(t)).map((t) => [t.nome.toLowerCase(), t]));
  const mapa = new Map();
  for (const r of rolls) {
    if (r.contexto === 'drill' || drill.has(r.sessionId)) continue;
    const nomes = [...Object.values(r.tecMeus || {}).flat(), ...(r.subsAplicadas || [])];
    for (const nome of nomes) {
      const t = porNome.get(String(nome).toLowerCase());
      if (!t) continue;
      const slug = POSICAO_DA_CATEGORIA[catSlug[t.categoriaId]] || posPorId[t.origemId]?.slug;
      const pos = posPorSlug[slug];
      if (!pos || FORA_DO_TEMA.has(slug)) continue;
      if (!mapa.has(slug)) mapa.set(slug, { slug, nome: pos.nome, usos: 0, tecnicas: new Map() });
      const p = mapa.get(slug);
      p.usos++;
      p.tecnicas.set(t.nome, (p.tecnicas.get(t.nome) || 0) + 1);
    }
  }
  return [...mapa.values()]
    .map((p) => ({ ...p, tecnicas: [...p.tecnicas.entries()].map(([nome, usos]) => ({ nome, usos })).sort((a, b) => b.usos - a.usos) }))
    .sort((a, b) => b.usos - a.usos);
}
