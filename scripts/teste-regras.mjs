import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   O QUE A REGRA DA IBJJF PERMITE

   Os casos da pesquisa (25/09/2026). O app avisa, nunca proíbe:
   aqui só se confere se o aviso aparece quando deve e some quando
   não deve.
   ============================================================ */
const { avaliarTecnica, grupoDaTecnica, idadeDe } = await import('../src/lib/regras.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};
const avisa = (nome, quem) => avaliarTecnica(nome, quem) != null;
const adulto = (faixa, modalidade = 'gi') => ({ faixa, idade: 25, modalidade });

/* chave de calcanhar */
ok('heel hook no Gi avisa até pra preta', avisa('Heel hook interno (chave de calcanhar)', adulto('preta')), true);
ok('heel hook no No-Gi, marrom adulto: pode', avisa('Heel hook interno (chave de calcanhar)', adulto('marrom', 'nogi')), false);
ok('heel hook no No-Gi, azul: avisa', avisa('Heel hook externo (chave de calcanhar)', adulto('azul', 'nogi')), true);
/* marrom em diante */
ok('kneebar na roxa avisa', avisa('Chave de joelho (kneebar)', adulto('roxa')), true);
ok('kneebar na marrom: pode', avisa('Chave de joelho (kneebar)', adulto('marrom')), false);
ok('toe hold na azul avisa', avisa('Toe hold (chave de dedão)', adulto('azul')), true);
ok('calf slicer na preta: pode', avisa('Compressão de panturrilha (calf slicer)', adulto('preta')), false);
/* idade */
ok('chave de punho na branca adulta avisa', avisa('Mão de vaca (chave de pulso)', adulto('branca')), true);
ok('chave de punho na azul adulta: pode', avisa('Mão de vaca (chave de pulso)', adulto('azul')), false);
ok('single leg com a cabeça por fora na branca avisa', avisa('Head outside single', adulto('branca')), true);
ok('chave de punho com 17 anos avisa', avisa('Chave de pulso (da guarda)', { faixa: 'azul', idade: 17 }), true);
ok('botinha com 15 anos avisa', avisa('Chave de pé reta (botinha)', { faixa: 'branca', idade: 15 }), true);
ok('botinha com 16 anos: pode', avisa('Chave de pé reta (botinha)', { faixa: 'branca', idade: 16 }), false);
ok('omoplata com 10 anos avisa', avisa('Omoplata', { faixa: 'branca', idade: 10 }), true);
ok('omoplata com 13 anos: pode', avisa('Omoplata', { faixa: 'branca', idade: 13 }), false);
ok('guilhotina com 9 anos avisa', avisa('Guilhotina', { faixa: 'branca', idade: 9 }), true);
ok('sem idade, as regras de idade não entram', avisa('Omoplata', { faixa: 'branca', idade: null }), false);
/* sempre */
ok('tesoura voadora avisa até pra preta', avisa('Kani basami (tesoura voadora)', adulto('preta')), true);
ok('twister avisa até pra preta', avisa('Twister', adulto('preta')), true);
/* o que não é a técnica proibida */
ok('defesa de heel hook não tem regra', grupoDaTecnica('Defesa de heel hook (rolar na direção)'), null);
ok('posição com nome parecido não tem regra', grupoDaTecnica('Twister side control'), null);
ok('mata-leão pra branca adulta: pode', avisa('Mata-leão', adulto('branca')), false);
ok('finalização escrita na mão também é reconhecida', grupoDaTecnica('heel hook da 50/50'), 'calcanhar');
ok('a idade sai do ano', idadeDe(2010, new Date('2026-09-25')), 16);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
