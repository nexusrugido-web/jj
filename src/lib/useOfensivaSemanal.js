import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, setMeta } from '../db/db';
import { escudosDaDivisao, useMinhaDivisao } from './liga';
import { ofensiva } from './ofensiva';
import { hojeOfensiva, ofensivaSemanal } from './ofensivaSemanal';

export default function useOfensivaSemanal() {
  const [data, setData] = useState(hojeOfensiva);
  const divisao = useMinhaDivisao();
  const maxEscudos = escudosDaDivisao(divisao?.divisao);
  useEffect(() => {
    const atualizar = () => setData(hojeOfensiva());
    const timer = setInterval(atualizar, 60000);
    document.addEventListener('visibilitychange', atualizar);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', atualizar); };
  }, []);
  const resultado = useLiveQuery(async () => {
    const [sessions, lesoes, pontos] = await Promise.all([
      db.sessions.toArray(), db.injuries.toArray(), db.pontos.toArray(),
    ]);
    // Preserva o recorde da regra diária até a data de transição.
    const corte = '2026-09-29';
    const anterior = await getMeta('ofensiva_recorde_diario', 0);
    const legado = ofensiva(pontos.filter((p) => p.data <= corte), corte, lesoes, { maxEscudos }).recorde;
    const recordeDiario = Math.max(anterior, legado);
    return { ...ofensivaSemanal(sessions, data, lesoes, { maxEscudos }), recordeDiario };
  }, [data, maxEscudos], { ...ofensivaSemanal([], data), recordeDiario: 0 });
  useEffect(() => {
    if (!resultado.recordeDiario) return;
    db.transaction('rw', db.meta, async () => {
      const anterior = await getMeta('ofensiva_recorde_diario', 0);
      if (resultado.recordeDiario > anterior) await setMeta('ofensiva_recorde_diario', resultado.recordeDiario);
    }).catch((e) => console.error('[ofensiva] recorde diário', e));
  }, [resultado.recordeDiario]);
  return resultado;
}
