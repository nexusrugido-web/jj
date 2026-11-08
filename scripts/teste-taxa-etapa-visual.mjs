import { chromium } from 'playwright';
import fs from 'node:fs/promises';

/* ============================================================
   R7.3 NO APP DE VERDADE (precisa do npm run dev), em 360, 700 e 1280px
   1. plano sem rola: nenhum número nas peças, o cartão diz "ainda sem rola";
   2. registra 3 rolas pelos fluxos de sempre (R7.2 "Registrar uso" e o
      registro do treino do R7.1) e põe no banco um drill e um rola antigo
      sem peça;
   3. o cartão: "Objetivo alcançado em 1 de 4", o aviso de pouco rola;
   4. o mapa: o número em cada peça com rola, nada na peça sem rola, e o
      detalhe ao tocar (encaixou, escapou, pra onde ele escapou);
   5. abrir o cartão, o mapa, tocar nas peças e o passo a passo não grava
      nada: o banco inteiro fica idêntico.
   ============================================================ */
const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/taxa-etapa';
await fs.mkdir(pasta, { recursive: true });

const ARM = 'Armlock da guarda fechada';
const base = { seFalhar: '', proxima: '', detalhe: '' };
const comum = { tipo: 'ataque', modo: 'ambos', faixa: 'branca', legal: true, aviso: '', resumo: '', paraAltura: [], paraPeso: [], pronto: 0, favorito: 0, arquivada: 0 };
const CONV = {
  ...comum, uid: 'r73-conv', nome: 'Duas entradas, um armlock', posicao: 'Guarda fechada', objetivo: 'Finalizar', objetivoTipo: 'finalizar',
  passos: [
    { id: 'fA', lig: 'lA', tipo: 'finta', descricao: 'Ameaço a guilhotina', gatilho: '', pai: null, via: null },
    { id: 'pB', lig: 'lB', tipo: 'preparacao', prep: 'pegada', descricao: 'Pegada na gola e na manga', gatilho: '', pai: null, via: null },
    { id: 'arm', lig: 'lArm', acao: ARM, gatilho: 'levantou a cabeça', pai: 0, via: 'reagiu' },
    { id: 'sit', lig: 'lsit', tipo: 'situacao', acao: 'Meia-guarda', gatilho: 'passou a perna', pai: 2, via: 'escapou' },
  ].map((x) => ({ ...base, ...x })),
  ligacoes: [{ id: 'cB', de: 'pB', via: 'feita', gatilho: '', para: 'arm' }],
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
    await page.evaluate(async (plano) => {
      const { db, getMeta, setMeta } = await import('/src/db/db.js');
      const { VERSAO_DOCS } = await import('/src/components/Aceite.jsx');
      await setMeta('settings', { ...(await getMeta('settings', {})), nome: 'Praticante de teste', anoNascimento: 1995, faixa: 'branca', onboardingFeito: 1, tourVisto: 1, celebrar: false, aceite: { versao: VERSAO_DOCS, em: new Date().toISOString() } });
      await db.attackPlans.add({ ...plano, criadoEm: Date.now() });
    }, CONV);

    /* R7.5: o rola se conta na linha da luta */
    const agora = () => page.locator('.fluxo-agora');
    const opcao = async (nome) => {
      await agora().locator('.fluxo-opcao', { has: page.locator('.fluxo-opcao-nome', { hasText: new RegExp(`^${nome}$`) }) }).first().click();
      await page.waitForTimeout(250);
    };
    const voltar = async () => { await page.getByRole('button', { name: 'Voltar pro treino' }).click(); await page.waitForTimeout(300); };
    const vaza = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    /* o banco inteiro: todas as tabelas, linha por linha */
    const fotoDoBanco = () => page.evaluate(async () => {
      const { db } = await import('/src/db/db.js');
      const out = {};
      for (const t of db.tables) out[t.name] = await t.toArray();
      return JSON.stringify(out);
    });
    const rolasDoBanco = () => page.evaluate(async () => {
      const { db } = await import('/src/db/db.js');
      return (await db.rolls.toArray()).sort((a, b) => a.id - b.id);
    });
    const irPraPlanos = async () => {
      await page.goto(`${url}/?go=planos`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
    };
    const cartao = () => page.locator('.plano-cartao', { hasText: CONV.nome }).first();
    const abrirMapa = async () => {
      await cartao().getByRole('button', { name: 'Ver o mapa' }).first().click();
      await page.waitForTimeout(900);
    };
    const salvar = async () => {
      await page.getByRole('button', { name: /Salvar treino/ }).click();
      await page.waitForTimeout(1200);
    };
    const noMapa = (texto) => page.locator('.mente-no', { hasText: texto }).first();
    const taxaDe = async (texto) => {
      const t = noMapa(texto).locator('.mente-taxa');
      return (await t.count()) ? (await t.textContent()).trim() : null;
    };

    /* 1. sem rola */
    await irPraPlanos();
    await cartao().waitFor({ timeout: 8000 });
    ok('1 cartão sem rola', await cartao().getByText('Ainda sem rola com ele').count(), 1);
    await abrirMapa();
    ok('1 nenhuma peça com número', await page.locator('.mente-taxa').count(), 0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    /* 2a. R7.2: Registrar uso, sem treino hoje: abre a linha; a finta, reagiu, armlock, encaixou */
    await abrirMapa();
    await page.getByRole('button', { name: 'Registrar uso' }).click();
    await page.waitForTimeout(1200);
    await opcao('Guarda fechada');
    await opcao('Ameaço a guilhotina');
    await opcao('Ele reagiu');
    await opcao(ARM);
    await opcao('Encaixou');
    await opcao('Não, acabou aí');
    await voltar();
    await salvar();
    /* 2b. R7.2 com treino hoje: rola novo, a preparação e ele não deixou */
    await irPraPlanos();
    await abrirMapa();
    await page.getByRole('button', { name: 'Registrar uso' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Rola novo neste treino' }).click();
    await page.waitForTimeout(1200);
    await opcao('Guarda fechada');
    await opcao('Pegada na gola e na manga');
    await opcao('Ele não deixou');
    await voltar();
    await salvar();
  /* R7.4a: o plano se escolhe no chip do bloco "Plano de ataque" ou no "Outro plano…" */
  const escolherPlano = async (nome) => {
    const bloco = page.locator('.plano-rola').first();
    const chip = bloco.getByRole('button', { name: nome, exact: true });
    if (await chip.count()) await chip.first().click();
    else { await bloco.getByRole('button', { name: 'Outro plano…', exact: true }).click(); await page.waitForTimeout(300); await page.getByRole('button', { name: nome, exact: true }).last().click(); }
    await page.waitForTimeout(250);
  };
    /* 2c. o registro do treino: armlock fora da ordem do plano (caminho não dito), ele escapou pra meia-guarda */
    await page.goto(`${url}/?go=treinos&novo=1`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Adicionar rola/ }).first().click();
    await escolherPlano(CONV.nome);
    await page.locator('.plano-rola').getByRole('button', { name: 'Contar a luta' }).click();
    await page.waitForTimeout(300);
    await opcao('Guarda fechada');
    await agora().getByRole('button', { name: 'Outra peça do plano' }).click();
    await page.waitForTimeout(300);
    await page.locator('.sheet').last().locator('.fluxo-opcao', { has: page.locator('.fluxo-opcao-nome', { hasText: new RegExp(`^${ARM}$`) }) }).click();
    await page.waitForTimeout(250);
    await opcao('Ele escapou');
    await opcao('Meia-guarda');
    await voltar();
    await salvar();
    const rs = await rolasDoBanco();
    ok('2 três rolas gravados com o plano', rs.map((r) => [r.plano?.peca, r.plano?.caminho, !!r.plano?.encaixou, r.plano?.parou || '', r.plano?.saida || '']),
      [['arm', ['lA', 'lArm'], true, '', ''], ['pB', ['lB'], false, 'impediu', ''], ['arm', [], false, 'escapou', 'lsit']]);
    /* um drill (não conta) e um rola antigo sem peça (uso, fora das etapas) */
    await page.evaluate(async ([uid, sessionId]) => {
      const { db } = await import('/src/db/db.js');
      await db.rolls.add({ sessionId, contexto: 'drill', resultado: 'finalizei', plano: { uid, peca: 'arm', caminho: ['lA', 'lArm'], encaixou: true } });
      await db.rolls.add({ sessionId, resultado: 'empate', plano: { uid, peca: null, caminho: [], ateAntigo: 3, encaixou: false } });
    }, [CONV.uid, rs[0].sessionId]);

    /* 3. o cartão */
    await irPraPlanos();
    const antes = await fotoDoBanco();
    const textoCartao = (await cartao().textContent()).replace(/\s+/g, ' ');
    ok('3 cartão: objetivo alcançado em 1 de 4 (drill fora, antigo conta)', textoCartao.includes('Objetivo alcançado em 1 de 4 rolas'), true);
    ok('3 cartão: sem porcentagem com pouco rola, e o aviso', [/\d+%/.test(textoCartao), textoCartao.includes('Ainda é pouco rola pra tirar conclusão.')], [false, true]);
    ok('3 cartão: não diz mais "Encaixou em"', textoCartao.includes('Encaixou em'), false);
    ok('3 a página não vaza a tela', await vaza(), false);
    await cartao().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${pasta}/3-cartao-${largura}.png` });

    /* 4. o mapa */
    await abrirMapa();
    ok('4 número em cada peça com rola', [await taxaDe('Ameaço a guilhotina'), await taxaDe('Pegada na gola'), await taxaDe(ARM)],
      ['reagiu 1 de 1', 'montou 0 de 1', 'encaixou 1 de 2']);
    ok('4 peça sem rola fica sem número (nunca 0%)', await taxaDe('Meia-guarda'), null);
    ok('4 com pouco rola o número vem apagado', await noMapa(ARM).locator('.mente-taxa.pouco').count(), 1);
    ok('4 o mapa não vaza a tela', await vaza(), false);
    await page.screenshot({ path: `${pasta}/4-mapa-${largura}.png` });
    await noMapa(ARM).click();
    await page.waitForTimeout(400);
    const det = page.locator('.mente-detalhe').first();
    const textoDet = (await det.textContent()).replace(/\s+/g, ' ');
    ok('4 detalhe: passou em 2, encaixou 1 de 2, escapou 1 de 2, defendeu 0 de 2', ['passou por aqui em 2 rolas', 'Encaixou: 1 de 2', 'Ele escapou: 1 de 2', 'Ele defendeu: 0 de 2'].map((x) => textoDet.includes(x)), [true, true, true, true]);
    ok('4 detalhe: pra onde ele escapou, pela fuga do plano', textoDet.includes('passou a perna → Meia-guarda: 1'), true);
    ok('4 detalhe: o aviso de pouco rola', textoDet.includes('Ainda é pouco rola pra tirar conclusão.'), true);
    await det.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${pasta}/4-detalhe-${largura}.png` });
    await noMapa('Meia-guarda').click();
    await page.waitForTimeout(300);
    ok('4 detalhe da peça sem rola', (await page.locator('.mente-detalhe').first().textContent()).includes('ainda sem rola por aqui'), true);
    await page.getByRole('button', { name: 'Ver passo a passo' }).click();
    await page.getByRole('button', { name: 'Próximo' }).click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    /* 5. ler não grava */
    await irPraPlanos();
    ok('5 abrir o cartão, o mapa e as peças não gravou nada', (await fotoDoBanco()) === antes, true);

    ok('nenhum erro na página', erros, []);
    await contexto.close();
  }
} finally {
  await browser.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
