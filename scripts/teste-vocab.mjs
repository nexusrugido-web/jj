import { register } from 'node:module';
import { readFileSync } from 'node:fs';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   TODO NOME ANTIGO TEM QUE CAIR NUM ID QUE EXISTE

   O vocabulário só vale se nenhuma parte do app ficar de fora.
   Aqui cada lista antiga (a posição do rola, a da biblioteca, a
   do cadastro de vídeo, os temas e as categorias de técnica) é
   passada inteira pelos mapas. Se alguém criar uma posição nova
   no rola e esquecer do mapa, este teste para o deploy.
   ============================================================ */

const V = await import('../src/lib/vocab.js');
const { SEED } = await import('../src/db/seed.js');
const { POSICOES_INICIAIS } = await import('../src/db/scoring.js');
const { REGRAS_POSICAO } = await import('../src/lib/categorizar.js');
const { TEMAS_AULA } = await import('../src/db/aulas.js');
const { NOME_POSICAO_SOFRIDA } = await import('../src/lib/graus.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

const validas = new Set(V.POSICOES_LADO);
const posicoes = new Set(V.idsDe(V.POSICOES));
const habilidades = new Set(V.idsDe(V.HABILIDADES));
const semMapa = (ids, mapa) => ids.filter((id) => !(id in mapa));
const foraDoVocab = (mapa) => Object.entries(mapa).filter(([, v]) => v !== null && !validas.has(v)).map(([k]) => k);

/* ---------- toda posição antiga tem destino ---------- */
ok('posição inicial do rola: nenhuma sem mapa', semMapa(POSICOES_INICIAIS.map((p) => p.id), V.DE_POSICAO_INICIAL), []);
ok('posição inicial do rola: todas caem num id válido', foraDoVocab(V.DE_POSICAO_INICIAL), []);
ok('posição inicial: o lado bate com o que o rola diz',
  POSICOES_INICIAIS.filter((p) => V.separar(V.DE_POSICAO_INICIAL[p.id]).lado !== p.lado).map((p) => p.id), []);

ok('biblioteca: nenhuma posição sem mapa', semMapa(SEED.positions.map((p) => p.slug), V.DE_POSICAO_BIBLIOTECA), []);
ok('biblioteca: todas caem num id válido', foraDoVocab(V.DE_POSICAO_BIBLIOTECA), []);
ok('biblioteca: posição "inferior" é sempre por baixo',
  SEED.positions.filter((p) => p.familia === 'inferior' && V.DE_POSICAO_BIBLIOTECA[p.slug])
    .filter((p) => V.separar(V.DE_POSICAO_BIBLIOTECA[p.slug]).lado !== 'baixo').map((p) => p.slug), []);
ok('biblioteca: posição "dominante" é sempre por cima',
  SEED.positions.filter((p) => p.familia === 'dominante' && V.DE_POSICAO_BIBLIOTECA[p.slug])
    .filter((p) => V.separar(V.DE_POSICAO_BIBLIOTECA[p.slug]).lado !== 'cima').map((p) => p.slug), []);

ok('cadastro de vídeo: nenhuma posição sem mapa', semMapa(Object.keys(REGRAS_POSICAO), V.DE_POSICAO_VIDEO), []);
ok('cadastro de vídeo: todas caem numa posição que existe',
  Object.values(V.DE_POSICAO_VIDEO).filter((p) => !posicoes.has(p)), []);

ok('posição sofrida: todas as que a leitura do jogo nomeia têm destino', semMapa(Object.keys(NOME_POSICAO_SOFRIDA), V.DE_POSICAO_SOFRIDA), []);
ok('posição sofrida: sempre por baixo',
  Object.values(V.DE_POSICAO_SOFRIDA).filter((v) => V.separar(v).lado !== 'baixo'), []);

/* ---------- toda categoria de técnica é habilidade ---------- */
ok('toda categoria da biblioteca é habilidade', SEED.categories.map((c) => c.slug).filter((s) => !habilidades.has(s)), []);
ok('toda técnica da biblioteca tem habilidade', [...new Set(SEED.techniques.map((t) => t.cat))].filter((c) => !habilidades.has(c)), []);

/* ---------- todo tema antigo tem destino ---------- */
ok('tema antigo: nenhum sem mapa', semMapa(TEMAS_AULA.map((t) => t.id), V.DE_TEMA), []);
ok('tema antigo: só vira habilidade que existe',
  Object.values(V.DE_TEMA).flatMap((m) => m.habilidades || []).filter((h) => !habilidades.has(h)), []);
ok('tema antigo: só vira formato que existe',
  Object.values(V.DE_TEMA).map((m) => m.formato).filter((f) => f && !V.idsDe(V.FORMATOS).includes(f)), []);

/* ---------- a conversão de um vídeo antigo ---------- */
ok('vídeo de defesa no 100kg', V.doLegado({ temas: ['defesa'], posicoes: ['cem_quilos'], faixa: 'branca' }),
  { posicaoLado: ['cem:neutro'], habilidades: ['escapada', 'defesa'], formato: null, nivel: 'fundamento' });
ok('conceito ganha de drill', V.doLegado({ temas: ['drill', 'logica'] }).formato, 'conceito');
ok('"competicao" e "geral" não viram nada', V.doLegado({ temas: ['competicao', 'geral'] }).habilidades, []);
ok('posição desconhecida é ignorada, não inventada', V.doLegado({ posicoes: ['xyz'] }).posicaoLado, []);
ok('vídeo sem nada', V.doLegado({}), { posicaoLado: [], habilidades: [], formato: null, nivel: null });

/* ---------- e de volta pros temas que o Estudo ainda usa ---------- */
const temasUsados = TEMAS_AULA.map((t) => t.id).filter((t) => !['competicao', 'geral'].includes(t));
ok('todo tema antigo sobrevive à ida e volta',
  temasUsados.filter((t) => !V.paraLegado(V.doLegado({ temas: [t] })).temas.includes(t)), []);
ok('toda habilidade tem tema', V.idsDe(V.HABILIDADES).filter((h) => !V.paraLegado({ habilidades: [h] }).temas.length), []);
ok('volta só pra tema que existe',
  [...V.idsDe(V.HABILIDADES).flatMap((h) => V.paraLegado({ habilidades: [h] }).temas),
    ...V.idsDe(V.FORMATOS).flatMap((f) => V.paraLegado({ formato: f }).temas)]
    .filter((t) => !TEMAS_AULA.some((x) => x.id === t)), []);
ok('posição volta pro nome antigo, sem o lado', V.paraLegado({ posicaoLado: ['cem:baixo', 'cem:cima', 'montada:cima'] }).posicoes, ['cem_quilos', 'montada']);
ok('quem vai competir acha o tema de competição', V.paraLegado({ situacoes: ['competir', 'sem_gas'] }).temas, ['competicao']);
ok('posição que o cadastro antigo não tinha não inventa nome', V.paraLegado({ posicaoLado: ['tartaruga:baixo'] }).posicoes, []);

/* ---------- o banco aceita exatamente o mesmo vocabulário ---------- */
const sql = readFileSync(new URL('../supabase/estudo.sql', import.meta.url), 'utf8');
const listaDoSql = (nome) => {
  const m = sql.match(new RegExp(`constraint ${nome}[\\s\\S]*?array\\[([^\\]]*)\\]`));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort() : null;
};
ok('posição e lado no banco = no app', listaDoSql('aula_posicao_lado_valida'), [...V.POSICOES_LADO].sort());
ok('habilidades no banco = no app', listaDoSql('aula_habilidades_validas'), V.idsDe(V.HABILIDADES).sort());
ok('formatos no banco = no app', listaDoSql('aula_formato_valido'), V.idsDe(V.FORMATOS).sort());
ok('níveis no banco = no app', listaDoSql('aula_nivel_valido'), V.idsDe(V.NIVEIS).sort());
ok('classificações no banco = no app', listaDoSql('aula_classificacao_valida'), V.idsDe(V.CLASSIFICACOES).sort());
ok('situações no banco = no app', listaDoSql('aula_situacoes_validas'), V.idsDe(V.SITUACOES).sort());

/* ---------- as pequenas ferramentas ---------- */
ok('juntar e separar voltam ao mesmo lugar', V.separar(V.juntar('cem', 'baixo')), { posicao: 'cem', lado: 'baixo' });
ok('sem lado é neutro', V.separar('montada'), { posicao: 'montada', lado: 'neutro' });
ok('nome com lado', V.nomePosicaoLado('cem:baixo'), '100kg por baixo');
ok('nome sem lado', V.nomePosicaoLado('perna:neutro'), 'Jogo de perna');
ok('finalização acha as três', V.familiaDaHabilidade('finalizacao'), ['finalizacao', 'estrangulamento', 'articular', 'perna']);
ok('estrangulamento acha finalização', V.familiaDaHabilidade('estrangulamento'), ['estrangulamento', 'finalizacao']);
ok('habilidade solta é ela mesma', V.familiaDaHabilidade('queda'), ['queda']);
ok('33 combinações de posição e lado', V.POSICOES_LADO.length, 33);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
