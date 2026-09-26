import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Flame, Crown, ShieldCheck, Share2, Swords, ChevronRight } from 'lucide-react';
import { db } from '../db/db';
import { useApp } from '../contexto';
import { Btn, Sheet } from './UI';
import Figurinha from './Figurinha';
import { semanaDe } from '../lib/xp';
import { ofensiva, textoOfensiva, diasFechados, diasParadosPorLesao, MAX_ESCUDOS } from '../lib/ofensiva';
import { hoje, addDias } from '../lib/utils';
import { escudosDaDivisao, useMinhaDivisao } from '../lib/liga';

/* ============================================================
   SUA OFENSIVA

   Abre do placar do Painel. É do aluno, não da liga: a sequência,
   quando vem o próximo escudo e a semana de agora contra a
   passada. A Liga ficou só com a liga.
   ============================================================ */
export default function MinhaOfensiva({ aberto, onClose }) {
  const { irPara } = useApp();
  const pontos = useLiveQuery(() => db.pontos.toArray(), [], []) || [];
  const lesoes = useLiveQuery(() => db.injuries.toArray(), [], []) || [];
  /* do Nacional pra cima a ofensiva guarda 3 escudos */
  const minhaDivisao = useMinhaDivisao();
  const ofa = useMemo(() => ofensiva(pontos, undefined, lesoes, { maxEscudos: escudosDaDivisao(minhaDivisao?.divisao) }), [pontos, lesoes, minhaDivisao]);

  const semanas = useMemo(() => {
    const soma = (f) => pontos.filter(f).reduce((a, x) => a + (x.xp || 0), 0);
    const sem = semanaDe();
    const semPassada = semanaDe(addDias(hoje(), -7));
    const porSemana = {};
    for (const l of pontos) porSemana[l.semana] = (porSemana[l.semana] || 0) + (l.xp || 0);
    return {
      agora: soma((x) => x.semana === sem),
      passada: soma((x) => x.semana === semPassada),
      recorde: Math.max(0, ...Object.values(porSemana)),
    };
  }, [pontos]);

  /* quem toca num botão daqui vai pra outra tela: a folha fecha antes */
  const ir = (rota) => { onClose(); irPara(rota); };

  return (
    <Sheet aberto={aberto} onClose={onClose} titulo="Sua ofensiva">
      <BlocoOfensiva o={ofa} pontos={pontos} lesoes={lesoes} irPara={ir} />
      <DueloDaSemana agora={semanas.agora} passada={semanas.passada} recorde={semanas.recorde} irPara={ir} />
    </Sheet>
  );
}

/* ============================================================
   A OFENSIVA

   O primeiro bloco da tela, porque é o número que faz a pessoa
   abrir o app amanhã. A pista mostra os últimos catorze dias:
   aceso é dia fechado, e o último quadradinho tracejado é hoje
   quando ainda não fechou.

   O botão só aparece quando falta fechar o dia. Nos outros dias
   ele seria só mais um botão.
   ============================================================ */
function BlocoOfensiva({ o, pontos, lesoes, irPara }) {
  const frase = textoOfensiva(o);
  const cor = frase.tom || (o.viva ? 'roar' : 'dim');

  /* os catorze dias que cabem na tela, do mais antigo pro de hoje */
  /* a mesma conta da ofensiva, e não uma cópia: o dia pago pelo
     treino tem que acender na pista igual ele conta lá */
  const fechados = new Set(diasFechados(pontos));
  const gelo = diasParadosPorLesao(lesoes);
  const pista = Array.from({ length: 14 }, (_, i) => {
    const dia = addDias(hoje(), -(13 - i));
    const cheio = fechados.has(dia);
    /* só o que está dentro da corrente de agora acende forte. O
       que veio antes de ela começar fica apagado, senão a pista
       mostra catorze dias iguais enquanto o número diz "1 dia". */
    const vale = !!o.desde && dia >= o.desde;
    return {
      dia,
      classe: cheio ? (vale ? 'on' : 'feito')
        /* congelado não é dia perdido, então não pode ficar cinza */
        : gelo.has(dia) ? 'gelo' : '',
      agora: i === 13,
    };
  });

  return (
    <div className={`ofa${o.viva ? ' viva' : ''}`} style={{ '--cor': `var(--${cor})` }}>
      <div className="ofa-topo">
        <span className="ofa-chama"><Flame size={22} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">ofensiva</div>
          <div className="ofa-num">
            <span className="num">{o.dias}</span>
            <span className="ofa-dia">{o.dias === 1 ? 'dia seguido' : 'dias seguidos'}</span>
          </div>
        </div>
        {o.recorde > o.dias && o.recorde >= 3 && (
          <span className="fita-recorde" title="seu recorde">
            <Crown size={12} /> {o.recorde}
          </span>
        )}
      </div>

      <div className="ofa-pista" title="os últimos 14 dias">
        {pista.map((d) => (
          <i key={d.dia} className={`${d.classe}${d.agora ? ' agora' : ''}`} />
        ))}
      </div>
      <div className="ofa-legenda">
        <span>14 dias atrás</span>
        <span>hoje</span>
      </div>

      <p className="ofa-txt">{frase.texto}</p>

      <div className="ofa-pe">
        <div className="escudos">
          {Array.from({ length: ofa.maxEscudos || MAX_ESCUDOS }).map((_, i) => (
            <span key={i} className={`escudo ${i < o.escudos ? 'cheio' : ''}`}>
              <ShieldCheck size={12} />
            </span>
          ))}
          <span className="micro muted" style={{ marginLeft: 4 }}>
            {o.escudos
              ? `${o.escudos} ${o.escudos === 1 ? 'escudo' : 'escudos'}`
              : `escudo em ${o.faltaProEscudo} ${o.faltaProEscudo === 1 ? 'dia' : 'dias'}`}
          </span>
        </div>

        <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
          {/* só dá pra compartilhar o que já virou alguma coisa.
              "1 dia seguido" não é conquista, é terça-feira. */}
          {o.dias >= 7 && <BtnCompartilhar o={o} />}
          {!o.fechouHoje && (
            <Btn size="sm" variant="primary" onClick={() => irPara('estudo')}>
              Fechar o dia <ChevronRight size={13} />
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

/* A figurinha da ofensiva pro story, com o link do card junto */
function BtnCompartilhar({ o }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Btn size="sm" icon={Share2} onClick={() => setAberto(true)}>Compartilhar</Btn>
      <Figurinha
        aberto={aberto} onClose={() => setAberto(false)} tipo="ofensiva"
        dados={{ selo: 'ofensiva', grande: `${o.dias} dias seguidos`, sub: `no tatame · recorde de ${o.recorde}` }}
        link={{ tipo: 'ofensiva', dados: { dias: o.dias, recorde: o.recorde }, texto: `${o.dias} dias seguidos no tatame.` }}
      />
    </>
  );
}

/* ============================================================
   A ARENA DA SEMANA

   Ninguém precisa de outra pessoa pra ter adversário. O seu
   adversário padrão é a sua semana passada, que já jogou e já
   tem placar. Quando a liga estiver cheia, ela entra por cima
   disto, não no lugar.
   ============================================================ */
function DueloDaSemana({ agora = 0, passada = 0, recorde = 0, irPara }) {
  const max = Math.max(1, agora, passada);
  const dif = agora - passada;
  const venceu = dif > 0;
  const empate = dif === 0;
  const bateuRecorde = agora > 0 && agora >= recorde;

  const leitura = bateuRecorde
    ? 'Esta é a sua melhor semana até agora. Hoje ninguém no seu histórico ganha de você.'
    : empate && agora === 0
      ? 'A semana ainda não começou a pontuar. O placar abre no primeiro registro.'
      : empate
        ? 'Empatado com a sua semana passada. Um registro desempata.'
        : venceu
          ? `Você está ${dif} pontos na frente da sua semana passada.`
          : `A sua semana passada está ${Math.abs(dif)} pontos na frente. Dá pra virar.`;

  return (
    <div className={`arena-duelo ${venceu || bateuRecorde ? 'ganhando' : empate ? '' : 'perdendo'}`}>
      <div className="row" style={{ gap: 9, marginBottom: 14 }}>
        <span className="stat-ico" style={{ color: 'var(--roar)' }}><Swords size={16} /></span>
        <div style={{ flex: 1 }}>
          <div className="eyebrow">arena da semana</div>
          <h2 className="h-sec" style={{ marginTop: 2 }}>Você contra a sua semana passada</h2>
        </div>
        {bateuRecorde && <span className="fita-recorde"><Crown size={12} /> recorde</span>}
      </div>

      <div className="duelo">
        <div className="duelo-lado eu">
          <span className="duelo-rot">esta semana</span>
          <span className="duelo-num num">{agora}</span>
          <span className="duelo-barra"><i style={{ width: `${(agora / max) * 100}%` }} /></span>
        </div>

        <span className="duelo-vs">vs</span>

        <div className="duelo-lado ele">
          <span className="duelo-rot">semana passada</span>
          <span className="duelo-num num">{passada}</span>
          <span className="duelo-barra"><i style={{ width: `${(passada / max) * 100}%` }} /></span>
        </div>
      </div>

      <p className="tiny muted" style={{ marginTop: 14, lineHeight: 1.65 }}>{leitura}</p>

      <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
        <Btn size="sm" variant="primary" onClick={() => irPara('treinos')}>Registrar treino</Btn>
        <Btn size="sm" variant="contorno" onClick={() => irPara('estudo')}>
          Estudar <ChevronRight size={13} />
        </Btn>
      </div>
    </div>
  );
}
