import React, { useState, useRef, useEffect } from 'react';
import { Check, Play, Pause, TriangleAlert, Maximize, Minimize, Subtitles } from 'lucide-react';
import { Btn, Sheet, Bar } from './UI';
import { embed, duracaoTexto } from '../db/aulas';
import { trechoValido, ondePodeVoltar } from '../lib/aulas';

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

   A tela cheia é nossa e não a do YouTube, porque a dele devolve
   a interface inteira junto, com a barra pra arrastar e o botão
   que leva pra fora. Aqui o vídeo ocupa o aparelho e os controles
   continuam sendo os do app.
   ============================================================ */

/* o quanto da aula precisa ter passado pra contar como vista */
const FRACAO_PRA_CONCLUIR = 0.9;

export default function Player({ aula, onClose, onConcluir }) {
  const ref = useRef(null);
  const caixa = useRef(null);
  const sumir = useRef(null);
  const [cheio, setCheio] = useState(false);
  const [controles, setControles] = useState(true);
  const [pronto, setPronto] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [concluida, setConcluida] = useState(false);
  const [semApi, setSemApi] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [naTela, setNaTela] = useState(0);
  const [agora, setAgora] = useState(0);      // onde a agulha está
  const [ate, setAte] = useState(0);          // até onde já foi assistido
  const [legendas, setLegendas] = useState(false);

  const player = useRef(null);
  const timer = useRef(null);
  const assistido = useRef(0);   // segundos de aula que passaram de verdade
  const ultimo = useRef(0);      // onde a agulha estava na última conferida
  const limite = useRef(0);      // o ponto mais longe que a aula já chegou

  useEffect(() => {
    if (!aula) return;
    setPronto(false); setProgresso(0); setConcluida(false);
    setRodando(false); setNaTela(0);
    assistido.current = 0;
    ultimo.current = 0;
    limite.current = 0;
    setAgora(0); setAte(0); setLegendas(false);

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
          cc_load_policy: 0,  // legenda não entra sozinha
        },
        events: {
          onReady: () => {
            setPronto(true);
            ultimo.current = 0;
            /* a conta do YouTube da pessoa pode forçar legenda
               automática mesmo com cc_load_policy zerado. Tirar o
               módulo é o único jeito que funciona sempre. */
            try { player.current?.unloadModule?.('captions'); } catch { /* sem o módulo */ }
            try { player.current?.unloadModule?.('cc'); } catch { /* sem o módulo */ }
          },
          onStateChange: (e) => {
            setRodando(e.data === 1);

            if (e.data === 1) {
              clearInterval(timer.current);
              timer.current = setInterval(() => {
                try {
                  const p = player.current;
                  const d = p.getDuration();
                  if (!(d > 0)) return;

                  const vel = p.getPlaybackRate?.() || 1;

                  const onde = p.getCurrentTime();
                  assistido.current += trechoValido(ultimo.current, onde, vel);
                  ultimo.current = onde;

                  /* o ponto mais longe que a aula chegou tocando. É até
                     aqui que a barra deixa voltar, e nem um segundo além. */
                  limite.current = Math.max(limite.current, onde);

                  setAgora(onde);
                  setAte(limite.current);
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

  /* ------------------------------------------------------------
     VOLTAR SIM, PULAR NAO

     A barra anda ate onde a aula ja chegou tocando, e nem um
     segundo alem. Da pra voltar e rever o pedaco que nao entrou,
     que e o motivo de existir barra numa aula, sem abrir a porta
     pra jogar a agulha no fim e marcar como vista.
     ------------------------------------------------------------ */
  function irPara(seg) {
    const pt = player.current;
    if (!pt) return;
    const alvo = ondePodeVoltar(seg, limite.current);
    try {
      pt.seekTo(alvo, true);
      ultimo.current = alvo;
      setAgora(alvo);
    } catch { /* player fechando */ }
    acordarControles();
  }

  function virarLegendas() {
    const pt = player.current;
    if (!pt) return;
    try {
      if (legendas) { pt.unloadModule('captions'); pt.unloadModule('cc'); }
      else { pt.loadModule('captions'); pt.loadModule('cc'); }
      setLegendas(!legendas);
    } catch { /* o video pode nao ter legenda */ }
    acordarControles();
  }

  function virarPlay() {
    const p = player.current;
    if (!p) return;
    try { rodando ? p.pauseVideo() : p.playVideo(); } catch { /* player fechando */ }
  }

  /* ---------- tela cheia ----------
     Tenta a de verdade do navegador e, dentro dela, deita o
     aparelho. Vídeo de aula é 16 por 9: em pé ele vira uma tira
     no meio da tela preta, que era o que estava acontecendo.

     O iPhone não deixa um elemento qualquer entrar em tela cheia
     nem deitar a tela na marra. Lá a classe do CSS estica o vídeo
     e a pessoa gira o aparelho na mão. */
  function virarCheio() {
    const alvo = caixa.current;
    if (!alvo) return;

    if (cheio) {
      try { screen.orientation?.unlock?.(); } catch { /* sem suporte */ }
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* sem suporte */ }
      setCheio(false);
      return;
    }

    setCheio(true);
    acordarControles();

    try {
      const p = alvo.requestFullscreen?.({ navigationUI: 'hide' });
      /* deitar a tela só é permitido depois que a tela cheia entrou */
      Promise.resolve(p)
        .then(() => screen.orientation?.lock?.('landscape'))
        .catch(() => { /* iPhone e computador não deitam, e tudo bem */ });
    } catch { /* fica com a classe do CSS */ }
  }

  /* os controles aparecem, e somem sozinhos se ninguém mexer */
  function acordarControles() {
    setControles(true);
    clearTimeout(sumir.current);
    sumir.current = setTimeout(() => setControles(false), 3500);
  }

  /* solta o recorte da folha enquanto a tela cheia estiver aberta */
  useEffect(() => {
    document.body.classList.toggle('player-cheio', cheio);
    return () => document.body.classList.remove('player-cheio');
  }, [cheio]);

  /* sair pelo gesto do aparelho ou pelo Esc precisa desmarcar */
  useEffect(() => {
    const sincronizar = () => {
      if (document.fullscreenElement) return;
      try { screen.orientation?.unlock?.(); } catch { /* sem suporte */ }
      setCheio(false);
    };
    document.addEventListener('fullscreenchange', sincronizar);
    return () => document.removeEventListener('fullscreenchange', sincronizar);
  }, []);

  useEffect(() => {
    if (!cheio) return;
    const esc = (e) => { if (e.key === 'Escape') virarCheio(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  });

  /* fechar a aula com a tela cheia aberta deixaria o aparelho
     preso nela, e deitado */
  useEffect(() => {
    if (!aula) {
      try { screen.orientation?.unlock?.(); } catch { /* sem suporte */ }
      if (document.fullscreenElement) {
        try { document.exitFullscreen(); } catch { /* sem suporte */ }
      }
      setCheio(false);
    }
  }, [aula]);

  useEffect(() => () => clearTimeout(sumir.current), []);

  if (!aula) return null;

  /* a mesma barra serve pra tela cheia e pra janela */
  const barra = (
    <div className="player-linha">
      <input
        className="player-range"
        type="range"
        min={0}
        max={Math.max(1, aula.d)}
        value={Math.round(agora)}
        step={1}
        disabled={semApi || ate < 2}
        onChange={(e) => irPara(e.target.value)}
        aria-label="Voltar na aula"
        style={{
          '--visto': Math.min(100, (ate / Math.max(1, aula.d)) * 100) + '%',
          '--agulha': Math.min(100, (agora / Math.max(1, aula.d)) * 100) + '%',
        }}
      />
      <span className="micro num muted" style={{ minWidth: 78, textAlign: 'right' }}>
        {duracaoTexto(Math.round(agora))} de {duracaoTexto(aula.d)}
      </span>
    </div>
  );

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
      {/* o vídeo fica sozinho, sem nada por cima dele. O YouTube
          exige isso. Os controles ficam embaixo, fora da área. */}
      <div ref={caixa} className={`player-caixa ${cheio ? 'cheio' : ''}`}>
        {semApi ? (
          <iframe
            src={embed(aula.id)}
            title={aula.t}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <div ref={ref} />
        )}

        {cheio && (
          <>
            {/* faixa invisível embaixo, pra acordar os controles
                sem precisar tocar em cima do vídeo */}
            <button className="player-toque" aria-label="Mostrar controles" onClick={acordarControles} />

            <div className={`player-barra ${controles ? '' : 'sumiu'}`}>
              {!semApi && (
                <button className="btn ghost xs" onClick={() => { virarPlay(); acordarControles(); }} disabled={!pronto}>
                  {rodando ? <Pause size={13} /> : <Play size={13} />}
                  {rodando ? 'Pausar' : 'Tocar'}
                </button>
              )}
              {barra}
              {!semApi && (
                <button className="btn ghost xs" onClick={virarLegendas} disabled={!pronto}>
                  <Subtitles size={13} /> {legendas ? 'Tirar legenda' : 'Legenda'}
                </button>
              )}
              <button className="btn ghost xs" onClick={virarCheio}>
                <Minimize size={13} /> Sair
              </button>
            </div>
          </>
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
        <div className="row" style={{ gap: 8 }}>
          {!semApi && (
            <Btn size="sm" icon={rodando ? Pause : Play} onClick={virarPlay} disabled={!pronto}>
              {rodando ? 'Pausar' : 'Tocar'}
            </Btn>
          )}
          <Btn size="sm" icon={Maximize} onClick={virarCheio}>Tela cheia</Btn>
          {!semApi && (
            <Btn size="sm" icon={Subtitles} onClick={virarLegendas} disabled={!pronto}>
              {legendas ? 'Tirar legenda' : 'Legenda'}
            </Btn>
          )}
        </div>

        {!semApi && barra}

        <Bar v={progresso} max={100} tone={concluida ? 'jade' : ''} />
        <span className="micro muted">
          {concluida
            ? 'Pode marcar como vista.'
            : progresso > 0
              ? `${progresso}% assistido. O botão libera aos 90%. Dá pra voltar e rever, mas não dá pra adiantar.`
              : pronto || semApi ? 'Toque no play pra começar.' : 'Carregando a aula.'}
        </span>

        {aula.descricao && (
          <p className="tiny muted" style={{ lineHeight: 1.65, marginTop: 4 }}>{aula.descricao}</p>
        )}
      </div>
    </Sheet>
  );
}
