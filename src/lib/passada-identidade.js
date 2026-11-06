import { db } from '../db/db';
import { passadaDeIdentidade } from './compatibilidade';
import { marcarProprias } from './proprias';
import { itemDaFila } from './sync';
import { supabaseConfigurado } from './supabase';

/* ============================================================
   A PASSADA DE IDENTIDADE, TUDO OU NADA (T5, 07/11/2026)

   Ligada no sync (sincronizar, depois do reparo S4), autorizada pelo
   dono em 07/11 depois da revisão conjunta. Antes de subir pra main:
   SQL 58 (cópia). Depois: SQL 59 e 57.

   Uma vez por aparelho (marca `identidade_t` em meta). Roda numa
   transação só do banco do aparelho: os registros corrigidos, a
   marca de pessoal, a fila de subida e a marca de "já rodou" entram
   juntos ou não entra nada. Se o app fechar no meio, o aparelho
   volta como estava e a próxima abertura roda de novo, do zero.

   Diferente do reparo S4: lá o registro grava e a fila entra por
   fora, e um fechamento entre os dois perde a subida. Aqui a fila é
   escrita dentro da transação (os hooks do banco ficam quietos por
   causa de `semFila`, senão enfileirariam por fora e em dobro).

   O que muda: só `tecUid`, `golpeUid` e `propria` (e a hora da
   alteração, carimbada pelo banco). Nenhum registro é criado ou
   apagado, nenhum nome é reescrito.
   ============================================================ */

export const MARCA_IDENTIDADE = 'identidade_t';

const TABELAS = ['rolls', 'attackPlans', 'goals', 'techniques'];

/* comFila: grava a fila junto (padrão: só com a nuvem ligada, como enfileirar) */
export async function aplicarIdentidadeUmaVez({ comFila = supabaseConfigurado } = {}) {
  return db.transaction('rw', ...TABELAS.map((t) => db[t]), db.outbox, db.meta, async (tx) => {
    tx.semFila = true;
    if ((await db.meta.get(MARCA_IDENTIDADE))?.value) return { jaFeita: true };

    const [rolls, attackPlans, goals, techniques] = await Promise.all(TABELAS.map((t) => db[t].toArray()));
    const { numeros, patches } = passadaDeIdentidade({ rolls, attackPlans, goals, techniques }, { simular: false });
    const marcadas = (await marcarProprias(techniques, { simular: true })).patches
      .map((p) => ({ tabela: 'techniques', id: p.id, patch: p.patch }));

    const itens = [];
    for (const { tabela, id, patch } of [...patches, ...marcadas]) {
      await db[tabela].update(id, patch);
      const gravado = await db[tabela].get(id);
      if (comFila && gravado) itens.push(itemDaFila(tabela, 'upsert', gravado));
    }
    if (itens.length) await db.outbox.bulkAdd(itens);

    const relatorio = { em: Date.now(), numeros, alterados: patches.length, marcadas: marcadas.length, naFila: itens.length };
    await db.meta.put({ key: MARCA_IDENTIDADE, value: relatorio });
    return { jaFeita: false, ...relatorio };
  });
}
