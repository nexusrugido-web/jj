import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Info, Droplet, Beef, Salad, Calculator, Clock, Zap, Flame, Minus, Plus, ChevronDown,
  ChevronLeft, ChevronRight, Check, X, CircleHelp, Pencil, Save, Pill, Search,
} from 'lucide-react';
import { useApp } from '../contexto';
import { db } from '../db/db';
import { Card, Btn, Sheet, Field, Input, NumeroInput, Stepper, Busca, useToast } from '../components/UI';
import Guia from '../components/Guia';
import { Vitrine } from '../components/Plano';
import { podeVer } from '../lib/plano';
import {
  contasDaNutricao, paraFechar, todosOsAlimentos, somarDia, chaveDoAlimento, bateuODia,
} from '../lib/nutricao';
import { hoje, addDias, fmtData, relativo, mesNome } from '../lib/utils';

/* ============================================================
   COMBUSTÍVEL PRO JIU-JITSU

   Pelo peso da pessoa: quanto comer (a calculadora), o dia a dia
   (toca no que comeu, a barra enche até a meta), os alimentos e as
   refeições dela, e o mês de proteína num calendário. Suplementação
   fica no fim, fechada. As contas moram em src/lib/nutricao.js.
   ============================================================ */

export default function Nutricao() {
  const { settings, salvarSettings, acesso, irPara } = useApp();
  const [duvidas, setDuvidas] = useState(false);
  const [dia, setDia] = useState(hoje());
  const livre = podeVer(acesso, 'nutricao');
  const treinosSemana = Number(settings.metaSemanal) || 3;
  const contas = useMemo(() => contasDaNutricao(settings.pesoKg, treinosSemana), [settings.pesoKg, treinosSemana]);

  const calculadora = (
    <Calculadora
      contas={contas} settings={settings} treinosSemana={treinosSemana}
      onPeso={(v) => salvarSettings({ pesoKg: v })}
      onTreinos={(v) => salvarSettings({ metaSemanal: v })}
      podeEditar={livre}
    />
  );

  if (!livre) {
    return (
      <div className="page">
        <div className="page-head"><div><h1 className="h-page">Combustível pro jiu-jitsu</h1></div></div>
        {!contas && (
          <Card style={{ marginBottom: 14 }}>
            <Field label="Qual o seu peso? (kg)" hint="O app faz a conta de proteína, carboidrato e água pra você.">
              <NumeroInput valor={settings.pesoKg} onChange={(v) => salvarSettings({ pesoKg: v })} />
            </Field>
          </Card>
        )}
        <Vitrine
          recurso="nutricao"
          fundo={calculadora}
          titulo="Quanto comer pro seu corpo aguentar o tatame, calculado pelo seu peso"
          texto={contas
            ? `Com os seus ${String(contas.peso).replace('.', ',')} kg, o app já fez a conta: quanto de proteína pra reconstruir o que o rola quebra, quanto de carboidrato pra ter gás até o último minuto e quanta água pra não apagar no terceiro round. E todo dia você confere se bateu a proteína, com a comida que já tem em casa.`
            : 'Coloque o seu peso e o app faz a conta: quanto de proteína pra reconstruir o que o rola quebra, quanto de carboidrato pra ter gás até o último minuto e quanta água pra não apagar no terceiro round.'}
          itens={[
            'Proteína, carboidrato, água e cafeína pelo seu peso e pela sua semana de tatame',
            'Bateu a proteína hoje? Toca no que comeu e a barra enche até a sua meta',
            'Seus alimentos e suas refeições salvas: o café da manhã entra com um toque',
            'O mês de proteína num calendário, junto dos seus dias de tatame',
            'Suplementação com estudo: o que a creatina, a beta-alanina e a cafeína fazem no seu corpo e no tatame',
          ]}
          onAssinar={() => irPara('ajustes')}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="h-page">Combustível pro jiu-jitsu</h1></div>
        <Btn icon={Info} onClick={() => setDuvidas(true)}>Dúvidas</Btn>
      </div>

      {calculadora}
      {contas && (
        <>
          <SeuDia dia={dia} setDia={setDia} meta={contas.proteina.min} metaCarbo={contas.carboidrato.min} />
          <MesDaProteina meta={contas.proteina.min} diaAberto={dia} onDia={(d) => { setDia(d); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </>
      )}
      <Suplementos contas={contas} />

      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        As contas seguem as recomendações de nutrição esportiva pra esporte de combate e servem pra quem é saudável.
        Tem condição de saúde, é menor de idade ou vai cortar peso pra competir? Fala com um nutricionista antes.
      </p>

      <Sheet aberto={duvidas} onClose={() => setDuvidas(false)} titulo="Combustível pro jiu-jitsu" wide>
        <Duvidas />
      </Sheet>
    </div>
  );
}

/* ============================================================
   O "?" DE CADA PARTE

   Um toque abre a explicação curta embaixo do título, outro fecha.
   Fica na tela, sem popup: a pessoa lê e já usa.
   ============================================================ */
function Titulo({ texto, ajuda, acao, grande = false }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
        {grande ? <h2 className="h-sec">{texto}</h2> : <h3 className="tiny" style={{ fontWeight: 700 }}>{texto}</h3>}
        {ajuda && (
          <button type="button" className={`nutri-ajuda-btn${aberto ? ' on' : ''}`} aria-label={`O que é ${texto}`} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
            <CircleHelp size={15} />
          </button>
        )}
        <span className="spacer" />
        {acao}
      </div>
      {aberto && <p className="nutri-ajuda micro">{ajuda}</p>}
    </div>
  );
}

/* ============================================================
   SEU DIA DE COMIDA

   Na tela fica só o que a pessoa comeu no dia, com a barra enchendo
   até a meta. Pra anotar: uma rotina inteira com um toque, ou o
   "Adicionar comida", que abre a busca num popup. Quem não quer
   anotar marca "Bati" ou "Não bati" direto. Nada de bronca.

   Um registro por dia na tabela meals. As rotinas (dietPlans) são
   os padrões da pessoa: "Dia de treino", "Dia de descanso", "Café
   da manhã". Quantas quiser.
   ============================================================ */
function SeuDia({ dia, setDia, meta, metaCarbo }) {
  const toast = useToast();
  const meus = useLiveQuery(() => db.foods.toArray(), [], []) || [];
  const rotinas = (useLiveQuery(() => db.dietPlans.toArray(), [], []) || []).filter((r) => !r.arquivada);
  const reg = useLiveQuery(() => db.meals.where('data').equals(dia).first(), [dia]);
  const alimentos = useMemo(() => todosOsAlimentos(meus), [meus]);
  const [adicionar, setAdicionar] = useState(false);
  const [rotina, setRotina] = useState(null);

  const comi = reg?.comi || {};
  const soma = somarDia(comi, alimentos);
  const pct = meta ? Math.min(100, Math.round((soma.proteina / meta) * 100)) : 0;
  const pctC = metaCarbo ? Math.min(100, Math.round((soma.carbo / metaCarbo) * 100)) : 0;
  const bateu = bateuODia({ ...reg, proteina: soma.proteina, meta });
  const ehHoje = dia === hoje();
  const marcados = alimentos.filter((a) => comi[chaveDoAlimento(a)] > 0);

  /* toques rápidos em fila: cada gravação lê o dia de novo antes de mudar */
  const fila = useRef(Promise.resolve());
  const gravar = (mudar) => {
    fila.current = fila.current.then(async () => {
      const atual = await db.meals.where('data').equals(dia).first();
      const novo = mudar({ comi: { ...(atual?.comi || {}) }, marcado: atual?.marcado ?? null });
      const s = somarDia(novo.comi, alimentos);
      const dados = { data: dia, comi: novo.comi, marcado: novo.marcado, proteina: s.proteina, carbo: s.carbo, meta };
      if (atual?.id) await db.meals.update(atual.id, dados);
      else await db.meals.add(dados);
    }).catch((e) => console.error('[nutrição]', e));
  };
  const mudar = (chave, passo) => gravar((r) => ({ ...r, comi: mudarItens(r.comi, chave, passo) }));
  const marcar = (m) => gravar((r) => ({ ...r, marcado: r.marcado === m ? null : m }));
  const usarRotina = (ro) => {
    gravar((r) => {
      for (const [k, n] of Object.entries(ro.itens || {})) r.comi[k] = (Number(r.comi[k]) || 0) + n;
      return r;
    });
    toast(`${ro.nome} entrou no dia. Ajuste o que mudou.`);
  };

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="nutri-dia-nav">
        <button className="btn icon sm" aria-label="Dia anterior" onClick={() => setDia(addDias(dia, -1))}><ChevronLeft size={16} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="eyebrow">{ehHoje ? 'hoje' : relativo(dia)}</div>
          <div className="tiny" style={{ fontWeight: 700 }}>{fmtData(dia)}</div>
        </div>
        <button className="btn icon sm" aria-label="Próximo dia" disabled={ehHoje} onClick={() => setDia(addDias(dia, 1))}><ChevronRight size={16} /></button>
      </div>

      <div className="nutri-meta">
        <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
          <span className="nutri-meta-num num" style={{ color: bateu ? 'var(--jade)' : 'var(--chalk)' }}>{soma.proteina} g</span>
          <span className="tiny muted">de {meta} g de proteína</span>
        </div>
        <div className="bar grossa"><i style={{ width: `${pct}%`, background: bateu ? 'var(--jade)' : 'var(--accent)' }} /></div>
        <div className="micro muted">Carboidrato: <b className="num" style={{ color: 'var(--chalk)' }}>{soma.carbo} g</b> de {metaCarbo} g</div>
        <div className="bar"><i style={{ width: `${pctC}%`, background: 'var(--ice)' }} /></div>
        {ehHoje && soma.proteina > 0 && <p className="tiny" style={{ lineHeight: 1.55 }}>{paraFechar(meta - soma.proteina)}</p>}
      </div>

      <Titulo
        texto="Bateu a proteína?"
        ajuda="Pra quem não quer anotar comida: marque direto se bateu a meta do dia. Se você anotar o que comeu, o app descobre sozinho quando passa da meta, e o que você marcar aqui vale mais que a conta. O dia marcado aparece no seu mês de proteína e no calendário do tatame."
      />
      <div className="nutri-bati">
        <button type="button" className={`sim${reg?.marcado === 'bati' || (bateu && !reg?.marcado) ? ' on' : ''}`} onClick={() => marcar('bati')}>
          <Check size={18} /> Bati
        </button>
        <button type="button" className={`nao${reg?.marcado === 'nao' ? ' on' : ''}`} onClick={() => marcar('nao')}>
          <X size={18} /> Não bati
        </button>
      </div>

      <Titulo
        texto="Minhas rotinas"
        ajuda="Rotina é o que você come de costume, salvo uma vez. Crie quantas quiser: dia de treino, dia de descanso, só o café da manhã. Um toque na rotina coloca tudo dela no dia, e depois é só ajustar o que mudou."
        acao={<button className="btn ghost xs" onClick={() => setRotina({ nome: '', itens: {} })}><Plus size={12} /> Nova rotina</button>}
      />
      {rotinas.length === 0 ? (
        <p className="micro muted" style={{ marginBottom: 16, lineHeight: 1.6 }}>
          Monte o seu dia de sempre uma vez só, e daí em diante ele entra com um toque, sem procurar comida por comida.
        </p>
      ) : (
        <div className="nutri-rotinas">
          {rotinas.map((r) => {
            const s = somarDia(r.itens, alimentos);
            return (
              <div key={r.id} className="nutri-rotina">
                <button type="button" className="nutri-rotina-usar" onClick={() => usarRotina(r)}>
                  <span className="nutri-rotina-mais"><Plus size={15} /></span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span className="tiny" style={{ fontWeight: 700, display: 'block' }}>{r.nome}</span>
                    <span className="micro muted">{s.proteina} g de proteína · {s.carbo} g de carbo</span>
                  </span>
                </button>
                <button type="button" className="nutri-rotina-editar" aria-label={`Editar ${r.nome}`} onClick={() => setRotina(r)}><Pencil size={14} /></button>
              </div>
            );
          })}
        </div>
      )}

      <Titulo
        texto={ehHoje ? 'O que comeu hoje' : 'O que comeu'}
        ajuda="A lista do dia. O mais e o menos mudam a quantidade, e a barra lá em cima acompanha. Pra colocar comida que não está aqui, toque em Adicionar comida e procure pelo nome. Se não achar, dá pra criar o seu alimento com a proteína do rótulo."
        acao={marcados.length > 0 && (
          <button className="btn ghost xs" onClick={() => setRotina({ nome: '', itens: { ...comi } })}><Save size={12} /> Virar rotina</button>
        )}
      />
      {marcados.length === 0 ? (
        <p className="micro muted" style={{ marginBottom: 10 }}>Nada anotado {ehHoje ? 'hoje' : 'neste dia'}.</p>
      ) : (
        <div className="col" style={{ gap: 6, marginBottom: 10 }}>
          {marcados.map((a) => <LinhaDeComida key={chaveDoAlimento(a)} a={a} n={comi[chaveDoAlimento(a)]} onMudar={mudar} />)}
        </div>
      )}
      <Btn variant="contorno" icon={Search} onClick={() => setAdicionar(true)} style={{ width: '100%' }}>Adicionar comida</Btn>

      <Sheet
        aberto={adicionar} onClose={() => setAdicionar(false)} titulo="Adicionar comida"
        subtitulo={`${soma.proteina} de ${meta} g de proteína ${ehHoje ? 'hoje' : 'neste dia'}`}
        footer={<Btn variant="primary" icon={Check} onClick={() => setAdicionar(false)} style={{ width: '100%' }}>Pronto</Btn>}
      >
        {adicionar && <ListaDeComida itens={comi} onMudar={mudar} alimentos={alimentos} />}
      </Sheet>
      <EditorDeRotina rotina={rotina} onClose={() => setRotina(null)} alimentos={alimentos} />
    </Card>
  );
}

/* soma ou tira uma porção; zerou, sai da lista */
function mudarItens(itens, chave, passo) {
  const novo = { ...itens, [chave]: Math.max(0, (Number(itens[chave]) || 0) + passo) };
  if (!novo[chave]) delete novo[chave];
  return novo;
}

function LinhaDeComida({ a, n, onMudar, onEditar }) {
  const k = chaveDoAlimento(a);
  return (
    <div className={`nutri-comida${n ? ' on' : ''}`}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tiny" style={{ fontWeight: 700 }}>
          {a.nome}
          {onEditar && !a.base && (
            <button type="button" className="nutri-editar" aria-label={`Editar ${a.nome}`} onClick={() => onEditar(a)}><Pencil size={11} /></button>
          )}
        </div>
        <div className="micro muted">{a.porcao ? `${a.porcao} · ` : ''}{a.p} g prot{a.c ? ` · ${a.c} g carbo` : ''}</div>
      </div>
      {n > 0 && <button type="button" className="nutri-mais" onClick={() => onMudar(k, -1)} aria-label={`Tirar ${a.nome}`}><Minus size={15} /></button>}
      {n > 0 && <span className="num tiny" style={{ minWidth: 18, textAlign: 'center', fontWeight: 700 }}>{n}</span>}
      <button type="button" className="nutri-mais" onClick={() => onMudar(k, 1)} aria-label={`Mais ${a.nome}`}><Plus size={15} /></button>
    </div>
  );
}

/* ============================================================
   A BUSCA DE COMIDA

   Serve pro dia e pro editor de rotina: busca em cima, os
   alimentos da pessoa primeiro, e o "criar alimento" no próprio
   popup (sem abrir outro por cima).
   ============================================================ */
function ListaDeComida({ itens, onMudar, alimentos }) {
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null);
  const [primeiros] = useState(() => new Set(Object.keys(itens).filter((k) => itens[k] > 0)));
  if (form) return <FormAlimento alimento={form} onPronto={() => setForm(null)} />;

  const termo = busca.trim().toLowerCase();
  /* o que já estava marcado quando abriu vem primeiro (na rotina, é o
     que ela tem). A ordem fica parada: item não pula enquanto a pessoa toca */
  const tem = (x) => (primeiros.has(chaveDoAlimento(x)) ? 0 : 1);
  const lista = (termo ? alimentos.filter((a) => a.nome.toLowerCase().includes(termo)) : alimentos)
    .map((x, i) => [x, i]).sort((p, q) => tem(p[0]) - tem(q[0]) || p[1] - q[1]).map(([x]) => x);
  return (
    <>
      <div className="nutri-busca">
        <Busca value={busca} onChange={setBusca} placeholder="Buscar: ovo, frango, arroz…" />
      </div>
      <button type="button" className="btn ghost xs" style={{ alignSelf: 'flex-start' }} onClick={() => setForm({ nome: busca, porcao: '', p: '', c: '' })}>
        <Plus size={12} /> Criar alimento{busca.trim() ? ` "${busca.trim()}"` : ''}
      </button>
      <div className="col" style={{ gap: 6 }}>
        {lista.map((a) => <LinhaDeComida key={chaveDoAlimento(a)} a={a} n={itens[chaveDoAlimento(a)] || 0} onMudar={onMudar} onEditar={setForm} />)}
      </div>
      {termo && lista.length === 0 && <p className="micro muted">Não achei "{busca}". Crie ele aí em cima, com a proteína do rótulo.</p>}
      <p className="micro muted">Os alimentos de casa seguem a tabela brasileira de alimentos, com valores aproximados.</p>
    </>
  );
}

/* O alimento da pessoa: nome, porção e quanto tem de proteína e
   carboidrato nessa porção. "1 ovo, 6 g" e o app faz o resto. */
function FormAlimento({ alimento, onPronto }) {
  const toast = useToast();
  const [f, setF] = useState(alimento);
  const novo = !f.id;
  const pronto = f.nome.trim() && f.p !== '' && Number(f.p) >= 0;

  async function salvar() {
    const dados = { nome: f.nome.trim(), porcao: String(f.porcao || '').trim(), p: Number(f.p) || 0, c: Number(f.c) || 0, grupo: 'meu', arquivada: 0 };
    if (novo) await db.foods.add(dados); else await db.foods.update(f.id, dados);
    toast(novo ? 'Alimento criado' : 'Alimento salvo');
    onPronto();
  }

  return (
    <>
      <div className="h-sec">{novo ? 'Criar alimento' : 'Editar alimento'}</div>
      <p className="tiny muted" style={{ lineHeight: 1.6 }}>
        Olhe o rótulo ou a tabela e coloque quanto tem numa porção. Exemplo: 1 ovo tem uns 6 g de proteína; 1 pote de iogurte proteico, uns 15 g.
      </p>
      <Field label="Nome"><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Iogurte proteico" /></Field>
      <Field label="Porção" hint="O que conta como 1 toque no mais"><Input value={f.porcao} onChange={(e) => setF({ ...f, porcao: e.target.value })} placeholder="1 pote (160 g)" /></Field>
      <div className="grid g2" style={{ gap: 10 }}>
        <Field label="Proteína (g)"><NumeroInput valor={f.p} vazio="" onChange={(v) => setF({ ...f, p: v })} /></Field>
        <Field label="Carboidrato (g)"><NumeroInput valor={f.c} vazio="" onChange={(v) => setF({ ...f, c: v })} /></Field>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <Btn variant="ghost" onClick={onPronto}>Voltar</Btn>
        {!novo && <Btn variant="ghost" onClick={async () => { await db.foods.update(f.id, { arquivada: 1 }); onPronto(); }}>Apagar</Btn>}
        <span className="spacer" />
        <Btn variant="primary" icon={Check} disabled={!pronto} onClick={salvar}>Salvar</Btn>
      </div>
    </>
  );
}

/* ============================================================
   O EDITOR DE ROTINA

   Nome e o que tem nela, com a mesma busca do dia. Nasce vazia
   ("Nova rotina") ou com o que já foi anotado no dia ("Virar
   rotina").
   ============================================================ */
function EditorDeRotina({ rotina, onClose, alimentos }) {
  const toast = useToast();
  const [r, setR] = useState(null);
  useEffect(() => { setR(rotina ? { ...rotina, itens: { ...(rotina.itens || {}) } } : null); }, [rotina]);
  if (!r) return null;
  const nova = !r.id;
  const soma = somarDia(r.itens, alimentos);
  const temItem = Object.keys(r.itens).length > 0;

  async function salvar() {
    const dados = { nome: r.nome.trim(), itens: r.itens, ativo: 1, arquivada: 0 };
    if (nova) await db.dietPlans.add(dados); else await db.dietPlans.update(r.id, dados);
    toast(nova ? 'Rotina criada' : 'Rotina salva');
    onClose();
  }

  return (
    <Sheet
      aberto onClose={onClose} titulo={nova ? 'Nova rotina' : 'Editar rotina'}
      subtitulo={`${soma.proteina} g de proteína · ${soma.carbo} g de carboidrato`}
      footer={<>
        {!nova && <Btn variant="ghost" onClick={async () => { await db.dietPlans.update(r.id, { arquivada: 1 }); onClose(); }}>Apagar</Btn>}
        <Btn variant="primary" icon={Save} disabled={!r.nome.trim() || !temItem} onClick={salvar}>Salvar rotina</Btn>
      </>}
    >
      <Field label="Nome da rotina"><Input value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value })} placeholder="Dia de treino" /></Field>
      <ListaDeComida itens={r.itens} alimentos={alimentos} onMudar={(k, passo) => setR((x) => ({ ...x, itens: mudarItens(x.itens, k, passo) }))} />
    </Sheet>
  );
}

/* ============================================================
   O MÊS DA PROTEÍNA

   Verde é dia que bateu; contorno é dia anotado que não bateu. Dia
   sem nada fica vazio, sem cobrança. Tocar num dia abre ele em cima.
   ============================================================ */
function MesDaProteina({ meta, onDia, diaAberto }) {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth());
  const regs = useLiveQuery(() => db.meals.toArray(), [], []) || [];
  const porDia = useMemo(() => new Map(regs.map((r) => [r.data, bateuODia(r)])), [regs]);

  const ini = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
  const total = new Date(ano, mes + 1, 0).getDate();
  const vazio = (new Date(ano, mes, 1).getDay() + 6) % 7;
  const dias = Array.from({ length: total }, (_, i) => addDias(ini, i));
  const batidos = dias.filter((d) => porDia.get(d) === true).length;
  const anotados = dias.filter((d) => porDia.get(d) != null).length;
  const hj = hoje();

  const irMes = (delta) => {
    let m = mes + delta, a = ano;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    if (a > agora.getFullYear() || (a === agora.getFullYear() && m > agora.getMonth())) return;
    setMes(m); setAno(a);
  };

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">Toque num dia pra abrir</div>
          <Titulo grande texto="Seu mês de proteína" ajuda="Cada quadrado é um dia. Verde: bateu a proteína. Só o contorno: anotou, mas ficou abaixo da meta. Vazio: não anotou nada, e tudo bem. Tocar num dia abre ele lá em cima, pra ver ou corrigir." />
        </div>
      </div>
      <div className="cal-nav">
        <button className="btn icon" onClick={() => irMes(-1)} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
        <div className="cal-nav-titulo">
          <span className="cal-nav-mes">{mesNome(mes)}</span>
          <span className="cal-nav-ano num">{ano}</span>
        </div>
        <button className="btn icon" onClick={() => irMes(1)} disabled={ano === agora.getFullYear() && mes >= agora.getMonth()} aria-label="Próximo mês"><ChevronRight size={16} /></button>
      </div>
      <p className="tiny muted" style={{ margin: '10px 0' }}>
        {anotados
          ? <>Bateu a proteína em <b style={{ color: 'var(--jade)' }}>{batidos} {batidos === 1 ? 'dia' : 'dias'}</b> de {anotados} anotados.</>
          : `Nenhum dia anotado em ${mesNome(mes).toLowerCase()}.`}
        {meta ? ` Meta de ${meta} g por dia.` : ''}
      </p>
      <div className="cal-grade solo">
        <div className="cal-mes">
          <div className="cal-semana">{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="cal-dias">
            {Array.from({ length: vazio }, (_, i) => <span key={`v${i}`} className="cal-vazio" />)}
            {dias.map((d) => {
              const b = porDia.get(d);
              const futuro = d > hj;
              return (
                <button
                  key={d}
                  className={`cal-dia n0 prot ${b === true ? 'bateu' : b === false ? 'anotado' : ''} ${d === hj ? 'hoje' : ''} ${d === diaAberto ? 'aberto' : ''} ${futuro ? 'futuro' : ''}`}
                  disabled={futuro}
                  onClick={() => onDia(d)}
                >{Number(d.slice(8))}</button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        <span className="micro muted row" style={{ gap: 6 }}><span className="cal-dia prot bateu legenda" /> bateu</span>
        <span className="micro muted row" style={{ gap: 6 }}><span className="cal-dia prot anotado legenda" /> anotado, não bateu</span>
      </div>
    </Card>
  );
}

/* ============================================================
   SUPLEMENTAÇÃO

   Só o que ajuda, e o que cada um faz: no corpo e no tatame. Sem
   veredito de "vale ou não vale" e sem falar do que o app não
   recomenda. A dose sai do peso quando dá, e a fonte vai junto.
   ============================================================ */
function Suplementos({ contas }) {
  const [sanfona, setSanfona] = useState(false);
  const [aberto, setAberto] = useState('creatina');
  const cafe = contas?.cafeina;
  const lista = [
    { id: 'creatina', nome: 'Creatina', dose: '3 a 5 g por dia, todo dia, sem fase de carga',
      resumo: 'O suplemento mais estudado do esporte, e o que mais combina com jiu-jitsu.',
      corpo: [
        'Enche o estoque de energia rápida do músculo, a que acaba nos primeiros segundos de esforço forte.',
        'Ajuda a ganhar força e massa magra junto com o treino de academia.',
        'Também alimenta o cérebro: memória, atenção e raciocínio mais rápidos, principalmente depois de noite mal dormida.',
      ],
      tatame: [
        'Mais explosão na queda, na raspagem e na hora de sair de baixo.',
        'Recupera melhor entre um rola e outro, e entre um treino e o próximo.',
        'Segura a cabeça ligada no fim do treino, quando o cansaço embaralha a técnica.',
      ],
      fonte: 'ISSN (posição sobre creatina) e meta-análise na Frontiers in Nutrition, 2024' },
    { id: 'betaalanina', nome: 'Beta-alanina', dose: '4 a 6 g por dia, divididos em doses de 1,6 g, por pelo menos 4 semanas',
      resumo: 'Segura o braço queimando no fim do round.',
      corpo: [
        'Aumenta a carnosina no músculo, que segura a acidez do esforço forte.',
        'Adia a hora em que o músculo "trava" de cansaço.',
      ],
      tatame: [
        'O efeito aparece em esforços de 1 a 4 minutos, que é o tamanho de um rola.',
        'Pegada e braço aguentam mais no fim do round e no rola seguinte.',
        'Dividir a dose em 1,6 g deixa o formigamento na pele (normal e sem perigo) bem mais leve.',
      ],
      fonte: 'ISSN (posição sobre beta-alanina)' },
    { id: 'cafeina', nome: 'Cafeína',
      dose: cafe ? `uns ${cafe.mg} mg, 1 hora antes (${cafe.xicaras} ${cafe.xicaras === 1 ? 'xícara' : 'xícaras'} de café coado)` : '3 mg por kg, 1 hora antes',
      resumo: 'Mais força e mais fôlego no treino pesado, com o café que você já toma.',
      corpo: [
        'Diminui a sensação de cansaço e deixa o esforço parecer mais leve.',
        'Melhora força, velocidade e resistência em doses de 3 a 6 mg por kg.',
      ],
      tatame: [
        'Mais disposição pro treino da noite depois de um dia inteiro de trabalho.',
        'Reação mais rápida no rola.',
        'Tomada até umas 16h, não atrapalha o sono, que é onde o corpo se recupera.',
      ],
      fonte: 'ISSN (posição sobre cafeína)' },
    { id: 'whey', nome: 'Whey', dose: '1 scoop quando não der pra bater a proteína com comida',
      resumo: 'O jeito mais rápido de fechar a proteína do dia.',
      corpo: [
        'Proteína completa e de digestão rápida, com todos os aminoácidos que o músculo usa pra se reconstruir.',
        'Prático pra quem tem o dia corrido e não consegue comer proteína em toda refeição.',
      ],
      tatame: [
        'Depois do treino, ajuda a consertar o que o rola quebrou.',
        'Bater a proteína do dia deixa você menos dolorido pro próximo treino.',
      ],
      fonte: 'ISSN (posição sobre proteína)' },
    { id: 'kefir', nome: 'Kefir e probióticos', dose: '1 copo de kefir por dia',
      resumo: 'Cuida do intestino, que cuida da imunidade.',
      corpo: [
        'Aumenta as bactérias boas do intestino.',
        'Nos estudos com atletas: menos problema de estômago e menos gripe na época de treino pesado.',
      ],
      tatame: [
        'Menos treino perdido por resfriado e mal-estar.',
        'Ainda soma proteína: um copo tem uns 7 g.',
      ],
      fonte: 'ISSN (posição sobre probióticos) e ensaio com jogadoras de futebol, 2025' },
  ];
  return (
    <Card style={{ marginBottom: 14 }}>
      <button type="button" className="nutri-sanfona" onClick={() => setSanfona(!sanfona)} aria-expanded={sanfona}>
        <span className="stat-ico"><Pill size={15} /></span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div className="eyebrow">Com estudo por trás</div>
          <h2 className="h-sec">Suplementação: o que ajuda</h2>
        </div>
        <ChevronDown size={18} className="muted" style={{ transform: sanfona ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
      </button>
      {sanfona && <div className="col" style={{ gap: 8, marginTop: 12 }}>
        <p className="micro muted" style={{ margin: 0, lineHeight: 1.6 }}>
          O que cada um faz no seu corpo e no tatame. Toque num suplemento pra ver os detalhes e a fonte.
        </p>
        {lista.map((s) => {
          const on = aberto === s.id;
          return (
            <div key={s.id} className="nutri-supl">
              <button type="button" className="nutri-supl-cab" onClick={() => setAberto(on ? null : s.id)} aria-expanded={on}>
                <span className="tiny" style={{ fontWeight: 800, flex: 1, textAlign: 'left' }}>{s.nome}</span>
                <ChevronDown size={17} className="muted" style={{ transform: on ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
              </button>
              <p className="micro" style={{ lineHeight: 1.55 }}>{s.resumo}</p>
              <div className="micro" style={{ fontWeight: 600, color: 'var(--accent)' }}>{s.dose}</div>
              {on && (
                <div className="nutri-ciencia">
                  <div className="micro" style={{ fontWeight: 700 }}>No corpo</div>
                  <ul>{s.corpo.map((c) => <li key={c} className="micro">{c}</li>)}</ul>
                  <div className="micro" style={{ fontWeight: 700, marginTop: 4 }}>No tatame</div>
                  <ul>{s.tatame.map((c) => <li key={c} className="micro">{c}</li>)}</ul>
                  <div className="micro muted">Fonte: {s.fonte}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>}
    </Card>
  );
}

/* ---------- a calculadora: peso e semana entram, as contas saem ---------- */
function Calculadora({ contas, settings, treinosSemana, onPeso, onTreinos, podeEditar }) {
  return (
    <Card className="accent" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow row" style={{ gap: 6 }}><Calculator size={13} /> Feito pro seu corpo</div>
          <Titulo grande texto="Quanto você precisa por dia" ajuda="A conta sai do seu peso e de quantas vezes você treina por semana, seguindo a recomendação de nutrição esportiva pra luta. A meta de proteína do seu dia (a barra logo abaixo) é o número menor da faixa. Mudou de peso? Troque aqui e tudo se ajusta." />
        </div>
      </div>

      {podeEditar && (
        <div className="grid g2" style={{ gap: 10, marginBottom: 14 }}>
          <Field label="Seu peso (kg)"><NumeroInput valor={settings.pesoKg} onChange={onPeso} /></Field>
          <Field label="Treinos por semana"><Stepper value={treinosSemana} onChange={onTreinos} min={1} max={14} /></Field>
        </div>
      )}

      {!contas ? (
        <p className="tiny muted">Coloque o seu peso pra ver a conta.</p>
      ) : (
        <div className="nutri-grade">
          <Numero icone={Beef} tom="blood" rotulo="Proteína" valor={`${contas.proteina.min} a ${contas.proteina.max} g`} conta={contas.proteina.conta} texto={contas.proteina.exemplo} />
          <Numero icone={Zap} tom="accent" rotulo="Carboidrato" valor={`${contas.carboidrato.min} a ${contas.carboidrato.max} g`} conta={contas.carboidrato.conta} texto={contas.carboidrato.porque} />
          <Numero icone={Droplet} tom="ice" rotulo="Água" valor={`${contas.agua.litros} L`} conta={`${String(contas.peso).replace('.', ',')} kg × 35 ml, fora o treino`}
            texto={`Mais uns ${contas.agua.antes[0]} a ${contas.agua.antes[1]} ml nas 4 horas antes do treino. Perder ${contas.agua.limite2} kg de suor (2% do seu peso) já derruba o gás.`} />
        </div>
      )}
    </Card>
  );
}

function Numero({ icone: Icone, tom, rotulo, valor, conta, texto }) {
  return (
    <div className={`nutri-num ${tom}`}>
      <span className="nutri-num-rot"><Icone size={15} /> {rotulo}</span>
      <span className="nutri-num-val num">{valor}</span>
      <span className="nutri-num-conta">{conta}</span>
      <p className="micro muted" style={{ lineHeight: 1.55 }}>{texto}</p>
    </div>
  );
}

function Duvidas() {
  return (
    <Guia topicos={[
      { id: 'caloria', icone: Calculator, titulo: 'Preciso contar caloria?', resumo: 'Não. Bater a proteína já resolve a maior parte',
        conteudo: <p>Contar ao grama exige uns cinco minutos todo dia e quase ninguém mantém. Bater a proteína e não fugir do carboidrato em dia de treino já muda o jogo.</p> },
      { id: 'jejum', icone: Clock, titulo: 'Posso treinar em jejum?', resumo: 'Pode, mas o gás cai e o risco de lesão sobe',
        conteudo: <p>Se o treino é cedo, uma banana ou um pão meia hora antes já resolve. Jejum longo e rola forte não combinam.</p> },
      { id: 'peso', icone: Flame, titulo: 'Vou emagrecer treinando?', resumo: 'Quem decide é o prato, não o treino',
        conteudo: <p>Rolar gasta bastante e dá fome, então é comum compensar sem perceber. Pra perder peso, o caminho é a proteína lá em cima e um pouco menos de carboidrato nos dias sem treino, não cortar comida no dia de rola.</p> },
      { id: 'escorregar', icone: Salad, titulo: 'Escorreguei no fim de semana', resumo: 'Faz parte e não estraga nada',
        conteudo: <p>O que conta é o que você faz na maioria das refeições. Oitenta por cento do tempo bem feito, por anos, ganha de cem por cento por três semanas.</p> },
    ]} />
  );
}
