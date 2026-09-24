import React, { useMemo, useState, useEffect } from 'react';
import {
  Flame, Clock, Swords, Target, ArrowRight, Plus, Award, Trophy, Sparkles, Loader, ShieldCheck,
  HeartPulse, Check, BarChart3, ChevronRight,
} from 'lucide-react';
import MinhaOfensiva from '../components/MinhaOfensiva';
import Guia from '../components/Guia';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useApp } from '../contexto';
import { Card, Btn, Contador, Empty, Chip, Field, Stepper } from '../components/UI';
import { EscadaPosicional, BarrasTop, Donut } from '../components/Charts';
import Calendario from '../components/Calendario';
import GraficoEvolucao from '../components/GraficoEvolucao';
import { resumo, escadaPosicional, treinosNaSemana } from '../lib/stats';
import { relativo, emQuanto } from '../lib/utils';
import { minhasTecnicas, meusBuracos, jogoPrincipal, grauPorN } from '../lib/graus';
import { recomendacoesDoAluno, faltaPara } from '../lib/recomendar';
import { progressoDaMeta, tituloDaMeta, metaDeHorasNoAno } from '../lib/metas';
import LinhaDeMeta from '../components/LinhaDeMeta';
import RotuloPeriodo from '../components/RotuloPeriodo';
import { periodoDeDados } from '../lib/periodo';
import Recomendacao, { VitrineRecomendacao } from '../components/Recomendacao';
import { resumoSemana, lerSemana } from '../lib/semana';
import { ofensiva } from '../lib/ofensiva';
import { situacao, guiaDeEstudo } from '../lib/lesao';
import { analisarJogo } from '../lib/game';
import { Ponteira } from '../components/Ponteira';
import { PrimeirosPassos, AvisoDeVolta } from '../components/PrimeirosPassos';
import Destaques from '../components/Destaques';
import { analisarDiario } from '../lib/ai';
import { Sheet, useToast, Diamante } from '../components/UI';
import { podeVer } from '../lib/plano';
import { Convite, Vitrine } from '../components/Plano';
import { supabase } from '../lib/supabase';

export default function Painel() {
  const [ajudaTec, setAjudaTec] = useState(false);
  const { sessions, rolls, positions, settings, salvarSettings, irPara, goals, techniques, partners, ligada, sessao, acesso } = useApp();
  const toast = useToast();
  const [analise, setAnalise] = useState(null);
  const [carregandoIa, setCarregandoIa] = useState(false);
  const [conviteIa, setConviteIa] = useState(false);
  const [ofensivaAberta, setOfensivaAberta] = useState(false);
  /* no grátis ficam os números; os gráficos e o "o que treinar" são do premium */
  const graficosLivres = podeVer(acesso, 'analise');
  const recsLivres = podeVer(acesso, 'recomendacoes');
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
  const lesoes = useLiveQuery(() => db.injuries.toArray(), [], []) || [];
  /* a lesão que tira do tatame congela a ofensiva: sem isso,
     quem operou o joelho perde tudo enquanto está de molho */
  const ofa = useMemo(() => ofensiva(pontos, undefined, lesoes), [pontos, lesoes]);

  const esteira = useMemo(() => minhasTecnicas(rolls, partners, sessions, techniques, settings.faixa, gradings, settings.graus || 0), [rolls, partners, sessions, techniques, settings.faixa, gradings, settings.graus]);
  const recap = useMemo(() => resumoSemana(sessions, rolls, esteira, { faixa: settings.faixa }), [sessions, rolls, esteira, settings.faixa]);
  const buracos = useMemo(() => meusBuracos(rolls, partners, sessions, settings.faixa), [rolls, partners, sessions, settings.faixa]);

  const metasAtivas = useMemo(() => {
    const dados = { sessions, rolls, tecnicas: esteira, buracos, aulas: vistasAulas, quiz: respostasQuiz };
    return goals
      .filter((g) => g.status !== 'concluida')
      .map((g) => ({ ...g, p: progressoDaMeta(g, dados) }))
      .filter((g) => g.p.conta)
      .slice(0, 5);
  }, [goals, sessions, rolls, esteira, buracos, vistasAulas, respostasQuiz]);
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
              if (!podeVer(acesso, 'ia')) { setConviteIa(true); return; }
              setCarregandoIa(true);
              try {
                const resumoIa = {
                  faixa: settings.faixa, treinos: r.sessoes, horas: r.matHoras, rolas: r.rolas,
                  finalizacoesAplicadas: r.topAplicadas, finalizacoesSofridas: r.topSofridas,
                  tecnicasDominadas: esteira.filter((e) => e.grau >= 3).map((e) => e.nome),
                  jogoA: meuJogo.map((e) => e.nome),
                  streak: ofa.dias,
                };
                const res = await analisarDiario(resumoIa, settings.faixa);
                setAnalise(res?.dados || { leitura: res?.texto || '' });
              } catch (e) { toast(String(e.message || e), 'err'); }
              finally { setCarregandoIa(false); }
            }}>
              {carregandoIa ? 'Lendo…' : 'Neuro-Análise IA'} <Diamante />
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

      {/* ---- o placar: um cartão, os números que importam ----
          a ofensiva é a mesma da Liga (pontos), não dias de treino */}
      <Card className="painel-placar" style={{ marginBottom: 14 }}>
        <div className="placar-principal">
        {/* a ofensiva é o número que traz a pessoa de volta: faixa própria,
            e o toque abre a sequência, o escudo e a semana contra a passada */}
        <button type="button" className="placar-ofa" onClick={() => setOfensivaAberta(true)}>
          <span className="placar-ofa-chama"><Flame size={24} /></span>
          <span className="placar-ofa-txt">
            <span className="placar-ofa-linha">
              <span className="placar-num num" style={ofa.dias > 0 ? { color: 'var(--roar)' } : undefined}>
                <Contador valor={ofa.dias} />
              </span>
              <span className="placar-rot">{ofa.dias === 1 ? 'dia de ofensiva' : 'dias de ofensiva'}</span>
            </span>
            <span className="placar-sub">
              recorde {ofa.recorde} · {ofa.escudos
                ? `${ofa.escudos} ${ofa.escudos === 1 ? 'escudo' : 'escudos'}`
                : `escudo em ${ofa.faltaProEscudo} ${ofa.faltaProEscudo === 1 ? 'dia' : 'dias'}`}
            </span>
          </span>
          <span className="placar-ofa-ver">Ver <ChevronRight size={15} /></span>
        </button>
        {/* quatro quadros do mesmo tamanho: cada número com o seu nome e o
            que ele quer dizer, sem espaço sobrando do lado */}
        <div className="placar-grade">
          <QuadroDoPlacar icone={Clock} rotulo="No tatame" valor={<Contador valor={r.matHoras} suffix="h" />}
            sub={`em ${r.sessoes} ${r.sessoes === 1 ? 'treino' : 'treinos'}`} />
          <QuadroDoPlacar icone={Swords} rotulo={r.rolas === 1 ? 'Luta' : 'Lutas'} valor={<Contador valor={r.rolas} />}
            sub={r.sessoes ? `${String((r.rolas / r.sessoes).toFixed(1)).replace('.', ',')} por treino` : 'nenhum treino ainda'} />
          <QuadroDoPlacar icone={Trophy} tom="jade" rotulo="Finalizei" valor={<Contador valor={r.finalizacoes} />}
            sub={r.finalizacoes === 1 ? 'vez que fiz bater' : 'vezes que fiz bater'} />
          <QuadroDoPlacar icone={ShieldCheck} tom="blood" rotulo="Fui finalizado" valor={<Contador valor={r.taps} />}
            sub={r.taps === 1 ? 'vez que bati' : 'vezes que bati'} />
        </div>
        </div>
        <div className="placar-fin">
          <Finalizacoes dadas={r.finalizacoes} sofridas={r.taps} />
        </div>
      </Card>

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
                  <Btn size="sm" variant="contorno" onClick={() => irPara('lesoes')}>Ver a lesão</Btn>
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
              <Btn variant="primary" icon={Swords} onClick={() => irPara('liga')}>Ver a liga</Btn>
            </div>
          </div>
        </Card>
      )}

      <Destaques resumo={r} onVerTudo={() => irPara('analise')} />

      <PrimeirosPassos sessions={sessions} rolls={rolls} tecnicas={esteira} irPara={irPara} />
      <AvisoDeVolta sessions={sessions} irPara={irPara} />

      {/* ---- o ritmo da semana ---- */}
      <SemanaDoRitmo
        semana={semana}
        metaFreq={(goals || []).find((g) => g.tipo === 'frequencia' && g.origem !== 'sugerida' && g.status === 'ativa')}
        porSemana={Number(settings.metaSemanal) || 0}
        ultimoTreino={r.streak.ultimo}
        salvarSettings={salvarSettings}
        irPara={irPara}
        resumo={!recap.vazia && (
          <>
            <p className="tiny" style={{ lineHeight: 1.7 }}>{lerSemana(recap, settings.faixa)}</p>
            {/* grau é habilidade, ponto é esforço: nunca na mesma linha */}
            {recap.subiram.length > 0 && (
              <div className="row wrap" style={{ gap: 6, marginTop: 11 }}>
                {recap.subiram.map((t) => (
                  <Chip key={t.nome} tone="jade">{t.nome} subiu de grau</Chip>
                ))}
              </div>
            )}
          </>
        )}
        chips={
          <>
            {naGame > 0 && <Chip tone="jade">{naGame} no jogo</Chip>}
            {aprendendo > 0 && <Chip tone="warn">{aprendendo} aprendendo</Chip>}
            {paraRevisar.length > 0 && <Chip tone="blood">{paraRevisar.length} pra revisar</Chip>}
          </>
        }
      />

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

          {/* as três que mais aparecem, cada uma dizendo o que falta
              pro próximo grau. A lista inteira fica em "ver todas". */}
          <p className="micro muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
            {esteira.length > 3
              ? `As 3 que mais aparecem nos seus rolas, de ${esteira.length} no total.`
              : esteira.length === 1
                ? 'A que apareceu nos seus rolas até agora.'
                : `As ${esteira.length} que apareceram nos seus rolas até agora.`}
          </p>
          <div className="col" style={{ gap: 8 }}>
            {esteira.slice(0, 3).map((t) => (
              <TecnicaNaHome key={t.nome} t={t} faixa={settings.faixa} onAbrir={() => irPara('dominio')} />
            ))}
          </div>

          {recs.length > 0 && !recsLivres && (
            <div style={{ marginTop: 16 }}>
              <VitrineRecomendacao recs={recs} faixa={settings.faixa} vistas={vistasAulas.map((v) => v.videoId)} onAssinar={() => irPara('ajustes')} />
            </div>
          )}
          {recs.length > 0 && recsLivres && (
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

      {graficosLivres ? (<>
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
      </>) : !semDados && (
        /* no grátis os gráficos viram uma vitrine só, com a evolução real borrada */
        <Vitrine
          recurso="analise"
          fundo={<GraficoEvolucao compacto periodoInicial="3m" sessions={sessions} rolls={rolls} partners={partners} gradings={gradings} />}
          titulo="Os gráficos do seu jogo"
          texto={`Os seus ${r.rolas} rolas já desenham como você vence, onde fica por cima e com que frequência aparece.`}
          itens={[
            'Evolução: como você vence, semana a semana',
            'Onde você fica por cima e onde fica por baixo',
            'Com o que você finaliza e em que você cai',
            'Presença no tatame, dia a dia',
          ]}
          onAssinar={() => irPara('ajustes')}
        />
      )}

      <MinhaOfensiva aberto={ofensivaAberta} onClose={() => setOfensivaAberta(false)} />

      {/* a IA é do premium: no grátis o botão abre o convite */}
      <Sheet aberto={conviteIa} onClose={() => setConviteIa(false)} titulo="">
        <Convite
          recurso="ia"
          marca="NeuroJitsu"
          titulo="Análise IA"
          texto="A IA lê os seus treinos, rolas e técnicas e diz em poucas linhas o que os seus números mostram, e o que fazer no próximo treino."
          itens={[
            'Uma leitura curta do seu momento',
            'Os focos pra agora, com o porquê e como treinar',
            'Uma pergunta pra levar pro seu professor',
          ]}
          onAssinar={() => { setConviteIa(false); irPara('ajustes'); }}
        />
      </Sheet>

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
        <Guia
          inicial="entra"
          topicos={[
            {
              id: 'entra', icone: Sparkles, titulo: 'Como a técnica entra aqui', resumo: 'Sozinha, pelo que você registra no rola',
              conteudo: <p>Toda técnica que aparece nos seus rolas entra sozinha. Você não cadastra nada: basta registrar o que aconteceu no treino.</p>,
            },
            {
              id: 'graus', icone: Award, titulo: 'Os quatro graus', resumo: 'Igual à ponteira da sua faixa',
              conteudo: (
                <div className="col" style={{ gap: 10 }}>
                  {[
                    ['Conheço o movimento', 'Apareceu pelo menos uma vez num rola seu.'],
                    ['Funciona no rola', 'Saiu várias vezes com o outro resistindo de verdade.'],
                    ['Faz parte do meu jogo', 'Sai em gente diferente e em semanas diferentes. Não foi uma fase boa.'],
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
              ),
            },
            {
              id: 'barra', icone: BarChart3, titulo: 'A barra e o que falta', resumo: 'Quanto do caminho até o próximo grau',
              conteudo: <p>A barra mostra quanto você já andou até o próximo grau. Embaixo dela vem o que falta fazer no tatame pra ela subir. Encaixar cinco vezes no mesmo colega vale menos que em cinco pessoas diferentes.</p>,
            },
            {
              id: 'levar', icone: ShieldCheck, titulo: 'Levar a técnica baixa o grau?', resumo: 'Não. Mostra outra coisa',
              conteudo: <p>Se você tem uma boa americana e toma uma de vez em quando, a sua americana continua boa. O que aquilo mostra é que falta trabalhar a saída.</p>,
            },
          ]}
        />
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
      <div className="row" style={{ gap: 8 }}>
        <span className="placar-rot" style={{ flex: 1 }}>Quem fez mais bater</span>
        <button className="ajuda" onClick={() => setAjuda(true)} aria-label="O que é isso">?</button>
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

/* um quadro do placar: o nome, o número grande e o que ele quer dizer */
function QuadroDoPlacar({ icone: Icone, rotulo, valor, sub, tom }) {
  return (
    <div className={`placar-quadro${tom ? ` ${tom}` : ''}`}>
      <span className="placar-quadro-rot"><Icone size={15} /> {rotulo}</span>
      <span className="placar-quadro-num num">{valor}</span>
      <span className="placar-quadro-sub">{sub}</span>
    </div>
  );
}

/* ============================================================
   UMA TÉCNICA NA HOME

   O grau de hoje, a barra até o próximo e, embaixo, o que falta
   fazer. No 2º grau a conta é só de usos no rola (pelo peso de cada
   um), então dá pra mostrar ela inteira ("1 de 5") e a barra bate.
   ============================================================ */
function TecnicaNaHome({ t, faixa, onAbrir }) {
  const g = grauPorN(t.grau);
  const prox = t.proximo ? grauPorN(t.proximo) : null;
  const falta = faltaPara(t, faixa);
  const conta = t.proximo === 2 && !t.soDrill && t.requisitos ? `${Math.min(t.requisitos.usos, Math.floor(t.volume))} de ${t.requisitos.usos}` : null;

  return (
    <button className="tec-home" onClick={onAbrir}>
      <div className="tec-home-topo">
        <span className="tec-home-nome">{t.nome}</span>
        <span className="tec-home-grau" style={{ color: `var(--${g.cor === 'dimmer' ? 'dim' : g.cor})` }}>
          <Ponteira n={t.grau} mini /> {g.curto}
        </span>
      </div>
      {prox ? (
        <>
          <div className="tec-home-barra">
            <i style={{ width: `${Math.max(4, t.progresso)}%`, background: `var(--${prox.cor})` }} />
          </div>
          <div className="tec-home-rodape">
            <span>{falta?.resumo}</span>
            {conta && <span className="num">{conta}</span>}
          </div>
        </>
      ) : (
        <div className="tec-home-rodape"><span>Grau máximo. Daqui pra frente é refinar.</span></div>
      )}
    </button>
  );
}

/* ============================================================
   O RITMO DA SEMANA

   O alvo é o que a pessoa respondeu no começo ("treino 3x por
   semana"), e o círculo vai fechando com os treinos registrados.
   Quem criou uma meta de frequência em Metas manda nela.

   A semana vai de segunda a domingo e zera na segunda, então a
   tela diz isso com todas as letras, em vez de dois números
   soltos com barra.
   ============================================================ */
function SemanaDoRitmo({ semana, metaFreq, porSemana, ultimoTreino, salvarSettings, irPara, chips, resumo }) {
  const [mudando, setMudando] = useState(false);
  const [quanto, setQuanto] = useState(porSemana || 3);
  const alvo = metaFreq ? Number(metaFreq.alvo) : porSemana;
  const feito = semana.qtd;


  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
        <Donut
          valor={feito}
          max={alvo || Math.max(1, feito)}
          label={alvo ? `${feito}/${alvo}` : String(feito)}
          sub="semana"
          size={104}
        />
        <div style={{ flex: 1, minWidth: 170 }}>
          <div className="eyebrow">{metaFreq ? 'meta que você criou' : 'o ritmo que você marcou'}</div>
          <div className="h-sec" style={{ marginTop: 4 }}>
            {!alvo
              ? (feito === 0 ? 'Nenhum treino esta semana' : `${feito} ${feito === 1 ? 'treino' : 'treinos'} esta semana`)
              : feito >= alvo
                ? 'Semana cumprida'
                : `${feito} de ${alvo} treinos`}
          </div>
          <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
            A semana termina {emQuanto(semana.fim)}
            {ultimoTreino && `. Último treino ${relativo(ultimoTreino)}`}.
          </p>
          {alvo > 0 && feito < alvo && (
            <p className="micro muted" style={{ marginTop: 6 }}>
              {alvo - feito === 1 ? 'Falta um treino' : `Faltam ${alvo - feito} treinos`} até domingo.
            </p>
          )}
          <div className="row wrap" style={{ marginTop: 12, gap: 6 }}>
            {chips}
            <button
              className="btn ghost xs"
              onClick={() => (metaFreq ? irPara('metas') : setMudando(true))}
            >
              {metaFreq ? 'ver a meta' : 'mudar o ritmo'}
            </button>
          </div>
        </div>
      </div>

      {resumo && (
        <div style={{ borderTop: '1px solid var(--seam)', paddingTop: 14, marginTop: 16 }}>{resumo}</div>
      )}

      <Sheet
        aberto={mudando} onClose={() => setMudando(false)}
        titulo="Quantas vezes por semana" subtitulo="é o alvo do círculo, dá pra mudar quando quiser"
        footer={(
          <>
            <Btn variant="ghost" onClick={() => setMudando(false)}>Cancelar</Btn>
            <Btn variant="primary" icon={Check} onClick={async () => { await salvarSettings({ metaSemanal: quanto }); setMudando(false); }}>
              Salvar
            </Btn>
          </>
        )}
      >
        <Field label="Treinos por semana">
          <Stepper value={quanto} onChange={setQuanto} min={1} max={14} />
        </Field>
        <p className="micro muted" style={{ lineHeight: 1.7 }}>
          Vale como alvo do círculo e ajuda o app a te colocar num grupo de ritmo parecido na liga.
          Pra acompanhar de verdade, com histórico, crie uma meta de frequência em Metas.
        </p>
      </Sheet>
    </Card>
  );
}
