import React, { useState, useCallback } from 'react';
import { Sheet } from './UI';
import { LimiteDoDia } from './Plano';
import { limiteDoDia } from '../lib/plano';

/* ============================================================
   A TRAVA DO DIA

   Duas telas abrem vídeo, e o quiz e o registro de treino têm
   o mesmo problema: perguntar antes se ainda cabe hoje, e
   explicar quando não cabe.

   O aviso é uma folha e não um alerta do navegador, porque a
   pessoa precisa conseguir ler o que ganha no premium e fechar
   sem sair do lugar onde estava.
   ============================================================ */
export function useLimite(acesso, irPara) {
  const [travado, setTravado] = useState(null);

  /* abre o aviso na mão, pra quem já sabe que não cabe. O editor
     de treino sabe: ele conta o que está na tela e ainda não foi
     salvo, coisa que o banco não tem como ver. */
  const travar = useCallback((tipo) => setTravado(tipo), []);

  /* devolve true quando ainda cabe, e abre o aviso quando não */
  const liberado = useCallback(async (tipo) => {
    const l = await limiteDoDia(acesso, tipo);
    if (l.pode) return true;
    setTravado(tipo);
    return false;
  }, [acesso]);

  const aviso = (
    <Sheet
      aberto={!!travado}
      onClose={() => setTravado(null)}
      titulo="Por hoje é isso"
    >
      <LimiteDoDia
        tipo={travado}
        onAssinar={() => { setTravado(null); irPara?.('ajustes'); }}
      />
    </Sheet>
  );

  return { liberado, travar, aviso };
}
