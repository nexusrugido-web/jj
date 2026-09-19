import React, { useEffect, useState, useCallback, useRef, lazy, Suspense, startTransition } from 'react';
import { AppCtx, useApp } from './contexto';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSeed, getMeta, setMeta, DEFAULT_SETTINGS, registrarSync, limparDuplicados, migrarGameplans, renomearAntigos, consertarAulasVistas } from './db/db';
import { ToastProvider } from './components/UI';
import Layout from './components/Layout';
import InstallPrompt from './components/InstallPrompt';
import Tour from './components/Tour';
import { marcarEngajamento , vigiarAtualizacao } from './lib/pwa';
import { supabase, supabaseConfigurado, sessaoAtual } from './lib/supabase';
import { enfileirar, iniciarSync, onSync, sincronizar, migrarParaNuvem } from './lib/sync';
import { resumo as calcResumo } from './lib/stats';
import { minhasTecnicas, resumoGraus } from './lib/graus';
import { sincronizarAcesso, acessoLocal } from './lib/plano';
import { subirPerfil, mexeuNoPerfil } from './lib/perfil';
import { acervoLocal, sincronizarAcervo, observarAcervo } from './lib/acervo';
import { subirPraLiga } from './lib/liga';
import { enviarMedidas } from './lib/medir';
import { carregarCompras } from './lib/pago';
import { carregarAjustes, observarAjustes } from './lib/ajustes';
import { carregarLinks, observarLinks } from './lib/links';
import { registrarErro, marcarPasso, erroDeAcesso } from './lib/monitor';
import { carregarChaves, carregarRecado, souAdmin, ligada, observarChaves, todasAsChaves } from './lib/chaves';
import { sincronizarMarcos } from './lib/milestones';
import { analisarJogo, placarDaRola } from './lib/game';
import { somarPontos } from './db/scoring';

import Painel from './pages/Painel';
import Aceite, { VERSAO_DOCS } from './components/Aceite';

/* Só o Painel e a tela de treinos vêm no primeiro carregamento.
   O resto chega quando você abre, o que deixa a abertura bem mais
   leve em celular mais simples. */
const Estudo = lazy(() => import('./pages/Estudo'));
const Analise = lazy(() => import('./pages/Analise'));
const Tecnicas = lazy(() => import('./pages/Tecnicas'));
const Academia = lazy(() => import('./pages/Academia'));
const Nutricao = lazy(() => import('./pages/Nutricao'));
const Respiracao = lazy(() => import('./pages/Respiracao'));
const Lesoes = lazy(() => import('./pages/Lesoes'));
const Competicoes = lazy(() => import('./pages/Competicoes'));
const Parceiros = lazy(() => import('./pages/Parceiros'));
const Admin = lazy(() => import('./pages/Admin'));
const Termos = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Termos })));
const Privacidade = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Privacidade })));
const MeuJogo = lazy(() => import('./pages/MeuJogo'));
const Metas = lazy(() => import('./pages/Metas'));
const Jornada = lazy(() => import('./pages/Jornada'));
const Dominio = lazy(() => import('./pages/Dominio'));
import Treinos from './pages/Treinos';
import Conquistas, { Celebracao } from './pages/Conquistas';
import Ajustes from './pages/Ajustes';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';

/* o contexto vive em contexto.js pra não criar ciclo com as telas */

const PAGINAS = {
  painel: Painel, treinos: Treinos, tecnicas: Tecnicas,
  estudo: Estudo, jornada: Jornada, admin: Admin,
  termos: Termos, privacidade: Privacidade, dominio: Dominio, meujogo: MeuJogo, analise: Analise, conquistas: Conquistas,
  metas: Metas, parceiros: Parceiros, competicoes: Competicoes,
  academia: Academia, nutricao: Nutricao, respiracao: Respiracao,
  lesoes: Lesoes, ajustes: Ajustes,
};

/* liga os hooks do banco na fila de sincronização */
registrarSync(enfileirar);

function rotaDaURL() {
  const p = new URLSearchParams(location.search).get('go');
  return PAGINAS[p] ? p : 'painel';
}

/* Cada tela chega num arquivo separado, pra o app abrir rápido.
   Quando alguma coisa trava no meio do caminho, isto aparece em
   vez de uma tela em branco.

   A tela não fala em erro nem em quebra. Quem está pra registrar
   o treino depois de sair do tatame não quer saber que o app
   falhou, quer o botão de volta. Ela tenta sozinha uma vez,
   porque a causa quase sempre é o arquivo da tela que ainda não
   chegou, e isso se resolve recarregando. */
class RedeDaPagina extends React.Component {
  constructor(p) { super(p); this.state = { erro: null, tentou: false }; }
  static getDerivedStateFromError(erro) { return { erro }; }

  componentDidCatch(erro) {
    console.error('[tela]', erro);
    registrarErro('tela', erro);

    /* uma tentativa automática, e só uma. Se a segunda também
       falhar, é problema de verdade e insistir só piora. */
    if (!this.state.tentou) {
      this.setState({ tentou: true });
      this.recarregar = setTimeout(() => this.setState({ erro: null }), 600);
    }
  }

  componentWillUnmount() { clearTimeout(this.recarregar); }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="page" style={{ display: 'grid', placeItems: 'center', minHeight: '50svh' }}>
        <div className="col center" style={{ alignItems: 'center', gap: 14, textAlign: 'center', maxWidth: 320 }}>
          <span className="brand-mark pulse" style={{ width: 44, height: 44, borderRadius: 14 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Carregando esta tela</div>
            <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
              Está demorando mais que o normal. Se você tem o app aberto em outra aba, feche ela: duas abas
              disputando o banco do aparelho seguram tudo.
            </p>
          </div>
          <button className="btn primary" onClick={() => location.reload()}>Abrir de novo</button>
        </div>
      </div>
    );
  }
}

export default function App() {
  const [pronto, setPronto] = useState(false);
  const [rota, setRota] = useState(rotaDaURL);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [instalarAberto, setInstalarAberto] = useState(false);
  const [sessao, setSessao] = useState(null);
  const [telaLogin, setTelaLogin] = useState(false);
  const [modoLogin, setModoLogin] = useState('entrar');
  const [erroBoot, setErroBoot] = useState([]);
  const [onboarding, setOnboarding] = useState(false);
  const [precisaAceitar, setPrecisaAceitar] = useState(false);
  const [tourAberto, setTourAberto] = useState(false);
  const [atualizar, setAtualizar] = useState(null);
  const [acesso, setAcesso] = useState({ premium: false, status: 'checando' });
  const [chaves, setChaves] = useState(todasAsChaves);
  const [ehAdmin, setEhAdmin] = useState(false);
  const [recado, setRecado] = useState(null);
  const [sync, setSync] = useState({ ligado: false, rodando: false, pendentes: 0 });
  const [celebrar, setCelebrar] = useState(null);
  const marcosChecados = useRef(false);

  useEffect(() => vigiarAtualizacao((aplicar) => setAtualizar(() => aplicar)), []);

  /* As chaves de recurso mudam no painel do administrador, e a tela
     precisa reagir na hora. Sem este ouvinte, ligar a liga só
     aparecia depois de fechar e abrir o app. */
  useEffect(() => observarChaves(setChaves), []);

  /* o acervo chega do servidor depois da tela montar. Sem este
     aviso, o Estudo fica com a lista velha até alguém recarregar. */
  const [acervoVer, setAcervoVer] = useState(0);
  useEffect(() => observarAcervo(() => setAcervoVer((n) => n + 1)), []);
  useEffect(() => observarAjustes(() => setAcervoVer((n) => n + 1)), []);
  useEffect(() => observarLinks(() => setAcervoVer((n) => n + 1)), []);
  const ligadaAgora = useCallback(
    (id) => (chaves ? (chaves[id] ?? ligada(id)) : ligada(id)),
    [chaves]
  );

  /* ---------- boot ---------- */
  /* Rede de segurança: aconteça o que acontecer, o app abre. */
  useEffect(() => {
    const t = setTimeout(() => {
      setPronto((p) => {
        if (!p) console.warn('[boot] abriu pelo tempo limite');
        return true;
      });
    }, 15000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    (async () => {
      /* Nada aqui pode impedir o app de abrir. Se qualquer etapa falhar,
         o app entra mesmo assim e mostra o erro em Ajustes. */
      const comTempo = (fn, ms) => Promise.race([
        Promise.resolve().then(fn),
        new Promise((_, rej) => setTimeout(() => rej(new Error(`demorou mais de ${ms / 1000}s`)), ms)),
      ]);

      const passo = async (nome, fn, ms = 12000) => {
        try { return await comTempo(fn, ms); }
        catch (e) {
          console.error('[boot]', nome, e);
          setErroBoot((a) => [...a, `${nome}: ${e?.message || e}`]);
          return null;
        }
      };

      await passo('seed', ensureSeed);
      /* a cópia local do acervo entra antes da primeira tela, senão
         o Estudo abre com o acervo velho e troca na cara da pessoa */
      await passo('acervo', acervoLocal);
      await passo('limpar duplicados', limparDuplicados);
      await passo('migrar planos', migrarGameplans);
      await passo('renomear posições', renomearAntigos);
      await passo('consertar aulas vistas', consertarAulasVistas);

      const s = (await passo('config', () => getMeta('settings', DEFAULT_SETTINGS))) || DEFAULT_SETTINGS;
      const completo = {
        ...DEFAULT_SETTINGS, ...s,
        mostrarNoDash: { ...DEFAULT_SETTINGS.mostrarNoDash, ...(s.mostrarNoDash || {}) },
      };
      settingsRef.current = completo;
      setSettings(completo);

      if (supabaseConfigurado) {
        const params = new URLSearchParams(location.search);
        const querRecuperar = params.get('recuperar') === '1' ||
          location.hash.includes('type=recovery');
        const sess = await passo('sessão', sessaoAtual, 8000);
        setSessao(sess);
        if (querRecuperar) { setModoLogin('nova_senha'); setTelaLogin(true); }
        const jaViu = await getMeta('viu_login', false);
        if (!sess && !jaViu) setTelaLogin(true);
        if (sess) {
          iniciarSync();
          const migrou = await getMeta('migrou_nuvem', false);
          if (!migrou) {
            await passo('migrar nuvem', migrarParaNuvem, 20000);
            await setMeta('migrou_nuvem', true);
          }
        }
      }

      /* o app já pode abrir. O resto chega quando chegar. */
      if (!s?.aceite || s.aceite.versao !== VERSAO_DOCS) setPrecisaAceitar(true);
      else if (!s?.onboardingFeito) setOnboarding(true);
      else if (!s?.tourVisto) setTimeout(() => setTourAberto(true), 800);
      setPronto(true);

      carregarChaves()
        .then(() => carregarRecado())
        .then(setRecado)
        .catch(() => {});
      souAdmin().then(setEhAdmin).catch(() => {});
      /* o perfil sobe antes dos pontos: é a frequência dele que
         escolhe o grupo quando o primeiro ponto da semana chega */
      subirPerfil(s).catch(() => {}).then(() => subirPraLiga()).catch(() => {});
      enviarMedidas().catch(() => {});
      sincronizarAcervo().catch(() => {});
      carregarCompras().catch(() => {});
      carregarAjustes().catch(() => {});
      carregarLinks().catch(() => {});
      acessoLocal().then(setAcesso).catch(() => {});
      sincronizarAcesso().then(setAcesso).catch(erroDeAcesso);
      marcarEngajamento();
    })();
  }, []);

  /* O vídeo novo também chega quando o app volta pra frente. No
     celular o app instalado fica dias aberto sem recarregar, e só
     buscar na abertura deixava o aluno sem as aulas novas. Busca só
     a diferença, e no máximo a cada 10 minutos. */
  useEffect(() => {
    let ultima = Date.now();
    const aoVoltar = () => {
      /* saindo da tela: o que o Estudo mediu sobe antes */
      if (document.visibilityState !== 'visible') { enviarMedidas().catch(() => {}); return; }
      enviarMedidas().catch(() => {});
      /* os pontos da liga só sobem se mudou alguma coisa */
      subirPraLiga().catch(() => {});
      if (Date.now() - ultima < 10 * 60 * 1000) return;
      ultima = Date.now();
      sincronizarAcervo().catch(() => {});
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, []);

  /* ---------- auth listener ---------- */
  useEffect(() => {
    if (!supabaseConfigurado) return;
    const { data } = supabase.auth.onAuthStateChange(async (evento, sess) => {
      setSessao(sess);
      if (evento === 'PASSWORD_RECOVERY') {
        setModoLogin('nova_senha');
        setTelaLogin(true);
        return;
      }
      if (evento === 'SIGNED_IN') {
        setTelaLogin(false);
        await setMeta('viu_login', true);
        iniciarSync();
        const migrou = await getMeta('migrou_nuvem', false);
        if (!migrou) { await migrarParaNuvem(); await setMeta('migrou_nuvem', true); }
        else sincronizar({ forcar: true });
        subirPraLiga().catch(() => {});
      }
    });
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => onSync((st) => {
    setSync(st);
    if (st.ultimo && !st.rodando) limparDuplicados().catch(() => {});
  }), []);

  /* ---------- rotas ---------- */
  useEffect(() => {
    const pop = () => startTransition(() => setRota(rotaDaURL()));
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  const irPara = useCallback((id, params = {}) => {
    /* Cada tela chega num arquivo separado. Sem avisar que isto é
       uma transição, o React entende o toque como entrada direta,
       e se o arquivo ainda não baixou ele derruba a tela em vez de
       esperar. No celular, que é mais lento, isso acontece sempre. */
    startTransition(() => setRota(id));
    const url = new URL(location.href);
    url.searchParams.set('go', id);
    url.searchParams.delete('novo');
    url.searchParams.delete('abrir');
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined) url.searchParams.delete(k);
      else url.searchParams.set(k, String(v));
    }
    history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  /* Guarda o que está gravado no banco, não o que está na tela.
     Se salvar usando uma cópia velha, tudo que o usuário já tinha
     configurado some, e ele perde faixa, nome e preferências. */
  const settingsRef = useRef(null);

  const salvarSettings = useCallback(async (patch) => {
    /* lê do banco antes de escrever. É uma leitura a mais, e ela
       impede de apagar configuração por acidente. */
    let atual = settingsRef.current;
    if (!atual) {
      try { atual = await getMeta('settings', DEFAULT_SETTINGS); }
      catch { atual = DEFAULT_SETTINGS; }
    }

    const novo = { ...DEFAULT_SETTINGS, ...atual, ...patch };
    settingsRef.current = novo;
    setSettings(novo);
    try { await setMeta('settings', novo); } catch (e) { console.error('[settings]', e); }

    /* faixa, graus, nome e ritmo aparecem pros outros na liga.
       Só sobe quando um deles muda, pra não falar com o servidor
       toda vez que alguém fecha o tour. */
    if (mexeuNoPerfil(patch)) subirPerfil(novo).catch(() => {});

    return novo;
  }, []);

  /* ---------- dados globais ---------- */
  const positions = useLiveQuery(() => db.positions.filter((p) => !p.arquivada).sortBy('ordem'), [], []);
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.arquivada).sortBy('ordem'), [], []);
  const techniques = useLiveQuery(() => db.techniques.filter((t) => !t.arquivada).toArray(), [], []);
  const partners = useLiveQuery(() => db.partners.filter((p) => !p.arquivada).toArray(), [], []);
  const sessions = useLiveQuery(() => db.sessions.orderBy('data').reverse().toArray(), [], []);
  const rolls = useLiveQuery(() => db.rolls.toArray(), [], []);
  const reviews = useLiveQuery(() => db.reviews.toArray(), [], []);
  const goals = useLiveQuery(() => db.goals.toArray(), [], []);

  /* ---------- tema ---------- */
  useEffect(() => {
    document.documentElement.dataset.belt = settings.faixa || 'branca';
    if (settings.acento && settings.acento !== 'belt') document.documentElement.dataset.accent = settings.acento;
    else delete document.documentElement.dataset.accent;
  }, [settings.faixa, settings.acento]);

  /* ---------- marcos (o lugar do XP) ---------- */
  useEffect(() => {
    if (!pronto || !sessions || !rolls || !techniques || !partners) return;
    if (!sessions.length) return;
    const t = setTimeout(async () => {
      const r = calcResumo(sessions, rolls);
      const esteira = minhasTecnicas(rolls, partners, sessions, techniques, settings.faixa);
      const dom = resumoGraus(esteira);
      const primeira = rolls.find((x) => (x.subsAplicadas || []).length)?.subsAplicadas?.[0] || null;

      const jogo = analisarJogo(rolls, partners, sessions, settings.faixa);
      const faixaDe = new Map(partners.map((p) => [p.id, p.faixa || 'branca']));
      const ordem = { branca: 0, azul: 1, roxa: 2, marrom: 3, preta: 4 };
      const minha = ordem[settings.faixa] ?? 0;
      const raspouAcima = rolls.some((x) =>
        (x.ptsMeus || []).includes('raspagem') && (ordem[faixaDe.get(x.partnerId)] ?? 0) > minha);
      const pesadas = rolls.filter((x) => x.pesoRel === 'pesado');
      const saldoPesado = pesadas.length >= 5 &&
        pesadas.reduce((a, x) => a + somarPontos(x.ptsMeus) - somarPontos(x.ptsDele), 0) > 0;

      const novos = await sincronizarMarcos({
        matHoras: r.matHoras, rolas: r.rolas, sessoes: r.sessoes,
        dominadas: dom.g3 + dom.g4, primeiraFinalizacao: primeira,
        streakRecorde: r.streak.recorde,
        pontos: jogo.ptsMeus,
        primeiraRaspagemAcima: raspouAcima,
        saldoPositivoPesado: saldoPesado,
        taxaVitoria: jogo.taxaVitoria,
        rolasComPontos: jogo.rolas,
      });

      if (novos.length && settings.celebrar !== false && marcosChecados.current) {
        setCelebrar(novos[novos.length - 1]);
      }
      marcosChecados.current = true;
    }, 900);
    return () => clearTimeout(t);
  }, [pronto, sessions, rolls, techniques, partners, settings.faixa, settings.celebrar]);

  if (!pronto) {
    return (
      <div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 20 }}>
        <div className="col center" style={{ alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <span className="brand-mark pulse" style={{ width: 54, height: 54, borderRadius: 16 }} />
          <span className="eyebrow">carregando o tatame</span>
          <button
            className="btn ghost xs"
            style={{ marginTop: 18, opacity: 0.7 }}
            onClick={() => setPronto(true)}
          >
            Demorando? Toque pra entrar assim mesmo
          </button>
        </div>
      </div>
    );
  }

  if (telaLogin) {
    return (
      <ToastProvider>
        <Login modoInicial={modoLogin} onPular={async () => { await setMeta('viu_login', true); setTelaLogin(false); setModoLogin('entrar'); }} />
      </ToastProvider>
    );
  }

  /* O aceite vem antes de tudo, e ele mesmo deixa abrir os
     documentos sem sair da tela. */
  if (precisaAceitar && rota !== 'termos' && rota !== 'privacidade') {
    return (
      <ToastProvider>
        <Aceite
          irPara={irPara}
          onSair={() => { window.location.href = 'about:blank'; }}
          onAceitar={async (registro) => {
            await salvarSettings({ aceite: registro });
            setPrecisaAceitar(false);
            const s = await getMeta('settings', DEFAULT_SETTINGS);
            if (!s?.onboardingFeito) setOnboarding(true);
          }}
        />
      </ToastProvider>
    );
  }

  /* os documentos abrem mesmo antes do aceite */
  if (precisaAceitar && (rota === 'termos' || rota === 'privacidade')) {
    const Doc = PAGINAS[rota];
    return (
      <ToastProvider>
        <Suspense fallback={<div className="entrada"><span className="brand-mark pulse" /></div>}>
          <Doc onVoltar={() => irPara('painel')} />
        </Suspense>
      </ToastProvider>
    );
  }

  if (onboarding) {
    return (
      <ToastProvider>
        <Onboarding
          settings={settings}
          salvarSettings={salvarSettings}
          onPronto={async () => { await salvarSettings({ onboardingFeito: 1 }); setOnboarding(false); }}
        />
      </ToastProvider>
    );
  }

  const Pagina = PAGINAS[rota] || Painel;
  const ctx = {
    settings, salvarSettings, irPara, rota,
    positions: positions || [], categories: categories || [], techniques: techniques || [],
    partners: partners || [], sessions: sessions || [], rolls: rolls || [],
    reviews: reviews || [], goals: goals || [],
    sessao, sync, erroBoot, acervoVer,
    abrirInstalar: () => setInstalarAberto(true),
    abrirLogin: () => setTelaLogin(true),
    refazerOnboarding: () => setOnboarding(true),
    abrirTour: () => setTourAberto(true),
    acesso,
    chaves,
    ehAdmin,
    ligada: ligadaAgora,
    recarregarChaves: () => carregarChaves(),
    recarregarAcesso: () => sincronizarAcesso().then(setAcesso),
  };

  const badges = {};

  return (
    <ToastProvider>
      <AppCtx.Provider value={ctx}>
        {/* O painel tem a casca dele. Quem administra nao precisa do
            menu de Treinos e Nutricao em volta, e ter aquilo do lado
            fazia o painel parecer uma aba perdida do app. */}
        {rota === 'admin' ? (
          <RedeDaPagina>
            <Suspense fallback={<div className="entrada"><span className="brand-mark pulse" /></div>}>
              <Pagina key={rota} />
            </Suspense>
          </RedeDaPagina>
        ) : (
          <Layout
            ehAdmin={ehAdmin}
            recado={recado}
            ligada={ligadaAgora}
            onComoUsar={() => setTourAberto(true)}
            rota={rota} irPara={irPara} settings={settings} badges={badges} sync={sync}
            onInstalar={() => setInstalarAberto(true)}
          >
            <Pagina key={rota} />
          </Layout>
        )}
        <InstallPrompt forcarAberto={instalarAberto} onFechar={() => setInstalarAberto(false)} />
        {atualizar && (
          <div className="aviso-update">
            <span className="tiny">Tem uma versão nova do app.</span>
            <button className="btn primary xs" onClick={atualizar}>Atualizar</button>
            <button className="btn ghost xs" onClick={() => setAtualizar(null)}>Depois</button>
          </div>
        )}
        <Tour aberto={tourAberto} onClose={() => setTourAberto(false)} onConcluir={() => salvarSettings({ tourVisto: 1 })} />
        <Celebracao marco={celebrar} onFechar={() => setCelebrar(null)} />
      </AppCtx.Provider>
    </ToastProvider>
  );
}
