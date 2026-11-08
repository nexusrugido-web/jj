import { chromium } from 'playwright';
import fs from 'node:fs/promises';

/* ============================================================
   R7.5 LINHA DA LUTA NO APP DE VERDADE (precisa do npm run dev), em 360, 700 e 1280px
   Cenário do dono: objetivo pela norte-sul, rola que começa em pé.
   1. o cartão do rola abre a linha ("Contar a luta"); o objetivo fica
      em cima e a primeira pergunta é o início real;
   2. em pé: finta em texto livre, reagiu; Single leg pelo catálogo com
      as respostas de queda; derrubou -> "Onde a luta ficou?";
   3. queda só pontua com toque (e o rodapé conta); passagem; norte-sul;
      a peça do plano aparece como sugestão tracejada; finalizou;
   4. salvar: a linha, o r.plano tirado dela, a finalização e o ponto
      no rola, sem duplicar ao reabrir e salvar de novo;
   5. o rola antigo (sem linha) abre pelo que ele dizia, sem mudar nada;
   6. nada vaza pro lado e nenhum erro na página;
   7. outro rola: escapou, a luta recomeçou, duas finalizações; no
      desktop as opções vão pra linha arrastando e soltando, no celular
      pelo toque (sem arraste).
   ============================================================ */
const url = process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta = process.env.APP_SCREENSHOTS || 'artifacts/linha-da-luta';
await fs.mkdir(pasta, { recursive: true });

const KIM = 'Kimura do norte-sul';
const base = { seFalhar: '', proxima: '', detalhe: '' };
const PLANO = {
  tipo: 'ataque', modo: 'ambos', faixa: 'branca', legal: true, aviso: '', resumo: '', paraAltura: [], paraPeso: [], pronto: 0, favorito: 0, arquivada: 0,
  posicao: 'Norte-sul', objetivo: 'Finalizar', objetivoTipo: 'finalizar', finalizacaoPreferida: KIM, finalizacoesAceitas: [], uid: 'r75', nome: 'Finalizar pela norte-sul',
  passos: [
    { id: 'kim', lig: 'lKim', acao: KIM, gatilho: '', pai: null, via: null },
    { id: 'est', lig: 'lEst', acao: 'Estrangulamento do norte-sul', gatilho: 'escondeu o braço', pai: 0, via: 'defendeu' },
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
      const ns = (await db.positions.toArray()).find((p) => p.slug === 'norte_sul');
      await db.attackPlans.add({ ...plano, posicaoId: ns.id, criadoEm: Date.now(), updatedAt: Date.now() });
      await db.partners.add({ nome: 'Zé', faixa: 'azul', graus: 0, academiaId: null, pesoKg: null, notas: '' });
      /* o rola antigo: kimura defendida, antes da linha */
      const s = await db.sessions.add({ data: '2026-10-01', tipo: 'gi', duracao: 60, notas: '' });
      return db.rolls.add({ sessionId: s, data: '2026-10-01', duracao: 5, contexto: 'rola', ptsMeus: [], ptsDele: [], subsAplicadas: [], subsSofridas: [], notas: 'antigo',
        plano: { uid: plano.uid, peca: 'kim', caminho: ['lKim'], encaixou: false, parou: 'defendeu', saida: 'lEst', entrou: [] } });
    }, PLANO);

    const folha = () => page.locator('.sheet').last();
    const fluxo = () => page.locator('.fluxo');
    const agora = () => page.locator('.fluxo-agora');
    const toque = async (loc) => { await loc.click(); await page.waitForTimeout(250); };
    const opcao = (nome) => agora().locator('.fluxo-opcao', { has: page.locator('.fluxo-opcao-nome', { hasText: new RegExp(`^${nome}$`) }) }).first();
    const pergunta = async () => ((await agora().locator('.fluxo-pergunta').first().textContent()) || '').trim();
    const rotulos = () => fluxo().locator('.fluxo-no .fluxo-nome').allTextContents();
    const vaza = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('.fluxo-no, .fluxo-opcao')].some((e) => e.scrollWidth > e.clientWidth + 1));
    const banco = () => page.evaluate(async () => {
      const { db } = await import('/src/db/db.js');
      return (await db.rolls.toArray()).sort((a, b) => a.id - b.id);
    });
    const tecnica = async (nome) => {
      await toque(agora().getByRole('button', { name: 'Outra técnica', exact: true }));
      await folha().getByPlaceholder(/Buscar em português/).fill(nome);
      await page.waitForTimeout(300);
      await toque(folha().locator('.list-item', { has: page.locator('.tiny', { hasText: new RegExp(`^${nome}\\s*$`) }) }).first());
    };
    const posicao = async (nome) => {
      await folha().getByPlaceholder('Buscar posição').fill(nome);
      await toque(folha().getByRole('button', { name: nome, exact: true }));
    };
    /* desktop: arrasta a opção até a área de soltar (que só aparece no arraste) */
    let fotoDoArraste = false;
    const arraste = async (loc) => {
      await page.waitForTimeout(500); /* espera a rolagem suave da pergunta nova */
      await loc.scrollIntoViewIfNeeded();
      const a = await loc.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 - 8, { steps: 4 });
      const alvo = page.locator('.fluxo-solta');
      await alvo.waitFor({ timeout: 2000 });
      await alvo.scrollIntoViewIfNeeded();
      const b = await alvo.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
      if (!fotoDoArraste) { fotoDoArraste = true; await page.screenshot({ path: `${pasta}/8-arrastando-${largura}.png` }); }
      await page.mouse.up();
      await page.waitForTimeout(300);
    };
    const pela = (loc) => (celular ? toque(loc) : arraste(loc));
    const foto = async (nome) => {
      await agora().evaluate((e) => e.scrollIntoView({ block: 'end' }));
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${pasta}/${nome}-${largura}.png` });
    };

    /* 1: abrir a linha pelo cartão do rola */
    await page.goto(`${url}/?go=treinos&novo=1`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Adicionar rola/ }).first().click();
    await page.waitForTimeout(300);
    await toque(page.locator('.parceiro-chips').getByRole('button', { name: 'Zé', exact: true }).first());
    await toque(page.locator('.plano-rola').getByRole('button', { name: PLANO.nome, exact: true }));
    ok('1 o mapa antigo saiu do cartão', await page.locator('.mapa-rola').count(), 0);
    await toque(page.locator('.plano-rola').getByRole('button', { name: 'Contar a luta' }));
    ok('1 objetivo no topo, pergunta do início real', [await fluxo().locator('.fluxo-no.n-objetivo .fluxo-nome').first().textContent(), await pergunta()], [`Finalizar com ${KIM}`, 'De onde o rola começou?']);
    ok('1 em pé e a posição do plano como opções', [await opcao('De pé').count(), await opcao('Norte-sul').count()], [1, 1]);
    await foto('1-inicio');

    /* 2: em pé, finta em texto, Single leg do catálogo */
    await toque(opcao('De pé'));
    ok('2 começou em pé: o plano não empurra a peça dele', await agora().locator('.fluxo-opcao.fantasma').count(), 0);
    await toque(agora().getByRole('button', { name: 'Finta ou preparação' }));
    await agora().getByPlaceholder(/ameaçar puxar/).fill('Ameaçar puxar pra guarda');
    await toque(agora().getByRole('button', { name: 'Pôr na linha' }));
    ok('2 finta: pergunta se ele reagiu', await pergunta(), 'Ele reagiu à finta?');
    await toque(opcao('Ele reagiu'));
    await tecnica('Single leg');
    const respostas = await agora().locator('.fluxo-opcao-nome').allTextContents();
    ok('2 Single leg com as respostas de queda', respostas, ['Consegui derrubar', 'Ele defendeu', 'Ele escapou', 'Ele puxou pra guarda', 'Não sei']);
    await foto('2-resultado-da-queda');
    await toque(opcao('Consegui derrubar'));
    ok('2 derrubou: pergunta onde a luta ficou (não pula pra passagem)', await pergunta(), 'Onde a luta ficou?');
    await foto('3-onde-ficou');

    /* 3: meia-guarda, passagem, 100kg, norte-sul, kimura */
    await toque(agora().getByRole('button', { name: /Outra posição/ }));
    await posicao('Meia-guarda, por cima');
    ok('3 a queda pode pontuar, mas só com toque', await fluxo().locator('.fluxo-pontos .chip').allTextContents(), ['Queda +2']);
    await toque(fluxo().locator('.fluxo-pontos').getByRole('button', { name: 'Queda +2' }));
    ok('3 confirmou a queda: rodapé conta 2', (await page.locator('.fluxo-placar').textContent()).trim(), '2 pontos confirmados');
    await tecnica('Passagem toureando');
    await toque(opcao('Passei a guarda'));
    await toque(opcao('Controle lateral, 100kg'));
    await toque(agora().getByRole('button', { name: 'Fui pra outra posição' }));
    await posicao('Norte-sul');
    const sugestao = agora().locator('.fluxo-opcao.fantasma', { has: page.locator('.fluxo-opcao-nome', { hasText: KIM }) });
    ok('3 na norte-sul, a peça do plano aparece como sugestão tracejada', await sugestao.count(), 1);
    await foto('4-sugestao-do-plano');
    await toque(sugestao.first());
    await toque(opcao('Encaixou'));
    ok('3 finalizou: o rola continuou?', await pergunta(), 'Finalizou! O rola continuou?');
    await toque(opcao('Não, acabou aí'));
    ok('3 a linha inteira, na ordem', await rotulos(), [`Finalizar com ${KIM}`, 'De pé', 'Ameaçar puxar pra guarda', 'Single leg', 'Meia-guarda, por cima', 'Passagem toureando', 'Controle lateral, 100kg', 'Norte-sul', KIM]);
    ok('3 os resultados nas setas', await fluxo().locator('.fluxo-seta-res').allTextContents(), ['Ele reagiu', 'Consegui derrubar', 'Passei a guarda', 'Finalizou']);
    ok('6 nada vaza pro lado', await vaza(), false);
    await fluxo().evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${pasta}/5-linha-inteira-${largura}.png`, fullPage: false });

    /* 4: salvar e reabrir sem duplicar */
    await toque(page.getByRole('button', { name: 'Voltar pro treino' }));
    ok('4 o cartão mostra o resumo e "Continuar a luta"', [await page.locator('.linha-resumo').count(), await page.locator('.plano-rola').getByRole('button', { name: 'Continuar a luta' }).count()], [1, 1]);
    await page.locator('.linha-abrir').evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${pasta}/6-cartao-${largura}.png` });
    await page.getByRole('button', { name: /Salvar treino/ }).click();
    await page.waitForTimeout(1200);
    let r = (await banco()).slice(-1)[0];
    ok('4 gravou a linha, o r.plano tirado dela, a finalização e o ponto', [r.linha?.seqs?.length, r.plano?.peca, r.plano?.encaixou, r.plano?.caminho, r.subsAplicadas, r.ptsMeus, r.linha?.entrou, r.linha?.pontuou?.length],
      [1, 'kim', true, ['lKim'], [KIM], ['queda'], [KIM], 1]);
    ok('4 o início real virou a posição de início do rola', r.posInicial, 'em_pe');
    await page.goto(`${url}/?go=treinos&abrir=${r.sessionId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
    await page.waitForTimeout(600);
    await toque(page.locator('.plano-rola').getByRole('button', { name: 'Continuar a luta' }));
    ok('4 reabriu no fim', await pergunta(), 'Fim do rola');
    await toque(page.getByRole('button', { name: 'Desfazer' }));
    await toque(opcao('Não, acabou aí'));
    await toque(page.getByRole('button', { name: 'Voltar pro treino' }));
    await page.getByRole('button', { name: /Salvar treino/ }).click();
    await page.waitForTimeout(1200);
    const r2 = (await banco()).find((x) => x.id === r.id) || (await banco()).find((x) => x.sessionId === r.sessionId);
    ok('4 reabrir e salvar de novo não duplica', [r2.subsAplicadas, r2.ptsMeus, r2.linha.entrou], [[KIM], ['queda'], [KIM]]);

    /* 5: o rola antigo abre pelo que ele dizia, sem mudar nada */
    const velho = (await banco()).find((x) => x.id === antigo);
    await page.goto(`${url}/?go=treinos&abrir=${velho.sessionId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
    await page.waitForTimeout(600);
    const resumoVelho = (await page.locator('.linha-resumo').first().textContent()) || '';
    ok('5 o antigo aparece pelo que ele dizia', resumoVelho.includes(KIM) && /defendeu/.test(resumoVelho), true);
    await toque(page.locator('.plano-rola').getByRole('button', { name: 'Continuar a luta' }));
    ok('5 abre a linha com a kimura defendida e a defesa', [await rotulos(), await fluxo().locator('.fluxo-seta-res').allTextContents()], [[`Finalizar com ${KIM}`, 'Norte-sul', KIM], ['Ele defendeu · escondeu o braço']]);
    await toque(page.getByRole('button', { name: 'Voltar pro treino' }));
    await page.getByRole('button', { name: 'Cancelar' }).last().click();
    await page.waitForTimeout(400);
    const igual = (await banco()).find((x) => x.id === antigo);
    ok('5 abrir e fechar não mexe no rola antigo', [igual.linha ?? null, igual.plano.parou, igual.plano.saida], [null, 'defendeu', 'lEst']);
    /* 7: escapou, recomeçou e duas finalizações; arrastando no desktop */
    await page.goto(`${url}/?go=treinos&novo=1`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Adicionar rola/ }).first().click();
    await page.waitForTimeout(300);
    await toque(page.locator('.parceiro-chips').getByRole('button', { name: 'Zé', exact: true }).first());
    await toque(page.locator('.plano-rola').getByRole('button', { name: PLANO.nome, exact: true }));
    await toque(page.locator('.plano-rola').getByRole('button', { name: 'Contar a luta' }));
    ok('7 arraste só com mouse (celular: toque)', await opcao('Norte-sul').getAttribute('draggable'), celular ? null : 'true');
    ok('7 a área de soltar não aparece parada', await page.locator('.fluxo-solta').count(), 0);
    await pela(opcao('Norte-sul'));
    const kim = () => agora().locator('.fluxo-opcao.fantasma', { has: page.locator('.fluxo-opcao-nome', { hasText: KIM }) }).first();
    await pela(kim());
    ok('7 a kimura entrou (tocando ou arrastando)', [await pergunta(), (await rotulos()).slice(-1)[0]], ['O que aconteceu?', KIM]);
    await pela(opcao('Ele escapou'));
    ok('7 escapou: pergunta onde a luta ficou', await pergunta(), 'Onde a luta ficou?');
    await toque(agora().getByRole('button', { name: /Outra posição/ }));
    await posicao('Combatendo a guarda, por cima');
    await toque(agora().getByRole('button', { name: 'A luta recomeçou' }));
    ok('7 recomeçou: pergunta de onde', await pergunta(), 'Onde a luta recomeçou?');
    await pela(opcao('Norte-sul'));
    await pela(kim());
    await pela(opcao('Encaixou'));
    await pela(opcao('Sim, recomeçou'));
    await pela(opcao('Norte-sul'));
    await pela(kim());
    await pela(opcao('Encaixou'));
    await pela(opcao('Não, acabou aí'));
    ok('7 três tentativas, a anterior guardada', await fluxo().locator('.fluxo-tentativa').count(), 2);
    ok('7 os resultados nas setas', await fluxo().locator('.fluxo-seta-res').allTextContents(), ['Ele escapou', 'Finalizou', 'Finalizou']);
    ok('7 nada vaza pro lado', await vaza(), false);
    await foto('7-recomeco-e-duas-finalizacoes');
    await toque(page.getByRole('button', { name: 'Voltar pro treino' }));
    await page.getByRole('button', { name: /Salvar treino/ }).click();
    await page.waitForTimeout(1200);
    r = (await banco()).slice(-1)[0];
    ok('7 gravou: três tentativas e duas finalizações (iguais contam duas)', [r.linha?.seqs?.length, r.subsAplicadas, r.linha?.entrou], [3, [KIM, KIM], [KIM, KIM]]);

    ok('nenhum erro na página', erros, []);
    await contexto.close();
  }
} finally {
  await browser.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
