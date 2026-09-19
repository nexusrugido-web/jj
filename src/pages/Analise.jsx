import React, { useMemo, useState } from 'react';
import { ChartNoAxesColumn, Download, TriangleAlert, Swords, Clock, Percent, Trophy, Grid3x3 } from 'lucide-react';
import { useApp } from '../contexto';
import { Card, Btn, Stat, Chip, Empty, Sheet, useToast } from '../components/UI';
import { EscadaPosicional, Radar, BarrasTop, MatrizPosicoes } from '../components/Charts';
import Calendario from '../components/Calendario';
import GraficoEvolucao from '../components/GraficoEvolucao';
import TaxaPorFaixa from '../components/TaxaPorFaixa';
import { periodoDeDados, dentroDoPeriodo, rotuloDoPeriodo, primeiroTreino } from '../lib/periodo';
import SeletorPeriodo from '../components/SeletorPeriodo';
import RotuloPeriodo from '../components/RotuloPeriodo';
import ListaResumida from '../components/ListaResumida';
import { minhasTecnicas } from '../lib/graus';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { resumo, escadaPosicional, radarHabilidades, buracosNoJogo } from '../lib/stats';
import { toCSV } from '../db/db';
import { baixarArquivo, fmtDur, contar, hoje } from '../lib/utils';

export default function Analise() {
  const { sessions, rolls, positions, categories, techniques, partners, settings, irPara } = useApp();
  const gradings = useLiveQuery(() => db.gradings.toArray(), [], []) || [];
  const toast = useToast();
  const [periodoId, setPeriodoId] = useState('ultimos-30');
  const [modo, setModo] = useState('todos');
  const [mapaAberto, setMapaAberto] = useState(false);

  /* um período só, e o mesmo objeto filtra os dados e escreve o
     rótulo de cada bloco: o que está escrito é o que foi contado */
  const periodo = useMemo(
    () => periodoDeDados(periodoId, { desde: primeiroTreino(sessions) }),
    [periodoId, sessions]
  );

  /* só o filtro Gi/No-Gi: a taxa por faixa e o gráfico recortam o período com o mesmo objeto */
  const porModo = useMemo(
    () => (modo === 'todos' ? sessions : sessions.filter((x) => x.tipo === modo)),
    [sessions, modo]
  );
  const idsModo = useMemo(() => new Set(porModo.map((s) => s.id)), [porModo]);
  const rolasModo = useMemo(() => rolls.filter((r) => idsModo.has(r.sessionId)), [rolls, idsModo]);

  const filtradas = useMemo(() => dentroDoPeriodo(porModo, periodo), [porModo, periodo]);
  const ids = useMemo(() => new Set(filtradas.map((s) => s.id)), [filtradas]);
  const rolasF = useMemo(() => rolls.filter((r) => ids.has(r.sessionId)), [rolls, ids]);

  const r = useMemo(() => resumo(filtradas, rolasF), [filtradas, rolasF]);
  const escada = useMemo(() => escadaPosicional(rolasF, positions), [rolasF, positions]);
  /* as técnicas do período escolhido, não do histórico inteiro */
  const minhasDoPeriodo = useMemo(
    () => minhasTecnicas(rolasF, partners, filtradas, techniques, settings.faixa),
    [rolasF, partners, filtradas, techniques, settings.faixa]
  );
  const radar = useMemo(
    () => radarHabilidades(minhasDoPeriodo, categories, techniques),
    [minhasDoPeriodo, categories, techniques]
  );
  const alertas = useMemo(() => buracosNoJogo(rolasF, positions), [rolasF, positions]);

  const porTipo = useMemo(() => contar(filtradas.map((s) => s.tipo)), [filtradas]);
  const rpeMedio = filtradas.length ? (filtradas.reduce((a, s) => a + (s.rpe || 0), 0) / filtradas.length).toFixed(1) : ',';

  function exportarCSV() {
    const linhas = rolasF.map((rr) => {
      const s = filtradas.find((x) => x.id === rr.sessionId);
      const p = partners.find((x) => x.id === rr.partnerId);
      return {
        data: s?.data || '',
        tipo: s?.tipo || '',
        parceiro: p?.nome || '',
        faixa_parceiro: p?.faixa || '',
        duracao_min: rr.duracao,
        resultado: rr.resultado,
        finalizacoes_aplicadas: (rr.subsAplicadas || []).join('|'),
        finalizacoes_sofridas: (rr.subsSofridas || []).join('|'),
        notas: rr.notas || '',
      };
    });
    baixarArquivo(`tatame-rolas-${hoje()}.csv`, toCSV(linhas), 'text/csv;charset=utf-8');
    toast('CSV baixado');
  }

  if (!sessions.length) {
    return (
      <div className="page">
        <h1 className="h-page" style={{ marginBottom: 18 }}>Análise</h1>
        <Card><Empty icon={ChartNoAxesColumn} titulo="Ainda sem dados" texto="Registre alguns treinos com rolas e essa tela vira um raio-x do seu jogo." /></Card>
      </div>
    );
  }

  const semRolas = rolasF.length === 0;
  const nada = <NadaNoPeriodo periodo={periodo} aoVerTudo={() => setPeriodoId('desde-inicio')} />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">raio-x do seu jogo</div>
          <h1 className="h-page">Análise</h1>
        </div>
        <Btn icon={Download} onClick={exportarCSV}>Exportar CSV</Btn>
      </div>

      {/* um período só pra tela toda, e o intervalo exato dele */}
      <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
        <SeletorPeriodo valor={periodo.id} onMudar={setPeriodoId} />
        <div className="seletor-pill" style={{ flex: '0 1 240px' }}>
          {[{ id: 'todos', nome: 'Todos' }, { id: 'gi', nome: 'Gi' }, { id: 'nogi', nome: 'No-Gi' }].map((o) => (
            <button key={o.id} className={modo === o.id ? 'on' : ''} onClick={() => setModo(o.id)}>{o.nome}</button>
          ))}
        </div>
      </div>
      <p className="micro muted" style={{ marginBottom: 16 }}>
        {rotuloDoPeriodo(periodo)}{modo !== 'todos' && ` · só ${modo === 'gi' ? 'Gi' : 'No-Gi'}`}
      </p>

      {/* resumo do período */}
      <div style={{ marginBottom: 8 }}><RotuloPeriodo periodo={periodo}>resumo</RotuloPeriodo></div>
      <div className="grid g4" style={{ marginBottom: 10 }}>
        <Card><Stat icon={Clock} valor={fmtDur(r.matMin)} label="tempo de tatame" sub={`${r.sessoes} treinos`} /></Card>
        <Card><Stat icon={Swords} valor={r.rolas} label="rolas" sub={`${(r.rolas / Math.max(1, r.sessoes)).toFixed(1)} por treino`} /></Card>
        <Card><Stat icon={Trophy} valor={`${r.taxaVitoria}%`} label="taxa de vitória" tone={r.rolas && r.taxaVitoria >= 50 ? 'jade' : undefined} sub={`${r.vitorias} vitórias · ${r.derrotas} derrotas`} /></Card>
        <Card><Stat icon={Percent} valor={`${r.subPct}%`} label="rolas com finalização" tone="jade" sub={`${r.tapPct}% com tap sofrido`} /></Card>
      </div>
      {filtradas.length > 0 && (
        <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
          <Chip>RPE médio {rpeMedio} de 10</Chip>
          {porTipo.map(([t, n]) => <Chip key={t}>{t}: {n}</Chip>)}
        </div>
      )}

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">toque num dia</div>
            <h2 className="h-sec">Presença no tatame</h2>
          </div>
        </div>
        <Calendario
          sessions={porModo} rolls={rolasModo} partners={partners} gradings={gradings}
          aoAbrirTreino={(ses) => irPara('treinos', { abrir: ses.id })}
        />
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <RotuloPeriodo periodo={periodo} />
            <h2 className="h-sec">Contra quem você luta</h2>
          </div>
        </div>
        {semRolas ? nada : (
          <TaxaPorFaixa sessions={porModo} rolls={rolasModo} partners={partners} minhaFaixa={settings.faixa} periodo={periodo} />
        )}
      </Card>

      <div className="split" style={{ marginBottom: 14 }}>
        <Card>
          <div className="card-head">
            <div>
              <RotuloPeriodo periodo={periodo}>sai dos pontos que você marca</RotuloPeriodo>
              <h2 className="h-sec">Onde você fica por cima e onde fica por baixo</h2>
              <p className="tiny muted" style={{ marginTop: 7, lineHeight: 1.7 }}>
                As posições vêm dos pontos que você marca em cada rola. Passagem de guarda coloca você em cima dos 100kg,
                montada coloca na montada. Só aparecem aqui as posições que já apareceram nos seus treinos.
              </p>
            </div>
          </div>
          {semRolas ? nada : (
            <>
              <EscadaPosicional dados={escada} />
              <Btn size="sm" variant="ghost" icon={Grid3x3} onClick={() => setMapaAberto(true)} style={{ marginTop: 12 }}>
                Ver mapa de posições
              </Btn>
            </>
          )}
        </Card>

        <div className="col">
          <Card>
            <div className="card-head"><div><RotuloPeriodo periodo={periodo} />
            <h2 className="h-sec">Radar de habilidades</h2></div></div>
            <p className="micro muted" style={{ marginBottom: 8 }}>Cada técnica que você aplicou nos rolas do período soma no eixo da categoria dela.</p>
            {semRolas ? nada : <Radar eixos={radar} />}
          </Card>
        </div>
      </div>

      <Sheet
        aberto={mapaAberto} onClose={() => setMapaAberto(false)} wide
        titulo="Mapa de posições" subtitulo={`▲ dominou · ▼ sofreu · ${periodo.rotulo.toLowerCase()}`}
      >
        <div className="scroll-x"><MatrizPosicoes dados={escada} /></div>
      </Sheet>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <RotuloPeriodo periodo={periodo} />
            <h2 className="h-sec">Evolução</h2>
          </div>
        </div>
        <GraficoEvolucao sessions={porModo} rolls={rolasModo} partners={partners} gradings={gradings} periodo={periodo} />
      </Card>

      <div className="split" style={{ marginBottom: 14 }}>
        <Card>
          <div className="card-head"><div><RotuloPeriodo periodo={periodo} /><h2 className="h-sec">Suas finalizações</h2></div><Chip tone="jade">{r.finalizacoes}</Chip></div>
          <ListaResumida itens={r.aplicadas} quantos={5} verTodos="Ver todas" titulo="Suas finalizações" subtitulo={rotuloDoPeriodo(periodo)}>
            {(lista) => <BarrasTop dados={lista} tone="jade" vazio="Nenhuma finalização no período." />}
          </ListaResumida>
        </Card>
        <Card>
          <div className="card-head"><div><RotuloPeriodo periodo={periodo} /><h2 className="h-sec">O que te pega</h2></div><Chip tone="blood">{r.taps}</Chip></div>
          <ListaResumida itens={r.sofridas} quantos={5} verTodos="Ver todas" titulo="O que te pega" subtitulo={rotuloDoPeriodo(periodo)}>
            {(lista) => <BarrasTop dados={lista} tone="blood" vazio="Ninguém te finalizou no período." />}
          </ListaResumida>
        </Card>
      </div>

      {alertas.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: 'color-mix(in srgb, var(--blood) 30%, var(--seam))' }}>
          <div className="card-head">
            <div>
              <RotuloPeriodo periodo={periodo} />
              <h2 className="h-sec row" style={{ gap: 8 }}><TriangleAlert size={17} style={{ color: 'var(--blood)' }} /> Buracos no jogo</h2>
            </div>
          </div>
          <div className="grid g-cards">
            {alertas.map((a, i) => (
              <div key={i} className="card" style={{ background: 'var(--void)' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.titulo}</div>
                <p className="tiny muted" style={{ marginTop: 4 }}>{a.texto}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* bloco sem rola no período: diz isso e deixa trocar, em vez de sumir */
function NadaNoPeriodo({ periodo, aoVerTudo }) {
  return (
    <div className="col" style={{ gap: 10, alignItems: 'flex-start', padding: '6px 0' }}>
      <p className="tiny muted">Nenhum rola no período ({periodo.rotulo.toLowerCase()}).</p>
      {periodo.id !== 'desde-inicio' && <Btn size="sm" onClick={aoVerTudo}>Ver desde o início</Btn>}
    </div>
  );
}
