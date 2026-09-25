import React, { useMemo, useState } from 'react';
import {
  Plus, Target, Trash2, Pencil, Check, Trophy, Sparkles, Clock, X, Minus, Share2,
} from 'lucide-react';
import Figurinha from '../components/Figurinha';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useApp } from '../contexto';
import {
  Card, Btn, Field, Input, NumeroInput, Textarea, Select, Sheet, Chip, Empty, Confirmar, useToast,
  Bar, Seg, Diamante,
} from '../components/UI';
import { SeletorTecnica } from '../components/SeletorTecnica';
import { Ponteira } from '../components/Ponteira';
import LinhaDeMeta from '../components/LinhaDeMeta';
import { minhasTecnicas, meusBuracos, grauPorN, GRAUS } from '../lib/graus';
import { faltaPara } from '../lib/recomendar';
import {
  TIPOS_META, tipoPorId, ORIGENS, sugerirMetas, progressoDaMeta, estadoSemMeta, tituloDaMeta, metaDeHorasNoAno,
  historicoDaMeta,
} from '../lib/metas';
import { POSICOES_INICIAIS } from '../db/scoring';
import { hoje, fmtData, relativo } from '../lib/utils';
import { podeVer, LIMITES } from '../lib/plano';
import { Convite } from '../components/Plano';

const vazia = () => ({
  tipo: 'frequencia',
  titulo: '',
  alvo: 3,
  grauAlvo: 3,
  data: '',
  notas: '',
  origem: 'usuario',
  status: 'ativa',
  inicio: hoje(),
  criadoEm: Date.now(),
});

export default function Metas() {
  const { goals, sessions, rolls, partners, techniques, gradings, categories, positions, settings, salvarSettings, irPara, acesso } = useApp();
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [aba, setAba] = useState('minhas');
  const [story, setStory] = useState(null);
  const [convite, setConvite] = useState(false);
  /* no grátis: as metas que o app sugere, até o limite de ativas.
     Criar a sua própria e passar do limite é do premium. */
  const livre = podeVer(acesso, 'metas');
  const novaMeta = () => (livre ? setEdit(vazia()) : setConvite(true));

  const faixa = settings.faixa || 'branca';
  const tecnicas = useMemo(
    () => minhasTecnicas(rolls, partners, sessions, techniques, faixa, gradings, settings.graus || 0),
    [rolls, partners, sessions, techniques, faixa, gradings, settings.graus]
  );
  const buracos = useMemo(() => meusBuracos(rolls, partners, sessions, faixa), [rolls, partners, sessions, faixa]);

  /* só entram aqui as metas que você assumiu */
  const aulas = useLiveQuery(() => db.aulasVistas.toArray(), [], []) || [];
  const quiz = useLiveQuery(() => db.quizRespostas.toArray(), [], []) || [];

  const minhas = useMemo(
    () => goals.filter((g) => g.origem !== 'sugerida' && g.status !== 'arquivada'),
    [goals]
  );
  const ativas = minhas.filter((g) => g.status === 'ativa');
  const feitas = minhas.filter((g) => g.status === 'concluida');

  const dispensadas = new Set(settings.sugestoesDispensadas || []);
  const sugestoes = useMemo(() => sugerirMetas({
    faixa,
    frequenciaTipica: Number(settings.metaSemanal) || 0,
    objetivo: settings.objetivo || 'lazer',
    tecnicas, buracos, sessions,
  }).filter((s) => {
    const chave = `${s.tipo}:${s.alvo}`;
    if (dispensadas.has(chave)) return false;
    return !minhas.some((m) => m.tipo === s.tipo && String(m.alvo) === String(s.alvo));
  }), [faixa, settings, tecnicas, buracos, sessions, minhas, dispensadas]);

  async function salvar() {
    const g = { ...edit };
    if (g.tipo === 'tecnica' && !g.alvo) return toast('Escolhe a técnica', 'err');
    if (!g.titulo) g.titulo = tituloAutomatico(g);
    if (g.id) await db.goals.put(g);
    else await db.goals.add({ ...g, criadoEm: Date.now() });
    setEdit(null);
    toast('Meta salva');
  }

  async function confirmarSugestao(s) {
    if (!livre && ativas.length >= LIMITES.metasAtivas) return setConvite(true);
    await db.goals.add({
      ...vazia(),
      tipo: s.tipo,
      alvo: s.alvo,
      grauAlvo: s.grauAlvo || 3,
      titulo: s.titulo,
      origem: 'confirmada',
      criadoEm: Date.now(),
    });
    toast('Meta criada');
  }

  async function dispensarSugestao(s) {
    const chave = `${s.tipo}:${s.alvo}`;
    await salvarSettings({ sugestoesDispensadas: [...(settings.sugestoesDispensadas || []), chave] });
  }

  const semMeta = estadoSemMeta(faixa, sessions.length > 0);
  const horasNoAno = useMemo(
    () => (Number(settings.metaAnualHoras) > 0 ? metaDeHorasNoAno(sessions, Number(settings.metaAnualHoras)) : null),
    [sessions, settings.metaAnualHoras]
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Metas</h1>
        </div>
        <Btn variant="primary" icon={Plus} onClick={novaMeta}>Nova meta {!livre && <Diamante />}</Btn>
      </div>

      <Seg value={aba} onChange={setAba} options={[
        { id: 'minhas', nome: `Minhas (${ativas.length})` },
        { id: 'sugestoes', nome: `Sugestões (${sugestoes.length})` },
        { id: 'feitas', nome: `Concluídas (${feitas.length})` },
      ]} />
      <div style={{ height: 14 }} />

      {/* a de horas no ano mora nos Ajustes, mas é meta como as outras */}
      {aba === 'minhas' && horasNoAno && (
        <Card style={{ marginBottom: 14 }}>
          <LinhaDeMeta titulo="Horas no ano" p={horasNoAno} />
          <button className="btn ghost xs" onClick={() => irPara('ajustes')} style={{ marginTop: 6 }}>mudar em Ajustes</button>
        </Card>
      )}

      {aba === 'minhas' && (
        ativas.length === 0 ? (
          <Card>
            <Empty
              icon={Target}
              titulo={semMeta.titulo}
              texto={semMeta.texto}
              acao={
                <Btn variant="primary" icon={Plus}
                  onClick={() => (!sessions.length ? irPara('treinos') : livre ? setEdit(vazia()) : setAba('sugestoes'))}>
                  {sessions.length && !livre ? 'Ver as sugestões' : semMeta.acao}
                </Btn>
              }
            />
            {sugestoes.length > 0 && (
              <p className="tiny muted center" style={{ marginTop: 16 }}>
                O app tem {sugestoes.length} {sugestoes.length === 1 ? 'ideia' : 'ideias'} baseada no seu histórico.
                Elas ficam na aba de sugestões e não valem nada até você aceitar.
              </p>
            )}
          </Card>
        ) : (
          <div className="grid g-cards">
            {ativas.map((g) => (
              <CartaoMeta
                key={g.id} g={g}
                dados={{ sessions, rolls, partners, tecnicas, buracos, aulas, quiz }}
                faixa={faixa}
                onEdit={() => setEdit({ ...g })}
                onDel={() => setExcluir(g)}
                onCompartilhar={(p) => setStory(p.concluida
                  ? { selo: 'meta concluída', grande: tituloDaMeta(g) }
                  : { selo: 'minha meta', grande: p.valor || tituloDaMeta(g), sub: p.valor ? tituloDaMeta(g) : '', pct: p.pct })}
                onConcluir={async () => { await db.goals.update(g.id, { status: 'concluida', concluidaEm: hoje() }); toast('Meta concluída'); }}
                onContar={async (passo) => {
                  /* meta manual guarda o número inteiro; as outras
                     guardam só o ajuste em cima do que foi contado */
                  if (passo === 'zerar') { await db.goals.update(g.id, { ajuste: 0 }); return; }
                  if (g.tipo === 'manual') {
                    await db.goals.update(g.id, { contador: Math.max(0, (g.contador || 0) + passo) });
                  } else {
                    await db.goals.update(g.id, { ajuste: (g.ajuste || 0) + passo });
                  }
                }}
              />
            ))}
          </div>
        )
      )}

      {aba === 'sugestoes' && (
        sugestoes.length === 0 ? (
          <Card>
            <Empty
              icon={Sparkles}
              titulo="Nenhuma sugestão agora"
              texto="As sugestões nascem do que você registra. Com mais treinos anotados, o app começa a ver padrão e aí propõe algo que faça sentido."
            />
          </Card>
        ) : (
          <>
            <Card style={{ marginBottom: 14 }}>
              <p className="tiny muted" style={{ lineHeight: 1.7 }}>
                Isto aqui é ideia do app, não é meta sua. Nada disso conta progresso, cobra ou aparece no painel
                enquanto você não aceitar.
              </p>
            </Card>
            <div className="col" style={{ gap: 12 }}>
              {sugestoes.map((s, i) => (
                <Card key={i} className="hover">
                  <div className="row wrap" style={{ gap: 7, marginBottom: 9 }}>
                    <Chip tone="warn"><Sparkles size={11} /> sugestão</Chip>
                    <Chip>{tipoPorId(s.tipo).nome}</Chip>
                  </div>
                  <h3 className="h-sec">{s.titulo}</h3>
                  <p className="tiny muted" style={{ marginTop: 7, lineHeight: 1.7 }}>{s.porque}</p>
                  <div className="row" style={{ gap: 8, marginTop: 14 }}>
                    <Btn size="sm" variant="primary" icon={Check} onClick={() => confirmarSugestao(s)}>
                      Aceitar como minha meta
                    </Btn>
                    <Btn size="sm" variant="ghost" icon={X} onClick={() => dispensarSugestao(s)}>Dispensar</Btn>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )
      )}

      {aba === 'feitas' && (
        feitas.length === 0 ? (
          <Card><Empty icon={Trophy} titulo="Nada concluído ainda" texto="Quando você fechar uma meta, ela fica guardada aqui." /></Card>
        ) : (
          <div className="col" style={{ gap: 10 }}>
            {feitas.map((g) => (
              <Card key={g.id}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="stat-ico" style={{ color: 'var(--jade)' }}><Check size={15} /></span>
                  <div className="grow">
                    <div className="tiny" style={{ fontWeight: 600 }}>{g.titulo}</div>
                    <div className="micro muted">
                      {ORIGENS[g.origem]?.nome}
                      {g.concluidaEm && `, concluída ${relativo(g.concluidaEm)}`}
                    </div>
                  </div>
                  <button className="btn ghost icon sm" aria-label="Compartilhar"
                    onClick={() => setStory({ selo: 'meta concluída', grande: g.titulo })}><Share2 size={14} /></button>
                  <button className="btn ghost icon sm" onClick={() => setExcluir(g)}><Trash2 size={13} /></button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      <Figurinha aberto={!!story} onClose={() => setStory(null)} dados={story} tipo="meta" />

      {/* criar a própria meta, ou passar do limite, no grátis */}
      <Sheet aberto={convite} onClose={() => setConvite(false)} titulo="">
        <Convite
          recurso="metas"
          icone={Target}
          titulo="Metas do seu jeito"
          texto={`No grátis você assume até ${LIMITES.metasAtivas} metas que o app sugere pelo seu momento. No Premium você cria as suas e acompanha quantas quiser.`}
          itens={[
            'Crie a meta que você quiser, com o seu alvo',
            'Quantas metas ativas precisar',
            'O app continua contando sozinho pelos seus registros',
          ]}
          onAssinar={() => { setConvite(false); irPara('ajustes'); }}
        />
      </Sheet>

      {/* editor */}
      <Sheet
        aberto={!!edit} onClose={() => setEdit(null)}
        titulo={edit?.id ? 'Editar meta' : 'Nova meta'}
        footer={<><Btn variant="ghost" onClick={() => setEdit(null)}>Cancelar</Btn><Btn variant="primary" icon={Check} onClick={salvar}>Salvar</Btn></>}
      >
        {edit && (
          <>
            <Field label="Que tipo de meta">
              <div className="col" style={{ gap: 8 }}>
                {['treino', 'estudo'].map((fam) => (
                  <React.Fragment key={fam}>
                    <div className="eyebrow" style={{ marginTop: fam === 'estudo' ? 8 : 0 }}>
                      {fam === 'treino' ? 'no tatame' : 'estudando'}
                    </div>
                    {TIPOS_META.filter((t) => (t.familia || 'treino') === fam).map((t) => (
                      <button
                        key={t.id} type="button"
                        className={`opcao-meta ${edit.tipo === t.id ? 'on' : ''}`}
                        onClick={() => setEdit({
                          ...edit, tipo: t.id,
                          alvo: t.id === 'frequencia' ? 3
                            : t.id === 'volume' ? 40
                            : t.id === 'aulas' ? 8
                            : t.id === 'quiz' ? 20
                            : t.id === 'rolas' ? 30
                            : t.id === 'treinos' ? 100
                            : t.id === 'manual' ? 25
                            : '',
                        })}
                      >
                        <div className="row" style={{ gap: 7 }}>
                          <span className="tiny" style={{ fontWeight: 600 }}>{t.nome}</span>
                          {!t.processo && <Chip tone="warn">depende de terceiros</Chip>}
                        </div>
                        <p className="micro muted" style={{ marginTop: 4 }}>{t.desc}</p>
                      </button>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </Field>

            {edit.tipo === 'frequencia' && (
              <Field label="Quantas vezes por semana" hint="Melhor começar com o que você já consegue e subir depois.">
                <div className="row wrap" style={{ gap: 7 }}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button key={n} type="button" className={`chip ${Number(edit.alvo) === n ? 'on' : ''}`}
                      style={{ minHeight: 40, paddingInline: 16 }}
                      onClick={() => setEdit({ ...edit, alvo: n })}>{n}x</button>
                  ))}
                </div>
              </Field>
            )}

            {edit.tipo === 'tecnica' && (
              <>
                <Field label="Qual técnica" hint="O app acompanha sozinho pelos seus registros, você não precisa atualizar nada.">
                  <Btn icon={Target} onClick={() => setSeletorAberto(true)} style={{ width: '100%', justifyContent: 'flex-start' }}>
                    {edit.alvo || 'Escolher da biblioteca'}
                  </Btn>
                </Field>
                <Field label="Chegar até qual grau">
                  <div className="row wrap" style={{ gap: 7 }}>
                    {GRAUS.slice(2).map((g) => (
                      <button key={g.n} type="button" className={`chip ${Number(edit.grauAlvo) === g.n ? 'on' : ''}`}
                        style={{ minHeight: 40, paddingInline: 14 }}
                        onClick={() => setEdit({ ...edit, grauAlvo: g.n })}>
                        <Ponteira n={g.n} mini /> {g.nome}
                      </button>
                    ))}
                  </div>
                </Field>
                {edit.alvo && (() => {
                  const t = tecnicas.find((x) => x.nome === edit.alvo);
                  if (!t) return <p className="micro muted">Essa técnica ainda não apareceu nos seus registros. Assim que aparecer, o acompanhamento começa.</p>;
                  const f = faltaPara(t, faixa);
                  return (
                    <div className="valida bom">
                      <Target size={14} className="valida-ico" style={{ color: 'var(--jade)' }} />
                      <div>
                        <div className="tiny" style={{ fontWeight: 600 }}>Hoje ela está no {grauPorN(t.grau).nome}</div>
                        {f && <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{f.texto}</p>}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {edit.tipo === 'defesa' && (
              <Field label="Qual técnica está te pegando">
                <Select value={edit.alvo || ''} onChange={(e) => setEdit({ ...edit, alvo: e.target.value })}>
                  <option value="">Escolha</option>
                  {buracos.map((b) => (
                    <option key={b.nome} value={b.nome}>{b.nome} ({b.vezes}x)</option>
                  ))}
                </Select>
              </Field>
            )}

            {['treinos', 'manual'].includes(edit.tipo) && (
              <Field
                label={edit.tipo === 'treinos' ? 'Quantos treinos no total' : 'Chegar a quanto'}
                hint={edit.tipo === 'treinos'
                  ? 'Conta todos os treinos que você já registrou.'
                  : 'Você mesmo soma e subtrai no card da meta.'}
              >
                <div className="row wrap" style={{ gap: 7 }}>
                  {(edit.tipo === 'treinos' ? [50, 100, 200, 365] : [10, 25, 50, 100]).map((n) => (
                    <button key={n} type="button" className={`chip ${Number(edit.alvo) === n ? 'on' : ''}`}
                      style={{ minHeight: 40, paddingInline: 16 }}
                      onClick={() => setEdit({ ...edit, alvo: n })}>{n}</button>
                  ))}
                </div>
                <NumeroInput
                  min="1" valor={edit.alvo || ''} style={{ marginTop: 8 }}
                  onChange={(v) => setEdit({ ...edit, alvo: v })}
                  placeholder="ou digite outro número"
                />
              </Field>
            )}

            {['aulas', 'quiz', 'rolas'].includes(edit.tipo) && (
              <Field
                label={edit.tipo === 'aulas' ? 'Quantas aulas' : edit.tipo === 'quiz' ? 'Quantos acertos' : 'Quantos rolas'}
                hint="Conta nos últimos 30 dias."
              >
                <div className="row wrap" style={{ gap: 7 }}>
                  {(edit.tipo === 'aulas' ? [4, 8, 12, 20] : edit.tipo === 'quiz' ? [10, 20, 40, 60] : [10, 20, 30, 50]).map((n) => (
                    <button key={n} type="button" className={`chip ${Number(edit.alvo) === n ? 'on' : ''}`}
                      style={{ minHeight: 40, paddingInline: 16 }}
                      onClick={() => setEdit({ ...edit, alvo: n })}>{n}</button>
                  ))}
                </div>
              </Field>
            )}

            {edit.tipo === 'posicao' && (
              <>
                <Field label="Qual posição">
                  <Select value={edit.alvo || ''} onChange={(e) => setEdit({ ...edit, alvo: e.target.value })}>
                    <option value="">Escolha</option>
                    {POSICOES_INICIAIS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </Select>
                </Field>
                <Field label="Quantos rolas começando daí">
                  <div className="row wrap" style={{ gap: 7 }}>
                    {[5, 10, 20, 30].map((n) => (
                      <button key={n} type="button" className={`chip ${Number(edit.quantidade) === n ? 'on' : ''}`}
                        style={{ minHeight: 40, paddingInline: 16 }}
                        onClick={() => setEdit({ ...edit, quantidade: n })}>{n}</button>
                    ))}
                  </div>
                </Field>
              </>
            )}

            {edit.tipo === 'volume' && (
              <Field label="Quantas horas" hint="Serve mais pra olhar depois do que pra perseguir no dia a dia.">
                <NumeroInput valor={edit.alvo} onChange={(v) => setEdit({ ...edit, alvo: v })} />
              </Field>
            )}

            {edit.tipo === 'competicao' && (
              <>
                <Field label="Qual campeonato"><Input value={edit.alvo || ''} onChange={(e) => setEdit({ ...edit, alvo: e.target.value })} /></Field>
                <Field label="Data"><Input type="date" value={edit.data || ''} onChange={(e) => setEdit({ ...edit, data: e.target.value })} /></Field>
              </>
            )}

            <Field label="Título" hint="Deixe vazio que o app preenche.">
              <Input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })}
                placeholder={tituloAutomatico(edit)} />
            </Field>
            <Field label="Notas"><Textarea value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} /></Field>
          </>
        )}
      </Sheet>

      <SeletorTecnica
        aberto={seletorAberto} onClose={() => setSeletorAberto(false)}
        techniques={techniques} categories={categories} positions={positions}
        faixa={faixa} titulo="Qual técnica você quer subir de grau"
        onEscolher={(t) => setEdit({ ...edit, alvo: t.nome })}
      />

      <Confirmar
        aberto={!!excluir} onClose={() => setExcluir(null)}
        onConfirmar={async () => {
          await db.goals.delete(excluir.id);
          /* meta que veio de sugestão e foi apagada não volta como sugestão */
          if (excluir.origem === 'confirmada' && excluir.alvo !== undefined) {
            const chave = `${excluir.tipo}:${excluir.alvo}`;
            const ja = settings.sugestoesDispensadas || [];
            if (!ja.includes(chave)) await salvarSettings({ sugestoesDispensadas: [...ja, chave] });
          }
          toast('Meta removida');
        }}
        titulo="Remover meta" texto="Ela some da lista."
      />
    </div>
  );
}

function tituloAutomatico(g) {
  if (!g) return '';
  if (g.tipo === 'frequencia') return `Treinar ${g.alvo}x por semana`;
  if (g.tipo === 'tecnica') return `Levar ${g.alvo || 'a técnica'} pro ${grauPorN(g.grauAlvo).nome}`;
  if (g.tipo === 'defesa') return `Parar de ser pego na ${String(g.alvo || '').toLowerCase()}`;
  if (g.tipo === 'volume') return `${g.alvo}h de tatame`;
  if (g.tipo === 'competicao') return g.alvo || 'Competir';
  return '';
}

function CartaoMeta({ g, dados, faixa, onEdit, onDel, onConcluir, onContar, onCompartilhar }) {
  const p = progressoDaMeta(g, dados);
  const tipo = tipoPorId(g.tipo);
  const t = g.tipo === 'tecnica' ? dados.tecnicas.find((x) => x.nome === g.alvo) : null;
  const falta = t ? faltaPara(t, faixa) : null;
  const historico = historicoDaMeta(g, dados);
  const [verHistorico, setVerHistorico] = useState(false);

  return (
    <Card className="hover" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* título na largura toda: os botões ficam na linha dos selos */}
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="row wrap" style={{ gap: 6, flex: 1, minWidth: 0 }}>
          {/* no celular estreito o nome do tipo encurta com reticências em vez de
              passar por baixo dos botões */}
          <Chip tone={tipo.processo ? 'jade' : 'warn'} title={tipo.nome} style={{ maxWidth: '100%', minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{tipo.nome}</span>
          </Chip>
          {p.concluida && <Chip tone="jade"><Check size={11} /> feita</Chip>}
        </div>
        <div className="row" style={{ gap: 2, flex: 'none' }}>
          <button className="btn ghost icon sm" aria-label="Compartilhar" onClick={() => onCompartilhar(p)}><Share2 size={14} /></button>
          <button className="btn ghost icon sm" onClick={onEdit}><Pencil size={14} /></button>
          <button className="btn ghost icon sm" onClick={onDel}><Trash2 size={14} /></button>
        </div>
      </div>
      <h3 className="h-sec" style={{ marginTop: -4 }}>{tituloDaMeta(g)}</h3>

      {g.tipo === 'tecnica' && t && (
        <div className="row" style={{ gap: 9 }}>
          <Ponteira n={t.grau} />
          <span className="tiny muted">{grauPorN(t.grau).curto}</span>
        </div>
      )}

      {/* o quanto já andou, em número e em barra; embaixo, a conta e de onde veio a meta */}
      <div className="col" style={{ gap: 8 }}>
        {p.valor !== 'sem técnica' && (
          <div className="meta-prog">
            <span className={`meta-pct num ${p.pct >= 100 ? 'feita' : ''}`}>{Math.min(100, Math.round(p.pct || 0))}%</span>
            <div style={{ flex: 1 }}><Bar v={p.pct} max={100} tone={p.pct >= 100 ? 'jade' : ''} /></div>
          </div>
        )}
        <span className="tiny">{p.texto}</span>
        <span className="micro muted">{[p.quando, ORIGENS[g.origem]?.nome || 'Você criou'].filter(Boolean).join(' · ')}</span>
      </div>

      {/* por que zerou: a última vez fica à vista, as outras abrem embaixo */}
      {historico.length > 0 && (
        <div className="meta-zerou">
          {g.tipo === 'defesa' && (
            <p className="micro" style={{ lineHeight: 1.6 }}>
              <b>Zerou em {fmtData(historico[0].data, { curto: true })}:</b> <span className="muted">{historico[0].texto}</span>
            </p>
          )}
          <button type="button" className="btn ghost xs" style={{ alignSelf: 'flex-start' }} onClick={() => setVerHistorico(!verHistorico)}>
            <Clock size={13} /> {g.tipo === 'frequencia' ? 'Semanas anteriores' : 'Quando zerou'} ({historico.length})
          </button>
          {verHistorico && (
            <ol className="meta-zerou-lista">
              {historico.map((h, i) => (
                <li key={i} className={h.batida ? 'batida' : ''}>
                  <span className="micro num muted">{fmtData(h.data, { curto: true })}</span>
                  <div>
                    <div className="micro" style={{ fontWeight: 600 }}>{h.texto}</div>
                    <div className="micro muted">{h.detalhe}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {p.conta && !p.semBotao && typeof p.atual === 'number' && (
        <div className="contador">
          <button
            className="contador-btn"
            onClick={() => onContar(-1)}
            disabled={p.atual <= 0}
            aria-label="Tirar um"
          >
            <Minus size={16} />
          </button>

          <div className="contador-meio">
            <div className="contador-num num">{p.atual}</div>
            {p.manual ? (
              <span className="micro muted">na mão</span>
            ) : p.ajuste ? (
              <span className="micro" style={{ color: 'var(--accent)' }}>
                {p.ajuste > 0 ? '+' : ''}{p.ajuste} que você somou
              </span>
            ) : (
              <span className="micro muted">contado sozinho</span>
            )}
          </div>

          <button className="contador-btn mais" onClick={() => onContar(1)} aria-label="Somar um">
            <Plus size={16} />
          </button>
        </div>
      )}

      {p.conta && !p.semBotao && !p.manual && !!p.ajuste && (
        <button className="btn ghost xs" onClick={() => onContar('zerar')} style={{ alignSelf: 'flex-start' }}>
          Voltar pro número contado
        </button>
      )}

      {falta && t && t.grau < (g.grauAlvo || 3) && (
        <p className="micro muted" style={{ lineHeight: 1.6 }}>{falta.texto}</p>
      )}

      {g.notas && <p className="micro muted" style={{ borderTop: '1px solid var(--seam)', paddingTop: 9 }}>{g.notas}</p>}

      {!p.concluida && p.pct >= 100 && (
        <Btn size="sm" variant="primary" icon={Check} onClick={onConcluir}>Marcar como concluída</Btn>
      )}
    </Card>
  );
}
