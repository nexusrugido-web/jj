import React, { useMemo, useState, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import {
  PRESETS, periodoDeDados, primeiroTreino, METRICAS, serieDoPeriodo, totaisComparados,
  contextoDaVitoria, marcadoresGraduacao, faixaDoNivel, barrasDoGrafico,
} from '../lib/periodo';
import { fmtData } from '../lib/utils';

/* Mais largo que alto: o eixo do tempo precisa de espaço
   horizontal, e gráfico quadrado espreme meses inteiros num
   palmo de tela. */
const W = 960;
const H = 250;
const PAD = { l: 38, r: 16, t: 22, b: 34 };

export default function GraficoEvolucao({
  sessions, rolls, partners, gradings = [],
  periodoInicial = '6m', metricaInicial = 'vitorias',
  compacto = false,
  periodo: periodoFora = null,   // o objeto de periodoDeDados; quando a página manda, o seletor some
}) {
  const [periodoLocal, setPeriodoLocal] = useState(periodoInicial);
  const controlado = periodoFora !== null;
  const periodo = useMemo(
    () => periodoFora || periodoDeDados(periodoLocal, { desde: primeiroTreino(sessions) }),
    [periodoFora, periodoLocal, sessions]
  );
  const [metricaId, setMetricaId] = useState(metricaInicial);
  const [ocultas, setOcultas] = useState([]);
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const metrica = METRICAS.find((m) => m.id === metricaId) || METRICAS[0];
  const { serie, grao } = useMemo(
    () => serieDoPeriodo(sessions, rolls, partners, periodo),
    [sessions, rolls, partners, periodo]
  );
  const marcas = useMemo(() => marcadoresGraduacao(gradings, serie), [gradings, serie]);

  const chaves = metrica.chaves.filter((c) => !ocultas.includes(c.k));
  /* espelho (ganhou e perdeu, finalizações, pontos): um lado sobe da
     linha do meio, o outro desce. Empilhado (como venceu, como
     perdeu): as partes do mesmo todo numa barra só. */
  const divergente = !!metrica.divergente;
  const empilhado = !!metrica.empilhado;
  const desce = (c) => divergente && !!c.desce;
  /* no empilhado, onde cada parte começa: o que as de antes já somaram */
  const baseDe = (c, i) => (empilhado ? chaves.slice(0, chaves.indexOf(c)).reduce((a, y) => a + (serie[i][y.k] || 0), 0) : 0);
  const emCima = (c, i) => !empilhado || chaves.slice(chaves.indexOf(c) + 1).every((y) => !(serie[i][y.k] > 0));

  const n = serie.length;
  const topoDe = (c) => Math.max(0, ...serie.map((s) => s[c.k] || 0));
  const topoEmpilhado = Math.max(0, ...serie.map((s) => chaves.reduce((a, c) => a + (s[c.k] || 0), 0)));

  const max = Math.max(1, ...(empilhado ? [topoEmpilhado] : chaves.filter((c) => !desce(c)).map(topoDe)));
  const maxNeg = Math.max(0, ...chaves.filter(desce).map(topoDe));

  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const zeroY = maxNeg > 0 ? PAD.t + ih * (max / (max + maxNeg)) : PAD.t + ih;
  const escPos = (zeroY - PAD.t) / max;
  const escNeg = maxNeg > 0 ? (PAD.t + ih - zeroY) / maxNeg : 0;

  /* cada balde tem a sua faixa do eixo, e as barras dele ficam no
     meio dela, lado a lado. No espelho (ganhou e perdeu) as duas
     ficam no mesmo lugar, uma subindo e outra descendo. */
  const faixa = iw / Math.max(1, n);
  const x = (i) => PAD.l + (i + 0.5) * faixa;
  const yDe = (c, v) => (desce(c) ? zeroY + v * escNeg : zeroY - v * escPos);
  const lado = divergente || empilhado ? 1 : Math.max(1, chaves.length);
  const grupo = Math.min(faixa * 0.74, 34 * lado);
  const larg = Math.max(2, grupo / lado - (lado > 1 ? 3 : 0));
  const barras = barrasDoGrafico(serie, chaves.map((c) => c.k));

  const totais = useMemo(
    () => totaisComparados(sessions, rolls, partners, periodo),
    [sessions, rolls, partners, periodo]
  );
  const contexto = useMemo(() => contextoDaVitoria(totais.atual, totais.anterior), [totais]);
  const semDados = serie.every((s) => s.rolas === 0 && s.sessoes === 0);

  const posDoEvento = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const cliente = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const cx = ((cliente - r.left) / r.width) * W;
    const i = Math.floor((cx - PAD.l) / faixa);
    return Math.max(0, Math.min(n - 1, i));
  };

  const uid = `${metrica.id}-${periodo.id}`;

  return (
    <div className="col graf-bloco" style={{ gap: 14 }}>
      {!controlado && (
        <div className="seletor-pill">
          {PRESETS.map((id) => periodoDeDados(id)).map((p) => (
            <button key={p.id} className={periodo.id === p.id ? 'on' : ''} onClick={() => setPeriodoLocal(p.id)}>
              {p.rotuloCurto}
            </button>
          ))}
        </div>
      )}

      {!compacto && (
        <div className="chips-scroll">
          {METRICAS.map((m) => (
            <button key={m.id} className={`chip ${metricaId === m.id ? 'on' : ''}`} onClick={() => { setMetricaId(m.id); setOcultas([]); }}>
              {m.nome}
            </button>
          ))}
        </div>
      )}

      {!semDados && (
        <div className="graf-topo">
          <div>
            <div className="eyebrow">{metrica.pergunta}</div>
            <div className="row" style={{ gap: 14, marginTop: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
              {metrica.chaves.map((c) => {
                const total = serie.reduce((a, s) => a + (s[c.k] || 0), 0);
                return (
                  <div key={c.k} className="graf-total">
                    <span className="graf-total-num num" style={{ color: c.cor }}>
                      {Number.isInteger(total) ? total : total.toFixed(1)}
                    </span>
                    <span className="graf-total-lab">{c.nome}</span>
                  </div>
                );
              })}
              {(metrica.extras || []).map((c) => {
                const total = serie.reduce((a, s) => a + (s[c.k] || 0), 0);
                return (
                  <div key={c.k} className="graf-total">
                    <span className="graf-total-num num" style={{ color: 'var(--chalk)' }}>
                      {Number.isInteger(total) ? total : total.toFixed(1)}{c.sufixo}
                    </span>
                    <span className="graf-total-lab">{c.nome}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {!compacto && <p className="micro muted">{metrica.desc}</p>}

      {semDados ? (
        <div className="center" style={{ padding: '40px 0' }}>
          <p className="tiny muted">Sem treino registrado neste período.</p>
        </div>
      ) : (
        <div className="graf-wrap anima-troca" key={`${periodo.id}-${metricaId}`}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            preserveAspectRatio="none"
            style={{ display: 'block', width: '100%', height: compacto ? 168 : 216, touchAction: 'pan-y' }}
            onMouseMove={(e) => setHover(posDoEvento(e))}
            onMouseLeave={() => setHover(null)}
            onTouchStart={(e) => setHover(posDoEvento(e))}
            onTouchMove={(e) => setHover(posDoEvento(e))}
          >
            <defs>
              {/* a barra é forte na ponta e vai sumindo em direção ao
                  zero, dos dois lados do espelho */}
              {metrica.chaves.map((c, i) => (
                <linearGradient
                  key={c.k} id={`barra-${uid}-${i}`}
                  x1="0" y1={desce(c) ? '1' : '0'} x2="0" y2={desce(c) ? '0' : '1'}
                >
                  <stop offset="0%" stopColor={c.cor} stopOpacity="1" />
                  {/* empilhada quase sólida: com degradê, cada pedaço parecia uma barra solta */}
                  <stop offset="100%" stopColor={c.cor} stopOpacity={empilhado ? 0.82 : 0.28} />
                </linearGradient>
              ))}
              {/* as barras aparecem da esquerda pra direita */}
              <clipPath id={`revela-${uid}`}>
                <rect x="0" y="0" width={W} height={H} className="graf-revela" />
              </clipPath>
              <filter id={`glow-${uid}`} x="-30%" y="-40%" width="160%" height="180%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const y = PAD.t + (zeroY - PAD.t) * f;
              const cheia = f === 1;
              return (
                <g key={f}>
                  <line
                    x1={PAD.l} x2={W - PAD.r} y1={y} y2={y}
                    stroke={cheia ? 'var(--seam-hi)' : 'var(--seam)'}
                    strokeWidth="1" strokeDasharray={cheia ? '' : '2 8'} opacity={cheia ? 0.9 : 0.5}
                  />
                  {/* com o topo em 1, o meio arredondaria pra 1 de novo */}
                  {(f === 0 || f === 1 || (f === 0.5 && max >= 2)) && (
                    <text x={PAD.l - 8} y={y + 3.5} textAnchor="end" fontSize="9.5" fontFamily="var(--mono)" fill="var(--dimmer)">
                      {Math.round(max * (1 - f))}
                    </text>
                  )}
                </g>
              );
            })}
            {maxNeg > 0 && (
              <text x={PAD.l - 8} y={PAD.t + ih + 3.5} textAnchor="end" fontSize="9.5" fontFamily="var(--mono)" fill="var(--blood)" opacity="0.8">
                {Math.round(maxNeg)}
              </text>
            )}

            {hover !== null && (
              <line
                x1={x(hover)} x2={x(hover)} y1={PAD.t - 8} y2={PAD.t + ih + 4}
                stroke="var(--chalk)" strokeWidth="1" opacity="0.22" strokeDasharray="3 4"
              />
            )}

            {marcas.map((m, i) => (
              <g key={i}>
                <line
                  x1={x(m.idx)} x2={x(m.idx)} y1={PAD.t - 4} y2={PAD.t + ih}
                  stroke="var(--jade)" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.55"
                />
                <circle cx={x(m.idx)} cy={PAD.t - 9} r="5" fill="var(--jade)" />
                <circle cx={x(m.idx)} cy={PAD.t - 9} r="9.5" fill="none" stroke="var(--jade)" strokeWidth="1" opacity="0.3" />
              </g>
            ))}

            <g clipPath={`url(#revela-${uid})`}>
              {barras.map(({ i, k, v }) => {
                const c = chaves.find((y) => y.k === k);
                const idx = metrica.chaves.indexOf(c);
                const j = divergente ? 0 : chaves.indexOf(c);
                const bx = x(i) - grupo / 2 + j * (grupo / lado) + (grupo / lado - larg) / 2;
                const base = baseDe(c, i);
                const y0 = yDe(c, base);
                const h = Math.max(base ? 0 : 3, Math.abs(yDe(c, base + v) - y0));
                /* só a ponta de longe do zero é arredondada, e no
                   empilhado só a de cima */
                const r = emCima(c, i) ? Math.min(larg / 2, 7, h) : 0;
                const d = desce(c)
                  ? `M${bx},${y0} L${bx},${y0 + h - r} Q${bx},${y0 + h} ${bx + r},${y0 + h} L${bx + larg - r},${y0 + h} Q${bx + larg},${y0 + h} ${bx + larg},${y0 + h - r} L${bx + larg},${y0} Z`
                  : `M${bx},${y0} L${bx},${y0 - h + r} Q${bx},${y0 - h} ${bx + r},${y0 - h} L${bx + larg - r},${y0 - h} Q${bx + larg},${y0 - h} ${bx + larg},${y0 - h + r} L${bx + larg},${y0} Z`;
                const apagada = hover !== null && hover !== i;
                return (
                  <g key={`${k}-${i}`} opacity={apagada ? 0.4 : 1} className="graf-barra">
                    <path d={d} fill={c.cor} filter={`url(#glow-${uid})`} opacity="0.3" />
                    <path d={d} fill={`url(#barra-${uid}-${idx})`} />
                  </g>
                );
              })}
            </g>

            {serie.map((s, i) => {
              const passo = Math.max(1, Math.ceil(n / (compacto ? 4 : 7)));
              if (i % passo !== 0 && i !== n - 1) return null;
              return (
                <text
                  key={i} x={x(i)} y={H - 10} textAnchor="middle"
                  fontSize="9.5" fontFamily="var(--mono)"
                  fill={hover === i ? 'var(--chalk)' : 'var(--dimmer)'}
                >
                  {s.label}
                </text>
              );
            })}
          </svg>

          {hover !== null && serie[hover] && (
            <div
              className="graf-tip"
              style={{ left: `${Math.min(86, Math.max(14, (x(hover) / W) * 100))}%`, top: 2 }}
            >
              <div className="graf-tip-titulo">
                {grao === 'dia' ? fmtData(serie[hover].ini)
                  : grao === 'semana' ? `semana de ${fmtData(serie[hover].ini, { curto: true })}`
                  : `${serie[hover].label} ${serie[hover].ano || ''}`}
              </div>
              {serie[hover].rolas === 0 && serie[hover].sessoes === 0 ? (
                <div className="tiny muted">Sem treino registrado</div>
              ) : (
                <>
                  {metrica.chaves.map((c) => (
                    <div key={c.k} className="graf-tip-linha">
                      <span className="graf-tip-cor" style={{ background: c.cor }} />
                      <span className="muted">{c.nome}</span>
                      <b className="num" style={{ marginLeft: 'auto' }}>{serie[hover][c.k] || 0}</b>
                    </div>
                  ))}
                  {(metrica.extras || []).map((c) => (
                    <div key={c.k} className="graf-tip-linha">
                      <span className="muted">{c.nome}</span>
                      <b className="num" style={{ marginLeft: 'auto' }}>{serie[hover][c.k] || 0}{c.sufixo}</b>
                    </div>
                  ))}
                  <div className="graf-tip-rodape">
                    {serie[hover].rolas} {serie[hover].rolas === 1 ? 'rola' : 'rolas'}
                    {serie[hover].nivelMedio !== null && `, média ${faixaDoNivel(serie[hover].nivelMedio)}`}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="col" style={{ gap: 8 }}>
        {metrica.chaves.map((c) => {
          const off = ocultas.includes(c.k);
          return (
            <button
              key={c.k}
              className={`graf-item ${off ? 'off' : ''}`}
              onClick={() => setOcultas(off ? ocultas.filter((y) => y !== c.k) : [...ocultas, c.k])}
            >
              <span className="graf-item-cor" style={{ background: c.cor }} />
              <span className="graf-item-nome">{c.nome}</span>
              {!compacto && <span className="graf-item-txt">{c.explica}</span>}
            </button>
          );
        })}
        {marcas.length > 0 && (
          <div className="graf-item" style={{ cursor: 'default' }}>
            <span className="graf-item-cor" style={{ background: 'var(--jade)' }} />
            <span className="graf-item-nome">Graduação</span>
            {!compacto && <span className="graf-item-txt">A linha tracejada marca o dia em que você ganhou grau ou faixa.</span>}
          </div>
        )}
        {!compacto && (
          <p className="micro muted" style={{ marginTop: 4 }}>
            O eixo de baixo é o tempo, o de lado conta {metrica.eixoY}. Cada barra é {{ dia: 'um dia', semana: 'uma semana', mes: 'um mês' }[grao] || 'um período'}
            de treino, e onde não tem barra você não treinou. Toque numa barra pra ver o número exato.
          </p>
        )}
      </div>

      {!compacto && (
        <>
          <div className="divider" />
          <ResumoComparado t={totais} periodo={periodo} />
          {contexto && (
            <div className={`valida ${contexto.tom === 'bom' ? 'bom' : 'atencao'}`}>
              <Sparkles size={15} className="valida-ico" style={{ color: `var(--${contexto.tom === 'bom' ? 'jade' : 'roar'})` }} />
              <div>
                <div className="tiny" style={{ fontWeight: 600 }}>{contexto.titulo}</div>
                <p className="micro muted" style={{ marginTop: 3 }}>{contexto.texto}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ResumoComparado({ t, periodo }) {
  const itens = [
    { k: 'rolas', nome: 'rolas', valor: t.atual.rolas },
    { k: 'horas', nome: 'horas', valor: `${t.atual.horas}h` },
    { k: 'sessoes', nome: 'treinos', valor: t.atual.sessoes },
    { k: 'tecnicasUnicas', nome: 'técnicas diferentes', valor: t.atual.tecnicasUnicas },
  ];

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12 }}>
        {itens.map((i) => (
          <div key={i.k} className="stat">
            <div className="row" style={{ gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span className="stat-val num sm">{i.valor}</span>
              <Variacao v={t.variacao[i.k]} />
            </div>
            <span className="stat-lab">{i.nome}</span>
          </div>
        ))}
      </div>
      <p className="micro muted">
        {!t.anterior ? 'Desde o primeiro treino, sem período anterior pra comparar.'
          : periodo.id === 'ano-atual' ? `Comparado com o mesmo trecho de ${Number(periodo.ini.slice(0, 4)) - 1}.`
            : `Comparado com os ${periodo.rotuloCurto} anteriores.`}
      </p>
    </div>
  );
}

export function Variacao({ v, sufixo = '%' }) {
  if (!v) return null;
  if (v.novo) return <span className="varia novo">novo</span>;
  if (v.pct === null || v.pct === 0) return <span className="varia igual"><Minus size={10} /> igual</span>;
  const sobe = v.pct > 0;
  return (
    <span className={`varia ${sobe ? 'sobe' : 'desce'}`}>
      {sobe ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {sobe ? '+' : ''}{v.pct}{sufixo === 'pp' ? 'pp' : '%'}
    </span>
  );
}
