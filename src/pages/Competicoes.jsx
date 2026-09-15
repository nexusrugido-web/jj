import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trophy, Trash2, Pencil, Check, Scale, BookOpen, ShieldAlert } from 'lucide-react';
import { db } from '../db/db';
import { useApp } from '../contexto';
import {
  Card, Btn, Field, Input, Textarea, Select, Modal, Chip, Empty, Confirmar, useToast, Stat, Seg,
} from '../components/UI';
import { hoje, fmtData, relativo } from '../lib/utils';

const PONTOS_IBJJF = [
  ['Queda (takedown)', 2],
  ['Raspagem (sweep)', 2],
  ['Joelho na barriga', 2],
  ['Passagem de guarda', 3],
  ['Montada', 4],
  ['Pegada nas costas (2 ganchos)', 4],
];

const CHECKLIST = [
  'Confirmar categoria de peso e idade na inscrição',
  'Pesar em casa com o kimono na semana da luta',
  'Conferir se o gi está dentro das medidas e sem rasgos',
  'Levar documento com foto',
  'Chegar 1h antes da chamada da categoria',
  'Aquecer 20 min antes de subir',
  'Levar água, banana e barra pra entre as lutas',
  'Revisar: faixa branca só pode chave de pé reta',
  'Lembrar: pular para a guarda é falta para faixa branca',
];

const vazia = () => ({
  data: hoje(), evento: '', organizacao: 'IBJJF', modalidade: 'gi', categoria: '',
  peso: '', lutas: 0, vitorias: 0, derrotas: 0, colocacao: '', metodo: '', aprendizados: '', notas: '',
});

export default function Competicoes() {
  const toast = useToast();
  const { settings } = useApp();
  const comps = useLiveQuery(() => db.competitions.orderBy('data').reverse().toArray(), [], []) || [];
  const [edit, setEdit] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [aba, setAba] = useState('historico');
  const [check, setCheck] = useState({});

  const totais = useMemo(() => ({
    eventos: comps.length,
    lutas: comps.reduce((a, c) => a + (c.lutas || 0), 0),
    vitorias: comps.reduce((a, c) => a + (c.vitorias || 0), 0),
    podios: comps.filter((c) => ['1', '2', '3', 'Ouro', 'Prata', 'Bronze'].includes(String(c.colocacao))).length,
  }), [comps]);

  async function salvar() {
    if (edit.id) await db.competitions.put(edit);
    else await db.competitions.add({ ...edit, criadoEm: Date.now() });
    setEdit(null);
    toast('Competição salva');
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">a prova real do seu jogo</div>
          <h1 className="h-page">Competições</h1>
        </div>
        <Btn variant="primary" icon={Plus} onClick={() => setEdit(vazia())}>Registrar</Btn>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Card><Stat icon={Trophy} valor={totais.eventos} label="campeonatos" /></Card>
        <Card><Stat icon={Scale} valor={totais.lutas} label="lutas" /></Card>
        <Card><Stat icon={Check} valor={totais.vitorias} label="vitórias" tone="jade" /></Card>
        <Card><Stat icon={Trophy} valor={totais.podios} label="pódios" tone="roar" /></Card>
      </div>

      <Seg value={aba} onChange={setAba} options={[
        { id: 'historico', nome: 'Histórico' },
        { id: 'regras', nome: 'Regras' },
        { id: 'checklist', nome: 'Checklist' },
      ]} />
      <div style={{ height: 14 }} />

      {aba === 'historico' && (
        comps.length === 0 ? (
          <Card>
            <Empty
              icon={Trophy}
              titulo="Nenhum campeonato ainda"
              texto="Competir acelera a evolução de faixa branca como poucas coisas. Uma luta de 5 minutos te mostra em que você confia de verdade."
              acao={<Btn variant="primary" icon={Plus} onClick={() => setEdit(vazia())}>Registrar campeonato</Btn>}
            />
          </Card>
        ) : (
          <div className="col" style={{ gap: 10 }}>
            {comps.map((c) => (
              <Card key={c.id} className="hover">
                <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 6 }}>
                      <Chip tone="warn">{c.organizacao}</Chip>
                      <Chip>{c.modalidade === 'gi' ? 'Gi' : 'No-Gi'}</Chip>
                      {c.colocacao && <Chip tone="jade">{c.colocacao}</Chip>}
                    </div>
                    <h3 className="h-sec" style={{ marginTop: 8 }}>{c.evento}</h3>
                    <div className="micro muted" style={{ marginTop: 3 }}>
                      {fmtData(c.data)} · {relativo(c.data)} {c.categoria && `· ${c.categoria}`} {c.peso && `· ${c.peso}kg`}
                    </div>
                    <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                      <Chip tone="jade">{c.vitorias}V</Chip>
                      <Chip tone="blood">{c.derrotas}D</Chip>
                      {c.metodo && <Chip>{c.metodo}</Chip>}
                    </div>
                    {c.aprendizados && (
                      <p className="tiny muted" style={{ marginTop: 10 }}>
                        <b style={{ color: 'var(--accent)' }}>Aprendi:</b> {c.aprendizados}
                      </p>
                    )}
                  </div>
                  <div className="row" style={{ gap: 2 }}>
                    <button className="btn ghost icon sm" onClick={() => setEdit({ ...c })}><Pencil size={13} /></button>
                    <button className="btn ghost icon sm" onClick={() => setExcluir(c)}><Trash2 size={13} /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {aba === 'regras' && (
        <div className="grid g-cards">
          <Card>
            <div className="card-head"><h2 className="h-sec">Pontuação IBJJF</h2></div>
            <div className="col" style={{ gap: 8 }}>
              {PONTOS_IBJJF.map(([nome, pts]) => (
                <div key={nome} className="row" style={{ padding: '8px 10px', background: 'var(--void)', borderRadius: 10 }}>
                  <span className="tiny" style={{ flex: 1 }}>{nome}</span>
                  <span className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{pts}</span>
                </div>
              ))}
            </div>
            <p className="micro muted" style={{ marginTop: 12 }}>
              A posição precisa ser estabilizada por <b>3 segundos</b>. Se não estabilizar, vira vantagem. Vantagens e punições desempatam.
            </p>
          </Card>

          <Card style={{ borderColor: 'color-mix(in srgb, var(--blood) 30%, var(--seam))' }}>
            <div className="card-head">
              <h2 className="h-sec row" style={{ gap: 8 }}><ShieldAlert size={17} style={{ color: 'var(--blood)' }} /> Faixa branca</h2>
            </div>
            <div className="col" style={{ gap: 10 }}>
              <div>
                <div className="eyebrow" style={{ color: 'var(--jade)' }}>permitido</div>
                <p className="tiny muted" style={{ marginTop: 5 }}>Chave de pé reta (straight ankle lock), girando sempre <b style={{ color: 'var(--chalk)' }}>para fora</b> do joelho. Estrangulamentos e chaves de braço em geral.</p>
              </div>
              <div className="divider" />
              <div>
                <div className="eyebrow" style={{ color: 'var(--blood)' }}>proibido</div>
                <p className="tiny muted" style={{ marginTop: 5 }}>
                  Heel hook, toe hold, kneebar, calf slicer, bicep slicer, knee reap, chave de pulso e <b style={{ color: 'var(--chalk)' }}>pular para a guarda</b>. Slam é proibido em todas as faixas.
                </p>
              </div>
              <div className="divider" />
              <p className="micro muted">
                No-Gi IBJJF liberou heel hook só para marrom e preta adultos. ADCC e CJI liberam praticamente tudo.
                <b style={{ color: 'var(--roar)' }}> Regras mudam, confira no site oficial antes de cada campeonato.</b>
              </p>
            </div>
          </Card>
        </div>
      )}

      {aba === 'checklist' && (
        <Card>
          <div className="card-head">
            <h2 className="h-sec">Checklist pré-competição</h2>
            <Chip tone="jade">{Object.values(check).filter(Boolean).length}/{CHECKLIST.length}</Chip>
          </div>
          <div className="col" style={{ gap: 6 }}>
            {CHECKLIST.map((c, i) => (
              <button
                key={i}
                className="list-item"
                style={{ borderRadius: 10, borderBottom: 0, background: 'var(--void)' }}
                onClick={() => setCheck({ ...check, [i]: !check[i] })}
              >
                <span style={{
                  width: 19, height: 19, borderRadius: 6, flex: 'none',
                  border: `1.5px solid ${check[i] ? 'var(--jade)' : 'var(--seam-hi)'}`,
                  background: check[i] ? 'var(--jade)' : 'transparent',
                  display: 'grid', placeItems: 'center',
                }}>
                  {check[i] && <Check size={12} color="var(--void)" strokeWidth={3} />}
                </span>
                <span className="tiny grow" style={{ textDecoration: check[i] ? 'line-through' : 'none', opacity: check[i] ? 0.5 : 1 }}>{c}</span>
              </button>
            ))}
          </div>
          <p className="micro muted" style={{ marginTop: 12 }}>
            Na IBJJF a pesagem é momentos antes da luta e não tem tolerância nem tempo pra reidratar. Compita no peso natural.
          </p>
        </Card>
      )}

      <Modal
        aberto={!!edit}
        onClose={() => setEdit(null)}
        titulo={edit?.id ? 'Editar competição' : 'Registrar competição'}
        wide
        footer={<><Btn variant="ghost" onClick={() => setEdit(null)}>Cancelar</Btn><Btn variant="primary" icon={Check} onClick={salvar}>Salvar</Btn></>}
      >
        {edit && (
          <>
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="Evento"><Input value={edit.evento} onChange={(e) => setEdit({ ...edit, evento: e.target.value })} placeholder="Ex.: Copa Bahia de Jiu-Jitsu" /></Field>
              <Field label="Data"><Input type="date" value={edit.data} onChange={(e) => setEdit({ ...edit, data: e.target.value })} /></Field>
            </div>
            <div className="grid g4" style={{ gap: 12 }}>
              <Field label="Organização"><Input value={edit.organizacao} onChange={(e) => setEdit({ ...edit, organizacao: e.target.value })} /></Field>
              <Field label="Modalidade">
                <Select value={edit.modalidade} onChange={(e) => setEdit({ ...edit, modalidade: e.target.value })}>
                  <option value="gi">Gi</option><option value="nogi">No-Gi</option>
                </Select>
              </Field>
              <Field label="Categoria"><Input value={edit.categoria} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })} placeholder="Adulto leve" /></Field>
              <Field label="Peso (kg)"><Input type="number" value={edit.peso} onChange={(e) => setEdit({ ...edit, peso: e.target.value })} /></Field>
            </div>
            <div className="grid g4" style={{ gap: 12 }}>
              <Field label="Lutas"><Input type="number" value={edit.lutas} onChange={(e) => setEdit({ ...edit, lutas: Number(e.target.value) })} /></Field>
              <Field label="Vitórias"><Input type="number" value={edit.vitorias} onChange={(e) => setEdit({ ...edit, vitorias: Number(e.target.value) })} /></Field>
              <Field label="Derrotas"><Input type="number" value={edit.derrotas} onChange={(e) => setEdit({ ...edit, derrotas: Number(e.target.value) })} /></Field>
              <Field label="Colocação"><Input value={edit.colocacao} onChange={(e) => setEdit({ ...edit, colocacao: e.target.value })} placeholder="Ouro / 2º / ," /></Field>
            </div>
            <Field label="Como venceu/perdeu"><Input value={edit.metodo} onChange={(e) => setEdit({ ...edit, metodo: e.target.value })} placeholder="Pontos, finalização, vantagem…" /></Field>
            <Field label="O que aprendi" hint="Isso aqui é o que vale mais que a medalha."><Textarea value={edit.aprendizados} onChange={(e) => setEdit({ ...edit, aprendizados: e.target.value })} /></Field>
            <Field label="Notas"><Textarea value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} /></Field>
          </>
        )}
      </Modal>

      <Confirmar
        aberto={!!excluir}
        onClose={() => setExcluir(null)}
        onConfirmar={async () => { await db.competitions.delete(excluir.id); toast('Removido'); }}
        titulo="Excluir competição"
        texto="Some do histórico."
      />
    </div>
  );
}
