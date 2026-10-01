/* ============================================================
   BACKUP DO SUPABASE

   O plano grátis não guarda backup que dê pra baixar. Este script
   baixa uma cópia completa dos dados (os schemas public e auth: as
   tabelas do app e as contas) pra uma pasta fora do git, em formato
   que o pg_restore lê de volta num projeto novo.

   A estrutura (tabelas e funções) já está nos supabase/*.sql; o
   backup guarda também os DADOS.

   Uso: npm run backup
   Precisa: Docker aberto, e o endereço do banco em .env.local
     SUPABASE_DB_URL=postgresql://postgres.xxxx:SENHA@aws-...pooler.supabase.com:5432/postgres
   (Supabase > Connect > Session pooler > URI. É segredo: fica só no
   .env.local, que o git ignora. Nunca no chat.)
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const lerEnv = () => {
  const arq = path.join(raiz, '.env.local');
  if (!fs.existsSync(arq)) return {};
  return Object.fromEntries(fs.readFileSync(arq, 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
};
let url = process.env.SUPABASE_DB_URL || lerEnv().SUPABASE_DB_URL;
/* primeira vez: pergunta o endereço e guarda no .env.local (fora do git) */
if (!url && process.stdin.isTTY) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('\nPrimeira vez: preciso do endereço do banco. Só pergunto uma vez.');
  console.log('1. No Supabase, clique em Connect (botão no topo)');
  console.log('2. Escolha "Session pooler" e copie a URI');
  console.log('3. Troque [YOUR-PASSWORD] pela senha do banco (esqueceu? Settings > Database > Reset database password)\n');
  url = (await rl.question('Cole a URI aqui e aperte Enter: ')).trim();
  rl.close();
  if (!/^postgres(ql)?:\/\//.test(url) || url.includes('[YOUR-PASSWORD]')) {
    console.error('Isso não parece a URI certa (começa com postgresql:// e tem a senha no lugar de [YOUR-PASSWORD]). Nada foi guardado.');
    process.exit(1);
  }
  fs.appendFileSync(path.join(raiz, '.env.local'), `\nSUPABASE_DB_URL=${url}\n`);
  console.log('Guardado no .env.local (fora do git).\n');
}
if (!url) {
  console.error('Falta SUPABASE_DB_URL no .env.local (Supabase > Connect > Session pooler > URI).');
  process.exit(1);
}

const pasta = path.resolve(raiz, '..', 'NEUROJITSU-BACKUPS');
fs.mkdirSync(pasta, { recursive: true });
const quando = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const nome = `neurojitsu-${quando}.dump`;

/* pg_dump da mesma versão grande do Supabase (17), pelo Docker: não
   precisa instalar Postgres no Windows */
const r = spawnSync('docker', [
  'run', '--rm', '-v', `${pasta}:/saida`, 'postgres:17-alpine',
  'pg_dump', url, '--format=custom', '--no-owner', '--no-privileges',
  '--schema=public', '--schema=auth', `--file=/saida/${nome}`,
], { stdio: ['ignore', 'inherit', 'pipe'], encoding: 'utf8' });

/* o erro do pg_dump pode trazer o endereço com a senha: mostra sem ela */
const semSenha = (t) => String(t || '').replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/g, '$1***@');
if (r.status !== 0) {
  console.error('O backup falhou:\n' + semSenha(r.stderr || r.error?.message));
  process.exit(1);
}
const tam = fs.statSync(path.join(pasta, nome)).size;
const tamanho = tam >= 1024 * 1024 ? `${(tam / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(tam / 1024))} KB`;
console.log(`Backup salvo: ${path.join(pasta, nome)} (${tamanho})`);
console.log('Pra restaurar num projeto novo: rode os supabase/*.sql e depois pg_restore --no-owner --data-only neste arquivo.');

/* guarda os 10 mais novos */
const antigos = fs.readdirSync(pasta).filter((f) => /^neurojitsu-.*\.dump$/.test(f)).sort().slice(0, -10);
for (const f of antigos) fs.unlinkSync(path.join(pasta, f));
if (antigos.length) console.log(`Apaguei ${antigos.length} backup(s) antigo(s); ficam os 10 mais novos.`);
