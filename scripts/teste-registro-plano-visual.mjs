import { chromium } from 'playwright';
import fs from 'node:fs/promises';

/* ============================================================
   R7.4a NO APP DE VERDADE (precisa do npm run dev), em 360, 700 e 1280px
   1. o bloco "Plano de ataque" fica no fluxo principal, antes do
      placar, sem abrir "Mais detalhes" (que não fala mais de plano);
   2. até 3 planos em chips, o resto no "Outro plano…";
   3. rola sem plano: parceiro e salvar, sem tocar no plano; grava sem
      plano e sem "Não usei" (não respondi);
   4. "Não usei" é escolha dita: liga, desliga e grava semPlano;
   5. escolher pelo popup tira o "Não usei" e grava o plano;
   6. o último plano contra o parceiro vem primeiro nos chips;
   7. recolher mostra o caminho numa linha; reabrir o treino salvo
      mostra recolhido e "Ver o caminho" abre o mapa de novo;
   8. o rola antigo sem nada continua sem nada (desconhecido).
   ============================================================ */
const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/registro-plano';
await fs.mkdir(pasta, { recursive: true });

const ARM = 'Armlock da guarda fechada';
const base = { seFalhar: '', proxima: '', detalhe: '' };
const comum = { tipo: 'ataque', modo: 'ambos', faixa: 'branca', legal: true, aviso: '', resumo: '', paraAltura: [], paraPeso: [], pronto: 0, favorito: 0, arquivada: 0, posicao: 'Guarda fechada', objetivo: 'Finalizar', objetivoTipo: 'finalizar' };
const CONV = {
  ...comum, uid: 'r74-conv', nome: 'Finta e armlock',
  passos: [
    { id: 'fA', lig: 'lA', tipo: 'finta', descricao: 'Ameaço a guilhotina', gatilho: '', pai: null, via: null },
    { id: 'arm', lig: 'lArm', acao: ARM, gatilho: 'levantou a cabeça', pai: 0, via: 'reagiu' },
  ].map((x) => ({ ...base, ...x })),
};
const simples = (n) => ({ ...comum, uid: `r74-p${n}`, nome: `Plano ${n}`, passos: [{ ...base, id: `g${n}`, lig: `l${n}`, acao: ARM, gatilho: '', pai: null, via: null }] });
const PLANOS = [CONV, simples(2), simples(3), simples(4), simples(5)];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};
try {
  for (const largura of [360, 700, 1280]) {
    console.log(`\n--- ${largura}px ---`);
    const celular = largura < 800;
    const contexto = await browser.newContext({ viewport: { width: largura, height: 800 }, deviceScaleFactor: 2, isMobile: celular, hasTouch: celular, timezoneId: 'America/Sao_Paulo' });
    await contexto.route('**/*', (route) => (new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort()));
    const page = await contexto.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    const antigo = await page.evaluate(async (planos) => {
      const { db, getMeta, setMeta } = await import('/src/db/db.js');
      const { VERSAO_DOCS } = await import('/src/components/Aceite.jsx');
      await setMeta('settings', { ...(await getMeta('settings', {})), nome: 'Praticante de teste', anoNascimento: 1995, faixa: 'branca', onboardingFeito: 1, tourVisto: 1, celebrar: false, aceite: { versao: VERSAO_DOCS, em: new Date().toISOString() } });
      for (const p of planos) await db.attackPlans.add({ ...p, criadoEm: Date.now() });
      await db.partners.add({ nome: 'Zé', faixa: 'azul', graus: 0, academiaId: null, pesoKg: null, notas: '' });
      /* o rola antigo: sem plano e sem "Não usei" */
      const s = await db.sessions.add({ data: '2026-10-01', tipo: 'gi', duracao: 60, notas: '' });
      return db.rolls.add({ sessionId: s, data: '2026-10-01', duracao: 5, contexto: 'rola', ptsMeus: [], ptsDele: [], subsAplicadas: [], subsSofridas: [], notas: 'antigo' });
    }, PLANOS);

    const bloco = () => page.locator('.plano-rola').first();
    const chipsDePlano = async () => (await bloco().locator('.row.wrap').first().locator('.chip').allTextContents()).filter((t) => t !== 'Outro plano…' && t !== 'Não usei');
    const ligado = async (nome) => /\bon\b/.test(await bloco().getByRole('button', { name: nome, exact: true }).first().getAttribute('class') || '');
    const toque = async (loc) => { await loc.click(); await page.waitForTimeout(250); };
    const vaza = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const banco = () => page.evaluate(async () => {
      const { db } = await import('/src/db/db.js');
      return (await db.rolls.toArray()).sort((a, b) => a.id - b.id);
    });
    const ultimo = async () => (await banco()).slice(-1)[0];
    const novo = async () => {
      await page.goto(`${url}/?go=treinos&novo=1`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Adicionar rola/ }).first().click();
      await page.waitForTimeout(300);
    };
    const ze = () => toque(page.locator('.parceiro-chips').getByRole('button', { name: 'Zé', exact: true }).first());
    const salvar = async () => { await page.getByRole('button', { name: /Salvar treino/ }).click(); await page.waitForTimeout(1200); };

    /* 1 e 2: onde fica e o que mostra */
    await novo();
    const ordem = await page.evaluate(() => {
      const p = document.querySelector('.plano-rola');
      const o = document.querySelector('.o-que-rolou');
      return !!p && !!o && !!(p.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    ok('1 o plano aparece antes do placar, sem abrir nada', [ordem, await bloco().isVisible()], [true, true]);
    ok('1 "Mais detalhes" não fala mais de plano', /plano/i.test(await page.locator('.mais-detalhes-botao').first().textContent()), false);
    ok('2 até 3 planos em chips, o resto no "Outro plano…"', [(await chipsDePlano()).length, await bloco().getByRole('button', { name: 'Outro plano…' }).count()], [3, 1]);
    ok('2 começa sem nada marcado e diz que é opcional', [await bloco().locator('.chip.on').count(), await bloco().getByText(/Opcional/).count()], [0, 1]);
    ok('1 nada vaza pro lado', await vaza(), false);
    await bloco().evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${pasta}/1-bloco-do-plano-${largura}.png` });

    /* 3: o rola de quem não usa plano, sem tocar no bloco */
    await ze();
    await salvar();
    let r = await ultimo();
    ok('3 sem tocar no plano: grava sem plano e sem "Não usei"', [r.partnerId > 0, r.plano ?? null, r.semPlano ?? null], [true, null, null]);

    /* 4: "Não usei" liga e desliga */
    await novo();
    await ze();
    await toque(bloco().getByRole('button', { name: 'Não usei', exact: true }));
    const liga = await ligado('Não usei');
    await toque(bloco().getByRole('button', { name: 'Não usei', exact: true }));
    const desliga = await ligado('Não usei');
    await toque(bloco().getByRole('button', { name: 'Não usei', exact: true }));
    ok('4 "Não usei" liga, desliga e liga', [liga, desliga, await ligado('Não usei')], [true, false, true]);
    await salvar();
    r = await ultimo();
    ok('4 gravou "Não usei" sem plano', [r.semPlano, r.plano ?? null], [true, null]);

    /* 5: pelo popup, depois do "Não usei" */
    await novo();
    await ze();
    await toque(bloco().getByRole('button', { name: 'Não usei', exact: true }));
    await toque(bloco().getByRole('button', { name: 'Outro plano…', exact: true }));
    await page.screenshot({ path: `${pasta}/2-outro-plano-${largura}.png` });
    await toque(page.getByRole('button', { name: 'Plano 5', exact: true }).last());
    ok('5 o plano do popup aparece marcado nos chips e "Não usei" sai', [await ligado('Plano 5'), await ligado('Não usei'), (await chipsDePlano()).length], [true, false, 3]);
    ok('5 o mapa do plano abre', await page.locator('.mapa-rola').count(), 1);
    await salvar();
    r = await ultimo();
    ok('5 gravou o plano e tirou o "Não usei"', [r.plano?.uid, r.semPlano], ['r74-p5', false]);

    /* 6: o último contra o Zé vem primeiro */
    await novo();
    await ze();
    ok('6 o último plano contra o parceiro é o primeiro chip', (await chipsDePlano())[0], 'Plano 5');

    /* 7: recolher, salvar e reabrir */
    await toque(bloco().getByRole('button', { name: CONV.nome, exact: true }));
    await toque(page.locator('.mapa-rola').getByRole('button', { name: ARM, exact: true }).first());
    await toque(page.getByRole('button', { name: 'Ele defendeu', exact: true }).first());
    await toque(bloco().getByRole('button', { name: 'Recolher', exact: true }));
    const resumo = (await page.locator('.plano-rola-resumo').first().textContent()) || '';
    ok('7 recolhido: sem mapa, o caminho numa linha', [await page.locator('.mapa-rola').count(), resumo.includes(`Ameaço a guilhotina → ${ARM} · ele defendeu`)], [0, true]);
    await bloco().evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${pasta}/3-recolhido-${largura}.png` });
    await toque(page.locator('.plano-rola-resumo').first());
    ok('7 "Ver o caminho" abre o mapa de novo', await page.locator('.mapa-rola').count(), 1);
    await salvar();
    r = await ultimo();
    ok('7 gravou a peça e o que ele fez', [r.plano?.uid, r.plano?.peca, r.plano?.parou], ['r74-conv', 'arm', 'defendeu']);
    await page.goto(`${url}/?go=treinos&abrir=${r.sessionId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
    await page.waitForTimeout(600);
    ok('7 o treino salvo reabre recolhido', [await page.locator('.mapa-rola').count(), await page.locator('.plano-rola-resumo').count()], [0, 1]);
    await bloco().evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${pasta}/4-reaberto-${largura}.png` });
    await page.getByRole('button', { name: 'Cancelar' }).last().click();
    await page.waitForTimeout(400);

    /* 8: o rola antigo continua desconhecido */
    const velho = (await banco()).find((x) => x.id === antigo);
    ok('8 o rola antigo continua sem plano e sem "Não usei"', [velho.plano ?? null, velho.semPlano ?? null, velho.notas], [null, null, 'antigo']);
    ok('nenhum erro na página', erros, []);
    await contexto.close();
  }
} finally {
  await browser.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
