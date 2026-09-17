import React, { useState, useRef, useEffect } from 'react';
import { Check, Play, Pause, TriangleAlert } from 'lucide-react';
import { Btn, Sheet, Bar } from './UI';
import { embed, duracaoTexto } from '../db/aulas';
import { trechoValido } from '../lib/aulas';

/* ============================================================
   PLAYER DE AULA

   Um só, usado no Estudo e nas recomendações do Painel.

   Duas decisões que mudam como ele funciona:

   1. A AULA NÃO TERMINA NO OUTRO APP. Não existe link pra fora,
      o controle nativo fica escondido e o teclado não pula. Quem
      abriu uma aula aqui fica aqui, porque sair no meio é sair do
      treino de estudo, não só da tela.

   2. ASSISTIR É TEMPO, NÃO É POSIÇÃO. Antes o app olhava onde a
      barra estava: arrastar até o fim marcava a aula como vista
      sem ver nada. Agora ele soma só o que passou de verdade, um
      pedaço por vez. Pulo pra frente não soma, e pulo pra trás
      também não, porque o que já foi somado continua somado.
   ============================================================ */

/* o quanto da aula precisa ter passado pra contar como vista */
const FRACAO_PRA_CONCLUIR = 0.9;

export default function Player({ aula, onClose, onConcluir }) {
  const ref = useRef(null);
  const [pronto, setPronto] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [concluida, setConcluida] = useState(false);
  const [semApi, setSemApi] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [naTela, setNaTela] = useState(0);

  const player = useRef(null);
  const timer = useRef(null);
  const assistido = useRef(0);   // segundos de aula que passaram de verdade
  const ultimo = useRef(0);      // onde a agulha estava na última conferida

  useEffect(() => {
    if (!aula) return;
    setPronto(false); setProgresso(0); setConcluida(false);
    setRodando(false); setNaTela(0);
    assistido.current = 0;
    ultimo.current = 0;

    const iniciar = () => {
      if (!ref.current || !window.YT?.Player) return;
      player.current = new window.YT.Player(ref.current, {
        videoId: aula.id,
        playerVars: {
          rel: 0,             // sem sugestão de outro canal no fim
          controls: 0,        // sem barra pra arrastar
          disablekb: 1,       // sem seta do teclado pulando
          fs: 0,              // sem tela cheia, que traz a marca junto
          iv_load_policy: 3,  // sem cartão clicável por cima
          playsinline: 1,
          modestbranding: 1,
        },
        events: {
          onReady: () => { setPronto(true); ultimo.current = 0; },
          onStateChange: (e) => {
            setRodando(e.data === 1);

            if (e.data === 1) {
              clearInterval(timer.current);
              timer.current = setInterval(() => {
                try {
                  const p = player.current;
                  const d = p.getDuration();
                  if (!(d > 0)) return;

                  const agora = p.getCurrentTime();
                  const vel = p.getPlaybackRate?.() || 1;

                  assistido.current += trechoValido(ultimo.current, agora, vel);
                  ultimo.current = agora;

                  setProgresso(Math.min(100, Math.round((assistido.current / d) * 100)));
                } catch { /* player fechando */ }
              }, 1000);
            } else {
              clearInterval(timer.current);
              try { ultimo.current = player.current?.getCurrentTime?.() ?? ultimo.current; }
              catch { /* player fechando */ }
            }

            /* chegou no fim sozinho, então assistiu */
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

  /* ---------- quando o app não consegue medir ----------
     Sem a API do YouTube não dá pra saber onde a agulha está. Em
     vez de liberar o botão na hora, que é o atalho mais fácil de
     todos, o app cobra o tempo de relógio com a aula aberta. Não
     dá pra apressar, e quem está de fato assistindo nem percebe. */
  useEffect(() => {
    if (!semApi || !aula) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setNaTela((n) => n + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [semApi, aula]);

  useEffect(() => {
    if (!semApi || !aula) return;
    const alvo = Math.max(1, Math.round(aula.d * FRACAO_PRA_CONCLUIR));
    setProgresso(Math.min(100, Math.round((naTela / alvo) * 100)));
    if (naTela >= alvo) setConcluida(true);
  }, [naTela, semApi, aula]);

  useEffect(() => {
    if (progresso >= FRACAO_PRA_CONCLUIR * 100 && !concluida) setConcluida(true);
  }, [progresso, concluida]);

  function virarPlay() {
    const p = player.current;
    if (!p) return;
    try { rodando ? p.pauseVideo() : p.playVideo(); } catch { /* player fechando */ }
  }

  if (!aula) return null;

  const vistos = Math.round((progresso / 100) * aula.d);

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
            disabled={!concluida}
            onClick={() => { onConcluir(aula, vistos); onClose(); }}
          >
            {concluida ? 'Marcar como vista' : `Faltam ${100 - progresso}%`}
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
          />
        ) : (
          <div ref={ref} />
        )}
      </div>

      {semApi && (
        <div className="valida atencao">
          <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.6 }}>
            Não consegui acompanhar o quanto você assistiu, então vou pelo tempo com a aula aberta.
            Costuma ser bloqueador de anúncio.
          </p>
        </div>
      )}

      <div className="col" style={{ gap: 9 }}>
        {!semApi && (
          <Btn
            size="sm"
            icon={rodando ? Pause : Play}
            onClick={virarPlay}
            disabled={!pronto}
            style={{ alignSelf: 'flex-start' }}
          >
            {rodando ? 'Pausar' : 'Tocar'}
          </Btn>
        )}

        <Bar v={progresso} max={100} tone={concluida ? 'jade' : ''} />
        <span className="micro muted">
          {concluida
            ? 'Pode marcar como vista.'
            : progresso > 0
              ? `${progresso}% assistido. O botão libera aos 90%, e pular pra frente não conta.`
              : pronto || semApi ? 'Toque no play pra começar.' : 'Carregando a aula.'}
        </span>
      </div>
    </Sheet>
  );
}
