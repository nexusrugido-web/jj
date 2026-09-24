import { JSDOM } from 'jsdom';
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
import 'fake-indexeddb/auto';

/* ============================================================
   TODAS AS TELAS, COM DADOS DE VERDADE

   O teste de boot abre as telas com o app vazio. Muita tela só
   quebra quando tem o que mostrar: parceiro sem faixa, meta de
   cada tipo, lesão aberta, campeonato, drill no meio dos rolas.

   Aqui o banco nasce com uns cinco meses de treino antes do app
   abrir, e o teste passa em todas as telas. Qualquer erro, ou a
   tela de "carregando esta tela", derruba o check.
   ============================================================ */

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://jj.local/', pretendToBeVisual: true,
});
const w = dom.window;
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
/* o Dexie do app e o daqui precisam ver o mesmo banco falso */
try { Object.defineProperty(w, 'indexedDB', { value: globalThis.indexedDB, configurable: true }); w.IDBKeyRange = globalThis.IDBKeyRange; } catch {}

/* ---------- o banco, antes do app abrir ---------- */
const Dexie = (await import('dexie')).default;
const d = new Dexie('tatame_os');
d.version(8).stores({
  meta: 'key', outbox: '++id, uid, tabela, criadoEm',
  positions: '++id, uid, nome, familia, ordem, arquivada, updatedAt',
  categories: '++id, uid, nome, ordem, arquivada, updatedAt',
  techniques: '++id, uid, nome, categoriaId, origemId, destinoId, status, favorita, arquivada, updatedAt',
  partners: '++id, uid, nome, faixa, arquivada, updatedAt',
  sessions: '++id, uid, data, tipo, arquivada, updatedAt',
  rolls: '++id, uid, sessionId, partnerId, data, updatedAt',
  goals: '++id, uid, status, tipo, escopo, prazo, ordem, updatedAt',
  reviews: '++id, uid, techniqueId, proxima, box, updatedAt',
  gameplans: '++id, uid, nome, posicaoId, ordem, arquivada, updatedAt',
  breathProtocols: '++id, uid, nome, ordem, arquivada, updatedAt',
  breathLogs: '++id, uid, data, protocoloId, updatedAt',
  exercises: '++id, uid, nome, grupo, arquivada, updatedAt',
  physical: '++id, uid, data, tipo, updatedAt',
  injuries: '++id, uid, data, regiao, status, updatedAt',
  competitions: '++id, uid, data, updatedAt',
  notes: '++id, uid, data, pin, updatedAt',
  customFields: '++id, uid, entidade, ordem, updatedAt',
  attackPlans: '++id, uid, nome, faixa, posicao, modo, favorito, arquivada, updatedAt',
  gradings: '++id, uid, data, tipo, faixa, updatedAt',
  milestones: '++id, uid, chave, data, updatedAt',
  media: '++id, uid, tipo, vinculoTipo, vinculoId, data, updatedAt',
  foods: '++id, uid, nome, grupo, arquivada, updatedAt',
  meals: '++id, uid, data, refeicao, updatedAt',
  dietPlans: '++id, uid, nome, ativo, arquivada, updatedAt',
  gymPrograms: '++id, uid, nome, ativo, arquivada, updatedAt',
  gymLogs: '++id, uid, data, programaId, updatedAt',
  supplements: '++id, uid, nome, ativo, updatedAt',
  academies: '++id, uid, nome, arquivada, updatedAt',
  professors: '++id, uid, nome, academiaId, arquivada, updatedAt',
  aulasVistas: '++id, uid, videoId, data, tipo, updatedAt',
  quizRespostas: '++id, uid, perguntaId, acertou, data, caixa, proxima, updatedAt',
  pontos: '++id, uid, evento, xp, refId, data, semana, updatedAt',
  mscTreinos: '++id, uid, data, updatedAt', mscSeries: '++id, uid, treinoId, exercicioId, data, updatedAt',
  recFeitas: '++id, uid, chave, intencao, alvo, data, resultado, updatedAt',
  acervo: 'id, k, atualizadoEm',
  videoEventos: '++id, uid, videoId, evento, data, updatedAt',
});
await d.open();
const iso = (dias) => new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
const pids = [];
for (const [nome, faixa] of [['Rafa', 'branca'], ['Leo', 'azul'], ['Duda', 'roxa'], ['Caio', 'branca']]) {
  pids.push(await d.table('partners').add({ nome, faixa, arquivada: 0 }));
}
const subs = ['Chave de braço (armlock)', 'Americana', 'Triângulo', 'Mata-leão', 'Kimura'];
const pts = ['montada', 'raspagem', 'passagem', 'queda', 'costas', 'joelho'];
let n = 0;
for (let dia = 3; dia < 150; dia += 4) {
  const tipo = dia % 40 === 3 ? 'drill' : dia === 63 ? 'competicao' : 'gi';
  const sid = await d.table('sessions').add({
    data: iso(dia), tipo, duracao: 60 + (dia % 3) * 30, rpe: 6, arquivada: 0,
    nota: dia % 5 ? '' : 'Travei na passagem, preciso manter o quadril baixo',
    focoTecnicas: [{ nome: subs[dia % 5], aprendizado: 'peguei' }],
    ...(tipo === 'competicao' ? { competicao: { evento: 'Copa Teste', resultado: 'prata', divisao: 'adulto' } } : {}),
  });
  for (let k = 0; k < 3; k++) {
    n++;
    await d.table('rolls').add({
      sessionId: sid, partnerId: n % 5 === 0 ? null : pids[n % 4], duracao: 5,
      /* rola de drill gravado do jeito antigo, como luta: a migração tem que acertar */
      contexto: tipo === 'competicao' ? 'competicao' : 'rola',
      ptsMeus: n % 2 ? [pts[n % 6]] : [], ptsDele: n % 3 ? [] : [pts[(n + 1) % 6]],
      tecMeus: n % 2 ? { [pts[n % 6]]: ['Raspagem de gancho (hip bump)'] } : {}, tecDele: {},
      vantMinhas: n % 7 === 0 ? 1 : 0, vantDele: 0,
      subsAplicadas: n % 4 === 0 ? [subs[n % 5]] : n % 11 === 0 ? [subs[0], subs[1]] : [],
      subsSofridas: n % 6 === 0 ? [subs[(n + 2) % 5]] : [],
      posDominadas: [], posSofridas: [], posInicial: n % 3 ? null : 'guarda_fechada_baixo',
      pesoRel: n % 2 ? 'pesado' : 'similar', notas: n % 9 ? '' : 'Ele trancou a guarda e não consegui passar',
    });
  }
}
for (const g of [
  { tipo: 'frequencia', alvo: 4 }, { tipo: 'defesa', alvo: 'Americana' }, { tipo: 'defesa', alvo: '' },
  { tipo: 'tecnica', alvo: 'Chave de braço (armlock)', grauAlvo: 3 }, { tipo: 'treinos', alvo: 100, ajuste: 2 },
  { tipo: 'competicao', alvo: 'Copa Teste', data: iso(-20) }, { tipo: 'volume', alvo: 50 }, { tipo: 'rolas', alvo: 30 },
  { tipo: 'aulas', alvo: 10 }, { tipo: 'quiz', alvo: 20 }, { tipo: 'manual', alvo: 10, contador: 3 },
  { tipo: 'posicao', alvo: 'guarda_fechada_baixo', quantidade: 5 },
]) await d.table('goals').add({ ...g, origem: 'usuario', status: 'ativa', inicio: iso(60), criadoEm: Date.now() });
/* pontos da liga: sem eles a tela da Liga só mostra o convite */
const local = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const segundaDe = (dia) => { const x = new Date(`${dia}T00:00:00`); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return local(x); };
for (let k = 0; k <= 40; k += 2) {
  const dia = iso(k);
  const ev = k % 4 ? { evento: 'rola', xp: 12 } : { evento: 'treino', xp: 20 };
  await d.table('pontos').add({ ...ev, refId: null, detalhe: null, data: dia, semana: segundaDe(dia), mes: dia.slice(0, 7), ano: dia.slice(0, 4), criadoEm: Date.now() - k * 864e5 });
}
await d.table('injuries').add({ data: iso(5), regiao: 'joelho', status: 'ativa', impacto: 'parado', prazo: '2s' });
console.log(`banco: ${n} rolas em ${pids.length} parceiros`);
d.close();

/* ---------- abre o app ---------- */
const erros = [];
w.addEventListener('error', (e) => erros.push('[janela] ' + e.message));
w.addEventListener('unhandledrejection', (e) => erros.push('[promessa] ' + String(e.reason?.stack || e.reason?.message || e.reason)));
console.error = (...a) => { erros.push(a.map((x) => (x && x.stack) ? x.stack : String(x)).join(' ')); };
console.warn = () => {};

const entrada = fs.readdirSync('dist/assets').find((f) => f.startsWith('index-') && f.endsWith('.js'));
await import(pathToFileURL(path.resolve('dist/assets', entrada)).href);
const esperar = (ms = 400) => new Promise((r) => setTimeout(r, ms));
await esperar(4000);

const raiz = w.document.getElementById('root');
const clicar = (el) => { if (!el) return false; el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); return true; };
const acharBotao = (txt) => [...raiz.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase().includes(txt));

/* o primeiro aparelho grava a configuração padrão: passa pelo aceite
   e pelo onboarding como uma pessoa passaria */
if (raiz.innerHTML.includes('aceite')) {
  for (const b of raiz.querySelectorAll('.aceite')) { clicar(b); await esperar(150); }
  clicar(acharBotao('aceitar e continuar')); await esperar(900);
}
if (raiz.innerHTML.includes('login-card') || raiz.innerHTML.includes('entrada-card')) {
  const i = raiz.querySelector('input');
  Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(i, 'Teste');
  i.dispatchEvent(new w.Event('input', { bubbles: true })); await esperar();
  clicar(acharBotao('continuar')); await esperar();
  clicar([...raiz.querySelectorAll('button')].find((b) => b.textContent.trim() === '3x')); await esperar(200);
  clicar(acharBotao('treinar por prazer')); await esperar(200);
  clicar(acharBotao('continuar')); await esperar();
  clicar(acharBotao('pular esta parte')); await esperar();
  clicar(acharBotao('continuar')); await esperar();
  clicar(acharBotao('começar')); await esperar(1500);
}

/* ---------- todas as telas ---------- */
const telas = ['painel', 'treinos', 'estudo', 'liga', 'amigos', 'jornada', 'dominio', 'meujogo', 'analise', 'conquistas',
  'metas', 'parceiros', 'academia', 'nutricao', 'respiracao', 'lesoes', 'ajustes', 'termos', 'privacidade'];
let falhas = 0;
for (const t of telas) {
  const antes = erros.length;
  w.history.pushState({}, '', `/?go=${t}`);
  w.dispatchEvent(new w.PopStateEvent('popstate'));
  await esperar(1500);
  const novos = erros.slice(antes);
  const telaDeErro = /Carregando esta tela/.test(raiz.textContent);
  const vazia = raiz.textContent.trim().length < 200;
  const ok = !novos.length && !telaDeErro && !vazia;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${t}${telaDeErro ? ' (tela de erro)' : ''}${vazia ? ' (vazia)' : ''}`);
  /* TELAS_HTML=<pasta> guarda o HTML de cada tela, pra tirar print */
  if (process.env.TELAS_HTML) fs.writeFileSync(path.join(process.env.TELAS_HTML, `${t}.html`), raiz.innerHTML);
  for (const e of novos.slice(0, 2)) console.log('      ', e.split('\n').slice(0, 3).join('\n       '));
}

/* os números que a tela mostra batem com os dados de cima */
const painel = () => { w.history.pushState({}, '', '/?go=painel'); w.dispatchEvent(new w.PopStateEvent('popstate')); };
painel(); await esperar(1500);
const txt = raiz.textContent;
const confere = (nome, bom) => { if (!bom) falhas++; console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}`); };
confere('painel mostra a melhor arma com dados', !/Registre uma finalização pra descobrir/.test(txt));
w.history.pushState({}, '', '/?go=metas'); w.dispatchEvent(new w.PopStateEvent('popstate')); await esperar(1500);
confere('meta de posição com nome, não código', raiz.textContent.includes('Trabalhar Guarda fechada (por baixo)'));

w.history.pushState({}, '', '/?go=meujogo'); w.dispatchEvent(new w.PopStateEvent('popstate')); await esperar(1500);
confere('drill antigo virou drill: Meu jogo conta 99 lutas, não 111', raiz.textContent.includes('seu estilo · 99 rolas'));

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
