/* Procura importação circular, inclusive as escritas em várias linhas.
   Um ciclo derruba o app com "Cannot access X before initialization",
   e o pior é que às vezes funciona no computador e quebra no celular. */
import fs from 'fs'; import path from 'path';

const arquivos = [];
(function w(d) {
  for (const x of fs.readdirSync(d)) {
    const p = path.join(d, x);
    if (fs.statSync(p).isDirectory()) w(p);
    else if (/\.(jsx?)$/.test(x)) arquivos.push(p);
  }
})('src');

/* pega import de uma linha, de várias linhas, e reexportação */
const PADROES = [
  /import\s+[\s\S]*?\s+from\s+['"](\.[^'"]+)['"]/g,
  /export\s+[\s\S]*?\s+from\s+['"](\.[^'"]+)['"]/g,
  /import\s+['"](\.[^'"]+)['"]/g,
];

function resolver(base, rel) {
  const alvo = path.resolve(path.dirname(base), rel);
  for (const ext of ['', '.js', '.jsx', '/index.js', '/index.jsx']) {
    const t = alvo + ext;
    if (fs.existsSync(t) && fs.statSync(t).isFile()) return t;
  }
  return null;
}

const grafo = {};
for (const a of arquivos) {
  const s = fs.readFileSync(a, 'utf8');
  const deps = new Set();
  for (const re of PADROES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) {
      /* import() dinâmico não cria ciclo, o módulo só carrega quando chamam */
      const antes = s.slice(Math.max(0, m.index - 8), m.index + 7);
      if (antes.includes('import(')) continue;
      const r = resolver(a, m[1]);
      if (r && r !== a) deps.add(r);
    }
  }
  grafo[a] = [...deps];
}

const cor = {}, ciclos = [];
function dfs(n, pilha) {
  cor[n] = 1; pilha.push(n);
  for (const d of grafo[n] || []) {
    if (cor[d] === 1) ciclos.push([...pilha.slice(pilha.indexOf(d)), d]);
    else if (!cor[d]) dfs(d, pilha);
  }
  pilha.pop(); cor[n] = 2;
}
for (const a of arquivos) if (!cor[a]) dfs(a, []);

const vistos = new Set();
const unicos = ciclos.filter((c) => {
  const k = [...c].sort().join('|');
  if (vistos.has(k)) return false;
  vistos.add(k); return true;
});

const curto = (x) => x.replace(/^src\//, '');
if (!unicos.length) {
  console.log(`${arquivos.length} arquivos, nenhum ciclo de importação`);
  process.exit(0);
}
console.log('=== CICLOS ENCONTRADOS ===');
for (const c of unicos) console.log('  ' + c.map(curto).join('\n     -> '));
console.log(`\n${unicos.length} ciclo(s). Cada um pode derrubar o app.`);
process.exit(1);
