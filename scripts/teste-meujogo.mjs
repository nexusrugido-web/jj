import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   MEU JOGO: O ESTILO SE CONFERE NA TELA

   O estilo é o que aparece em mais rolas, e a tela mostra "em X
   dos N rolas" pra cada forma de pontuar. Se o app chama alguém
   de quedador, a queda tem que ser a linha mais alta da lista.
   ============================================================ */
const { analisarJogo, porqueDoEstilo, oQueMaisCede, compararEstilo } = await import('../src/lib/game.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperado ${JSON.stringify(esperado)}`}`);
};

/* n rolas, cada um com o que for passado */
const rolas = (n, r) => Array.from({ length: n }, () => ({ v2: true, ptsMeus: [], ptsDele: [], subsAplicadas: [], subsSofridas: [], ...r }));
const jogo = (lista) => analisarJogo(lista, [], []);

/* ---- o caso da tela do usuário: queda e finalização quase empatadas ---- */
const misto = jogo([
  ...rolas(8, { ptsMeus: ['queda'], subsAplicadas: ['Armlock'] }),
  ...rolas(1, { ptsMeus: ['queda'] }),
  ...rolas(1, { subsAplicadas: ['Triângulo'] }),
  ...rolas(8, { ptsDele: ['raspagem'] }),
]);
ok('queda em 9 e finalização em 9 dos 18: jogo completo', misto.estilo.id, 'completo');
ok('o porquê cita os dois números da lista', porqueDoEstilo(misto.estilo, 18), 'Você derrubou em 9 e finalizou em 9 dos 18 rolas. Nenhuma se destaca: você pontua de vários jeitos.');
ok('lance conta rola, não evento', misto.lances.find((l) => l.id === 'queda').meus, 9);
ok('finalização mais usada com o nome', misto.lances.find((l) => l.id === 'finalizacao').tecMeu, { nome: 'Armlock', vezes: 8 });
ok('o que mais cede é raspagem', oQueMaisCede(misto).id, 'raspagem');

/* ---- quem mais aparece é o estilo, sem alvo inventado ---- */
const passa = jogo([
  ...rolas(11, { ptsMeus: ['passagem'] }),
  ...rolas(5, { ptsMeus: ['queda'] }),
]);
ok('passagem em 11, queda em 5: passador', passa.estilo.id, 'passador');
ok('o porquê do passador', porqueDoEstilo(passa.estilo, 16), 'Você passou a guarda em 11 dos 16 rolas, mais do que qualquer outra forma de pontuar.');

const quedas = jogo([
  ...rolas(12, { ptsMeus: ['queda', 'queda'] }),
  ...rolas(4, { ptsMeus: ['passagem', 'passagem', 'passagem'] }),
]);
ok('três passagens no mesmo rola não ganham de queda em 12 rolas', quedas.estilo.id, 'quedador');

/* ---- passagem e controle são o mesmo jogo ---- */
const porCima = jogo([
  ...rolas(10, { ptsMeus: ['passagem', 'montada'] }),
  ...rolas(5, { ptsMeus: ['costas'] }),
]);
ok('controle em 15, passagem em 10: controlador, não completo', porCima.estilo.id, 'controlador');

/* ---- pouco ponto ---- */
const muro = jogo(rolas(15, {}));
ok('ninguém pontua e ninguém passa: sobrevivente', muro.estilo.id, 'defensor');
const apanha = jogo(rolas(15, { ptsDele: ['passagem'] }));
ok('ninguém pontua mas passam sempre: completo sem pico', [apanha.estilo.id, !!apanha.estilo.pouco], ['completo', true]);

/* ---- antes de 15 não tem estilo, mas a lista já conta ---- */
const cedo = jogo(rolas(5, { ptsMeus: ['raspagem'] }));
ok('5 rolas: sem estilo', cedo.estilo, null);
ok('5 rolas: a lista já mostra', cedo.lances.find((l) => l.id === 'raspagem').meus, 5);

/* ---- drill não entra ---- */
ok('drill fica de fora', jogo([...rolas(3, {}), ...rolas(2, { contexto: 'drill' })]).rolas, 3);

/* ---- o teste do onboarding contra a realidade ---- */
ok('teste bate', compararEstilo('passador', passa).bate, true);
ok('teste não bate, sem bronca', compararEstilo('guardeiro', passa).titulo, 'Diferente do seu teste');
ok('jogo completo não vira "o que mais aparece é Jogo Completo"', /mais aparece/.test(compararEstilo('guardeiro', misto).texto), false);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
