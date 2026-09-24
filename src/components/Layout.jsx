import React, { useState } from 'react';
import {
  LayoutDashboard, NotebookPen, Library, Swords, Repeat, ChartNoAxesColumn,
  Target, Wind, Dumbbell, HeartPulse, Trophy, Users, Settings as Cog,
  MoreHorizontal, Download, Award, Apple, CloudOff, Cloud, RefreshCw, LogIn, Dna,
  GraduationCap, Flame, Shield, Megaphone, CircleHelp, X, UsersRound,
} from 'lucide-react';
import { Modal } from './UI';

export const ROTAS_TODAS = [
  { id: 'painel', nome: 'Painel', icon: LayoutDashboard, grupo: 'No tatame' },
  { id: 'treinos', nome: 'Treinos e rolas', icon: NotebookPen, grupo: 'No tatame' },
  { id: 'tecnicas', nome: 'Técnicas', icon: Library, grupo: 'No tatame' },
  { id: 'estudo', nome: 'Estudo', icon: GraduationCap, grupo: 'No tatame' },
  { id: 'liga', nome: 'Liga', icon: Flame, grupo: 'No tatame' },
  { id: 'amigos', nome: 'Amigos', icon: UsersRound, grupo: 'No tatame' },

  { id: 'meujogo', nome: 'Meu jogo', icon: Dna, grupo: 'Evolução' },
  { id: 'dominio', nome: 'Minhas técnicas', icon: Award, grupo: 'Evolução' },
  { id: 'analise', nome: 'Análise', icon: ChartNoAxesColumn, grupo: 'Evolução' },
  { id: 'conquistas', nome: 'Conquistas', icon: Trophy, grupo: 'Evolução' },
  { id: 'metas', nome: 'Metas', icon: Target, grupo: 'Evolução' },
  { id: 'parceiros', nome: 'Parceiros', icon: Users, grupo: 'Evolução' },

  { id: 'academia', nome: 'Academia', icon: Dumbbell, grupo: 'Corpo' },
  { id: 'nutricao', nome: 'Nutrição', icon: Apple, grupo: 'Corpo' },
  { id: 'respiracao', nome: 'Gás', icon: Wind, grupo: 'Corpo' },
  { id: 'lesoes', nome: 'Lesões', icon: HeartPulse, grupo: 'Corpo' },

  { id: 'admin', nome: 'Painel', icon: Shield, grupo: 'Sistema', admin: true },
  { id: 'ajustes', nome: 'Ajustes', icon: Cog, grupo: 'Sistema' },
];

const POR_CHAVE = { estudo: 'estudo', academia: 'musculacao', amigos: 'liga' };

const visiveis = (ehAdmin, ligada) => ROTAS_TODAS.filter((r) => {
  if (r.admin && !ehAdmin) return false;
  const chave = POR_CHAVE[r.id];
  if (chave && ligada && !ligada(chave)) return false;
  return true;
});

const MOBILE = ['painel', 'treinos', 'metas', 'estudo'];

export default function Layout({ rota, irPara, settings, badges = {}, sync, onInstalar, ehAdmin = false, recado = null, ligada, onComoUsar, children }) {
  const [mais, setMais] = useState(false);
  /* o recado some depois de fechado e só volta quando o admin publicar
     outro: a marca é a hora em que ele foi salvo no painel */
  const marcaDoRecado = recado ? String(recado.atualizado || `${recado.titulo}|${recado.texto}`) : '';
  const [fechado, setFechado] = useState(() => { try { return localStorage.getItem('recado:fechado') || ''; } catch { return ''; } });
  const fecharRecado = () => {
    setFechado(marcaDoRecado);
    try { localStorage.setItem('recado:fechado', marcaDoRecado); } catch { /* sem armazenamento, some só até recarregar */ }
  };
  const grupos = [...new Set(visiveis(ehAdmin, ligada).map((r) => r.grupo))];
  const atual = ROTAS_TODAS.find((r) => r.id === rota);

  const Link = ({ r }) => (
    <button className={`navlink ${rota === r.id ? 'on' : ''}`} onClick={() => irPara(r.id)}>
      <r.icon size={17} />
      {r.nome}
      {badges[r.id] > 0 && <span className="navlink-badge num">{badges[r.id]}</span>}
    </button>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <button className="brand" onClick={onComoUsar} title="Como o app funciona">
          <span className="brand-mark" />
          <div>
            <div className="brand-name">NeuroJitsu</div>
            <div className="brand-sub">jiu-jitsu</div>
          </div>
        </button>

        {grupos.map((g) => (
          <div key={g}>
            <div className="nav-group eyebrow">{g}</div>
            {visiveis(ehAdmin, ligada).filter((r) => r.grupo === g).map((r) => <Link key={r.id} r={r} />)}
          </div>
        ))}

        <div className="spacer" />
        <div className="divider" style={{ margin: '14px 10px' }} />
        <div className="micro muted" style={{ padding: '4px 10px 8px' }}>
          {settings.nome || 'Sem nome'}{settings.academia && ` · ${settings.academia}`}
        </div>
        <SyncStatus sync={sync} irPara={irPara} />
        <button className="navlink" onClick={onInstalar} style={{ fontSize: 13 }}>
          <Download size={16} /> Instalar no celular
        </button>
      </aside>

      <main className="main">
        <div className="topbar">
          <span className="brand-mark" style={{ width: 30, height: 30, borderRadius: 9 }} />
          <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
            {atual?.nome || 'NeuroJitsu'}
          </div>
          <span className="spacer" />
          {/* "como usar" explica o app inteiro: mora na home, que é
              onde a pessoa chega, e não em cima de cada tela */}
          {rota === 'painel' && (
            <button className="btn-ajuda-topo" onClick={onComoUsar}>
              <CircleHelp size={15} />
              <span className="btn-ajuda-txt">Como usar</span>
            </button>
          )}
          <SyncPonto sync={sync} />
        </div>
        {recado?.texto && fechado !== marcaDoRecado && (
          <div className={`recado ${recado.tom || 'info'}`}>
            <Megaphone size={15} style={{ flex: 'none', marginTop: 2, color: `var(--${recado.tom === 'bom' ? 'jade' : recado.tom === 'atencao' ? 'roar' : 'ice'})` }} />
            <div>
              {recado.titulo && <div className="tiny" style={{ fontWeight: 600 }}>{recado.titulo}</div>}
              <p className="micro muted" style={{ marginTop: recado.titulo ? 4 : 0, lineHeight: 1.6 }}>{recado.texto}</p>
              {recado.link && (
                <a className="btn ghost xs" href={recado.link} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
                  Saiba mais
                </a>
              )}
            </div>
            <button className="btn ghost icon sm recado-fechar" onClick={fecharRecado} aria-label="Fechar recado">
              <X size={15} />
            </button>
          </div>
        )}
        {children}
      </main>

      <nav className="mobilebar">
        {MOBILE.map((id) => {
          const r = ROTAS_TODAS.find((x) => x.id === id);
          return (
            <button key={id} className={rota === id ? 'on' : ''} onClick={() => irPara(id)}>
              <span className="mb-ico"><r.icon size={19} /></span>
              {r.nome.split(' ')[0]}
            </button>
          );
        })}
        <button className={!MOBILE.includes(rota) ? 'on' : ''} onClick={() => setMais(true)}>
          <span className="mb-ico"><MoreHorizontal size={19} /></span>
          Mais
        </button>
      </nav>

      <Modal aberto={mais} onClose={() => setMais(false)} titulo="Todos os módulos">
        {grupos.map((g) => {
          const itens = visiveis(ehAdmin, ligada).filter((r) => r.grupo === g && !MOBILE.includes(r.id));
          if (!itens.length) return null;
          return (
            <div key={g}>
              <div className="eyebrow" style={{ marginBottom: 9 }}>{g}</div>
              <div className="grid g2" style={{ gap: 9, marginBottom: 6 }}>
                {itens.map((r) => (
                  <button key={r.id} className="card hover"
                    style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-start', textAlign: 'left' }}
                    onClick={() => { irPara(r.id); setMais(false); }}>
                    <span className="stat-ico"><r.icon size={16} /></span>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.nome}</span>
                    {badges[r.id] > 0 && <span className="chip on micro">{badges[r.id]}</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <button className="card hover"
          style={{ padding: 13, display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', width: '100%' }}
          onClick={() => { setMais(false); onInstalar(); }}>
          <span className="stat-ico"><Download size={16} /></span>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>Instalar no celular</span>
        </button>
      </Modal>
    </div>
  );
}

function SyncPonto({ sync }) {
  if (!sync) return null;
  const cls = sync.rodando ? 'rodando' : sync.erro ? 'erro' : sync.ligado ? 'ok' : 'off';
  return <span className={`sync-dot ${cls}`} title={sync.ligado ? 'Sincronizando com a nuvem' : 'Só neste aparelho'} />;
}

function SyncStatus({ sync, irPara }) {
  if (!sync) return null;
  const Ico = sync.rodando ? RefreshCw : sync.ligado ? Cloud : CloudOff;
  return (
    <button className="navlink" onClick={() => irPara('ajustes')} style={{ fontSize: 12.5 }}>
      <Ico size={15} className={sync.rodando ? 'pulse' : ''} />
      {sync.rodando ? 'Sincronizando…' : sync.ligado ? 'Na nuvem' : 'Só neste aparelho'}
      {sync.pendentes > 0 && <span className="navlink-badge num">{sync.pendentes}</span>}
    </button>
  );
}
