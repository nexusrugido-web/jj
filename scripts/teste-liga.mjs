import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   A TELA DA LIGA TEM QUE DIZER O MESMO QUE O FECHAMENTO FAZ

   Quantos sobem e quantos descem é decidido no servidor
   (supabase/liga-automatica.sql). A tela mostra antes, com as
   mesmas contas, e o nome que a pessoa vê antes de salvar é o
   mesmo que o servidor monta.
   ============================================================ */
const { corteDoGrupo, nomeCurto } = await import('../src/lib/liga.js');
const { hoje, addDias, dataLocal } = await import('../src/lib/utils.js');
const { semanaDe } = await import('../src/lib/xp.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

ok('sozinho não corre', corteDoGrupo(1), { sobem: 0, descem: 0 });
ok('dois: o primeiro sobe, ninguém desce', corteDoGrupo(2), { sobem: 1, descem: 0 });
ok('três: um sobe, um desce', corteDoGrupo(3), { sobem: 1, descem: 1 });
ok('cinco: um sobe, um desce', corteDoGrupo(5), { sobem: 1, descem: 1 });
ok('seis: dois sobem, dois descem', corteDoGrupo(6), { sobem: 2, descem: 2 });
ok('dez: o corte do painel (3)', corteDoGrupo(10), { sobem: 3, descem: 3 });
ok('o corte do painel é o teto', corteDoGrupo(30, 2), { sobem: 2, descem: 2 });

ok('nome e sobrenome', nomeCurto('ana paula souza'), 'Ana S.');
ok('um nome só', nomeCurto('BIA'), 'Bia');
ok('sem nome', nomeCurto('   '), 'Praticante');

/* o dia é o do calendário de quem usa, não o de Greenwich */
const agora = new Date();
ok('hoje é o dia local', hoje(), dataLocal(agora));
ok('somar dias não escorrega de fuso', addDias('2026-09-19', 1), '2026-09-20');
ok('virada de mês', addDias('2026-09-30', 1), '2026-10-01');
ok('a semana começa na segunda', semanaDe('2026-09-20'), '2026-09-14');
ok('segunda é o começo dela mesma', semanaDe('2026-09-14'), '2026-09-14');

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
