import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   CADA ROLA CONTADO UMA VEZ, NO LUGAR CERTO

   Os gráficos de "como você venceu", "como você perdeu" e "ganhou e
   perdeu", os totais do topo e o resumo do app contam os mesmos
   rolas por caminhos diferentes. Aqui eles têm que bater: nenhum
   rola some, nenhum conta duas vezes, drill não entra, e a vitória
   por finalização, por pontos e por vantagem cai no balde certo.
   ============================================================ */
const { placarDaRola } = await import('../src/lib/game.js');
const { serieDoPeriodo, totaisComparados, periodoDeDados } = await import('../src/lib/periodo.js');
const { resumo } = await import('../src/lib/stats.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

/* ---------- casos que a regra do tatame decide ---------- */
const cada = [
  [{ subsAplicadas: ['Armlock'] }, 'finalizei'],
  [{ subsSofridas: ['Mata-leão'] }, 'fui_finalizado'],
  [{ ptsMeus: ['passagem'], ptsDele: ['raspagem'] }, 'venci_pontos'],
  [{ ptsMeus: ['raspagem'], ptsDele: ['montada'] }, 'perdi_pontos'],
  [{ ptsMeus: ['raspagem'], ptsDele: ['queda'], vantMinhas: 2, vantDele: 1 }, 'venci_vantagem'],
  [{ vantDele: 1 }, 'perdi_vantagem'],
  [{ subsAplicadas: ['a'], ptsDele: ['montada', 'costas'] }, 'finalizei'],
  [{ ptsMeus: ['montada'], vantDele: 5 }, 'venci_pontos'],
  [{}, 'empate'],
];
for (const [r, esp] of cada) ok(`${JSON.stringify(r)} é ${esp}`, placarDaRola(r).resultado, esp);

/* ---------- um mês de treino inventado, com drill no meio ---------- */
const hoje = new Date();
const iso = (d) => new Date(hoje.getTime() - d * 864e5).toISOString().slice(0, 10);
const sessions = [];
const rolls = [];
let semente = 7;
const sorte = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
const P = ['queda', 'raspagem', 'passagem', 'montada', 'costas', 'joelho'];
for (let d = 1; d < 28; d += 2) {
  sessions.push({ id: d, data: iso(d), duracao: 60 });
  for (let k = 0; k < 4; k++) {
    const pega = (n) => Array.from({ length: Math.floor(sorte() * n) }, () => P[Math.floor(sorte() * P.length)]);
    rolls.push({
      sessionId: d, partnerId: null,
      contexto: k === 3 && d % 5 === 0 ? 'drill' : 'rola',
      subsAplicadas: sorte() < 0.2 ? ['Armlock'] : [],
      subsSofridas: sorte() < 0.15 ? ['Americana'] : [],
      ptsMeus: pega(3), ptsDele: pega(3),
      vantMinhas: sorte() < 0.3 ? 1 : 0, vantDele: sorte() < 0.3 ? 1 : 0,
    });
  }
}
const lutas = rolls.filter((r) => r.contexto !== 'drill');
const conta = (res) => lutas.filter((r) => placarDaRola(r).resultado === res).length;

const periodo = periodoDeDados('ultimos-30');
const { serie } = serieDoPeriodo(sessions, rolls, [], periodo);
const soma = (k) => serie.reduce((a, s) => a + (s[k] || 0), 0);
const tot = totaisComparados(sessions, rolls, [], periodo).atual;
const res = resumo(sessions, rolls);

ok('drill fica de fora', soma('rolas'), lutas.length);
ok('vitórias por finalização batem com a regra', soma('porFinalizacao'), conta('finalizei'));
ok('vitórias no placar = pontos + vantagem', soma('porPlacar'), conta('venci_pontos') + conta('venci_vantagem'));
ok('derrotas por finalização batem com a regra', soma('fuiFinalizado'), conta('fui_finalizado'));
ok('derrotas no placar = pontos + vantagem', soma('perdiPlacar'), conta('perdi_pontos') + conta('perdi_vantagem'));
ok('como você venceu soma o total de vitórias', soma('porFinalizacao') + soma('porPlacar'), soma('vitorias'));
ok('como você perdeu soma o total de derrotas', soma('fuiFinalizado') + soma('perdiPlacar'), soma('derrotas'));
ok('nenhum rola some: vitórias + derrotas + empates = rolas', soma('vitorias') + soma('derrotas') + soma('empates'), lutas.length);
ok('o gráfico bate com os totais do topo', [soma('vitorias'), soma('derrotas')], [tot.vitorias, tot.derrotas]);
ok('o gráfico bate com o resumo do app', [soma('vitorias'), soma('derrotas')], [res.vitorias, res.derrotas]);
ok('tem de tudo no teste (senão ele não prova nada)',
  ['finalizei', 'fui_finalizado', 'venci_pontos', 'perdi_pontos', 'venci_vantagem', 'perdi_vantagem'].every((x) => conta(x) > 0), true);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
