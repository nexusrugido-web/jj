import React, { useState } from 'react';
import { Btn, Sheet } from './UI';

/* Mantém a página curta sem esconder os registros antigos. A lista inteira
   continua disponível na folha, com carregamento progressivo de cartões. */
export default function ListaComHistorico({ itens, limite = 5, titulo, className = 'col', style, renderItem, cabecalho, abrirSempre = false, textoAbrir }) {
  const [aberto, setAberto] = useState(false);
  const [mostrar, setMostrar] = useState(20);
  const linha = (item, indice) => renderItem(item, indice);
  return (
    <>
      <div className={className} style={style}>{itens.slice(0, limite).map(linha)}</div>
      {(itens.length > limite || abrirSempre) && (
        <Btn variant="contorno" onClick={() => { setMostrar(20); setAberto(true); }} style={{ marginTop: 12 }}>
          {textoAbrir || `Ver todos (${itens.length})`}
        </Btn>
      )}
      <Sheet aberto={aberto} onClose={() => setAberto(false)} titulo={titulo} subtitulo={`${itens.length} registros`} wide>
        {cabecalho}
        <div className={className} style={style}>{itens.slice(0, mostrar).map(linha)}</div>
        {itens.length > mostrar && (
          <Btn variant="ghost" onClick={() => setMostrar((n) => n + 20)} style={{ marginTop: 12 }}>
            Mostrar mais ({itens.length - mostrar})
          </Btn>
        )}
      </Sheet>
    </>
  );
}
