import React, { useRef, useState, useMemo } from 'react';
import {
  Upload, Trash2, Check, Smartphone, Palette, User, Database, RefreshCw, FileJson, TriangleAlert,
  ChevronRight, UserRound, LogOut, LogIn, Sparkles, Loader, Info, Bell, BellOff,
} from 'lucide-react';
import { useApp } from '../contexto';
import Plano from '../components/Plano';
import TesteVideo from '../components/TesteVideo';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportAll, importAll, wipeAll, ensureSeed } from '../db/db';
import { FAIXAS } from '../db/seed';
import {
  Card, Btn, Field, Input, NumeroInput, Select, Switch, Modal, Chip, useToast, Stat, Confirmar, Stepper, Sheet,
} from '../components/UI';
import { baixarArquivo, hoje } from '../lib/utils';
import { ehStandalone, detectarPlataforma } from '../lib/pwa';
import { supabaseConfigurado, sair, apagarMinhaConta } from '../lib/supabase';
import { limparCursor, sincronizar } from '../lib/sync';
import { minhasTecnicas } from '../lib/graus';
import Guia from '../components/Guia';
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
  ['finalizacoes', 'Finalizações'],
];

export default function Ajustes() {
  const [toquesVersao, setToquesVersao] = useState(0);
  const { settings, salvarSettings, abrirInstalar, sessao, sync, abrirLogin, erroBoot, abrirTour, refazerOnboarding, acesso, recarregarAcesso, ligada, ehAdmin } = useApp();
  const [temIA, setTemIA] = useState(null);
  const [aberto, setAberto] = useState(null);
  const [apagarConta, setApagarConta] = useState(false);
  const toast = useToast();
  const fileRef = useRef(null);
  const [zerar, setZerar] = useState(false);
  const [importando, setImportando] = useState(null);
  const plat = detectarPlataforma();

  useEffect(() => { if (ehAdmin) iaDisponivel().then(setTemIA); }, [ehAdmin]);

  const academias = useLiveQuery(() => db.academies.filter((a) => !a.arquivada).toArray(), [], []) || [];
  const professores = useLiveQuery(() => db.professors.filter((p) => !p.arquivada).toArray(), [], []) || [];

  const set = (k, v) => salvarSettings({ [k]: v });
  const setDash = (k, v) => salvarSettings({ mostrarNoDash: { ...settings.mostrarNoDash, [k]: v } });

  async function exportarJSON() {
    const dump = await exportAll();
    baixarArquivo(`tatame-backup-${hoje()}.json`, JSON.stringify(dump, null, 2));
    toast('Backup baixado');
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

  const fechar = () => setAberto(null);
  const faixaNome = FAIXAS.find((f) => f.id === settings.faixa)?.nome || 'Branca';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Ajustes</h1>
        </div>
      </div>

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

      {/* cada item abre o seu popup: a tela fica curta e cada assunto no seu lugar */}
      <Card className="ajustes-lista" style={{ marginBottom: 14 }}>
        <LinhaAjuste icone={User} titulo="Perfil" resumo={`${settings.nome || 'Sem nome'} · Faixa ${faixaNome.toLowerCase()}`} onClick={() => setAberto('perfil')} />
        <LinhaAjuste icone={Palette} titulo="Aparência" resumo="Cor, fundo e o que aparece no Painel" onClick={() => setAberto('aparencia')} />
        <LinhaAjuste icone={Info} titulo="Como usar" resumo="O passo a passo do app" onClick={() => setAberto('comousar')} />
        <LinhaAjuste icone={Smartphone} titulo="App no celular" resumo={ehStandalone() ? 'Instalado' : 'Rodando no navegador'} onClick={() => setAberto('app')} />
        <LinhaAjuste icone={Bell} titulo="Avisos" resumo="Ofensiva e liga, no máximo um por dia" onClick={() => setAberto('avisos')} />
        <LinhaAjuste icone={Database} titulo="Seus dados" resumo="Tudo salva sozinho" onClick={() => setAberto('dados')} />
        <LinhaAjuste
          icone={sessao ? UserRound : LogIn}
          titulo="Conta"
          resumo={!supabaseConfigurado ? 'Só neste aparelho' : sessao ? sessao.user?.email : 'Entrar ou criar conta'}
          onClick={() => setAberto('conta')}
        />
      </Card>

      {/* o teste do vídeo e a chave da IA são de quem administra, não do aluno */}
      {ehAdmin && (
        <>
          <div className="eyebrow" style={{ margin: '4px 0 10px' }}>Só a conta de admin vê daqui pra baixo</div>
          <TesteVideo />
          <Card style={{ marginBottom: 14 }}>
            <div className="card-head">
              <h2 className="h-sec row" style={{ gap: 8 }}><Sparkles size={17} /> Inteligência artificial</h2>
              <Chip tone={temIA ? 'jade' : temIA === false ? 'blood' : ''}>
                {temIA === null ? 'verificando…' : temIA ? 'ligada' : 'desligada'}
              </Chip>
            </div>
            <p className="tiny muted">
              A IA preenche técnicas pelo nome, checa a regra da IBJJF buscando na web e comenta o treino.
              A chave fica no <b style={{ color: 'var(--chalk)' }}>servidor</b> (variável GROQ_API_KEY na Vercel),
              nunca no navegador.
            </p>
            {temIA === false && (
              <p className="micro" style={{ color: 'var(--roar)', marginTop: 10 }}>
                Adicione GROQ_API_KEY nas variáveis de ambiente da Vercel e faça um novo deploy pra ligar.
              </p>
            )}
          </Card>
        </>
      )}

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

      {/* ---------- perfil ---------- */}
      <Sheet aberto={aberto === 'perfil'} onClose={fechar} titulo="Perfil" footer={<Btn variant="primary" onClick={fechar}>Pronto</Btn>}>
        <SalvaSozinho />
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
          <Field label="Duração padrão do treino (min)" hint="O novo treino já abre com ela.">
            <Stepper value={Number(settings.duracaoTreinoPadrao) || 90} onChange={(v) => set('duracaoTreinoPadrao', v)} min={15} max={240} step={15} />
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
      </Sheet>

      {/* ---------- aparência ---------- */}
      <Sheet aberto={aberto === 'aparencia'} onClose={fechar} titulo="Aparência" footer={<Btn variant="primary" onClick={fechar}>Pronto</Btn>}>
        <SalvaSozinho />
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

        <div className="divider" style={{ margin: '4px 0' }} />
        <div className="row" style={{ padding: '9px 11px', background: 'var(--void)', borderRadius: 10 }}>
          <span className="tiny grow">Comemorar marcos em tela cheia</span>
          <Switch on={settings.celebrar !== false} onChange={(v) => set('celebrar', v)} />
        </div>
        <div className="eyebrow" style={{ marginTop: 6 }}>O que aparece no Painel</div>
        <div className="grid g2" style={{ gap: 10 }}>
          {CARDS_DASH.map(([k, nome]) => (
            <div key={k} className="row" style={{ padding: '8px 10px', background: 'var(--void)', borderRadius: 10 }}>
              <span className="tiny grow">{nome}</span>
              <Switch on={settings.mostrarNoDash?.[k] !== false} onChange={(v) => setDash(k, v)} />
            </div>
          ))}
        </div>
      </Sheet>

      {/* ---------- como usar ---------- */}
      <Sheet aberto={aberto === 'comousar'} onClose={fechar} titulo="Como usar">
        <p className="tiny muted" style={{ lineHeight: 1.65 }}>
          Um passo a passo curto: como registrar treino, o que são os graus das técnicas, por que atacar e defender
          ficam separados e onde os seus dados ficam.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <Btn variant="primary" icon={Info} onClick={() => { fechar(); abrirTour(); }}>Ver o passo a passo</Btn>
          <Btn variant="contorno" onClick={() => { fechar(); refazerOnboarding(); }}>Refazer meu perfil</Btn>
        </div>
      </Sheet>

      {/* ---------- app no celular ---------- */}
      <Sheet aberto={aberto === 'app'} onClose={fechar} titulo="App no celular">
        <div className="row wrap" style={{ gap: 8 }}>
          <Chip tone={ehStandalone() ? 'jade' : ''}>{ehStandalone() ? 'Instalado' : 'Rodando no navegador'}</Chip>
          <Chip>{plat.iOS ? 'iOS' : plat.androide ? 'Android' : 'Desktop'}</Chip>
          <Chip tone={navigator.onLine ? 'jade' : 'blood'}>{navigator.onLine ? 'Online' : 'Offline'}</Chip>
        </div>
        <p className="tiny muted" style={{ lineHeight: 1.65 }}>
          Instalado, o app abre da tela de início e funciona sem internet.
          {plat.iOS && ' No iPhone a instalação é pelo Safari: Compartilhar → Adicionar à Tela de Início.'}
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <Btn variant="primary" icon={Smartphone} onClick={() => { fechar(); abrirInstalar(); }}>Como instalar</Btn>
          <Btn variant="contorno" icon={RefreshCw} onClick={async () => {
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.update()));
            }
            toast('Procurando atualização');
          }}>Buscar atualização</Btn>
        </div>
      </Sheet>

      {/* ---------- avisos ---------- */}
      <Sheet aberto={aberto === 'avisos'} onClose={fechar} titulo="Avisos">
        <Notificacoes sessao={sessao} />
      </Sheet>

      {/* ---------- seus dados ---------- */}
      <Sheet aberto={aberto === 'dados'} onClose={fechar} titulo="Seus dados">
        <SeusDados />
        <p className="tiny muted" style={{ lineHeight: 1.65 }}>
          Tudo salva sozinho na hora em que você registra, não existe botão de salvar.
          {sessao
            ? ' Com a sua conta, fica guardado também na nuvem e aparece em qualquer aparelho em que você entrar.'
            : ' Sem conta, fica só neste aparelho: limpar os dados do navegador apaga tudo. Uma cópia de vez em quando resolve.'}
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <Btn variant="primary" icon={FileJson} onClick={exportarJSON}>Baixar uma cópia</Btn>
          <Btn variant="contorno" icon={Upload} onClick={() => fileRef.current?.click()}>Restaurar uma cópia</Btn>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={lerArquivo} style={{ display: 'none' }} />
        </div>
      </Sheet>

      {/* ---------- conta ---------- */}
      <Sheet aberto={aberto === 'conta'} onClose={fechar} titulo="Conta">
        {!supabaseConfigurado ? (
          <p className="tiny muted" style={{ lineHeight: 1.65 }}>
            Este app está funcionando sem nuvem: os dados ficam só neste aparelho.
          </p>
        ) : sessao ? (
          <>
            <div className="row wrap" style={{ gap: 8 }}>
              <Chip tone="jade"><Check size={11} /> {sessao.user?.email}</Chip>
            </div>
            <p className="tiny muted" style={{ lineHeight: 1.65 }}>
              Seus treinos sincronizam sozinhos entre os seus aparelhos. Sem internet, o app guarda e manda quando a conexão voltar.
            </p>
            <p className="micro" style={{ color: sync?.erro ? 'var(--blood)' : 'var(--dim)' }}>
              {sync?.erro
                ? `A nuvem não respondeu: ${sync.erro}. O app tenta de novo sozinho.`
                : sync?.pendentes > 0
                  ? `Mandando ${sync.pendentes} ${sync.pendentes === 1 ? 'registro' : 'registros'} pra nuvem…`
                  : sync?.ultimo
                    ? `Tudo guardado na nuvem, às ${new Date(sync.ultimo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
                    : 'Conferindo a nuvem…'}
            </p>
            <div className="row wrap" style={{ gap: 8 }}>
              <Btn variant="contorno" icon={LogOut} onClick={async () => {
                /* sair limpa a fila de envio: antes, manda o que falta. Se não
                   der (sem internet), não sai, senão o que não subiu se perde */
                await sincronizar({ forcar: true });
                const pendentes = await db.outbox.count();
                if (pendentes) {
                  toast(`Ainda tem ${pendentes} ${pendentes === 1 ? 'registro' : 'registros'} sem ir pra nuvem. Conecte na internet e tente sair de novo.`, 'err');
                  return;
                }
                await sair(); await limparCursor();
                toast('Você saiu, os dados continuam no aparelho');
                setTimeout(() => location.reload(), 600);
              }}>Sair</Btn>
            </div>
            <div className="divider" style={{ margin: '4px 0' }} />
            <button className="btn ghost xs" style={{ alignSelf: 'flex-start', color: 'var(--blood)' }} onClick={() => { fechar(); setApagarConta(true); }}>
              <Trash2 size={13} /> Apagar minha conta
            </button>
          </>
        ) : (
          <>
            <p className="tiny muted" style={{ lineHeight: 1.65 }}>
              Com uma conta, os seus treinos ficam guardados na nuvem e aparecem no celular e no computador.
            </p>
            <Btn variant="primary" icon={LogIn} onClick={() => { fechar(); abrirLogin(); }}>Entrar ou criar conta</Btn>
            <div className="divider" style={{ margin: '4px 0' }} />
            <button className="btn ghost xs" style={{ alignSelf: 'flex-start', color: 'var(--blood)' }} onClick={() => { fechar(); setZerar(true); }}>
              <Trash2 size={13} /> Apagar os dados deste aparelho
            </button>
          </>
        )}
      </Sheet>

      <ApagarConta aberto={apagarConta} onClose={() => setApagarConta(false)} onBaixarCopia={exportarJSON} />

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
        titulo="Apagar os dados deste aparelho"
        rotulo="Apagar tudo"
        texto="Todos os treinos, rolas, técnicas, metas e registros deste aparelho somem definitivamente. Baixe uma cópia antes se tiver qualquer dúvida."
      />
    </div>
  );
}

/* uma linha da lista: ícone, nome, o estado de agora e a seta */
function LinhaAjuste({ icone: Icone, titulo, resumo, onClick }) {
  return (
    <button type="button" className="ajuste-linha" onClick={onClick}>
      <span className="stat-ico"><Icone size={16} /></span>
      <span className="ajuste-linha-txt">
        <span className="tiny" style={{ fontWeight: 600 }}>{titulo}</span>
        {resumo && <span className="micro muted">{resumo}</span>}
      </span>
      <ChevronRight size={17} className="muted" />
    </button>
  );
}

function SalvaSozinho() {
  return (
    <p className="micro muted row" style={{ gap: 6 }}>
      <Check size={13} style={{ color: 'var(--jade)' }} /> Salva sozinho, enquanto você mexe.
    </p>
  );
}

/* ============================================================
   SEUS DADOS

   Só o que é da pessoa. A biblioteca tem mais de seiscentas
   técnicas, e contar todas aqui fazia parecer que ela tinha
   registrado seiscentas coisas. Técnica conta quando apareceu
   num treino ou rola dela.
   ============================================================ */
function SeusDados() {
  const { sessions, rolls, partners, techniques, gradings, settings } = useApp();
  const n = useMemo(() => {
    const lutas = rolls.filter((r) => (r.contexto || 'rola') !== 'drill');
    return {
      tecnicas: minhasTecnicas(rolls, partners, sessions, techniques, settings.faixa, gradings, settings.graus || 0).length,
      finalizacoes: lutas.reduce((a, r) => a + (r.subsAplicadas || []).length, 0),
      posicoes: new Set(lutas.map((r) => r.posInicial).filter(Boolean)).size,
      lutas: lutas.length,
    };
  }, [sessions, rolls, partners, techniques, gradings, settings.faixa, settings.graus]);

  return (
    <div className="grid g3" style={{ gap: 12 }}>
      <Stat size="sm" valor={sessions.length} label="treinos" />
      <Stat size="sm" valor={n.lutas} label="rolas" />
      <Stat size="sm" valor={partners.length} label="parceiros" />
      <Stat size="sm" valor={n.tecnicas} label="técnicas que você usou" />
      <Stat size="sm" valor={n.finalizacoes} label="finalizações que você aplicou" />
      <Stat size="sm" valor={n.posicoes} label="posições de começo anotadas" />
    </div>
  );
}

/* ============================================================
   APAGAR A CONTA

   Direito do aluno pela LGPD, e ele faz sozinho. A tela diz o que
   some, o que fica e por quê, lembra da assinatura (apagar a conta
   não cancela cobrança) e oferece uma cópia antes. Escrever APAGAR
   evita o toque sem querer.

   A ordem importa: primeiro o servidor. Se ele falhar, o aparelho
   não é limpo e a pessoa não fica com meia conta.
   ============================================================ */
function ApagarConta({ aberto, onClose, onBaixarCopia }) {
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [apagando, setApagando] = useState(false);
  const pode = texto.trim().toUpperCase() === 'APAGAR';

  async function apagar() {
    setApagando(true);
    try {
      await apagarMinhaConta();
    } catch (e) {
      console.error('[apagar conta]', e);
      toast('Não consegui apagar agora. A sua conta continua, tente de novo.', 'err');
      setApagando(false);
      return;
    }
    await limparCursor();
    await wipeAll();
    await ensureSeed();
    toast('Conta apagada');
    setTimeout(() => location.reload(), 900);
  }

  return (
    <Sheet
      aberto={aberto}
      onClose={() => { setTexto(''); onClose(); }}
      titulo="Apagar minha conta"
      footer={(
        <>
          <Btn variant="ghost" onClick={() => { setTexto(''); onClose(); }}>Cancelar</Btn>
          <Btn variant="danger" icon={apagando ? Loader : Trash2} disabled={!pode || apagando} onClick={apagar}>
            {apagando ? 'Apagando' : 'Apagar pra sempre'}
          </Btn>
        </>
      )}
    >
      <Guia inicial="some" topicos={[
        {
          id: 'some', icone: Trash2, titulo: 'O que some', resumo: 'Tudo o que é seu, aqui e na nuvem',
          conteudo: <p>{'Treinos, rolas, técnicas, metas, vídeos, foto, pontos da liga, amigos e salas. Não dá pra desfazer.'}</p>,
        },
        {
          id: 'fica', icone: FileJson, titulo: 'O que fica', resumo: 'Só o registro da compra, sem o seu nome',
          conteudo: <p>{'Se você comprou alguma coisa, o registro da venda continua guardado, desligado da sua conta. Nota de venda se guarda por lei.'}</p>,
        },
        {
          id: 'assinatura', icone: TriangleAlert, titulo: 'Se você assina', resumo: 'Apagar a conta não cancela a cobrança',
          conteudo: <p>{'A assinatura é cobrada pela Hotmart. Cancele lá antes, senão a cobrança continua mesmo sem a conta.'}</p>,
        },
      ]} />
      <Btn variant="contorno" icon={FileJson} onClick={onBaixarCopia}>Baixar uma cópia antes</Btn>
      <Field label="Pra confirmar, escreva APAGAR">
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="APAGAR" autoCapitalize="characters" />
      </Field>
    </Sheet>
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
  /* o passo em que parou, quando parou: melhor que um botão girando */
  const [falha, setFalha] = useState(null);
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
      setFalha(null);
      const r = await ligarNotificacao(sessao?.user?.id);
      if (r.ok) {
        setLigado(true);
        toast('Pronto. Você é avisado antes de perder a ofensiva.');
      } else if (r.motivo === 'negada') {
        toast('O navegador bloqueou. Libere nos ajustes do site.');
      } else if (r.motivo === 'ignorada') {
        toast('O pedido fechou sem resposta. Toque de novo e escolha Permitir.');
      } else {
        setFalha(r.detalhe || r.motivo);
        toast('Não consegui ligar os avisos.', 'err');
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
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
      ) : motivo === 'sem_chave' ? (
        <p className="micro muted">Os avisos ainda não foram configurados neste app.</p>
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
      {falha && /push service/i.test(falha) ? (
        /* o Chrome não fala com o serviço de avisos do Google: é ajuste do
           celular, não do app. Comum em Xiaomi e em quem usa Brave. */
        <div className="valida atencao">
          <Bell size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <div className="micro muted" style={{ lineHeight: 1.6 }}>
            <b style={{ color: 'var(--chalk)' }}>O celular bloqueou o serviço de avisos do navegador.</b> Pra liberar:
            <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Ajustes do celular → Apps → Chrome → Notificações: ligadas.</li>
              <li>No mesmo lugar, Economia de bateria: sem restrições, e Início automático ligado (Xiaomi).</li>
              <li>Se usa Brave, avisos não funcionam nele: use o Chrome.</li>
            </ol>
            Depois feche o app de vez e tente de novo.
          </div>
        </div>
      ) : falha && (
        <p className="micro" style={{ color: 'var(--blood)', lineHeight: 1.6 }}>
          Parou aqui: {falha}. Tente de novo; se repetir, mande um print disso pro suporte.
        </p>
      )}
    </>
  );
}
