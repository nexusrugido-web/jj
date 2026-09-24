import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Trophy, Award, Clock, Swords, Flame, Sparkles, Check, Medal, Trash2, Share2,
} from 'lucide-react';
import { useApp } from '../contexto';
import { db } from '../db/db';
import { FAIXAS } from '../db/seed';
import {
  Card, Btn, Field, Input, Textarea, Select, Sheet, Empty, useToast, Stat, BeltTag, Stepper,
  Confirmar,
} from '../components/UI';
import { resumo as resumoGeral } from '../lib/stats';
import { ofensiva } from '../lib/ofensiva';
import Figurinha from '../components/Figurinha';
import { minhasTecnicas, resumoGraus, requisitosDaFaixa, grauPorN } from '../lib/graus';
import { Ponteira } from '../components/Ponteira';
import { proximaGraduacao, FAIXAS_ORDEM } from '../lib/milestones';
import { hoje, fmtData, relativo, diasEntre, fmtDur } from '../lib/utils';

/* Abre a figurinha pro story (a imagem, com o @ do app). O card
   em link continua lá dentro, pra quem prefere mandar no grupo. */
function Compartilhar({ tipo, dados, texto, variante, figura, soIcone = false }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      {soIcone
        ? <button type="button" className="btn ghost icon sm" aria-label="Compartilhar" onClick={() => setAberto(true)}><Share2 size={16} /></button>
        : <Btn size="sm" variant={variante} icon={Share2} onClick={() => setAberto(true)}>Compartilhar</Btn>}
      <Figurinha aberto={aberto} onClose={() => setAberto(false)} dados={figura} link={{ tipo, dados, texto }} />
    </>
  );
}

const ICONES = { horas: Clock, rolas: Swords, dominio: Award, streak: Flame, tecnica: Sparkles, inicio: Check, pontos: Trophy };

export default function Conquistas() {
  const { sessions, rolls, partners, techniques, settings, salvarSettings } = useApp();
  const toast = useToast();
  const marcos = useLiveQuery(() => db.milestones.orderBy('data').reverse().toArray(), [], []) || [];
  const graduacoes = useLiveQuery(() => db.gradings.orderBy('data').reverse().toArray(), [], []) || [];
  const [registrar, setRegistrar] = useState(null);
  const [faixaNova, setFaixaNova] = useState(null);
  const [excluir, setExcluir] = useState(null);

  const r = useMemo(() => resumoGeral(sessions, rolls), [sessions, rolls]);
  const pontos = useLiveQuery(() => db.pontos.toArray(), [], []) || [];
  const lesoes = useLiveQuery(() => db.injuries.toArray(), [], []) || [];
  const ofa = useMemo(() => ofensiva(pontos, undefined, lesoes), [pontos, lesoes]);
  const esteira = useMemo(() => minhasTecnicas(rolls, partners, sessions, techniques, settings.faixa, graduacoes, settings.graus || 0), [rolls, partners, sessions, techniques, settings.faixa, graduacoes, settings.graus]);
  const dom = useMemo(() => resumoGraus(esteira), [esteira]);

  const ultimaGrad = graduacoes[0];
  const desde = ultimaGrad?.data || settings.inicioTreino || null;
  const prox = proximaGraduacao(settings.faixa, settings.graus);

  /* estatísticas desde a última graduação */
  const periodo = useMemo(() => {
    if (!desde) return null;
    const ses = sessions.filter((s) => s.data >= desde);
    const ids = new Set(ses.map((s) => s.id));
    const rls = rolls.filter((x) => ids.has(x.sessionId));
    return {
      dias: diasEntre(desde, hoje()),
      treinos: ses.length,
      minutos: ses.reduce((a, s) => a + (Number(s.duracao) || 0), 0),
      rolas: rls.length,
      subs: rls.flatMap((x) => x.subsAplicadas || []).length,
    };
  }, [desde, sessions, rolls]);

  async function salvarGraduacao() {
    const g = { ...registrar };
    await db.gradings.add({ ...g, criadoEm: Date.now() });
    await salvarSettings({ faixa: g.faixa, graus: g.tipo === 'faixa' ? 0 : g.graus });
    setRegistrar(null);
    toast('Parabéns! Graduação registrada 🥋');
    /* graduação sobe a régua das técnicas, de faixa ou de grau: quem vê
       o próximo grau mais longe precisa saber que não perdeu nada */
    setFaixaNova({ tipo: g.tipo, faixa: g.faixa, graus: g.tipo === 'faixa' ? 0 : Number(g.graus) || 0, antes: settings.faixa });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Conquistas</h1>
        </div>
        <Btn variant="primary" icon={Medal} onClick={() => setRegistrar({
          data: hoje(), tipo: settings.graus < 4 ? 'grau' : 'faixa',
          faixa: settings.graus < 4 ? settings.faixa : (FAIXAS_ORDEM[FAIXAS_ORDEM.indexOf(settings.faixa) + 1] || settings.faixa),
          graus: settings.graus < 4 ? settings.graus + 1 : 0,
          professor: settings.professor || '', academia: settings.academia || '', notas: '',
        })}>
          Ganhei graduação
        </Btn>
      </div>

      {/* ---- faixa atual e caminho ---- */}
      <Card className="accent" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="eyebrow">sua faixa</div>
            <div className="row" style={{ gap: 10, marginTop: 8, alignItems: 'center' }}>
              <BeltTag faixa={settings.faixa} graus={settings.graus} />
              <span className="muted tiny">{settings.graus} de 4 graus</span>
            </div>
            <div className="row" style={{ gap: 5, marginTop: 12 }}>
              {[1, 2, 3, 4].map((i) => (
                <span key={i} style={{
                  flex: 1, height: 9, borderRadius: 3,
                  background: i <= settings.graus ? 'var(--accent)' : 'var(--seam)',
                  boxShadow: i <= settings.graus ? '0 0 10px -2px var(--accent)' : 'none',
                  transition: 'all .4s var(--ease)',
                }} />
              ))}
            </div>
            <p className="tiny muted" style={{ marginTop: 12 }}>
              Próximo passo: <b style={{ color: 'var(--accent)' }}>{prox.label}</b>.
              Quem decide é o seu professor, aqui você só registra e vê o caminho.
            </p>
          </div>

          {periodo && (
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="eyebrow">desde {ultimaGrad ? 'a última graduação' : 'que você começou'}</div>
              <div className="grid g2" style={{ gap: 10, marginTop: 10 }}>
                <Stat size="sm" valor={periodo.dias} label="dias" />
                <Stat size="sm" valor={periodo.treinos} label="treinos" />
                <Stat size="sm" valor={fmtDur(periodo.minutos)} label="no tatame" />
                <Stat size="sm" valor={periodo.rolas} label="rolas" />
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Card><Stat icon={Clock} valor={`${r.matHoras}h`} label="tatame total" tone="roar" /></Card>
        <Card><Stat icon={Award} valor={dom.g3 + dom.g4} label={dom.g3 + dom.g4 === 1 ? 'técnica dominada' : 'técnicas dominadas'} tone="jade" /></Card>
        <Card><Stat icon={Flame} valor={ofa.recorde} label="recorde de ofensiva" /></Card>
        <Card><Stat icon={Trophy} valor={marcos.length} label="marcos" /></Card>
      </div>

      {/* o resumo inteiro num card só: é o que mostra evolução de
          verdade, e é o que alguém posta no fim de um ciclo */}
      {r.sessoes > 0 && (
        <div className="row" style={{ gap: 10, marginBottom: 14 }}>
          <p className="micro muted" style={{ flex: 1, lineHeight: 1.6 }}>
            Tudo isso num card que dá pra mandar pro grupo da academia.
          </p>
          <Compartilhar
            tipo="resumo"
            dados={{
              periodo: 'desde o começo',
              horas: r.matHoras,
              treinos: r.sessoes,
              rolas: r.rolas,
              subiram: esteira.filter((t) => t.grau >= 3).map((t) => t.nome).slice(0, 6),
            }}
            texto={`${r.matHoras}h no tatame, ${r.sessoes} treinos e ${r.rolas} rolas.`}
            figura={{ selo: 'desde o começo', grande: `${r.matHoras}h no tatame`, sub: `${r.sessoes} treinos · ${r.rolas} rolas` }}
            variante="primary"
          />
        </div>
      )}

      {/* ---- próximo marco de horas ---- */}
      <ProximoMarco horas={r.matHoras} />

      {/* ---- graduações ---- */}
      {graduacoes.length > 0 && (
        <Card style={{ marginBottom: 14 }} className="pad-0">
          <div style={{ padding: '16px 16px 8px' }}><h2 className="h-sec">Sua linha do tempo</h2></div>
          <div className="list">
            {graduacoes.map((g) => (
              <div key={g.id} className="list-item">
                <span className="stat-ico" style={{ color: 'var(--accent)' }}><Medal size={16} /></span>
                <div className="grow">
                  <div className="tiny" style={{ fontWeight: 600 }}>
                    {g.tipo === 'faixa' ? `Faixa ${FAIXAS.find((f) => f.id === g.faixa)?.nome}` : `${g.graus}º grau, faixa ${FAIXAS.find((f) => f.id === g.faixa)?.nome}`}
                  </div>
                  <div className="micro muted">
                    {fmtData(g.data)} · {relativo(g.data)}{g.professor && ` · ${g.professor}`}
                  </div>
                  {g.notas && <p className="micro muted" style={{ marginTop: 4 }}>{g.notas}</p>}
                </div>
                <button className="btn ghost icon sm" onClick={() => setExcluir(g)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ---- marcos ---- */}
      <div className="card-head">
        <h2 className="h-sec">Marcos</h2>
        <span className="micro muted">sem pontinho. só coisa que aconteceu de verdade.</span>
      </div>

      {marcos.length === 0 ? (
        <Card><Empty icon={Trophy} titulo="Nenhum marco ainda" texto="Registre treinos e rolas. Os marcos aparecem sozinhos quando você bate horas de tatame, domina técnicas e mantém consistência." /></Card>
      ) : (
        /* as conquistas em linha do tempo: o mais recente em cima */
        <Card className="marcos">
          {marcos.map((m) => {
            const Ico = ICONES[m.tipo] || Trophy;
            return (
              <div key={m.id} className="marco">
                <span className="marco-ico"><Ico size={16} /></span>
                <div className="marco-txt">
                  <div className="marco-tit">{m.titulo}</div>
                  <p className="micro muted" style={{ marginTop: 2 }}>{m.texto}</p>
                  <span className="micro" style={{ color: 'var(--dimmer)' }}>{relativo(m.data)}</span>
                </div>
                <Compartilhar
                  soIcone
                  tipo="marco"
                  dados={{ titulo: m.titulo, texto: m.texto }}
                  texto={m.titulo}
                  figura={{ selo: 'marco atingido', grande: m.titulo, sub: m.texto }}
                />
              </div>
            );
          })}
        </Card>
      )}

      {/* ---- registrar graduação ---- */}
      <Sheet
        aberto={!!registrar} onClose={() => setRegistrar(null)}
        titulo="Registrar graduação"
        footer={<><Btn variant="ghost" onClick={() => setRegistrar(null)}>Cancelar</Btn><Btn variant="primary" icon={Check} onClick={salvarGraduacao}>Registrar</Btn></>}
      >
        {registrar && (
          <>
            <p className="tiny muted">Esse é o único momento que o app comemora de verdade. Merecido.</p>
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="Data"><Input type="date" value={registrar.data} onChange={(e) => setRegistrar({ ...registrar, data: e.target.value })} /></Field>
              <Field label="O que ganhou">
                <Select value={registrar.tipo} onChange={(e) => setRegistrar({ ...registrar, tipo: e.target.value })}>
                  <option value="grau">Um grau</option>
                  <option value="faixa">Faixa nova</option>
                </Select>
              </Field>
            </div>
            <Field label="Faixa">
              <Select value={registrar.faixa} onChange={(e) => setRegistrar({ ...registrar, faixa: e.target.value })}>
                {FAIXAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </Select>
            </Field>
            {registrar.tipo === 'grau' && (
              <Field label="Qual grau"><Stepper value={registrar.graus} onChange={(v) => setRegistrar({ ...registrar, graus: v })} min={1} max={4} /></Field>
            )}
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="Professor"><Input value={registrar.professor} onChange={(e) => setRegistrar({ ...registrar, professor: e.target.value })} /></Field>
              <Field label="Academia"><Input value={registrar.academia} onChange={(e) => setRegistrar({ ...registrar, academia: e.target.value })} /></Field>
            </div>
            <Field label="O que ficou marcado"><Textarea value={registrar.notas} onChange={(e) => setRegistrar({ ...registrar, notas: e.target.value })} placeholder="Como foi, quem estava, o que você sentiu" /></Field>
          </>
        )}
      </Sheet>

      <FaixaNova aviso={faixaNova} tecnica={esteira[0]} onClose={() => setFaixaNova(null)} />

      <Confirmar
        aberto={!!excluir} onClose={() => setExcluir(null)}
        onConfirmar={async () => { await db.gradings.delete(excluir.id); toast('Removido'); }}
        titulo="Remover graduação" texto="Some da linha do tempo."
      />
    </div>
  );
}

function ProximoMarco({ horas }) {
  const alvos = [10, 25, 50, 100, 200, 300, 500, 750, 1000];
  const prox = alvos.find((a) => horas < a);
  if (!prox) return null;
  const anterior = alvos[alvos.indexOf(prox) - 1] || 0;
  const pct = Math.round(((horas - anterior) / (prox - anterior)) * 100);
  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="eyebrow">próximo marco</div>
          <div className="h-sec" style={{ marginTop: 5 }}>{prox} horas de tatame</div>
          <p className="tiny muted" style={{ marginTop: 5 }}>
            Faltam <b style={{ color: 'var(--accent)' }}>{prox - horas}h</b>. Hora no tatame é a única moeda que o jiu-jitsu aceita.
          </p>
        </div>
        <div style={{ flex: 1, minWidth: 200, alignSelf: 'center' }}>
          <div className="row tiny" style={{ marginBottom: 6 }}>
            <span className="num muted">{horas}h</span>
            <span className="spacer" />
            <span className="num muted">{prox}h</span>
          </div>
          <div className="bar"><i style={{ width: `${Math.max(2, pct)}%` }} /></div>
        </div>
      </div>
    </Card>
  );
}

/* ---------- celebração em tela cheia ---------- */
export function Celebracao({ marco, onFechar }) {
  const [story, setStory] = useState(false);
  useEffect(() => {
    if (!marco) return;
    try { navigator.vibrate?.([120, 60, 120, 60, 220]); } catch { /* nada */ }
  }, [marco]);

  if (!marco) return null;
  const Ico = ICONES[marco.tipo] || Trophy;

  return (
    <div className="celebra" onClick={onFechar}>
      <div className="celebra-card" onClick={(e) => e.stopPropagation()}>
        <div className="celebra-selo"><Ico size={34} /></div>
        <div className="eyebrow">marco atingido</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginTop: 8, letterSpacing: '-0.03em' }}>{marco.titulo}</h2>
        <p className="tiny muted" style={{ marginTop: 10, maxWidth: 320, marginInline: 'auto' }}>{marco.texto}</p>
        <Btn variant="primary" onClick={onFechar} style={{ marginTop: 22, width: '100%', minHeight: 46 }}>Valeu</Btn>
        <Btn variant="contorno" icon={Share2} onClick={() => setStory(true)} style={{ marginTop: 10, width: '100%' }}>
          Compartilhar no story
        </Btn>
      </div>
      <Figurinha
        aberto={story} onClose={() => setStory(false)}
        dados={{ selo: 'marco atingido', grande: marco.titulo, sub: marco.texto }}
        link={{ tipo: 'marco', dados: { titulo: marco.titulo, texto: marco.texto }, texto: marco.titulo }}
      />
    </div>
  );
}

/* ============================================================
   FAIXA NOVA, TÉCNICAS INTACTAS

   Com a faixa nova, o próximo grau de cada técnica pede mais. Sem
   explicar, o aluno vê a barra andar pra trás no dia mais feliz do
   ano e acha que perdeu alguma coisa.
   ============================================================ */
function FaixaNova({ aviso, tecnica, onClose }) {
  if (!aviso) return null;
  const nome = (id) => FAIXAS.find((f) => f.id === id)?.nome?.toLowerCase() || id;
  const deFaixa = aviso.tipo !== 'grau';
  const g = tecnica ? grauPorN(tecnica.grau) : null;
  const req = tecnica?.proximo ? requisitosDaFaixa(aviso.faixa, 'v2', aviso.graus)[tecnica.proximo] : null;
  const titulo = deFaixa ? `Faixa ${nome(aviso.faixa)}, parabéns` : `${aviso.graus}º grau na faixa ${nome(aviso.faixa)}, parabéns`;
  return (
    <Sheet
      aberto onClose={onClose} titulo={titulo}
      footer={<Btn variant="primary" onClick={onClose} style={{ width: '100%' }}>Bora treinar</Btn>}
    >
      <p className="tiny" style={{ lineHeight: 1.7 }}>
        Suas técnicas não perdem nada com {deFaixa ? 'a faixa nova' : 'o grau novo'}. Cada uma continua no grau
        que você conquistou.
      </p>
      {tecnica && g && (
        <div className="card" style={{ background: 'var(--void)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Ponteira n={tecnica.grau} />
          <p className="tiny" style={{ lineHeight: 1.6 }}>
            <b>{tecnica.nome}</b> continua no {g.nome}: {g.curto.toLowerCase()}.
          </p>
        </div>
      )}
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        O que muda é daqui pra frente.{' '}
        {deFaixa
          ? `A faixa ${nome(aviso.faixa)} pede um pouco mais pra subir o próximo grau, porque o que era notável na ${nome(aviso.antes)} vira rotina agora.`
          : 'Cada grau da faixa sobe um pouco a régua das suas técnicas, porque o que era notável no começo da faixa vira rotina perto do fim dela.'}
        {req && tecnica && ` Pro ${grauPorN(tecnica.proximo).nome} da ${tecnica.nome}, agora são ${req.usos} usos no rola.`}
      </p>
    </Sheet>
  );
}
