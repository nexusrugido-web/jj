import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

/* Nada aqui pode impedir o app de montar. Monitoramento e service
   worker são acessórios, e acessório que quebra a entrada é pior
   que acessório nenhum. */
function tentar(nome, fn) {
  try { fn(); } catch (e) { console.warn('[arranque]', nome, e); }
}

/* o monitoramento carrega depois, sem segurar a tela */
setTimeout(() => {
  import('./lib/monitor')
    .then((m) => tentar('monitor', m.iniciarMonitor))
    .catch(() => {});
}, 2000);

setTimeout(() => {
  import('./lib/pwa')
    .then((m) => tentar('pwa', m.iniciarPWA))
    .catch(() => {});
}, 1200);

/* se o App explodir, o usuário vê o que houve e como sair disso */
class Rede extends React.Component {
  constructor(p) { super(p); this.state = { erro: null }; }
  static getDerivedStateFromError(erro) { return { erro }; }
  componentDidCatch(erro, info) {
    console.error('[app]', erro, info);
    import('./lib/monitor').then((m) => m.registrarErro?.(erro, { onde: 'raiz' })).catch(() => {});
  }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div style={{
        minHeight: '100svh', display: 'grid', placeItems: 'center',
        padding: 28, textAlign: 'center', background: '#0B0C0E', color: '#e8e6e1',
      }}>
        <div style={{ maxWidth: 340 }}>
          <img
            src="/icon-192.png"
            alt=""
            style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 18px', display: 'block' }}
          />
          <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>Algo quebrou aqui dentro</div>
          <p style={{ fontSize: 14, color: '#8b938f', lineHeight: 1.6 }}>
            Seus treinos estão salvos. Limpar a memória do aparelho costuma resolver.
          </p>
          <button
            onClick={() => { location.href = location.origin + location.pathname + '?limpar=1'; }}
            style={{
              marginTop: 20, background: '#F0A830', color: '#0B0C0E', border: 0,
              borderRadius: 12, padding: '14px 24px', fontSize: 15, fontWeight: 700,
            }}
          >
            Limpar e abrir de novo
          </button>
          <p style={{
            marginTop: 16, fontSize: 11, color: '#5a615e',
            fontFamily: 'ui-monospace, monospace', wordBreak: 'break-word',
          }}>
            {String(this.state.erro?.message || this.state.erro).slice(0, 160)}
          </p>
        </div>
      </div>
    );
  }
}

const raiz = document.getElementById('root');

try {
  createRoot(raiz).render(
    <Rede>
      <App />
    </Rede>
  );
  window.__appSubiu?.();
} catch (e) {
  console.error('[arranque] montagem', e);
  raiz.innerHTML =
    '<div style="min-height:100svh;display:grid;place-items:center;padding:28px;text-align:center;color:#e8e6e1">' +
    '<div><div style="font-size:18px;font-weight:700">Não consegui abrir</div>' +
    '<p style="font-size:13px;color:#8b938f;margin:10px 0 18px">Toque abaixo pra limpar a memória do aparelho.</p>' +
    '<a href="?limpar=1" style="background:#F0A830;color:#0B0C0E;border-radius:12px;padding:13px 22px;font-weight:700;text-decoration:none">Limpar e abrir</a>' +
    '</div></div>';
}
