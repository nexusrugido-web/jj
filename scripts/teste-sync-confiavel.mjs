import { register } from 'node:module';
import 'fake-indexeddb/auto';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   SYNC CONFIÁVEL (Trilha S, 06/11/2026)

   S1. A fila não trava: registro recusado fica com o motivo e espera
       a vez; os outros sobem. Erro geral (sem internet, sessão
       vencida) para o ciclo sem tentar um por um.
   ============================================================ */

const { db } = await import('../src/db/db.js');
const { subirFila, erroGeral, esperaDaTentativa } = await import('../src/lib/sync.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

/* ---------- S1: a fila ---------- */
const T = Date.parse('2026-11-06T12:00:00Z');
const item = (uid, extra = {}) => ({ tabela: 'sessions', op: 'upsert', uid, dados: { uid, data: '2026-11-01', ...extra }, updatedAt: T, criadoEm: T, tentativas: 0 });
const recusa = { error: { code: '42501', message: 'new row violates row-level security policy' }, status: 403 };
const semRede = { error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0 };

/* um servidor de mentira: recusa os ids marcados, guarda o que aceitou e conta as chamadas */
function servidor({ recusar = [], tudo = null } = {}) {
  const s = { aceitos: new Map(), chamadas: 0 };
  s.enviar = async (linhas) => {
    s.chamadas++;
    if (tudo) return tudo;
    if (linhas.some((l) => recusar.includes(l.id))) return recusa;
    for (const l of linhas) s.aceitos.set(l.id, l);
    return { error: null, status: 201 };
  };
  return s;
}

ok('erro de rede, sessão vencida e servidor fora são gerais', [erroGeral(semRede.error, 0), erroGeral({ code: 'PGRST301' }, 401), erroGeral({}, 503), erroGeral({}, 429)], [true, true, true, true]);
ok('regra de segurança e dado inválido são do registro', [erroGeral(recusa.error, 403), erroGeral({ code: '23505' }, 409), erroGeral({ code: '22P02' }, 400)], [false, false, false]);

await db.outbox.clear();
await db.outbox.bulkAdd([item('t1'), item('t2'), item('ruim'), item('t3')]);
let srv = servidor({ recusar: ['ruim'] });
let r = await subirFila('conta', srv.enviar, T);
ok('um registro recusado não segura os outros', [r, [...srv.aceitos.keys()].sort()], [{ subiram: 3, falharam: 1 }, ['t1', 't2', 't3']]);
const ruim = await db.outbox.where('uid').equals('ruim').first();
ok('o recusado fica na fila, com o motivo, a tentativa e a hora da próxima',
  [await db.outbox.count(), ruim.tentativas, ruim.erro.startsWith('42501'), ruim.proximaEm], [1, 1, true, T + 60000]);

srv = servidor();
r = await subirFila('conta', srv.enviar, T + 1000);
ok('antes da hora ele não é tentado de novo (nenhuma chamada)', [r, srv.chamadas], [{ subiram: 0, falharam: 0 }, 0]);
r = await subirFila('conta', srv.enviar, T + 60000);
ok('na hora, tenta de novo e, aceito, sai da fila', [r.subiram, await db.outbox.count()], [1, 0]);
ok('a espera dobra a cada tentativa e para em 6 horas', [esperaDaTentativa(1), esperaDaTentativa(2), esperaDaTentativa(3), esperaDaTentativa(30)], [60000, 120000, 240000, 6 * 3600000]);

/* erro geral: uma chamada só, nada sai da fila, nada é marcado */
await db.outbox.bulkAdd([item('a'), item('b'), item('c')]);
srv = servidor({ tudo: semRede });
let lancou = null;
try { await subirFila('conta', srv.enviar, T); } catch (e) { lancou = e.message; }
const fila = await db.outbox.toArray();
ok('sem internet: para na hora, sem tentar um por um, e a fila fica intacta',
  [lancou, srv.chamadas, fila.length, fila.some((i) => i.erro || i.tentativas)], ['TypeError: Failed to fetch', 1, 3, false]);
srv = servidor();
await subirFila('conta', srv.enviar, T);
ok('voltou a internet: sobe tudo', [await db.outbox.count(), srv.aceitos.size], [0, 3]);

/* versão nova de um registro recusado: a velha sai junto e nunca sobe por cima */
await db.outbox.add(item('x', { nota: 'velha' }));
await subirFila('conta', servidor({ recusar: ['x'] }).enviar, T);
await db.outbox.add({ ...item('x', { nota: 'nova' }), criadoEm: T + 5 });
srv = servidor();
await subirFila('conta', srv.enviar, T + 10);
ok('a versão nova sobe e leva embora a recusada que esperava', [srv.aceitos.get('x')?.dados.nota, await db.outbox.count()], ['nova', 0]);
await subirFila('conta', srv.enviar, T + 999999999);
ok('e a velha não sobe depois', srv.aceitos.get('x').dados.nota, 'nova');

/* repetir não duplica: o mesmo uid duas vezes vira uma linha só */
await db.outbox.bulkAdd([item('d', { nota: '1' }), item('d', { nota: '2' })]);
srv = servidor();
await subirFila('conta', srv.enviar, T);
ok('duas versões na fila sobem como uma, a última', [srv.aceitos.size, srv.aceitos.get('d').dados.nota, await db.outbox.count()], [1, '2', 0]);

/* ---------- S2: duas contas, a mesma técnica da biblioteca ----------
   O banco de mentira faz o que o Supabase faz: o id é único no banco
   inteiro e a regra de segurança só deixa cada conta mexer na sua linha
   (é o que a prova 53 mostrou no banco de verdade). */
const { paraRegistros, aplicarLocal, idNaNuvem } = await import('../src/lib/sync.js');
const { uidEstavel, chaveNome } = await import('../src/lib/uid.js');
function bancoComRls() {
  const linhas = new Map();
  return {
    linhas,
    como: (conta) => async (envio) => {
      for (const l of envio) {
        if (l.user_id !== conta) return recusa;                       // insert: with check
        const ja = linhas.get(l.id);
        if (ja && ja.user_id !== conta) return recusa;                // update: using
      }
      for (const l of envio) linhas.set(l.id, { ...l });
      return { error: null, status: 201 };
    },
    doDono: (conta) => [...linhas.values()].filter((l) => l.user_id === conta),   // select: using
  };
}
const ARMLOCK = uidEstavel(chaveNome('techniques', 'Chave de braço (armlock)'));
const marca = (status) => ({ tabela: 'techniques', op: 'upsert', uid: ARMLOCK, updatedAt: T, criadoEm: T, tentativas: 0,
  dados: { uid: ARMLOCK, nome: 'Armlock da guarda fechada', status, updatedAt: T, criadoEm: T - 999999 } });
const banco = bancoComRls();
await db.outbox.clear();
await db.outbox.add(marca('aprendendo'));
r = await subirFila('conta-A', banco.como('conta-A'), T);
await db.outbox.add(marca('dominada'));
const rB = await subirFila('conta-B', banco.como('conta-B'), T);
ok('as duas contas marcam a mesma técnica e as duas sobem', [r, rB, await db.outbox.count()], [{ subiram: 1, falharam: 0 }, { subiram: 1, falharam: 0 }, 0]);
ok('cada conta tem a sua linha, com o seu progresso', [banco.doDono('conta-A').map((l) => l.dados.status), banco.doDono('conta-B').map((l) => l.dados.status)], [['aprendendo'], ['dominada']]);
ok('o id na nuvem é por conta, e o uid de verdade vai nos dados', [banco.doDono('conta-A')[0].id === banco.doDono('conta-B')[0].id, banco.doDono('conta-B')[0].dados.uid], [false, ARMLOCK]);
ok('treino e rola continuam com o próprio uid (não colidem)', idNaNuvem('sessions', 'abc', 'conta-A'), 'abc');
ok('as configurações continuam com o id da conta', idNaNuvem('settings', 'settings', 'conta-A'), 'conta-A');
const aMexe = await banco.como('conta-A')([{ ...banco.doDono('conta-B')[0], user_id: 'conta-A' }]);
ok('a conta A não consegue mexer na linha da B', aMexe.error?.code, '42501');

/* a descida: o aparelho da conta B só recebe a dela e grava no uid certo */
const tec = await db.techniques.add({ uid: ARMLOCK, nome: 'Armlock da guarda fechada', status: 'nao_iniciada', updatedAt: 1, __local: 1 });
await aplicarLocal(banco.doDono('conta-B'));
ok('o aparelho da B grava o progresso dela na técnica certa, sem criar outra', [(await db.techniques.get(tec)).status, await db.techniques.where('uid').equals(ARMLOCK).count()], ['dominada', 1]);
/* linha antiga (id = uid, de antes desta correção) continua valendo */
await aplicarLocal([{ id: ARMLOCK, user_id: 'conta-B', tabela: 'techniques', dados: { uid: ARMLOCK, nome: 'Armlock da guarda fechada', status: 'aprendendo' }, updated_at: new Date(T + 5000).toISOString(), deleted_at: null }]);
ok('linha antiga, mais nova, ainda vale e não duplica', [(await db.techniques.get(tec)).status, await db.techniques.where('uid').equals(ARMLOCK).count()], ['aprendendo', 1]);
/* apagar: a linha de apagado leva o uid nos dados */
const del = paraRegistros([{ tabela: 'attackPlans', op: 'delete', uid: 'plano-1', updatedAt: T }], 'conta-A')[0];
ok('apagar vai pro id da conta e leva o uid', [del.id === idNaNuvem('attackPlans', 'plano-1', 'conta-A'), del.dados.uid], [true, 'plano-1']);

/* ---------- S3: trocar de aparelho, relações pelo id permanente ----------
   O aparelho A grava pelo caminho de verdade (hooks → fila → subirFila);
   o B é um banco zerado, com as categorias numa ordem diferente
   (Compressões entrou no meio da lista), e baixa pelo aplicarLocal. */
const { default: Dexie } = await import('dexie');
const { registrarSync } = await import('../src/db/db.js');
const { resolverPendentes } = await import('../src/lib/sync.js');
let relogio = T;
registrarSync((tabela, op, reg) => Dexie.ignoreTransaction(() => db.outbox.add({
  tabela, op, uid: reg.uid, dados: op === 'delete' ? null : reg, updatedAt: reg.updatedAt, criadoEm: ++relogio, tentativas: 0,
})));
const espera = () => new Promise((res) => setTimeout(res, 3));
const CATS_ANTES = ['queda', 'passagem', 'raspagem', 'estrangulamento', 'articular', 'perna', 'escapada', 'transicao', 'compressao'];
const CATS_DEPOIS = ['queda', 'passagem', 'raspagem', 'estrangulamento', 'articular', 'perna', 'compressao', 'escapada', 'transicao'];
const semear = async (cats) => {
  for (const slug of cats) await db.categories.add({ slug, nome: slug, uid: uidEstavel(chaveNome('categories', slug)), __local: 1 });
  for (const slug of ['guarda_fechada', 'montada', 'costas']) await db.positions.add({ slug, nome: slug, uid: uidEstavel(chaveNome('positions', slug)), __local: 1 });
};
const idCat = async (slug) => (await db.categories.filter((c) => c.slug === slug).first()).id;
const idPos = async (slug) => (await db.positions.filter((c) => c.slug === slug).first()).id;

/* aparelho A */
await db.delete(); await db.open();
await semear(CATS_ANTES);
const fuga = await db.techniques.add({ nome: 'Fuga de quadril', uid: uidEstavel(chaveNome('techniques', 'Fuga de quadril')), categoriaId: await idCat('escapada'), origemId: await idPos('montada'), destinoId: await idPos('guarda_fechada'), status: 'nao_iniciada', criadoEm: T - 999999, __local: 1 });
await db.techniques.update(fuga, { status: 'aprendendo' });                 // marcou: vira dado dele e sobe
const minha = await db.techniques.add({ nome: 'Minha raspagem', categoriaId: await idCat('raspagem'), origemId: await idPos('guarda_fechada'), status: 'aprendendo', criadoEm: T });
const acad = await db.academies.add({ nome: 'Academia X' });
const prof = await db.professors.add({ nome: 'Professor Y', academiaId: acad });
const parceiros = [await db.partners.add({ nome: 'Ana' }), await db.partners.add({ nome: 'Bruno' })];
const datas = ['2026-10-01', '2026-10-02', '2026-10-03'];
for (const [i, d] of datas.entries()) {
  const sid = await db.sessions.add({ data: d, tipo: 'gi', academiaId: acad, professorId: prof, focoTecnicas: [{ tecnicaId: i === 0 ? fuga : minha, nome: i === 0 ? 'Fuga de quadril' : 'Minha raspagem' }] }); await espera();
  await db.rolls.add({ sessionId: sid, partnerId: parceiros[i % 2], data: d, subsSofridas: [] }); await espera();
  await db.pontos.add({ evento: 'treino', xp: 10, refId: `treino:${sid}`, data: d }); await espera();
}
const primeiroTreino = (await db.sessions.toArray())[0];
await db.sessions.update(primeiroTreino.id, { notas: 'editado depois' }); await espera();
const nuvemS3 = bancoComRls();
while ((await subirFila('conta-A', nuvemS3.como('conta-A'), Date.now())).subiram);
const linhasA = nuvemS3.doDono('conta-A').sort((a, b) => a.updated_at.localeCompare(b.updated_at) || 0);
ok('o rola sobe com o id permanente do treino e do parceiro', linhasA.filter((l) => l.tabela === 'rolls').every((l) => l.dados.refs?.sessionId && l.dados.refs?.partnerId), true);
ok('categoria e posição da biblioteca sobem pelo slug', linhasA.find((l) => l.dados.nome === 'Fuga de quadril').dados.refs, { categoriaId: 'slug:escapada', origemId: 'slug:montada', destinoId: 'slug:guarda_fechada' });

/* aparelho B: outra ordem de categorias, a nuvem desce na ordem de updated_at */
await db.delete(); await db.open();
await semear(CATS_DEPOIS);
/* a biblioteca do celular novo nasce agora, mais nova que a marca que vem da nuvem */
await db.techniques.add({ nome: 'Fuga de quadril', uid: uidEstavel(chaveNome('techniques', 'Fuga de quadril')), categoriaId: await idCat('escapada'), status: 'nao_iniciada', criadoEm: Date.now() + 9e6, updatedAt: Date.now() + 9e6, __local: 1 });
ok('no B, a numeração das categorias é outra mesmo (escapada era 7 no A)', await idCat('escapada'), 8);
await aplicarLocal(linhasA);
const sesB = await db.sessions.toArray();
const rolB = await db.rolls.toArray();
const parB = await db.partners.toArray();
ok('cada rola continua no treino certo (mesmo com o treino editado e outra ordem)',
  rolB.map((r) => [r.data, sesB.find((s) => s.id === r.sessionId)?.data]), datas.map((d) => [d, d]));
ok('e com o parceiro certo', rolB.map((r) => parB.find((p) => p.id === r.partnerId)?.nome), ['Ana', 'Bruno', 'Ana']);
const fugaB = await db.techniques.where('uid').equals(uidEstavel(chaveNome('techniques', 'Fuga de quadril'))).first();
ok('técnica marcada fica na categoria certa do B e com o progresso (a biblioteca recém-criada não ganha da marca)', [fugaB.categoriaId === await idCat('escapada'), fugaB.origemId === await idPos('montada'), fugaB.status, 'refs' in fugaB], [true, true, 'aprendendo', false]);
const minhaB = await db.techniques.filter((t) => t.nome === 'Minha raspagem').first();
ok('técnica criada pelo atleta também', minhaB.categoriaId === await idCat('raspagem'), true);
ok('a técnica do foco do treino aponta pra técnica certa do B', sesB.map((s) => s.focoTecnicas[0].tecnicaId === (s.focoTecnicas[0].nome === 'Minha raspagem' ? minhaB.id : fugaB.id)), [true, true, true]);
const profB = await db.professors.toArray();
const acadB = await db.academies.toArray();
ok('professor aponta pra academia do B', profB[0].academiaId === acadB[0].id && sesB.every((s) => s.academiaId === acadB[0].id && s.professorId === profB[0].id), true);
const ptsB = await db.pontos.toArray();
ok('o ponto aponta pro treino do B', ptsB.map((p) => sesB.find((s) => `treino:${s.id}` === p.refId)?.data), datas);
ok('repetir a descida não duplica nada', await (async () => { await aplicarLocal(linhasA); return [await db.sessions.count(), await db.rolls.count(), await db.partners.count(), await db.techniques.count()]; })(), [3, 3, 2, 2]);
ok('a descida não volta pra fila', await db.outbox.count(), 0);

/* rola que chega antes do treino: fica pendente, sem número de ninguém, e liga quando o treino chega */
await db.delete(); await db.open();
await semear(CATS_DEPOIS);
const soRolas = linhasA.filter((l) => l.tabela === 'rolls');
await aplicarLocal(soRolas);
ok('rola sem o treino ainda: sem número de outro aparelho', (await db.rolls.toArray()).map((r) => r.sessionId), [null, null, null]);
await aplicarLocal(linhasA.filter((l) => l.tabela !== 'rolls'));
const sesC = await db.sessions.toArray();
ok('o treino chegou: o rola liga nele', (await db.rolls.toArray()).map((r) => sesC.find((s) => s.id === r.sessionId)?.data), datas);
ok('não sobra pendência', [(await db.meta.get('refs_pendentes'))?.value?.length, await resolverPendentes()], [0, 0]);

/* registro antigo (sem refs) desce como sempre desceu */
const antigo = { id: 'rola-velho', user_id: 'conta-A', tabela: 'rolls', dados: { uid: 'rola-velho', sessionId: 2, data: '2026-09-01' }, updated_at: new Date(T).toISOString(), deleted_at: null };
await aplicarLocal([antigo]);
ok('registro antigo, sem refs, desce igual a antes', (await db.rolls.where('uid').equals('rola-velho').first()).sessionId, 2);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
