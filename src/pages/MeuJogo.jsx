import React, { useMemo, useState } from 'react';
import {
  Dna, Trophy, Info, Check, TriangleAlert, Swords, Weight, MapPin, RefreshCw, ArrowRight,
  ListChecks, Award, Calculator, Lock,
} from 'lucide-react';
import Guia from '../components/Guia';
import { useApp } from '../contexto';
import {
  Card, Btn, Empty, Stat, Sheet, Bar, useToast,
} from '../components/UI';
import {
  analisarJogo, lerJogo, compararEstilo, porqueDoEstilo, oQueMaisCede, MIN_ROLAS_ESTILO,
} from '../lib/game';
import { minhasTecnicas } from '../lib/graus';
import { podeVer } from '../lib/plano';
import { ESTILOS, estiloPorId, QUIZ, estiloDoQuiz } from '../db/scoring';

/* 4.8 vira 4,8 */
const decimal = (x) => String(x).replace('.', ',');

export default function MeuJogo() {
  const {
    rolls, partners, sessions, techniques, gradings, settings, salvarSettings, irPara, acesso,
  } = useApp();
  const toast = useToast();
  const [quizAberto, setQuizAberto] = useState(false);
  const [comoAberto, setComoAberto] = useState(false);

  const a = useMemo(() => analisarJogo(rolls, partners, sessions, settings.faixa), [rolls, partners, sessions, settings.faixa]);
  const notas = useMemo(() => lerJogo(a), [a]);
  const comparacao = useMemo(() => compararEstilo(settings.estiloDeclarado, a), [settings.estiloDeclarado, a]);
  const cede = useMemo(() => oQueMaisCede(a), [a]);

  /* o grau de cada técnica, pra técnica mais usada de cada ponto
     mostrar o mesmo número que a tela Técnicas */
  const grauDe = useMemo(() => new Map(
    minhasTecnicas(rolls, partners, sessions, techniques, settings.faixa, gradings, settings.graus || 0)
      .map((t) => [t.nome.toLowerCase(), t.grau])
  ), [rolls, partners, sessions, techniques, settings.faixa, gradings, settings.graus]);

  const declarado = settings.estiloDeclarado ? estiloPorId(settings.estiloDeclarado) : null;
  const real = a.estilo ? estiloPorId(a.estilo.id) : null;
  const mostrar = real || declarado;

  const n = a.rolas;
  const ganhos = a.lances.filter((l) => l.meus > 0).sort((x, y) => y.meus - x.meus);
  const cedidos = a.lances.filter((l) => l.deles > 0).sort((x, y) => y.deles - x.deles);
  /* com poucos rolas, "nunca raspou" ainda não diz nada */
  const ausentes = n >= 5 ? a.lances.filter((l) => l.meus === 0) : [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Meu jogo</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Btn icon={Info} onClick={() => setComoAberto(true)}>Como funciona</Btn>
          {!a.suficiente && (
            <Btn icon={declarado ? RefreshCw : Dna} onClick={() => setQuizAberto(true)}>
              {declarado ? 'Refazer o teste' : 'Fazer o teste'}
            </Btn>
          )}
        </div>
      </div>

      {/* ---- o estilo ---- */}
      <Card className="accent" style={{ marginBottom: 14 }}>
        {mostrar ? (
          <>
            <div className="eyebrow">
              {real ? `seu estilo · ${n} rolas com pontos marcados` : 'seu estilo pelo teste'}
            </div>
            <h2 style={{ fontSize: 'clamp(22px,4.5vw,30px)', fontWeight: 800, marginTop: 7, letterSpacing: '-0.03em' }}>
              {mostrar.nome}
            </h2>
            <p style={{ color: 'var(--accent)', fontStyle: 'italic', marginTop: 5, fontSize: 14 }}>"{mostrar.lema}"</p>
            {real && (
              <p className="tiny" style={{ marginTop: 12, lineHeight: 1.65, fontWeight: 600 }}>{porqueDoEstilo(a.estilo, n)}</p>
            )}
            {/* no jogo completo o porquê já diz a mesma coisa */}
            {!(real && a.estilo.id === 'completo') && (
              <p className="tiny muted" style={{ marginTop: 8, lineHeight: 1.65 }}>{mostrar.desc}</p>
            )}

            {!real && (
              <div style={{ marginTop: 14 }}>
                <div className="row tiny" style={{ marginBottom: 7 }}>
                  <span style={{ flex: 1 }}>rolas com pontos marcados</span>
                  <span className="num muted">{n} de {MIN_ROLAS_ESTILO}</span>
                </div>
                <Bar v={n} max={MIN_ROLAS_ESTILO} />
                <p className="micro muted" style={{ marginTop: 9, lineHeight: 1.6 }}>
                  Faltam {a.faltam} {a.faltam === 1 ? 'rola' : 'rolas'} com pontos marcados pra o estilo sair do que
                  acontece nos seus treinos, e não mais do teste.
                </p>
              </div>
            )}

            {comparacao && (
              <div className={`valida ${comparacao.bate ? 'bom' : 'atencao'}`} style={{ marginTop: 14 }}>
                {comparacao.bate
                  ? <Check size={16} className="valida-ico" style={{ color: 'var(--jade)' }} />
                  : <Info size={16} className="valida-ico" style={{ color: 'var(--roar)' }} />}
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
              titulo="Qual é o seu estilo de jogo?"
              texto={`Responda ${QUIZ.length} perguntas rápidas pra ter um ponto de partida. Depois de ${MIN_ROLAS_ESTILO} rolas com pontos marcados, o estilo passa a sair do que acontece nos seus treinos.`}
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

      {n === 0 ? (
        <Card>
          <Empty
            icon={Trophy}
            titulo="Nenhum rola com pontos marcados ainda"
            texto="Finalização é rara. Ponto acontece em quase todo rola, e é isso que mostra o seu jogo. Ao registrar o treino, marque queda, raspagem, passagem, montada e costas de cada rola."
            acao={<Btn variant="primary" icon={Swords} onClick={() => irPara('treinos')}>Registrar um treino</Btn>}
          />
        </Card>
      ) : (
        <>
          {/* ---- o placar ---- */}
          <Card style={{ marginBottom: 14 }}>
            <div className="eyebrow">desde o primeiro treino</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, letterSpacing: '-0.02em' }}>
              Venceu {a.vitorias} de {n} {n === 1 ? 'rola' : 'rolas'}
            </div>
            <p className="micro muted" style={{ marginTop: 4 }}>
              {a.derrotas} {a.derrotas === 1 ? 'derrota' : 'derrotas'} · {a.empates} {a.empates === 1 ? 'empate' : 'empates'}
            </p>
            <div className="grid g2" style={{ gap: 12, marginTop: 14 }}>
              <Stat size="sm" valor={decimal(a.mediaMeus)} label="pontos seus em cada rola, na média" tone="jade" />
              <Stat size="sm" valor={decimal(a.mediaDele)} label="pontos do parceiro em cada rola, na média" tone="blood" />
            </div>
          </Card>

          {/* ---- onde você ganha ---- */}
          <Card style={{ marginBottom: 14 }}>
            <div className="card-head">
              <div>
                <div className="eyebrow">em quantos dos seus {n} rolas</div>
                <h2 className="h-sec">Onde você ganha</h2>
              </div>
            </div>
            {ganhos.length === 0 ? (
              <p className="tiny muted">Nenhum ponto seu marcado ainda.</p>
            ) : (
              <div className="col" style={{ gap: 13 }}>
                {ganhos.map((l) => (
                  <LinhaLance
                    key={l.id} nome={l.meu} vezes={l.meus} n={n} tom="jade"
                    tecnica={l.tecMeu && `mais usada: ${l.tecMeu.nome}${grauDe.get(l.tecMeu.nome.toLowerCase()) ? ` · ${grauDe.get(l.tecMeu.nome.toLowerCase())}º grau` : ''}`}
                  />
                ))}
              </div>
            )}
            {a.vantMinhas > 0 && (
              <p className="micro muted" style={{ marginTop: 14, lineHeight: 1.6 }}>
                E {a.vantMinhas} {a.vantMinhas === 1 ? 'vantagem' : 'vantagens'}: você chegou na posição e não segurou os
                3 segundos. É ponto que quase entrou.
              </p>
            )}
          </Card>

          {/* ---- onde você cede ---- */}
          <Card style={{ marginBottom: 14 }}>
            <div className="card-head">
              <div>
                <div className="eyebrow">em quantos dos seus {n} rolas</div>
                <h2 className="h-sec">Onde você cede</h2>
              </div>
            </div>
            {cedidos.length === 0 ? (
              <p className="tiny muted">Ninguém pontuou em você ainda.</p>
            ) : (
              <>
                {cede && (
                  <div className="valida atencao" style={{ marginBottom: 14 }}>
                    <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
                    <div>
                      <div className="tiny" style={{ fontWeight: 600 }}>{cede.dele} em {cede.deles} dos {n} rolas</div>
                      <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{cede.texto}</p>
                      <button type="button" className="btn ghost xs" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => irPara('estudo')}>
                        Ver o que treinar <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                )}
                <div className="col" style={{ gap: 13 }}>
                  {cedidos.map((l) => (
                    <LinhaLance
                      key={l.id} nome={l.dele} vezes={l.deles} n={n} tom="blood"
                      tecnica={l.tecDele && `a que mais aparece: ${l.tecDele.nome}`}
                    />
                  ))}
                </div>
              </>
            )}
            {a.vantDele > 0 && (
              <p className="micro muted" style={{ marginTop: 14, lineHeight: 1.6 }}>
                E {a.vantDele} {a.vantDele === 1 ? 'vantagem' : 'vantagens'} pro parceiro: ele chegou e você saiu antes dos 3 segundos.
              </p>
            )}
          </Card>

          {/* ---- o que ainda não aparece ---- */}
          {ausentes.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div className="card-head">
                <div>
                  <div className="eyebrow">nos seus {n} rolas</div>
                  <h2 className="h-sec">O que ainda não aparece</h2>
                </div>
              </div>
              <div className="col" style={{ gap: 12 }}>
                {ausentes.map((l) => (
                  <div key={l.id}>
                    <div className="tiny" style={{ fontWeight: 600 }}>{l.nenhum}</div>
                    <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.6 }}>{l.dica}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ---- por situação: é o que o plano pago abre ---- */}
          {podeVer(acesso, 'meujogo')
            ? <PorSituacao a={a} notas={notas} />
            : <VitrineSituacao a={a} notas={notas} onAssinar={() => irPara('ajustes')} />}
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

/* "Derrubou · 9 de 18", com a barra e a técnica embaixo */
function LinhaLance({ nome, vezes, n, tom, tecnica }) {
  return (
    <div className="col" style={{ gap: 5 }}>
      <div className="row tiny" style={{ gap: 8 }}>
        <span style={{ flex: 1 }}>{nome}</span>
        <span className="num micro" style={{ color: `var(--${tom})` }}>{vezes} de {n}</span>
      </div>
      <div className={`bar thin ${tom}`}><i style={{ width: `${Math.round((vezes / n) * 100)}%` }} /></div>
      {tecnica && <span className="micro muted">{tecnica}</span>}
    </div>
  );
}

function PorSituacao({ a, notas }) {
  const vazio = a.porPeso.length === 0 && a.porPosicao.length === 0;
  return (
    <Card>
      <div className="card-head">
        <div>
          <div className="eyebrow">desde o primeiro treino</div>
          <h2 className="h-sec">Em que situação você vai melhor</h2>
        </div>
      </div>
      {vazio ? (
        <p className="tiny muted">Marque o peso do parceiro e onde o rola começou pra ver isso.</p>
      ) : (
        <div className="col" style={{ gap: 18 }}>
          {notas.length > 0 && (
            <div className="col" style={{ gap: 9 }}>
              {notas.map((nota, i) => (
                <div key={i} className={`valida ${nota.tom === 'blood' ? 'ruim' : 'atencao'}`}>
                  <TriangleAlert size={15} className="valida-ico" style={{ color: `var(--${nota.tom === 'blood' ? 'blood' : 'roar'})` }} />
                  <div>
                    <div className="tiny" style={{ fontWeight: 600 }}>{nota.titulo}</div>
                    <p className="micro muted" style={{ marginTop: 3 }}>{nota.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {a.porPeso.length > 0 && (
            <div>
              <div className="tiny row" style={{ gap: 7, fontWeight: 600, marginBottom: 10 }}><Weight size={14} /> Peso do parceiro</div>
              <TabelaSituacao linhas={a.porPeso} />
            </div>
          )}
          {a.porPosicao.length > 0 && (
            <div>
              <div className="tiny row" style={{ gap: 7, fontWeight: 600, marginBottom: 10 }}><MapPin size={14} /> Onde o rola começou</div>
              <TabelaSituacao linhas={a.porPosicao} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   O QUE O PREMIUM ABRE AQUI

   A seção de verdade, com os números da própria pessoa, borrada
   atrás do convite. Ela vê que a resposta existe e é dela: não é
   promessa, é o jogo dela esperando.
   ============================================================ */
function VitrineSituacao({ a, notas, onAssinar }) {
  const temDado = a.porPeso.length > 0 || a.porPosicao.length > 0;
  return (
    <div className="vitrine">
      <div className="vitrine-fundo" aria-hidden="true">
        <PorSituacao a={a} notas={notas} />
      </div>
      <div className="vitrine-frente">
        <span className="vitrine-selo"><Lock size={13} /> Premium</span>
        <h3 className="h-sec" style={{ marginTop: 10 }}>Onde você perde as lutas que dava pra ganhar</h3>
        <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
          {temDado
            ? `Os seus ${a.rolas} rolas já mostram em que situação você vence menos. A resposta já está pronta, com os seus números.`
            : 'Marque o peso do parceiro e onde o rola começou, e o app mostra em que situação você vence menos.'}
        </p>
        <ul className="vitrine-lista">
          <li><Check size={15} /> Contra mais pesado, parecido e mais leve: quantas você vence</li>
          <li><Check size={15} /> A posição de começo em que você mais apanha</li>
          <li><Check size={15} /> O que treinar pra virar isso, com aula pronta no Estudo</li>
        </ul>
        <Btn variant="primary" onClick={onAssinar} style={{ marginTop: 14, width: '100%' }}>Liberar no premium</Btn>
      </div>
    </div>
  );
}

function TabelaSituacao({ linhas }) {
  return (
    <div className="col" style={{ gap: 11 }}>
      {linhas.map((l) => {
        const bom = l.v * 2 >= l.n;
        return (
          <div key={l.chave} className="col" style={{ gap: 5 }}>
            <div className="row tiny" style={{ gap: 8 }}>
              <span style={{ flex: 1 }}>{l.nome}</span>
              <span className="num micro" style={{ color: bom ? 'var(--jade)' : 'var(--blood)' }}>venceu {l.v} de {l.n}</span>
            </div>
            <div className="bar thin"><i style={{ width: `${Math.round((l.v / l.n) * 100)}%`, background: bom ? 'var(--jade)' : 'var(--blood)' }} /></div>
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
              Esse é o seu ponto de partida. Com {MIN_ROLAS_ESTILO} rolas com pontos marcados, o estilo passa a sair do
              que acontece nos seus treinos, que às vezes é diferente do que a gente imagina.
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
    <Sheet aberto={aberto} onClose={onClose} titulo="Como o Meu jogo funciona" wide>
      <Guia
        inicial="conta"
        topicos={[
          {
            id: 'conta', icone: ListChecks, titulo: 'O que entra na conta', resumo: 'Todo rola com pontos marcados, sem o drill',
            conteudo: (
              <>
                <p>Todo rola em que você marcou pontos ou finalização, desde o primeiro treino. Drill fica de fora, porque não tem ninguém resistindo.</p>
                <p>Cada número conta em quantos rolas aquilo aconteceu: um rola com três raspagens conta uma vez.</p>
              </>
            ),
          },
          {
            id: 'estilo', icone: Dna, titulo: 'Como sai o seu estilo', resumo: 'É o que aparece em mais rolas seus',
            conteudo: (
              <>
                <p>Se você passou a guarda em 11 de 18 e essa é a linha mais alta de "Onde você ganha", você é passador. Quando duas coisas bem diferentes aparecem quase o mesmo tanto, o estilo é jogo completo.</p>
                <p>Antes de {MIN_ROLAS_ESTILO} rolas com pontos marcados, vale o teste de {QUIZ.length} perguntas do começo. Depois, vale o que acontece nos treinos.</p>
              </>
            ),
          },
          {
            id: 'grau', icone: Award, titulo: 'Estilo e grau das técnicas', resumo: 'Duas contas do mesmo registro',
            conteudo: <p>O estilo olha o tipo de ponto: queda, passagem, raspagem. O grau olha cada técnica: qual queda, qual passagem, e sobe quando ela funciona em gente diferente, em semanas diferentes. Por isso cada linha de "Onde você ganha" mostra a técnica que você mais usa ali e o grau dela.</p>,
          },
          {
            id: 'pontos', icone: Calculator, titulo: 'Quanto vale cada ponto', resumo: 'A tabela da IBJJF, e o que é vantagem',
            conteudo: (
              <>
                <div className="grid g2" style={{ gap: 8 }}>
                  {[['Queda', 2], ['Raspagem', 2], ['Joelho na barriga', 2], ['Passagem de guarda', 3], ['Montada', 4], ['Pegada nas costas', 4]].map(([nome, p]) => (
                    <div key={nome} className="guia-linha row">
                      <span className="tiny" style={{ flex: 1 }}>{nome}</span>
                      <span className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{p}</span>
                    </div>
                  ))}
                </div>
                <p>A posição precisa ficar parada 3 segundos. Não ficou? É vantagem, e o app mostra separado, porque é ponto que quase entrou.</p>
              </>
            ),
          },
        ]}
      />
      <div className="valida bom">
        <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
        <p className="micro muted">
          Os pontos que você marca também preenchem o mapa de posições da Análise e fazem as técnicas subirem de grau.
        </p>
      </div>
    </Sheet>
  );
}
