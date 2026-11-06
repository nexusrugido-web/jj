import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

import 'fake-indexeddb/auto';

/* ============================================================
   A IDENTIDADE DAS TÉCNICAS NOS REGISTROS
   O uid ao lado do nome no rola, no plano e na meta: só liga com
   prova (nome de uma técnica só), o nome na época nunca muda,
   renomear pelo uid troca as listas e a passada nos antigos simula
   antes de aplicar e não muda nada na segunda vez.
   ============================================================ */
const {
  uidDaTecnica, resolverNome, comTecUid, uidDoGolpe, nomesDoRola, patchesDoRenomeio,
} = await import('../src/lib/identidade.js');
const { passadaDeIdentidade } = await import('../src/lib/compatibilidade.js');
const { planoNovo, correnteDoPlano } = await import('../src/lib/planos.js');
const { CATALOGO_TECNICAS, origemDaTecnica } = await import('../src/lib/tecnicas.js');
const { uidEstavel, chaveNome } = await import('../src/lib/uid.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

const doCatalogo = (nome) => CATALOGO_TECNICAS.find((t) => t.nome === nome);
const singleLeg = doCatalogo('Single leg');
const triangulo = CATALOGO_TECNICAS.find((t) => t.cat === 'estrangulamento');
const armlock = doCatalogo('Armlock da guarda fechada');

/* o aparelho: o catálogo, uma própria e uma própria com nome repetido de outra */
const techniques = [
  ...CATALOGO_TECNICAS.map((t, i) => ({ id: i + 1, uid: t.uid, nome: t.nome })),
  { id: 9001, uid: 'pp-minha-kimura', nome: 'Kimura do meu jeito', propria: 1 },
  { id: 9002, uid: 'pp-repetida-1', nome: 'Pegada do tio', propria: 1 },
  { id: 9003, uid: 'pp-repetida-2', nome: 'Pegada do tio', propria: 1 },
];

/* ---------- ligar o nome ---------- */
ok('nome único do catálogo liga', uidDaTecnica('Single leg', techniques), singleLeg.uid);
ok('sem acento e caixa, como o app compara', uidDaTecnica('single LEG', techniques), singleLeg.uid);
ok('nome antigo do catálogo liga no uid certo', uidDaTecnica('Solo (single leg)', techniques), singleLeg.uid);
ok('técnica própria liga', uidDaTecnica('Kimura do meu jeito', techniques), 'pp-minha-kimura');
ok('nome ambíguo não liga', resolverNome('Pegada do tio', techniques), { ambiguo: true });
ok('nome sem par não liga', resolverNome('Golpe que não existe', techniques), { semPar: true });
ok('família não é técnica', uidDaTecnica('fam:armlock', techniques), null);
/* aparelho antigo: a linha do catálogo ficou com o uid do nome de antes de RENOMEAR */
const uidVelho = uidEstavel(chaveNome('techniques', 'Katagatame (triângulo de braço)'));
const katagatame = doCatalogo('Katagatame dos 100kg');
const comUidVelho = [...techniques.filter((t) => t.uid !== katagatame.uid), { id: 9100, uid: uidVelho, nome: 'Katagatame dos 100kg' }];
ok('linha do catálogo com uid de nome antigo é do catálogo (origemDaTecnica)', origemDaTecnica(uidVelho), 'catalogo');
ok('e liga no uid da biblioteca, sem virar ambíguo', uidDaTecnica('Katagatame dos 100kg', comUidVelho), katagatame.uid);

/* ---------- o rola ---------- */
const rola = {
  subsAplicadas: ['Armlock da guarda fechada', 'Kimura do meu jeito'],
  subsSofridas: ['Pegada do tio'],
  tecMeus: { queda: ['Solo (single leg)'] },
  tecDele: { raspagem: ['Golpe que não existe'] },
};
const tecUid = comTecUid(nomesDoRola(rola), techniques);
ok('rola: liga o que é de uma técnica só, com o nome na época', tecUid,
  { [armlock.uid]: 'Armlock da guarda fechada', 'pp-minha-kimura': 'Kimura do meu jeito', [singleLeg.uid]: 'Solo (single leg)' });
ok('tecUid não é reescrito ao salvar de novo', comTecUid(nomesDoRola(rola), techniques, { ...tecUid, [armlock.uid]: 'Chave de braço (armlock)' })[armlock.uid], 'Chave de braço (armlock)');
ok('técnica que saiu do rola sai do mapa', Object.keys(comTecUid(['Kimura do meu jeito'], techniques, tecUid)), ['pp-minha-kimura']);

/* ---------- o plano ---------- */
const edit = {
  nome: 'Meu plano', objetivo: 'Finalizar', objetivoTipo: 'finalizar',
  finalizacaoPreferida: 'Kimura do meu jeito', finalizacoesAceitas: ['fam:armlock', triangulo.nome],
  passos: [
    { id: 'a1', lig: 'l1', tipo: 'finta', golpe: 'finjo que vou passar', pai: null, via: null },
    { id: 'a2', lig: 'l2', golpe: 'Armlock da guarda fechada', pai: 0, via: 'reagiu' },
    { id: 'a3', lig: 'l3', tipo: 'situacao', golpe: 'Lugar nenhum', pai: 1, via: 'escapou' },
  ],
};
const salvo = planoNovo({ ...edit, tecnicas: techniques });
ok('finta não ganha uid', salvo.passos[0].golpeUid, undefined);
ok('golpe ganha golpeUid', salvo.passos[1].golpeUid, armlock.uid);
ok('situação sem técnica fica sem uid', salvo.passos[2].golpeUid, undefined);
ok('preferida e aceitas no tecUid do plano, família fora', salvo.tecUid,
  { 'pp-minha-kimura': 'Kimura do meu jeito', [triangulo.uid]: triangulo.nome });
ok('sem a lista de técnicas, o plano sai como antes', 'tecUid' in planoNovo(edit) || planoNovo(edit).passos.some((x) => x.golpeUid), false);

/* editar e salvar de novo: correnteDoPlano → editor → planoNovo */
const doBanco = { ...salvo, id: 7 };
const c = correnteDoPlano(doBanco);
const reeditado = { ...edit, tecUid: doBanco.tecUid, passos: c.passos.map((x) => ({ ...x })) };
const deNovo = planoNovo({ ...reeditado, tecnicas: techniques });
ok('golpeUid sobrevive a editar e salvar', deNovo.passos.map((x) => x.golpeUid || null), salvo.passos.map((x) => x.golpeUid || null));
ok('tecUid do plano igual ao salvar de novo', deNovo.tecUid, salvo.tecUid);
const trocado = planoNovo({ ...reeditado, tecnicas: techniques, passos: reeditado.passos.map((x) => (x.id === 'a2' ? { ...x, golpe: 'Kimura do meu jeito' } : x)) });
ok('trocou o golpe: o uid acompanha o golpe novo', trocado.passos.find((x) => x.id === 'a2').golpeUid, 'pp-minha-kimura');
ok('uidDoGolpe da finta é nulo', uidDoGolpe({ tipo: 'finta', golpe: 'Single leg' }, techniques), null);

/* ---------- renomear a própria pelo uid ---------- */
const rolaSalvo = { id: 1, ...rola, tecUid };
const planoSalvo = { ...salvo, id: 2 };
const meta = { id: 3, tipo: 'tecnica', alvo: 'Kimura do meu jeito', tecUid: { 'pp-minha-kimura': 'Kimura do meu jeito' } };
const metaSoNome = { id: 4, tipo: 'tecnica', alvo: 'Kimura do meu jeito' };
const patches = patchesDoRenomeio({ uid: 'pp-minha-kimura', nomeNovo: 'Kimura de sempre', nomeAntigo: 'Kimura do meu jeito' },
  { rolls: [rolaSalvo], attackPlans: [planoSalvo], goals: [meta, metaSoNome] });
const de = (t, id) => patches.find((p) => p.tabela === t && p.id === id)?.patch;
ok('rola: a lista troca o nome', de('rolls', 1)?.subsAplicadas, ['Armlock da guarda fechada', 'Kimura de sempre']);
ok('rola: o nome na época fica', 'tecUid' in (de('rolls', 1) || {}), false);
ok('plano: a preferida troca', de('attackPlans', 2)?.finalizacaoPreferida, 'Kimura de sempre');
ok('meta: o alvo troca', de('goals', 3), { alvo: 'Kimura de sempre' });
ok('meta só pelo nome não é tocada (fica pra passada)', de('goals', 4), undefined);
const comGolpe = { id: 5, passos: [{ id: 'x', acao: 'Kimura do meu jeito', golpeUid: 'pp-minha-kimura' }, { id: 'y', tipo: 'finta', descricao: 'Kimura do meu jeito' }] };
const pg = patchesDoRenomeio({ uid: 'pp-minha-kimura', nomeNovo: 'Kimura de sempre' }, { attackPlans: [comGolpe] })[0]?.patch;
ok('plano: a peça com golpeUid troca, a finta não', pg?.passos.map((x) => x.acao || x.descricao), ['Kimura de sempre', 'Kimura do meu jeito']);
/* depois do renomeio, salvar o rola de novo mantém o nome na época */
const techniques2 = techniques.map((t) => (t.uid === 'pp-minha-kimura' ? { ...t, nome: 'Kimura de sempre' } : t));
const rolaRenomeado = { ...rolaSalvo, ...de('rolls', 1) };
ok('salvar depois do renomeio: o uid fica com o nome na época',
  comTecUid(nomesDoRola(rolaRenomeado), techniques2, rolaRenomeado.tecUid)['pp-minha-kimura'], 'Kimura do meu jeito');

/* ---------- a passada nos registros antigos ---------- */
const antigos = {
  techniques,
  rolls: [
    { id: 1, subsAplicadas: ['Single leg', 'Pegada do tio'], tecMeus: { x: ['Golpe que não existe'] } },
    { id: 2, subsSofridas: ['Kimura do meu jeito'] },
    { id: 3, ptsMeus: ['queda'] }, // sem técnica: não conta
  ],
  attackPlans: [
    { id: 10, objetivo: 'Single leg', objetivoTipo: 'tecnica', passos: [{ acao: 'Armlock da guarda fechada' }, { tipo: 'finta', acao: 'Single leg' }] },
    { id: 11, pronto: 1, passos: [{ acao: 'Single leg' }] }, // pronto: fica de fora
  ],
  goals: [
    { id: 20, tipo: 'defesa', alvo: 'Pegada do tio' },
    { id: 21, tipo: 'frequencia', alvo: 3 },
  ],
};
const sim = passadaDeIdentidade(antigos);
ok('simular não devolve patch', 'patches' in sim, false);
ok('rolas: números', sim.numeros.rolls, { registros: 2, alterados: 2, ligados: 2, jaLigados: 0, ambiguos: 1, semPar: 1 });
ok('planos: números (finta e pronto fora)', sim.numeros.attackPlans, { registros: 1, alterados: 1, ligados: 2, jaLigados: 0, ambiguos: 0, semPar: 0 });
ok('metas: números', sim.numeros.goals, { registros: 1, alterados: 0, ligados: 0, jaLigados: 0, ambiguos: 1, semPar: 0 });

const { patches: ps } = passadaDeIdentidade(antigos, { simular: false });
const aplicar = (lista, tabela) => lista.map((r) => ({ ...r, ...(ps.find((p) => p.tabela === tabela && p.id === r.id)?.patch || {}) }));
const depois = { techniques, rolls: aplicar(antigos.rolls, 'rolls'), attackPlans: aplicar(antigos.attackPlans, 'attackPlans'), goals: aplicar(antigos.goals, 'goals') };
ok('aplicar: o rola ganha o uid e mantém a lista', [depois.rolls[0].tecUid, depois.rolls[0].subsAplicadas], [{ [singleLeg.uid]: 'Single leg' }, ['Single leg', 'Pegada do tio']]);
ok('aplicar: a peça ganha golpeUid, a finta não', depois.attackPlans[0].passos.map((x) => x.golpeUid || null), [armlock.uid, null]);
const segunda = passadaDeIdentidade(depois, { simular: false });
ok('rodar de novo não muda nada', segunda.patches, []);
ok('na segunda vez o que ligou conta como já ligado', [segunda.numeros.rolls.jaLigados, segunda.numeros.attackPlans.jaLigados], [2, 2]);

/* ---------- registro sem uid continua pelo nome ---------- */
ok('rola sem tecUid: as listas de nomes seguem iguais', nomesDoRola(antigos.rolls[1]), ['Kimura do meu jeito']);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
