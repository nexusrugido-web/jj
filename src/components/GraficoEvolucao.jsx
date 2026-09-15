import React, { useMemo, useState, useRef } from 'react';
import { Medal, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import {
  PERIODOS, METRICAS, serieDoPeriodo, totaisComparados,
  contextoDaVitoria, marcadoresGraduacao, faixaDoNivel,
} from '../lib/periodo';
import { fmtData } from '../lib/utils';

/* Mais largo que alto: o eixo do tempo precisa de espaço
   horizontal, e gráfico quadrado espreme meses inteiros num
   palmo de tela. */
const W = 960;
const H = 250;
const PAD = { l: 38, r: 16, t: 22, b: 34 };

/* curva monotônica cúbica, suave sem inventar picos que não existem */
function curva(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  const n = pts.length;
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    dy.push(pts[i + 1][1] - pts[i][1]);
    m.push(dy[i] / (dx[i] || 1));
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t.push(0);
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      t.push((w1 + w2) / (w1 / m[i - 1] + w2 / m[i]));
    }
  }
  t.push(m[n - 2]);

  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

export default function GraficoEvolucao({
  sessions, rolls, partners, gradings = [],
  periodoInicial = '6m', metricaInicial = 'vitorias',
  compacto = false,
  periodo: periodoFora = null,
  modo = 'auto',
}) {
  const [periodoLocal, setPeriodoLocal] = useState(periodoInicial);
  const controlado = periodoFora !== null;
  const periodo = controlado ? periodoFora : periodoLocal;
  const setPeriodo = setPeriodoLocal;
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
  /* quem passa modo="linha" manda mais que a métrica: existe
     tela em que a linha lê melhor que o bloco */
  const soLinha = modo === 'linha';
  const empilhado = soLinha ? false : !!metrica.empilhado;
  const divergente = soLinha ? false : !!metrica.divergente;

  const positivas = divergente ? chaves.filter((c) => c.k !== 'derrotas') : chaves;
  const max = Math.max(
    1,
    ...serie.map((s) => (empilhado
      ? positivas.reduce((a, c) => a + (s[c.k] || 0), 0)
      : Math.max(0, ...positivas.map((c) => s[c.k] || 0))))
  );
  const maxNeg = divergente && !ocultas.includes('derrotas')
    ? Math.max(0, ...serie.map((s) => s.derrotas || 0)) : 0;

  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const zeroY = maxNeg > 0 ? PAD.t + ih * (max / (max + maxNeg)) : PAD.t + ih;
  const escPos = (zeroY - PAD.t) / max;
  const escNeg = maxNeg > 0 ? (PAD.t + ih - zeroY) / maxNeg : 0;

  const n = serie.length;
  const passoX = iw / Math.max(1, n);
  const x = (i) => PAD.l + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const larguraBarra = Math.max(3, Math.min(22, passoX * 0.58));

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
    const i = Math.round(((cx - PAD.l) / iw) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  };

  const uid = `${metrica.id}-${periodo}`;

  return (
    <div className="col graf-bloco" style={{ gap: 14 }}>
      {!controlado && (
        <div className="seletor-pill">
          {PERIODOS.map((p) => (
            <button key={p.id} className={periodo === p.id ? 'on' : ''} onClick={() => setPeriodo(p.id)}>
              {p.nome}
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
        <div className="graf-wrap anima-troca" key={`${periodo}-${metricaId}`}>
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
              {metrica.chaves.map((c, i) => (
                <linearGradient key={c.k} id={`ar-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.cor} stopOpacity="0.42" />
                  <stop offset="55%" stopColor={c.cor} stopOpacity="0.13" />
                  <stop offset="100%" stopColor={c.cor} stopOpacity="0" />
                </linearGradient>
              ))}
              {metrica.chaves.map((c, i) => (
                <linearGradient key={'b' + c.k} id={`bar-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.cor} stopOpacity="1" />
                  <stop offset="100%" stopColor={c.cor} stopOpacity="0.5" />
                </linearGradient>
              ))}
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
                  {(f === 0 || f === 0.5 || f === 1) && (
                    <text x={PAD.l - 8} y={y + 3.5} textAnchor="end" fontSize="9.5" fontFamily="var(--mono)" fill="var(--dimmer)">
                      {Math.round(max * (1 - f))}
                    </text>
                  )}
                </g>
              );
            })}
            {maxNeg > 0 && (
              <text x={PAD.l - 8} y={PAD.t + ih + 3.5} textAnchor="end" fontSize="9.5" fontFamily="var(--mono)" fill="var(--blood)" opacity="0.8">
                {maxNeg}
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

            {(empilhado || divergente) ? (
              serie.map((s, i) => {
                let acc = 0;
                const ativo = hover === null || hover === i;
                return (
                  <g key={i} opacity={ativo ? 1 : 0.35} style={{ transition: 'opacity .18s' }}>
                    {positivas.map((c) => {
                      const v = s[c.k] || 0;
                      if (!v) return null;
                      const alt = v * escPos;
                      const y = zeroY - acc - alt;
                      acc += alt;
                      const idx = metrica.chaves.indexOf(c);
                      return (
                        <rect
                          key={c.k}
                          x={x(i) - larguraBarra / 2} y={y}
                          width={larguraBarra} height={Math.max(2, alt)}
                          fill={`url(#bar-${uid}-${idx})`} rx={Math.min(4, larguraBarra / 3)}
                          className="graf-barra" style={{ animationDelay: `${i * 20}ms` }}
                        />
                      );
                    })}
                    {!ocultas.includes('derrotas') && (s.derrotas || 0) > 0 && (
                      <rect
                        x={x(i) - larguraBarra / 2} y={zeroY}
                        width={larguraBarra} height={Math.max(2, (s.derrotas || 0) * escNeg)}
                        fill="var(--blood)" opacity="0.7" rx={Math.min(4, larguraBarra / 3)}
                        className="graf-barra" style={{ animationDelay: `${i * 20}ms` }}
                      />
                    )}
                  </g>
                );
              })
            ) : (
              chaves.map((c) => {
                const idx = metrica.chaves.indexOf(c);
                const pts = serie.map((s, i) => [x(i), zeroY - (s[c.k] || 0) * escPos]);
                const d = curva(pts);
                const area = `${d} L${pts[pts.length - 1][0]},${zeroY} L${pts[0][0]},${zeroY} Z`;
                return (
                  <g key={c.k}>
                    <path d={area} fill={`url(#ar-${uid}-${idx})`} className="graf-area" />
                    <path
                      d={d} fill="none" stroke={c.cor} strokeWidth="2.6"
                      strokeLinecap="round" strokeLinejoin="round"
                      filter={`url(#glow-${uid})`} opacity="0.5"
                    />
                    <path
                      d={d} fill="none" stroke={c.cor} strokeWidth="2.4"
                      strokeLinecap="round" strokeLinejoin="round"
                      className="graf-linha"
                    />
                    {hover !== null && pts[hover] && (
                      <>
                        <circle cx={pts[hover][0]} cy={pts[hover][1]} r="8" fill={c.cor} opacity="0.18" />
                        <circle cx={pts[hover][0]} cy={pts[hover][1]} r="4.5" fill="var(--mat)" stroke={c.cor} strokeWidth="2.5" />
                      </>
                    )}
                  </g>
                );
              })
            )}

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
            O eixo de baixo é o tempo. O de lado conta {metrica.eixoY}. Toque no gráfico pra ver o valor de cada ponto.
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
  const p = PERIODOS.find((x) => x.id === periodo);
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
      <p className="micro muted">Comparado com {p && p.nome === 'Tudo' ? 'o ano anterior' : `os ${p ? p.nome : ''} anteriores`}.</p>
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
