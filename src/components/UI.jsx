import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { X, Check, AlertTriangle, Minus, Plus, Search, CalendarDays } from 'lucide-react';
import { hoje, addDias, fmtData } from '../lib/utils';
import { FAIXAS } from '../db/seed';
import Sheet from './Sheet';

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [lista, setLista] = useState([]);
  const push = useCallback((texto, tipo = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setLista((l) => [...l, { id, texto, tipo }]);
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {lista.map((t) => (
          <div key={t.id} className={`toast ${t.tipo}`}>
            {t.tipo === 'err' ? <AlertTriangle size={15} /> : <Check size={15} />}
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Primitivos ---------------- */
export const Card = ({ children, className = '', ...p }) => (
  <div className={`card ${className}`} {...p}>{children}</div>
);

export function Btn({ children, variant = '', size = '', icon: Icon, className = '', ...p }) {
  return (
    <button className={`btn ${variant} ${size} ${className}`} {...p}>
      {Icon && <Icon size={size === 'xs' ? 13 : 15} />}
      {children}
    </button>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="micro muted">{hint}</span>}
    </label>
  );
}

export const Input = (p) => <input className={`input ${p.type === 'number' ? 'num-in' : ''}`} {...p} />;

/* ============================================================
   CAMPO DE NÚMERO QUE DEIXA APAGAR

   Com o valor preso ao número, apagar o conteúdo virava 0 na
   hora, e o zero ficava grudado no que a pessoa digitava depois:
   quem queria 60 acabava com "060". Aqui o texto é local
   enquanto o campo está em uso, e só o número sai pra fora.
   ============================================================ */
export function NumeroInput({ valor, onChange, vazio = 0, ...p }) {
  const [texto, setTexto] = React.useState(valor == null ? '' : String(valor));
  const digitando = React.useRef(false);

  React.useEffect(() => {
    if (!digitando.current) setTexto(valor == null ? '' : String(valor));
  }, [valor]);

  return (
    <Input
      type="number"
      inputMode="numeric"
      value={texto}
      onFocus={() => { digitando.current = true; }}
      onBlur={() => {
        digitando.current = false;
        if (texto === '') { setTexto(String(vazio)); onChange(vazio); }
        else setTexto(String(Number(texto)));
      }}
      onChange={(e) => {
        const t = e.target.value;
        setTexto(t);
        onChange(t === '' ? vazio : Number(t));
      }}
      {...p}
    />
  );
}
export const Textarea = (p) => <textarea className="textarea" {...p} />;
export const Select = ({ children, ...p }) => <select className="select" {...p}>{children}</select>;

export function Switch({ on, onChange, label }) {
  return (
    <button type="button" className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on}>
      <span className="switch-track" />
      {label && <span className="tiny">{label}</span>}
    </button>
  );
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          className={value === o.id ? 'on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.nome}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix = '' }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} aria-label="Diminuir">
        <Minus size={15} />
      </button>
      <span className="stepper-val">{value}{suffix}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} aria-label="Aumentar">
        <Plus size={15} />
      </button>
    </div>
  );
}

export function Busca({ value, onChange, placeholder = 'Buscar…' }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
      <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--dimmer)' }} />
      <input
        className="input"
        style={{ paddingLeft: 34 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function Chip({ children, on, onClick, tone = '', ...p }) {
  const C = onClick ? 'button' : 'span';
  return (
    <C className={`chip ${on ? 'on' : ''} ${tone}`} onClick={onClick} type={onClick ? 'button' : undefined} {...p}>
      {children}
    </C>
  );
}

export function Stat({ valor, label, sub, icon: Icon, tone, size }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
      {Icon && <span className="stat-ico" style={tone ? { color: `var(--${tone})`, background: `color-mix(in srgb, var(--${tone}) 14%, transparent)` } : undefined}><Icon size={16} /></span>}
      <div className="stat">
        <span className={`stat-val num ${size === 'sm' ? 'sm' : ''}`} style={tone ? { color: `var(--${tone})` } : undefined}>{valor}</span>
        <span className="stat-lab">{label}</span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

export function Bar({ v, max = 100, tone = '' }) {
  return (
    <div className={`bar ${tone}`}>
      <i style={{ width: `${Math.min(100, max ? (v / max) * 100 : 0)}%` }} />
    </div>
  );
}

export function BeltTag({ faixa, graus = 0, children }) {
  const f = FAIXAS.find((x) => x.id === faixa) || FAIXAS[0];
  return (
    <span className="belt-tag">
      <span className="belt-bar" style={{ background: f.cor, border: faixa === 'preta' ? '1px solid #4a5250' : 'none' }} />
      {children || f.nome}
      {graus > 0 && <span className="num micro muted">{'|'.repeat(graus)}</span>}
    </span>
  );
}

export function Empty({ icon: Icon, titulo, texto, acao }) {
  return (
    <div className="empty">
      {Icon && <span className="empty-ico"><Icon size={22} /></span>}
      <div>
        <div style={{ fontWeight: 600, color: 'var(--chalk)' }}>{titulo}</div>
        {texto && <div className="tiny" style={{ marginTop: 4, maxWidth: 380 }}>{texto}</div>}
      </div>
      {acao}
    </div>
  );
}

/* ---------------- Modal / Confirmar (agora vêm do Sheet) ---------------- */
export { Sheet };
export { Modal, ConfirmarSheet as Confirmar } from './Sheet';

/* ---------------- Contador animado ---------------- */
export function Contador({ valor, dur = 900, suffix = '' }) {
  const [n, setN] = useState(0);
  const alvo = Number(valor) || 0;
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(alvo); return; }
    let raf;
    const t0 = performance.now();
    const de = 0;
    const tick = (t) => {
      /* o relógio do quadro pode vir uns ms antes do t0: sem o 0, o número nascia negativo */
      const p = Math.min(1, Math.max(0, (t - t0) / dur));
      const e = 1 - Math.pow(1 - p, 3);
      setN(Math.round(de + (alvo - de) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [alvo, dur]);
  return <>{n.toLocaleString('pt-BR')}{suffix}</>;
}

/* ============================================================
   QUANDO FOI

   Quase todo registro é de hoje ou de ontem. Um campo de data
   obriga a pessoa a abrir o calendário do sistema e confirmar o
   óbvio. Aqui o botão já diz "Hoje", e quem registra depois
   escolhe na folha, inclusive outro dia qualquer.
   ============================================================ */
const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaDaSemana = (iso) => DIAS_DA_SEMANA[new Date(`${iso}T00:00:00`).getDay()];

export function EscolherData({ valor, onChange, titulo = 'Quando foi', futuro = false }) {
  const [aberto, setAberto] = useState(false);
  const atalhos = [
    { data: hoje(), nome: 'Hoje' },
    { data: addDias(hoje(), -1), nome: 'Ontem' },
    { data: addDias(hoje(), -2), nome: 'Anteontem' },
  ];
  const atalho = atalhos.find((a) => a.data === valor);

  return (
    <>
      <button type="button" className="input" onClick={() => setAberto(true)} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <CalendarDays size={14} className="muted" />
        {atalho ? atalho.nome : `${diaDaSemana(valor)}, ${fmtData(valor)}`}
      </button>

      <Sheet aberto={aberto} onClose={() => setAberto(false)} titulo={titulo}>
        <div className="col" style={{ gap: 9 }}>
          {atalhos.map((a) => (
            <button
              key={a.data} type="button"
              className={`opcao-meta ${valor === a.data ? 'on' : ''}`}
              onClick={() => { onChange(a.data); setAberto(false); }}
            >
              <div className="tiny" style={{ fontWeight: 600 }}>{a.nome}</div>
              <div className="micro muted" style={{ marginTop: 2 }}>{diaDaSemana(a.data)}, {fmtData(a.data)}</div>
            </button>
          ))}
        </div>
        <Field label="Outro dia">
          <Input
            type="date" value={valor} max={futuro ? undefined : hoje()}
            onChange={(e) => { if (e.target.value) { onChange(e.target.value); setAberto(false); } }}
          />
        </Field>
      </Sheet>
    </>
  );
}

/* ---------------- Editor de lista genérico (flexibilidade) ---------------- */
export function TagsInput({ valor = [], onChange, sugestoes = [], placeholder = 'Adicionar…' }) {
  const [txt, setTxt] = useState('');
  const add = (v) => {
    const s = String(v).trim();
    if (!s || valor.includes(s)) return;
    onChange([...valor, s]);
    setTxt('');
  };
  const sug = sugestoes.filter((s) => !valor.includes(s) && s.toLowerCase().includes(txt.toLowerCase())).slice(0, 6);
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row wrap" style={{ gap: 6 }}>
        {valor.map((t) => (
          <button key={t} type="button" className="chip on" onClick={() => onChange(valor.filter((x) => x !== t))}>
            {t} <X size={11} />
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 7 }}>
        <input
          className="input" value={txt} placeholder={placeholder}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(txt); } }}
        />
        <button type="button" className="btn icon" onClick={() => add(txt)} disabled={!txt.trim()} aria-label="Adicionar">
          <Plus size={16} />
        </button>
      </div>
      {txt && sug.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {sug.map((s) => <button key={s} type="button" className="chip" onClick={() => add(s)}>+ {s}</button>)}
        </div>
      )}
    </div>
  );
}

/* ---------------- Finalizações de um rola ----------------
   Aceita a MESMA finalização várias vezes na mesma rola.
   Guardado como lista simples (["Triângulo","Triângulo","Kimura"])
   e mostrado agrupado com contador. */
export function SubsInput({ valor = [], onChange, sugestoes = [], rapidas = [], tone = 'jade', placeholder = 'Ex.: Triângulo' }) {
  const [txt, setTxt] = useState('');

  const grupos = useMemo(() => {
    const m = new Map();
    for (const v of valor) m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()];
  }, [valor]);

  const add = (v) => {
    const s = String(v).trim();
    if (!s) return;
    onChange([...valor, s]);
    setTxt('');
  };
  const remover = (nome) => {
    const i = valor.lastIndexOf(nome);
    if (i < 0) return;
    const novo = [...valor];
    novo.splice(i, 1);
    onChange(novo);
  };

  const sug = sugestoes
    .filter((s) => s.toLowerCase().includes(txt.toLowerCase()))
    .slice(0, 6);

  const atalhos = (rapidas.length ? rapidas : sugestoes.slice(0, 6)).slice(0, 8);

  return (
    <div className="col" style={{ gap: 9 }}>
      {grupos.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {grupos.map(([nome, n]) => (
            <span key={nome} className={`chip ${tone}`} style={{ paddingRight: 4 }}>
              {nome}
              {n > 1 && <b className="num" style={{ marginLeft: 3 }}>×{n}</b>}
              <button type="button" className="chip-mais" onClick={() => add(nome)} aria-label={`Mais um ${nome}`}>
                <Plus size={11} />
              </button>
              <button type="button" className="chip-menos" onClick={() => remover(nome)} aria-label={`Remover um ${nome}`}>
                <Minus size={11} />
              </button>
            </span>
          ))}
          <span className="chip" style={{ opacity: 0.7 }}>total {valor.length}</span>
        </div>
      )}

      <div className="row" style={{ gap: 7 }}>
        <input
          className="input" value={txt} placeholder={placeholder}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(txt); } }}
        />
        <button type="button" className="btn icon primary" onClick={() => add(txt)} disabled={!txt.trim()} aria-label="Adicionar">
          <Plus size={16} />
        </button>
      </div>

      {txt ? (
        sug.length > 0 && (
          <div className="chips-scroll">
            {sug.map((s) => <button key={s} type="button" className="chip" onClick={() => add(s)}>+ {s}</button>)}
          </div>
        )
      ) : atalhos.length > 0 && (
        <div className="chips-scroll">
          {atalhos.map((s) => <button key={s} type="button" className="chip" onClick={() => add(s)}>+ {s}</button>)}
        </div>
      )}
    </div>
  );
}

/* ---------------- Contador de pontos IBJJF ----------------
   Toca pra marcar, toca no + pra somar. O total sai sozinho. */
export function PontosInput({ valor = [], onChange, catalogo = [], tone = 'jade', nomes = {}, onNomear }) {
  const conta = useMemo(() => {
    const m = {};
    for (const id of valor) m[id] = (m[id] || 0) + 1;
    return m;
  }, [valor]);

  const add = (id) => onChange([...valor, id]);
  const tirar = (id) => {
    const i = valor.lastIndexOf(id);
    if (i < 0) return;
    const n = [...valor];
    n.splice(i, 1);
    onChange(n);
  };

  return (
    <div className="pts-grade">
      {catalogo.map((p) => {
        const n = conta[p.id] || 0;
        const ativo = n > 0;
        const marcadas = nomes[p.id] || [];
        return (
          <div key={p.id} className={`pts-item ${ativo ? tone : ''}`}>
            <button type="button" className="pts-toque" onClick={() => add(p.id)}>
              <span className="pts-nome">{p.nome}</span>
              <span className="pts-valor num">{p.pts}pt</span>
            </button>
            {ativo && (
              <>
                <div className="pts-ctrl">
                  <button type="button" onClick={() => tirar(p.id)} aria-label="Menos um"><Minus size={12} /></button>
                  <span className="num pts-n">{n}</span>
                  <button type="button" onClick={() => add(p.id)} aria-label="Mais um"><Plus size={12} /></button>
                </div>
                {onNomear && (
                  <button type="button" className="pts-nomear" onClick={() => onNomear(p)}>
                    {marcadas.length
                      ? marcadas.join(', ')
                      : <span className="muted">qual foi? <span style={{ opacity: .6 }}>(opcional)</span></span>}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Escolha em chips grandes, um por linha em telas pequenas */
export function EscolhaChips({ valor, onChange, opcoes, permiteLimpar = true }) {
  return (
    <div className="row wrap" style={{ gap: 7 }}>
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip ${valor === o.id ? 'on' : ''}`}
          style={{ minHeight: 38, paddingInline: 13 }}
          onClick={() => onChange(permiteLimpar && valor === o.id ? null : o.id)}
        >
          {o.icone ? <span className="num" style={{ opacity: 0.7 }}>{o.icone}</span> : null}
          {o.nome}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   PARCEIRO RÁPIDO

   Antes você precisava cadastrar academia, depois professor,
   depois parceiro, e só então registrar o rola. Isso derrubava
   gente no primeiro uso. Agora escreve o nome e segue.
   ============================================================ */
export function ParceiroRapido({ valor, partners = [], onEscolher }) {
  const [criando, setCriando] = React.useState(false);
  const [nome, setNome] = React.useState('');
  const [faixa, setFaixa] = React.useState('branca');
  const [salvando, setSalvando] = React.useState(false);
  const toast = useToast();

  async function criar() {
    const n = nome.trim();
    if (!n) return;
    setSalvando(true);
    try {
      const { db } = await import('../db/db');
      const existe = partners.find((p) => p.nome.toLowerCase() === n.toLowerCase());
      const id = existe ? existe.id : await db.partners.add({
        nome: n, faixa, graus: 0, academiaId: null, pesoKg: null,
        notas: '', criadoEm: Date.now(),
      });
      onEscolher(Number(id));
      setCriando(false); setNome(''); setFaixa('branca');
      if (!existe) toast(`${n} adicionado`);
    } finally {
      setSalvando(false);
    }
  }

  if (criando) {
    return (
      <div className="col" style={{ gap: 9 }}>
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome ou apelido"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); criar(); } }}
        />
        <div className="row wrap" style={{ gap: 6 }}>
          {['branca', 'azul', 'roxa', 'marrom', 'preta'].map((f) => (
            <button
              key={f} type="button"
              className={`chip ${faixa === f ? 'on' : ''}`}
              style={{ minHeight: 36, textTransform: 'capitalize' }}
              onClick={() => setFaixa(f)}
            >{f}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Btn size="sm" variant="primary" onClick={criar} disabled={!nome.trim() || salvando}>
            Adicionar
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => { setCriando(false); setNome(''); }}>
            Cancelar
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      {partners.length > 0 && (
        <Select
          value={valor || ''}
          onChange={(e) => onEscolher(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Escolher parceiro</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.nome} ({p.faixa})</option>
          ))}
        </Select>
      )}
      <button type="button" className="btn ghost sm" onClick={() => setCriando(true)} style={{ alignSelf: 'flex-start' }}>
        <Plus size={13} /> {partners.length ? 'Novo parceiro' : 'Adicionar quem rolou com você'}
      </button>
    </div>
  );
}
