import React, { useMemo, useState } from 'react';
import { ChartNoAxesColumn, Download, TriangleAlert, Swords, Clock, Percent, Flame } from 'lucide-react';
import { useApp } from '../contexto';
import { Card, Btn, Stat, Chip, Empty, Seg, useToast, Bar } from '../components/UI';
import { EscadaPosicional, Radar, BarrasTop, MatrizPosicoes, Donut } from '../components/Charts';
import Calendario from '../components/Calendario';
import GraficoEvolucao from '../components/GraficoEvolucao';
import TaxaPorFaixa from '../components/TaxaPorFaixa';
import { PERIODOS } from '../lib/periodo';
import SeletorPeriodo, { rotuloDe } from '../components/SeletorPeriodo';
import { minhasTecnicas } from '../lib/graus';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { resumo, escadaPosicional, radarHabilidades, buracosNoJogo, statsParceiro } from '../lib/stats';
import { toCSV } from '../db/db';
import { baixarArquivo, fmtDur, pct, contar, hoje, addDias } from '../lib/utils';

export default function Analise() {
  const { sessions, rolls, positions, categories, techniques, partners, settings, irPara } = useApp();
  const gradings = useLiveQuery(() => db.gradings.toArray(), [], []) || [];
  const toast = useToast();
  const [periodo, setPeriodo] = useState('30d');
  const [modo, setModo] = useState('todos');

  const filtradas = useMemo(() => {
    let s = sessions;
    if (periodo !== 'tudo') {
      const p = PERIODOS.find((x) => x.id === periodo);
      const dias = p?.dias || 365;
      const corte = addDias(hoje(), -dias);
      s = s.filter((x) => x.data >= corte);
    }
    if (modo !== 'todos') s = s.filter((x) => x.tipo === modo);
    return s;
  }, [sessions, periodo, modo]);

  const ids = useMemo(() => new Set(filtradas.map((s) => s.id)), [filtradas]);
  const rolasF = useMemo(() => rolls.filter((r) => ids.has(r.sessionId)), [rolls, ids]);

  /* só o filtro Gi/No-Gi, o recorte de tempo quem faz é o próprio bloco */
  const porModo = useMemo(
    () => (modo === 'todos' ? sessions : sessions.filter((x) => x.tipo === modo)),
    [sessions, modo]
  );
  const idsModo = useMemo(() => new Set(porModo.map((s) => s.id)), [porModo]);
  const rolasModo = useMemo(() => rolls.filter((r) => idsModo.has(r.sessionId)), [rolls, idsModo]);

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

  const porFaixaParceiro = useMemo(() => {
    const m = new Map();
    for (const rr of rolasF) {
      const p = partners.find((x) => x.id === rr.partnerId);
      const f = p?.faixa || 'sem faixa';
      if (!m.has(f)) m.set(f, { rolas: 0, fin: 0, tap: 0 });
      const o = m.get(f);
      o.rolas++;
      if (rr.resultado === 'finalizei' || rr.resultado === 'ambos') o.fin++;
      if (rr.resultado === 'fui_finalizado' || rr.resultado === 'ambos') o.tap++;
    }
    return [...m.entries()].sort((a, b) => b[1].rolas - a[1].rolas);
  }, [rolasF, partners]);

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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">raio-x do seu jogo</div>
          <h1 className="h-page">Análise</h1>
        </div>
        <Btn icon={Download} onClick={exportarCSV}>Exportar CSV</Btn>
      </div>

      <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
        <SeletorPeriodo valor={periodo} onMudar={setPeriodo} />
        <div className="seletor-pill" style={{ flex: '0 1 240px' }}>
          {[{ id: 'todos', nome: 'Todos' }, { id: 'gi', nome: 'Gi' }, { id: 'nogi', nome: 'No-Gi' }].map((o) => (
            <button key={o.id} className={modo === o.id ? 'on' : ''} onClick={() => setModo(o.id)}>{o.nome}</button>
          ))}
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Card><Stat icon={Clock} valor={fmtDur(r.matMin)} label="tempo de tatame" sub={`${r.sessoes} treinos`} /></Card>
        <Card><Stat icon={Swords} valor={r.rolas} label="rolas" sub={`${(r.rolas / Math.max(1, r.sessoes)).toFixed(1)} por treino`} /></Card>
        <Card><Stat icon={Percent} valor={`${r.subPct}%`} label="rolas com finalização" tone="jade" sub={`${r.tapPct}% com tap sofrido`} /></Card>
        <Card><Stat icon={Flame} valor={rpeMedio} label="RPE médio" sub="1 a 10" /></Card>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">{rotuloDe(periodo)} · toque num dia</div>
            <h2 className="h-sec">Presença no tatame</h2>
          </div>
        </div>
        <Calendario
          sessions={porModo} rolls={rolasModo} partners={partners} gradings={gradings}
          modo="ano" periodo={periodo}
          aoAbrirTreino={(ses) => irPara('treinos', { abrir: ses.id })}
        />
        <div className="row wrap" style={{ gap: 6, marginTop: 16, borderTop: '1px solid var(--seam)', paddingTop: 14 }}>
          {porTipo.map(([t, n]) => <Chip key={t}>{t}: {n}</Chip>)}
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">{rotuloDe(periodo)}</div>
            <h2 className="h-sec">Taxa de vitória por faixa</h2>
          </div>
        </div>
        <TaxaPorFaixa sessions={porModo} rolls={rolasModo} partners={partners} minhaFaixa={settings.faixa} periodo={periodo} />
      </Card>

      {alertas.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: 'color-mix(in srgb, var(--blood) 30%, var(--seam))' }}>
          <div className="card-head">
            <h2 className="h-sec row" style={{ gap: 8 }}><TriangleAlert size={17} style={{ color: 'var(--blood)' }} /> Buracos no jogo</h2>
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

      <div className="split" style={{ marginBottom: 14 }}>
        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">sai dos pontos que você marca</div>
              <div className="eyebrow">{rotuloDe(periodo)}</div>
            <h2 className="h-sec">Onde você fica por cima e onde fica por baixo</h2>
            <p className="tiny muted" style={{ marginTop: 7, lineHeight: 1.7 }}>
              As posições vêm dos pontos que você marca em cada rola. Passagem de guarda coloca você em cima dos 100kg,
              montada coloca na montada. Só aparecem aqui as posições que já apareceram nos seus treinos.
            </p>
            </div>
          </div>
          <EscadaPosicional dados={escada} />
        </Card>

        <div className="col">
          <Card>
            <div className="card-head"><div className="eyebrow">{rotuloDe(periodo)}</div>
            <h2 className="h-sec">Radar de habilidades</h2></div>
            <p className="micro muted" style={{ marginBottom: 8 }}>Baseado no domínio que você marcou em cada técnica.</p>
            <Radar eixos={radar} />
          </Card>
        </div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div className="eyebrow">{rotuloDe(periodo)}</div>
            <h2 className="h-sec">Mapa de posições</h2>
          <span className="micro muted">▲ dominou · ▼ sofreu</span>
        </div>
        <div className="scroll-x"><MatrizPosicoes dados={escada} /></div>
      </Card>

      <div className="split" style={{ marginBottom: 14 }}>
        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">{rotuloDe(periodo)}</div>
              <h2 className="h-sec">Evolução</h2>
            </div>
          </div>
          <GraficoEvolucao sessions={porModo} rolls={rolasModo} partners={partners} gradings={gradings} periodo={periodo} />
        </Card>

        <Card>
          <div className="card-head"><h2 className="h-sec">Contra cada faixa</h2></div>
          {porFaixaParceiro.length === 0 ? (
            <p className="tiny muted">Cadastre parceiros e vincule nos rolas.</p>
          ) : (
            <div className="col" style={{ gap: 12 }}>
              {porFaixaParceiro.map(([faixa, o]) => (
                <div key={faixa} className="col" style={{ gap: 5 }}>
                  <div className="row tiny">
                    <span style={{ flex: 1, textTransform: 'capitalize' }}>{faixa}</span>
                    <span className="num micro" style={{ color: 'var(--jade)' }}>+{o.fin}</span>
                    <span className="num micro" style={{ color: 'var(--blood)' }}>−{o.tap}</span>
                    <span className="num micro muted">{o.rolas} rolas</span>
                  </div>
                  <Bar v={o.fin} max={Math.max(1, o.fin + o.tap)} tone="jade" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="split" style={{ marginBottom: 14 }}>
        <Card>
          <div className="card-head"><h2 className="h-sec">Suas finalizações</h2><Chip tone="jade">{r.finalizacoes}</Chip></div>
          <BarrasTop dados={r.topAplicadas} tone="jade" />
        </Card>
        <Card>
          <div className="card-head"><h2 className="h-sec">O que te pega</h2><Chip tone="blood">{r.taps}</Chip></div>
          <BarrasTop dados={r.topSofridas} tone="blood" />
        </Card>
      </div>


    </div>
  );
}
