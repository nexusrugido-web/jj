import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Info, Droplet, Beef, Salad, Calculator, Clock, Zap, Flame, Minus, Plus, ChevronDown,
  ChevronLeft, ChevronRight, Check, X, CircleHelp, Pencil, Save, Pill,
} from 'lucide-react';
import { useApp } from '../contexto';
import { db } from '../db/db';
import { Card, Btn, Sheet, Field, Input, NumeroInput, Stepper, Chip, Busca, useToast } from '../components/UI';
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
            'Suplementação com estudo: creatina, beta-alanina, cafeína pelo seu peso, e o que é só propaganda',
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
   SEU DIA DE COMIDA

   Toca no que comeu e a barra enche até a meta de proteína. Nada de
   bronca: é a ferramenta pra saber se está batendo. Quem não quer
   anotar comida marca "bati" ou "não bati" direto. Fica guardado na
   conta (tabela meals, um registro por dia), e o dia aparece no
   calendário daqui e no de presença do tatame.

   As refeições salvas (dietPlans) são o atalho: "café da manhã" com
   três ovos e um copo de leite entra inteiro com um toque.
   ============================================================ */
function SeuDia({ dia, setDia, meta, metaCarbo }) {
  const toast = useToast();
  const meus = useLiveQuery(() => db.foods.toArray(), [], []) || [];
  const refeicoes = useLiveQuery(() => db.dietPlans.toArray(), [], []) || [];
  const reg = useLiveQuery(() => db.meals.where('data').equals(dia).first(), [dia]);
  const alimentos = useMemo(() => todosOsAlimentos(meus), [meus]);
  const [busca, setBusca] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const [editar, setEditar] = useState(null);
  const [salvarRefeicao, setSalvarRefeicao] = useState(false);

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
  const mudar = (chave, passo) => gravar((r) => {
    r.comi[chave] = Math.max(0, (Number(r.comi[chave]) || 0) + passo);
    if (!r.comi[chave]) delete r.comi[chave];
    return r;
  });
  const marcar = (m) => gravar((r) => ({ ...r, marcado: r.marcado === m ? null : m }));
  const usarRefeicao = (ref) => {
    gravar((r) => {
      for (const [k, n] of Object.entries(ref.itens || {})) r.comi[k] = (Number(r.comi[k]) || 0) + n;
      return r;
    });
    toast(`${ref.nome} entrou no dia`);
  };

  const termo = busca.trim().toLowerCase();
  /* a lista curta: os da pessoa, o que já está marcado e os de casa
     mais comuns. O resto abre no "ver todos" ou na busca. */
  const COMUNS = ['frango', 'ovo', 'carne', 'arroz', 'feijao', 'leite'];
  const lista = termo ? alimentos.filter((a) => a.nome.toLowerCase().includes(termo))
    : verTodos ? alimentos
      : alimentos.filter((a) => !a.base || comi[chaveDoAlimento(a)] > 0 || COMUNS.includes(a.id));

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
          {bateu && <Chip tone="jade" style={{ marginLeft: 'auto' }}><Check size={12} /> bateu</Chip>}
        </div>
        <div className="bar grossa"><i style={{ width: `${pct}%`, background: bateu ? 'var(--jade)' : 'var(--accent)' }} /></div>
        <div className="row micro muted" style={{ gap: 8 }}>
          <span>Carboidrato: <b className="num" style={{ color: 'var(--chalk)' }}>{soma.carbo} g</b> de {metaCarbo} g</span>
        </div>
        <div className="bar"><i style={{ width: `${pctC}%`, background: 'var(--ice)' }} /></div>
        {ehHoje && soma.proteina > 0 && <p className="tiny" style={{ lineHeight: 1.55 }}>{paraFechar(meta - soma.proteina)}</p>}
      </div>

      <p className="micro muted" style={{ marginBottom: 8 }}>Sem tempo de anotar? Marque direto:</p>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <Chip on={reg?.marcado === 'bati'} onClick={() => marcar('bati')} tone={reg?.marcado === 'bati' ? 'jade' : ''}><Check size={12} /> Bati</Chip>
        <Chip on={reg?.marcado === 'nao'} onClick={() => marcar('nao')}>Não bati</Chip>
      </div>

      <div className="card-head" style={{ marginBottom: 8 }}>
        <h3 className="tiny" style={{ fontWeight: 700 }}>Minhas refeições</h3>
        {marcados.length > 0 && (
          <button className="btn ghost xs" onClick={() => setSalvarRefeicao(true)}><Save size={12} /> Salvar o que marquei</button>
        )}
      </div>
      {refeicoes.filter((r) => !r.arquivada).length === 0 ? (
        <p className="micro muted" style={{ marginBottom: 14, lineHeight: 1.6 }}>
          Marque o que você come sempre junto (o café da manhã, o prato do almoço) e toque em "Salvar o que marquei".
          Depois ele entra inteiro com um toque.
        </p>
      ) : (
        <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
          {refeicoes.filter((r) => !r.arquivada).map((r) => (
            <span key={r.id} className="nutri-refeicao">
              <button type="button" onClick={() => usarRefeicao(r)}><Plus size={13} /> {r.nome}
                <span className="micro muted num"> {somarDia(r.itens, alimentos).proteina} g</span></button>
              <button type="button" aria-label={`Apagar ${r.nome}`} onClick={() => db.dietPlans.update(r.id, { arquivada: 1 })}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      <div className="card-head" style={{ marginBottom: 8 }}>
        <h3 className="tiny" style={{ fontWeight: 700 }}>O que você comeu</h3>
        <button className="btn ghost xs" onClick={() => setEditar({ nome: '', porcao: '', p: '', c: '' })}><Plus size={12} /> Criar alimento</button>
      </div>
      <div style={{ display: 'flex', marginBottom: 10 }}><Busca value={busca} onChange={setBusca} placeholder="Buscar alimento" /></div>
      <div className="nutri-comidas">
        {lista.map((a) => {
          const k = chaveDoAlimento(a);
          const n = Number(comi[k]) || 0;
          return (
            <div key={k} className={`nutri-comida${n ? ' on' : ''}`}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tiny" style={{ fontWeight: 700 }}>
                  {a.nome}
                  {!a.base && (
                    <button type="button" className="nutri-editar" aria-label={`Editar ${a.nome}`} onClick={() => setEditar(a)}><Pencil size={11} /></button>
                  )}
                </div>
                <div className="micro muted">{a.porcao ? `${a.porcao} · ` : ''}{a.p} g prot{a.c ? ` · ${a.c} g carbo` : ''}</div>
              </div>
              {n > 0 && <button type="button" className="nutri-mais" onClick={() => mudar(k, -1)} aria-label={`Tirar ${a.nome}`}><Minus size={15} /></button>}
              {n > 0 && <span className="num tiny" style={{ minWidth: 18, textAlign: 'center', fontWeight: 700 }}>{n}</span>}
              <button type="button" className="nutri-mais" onClick={() => mudar(k, 1)} aria-label={`Mais ${a.nome}`}><Plus size={15} /></button>
            </div>
          );
        })}
      </div>
      {!termo && lista.length < alimentos.length && (
        <button className="btn ghost xs" style={{ marginTop: 8 }} onClick={() => setVerTodos(true)}>
          Ver todos os alimentos ({alimentos.length}) <ChevronDown size={12} />
        </button>
      )}
      {termo && lista.length === 0 && (
        <p className="micro muted" style={{ marginTop: 8 }}>
          Não achei "{busca}". <button className="btn ghost xs" onClick={() => setEditar({ nome: busca, porcao: '', p: '', c: '' })}>Criar "{busca}"</button>
        </p>
      )}
      <p className="micro muted" style={{ marginTop: 10 }}>Os alimentos de casa seguem a tabela brasileira de alimentos, com valores aproximados.</p>

      <CriarAlimento alimento={editar} onClose={() => setEditar(null)} />
      <SalvarRefeicao
        aberto={salvarRefeicao} onClose={() => setSalvarRefeicao(false)}
        itens={comi} marcados={marcados}
      />
    </Card>
  );
}

/* O alimento da pessoa: nome, porção e quanto tem de proteína e
   carboidrato nessa porção. "1 ovo, 6 g" e o app faz o resto. */
function CriarAlimento({ alimento, onClose }) {
  const toast = useToast();
  const [f, setF] = useState(null);
  useEffect(() => { setF(alimento ? { ...alimento } : null); }, [alimento]);
  if (!f) return null;
  const novo = !f.id;
  const pronto = f.nome.trim() && Number(f.p) >= 0 && f.p !== '';

  async function salvar() {
    const dados = { nome: f.nome.trim(), porcao: f.porcao.trim(), p: Number(f.p) || 0, c: Number(f.c) || 0, grupo: 'meu', arquivada: 0 };
    if (novo) await db.foods.add(dados); else await db.foods.update(f.id, dados);
    toast(novo ? 'Alimento criado' : 'Alimento salvo');
    onClose();
  }

  return (
    <Sheet
      aberto onClose={onClose} titulo={novo ? 'Criar alimento' : 'Editar alimento'}
      footer={<>
        {!novo && <Btn variant="ghost" onClick={async () => { await db.foods.update(f.id, { arquivada: 1 }); onClose(); }}>Apagar</Btn>}
        <Btn variant="primary" icon={Check} disabled={!pronto} onClick={salvar}>Salvar</Btn>
      </>}
    >
      <p className="tiny muted" style={{ lineHeight: 1.6 }}>
        Olhe o rótulo ou a tabela e coloque quanto tem numa porção. Exemplo: 1 ovo tem uns 6 g de proteína; 1 pote de iogurte proteico, uns 15 g.
      </p>
      <Field label="Nome"><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Iogurte proteico" autoFocus /></Field>
      <Field label="Porção" hint="O que conta como 1 toque"><Input value={f.porcao} onChange={(e) => setF({ ...f, porcao: e.target.value })} placeholder="1 pote (160 g)" /></Field>
      <div className="grid g2" style={{ gap: 10 }}>
        <Field label="Proteína (g)"><NumeroInput valor={f.p} vazio="" onChange={(v) => setF({ ...f, p: v })} /></Field>
        <Field label="Carboidrato (g)"><NumeroInput valor={f.c} vazio="" onChange={(v) => setF({ ...f, c: v })} /></Field>
      </div>
    </Sheet>
  );
}

function SalvarRefeicao({ aberto, onClose, itens, marcados }) {
  const toast = useToast();
  const [nome, setNome] = useState('');
  useEffect(() => { if (aberto) setNome(''); }, [aberto]);
  const soma = somarDia(itens, marcados);
  return (
    <Sheet
      aberto={aberto} onClose={onClose} titulo="Salvar como refeição"
      footer={<Btn variant="primary" icon={Save} disabled={!nome.trim()} onClick={async () => {
        await db.dietPlans.add({ nome: nome.trim(), itens: { ...itens }, ativo: 1, arquivada: 0 });
        toast('Refeição salva');
        onClose();
      }}>Salvar</Btn>}
    >
      <Field label="Nome da refeição"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Café da manhã" autoFocus /></Field>
      <ul className="nutri-itens">
        {marcados.map((a) => <li key={chaveDoAlimento(a)} className="tiny">{itens[chaveDoAlimento(a)]}× {a.nome}</li>)}
      </ul>
      <p className="micro muted">Dá {soma.proteina} g de proteína e {soma.carbo} g de carboidrato.</p>
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
          <h2 className="h-sec">Seu mês de proteína</h2>
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
   SUPLEMENTAÇÃO: O QUE VALE

   Veredito na frente, e quem quiser abre o que a ciência diz, com
   a fonte. Nada de "turbina", "explode" ou promessa: o que tem
   estudo, a dose pelo peso e o que é só propaganda.
   ============================================================ */
function Suplementos({ contas }) {
  const [sanfona, setSanfona] = useState(false);
  const [aberto, setAberto] = useState('creatina');
  const cafe = contas?.cafeina;
  const lista = [
    { id: 'creatina', nome: 'Creatina', nota: 'vale', dose: '3 a 5 g por dia, todo dia, sem fase de carga',
      resumo: 'O suplemento mais estudado do esporte, e o que mais combina com jiu-jitsu.',
      ciencia: [
        'Mais força e mais potência, e ajuda a aguentar treino pesado com recuperação melhor entre um treino e outro.',
        'Também é combustível pro cérebro: uma meta-análise de 2024 viu memória, atenção e rapidez de raciocínio melhores com creatina.',
        'Protege o raciocínio depois de uma noite mal dormida, que é a noite antes de quase todo treino cedo.',
        'Segura nas doses recomendadas e não precisa ciclar. Atenção pra quem compete: ela segura um pouco de água no músculo, e a balança sobe perto de 1 kg.',
      ],
      fonte: 'ISSN (posição sobre creatina) e meta-análise na Frontiers in Nutrition, 2024' },
    { id: 'betaalanina', nome: 'Beta-alanina', nota: 'vale', dose: '4 a 6 g por dia, divididos em doses de 1,6 g, por pelo menos 4 semanas',
      resumo: 'Pra quem rola forte ou compete: segura o braço queimando no fim do round.',
      ciencia: [
        'Aumenta a carnosina no músculo, que segura a acidez do esforço forte.',
        'O efeito aparece mais em esforços de 1 a 4 minutos, que é o tamanho de um rola.',
        'Leva de 2 a 4 semanas pra fazer efeito: não adianta tomar só no dia da luta.',
        'O formigamento na pele é normal e sem perigo. Dividir a dose em 1,6 g diminui.',
      ],
      fonte: 'ISSN (posição sobre beta-alanina)' },
    { id: 'cafeina', nome: 'Cafeína', nota: 'vale',
      dose: cafe ? `uns ${cafe.mg} mg, 1 hora antes (${cafe.xicaras} ${cafe.xicaras === 1 ? 'xícara' : 'xícaras'} de café coado)` : '3 mg por kg, 1 hora antes',
      resumo: 'Mais força e mais fôlego no treino pesado, com o café que você já toma.',
      ciencia: [
        'De 3 a 6 mg por kg melhora força, velocidade e resistência; começa pela menor dose.',
        'Mais que 9 mg por kg só aumenta tremedeira e taquicardia, sem ganho nenhum.',
        'Depois das 16h atrapalha o sono, e sono ruim cobra mais do que o café entrega.',
      ],
      fonte: 'ISSN (posição sobre cafeína)' },
    { id: 'whey', nome: 'Whey', nota: 'depende', dose: '1 scoop quando não der pra bater a proteína com comida',
      resumo: 'É só proteína em pó, prática. Não faz nada que um filé de frango não faça.',
      ciencia: ['O que importa é a proteína do dia inteiro. O whey só é o jeito mais rápido de fechar a conta.'],
      fonte: 'ISSN (posição sobre proteína)' },
    { id: 'kefir', nome: 'Kefir e probióticos', nota: 'depende', dose: '1 copo de kefir por dia',
      resumo: 'Bom hábito pro intestino, não milagre.',
      ciencia: [
        'Nos estudos com atletas: menos problema de estômago e menos gripe na época de treino pesado.',
        'Em jogadoras de futebol, o kefir aumentou as bactérias boas do intestino.',
      ],
      fonte: 'ISSN (posição sobre probióticos) e ensaio com jogadoras de futebol, 2025' },
    { id: 'bcaa', nome: 'BCAA', nota: 'nao', dose: 'não precisa',
      resumo: 'Se você bate a proteína do dia, o BCAA já veio junto. É pagar duas vezes pela mesma coisa.',
      ciencia: ['Os aminoácidos do BCAA já estão em qualquer proteína completa: carne, ovo, leite, whey.'],
      fonte: 'ISSN (posição sobre proteína)' },
    { id: 'termogenico', nome: 'Termogênico', nota: 'nao', dose: 'não vale',
      resumo: 'O que emagrece é o prato. O termogênico acelera o coração e atrapalha o sono.',
      ciencia: ['A maioria é cafeína cara com outros estimulantes. O café resolve a parte que funciona, pagando bem menos.'],
      fonte: 'ISSN (posição sobre cafeína)' },
  ];
  const ICONE = { vale: Check, depende: CircleHelp, nao: X };
  const ROTULO = { vale: 'Vale', depende: 'Depende', nao: 'Não vale' };
  return (
    <Card style={{ marginBottom: 14 }}>
      <button type="button" className="nutri-sanfona" onClick={() => setSanfona(!sanfona)} aria-expanded={sanfona}>
        <span className="stat-ico"><Pill size={15} /></span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div className="eyebrow">Sem propaganda, com estudo</div>
          <h2 className="h-sec">Suplementação: o que vale</h2>
        </div>
        <ChevronDown size={18} className="muted" style={{ transform: sanfona ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
      </button>
      {sanfona && <div className="col" style={{ gap: 8, marginTop: 12 }}>
        {lista.map((s) => {
          const I = ICONE[s.nota];
          const on = aberto === s.id;
          return (
            <div key={s.id} className={`nutri-supl ${s.nota}`}>
              <button type="button" className="nutri-supl-cab" onClick={() => setAberto(on ? null : s.id)} aria-expanded={on}>
                <span className="nutri-supl-selo"><I size={13} /> {ROTULO[s.nota]}</span>
                <span className="tiny" style={{ fontWeight: 700, flex: 1, textAlign: 'left' }}>{s.nome}</span>
                <ChevronDown size={17} className="muted" style={{ transform: on ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
              </button>
              <div className="micro" style={{ fontWeight: 600 }}>{s.dose}</div>
              <p className="micro muted" style={{ lineHeight: 1.55 }}>{s.resumo}</p>
              {on && (
                <div className="nutri-ciencia">
                  <div className="micro" style={{ fontWeight: 700, color: 'var(--cor)' }}>O que a ciência diz</div>
                  <ul>
                    {s.ciencia.map((c) => <li key={c} className="micro">{c}</li>)}
                  </ul>
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
          <h2 className="h-sec">Quanto você precisa por dia</h2>
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
