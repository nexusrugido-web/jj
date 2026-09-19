/* Procura componente ou função usada sem ter sido importada nem
   definida no arquivo. O build não pega isso, porque só quebra
   quando a tela abre, e aí o usuário é quem descobre. */
import fs from 'fs'; import path from 'path';

const arquivos = [];
(function w(d) {
  for (const x of fs.readdirSync(d)) {
    const p = path.join(d, x);
    if (fs.statSync(p).isDirectory()) w(p);
    else if (/\.jsx?$/.test(x)) arquivos.push(p);
  }
})('src');

/* o que já existe sem precisar importar */
const GLOBAIS = new Set([
  'React', 'Fragment', 'Math', 'Object', 'Array', 'JSON', 'Date', 'Number',
  'String', 'Boolean', 'Promise', 'Map', 'Set', 'Error', 'RegExp', 'Intl',
  'Image', 'URL', 'URLSearchParams', 'FileReader', 'Blob', 'AbortController',
  'AudioContext', 'SpeechRecognition', 'Notification', 'IntersectionObserver',
  'ResizeObserver', 'MutationObserver', 'Infinity', 'NaN', 'Symbol', 'BigInt',
  'WeakMap', 'WeakSet', 'Proxy', 'Reflect', 'TextEncoder', 'TextDecoder',
]);

const problemas = [];

for (const a of arquivos) {
  const s = fs.readFileSync(a, 'utf8');

  /* tudo que o arquivo conhece: importado, declarado ou parâmetro */
  const conhecidos = new Set(GLOBAIS);

  for (const m of s.matchAll(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/g)) {
    const bloco = m[1];
    for (const n of bloco.matchAll(/([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?/g)) {
      conhecidos.add(n[2] || n[1]);
    }
  }
  for (const m of s.matchAll(/(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) conhecidos.add(m[1]);
  for (const m of s.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) conhecidos.add(m[1]);
  for (const m of s.matchAll(/\[([^\[\]]*)\]\s*=/g)) {
    for (const n of m[1].matchAll(/([A-Za-z_$][\w$]*)/g)) conhecidos.add(n[1]);
  }
  /* desestruturação, inclusive em parâmetro de componente */
  for (const m of s.matchAll(/\{([^{}]*)\}\s*(?:=|\)|,)/g)) {
    for (const n of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*(?::\s*([A-Za-z_$][\w$]*))?/g)) {
      conhecidos.add(n[2] || n[1]);
    }
  }

  /* toda tag de componente usada */
  const usados = new Set();
  for (const m of s.matchAll(/<([A-Z][\w$]*)/g)) usados.add(m[1]);

  /* e as constantes em maiúscula, que é como as listas do app
     são escritas. IMPACTOS esquecido quebra a tela igual a um
     componente esquecido, e o detector não via. */
  const semComentario = s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    /* o nome original em "import { X as Y }" não é uso de X */
    .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]/g, '')
    .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''")
    /* texto escrito entre tags é conteúdo, não código: em
       ">tabela da IBJJF<" a sigla é palavra, não variável */
    .replace(/>[^<>{}]*</g, '><');
  for (const m of semComentario.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
    /* variável de ambiente vem do build, não de import */
    if (m[1].startsWith('VITE_')) continue;
    usados.add(m[1]);
  }

  /* palavras que parecem nome mas são da linguagem */
  const PALAVRAS = new Set([
    'NaN', 'JSON', 'URL', 'DOM', 'API', 'XP', 'IA', 'CSV', 'PWA', 'SQL', 'UI',
    'RPE', 'MODE', 'SKIP_WAITING',
  ]);

  for (const u of usados) {
    if (PALAVRAS.has(u) || u.includes('.')) continue;
    if (!conhecidos.has(u)) {
      const ehComponente = /^[A-Z][a-z]/.test(u);
      problemas.push(`${a.replace('src/', '')}: ${ehComponente ? `<${u}>` : u} usado mas não importado`);
    }
  }
}

if (!problemas.length) {
  console.log(`${arquivos.length} arquivos, nenhum símbolo solto`);
  process.exit(0);
}
console.log('=== SÍMBOLO USADO SEM IMPORTAR ===');
for (const p of problemas) console.log('  ' + p);
process.exit(1);
