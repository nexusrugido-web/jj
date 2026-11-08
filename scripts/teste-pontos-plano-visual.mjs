import { chromium } from 'playwright';
import fs from 'node:fs/promises';

/* ============================================================
   R7.4b NO APP DE VERDADE (precisa do npm run dev), em 360, 700 e 1280px
   1. marcar a peça e o "Encaixou" não põe ponto nenhum sozinho;
   2. "Contou ponto?": a raspagem que termina na montada dá dois chips;
      um toque põe em "Meus lances" com a técnica, de novo tira só ele;
   3. desmarcar o "Encaixou" tira só o que o plano pôs (o ponto marcado
      na mão fica);
   4. já marcada na mão: o chip diz "já está nos lances" e não soma;
   5. salvar grava o pontuou; reabrir o treino mantém, e apagar o ponto
      em "Meus lances" tira ele do pontuou;
   6. vantagem não aparece pelo plano; finalização segue no "Eu finalizei";
   7. na luta de campeonato não tem pergunta de ponto;
   8. o rola antigo continua igual.
   ============================================================ */
const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/pontos-plano';
await fs.mkdir(pasta, { recursive: true });

const TES = 'Raspagem de tesoura';
const ARM = 'Armlock da guarda fechada';
const base = { seFalhar: '', proxima: '', detalhe: '' };
const PLANO = {
  tipo: 'ataque', modo: 'ambos', faixa: 'branca', legal: true, aviso: '', resumo: '', paraAltura: [], paraPeso: [], pronto: 0, favorito: 0, arquivada: 0,
  posicao: 'Guarda fechada', objetivo: 'Finalizar', objetivoTipo: 'finalizar', uid: 'r74b-tes', nome: 'Tesoura e armlock',
  passos: [
    { id: 'tes', lig: 'lTes', acao: TES, gatilho: '', pai: null, via: null },
    { id: 'arm', lig: 'lArm', acao: ARM, gatilho: 'deu o braço', pai: 0, via: 'encaixou' },
  ].map((x) => ({ ...base, ...x })),
};

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
    const antigo = await page.evaluate(async (plano) => {
      const { db, getMeta, setMeta } = await import('/src/db/db.js');
      const { VERSAO_DOCS } = await import('/src/components/Aceite.jsx');
      await setMeta('settings', { ...(await getMeta('settings', {})), nome: 'Praticante de teste', anoNascimento: 1995, faixa: 'branca', onboardingFeito: 1, tourVisto: 1, celebrar: false, aceite: { versao: VERSAO_DOCS, em: new Date().toISOString() } });
      await db.attackPlans.add({ ...plano, criadoEm: Date.now() });
      await db.partners.add({ nome: 'Zé', faixa: 'azul', graus: 0, academiaId: null, pesoKg: null, notas: '' });
      const s = await db.sessions.add({ data: '2026-10-01', tipo: 'gi', duracao: 60, notas: '' });
      return db.rolls.add({ sessionId: s, data: '2026-10-01', duracao: 5, contexto: 'rola', ptsMeus: ['raspagem'], ptsDele: [], tecMeus: { raspagem: [plano.passos[0].acao] }, subsAplicadas: [], subsSofridas: [], notas: 'antigo' });
    }, PLANO);

    const bloco = () => page.locator('.plano-rola').first();
    const meus = () => page.locator('.subs-bloco.jade').first();
    const pontos = () => page.locator('.pontos-do-plano');
    const chipsDePonto = async () => (await pontos().count() ? pontos().first().locator('.chip').allTextContents() : []);
    const total = async () => (await meus().locator('.subs-titulo .num').first().textContent()).trim();
    const ligado = async (loc) => /\bon\b/.test(await loc.getAttribute('class') || '');
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
      await toque(page.locator('.parceiro-chips').getByRole('button', { name: 'Zé', exact: true }).first());
    };
    const peca = (nome) => page.locator('.mapa-rola').getByRole('button', { name: nome, exact: true }).first();
    const encaixou = () => bloco().getByRole('button', { name: 'Encaixou', exact: true }).first();
    const chipPonto = (re) => pontos().first().locator('.chip').filter({ hasText: re }).first();
    const manual = (nome) => toque(meus().locator('.pts-toque').filter({ hasText: nome }).first());
    const salvar = async () => { await page.getByRole('button', { name: /Salvar treino/ }).click(); await page.waitForTimeout(1200); };

    /* 1: marcar e encaixar não põe ponto */
    await novo();
    await toque(bloco().getByRole('button', { name: PLANO.nome, exact: true }));
    await toque(peca(TES));
    ok('1 só marcar a peça: sem pergunta de ponto', await pontos().count(), 0);
    await toque(encaixou());
    ok('1 encaixou: pergunta, mas nada entra sozinho', [await chipsDePonto(), await total()], [[`Raspagem +2 · ${TES}`, 'Montada +4'], '0 pts']);
    ok('6 vantagem não aparece pelo plano', (await chipsDePonto()).some((t) => /vantagem/i.test(t)), false);
    ok('1 nada vaza pro lado', await vaza(), false);
    await pontos().first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${pasta}/1-contou-ponto-${largura}.png` });

    /* 2: um toque em cada; de novo tira só ele */
    await toque(chipPonto(/^Raspagem/));
    await toque(chipPonto(/^Montada/));
    ok('2 os dois toques: 6 pontos em "Meus lances", com a técnica', [await total(), await ligado(chipPonto(/^Raspagem/)), await ligado(chipPonto(/^Montada/)), (await meus().textContent()).includes(TES)], ['6 pts', true, true, true]);
    await meus().evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${pasta}/2-nos-lances-${largura}.png` });
    await toque(chipPonto(/^Montada/));
    ok('2 tocar de novo tira só a montada', [await total(), await ligado(chipPonto(/^Montada/)), await ligado(chipPonto(/^Raspagem/))], ['2 pts', false, true]);
    await toque(chipPonto(/^Montada/));

    /* 3: com uma queda na mão, desmarcar o "Encaixou" tira só o do plano */
    await manual('Queda');
    ok('3 queda na mão soma', await total(), '8 pts');
    await toque(encaixou());
    ok('3 desmarcou o encaixou: sai só o que o plano pôs', [await total(), await pontos().count()], ['2 pts', 0]);
    await toque(encaixou());
    ok('3 encaixou de novo: volta a perguntar, sem pôr nada', [await total(), await ligado(chipPonto(/^Raspagem/))], ['2 pts', false]);

    /* 4: a raspagem já marcada na mão não soma de novo */
    await manual('Raspagem');
    ok('4 já marcada na mão: "já está nos lances"', await chipsDePonto(), ['Raspagem: já está nos lances', 'Montada +4']);
    await toque(chipPonto(/^Montada/));
    ok('4 a montada entra, a raspagem não duplica', await total(), '8 pts');
    await pontos().first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${pasta}/3-ja-esta-${largura}.png` });
    /* foram duas raspagens de verdade: a segunda entra na mão, como sempre */
    await meus().locator('.pts-item').filter({ hasText: 'Raspagem' }).first().getByRole('button', { name: 'Mais um' }).click();
    await page.waitForTimeout(250);
    ok('4 a segunda raspagem entra na mão', await total(), '10 pts');
    await salvar();
    let r = await ultimo();
    ok('4 gravou: a do plano no pontuou, as da mão fora', [r.ptsMeus, r.plano?.pontuou], [['queda', 'raspagem', 'montada', 'raspagem'], [{ ponto: 'montada', nome: '' }]]);

    /* 5: um rola só com o plano; salvar, reabrir e apagar na mão */
    await novo();
    await toque(bloco().getByRole('button', { name: PLANO.nome, exact: true }));
    await toque(peca(TES));
    await toque(encaixou());
    await toque(chipPonto(/^Raspagem/));
    await toque(chipPonto(/^Montada/));
    await salvar();
    r = await ultimo();
    ok('5 gravou os pontos e o que o plano pôs', [r.ptsMeus, r.tecMeus, r.plano?.pontuou],
      [['raspagem', 'montada'], { raspagem: [TES] }, [{ ponto: 'raspagem', nome: TES }, { ponto: 'montada', nome: '' }]]);
    await page.goto(`${url}/?go=treinos&abrir=${r.sessionId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
    await page.waitForTimeout(600);
    await toque(page.locator('.plano-rola-resumo').first());
    ok('5 reaberto: os chips continuam do plano', [await ligado(chipPonto(/^Raspagem/)), await ligado(chipPonto(/^Montada/)), await total()], [true, true, '6 pts']);
    await toque(meus().locator('.pts-item').filter({ hasText: 'Raspagem' }).first().getByRole('button', { name: 'Menos um' }));
    ok('5 apagou a raspagem na mão: o chip volta a livre', [await total(), await ligado(chipPonto(/^Raspagem/))], ['4 pts', false]);
    await salvar();
    r = (await banco()).find((x) => x.sessionId === r.sessionId);
    ok('5 salvo: a raspagem saiu do pontuou, a montada ficou', [r.ptsMeus, r.plano?.pontuou], [['montada'], [{ ponto: 'montada', nome: '' }]]);

    /* 7: na luta de campeonato o placar é do árbitro */
    await page.goto(`${url}/?go=treinos`, { waitUntil: 'networkidle' });
    await toque(page.locator('button.chip').filter({ hasText: /^Competição$/ }).first());
    await page.getByRole('button', { name: /Novo treino/i }).first().click();
    await page.waitForTimeout(600);
    await page.locator('input[placeholder^="Ex.: Copa"]').last().fill('Copa Teste');
    await toque(page.getByRole('button', { name: /Salvar e seguir/i }).last());
    await page.waitForTimeout(800);
    await toque(page.getByRole('button', { name: /Registrar a 1ª luta/i }).last());
    await page.waitForTimeout(600);
    await toque(bloco().getByRole('button', { name: PLANO.nome, exact: true }));
    await toque(peca(TES));
    await toque(encaixou());
    ok('7 luta de campeonato: encaixou sem pergunta de ponto', [await bloco().isVisible(), await ligado(encaixou()), await pontos().count()], [true, true, 0]);

    /* 8: o rola antigo continua igual */
    const velho = (await banco()).find((x) => x.id === antigo);
    ok('8 o rola antigo continua igual', [velho.ptsMeus, velho.tecMeus, velho.plano ?? null], [['raspagem'], { raspagem: [TES] }, null]);
    ok('nenhum erro na página', erros, []);
    await contexto.close();
  }
} finally {
  await browser.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
