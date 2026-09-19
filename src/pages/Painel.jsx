import React, { useMemo, useState, useEffect } from 'react';
import {
  Flame, Clock, Swords, Percent, TriangleAlert, Target, Repeat, Wind,
  ArrowRight, Plus, Award, Activity, Trophy, Sparkles, Loader,
  ShieldCheck, HeartPulse,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useApp } from '../contexto';
import { Card, Stat, Btn, Contador, Bar, Empty, Chip } from '../components/UI';
import { EscadaPosicional, BarrasTop, Donut } from '../components/Charts';
import Calendario from '../components/Calendario';
import GraficoEvolucao from '../components/GraficoEvolucao';
import { resumo, escadaPosicional, treinosNaSemana } from '../lib/stats';
import { fmtDur, relativo, fmtData } from '../lib/utils';
import { minhasTecnicas, meusBuracos, resumoGraus, jogoPrincipal, grauPorN } from '../lib/graus';
import { recomendacoesDoAluno, INTENCOES } from '../lib/recomendar';
import { progressoDaMeta, tituloDaMeta, metaDeHorasNoAno } from '../lib/metas';
import LinhaDeMeta from '../components/LinhaDeMeta';
import RotuloPeriodo from '../components/RotuloPeriodo';
import { periodoDeDados } from '../lib/periodo';
import Recomendacao from '../components/Recomendacao';
import { sequencia, textoSequencia, resumoSemana, lerSemana, rotuloSemana, escudos, textoEscudo, semanasProtegidas } from '../lib/semana';
import { situacao, guiaDeEstudo } from '../lib/lesao';
import { analisarJogo } from '../lib/game';
import { estiloPorId } from '../db/scoring';
import { Ponteira } from '../components/Ponteira';
import { PrimeirosPassos, AvisoDeVolta } from '../components/PrimeirosPassos';
import Destaques from '../components/Destaques';
import { analisarDiario } from '../lib/ai';
import { Sheet, useToast } from '../components/UI';
import { supabase } from '../lib/supabase';

export default function Painel() {
  const [ajudaTec, setAjudaTec] = useState(false);
  const { sessions, rolls, positions, settings, salvarSettings, irPara, reviews, goals, techniques, partners, ligada, sessao } = useApp();
  const toast = useToast();
  const [analise, setAnalise] = useState(null);
  const [carregandoIa, setCarregandoIa] = useState(false);
  /* todo mundo entra na liga sozinho; o convite é pra quem saiu,
     e é ligado no painel do administrador */
  const [jaNaLiga, setJaNaLiga] = useState(null);
  const convidarPraLiga = ligada?.('liga') && ligada?.('liga_convite');

  useEffect(() => {
    let vivo = true;
    if (!convidarPraLiga || !supabase || !sessao) { setJaNaLiga(null); return () => {}; }
    supabase.from('perfil').select('participa_liga').eq('user_id', sessao.user.id).single()
      .then(({ data }) => { if (vivo) setJaNaLiga(!!data?.participa_liga); })
      .catch(() => { if (vivo) setJaNaLiga(false); });
    return () => { vivo = false; };
  }, [convidarPraLiga, sessao]);

  const r = useMemo(() => resumo(sessions, rolls), [sessions, rolls]);
  const escada = useMemo(() => escadaPosicional(rolls, positions), [rolls, positions]);
  const semana = useMemo(() => treinosNaSemana(sessions), [sessions]);
  const paraRevisar = [];
  /* O progresso é calculado, não guardado. Antes o Painel lia um
     campo do banco que ninguém preenchia, e por isso mostrava
     zero enquanto a tela de Metas mostrava o número certo. */
  const dash = settings.mostrarNoDash || {};
  const gradings = useLiveQuery(() => db.gradings.toArray(), [], []) || [];
  const pontos = useLiveQuery(() => db.pontos.toArray(), [], []) || [];
  const respostasQuiz = useLiveQuery(() => db.quizRespostas.toArray(), [], []) || [];
  const feitas = useLiveQuery(() => db.recFeitas.toArray(), [], []) || [];
  const vistasAulas = useLiveQuery(() => db.aulasVistas.toArray(), [], []) || [];
  const seq = useMemo(() => sequencia(sessions), [sessions]);
  const fraseSeq = useMemo(() => textoSequencia(seq, sessions), [seq, sessions]);
  const lesoes = useLiveQuery(() => db.injuries.toArray(), [], []) || [];
  const protegidas = useMemo(() => semanasProtegidas(lesoes, vistasAulas), [lesoes, vistasAulas]);
  const escudo = useMemo(() => escudos(sessions, protegidas), [sessions, protegidas]);

  const esteira = useMemo(() => minhasTecnicas(rolls, partners, sessions, techniques, settings.faixa), [rolls, partners, sessions, techniques, settings.faixa]);
  const recap = useMemo(() => resumoSemana(sessions, rolls, esteira, pontos), [sessions, rolls, esteira, pontos]);
  const buracos = useMemo(() => meusBuracos(rolls, partners, sessions, settings.faixa), [rolls, partners, sessions, settings.faixa]);

  const metasAtivas = useMemo(() => {
    const dados = { sessions, rolls, tecnicas: esteira, buracos, aulas: vistasAulas, quiz: respostasQuiz };
    return goals
      .filter((g) => g.status !== 'concluida')
      .map((g) => ({ ...g, p: progressoDaMeta(g, dados) }))
      .filter((g) => g.p.conta)
      .slice(0, 5);
  }, [goals, sessions, rolls, esteira, buracos, vistasAulas, respostasQuiz]);
  const dom = useMemo(() => resumoGraus(esteira), [esteira]);
  const meuJogo = useMemo(() => jogoPrincipal(esteira, 5), [esteira]);
  const recs = useMemo(
    () => recomendacoesDoAluno({ tecnicas: esteira, buracos, partners, sessions, rolls, faixa: settings.faixa, feitas, limite: 2 }),
    [esteira, buracos, partners, sessions, rolls, settings.faixa, feitas]
  );
  const jogo = useMemo(() => analisarJogo(rolls, partners, sessions, settings.faixa), [rolls, partners, sessions, settings.faixa]);
  const horasNoAno = useMemo(
    () => (Number(settings.metaAnualHoras) > 0 ? metaDeHorasNoAno(sessions, Number(settings.metaAnualHoras)) : null),
    [sessions, settings.metaAnualHoras]
  );

  const naGame = techniques.filter((t) => t.status === 'game').length;
  const aprendendo = techniques.filter((t) => t.status === 'aprendendo').length;

  const semDados = sessions.length === 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="h-page">
            {settings.nome ? `E aí, ${settings.nome.split(' ')[0]}` : 'Painel'}
          </h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {sessions.length >= 3 && (
            <Btn icon={carregandoIa ? Loader : Sparkles} disabled={carregandoIa} onClick={async () => {
              setCarregandoIa(true);
              try {
                const resumoIa = {
                  faixa: settings.faixa, treinos: r.sessoes, horas: r.matHoras, rolas: r.rolas,
                  finalizacoesAplicadas: r.topAplicadas, finalizacoesSofridas: r.topSofridas,
                  tecnicasDominadas: esteira.filter((e) => e.nivel === 'dominado').map((e) => e.nome),
                  jogoA: meuJogo.map((e) => e.nome),
                  streak: r.streak.atual,
                };
                const res = await analisarDiario(resumoIa, settings.faixa);
                setAnalise(res?.dados || { leitura: res?.texto || '' });
              } catch (e) { toast(String(e.message || e), 'err'); }
              finally { setCarregandoIa(false); }
            }}>
              {carregandoIa ? 'Lendo…' : 'Análise IA'}
            </Btn>
          )}
          <Btn variant="primary" icon={Plus} onClick={() => irPara('treinos')}>Registrar treino</Btn>
        </div>
      </div>

      {semDados && (
        <Card className="accent" style={{ marginBottom: 14 }}>
          <Empty
            icon={Swords}
            titulo="Tatame vazio. Bora encher."
            texto="Registre seu primeiro treino: quantos rolas, com quem, o que funcionou e o que não. Em duas semanas os gráficos já te mostram onde tá o buraco no seu jogo."
            acao={<Btn variant="primary" icon={Plus} onClick={() => irPara('treinos')}>Registrar o primeiro treino</Btn>}
          />
        </Card>
      )}

      {/* ---- números principais ---- */}
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Card className="hover">
          <Stat
            icon={Flame}
            tone={r.streak.atual > 0 ? 'roar' : undefined}
            valor={<Contador valor={r.streak.atual} />}
            label="dias de streak"
            sub={`recorde ${r.streak.recorde}`}
          />
        </Card>
        <Card className="hover">
          <Stat icon={Clock} valor={<Contador valor={r.matHoras} suffix="h" />} label="no tatame" sub={`${r.sessoes} treinos`} />
        </Card>
        <Card className="hover">
          <Stat
            icon={Swords}
            valor={<Contador valor={r.rolas} />}
            label={r.rolas === 1 ? 'luta registrada' : 'lutas registradas'}
            sub="treino técnico não conta"
          />
        </Card>
        <Card className="hover">
          <Finalizacoes dadas={r.finalizacoes} sofridas={r.taps} />
        </Card>
      </div>

      {(() => {
        const aberta = lesoes.find((l) => l.status !== 'curada' && l.impacto === 'parado');
        if (!aberta) return null;
        const sit = situacao(aberta);
        const guia = guiaDeEstudo(aberta.regiao);
        if (!sit) return null;
        return (
          <Card style={{ marginBottom: 14, borderLeft: `3px solid var(--${sit.tone})` }}>
            <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <span className="stat-ico" style={{ color: `var(--${sit.tone})` }}><HeartPulse size={16} /></span>
              <div style={{ flex: 1 }}>
                <div className="h-sec">{sit.titulo}</div>
                <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.7 }}>{sit.texto}</p>
                <p className="tiny muted" style={{ marginTop: 8, lineHeight: 1.7 }}>{guia.porque}</p>
                <div className="valida bom" style={{ marginTop: 12 }}>
                  <ShieldCheck size={14} className="valida-ico" style={{ color: 'var(--jade)' }} />
                  <p className="micro muted" style={{ lineHeight: 1.6 }}>
                    Sua sequência está protegida. Estudar conta no lugar de treinar enquanto você se recupera.
                  </p>
                </div>
                <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
                  <Btn size="sm" variant="primary" onClick={() => irPara('estudo', { tema: guia.busque[0] })}>
                    Estudar sobre isso
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => irPara('lesoes')}>Ver a lesão</Btn>
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* ---- metas, num bloco só e logo no alto ---- */}
      {dash.metas !== false && (
        <Card style={{ marginBottom: 14 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">tudo que você assumiu</div>
              <h2 className="h-sec">Suas metas</h2>
            </div>
            <button className="btn ghost xs" onClick={() => irPara('metas')}>ver todas <ArrowRight size={12} /></button>
          </div>

          {metasAtivas.length === 0 && !horasNoAno ? (
            <>
              <p className="tiny muted" style={{ lineHeight: 1.65 }}>
                Nenhuma meta assumida ainda. Meta de frequência funciona melhor que meta de resultado no
                começo, porque depende só de você aparecer.
              </p>
              <Btn size="sm" variant="ghost" onClick={() => irPara('metas')} style={{ marginTop: 11 }}>
                Criar uma meta
              </Btn>
            </>
          ) : (
            <div className="col" style={{ gap: 14 }}>
              {/* a de horas no ano, desenhada como as outras */}
              {horasNoAno && <LinhaDeMeta titulo="Horas no ano" p={horasNoAno} />}
              {metasAtivas.map((g) => <LinhaDeMeta key={g.id} titulo={tituloDaMeta(g)} p={g.p} />)}
            </div>
          )}
        </Card>
      )}

      {convidarPraLiga && jaNaLiga === false && (
        <Card className="accent" style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="stat-ico" style={{ width: 42, height: 42, borderRadius: 13, color: 'var(--roar)' }}>
              <Trophy size={19} />
            </span>
            <div style={{ flex: 1, minWidth: 210 }}>
              <div className="eyebrow">ranking que vira toda semana</div>
              <div className="h-sec" style={{ marginTop: 3 }}>Volte pra liga</div>
              <p className="tiny muted" style={{ marginTop: 5, lineHeight: 1.65 }}>
                Você está fora. Voltando, o próximo treino te coloca num grupo com gente de ritmo parecido com o
                seu. Dá pra aparecer com apelido.
              </p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Btn variant="primary" icon={Swords} onClick={() => irPara('jornada')}>Ver a liga</Btn>
            </div>
          </div>
        </Card>
      )}

      <Destaques resumo={r} onVerTudo={() => irPara('analise')} />

      <PrimeirosPassos sessions={sessions} rolls={rolls} tecnicas={esteira} irPara={irPara} />
      <AvisoDeVolta sessions={sessions} irPara={irPara} />

      {/* ---- sequência e resumo da semana ---- */}
      {sessions.length > 0 && (
        <Card className={fraseSeq.tom === 'jade' ? 'accent' : ''} style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 13, alignItems: 'flex-start', marginBottom: recap.vazia ? 0 : 14 }}>
            <span className="stat-ico" style={{ color: `var(--${fraseSeq.tom || 'dim'})` }}>
              <Flame size={17} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="h-sec">{fraseSeq.titulo}</div>
              <p className="tiny muted" style={{ marginTop: 5, lineHeight: 1.65 }}>{fraseSeq.texto}</p>
              {seq.recorde > seq.semanas && seq.recorde >= 3 && (
                <p className="micro muted" style={{ marginTop: 6 }}>
                  Seu recorde é de {seq.recorde} semanas seguidas.
                </p>
              )}

              {(escudo.tem > 0 || escudo.gastos > 0) && (
                <div className="escudos">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className={`escudo ${i < escudo.tem ? 'cheio' : ''}`}>
                      <ShieldCheck size={12} />
                    </span>
                  ))}
                  <span className="micro muted" style={{ marginLeft: 4 }}>
                    {escudo.tem
                      ? `${escudo.tem} ${escudo.tem === 1 ? 'escudo' : 'escudos'}`
                      : 'escudo gasto'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {!recap.vazia && (
            <div style={{ borderTop: '1px solid var(--seam)', paddingTop: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>sua semana, {rotuloSemana(recap.semana)}</div>
              <p className="tiny" style={{ lineHeight: 1.7 }}>{lerSemana(recap, settings.faixa)}</p>
              {recap.xp > 0 && (
                <div className="row wrap" style={{ gap: 6, marginTop: 11 }}>
                  <Chip tone="accent">+{recap.xp} pontos</Chip>
                  {recap.subiram.map((t) => (
                    <Chip key={t.nome} tone="jade">{t.nome} subiu de grau</Chip>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ---- ritmo da semana. Só vira meta se você tiver criado uma ---- */}
      {(() => {
        const metaFreq = (goals || []).find((g) => g.tipo === 'frequencia' && g.origem !== 'sugerida' && g.status === 'ativa');
        const alvo = metaFreq ? Number(metaFreq.alvo) : 0;
        return (
          <Card style={{ marginBottom: 14 }}>
            <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
              <Donut
                valor={semana.qtd}
                max={alvo || Math.max(1, semana.qtd)}
                label={alvo ? `${semana.qtd}/${alvo}` : String(semana.qtd)}
                sub="semana"
                size={104}
              />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="eyebrow">{alvo ? 'meta que você criou' : 'esta semana'}</div>
                <div className="h-sec" style={{ marginTop: 4 }}>
                  {alvo
                    ? (semana.qtd >= alvo
                        ? 'Meta batida'
                        : `${semana.qtd} de ${alvo} treinos`)
                    : (semana.qtd === 0
                        ? 'Nenhum treino registrado ainda'
                        : `${semana.qtd} ${semana.qtd === 1 ? 'treino' : 'treinos'} registrados`)}
                </div>
                <p className="tiny muted" style={{ marginTop: 6 }}>
                  {fmtData(semana.ini, { curto: true })} a {fmtData(semana.fim, { curto: true })}
                  {r.streak.ultimo && `, último treino ${relativo(r.streak.ultimo)}`}
                </p>
                {!alvo && sessions.length >= 3 && (
                  <p className="micro muted" style={{ marginTop: 8 }}>
                    Se quiser um alvo de frequência, dá pra criar em Metas. Sem isso o app só mostra o que aconteceu.
                  </p>
                )}
                <div className="row wrap" style={{ marginTop: 12, gap: 6 }}>
                  {naGame > 0 && <Chip tone="jade">{naGame} no jogo</Chip>}
                  {aprendendo > 0 && <Chip tone="warn">{aprendendo} aprendendo</Chip>}
                  {paraRevisar.length > 0 && <Chip tone="blood">{paraRevisar.length} pra revisar</Chip>}
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* ---- convite pro teste de estilo ---- */}
      {!settings.estiloDeclarado && !settings.quizDispensado && !jogo.estilo && sessions.length > 0 && (
        <Card className="accent" style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="stat-ico" style={{ width: 42, height: 42, borderRadius: 13 }}><Sparkles size={19} /></span>
            <div style={{ flex: 1, minWidth: 210 }}>
              <div className="eyebrow">1 minuto</div>
              <div className="h-sec" style={{ marginTop: 3 }}>Qual é o seu estilo de jogo?</div>
              <p className="tiny muted" style={{ marginTop: 5 }}>
                Seis perguntas pra começar. Depois de 15 rolas com pontuação, o app troca a sua resposta pelo que os
                números realmente mostram.
              </p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Btn variant="primary" onClick={() => irPara('meujogo')}>Descobrir</Btn>
              <Btn variant="ghost" size="sm" onClick={() => salvarSettings({ quizDispensado: 1 })}>Agora não</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* ---- meta de horas, só se você tiver criado uma ---- */}
      {/* ---- minhas técnicas ---- */}
      {dash.dominio !== false && esteira.length > 0 && (
        <Card className="accent" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">o que os seus treinos mostram</div>
              <h2 className="h-sec row" style={{ gap: 7 }}>
                Minhas técnicas
                <button className="ajuda" onClick={() => setAjudaTec(true)} aria-label="O que é isso">?</button>
              </h2>
            </div>
            <button className="btn ghost xs" onClick={() => irPara('dominio')}>ver todas <ArrowRight size={12} /></button>
          </div>

          <div className="grid g4" style={{ gap: 12, marginBottom: 14 }}>
            {[4, 3, 2, 1].map((n) => (
              <div key={n} className="stat">
                <div className="row" style={{ gap: 7, marginBottom: 5 }}><Ponteira n={n} mini /></div>
                <span className="stat-val num sm" style={{ color: `var(--${grauPorN(n).cor})` }}>{dom[`g${n}`]}</span>
                <span className="stat-lab">{grauPorN(n).curto}</span>
              </div>
            ))}
          </div>

          {meuJogo.length > 0 && (
            <div className="row wrap" style={{ gap: 7 }}>
              {meuJogo.map((e) => {
                const g = grauPorN(e.grau);
                return (
                  <span key={e.nome} className="chip" style={{ color: `var(--${g.cor})`, borderColor: `color-mix(in srgb, var(--${g.cor}) 40%, var(--seam))` }}>
                    {e.nome} <Ponteira n={e.grau} mini />
                  </span>
                );
              })}
            </div>
          )}

          {recs.length > 0 && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--seam)', paddingTop: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>o que treinar agora</div>
              <div className="col" style={{ gap: 10 }}>
                {recs.map((r, i) => (
                  <Recomendacao
                    key={`${r.intencao}:${r.alvo || i}`}
                    rec={r}
                    faixa={settings.faixa}
                    vistas={vistasAulas.map((v) => v.videoId)}
                  />
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="split" style={{ marginBottom: 14 }}>
        {/* ---- escada posicional: o elemento assinatura ---- */}
        {dash.escada !== false && (
          <Card className="pad-0">
            <div style={{ padding: '18px 18px 4px' }}>
              <div className="card-head" style={{ marginBottom: 4 }}>
                <div>
                  <RotuloPeriodo periodo={periodoDeDados('desde-inicio')}>sai dos pontos que você marca</RotuloPeriodo>
                  <h2 className="h-sec">Onde você fica por cima e onde fica por baixo</h2>
                </div>
                <span className="micro muted nowrap">pts IBJJF</span>
              </div>
              <p className="tiny muted" style={{ marginBottom: 10 }}>
Toda vez que você marca um ponto, o app anota a posição que veio junto. Passagem de guarda coloca
                você em cima dos 100kg, montada coloca na montada, e assim por diante. Verde é quando você chegou lá,
                vermelho é quando o outro chegou. De cima pra baixo, da melhor posição pra pior.
              </p>
            </div>
            <div style={{ padding: '0 10px 16px' }}>
              <EscadaPosicional dados={escada} compacto />
            </div>
          </Card>
        )}

        <div className="col">
          {dash.finalizacoes !== false && (
            <Card>
              <div className="card-head">
                <div>
                  <RotuloPeriodo periodo={periodoDeDados('desde-inicio')} />
                  <h2 className="h-sec">Você finaliza com</h2>
                </div>
                <Chip tone="jade">{r.finalizacoes}</Chip>
              </div>
              <BarrasTop dados={r.topAplicadas} tone="jade" vazio="Marque as finalizações nos rolas." />
              <div className="divider" style={{ margin: '16px 0 14px' }} />
              <div className="card-head">
                <h2 className="h-sec">Você cai em</h2>
                <Chip tone="blood">{r.taps}</Chip>
              </div>
              <BarrasTop dados={r.topSofridas} tone="blood" vazio="Nada registrado, ou você é um monstro." />
            </Card>
          )}
        </div>
      </div>

      {/* ---- heatmap ---- */}
      {dash.heat !== false && (
        <Card style={{ marginBottom: 14 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">toque num dia pra ver o treino</div>
              <h2 className="h-sec">Presença no tatame</h2>
            </div>
            <span className="micro muted">escolha o mês nas setas</span>
          </div>
          <Calendario
            modo="mes"
            sessions={sessions} rolls={rolls} partners={partners} gradings={gradings}
            aoAbrirTreino={(ses) => irPara('treinos', { abrir: ses.id })}
            aoVerTudo={() => irPara('analise')}
          />
        </Card>
      )}

      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">como você venceu</div>
            <h2 className="h-sec">Evolução</h2>
          </div>
          <button className="btn ghost xs" onClick={() => irPara('analise')}>ver tudo <ArrowRight size={12} /></button>
        </div>
        <GraficoEvolucao
          compacto periodoInicial="3m"
          sessions={sessions} rolls={rolls} partners={partners} gradings={gradings}
        />
      </Card>

      <Sheet aberto={!!analise} onClose={() => setAnalise(null)} titulo="O que os seus números dizem">
        {analise && (
          <>
            {analise.leitura && <p className="tiny">{analise.leitura}</p>}
            <div className="col" style={{ gap: 10 }}>
              {(analise.focos || []).map((f, i) => (
                <div key={i} className="card" style={{ background: 'var(--void)' }}>
                  <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                    <span className="install-n">{i + 1}</span>
                    <div>
                      <div className="tiny" style={{ fontWeight: 600 }}>{f.titulo}</div>
                      <p className="micro muted" style={{ marginTop: 4 }}>{f.porque}</p>
                      {f.comoTreinar && (
                        <p className="micro" style={{ marginTop: 6, color: 'var(--jade)' }}>Como treinar: {f.comoTreinar}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {analise.pergunta && (
              <div className="valida atencao">
                <Target size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
                <div>
                  <div className="micro" style={{ fontWeight: 600 }}>Leve isso pro seu professor</div>
                  <p className="micro muted" style={{ marginTop: 3 }}>{analise.pergunta}</p>
                </div>
              </div>
            )}
            <p className="micro muted">A IA lê só os seus números. Quem conhece o seu jogo de verdade é quem te vê rolar.</p>
          </>
        )}
      </Sheet>

      <Sheet aberto={ajudaTec} onClose={() => setAjudaTec(false)} titulo="Minhas técnicas" wide>
        <p className="tiny muted" style={{ lineHeight: 1.7 }}>
          Toda técnica que aparece nas suas rolas entra aqui sozinha. Você não precisa cadastrar nada: basta
          registrar o que aconteceu no treino.
        </p>
        <p className="tiny muted" style={{ lineHeight: 1.7 }}>
          Cada uma ganha graus conforme você usa, igual à ponteira da sua faixa. E o grau não sobe só com
          quantidade: encaixar cinco vezes no mesmo colega vale menos que encaixar em cinco pessoas diferentes.
        </p>

        <div className="divider" />
        <div className="eyebrow">os quatro graus</div>
        <div className="col" style={{ gap: 12 }}>
          {[
            ['Conheço o movimento', 'Apareceu pelo menos uma vez numa rola sua.'],
            ['Funciona no rola', 'Saiu várias vezes com o outro resistindo de verdade.'],
            ['Faz parte do meu jogo', 'Sai em gente diferente, ou você já refinou bastante na mesma pessoa.'],
            ['Assinatura', 'É o seu golpe. Sai até contra quem é mais graduado que você.'],
          ].map(([n, d], i) => (
            <div key={n} className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
              <span style={{ marginTop: 3 }}><Ponteira n={i + 1} mini /></span>
              <div style={{ flex: 1 }}>
                <div className="tiny" style={{ fontWeight: 600 }}>{n}</div>
                <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.6 }}>{d}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="valida bom">
          <Target size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
          <p className="micro muted" style={{ lineHeight: 1.65 }}>
            Levar uma técnica nunca baixa o grau da sua. Se você tem uma boa americana e toma uma de vez em
            quando, a sua americana continua boa. O que aquilo mostra é outra coisa: falta trabalhar a saída.
          </p>
        </div>
      </Sheet>
    </div>
  );
}



/* ============================================================
   FINALIZAÇÕES

   O "saldo de taps" confundia: ninguém sabia se menos um era
   ruim, nem de onde vinha. Agora os dois números aparecem
   lado a lado, com quem está na frente em destaque.
   ============================================================ */
function Finalizacoes({ dadas = 0, sofridas = 0 }) {
  const [ajuda, setAjuda] = useState(false);
  const total = dadas + sofridas;
  const dif = dadas - sofridas;

  const leitura = !total
    ? 'Nenhuma finalização registrada ainda.'
    : dif > 0
      ? `Você finaliza mais do que bate, por ${dif}.`
      : dif < 0
        ? `Você bate mais do que finaliza, por ${Math.abs(dif)}. Normal quando se rola com gente mais graduada.`
        : 'Empatado entre dar e levar.';

  return (
    <>
      <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
        <span className="stat-ico"><Swords size={15} /></span>
        <span className="spacer" />
        <button className="ajuda" onClick={() => setAjuda(true)} aria-label="O que é isso">?</button>
      </div>

      <div className="fin-par">
        <div className="fin-lado">
          <span className="fin-num num" style={{ color: dif >= 0 ? 'var(--jade)' : 'var(--dim)' }}>{dadas}</span>
          <span className="fin-rot">apliquei</span>
        </div>
        <span className="fin-sep" />
        <div className="fin-lado">
          <span className="fin-num num" style={{ color: dif < 0 ? 'var(--blood)' : 'var(--dim)' }}>{sofridas}</span>
          <span className="fin-rot">sofri</span>
        </div>
      </div>

      <div className="fin-barra">
        <i style={{ width: `${total ? (dadas / total) * 100 : 50}%`, background: 'var(--jade)' }} />
        <i style={{ width: `${total ? (sofridas / total) * 100 : 50}%`, background: 'var(--blood)' }} />
      </div>

      <p className="micro muted" style={{ marginTop: 8, lineHeight: 1.5 }}>{leitura}</p>

      <Sheet aberto={ajuda} onClose={() => setAjuda(false)} titulo="Finalizações">
        <p className="tiny muted" style={{ lineHeight: 1.7 }}>
          À esquerda, quantas vezes você fez alguém bater. À direita, quantas vezes você bateu.
        </p>
        <p className="tiny muted" style={{ lineHeight: 1.7 }}>
          Levar mais do que aplicar é o normal no começo, e continua normal se você rola com gente
          mais graduada que você. O que importa é ver esses dois números se aproximarem ao longo dos meses.
        </p>
      </Sheet>
    </>
  );
}
