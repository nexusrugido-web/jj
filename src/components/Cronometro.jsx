import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCcw, Volume2, VolumeX, Plus, Minus, Check,
} from 'lucide-react';
import { Card, Btn, Sheet } from './UI';

/* ============================================================
   CRONÔMETRO DE ROLA

   Apita alto no começo e no fim, porque no tatame tem barulho
   e o celular fica longe. Quando o round acaba, pergunta se
   você quer registrar aquele rola ali mesmo, enquanto está
   fresco na cabeça.

   A conta é pelo relógio, não por "tique": guarda a hora em que a
   fase acaba e calcula quanto falta. Com o app no fundo o celular
   congela os tiques, e a contagem antiga atrasava e travava; agora,
   ao voltar, o número está certo (e as fases que passaram no fundo
   já passaram). Com o app no fundo e os avisos ligados, o fim do
   round chega como aviso do celular.
   ============================================================ */

const PRESETS = [
  { rola: 5, descanso: 1, nome: '5 e 1' },
  { rola: 6, descanso: 1, nome: '6 e 1' },
  { rola: 7, descanso: 2, nome: '7 e 2' },
  { rola: 10, descanso: 2, nome: '10 e 2' },
];

/* som gerado na hora, sem arquivo pra baixar */
function apito(tipo = 'fim') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const agora = ctx.currentTime;

    const tocar = (freq, inicio, dur, volume = 0.9) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, agora + inicio);
      g.gain.setValueAtTime(0, agora + inicio);
      g.gain.linearRampToValueAtTime(volume, agora + inicio + 0.01);
      g.gain.setValueAtTime(volume, agora + inicio + dur - 0.03);
      g.gain.linearRampToValueAtTime(0, agora + inicio + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(agora + inicio); osc.stop(agora + inicio + dur);
    };

    if (tipo === 'inicio') {
      tocar(880, 0, 0.18);
      tocar(1180, 0.22, 0.32);
    } else if (tipo === 'aviso') {
      tocar(660, 0, 0.12, 0.5);
    } else {
      tocar(1180, 0, 0.25);
      tocar(1180, 0.32, 0.25);
      tocar(880, 0.64, 0.5);
    }

    setTimeout(() => ctx.close(), 2000);
  } catch { /* navegador sem áudio, segue sem som */ }
}

function vibrar(padrao) {
  try { navigator.vibrate?.(padrao); } catch { /* sem vibração */ }
}

function avisarNoFundo(titulo, corpo) {
  try {
    if (!document.hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    navigator.serviceWorker?.ready?.then((reg) => reg.showNotification(titulo, {
      body: corpo, tag: 'cronometro', renotify: true, icon: '/icon-192.png', badge: '/badge-96.png',
      vibrate: [200, 100, 200, 100, 400], data: { navigate: '/?go=treinos', soFocar: true },
    })).catch(() => {});
  } catch { /* sem aviso */ }
}

export default function Cronometro({ aberto, onClose, onRegistrar }) {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [fase, setFase] = useState('parado');   // parado | rola | descanso
  const [resta, setResta] = useState(PRESETS[0].rola * 60);
  const [round, setRound] = useState(1);
  const [som, setSom] = useState(true);
  const [perguntar, setPerguntar] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [fechado, setFechado] = useState(0);      // o round que acabou de fechar

  const tick = useRef(null);
  const acordado = useRef(null);
  const fimEm = useRef(0);        // a hora (ms) em que a fase atual acaba
  const sobrou = useRef(0);       // o que faltava quando pausou (ms)
  const avisou = useRef(0);       // o último apito de "falta pouco"
  const noFundo = useRef(null);   // o aviso do celular marcado pro fim da fase
  const rodando = fase !== 'parado' && !pausado;

  /* mantém a tela ligada durante o round, e religa ao voltar pro app
     (o celular solta a trava sempre que o app vai pro fundo) */
  useEffect(() => {
    const soltar = () => { acordado.current?.release?.().catch(() => {}); acordado.current = null; };
    if (!rodando) { soltar(); return undefined; }
    const pedir = () => {
      if (document.hidden) return;
      navigator.wakeLock?.request?.('screen').then((s) => { acordado.current = s; }).catch(() => {});
    };
    pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => { document.removeEventListener('visibilitychange', pedir); soltar(); };
  }, [rodando]);

  /* a conta: quanto falta pra hora marcada. Fase que acabou com o app
     no fundo já passa direto pra próxima, quantas vezes precisar */
  useEffect(() => {
    if (!rodando) { clearInterval(tick.current); clearTimeout(noFundo.current); return undefined; }
    let faseAgora = fase;
    let roundAgora = round;

    const marcarAviso = () => {
      clearTimeout(noFundo.current);
      const falta = fimEm.current - Date.now();
      noFundo.current = setTimeout(() => avisarNoFundo(
        faseAgora === 'rola' ? '⏱️ Acabou o round' : '🥋 Bora pro próximo round',
        faseAgora === 'rola' ? 'Hora do descanso. Toca pra anotar o rola.' : 'O descanso acabou.',
      ), Math.max(0, falta));
    };

    const conferir = () => {
      const agora = Date.now();
      let virou = false;
      while (agora >= fimEm.current) {
        virou = true;
        if (faseAgora === 'rola') {
          setFechado(roundAgora);
          setPerguntar(true);
          faseAgora = 'descanso';
          fimEm.current += preset.descanso * 60000;
        } else {
          roundAgora += 1;
          faseAgora = 'rola';
          fimEm.current += preset.rola * 60000;
        }
      }
      if (virou) {
        if (som) apito(faseAgora === 'descanso' ? 'fim' : 'inicio');
        vibrar(faseAgora === 'descanso' ? [200, 100, 200, 100, 400] : [120, 80, 200]);
        setFase(faseAgora);
        setRound(roundAgora);
        marcarAviso();
      }
      const r = Math.max(0, Math.ceil((fimEm.current - agora) / 1000));
      /* um minuto e dez segundos pro fim, o mesmo apito: no tatame
         alguém grita "1 minuto" e todo mundo acelera o que falta */
      if ((r === 61 || r === 11) && faseAgora === 'rola' && som && avisou.current !== r) { avisou.current = r; apito('aviso'); }
      setResta(r);
    };

    marcarAviso();
    conferir();
    tick.current = setInterval(conferir, 250);
    document.addEventListener('visibilitychange', conferir);
    return () => { clearInterval(tick.current); clearTimeout(noFundo.current); document.removeEventListener('visibilitychange', conferir); };
  }, [rodando, preset, som]); // eslint-disable-line react-hooks/exhaustive-deps

  function comecar() {
    if (som) apito('inicio');
    vibrar([120, 80, 200]);
    fimEm.current = Date.now() + preset.rola * 60000;
    avisou.current = 0;
    setRound(1);
    setPausado(false);
    setFase('rola');
    setResta(preset.rola * 60);
  }

  function pausar() {
    sobrou.current = Math.max(0, fimEm.current - Date.now());
    setPausado(true);
  }

  function continuar() {
    fimEm.current = Date.now() + sobrou.current;
    setPausado(false);
  }

  function zerar() {
    clearInterval(tick.current);
    clearTimeout(noFundo.current);
    setFase('parado');
    setPausado(false);
    setRound(1);
    setResta(preset.rola * 60);
    setPerguntar(false);
  }

  const mm = String(Math.floor(resta / 60)).padStart(2, '0');
  const ss = String(resta % 60).padStart(2, '0');
  const total = (fase === 'descanso' ? preset.descanso : preset.rola) * 60;
  const pct = fase === 'parado' ? 0 : ((total - resta) / total) * 100;
  const acabando = fase === 'rola' && resta <= 10;

  return (
    <Sheet aberto={aberto} onClose={() => { zerar(); onClose(); }} titulo="Cronômetro" wide>
      <div className="crono">
        <svg viewBox="0 0 200 200" className="crono-anel">
          <circle cx="100" cy="100" r="88" fill="none" stroke="var(--seam)" strokeWidth="8" />
          <circle
            cx="100" cy="100" r="88" fill="none"
            stroke={fase === 'descanso' ? 'var(--ice)' : acabando ? 'var(--blood)' : 'var(--accent)'}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 88}
            strokeDashoffset={2 * Math.PI * 88 * (1 - pct / 100)}
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }}
          />
        </svg>
        <div className="crono-centro">
          <div className={`crono-num num ${acabando ? 'piscando' : ''}`}>{mm}:{ss}</div>
          <div className="crono-fase">
            {fase === 'parado' ? 'pronto' : pausado ? 'pausado' : fase === 'rola' ? `round ${round}` : 'descanso'}
          </div>
        </div>
      </div>

      {fase === 'parado' && (
        <>
          <div className="seletor-pill">
            {PRESETS.map((p) => (
              <button
                key={p.nome}
                className={preset.nome === p.nome ? 'on' : ''}
                onClick={() => { setPreset(p); setResta(p.rola * 60); }}
              >{p.nome}</button>
            ))}
          </div>
          <div className="row" style={{ gap: 16, justifyContent: 'center' }}>
            <Ajuste
              label="rola"
              valor={preset.rola}
              onMudar={(v) => { const p = { ...preset, rola: v, nome: `${v} e ${preset.descanso}` }; setPreset(p); setResta(v * 60); }}
            />
            <Ajuste
              label="descanso"
              valor={preset.descanso}
              onMudar={(v) => setPreset({ ...preset, descanso: v, nome: `${preset.rola} e ${v}` })}
            />
          </div>
        </>
      )}

      <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
        {fase === 'parado' ? (
          <Btn variant="primary" icon={Play} onClick={comecar} style={{ minHeight: 52, paddingInline: 32, fontSize: 16 }}>
            Começar
          </Btn>
        ) : (
          <>
            {pausado
              ? <Btn variant="primary" icon={Play} onClick={continuar} style={{ minHeight: 48 }}>Continuar</Btn>
              : <Btn icon={Pause} onClick={pausar} style={{ minHeight: 48 }}>Pausar</Btn>}
            <Btn variant="ghost" icon={RotateCcw} onClick={zerar} style={{ minHeight: 48 }}>Zerar</Btn>
          </>
        )}
        <button
          className="btn ghost icon"
          onClick={() => setSom(!som)}
          style={{ minHeight: 48, minWidth: 48 }}
          aria-label={som ? 'Desligar som' : 'Ligar som'}
        >
          {som ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
      </div>

      {fase !== 'parado' && (
        <p className="micro muted center">
          A tela fica acesa enquanto o cronômetro roda. Apita dez segundos antes de acabar e de novo no fim. Se sair do app, a conta continua certa, e com os avisos ligados o fim do round chega no celular.
        </p>
      )}

      {/* o convite pra registrar, na hora que o round acabou */}
      {perguntar && (
        <Card className="accent">
          <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
            <span className="stat-ico"><Check size={16} /></span>
            <div style={{ flex: 1 }}>
              <div className="tiny" style={{ fontWeight: 600 }}>Round {fechado} fechado</div>
              <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.6 }}>
                Quer anotar esse rola agora, enquanto está fresco? Leva uns quinze segundos.
              </p>
              <div className="row wrap" style={{ gap: 8, marginTop: 11 }}>
                <Btn size="sm" variant="primary" onClick={() => { setPerguntar(false); onRegistrar?.(preset.rola); }}>
                  Anotar o rola
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => setPerguntar(false)}>Depois</Btn>
              </div>
            </div>
          </div>
        </Card>
      )}
    </Sheet>
  );
}

function Ajuste({ label, valor, onMudar }) {
  return (
    <div className="center">
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <button className="btn ghost icon sm" onClick={() => onMudar(Math.max(1, valor - 1))}><Minus size={13} /></button>
        <span className="num" style={{ fontSize: 20, fontWeight: 700, minWidth: 34, textAlign: 'center' }}>{valor}</span>
        <button className="btn ghost icon sm" onClick={() => onMudar(Math.min(30, valor + 1))}><Plus size={13} /></button>
      </div>
      <div className="micro muted" style={{ marginTop: 5 }}>minutos</div>
    </div>
  );
}
