import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

/* ============================================================
   MAPA DO PLANO NO CELULAR
   Abre o app de verdade (npm run dev) no Chrome com a tela de 360px
   (viewport do Playwright: o --window-size do Chrome headless não
   desce de ~494px) e confere o "Ver o mapa" e o editor: cartões com
   tamanho, dentro do quadro, sem a página vazar pro lado.
   ============================================================ */
const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/planos';
await fs.mkdir(pasta, { recursive: true });

const PLANO = {
  nome: 'Guarda fechada, três entradas', posicao: 'Guarda fechada', objetivo: 'Finalizar', objetivoTipo: 'finalizar',
  passos: [
    { id: 'f1', lig: 'l1', tipo: 'finta', acao: 'Guilhotina', gatilho: '', pai: null, via: null },
    { id: 'f2', lig: 'l2', tipo: 'finta', acao: 'Raspagem de tesoura', gatilho: '', pai: null, via: null },
    { id: 'g3', lig: 'l3', acao: 'Armlock', gatilho: 'levantou a cabeça', pai: 0, via: 'reagiu' },
    { id: 'g4', lig: 'l4', acao: 'Triângulo', gatilho: 'colou o cotovelo', pai: 2, via: 'defendeu' },
    { id: 'g5', lig: 'l5', acao: 'Omoplata', gatilho: 'girou o braço pra fora', pai: 2, via: 'defendeu' },
    { id: 'g6', lig: 'l6', acao: 'Kimura', gatilho: '', pai: 0, via: 'naoReagiu' },
    { id: 'g7', lig: 'l7', acao: 'Mata-leão', gatilho: '', pai: 0, via: 'naoReagiu' },
    { id: 'g8', lig: 'l8', acao: 'Raspagem de quadril (hip bump)', gatilho: 'apoiou a mão', pai: 1, via: 'reagiu' },
  ].map((x) => ({ seFalhar: '', proxima: '', detalhe: '', ...x })),
  tipo: 'ataque', modo: 'ambos', faixa: 'branca', legal: true, aviso: '', resumo: '', paraAltura: [], paraPeso: [],
  pronto: 0, favorito: 0, arquivada: 0,
};

/* cada cartão do mapa com tamanho, e quantos estão dentro do quadro */
const medirMapa = (s) => {
  const quadro = document.querySelector(s).getBoundingClientRect();
  const nos = [...document.querySelectorAll(`${s} .mente-no`)].map((n) => n.getBoundingClientRect());
  return {
    quadro: { w: Math.round(quadro.width), h: Math.round(quadro.height) },
    nos: nos.length,
    vazios: nos.filter((r) => r.width < 20 || r.height < 20).length,
    aVista: nos.filter((r) => r.right > quadro.left && r.left < quadro.right && r.bottom > quadro.top && r.top < quadro.bottom).length,
    vaza: document.documentElement.scrollWidth > innerWidth,
  };
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [nome, viewport] of [['360', { width: 360, height: 800 }], ['700', { width: 700, height: 900 }]]) {
    const contexto = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: nome === '360', hasTouch: nome === '360', timezoneId: 'America/Sao_Paulo' });
    await contexto.route('**/*', (route) => (new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort()));
    const page = await contexto.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(async (plano) => {
      const { db, getMeta, setMeta } = await import('/src/db/db.js');
      const { VERSAO_DOCS } = await import('/src/components/Aceite.jsx');
      await setMeta('settings', { ...(await getMeta('settings', {})), nome: 'Praticante de teste', anoNascimento: 1995, faixa: 'branca', onboardingFeito: 1, tourVisto: 1, celebrar: false, aceite: { versao: VERSAO_DOCS, em: new Date().toISOString() } });
      await db.attackPlans.add({ ...plano, criadoEm: Date.now() });
    }, PLANO);
    await page.goto(`${url}/?go=planos`, { waitUntil: 'networkidle' });
    await page.getByText(PLANO.nome).first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `lista de planos vaza em ${nome}`);
    await page.screenshot({ path: `${pasta}/${nome}-lista.png` });

    /* Ver o mapa */
    await page.getByRole('button', { name: 'Ver o mapa' }).first().click();
    await page.locator('.mente-tela .mente-no').first().waitFor();
    await page.waitForTimeout(400);
    const ver = await page.evaluate(medirMapa, '.mente-tela');
    console.log(`${nome} ver o mapa:`, JSON.stringify(ver));
    await page.screenshot({ path: `${pasta}/${nome}-ver-mapa.png` });
    assert.equal(ver.nos, 9, 'posição + 8 peças');
    assert.equal(ver.vazios, 0, 'cartão sem tamanho');
    assert.ok(ver.quadro.w > 200 && ver.quadro.h > 200, 'quadro do mapa sem tamanho');
    assert.ok(ver.aVista >= 1, 'nenhum cartão à vista');
    assert.equal(ver.vaza, false, 'mapa vaza a página');
    await page.keyboard.press('Escape');
    await page.goto(`${url}/?go=planos`, { waitUntil: 'networkidle' });

    /* editor */
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await page.locator('.mente-tela .mente-vaga').first().waitFor();
    await page.locator('.mente-tela').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const ed = await page.evaluate(medirMapa, '.mente-tela');
    console.log(`${nome} editor:`, JSON.stringify(ed));
    await page.screenshot({ path: `${pasta}/${nome}-editor.png` });
    assert.equal(ed.nos, 9);
    assert.equal(ed.vazios, 0);
    assert.equal(ed.vaza, false, 'editor vaza a página');
    assert.ok(await page.getByText('Outra ameaça pra trocar').count() >= 1, 'o "não reagiu" aceita outra ameaça');
    assert.deepEqual(erros, [], `erros em ${nome}`);
    await contexto.close();
  }
} finally { await browser.close(); }
console.log(`Mapa do plano verificado em 360px e 700px. Capturas: ${pasta}`);
