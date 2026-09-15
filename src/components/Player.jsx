import React, { useState, useRef, useEffect } from 'react';
import { Check, X, TriangleAlert } from 'lucide-react';
import { Btn, Sheet, Bar } from './UI';
import { embed, linkAula, duracaoTexto } from '../db/aulas';

/* ============================================================
   PLAYER DE AULA

   Um só, usado no Estudo e nas recomendações do Painel. Marca
   como vista quando você assiste até quase o fim, e quem marca
   ganha ponto, porque estudar também é evolução.
   ============================================================ */

export default function Player({ aula, onClose, onConcluir }) {
  const ref = useRef(null);
  const [pronto, setPronto] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [concluida, setConcluida] = useState(false);
  const [semApi, setSemApi] = useState(false);
  const player = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!aula) return;
    setPronto(false); setProgresso(0); setConcluida(false);

    const iniciar = () => {
      if (!ref.current || !window.YT?.Player) return;
      player.current = new window.YT.Player(ref.current, {
        videoId: aula.id,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => setPronto(true),
          onStateChange: (e) => {
            if (e.data === 1) {
              clearInterval(timer.current);
              timer.current = setInterval(() => {
                try {
                  const p = player.current;
                  const d = p.getDuration();
                  if (d > 0) setProgresso(Math.min(100, Math.round((p.getCurrentTime() / d) * 100)));
                } catch { /* player fechando */ }
              }, 1000);
            } else {
              clearInterval(timer.current);
            }
            if (e.data === 0) { setProgresso(100); setConcluida(true); }
          },
        },
      });
    };

    if (window.YT?.Player) iniciar();
    else {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => setSemApi(true);
      window.onYouTubeIframeAPIReady = iniciar;
      document.body.appendChild(s);

      /* Se o script do YouTube não chegar em cinco segundos, cai
         pro vídeo simples. Bloqueador de anúncio derruba esse
         script com frequência, e tela preta sem explicação é pior
         que um player sem barra de progresso. */
      const desistir = setTimeout(() => {
        if (!player.current) setSemApi(true);
      }, 5000);
      return () => clearTimeout(desistir);
    }

    return () => {
      clearInterval(timer.current);
      try { player.current?.destroy?.(); } catch { /* já foi */ }
      player.current = null;
    };
  }, [aula]);

  useEffect(() => {
    if (progresso >= 90 && !concluida) setConcluida(true);
  }, [progresso, concluida]);

  if (!aula) return null;

  return (
    <Sheet
      aberto={!!aula}
      onClose={onClose}
      titulo={aula.t}
      subtitulo={duracaoTexto(aula.d)}
      wide
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
          <Btn
            variant="primary"
            icon={Check}
            disabled={!concluida && !semApi}
            onClick={() => { onConcluir(aula, Math.round((progresso / 100) * aula.d)); onClose(); }}
          >
            {concluida || semApi ? 'Marcar como vista' : `Assista até o fim (${progresso}%)`}
          </Btn>
        </>
      }
    >
      {/* o player fica sozinho, sem nada por cima. O YouTube exige isso. */}
      <div className="player-caixa">
        {semApi ? (
          <iframe
            src={embed(aula.id)}
            title={aula.t}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div ref={ref} />
        )}
      </div>

      {semApi && (
        <div className="valida atencao">
          <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.6 }}>
            Não consegui acompanhar o quanto você assistiu, então dá pra marcar como vista assim que quiser.
            Costuma ser bloqueador de anúncio.
          </p>
        </div>
      )}

      <div className="col" style={{ gap: 7 }}>
        <Bar v={progresso} max={100} tone={concluida ? 'jade' : ''} />
        <span className="micro muted">
          {concluida
            ? 'Pode marcar como vista.'
            : progresso > 0
              ? `${progresso}% assistido. O botão libera aos 90%.`
              : 'Toque no play pra começar.'}
        </span>
      </div>

      <a className="btn ghost xs" href={linkAula(aula.id)} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
        Abrir no YouTube
      </a>
    </Sheet>
  );
}
