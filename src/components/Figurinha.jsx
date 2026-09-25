import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2, Copy, Link2, RefreshCw } from 'lucide-react';
import { Sheet, Btn, Seg, Diamante, useToast } from './UI';
import { useApp } from '../contexto';
import { FAIXAS } from '../db/seed';
import { podeVer } from '../lib/plano';
import { desenharFigurinha, paraPNG, INSTAGRAM, FRASES, TEMAS } from '../lib/figurinha';
import { compartilhar } from '../lib/card';

/* ============================================================
   A FOLHA DA FIGURINHA

   Mostra a imagem pronta e três saídas: compartilhar (vai direto
   pro Instagram no celular), baixar o PNG e copiar, que é como o
   Strava faz: copia, abre o story e cola por cima da foto.

   A pessoa escolhe o fundo, se sai com frase de impacto (e troca
   por outra) e a cor. Tudo é de graça, porque cada post leva o
   NeuroJitsu pra quem ainda não conhece; só as cores extras são
   do Premium, e a prévia mostra elas antes de pedir pra assinar.

   dados  { selo, grande, sub, pct, faixa }
   tipo   qual lista de frases (graduacao, recorde, ofensiva,
          semana, meta, marco)
   link   opcional { tipo, dados, texto }: manda o card como link
   ============================================================ */
export default function Figurinha({ aberto, onClose, dados, tipo = 'marco', link }) {
  const { acesso, settings, irPara } = useApp();
  const toast = useToast();
  const [fundo, setFundo] = useState('sem');
  const [comFrase, setComFrase] = useState('com');
  const frases = FRASES[tipo] || FRASES.marco;
  /* começa numa frase qualquer: senão todo mundo posta a mesma */
  const [qualFrase, setQualFrase] = useState(() => Math.floor(Math.random() * frases.length));
  const [tema, setTema] = useState('app');
  const [url, setUrl] = useState(null);
  const blob = useRef(null);
  const chave = JSON.stringify(dados || {});

  const faixa = settings.faixa || 'branca';
  /* a preta pega o vermelho da ponteira: cinza escuro some no fundo escuro */
  const corFaixa = faixa === 'preta' ? '#c1272d' : FAIXAS.find((f) => f.id === faixa)?.cor;
  const frase = comFrase === 'com' ? frases[qualFrase % frases.length] : '';
  const travado = !!TEMAS.find((t) => t.id === tema)?.premium && !podeVer(acesso, 'temasFigurinha');

  useEffect(() => {
    if (!aberto) return undefined;
    let vivo = true;
    desenharFigurinha({ ...JSON.parse(chave), frase, tema, corFaixa, fundo: fundo === 'com' })
      .then(paraPNG)
      .then((b) => {
        if (!vivo || !b) return;
        blob.current = b;
        setUrl((antes) => { if (antes) URL.revokeObjectURL(antes); return URL.createObjectURL(b); });
      })
      .catch((e) => console.error('[figurinha]', e));
    return () => { vivo = false; };
  }, [aberto, fundo, chave, frase, tema, corFaixa]);

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
      <div className={`figurinha-previa ${fundo === 'sem' ? 'xadrez' : ''}`}>
        {url ? <img src={url} alt="Prévia da imagem" /> : <span className="micro muted">Montando a imagem…</span>}
      </div>

      <div className="figurinha-opcoes">
        <Seg value={fundo} onChange={setFundo} options={[{ id: 'sem', nome: 'Sem fundo' }, { id: 'com', nome: 'Com fundo' }]} />
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Seg value={comFrase} onChange={setComFrase} options={[{ id: 'com', nome: 'Com frase' }, { id: 'sem', nome: 'Sem frase' }]} />
          </div>
          {comFrase === 'com' && (
            <button type="button" className="btn contorno icon sm" aria-label="Outra frase" title="Outra frase"
              onClick={() => setQualFrase((i) => i + 1)}>
              <RefreshCw size={16} />
            </button>
          )}
        </div>
        <Seg value={tema} onChange={setTema} options={TEMAS.map((t) => ({
          id: t.id,
          nome: t.premium ? <span className="row" style={{ gap: 5, justifyContent: 'center' }}>{t.nome} <Diamante size={12} /></span> : t.nome,
        }))} />
      </div>

      {travado ? (
        <div className="figurinha-premium">
          <p className="tiny" style={{ lineHeight: 1.6 }}>
            <b>A cor da faixa e o dourado são do Premium.</b> Na cor do app, a figurinha inteira continua de graça.
          </p>
          <Btn variant="primary" onClick={() => { onClose(); irPara('ajustes'); }} style={{ width: '100%' }}>Liberar no Premium</Btn>
        </div>
      ) : (
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
      )}

      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        {fundo === 'sem'
          ? `Sem fundo é pra ir por cima da sua foto: no story, cole a imagem copiada ou use a figurinha de foto. Marque ${INSTAGRAM}.`
          : `Com fundo dá pra postar sozinha, no story ou no feed. Marque ${INSTAGRAM}.`}
      </p>
    </Sheet>
  );
}
