import React from 'react';
import { Wind, Info, Check } from 'lucide-react';
import { useApp } from '../contexto';
import { Card, Btn, Chip } from '../components/UI';

/* ============================================================
   FÔLEGO
   Escrito pra quem cansa em três minutos de rola e não
   entende por quê.
   ============================================================ */

export default function Respiracao() {
  const { irPara } = useApp();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Gás no jiu-jitsu</h1>
        </div>
      </div>

      <Card className="accent" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <span className="stat-ico"><Wind size={17} /></span>
          <div>
            <h2 className="h-sec">Cansar no rola quase nunca é falta de preparo físico</h2>
            <p className="tiny muted" style={{ marginTop: 8, lineHeight: 1.75 }}>
              Gente que corre dez quilômetros também fica sem ar em três minutos de rola quando está começando.
              O fôlego no jiu-jitsu é técnico antes de ser físico, e é isso que faz um faixa preta de cinquenta anos
              rolar seis rounds seguidos sem parecer cansado.
            </p>
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">em ordem de impacto</div>
            <h2 className="h-sec">O que realmente gasta o seu gás</h2>
          </div>
        </div>

        <div className="col" style={{ gap: 11 }}>
          {[
            [
              'Pegada fechada com força máxima o tempo todo',
              'É o maior ralo que existe. Mão apertada sem motivo queima o antebraço em dois minutos e depois você não segura mais nada. Pegada tem hora de apertar e hora de descansar.',
            ],
            [
              'Prender a respiração na hora do aperto',
              'Quase todo mundo faz sem perceber, principalmente embaixo de pressão. Você trava o ar justamente quando mais precisa dele. Reparar nisso já muda o round.',
            ],
            [
              'Usar força onde dava pra usar posição',
              'Empurrar de baixo, puxar contra o bíceps do outro, brigar em alavanca perdida. Cada uma dessas trocas gasta muito e devolve pouco.',
            ],
            [
              'Não descansar quando dá',
              'Existe momento de pausa dentro do rola: a guarda fechada, o controle estabilizado. Quem não aprende a respirar nesses momentos chega no fim sem nada.',
            ],
          ].map(([t, d]) => (
            <div key={t} className="card" style={{ background: 'var(--void)', padding: 14 }}>
              <div className="tiny" style={{ fontWeight: 600, marginBottom: 6 }}>{t}</div>
              <p className="micro muted" style={{ lineHeight: 1.7 }}>{d}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">o que funciona de verdade</div>
            <h2 className="h-sec">O que fazer</h2>
          </div>
        </div>

        <div className="col" style={{ gap: 11 }}>
          {[
            ['No rola', 'Respire pelo nariz enquanto der. Quando precisar da boca, é sinal de que você passou do ponto e vale baixar o ritmo antes de estourar.'],
            ['Na pegada', 'Aperte só na hora de agir. No resto do tempo, mão relaxada segurando o suficiente pra não perder o controle.'],
            ['Entre os rolas', 'Sente, respire fundo pelo nariz e solte devagar pela boca. Uns trinta segundos disso derrubam bastante a frequência cardíaca e você entra melhor no próximo.'],
            ['Fora do tatame', 'Se quiser treinar o músculo da respiração de fato, existem aparelhos de carga inspiratória. Eles têm evidência de reduzir a sensação de esforço. Um app não substitui isso.'],
          ].map(([t, d]) => (
            <div key={t} className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
              <span className="stat-ico" style={{ width: 30, height: 30, borderRadius: 9 }}>
                <Check size={13} />
              </span>
              <div style={{ flex: 1 }}>
                <div className="tiny" style={{ fontWeight: 600 }}>{t}</div>
                <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.65 }}>{d}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
          <Wind size={16} style={{ color: 'var(--accent)', flex: 'none', marginTop: 2 }} />
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>Em quanto tempo isso melhora</div>
            <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
              A parte técnica melhora rápido. Duas ou três semanas prestando atenção na pegada e na respiração já
              mudam bastante como você chega no fim do round. A parte de condicionamento demora mais e vem sozinha
              com a frequência de treino.
            </p>
            <p className="micro muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
              Se você está no primeiro ano e cansa muito, saiba que é assim com todo mundo. Não é falta de preparo,
              é o corpo ainda não sabendo economizar. Isso passa.
            </p>
            <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
              <Btn size="sm" onClick={() => irPara('estudo', { tema: 'fisico' })}>Ver aulas sobre isso</Btn>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
