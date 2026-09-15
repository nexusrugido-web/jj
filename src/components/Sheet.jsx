import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { RemoveScroll } from 'react-remove-scroll';

/* ============================================================
   SHEET, substitui o Modal antigo.
   No celular vira uma folha que sobe de baixo, com alça pra
   arrastar e fechar, e o conteúdo ROLA de verdade.
   O bug antigo: o body ficava travado e o iOS travava junto o
   scroll interno. Agora o travamento é feito pelo RemoveScroll,
   que libera o container marcado, e o container usa
   overscroll-behavior:contain pra não "vazar" o scroll.
   ============================================================ */

const ehMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 780px)').matches;

export default function Sheet({
  aberto, onClose, titulo, subtitulo, children, footer,
  wide = false, alturaMobile = 92,
}) {
  const [mobile, setMobile] = useState(ehMobile);
  const [arrastoY, setArrastoY] = useState(0);
  const [fechando, setFechando] = useState(false);
  const inicioY = useRef(null);
  const corpoRef = useRef(null);
  const painelRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 780px)');
    const fn = (e) => setMobile(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (!aberto) { setArrastoY(0); setFechando(false); return; }
    const esc = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aberto, onClose]);

  // foco inicial para leitores de tela
  useEffect(() => {
    if (aberto && painelRef.current) {
      const t = setTimeout(() => painelRef.current?.focus?.(), 60);
      return () => clearTimeout(t);
    }
  }, [aberto]);

  const fechar = useCallback(() => {
    setFechando(true);
    setTimeout(() => { onClose?.(); setFechando(false); setArrastoY(0); }, 180);
  }, [onClose]);

  /* --- arrastar pra fechar: SÓ pela alça e pelo cabeçalho.
         Assim o conteúdo continua rolando normalmente. --- */
  const onTouchStart = (e) => { inicioY.current = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (inicioY.current === null) return;
    const dy = e.touches[0].clientY - inicioY.current;
    if (dy > 0) {
      setArrastoY(dy);
      e.preventDefault();
    }
  };
  const onTouchEnd = () => {
    if (arrastoY > 110) fechar();
    else setArrastoY(0);
    inicioY.current = null;
  };

  if (!aberto) return null;

  const conteudo = (
    <RemoveScroll allowPinchZoom removeScrollBar={false}>
      <div
        className={`sheet-overlay ${fechando ? 'saindo' : ''}`}
        onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}
        onTouchStart={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}
      >
        <div
          ref={painelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={titulo || 'Janela'}
          className={`sheet ${wide ? 'wide' : ''} ${fechando ? 'saindo' : ''}`}
          style={{
            transform: arrastoY ? `translateY(${arrastoY}px)` : undefined,
            transition: arrastoY ? 'none' : undefined,
            ...(mobile ? { maxHeight: `${alturaMobile}dvh` } : {}),
          }}
        >
          {mobile && (
            <div
              className="sheet-grab"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <span />
            </div>
          )}

          <div
            className="sheet-head"
            onTouchStart={mobile ? onTouchStart : undefined}
            onTouchMove={mobile ? onTouchMove : undefined}
            onTouchEnd={mobile ? onTouchEnd : undefined}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 className="h-sec truncate">{titulo}</h3>
              {subtitulo && <p className="micro muted truncate" style={{ marginTop: 2 }}>{subtitulo}</p>}
            </div>
            <button className="btn ghost icon" onClick={fechar} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="sheet-body" ref={corpoRef}>
            {children}
          </div>

          {footer && <div className="sheet-foot">{footer}</div>}
        </div>
      </div>
    </RemoveScroll>
  );

  return createPortal(conteudo, document.body);
}

/* compatibilidade: quem já importava Modal continua funcionando */
export const Modal = ({ aberto, onClose, titulo, children, footer, wide }) => (
  <Sheet aberto={aberto} onClose={onClose} titulo={titulo} footer={footer} wide={wide}>
    {children}
  </Sheet>
);

export function ConfirmarSheet({ aberto, onClose, onConfirmar, titulo, texto, rotulo = 'Excluir' }) {
  return (
    <Sheet
      aberto={aberto}
      onClose={onClose}
      titulo={titulo}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn danger" onClick={() => { onConfirmar(); onClose(); }}>{rotulo}</button>
        </>
      }
    >
      <p className="muted">{texto}</p>
    </Sheet>
  );
}
