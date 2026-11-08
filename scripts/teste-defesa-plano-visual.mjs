import { chromium } from 'playwright';
import fs from 'node:fs/promises';

/* ============================================================
   R7.4c NO APP DE VERDADE (precisa do npm run dev), em 360, 700 e 1280px
   1. "Ele defendeu" é uma coisa, "como" é outra: depois do defendeu
      aparecem só as defesas que o plano tem pra essa peça, nada marcado
      sozinho, com "Não sei";
   2. várias defesas: escolhe a que aconteceu, tocar de novo desfaz; a
      peça marcada não anda; o resumo recolhido diz como;
   3. defesa única: aparece, mas não é escolhida sozinha;
   4. peça sem defesa no plano e "Ele escapou" não perguntam como;
   5. a defesa sai do plano: o treino salvo continua dizendo qual foi;
   6. a taxa por etapa lê a defesa da última peça;
   7. o rola antigo continua igual.
   ============================================================ */
const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/defesa-plano';
await fs.mkdir(pasta, { recursive: true });

const ARM = 'Armlock da guarda fechada';
const base = { seFalhar: '', proxima: '', detalhe: '' };
const PLANO = {
  tipo: 'ataque', modo: 'ambos', faixa: 'branca', legal: true, aviso: '', resumo: '', paraAltura: [], paraPeso: [], pronto: 0, favorito: 0, arquivada: 0,
  posicao: 'Guarda fechada', objetivo: 'Finalizar', objetivoTipo: 'finalizar', uid: 'r74c', nome: 'Armlock e as defesas',
  passos: [
    { id: 'arm', lig: 'lArm', acao: ARM, gatilho: '', pai: null, via: null },
    { id: 'tri', lig: 'lTri', acao: 'Triângulo', gatilho: 'puxou o braço', pai: 0, via: 'defendeu' },
    { id: 'omo', lig: 'lOmo', acao: 'Omoplata', gatilho: 'empilhou', pai: 0, via: 'defendeu' },
    { id: 'kim', lig: 'lKim', acao: 'Kimura', gatilho: 'tirou a cabeça', pai: 1, via: 'defendeu' },
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
      await db.attackPlans.add({ ...plano, criadoEm: Date.now(), updatedAt: Date.now() });
      await db.partners.add({ nome: 'Zé', faixa: 'azul', graus: 0, academiaId: null, pesoKg: null, notas: '' });
      /* o rola antigo: defendeu, sem dizer como */
      const s = await db.sessions.add({ data: '2026-10-01', tipo: 'gi', duracao: 60, notas: '' });
      return db.rolls.add({ sessionId: s, data: '2026-10-01', duracao: 5, contexto: 'rola', ptsMeus: [], ptsDele: [], subsAplicadas: [], subsSofridas: [], notas: 'antigo',
        plano: { uid: plano.uid, peca: 'arm', caminho: ['lArm'], encaixou: false, parou: 'defendeu', entrou: [] } });
    }, PLANO);

    const bloco = () => page.locator('.plano-rola').first();
    const defesas = () => page.locator('.defesas-do-rola');
    const chipsDeDefesa = async () => (await defesas().count() ? defesas().first().locator('.chip').allTextContents() : []);
    const ligado = async (loc) => /\bon\b/.test(await loc.getAttribute('class') || '');
    const chip = (nome) => defesas().first().getByRole('button', { name: nome, exact: true }).first();
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
      await toque(bloco().getByRole('button', { name: PLANO.nome, exact: true }));
    };
    const peca = (nome) => page.locator('.mapa-rola').getByRole('button', { name: nome, exact: true }).first();
    const parada = (nome) => bloco().getByRole('button', { name: nome, exact: true }).first();
    const salvar = async () => { await page.getByRole('button', { name: /Salvar treino/ }).click(); await page.waitForTimeout(1200); };
    const EMP = 'empilhou → Omoplata';
    const PUX = 'puxou o braço → Triângulo';

    /* 1: defendeu é uma coisa, como é outra */
    await novo();
    await toque(peca(ARM));
    ok('1 só marcar a peça: não pergunta como', await defesas().count(), 0);
    await toque(parada('Ele defendeu'));
    ok('1 defendeu: as defesas do plano pra essa peça, nada escolhido sozinho', [await chipsDeDefesa(), await ligado(chip('Não sei'))], [[PUX, EMP, 'Não sei'], true]);
    ok('1 nada vaza pro lado', await vaza(), false);
    await defesas().first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${pasta}/1-como-defendeu-${largura}.png` });

    /* 2: várias: escolhe, desfaz, escolhe; a peça não anda */
    await toque(chip(EMP));
    const escolheu = [await ligado(chip(EMP)), await ligado(chip('Não sei'))];
    await toque(chip(EMP));
    const desfez = [await ligado(chip(EMP)), await ligado(chip('Não sei'))];
    await toque(chip(EMP));
    ok('2 escolhe, desfaz e escolhe de novo', [escolheu, desfez], [[true, false], [false, true]]);
    ok('2 a peça marcada continua o armlock (o caminho não anda)', [await ligado(peca(ARM)), await ligado(peca('Omoplata'))], [true, false]);
    await toque(bloco().getByRole('button', { name: 'Recolher', exact: true }));
    const resumo = (await page.locator('.plano-rola-resumo').first().textContent()) || '';
    ok('2 o resumo diz como ele defendeu', resumo.includes(`${ARM} · ele defendeu: ${EMP}`), true);
    await bloco().evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${pasta}/2-recolhido-${largura}.png` });
    await salvar();
    let r = await ultimo();
    ok('2 gravou o defendeu e a defesa na saida', [r.plano?.peca, r.plano?.parou, r.plano?.saida], ['arm', 'defendeu', 'lOmo']);
    const salvo = r;

    /* 3: defesa única: aparece, mas não é escolhida sozinha */
    await novo();
    await toque(peca('Triângulo'));
    await toque(parada('Ele defendeu'));
    ok('3 defesa única: só a dessa peça, sem escolher sozinha', [await chipsDeDefesa(), await ligado(chip('Não sei'))], [['tirou a cabeça → Kimura', 'Não sei'], true]);
    await salvar();
    r = await ultimo();
    ok('3 sem escolher: defendeu, sem dizer como', [r.plano?.peca, r.plano?.parou, r.plano?.saida], ['tri', 'defendeu', '']);

    /* 4: sem defesa no plano, e o escapou, não perguntam como */
    await novo();
    await toque(peca('Kimura'));
    await toque(parada('Ele defendeu'));
    ok('4 peça sem defesa no plano: não pergunta como', await defesas().count(), 0);
    await toque(peca(ARM));
    await toque(parada('Ele escapou'));
    ok('4 ele escapou: não pergunta como defendeu', await defesas().count(), 0);

    /* 5: a Omoplata sai do plano; o treino salvo continua dizendo qual foi */
    await page.evaluate(async (uid) => {
      const { db } = await import('/src/db/db.js');
      const { planoNovo, removidosAoSalvar, correnteDoPlano } = await import('/src/lib/planos.js');
      const p = await db.attackPlans.where('uid').equals(uid).first();
      const c = correnteDoPlano(p);
      const novo = planoNovo({ ...p, passos: c.passos.filter((x) => x.id !== 'omo').map((x) => ({ ...x })), ligacoes: c.ligacoes });
      await db.attackPlans.update(p.id, { passos: novo.passos, ligacoes: novo.ligacoes, removidos: removidosAoSalvar(p, novo), updatedAt: Date.now() });
    }, PLANO.uid);
    await page.goto(`${url}/?go=treinos&abrir=${salvo.sessionId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
    await page.waitForTimeout(600);
    const reaberto = (await page.locator('.plano-rola-resumo').first().textContent()) || '';
    await toque(page.locator('.plano-rola-resumo').first());
    ok('5 a defesa que saiu continua no treino salvo', [reaberto.includes(`ele defendeu: ${EMP}`), await chipsDeDefesa()], [true, [PUX, `${EMP} (saiu do plano)`, 'Não sei']]);
    await defesas().first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${pasta}/3-saiu-do-plano-${largura}.png` });
    await page.getByRole('button', { name: 'Cancelar' }).last().click();
    await page.waitForTimeout(400);
    r = (await banco()).find((x) => x.id === salvo.id) || (await banco()).find((x) => x.sessionId === salvo.sessionId);
    ok('5 cancelar não mexe no que foi salvo', [r.plano?.parou, r.plano?.saida], ['defendeu', 'lOmo']);

    /* 6: a taxa por etapa lê a defesa da última peça */
    const taxa = await page.evaluate(async (uid) => {
      const { db } = await import('/src/db/db.js');
      const { taxaPorEtapa } = await import('/src/lib/planos.js');
      const p = await db.attackPlans.where('uid').equals(uid).first();
      return taxaPorEtapa(p, await db.rolls.toArray()).pecas.arm;
    }, PLANO.uid);
    ok('6 taxa no armlock: 3 defendeu (a Omoplata que saiu, o caminho que seguiu pro Triângulo e o antigo sem dizer)', [taxa.vias.defendeu, taxa.ligacoes], [3, { lOmo: 1, lTri: 1 }]);

    /* 7: o rola antigo continua igual */
    const velho = (await banco()).find((x) => x.id === antigo);
    ok('7 o rola antigo continua sem dizer como', [velho.plano.parou, velho.plano.saida ?? null, velho.notas], ['defendeu', null, 'antigo']);
    ok('nenhum erro na página', erros, []);
    await contexto.close();
  }
} finally {
  await browser.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
