import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

/* ============================================================
   MAPA DO PLANO NO CELULAR
   Abre o app de verdade (npm run dev) no Chrome com a tela de 360px
   (viewport do Playwright: o --window-size do Chrome headless não
   desce de ~494px) e confere o "Ver o mapa" e o editor: cartões com
   tamanho, dentro do quadro, sem a página vazar pro lado.
   ============================================================ */
const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/planos';
await fs.mkdir(pasta, { recursive: true });

const PLANO = {
  nome: 'Guarda fechada, três entradas', posicao: 'Guarda fechada', objetivo: 'Finalizar', objetivoTipo: 'finalizar',
  passos: [
    { id: 'f1', lig: 'l1', tipo: 'finta', acao: 'Guilhotina', gatilho: '', pai: null, via: null },
    { id: 'f2', lig: 'l2', tipo: 'finta', acao: 'Raspagem de tesoura', gatilho: '', pai: null, via: null },
    { id: 'g3', lig: 'l3', acao: 'Armlock', gatilho: 'levantou a cabeça', pai: 0, via: 'reagiu' },
    { id: 'g4', lig: 'l4', acao: 'Triângulo', gatilho: 'colou o cotovelo', pai: 2, via: 'defendeu' },
    { id: 'g5', lig: 'l5', acao: 'Omoplata', gatilho: 'girou o braço pra fora', pai: 2, via: 'defendeu' },
    { id: 'g6', lig: 'l6', acao: 'Kimura', gatilho: '', pai: 0, via: 'naoReagiu' },
    { id: 'g7', lig: 'l7', acao: 'Mata-leão', gatilho: '', pai: 0, via: 'naoReagiu' },
    { id: 'g8', lig: 'l8', acao: 'Raspagem de quadril (hip bump)', gatilho: 'apoiou a mão', pai: 1, via: 'reagiu' },
  ].map((x) => ({ seFalhar: '', proxima: '', detalhe: '', ...x })),
  tipo: 'ataque', modo: 'ambos', faixa: 'branca', legal: true, aviso: '', resumo: '', paraAltura: [], paraPeso: [],
  pronto: 0, favorito: 0, arquivada: 0,
};

/* o plano grande: 3 entradas com finta, reagiu e 2 não reagiu, cada
   golpe com 2 defesas e um galho que desce 12 níveis. Sem teto de peças. */
const GRANDE = (() => {
  const passos = [];
  const poe = (x) => { passos.push({ id: `G${passos.length}`, lig: `L${passos.length}`, gatilho: '', seFalhar: '', proxima: '', detalhe: '', ...x }); return passos.length - 1; };
  for (let e = 0; e < 3; e++) {
    const f = poe({ tipo: 'finta', acao: ['Guilhotina', 'Raspagem de tesoura', 'Kimura'][e], pai: null, via: null });
    for (const via of ['reagiu', 'naoReagiu', 'naoReagiu']) {
      const g = poe({ acao: 'Armlock', gatilho: 'ele mexeu', pai: f, via });
      poe({ acao: 'Triângulo', gatilho: 'colou o cotovelo', pai: g, via: 'defendeu' });
      poe({ acao: 'Omoplata', gatilho: 'girou o braço', pai: g, via: 'defendeu' });
    }
  }
  let fundo = 10;
  for (let k = 0; k < 12; k++) fundo = poe({ acao: k % 2 ? 'Mata-leão' : 'Raspagem de quadril (hip bump)', gatilho: 'defendeu de novo', pai: fundo, via: k % 3 ? 'defendeu' : 'encaixou' });
  return { ...PLANO, nome: 'Sistema grande da guarda', passos };
})();

/* R2: ele escapou do armlock e recuperou a guarda (dali volto a
   atacar até a kimura); ou levantou, e dali o plano não tem ataque */
const FUGA = {
  ...PLANO, nome: 'Armlock com fuga', passos: [
    { id: 'a0', lig: 'm0', acao: 'Armlock', gatilho: '', pai: null, via: null },
    { id: 'a1', lig: 'm1', acao: 'Triângulo', gatilho: 'colou o cotovelo', pai: 0, via: 'defendeu' },
    { id: 'a2', lig: 'm2', tipo: 'situacao', acao: 'Guarda fechada', gatilho: 'girou e recuperou a guarda', pai: 0, via: 'escapou' },
    { id: 'a3', lig: 'm3', acao: 'Raspagem de quadril (hip bump)', gatilho: 'sentou pra trás', pai: 2, via: 'retoma' },
    { id: 'a4', lig: 'm4', acao: 'Kimura', gatilho: '', pai: 3, via: 'encaixou' },
    { id: 'a5', lig: 'm5', tipo: 'situacao', acao: 'De pé', gatilho: 'levantou e saiu', pai: 0, via: 'escapou' },
  ].map((x) => ({ seFalhar: '', proxima: '', detalhe: '', ...x })),
};

/* R3: três fintas abrem o mesmo armlock (um cartão só); do triângulo
   ele escapa e a luta volta pra guarda fechada (onde começa); da
   meia-guarda volto pro armlock; a fuga da raspagem cai na meia-guarda
   que já existe */
const CONV = {
  ...PLANO, nome: 'Três fintas, um armlock', passos: [
    { id: 'fA', lig: 'lA', tipo: 'finta', acao: 'Guilhotina', gatilho: '', pai: null, via: null },
    { id: 'fB', lig: 'lB', tipo: 'finta', acao: 'Raspagem de tesoura', gatilho: '', pai: null, via: null },
    { id: 'fC', lig: 'lC', tipo: 'finta', acao: 'Kimura', gatilho: '', pai: null, via: null },
    { id: 'arm', lig: 'lArm', acao: 'Armlock', gatilho: 'levantou a cabeça', pai: 0, via: 'reagiu' },
    { id: 'tri', lig: 'lTri', acao: 'Triângulo', gatilho: 'colou o cotovelo', pai: 3, via: 'defendeu' },
    { id: 'sit', lig: 'lSit', tipo: 'situacao', acao: 'Meia-guarda', gatilho: 'passou a perna', pai: 3, via: 'escapou' },
    { id: 'hip', lig: 'lHip', acao: 'Raspagem de quadril (hip bump)', gatilho: '', pai: 1, via: 'naoReagiu' },
  ].map((x) => ({ seFalhar: '', proxima: '', detalhe: '', ...x })),
  ligacoes: [
    { id: 'cB', de: 'fB', via: 'reagiu', gatilho: 'apoiou a mão', para: 'arm' },
    { id: 'cC', de: 'fC', via: 'reagiu', gatilho: 'escondeu o braço', para: 'arm' },
    { id: 'volta', de: 'tri', via: 'escapou', gatilho: 'girou e recuperou a guarda', para: null },
    { id: 'reat', de: 'sit', via: 'retoma', gatilho: '', para: 'arm' },
    { id: 'esc2', de: 'hip', via: 'escapou', gatilho: 'levantou', para: 'sit' },
  ],
};

/* cada cartão do mapa com tamanho, e quantos estão dentro do quadro */
const medirMapa = (s) => {
  const quadro = document.querySelector(s).getBoundingClientRect();
  const nos = [...document.querySelectorAll(`${s} .mente-no`)].map((n) => n.getBoundingClientRect());
  return {
    quadro: { w: Math.round(quadro.width), h: Math.round(quadro.height) },
    nos: nos.length,
    vazios: nos.filter((r) => r.width < 20 || r.height < 20).length,
    aVista: nos.filter((r) => r.right > quadro.left && r.left < quadro.right && r.bottom > quadro.top && r.top < quadro.bottom).length,
    vaza: document.documentElement.scrollWidth > innerWidth,
    /* dois cartões (peça, vaga ou folha) um em cima do outro */
    sobrepostos: (() => {
      const r = [...document.querySelectorAll(`${s} .mente-no, ${s} .mente-vaga, ${s} .mente-folha, ${s} .mente-atalho`)].map((n) => n.getBoundingClientRect());
      let n = 0;
      for (let a = 0; a < r.length; a++) for (let b = a + 1; b < r.length; b++) {
        if (r[a].left < r[b].right - 1 && r[b].left < r[a].right - 1 && r[a].top < r[b].bottom - 1 && r[b].top < r[a].bottom - 1) n++;
      }
      return n;
    })(),
  };
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [nome, viewport] of [['360', { width: 360, height: 800 }], ['700', { width: 700, height: 900 }]]) {
    const contexto = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: nome === '360', hasTouch: nome === '360', timezoneId: 'America/Sao_Paulo' });
    await contexto.route('**/*', (route) => (new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort()));
    const page = await contexto.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(async (plano) => {
      const { db, getMeta, setMeta } = await import('/src/db/db.js');
      const { VERSAO_DOCS } = await import('/src/components/Aceite.jsx');
      await setMeta('settings', { ...(await getMeta('settings', {})), nome: 'Praticante de teste', anoNascimento: 1995, faixa: 'branca', onboardingFeito: 1, tourVisto: 1, celebrar: false, aceite: { versao: VERSAO_DOCS, em: new Date().toISOString() } });
      for (const p of plano) await db.attackPlans.add({ ...p, criadoEm: Date.now() });
    }, [PLANO, GRANDE, FUGA, CONV]);
    await page.goto(`${url}/?go=planos`, { waitUntil: 'networkidle' });
    await page.getByText(PLANO.nome).first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `lista de planos vaza em ${nome}`);
    await page.screenshot({ path: `${pasta}/${nome}-lista.png` });

    /* Ver o mapa */
    await page.locator('.plano-cartao', { hasText: PLANO.nome }).first().getByRole('button', { name: 'Ver o mapa' }).first().click();
    await page.locator('.mente-tela .mente-no').first().waitFor();
    await page.waitForTimeout(400);
    const ver = await page.evaluate(medirMapa, '.mente-tela');
    console.log(`${nome} ver o mapa:`, JSON.stringify(ver));
    await page.screenshot({ path: `${pasta}/${nome}-ver-mapa.png` });
    assert.equal(ver.nos, 9, 'posição + 8 peças');
    assert.equal(ver.vazios, 0, 'cartão sem tamanho');
    assert.ok(ver.quadro.w > 200 && ver.quadro.h > 200, 'quadro do mapa sem tamanho');
    assert.ok(ver.aVista >= 1, 'nenhum cartão à vista');
    assert.equal(ver.vaza, false, 'mapa vaza a página');
    assert.equal(ver.sobrepostos, 0, 'cartões sobrepostos no mapa');
    await page.keyboard.press('Escape');
    await page.goto(`${url}/?go=planos`, { waitUntil: 'networkidle' });

    /* editor */
    await page.getByText(PLANO.nome).first().waitFor();
    await page.locator('.plano-cartao', { hasText: PLANO.nome }).first().getByRole('button', { name: 'Editar' }).first().click();
    await page.locator('.mente-tela .mente-vaga').first().waitFor();
    await page.locator('.mente-tela').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const ed = await page.evaluate(medirMapa, '.mente-tela');
    console.log(`${nome} editor:`, JSON.stringify(ed));
    await page.screenshot({ path: `${pasta}/${nome}-editor.png` });
    assert.equal(ed.nos, 9);
    assert.equal(ed.vazios, 0);
    assert.equal(ed.vaza, false, 'editor vaza a página');
    assert.equal(ed.sobrepostos, 0, 'cartões sobrepostos no editor');
    assert.ok(await page.getByText('Outra ameaça pra trocar').count() >= 1, 'o "não reagiu" aceita outra ameaça');

    /* R2: a fuga abre a situação; dela volto a atacar ou o caminho fecha */
    await page.goto(`${url}/?go=planos`, { waitUntil: 'networkidle' });
    await page.getByText(FUGA.nome).first().waitFor();
    await page.locator('.plano-cartao', { hasText: FUGA.nome }).first().getByRole('button', { name: 'Ver o mapa' }).first().click();
    await page.locator('.mente-tela .mente-no.situacao').first().waitFor();
    await page.waitForTimeout(400);
    const fv = await page.evaluate(medirMapa, '.mente-tela');
    console.log(`${nome} fuga, ver o mapa:`, JSON.stringify(fv));
    await page.screenshot({ path: `${pasta}/${nome}-fuga-ver.png` });
    assert.equal(fv.nos, 7, 'fuga: posição + 6 peças');
    assert.equal(fv.sobrepostos, 0, 'fuga: cartões sobrepostos');
    assert.equal(fv.vaza, false, 'fuga: vaza a página');
    assert.equal(await page.locator('.mente-tela .mente-no.situacao').count(), 2, 'as duas situações aparecem');
    assert.equal(await page.locator('.mente-tela .mente-folha.fecha').count(), 1, 'a situação sem ataque diz que fecha');
    assert.ok(await page.locator('.mente-tela .mente-folha.chegada').count() >= 1, 'a reconstrução chega no objetivo');
    await page.getByRole('button', { name: 'Ver inteiro' }).click();
    await page.waitForTimeout(2500);
    await page.locator('.mente-quadro').screenshot({ path: `${pasta}/${nome}-fuga-inteiro.png` });
    await page.locator('.mente-tela .mente-no.situacao', { hasText: 'Guarda fechada' }).click();
    assert.ok(await page.getByText('atrás do mesmo objetivo').count() >= 1, 'o detalhe da situação lembra o objetivo');
    await page.keyboard.press('Escape');
    await page.goto(`${url}/?go=planos`, { waitUntil: 'networkidle' });
    await page.getByText(FUGA.nome).first().waitFor();
    await page.locator('.plano-cartao', { hasText: FUGA.nome }).first().getByRole('button', { name: 'Editar' }).first().click();
    await page.locator('.mente-tela .mente-vaga.escapou').first().waitFor();
    const fe = await page.evaluate(medirMapa, '.mente-tela');
    console.log(`${nome} fuga, editor:`, JSON.stringify(fe));
    await page.screenshot({ path: `${pasta}/${nome}-fuga-editor.png` });
    assert.equal(fe.sobrepostos, 0, 'fuga no editor: cartões sobrepostos');
    assert.equal(fe.vaza, false, 'fuga no editor: vaza a página');
    assert.equal(await page.locator('.mente-tela .mente-vaga.retoma').count(), 2, 'cada situação tem o + de voltar a atacar');
    /* montar uma fuga nova no Triângulo: escolhe onde a luta ficou */
    await page.locator('.mente-tela .mente-vaga.escapou', { hasText: 'Se ele escapar' }).first().click();
    await page.getByText('Onde a luta ficou').waitFor();
    await page.screenshot({ path: `${pasta}/${nome}-fuga-peca.png` });
    assert.equal(await page.getByText('É golpe ou finta?').count(), 0, 'a fuga não pergunta golpe ou finta');
    await page.locator('select').filter({ hasText: 'Escolha a posição' }).last().selectOption({ label: 'Meia-guarda' });
    await page.getByRole('button', { name: 'Pronto' }).click();
    await page.locator('.mente-tela .mente-no.situacao', { hasText: 'Meia-guarda' }).waitFor();
    assert.equal(await page.locator('.mente-tela .mente-no.situacao').count(), 3, 'a fuga nova entrou no mapa');

    /* R3: convergência e retorno, vendo e montando */
    await page.goto(`${url}/?go=planos`, { waitUntil: 'networkidle' });
    await page.getByText(CONV.nome).first().waitFor();
    await page.locator('.plano-cartao', { hasText: CONV.nome }).first().getByRole('button', { name: 'Ver o mapa' }).first().click();
    await page.locator('.mente-tela .mente-atalho').first().waitFor();
    await page.waitForTimeout(1200);
    const cv = await page.evaluate(medirMapa, '.mente-tela');
    console.log(`${nome} convergência, ver o mapa:`, JSON.stringify(cv));
    await page.screenshot({ path: `${pasta}/${nome}-conv-ver.png` });
    assert.equal(cv.nos, 8, 'convergência: posição + 7 peças');
    assert.equal(await page.locator('.mente-tela .mente-no', { hasText: 'Armlock' }).count(), 1, 'um Armlock só no mapa');
    assert.equal(await page.locator('.mente-tela .mente-atalho').count(), 5, 'os 5 caminhos extras viram atalho');
    assert.equal(await page.locator('.mente-tela .mapa-ponte path').count(), 5, 'cada atalho com o fio tracejado');
    assert.equal(cv.sobrepostos, 0, 'convergência: cartões sobrepostos');
    assert.equal(cv.vaza, false, 'convergência: vaza a página');
    assert.equal(await page.locator('.mente-tela .mente-atalho', { hasText: 'Volta pra' }).count(), 2, 'volta pra guarda (onde começa) e, da meia-guarda, pro armlock que vem antes');
    assert.equal(await page.locator('.mente-tela .mente-folha.fecha').count(), 0, 'a meia-guarda volta a atacar: não fecha');
    await page.getByRole('button', { name: 'Ver inteiro' }).click();
    await page.waitForTimeout(1500);
    await page.locator('.mente-quadro').screenshot({ path: `${pasta}/${nome}-conv-inteiro.png` });
    await page.getByRole('button', { name: 'Aproximar' }).click();
    await page.getByRole('button', { name: 'Aproximar' }).click();
    await page.locator('.mente-tela .mente-atalho', { hasText: 'apoiou a mão' }).click();
    await page.getByRole('button', { name: 'Ver no mapa' }).click();
    assert.equal(await page.locator('.mente-tela .mente-no.aberto', { hasText: 'Armlock' }).count(), 1, 'do atalho, o Ver no mapa abre o Armlock');
    assert.ok(await page.getByText('Também chega aqui por outro caminho').count() >= 1, 'o Armlock diz que chega por outros caminhos');
    await page.keyboard.press('Escape');
    await page.goto(`${url}/?go=planos`, { waitUntil: 'networkidle' });
    await page.getByText(CONV.nome).first().waitFor();
    await page.locator('.plano-cartao', { hasText: CONV.nome }).first().getByRole('button', { name: 'Editar' }).first().click();
    await page.locator('.mente-tela .mente-atalho').first().waitFor();
    await page.waitForTimeout(400);
    const ce = await page.evaluate(medirMapa, '.mente-tela');
    console.log(`${nome} convergência, editor:`, JSON.stringify(ce));
    await page.screenshot({ path: `${pasta}/${nome}-conv-editor.png` });
    assert.equal(ce.sobrepostos, 0, 'convergência no editor: cartões sobrepostos');
    assert.equal(ce.vaza, false, 'convergência no editor: vaza a página');
    /* outra defesa do Armlock liga na finta Guilhotina, que já está no mapa */
    await page.locator('.mente-tela .mente-vaga.defendeu', { hasText: 'Outra defesa dele' }).first().click();
    await page.getByText('Ou segue numa peça que já está no mapa').waitFor();
    await page.screenshot({ path: `${pasta}/${nome}-conv-peca.png` });
    await page.locator('.chip', { hasText: 'finta: Guilhotina' }).click();
    await page.getByPlaceholder('Ex.: colou o cotovelo no corpo').fill('empurrou meu quadril');
    await page.getByRole('button', { name: 'Pronto' }).click();
    await page.locator('.mente-tela .mente-atalho', { hasText: 'empurrou meu quadril' }).waitFor();
    assert.equal(await page.locator('.mente-tela .mente-atalho').count(), 6, 'a ligação nova entrou');
    assert.equal(await page.locator('.mente-tela .mente-no', { hasText: 'Guilhotina' }).count(), 1, 'sem repetir o cartão da Guilhotina');
    /* tirar a ligação: a peça fica */
    await page.locator('.mente-tela .mente-atalho', { hasText: 'empurrou meu quadril' }).click();
    await page.getByRole('button', { name: 'Tirar essa ligação' }).click();
    assert.equal(await page.locator('.mente-tela .mente-atalho').count(), 5, 'a ligação saiu');
    assert.equal(await page.locator('.mente-tela .mente-no', { hasText: 'Guilhotina' }).count(), 1, 'a Guilhotina ficou');
    /* fuga com o nome de uma posição que já está no mapa: oferece ligar nela */
    const fugas = page.locator('.mente-tela .mente-vaga.escapou');
    let ofereceu = false;
    for (let k = 0; k < await fugas.count() && !ofereceu; k++) {
      await fugas.nth(k).click();
      await page.getByText('Onde a luta ficou').waitFor();
      for (const pos of ['Guarda fechada', 'Meia-guarda']) {
        await page.locator('select').filter({ hasText: 'Escolha a posição' }).last().selectOption({ label: pos });
        if (await page.getByText('já está no mapa. Se é o mesmo ponto').count()) { ofereceu = true; break; }
      }
      if (!ofereceu) await page.keyboard.press('Escape');
    }
    assert.ok(ofereceu, 'a fuga pra uma posição que já está no mapa oferece ligar nela');
    await page.screenshot({ path: `${pasta}/${nome}-conv-repetida.png` });
    await page.getByRole('button', { name: 'Ligar no que já está' }).click();
    await page.getByRole('button', { name: 'Pronto' }).click();
    assert.equal(await page.locator('.mente-tela .mente-atalho').count(), 6, 'a fuga virou ligação, sem cartão novo');
    assert.equal(await page.locator('.mente-tela .mente-no.situacao').count(), 1, 'continua uma situação só');
    await page.getByRole('button', { name: 'Salvar plano' }).click();
    await page.getByText('Plano salvo').first().waitFor();
    const salvo = await page.evaluate(async (n) => {
      const { db } = await import('/src/db/db.js');
      const p = (await db.attackPlans.toArray()).find((x) => x.nome === n);
      return { ligs: p.ligacoes.map((l) => l.id), removidas: (p.removidos?.ligacoes || []).map((l) => l.id), pecas: p.passos.length };
    }, CONV.nome);
    console.log(`${nome} convergência salva:`, JSON.stringify(salvo));
    assert.deepEqual(salvo.ligs.slice(0, 5), ['cB', 'cC', 'volta', 'reat', 'esc2'], 'os ids das ligações de antes não mudam ao salvar');
    assert.equal(salvo.ligs.length, 6, 'a fuga ligada foi salva');
    assert.equal(salvo.pecas, 7, 'nenhuma peça nova');

    /* o plano grande: mais de 16 peças, vendo e editando */
    for (const modo of ['Ver o mapa', 'Editar']) {
      await page.goto(`${url}/?go=planos`, { waitUntil: 'networkidle' });
      await page.getByText(GRANDE.nome).first().waitFor();
      const cartao = page.locator('.plano-cartao', { hasText: GRANDE.nome }).first();
      const t0 = Date.now();
      await cartao.getByRole('button', { name: modo }).first().click();
      await page.locator('.mente-tela .mente-no').nth(GRANDE.passos.length).waitFor();
      await page.waitForTimeout(400);
      const ms = Date.now() - t0;
      const m = await page.evaluate(medirMapa, '.mente-tela');
      console.log(`${nome} grande, ${modo} (${ms}ms):`, JSON.stringify(m));
      await page.screenshot({ path: `${pasta}/${nome}-grande-${modo === 'Editar' ? 'editor' : 'ver'}.png` });
      assert.equal(m.nos, GRANDE.passos.length + 1, `grande: posição + ${GRANDE.passos.length} peças`);
      assert.equal(m.vazios, 0);
      assert.equal(m.sobrepostos, 0, `grande: cartões sobrepostos (${modo})`);
      assert.equal(m.vaza, false, `grande: vaza a página (${modo})`);
      assert.ok(ms < 3000, `grande: demorou ${ms}ms pra abrir (${modo})`);
      if (modo === 'Ver o mapa') await page.keyboard.press('Escape');
    }
    assert.deepEqual(erros, [], `erros em ${nome}`);
    await contexto.close();
  }
} finally { await browser.close(); }
console.log(`Mapa do plano verificado em 360px e 700px. Capturas: ${pasta}`);
