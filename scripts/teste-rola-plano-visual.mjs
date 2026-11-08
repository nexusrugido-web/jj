import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

/* ============================================================
   R7.1 NO APP DE VERDADE (precisa do npm run dev), em 360, 700 e 1280px.
   Desde o R7.2 a peça se marca tocando no mapa do rola.
   Registra rolas pelo plano tocando na tela, em 360px, salva o treino
   e confere o que ficou gravado no banco:
   1. entrada certa quando várias levam à mesma peça, e pra onde a
      luta foi quando ele escapou;
   2. finalização marcada na mão não duplica e desmarcar o encaixou
      não apaga ela;
   3. a que o plano pôs sai quando desmarca;
   4. a finalização que o plano põe passa pelo mesmo aviso de regra da
      marcada na mão ("Não registrar" deixa como estava);
   5. "fiz outra coisa" passa pelo aviso uma vez só e não conta como
      objetivo alcançado.
   ============================================================ */
const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/rola-plano';
await fs.mkdir(pasta, { recursive: true });

const ARM = 'Armlock da guarda fechada';
const HEEL = 'Heel hook interno (chave de calcanhar)';
const base = { seFalhar: '', proxima: '', detalhe: '' };
const comum = { tipo: 'ataque', modo: 'ambos', faixa: 'branca', legal: true, aviso: '', resumo: '', paraAltura: [], paraPeso: [], pronto: 0, favorito: 0, arquivada: 0 };
const CONV = {
  ...comum, uid: 'r7-conv', nome: 'Duas entradas, um armlock', posicao: 'Guarda fechada', objetivo: 'Finalizar', objetivoTipo: 'finalizar',
  passos: [
    { id: 'fA', lig: 'lA', tipo: 'finta', descricao: 'Ameaço a guilhotina', gatilho: '', pai: null, via: null },
    { id: 'pB', lig: 'lB', tipo: 'preparacao', prep: 'pegada', descricao: 'Pegada na gola e na manga', gatilho: '', pai: null, via: null },
    { id: 'arm', lig: 'lArm', acao: ARM, gatilho: 'levantou a cabeça', pai: 0, via: 'reagiu' },
    { id: 'sit', lig: 'lsit', tipo: 'situacao', acao: 'Meia-guarda', gatilho: 'passou a perna', pai: 2, via: 'escapou' },
  ].map((x) => ({ ...base, ...x })),
  ligacoes: [
    { id: 'cB', de: 'pB', via: 'feita', gatilho: '', para: 'arm' },
    { id: 'volta', de: 'arm', via: 'escapou', gatilho: 'girou', para: null },
  ],
};
const REGRA = {
  ...comum, uid: 'r7-regra', nome: 'Heel hook direto', posicao: 'Guarda fechada', objetivo: 'Finalizar', objetivoTipo: 'finalizar',
  passos: [{ ...base, id: 'h', lig: 'lh', acao: HEEL, gatilho: '', pai: null, via: null }],
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
  await page.evaluate(async (planos) => {
    const { db, getMeta, setMeta } = await import('/src/db/db.js');
    const { VERSAO_DOCS } = await import('/src/components/Aceite.jsx');
    await setMeta('settings', { ...(await getMeta('settings', {})), nome: 'Praticante de teste', anoNascimento: 1995, faixa: 'branca', onboardingFeito: 1, tourVisto: 1, celebrar: false, aceite: { versao: VERSAO_DOCS, em: new Date().toISOString() } });
    for (const p of planos) await db.attackPlans.add({ ...p, criadoEm: Date.now() });
  }, [CONV, REGRA]);

  const botao = (nome) => page.getByRole('button', { name: nome, exact: true });
  const toque = async (nome, qual = 'first') => { await botao(nome)[qual]().click(); await page.waitForTimeout(250); };
  /* R7.2: a peça se marca no mapa do rola */
  const peca = async (nome) => { await page.locator('.mapa-rola').getByRole('button', { name: nome, exact: true }).first().click(); await page.waitForTimeout(250); };
  const ligado = async (nome, qual = 'first') => /\bon\b/.test(await botao(nome)[qual]().getAttribute('class') || '');
  const fuga = (nome) => page.getByText('Pra onde a luta foi?').locator('xpath=..').getByRole('button', { name: nome, exact: true });
  const avisoAberto = () => page.getByText('Essa técnica tem regra').isVisible();
  /* R7.4a: o plano se escolhe no chip do bloco "Plano de ataque" ou no "Outro plano…" */
  const escolherPlano = async (nome) => {
    const bloco = page.locator('.plano-rola').first();
    const chip = bloco.getByRole('button', { name: nome, exact: true });
    if (await chip.count()) await chip.first().click();
    else { await bloco.getByRole('button', { name: 'Outro plano…', exact: true }).click(); await page.waitForTimeout(300); await page.getByRole('button', { name: nome, exact: true }).last().click(); }
    await page.waitForTimeout(250);
  };
  const planoMarcado = async () => (await page.locator('.plano-rola').first().locator('.chip.on').allTextContents()).join('|');
  const novoRola = async (uid) => {
    await page.goto(`${url}/?go=treinos&novo=1`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Adicionar rola/ }).first().click();
    await escolherPlano({ 'r7-conv': CONV.nome, 'r7-regra': REGRA.nome }[uid]);
    await page.waitForTimeout(250);
  };
  const manual = async (nome) => {
    await page.getByPlaceholder('Qual finalização?').first().fill(nome);
    await page.getByPlaceholder('Qual finalização?').first().press('Enter');
    await page.waitForTimeout(250);
  };
  const salvar = async () => {
    await page.getByRole('button', { name: /Salvar treino/ }).click();
    await page.waitForTimeout(1200);
    return page.evaluate(async () => {
      const { db } = await import('/src/db/db.js');
      const r = (await db.rolls.toArray()).sort((a, b) => a.id - b.id).pop();
      return { plano: r.plano, subs: r.subsAplicadas, resultado: r.resultado, tecUid: r.tecUid || {} };
    });
  };
  const ler = (fn, ...args) => page.evaluate(async ([f, a]) => {
    const m = await import('/src/lib/planos.js');
    return m[f](...a);
  }, [fn, args]);

  /* 1. entrada e fuga */
  await novoRola('r7-conv');
  await peca(ARM);
  ok('1 com duas entradas, pergunta por qual (e "Não sei" fica marcado até responder)', [await botao('Pegada na gola e na manga').count(), await ligado('Não sei')], [1, true]);
  await toque('Pegada na gola e na manga');
  await toque('Ele escapou');
  ok('1 pergunta pra onde a luta foi, com as fugas do plano', [await fuga('Meia-guarda').count(), await fuga('Voltou pra Guarda fechada').count(), await ligado('Outro lugar')], [1, 1, true]);
  await fuga('Meia-guarda').click();
  await page.waitForTimeout(250);
  await peca(ARM);
  ok('1 tocar de novo no golpe não apaga entrada nem lugar', [await ligado('Pegada na gola e na manga'), (await fuga('Meia-guarda').getAttribute('class')).split(' ').includes('on')], [true, true]);
  await page.getByText('Pra onde a luta foi?').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${pasta}/1-entrada-e-fuga-${largura}.png` });
  const r1 = await salvar();
  ok('1 gravou a entrada pela preparação', r1.plano.caminho, ['lB', 'cB']);
  ok('1 gravou que ele escapou e pra onde', [r1.plano.parou, r1.plano.saida, await ler('lugarDaFuga', CONV, r1.plano)], ['escapou', 'lsit', 'Meia-guarda']);
  ok('1 o caminho fecha da posição até a peça', (await ler('caminhoDoRola', CONV, r1.plano.caminho)).inteiro, true);
  ok('1 sem encaixe, nada entra em "Eu finalizei"', r1.subs, []);

  /* 2. marcada na mão não duplica e não sai */
  await novoRola('r7-conv');
  await peca(ARM);
  await manual(ARM);
  await toque('Encaixou');
  ok('2 encaixou com ela já marcada na mão: não aparece "Já entrou"', await page.getByText('Já entrou em').count(), 0);
  await toque('Encaixou');
  await toque('Encaixou');
  const r2 = await salvar();
  ok('2 gravou uma só, e como sua', [r2.subs, r2.plano.entrou, r2.plano.encaixou], [[ARM], [], true]);
  ok('2 o rola sai como finalização, com o uid da técnica', [r2.resultado, Object.values(r2.tecUid).includes(ARM)], ['finalizei', true]);
  await novoRola('r7-conv');
  await peca(ARM);
  await manual(ARM);
  await toque('Encaixou');
  await toque('Encaixou');
  const r2b = await salvar();
  ok('2 desmarcar o encaixou não apaga a marcada na mão', [r2b.subs, r2b.plano.encaixou], [[ARM], false]);

  /* 3. a que o plano pôs sai quando desmarca */
  await novoRola('r7-conv');
  await peca(ARM);
  await toque('Encaixou');
  ok('3 encaixou: entra uma vez e avisa', await page.getByText(`Já entrou em "Eu finalizei": ${ARM}.`).count(), 1);
  await toque('Encaixou');
  await toque('Encaixou');
  const r3 = await salvar();
  ok('3 liga, desliga, liga: uma só, marcada como do plano', [r3.subs, r3.plano.entrou], [[ARM], [ARM]]);
  await novoRola('r7-conv');
  await peca(ARM);
  await toque('Encaixou');
  await toque('Encaixou');
  const r3b = await salvar();
  ok('3 desmarcou: a que o plano pôs saiu', [r3b.subs, r3b.plano.entrou], [[], []]);

  /* 4. o mesmo aviso de regra */
  await novoRola('r7-regra');
  await manual(HEEL);
  ok('4 na mão: heel hook abre o aviso de regra', await avisoAberto(), true);
  await toque('Não registrar');
  await peca(HEEL);
  await toque('Encaixou');
  ok('4 pelo plano: abre o mesmo aviso', await avisoAberto(), true);
  await page.screenshot({ path: `${pasta}/4-aviso-pelo-plano-${largura}.png` });
  await toque('Não registrar');
  ok('4 "Não registrar": encaixou e "Eu finalizei" ficam como estavam', [await ligado('Encaixou'), await page.getByText('Já entrou em').count()], [false, 0]);
  await toque('Encaixou');
  await toque('Registrar mesmo assim');
  ok('4 "Registrar mesmo assim": aviso fecha e encaixou liga', [await avisoAberto(), await ligado('Encaixou')], [false, true]);
  const r4 = await salvar();
  ok('4 gravou a finalização uma vez', [r4.subs, r4.plano.encaixou], [[HEEL], true]);

  /* 5. fiz outra coisa */
  await novoRola('r7-conv');
  await peca(ARM);
  await toque('Fiz outra coisa');
  await page.getByPlaceholder('Buscar em português ou inglês…').fill('Heel hook interno');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: new RegExp(HEEL.replace(/[()]/g, '\\$&')) }).first().click();
  await page.waitForTimeout(300);
  ok('5 escolher a técnica abre o aviso de regra', await avisoAberto(), true);
  await toque('Registrar mesmo assim');
  await toque('Encaixou', 'last');
  ok('5 encaixou no improviso: não avisa de novo', await avisoAberto(), false);
  await page.getByText('Fez outra coisa, fora do plano?').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${pasta}/5-fiz-outra-coisa-${largura}.png` });
  const r5 = await salvar();
  ok('5 gravou fora do plano, com uid', [r5.plano.improviso?.nome, !!r5.plano.improviso?.uid, r5.plano.improviso?.encaixou, r5.plano.encaixou], [HEEL, true, true, false]);
  ok('5 finalização aplicada, objetivo do plano não alcançado', [r5.subs, r5.resultado, await ler('alcancouObjetivo', CONV, { plano: r5.plano })], [[HEEL], 'finalizei', false]);

  ok('nenhum erro na página', erros, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'a página vaza pro lado');
  await contexto.close();
 }
} finally {
  await browser.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
