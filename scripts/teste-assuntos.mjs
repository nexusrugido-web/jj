import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   OS 14 ASSUNTOS, O `contra` DAS DEFESAS E O LADO DA TÉCNICA (07/11/2026)

   1. contagens aprovadas (relatório 2026-11-07-assuntos-lista-final.md);
   2. nenhuma regra lê nome (a técnica lança erro se alguém tentar);
   3. o `contra` é só o que o dono confirmou; o que não foi conferido
      fica pendente, nunca vira associação;
   4. o lado de quem passa e de quem ataca a tartaruga.
   ============================================================ */

const { CATALOGO_TECNICAS, TECNICA_POR_UID } = await import('../src/lib/tecnicas.js');
const { ASSUNTOS, tecnicasDoAssunto, assuntosDaTecnica, contraDaTecnica, grupoDaDefesa } = await import('../src/lib/assuntos.js');
const { FAMILIA_POR_ID, ehFamilia } = await import('../src/lib/familias.js');
const { DE_POSICAO_BIBLIOTECA } = await import('../src/lib/vocab.js');
const { uidEstavel, chaveNome } = await import('../src/lib/uid.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

/* a ordem das chaves não conta */
const ordenado = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

const porNome = (nome) => {
  const t = CATALOGO_TECNICAS.find((x) => x.nome === nome);
  if (!t) throw new Error(`técnica do teste não existe no catálogo: ${nome}`);
  return t;
};
const id = (nome) => porNome(nome).uid;
const doAssunto = (a) => tecnicasDoAssunto(`assunto:${a}`);
const estaEm = (nome, a) => doAssunto(a).some((t) => t.uid === id(nome));

/* ---------- 1. as contagens aprovadas ---------- */
const ESPERADO = {
  finalizacoes_braco: 38, estrangulamentos: 56, pernas: 18, guarda_fechada: 37, meia_guarda: 18, raspagens: 68, passagens: 66,
  retencao: 19, saidas: 43, controle_por_cima: 32, costas: 43, defesas: 21, troca_de_guarda: 12, jogo_em_pe: 108,
};
ok('são 14 assuntos, com os ids aprovados', ASSUNTOS.map((a) => a.id), Object.keys(ESPERADO).map((k) => `assunto:${k}`));
ok('a quantidade de técnicas de cada assunto', Object.fromEntries(ASSUNTOS.map((a) => [a.id.slice(8), tecnicasDoAssunto(a.id).length])), ESPERADO);

const qtd = CATALOGO_TECNICAS.map((t) => assuntosDaTecnica(t.uid).length);
ok('catálogo de 614; 506 em pelo menos um assunto, 108 em nenhum, 73 em dois, nenhum em três',
  [CATALOGO_TECNICAS.length, qtd.filter((n) => n >= 1).length, qtd.filter((n) => n === 0).length, qtd.filter((n) => n === 2).length, qtd.filter((n) => n >= 3).length],
  [614, 506, 108, 73, 0]);

const soltas = CATALOGO_TECNICAS.filter((t) => !assuntosDaTecnica(t.uid).length);
const porCat = {};
for (const t of soltas) porCat[t.cat] = (porCat[t.cat] || 0) + 1;
ok('as 108 sem assunto: 83 guardas e posições, 15 movimentos base, 7 pegadas de guarda aberta, 3 transições', ordenado(porCat), ordenado({ guarda: 83, base: 15, pegada: 7, transicao: 3 }));

/* os filtros de dentro */
const filtro = (a, f) => tecnicasDoAssunto(`assunto:${a}`, f).length;
ok('Raspagens: fechada 9, meia 10, aberta 47, perna 2 (somam as 68, sem repetir)', [filtro('raspagens', 'fechada'), filtro('raspagens', 'meia'), filtro('raspagens', 'aberta'), filtro('raspagens', 'perna')], [9, 10, 47, 2]);
const emPe = doAssunto('jogo_em_pe');
const filtrosEmPe = ['wrestling', 'judo', 'puxada', 'pegada'];
ok('Jogo em pé: todas as 108 caem em pelo menos um filtro',
  emPe.filter((t) => filtrosEmPe.some((f) => tecnicasDoAssunto('assunto:jogo_em_pe', f).includes(t))).length, 108);
ok('Jogo em pé: wrestling 41 e judô 58 entre as quedas, puxada 4, pegada 5',
  [emPe.filter((t) => t.cat === 'queda' && t.tags.includes('wrestling')).length, filtro('jogo_em_pe', 'judo'), filtro('jogo_em_pe', 'puxada'), filtro('jogo_em_pe', 'pegada')], [41, 58, 4, 5]);
ok('Jogo em pé: nenhuma técnica é wrestling e judô ao mesmo tempo', emPe.filter((t) => t.tags.includes('wrestling') && t.tags.includes('judo')).length, 0);
ok('Defesas: finalização 12, queda 5, raspagem 1, geral 2, alvo a confirmar 1 (somam as 21)',
  ['finalizacao', 'queda', 'raspagem', 'geral', 'pendente'].map((f) => filtro('defesas', f)), [12, 5, 1, 2, 1]);

/* ---------- 2. nenhuma regra lê nome ---------- */
const PROIBIDO = new Set(['nome', 'antigo', 'en', 'busca', 'pt']);
const cego = (t) => new Proxy(t, { get(o, k) { if (PROIBIDO.has(k)) throw new Error(`a regra leu "${String(k)}"`); return o[k]; } });
let leuNome = null;
try {
  for (const a of ASSUNTOS) {
    for (const t of CATALOGO_TECNICAS) {
      a.entra(cego(t));
      for (const f of a.filtros || []) f.entra(cego(t));
    }
  }
} catch (e) { leuNome = e.message; }
ok('nenhuma regra nem filtro lê nome, antigo, inglês ou busca (as 14 regras e os filtros, nas 614)', leuNome, null);
let defesaLeuNome = null;
try { for (const t of CATALOGO_TECNICAS.filter((x) => x.cat === 'defesa')) grupoDaDefesa(cego(t)); } catch (e) { defesaLeuNome = e.message; }
ok('o grupo da defesa também não lê nome', defesaLeuNome, null);

/* ---------- as correções de classificação (relatório, seção 5) ---------- */
ok('Controle por cima ganhou quem ataca a tartaruga e não tem as costas',
  [estaEm('Tartaruga para crucifixo', 'controle_por_cima'), estaEm('Wrist ride', 'controle_por_cima'), estaEm('Costas para montada', 'controle_por_cima'), estaEm('Pegada de cinto (seat belt)', 'controle_por_cima')], [true, true, false, false]);
ok('Costas ganhou as 9 que saem das costas (transição ou pegada)',
  [estaEm('Costas para montada', 'costas'), estaEm('Pegada de cinto (seat belt)', 'costas'), estaEm('Ganchos (hooks) nas costas', 'costas')], [true, true, true]);
ok('Braço ganhou as chaves avulsas; Twister fica em Costas e Texas cloverleaf vai para Pernas',
  [estaEm('Baratoplata', 'finalizacoes_braco'), estaEm('Mir lock', 'finalizacoes_braco'), estaEm('Twister', 'finalizacoes_braco'), estaEm('Twister', 'costas'),
    estaEm('Texas cloverleaf', 'finalizacoes_braco'), estaEm('Texas cloverleaf', 'pernas')], [true, true, false, true, false, true]);
ok('Pernas ganhou calf slicer e Banana split; estrangulamento de 50/50 não entra',
  [estaEm('Compressão de panturrilha (calf slicer)', 'pernas'), estaEm('Banana split', 'pernas')], [true, true]);
ok('Guarda fechada ganhou pegada que sai dela; a postura (defesa) não entra',
  [estaEm('Pegada de lapela e manga', 'guarda_fechada'), estaEm('Postura na guarda fechada', 'guarda_fechada')], [true, false]);
ok('Meia ganhou o underhook', estaEm('Underhook', 'meia_guarda'), true);
ok('Berimbolo está em Raspagens e em Costas (a mecânica raspa e o destino são as costas)', [estaEm('Berimbolo', 'raspagens'), estaEm('Berimbolo', 'costas')], [true, true]);
ok('Defesas: todas as 21 entram, inclusive a sem alvo', [estaEm('Postura na guarda fechada', 'defesas'), estaEm('Whizzer', 'defesas'), estaEm('Defesa de estrangulamento de lapela', 'defesas')], [true, true, true]);
ok('Trocar de guarda: a entrada no 50/50 é de Pernas, não daqui', [estaEm('Entrada no 50/50', 'troca_de_guarda'), estaEm('Entrada no 50/50', 'pernas')], [false, true]);

/* ---------- 3. o `contra`: só o confirmado ---------- */
const alvos = (...nomes) => nomes.map(id);
const CONTRA = new Map([
  ['Defesa de mata-leão (mão no queixo)', ['fam:mata_leao']],
  ['Defesa de triângulo (postura)', ['fam:triangulo']],
  ['Defesa de armlock (esconder o cotovelo)', ['fam:armlock']],
  ['Defesa de armlock (hitchhiker)', ['fam:armlock']],
  ['Defesa de guilhotina', ['fam:guilhotina']],
  ['Defesa de kimura', ['fam:kimura']],
  ['Defesa de americana', ['fam:americana']],
  ['Defesa de omoplata', ['fam:omoplata']],
  ['Defesa de katagatame', ['fam:katagatame']],
  ['Defesa de chave de pé (rolar para fora)', ['fam:pe_reta']],
  ['Defesa de heel hook (rolar na direção)', ['fam:heel_hook']],
  ['Defesa de brabo/anaconda', alvos("Brabo (D'arce)", 'Anaconda')],
  ['Defesa de baiana (crossface e sprawl)', alvos('Baiana (double leg)', 'Baiana com blast')],
  ['Defesa de single leg (limp leg)', alvos('Single leg')],
  ['Defesa de berimbolo', alvos('Berimbolo')],
]);
const PENDENTE = new Map([
  ['Defesa de single leg (limp leg)', { motivo: 'variacao_a_confirmar', candidatas: alvos('High crotch (single leg alto)', 'Single leg com running the pipe') }],
  ['Defesa de berimbolo', { motivo: 'variacao_a_confirmar', candidatas: alvos('Berimbolo invertido') }],
  ['Defesa de estrangulamento de lapela', { motivo: 'alvo_generico', candidatas: [] }],
]);
const defesas = CATALOGO_TECNICAS.filter((t) => t.cat === 'defesa');
ok('são 21 defesas: 15 com contra confirmado, 1 só pendente, 5 sem alvo',
  [defesas.length, defesas.filter((t) => t.contra.length).length, defesas.filter((t) => !t.contra.length && t.pendente).length, defesas.filter((t) => !t.contra.length && !t.pendente).length], [21, 15, 1, 5]);
ok('o contra de cada defesa é exatamente o da tabela aprovada', ordenado(Object.fromEntries(defesas.filter((t) => t.contra.length).map((t) => [t.nome, t.contra]))), ordenado(Object.fromEntries(CONTRA)));
ok('o pendente é exatamente o conferido como pendente', ordenado(Object.fromEntries(defesas.filter((t) => t.pendente).map((t) => [t.nome, t.pendente]))), ordenado(Object.fromEntries(PENDENTE)));
ok('as 5 sem alvo continuam sem contra e sem pendente (o motor segue a regra atual: sair da posição, com aviso)',
  defesas.filter((t) => !t.contra.length && !t.pendente).map((t) => t.nome).sort(),
  ['Defesa de queda (sprawl)', 'Postura na guarda fechada', 'Proteger o pescoço na tartaruga', 'Sprawl com crossface', 'Whizzer']);
ok('só defesa tem contra ou pendente', CATALOGO_TECNICAS.filter((t) => t.cat !== 'defesa' && (t.contra.length || t.pendente)).length, 0);

const todosOsContra = defesas.flatMap((t) => t.contra);
ok('todo item do contra existe: família real do app ou uid de técnica do catálogo',
  todosOsContra.every((c) => (ehFamilia(c) ? FAMILIA_POR_ID.has(c) : TECNICA_POR_UID.has(c))), true);
ok('toda família do contra tem técnica no catálogo', [...new Set(todosOsContra.filter(ehFamilia))].every((f) => CATALOGO_TECNICAS.some((t) => t.fam === f)), true);
ok('o uid do contra é o uid permanente (o mesmo que o catálogo usa), não um número solto',
  todosOsContra.filter((c) => !ehFamilia(c)).every((c) => TECNICA_POR_UID.get(c).uid === c), true);
ok('nenhuma variação não conferida entrou no contra (High crotch, running the pipe, Berimbolo invertido)',
  alvos('High crotch (single leg alto)', 'Single leg com running the pipe', 'Berimbolo invertido').filter((u) => todosOsContra.includes(u)), []);
ok('os candidatos pendentes existem, são técnicas e não estão no contra da própria defesa',
  defesas.filter((t) => t.pendente).every((t) => t.pendente.candidatas.every((u) => TECNICA_POR_UID.has(u) && !t.contra.includes(u))), true);
ok('contraDaTecnica devolve confirmado e pendente separados',
  [contraDaTecnica(id('Defesa de berimbolo')).contra, contraDaTecnica(id('Defesa de berimbolo')).pendente.candidatas, contraDaTecnica(id('Whizzer'))],
  [alvos('Berimbolo'), alvos('Berimbolo invertido'), { contra: [], pendente: null }]);
ok('a defesa de lapela não ganha família (a Cruzada é lapela, mas o catálogo tem 15 estrangulamentos de lapela)',
  [porNome('Defesa de estrangulamento de lapela').contra, grupoDaDefesa(porNome('Defesa de estrangulamento de lapela'))], [[], 'pendente']);
ok('o uid do catálogo continua o mesmo de antes (seed não mudou de identidade)',
  porNome('Single leg').uid, uidEstavel(chaveNome('techniques', 'Solo (single leg)')));

/* ---------- 4. o lado de quem faz a técnica ---------- */
const passagens = CATALOGO_TECNICAS.filter((t) => t.cat === 'passagem');
ok('nenhuma passagem fica "por baixo": quem passa está por cima', passagens.filter((t) => t.de && t.de.endsWith(':baixo')).length, 0);
ok('as 51 passagens da guarda aberta agora saem de guarda_aberta:cima', passagens.filter((t) => t.from === 'guarda_aberta').every((t) => t.de === 'guarda_aberta:cima') && passagens.filter((t) => t.from === 'guarda_aberta').length, 51);
const daTartaruga = CATALOGO_TECNICAS.filter((t) => t.from === 'tartaruga');
const cima = daTartaruga.filter((t) => t.de === 'tartaruga:cima');
ok('quem ataca a tartaruga (finalização, transição, pegada) está por cima: 16', [cima.length, cima.every((t) => ['estrangulamento', 'articular', 'perna', 'compressao', 'transicao', 'pegada'].includes(t.cat))], [16, true]);
ok('escapada, defesa, queda, base e posição da tartaruga continuam por baixo',
  daTartaruga.filter((t) => t.de === 'tartaruga:baixo').every((t) => ['escapada', 'defesa', 'queda', 'base', 'guarda'].includes(t.cat)), true);
ok('o resto do catálogo não mudou de lado (só passagem e ataque à tartaruga)',
  CATALOGO_TECNICAS.filter((t) => t.cat !== 'passagem' && t.from !== 'tartaruga').every((t) => t.de === (DE_POSICAO_BIBLIOTECA[t.from] || null)), true);
ok('passagem que já saía de uma posição de cima ou neutra não muda', passagens.filter((t) => t.from !== 'guarda_aberta').every((t) => t.de === (DE_POSICAO_BIBLIOTECA[t.from] || null)), true);
ok('a posição (sem o lado) de cada técnica é a mesma de antes', CATALOGO_TECNICAS.every((t) => t.posicao === ((DE_POSICAO_BIBLIOTECA[t.from] || '').split(':')[0] || null)), true);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
