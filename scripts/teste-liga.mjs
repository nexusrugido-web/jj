import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   A TELA DA LIGA TEM QUE DIZER O MESMO QUE O FECHAMENTO FAZ

   Quantos sobem e quantos descem é decidido no servidor
   (supabase/liga-automatica.sql). A tela mostra antes, com as
   mesmas contas, e o nome que a pessoa vê antes de salvar é o
   mesmo que o servidor monta.
   ============================================================ */
const { corteDoGrupo, nomeCurto, relogioDaLiga, faltaTexto, resultadoEmPalavras, praDivisao, naDivisao, progressoPraSubir, beneficiosDa, escudosDaDivisao } = await import('../src/lib/liga.js');
const { hoje, addDias, dataLocal } = await import('../src/lib/utils.js');
const { semanaDe } = await import('../src/lib/xp.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

ok('sozinho não corre', corteDoGrupo(1), { sobem: 0, descem: 0 });
ok('dois: ninguém sobe nem desce (só vale com 3 ou mais)', corteDoGrupo(2), { sobem: 0, descem: 0 });
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

/* ---------- o relógio da semana (Brasília) ---------- */
const quarta = relogioDaLiga(new Date('2026-09-23T13:00:00Z')); // quarta 10h em Brasília
ok('quarta: fecha na segunda seguinte ao meio-dia de Brasília (15h UTC)', [quarta.fecha.toISOString(), quarta.apurando], ['2026-09-28T15:00:00.000Z', false]);
const domingoTarde = relogioDaLiga(new Date('2026-09-28T01:30:00Z')); // domingo 22h30 em Brasília
ok('domingo à noite ainda é a mesma semana', [domingoTarde.fecha.toISOString(), domingoTarde.diaDaSemana], ['2026-09-28T15:00:00.000Z', 6]);
const segundaCedo = relogioDaLiga(new Date('2026-09-28T11:00:00Z')); // segunda 8h em Brasília
ok('segunda de manhã: apurando, resultado ao meio-dia, e a semana nova fecha na outra segunda',
  [segundaCedo.apurando, segundaCedo.resultadoDaPassada?.toISOString(), segundaCedo.fecha.toISOString()],
  [true, '2026-09-28T15:00:00.000Z', '2026-10-05T15:00:00.000Z']);
ok('segunda depois do meio-dia não está mais apurando', relogioDaLiga(new Date('2026-09-28T16:00:00Z')).apurando, false);
ok('quanto falta, em palavras', [faltaTexto(2 * 864e5 + 5 * 36e5), faltaTexto(5 * 36e5 + 20 * 6e4), faltaTexto(12 * 6e4), faltaTexto(3e4)], ['2d 5h', '5h 20min', '12min', 'menos de 1min']);

/* ---------- o resultado em palavras ---------- */
ok('a divisão com o artigo certo', [praDivisao('branca'), praDivisao('roxa'), naDivisao('branca'), naDivisao('azul')], ['pra Academia', 'pro Nacional', 'na Academia', 'no Estadual']);
const base = { fechada: true, posicao: 1, total: 4, xp: 250, divisao_antes: 'azul' };
ok('subiu', resultadoEmPalavras({ ...base, resultado: 'subiu', divisao_depois: 'roxa' }).titulo, 'Você subiu pro Nacional');
ok('desceu pra Academia', resultadoEmPalavras({ ...base, posicao: 4, resultado: 'desceu', divisao_depois: 'branca' }).titulo, 'Você desceu pra Academia');
ok('ficou', resultadoEmPalavras({ ...base, posicao: 2, resultado: 'ficou', divisao_depois: 'azul' }).titulo, 'Você continua no Estadual');
ok('sozinho não correu', resultadoEmPalavras({ ...base, total: 1, resultado: 'sozinho', divisao_depois: 'azul' }).titulo, 'Ninguém correu com você');
ok('semana ainda aberta: apurando, com a posição parcial', resultadoEmPalavras({ ...base, fechada: false, posicao: 3, xp: 90 }).texto.startsWith('Você está em 3º de 4, com 90 pontos.'), true);
ok('1º sem o mínimo: a tela explica quanto faltou', resultadoEmPalavras({ ...base, resultado: 'ficou', xp: 100, divisao_antes: 'azul', divisao_depois: 'azul' }).texto,
  'Terminou em 1º, com 100 pontos, mas pra subir pro Nacional precisava de 120. Faltaram 20.');
ok('grupo de 2: explica que não vale subida', resultadoEmPalavras({ ...base, total: 2, resultado: 'poucos', divisao_depois: 'azul' }).titulo, 'Grupo de 2 não vale subida');
ok('semana fechada antes do resultado ser guardado: só o lugar', resultadoEmPalavras({ ...base, resultado: null, posicao: 2 }).titulo, 'Você terminou em 2º');

/* ---------- quanto falta pra subir, e o que cada divisão dá ---------- */
const p1 = progressoPraSubir({ divisao: 'azul', xp: 90, posicao: 1, total: 4 });
ok('Estadual com 90 de 120: falta 30, 75%, em 1º num grupo que vale', [p1.proxima, p1.minimo, p1.falta, p1.pct, p1.grupoOk, p1.lugarOk, p1.pontosOk], ['roxa', 120, 30, 75, true, true, false]);
const p2 = progressoPraSubir({ divisao: 'branca', xp: 100, posicao: 2, total: 2 });
ok('Academia com 100: pontos ok, mas em 2º e grupo de 2', [p2.pontosOk, p2.lugarOk, p2.grupoOk, p2.pct], [true, false, false, 100]);
ok('no Mundial não tem pra onde subir', progressoPraSubir({ divisao: 'preta', xp: 500 }).topo, true);
ok('escudos: 2 até o Estadual, 3 do Nacional pra cima', ['branca', 'azul', 'roxa', 'preta', undefined].map(escudosDaDivisao), [2, 2, 3, 3, 2]);
ok('Nacional: moldura, selo e o escudo extra', beneficiosDa('roxa'), ['Moldura verde na sua foto, na liga e no perfil', 'Selo "Divisão Nacional" na figurinha do story', 'Ofensiva com 3 escudos em vez de 2']);
ok('Mundial tem a coroa', beneficiosDa('preta').some((b) => b.includes('coroa')), true);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
