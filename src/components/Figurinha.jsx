import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2, Copy, Link2 } from 'lucide-react';
import { Sheet, Btn, Seg, useToast } from './UI';
import { desenharFigurinha, paraPNG, INSTAGRAM } from '../lib/figurinha';
import { compartilhar } from '../lib/card';

/* ============================================================
   A FOLHA DA FIGURINHA

   Mostra a imagem pronta e três saídas: compartilhar (vai direto
   pro Instagram no celular), baixar o PNG e copiar, que é como o
   Strava faz: copia, abre o story e cola por cima da foto.

   dados  { selo, grande, sub, pct }
   link   opcional { tipo, dados, texto }: manda o card como link
   ============================================================ */
export default function Figurinha({ aberto, onClose, dados, link }) {
  const toast = useToast();
  const [fundo, setFundo] = useState('sem');
  const [url, setUrl] = useState(null);
  const blob = useRef(null);
  const chave = JSON.stringify(dados || {});

  useEffect(() => {
    if (!aberto) return undefined;
    let vivo = true;
    desenharFigurinha({ ...JSON.parse(chave), fundo: fundo === 'com' })
      .then(paraPNG)
      .then((b) => {
        if (!vivo || !b) return;
        blob.current = b;
        setUrl((antes) => { if (antes) URL.revokeObjectURL(antes); return URL.createObjectURL(b); });
      })
      .catch((e) => console.error('[figurinha]', e));
    return () => { vivo = false; };
  }, [aberto, fundo, chave]);

  const arquivo = () => new File([blob.current], 'neurojitsu.png', { type: 'image/png' });
  const podeCompartilhar = (() => {
    try { return !!blob.current && !!navigator.canShare?.({ files: [arquivo()] }); } catch { return false; }
  })();
  const podeCopiar = typeof window !== 'undefined' && 'ClipboardItem' in window && !!navigator.clipboard?.write;

  async function mandar() {
    try {
      await navigator.share({ files: [arquivo()], text: INSTAGRAM });
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Não abriu o compartilhar. Baixe a imagem.', 'err');
    }
  }

  function baixar() {
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurojitsu-${fundo === 'com' ? 'card' : 'figurinha'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function copiar() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob.current })]);
      toast('Copiada. No story, cole por cima da sua foto.');
    } catch {
      toast('Não deu pra copiar aqui. Baixe a imagem.', 'err');
    }
  }

  return (
    <Sheet aberto={aberto} onClose={onClose} titulo="Compartilhar no story">
      <Seg value={fundo} onChange={setFundo} options={[{ id: 'sem', nome: 'Sem fundo' }, { id: 'com', nome: 'Com fundo' }]} />

      <div className={`figurinha-previa ${fundo === 'sem' ? 'xadrez' : ''}`}>
        {url ? <img src={url} alt="Prévia da imagem" /> : <span className="micro muted">Montando a imagem…</span>}
      </div>

      <div className="col" style={{ gap: 8 }}>
        {podeCompartilhar && <Btn variant="primary" icon={Share2} onClick={mandar} disabled={!url}>Compartilhar</Btn>}
        <div className="row" style={{ gap: 8 }}>
          <Btn variant={podeCompartilhar ? 'contorno' : 'primary'} icon={Download} onClick={baixar} disabled={!url} style={{ flex: 1 }}>
            Baixar
          </Btn>
          {podeCopiar && (
            <Btn variant="contorno" icon={Copy} onClick={copiar} disabled={!url} style={{ flex: 1 }}>Copiar</Btn>
          )}
        </div>
        {link && (
          <Btn variant="ghost" icon={Link2} onClick={async () => {
            const r = await compartilhar(link.tipo, link.dados, link.texto);
            if (r === 'copiado') toast('Link copiado');
            else if (r === 'erro') toast('Não consegui gerar o link agora', 'err');
          }}>Mandar como link</Btn>
        )}
      </div>

      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        {fundo === 'sem'
          ? `Sem fundo é pra ir por cima da sua foto: no story, cole a imagem copiada ou use a figurinha de foto. Marque ${INSTAGRAM}.`
          : `Com fundo dá pra postar sozinha, no story ou no feed. Marque ${INSTAGRAM}.`}
      </p>
    </Sheet>
  );
}
