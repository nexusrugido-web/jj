import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, HeartPulse, Trash2, Pencil, Check, TriangleAlert, Activity } from 'lucide-react';
import { db } from '../db/db';
import { useApp } from '../contexto';
import ParadoEstudando from '../components/ParadoEstudando';
import { REGIOES_CORPO } from '../db/seed';
import {
  Card, Btn, Field, Input, Textarea, Select, Modal, Chip, Empty, Confirmar, useToast, Stat, Seg, Bar,
} from '../components/UI';
import { hoje, addDias, fmtData, relativo, diasEntre, contar } from '../lib/utils';
import { IMPACTOS, impactoPorId, PRAZOS, situacao, guiaDeEstudo } from '../lib/lesao';

const STATUS = [
  { id: 'ativa', nome: 'Ativa', tone: 'blood' },
  { id: 'recuperando', nome: 'Recuperando', tone: 'warn' },
  { id: 'curada', nome: 'Curada', tone: 'jade' },
];

const vazia = () => ({
  data: hoje(), regiao: 'Joelho', lado: '', status: 'ativa',
  impacto: 'adaptado', prazo: 'nsei',
  comoAconteceu: '', tratamento: '', notas: '', dataCura: '',
});

/* Hoje e ontem cobrem quase todo registro. Data por extenso só
   quando a pessoa lembra de anotar dias depois. */
const QUANDO = [
  { id: 'hoje', nome: 'Hoje', data: () => hoje() },
  { id: 'ontem', nome: 'Ontem', data: () => addDias(hoje(), -1) },
  { id: 'outro', nome: 'Outro dia', data: null },
];

export default function Lesoes() {
  const toast = useToast();
  const { settings, irPara } = useApp();
  const vistasRaw = useLiveQuery(() => db.aulasVistas.toArray(), [], []) || [];
  const vistas = vistasRaw.map((v) => v.videoId);
  const lesoes = useLiveQuery(() => db.injuries.orderBy('data').reverse().toArray(), [], []) || [];
  const [edit, setEdit] = useState(null);
  const [recemSalva, setRecemSalva] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [aba, setAba] = useState('abertas');

  const lista = lesoes.filter((l) => (aba === 'abertas' ? l.status !== 'curada' : l.status === 'curada'));
  const ativas = lesoes.filter((l) => l.status === 'ativa').length;
  const curadas = lesoes.filter((l) => l.status === 'curada').length;
  const porRegiao = useMemo(() => contar(lesoes.map((l) => l.regiao)).slice(0, 6), [lesoes]);

  async function salvar() {
    const l = { ...edit };
    if (l.status === 'curada' && !l.dataCura) l.dataCura = hoje();
    const nova = !l.id;
    if (l.id) await db.injuries.put(l);
    else await db.injuries.add({ ...l, criadoEm: Date.now() });
    setEdit(null);
    toast('Registro salvo');

    /* Quem acabou de se machucar precisa saber duas coisas na
       hora: que não vai perder o que construiu, e o que fazer
       com o tempo parado. */
    if (nova && l.status !== 'curada') setRecemSalva(l);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Lesões</h1>
        </div>
        <Btn variant="primary" icon={Plus} onClick={() => setEdit(vazia())}>Registrar</Btn>
      </div>

      {ativas > 0 && (
        <Card style={{ marginBottom: 14, borderColor: 'color-mix(in srgb, var(--blood) 35%, var(--seam))' }}>
          <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
            <span className="stat-ico" style={{ color: 'var(--blood)', background: 'color-mix(in srgb, var(--blood) 14%, transparent)' }}>
              <TriangleAlert size={16} />
            </span>
            <p className="tiny">
              <b>{ativas === 1 ? '1 lesão ativa.' : `${ativas} lesões ativas.`}</b> <span className="muted">Bate cedo, não rola exausto e não force o que está machucado. A maioria das lesões de joelho no BJJ acontece na fadiga. Isso aqui não substitui médico ou fisioterapeuta.</span>
            </p>
          </div>
        </Card>
      )}

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Card><Stat icon={HeartPulse} valor={lesoes.length} label={lesoes.length === 1 ? 'registro' : 'registros'} /></Card>
        <Card><Stat icon={TriangleAlert} valor={ativas} label={ativas === 1 ? 'ativa' : 'ativas'} tone={ativas ? 'blood' : 'jade'} /></Card>
        <Card><Stat icon={Check} valor={curadas} label={curadas === 1 ? 'curada' : 'curadas'} tone="jade" /></Card>
      </div>

      {porRegiao.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div className="card-head">
            <h2 className="h-sec">Onde você mais se machuca</h2>
            <span className="micro muted">no BJJ: joelho e ombro lideram</span>
          </div>
          <div className="col" style={{ gap: 9 }}>
            {porRegiao.map(([reg, n]) => (
              <div key={reg} className="col" style={{ gap: 4 }}>
                <div className="row tiny"><span style={{ flex: 1 }}>{reg}</span><span className="num micro muted">{n}</span></div>
                <Bar v={n} max={porRegiao[0][1]} tone="blood" />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Seg value={aba} onChange={setAba} options={[{ id: 'abertas', nome: 'Abertas' }, { id: 'curadas', nome: 'Curadas' }, { id: 'recuperacao', nome: 'Recuperação' }]} />
      <div style={{ height: 14 }} />

      {aba === 'recuperacao' ? <Recuperacao /> : lista.length === 0 ? (
        <Card>
          <Empty
            icon={HeartPulse}
            titulo={aba === 'abertas' ? 'Nada machucado' : 'Nenhuma lesão curada registrada'}
            texto="Registrar dor cedo ajuda a ver padrão, se o mesmo ombro dói toda vez que você faz uma raspagem, o problema é técnico, não só físico."
          />
        </Card>
      ) : (
        <div className="grid g-cards">
          {lista.map((l) => {
            const st = STATUS.find((s) => s.id === l.status);
            const dias = l.status === 'curada' && l.dataCura ? diasEntre(l.data, l.dataCura) : diasEntre(l.data, hoje());
            return (
              <Card key={l.id} className="hover" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div className="row wrap" style={{ gap: 6 }}>
                      <Chip tone={st?.tone}>{st?.nome}</Chip>
                      <Chip tone={impactoPorId(l.impacto).tone}>{impactoPorId(l.impacto).nome}</Chip>
                    </div>
                    <h3 className="h-sec" style={{ marginTop: 8 }}>{l.regiao} {l.lado && `(${l.lado})`}</h3>
                    <div className="micro muted" style={{ marginTop: 3 }}>
                      {l.status === 'curada' ? `durou ${dias} ${dias === 1 ? 'dia' : 'dias'}` : `começou ${relativo(l.data)}`}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 2 }}>
                    <button className="btn ghost icon sm" onClick={() => setEdit({ ...l })}><Pencil size={13} /></button>
                    <button className="btn ghost icon sm" onClick={() => setExcluir(l)}><Trash2 size={13} /></button>
                  </div>
                </div>
                {l.comoAconteceu && <p className="tiny muted"><b style={{ color: 'var(--chalk)' }}>Como:</b> {l.comoAconteceu}</p>}
                {l.tratamento && <p className="tiny muted"><b style={{ color: 'var(--chalk)' }}>Tratamento:</b> {l.tratamento}</p>}
                {l.notas && <p className="micro muted">{l.notas}</p>}
                {l.status !== 'curada' && (
                  <Btn size="sm" onClick={() => db.injuries.update(l.id, { status: 'curada', dataCura: hoje() })} style={{ marginTop: 'auto' }}>
                    Marcar como curada
                  </Btn>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        aberto={!!edit}
        onClose={() => setEdit(null)}
        titulo={edit?.id ? 'Editar registro' : 'Registrar lesão ou dor'}
        footer={<><Btn variant="ghost" onClick={() => setEdit(null)}>Cancelar</Btn><Btn variant="primary" icon={Check} onClick={salvar}>Salvar</Btn></>}
      >
        {edit && (
          <>
            <div className="grid g3" style={{ gap: 12 }}>
              <Field label="Quando foi">
                <div className="row wrap" style={{ gap: 7 }}>
                  {QUANDO.map((q) => {
                    const escolhido = q.data
                      ? edit.data === q.data()
                      : edit.data !== hoje() && edit.data !== addDias(hoje(), -1);
                    return (
                      <button key={q.id} type="button"
                        className={`chip ${escolhido ? 'on' : ''}`}
                        style={{ minHeight: 38, paddingInline: 14 }}
                        onClick={() => setEdit({ ...edit, data: q.data ? q.data() : addDias(hoje(), -2) })}>
                        {q.nome}
                      </button>
                    );
                  })}
                </div>
                {edit.data !== hoje() && edit.data !== addDias(hoje(), -1) && (
                  <Input type="date" value={edit.data} max={hoje()} style={{ marginTop: 8 }}
                    onChange={(e) => setEdit({ ...edit, data: e.target.value })} />
                )}
              </Field>
              <Field label="Região">
                <Select value={edit.regiao} onChange={(e) => setEdit({ ...edit, regiao: e.target.value })}>
                  {REGIOES_CORPO.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
              <Field label="Lado">
                <Select value={edit.lado} onChange={(e) => setEdit({ ...edit, lado: e.target.value })}>
                  <option value="">Escolha</option><option value="direito">Direito</option><option value="esquerdo">Esquerdo</option><option value="ambos">Ambos</option>
                </Select>
              </Field>
            </div>
            <Field
              label="Dá pra treinar assim?"
              hint="É isso que muda o que o app faz, não o nome da lesão."
            >
              <div className="col" style={{ gap: 8 }}>
                {IMPACTOS.map((i) => (
                  <button
                    key={i.id} type="button"
                    className={`opcao-meta ${edit.impacto === i.id ? 'on' : ''}`}
                    onClick={() => setEdit({ ...edit, impacto: i.id, prazo: i.treina ? 'nsei' : edit.prazo })}
                  >
                    <div className="tiny" style={{ fontWeight: 600 }}>{i.nome}</div>
                    <p className="micro muted" style={{ marginTop: 3 }}>{i.desc}</p>
                  </button>
                ))}
              </div>
            </Field>

            {edit.impacto === 'parado' && (
              <Field label="Quanto tempo até voltar" hint="Dá pra mudar depois, é só uma previsão.">
                <div className="row wrap" style={{ gap: 7 }}>
                  {PRAZOS.map((p) => (
                    <button key={p.id} type="button"
                      className={`chip ${edit.prazo === p.id ? 'on' : ''}`}
                      style={{ minHeight: 38, paddingInline: 14 }}
                      onClick={() => setEdit({ ...edit, prazo: p.id })}>
                      {p.nome}
                    </button>
                  ))}
                </div>
                {edit.prazo === 'nsei' && (
                  <p className="micro muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                    Sem problema. A lesão fica aberta e fecha sozinha quando você registrar o próximo treino.
                  </p>
                )}
              </Field>
            )}
            <Field label="Como aconteceu"><Input value={edit.comoAconteceu} onChange={(e) => setEdit({ ...edit, comoAconteceu: e.target.value })} placeholder="Ex.: raspagem, o joelho travou" /></Field>
            <Field label="Tratamento"><Input value={edit.tratamento} onChange={(e) => setEdit({ ...edit, tratamento: e.target.value })} placeholder="Fisio, gelo, repouso…" /></Field>
            <Field label="Notas"><Textarea value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} /></Field>
          </>
        )}
      </Modal>

      <Confirmar
        aberto={!!excluir}
        onClose={() => setExcluir(null)}
        onConfirmar={async () => { await db.injuries.delete(excluir.id); toast('Registro excluído'); }}
        titulo="Excluir registro"
        texto="Some do histórico."
      />
    </div>
  );
}

/* ---------- recuperação: o que funciona e o que é hype ---------- */
function Recuperacao() {
  const itens = [
    {
      titulo: 'Sono', nivel: 'bom', tag: 'evidência forte',
      texto: '7 a 9 horas por noite. É a intervenção número um, sem concorrente. Atletas que dormem menos de 8h têm cerca de 70% mais lesões. Estender o sono melhora sprint, precisão e tempo de reação.',
    },
    {
      titulo: 'Comer o suficiente', nivel: 'bom', tag: 'evidência forte',
      texto: 'Proteína e caloria suficientes fazem mais pela sua recuperação do que qualquer aparelho. Déficit agressivo derruba performance e atrasa cicatrização.',
    },
    {
      titulo: 'Descanso ativo e mobilidade', nivel: 'bom', tag: 'evidência boa',
      texto: 'Movimento leve no dia seguinte ajuda mais que ficar parado. Caminhada, mobilidade de quadril e ombro, respiração.',
    },
    {
      titulo: 'Banho QUENTE ou sauna', nivel: 'bom', tag: 'melhor que o gelo',
      texto: 'Para quem treina força, o calor é a escolha melhor: relaxa, aumenta fluxo sanguíneo e NÃO atrapalha o ganho de força e massa. É o oposto do que acontece com o gelo.',
    },
    {
      titulo: 'Banho de GELO logo após treino de força', nivel: 'ruim', tag: 'atrapalha a adaptação',
      texto: 'A evidência atual mostra que imersão em água fria logo depois do treino de força ATENUA o ganho de massa e de força. O frio corta justamente a inflamação que sinaliza a adaptação. Reserve para dia de campeonato com várias lutas seguidas, quando recuperar rápido vale mais que adaptar.',
    },
    {
      titulo: 'Contraste (quente e frio alternado)', nivel: 'atencao', tag: 'meio-termo',
      texto: 'Ajuda na dor muscular e na sensação de recuperação, sem o prejuízo claro do frio isolado. Opção razoável se você gosta.',
    },
    {
      titulo: 'Massagem e compressão', nivel: 'atencao', tag: 'evidência fraca',
      texto: 'Boa para sensação e relaxamento. Não espere ganho mensurável de performance.',
    },
  ];

  return (
    <div className="col" style={{ gap: 10 }}>
      <Card>
        <div className="card-head"><h2 className="h-sec">O que recupera de verdade</h2></div>
        <p className="tiny muted">
          Muita coisa vendida como recuperação não faz nada, e uma delas pode até atrapalhar seu ganho.
          Aqui está o que a evidência atual sustenta, em ordem de impacto.
        </p>
      </Card>

      {itens.map((i) => (
        <Card key={i.titulo} className="hover">
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <Chip tone={i.nivel === 'bom' ? 'jade' : i.nivel === 'ruim' ? 'blood' : 'warn'}>{i.tag}</Chip>
          </div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--display)', fontSize: 15.5, letterSpacing: '-0.02em' }}>{i.titulo}</div>
          <p className="tiny muted" style={{ marginTop: 6 }}>{i.texto}</p>
        </Card>
      ))}

      <Card>
        <p className="micro muted">
          Nada disso substitui médico ou fisioterapeuta. Dor que não passa em dias, inchaço, travamento
          ou perda de força merecem avaliação presencial.
        </p>
      </Card>
      <ParadoEstudando
        aberto={!!recemSalva}
        lesao={recemSalva}
        faixa={settings.faixa}
        vistas={vistas}
        onClose={() => setRecemSalva(null)}
        onEstudar={() => {
          const g = guiaDeEstudo(recemSalva?.regiao);
          setRecemSalva(null);
          irPara('estudo', { tema: g.busque[0] });
        }}
      />

    </div>
  );
}
