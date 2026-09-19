import React, { useState } from 'react';
import { Apple, Check, Info, Droplet, Beef, Wheat, Salad } from 'lucide-react';
import { useApp } from '../contexto';
import { Card, Btn, Chip, Sheet } from '../components/UI';

/* ============================================================
   ALIMENTAÇÃO
   O básico que resolve pra quem treina algumas vezes por
   semana, sem planilha e sem pesar comida.
   ============================================================ */

const PRATO = [
  { icone: Salad, cor: 'jade', pct: 50, t: 'Metade de vegetais', d: 'Salada, legume, verdura. O que quiser, à vontade. É o que dá saciedade sem peso.' },
  { icone: Beef, cor: 'blood', pct: 25, t: 'Um quarto de proteína', d: 'Carne, frango, peixe, ovo, feijão com arroz. Do tamanho da palma da sua mão.' },
  { icone: Wheat, cor: 'accent', pct: 25, t: 'Um quarto de carboidrato', d: 'Arroz, macarrão, batata, mandioca. Do tamanho do seu punho fechado.' },
];

const REGRAS = [
  {
    t: 'Coma proteína suficiente',
    d: 'É o que recupera o músculo que você destruiu no rola. A conta simples: a palma da sua mão em cada refeição principal. Quem treina forte precisa de mais do que imagina, e faltar proteína é o motivo mais comum de acordar quebrado.',
  },
  {
    t: 'Não treine com o estômago vazio nem cheio',
    d: 'Uma refeição de verdade duas a três horas antes, ou algo leve trinta minutos antes se o treino for cedo. Treinar em jejum prolongado derruba o gás e aumenta a chance de lesão.',
  },
  {
    t: 'Beba água antes de sentir sede',
    d: 'Sede já é desidratação instalada. Meio litro nas duas horas antes do treino e goles durante. Desidratação de 2% do peso já piora a performance e a cabeça.',
  },
  {
    t: 'Oitenta por cento do tempo, não cem',
    d: 'Comer bem na maior parte das refeições e relaxar no resto é o que dá pra manter por anos. Dieta perfeita por três semanas seguida de desistência não serve pra nada.',
  },
];

export default function Nutricao() {
  const { settings, irPara } = useApp();
  const [porque, setPorque] = useState(false);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Alimentação</h1>
        </div>
        <Btn icon={Info} onClick={() => setPorque(true)}>Dúvidas comuns</Btn>
      </div>

      <Card className="accent" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">funciona em qualquer refeição</div>
            <h2 className="h-sec">O método do prato</h2>
          </div>
        </div>
        <p className="tiny muted" style={{ marginBottom: 16, lineHeight: 1.7 }}>
          Divida o prato em três e pronto. Não precisa pesar nada, não precisa anotar nada. Funciona no restaurante,
          na casa da sogra e no marmitex.
        </p>

        <div className="prato">
          {PRATO.map((p) => {
            const I = p.icone;
            return (
              <div key={p.t} className="prato-fatia" style={{ flex: p.pct }}>
                <span className="prato-ico" style={{ color: `var(--${p.cor})` }}><I size={17} /></span>
                <div className="prato-pct num" style={{ color: `var(--${p.cor})` }}>{p.pct}%</div>
              </div>
            );
          })}
        </div>

        <div className="col" style={{ gap: 11, marginTop: 16 }}>
          {PRATO.map((p) => (
            <div key={p.t} className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: `var(--${p.cor})`, marginTop: 7, flex: 'none' }} />
              <div>
                <div className="tiny" style={{ fontWeight: 600 }}>{p.t}</div>
                <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.65 }}>{p.d}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">o que basta saber</div>
            <h2 className="h-sec">Quatro regras</h2>
          </div>
        </div>
        <div className="col" style={{ gap: 12 }}>
          {REGRAS.map((r, i) => (
            <div key={r.t} className="card" style={{ background: 'var(--void)', padding: 14 }}>
              <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                <span className="num micro" style={{ color: 'var(--accent)', fontWeight: 700 }}>{i + 1}</span>
                <span className="tiny" style={{ fontWeight: 600, flex: 1 }}>{r.t}</span>
              </div>
              <p className="micro muted" style={{ lineHeight: 1.7 }}>{r.d}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">a conta pela mão</div>
            <h2 className="h-sec">Porção sem balança</h2>
          </div>
        </div>
        <div className="grid g2" style={{ gap: 11 }}>
          {[
            ['Palma da mão', 'Uma porção de proteína'],
            ['Punho fechado', 'Uma porção de carboidrato'],
            ['Mão em concha', 'Uma porção de vegetal'],
            ['Polegar', 'Uma porção de gordura'],
          ].map(([m, q]) => (
            <div key={m} className="card" style={{ background: 'var(--void)', padding: 13 }}>
              <div className="tiny" style={{ fontWeight: 600 }}>{m}</div>
              <p className="micro muted" style={{ marginTop: 4 }}>{q}</p>
            </div>
          ))}
        </div>
        <p className="micro muted" style={{ marginTop: 12, lineHeight: 1.65 }}>
          A mão acompanha o tamanho do corpo, então a porção se ajusta sozinha. Quem é grande tem mão grande.
        </p>
      </Card>

      <Card>
        <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
          <Droplet size={16} style={{ color: 'var(--ice)', flex: 'none', marginTop: 2 }} />
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>Quando o assunto é peso pra competir</div>
            <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
              Corte de peso é assunto sério e não cabe num app. Se você vai competir e precisa bater categoria,
              converse com o seu professor e, se der, com um nutricionista que entenda de esporte de combate.
              Cortar na base do improviso custa o desempenho e às vezes a saúde.
            </p>
          </div>
        </div>
      </Card>

      <Sheet aberto={porque} onClose={() => setPorque(false)} titulo="Dúvidas comuns" wide>
        <div className="col" style={{ gap: 11 }}>
          {[
            ['Preciso contar caloria?',
             'Não. Se você treina algumas vezes por semana e come razoavelmente, o método do prato já resolve. Contar ao grama exige uns cinco minutos todo dia e quase ninguém mantém depois de duas semanas.'],
            ['Posso comer antes do treino?',
             'Pode e deve. Uma refeição de verdade duas a três horas antes, ou algo leve meia hora antes se o treino for logo cedo. Treinar com fome derruba o gás e aumenta a chance de se machucar.'],
            ['Preciso de suplemento?',
             'Não precisa. Whey e creatina ajudam quem já come bem e quer um extra, mas não substituem comida. Se a sua alimentação está desregulada, suplemento não conserta.'],
            ['Vou perder peso treinando jiu-jitsu?',
             'Provavelmente, mas o que decide isso é o que você come, não o treino. Rolar gasta bastante e dá fome, então é comum compensar sem perceber.'],
            ['Como como fora de casa?',
             'Mesmo método. Olhe o prato e tente chegar perto de metade vegetal, um quarto proteína, um quarto carboidrato. Não precisa ser exato.'],
            ['E se eu escorregar no fim de semana?',
             'Faz parte e não estraga nada. O que conta é o que você faz na maioria das refeições, não em todas.'],
          ].map(([t, d]) => (
            <div key={t} className="card" style={{ background: 'var(--void)', padding: 13 }}>
              <div className="tiny" style={{ fontWeight: 600, marginBottom: 5 }}>{t}</div>
              <p className="micro muted" style={{ lineHeight: 1.65 }}>{d}</p>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
