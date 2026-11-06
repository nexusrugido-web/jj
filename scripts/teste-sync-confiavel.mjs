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

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
