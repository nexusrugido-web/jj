import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

/* Telas de técnica própria (07/11/2026), na ficha de Minhas técnicas:
   a própria edita e arquiva; renomear chega no rola que aponta pelo uid;
   a do catálogo mostra "Criar minha versão" e cria com versaoDe.
   Precisa do `npm run dev`. */
const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/proprias';
await fs.mkdir(pasta, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [nome, viewport] of [['360', { width: 360, height: 800 }], ['700', { width: 700, height: 900 }]]) {
    const contexto = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: nome === '360', hasTouch: nome === '360', timezoneId: 'America/Sao_Paulo' });
    await contexto.route('**/*', (route) => (new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort()));
    const page = await contexto.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    const rolaId = await page.evaluate(async () => {
      const { db, getMeta, setMeta } = await import('/src/db/db.js');
      const { VERSAO_DOCS } = await import('/src/components/Aceite.jsx');
      const { criarTecnicaPropria } = await import('/src/lib/proprias.js');
      await setMeta('settings', { ...(await getMeta('settings', {})), nome: 'Praticante de teste', anoNascimento: 1995, faixa: 'branca', onboardingFeito: 1, tourVisto: 1, celebrar: false, aceite: { versao: VERSAO_DOCS, em: new Date().toISOString() } });
      const { tecnica } = await criarTecnicaPropria({ nome: 'Raspagem do Tio' });
      const d = new Date().toISOString().slice(0, 10);
      const sid = await db.sessions.add({ data: d, tipo: 'gi', duracao: 60, criadoEm: Date.now() });
      return db.rolls.add({ sessionId: sid, data: d, subsAplicadas: ['Kimura'], subsSofridas: [], tecMeus: { raspagem: ['Raspagem do Tio'] }, tecDele: {}, tecUid: { [tecnica.uid]: 'Raspagem do Tio' }, criadoEm: Date.now() });
    });
    await page.goto(`${url}/?go=dominio`, { waitUntil: 'networkidle' });

    /* a própria: editar e renomear */
    await page.getByText('Raspagem do Tio').first().click();
    const ficha = page.locator('.sheet').last();
    await ficha.getByRole('button', { name: 'Editar' }).waitFor({ timeout: 15000 });
    await ficha.getByRole('button', { name: 'Editar' }).click();
    await ficha.locator('input.input').first().fill('Raspagem do Velho');
    await ficha.locator('textarea').fill('Puxa a manga e empurra o joelho.');
    await ficha.getByText('O nome novo vai pros rolas').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${pasta}/${nome}-editar.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `vaza em ${nome} (editar)`);
    await ficha.getByRole('button', { name: 'Salvar' }).click();
    await page.waitForTimeout(500);
    const rola = await page.evaluate(async (id) => (await (await import('/src/db/db.js')).db.rolls.get(id)), rolaId);
    assert.deepEqual(rola.tecMeus.raspagem, ['Raspagem do Velho'], 'o rola ganhou o nome novo');

    /* a do catálogo: criar minha versão */
    await page.getByText('Kimura', { exact: true }).last().click();
    const ficha2 = page.locator('.sheet').last();
    await ficha2.getByRole('button', { name: 'Criar minha versão' }).waitFor({ timeout: 15000 });
    await ficha2.getByRole('button', { name: 'Criar minha versão' }).click();
    await ficha2.locator('input.input').first().fill('Kimura do meu jeito');
    await ficha2.getByRole('button', { name: 'Criar', exact: true }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${pasta}/${nome}-versao.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `vaza em ${nome} (versão)`);
    await ficha2.getByRole('button', { name: 'Criar', exact: true }).click();
    await ficha2.getByText('está na sua lista').waitFor({ timeout: 5000 });
    const versao = await page.evaluate(async () => (await (await import('/src/db/db.js')).db.techniques.where('nome').equals('Kimura do meu jeito').first()));
    assert.equal(versao.propria, 1);
    assert.equal(versao.fam, 'fam:kimura');
    assert.ok(versao.versaoDe, 'grava versaoDe');

    /* criada e sem rola: aparece em "Criadas por você, ainda sem rola" e arquiva dali */
    await page.goto(`${url}/?go=dominio`, { waitUntil: 'networkidle' });
    const semRola = page.locator('.card', { hasText: 'Criadas por você, ainda sem rola' });
    await semRola.getByText('Kimura do meu jeito').waitFor({ timeout: 15000 });
    assert.equal(await semRola.getByText('Raspagem do Velho').count(), 0, 'a que já tem rola não entra');
    await semRola.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${pasta}/${nome}-sem-rola.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `vaza em ${nome} (sem rola)`);
    await semRola.getByText('Kimura do meu jeito').click();
    const ficha3 = page.locator('.sheet').last();
    await ficha3.getByRole('button', { name: 'Arquivar' }).click();
    await page.waitForTimeout(500);
    const arquivada = await page.evaluate(async () => (await (await import('/src/db/db.js')).db.techniques.where('nome').equals('Kimura do meu jeito').first()));
    assert.equal(arquivada.arquivada, 1, 'arquivou pela parte sem rola');
    await semRola.getByText('arquivada', { exact: true }).waitFor({ timeout: 5000 });
    await semRola.getByText('Kimura do meu jeito').click();
    await page.locator('.sheet').last().getByRole('button', { name: 'Tirar do arquivo' }).click();
    await page.waitForTimeout(500);
    const volta = await page.evaluate(async () => (await (await import('/src/db/db.js')).db.techniques.where('nome').equals('Kimura do meu jeito').first()));
    assert.equal(volta.arquivada, 0, 'tirou do arquivo');

    assert.deepEqual(erros, [], `erros em ${nome}`);
    await contexto.close();
  }
  console.log('Técnica própria na ficha verificada em 360px e 700px. Capturas: ' + pasta);
} finally { await browser.close(); }
