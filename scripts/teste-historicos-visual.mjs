import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/historicos';
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
      const { db, getMeta, setMeta } = await import('/src/db/db.js');
      await setMeta('settings', { ...(await getMeta('settings', {})), nome: 'Teste', anoNascimento: 1995, onboardingFeito: 1, tourVisto: 1, celebrar: false, aceite: { versao: '2026-09-25.1', em: new Date().toISOString() } });
      for (let i = 0; i < 8; i++) {
        const d = new Date(2026, 8, 29 - Math.floor(i / 2));
        const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        await db.goals.add({ tipo: 'manual', titulo: `Meta concluída ${i + 1}`, alvo: 1, status: 'concluida', origem: 'usuario', concluidaEm: dia, criadoEm: Date.now() - i * 1000 });
      }
    });
    await page.goto(`${url}/?go=metas`, { waitUntil: 'networkidle' });
    await page.getByText('Concluídas (8)').click();
    assert.equal(await page.locator('.page .card').filter({ hasText: 'Meta concluída' }).count(), 3);
    await page.screenshot({ path: `${pasta}/${nome}-metas.png` });
    await page.getByRole('button', { name: 'Ver todas (8) e gráfico' }).click();
    await page.getByText('Quando você concluiu').waitFor();
    assert.equal(await page.getByRole('dialog').getByText('Meta concluída', { exact: false }).count(), 8);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${pasta}/${nome}-grafico.png` });
    assert.deepEqual(erros, []);
    await context.close();
  }
} finally { await browser.close(); }
console.log(`Metas e gráfico verificados em Android emulado e desktop: ${pasta}`);
