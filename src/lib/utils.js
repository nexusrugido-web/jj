/* O dia no calendário de quem está usando, e não o de Greenwich.
   Com toISOString, depois das 21h no Brasil já era amanhã: o treino
   da noite ganhava a data do dia seguinte, e a semana virava no
   domingo à noite. */
export function dataLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const hoje = () => dataLocal(new Date());

export function fmtData(iso, { curto = false } = {}) {
  if (!iso) return ',';
  const [a, m, d] = iso.split('-');
  if (curto) return `${d}/${m}`;
  return `${d}/${m}/${a}`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const mesNome = (i) => MESES[i];

const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/* '2026-09-19' vira "setembro" */
export const mesLongo = (iso) => MESES_LONGOS[Number(iso.slice(5, 7)) - 1];
/* '2026-09' ou '2026-09-19' vira "setembro de 2026" */
export const mesPorExtenso = (iso) => `${mesLongo(iso)} de ${iso.slice(0, 4)}`;

export function diasEntre(a, b) {
  const ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00');
  return Math.round(ms / 86400000);
}

export function addDias(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dataLocal(d);
}

/* quanto tempo faz, escrito por extenso: "há 2 dias", não "há 2d" */
export function relativo(iso) {
  if (!iso) return ',';
  const d = diasEntre(iso, hoje());
  if (d < 0) return emQuanto(iso);
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  const n = (q, um, varios) => `há ${q} ${q === 1 ? um : varios}`;
  if (d < 7) return n(d, 'dia', 'dias');
  if (d < 30) return n(Math.floor(d / 7), 'semana', 'semanas');
  if (d < 365) return n(Math.floor(d / 30), 'mês', 'meses');
  return n(Math.floor(d / 365), 'ano', 'anos');
}

/* quanto falta, pra quem lê na hora: "hoje", "amanhã", "em 3 dias".
   Data solta ("a partir de 28/09") obriga a pessoa a fazer a conta. */
export function emQuanto(iso) {
  if (!iso) return '';
  const d = diasEntre(hoje(), iso);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'amanhã';
  return `em ${d} dias`;
}

export function fmtDur(min) {
  if (!min) return '0min';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

export function mmss(seg) {
  const s = Math.max(0, Math.round(seg));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function baixarArquivo(nome, conteudo, tipo = 'application/json') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function agrupar(arr, fn) {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}


export function contar(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function slug(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function buscaMatch(texto, termo) {
  if (!termo) return true;
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return norm(texto).includes(norm(termo));
}

export const FAIXA_ORDEM = { branca: 0, azul: 1, roxa: 2, marrom: 3, preta: 4 };
