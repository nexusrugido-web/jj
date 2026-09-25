import React, { useState } from 'react';
import { Check, ChevronRight, ChevronLeft, Dna, Sparkles } from 'lucide-react';
import { Card, Btn, Field, Input, useToast } from '../components/UI';
import { db } from '../db/db';
import { FAIXAS } from '../db/seed';
import { QUIZ, estiloDoQuiz, estiloPorId } from '../db/scoring';
import { hoje } from '../lib/utils';
import { podeVer, LIMITES } from '../lib/plano';
import { EscolherDificuldades } from '../components/Dificuldades';

/* ============================================================
   ONBOARDING

   Uma pergunta por tela: nome, faixa, tempo de tatame, ritmo, o
   que move, o que trava, o teste de estilo e as metas. Pergunta
   de um toque só avança sozinha. Nenhuma meta nasce sozinha: o
   que sai daqui é o que você marcou, e nada além disso.
   ============================================================ */

const OBJETIVOS = [
  { id: 'lazer', nome: 'Treinar por prazer', desc: 'Sem pressa, sem campeonato no radar.' },
  { id: 'condicionamento', nome: 'Condicionamento e saúde', desc: 'O jiu-jitsu como atividade física principal.' },
  { id: 'evolucao', nome: 'Evoluir tecnicamente', desc: 'Quero melhorar o jogo, mesmo sem competir.' },
  { id: 'competicao', nome: 'Competir', desc: 'Campeonato faz parte do plano.' },
];

const TEMPO = [
  { id: '0-6m', nome: 'Menos de 6 meses' },
  { id: '6m-1a', nome: '6 meses a 1 ano' },
  { id: '1-2a', nome: '1 a 2 anos' },
  { id: '2-5a', nome: '2 a 5 anos' },
  { id: '5a+', nome: 'Mais de 5 anos' },
];

export default function Onboarding({ settings, salvarSettings, acesso, onPronto }) {
  const toast = useToast();
  /* no grátis são até LIMITES.metasAtivas metas ativas, as mesmas regras da aba Metas */
  const tetoDeMetas = podeVer(acesso, 'metas') ? Infinity : LIMITES.metasAtivas;
  const [passo, setPasso] = useState(0);
  const [perfil, setPerfil] = useState({
    nome: settings.nome || '',
    faixa: settings.faixa || 'branca',
    graus: settings.graus || 0,
    tempo: '',
    frequencia: 0,
    objetivo: '',
    dificuldades: [],
  });
  const [respostas, setRespostas] = useState([]);
  const [quizPasso, setQuizPasso] = useState(0);
  const [estilo, setEstilo] = useState(null);
  const [metasEscolhidas, setMetasEscolhidas] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const PASSOS = [
    { id: 'nome', rotulo: 'Quem é você' },
    { id: 'faixa', rotulo: 'Sua faixa' },
    { id: 'tempo', rotulo: 'Seu tempo de tatame' },
    { id: 'frequencia', rotulo: 'Seu ritmo' },
    { id: 'objetivo', rotulo: 'O que te move' },
    { id: 'trava', rotulo: 'O que te trava' },
    { id: 'estilo', rotulo: 'Seu estilo' },
    { id: 'metas', rotulo: 'Suas metas' },
  ];
  const atual = PASSOS[passo].id;
  const ultimo = passo === PASSOS.length - 1;
  /* escolha de um toque só: marca e já passa pra próxima */
  const escolher = (mudanca) => {
    setPerfil((p) => ({ ...p, ...mudanca }));
    setTimeout(() => setPasso((x) => Math.min(x + 1, PASSOS.length - 1)), 260);
  };
  const Pergunta = ({ titulo, texto }) => (
    <div>
      <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>{titulo}</h2>
      {texto && <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.6 }}>{texto}</p>}
    </div>
  );

  /* ---------- sugestões nascem do perfil, não viram meta sozinhas ---------- */
  const sugestoes = [];
  if (perfil.frequencia >= 1) {
    sugestoes.push({
      id: 'freq',
      tipo: 'frequencia',
      alvo: perfil.frequencia,
      titulo: `Treinar ${perfil.frequencia}x por semana`,
      porque: `Foi o ritmo que você contou. Registrar isso é o que faz o resto do app ter dado pra trabalhar.`,
    });
  }
  if (perfil.faixa === 'branca') {
    sugestoes.push({
      id: 'defesa-branca',
      tipo: 'defesa',
      alvo: '',
      titulo: 'Focar em sair de posição ruim',
      porque: 'No primeiro ano, saber sair de baixo segura a evolução mais do que qualquer ataque novo. Você marca a técnica depois, quando souber qual mais te pega.',
    });
  }
  if (perfil.objetivo === 'competicao') {
    sugestoes.push({
      id: 'comp',
      tipo: 'competicao',
      alvo: '',
      titulo: 'Escolher um campeonato',
      porque: 'Data marcada muda a forma de treinar. Você preenche qual e quando depois.',
    });
  }

  async function concluir() {
    setSalvando(true);
    try {
      await salvarSettings({
        nome: perfil.nome,
        faixa: perfil.faixa,
        graus: perfil.graus,
        tempoTreino: perfil.tempo,
        metaSemanal: perfil.frequencia,
        objetivo: perfil.objetivo || 'lazer',
        dificuldades: perfil.dificuldades,
        estiloDeclarado: estilo || null,
        quizDispensado: 1,
        onboardingFeito: 1,
      });

      for (const id of metasEscolhidas) {
        const s = sugestoes.find((x) => x.id === id);
        if (!s) continue;
        await db.goals.add({
          tipo: s.tipo,
          alvo: s.alvo,
          grauAlvo: 3,
          titulo: s.titulo,
          origem: 'confirmada',
          status: 'ativa',
          inicio: hoje(),
          notas: '',
          criadoEm: Date.now(),
        });
      }
      onPronto();
    } catch (e) {
      console.error('[onboarding]', e);
      toast('Não consegui salvar tudo. Você pode ajustar em Ajustes.', 'err');
      onPronto();
    }
  }

  const podeAvancar =
    atual === 'nome' ? perfil.nome.trim().length > 0
    : atual === 'tempo' ? !!perfil.tempo
    : atual === 'frequencia' ? perfil.frequencia > 0
    : atual === 'objetivo' ? !!perfil.objetivo
    : true;

  return (
    <div className="login-wrap">
      <Card className="login-card" style={{ maxWidth: 480 }}>
        <div className="row" style={{ gap: 12, marginBottom: 18 }}>
          <span className="brand-mark" style={{ width: 40, height: 40, borderRadius: 12 }} />
          <div style={{ flex: 1 }}>
            <div className="brand-name" style={{ fontSize: 17 }}>NeuroJitsu</div>
            <div className="brand-sub">{PASSOS[passo].rotulo}</div>
          </div>
          <span className="micro muted num">{passo + 1} de {PASSOS.length}</span>
        </div>

        <div className="quiz-barra" style={{ marginBottom: 20 }}>
          <i style={{ width: `${((passo + 1) / PASSOS.length) * 100}%` }} />
        </div>

        {atual === 'nome' && (
          <div className="col" style={{ gap: 16 }}>
            <Pergunta titulo="Como te chamam?" texto="Isso fica só no seu aparelho, e serve pra o app falar com você do jeito certo." />
            <Input
              value={perfil.nome} onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' && perfil.nome.trim()) setPasso(passo + 1); }}
              placeholder="Seu nome" autoFocus
            />
          </div>
        )}

        {atual === 'faixa' && (
          <div className="col" style={{ gap: 16 }}>
            <Pergunta titulo="Qual a sua faixa?" texto="E quantos graus ela tem hoje. O app ajusta a régua das suas técnicas por aqui." />
            <div className="row wrap" style={{ gap: 7 }}>
              {FAIXAS.map((f) => (
                <button key={f.id} type="button" className={`chip ${perfil.faixa === f.id ? 'on' : ''}`}
                  style={{ minHeight: 44, paddingInline: 16 }}
                  onClick={() => setPerfil({ ...perfil, faixa: f.id })}>
                  <span style={{ width: 14, height: 7, borderRadius: 2, background: f.cor, border: f.id === 'preta' ? '1px solid #4a5250' : 'none' }} />
                  {f.nome}
                </button>
              ))}
            </div>
            <Field label="Graus">
              <div className="row wrap" style={{ gap: 7 }}>
                {[0, 1, 2, 3, 4].map((n) => (
                  <button key={n} type="button" className={`chip ${perfil.graus === n ? 'on' : ''}`}
                    style={{ minHeight: 42, paddingInline: 17 }}
                    onClick={() => setPerfil({ ...perfil, graus: n })}>{n}</button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {atual === 'tempo' && (
          <div className="col" style={{ gap: 16 }}>
            <Pergunta titulo="Há quanto tempo você treina?" texto="Contando desde o primeiro treino, mesmo com pausas no meio." />
            <div className="col" style={{ gap: 8 }}>
              {TEMPO.map((x) => (
                <button key={x.id} type="button" className={`opcao-meta ${perfil.tempo === x.id ? 'on' : ''}`}
                  onClick={() => escolher({ tempo: x.id })}>
                  <div className="tiny" style={{ fontWeight: 600 }}>{x.nome}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {atual === 'frequencia' && (
          <div className="col" style={{ gap: 16 }}>
            <Pergunta
              titulo="Quantas vezes por semana você treina?"
              texto="Fala o que acontece de verdade, não o que você gostaria. O app usa isso pra sugerir coisa realista."
            />
            <div className="row wrap" style={{ gap: 8 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} type="button" className={`chip ${perfil.frequencia === n ? 'on' : ''}`}
                  style={{ minHeight: 48, minWidth: 56, justifyContent: 'center' }}
                  onClick={() => escolher({ frequencia: n })}>{n}x</button>
              ))}
            </div>
          </div>
        )}

        {atual === 'objetivo' && (
          <div className="col" style={{ gap: 16 }}>
            <Pergunta titulo="O que te move no jiu-jitsu?" texto="Escolha o que pesa mais hoje. O app usa isso pra sugerir as suas primeiras metas." />
            <div className="col" style={{ gap: 8 }}>
              {OBJETIVOS.map((o) => (
                <button key={o.id} type="button" className={`opcao-meta ${perfil.objetivo === o.id ? 'on' : ''}`}
                  onClick={() => escolher({ objetivo: o.id })}>
                  <div className="tiny" style={{ fontWeight: 600 }}>{o.nome}</div>
                  <p className="micro muted" style={{ marginTop: 3 }}>{o.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {atual === 'trava' && (
          <div className="col" style={{ gap: 16 }}>
            <Pergunta titulo="O que mais te trava hoje?" texto="Marque até três, ou pule. O Estudo começa pelas aulas que atacam isso." />
            <EscolherDificuldades
              valor={perfil.dificuldades}
              onChange={(dificuldades) => setPerfil({ ...perfil, dificuldades })}
            />
          </div>
        )}

        {/* ---------- o teste de estilo ---------- */}
        {atual === 'estilo' && (
          <div className="col" style={{ gap: 16 }}>
            {estilo ? (
              <div className="col center" style={{ alignItems: 'center', gap: 14 }}>
                <div className="celebra-selo" style={{ width: 60, height: 60 }}><Dna size={26} /></div>
                <div className="center">
                  <div className="eyebrow">ponto de partida</div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, marginTop: 7 }}>{estiloPorId(estilo).nome}</h2>
                  <p className="tiny muted" style={{ marginTop: 8, maxWidth: 340 }}>{estiloPorId(estilo).desc}</p>
                </div>
                <div className="valida bom" style={{ textAlign: 'left', maxWidth: 400 }}>
                  <Sparkles size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
                  <p className="micro muted" style={{ lineHeight: 1.65 }}>
                    Esse é o seu ponto de partida. Daqui pra frente o app acompanha o que acontece nos seus
                    rolas e vai refinando o retrato, porque o jogo de todo mundo muda com o tempo.
                  </p>
                </div>
                <button className="btn ghost xs" onClick={() => { setEstilo(null); setQuizPasso(0); setRespostas([]); }}>
                  Refazer
                </button>
              </div>
            ) : quizPasso < QUIZ.length ? (
              <>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                    {QUIZ[quizPasso].q}
                  </h2>
                  <p className="micro muted" style={{ marginTop: 6 }}>pergunta {quizPasso + 1} de {QUIZ.length}</p>
                </div>
                <div className="col" style={{ gap: 9 }}>
                  {QUIZ[quizPasso].ops.map((o, i) => (
                    <button key={i} className="quiz-op" onClick={() => {
                      const novas = [...respostas];
                      novas[quizPasso] = o.e;
                      setRespostas(novas);
                      if (quizPasso < QUIZ.length - 1) setQuizPasso(quizPasso + 1);
                      else setEstilo(estiloDoQuiz(novas).estilo);
                    }}>{o.t}</button>
                  ))}
                </div>
                {/* pular não é resposta: sem estilo, o Meu jogo oferece o teste depois */}
                <button className="btn ghost xs" onClick={() => { setEstilo(null); setPasso(passo + 1); }} style={{ alignSelf: 'center' }}>
                  Pular esta parte
                </button>
              </>
            ) : null}
          </div>
        )}

        {/* ---------- as metas, com confirmação ---------- */}
        {atual === 'metas' && (
          <div className="col" style={{ gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>Quer definir alguma meta?</h2>
              <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
                Pelo que você contou, essas fazem sentido. Marque as que você quer assumir de verdade.
                O que você não marcar não aparece em lugar nenhum.
              </p>
            </div>

            {sugestoes.length === 0 ? (
              <p className="tiny muted">Nenhuma sugestão por enquanto. Você pode criar metas depois, quando quiser.</p>
            ) : (
              <div className="col" style={{ gap: 9 }}>
                {sugestoes.map((s) => {
                  const on = metasEscolhidas.includes(s.id);
                  return (
                    <button key={s.id} type="button" className={`opcao-meta ${on ? 'on' : ''}`}
                      onClick={() => {
                        if (!on && metasEscolhidas.length >= tetoDeMetas) return toast(`No plano grátis são até ${LIMITES.metasAtivas} metas por vez.`);
                        setMetasEscolhidas(on
                          ? metasEscolhidas.filter((x) => x !== s.id)
                          : [...metasEscolhidas, s.id]);
                      }}>
                      <div className="row" style={{ gap: 9 }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: 6, flex: 'none', display: 'grid', placeItems: 'center',
                          border: `1.5px solid ${on ? 'var(--accent)' : 'var(--seam-hi)'}`,
                          background: on ? 'var(--accent)' : 'transparent',
                        }}>
                          {on && <Check size={12} color="var(--accent-ink)" strokeWidth={3} />}
                        </span>
                        <span className="tiny" style={{ fontWeight: 600, flex: 1 }}>{s.titulo}</span>
                      </div>
                      <p className="micro muted" style={{ marginTop: 6, marginLeft: 29, lineHeight: 1.6 }}>{s.porque}</p>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="micro muted">
              Dá pra mudar ou trocar as metas quando quiser, na aba Metas.
            </p>
          </div>
        )}

        {/* navegação */}
        <div className="row" style={{ gap: 10, marginTop: 24 }}>
          {passo > 0 && (
            <Btn variant="ghost" icon={ChevronLeft} onClick={() => setPasso(passo - 1)}>Voltar</Btn>
          )}
          <span className="spacer" />
          {!ultimo ? (
            <Btn variant="primary" onClick={() => setPasso(passo + 1)} disabled={!podeAvancar}>
              {atual === 'trava' && !perfil.dificuldades.length ? 'Pular' : 'Continuar'} <ChevronRight size={15} />
            </Btn>
          ) : (
            <Btn variant="primary" icon={Check} onClick={concluir} disabled={salvando}>
              {metasEscolhidas.length ? `Começar com ${metasEscolhidas.length} meta${metasEscolhidas.length > 1 ? 's' : ''}` : 'Começar sem meta'}
            </Btn>
          )}
        </div>

        {passo === 0 && (
          <button className="btn ghost xs" onClick={onPronto} style={{ width: '100%', marginTop: 14, opacity: 0.7 }}>
            Pular por agora
          </button>
        )}
      </Card>
    </div>
  );
}
