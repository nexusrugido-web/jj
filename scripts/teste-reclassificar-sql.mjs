import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';

/* ============================================================
   RECLASSIFICAÇÃO DAS AULAS NO BANCO (Trilha R, E2: SQL 65 a 68)

   Roda os SQL num Postgres de verdade (PGlite), com uma tabela
   aula de mentira: confere quem vai pra fila, que a cópia não é
   sobrescrita, o resumo e o detalhe depois da esteira, e que o
   68 devolve tudo como estava sem tocar na aula conferida à mão.
   ============================================================ */

let falhas = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ok  ${msg}`); else { falhas++; console.log(`  XX  ${msg}`); } };
const ler = (f) => fs.readFile(new URL(`../supabase/${f}`, import.meta.url), 'utf8');

const pg = new PGlite();
await pg.exec(`
  create table public.aula (
    id text primary key, titulo text not null, ativo boolean not null default true,
    temas text[] not null default '{}', posicoes text[] not null default '{}', revisar boolean not null default false,
    posicao_lado text[] not null default '{}', habilidades text[] not null default '{}', tecnicas text[] not null default '{}',
    formato text, nivel text, situacoes text[] not null default '{}',
    classificacao text not null default 'legado', classificado_em timestamptz, classificacao_motivo text,
    premium boolean not null default false
  );
  insert into public.aula (id, titulo, tecnicas, classificacao, temas, ativo) values
    ('semtec1',     'Pressão na passagem',              '{}',      'automatica', '{passagem}', true),
    ('semtec2',     'Quem faz jiu precisa de musculação', '{}',    'revisar',    '{fisico}',   true),
    ('84GMpycm-nQ', 'Raspagem simples',                 '{u-berimbolo}', 'automatica', '{raspagem}', true),
    ('9yfsu67OQhw', 'arm lock / triângulo / omoplata',  '{u-tri,u-omo}', 'automatica', '{finalizacao}', true),
    ('chpe',        'Chave de pé ou triângulo?',        '{u-tri}', 'automatica', '{finalizacao}', true),
    ('certa',       'Omoplata da guarda fechada',       '{u-omo}', 'automatica', '{finalizacao}', true),
    ('maoh',        'Kimura conferida à mão',           '{}',      'revisada',   '{finalizacao}', true),
    ('inativa',     'Aula apagada',                     '{}',      'automatica', '{geral}',    false);
`);

/* ---- 65: cópia e fila ---- */
const s65 = await ler('65-reclassificar-com-a-esteira-nova.sql');
await pg.exec(s65);
const fila = (await pg.query("select id, classificacao, classificacao_motivo from public.aula order by id")).rows;
const de = (id) => fila.find((r) => r.id === id);
ok(['semtec1', 'semtec2', '84GMpycm-nQ', '9yfsu67OQhw', 'chpe'].every((id) => de(id).classificacao === 'legado'), 'sem técnica, do relatório e a incompleta pelo título vão pra fila');
ok(de('certa').classificacao === 'automatica', 'aula com técnica certa fica como está');
ok(de('maoh').classificacao === 'revisada', 'aula conferida à mão não entra na fila');
ok(de('inativa').classificacao === 'automatica', 'aula inativa não entra na fila');
ok(de('84GMpycm-nQ').classificacao_motivo.endsWith('técnica errada'), 'o motivo fica escrito na aula');
const copia = (await pg.query('select id, alvo, motivo from copias.reclassificar_aulas order by id')).rows;
ok(copia.length === 7 && !copia.some((r) => r.id === 'inativa'), 'a cópia leva as 7 ativas, com e sem fila');
ok(copia.find((r) => r.id === 'chpe').motivo === 'incompleta', 'a incompleta pelo título leva o motivo certo');

/* rodar de novo não sobrescreve a cópia nem mexe na aula */
await pg.query("update public.aula set classificacao = 'automatica', tecnicas = '{u-x}' where id = 'semtec1'");
let falhou = false;
try { await pg.exec(s65); } catch { falhou = true; await pg.exec('rollback'); }
ok(falhou, 'o 65 rodado de novo falha');
ok((await pg.query("select classificacao from public.aula where id = 'semtec1'")).rows[0].classificacao === 'automatica', 'e não põe nada na fila de novo');
ok((await pg.query("select dados->>'classificacao' c from copias.reclassificar_aulas where id = 'semtec1'")).rows[0].c === 'automatica', 'a cópia continua a de antes');

/* ---- a esteira passa ---- */
await pg.exec(`
  update public.aula set classificacao = 'automatica', tecnicas = '{}' where id = 'semtec2';
  update public.aula set classificacao = 'revisar', tecnicas = '{}' where id = '84GMpycm-nQ';
  update public.aula set classificacao = 'automatica', tecnicas = '{u-arm,u-tri,u-omo}' where id = '9yfsu67OQhw';
  update public.aula set classificacao = 'revisada', tecnicas = '{u-chpe}' where id = 'maoh';
`);
// 'chpe' fica na fila

/* ---- 66 e 67 ---- */
const resumo = Object.fromEntries((await pg.query(await ler('66-conferir-reclassificacao-resumo.sql'))).rows.map((r) => [r.situacao, Number(r.aulas)]));
ok(resumo['1 ainda na fila'] === 1, 'resumo: 1 ainda na fila');
ok(resumo['2 sem técnica, ganhou técnica'] === 1, 'resumo: 1 sem técnica ganhou técnica');
ok(resumo['3 sem técnica, continua sem'] === 1, 'resumo: 1 continua sem');
ok(resumo['4 do relatório, técnica mudou'] === 1, 'resumo: 1 do relatório mudou');
ok(resumo['6 do relatório, ficou sem técnica'] === 1, 'resumo: 1 do relatório ficou sem');
ok(resumo['9 fora da fila, mudou'] === 1, 'resumo: a revisada à mão aparece como fora da fila que mudou');
ok(resumo['8 fora da fila, igual'] === 1, 'resumo: a certa fica igual');
const detalhe = (await pg.query(await ler('67-conferir-reclassificacao-aulas.sql'))).rows;
ok(detalhe.length === 4 && detalhe.at(-1).id === 'semtec1', 'detalhe: as 3 do relatório e, por último, a que ganhou técnica');
ok(detalhe.find((r) => r.id === '9yfsu67OQhw').antes.includes('(uid fora do catálogo)'), 'detalhe: uid que não é do catálogo aparece como tal');
ok(detalhe.find((r) => r.id === '84GMpycm-nQ').depois === '—', 'detalhe: sem técnica aparece como —');

/* nome do catálogo de verdade */
const linhaNome = /\('([0-9a-f-]{36})', '([^']+)'\)/.exec(await ler('66-conferir-reclassificacao-resumo.sql'));
await pg.query('update public.aula set tecnicas = $1 where id = $2', [[linhaNome[1]], 'semtec1']);
const comNome = (await pg.query(await ler('67-conferir-reclassificacao-aulas.sql'))).rows.find((r) => r.id === 'semtec1');
ok(comNome.depois === linhaNome[2], `detalhe: o uid vira o nome (${linhaNome[2]})`);

/* ---- 68: restaurar ---- */
await pg.exec((await ler('68-restaurar-aulas-antes-da-reclassificacao.sql')).split('commit;')[0] + 'commit;');
const depois = Object.fromEntries((await pg.query('select id, classificacao, tecnicas from public.aula')).rows.map((r) => [r.id, r]));
ok(depois['84GMpycm-nQ'].classificacao === 'automatica' && depois['84GMpycm-nQ'].tecnicas[0] === 'u-berimbolo', '68: a errada volta como estava');
ok(depois.chpe.classificacao === 'automatica', '68: a que estava na fila volta');
ok(depois.semtec1.tecnicas.length === 0, '68: a que ganhou técnica volta sem');
ok(depois.maoh.classificacao === 'revisada' && depois.maoh.tecnicas[0] === 'u-chpe', '68: a conferida à mão depois do 65 não é tocada');
const conferir = (await ler('68-restaurar-aulas-antes-da-reclassificacao.sql')).split('commit;')[1];
ok(Number((await pg.query(conferir)).rows[0].diferentes) === 0, '68: a conferência final dá zero');

console.log(falhas ? `\n${falhas} falha(s)` : '\nreclassificação no banco: tudo certo');
process.exit(falhas ? 1 : 0);
