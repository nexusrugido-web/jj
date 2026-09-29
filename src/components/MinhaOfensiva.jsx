import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Flame, Crown, ShieldCheck, Share2, Swords, ChevronRight } from 'lucide-react';
import { db } from '../db/db';
import { useApp } from '../contexto';
import { Btn, Sheet } from './UI';
import Figurinha from './Figurinha';
import { semanaDe } from '../lib/xp';
import { textoOfensivaSemanal, somarDiasOfensiva, MAX_ESCUDOS } from '../lib/ofensivaSemanal';
import useOfensivaSemanal from '../lib/useOfensivaSemanal';
import { hoje, addDias } from '../lib/utils';


/* ============================================================
   SUA OFENSIVA

   Abre do placar do Painel. É do aluno, não da liga: a sequência,
   quando vem o próximo escudo e a semana de agora contra a
   passada. A Liga ficou só com a liga.
   ============================================================ */
export default function MinhaOfensiva({ aberto, onClose }) {
  const { irPara } = useApp();
  const pontos = useLiveQuery(() => db.pontos.toArray(), [], []) || [];
  const ofa = useOfensivaSemanal();

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
      <BlocoOfensiva o={ofa} irPara={ir} />
      <DueloDaSemana agora={semanas.agora} passada={semanas.passada} recorde={semanas.recorde} irPara={ir} />
    </Sheet>
  );
}

/* ============================================================
   A OFENSIVA

   A pista mostra as últimas doze semanas. Treinos, pausas e
   escudos seguem o mesmo cálculo do contador.
   ============================================================ */
function BlocoOfensiva({ o, irPara }) {
  const frase = textoOfensivaSemanal(o);
  const cor = frase.tom || (o.viva ? 'roar' : 'dim');
  const estados = new Map(o.historico.map((h) => [h.semana, h.estado]));
  const pista = Array.from({ length: 12 }, (_, i) => {
    const semana = somarDiasOfensiva(o.semanaAtual, -(11 - i) * 7);
    const estado = estados.get(semana) || (i === 11 ? o.estado : 'sem_treino');
    return { semana, estado, classe: estado === 'treinada' ? 'on' : ['pausada', 'protegida'].includes(estado) ? 'gelo' : '', agora: i === 11 };
  });
  const nomes = { treinada: 'com treino', pausada: 'pausada por lesão', protegida: 'protegida por escudo', pendente: 'em aberto', sem_treino: 'sem treino' };
  return (
    <div className={`ofa${o.viva ? ' viva' : ''}`} style={{ '--cor': `var(--${cor})` }}>
      <div className="ofa-topo">
        <span className="ofa-chama"><Flame size={22} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">ofensiva semanal</div>
          <div className="ofa-num"><span className="num">{o.semanas}</span><span className="ofa-dia">{o.semanas === 1 ? 'semana' : 'semanas'}</span></div>
        </div>
        {o.recorde > o.semanas && <span className="fita-recorde" title="recorde semanal"><Crown size={12} /> {o.recorde}</span>}
      </div>
      <div className="ofa-pista" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }} aria-label="Últimas 12 semanas">
        {pista.map((d) => <i key={d.semana} className={`${d.classe}${d.agora ? ' agora' : ''}`} title={`Semana de ${d.semana}: ${nomes[d.estado]}`} aria-label={`Semana de ${d.semana}: ${nomes[d.estado]}`} />)}
      </div>
      <div className="ofa-legenda"><span>últimas 12 semanas</span><span>esta semana</span></div>
      <p className="ofa-txt"><strong>{frase.titulo}.</strong> {frase.texto}</p>
      <p className="tiny muted">Um treino realizado na semana mantém a ofensiva. Sua meta pessoal é acompanhada separadamente. A semana vai de segunda a domingo, no horário de Brasília.</p>
      <p className="micro muted">Gi, no-gi, drill, open mat e aula privada contam. Competições contam quando você conclui o registro da participação.</p>
      <div className="ofa-pe">
        <div className="escudos">
          {Array.from({ length: o.maxEscudos || MAX_ESCUDOS }).map((_, i) => <span key={i} className={`escudo ${i < o.escudos ? 'cheio' : ''}`}><ShieldCheck size={12} /></span>)}
          <span className="micro muted" style={{ marginLeft: 4 }}>{o.escudos} de {o.maxEscudos} escudos</span>
        </div>
        <div className="row wrap" style={{ gap: 8, marginLeft: 'auto' }}>
          {o.semanas >= 4 && <BtnCompartilhar o={o} />}
          {!o.treinouEstaSemana && !o.congelada && <Btn size="sm" variant="primary" onClick={() => irPara('treinos')}>Registrar treino <ChevronRight size={13} /></Btn>}
        </div>
      </div>
      <p className="micro muted" style={{ marginTop: 12 }}>{o.faltaProEscudo ? `Próximo escudo em ${o.faltaProEscudo} ${o.faltaProEscudo === 1 ? 'semana com treino' : 'semanas com treino'}.` : 'Escudos completos.'} Um escudo protege uma semana sem treino. Lesões que impedem treinar preservam a sequência sem gastar escudos. Proteção e pausa não somam semanas.</p>
      {o.recordeDiario > 0 && <p className="micro muted">Histórico anterior: recorde de {o.recordeDiario} dias na regra diária. Esse recorde não foi convertido em semanas.</p>}
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
        dados={{ selo: 'ofensiva', grande: `${o.semanas} semanas de ofensiva`, sub: `no tatame · recorde de ${o.recorde}` }}
        link={{ tipo: 'ofensiva', dados: { semanas: o.semanas, recorde: o.recorde, versao: 2 }, texto: `${o.semanas} semanas de ofensiva no tatame.` }}
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
