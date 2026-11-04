import React, { useMemo, useState } from 'react';
import { Plus, Play, Copy, Pencil, Trash2, Route, ChevronRight, RotateCcw, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../contexto';
import { db } from '../db/db';
import {
  Card, Btn, Field, Input, Select, Sheet, Chip, Empty, Confirmar, useToast,
} from '../components/UI';
import { SeletorTecnica } from '../components/SeletorTecnica';
import { podeVer, pedirOferta } from '../lib/plano';
import {
  meusPlanos, planosProntos, podeCriarPlano, correnteDoPlano, copiaDoPronto, planoNovo, MAX_PASSOS, ALTURA_REL,
} from '../lib/planos';
import { FAIXAS } from '../lib/faixas';
import { PESO_REL } from '../db/scoring';

/* ============================================================
   PLANOS DE ATAQUE

   Da posição, a finta; ele reage; vem o golpe; se defender, o
   próximo. O grátis tem 1 plano seu (criado ou copiado de um
   pronto) e vê todos os prontos; o Premium não tem limite.
   ============================================================ */
export default function Planos() {
  const { positions = [], techniques = [], categories = [], settings, acesso } = useApp();
  const toast = useToast();
  const todos = useLiveQuery(() => db.attackPlans.toArray(), [], []) || [];
  const meus = useMemo(() => meusPlanos(todos), [todos]);
  const prontos = useMemo(() => planosProntos(todos), [todos]);
  const premium = podeVer(acesso, 'planos');

  const [edit, setEdit] = useState(null);
  const [assistindo, setAssistindo] = useState(null);
  const [apagar, setApagar] = useState(null);

  const liberado = () => {
    if (podeCriarPlano(todos, premium)) return true;
    pedirOferta('planos');
    return false;
  };

  async function copiar(p) {
    if (!liberado()) return;
    await db.attackPlans.add({ ...copiaDoPronto(p), criadoEm: Date.now() });
    toast('Copiado pros seus planos');
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Planos de ataque</h1>
          <p className="tiny muted" style={{ marginTop: 4 }}>Da posição, a finta. Ele reage, você encaixa. Se defender, o próximo.</p>
        </div>
        <Btn variant="primary" icon={Plus} onClick={() => liberado() && setEdit(rascunho())}>Criar plano</Btn>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h2 className="h-sec">Meus planos</h2>
          {!premium && <span className="micro muted">{meus.length} de 1 no grátis</span>}
        </div>
        {meus.length === 0 ? (
          <Empty
            icon={Route}
            titulo="Nenhum plano seu ainda"
            texto="Monte a sua corrente ou copie um dos prontos aqui embaixo e ajuste pro seu jogo."
          />
        ) : (
          <div className="col" style={{ gap: 10 }}>
            {meus.map((p) => (
              <CartaoPlano key={p.id} p={p} onAssistir={() => setAssistindo(p)}>
                <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => setEdit(paraEditar(p))}>Editar</Btn>
                <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => setApagar(p)} aria-label="Apagar" />
              </CartaoPlano>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="card-head">
          <h2 className="h-sec">Prontos</h2>
          <span className="micro muted">{prontos.length} planos</span>
        </div>
        <div className="col" style={{ gap: 10 }}>
          {prontos.map((p) => (
            <CartaoPlano key={p.id} p={p} onAssistir={() => setAssistindo(p)}>
              <Btn size="sm" variant="ghost" icon={Copy} onClick={() => copiar(p)}>Copiar pra mim</Btn>
            </CartaoPlano>
          ))}
        </div>
      </Card>

      <EditorPlano
        edit={edit} setEdit={setEdit}
        positions={positions} techniques={techniques} categories={categories} faixa={settings?.faixa}
        onSalvar={async (e) => {
          const pos = positions.find((x) => String(x.id) === String(e.posicaoId));
          const dados = planoNovo({ ...e, posicao: pos?.nome || e.posicao });
          if (!dados.passos.length) { toast('Escolha pelo menos um golpe', 'err'); return; }
          if (e.id) await db.attackPlans.update(e.id, dados);
          else await db.attackPlans.add({ ...dados, criadoEm: Date.now() });
          setEdit(null);
          toast('Plano salvo');
        }}
      />

      <AssistirPlano plano={assistindo} onClose={() => setAssistindo(null)} />

      <Confirmar
        aberto={!!apagar} onClose={() => setApagar(null)}
        titulo="Apagar o plano?" texto={apagar ? `"${apagar.nome}" sai dos seus planos.` : ''}
        onConfirmar={async () => { await db.attackPlans.update(apagar.id, { arquivada: 1 }); setApagar(null); }}
      />
    </div>
  );
}

const rascunho = () => ({ nome: '', posicaoId: '', posicao: '', finta: '', paraAltura: [], paraPeso: [], passos: [{ reacao: '', golpe: '' }] });
const paraEditar = (p) => ({
  id: p.id, nome: p.nome, posicaoId: p.posicaoId || '', posicao: p.posicao || '', finta: p.finta || '',
  paraAltura: p.paraAltura || [], paraPeso: p.paraPeso || [],
  passos: correnteDoPlano(p).passos.map((x) => ({ reacao: x.reacao, golpe: x.golpe })),
});

const alternar = (lista, id) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

/* o cartão: nome, posição e a corrente em miniatura */
function CartaoPlano({ p, onAssistir, children }) {
  const c = correnteDoPlano(p);
  const faixa = FAIXAS.find((f) => f.id === p.faixa);
  return (
    <div className="plano-cartao">
      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tiny" style={{ fontWeight: 700 }}>{p.nome}</div>
          <div className="micro muted" style={{ marginTop: 2 }}>
            {c.posicao || 'Sem posição'}{p.pronto && faixa ? ` · a partir da ${faixa.nome.toLowerCase()}` : ''}
          </div>
        </div>
        <Btn size="sm" variant="contorno" icon={Play} onClick={onAssistir}>Assistir</Btn>
      </div>
      <div className="plano-mini">
        {c.finta && <Chip tone="warn">finta: {c.finta}</Chip>}
        {c.passos.map((x, i) => (
          <React.Fragment key={i}>
            {(i > 0 || c.finta) && <ChevronRight size={13} className="muted" />}
            <Chip>{x.golpe}</Chip>
          </React.Fragment>
        ))}
      </div>
      {children && <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>{children}</div>}
    </div>
  );
}

/* ============================================================
   MONTAR A CORRENTE
   ============================================================ */
function EditorPlano({ edit, setEdit, positions, techniques, categories, faixa, onSalvar }) {
  /* qual campo o seletor de técnica preenche: 'finta' ou o índice do golpe */
  const [escolhendo, setEscolhendo] = useState(null);
  if (!edit) return null;
  const passos = edit.passos;
  const mudarPasso = (i, campo, v) => setEdit({ ...edit, passos: passos.map((x, k) => (k === i ? { ...x, [campo]: v } : x)) });

  return (
    <Sheet
      aberto={!!edit} onClose={() => setEdit(null)}
      titulo={edit.id ? 'Editar plano' : 'Novo plano'}
      footer={<Btn variant="primary" style={{ width: '100%' }} onClick={() => onSalvar(edit)}>Salvar plano</Btn>}
    >
      <Field label="Nome do plano">
        <Input value={edit.nome} placeholder="Ex.: finta da raspagem pra kimura" onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
      </Field>
      <Field label="De onde começa">
        <Select value={edit.posicaoId} onChange={(e) => setEdit({ ...edit, posicaoId: e.target.value })}>
          <option value="">{edit.posicao || 'Escolha a posição'}</option>
          {positions.filter((p) => p.slug !== 'finalizacao' && p.slug !== 'finalizado').map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Select>
      </Field>
      <Field label="A finta (opcional)" hint="O movimento que faz ele reagir do jeito que você quer.">
        <button type="button" className="input plano-escolher" onClick={() => setEscolhendo('finta')}>
          {edit.finta || 'Escolher a finta'}
        </button>
      </Field>

      <Field label="Pra quem serve (opcional)" hint="O parceiro com essa altura ou esse peso vê o plano na ficha dele.">
        <div className="row wrap" style={{ gap: 6 }}>
          {ALTURA_REL.map((o) => (
            <Chip key={o.id} on={edit.paraAltura.includes(o.id)} onClick={() => setEdit({ ...edit, paraAltura: alternar(edit.paraAltura, o.id) })}>{o.nome}</Chip>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
          {PESO_REL.map((o) => (
            <Chip key={o.id} on={edit.paraPeso.includes(o.id)} onClick={() => setEdit({ ...edit, paraPeso: alternar(edit.paraPeso, o.id) })}>{o.nome}</Chip>
          ))}
        </div>
      </Field>

      <div className="col" style={{ gap: 12, marginTop: 6 }}>
        {passos.map((x, i) => (
          <div key={i} className="plano-passo-edit">
            <div className="row" style={{ gap: 8 }}>
              <span className="eyebrow" style={{ flex: 1 }}>{i === 0 ? 'golpe' : `se defender, golpe ${i + 1}`}</span>
              {passos.length > 1 && (
                <button type="button" className="btn ghost xs" aria-label="Tirar este golpe"
                  onClick={() => setEdit({ ...edit, passos: passos.filter((_, k) => k !== i) })}><X size={13} /></button>
              )}
            </div>
            <Input value={x.reacao} placeholder="Como ele reage (ex.: baseia a mão no chão)" onChange={(e) => mudarPasso(i, 'reacao', e.target.value)} />
            <button type="button" className="input plano-escolher" onClick={() => setEscolhendo(i)}>
              {x.golpe || 'Escolher o golpe'}
            </button>
          </div>
        ))}
      </div>
      {passos.length < MAX_PASSOS && (
        <Btn size="sm" variant="ghost" icon={Plus} style={{ marginTop: 10 }}
          onClick={() => setEdit({ ...edit, passos: [...passos, { reacao: '', golpe: '' }] })}>
          Se ele defender, o próximo
        </Btn>
      )}

      <SeletorTecnica
        aberto={escolhendo !== null} onClose={() => setEscolhendo(null)}
        techniques={techniques} categories={categories} positions={positions} faixa={faixa}
        titulo={escolhendo === 'finta' ? 'Qual é a finta' : 'Qual é o golpe'}
        semPosicoes
        onEscolher={(t) => {
          if (escolhendo === 'finta') setEdit({ ...edit, finta: t.nome });
          else mudarPasso(escolhendo, 'golpe', t.nome);
          setEscolhendo(null);
        }}
      />
    </Sheet>
  );
}

/* ============================================================
   MODO ASSISTIR
   A corrente em cena, um cartão por vez, entrando em cascata.
   ============================================================ */
function AssistirPlano({ plano, onClose }) {
  const [ate, setAte] = useState(0);
  if (!plano) return null;
  const c = correnteDoPlano(plano);
  const cenas = [
    { tipo: 'posicao', rotulo: 'de onde começa', titulo: c.posicao || 'A posição' },
    ...(c.finta ? [{ tipo: 'finta', rotulo: 'a finta', titulo: c.finta }] : []),
    ...c.passos.flatMap((x, i) => [
      ...(x.reacao ? [{ tipo: 'reacao', rotulo: i === 0 ? 'ele reage' : 'ele defende', titulo: x.reacao }] : []),
      { tipo: 'golpe', rotulo: i === 0 ? 'o golpe' : `golpe ${i + 1}`, titulo: x.golpe, detalhe: x.detalhe },
    ]),
    ...(c.fim ? [{ tipo: 'fim', rotulo: 'se tudo falhar', titulo: c.fim }] : []),
  ];
  const fechar = () => { setAte(0); onClose(); };
  const acabou = ate >= cenas.length - 1;

  return (
    <Sheet aberto onClose={fechar} titulo={plano.nome} subtitulo="o plano em cena">
      <div className="plano-cena">
        {cenas.slice(0, ate + 1).map((x, i) => (
          <div key={i} className={`plano-carta ${x.tipo}`} style={{ '--i': i }}>
            <span className="eyebrow">{x.rotulo}</span>
            <div className="plano-carta-titulo">{x.titulo}</div>
            {x.detalhe && <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.55 }}>{x.detalhe}</p>}
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 14 }}>
        {acabou ? (
          <Btn variant="contorno" icon={RotateCcw} style={{ flex: 1 }} onClick={() => setAte(0)}>Ver de novo</Btn>
        ) : (
          <>
            <Btn variant="primary" icon={ChevronRight} style={{ flex: 1 }} onClick={() => setAte((n) => n + 1)}>Próximo</Btn>
            <Btn variant="ghost" onClick={() => setAte(cenas.length - 1)}>Ver tudo</Btn>
          </>
        )}
      </div>
    </Sheet>
  );
}
