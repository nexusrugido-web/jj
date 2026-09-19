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

/* ============================================================
   SE O APP INTEIRO CAIR

   A primeira resposta é abrir de novo sozinho, com a mesma cara da
   abertura: quase sempre é o arquivo de uma versão nova que ainda
   não tinha chegado, e recarregar resolve. O aluno nem percebe.

   Só se cair de novo logo em seguida aparece uma tela, e ela fala
   em abrir, não em quebra. O erro técnico vai pro monitoramento,
   não pra tela.
   ============================================================ */
const JA_RECARREGOU = 'rede:recarregou';

function podeRecarregarSozinho() {
  try {
    const ultima = Number(sessionStorage.getItem(JA_RECARREGOU)) || 0;
    if (Date.now() - ultima < 60000) return false;
    sessionStorage.setItem(JA_RECARREGOU, String(Date.now()));
    return true;
  } catch {
    /* sem armazenamento não dá pra saber se já tentou: não arrisca repetir pra sempre */
    return false;
  }
}

class Rede extends React.Component {
  constructor(p) { super(p); this.state = { erro: null, desistiu: false }; }
  static getDerivedStateFromError(erro) { return { erro }; }
  componentDidCatch(erro, info) {
    console.error('[app]', erro, info);
    import('./lib/monitor').then((m) => m.registrarErro?.(erro, { onde: 'raiz' })).catch(() => {});
    if (podeRecarregarSozinho()) this.recarga = setTimeout(() => location.reload(), 700);
    else this.setState({ desistiu: true });
  }
  componentWillUnmount() { clearTimeout(this.recarga); }
  render() {
    if (!this.state.erro) return this.props.children;
    const { desistiu } = this.state;
    return (
      <div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <div className="col center" style={{ alignItems: 'center', gap: 14, maxWidth: 320 }}>
          <span className="brand-mark pulse" style={{ width: 54, height: 54, borderRadius: 16 }} />
          <span className="eyebrow">{desistiu ? 'quase lá' : 'carregando o tatame'}</span>
          {desistiu && (
            <>
              <p className="tiny muted" style={{ lineHeight: 1.65 }}>
                O app não abriu de primeira. Seus treinos estão guardados no aparelho.
              </p>
              <button className="btn primary" onClick={() => location.reload()}>Abrir de novo</button>
              <button
                className="btn ghost xs"
                style={{ opacity: 0.7 }}
                onClick={() => { location.href = location.origin + location.pathname + '?limpar=1'; }}
              >
                Ainda não abriu? Limpar a memória do app
              </button>
            </>
          )}
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
