import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/faixas';
await fs.mkdir(pasta, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [nome, viewport] of [['android', { width: 393, height: 852 }], ['desktop', { width: 1440, height: 900 }]]) {
    const context = await browser.newContext({ viewport, isMobile: nome === 'android', hasTouch: nome === 'android', timezoneId: 'America/Sao_Paulo' });
    await context.route('**/*', (route) => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const { getMeta, setMeta } = await import('/src/db/db.js');
      await setMeta('settings', { ...(await getMeta('settings', {})), nome: '', anoNascimento: null, faixa: 'branca', onboardingFeito: 0, aceite: { versao: '2026-09-25.1', em: new Date().toISOString() } });
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByPlaceholder('Seu nome').fill('Atleta de teste');
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.getByPlaceholder('Ex.: 1998').fill(String(new Date().getFullYear() - 13));
    await page.getByRole('button', { name: /Um responsável acompanha e autoriza/i }).click();
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.getByRole('button', { name: 'Verde e preta' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Azul', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Laranja e branca' }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(erros, []);
    await page.screenshot({ path: `${pasta}/${nome}-13-anos.png`, fullPage: true });
    await context.close();
  }
} finally { await browser.close(); }
console.log(`Faixas por idade verificadas em Android e desktop: ${pasta}`);
