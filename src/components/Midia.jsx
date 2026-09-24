import React, { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Play, Image as ImgIcon, Film, CloudOff, Loader } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { supabaseConfigurado, enviarArquivo, urlAssinada, apagarArquivo, sessaoAtual, traduzErro } from '../lib/supabase';
import { Btn, Chip, useToast } from './UI';
import { hoje, fmtData } from '../lib/utils';

const MAX_MB = 45; // o plano free do Supabase corta em 50MB por arquivo

export function Midia({ vinculoTipo, vinculoId, compacto = false }) {
  const toast = useToast();
  const input = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [logado, setLogado] = useState(false);

  const itens = useLiveQuery(
    () => db.media.filter((m) => m.vinculoTipo === vinculoTipo && m.vinculoId === vinculoId).toArray(),
    [vinculoTipo, vinculoId], []
  ) || [];

  useEffect(() => { sessaoAtual().then((s) => setLogado(!!s)); }, []);

  async function escolher(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;

    if (!supabaseConfigurado || !logado) {
      toast('Entre na sua conta pra guardar vídeos e fotos', 'err');
      return;
    }

    setEnviando(true);
    for (const f of files) {
      try {
        if (f.size > MAX_MB * 1024 * 1024) {
          toast(`"${f.name}" tem mais de ${MAX_MB}MB. Comprime o vídeo antes.`, 'err');
          continue;
        }
        const tipo = f.type.startsWith('video') ? 'video' : 'image';
        const { caminho, bucket } = await enviarArquivo(f, { pasta: vinculoTipo || 'geral' });
        await db.media.add({
          tipo, bucket, caminho, nome: f.name, tamanho: f.size,
          vinculoTipo, vinculoId, marcas: [], data: hoje(), criadoEm: Date.now(),
        });
        toast(tipo === 'video' ? 'Vídeo salvo' : 'Foto salva');
      } catch (err) {
        toast(traduzErro(err), 'err');
      }
    }
    setEnviando(false);
  }

  async function remover(m) {
    try { if (m.caminho) await apagarArquivo(m.caminho); } catch { /* já pode ter sumido */ }
    await db.media.delete(m.id);
    toast('Removido');
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Btn
          size="sm"
          icon={enviando ? Loader : Upload}
          onClick={() => input.current?.click()}
          disabled={enviando}
        >
          {enviando ? 'Enviando…' : 'Foto ou vídeo'}
        </Btn>
        {itens.length > 0 && <Chip>{itens.length} {itens.length === 1 ? 'arquivo' : 'arquivos'}</Chip>}
        {!supabaseConfigurado && <Chip tone="blood"><CloudOff size={11} /> nuvem desligada</Chip>}
        {supabaseConfigurado && !logado && <Chip tone="warn">precisa entrar na conta</Chip>}
        <input
          ref={input} type="file" multiple
          accept="image/*,video/*"
          onChange={escolher}
          style={{ display: 'none' }}
        />
      </div>

      {itens.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: compacto ? 'repeat(auto-fill,minmax(96px,1fr))' : 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
          {itens.map((m) => <Cartao key={m.id} m={m} onRemover={() => remover(m)} />)}
        </div>
      )}
    </div>
  );
}

function Cartao({ m, onRemover }) {
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState(false);
  const [abrir, setAbrir] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!m.caminho) return;
    urlAssinada(m.caminho, 3600)
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, [m.caminho]);

  return (
    <div className="card pad-0" style={{ overflow: 'hidden', position: 'relative' }}>
      <div style={{ aspectRatio: '4/3', background: 'var(--void)', display: 'grid', placeItems: 'center', position: 'relative' }}>
        {erro && <span className="micro muted center" style={{ padding: 8 }}>não carregou</span>}
        {!erro && !url && <Loader size={16} className="pulse muted" />}
        {url && m.tipo === 'image' && (
          <img src={url} alt={m.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        )}
        {url && m.tipo === 'video' && !abrir && (
          <button
            onClick={() => setAbrir(true)}
            style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--void)' }}
          >
            <span className="stat-ico" style={{ width: 40, height: 40 }}><Play size={18} /></span>
          </button>
        )}
        {url && m.tipo === 'video' && abrir && (
          <video src={url} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        )}
      </div>
      <div className="row" style={{ padding: '7px 9px', gap: 6 }}>
        {m.tipo === 'video' ? <Film size={12} className="muted" /> : <ImgIcon size={12} className="muted" />}
        <span className="micro muted truncate" style={{ flex: 1 }}>{fmtData(m.data, { curto: true })}</span>
        <button className="btn ghost icon sm" onClick={onRemover} aria-label="Remover"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

export default Midia;
