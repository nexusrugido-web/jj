import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   A MEDIÇÃO NÃO PODE INFLAR NEM PERDER A ORIGEM

   "Mostrou" conta uma vez por dia por lugar e vídeo, senão cada
   vez que a tela desenha viraria uma exibição. A origem ida e
   volta tem que dar o mesmo lugar. E a necessidade sem vídeo tem
   que virar uma frase que dá pra gravar.
   ============================================================ */
const guardado = new Map();
globalThis.localStorage = {
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, String(v)),
  removeItem: (k) => guardado.delete(k),
};

const { medir, origem, lerOrigem } = await import('../src/lib/medir.js');
const { descreverPedido, pedidoDaRec, DIFICULDADES } = await import('../src/lib/necessidades.js');
const { aulasPara } = await import('../src/lib/motor.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};
const fila = () => JSON.parse(guardado.get('medidas:fila') || '[]');

ok('a origem vai e volta', lerOrigem(origem('estudo', 'rec', 'corrigir:Chave de braço, armlock')),
  { tela: 'estudo', tipo: 'rec', alvo: 'corrigir:Chave de braço, armlock' });
ok('origem vazia não quebra', lerOrigem(null), { tela: null, tipo: null, alvo: null });

const o = origem('estudo', 'dificuldade', 'pesado');
medir('exibiu', { origem: o, videoId: 'v1' });
medir('exibiu', { origem: o, videoId: 'v1' });
medir('exibiu', { origem: o, videoId: 'v2' });
ok('mostrar o mesmo vídeo no mesmo lugar conta uma vez', fila().filter((x) => x.evento === 'exibiu').length, 2);

medir('abriu', { origem: o, videoId: 'v1' });
medir('abriu', { origem: o, videoId: 'v1' });
ok('abrir conta toda vez', fila().filter((x) => x.evento === 'abriu').length, 2);

medir('faltou', { origem: o, detalhe: 'Contra mais pesado' });
medir('faltou', { origem: o, detalhe: 'Contra mais pesado' });
ok('faltar vídeo conta uma vez por dia', fila().filter((x) => x.evento === 'faltou').length, 1);

const ultima = fila().at(-1);
ok('a medida leva o dia e a origem aberta em partes', [typeof ultima.dia, ultima.tela, ultima.tipo, ultima.alvo], ['string', 'estudo', 'dificuldade', 'pesado']);

ok('pedido de posição vira frase', descreverPedido(pedidoDaRec({ intencao: 'corrigir', posicao: 'costas_baixo' })), 'Costas por baixo · Escapada');
ok('pedido de técnica vira frase', descreverPedido(pedidoDaRec({ intencao: 'corrigir', alvo: 'Chave de braço, armlock' })), 'Chave de braço, armlock · Defesa de finalização');
ok('pedido de dificuldade vira frase', descreverPedido(DIFICULDADES.find((d) => d.id === 'pesado').pedido), 'Contra mais pesado');

const lista = [{ id: 'c', t: 'c', d: 300, k: 'aula', tm: [], p: [], posicaoLado: [], habilidades: [], tecnicas: [], situacoes: [], formato: 'conceito', classificacao: 'automatica' }];
ok('sem vídeo do assunto, a lista vem marcada como reserva', aulasPara({ habilidades: ['passagem'] }, { lista }).every((a) => a.reserva), true);
ok('com vídeo do assunto, não é reserva', aulasPara({ formatos: ['conceito'], formatoEhAssunto: true }, { lista }).some((a) => a.reserva), false);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
