import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/aprendizado';
await fs.mkdir(pasta, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, timezoneId: 'America/Sao_Paulo' });
  await context.route('**/*', (route) => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { getMeta, setMeta } = await import('/src/db/db.js');
    await setMeta('settings', { ...(await getMeta('settings', {})), nome: 'Atleta de teste', anoNascimento: 1995,
      faixa: 'branca', onboardingFeito: 1, tourVisto: 1,
      aceite: { versao: '2026-09-25.1', em: new Date().toISOString() } });
  });
  await page.goto(`${url}/?go=treinos`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Registrar treino|Novo treino/ }).first().click();
  await page.locator('button').filter({ hasText: 'Escolher técnicas da aula' }).last().click();
  const seletor = page.getByRole('dialog', { name: 'Técnicas da aula' });
  await seletor.getByPlaceholder(/Buscar em português/).fill('chave de pé reta');
  await seletor.getByRole('button', { name: /Chave de pé reta \(botinha\)/ }).first().click();
  await seletor.getByRole('button', { name: 'Fechar' }).click();
  const grupo = page.getByRole('group', { name: /Como foi Chave de pé reta/ });
  const meio = grupo.getByRole('button', { name: 'Mais ou menos' });
  await meio.click();
  assert.equal(await meio.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.foco-aprendizado-opcao.selecionada').count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('.foco-item').first().scrollIntoViewIfNeeded();
  await meio.click();
  assert.equal(await meio.getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: `${pasta}/android-selecionado.png` });
  await page.getByRole('button', { name: 'Salvar treino' }).click();
  const salvo = await page.evaluate(async () => {
    const { db } = await import('/src/db/db.js');
    return (await db.sessions.toArray()).find((s) => s.focoTecnicas?.some((f) => f.nome.includes('Chave de pé reta')))?.focoTecnicas;
  });
  assert.equal(salvo?.[0]?.aprendizado, 'meio');
  assert.deepEqual(erros, []);
  await context.close();
} finally { await browser.close(); }
console.log(`Seleção, largura e persistência conferidas no Android: ${pasta}`);
