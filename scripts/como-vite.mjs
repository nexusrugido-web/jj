/* ============================================================
   FAZER O NODE LER O CODIGO COMO O VITE LE

   Duas coisas o Vite resolve e o Node nao: importacao sem
   extensao e import.meta.env. Sem isto nao da pra testar um
   arquivo de src direto, so o bundle pronto.
   ============================================================ */

export async function resolve(esp, ctx, next) {
  try { return await next(esp, ctx); }
  catch (e) {
    if (!esp.startsWith('.')) throw e;
    for (const ext of ['.js', '/index.js']) {
      try { return await next(esp + ext, ctx); } catch { /* tenta o proximo */ }
    }
    throw e;
  }
}

export async function load(url, ctx, next) {
  const r = await next(url, ctx);
  if (r.format === 'module' && typeof r.source !== 'undefined') {
    const txt = r.source.toString();
    if (txt.includes('import.meta.env')) {
      return { ...r, source: txt.replaceAll('import.meta.env', '({})') };
    }
  }
  return r;
}
