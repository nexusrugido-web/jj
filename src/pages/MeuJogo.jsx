import React, { useMemo, useState } from 'react';
import {
  Dna, Trophy, TrendingUp, TrendingDown, Target, Info, Sparkles, Check,
  TriangleAlert, Swords, Weight, MapPin, ArrowRight, Loader, RefreshCw,
} from 'lucide-react';
import { useApp } from '../contexto';
import { db } from '../db/db';
import {
  Card, Btn, Chip, Empty, Stat, Sheet, Bar, Seg, useToast,
} from '../components/UI';
import { Radar, BarrasTop } from '../components/Charts';
import GraficoEvolucao from '../components/GraficoEvolucao';
import TaxaPorFaixa from '../components/TaxaPorFaixa';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  analisarJogo, lerJogo, compararEstilo, MIN_ROLAS_ESTILO,
} from '../lib/game';
import { EIXOS, ESTILOS, estiloPorId, QUIZ, estiloDoQuiz } from '../db/scoring';
import { pct } from '../lib/utils';

export default function MeuJogo() {
  const { rolls, partners, sessions, settings, salvarSettings, irPara } = useApp();
  const toast = useToast();
  const [aba, setAba] = useState('estilo');
  const [quizAberto, setQuizAberto] = useState(false);
  const [comoAberto, setComoAberto] = useState(false);

  const a = useMemo(() => analisarJogo(rolls, partners, sessions, settings.faixa), [rolls, partners, sessions, settings.faixa]);
  const notas = useMemo(() => lerJogo(a), [a]);
  const gradings = useLiveQuery(() => db.gradings.toArray(), [], []) || [];
  const comparacao = useMemo(() => compararEstilo(settings.estiloDeclarado, a), [settings.estiloDeclarado, a]);

  const declarado = settings.estiloDeclarado ? estiloPorId(settings.estiloDeclarado) : null;
  const real = a.estilo ? estiloPorId(a.estilo.id) : null;
  const mostrar = real || declarado;

  const radarEixos = EIXOS.map((e) => ({ nome: e.nome, valor: a.eixos[e.id] || 0, cor: `var(--${e.cor})` }));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Meu jogo</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Btn icon={Info} onClick={() => setComoAberto(true)}>Como funciona</Btn>
          <Btn icon={declarado ? RefreshCw : Dna} onClick={() => setQuizAberto(true)}>
            {declarado ? 'Refazer teste' : 'Descobrir meu estilo'}
          </Btn>
        </div>
      </div>

      {/* ---- o cartão do estilo ---- */}
      <Card className="accent" style={{ marginBottom: 14 }}>
        {mostrar ? (
          <>
            <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div className="eyebrow">
                  {real ? `calculado de ${a.rolas} rolas registrados` : 'declarado no teste, ainda sem dados'}
                </div>
                <h2 style={{ fontSize: 'clamp(22px,4.5vw,30px)', fontWeight: 800, marginTop: 7, letterSpacing: '-0.03em' }}>
                  {mostrar.nome}
                </h2>
                <p style={{ color: 'var(--accent)', fontStyle: 'italic', marginTop: 5, fontSize: 14 }}>"{mostrar.lema}"</p>
                <p className="tiny muted" style={{ marginTop: 10, maxWidth: 460 }}>{mostrar.desc}</p>

                {real && (
                  <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
                    <Chip tone="jade">{a.estilo.confianca}% de confiança</Chip>
                    {a.estilo.dominante && (
                      <Chip>eixo forte: {EIXOS.find((e) => e.id === a.estilo.dominante)?.nome}</Chip>
                    )}
                  </div>
                )}
              </div>

              {!a.suficiente && (
                <div className="card" style={{ background: 'var(--void)', minWidth: 220, flex: 1 }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>ainda calculando</div>
                  <div className="row tiny" style={{ marginBottom: 7 }}>
                    <span style={{ flex: 1 }}>rolas com pontos registrados</span>
                    <span className="num muted">{a.rolas}/{MIN_ROLAS_ESTILO}</span>
                  </div>
                  <Bar v={a.rolas} max={MIN_ROLAS_ESTILO} />
                  <p className="micro muted" style={{ marginTop: 10 }}>
                    Faltam <b style={{ color: 'var(--accent)' }}>{a.faltam} rolas</b> com pontuação marcada pra eu parar de
                    usar o teste e começar a usar a realidade.
                  </p>
                </div>
              )}
            </div>

            {comparacao && (
              <div className={`valida ${comparacao.bate ? 'bom' : 'atencao'}`} style={{ marginTop: 16 }}>
                {comparacao.bate
                  ? <Check size={16} className="valida-ico" style={{ color: 'var(--jade)' }} />
                  : <TriangleAlert size={16} className="valida-ico" style={{ color: 'var(--roar)' }} />}
                <div>
                  <div className="tiny" style={{ fontWeight: 600 }}>{comparacao.titulo}</div>
                  <p className="micro muted" style={{ marginTop: 4 }}>{comparacao.texto}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <Empty
              icon={Dna}
              titulo="Vamos descobrir seu estilo"
              texto="Responda 6 perguntas rápidas pra ter um ponto de partida. Depois de 15 rolas com pontuação registrada, o app troca a sua resposta pela realidade dos seus números."
              acao={<Btn variant="primary" icon={Dna} onClick={() => setQuizAberto(true)}>Fazer o teste (1 minuto)</Btn>}
            />
            <div className="divider" style={{ margin: '16px 0 12px' }} />
            <div className="eyebrow" style={{ marginBottom: 9 }}>ou escolha direto</div>
            <div className="row wrap" style={{ gap: 7 }}>
              {ESTILOS.map((e) => (
                <button
                  key={e.id} className="chip"
                  onClick={async () => {
                    await salvarSettings({ estiloDeclarado: e.id, quizDispensado: 1 });
                    toast(`Estilo definido: ${e.nome}`);
                  }}
                >
                  {e.nome}
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      {a.rolas === 0 ? (
        <Card>
          <Empty
            icon={Trophy}
            titulo="Nenhuma rola com pontuação ainda"
            texto="Finalização é raro. Ponto acontece toda rola, é isso que dá dado suficiente pra o app entender o seu jogo. Marque queda, raspagem, passagem, montada e costas em cada rola."
            acao={<Btn variant="primary" icon={Swords} onClick={() => irPara('treinos')}>Registrar um rola</Btn>}
          />
        </Card>
      ) : (
        <>
          <div className="grid g4" style={{ marginBottom: 14 }}>
            <Card><Stat icon={Trophy} valor={`${a.taxaVitoria}%`} label="taxa de vitória" sub={`${a.vitorias}V ${a.derrotas}D ${a.empates}E`} tone={a.taxaVitoria >= 50 ? 'jade' : undefined} /></Card>
            <Card><Stat valor={a.ptsMeus} label="pontos conquistados" tone="jade" sub={`${a.mediaMeus} por rola`} /></Card>
            <Card><Stat valor={a.ptsDele} label="pontos sofridos" tone="blood" sub={`${a.mediaDele} por rola`} /></Card>
            <Card><Stat valor={`${a.saldo >= 0 ? '+' : ''}${a.saldo}`} label="saldo" tone={a.saldo >= 0 ? 'jade' : 'blood'} sub={`${a.porMinuto} pts/min`} /></Card>
          </div>

          {notas.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div className="card-head">
                <div>
                  <div className="eyebrow">o que os números gritam</div>
                  <h2 className="h-sec">Leitura do seu jogo</h2>
                </div>
              </div>
              <div className="col" style={{ gap: 9 }}>
                {notas.map((nota, i) => (
                  <div key={i} className={`valida ${nota.tom === 'jade' ? 'bom' : nota.tom === 'blood' ? 'ruim' : 'atencao'}`}>
                    {nota.tom === 'jade' ? <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
                      : <TriangleAlert size={15} className="valida-ico" style={{ color: `var(--${nota.tom === 'blood' ? 'blood' : 'roar'})` }} />}
                    <div>
                      <div className="tiny" style={{ fontWeight: 600 }}>{nota.titulo}</div>
                      <p className="micro muted" style={{ marginTop: 3 }}>{nota.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Seg value={aba} onChange={setAba} options={[
            { id: 'estilo', nome: 'Radar' },
            { id: 'pontos', nome: 'Pontuação' },
            { id: 'contexto', nome: 'Contexto' },
          ]} />
          <div style={{ height: 14 }} />

          {aba === 'estilo' && (
            <div className="split">
              <Card>
                <div className="card-head">
                  <h2 className="h-sec">Radar de 6 eixos</h2>
                  <span className="micro muted">0 a 100</span>
                </div>
                <Radar eixos={radarEixos} size={280} />
              </Card>
              <Card>
                <div className="card-head"><h2 className="h-sec">Eixo por eixo</h2></div>
                <div className="col" style={{ gap: 13 }}>
                  {EIXOS.map((e) => {
                    const v = a.eixos[e.id] || 0;
                    return (
                      <div key={e.id} className="eixo-linha">
                        <span className="eixo-nome">{e.nome}</span>
                        <div className="bar thin"><i style={{ width: `${v}%`, background: `var(--${e.cor})` }} /></div>
                        <span className="eixo-val" style={{ color: `var(--${e.cor})` }}>{v}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="micro muted" style={{ marginTop: 16 }}>
                  Cada eixo é normalizado pela frequência por rola. "Defesa" é o inverso do que você concede ,
                  quanto menos passagem e finalização você sofre, mais alto ele fica.
                </p>
              </Card>
            </div>
          )}

          {aba === 'pontos' && (
            <>
              <div className="split" style={{ marginBottom: 14 }}>
                <Card>
                  <div className="card-head">
                    <h2 className="h-sec">Onde você pontua</h2>
                    <Chip tone="jade">{a.ptsMeus} pts</Chip>
                  </div>
                  {a.conquistei.length === 0 ? (
                    <p className="tiny muted">Marque os pontos nos rolas pra ver isso.</p>
                  ) : (
                    <div className="col" style={{ gap: 11 }}>
                      {a.conquistei.map((c) => (
                        <div key={c.id} className="col" style={{ gap: 5 }}>
                          <div className="row tiny">
                            <span style={{ flex: 1 }}>{c.nome}</span>
                            <span className="num micro muted">{c.n}× · {c.total} pts</span>
                            <span className="num micro" style={{ color: 'var(--jade)', minWidth: 34, textAlign: 'right' }}>{c.pct}%</span>
                          </div>
                          <div className="bar thin jade"><i style={{ width: `${c.pct}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card>
                  <div className="card-head">
                    <h2 className="h-sec">Onde você concede</h2>
                    <Chip tone="blood">{a.ptsDele} pts</Chip>
                  </div>
                  {a.sofri.length === 0 ? (
                    <p className="tiny muted">Nada registrado, ou você é uma muralha.</p>
                  ) : (
                    <div className="col" style={{ gap: 11 }}>
                      {a.sofri.map((c) => (
                        <div key={c.id} className="col" style={{ gap: 5 }}>
                          <div className="row tiny">
                            <span style={{ flex: 1 }}>{c.nome}</span>
                            <span className="num micro muted">{c.n}× · {c.total} pts</span>
                            <span className="num micro" style={{ color: 'var(--blood)', minWidth: 34, textAlign: 'right' }}>{c.pct}%</span>
                          </div>
                          <div className="bar thin blood"><i style={{ width: `${c.pct}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {(a.vantMinhas > 0 || a.vantDele > 0) && (
                <Card style={{ marginBottom: 14 }}>
                  <div className="card-head">
                    <div>
                      <div className="eyebrow">o "quase lá"</div>
                      <h2 className="h-sec">Vantagens</h2>
                    </div>
                  </div>
                  <div className="grid g2" style={{ gap: 12 }}>
                    <Stat size="sm" valor={a.vantMinhas} label="você conquistou" tone="jade" />
                    <Stat size="sm" valor={a.vantDele} label="você concedeu" tone="blood" />
                  </div>
                  <p className="micro muted" style={{ marginTop: 12 }}>
                    Vantagem é você tendo chegado na posição e não segurado os 3 segundos. É o indicador mais honesto
                    de quanto está faltando, cada uma dessas é um ponto que quase entrou.
                  </p>
                </Card>
              )}

              <Card>
                <div className="card-head">
                  <div>
                    <div className="eyebrow">escolha o período e a métrica</div>
                    <h2 className="h-sec">Evolução do seu jogo</h2>
                  </div>
                </div>
                <GraficoEvolucao
                  sessions={sessions} rolls={rolls} partners={partners} gradings={gradings}
                  metricaInicial="pontos"
                />
              </Card>
            </>
          )}

          {aba === 'contexto' && (
            <div className="col" style={{ gap: 14 }}>
              <Card>
                <div className="card-head">
                  <div>
                    <div className="eyebrow">o número que não mente</div>
                    <h2 className="h-sec row" style={{ gap: 8 }}><Swords size={16} /> Taxa de vitória por faixa</h2>
                  </div>
                </div>
                <TaxaPorFaixa sessions={sessions} rolls={rolls} partners={partners} minhaFaixa={settings.faixa} />
              </Card>

              <Card>
                <div className="card-head">
                  <h2 className="h-sec row" style={{ gap: 8 }}><Weight size={16} /> Contra cada peso</h2>
                </div>
                {a.porPeso.length === 0 ? (
                  <p className="tiny muted">Marque o peso relativo do parceiro em cada rola.</p>
                ) : (
                  <TabelaContexto linhas={a.porPeso} />
                )}
              </Card>

              <Card>
                <div className="card-head">
                  <h2 className="h-sec row" style={{ gap: 8 }}><MapPin size={16} /> Por posição inicial</h2>
                  <span className="micro muted">de onde você ganha e de onde apanha</span>
                </div>
                {a.porPosicao.length === 0 ? (
                  <p className="tiny muted">Marque a posição inicial de cada rola pra descobrir onde treinar.</p>
                ) : (
                  <TabelaContexto linhas={a.porPosicao} />
                )}
              </Card>
            </div>
          )}
        </>
      )}

      <QuizEstilo
        aberto={quizAberto}
        onClose={() => setQuizAberto(false)}
        onPronto={async (estilo, opcoes = {}) => {
          try {
            await salvarSettings({ estiloDeclarado: estilo, quizDispensado: 1 });
            if (!opcoes.silencioso) toast(`Estilo definido: ${estiloPorId(estilo).nome}`);
          } catch (e) {
            console.error('[estilo]', e);
            toast('Não consegui salvar o estilo. Tente escolher na lista abaixo.', 'err');
          }
        }}
      />
      <ComoFunciona aberto={comoAberto} onClose={() => setComoAberto(false)} />
    </div>
  );
}

function TabelaContexto({ linhas }) {
  return (
    <div className="col" style={{ gap: 10 }}>
      {linhas.map((l) => {
        const taxa = pct(l.v, l.n);
        const saldo = l.meus - l.dele;
        return (
          <div key={l.chave} className="col" style={{ gap: 6 }}>
            <div className="row tiny" style={{ gap: 8 }}>
              <span style={{ flex: 1, textTransform: 'capitalize' }}>{l.icone ? `${l.icone} ` : ''}{l.nome}</span>
              <span className="num micro muted">{l.n} rola{l.n > 1 ? 's' : ''}</span>
              <span className="num micro" style={{ color: saldo >= 0 ? 'var(--jade)' : 'var(--blood)', minWidth: 40, textAlign: 'right' }}>
                {saldo >= 0 ? '+' : ''}{saldo} pts
              </span>
              <span className="num micro" style={{ minWidth: 38, textAlign: 'right', color: taxa >= 50 ? 'var(--jade)' : 'var(--blood)' }}>{taxa}%</span>
            </div>
            <div className="bar thin"><i style={{ width: `${taxa}%`, background: taxa >= 50 ? 'var(--jade)' : 'var(--blood)' }} /></div>
          </div>
        );
      })}
    </div>
  );
}

/* ================= quiz ================= */
function QuizEstilo({ aberto, onClose, onPronto }) {
  const [passo, setPasso] = useState(0);
  const [respostas, setRespostas] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [salvo, setSalvo] = useState(false);

  React.useEffect(() => {
    if (aberto) { setPasso(0); setRespostas([]); setResultado(null); setSalvo(false); }
  }, [aberto]);

  const responder = (efeito) => {
    const novas = [...respostas];
    novas[passo] = efeito;
    setRespostas(novas);
    if (passo < QUIZ.length - 1) {
      setTimeout(() => setPasso(passo + 1), 160);
      return;
    }
    /* Última pergunta: calcula E JÁ SALVA. Não depende de nenhum
       clique extra, se o botão falhar, o estilo já está guardado. */
    const r = estiloDoQuiz(novas);
    setResultado(r);
    Promise.resolve(onPronto(r.estilo, { silencioso: true }))
      .then(() => setSalvo(true))
      .catch((e) => console.error('[quiz]', e));
  };

  const q = QUIZ[passo];

  return (
    <Sheet
      aberto={aberto}
      onClose={onClose}
      titulo={resultado ? 'Seu estilo de jogo' : 'Descobrir meu estilo'}
      subtitulo={resultado ? undefined : `${passo + 1} de ${QUIZ.length}`}
    >
      {resultado ? (
        <div className="col center" style={{ alignItems: 'center', gap: 16, padding: '10px 0' }}>
          <div className="celebra-selo" style={{ width: 66, height: 66 }}><Dna size={30} /></div>
          <div className="center">
            <div className="eyebrow">seu estilo de jogo</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, marginTop: 8, letterSpacing: '-0.03em' }}>
              {estiloPorId(resultado.estilo).nome}
            </h2>
            <p style={{ color: 'var(--accent)', fontStyle: 'italic', marginTop: 6 }}>
              "{estiloPorId(resultado.estilo).lema}"
            </p>
            <p className="tiny muted" style={{ marginTop: 12, maxWidth: 380 }}>
              {estiloPorId(resultado.estilo).desc}
            </p>
          </div>

          <div className="valida atencao" style={{ width: '100%' }}>
            <Info size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
            <p className="micro muted">
              Isso é o que você <b style={{ color: 'var(--chalk)' }}>acha</b> que é. Registre {MIN_ROLAS_ESTILO} rolas com
              pontuação e o app troca essa resposta pelo que os seus números realmente mostram, que às vezes é o oposto.
            </p>
          </div>

          {salvo && (
            <div className="valida bom" style={{ width: '100%' }}>
              <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
              <p className="micro muted">Já ficou salvo no seu perfil. Pode fechar.</p>
            </div>
          )}

          <Btn
            variant="primary"
            onClick={() => { onPronto(resultado.estilo); onClose(); }}
            style={{ width: '100%', minHeight: 48 }}
          >
            {salvo ? 'Pronto' : 'Salvar meu estilo'}
          </Btn>

          <button className="btn ghost xs" onClick={() => { setResultado(null); setPasso(0); setRespostas([]); setSalvo(false); }}>
            Refazer o teste
          </button>
        </div>
      ) : (
        <>
          <div className="quiz-barra"><i style={{ width: `${((passo) / QUIZ.length) * 100}%` }} /></div>
          <h3 style={{ fontSize: 'clamp(18px,4vw,22px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3, marginTop: 6 }}>
            {q.q}
          </h3>
          <div className="col" style={{ gap: 9 }}>
            {q.ops.map((o, i) => (
              <button key={i} className="quiz-op" onClick={() => responder(o.e)}>{o.t}</button>
            ))}
          </div>
          {passo > 0 && (
            <button className="btn ghost xs" onClick={() => setPasso(passo - 1)} style={{ alignSelf: 'flex-start' }}>
              Voltar
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}

/* ================= explicação ================= */
function ComoFunciona({ aberto, onClose }) {
  return (
    <Sheet aberto={aberto} onClose={onClose} titulo="Como o Meu Jogo funciona" wide>
      <p className="tiny muted">
        Finalização é evento raro, pode passar semanas sem uma. <b style={{ color: 'var(--chalk)' }}>Ponto acontece toda rola.</b> É
        por isso que registrar a pontuação IBJJF dá dado suficiente pra o app entender o seu jogo de verdade, e não só nos rolas que acabam em tap.
      </p>

      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>a tabela IBJJF</div>
        <div className="grid g2" style={{ gap: 8 }}>
          {[['Queda', 2], ['Raspagem', 2], ['Joelho na barriga', 2], ['Passagem de guarda', 3], ['Montada', 4], ['Pegada nas costas', 4]].map(([n, p]) => (
            <div key={n} className="row" style={{ padding: '9px 11px', background: 'var(--void)', borderRadius: 10 }}>
              <span className="tiny" style={{ flex: 1 }}>{n}</span>
              <span className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{p}</span>
            </div>
          ))}
        </div>
        <p className="micro muted" style={{ marginTop: 10 }}>
          A posição precisa ser estabilizada por 3 segundos. Não estabilizou? Isso é vantagem, e o app registra separado,
          porque é o melhor indicador de "quanto falta".
        </p>
      </div>

      <div className="divider" />
      <div className="eyebrow">o estilo calculado</div>
      <p className="tiny muted">
        O teste de 6 perguntas serve só pra você não abrir um app vazio no primeiro dia. Depois de {MIN_ROLAS_ESTILO} rolas
        com pontuação, o app para de usar a sua resposta e passa a usar a distribuição real dos seus pontos.
      </p>
      <p className="tiny muted">
        Se 60% do que você conquista vem de passagem e montada, você é um passador, mesmo que tenha respondido "guardeiro".
        Quando isso acontece o app te mostra a divergência na cara, sem passar a mão na cabeça.
      </p>

      <div className="divider" />
      <div className="eyebrow">os seis eixos</div>
      <div className="col" style={{ gap: 8 }}>
        {[
          ['Queda', 'Quedas conquistadas por rola.'],
          ['Passagem', 'Passagens de guarda por rola.'],
          ['Raspagem', 'Raspagens por rola, o jogo por baixo.'],
          ['Controle', 'Montada, costas e joelho na barriga somados.'],
          ['Finalização', 'Finalizações aplicadas por rola.'],
          ['Defesa', 'O inverso do que você concede. Quanto menos passagem e tap você sofre, mais alto.'],
        ].map(([n, d]) => (
          <div key={n} className="row" style={{ gap: 10, padding: '9px 11px', background: 'var(--void)', borderRadius: 10, alignItems: 'flex-start' }}>
            <Chip>{n}</Chip>
            <p className="micro muted" style={{ flex: 1 }}>{d}</p>
          </div>
        ))}
      </div>

      <div className="valida bom">
        <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
        <p className="micro muted">
          Marcar pontos também preenche a escada posicional sozinha e alimenta o cálculo de domínio, inclusive com o
          peso do adversário: raspar alguém mais pesado vale mais.
        </p>
      </div>
    </Sheet>
  );
}
