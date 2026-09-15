import React, { useMemo, useState } from 'react';

/* ============================================================
   ESCADA POSICIONAL, o elemento assinatura.
   Cada degrau e uma posicao, ordenada pela hierarquia real do
   jiu-jitsu. Verde = tempo que voce dominou. Vermelho = tempo
   que voce sofreu. A linha d'agua separa cima de baixo.
   ============================================================ */
export function EscadaPosicional({ dados, compacto = false }) {
  const comDados = dados.filter((d) => d.dom + d.inf > 0);
  const linhas = compacto ? (comDados.length ? comDados.slice(0, 12) : dados.slice(0, 8)) : dados;
  if (!linhas.length) {
    return <p className="tiny muted center" style={{ padding: '24px 0' }}>Registre rolas marcando as posições pra escada ganhar vida.</p>;
  }
  let jaPassouAgua = false;
  return (
    <div className="ladder">
      {linhas.map((p) => {
        const inferior = p.familia === 'inferior';
        const agua = inferior && !jaPassouAgua;
        if (agua) jaPassouAgua = true;
        const tone = p.dom === 0 && p.inf === 0 ? 'neu' : p.dom >= p.inf ? 'dom' : 'inf';
        const valor = Math.max(p.dom, p.inf);
        const w = valor === 0 ? 0 : Math.max(4, (valor / (p.max || 1)) * 100);
        return (
          <React.Fragment key={p.id}>
            {agua && (
              <div className="waterline">
                <i /><span>linha d'água</span><i />
              </div>
            )}
            <div className={`rung ${tone}`} title={`${p.nome}, dominou ${p.dom}x, sofreu ${p.inf}x`}>
              <span className="rung-pts">{p.pts ? p.pts : '·'}</span>
              <span className="rung-mid">
                <span className="rung-name truncate">{p.nome}</span>
                <span className="rung-track">
                  <span className="rung-fill" style={{ width: `${w}%` }} />
                </span>
              </span>
              <span className="rung-val">
                {p.dom > 0 && <span style={{ color: 'var(--jade)' }}>+{p.dom}</span>}
                {p.dom > 0 && p.inf > 0 && <span className="muted"> </span>}
                {p.inf > 0 && <span style={{ color: 'var(--blood)' }}>−{p.inf}</span>}
                {p.dom === 0 && p.inf === 0 && <span style={{ color: 'var(--dimmer)' }}>,</span>}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---------------- Radar de habilidades ---------------- */
export function Radar({ eixos, size = 260 }) {
  const n = eixos.length;
  if (n < 3) return <p className="tiny muted center" style={{ padding: 24 }}>Precisa de pelo menos 3 categorias.</p>;

  /* área extra em volta pro texto caber sem cortar */
  const PAD = 62;
  const VB = size + PAD * 2;
  const cx = VB / 2;
  const cy = VB / 2;
  const r = size / 2 - 6;

  const ponto = (i, frac) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r * frac, cy + Math.sin(a) * r * frac];
  };

  const poly = eixos.map((e, i) => ponto(i, Math.max(0.04, e.valor / 100)).join(',')).join(' ');
  const anelPts = (f) => eixos.map((_, i) => ponto(i, f).join(',')).join(' ');

  /* quebra o nome em até duas linhas em vez de cortar com reticências */
  const linhas = (nome) => {
    if (nome.length <= 12) return [nome];
    const partes = nome.split(' ');
    if (partes.length === 1) return [nome];
    let a = '', b = '';
    for (const w of partes) {
      if ((a + ' ' + w).trim().length <= 12 && !b) a = (a + ' ' + w).trim();
      else b = (b + ' ' + w).trim();
    }
    return b ? [a, b] : [a];
  };

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      width="100%"
      style={{ maxWidth: VB, display: 'block', margin: '0 auto' }}
    >
      <defs>
        <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.10" />
        </radialGradient>
      </defs>

      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f} points={anelPts(f)} fill="none"
          stroke="var(--seam)" strokeWidth="1"
          opacity={f === 1 ? 0.9 : 0.5}
        />
      ))}
      {eixos.map((_, i) => {
        const [x, y] = ponto(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--seam)" strokeWidth="1" opacity="0.55" />;
      })}

      <polygon
        points={poly} fill="url(#radar-fill)"
        stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round"
        className="graf-area"
      />
      {eixos.map((e, i) => {
        const [x, y] = ponto(i, Math.max(0.04, e.valor / 100));
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="6" fill="var(--accent)" opacity="0.2" />
            <circle cx={x} cy={y} r="3.4" fill="var(--accent)" />
          </g>
        );
      })}

      {eixos.map((e, i) => {
        const [x, y] = ponto(i, 1.13);
        const ls = linhas(e.nome);
        const anchor = x < cx - 8 ? 'end' : x > cx + 8 ? 'start' : 'middle';
        const yBase = y - (ls.length - 1) * 6;
        return (
          <g key={i}>
            {ls.map((linha, k) => (
              <text
                key={k} x={x} y={yBase + k * 12}
                textAnchor={anchor} dominantBaseline="middle"
                fontSize="10.5" fontFamily="var(--mono)" fill="var(--dim)"
              >
                {linha}
              </text>
            ))}
            <text
              x={x} y={yBase + ls.length * 12}
              textAnchor={anchor} dominantBaseline="middle"
              fontSize="10" fontFamily="var(--mono)" fontWeight="700"
              fill={e.valor > 0 ? 'var(--accent)' : 'var(--dimmer)'}
            >
              {e.valor}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------- Linha / barras de evolução ---------------- */
export function Evolucao({ serie, chaves = [{ k: 'rolas', cor: 'var(--accent)', nome: 'Rolas' }], altura = 170 }) {
  const w = 560;
  const h = altura;
  const pad = { l: 30, r: 12, t: 14, b: 24 };
  const max = Math.max(1, ...serie.flatMap((s) => chaves.map((c) => s[c.k] || 0)));
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const x = (i) => pad.l + (serie.length > 1 ? (i / (serie.length - 1)) * iw : iw / 2);
  const y = (v) => pad.t + ih - (v / max) * ih;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={w - pad.r} y1={pad.t + ih * f} y2={pad.t + ih * f} stroke="var(--seam)" strokeWidth="1" strokeDasharray={f === 1 ? '' : '3 5'} />
          <text x={pad.l - 7} y={pad.t + ih * f + 3} textAnchor="end" fontSize="9" fontFamily="var(--mono)" fill="var(--dimmer)">
            {Math.round(max * (1 - f))}
          </text>
        </g>
      ))}
      {chaves.map((c) => {
        const d = serie.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(s[c.k] || 0)}`).join(' ');
        const area = `${d} L${x(serie.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`;
        return (
          <g key={c.k}>
            <path d={area} fill={c.cor} opacity="0.1" />
            <path d={d} fill="none" stroke={c.cor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ '--len': 1400 }} className="drawline" />
            {serie.map((s, i) => (
              <circle key={i} cx={x(i)} cy={y(s[c.k] || 0)} r="3" fill="var(--mat)" stroke={c.cor} strokeWidth="2" />
            ))}
          </g>
        );
      })}
      {serie.map((s, i) => (
        <text key={i} x={x(i)} y={h - 6} textAnchor="middle" fontSize="9.5" fontFamily="var(--mono)" fill="var(--dimmer)">
          {s.label}
        </text>
      ))}
    </svg>
  );
}

/* ---------------- Barras horizontais (top finalizações) ---------------- */
export function BarrasTop({ dados, tone = 'jade', vazio = 'Sem dados ainda.' }) {
  if (!dados.length) return <p className="tiny muted center" style={{ padding: '18px 0' }}>{vazio}</p>;
  const max = Math.max(...dados.map((d) => d[1]));
  return (
    <div className="col" style={{ gap: 9 }}>
      {dados.map(([nome, qtd]) => (
        <div key={nome} className="col" style={{ gap: 4 }}>
          <div className="row tiny">
            <span className="truncate" style={{ flex: 1 }}>{nome}</span>
            <span className="num micro" style={{ color: `var(--${tone})` }}>{qtd}</span>
          </div>
          <div className={`bar thin ${tone}`}><i style={{ width: `${(qtd / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Donut ---------------- */
export function Donut({ valor, max = 100, label, sub, size = 120, tone = 'accent' }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const frac = max ? Math.min(1, valor / max) : 0;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--seam)" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`var(--${tone})`} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="ring-mid">
        <div className="num" style={{ fontSize: size / 4.4, fontWeight: 700, letterSpacing: '-0.03em' }}>{label}</div>
        {sub && <div className="micro muted">{sub}</div>}
      </div>
    </div>
  );
}

/* ---------------- Mapa de calor por posição (grade) ---------------- */
export function MatrizPosicoes({ dados }) {
  const linhas = dados.filter((d) => d.dom + d.inf > 0);
  if (!linhas.length) return <p className="tiny muted center" style={{ padding: 24 }}>Marque posições nos rolas pra ver o mapa.</p>;
  const max = Math.max(...linhas.map((d) => Math.max(d.dom, d.inf)));
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))', gap: 8 }}>
      {linhas.map((p) => {
        const total = p.dom + p.inf;
        const saldo = p.dom - p.inf;
        const intens = Math.min(1, Math.max(p.dom, p.inf) / max);
        const cor = saldo > 0 ? 'var(--jade)' : saldo < 0 ? 'var(--blood)' : 'var(--dimmer)';
        return (
          <div
            key={p.id}
            className="card"
            style={{
              padding: 11,
              background: `color-mix(in srgb, ${cor} ${Math.round(intens * 22)}%, var(--mat))`,
              borderColor: `color-mix(in srgb, ${cor} ${Math.round(intens * 45)}%, var(--seam))`,
            }}
          >
            <div className="micro truncate" style={{ fontWeight: 600 }}>{p.nome}</div>
            <div className="row" style={{ marginTop: 6, gap: 8 }}>
              <span className="num micro" style={{ color: 'var(--jade)' }}>▲{p.dom}</span>
              <span className="num micro" style={{ color: 'var(--blood)' }}>▼{p.inf}</span>
              <span className="spacer" />
              <span className="num micro muted">{total}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
