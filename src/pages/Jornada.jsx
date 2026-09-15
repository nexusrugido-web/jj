import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Flame, Award, Info, Lock, Check, Swords, ChevronRight, Crown,
} from 'lucide-react';
import { db } from '../db/db';
import { useApp } from '../contexto';
import { Card, Btn, Stat, Empty, Bar, Sheet } from '../components/UI';
import Liga from '../components/Liga';
import { EVENTOS, DIVISOES, divisaoPorXp, proximaDivisao, semanaDe, mesDe } from '../lib/xp';
import { relativo, hoje, addDias } from '../lib/utils';

/* Semana, Mês e Sempre não diziam nada sobre jiu-jitsu.
   Estes três nomes dizem o que cada intervalo mede de verdade. */
const JANELAS = [
  {
    id: 'ritmo', nome: 'Ritmo', intervalo: 'últimos 7 dias',
    texto: 'O que você fez nesta semana. Serve pra saber se está mantendo o passo, não pra comparar com o seu total.',
  },
  {
    id: 'constancia', nome: 'Constância', intervalo: 'últimos 30 dias',
    texto: 'Um mês é o intervalo em que dá pra ver hábito. Semana ruim acontece com todo mundo, mês inteiro parado é outra conversa.',
  },
  {
    id: 'temporada', nome: 'Temporada', intervalo: 'de janeiro até hoje',
    texto: 'O ano corrente. Zera em primeiro de janeiro, e é por isso que uma aula vista há mais de um ano volta a valer ponto: nesse tempo você mudou, e ela vai te dizer outra coisa.',
  },
  {
    id: 'jornada', nome: 'Jornada', intervalo: 'desde o primeiro registro',
    texto: 'Tudo que você já fez. Este número nunca volta pra trás, e é ele que mostra o tamanho do caminho.',
  },
];

/* ============================================================
   AS FASES

   Cada divisão vira uma fase com nome de lugar, porque ponto
   solto não diz nada e "Praticante" sozinho também não. O nome
   do lugar diz o que muda quando você chega lá.
   ============================================================ */
const ARENAS = {
  iniciante: {
    fase: 'Fase 1',
    arena: 'Tatame de casa',
    lema: 'Aqui o jogo é aparecer. Só isso.',
    libera: 'Registrar treino, contar o que funcionou e ver a sua presença no mês.',
  },
  praticante: {
    fase: 'Fase 2',
    arena: 'Roda de treino',
    lema: 'Você já tem ritmo. Agora é encaixar contra quem resiste.',
    libera: 'Os graus das suas técnicas começam a fazer sentido, porque já tem registro suficiente.',
  },
  competidor: {
    fase: 'Fase 3',
    arena: 'Área de luta',
    lema: 'O seu jogo tem forma. Dá pra escolher onde a luta vai parar.',
    libera: 'O app já consegue apontar buraco de defesa e caminho de ataque com os seus próprios números.',
  },
  veterano: {
    fase: 'Fase 4',
    arena: 'Tatame principal',
    lema: 'Anos somados. Daqui pra frente o número só cresce.',
    libera: 'Nada trava mais. O que aparece aqui é o tamanho do caminho que você já fez.',
  },
};

export default function Jornada() {
  const { irPara } = useApp();
  const pontos = useLiveQuery(() => db.pontos.toArray(), [], []) || [];
  const [comoFunciona, setComoFunciona] = useState(false);
  const [periodo, setPeriodo] = useState('ritmo');

  const dados = useMemo(() => {
    /* cada janela conta só o que aconteceu dentro dela. Antes os
       três botões mostravam o mesmo número, que é o que deixava
       a tela sem sentido. */
    const soma = (f) => pontos.filter(f).reduce((a, x) => a + (x.xp || 0), 0);
    const sem = semanaDe();
    const semPassada = semanaDe(addDias(hoje(), -7));
    const mes = mesDe();
    const total = soma(() => true);
    const porEvento = {};
    for (const l of pontos) porEvento[l.evento] = (porEvento[l.evento] || 0) + l.xp;
    const div = divisaoPorXp(total);
    const prox = proximaDivisao(total);
    const dias = (n) => addDias(hoje(), -n);
    const janela = (filtro) => {
      const linhas = pontos.filter(filtro);
      return {
        xp: linhas.reduce((a, x) => a + (x.xp || 0), 0),
        eventos: linhas.length,
        treinos: linhas.filter((x) => x.evento === 'treino').length,
      };
    };

    /* o seu melhor 7 dias de todos, pra saber contra o que você
       está lutando quando não tem mais ninguém na sala */
    const porSemana = {};
    for (const l of pontos) porSemana[l.semana] = (porSemana[l.semana] || 0) + (l.xp || 0);
    const recorde = Math.max(0, ...Object.values(porSemana));

    return {
      total,
      semana: soma((x) => x.semana === sem),
      semanaPassada: soma((x) => x.semana === semPassada),
      recordeSemana: recorde,
      mes: soma((x) => x.mes === mes),
      porEvento,
      divisao: div,
      proxima: prox,
      janelas: {
        ritmo: janela((x) => x.data >= dias(6)),
        constancia: janela((x) => x.data >= dias(29)),
        temporada: janela((x) => String(x.data).slice(0, 4) === new Date().getFullYear().toString()),
        jornada: janela(() => true),
      },
    };
  }, [pontos]);

  const recentes = useMemo(
    () => [...pontos].sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 20),
    [pontos]
  );

  if (!pontos.length) {
    return (
      <div className="page">
        <Cabecalho onComo={() => setComoFunciona(true)} />
        <Card>
          <Empty
            icon={Flame}
            titulo="Sua jornada começa no primeiro registro"
            texto="Cada treino anotado, cada aula assistida e cada pergunta do quiz soma pontos. Eles nunca zeram, porque evolução no jiu-jitsu não zera toda segunda-feira."
            acao={<Btn variant="primary" onClick={() => irPara('treinos')}>Registrar treino</Btn>}
          />
        </Card>
        <Trilha total={0} />
        <ComoFunciona aberto={comoFunciona} onClose={() => setComoFunciona(false)} />
      </div>
    );
  }

  const arena = ARENAS[dados.divisao.id] || ARENAS.iniciante;
  const faltam = dados.proxima ? dados.proxima.min - dados.total : 0;
  const feito = dados.total - dados.divisao.min;
  const trecho = dados.proxima ? dados.proxima.min - dados.divisao.min : 1;

  return (
    <div className="page">
      <Cabecalho onComo={() => setComoFunciona(true)} />

      {/* ---- a fase em que você está ---- */}
      <div className="arena" style={{ '--cor': `var(--${dados.divisao.cor})` }}>
        <div className="arena-luz" />
        <div className="arena-topo">
          <span className="arena-fase">{arena.fase}</span>
          <span className="arena-selo"><Award size={13} /> {dados.divisao.nome}</span>
        </div>

        <h2 className="arena-nome">{arena.arena}</h2>
        <p className="arena-lema">{arena.lema}</p>

        <div className="arena-num">
          <span className="num">{dados.total}</span>
          <span className="stat-lab">pontos somados</span>
        </div>

        {dados.proxima ? (
          <div className="arena-portao">
            <div className="row tiny" style={{ gap: 8, marginBottom: 7 }}>
              <span style={{ flex: 1 }}>
                Portão da {ARENAS[dados.proxima.id]?.arena || dados.proxima.nome}
              </span>
              <span className="num micro muted">{feito} de {trecho}</span>
            </div>
            <Bar v={feito} max={trecho} />
            <p className="tiny muted" style={{ marginTop: 8, lineHeight: 1.65 }}>
              Faltam <b style={{ color: 'var(--chalk)' }}>{faltam} pontos</b> pra abrir.
              {' '}{ARENAS[dados.proxima.id]?.libera}
            </p>
          </div>
        ) : (
          <div className="arena-portao">
            <div className="row" style={{ gap: 9 }}>
              <Crown size={15} style={{ color: `var(--${dados.divisao.cor})` }} />
              <p className="tiny muted" style={{ flex: 1, lineHeight: 1.65 }}>
                Última fase aberta. Daqui pra frente o número só cresce.
              </p>
            </div>
          </div>
        )}
      </div>

      <Trilha total={dados.total} />

      {/* ---- a arena da semana ---- */}
      <DueloDaSemana
        agora={dados.semana}
        passada={dados.semanaPassada}
        recorde={dados.recordeSemana}
        irPara={irPara}
      />

      <div className="seletor-pill" style={{ marginBottom: 14 }}>
        {JANELAS.map((o) => (
          <button key={o.id} className={periodo === o.id ? 'on' : ''} onClick={() => setPeriodo(o.id)}>{o.nome}</button>
        ))}
      </div>

      {(() => {
        const j = JANELAS.find((x) => x.id === periodo) || JANELAS[0];
        const d = dados.janelas[periodo];
        return (
          <Card className="accent" style={{ marginBottom: 14 }}>
            <div className="card-head">
              <div>
                <div className="eyebrow">{j.intervalo}</div>
                <h2 className="h-sec">{j.nome}</h2>
              </div>
            </div>
            <p className="tiny muted" style={{ lineHeight: 1.7, marginBottom: 14 }}>{j.texto}</p>

            <div className="grid g3" style={{ gap: 12 }}>
              <Stat size="sm" valor={d.xp} label="pontos" tone="accent" />
              <Stat size="sm" valor={d.treinos} label={d.treinos === 1 ? 'treino' : 'treinos'} />
              <Stat size="sm" valor={d.eventos} label="registros" />
            </div>

            {d.xp === 0 && (
              <p className="micro muted" style={{ marginTop: 12 }}>
                Nada registrado neste intervalo ainda.
              </p>
            )}
          </Card>
        );
      })()}

      {/* de onde veio */}
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">de onde vieram os seus pontos</div>
            <h2 className="h-sec">O que você anda fazendo</h2>
          </div>
        </div>
        <div className="col" style={{ gap: 9 }}>
          {Object.entries(dados.porEvento)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => {
              const e = EVENTOS[k];
              if (!e) return null;
              return (
                <div key={k}>
                  <div className="row" style={{ gap: 9, marginBottom: 5 }}>
                    <span className="tiny" style={{ flex: 1, fontWeight: 600 }}>{e.nome}</span>
                    <span className="num micro" style={{ color: 'var(--accent)' }}>{v}</span>
                  </div>
                  <Bar v={v} max={Math.max(...Object.values(dados.porEvento))} />
                </div>
              );
            })}
        </div>
      </Card>

      <Liga />

      {/* histórico */}
      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">o que entrou por último</div>
            <h2 className="h-sec">Últimos pontos</h2>
          </div>
        </div>
        <div className="col" style={{ gap: 7 }}>
          {recentes.map((l) => (
            <div key={l.id} className="xp-evento">
              <span className="tiny" style={{ flex: 1 }}>
                {EVENTOS[l.evento]?.nome || l.evento}
                {l.detalhe && <span className="micro muted"> · {String(l.detalhe).slice(0, 34)}</span>}
              </span>
              <span className="micro muted">{relativo(l.data)}</span>
              <span className="xp-evento-xp">+{l.xp}</span>
            </div>
          ))}
        </div>
      </Card>

      <ComoFunciona aberto={comoFunciona} onClose={() => setComoFunciona(false)} />
    </div>
  );
}

/* ============================================================
   A TRILHA

   As quatro fases uma do lado da outra, com o caminho entre
   elas preenchendo conforme os pontos sobem. Fase fechada fica
   com cadeado e o preço aparece embaixo, pra você saber o que
   está comprando com treino.
   ============================================================ */
function Trilha({ total = 0 }) {
  const atual = divisaoPorXp(total);
  return (
    <Card className="pad-0" style={{ marginBottom: 14 }}>
      <div style={{ padding: '16px 18px 2px' }}>
        <div className="eyebrow">o caminho inteiro</div>
        <h2 className="h-sec">As quatro fases</h2>
      </div>
      <div className="trilha">
        {DIVISOES.map((d, i) => {
          const prox = DIVISOES[i + 1];
          const aberta = total >= d.min;
          const estado = !aberta ? 'trancada' : d.id === atual.id ? 'atual' : 'feita';
          const pct = !prox
            ? (aberta ? 100 : 0)
            : Math.max(0, Math.min(100, ((total - d.min) / (prox.min - d.min)) * 100));
          const a = ARENAS[d.id] || {};
          return (
            <div key={d.id} className={`fase ${estado}`} style={{ '--cor': `var(--${d.cor})` }}>
              <span className="fase-trilho">
                <i style={{ width: `${aberta ? pct : 0}%`, background: `var(--${d.cor})` }} />
              </span>
              <span className="fase-no">
                {estado === 'trancada' ? <Lock size={15} />
                  : estado === 'atual' ? <Swords size={15} />
                    : <Check size={15} />}
              </span>
              <span className="fase-n">{a.fase}</span>
              <span className="fase-nome">{a.arena}</span>
              <span className="fase-gate num">{d.min === 0 ? 'aberta' : `${d.min} pts`}</span>
            </div>
          );
        })}
      </div>
      <p className="micro muted" style={{ padding: '4px 18px 16px', lineHeight: 1.6 }}>
        A fase nunca fecha depois de aberta. Ficar seis meses parado não te devolve pra trás, porque o que você
        treinou não deixa de ter acontecido.
      </p>
    </Card>
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
        <Btn size="sm" variant="ghost" onClick={() => irPara('estudo')}>
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
        <div className="eyebrow">tudo que você já fez, somado</div>
        <h1 className="h-page">Jornada</h1>
      </div>
      <Btn icon={Info} onClick={onComo}>Como funciona</Btn>
    </div>
  );
}

function ComoFunciona({ aberto, onClose }) {
  return (
    <Sheet aberto={aberto} onClose={onClose} titulo="Como os pontos funcionam" wide>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        Cada coisa que você registra vale um tanto de pontos. Treinar vale mais que assistir aula, porque é o
        tatame que faz você melhorar. Assistir vale mais que nada, porque entender o porquê também conta.
      </p>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        Os pontos somam e nunca voltam a zero. Serve pra você ver o quanto já andou. Tem dia que o treino
        parece que não rendeu, aí você abre aqui e vê que em três meses foram trinta treinos. Esse número não
        mente.
      </p>

      <div className="divider" />
      <div className="eyebrow">as quatro fases</div>
      <div className="col" style={{ gap: 9 }}>
        {DIVISOES.map((d) => {
          const a = ARENAS[d.id] || {};
          return (
            <div key={d.id} className="card" style={{ background: 'var(--void)', padding: 13 }}>
              <div className="row" style={{ gap: 9, marginBottom: 5 }}>
                <span className="micro" style={{ color: 'var(--dimmer)' }}>{a.fase}</span>
                <span className="tiny" style={{ fontWeight: 600, flex: 1, color: `var(--${d.cor})` }}>{a.arena}</span>
                <span className="num micro muted">{d.min === 0 ? 'aberta' : `${d.min}+`}</span>
              </div>
              <p className="micro muted" style={{ lineHeight: 1.6 }}>{a.lema}</p>
              <p className="micro" style={{ color: 'var(--dimmer)', marginTop: 5, lineHeight: 1.6 }}>{a.libera}</p>
            </div>
          );
        })}
      </div>
      <p className="micro muted" style={{ lineHeight: 1.65 }}>
        A sua faixa continua sendo o que vale no tatame. As fases aqui são um jeito de enxergar o esforço que
        você vem colocando, e elas nunca voltam pra trás.
      </p>

      <div className="divider" />
      <div className="eyebrow">a arena da semana</div>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        O seu adversário padrão é a sua semana passada. Ela já jogou, já tem placar e não depende de mais
        ninguém ter baixado o app. Quando a liga abrir, ela entra por cima disso, não no lugar.
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
      <div className="eyebrow">as quatro janelas</div>
      <div className="col" style={{ gap: 10 }}>
        {JANELAS.map((j) => (
          <div key={j.id} className="row" style={{ gap: 11, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--void)', borderRadius: 10 }}>
            <div style={{ flex: 1 }}>
              <div className="tiny" style={{ fontWeight: 600 }}>{j.nome}</div>
              <p className="micro muted" style={{ marginTop: 3 }}>{j.intervalo}</p>
            </div>
            <span className="micro" style={{ color: j.id === 'jornada' ? 'var(--jade)' : 'var(--dimmer)' }}>
              {j.id === 'jornada' ? 'nunca zera' : 'zera'}
            </span>
          </div>
        ))}
      </div>
      <p className="micro muted" style={{ lineHeight: 1.65 }}>
        As três primeiras zeram porque medem ritmo. A última guarda tudo, porque o que você já treinou não
        deixa de ter acontecido.
      </p>

      <div className="divider" />
      <div className="eyebrow">o que uma semana cheia rende</div>
      <div className="col" style={{ gap: 7 }}>
        {[
          ['3 treinos com reflexão', '60'],
          ['9 rolas com dados completos', '108'],
          ['2 aulas longas', '30'],
          ['6 shorts', '6'],
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
        Nesse ritmo, a Fase 2 chega em umas quatro semanas e a Fase 3 em uns três meses. Quem treina duas vezes
        por semana leva mais tempo, e tudo bem: o bônus de ritmo compara você com a sua própria média, não com
        a de quem tem mais tempo livre.
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
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        E a sua sequência de semanas tem escudo. A cada quatro semanas seguidas você ganha um, até três
        guardados. Se precisar faltar por lesão ou viagem, o escudo segura a sequência no lugar de você.
      </p>
    </Sheet>
  );
}
