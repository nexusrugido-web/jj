import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Flame, Info, Swords, ChevronRight, Crown, ShieldCheck, Share2, UsersRound,
} from 'lucide-react';
import { db } from '../db/db';
import { useApp } from '../contexto';
import { Card, Btn, Empty, Sheet } from '../components/UI';
import Figurinha from '../components/Figurinha';
import Liga from '../components/Liga';
import RankingOfensivas from '../components/RankingOfensivas';
import ListaResumida from '../components/ListaResumida';
import { EVENTOS, semanaDe } from '../lib/xp';
import { DIVISOES_LIGA } from '../lib/liga';
import FaixaVisual from '../components/FaixaVisual';
import { FAIXAS } from '../db/seed';
import { ofensiva, textoOfensiva, diasFechados, diasParadosPorLesao, MAX_ESCUDOS, DIAS_POR_ESCUDO } from '../lib/ofensiva';
import { relativo, hoje, addDias, fmtData } from '../lib/utils';

/* ============================================================
   A LIGA

   Esforço, social, e zera toda segunda: pontos de treino, de aula
   e de quiz contra um grupo de gente com ritmo parecido. O que é
   do seu jogo (técnicas, graus, rolas) fica nas telas de Evolução
   e ninguém mais vê.
   ============================================================ */
export default function LigaPagina() {
  const { irPara, settings } = useApp();
  const pontos = useLiveQuery(() => db.pontos.toArray(), [], []) || [];
  const [comoFunciona, setComoFunciona] = useState(false);

  const dados = useMemo(() => {
    const soma = (f) => pontos.filter(f).reduce((a, x) => a + (x.xp || 0), 0);
    const sem = semanaDe();
    const semPassada = semanaDe(addDias(hoje(), -7));
    /* o seu melhor 7 dias de todos, pra saber contra o que você
       está lutando quando não tem mais ninguém na sala */
    const porSemana = {};
    for (const l of pontos) porSemana[l.semana] = (porSemana[l.semana] || 0) + (l.xp || 0);
    return {
      semana: soma((x) => x.semana === sem),
      semanaPassada: soma((x) => x.semana === semPassada),
      recordeSemana: Math.max(0, ...Object.values(porSemana)),
    };
  }, [pontos]);

  const recentes = useMemo(
    () => [...pontos].sort((a, b) => b.criadoEm - a.criadoEm),
    [pontos]
  );

  const lesoes = useLiveQuery(() => db.injuries.toArray(), [], []) || [];
  const ofa = useMemo(() => ofensiva(pontos, undefined, lesoes), [pontos, lesoes]);

  if (!pontos.length) {
    return (
      <div className="page">
        <Cabecalho onComo={() => setComoFunciona(true)} />
        <Card>
          <Empty
            icon={Flame}
            titulo="Sua liga começa no primeiro ponto"
            texto="Cada treino anotado, cada aula assistida e cada pergunta do quiz vale pontos na semana. O primeiro ponto já te coloca num grupo com gente de ritmo parecido com o seu."
            acao={<Btn variant="primary" onClick={() => irPara('treinos')}>Registrar treino</Btn>}
          />
        </Card>
        <ComoFunciona aberto={comoFunciona} onClose={() => setComoFunciona(false)} />
      </div>
    );
  }

  return (
    <div className="page">
      <Cabecalho onComo={() => setComoFunciona(true)} />

      <MinhaFaixa settings={settings} irPara={irPara} />

      <BlocoOfensiva o={ofa} pontos={pontos} lesoes={lesoes} irPara={irPara} />

      {/* a corrida desta semana primeiro; amigos e sala moram na aba deles */}
      <Liga />
      <button type="button" className="card atalho" onClick={() => irPara('amigos')} style={{ marginBottom: 14 }}>
        <span className="stat-ico" style={{ color: 'var(--accent)' }}><UsersRound size={17} /></span>
        <span style={{ flex: 1, textAlign: 'left' }}>
          <span className="h-sec" style={{ display: 'block', fontSize: 16 }}>Amigos e sala</span>
          <span className="tiny muted">Chame os amigos pra correr a liga numa sala só de vocês.</span>
        </span>
        <ChevronRight size={18} className="muted" />
      </button>

      {/* ---- a arena da semana ---- */}
      <DueloDaSemana
        agora={dados.semana}
        passada={dados.semanaPassada}
        recorde={dados.recordeSemana}
        irPara={irPara}
      />

      <RankingOfensivas />

      {/* histórico */}
      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">o que entrou por último</div>
            <h2 className="h-sec">Últimos pontos</h2>
          </div>
        </div>
        {/* 5 na tela; a folha tem todos, agrupados pelo dia do ponto */}
        <ListaResumida itens={recentes} quantos={5} titulo="Todos os pontos" subtitulo="do dia mais recente pro mais antigo">
          {(lista, completa) => {
            const ordem = completa
              ? [...lista].sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.criadoEm - a.criadoEm)
              : lista;
            return (
              <div className="col" style={{ gap: 7 }}>
                {ordem.map((l, i) => (
                  <React.Fragment key={l.id}>
                    {completa && (i === 0 || ordem[i - 1].data !== l.data) && (
                      <div className="eyebrow" style={{ marginTop: i ? 10 : 0 }}>{fmtData(l.data)} · {relativo(l.data)}</div>
                    )}
                    <div className="xp-evento">
                      <span className="tiny" style={{ flex: 1 }}>
                        {EVENTOS[l.evento]?.nome || l.evento}
                        {l.detalhe && !/^\d{4}-\d{2}-\d{2}$/.test(l.detalhe) && <span className="micro muted"> · {String(l.detalhe).slice(0, 34)}</span>}
                      </span>
                      {!completa && <span className="micro muted">{relativo(l.data)}</span>}
                      <span className="xp-evento-xp">+{l.xp}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            );
          }}
        </ListaResumida>
      </Card>

      <ComoFunciona aberto={comoFunciona} onClose={() => setComoFunciona(false)} />
    </div>
  );
}

/* ============================================================
   A SUA FAIXA

   É o que os outros veem de você na liga, junto com o nome. Quem
   gradua é o professor: o aluno registra, e o app não tenta prever
   quando vem o próximo grau.
   ============================================================ */
function MinhaFaixa({ settings, irPara }) {
  const faixa = settings.faixa || 'branca';
  const graus = Number(settings.graus) || 0;
  const nome = FAIXAS.find((f) => f.id === faixa)?.nome || 'Branca';
  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="row" style={{ gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">sua faixa</div>
          <div className="h-sec" style={{ marginTop: 3 }}>
            Faixa {nome.toLowerCase()}{graus ? `, ${graus}º grau` : ''}
          </div>
        </div>
        <button className="btn ghost xs" onClick={() => irPara('conquistas')}>Ganhei graduação</button>
      </div>
      <div style={{ marginTop: 12 }}><FaixaVisual faixa={faixa} graus={graus} /></div>
      <p className="micro muted" style={{ marginTop: 9, lineHeight: 1.6 }}>
        Quem gradua é o seu professor. Quando ele te der grau ou faixa, registre aqui: suas técnicas não perdem nada.
      </p>
    </Card>
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
          {Array.from({ length: MAX_ESCUDOS }).map((_, i) => (
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
        aberto={aberto} onClose={() => setAberto(false)}
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

function Cabecalho({ onComo }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="h-page">Liga</h1>
      </div>
      <Btn icon={Info} onClick={onComo}>Como funciona</Btn>
    </div>
  );
}

function ComoFunciona({ aberto, onClose }) {
  return (
    <Sheet aberto={aberto} onClose={onClose} titulo="Como a liga funciona" wide>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        Cada coisa que você registra vale um tanto de pontos. Treinar vale mais que assistir aula, porque é o
        tatame que faz você melhorar. Assistir vale mais que nada, porque entender o porquê também conta.
      </p>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        Toda semana você corre num grupo pequeno, com gente que treina num ritmo parecido com o seu. Quem faz
        mais pontos sobe de divisão, quem faz menos desce. Na segunda ao meio-dia a semana fecha e tudo começa
        de novo.
      </p>

      <div className="divider" />
      <div className="eyebrow">as divisões</div>
      <div className="row wrap" style={{ gap: 6 }}>
        {Object.values(DIVISOES_LIGA).map((d, i, lista) => (
          <span key={d.nome} className="tiny" style={{ fontWeight: 600 }}>
            {d.nome}{i < lista.length - 1 ? ' →' : ''}
          </span>
        ))}
      </div>
      <p className="micro muted" style={{ lineHeight: 1.65 }}>
        A divisão é só da liga e muda toda semana. A sua faixa continua sendo a do tatame, e quem gradua é o seu
        professor.
      </p>

      <div className="divider" />
      <div className="eyebrow">o que os outros veem</div>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        O seu nome ou apelido, a sua faixa, a divisão, os pontos da semana, a ofensiva e quantas vezes por
        semana você disse que treina. As suas técnicas, os graus e o que acontece nos seus rolas ficam só com você.
      </p>

      <div className="divider" />
      <div className="eyebrow">a arena da semana</div>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        Além do grupo, você tem sempre um adversário: a sua semana passada. Ela já jogou e já tem placar,
        então dá pra ganhar dela mesmo na semana em que o grupo está parado.
      </p>

      <div className="divider" />
      <div className="eyebrow">quanto vale cada coisa</div>
      <div className="col" style={{ gap: 9 }}>
        {Object.values(EVENTOS).sort((a, b) => b.xp - a.xp).map((e) => (
          <div key={e.id} className="card" style={{ background: 'var(--void)', padding: 13 }}>
            <div className="row" style={{ gap: 9, marginBottom: 5 }}>
              <span className="tiny" style={{ fontWeight: 600, flex: 1 }}>{e.nome}</span>
              <span className="num tiny" style={{ color: 'var(--accent)', fontWeight: 700 }}>+{e.xp}</span>
            </div>
            <p className="micro muted" style={{ lineHeight: 1.6 }}>{e.desc}</p>
            <p className="micro" style={{ color: 'var(--dimmer)', marginTop: 5 }}>
              no máximo {e.tetoDia}x por dia
            </p>
          </div>
        ))}
      </div>

      <div className="divider" />
      <div className="eyebrow">o que uma semana cheia rende</div>
      <div className="col" style={{ gap: 7 }}>
        {[
          ['3 treinos com reflexão', '60'],
          ['9 rolas com dados completos', '108'],
          ['2 aulas completas', '30'],
          ['6 aulas rápidas', '6'],
          ['3 perguntas do quiz', '30'],
          ['bônus de ritmo', '25'],
        ].map(([o, q]) => (
          <div key={o} className="row" style={{ gap: 10, padding: '7px 11px', background: 'var(--void)', borderRadius: 9 }}>
            <span className="tiny" style={{ flex: 1 }}>{o}</span>
            <span className="num micro" style={{ color: 'var(--accent)' }}>+{q}</span>
          </div>
        ))}
        <div className="row" style={{ gap: 10, padding: '9px 11px' }}>
          <span className="tiny" style={{ flex: 1, fontWeight: 700 }}>a semana toda</span>
          <span className="num tiny" style={{ color: 'var(--jade)', fontWeight: 700 }}>259</span>
        </div>
      </div>
      <p className="micro muted" style={{ lineHeight: 1.65 }}>
        Quem treina duas vezes por semana não fica pra trás: o bônus de ritmo compara você com a sua própria
        média, não com a de quem tem mais tempo livre, e o grupo junta gente de ritmo parecido.
      </p>

      <p className="micro muted" style={{ lineHeight: 1.65 }}>
        Estudar rende até 140 pontos por semana, e só. Assistir vídeo a semana inteira nunca vai valer mais
        que ir treinar, porque é o tatame que faz você melhorar.
      </p>

      <div className="divider" />
      <div className="eyebrow">por que tem um limite por dia</div>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        Cada coisa tem um teto diário. Assistir vinte vídeos numa tarde não vale mais que ir treinar, porque o
        que faz você melhorar é o tatame.
      </p>
      <div className="divider" />
      <div className="eyebrow">a ofensiva</div>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        São dias seguidos aparecendo, e não dias seguidos de tatame. Ninguém treina jiu-jitsu sete dias por
        semana, e uma ofensiva que cobra isso quebra na primeira semana.
      </p>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        Qualquer coisa que dê ponto fecha o dia: uma aula rápida de trinta segundos, uma pergunta do quiz, uma
        revisão, ou o treino registrado.
      </p>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        E treino paga os <b style={{ color: 'var(--chalk)' }}>dois dias seguintes</b>, porque recuperação é
        parte do treino. Quem treina três vezes por semana nunca perde a ofensiva sem estudar nada. Quem treina
        duas precisa aparecer uma vez no fim de semana, e são trinta segundos.
      </p>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        A cada {DIAS_POR_ESCUDO} dias seguidos você ganha um escudo, até {MAX_ESCUDOS} guardados. Ele é gasto
        sozinho, sem perguntar, no dia que você não conseguir aparecer, porque quem esqueceu o dia não abriu
        o app pra confirmar nada. Quem está em {DIAS_POR_ESCUDO - 1} dias e some perde tudo. Quem passou
        dos {DIAS_POR_ESCUDO} tem como voltar.
      </p>

    </Sheet>
  );
}
