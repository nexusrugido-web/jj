import React, { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, Compass } from 'lucide-react';
import { Btn } from './UI';
import {
  detectarPlataforma, temPromptNativo, onMudanca, instalar,
  dispensar, podeConvidar, ehStandalone,
} from '../lib/pwa';

export default function InstallPrompt({ forcarAberto, onFechar }) {
  const [visivel, setVisivel] = useState(false);
  const [nativo, setNativo] = useState(temPromptNativo());
  const p = detectarPlataforma();

  useEffect(() => onMudanca(setNativo), []);

  useEffect(() => {
    if (forcarAberto) { setVisivel(true); return; }
    const t = setTimeout(() => { if (podeConvidar()) setVisivel(true); }, 3500);
    return () => clearTimeout(t);
  }, [forcarAberto, nativo]);

  const fechar = (comDispensa) => {
    if (comDispensa) dispensar(14);
    setVisivel(false);
    onFechar?.();
  };

  if (!visivel) return null;

  if (ehStandalone() && !forcarAberto) return null;

  const jaInstalado = ehStandalone();

  return (
    <div className="install-card" role="dialog" aria-label="Instalar o app">
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className="stat-ico" style={{ width: 38, height: 38, borderRadius: 12, flex: 'none' }}>
          <Smartphone size={19} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
            {jaInstalado ? 'Já tá instalado' : 'Instala o NeuroJitsu no celular'}
          </div>
          <p className="tiny muted" style={{ marginTop: 2 }}>
            {jaInstalado
              ? 'Você já está rodando o app instalado. Boa.'
              : 'Abre direto da tela de início, funciona sem internet e registra o rola em segundos no vestiário.'}
          </p>
        </div>
        <button className="btn ghost icon sm" onClick={() => fechar(true)} aria-label="Agora não">
          <X size={16} />
        </button>
      </div>

      {!jaInstalado && (
        <>
          {nativo ? (
            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              <Btn
                variant="primary"
                icon={Download}
                onClick={async () => {
                  const r = await instalar();
                  if (r === 'accepted') fechar(false);
                }}
                style={{ flex: 1 }}
              >
                Instalar agora
              </Btn>
              <Btn variant="ghost" onClick={() => fechar(true)}>Agora não</Btn>
            </div>
          ) : p.iOS ? (
            <div className="install-steps">
              {p.navegadorIOSSemInstalar && (
                <div className="install-step" style={{ color: 'var(--roar)' }}>
                  <Compass size={15} />
                  <span>Abre este link no <b>Safari</b>, só ele instala no iPhone.</span>
                </div>
              )}
              <div className="install-step">
                <span className="install-n">1</span>
                <span>Toque em <b>Compartilhar</b></span>
                <Share size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="install-step">
                <span className="install-n">2</span>
                <span>Escolha <b>Adicionar à Tela de Início</b></span>
                <PlusSquare size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="install-step">
                <span className="install-n">3</span>
                <span>Confirme em <b>Adicionar</b>. Pronto.</span>
              </div>
              <Btn variant="primary" onClick={() => fechar(false)} style={{ marginTop: 6 }}>Entendi</Btn>
            </div>
          ) : (
            <div className="install-steps">
              <div className="install-step">
                <span className="install-n">1</span>
                <span>Abra o menu do navegador (<b>⋮</b>)</span>
              </div>
              <div className="install-step">
                <span className="install-n">2</span>
                <span>Toque em <b>Instalar app</b> ou <b>Adicionar à tela de início</b></span>
              </div>
              <Btn variant="primary" onClick={() => fechar(false)} style={{ marginTop: 6 }}>Entendi</Btn>
            </div>
          )}
        </>
      )}
      {jaInstalado && (
        <Btn variant="primary" onClick={() => fechar(false)} style={{ marginTop: 12, width: '100%' }}>Fechar</Btn>
      )}
    </div>
  );
}
