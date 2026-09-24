import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, X, Lightbulb, ChevronRight, Brain, RotateCcw } from 'lucide-react';
import { db } from '../db/db';
import { Card, Btn, Chip, Empty, useToast } from './UI';
import { perguntasPara, proximaRevisao } from '../db/quiz';
import { darXp } from '../lib/xp';
import { hoje } from '../lib/utils';
import { useApp } from '../contexto';
import { limiteDoDia, podeVer } from '../lib/plano';
import { LimiteDoDia } from './Plano';

/* ============================================================
   QUIZ
   Perguntas de situação, não de decorar nome de golpe.
   ============================================================ */

export default function Quiz({ faixa = 'branca', dor = null, tema = null, onSair }) {
  const toast = useToast();
  const { acesso, irPara } = useApp();
  /* sem valor padrão: undefined é "ainda carregando", e a rodada espera */
  const respondidasDb = useLiveQuery(() => db.quizRespostas.toArray(), []);
  const respondidas = respondidasDb || [];

  /* No plano grátis é uma rodada por dia. A conta é feita ao
     abrir e ao pedir outra rodada, nunca no meio: quem começou
     a responder termina e vê o resultado. */
  const [travado, setTravado] = useState(false);
  useEffect(() => {
    limiteDoDia(acesso, 'quiz').then((l) => setTravado(!l.pode)).catch(() => {});
  }, [acesso]);

  const [fila, setFila] = useState(null);
  /* no grátis a rodada é sorteada; a revisão do que você errou é do premium */
  const revisa = podeVer(acesso, 'quizIlimitado');
  const [sorteio] = useState(() => Math.random());
  const [i, setI] = useState(0);
  const [escolha, setEscolha] = useState(null);
  const [acertos, setAcertos] = useState(0);
  const [ganho, setGanho] = useState(0);

  /* a rodada é montada uma vez e fica parada até acabar. Antes ela era
     refeita a cada resposta, e a pergunta seguinte pulava ou repetia */
  useEffect(() => {
    if (!fila && respondidasDb) {
      setFila(perguntasPara({ faixa, dor, tema, limite: 5, respondidas: respondidasDb, sorteio: revisa ? null : sorteio }));
    }
  }, [fila, respondidasDb, faixa, dor, tema, revisa, sorteio]);
  const lista = fila || [];

  const p = lista[i];
  const terminou = i >= lista.length;

  async function responder(idx) {
    if (escolha !== null) return;
    setEscolha(idx);
    const acertou = p.ops[idx].ok;
    if (acertou) setAcertos((a) => a + 1);

    const ja = respondidas.find((r) => r.perguntaId === p.id);
    const { caixa, proxima } = proximaRevisao(ja?.caixa, acertou);

    if (ja) {
      await db.quizRespostas.update(ja.id, {
        acertou: acertou ? 1 : 0, caixa, proxima, data: hoje(),
        vezes: (ja.vezes || 1) + 1,
      });
    } else {
      await db.quizRespostas.add({
        perguntaId: p.id, acertou: acertou ? 1 : 0, caixa, proxima,
        data: hoje(), vezes: 1, criadoEm: Date.now(),
      });
    }

    const x = await darXp(acertou ? 'quizAcerto' : 'quizErro', {
      refId: `quiz:${p.id}:${hoje()}`, detalhe: p.q.slice(0, 40),
    });
    if (x) setGanho((g) => g + x.xp);
  }

  function proxima() {
    setEscolha(null);
    setI(i + 1);
  }

  async function recomecar() {
    const l = await limiteDoDia(acesso, 'quiz');
    if (!l.pode) { setTravado(true); return; }
    setFila(perguntasPara({ faixa, dor, tema, limite: 5, respondidas, sorteio: revisa ? null : Math.random() }));
    setI(0); setEscolha(null); setAcertos(0); setGanho(0);
  }

  if (travado) {
    return (
      <div className="col" style={{ gap: 12 }}>
        <LimiteDoDia tipo="quiz" onAssinar={() => irPara?.('ajustes')} />
        {onSair && <button className="btn ghost xs" onClick={onSair}>Voltar</button>}
      </div>
    );
  }

  if (!fila) return null;

  if (!lista.length) {
    return (
      <Card>
        <Empty
          icon={Brain}
          titulo="Nada pra revisar agora"
          texto="Você já respondeu as perguntas disponíveis. Elas voltam sozinhas conforme o tempo passa, que é como a memória funciona de verdade."
        />
      </Card>
    );
  }

  if (terminou) {
    return (
      <Card>
        <div className="col center" style={{ alignItems: 'center', gap: 16, padding: '12px 0' }}>
          <div className="celebra-selo" style={{ width: 62, height: 62 }}>
            <Brain size={26} />
          </div>
          <div className="center">
            <div className="eyebrow">rodada de hoje feita</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 7 }}>
              {acertos} de {lista.length}
            </h2>
            <p className="tiny muted" style={{ marginTop: 8, maxWidth: 360 }}>
              {acertos === lista.length
                ? 'Gabaritou. As que você acertou voltam mais espaçadas.'
                : acertos === 0
                  ? 'Errar aqui é barato, errar no rola custa a posição. As que você errou voltam amanhã.'
                  : 'As que você errou voltam amanhã, as que acertou voltam mais pra frente.'}
            </p>
          </div>
          {ganho > 0 && <Chip tone="jade">+{ganho} pontos</Chip>}
          {/* o que vem depois, sem a pessoa precisar adivinhar */}
          <div className="valida bom" style={{ maxWidth: 380, textAlign: 'left' }}>
            <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
            <p className="micro muted" style={{ lineHeight: 1.6 }}>
              {revisa
                ? 'Próxima rodada já está pronta: ela começa pelas que você errou.'
                : 'A próxima rodada abre amanhã, com perguntas novas. No premium o quiz não acaba e volta nas que você errou.'}
            </p>
          </div>
          <div className="row" style={{ gap: 9 }}>
            {revisa && <Btn icon={RotateCcw} onClick={recomecar}>Próxima rodada</Btn>}
            {onSair && <Btn variant="ghost" onClick={onSair}>Sair</Btn>}
          </div>
        </div>
      </Card>
    );
  }

  const certa = p.ops.findIndex((o) => o.ok);

  return (
    <Card>
      <div className="row" style={{ marginBottom: 12, gap: 10 }}>
        <span className="micro muted num">{i + 1} de {lista.length}</span>
        <span className="spacer" />
        {ganho > 0 && <span className="micro" style={{ color: 'var(--jade)' }}>+{ganho}</span>}
      </div>
      <div className="quiz-barra" style={{ marginBottom: 18 }}>
        <i style={{ width: `${((i + (escolha !== null ? 1 : 0)) / lista.length) * 100}%` }} />
      </div>

      <h3 style={{ fontSize: 'clamp(17px,4vw,20px)', fontWeight: 700, lineHeight: 1.35, marginBottom: 16 }}>
        {p.q}
      </h3>

      <div className="col" style={{ gap: 9 }}>
        {p.ops.map((o, k) => {
          const marcada = escolha === k;
          const revelar = escolha !== null;
          const estado = !revelar ? '' : o.ok ? 'certa' : marcada ? 'errada' : 'apagada';
          return (
            <button
              key={k}
              className={`quiz-op ${estado}`}
              onClick={() => responder(k)}
              disabled={revelar}
            >
              <span className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                {revelar && (
                  <span className="quiz-ico">
                    {o.ok ? <Check size={14} /> : marcada ? <X size={14} /> : null}
                  </span>
                )}
                <span style={{ flex: 1 }}>{o.t}</span>
              </span>
              {revelar && (marcada || o.ok) && (
                <p className="quiz-porque">{o.p}</p>
              )}
            </button>
          );
        })}
      </div>

      {escolha !== null && (
        <>
          {!p.ops[escolha].ok && (
            <div className="valida atencao" style={{ marginTop: 14 }}>
              <Lightbulb size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
              <p className="micro muted" style={{ lineHeight: 1.65 }}>
                Errar e entender o porquê vale ponto aqui. Essa pergunta volta amanhã pra ver se pegou.
              </p>
            </div>
          )}
          <Btn variant="primary" onClick={proxima} style={{ width: '100%', marginTop: 14, minHeight: 46 }}>
            {i + 1 >= lista.length ? 'Ver resultado' : 'Próxima'} <ChevronRight size={15} />
          </Btn>
        </>
      )}
    </Card>
  );
}
