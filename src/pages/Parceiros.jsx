import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus, Users, Trash2, Pencil, Check, Building2, GraduationCap,
  TriangleAlert, MapPin, ScanSearch,
} from 'lucide-react';
import { useApp } from '../contexto';
import { db } from '../db/db';
import { FAIXAS } from '../db/seed';
import {
  Card, Btn, Field, Input, NumeroInput, Textarea, Select, Sheet, Chip, Empty, Confirmar, useToast,
  BeltTag, Busca, Bar, Seg,
} from '../components/UI';
import { statsParceiro } from '../lib/stats';
import ListaComHistorico from '../components/ListaComHistorico';
import { buscaMatch } from '../lib/utils';
import { PESO_REL, pesoRelPorId } from '../db/scoring';
import '../styles/treino-rola.css';
import RaioXParceiro from '../components/RaioXParceiro';

export default function Parceiros() {
  const [aba, setAba] = useState('parceiros');
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Parceiros e academia</h1>
        </div>
      </div>

      {/* na ordem do padrão do treino: a academia, quem dá aula nela, quem treina nela */}
      <Seg value={aba} onChange={setAba} options={[
        { id: 'academias', nome: 'Academias' },
        { id: 'professores', nome: 'Professores' },
        { id: 'parceiros', nome: 'Parceiros' },
      ]} />
      <div style={{ height: 14 }} />

      {aba === 'parceiros' && <AbaParceiros />}
      {aba === 'academias' && <AbaAcademias />}
      {aba === 'professores' && <AbaProfessores />}
    </div>
  );
}

/* ================= PARCEIROS ================= */
const vazioP = (academiaId = null) => ({ nome: '', faixa: '', graus: 0, pesoRel: null, estilo: '', notas: '', academiaId });

/* o peso do parceiro do mesmo jeito que o rola pergunta: em relação a
   você. Escolher o parceiro no rola já marca esse peso. */
function PesoRelativo({ valor, onChange }) {
  return (
    <div className="rola-peso">
      <span className="label">Peso dele em relação a você</span>
      <div className="rola-peso-opcoes" role="group" aria-label="Peso do parceiro em relação a você">
        {PESO_REL.map((o) => (
          <button type="button" key={o.id}
            className={`rola-peso-opcao ${valor === o.id ? 'selecionada' : ''}`}
            aria-pressed={valor === o.id}
            onClick={() => onChange(valor === o.id ? null : o.id)}>
            <span className="rola-peso-icone" aria-hidden="true">{o.icone}</span>
            <span>{o.nome}</span>
            {valor === o.id && <Check size={15} className="rola-peso-check" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/* também abre por cima do registro do treino, quando ainda não há parceiro */
export function AbaParceiros() {
  const { partners, rolls, settings, acesso } = useApp();
  const [raio, setRaio] = useState(null);
  const toast = useToast();
  const academias = useLiveQuery(() => db.academies.filter((a) => !a.arquivada).toArray(), [], []) || [];
  const [edit, setEdit] = useState(null);
  /* criando a academia no meio do cadastro: guarda o parceiro pela metade */
  const [academiaPara, setAcademiaPara] = useState(null);
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

  /* todo parceiro treina em alguma academia: sem nenhuma cadastrada, o
     botão de parceiro começa por ela. Com academia, já vem a de sempre. */
  function novo() {
    const padrao = academias.find((a) => a.id === settings?.academiaPadraoId) || (academias.length === 1 ? academias[0] : null);
    if (!academias.length) setAcademiaPara(vazioP());
    else setEdit(vazioP(padrao?.id || null));
  }
  function outraAcademia() {
    setAcademiaPara(edit);
    setEdit(null);
  }

  async function salvar() {
    if (!edit.nome.trim()) return toast('Coloca um nome', 'err');
    if (!edit.academiaId) return toast('Escolhe a academia dele', 'err');
    if (edit.id) await db.partners.put(edit);
    else await db.partners.add({ ...edit, arquivada: 0, criadoEm: Date.now() });
    setEdit(null);
    toast('Parceiro salvo');
  }

  return (
    <>
      <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
        <Busca value={busca} onChange={setBusca} placeholder="Buscar parceiro…" />
        <Btn variant="primary" icon={Plus} onClick={novo}>Novo parceiro</Btn>
      </div>

      {lista.length === 0 ? (
        <Card>
          <Empty
            icon={Users}
            titulo="Nenhum parceiro cadastrado"
            texto={academias.length
              ? 'Cadastre quem você mais rola. Com isso o app mostra contra qual faixa e qual jogo você trava, e o cálculo de domínio passa a pesar a faixa de quem estava do outro lado.'
              : 'Primeiro a academia, depois quem treina nela. Com os parceiros o app mostra contra qual faixa e qual jogo você trava.'}
            acao={<Btn variant="primary" icon={Plus} onClick={novo}>{academias.length ? 'Cadastrar' : 'Começar pela academia'}</Btn>}
          />
        </Card>
      ) : (
        <ListaComHistorico itens={lista} limite={6} titulo="Todos os parceiros" className="grid g-auto"
          renderItem={(p) => (
            <Card key={p.id} className="hover" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }} className="truncate">{p.nome}</div>
                  <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {p.faixa ? <BeltTag faixa={p.faixa} graus={p.graus} /> : <Chip>faixa não informada</Chip>}
                    {p.pesoRel ? <Chip>{pesoRelPorId[p.pesoRel]?.icone} {pesoRelPorId[p.pesoRel]?.nome}</Chip> : p.pesoKg ? <Chip>{p.pesoKg} kg</Chip> : null}
                  </div>
                  {acadById[p.academiaId] && <div className="micro muted" style={{ marginTop: 6 }}>{acadById[p.academiaId].nome}</div>}
                </div>
                <div className="row" style={{ gap: 2 }}>
                  <button className="btn ghost icon sm" onClick={() => setEdit({ ...p })}><Pencil size={13} /></button>
                  <button className="btn ghost icon sm" onClick={() => setExcluir(p)}><Trash2 size={13} /></button>
                </div>
              </div>

              {p.estilo && <p className="micro muted">{p.estilo}</p>}

              {p.s.rolas > 0 && (
                <button type="button" className="btn contorno sm" onClick={() => setRaio(p)} style={{ alignSelf: 'flex-start' }}>
                  <ScanSearch size={14} /> Raio-x contra {p.nome.split(' ')[0]}
                </button>
              )}

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
          )}
        />
      )}

      <Sheet
        aberto={!!edit} onClose={() => setEdit(null)}
        titulo={edit?.id ? 'Editar parceiro' : 'Novo parceiro'}
        footer={<><Btn variant="ghost" onClick={() => setEdit(null)}>Cancelar</Btn><Btn variant="primary" icon={Check} onClick={salvar}>Salvar</Btn></>}
      >
        {edit && (
          <>
            <Field label="Onde vocês treinam">
              <div className="row wrap" style={{ gap: 6 }}>
                {academias.map((a) => (
                  <button key={a.id} type="button" className={`chip ${edit.academiaId === a.id ? 'on' : ''}`}
                    style={{ minHeight: 38 }} onClick={() => setEdit({ ...edit, academiaId: a.id })}>
                    <Building2 size={12} /> {a.nome}
                  </button>
                ))}
                <button type="button" className="chip" style={{ minHeight: 38 }} onClick={outraAcademia}>
                  <Plus size={12} /> Outra academia
                </button>
              </div>
            </Field>
            <Field label="Nome"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Nome ou apelido" /></Field>
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="Faixa">
                <Select value={edit.faixa || ''} onChange={(e) => setEdit({ ...edit, faixa: e.target.value })}>
                  <option value="">Não sei / não informada</option>
                  {FAIXAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </Select>
              </Field>
              <Field label="Graus"><NumeroInput min="0" max="4" valor={edit.graus} onChange={(v) => setEdit({ ...edit, graus: v })} /></Field>
            </div>
            <PesoRelativo valor={edit.pesoRel} onChange={(pesoRel) => setEdit({ ...edit, pesoRel })} />
            <Field label="Estilo de jogo"><Input value={edit.estilo} onChange={(e) => setEdit({ ...edit, estilo: e.target.value })} placeholder="Ex.: passador pesado, guardeiro de laçada" /></Field>
            <Field label="Notas" hint="O que funciona e o que não funciona contra ele."><Textarea value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} /></Field>
          </>
        )}
      </Sheet>

      <RaioXParceiro parceiro={raio} rolls={rolls} acesso={acesso} onClose={() => setRaio(null)} />

      <SheetAcademia
        aberto={!!academiaPara}
        titulo={academias.length ? 'Nova academia' : 'Primeiro, a academia'}
        texto={academias.length ? null : 'Todo parceiro treina em algum lugar. Cadastre a academia agora e, em seguida, o parceiro.'}
        onClose={() => {
          /* desistiu da academia: volta pro parceiro que estava pela metade */
          const pend = academiaPara;
          setAcademiaPara(null);
          if (pend && academias.length) setEdit(pend);
        }}
        onSalva={(id) => { const pend = academiaPara; setAcademiaPara(null); setEdit({ ...(pend || vazioP()), academiaId: id }); }}
      />

      <Confirmar
        aberto={!!excluir} onClose={() => setExcluir(null)}
        onConfirmar={async () => { await db.partners.update(excluir.id, { arquivada: 1 }); toast('Parceiro arquivado'); }}
        titulo="Arquivar parceiro" rotulo="Arquivar"
        texto={`"${excluir?.nome}" sai da lista, mas os rolas antigos continuam registrados.`}
      />
    </>
  );
}

/* ================= ACADEMIAS ================= */
const vazioA = () => ({ nome: '', cidade: '', equipe: '', notas: '' });

/* o cadastro da academia: na aba Academias, no meio do cadastro do
   parceiro e por cima do registro do treino (onSalva recebe o id) */
export function SheetAcademia({ aberto, inicial = null, titulo, texto = null, onClose, onSalva }) {
  const toast = useToast();
  const [edit, setEdit] = useState(vazioA());
  useEffect(() => { if (aberto) setEdit(inicial ? { ...inicial } : vazioA()); }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    if (!edit.nome.trim()) return toast('Coloca o nome da academia', 'err');
    let id = edit.id;
    if (id) await db.academies.put(edit);
    else id = Number(await db.academies.add({ ...edit, nome: edit.nome.trim(), arquivada: 0, criadoEm: Date.now() }));
    toast('Academia salva');
    onSalva?.(id);
  }

  return (
    <Sheet
      aberto={aberto} onClose={onClose}
      titulo={titulo || (inicial?.id ? 'Editar academia' : 'Nova academia')}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn variant="primary" icon={Check} onClick={salvar}>Salvar</Btn></>}
    >
      {aberto && (
        <>
          {texto && <p className="tiny muted" style={{ lineHeight: 1.6 }}>{texto}</p>}
          <Field label="Nome da academia"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Ex.: Gracie Barra Catu" /></Field>
          <div className="grid g2" style={{ gap: 12 }}>
            <Field label="Cidade"><Input value={edit.cidade} onChange={(e) => setEdit({ ...edit, cidade: e.target.value })} /></Field>
            <Field label="Equipe"><Input value={edit.equipe} onChange={(e) => setEdit({ ...edit, equipe: e.target.value })} placeholder="Ex.: Alliance" /></Field>
          </div>
          <Field label="Notas"><Textarea value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} placeholder="Horários, dias de no-gi, open mat…" /></Field>
        </>
      )}
    </Sheet>
  );
}

function AbaAcademias() {
  const toast = useToast();
  const academias = useLiveQuery(() => db.academies.filter((a) => !a.arquivada).toArray(), [], []) || [];
  const professores = useLiveQuery(() => db.professors.filter((p) => !p.arquivada).toArray(), [], []) || [];
  const { sessions } = useApp();
  const [edit, setEdit] = useState(null);
  const [excluir, setExcluir] = useState(null);

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
        <ListaComHistorico itens={academias} limite={6} titulo="Todas as academias" className="grid g-auto"
          renderItem={(a) => {
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
                  <Chip>{profs.length} {profs.length === 1 ? 'professor' : 'professores'}</Chip>
                  <Chip tone="jade">{treinos} {treinos === 1 ? 'treino' : 'treinos'}</Chip>
                </div>

                {profs.length > 0 && (
                  <div className="row wrap" style={{ gap: 5 }}>
                    {profs.map((p) => <Chip key={p.id}><GraduationCap size={11} /> {p.nome}</Chip>)}
                  </div>
                )}

                {a.notas && <p className="micro muted">{a.notas}</p>}
              </Card>
            );
          }}
        />
      )}

      <SheetAcademia aberto={!!edit} inicial={edit?.id ? edit : null} onClose={() => setEdit(null)} onSalva={() => setEdit(null)} />

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

/* o cadastro do professor: na aba Professores e por cima do registro do
   treino, já na academia escolhida (onSalva recebe o id) */
export function SheetProfessor({ aberto, inicial = null, academiaId = null, onClose, onSalva }) {
  const toast = useToast();
  const academias = useLiveQuery(() => db.academies.filter((a) => !a.arquivada).toArray(), [], []) || [];
  const professores = useLiveQuery(() => db.professors.filter((p) => !p.arquivada).toArray(), [], []) || [];
  const [edit, setEdit] = useState(vazioProf(academiaId));
  useEffect(() => { if (aberto) setEdit(inicial ? { ...inicial } : vazioProf(academiaId)); }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    if (!edit.nome.trim()) return toast('Coloca o nome do professor', 'err');
    if (!edit.academiaId) return toast('Escolhe a academia dele', 'err');
    const jaExiste = professores.find(
      (p) => p.id !== edit.id && p.nome.trim().toLowerCase() === edit.nome.trim().toLowerCase()
    );
    if (jaExiste) {
      const onde = academias.find((a) => a.id === jaExiste.academiaId)?.nome || 'outra academia';
      return toast(`"${edit.nome}" já está cadastrado em ${onde}`, 'err');
    }
    let id = edit.id;
    if (id) await db.professors.put(edit);
    else id = Number(await db.professors.add({ ...edit, arquivada: 0, criadoEm: Date.now() }));
    toast('Professor salvo');
    onSalva?.(id);
  }

  return (
    <Sheet
      aberto={aberto} onClose={onClose}
      titulo={inicial?.id ? 'Editar professor' : 'Novo professor'}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn variant="primary" icon={Check} onClick={salvar}>Salvar</Btn></>}
    >
      {aberto && (
        <>
          <Field label="Academia" hint="Um professor pertence a uma academia só.">
            <div className="row wrap" style={{ gap: 6 }}>
              {academias.map((a) => (
                <button key={a.id} type="button" className={`chip ${edit.academiaId === a.id ? 'on' : ''}`}
                  style={{ minHeight: 38 }} onClick={() => setEdit({ ...edit, academiaId: a.id })}>
                  <Building2 size={12} /> {a.nome}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Nome"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Ex.: Lucas Dantas" /></Field>
          <div className="grid g2" style={{ gap: 12 }}>
            <Field label="Faixa">
              <Select value={edit.faixa} onChange={(e) => setEdit({ ...edit, faixa: e.target.value })}>
                {FAIXAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </Select>
            </Field>
            <Field label="Graus"><NumeroInput min="0" max="6" valor={edit.graus} onChange={(v) => setEdit({ ...edit, graus: v })} /></Field>
          </div>
          <Field label="Notas"><Textarea value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} placeholder="Estilo de aula, o que ele cobra…" /></Field>
        </>
      )}
    </Sheet>
  );
}

function AbaProfessores() {
  const toast = useToast();
  const academias = useLiveQuery(() => db.academies.filter((a) => !a.arquivada).toArray(), [], []) || [];
  const professores = useLiveQuery(() => db.professors.filter((p) => !p.arquivada).toArray(), [], []) || [];
  const { sessions } = useApp();
  const [edit, setEdit] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [academiaNova, setAcademiaNova] = useState(false);

  const acadById = useMemo(() => Object.fromEntries(academias.map((a) => [a.id, a])), [academias]);

  if (!academias.length) {
    return (
      <>
        <Card>
          <Empty
            icon={TriangleAlert}
            titulo="Cadastre uma academia primeiro"
            texto="Todo professor pertence a uma academia. Cadastre a academia e, em seguida, o professor."
            acao={<Btn variant="primary" icon={Plus} onClick={() => setAcademiaNova(true)}>Cadastrar a academia</Btn>}
          />
        </Card>
        <SheetAcademia aberto={academiaNova} titulo="Primeiro, a academia" onClose={() => setAcademiaNova(false)}
          onSalva={(id) => { setAcademiaNova(false); setEdit(vazioProf(id)); }} />
      </>
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

      {professores.length === 0 ? (
        <Card><Empty icon={GraduationCap} titulo="Nenhum professor cadastrado" texto="Cadastre o professor e vincule à academia dele." /></Card>
      ) : (
        <ListaComHistorico
          itens={[...professores].sort((a, b) => (acadById[a.academiaId]?.nome || '').localeCompare(acadById[b.academiaId]?.nome || '') || a.nome.localeCompare(b.nome))}
          limite={6} titulo="Todos os professores" className="grid g-auto"
          renderItem={(p) => {
                  const treinos = sessions.filter((s) => s.professorId === p.id).length;
                  return (
                    <Card key={p.id} className="hover" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <span className="stat-ico"><GraduationCap size={15} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontFamily: 'var(--display)', fontSize: 15 }} className="truncate">{p.nome}</div>
                          <div className="micro muted" style={{ marginTop: 4 }}>{acadById[p.academiaId]?.nome || 'Academia não encontrada'}</div>
                          <div className="row" style={{ gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                            <BeltTag faixa={p.faixa} graus={p.graus} />
                            {treinos > 0 && <Chip tone="jade">{treinos} {treinos === 1 ? 'aula' : 'aulas'}</Chip>}
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
          }}
        />
      )}

      <SheetProfessor aberto={!!edit} inicial={edit?.id ? edit : null} academiaId={edit?.academiaId}
        onClose={() => setEdit(null)} onSalva={() => setEdit(null)} />

      <Confirmar
        aberto={!!excluir} onClose={() => setExcluir(null)}
        onConfirmar={async () => { await db.professors.update(excluir.id, { arquivada: 1 }); toast('Professor arquivado'); }}
        titulo="Arquivar professor" rotulo="Arquivar"
        texto={`"${excluir?.nome}" sai da lista.`}
      />
    </>
  );
}
