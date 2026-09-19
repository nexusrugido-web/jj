import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { capa, SERVIDORES_CAPA } from '../lib/aulas';

/* ============================================================
   MINIATURA

   O YouTube não tem todas as resoluções pra todo vídeo, e tem
   gente com bloqueador que derruba a imagem. Em vez de deixar
   um retângulo cinza sem explicação, cai pra uma resolução
   menor e, se nada vier, desenha o play.
   ============================================================ */

const ESCADA = ['maxres', 'sd', 'hq', 'mq', ''];

/* propria: a miniatura que o administrador cadastrou pro vídeo.
   Ela vem primeiro; se não carregar, o app volta pra do YouTube. */
export default function Capa({ id, propria = null, alt = '', tamanho = 'hq', className = '', children }) {
  const inicio = Math.max(0, ESCADA.indexOf(tamanho));
  const [passo, setPasso] = useState(inicio);
  const [servidor, setServidor] = useState(0);
  const [morreu, setMorreu] = useState(false);
  const [usarPropria, setUsarPropria] = useState(!!propria);

  return (
    <div className={`capa ${className}`}>
      {usarPropria ? (
        <img
          src={propria}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setUsarPropria(false)}
        />
      ) : !morreu ? (
        <img
          src={capa(id, ESCADA[passo], servidor)}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            /* tenta a próxima resolução; esgotando, troca de
               servidor; esgotando tudo, desenha o play */
            if (passo < ESCADA.length - 1) setPasso(passo + 1);
            else if (servidor < SERVIDORES_CAPA.length - 1) { setServidor(servidor + 1); setPasso(inicio); }
            else setMorreu(true);
          }}
        />
      ) : (
        <div className="capa-vazia"><Play size={18} /></div>
      )}
      {children}
    </div>
  );
}
