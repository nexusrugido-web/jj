import { chromium } from 'playwright';
import fs from 'node:fs/promises';

/* ============================================================
   R7.2 NO APP DE VERDADE (precisa do npm run dev), em 360, 700 e 1280px
   1. o mapa do rola: as peças são botões, a fuga é lugar (não marca),
      a ligação extra marca a peça já pela entrada dela;
   2. "Registrar uso" sem treino hoje: abre o treino novo com o rola e
      o plano marcados; nada é gravado antes do "Salvar treino";
   3. com treino hoje: escolhe "Rola novo neste treino" e grava no
      mesmo treino, sem treino nem rola repetido;
   4. o rola que já está com este plano abre como está e salvar de novo
      não duplica nada;
   5. rola com outro plano não é trocado: o botão fica travado.
   ============================================================ */
const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/registrar-uso';
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

    const mapa = () => page.locator('.mapa-rola');
    const peca = (nome) => mapa().getByRole('button', { name: nome, exact: true });
    const marcada = async (nome) => (await peca(nome).first().getAttribute('aria-pressed')) === 'true';
    const vaza = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const banco = () => page.evaluate(async () => {
      const { db } = await import('/src/db/db.js');
      return { treinos: await db.sessions.toArray(), rolas: (await db.rolls.toArray()).sort((a, b) => a.id - b.id) };
    });
    const abrirMapa = async (nome) => {
      await page.goto(`${url}/?go=planos`, { waitUntil: 'networkidle' });
      await page.locator('.plano-cartao', { hasText: nome }).first().getByRole('button', { name: 'Ver o mapa' }).first().click();
      await page.waitForTimeout(600);
    };
    const salvar = async () => {
      await page.getByRole('button', { name: /Salvar treino/ }).click();
      await page.waitForTimeout(1200);
    };

  /* R7.4a: o plano se escolhe no chip do bloco "Plano de ataque" ou no "Outro plano…" */
  const escolherPlano = async (nome) => {
    const bloco = page.locator('.plano-rola').first();
    const chip = bloco.getByRole('button', { name: nome, exact: true });
    if (await chip.count()) await chip.first().click();
    else { await bloco.getByRole('button', { name: 'Outro plano…', exact: true }).click(); await page.waitForTimeout(300); await page.getByRole('button', { name: nome, exact: true }).last().click(); }
    await page.waitForTimeout(250);
  };
  const planoMarcado = async () => (await page.locator('.plano-rola').first().locator('.chip.on').allTextContents()).join('|');
    /* 1. o mapa do rola */
    await page.goto(`${url}/?go=treinos&novo=1`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Adicionar rola/ }).first().click();
    await escolherPlano(CONV.nome);
    await page.waitForTimeout(300);
    ok('1 as peças do plano são botões no mapa', [await peca('Finta: Ameaço a guilhotina').count(), await peca('Preparação: Pegada na gola e na manga').count(), await peca(ARM).count()], [1, 1, 1]);
    ok('1 a fuga aparece como lugar, sem botão', [await mapa().getByText('Meia-guarda').count(), await mapa().getByRole('button', { name: /Meia-guarda/ }).count()], [1, 0]);
    ok('1 a volta pra posição aparece como lugar', await mapa().getByText('Volta pra Guarda fechada').count(), 1);
    const atalho = mapa().locator('.mapa-rola-peca.atalho');
    ok('1 a ligação extra (preparação → armlock) aparece na trilha', [await atalho.count(), (await atalho.first().textContent()).trim()], [1, ARM]);
    await atalho.first().click();
    await page.waitForTimeout(250);
    const porQual = page.getByText('Por qual entrada você chegou?').locator('xpath=..');
    const entrada = porQual.getByRole('button', { name: 'Pegada na gola e na manga', exact: true });
    ok('1 pela ligação: marca o armlock já pela preparação', [await atalho.first().getAttribute('aria-pressed'), await marcada(ARM), /\bon\b/.test(await entrada.getAttribute('class') || '')], ['true', false, true]);
    await peca('Finta: Ameaço a guilhotina').click();
    await page.waitForTimeout(250);
    ok('1 trocar pra finta: só ela marcada', [await marcada('Finta: Ameaço a guilhotina'), await marcada(ARM), await atalho.first().getAttribute('aria-pressed')], [true, false, 'false']);
    ok('1 o mapa não vaza a tela', await vaza(), false);
    await mapa().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${pasta}/1-mapa-do-rola-${largura}.png` });
    await page.getByRole('button', { name: 'Cancelar' }).last().click();
    await page.waitForTimeout(400);

    /* 2. Registrar uso sem treino hoje */
    await abrirMapa(CONV.nome);
    await page.getByRole('button', { name: 'Registrar uso' }).click();
    await page.waitForTimeout(1200);
    ok('2 sem treino hoje: abre o treino novo', await page.getByText('Novo treino').first().isVisible(), true);
    ok('2 o rola já vem com o plano e o mapa aberto', [await mapa().count(), await planoMarcado()], [1, CONV.nome]);
    ok('2 nada gravado antes do Salvar', (await banco()).rolas.length, 0);
    ok('2 o mapa aparece na tela', await mapa().isVisible(), true);
    await page.screenshot({ path: `${pasta}/2-registrar-uso-novo-${largura}.png` });
    await peca(ARM).click();
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: 'Encaixou', exact: true }).first().click();
    await page.waitForTimeout(250);
    await salvar();
    let b = await banco();
    ok('2 gravou 1 treino e 1 rola com o plano', [b.treinos.length, b.rolas.length, b.rolas[0]?.plano?.uid, b.rolas[0]?.plano?.peca, b.rolas[0]?.plano?.encaixou], [1, 1, 'r7-conv', 'arm', true]);
    ok('2 a finalização entrou uma vez, pelo plano', [b.rolas[0]?.subsAplicadas, b.rolas[0]?.plano?.entrou, b.rolas[0]?.resultado], [[ARM], [ARM], 'finalizei']);
    const r1 = b.rolas[0];

    /* 3. com treino hoje: rola novo no mesmo treino */
    await abrirMapa(CONV.nome);
    await page.getByRole('button', { name: 'Registrar uso' }).click();
    await page.waitForTimeout(500);
    ok('3 pergunta em qual rola, e mostra o que já está com o plano', await page.getByRole('button', { name: /Rola 1.*já está com este plano/ }).count(), 1);
    await page.screenshot({ path: `${pasta}/3-escolher-rola-${largura}.png` });
    await page.getByRole('button', { name: 'Rola novo neste treino' }).click();
    await page.waitForTimeout(1200);
    ok('3 abre o mesmo treino pra editar', await page.getByText('Editar treino').first().isVisible(), true);
    await peca('Preparação: Pegada na gola e na manga').click();
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: 'Ele não deixou', exact: true }).click();
    await page.waitForTimeout(250);
    await salvar();
    b = await banco();
    ok('3 continua 1 treino, agora com 2 rolas', [b.treinos.length, b.rolas.length], [1, 2]);
    /* editar treino regrava os rolas dele (id novo), como sempre foi: confere o conteúdo */
    ok('3 o rola 1 ficou igual', [b.rolas[0].sessionId, b.rolas[0].plano, b.rolas[0].subsAplicadas, b.rolas[0].resultado], [r1.sessionId, r1.plano, r1.subsAplicadas, r1.resultado]);
    ok('3 o rola 2 gravou a preparação e onde parou', [b.rolas[1].sessionId, b.rolas[1].plano?.peca, b.rolas[1].plano?.parou, b.rolas[1].plano?.caminho, b.rolas[1].subsAplicadas], [r1.sessionId, 'pB', 'impediu', ['lB'], []]);

    /* 4. o rola que já está com o plano abre como está */
    await abrirMapa(CONV.nome);
    await page.getByRole('button', { name: 'Registrar uso' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Rola 1.*já está com este plano/ }).click();
    await page.waitForTimeout(1200);
    ok('4 abre com o armlock e o encaixou marcados', [await marcada(ARM), /\bon\b/.test(await page.getByRole('button', { name: 'Encaixou', exact: true }).first().getAttribute('class'))], [true, true]);
    await salvar();
    b = await banco();
    ok('4 salvar de novo não duplica treino, rola nem finalização', [b.treinos.length, b.rolas.length, b.rolas[0].subsAplicadas, b.rolas[0].plano.entrou], [1, 2, [ARM], [ARM]]);

    /* 5. rola com outro plano não é trocado */
    await abrirMapa(REGRA.nome);
    await page.getByRole('button', { name: 'Registrar uso' }).click();
    await page.waitForTimeout(500);
    const travados = page.getByRole('button', { name: /já tem outro plano/ });
    ok('5 os dois rolas aparecem travados', [await travados.count(), await travados.first().isDisabled()], [2, true]);
    ok('5 a escolha não vaza a tela', await vaza(), false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    ok('nenhum erro na página', erros, []);
    await contexto.close();
  }
} finally {
  await browser.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
