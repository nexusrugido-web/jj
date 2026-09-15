import { createContext, useContext } from 'react';

/* ============================================================
   O CONTEXTO DO APP

   Isto mora sozinho num arquivo, e não dentro do App, por um
   motivo prático: toda tela precisa do useApp, e o App precisa
   das telas. Se os dois ficassem juntos, um chamaria o outro
   em círculo e o app quebraria ao abrir.
   ============================================================ */

export const AppCtx = createContext(null);

export const useApp = () => useContext(AppCtx);
