import React, { useRef, useState } from 'react';
import {
  Download, Upload, Trash2, Check, Smartphone, Palette, User, Database,
  RefreshCw, FileJson, FileSpreadsheet, TriangleAlert, Cloud, CloudOff,
  LogOut, LogIn, Sparkles, Loader, Info, Bell, BellOff,
} from 'lucide-react';
import { useApp } from '../contexto';
import Plano from '../components/Plano';
import TesteVideo from '../components/TesteVideo';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportAll, importAll, wipeAll, toCSV, ensureSeed } from '../db/db';
import { FAIXAS } from '../db/seed';
import {
  Card, Btn, Field, Input, NumeroInput, Select, Switch, Modal, Chip, useToast, Stat, Confirmar, Stepper, BeltTag,
} from '../components/UI';
import { baixarArquivo, hoje } from '../lib/utils';
import { ehStandalone, detectarPlataforma } from '../lib/pwa';
import { supabaseConfigurado, sair, traduzErro } from '../lib/supabase';
import { sincronizar, migrarParaNuvem, limparCursor } from '../lib/sync';
import { iaDisponivel } from '../lib/ai';
import { podeNotificar, ligarNotificacao, desligarNotificacao, estaLigada } from '../lib/push';
import { useEffect } from 'react';

const ACENTOS = [
  { id: 'roar', nome: 'Âmbar', cor: '#f0a830' },
  { id: 'jade', nome: 'Jade', cor: '#2ed3a0' },
  { id: 'ice', nome: 'Gelo', cor: '#55b6ff' },
  { id: 'blood', nome: 'Brasa', cor: '#ef5a44' },
  { id: 'belt', nome: 'Cor da faixa', cor: 'transparent' },
];

const CARDS_DASH = [
  ['escada', 'Escada posicional'],
  ['dominio', 'Domínio e jogo A'],
  ['heat', 'Calendário de presença'],
  ['metas', 'Metas'],
  ['revisao', 'Revisão de hoje'],
  ['finalizacoes', 'Finalizações'],
];

export default function Ajustes() {
  const [toquesVersao, setToquesVersao] = useState(0);
  const { settings, salvarSettings, sessions, rolls, techniques, partners, abrirInstalar, sessao, sync, abrirLogin, erroBoot, abrirTour, refazerOnboarding, acesso, recarregarAcesso, ligada, irPara } = useApp();
  const [temIA, setTemIA] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const toast = useToast();
  const fileRef = useRef(null);
  const [zerar, setZerar] = useState(false);
  const [importando, setImportando] = useState(null);
  const plat = detectarPlataforma();

  useEffect(() => { iaDisponivel().then(setTemIA); }, []);

  const academias = useLiveQuery(() => db.academies.filter((a) => !a.arquivada).toArray(), [], []) || [];
  const professores = useLiveQuery(() => db.professors.filter((p) => !p.arquivada).toArray(), [], []) || [];

  const set = (k, v) => salvarSettings({ [k]: v });
  const setDash = (k, v) => salvarSettings({ mostrarNoDash: { ...settings.mostrarNoDash, [k]: v } });

  async function exportarJSON() {
    const dump = await exportAll();
    baixarArquivo(`tatame-backup-${hoje()}.json`, JSON.stringify(dump, null, 2));
    toast('Backup baixado');
  }

  async function exportarTecnicasCSV() {
    const rows = techniques.map((t) => ({
      nome: t.nome, nome_en: t.nomeEn, status: t.status, nivel: t.nivel,
      modo: t.modo, faixa_min: t.faixaMin, tags: (t.tags || []).join('|'), detalhes: t.detalhes,
    }));
    baixarArquivo(`tatame-tecnicas-${hoje()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
    toast('CSV baixado');
  }

  async function lerArquivo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dump = JSON.parse(await f.text());
      setImportando(dump);
    } catch (err) {
      toast('Arquivo inválido', 'err');
    }
    e.target.value = '';
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Ajustes</h1>
        </div>
      </div>

      {/* perfil */}
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h2 className="h-sec row" style={{ gap: 8 }}><User size={17} /> Perfil</h2>
          <BeltTag faixa={settings.faixa} graus={settings.graus} />
        </div>
        <div className="grid g2" style={{ gap: 12 }}>
          <Field label="Nome"><Input value={settings.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Como te chamam" /></Field>
          <Field label="Academia padrão" hint="Cadastre em Parceiros → Academias.">
            <Select value={settings.academiaPadraoId || ''} onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null;
              const prof = professores.find((p) => p.id === settings.professorPadraoId && p.academiaId === id);
              salvarSettings({ academiaPadraoId: id, professorPadraoId: prof ? settings.professorPadraoId : null });
            }}>
              <option value="">Escolha</option>
              {academias.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
          <Field label="Professor padrão">
            <Select value={settings.professorPadraoId || ''} onChange={(e) => set('professorPadraoId', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Nenhuma</option>
              {professores.filter((p) => !settings.academiaPadraoId || p.academiaId === settings.academiaPadraoId).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </Field>
          <Field label="Peso (kg)"><Input type="number" value={settings.pesoKg} onChange={(e) => set('pesoKg', e.target.value)} /></Field>
          <Field label="Faixa" hint="Filtra as finalizações legais pra você.">
            <Select value={settings.faixa} onChange={(e) => set('faixa', e.target.value)}>
              {FAIXAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </Select>
          </Field>
          <Field label="Graus"><Stepper value={settings.graus} onChange={(v) => set('graus', v)} min={0} max={4} /></Field>
          <Field label="Comecei a treinar em"><Input type="date" value={settings.inicioTreino} onChange={(e) => set('inicioTreino', e.target.value)} /></Field>
          <Field label="Meta de treinos por semana"><Stepper value={settings.metaSemanal} onChange={(v) => set('metaSemanal', v)} min={1} max={14} /></Field>
          <Field label="Meta de horas no ano" hint="3x/semana de 1h30 dá ~200h."><NumeroInput valor={settings.metaAnualHoras} onChange={(v) => set('metaAnualHoras', v)} /></Field>
          <Field label="Duração padrão do rola (min)"><Stepper value={settings.duracaoRolaPadrao} onChange={(v) => set('duracaoRolaPadrao', v)} min={1} max={20} /></Field>
        </div>
      </Card>

      {/* aparência */}
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head"><h2 className="h-sec row" style={{ gap: 8 }}><Palette size={17} /> Aparência</h2></div>
        <Field label="Cor de destaque">
          <div className="row wrap" style={{ gap: 8 }}>
            {ACENTOS.map((a) => (
              <button
                key={a.id}
                className={`chip ${settings.acento === a.id ? 'on' : ''}`}
                onClick={() => set('acento', a.id)}
                style={{ paddingLeft: 6 }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 5,
                  background: a.id === 'belt' ? 'linear-gradient(135deg,#edf2ef,#3b7ae4,#8b5cf6,#8a5a34)' : a.cor,
                }} />
                {a.nome}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Fundo" hint="O preto deixa a cor de destaque aparecer mais. O outro tinge o fundo com ela.">
          <div className="row wrap" style={{ gap: 8 }}>
            {[{ id: 'preto', nome: 'Preto' }, { id: 'cor', nome: 'Com a cor de destaque' }].map((f) => (
              <button
                key={f.id}
                className={`chip ${(settings.fundo === 'cor' ? 'cor' : 'preto') === f.id ? 'on' : ''}`}
                onClick={() => set('fundo', f.id)}
              >
                {f.nome}
              </button>
            ))}
          </div>
        </Field>

        <div className="divider" style={{ margin: '16px 0' }} />
        <div className="row" style={{ padding: '9px 11px', background: 'var(--void)', borderRadius: 10, marginBottom: 14 }}>
          <span className="tiny grow">Comemorar marcos em tela cheia</span>
          <Switch on={settings.celebrar !== false} onChange={(v) => set('celebrar', v)} />
        </div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>o que aparece no painel</div>
        <div className="grid g2" style={{ gap: 10 }}>
          {CARDS_DASH.map(([k, nome]) => (
            <div key={k} className="row" style={{ padding: '8px 10px', background: 'var(--void)', borderRadius: 10 }}>
              <span className="tiny grow">{nome}</span>
              <Switch on={settings.mostrarNoDash?.[k] !== false} onChange={(v) => setDash(k, v)} />
            </div>
          ))}
        </div>
      </Card>

      {erroBoot?.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: 'color-mix(in srgb, var(--blood) 35%, var(--seam))' }}>
          <div className="card-head">
            <h2 className="h-sec row" style={{ gap: 8 }}>
              <TriangleAlert size={17} style={{ color: 'var(--blood)' }} /> Avisos ao abrir o app
            </h2>
          </div>
          <p className="tiny muted" style={{ marginBottom: 10 }}>
            O app abriu mesmo assim, mas alguma etapa falhou. Se algo estiver estranho, é por aqui:
          </p>
          <div className="col" style={{ gap: 6 }}>
            {erroBoot.map((e, i) => (
              <p key={i} className="micro num" style={{ padding: '8px 10px', background: 'var(--void)', borderRadius: 9 }}>{e}</p>
            ))}
          </div>
        </Card>
      )}

      {ligada('cobranca') && <Plano acesso={acesso} recarregar={recarregarAcesso} />}

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h2 className="h-sec">Aprender a usar</h2>
        </div>
        <p className="tiny muted" style={{ marginBottom: 14 }}>
          Seis telas explicando como registrar treino, o que são os graus das técnicas e por que atacar e defender
          ficam separados.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <Btn icon={Info} onClick={abrirTour}>Ver o tour</Btn>
          <Btn variant="ghost" onClick={refazerOnboarding}>Refazer meu perfil</Btn>
        </div>
      </Card>

      <TesteVideo />

      {/* conta e nuvem */}
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h2 className="h-sec row" style={{ gap: 8 }}>
            {sync?.ligado ? <Cloud size={17} /> : <CloudOff size={17} />} Conta e sincronização
          </h2>
          {sync && <span className={`sync-dot ${sync.rodando ? 'rodando' : sync.erro ? 'erro' : sync.ligado ? 'ok' : 'off'}`} />}
        </div>

        {!supabaseConfigurado ? (
          <>
            <p className="tiny muted">
              A nuvem não está configurada neste deploy. O app funciona 100% assim, os dados ficam no aparelho.
              Pra ligar a sincronização, adicione na Vercel as variáveis
              <b style={{ color: 'var(--chalk)' }}> VITE_SUPABASE_URL</b> e
              <b style={{ color: 'var(--chalk)' }}> VITE_SUPABASE_ANON_KEY</b>, e rode o arquivo
              <b style={{ color: 'var(--chalk)' }}> supabase/schema.sql</b> no SQL Editor do Supabase.
            </p>
          </>
        ) : sessao ? (
          <>
            <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
              <Chip tone="jade"><Check size={11} /> {sessao.user?.email}</Chip>
              {sync?.pendentes > 0 && <Chip tone="warn">{sync.pendentes} {sync.pendentes === 1 ? 'pendente' : 'pendentes'}</Chip>}
              {sync?.ultimo && <Chip>último sync {new Date(sync.ultimo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Chip>}
            </div>
            {sync?.erro && <p className="micro" style={{ color: 'var(--blood)', marginBottom: 10 }}>{sync.erro}</p>}
            <p className="tiny muted" style={{ marginBottom: 14 }}>
              Seus treinos, técnicas, vídeos e metas sincronizam entre todos os seus aparelhos.
              Tudo continua funcionando offline, quando a internet volta, sobe sozinho.
            </p>
            <div className="row wrap" style={{ gap: 8 }}>
              <Btn icon={sincronizando ? Loader : RefreshCw} disabled={sincronizando} onClick={async () => {
                setSincronizando(true);
                const r = await sincronizar({ forcar: true });
                setSincronizando(false);
                toast(r.ok ? 'Sincronizado' : 'Não deu pra sincronizar agora', r.ok ? 'ok' : 'err');
              }}>Sincronizar agora</Btn>
              <Btn onClick={async () => {
                setSincronizando(true);
                const n = await migrarParaNuvem();
                setSincronizando(false);
                toast(`${n} registros enviados`);
              }}>Reenviar tudo</Btn>
              <span className="spacer" />
              <Btn variant="danger" icon={LogOut} onClick={async () => {
                await sair(); await limparCursor();
                toast('Você saiu, os dados continuam no aparelho');
                setTimeout(() => location.reload(), 600);
              }}>Sair</Btn>
            </div>
          </>
        ) : (
          <>
            <p className="tiny muted" style={{ marginBottom: 14 }}>
              Entre com Google ou e-mail para sincronizar entre celular e computador, e para guardar vídeos das suas técnicas.
            </p>
            <Btn variant="primary" icon={LogIn} onClick={abrirLogin}>Entrar ou criar conta</Btn>
          </>
        )}
      </Card>

      {/* IA */}
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h2 className="h-sec row" style={{ gap: 8 }}><Sparkles size={17} /> Inteligência artificial</h2>
          <Chip tone={temIA ? 'jade' : temIA === false ? 'blood' : ''}>
            {temIA === null ? 'verificando…' : temIA ? 'ligada' : 'desligada'}
          </Chip>
        </div>
        <p className="tiny muted">
          A IA preenche técnicas pelo nome, checa a regra da IBJJF buscando na web, monta planos de ataque e
          comenta seu treino e sua dieta. A chave fica no <b style={{ color: 'var(--chalk)' }}>servidor</b> (variável GROQ_API_KEY na Vercel),
          nunca no navegador.
        </p>
        {temIA === false && (
          <p className="micro" style={{ color: 'var(--roar)', marginTop: 10 }}>
            Adicione GROQ_API_KEY nas variáveis de ambiente da Vercel e faça um novo deploy pra ligar.
          </p>
        )}
        <div className="row" style={{ marginTop: 14, padding: '9px 11px', background: 'var(--void)', borderRadius: 10 }}>
          <span className="tiny grow">Usar IA no app</span>
          <Switch on={settings.iaLigada !== false} onChange={(v) => set('iaLigada', v)} />
        </div>
      </Card>

      {/* app */}
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head"><h2 className="h-sec row" style={{ gap: 8 }}><Smartphone size={17} /> App no celular</h2></div>
        <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
          <Chip tone={ehStandalone() ? 'jade' : ''}>{ehStandalone() ? 'Instalado' : 'Rodando no navegador'}</Chip>
          <Chip>{plat.iOS ? 'iOS' : plat.androide ? 'Android' : 'Desktop'}</Chip>
          <Chip tone={navigator.onLine ? 'jade' : 'blood'}>{navigator.onLine ? 'Online' : 'Offline'}</Chip>
        </div>
        <p className="tiny muted" style={{ marginBottom: 12 }}>
          Instalado, o app abre da tela de início e funciona sem internet, seus dados ficam no próprio aparelho.
          {plat.iOS && ' No iPhone a instalação é pelo Safari: Compartilhar → Adicionar à Tela de Início.'}
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <Btn variant="primary" icon={Smartphone} onClick={abrirInstalar}>Como instalar</Btn>
          <Btn icon={RefreshCw} onClick={async () => {
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.update()));
            }
            toast('Procurando atualização');
          }}>Buscar atualização</Btn>
        </div>
      </Card>

      <Notificacoes sessao={sessao} />

      {/* dados */}
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head"><h2 className="h-sec row" style={{ gap: 8 }}><Database size={17} /> Seus dados</h2></div>
        <div className="grid g4" style={{ gap: 12, marginBottom: 16 }}>
          <Stat size="sm" valor={sessions.length} label="treinos" />
          <Stat size="sm" valor={rolls.length} label="rolas" />
          <Stat size="sm" valor={techniques.length} label="técnicas" />
          <Stat size="sm" valor={partners.length} label="parceiros" />
        </div>
        <p className="tiny muted" style={{ marginBottom: 14 }}>
          Tudo fica salvo <b style={{ color: 'var(--chalk)' }}>no seu aparelho</b> (IndexedDB), não sobe pra servidor nenhum.
          Isso é ótimo pra privacidade, mas significa que limpar os dados do navegador apaga tudo. <b style={{ color: 'var(--roar)' }}>Faça backup de vez em quando.</b>
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <Btn variant="primary" icon={FileJson} onClick={exportarJSON}>Backup completo (JSON)</Btn>
          <Btn icon={FileSpreadsheet} onClick={exportarTecnicasCSV}>Técnicas em CSV</Btn>
          <Btn icon={Upload} onClick={() => fileRef.current?.click()}>Restaurar backup</Btn>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={lerArquivo} style={{ display: 'none' }} />
          <span className="spacer" />
          <Btn variant="danger" icon={Trash2} onClick={() => setZerar(true)}>Apagar tudo</Btn>
        </div>
      </Card>

      <Card>
        <div className="card-head"><h2 className="h-sec">Sobre</h2></div>
        <p className="tiny muted">
          NeuroJitsu, sistema pessoal de evolução em Jiu-Jitsu. Feito pra ser rápido de preencher no vestiário
          e honesto na hora de mostrar onde está o buraco no seu jogo.
        </p>
        <p className="micro muted" style={{ marginTop: 10 }}>
          As referências de regra (IBJJF, ADCC) são um guia, não a fonte oficial, regras mudam de temporada.
          As orientações de físico, respiração e lesão são informativas e não substituem médico, fisioterapeuta ou seu professor.
        </p>
      </Card>

      <Modal
        aberto={!!importando}
        onClose={() => setImportando(null)}
        titulo="Restaurar backup"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setImportando(null)}>Cancelar</Btn>
            <Btn onClick={async () => {
              await importAll(importando, { substituir: false });
              setImportando(null); toast('Backup mesclado'); setTimeout(() => location.reload(), 700);
            }}>Mesclar</Btn>
            <Btn variant="primary" onClick={async () => {
              await importAll(importando, { substituir: true });
              setImportando(null); toast('Backup restaurado'); setTimeout(() => location.reload(), 700);
            }}>Substituir tudo</Btn>
          </>
        }
      >
        <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
          <span className="stat-ico" style={{ color: 'var(--roar)', background: 'color-mix(in srgb, var(--roar) 14%, transparent)' }}>
            <TriangleAlert size={16} />
          </span>
          <div>
            <p className="tiny">
              Backup de <b>{importando?.exportadoEm?.slice(0, 10) || ','}</b>.
            </p>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              <b style={{ color: 'var(--chalk)' }}>Mesclar</b> junta com o que já existe (registros com mesmo id são sobrescritos).<br />
              <b style={{ color: 'var(--chalk)' }}>Substituir tudo</b> apaga o que está aqui e coloca só o backup.
            </p>
          </div>
        </div>
      </Modal>

      <Confirmar
        aberto={zerar}
        onClose={() => setZerar(false)}
        onConfirmar={async () => {
          await wipeAll();
          await ensureSeed();
          toast('Tudo apagado');
          setTimeout(() => location.reload(), 700);
        }}
        titulo="Apagar tudo"
        rotulo="Apagar tudo"
        texto="Todos os treinos, rolas, técnicas, metas e registros somem definitivamente. Baixe um backup antes se tiver qualquer dúvida."
      />
    </div>
  );
}

/* ============================================================
   NOTIFICACOES

   Tres estados, e cada um precisa de uma tela diferente:

   nao da       iPhone sem o app instalado. Nao adianta oferecer
                um botao que nao vai funcionar: a explicacao e
                que o Push so existe pra app na tela de inicio.
   negada       ela ja disse nao uma vez. O navegador nao deixa
                perguntar de novo, entao o caminho e o ajuste do
                sistema, e dizer isso e melhor que um botao morto.
   da           o botao, e ele pede a permissao dentro do clique.

   Por que nao tem lista de "quero esta, nao quero aquela": sao
   quatro avisos, no maximo um por dia, e quem nao abre para de
   receber sozinho. Uma tela de preferencia pra isso seria mais
   trabalho pra pessoa do que o problema que resolve.
   ============================================================ */
function Notificacoes({ sessao }) {
  const toast = useToast();
  const [ligado, setLigado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const { pode, motivo } = podeNotificar();

  useEffect(() => { estaLigada().then(setLigado); }, [sessao]);

  async function alternar() {
    setOcupado(true);
    try {
      if (ligado) {
        await desligarNotificacao(sessao?.user?.id);
        setLigado(false);
        toast('Notificações desligadas');
        return;
      }
      const r = await ligarNotificacao(sessao?.user?.id);
      if (r === 'ligada') {
        setLigado(true);
        toast('Pronto. Você é avisado antes de perder a ofensiva.');
      } else if (r === 'negada') {
        toast('O navegador bloqueou. Libere nos ajustes do site.');
      } else {
        toast('Não consegui ligar agora.');
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h2 className="h-sec row" style={{ gap: 8 }}><Bell size={17} /> Avisos</h2>
      </div>

      <p className="tiny muted" style={{ marginBottom: 12, lineHeight: 1.7 }}>
        No máximo um por dia, na hora em que você costuma usar o app. Avisam quando a ofensiva está pra cair,
        quando a liga fecha, e o resultado dela na segunda.
      </p>

      {!sessao ? (
        <p className="micro muted">Entre com a sua conta pra ligar os avisos.</p>
      ) : motivo === 'instalar' ? (
        <p className="micro muted" style={{ lineHeight: 1.7 }}>
          No iPhone, aviso só chega pra app instalado na tela de início. É regra do iOS, não ajuste do app.
          Instale pelo Safari em Compartilhar → Adicionar à Tela de Início e volte aqui.
        </p>
      ) : motivo === 'negada' ? (
        <p className="micro muted" style={{ lineHeight: 1.7 }}>
          Você bloqueou os avisos neste navegador, e ele não deixa perguntar de novo. Pra liberar, é nos
          ajustes do site, no cadeado ao lado do endereço.
        </p>
      ) : !pode ? (
        <p className="micro muted">Este navegador não recebe avisos.</p>
      ) : (
        <div className="row" style={{ gap: 10 }}>
          <Btn
            variant={ligado ? 'ghost' : 'primary'}
            icon={ligado ? BellOff : Bell}
            disabled={ocupado}
            onClick={alternar}
          >
            {ocupado ? 'Um instante' : ligado ? 'Desligar avisos' : 'Ligar avisos'}
          </Btn>
          {ligado && <Chip tone="jade"><Check size={11} /> ligados neste aparelho</Chip>}
        </div>
      )}
    </Card>
  );
}
