import { useEffect, useRef, useState } from 'react';

/* Timer baseado no relogio real, nao em contagem de ticks.
   Assim ele nao "anda duas vezes" no StrictMode, nao acumula
   atraso e continua certo se a aba ficar em segundo plano. */
export function useCronometro() {
  const [decorrido, setDecorrido] = useState(0);
  const [rodando, setRodando] = useState(false);
  const base = useRef(0); // segundos acumulados antes do play atual
  const t0 = useRef(0);

  useEffect(() => {
    if (!rodando) return;
    t0.current = Date.now();
    const id = setInterval(() => {
      setDecorrido(base.current + Math.floor((Date.now() - t0.current) / 1000));
    }, 200);
    return () => {
      clearInterval(id);
      base.current = base.current + Math.floor((Date.now() - t0.current) / 1000);
    };
  }, [rodando]);

  const zerar = () => {
    setRodando(false);
    base.current = 0;
    setDecorrido(0);
  };

  const parar = () => setRodando(false);

  return { decorrido, rodando, setRodando, zerar, parar, setDecorrido };
}

export function vibrar(padrao) {
  try { if (navigator.vibrate) navigator.vibrate(padrao); } catch (e) { /* nada */ }
}

/* Dispara `fn` uma unica vez por marco atingido. */
export function useMarco(valor, fn) {
  const anterior = useRef(valor);
  useEffect(() => {
    if (valor !== anterior.current) {
      anterior.current = valor;
      fn(valor);
    }
  }, [valor]);
}
