import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus, Users, Trash2, Pencil, Check, Building2, GraduationCap,
  TriangleAlert, MapPin,
} from 'lucide-react';
import { useApp } from '../contexto';
import { db } from '../db/db';
import { FAIXAS } from '../db/seed';
import {
  Card, Btn, Field, Input, Textarea, Select, Sheet, Chip, Empty, Confirmar,
  useToast, BeltTag, Busca, Bar, Seg, Stat,
} from '../components/UI';
import { statsParceiro } from '../lib/stats';
import { buscaMatch } from '../lib/utils';

export default function Parceiros() {
  const [aba, setAba] = useState('parceiros');
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">quem te faz melhorar</div>
          <h1 className="h-page">Parceiros e academia</h1>
        </div>
      </div>

      <Seg value={aba} onChange={setAba} options={[
        { id: 'parceiros', nome: 'Parceiros' },
        { id: 'academias', nome: 'Academias' },
        { id: 'professores', nome: 'Professores' },
      ]} />
      <div style={{ height: 14 }} />

      {aba === 'parceiros' && <AbaParceiros />}
      {aba === 'academias' && <AbaAcademias />}
      {aba === 'professores' && <AbaProfessores />}
    </div>
  );
}

/* ================= PARCEIROS ================= */
const vazioP = () => ({ nome: '', faixa: 'branca', graus: 0, pesoKg: '', estilo: '', notas: '', academiaId: null });

/* também abre por cima do registro do treino, quando ainda não há parceiro */
export function AbaParceiros() {
  const { partners, rolls } = useApp();
  const toast = useToast();
  const academias = useLiveQuery(() => db.academies.filter((a) => !a.arquivada).toArray(), [], []) || [];
  const [edit, setEdit] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [busca, setBusca] = useState('');

  const acadById = useMemo(() => Object.fromEntries(academias.map((a) => [a.id, a])), [academias]);

  const lista = useMemo(
    () => partners
      .filter((p) => buscaMatch(`${p.nome} ${p.estilo} ${p.notas}`, busca))
      .map((p) => ({ ...p, s: statsParceiro(rolls, p.id) }))
      .sort((a, b) => b.s.rolas - a.s.rolas),
    [partners, rolls, busca]
  );

  async function salvar() {
    if (!edit.nome.trim()) return toast('Coloca um nome', 'err');
    if (edit.id) await db.partners.put(edit);
    else await db.partners.add({ ...edit, arquivada: 0, criadoEm: Date.now() });
    setEdit(null);
    toast('Parceiro salvo');
  }

  return (
    <>
      <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
        <Busca value={busca} onChange={setBusca} placeholder="Buscar parceiro…" />
        <Btn variant="primary" icon={Plus} onClick={() => setEdit(vazioP())}>Novo parceiro</Btn>
      </div>

      {lista.length === 0 ? (
        <Card>
          <Empty
            icon={Users}
            titulo="Nenhum parceiro cadastrado"
            texto="Cadastre quem você mais rola. Com isso o app mostra contra qual faixa e qual jogo você trava, e o cálculo de domínio passa a pesar a faixa de quem estava do outro lado."
            acao={<Btn variant="primary" icon={Plus} onClick={() => setEdit(vazioP())}>Cadastrar</Btn>}
          />
        </Card>
      ) : (
        <div className="grid g-auto">
          {lista.map((p) => (
            <Card key={p.id} className="hover" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }} className="truncate">{p.nome}</div>
                  <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <BeltTag faixa={p.faixa} graus={p.graus} />
                    {p.pesoKg && <Chip>{p.pesoKg} kg</Chip>}
                  </div>
                  {acadById[p.academiaId] && <div className="micro muted" style={{ marginTop: 6 }}>{acadById[p.academiaId].nome}</div>}
                </div>
                <div className="row" style={{ gap: 2 }}>
                  <button className="btn ghost icon sm" onClick={() => setEdit({ ...p })}><Pencil size={13} /></button>
                  <button className="btn ghost icon sm" onClick={() => setExcluir(p)}><Trash2 size={13} /></button>
                </div>
              </div>

              {p.estilo && <p className="micro muted">{p.estilo}</p>}

              <div className="col" style={{ gap: 6 }}>
                <div className="row micro">
                  <span className="muted" style={{ flex: 1 }}>{p.s.rolas} rolas</span>
                  <span className="num" style={{ color: 'var(--jade)' }}>+{p.s.fin}</span>
                  <span className="num" style={{ color: 'var(--blood)' }}>−{p.s.tap}</span>
                </div>
                <Bar v={p.s.fin} max={Math.max(1, p.s.fin + p.s.tap)} tone="jade" />
              </div>

              {p.notas && <p className="micro muted" style={{ borderTop: '1px solid var(--seam)', paddingTop: 9, whiteSpace: 'pre-wrap' }}>{p.notas}</p>}
            </Card>
          ))}
        </div>
      )}

      <Sheet
        aberto={!!edit} onClose={() => setEdit(null)}
        titulo={edit?.id ? 'Editar parceiro' : 'Novo parceiro'}
        footer={<><Btn variant="ghost" onClick={() => setEdit(null)}>Cancelar</Btn><Btn variant="primary" icon={Check} onClick={salvar}>Salvar</Btn></>}
      >
        {edit && (
          <>
            <Field label="Nome"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
            <div className="grid g3" style={{ gap: 12 }}>
              <Field label="Faixa">
                <Select value={edit.faixa} onChange={(e) => setEdit({ ...edit, faixa: e.target.value })}>
                  {FAIXAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </Select>
              </Field>
              <Field label="Graus"><Input type="number" inputMode="numeric" min="0" max="4" value={edit.graus} onChange={(e) => setEdit({ ...edit, graus: Number(e.target.value) })} /></Field>
              <Field label="Peso (kg)"><Input type="number" inputMode="decimal" value={edit.pesoKg} onChange={(e) => setEdit({ ...edit, pesoKg: e.target.value })} /></Field>
            </div>
            <Field label="Academia">
              <Select value={edit.academiaId || ''} onChange={(e) => setEdit({ ...edit, academiaId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Escolha</option>
                {academias.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </Select>
            </Field>
            <Field label="Estilo de jogo"><Input value={edit.estilo} onChange={(e) => setEdit({ ...edit, estilo: e.target.value })} placeholder="Ex.: passador pesado, guardeiro de laçada" /></Field>
            <Field label="Notas" hint="O que funciona e o que não funciona contra ele."><Textarea value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} /></Field>
          </>
        )}
      </Sheet>

      <Confirmar
        aberto={!!excluir} onClose={() => setExcluir(null)}
        onConfirmar={async () => { await db.partners.update(excluir.id, { arquivada: 1 }); toast('Parceiro arquivado'); }}
        titulo="Arquivar parceiro" rotulo="Arquivar"
        texto={`"${excluir?.nome}" sai da lista, mas os rolas antigas continuam registradas.`}
      />
    </>
  );
}

/* ================= ACADEMIAS ================= */
const vazioA = () => ({ nome: '', cidade: '', equipe: '', notas: '' });

function AbaAcademias() {
  const toast = useToast();
  const academias = useLiveQuery(() => db.academies.filter((a) => !a.arquivada).toArray(), [], []) || [];
  const professores = useLiveQuery(() => db.professors.filter((p) => !p.arquivada).toArray(), [], []) || [];
  const { sessions } = useApp();
  const [edit, setEdit] = useState(null);
  const [excluir, setExcluir] = useState(null);

  async function salvar() {
    if (!edit.nome.trim()) return toast('Coloca o nome da academia', 'err');
    if (edit.id) await db.academies.put(edit);
    else await db.academies.add({ ...edit, arquivada: 0, criadoEm: Date.now() });
    setEdit(null);
    toast('Academia salva');
  }

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <p className="tiny muted">
          Cadastre aqui e no registro de treino você escolhe com um clique, sem digitar nada.
          Cada professor pertence a <b style={{ color: 'var(--chalk)' }}>uma</b> academia.
        </p>
        <Btn variant="primary" icon={Plus} onClick={() => setEdit(vazioA())} style={{ marginTop: 12 }}>Nova academia</Btn>
      </Card>

      {academias.length === 0 ? (
        <Card><Empty icon={Building2} titulo="Nenhuma academia" texto="Cadastre onde você treina pra parar de digitar o mesmo nome toda vez." /></Card>
      ) : (
        <div className="grid g-auto">
          {academias.map((a) => {
            const profs = professores.filter((p) => p.academiaId === a.id);
            const treinos = sessions.filter((s) => s.academiaId === a.id).length;
            return (
              <Card key={a.id} className="hover" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="stat-ico"><Building2 size={16} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }} className="truncate">{a.nome}</div>
                    {(a.cidade || a.equipe) && (
                      <div className="micro muted row" style={{ gap: 5, marginTop: 3 }}>
                        {a.cidade && <><MapPin size={10} /> {a.cidade}</>}
                        {a.equipe && <span>· {a.equipe}</span>}
                      </div>
                    )}
                  </div>
                  <div className="row" style={{ gap: 2 }}>
                    <button className="btn ghost icon sm" onClick={() => setEdit({ ...a })}><Pencil size={13} /></button>
                    <button className="btn ghost icon sm" onClick={() => setExcluir(a)}><Trash2 size={13} /></button>
                  </div>
                </div>

                <div className="row wrap" style={{ gap: 6 }}>
                  <Chip>{profs.length} professor(es)</Chip>
                  <Chip tone="jade">{treinos} treino(s)</Chip>
                </div>

                {profs.length > 0 && (
                  <div className="row wrap" style={{ gap: 5 }}>
                    {profs.map((p) => <Chip key={p.id}><GraduationCap size={11} /> {p.nome}</Chip>)}
                  </div>
                )}

                {a.notas && <p className="micro muted">{a.notas}</p>}
              </Card>
            );
          })}
        </div>
      )}

      <Sheet
        aberto={!!edit} onClose={() => setEdit(null)}
        titulo={edit?.id ? 'Editar academia' : 'Nova academia'}
        footer={<><Btn variant="ghost" onClick={() => setEdit(null)}>Cancelar</Btn><Btn variant="primary" icon={Check} onClick={salvar}>Salvar</Btn></>}
      >
        {edit && (
          <>
            <Field label="Nome da academia"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Ex.: Gracie Barra Catu" /></Field>
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="Cidade"><Input value={edit.cidade} onChange={(e) => setEdit({ ...edit, cidade: e.target.value })} /></Field>
              <Field label="Equipe"><Input value={edit.equipe} onChange={(e) => setEdit({ ...edit, equipe: e.target.value })} placeholder="Ex.: Alliance" /></Field>
            </div>
            <Field label="Notas"><Textarea value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} placeholder="Horários, dias de no-gi, open mat…" /></Field>
          </>
        )}
      </Sheet>

      <Confirmar
        aberto={!!excluir} onClose={() => setExcluir(null)}
        onConfirmar={async () => { await db.academies.update(excluir.id, { arquivada: 1 }); toast('Academia arquivada'); }}
        titulo="Arquivar academia" rotulo="Arquivar"
        texto={`"${excluir?.nome}" sai da lista. Os treinos antigos continuam registrados.`}
      />
    </>
  );
}

/* ================= PROFESSORES ================= */
const vazioProf = (academiaId) => ({ nome: '', faixa: 'preta', graus: 0, academiaId: academiaId || null, notas: '' });

function AbaProfessores() {
  const toast = useToast();
  const academias = useLiveQuery(() => db.academies.filter((a) => !a.arquivada).toArray(), [], []) || [];
  const professores = useLiveQuery(() => db.professors.filter((p) => !p.arquivada).toArray(), [], []) || [];
  const { sessions } = useApp();
  const [edit, setEdit] = useState(null);
  const [excluir, setExcluir] = useState(null);

  const acadById = useMemo(() => Object.fromEntries(academias.map((a) => [a.id, a])), [academias]);

  async function salvar() {
    if (!edit.nome.trim()) return toast('Coloca o nome do professor', 'err');
    if (!edit.academiaId) return toast('Escolhe a academia dele', 'err');
    const jaExiste = professores.find(
      (p) => p.id !== edit.id && p.nome.trim().toLowerCase() === edit.nome.trim().toLowerCase()
    );
    if (jaExiste) {
      const onde = acadById[jaExiste.academiaId]?.nome || 'outra academia';
      return toast(`"${edit.nome}" já está cadastrado em ${onde}`, 'err');
    }
    if (edit.id) await db.professors.put(edit);
    else await db.professors.add({ ...edit, arquivada: 0, criadoEm: Date.now() });
    setEdit(null);
    toast('Professor salvo');
  }

  if (!academias.length) {
    return (
      <Card>
        <Empty
          icon={TriangleAlert}
          titulo="Cadastre uma academia primeiro"
          texto="Todo professor pertence a uma academia. Crie a academia na aba ao lado e volte aqui."
        />
      </Card>
    );
  }

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <p className="tiny muted">
          Cada professor fica vinculado a uma academia. Ao registrar o treino, escolher a academia já filtra os professores dela.
        </p>
        <Btn variant="primary" icon={Plus} onClick={() => setEdit(vazioProf(academias[0]?.id))} style={{ marginTop: 12 }}>Novo professor</Btn>
      </Card>

      {academias.map((a) => {
        const profs = professores.filter((p) => p.academiaId === a.id);
        return (
          <div key={a.id} style={{ marginBottom: 16 }}>
            <div className="row" style={{ gap: 8, marginBottom: 9 }}>
              <Building2 size={14} className="muted" />
              <span className="eyebrow">{a.nome}</span>
              <span className="spacer" />
              <button className="btn ghost xs" onClick={() => setEdit(vazioProf(a.id))}><Plus size={11} /> professor</button>
            </div>
            {profs.length === 0 ? (
              <Card><p className="tiny muted center" style={{ padding: 10 }}>Nenhum professor nesta academia ainda.</p></Card>
            ) : (
              <div className="grid g-auto">
                {profs.map((p) => {
                  const treinos = sessions.filter((s) => s.professorId === p.id).length;
                  return (
                    <Card key={p.id} className="hover" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <span className="stat-ico"><GraduationCap size={15} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontFamily: 'var(--display)', fontSize: 15 }} className="truncate">{p.nome}</div>
                          <div className="row" style={{ gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                            <BeltTag faixa={p.faixa} graus={p.graus} />
                            {treinos > 0 && <Chip tone="jade">{treinos} aula(s)</Chip>}
                          </div>
                        </div>
                        <div className="row" style={{ gap: 2 }}>
                          <button className="btn ghost icon sm" onClick={() => setEdit({ ...p })}><Pencil size={13} /></button>
                          <button className="btn ghost icon sm" onClick={() => setExcluir(p)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                      {p.notas && <p className="micro muted">{p.notas}</p>}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <Sheet
        aberto={!!edit} onClose={() => setEdit(null)}
        titulo={edit?.id ? 'Editar professor' : 'Novo professor'}
        footer={<><Btn variant="ghost" onClick={() => setEdit(null)}>Cancelar</Btn><Btn variant="primary" icon={Check} onClick={salvar}>Salvar</Btn></>}
      >
        {edit && (
          <>
            <Field label="Nome"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Ex.: Lucas Dantas" /></Field>
            <Field label="Academia" hint="Um professor pertence a uma academia só.">
              <Select value={edit.academiaId || ''} onChange={(e) => setEdit({ ...edit, academiaId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Escolha…</option>
                {academias.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </Select>
            </Field>
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="Faixa">
                <Select value={edit.faixa} onChange={(e) => setEdit({ ...edit, faixa: e.target.value })}>
                  {FAIXAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </Select>
              </Field>
              <Field label="Graus"><Input type="number" inputMode="numeric" min="0" max="6" value={edit.graus} onChange={(e) => setEdit({ ...edit, graus: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Notas"><Textarea value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} placeholder="Estilo de aula, o que ele cobra…" /></Field>
          </>
        )}
      </Sheet>

      <Confirmar
        aberto={!!excluir} onClose={() => setExcluir(null)}
        onConfirmar={async () => { await db.professors.update(excluir.id, { arquivada: 1 }); toast('Professor arquivado'); }}
        titulo="Arquivar professor" rotulo="Arquivar"
        texto={`"${excluir?.nome}" sai da lista.`}
      />
    </>
  );
}
