/* Procura dependência circular entre os arquivos que o build gera.
   É diferente do ciclo entre fontes: dois pedaços podem depender um
   do outro mesmo sem o código-fonte ter ciclo, e o resultado é o
   mesmo erro de acesso antes de inicializar. */
import fs from 'fs'; import path from 'path';

const dir = 'dist/assets';
if (!fs.existsSync(dir)) { console.log('rode o build antes'); process.exit(0); }

const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
const grafo = {};
for (const f of arquivos) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  const deps = new Set();
  for (const m of s.matchAll(/from"\.\/([\w.-]+\.js)"/g)) deps.add(m[1]);
  for (const m of s.matchAll(/import"\.\/([\w.-]+\.js)"/g)) deps.add(m[1]);
  grafo[f] = [...deps];
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
for (const f of arquivos) if (!cor[f]) dfs(f, []);

if (!ciclos.length) { console.log(`${arquivos.length} pedaços, nenhum ciclo`); process.exit(0); }
console.log('=== CICLO ENTRE PEDAÇOS ===');
const vistos = new Set();
for (const c of ciclos) {
  const k = [...c].sort().join('|'); if (vistos.has(k)) continue; vistos.add(k);
  console.log('  ' + c.join(' -> '));
}
process.exit(1);
