import React, { useState } from 'react';
import {
  NotebookPen, Trophy, Dna, Award, Target, Cloud, Sparkles, Layers, ChevronLeft, ChevronRight, Check,
} from 'lucide-react';
import { Sheet, Btn } from './UI';
import { Ponteira } from './Ponteira';
import { GRAUS } from '../lib/graus';

/* ============================================================
   TOUR
   Oito telas explicando o app pra quem nunca viu.
   Fica reabrível em Ajustes.
   ============================================================ */

const PASSOS = [
  {
    icone: NotebookPen,
    titulo: 'Registrar um treino leva um minuto',
    corpo: [
      'Você anota a data, quanto tempo durou e as técnicas que o professor passou. Em cada uma marca se pegou, se saiu mais ou menos, ou se não pegou.',
      'Depois adiciona os rolas. Em cada um você diz com quem foi, o que pontuou, o que sofreu e escreve duas linhas sobre o que aconteceu.',
      'Essas duas linhas são o que mais vale quando você voltar aqui daqui a três meses. O resto o app calcula sozinho.',
    ],
  },
  {
    icone: Trophy,
    titulo: 'Por que marcar os pontos',
    corpo: [
      'Finalização é raro. Pode passar semanas sem uma, e um app que só olha finalização fica cego a maior parte do tempo.',
      'Ponto acontece em todo rola. Queda vale 2, raspagem 2, joelho na barriga 2, passagem de guarda 3, montada 4, pegada nas costas 4.',
      'Marcando os dois lados, o que você fez e o que fizeram em você, o app passa a enxergar o seu jogo inteiro e não só as finalizações.',
    ],
  },
  {
    icone: Award,
    titulo: 'Cada técnica tem quatro graus',
    corpo: [
      'Funciona igual à ponteira da faixa. A diferença é que a técnica sobe de grau porque ela apareceu nos seus treinos, não porque você marcou que sabe.',
      'É isso que faz a evolução ser real. O app trabalha com o que aconteceu de verdade no tatame, então o que você vê aqui não é o que você acha que sabe, é o que você já mostrou que sabe.',
    ],
    graus: true,
  },
  {
    icone: Layers,
    titulo: 'Nem toda repetição vale o mesmo',
    corpo: [
      'Encaixar num faixa mais alta, ou em alguém bem mais pesado, não é igual a encaixar no colega do seu tamanho. Por isso cada uso vale um tanto.',
    ],
    fatores: true,
  },
  {
    icone: Dna,
    titulo: 'Do 3º grau em diante, o tempo conta',
    corpo: [
      'Chegando no 2º grau a técnica já funciona contra resistência. Do 3º em diante o app quer saber se ela é jogo seu ou foi uma fase boa.',
      'Por isso o 3º grau pede que ela saia em semanas diferentes e em pelo menos duas pessoas, e a Assinatura pede meses. Quem treina sempre com o mesmo grupo não fica travado.',
      'E o grau conquistado fica. Uma técnica nunca desce, nem quando você pega faixa nova e a régua sobe.',
    ],
  },
  {
    icone: Target,
    titulo: 'Ataque e defesa contados separados',
    corpo: [
      'O app registra as duas coisas, mas em lugares diferentes, porque elas dizem coisas diferentes sobre o seu jogo.',
      'O que você aplica vai pro grau das suas técnicas, e mostra onde o seu ataque está funcionando. O que você sofre vai pra uma lista chamada Onde você apanha, e mostra onde vale investir na defesa.',
      'Na prática: se a sua americana é boa e você leva uma de vez em quando, a sua americana continua boa. O que aquilo mostra é que falta trabalhar a saída daquela posição, que é outra coisa.',
    ],
  },
  {
    icone: Sparkles,
    titulo: 'As sugestões e as suas metas',
    corpo: [
      'Conforme você registra, o app começa a enxergar padrão. Ele vê qual técnica está prestes a subir de grau, qual finalização está te pegando toda semana, qual posição você evita.',
      'Isso vira sugestão, e vale a pena olhar. Muita coisa que aparece ali é o tipo de coisa que passa despercebida quando você só treina sem anotar.',
      'A diferença é que sugestão fica na aba de sugestões e não vira compromisso sozinha. Você olha, decide, e se fizer sentido aceita. Aí sim ela vira sua meta e passa a acompanhar sozinha.',
    ],
  },
  {
    icone: Cloud,
    titulo: 'Onde os seus dados ficam',
    corpo: [
      'Entrando com uma conta, tudo que você registra vai pra nuvem. Você abre no celular, no notebook, em qualquer lugar, e está lá. Trocar de aparelho não perde nada.',
      'O app também funciona sem internet. Você registra o treino no vestiário mesmo sem sinal, e quando a conexão volta ele sobe sozinho.',
      'Dá pra usar sem conta, e aí os dados ficam só naquele aparelho. Nesse caso vale fazer backup de vez em quando, em Ajustes, porque limpar os dados do navegador apaga tudo.',
    ],
  },
];

export default function Tour({ aberto, onClose, onConcluir }) {
  const [i, setI] = useState(0);
  const p = PASSOS[i];
  const Ico = p.icone;
  const ultimo = i === PASSOS.length - 1;

  const fechar = () => { setI(0); onClose(); };

  return (
    <Sheet
      aberto={aberto}
      onClose={fechar}
      titulo="Como o app funciona"
      subtitulo={`${i + 1} de ${PASSOS.length}`}
      footer={
        <>
          {i > 0 && <Btn variant="ghost" icon={ChevronLeft} onClick={() => setI(i - 1)}>Voltar</Btn>}
          <span className="spacer" />
          {ultimo ? (
            <Btn variant="primary" icon={Check} onClick={() => { onConcluir?.(); fechar(); }}>Entendi</Btn>
          ) : (
            <Btn variant="primary" onClick={() => setI(i + 1)}>Continuar <ChevronRight size={15} /></Btn>
          )}
        </>
      }
    >
      <div className="quiz-barra"><i style={{ width: `${((i + 1) / PASSOS.length) * 100}%` }} /></div>

      <div className="col" style={{ gap: 14, paddingTop: 6 }}>
        <span className="stat-ico" style={{ width: 46, height: 46, borderRadius: 14 }}><Ico size={21} /></span>
        <h3 style={{ fontSize: 'clamp(19px,4.2vw,23px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
          {p.titulo}
        </h3>
        <div className="col" style={{ gap: 11 }}>
          {p.corpo.map((linha, k) => (
            <p key={k} className="tiny muted" style={{ lineHeight: 1.75 }}>{linha}</p>
          ))}
        </div>

        {p.fatores && (
          <div className="col" style={{ gap: 9, marginTop: 2 }}>
            {[
              ['Onde aconteceu', 'Treinar com o parceiro colaborando constrói o movimento e vale pro 1º grau. Encaixar no rola, com ele tentando impedir, é o que faz subir. Em competição vale ainda mais, porque tem regra, adrenalina e alguém que nunca te viu.'],
              ['A faixa de quem estava do outro lado', 'Encaixar num azul não é o mesmo que encaixar num branca. Quanto mais graduado o parceiro, mais aquele uso pesa. E pra chegar na Assinatura, uma parte dos encaixes tem que ser em quem tem mais tempo de tatame que você.'],
              ['O peso dele', 'Raspar alguém quinze quilos mais pesado exige alavanca e timing que não são necessários contra alguém do seu tamanho. Isso conta a favor.'],
              ['Em quantas pessoas saiu', 'Cada parceiro tem um jogo. Funcionar em gente diferente mostra que a técnica não depende de um corpo específico.'],
              ['Quando saiu', 'Uma semana inspirada não faz uma técnica. Do 3º grau em diante ela precisa sair em semanas diferentes.'],
            ].map(([t, d]) => (
              <div key={t} className="card" style={{ background: 'var(--void)', padding: 13 }}>
                <div className="tiny" style={{ fontWeight: 600, marginBottom: 5 }}>{t}</div>
                <p className="micro muted" style={{ lineHeight: 1.65 }}>{d}</p>
              </div>
            ))}
            <p className="micro muted" style={{ lineHeight: 1.65, marginTop: 2 }}>
              A régua também sobe com a sua faixa. O que é notável pra um faixa branca vira rotina pra um roxa, então
              a exigência acompanha.
            </p>
          </div>
        )}

        {p.graus && (
          <div className="col" style={{ gap: 8, marginTop: 4 }}>
            {GRAUS.slice(1).map((g) => (
              <div key={g.n} className="row" style={{ gap: 10, padding: '9px 11px', background: 'var(--void)', borderRadius: 10 }}>
                <Ponteira n={g.n} />
                <span className="tiny" style={{ fontWeight: 600, color: `var(--${g.cor})` }}>{g.nome}</span>
                <span className="spacer" />
                <span className="micro muted">{g.curto}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn ghost xs" onClick={fechar} style={{ alignSelf: 'center', opacity: 0.7 }}>
        Fechar
      </button>
    </Sheet>
  );
}
