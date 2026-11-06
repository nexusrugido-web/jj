import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

/* R4.1: quem toma Bicep slicer recebe, no Painel, a defesa de uma
   compressão. Aula de chave de perna ou de chave articular nunca. */
const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/defesa';
await fs.mkdir(pasta, { recursive: true });

const BICEP = 'Chave de bíceps (bicep slicer)';
const aula = (id, t, extra) => ({ id, t, d: 600, k: 'aula', tm: [], formato: 'aula', classificacao: 'revisada', posicaoLado: [], tecnicas: [], ...extra });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [nome, viewport] of [['360', { width: 360, height: 800 }], ['700', { width: 700, height: 900 }]]) {
    const contexto = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: nome === '360', hasTouch: nome === '360', timezoneId: 'America/Sao_Paulo' });
    await contexto.route('**/*', (route) => (new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort()));
    const page = await contexto.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(async ({ BICEP, aulas }) => {
      const { db, getMeta, setMeta } = await import('/src/db/db.js');
      const { VERSAO_DOCS } = await import('/src/components/Aceite.jsx');
      const { uidEstavel, chaveNome } = await import('/src/lib/uid.js');
      await setMeta('settings', { ...(await getMeta('settings', {})), nome: 'Praticante de teste', anoNascimento: 1995, faixa: 'branca', onboardingFeito: 1, tourVisto: 1, celebrar: false, aceite: { versao: VERSAO_DOCS, em: new Date().toISOString() } });
      const u = (n) => uidEstavel(chaveNome('techniques', n));
      const lista = aulas.map((a) => ({ ...a, tecnicas: (a.tecnicas || []).map(u), atualizadoEm: Date.now() }));
      await db.acervo.bulkPut(lista);
      const hoje = new Date();
      for (let i = 0; i < 3; i++) {
        const d = new Date(hoje.getTime() - i * 3 * 864e5).toISOString().slice(0, 10);
        const sid = await db.sessions.add({ data: d, tipo: 'gi', duracao: 60, criadoEm: Date.now() });
        await db.rolls.add({ sessionId: sid, data: d, subsAplicadas: [], subsSofridas: [BICEP], tecMeus: {}, tecDele: {}, criadoEm: Date.now() });
      }
    }, { BICEP, aulas: [
      aula('t-defesa-perna', 'Defesa de chave de perna', { habilidades: ['defesa', 'perna'], tecnicas: ['Heel hook interno'] }),
      aula('t-defesa-articular', 'Defesa de chave de braço', { habilidades: ['defesa', 'articular'] }),
      aula('t-defesa-banana', 'Defesa contra o Banana split', { habilidades: ['defesa'], tecnicas: ['Banana split'] }),
    ] });
    await page.goto(`${url}/?go=painel`, { waitUntil: 'networkidle' });
    await page.getByText('Ver mais do seu treino').click();
    await page.getByRole('button', { name: 'O que te pega e como defender' }).click();
    const rec = page.locator('.card').filter({ hasText: 'Sua próxima defesa' }).last();
    await rec.waitFor({ timeout: 15000 });
    await rec.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${pasta}/${nome}-painel.png` });
    const texto = await page.locator('body').innerText();
    console.log(`${nome}:`, texto.includes('Defesa contra o Banana split') ? 'traz a defesa do Banana split' : 'sem a aula de compressão');
    assert.ok(texto.includes('Defesa contra o Banana split'), 'a defesa de outra compressão aparece');
    assert.ok(texto.includes('esta ensina a defesa de outra compressão'), 'a tela diz que é de outra compressão');
    assert.ok(!texto.includes('Defesa de chave de perna'), 'nunca a aula de chave de perna');
    assert.ok(!texto.includes('Defesa de chave de braço'), 'nunca a aula de chave articular');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `vaza em ${nome}`);
    assert.deepEqual(erros, [], `erros em ${nome}`);
    await contexto.close();
  }
  console.log('Defesa contra Bicep slicer verificada no Meu jogo em 360px e 700px. Capturas: ' + pasta);
} finally { await browser.close(); }
