import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Sheet } from './UI';

/* ============================================================
   LISTA CURTA, E O RESTO NUMA FOLHA

   A lista que cresce com o uso mostra só os primeiros na tela, e
   "Ver todos (N)" abre a lista inteira numa folha. A folha é a
   mesma do resto do app, no celular e no computador.

   itens     a lista inteira, já na ordem
   quantos   quantos ficam na tela
   titulo    o título da folha
   children  (lista, completa) => o desenho; completa é true na
             folha, pra quem quiser agrupar só lá
   ============================================================ */
export default function ListaResumida({ itens, quantos = 5, titulo, subtitulo, verTodos = 'Ver todos', children }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      {children(itens.slice(0, quantos), false)}
      {itens.length > quantos && (
        <button className="btn ghost xs" onClick={() => setAberto(true)} style={{ marginTop: 10 }}>
          {verTodos} ({itens.length}) <ChevronRight size={12} />
        </button>
      )}
      <Sheet aberto={aberto} onClose={() => setAberto(false)} titulo={titulo} subtitulo={subtitulo}>
        {aberto && children(itens, true)}
      </Sheet>
    </>
  );
}
