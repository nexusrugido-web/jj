import { JSDOM } from 'jsdom';
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
import 'fake-indexeddb/auto';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://jj.local/', pretendToBeVisual: true,
});
const w = dom.window;

// coloca o DOM como global, pra o bundle rodar como se fosse navegador
for (const k of ['document','navigator','location','history','HTMLElement','Element','Node','Event',
  'CustomEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame',
  'DOMParser','Image','SVGElement','Text','NodeList','HTMLCollection','CSSStyleDeclaration','AbortController']) {
  if (w[k] !== undefined) { try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); } catch {} }
}
globalThis.window = w;
globalThis.self = w;
globalThis.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
w.matchMedia = globalThis.matchMedia;
globalThis.scrollTo = () => {};
w.scrollTo = () => {};
globalThis.fetch = async () => ({ ok:false, status:500, json: async()=>({}) });
try { Object.defineProperty(w,'localStorage',{ value:{_d:{},getItem(k){return this._d[k]??null},setItem(k,v){this._d[k]=String(v)},removeItem(k){delete this._d[k]}}, configurable:true }); } catch {}
globalThis.localStorage = w.localStorage;

const entrada = fs.readdirSync('dist/assets').find(f => f.startsWith('index-') && f.endsWith('.js'));
console.log('executando', entrada);

try {
  const erros = [];
  w.addEventListener('error', (e) => erros.push(e.message));
  w.addEventListener('unhandledrejection', (e) => erros.push(String(e.reason?.message || e.reason)));
  const logErro = console.error;
  console.error = (...a) => { erros.push(a.map(String).join(' ')); logErro(...a); };

  await import(pathToFileURL(path.resolve('dist/assets', entrada)).href);
  await new Promise(r => setTimeout(r, 4000));

  /* ---------- atravessa o onboarding como um usuário ---------- */
  const raiz = w.document.getElementById('root');
  const clicar = (el) => {
    if (!el) return false;
    el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  };
  const acharBotao = (txt) => [...raiz.querySelectorAll('button')]
    .find((b) => b.textContent.trim().toLowerCase().includes(txt.toLowerCase()));
  const esperar = (ms = 400) => new Promise((r) => setTimeout(r, ms));
  /* as redes de proteção não mostram mais "quebrou" na tela: elas
     registram no console, [app] na raiz e [tela] na de cada tela */
  const caiu = () => erros.some((e) => e.startsWith('[app]') || e.startsWith('[tela]'));

  const escreverNome = () => {
    const i = raiz.querySelector('input');
    if (!i) return false;
    const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set;
    setter.call(i, 'Teste');
    i.dispatchEvent(new w.Event('input', { bubbles: true }));
    return true;
  };

  /* o aceite vem antes de tudo */
  if (raiz.innerHTML.includes('aceite')) {
    console.log('aceitando os termos...');
    for (const b of raiz.querySelectorAll('.aceite')) { clicar(b); await esperar(150); }
    clicar(acharBotao('aceitar e continuar'));
    await esperar(900);
  }

  if (raiz.innerHTML.includes('login-card') || raiz.innerHTML.includes('entrada-card')) {
    console.log('passando pelo onboarding...');
    escreverNome(); await esperar();
    clicar(acharBotao('continuar')); await esperar();
    // a idade: o ano de nascimento
    { const i = raiz.querySelector('input'); Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(i, '1995'); i.dispatchEvent(new w.Event('input', { bubbles: true })); }
    await esperar();
    clicar(acharBotao('continuar')); await esperar();
    // uma pergunta por tela: faixa, tempo, ritmo, objetivo, trava, estilo, metas
    clicar(acharBotao('continuar')); await esperar();
    clicar(acharBotao('menos de 6 meses')); await esperar(600);
    clicar([...raiz.querySelectorAll('button')].find((b) => b.textContent.trim() === '3x')); await esperar(600);
    clicar(acharBotao('treinar por prazer')); await esperar(600);
    clicar(acharBotao('pular')); await esperar();
    clicar(acharBotao('pular esta parte')); await esperar();
    clicar(acharBotao('começar')); await esperar(1200);
  }

  /* ---------- visita as telas, que é onde os pedaços carregam ---------- */
  const telas = ['painel', 'treinos', 'estudo', 'jornada', 'dominio', 'analise', 'meujogo', 'metas', 'ajustes'];
  for (const t of telas) {
    w.history.pushState({}, '', `/?go=${t}`);
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    await esperar(500);
    if (caiu()) {
      console.log(`\n>>> A TELA "${t}" DERRUBOU O APP`);
      break;
    }
  }

  /* o player de aula precisa ser desenhado no corpo da página,
     senão ele herda a posição do card e some no meio do scroll */
  w.history.pushState({}, '', '/?go=painel');
  w.dispatchEvent(new w.PopStateEvent('popstate'));
  await esperar(700);
  const capaAula = raiz.querySelector('.rec-aula');
  if (capaAula) {
    clicar(capaAula);
    await esperar(500);
    const noCorpo = w.document.body.querySelector(':scope > .rec-player, :scope > [data-rr-ui] .rec-player, :scope > div > .rec-player');
    const dentroDoCard = raiz.querySelector('.rec-player');
    console.log('player fora do card:', noCorpo || !dentroDoCard ? 'SIM' : 'NÃO, ainda está dentro');
    const iframe = w.document.querySelector('.rec-player-caixa iframe');
    console.log('vídeo carregou:', iframe ? 'SIM' : 'não achou');
  } else {
    console.log('(sem aula recomendada neste cenário)');
  }

  /* abrir a aula é o que expõe o player. Navegar pelas telas
     não bastava: o player só monta quando alguém clica. */
  for (const tela of ['painel', 'estudo']) {
    w.history.pushState({}, '', `/?go=${tela}`);
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    await esperar(700);
    const cartao = raiz.querySelector('.rec-aula') || raiz.querySelector('.aula-card');
    if (!cartao) continue;
    clicar(cartao);
    await esperar(700);
    if (caiu()) {
      console.log(`\n>>> ABRIR A AULA EM "${tela}" DERRUBOU O APP`);
      process.exit(1);
    }
    const player = w.document.querySelector('.player-caixa, .rec-player-tela');
    console.log(`  aula em ${tela}:`, player ? 'player abriu' : 'não achou aula pra abrir');
    const fechar = [...w.document.querySelectorAll('button')].find((b) => /fechar/i.test(b.textContent));
    if (fechar) { clicar(fechar); await esperar(300); }
  }

  const html = raiz.innerHTML;
  // o que o app realmente leu do banco
  try {
    const Dexie = (await import('dexie')).default;
    const d2 = new Dexie('tatame_os'); await d2.open();
    const cfg = await d2.table('meta').get('settings');
    console.log('settings no banco:', JSON.stringify(cfg?.value ? { onboardingFeito: cfg.value.onboardingFeito, nome: cfg.value.nome } : null));
    console.log('sessions:', await d2.table('sessions').count(), '| rolls:', await d2.table('rolls').count());
    d2.close();
  } catch (e) { console.log('leitura falhou:', e.message); }
  const quebrou = caiu();
  const tdz = erros.find((e) => /before initialization/i.test(e));

  console.log('\n=== RESULTADO ===');
  if (tdz) { console.log('CICLO DETECTADO:', tdz); process.exit(1); }
  if (quebrou) { console.log('O APP CAIU NA TELA DE ERRO'); console.log(erros.slice(0,3)); process.exit(1); }
  console.log(html.length > 100 ? `MONTOU (${html.length} chars)` : `NÃO MONTOU (${html.length} chars)`);
  if (html.length > 100) console.log('trecho:', html.slice(0,180).replace(/\s+/g,' '));
  if (html.length <= 100) process.exit(1);
} catch (e) {
  console.log('\n>>> ERRO NA EXECUÇÃO');
  console.log('   ', e.message);
  console.log(String(e.stack).split('\n').slice(1,4).join('\n'));
}
process.exit(0);
