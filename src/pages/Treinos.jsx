import React, { useMemo, useState, useEffect, Suspense } from 'react';
import { lazy } from '../lib/lazy';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus, Trash2, Pencil, NotebookPen, Timer, ChevronDown, ChevronRight, Copy, Check,
  MessageSquare, Building2, GraduationCap, Trophy, Weight, Mic, Users, History, ShieldAlert,
} from 'lucide-react';
import { useApp } from '../contexto';
import { db } from '../db/db';
import { PONTOS, POSICOES_INICIAIS, PESO_REL, posInicialPorId, pesoRelPorId, somarPontos, agruparPontos } from '../db/scoring';
import { placarDaRola, ROTULO_RESULTADO, TOM_RESULTADO, posicoesImplicadas } from '../lib/game';
import { CONTEXTOS } from '../lib/graus';
import Cronometro from '../components/Cronometro';
import Voz, { temVoz } from '../components/Voz';
import { darXp, checarConsistencia } from '../lib/xp';
import { SeletorTecnica, ListaFoco, APRENDIZADO } from '../components/SeletorTecnica';
import {
  Card, Btn, Field, Input, NumeroInput, EscolherData, Textarea, Select, Sheet, Chip, Stepper,
  Empty, Confirmar, useToast, SubsInput, Busca, PontosInput, EscolhaChips, ParceiroRapido, Seg,
} from '../components/UI';
import Calendario from '../components/Calendario';
import ResumoDoTipo, { PodioCategoria } from '../components/ResumoDoTipo';
import { hoje, fmtDur, relativo, buscaMatch, mesPorExtenso } from '../lib/utils';
import { recortarHistorico } from '../lib/plano';
import { HistoricoCortado } from '../components/Plano';
import AntesDeCompetir from '../components/AntesDeCompetir';
import { padraoDoTipo } from '../lib/padraoTreino';
import { avaliarTecnica, idadeDe, modalidadeDoTreino, FONTE_DA_REGRA } from '../lib/regras';
import { divisaoDaIdade } from '../lib/idade';
import {
  ORGANIZACOES, DIVISOES, CATEGORIAS_PESO, RESULTADOS, resultadoPorId, ehPodio,
  competicaoVazia, EU, resultadoDoPodio, podioComEu, atletasDaChave,
} from '../lib/competicao';

const TIPOS = [
  { id: 'gi', nome: 'Gi' },
  { id: 'nogi', nome: 'No-Gi' },
  { id: 'drill', nome: 'Drill' },
  { id: 'openmat', nome: 'Open mat' },
  { id: 'privada', nome: 'Aula privada' },
  { id: 'competicao', nome: 'Competição', competicao: true },
];

/* ============================================================
   O FORMULÁRIO DE CADA TIPO

   Gi e No-Gi: a aula e os rolas com placar.
   Drill: as técnicas e quantas repetições; sem rola (ninguém resiste).
   Open mat: sem aula nem professor, direto pros rolas.
   Aula particular: o professor e o que você aprendeu; rola é extra.
   Competição: o campeonato, as suas lutas (adversário pelo nome), as
   lutas da chave e o pódio. Academia e professor não entram.
   ============================================================ */
const FORMA = {
  gi: { aula: 'A aula', professor: true, rolas: 'sempre', nota: 'Anotação da aula', tecnicas: 'Técnicas treinadas hoje' },
  nogi: { aula: 'A aula', professor: true, rolas: 'sempre', nota: 'Anotação da aula', tecnicas: 'Técnicas treinadas hoje' },
  drill: { aula: 'O drill', professor: true, rolas: 'nunca', repeticoes: true, nota: 'O que ficou do drill', tecnicas: 'O que você drillou' },
  openmat: { aula: 'Onde foi', professor: false, rolas: 'sempre', nota: 'Anotação do open mat', tecnicas: 'Técnicas que você testou' },
  privada: { aula: 'A aula particular', professor: true, rolas: 'extra', nota: 'O que ficou da aula', tecnicas: 'O que você aprendeu' },
  competicao: { aula: null, rolas: 'sempre', lutas: true },
};
const formaDe = (tipo) => FORMA[tipo] || FORMA.gi;
/* rola com alguma coisa dentro: o vazio que nasce com o treino novo não conta */
const rolaTemDado = (r) => !!(r.partnerId || String(r.adversario || '').trim() || (r.ptsMeus || []).length || (r.ptsDele || []).length
  || (r.subsAplicadas || []).length || (r.subsSofridas || []).length || String(r.notas || '').trim());

/* Competição não é rola de treino. A luta vale mais no cálculo,
   o adversário é desconhecido e o resultado conta de outro jeito. */
const ehCompeticao = (tipo) => tipo === 'competicao';

const novaSessao = (settings, tipo = 'gi') => ({
  data: hoje(),
  tipo,
  duracao: padraoDoTipo(settings, tipo).duracao || 90,
  academiaId: padraoDoTipo(settings, tipo).academiaId,
  professorId: padraoDoTipo(settings, tipo).professorId,
  foco: '',
  focoTecnicas: [],
  nota: '',
  rpe: 6,
  sono: 3,
  energia: 3,
});

const novaRola = (dur, ultima, tipoTreino) => ({
  duracao: dur || 5,
  contexto: ehCompeticao(tipoTreino) ? 'competicao' : 'rola',
  partnerId: null,
  posInicial: ultima?.posInicial || null,
  pesoRel: null,
  ptsMeus: [],
  ptsDele: [],
  tecMeus: {},
  tecDele: {},
  vantMinhas: 0,
  vantDele: 0,
  resultado: 'empate',
  subsAplicadas: [],
  subsSofridas: [],
  posDominadas: [],
  posSofridas: [],
  notas: '',
});

/* qual categoria da biblioteca cada ponto puxa */
export const CAT_DO_PONTO = {
  queda: 'queda',
  raspagem: 'raspagem',
  passagem: 'passagem',
  montada: 'transicao',
  costas: 'transicao',
  joelho: 'transicao',
};

/* o resultado sai sozinho: finalização decide primeiro,
   depois pontos, depois vantagem. Igual à IBJJF. */
export function resultadoDerivado(r) {
  return placarDaRola(r).resultado;
}

/* agrupa finalizações repetidas: ["Triângulo","Triângulo"] -> [["Triângulo",2]] */
function agrupar(lista) {
  const m = new Map();
  for (const x of lista || []) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()];
}

/* junta campos antigos (funcionou/falhou/focar/notas) numa nota só */
function notaDaSessao(s) {
  if (s.nota) return s.nota;
  const partes = [];
  if (s.funcionou) partes.push(`Funcionou: ${s.funcionou}`);
  if (s.falhou && s.falhou.toLowerCase() !== 'nada') partes.push(`Falhou: ${s.falhou}`);
  if (s.focar) partes.push(`Focar: ${s.focar}`);
  if (s.notas) partes.push(s.notas);
  return partes.join('\n');
}

/* a aba de parceiros, pra abrir por cima do treino sem perder o que foi preenchido */
const AbaParceiros = lazy(() => import('./Parceiros').then((m) => ({ default: m.AbaParceiros })));

/* o histórico é a própria tela: carrega de 20 em 20, agrupado por mês */
const POR_VEZ = 20;
/* na tela ficam os 10 mais recentes; o resto abre no popup, em lista ou calendário */
const NA_TELA = 10;

export default function Treinos() {
  const { sessions, rolls, partners, positions, techniques, categories, settings, salvarSettings, ligada, acesso, irPara } = useApp();
  const toast = useToast();
  const academias = useLiveQuery(() => db.academies.filter((a) => !a.arquivada).toArray(), [], []) || [];
  const professores = useLiveQuery(() => db.professors.filter((p) => !p.arquivada).toArray(), [], []) || [];

  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [rolasEdit, setRolasEdit] = useState([]);
  const [excluir, setExcluir] = useState(null);
  const [aberta, setAberta] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [cronoAberto, setCronoAberto] = useState(false);
  const [vozAberta, setVozAberta] = useState(false);
  const [mostrar, setMostrar] = useState(POR_VEZ);
  /* 'lista' ou 'calendario': o popup com todos os treinos */
  const [todosAberto, setTodosAberto] = useState(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('novo')) { abrirNova(); return; }
    const id = Number(q.get('abrir'));
    if (id) {
      setAberta(id);
      setBusca('');
      setFiltroTipo('todos');
      /* o treino pedido pode estar depois dos primeiros 20 */
      const i = sessions.findIndex((s) => s.id === id);
      if (i >= 0) setMostrar((m) => Math.max(m, Math.ceil((i + 1) / POR_VEZ) * POR_VEZ));
      if (i >= NA_TELA) setTodosAberto('lista');
      // rola até o cartão depois que a lista renderiza
      const t = setTimeout(() => {
        const el = document.getElementById(`treino-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('destacado');
          setTimeout(() => el.classList.remove('destacado'), 2200);
        }
      }, 320);
      return () => clearTimeout(t);
    }
  }, []);

  const acadById = useMemo(() => Object.fromEntries(academias.map((a) => [a.id, a])), [academias]);
  const profById = useMemo(() => Object.fromEntries(professores.map((p) => [p.id, p])), [professores]);
  const partById = useMemo(() => Object.fromEntries(partners.map((p) => [p.id, p])), [partners]);
  const posById = useMemo(() => Object.fromEntries(positions.map((p) => [p.id, p])), [positions]);

  const finalizacoes = useMemo(() => {
    const cats = categories.filter((c) => ['estrangulamento', 'articular', 'perna'].includes(c.slug) || /finaliza|estrangul|chave/i.test(c.nome));
    const ids = new Set(cats.map((c) => c.id));
    return techniques.filter((t) => ids.has(t.categoriaId)).map((t) => t.nome).sort();
  }, [techniques, categories]);

  const recentesPorPonto = useMemo(() => {
    const out = {};
    for (const r of rolls) {
      for (const [ponto, nomes] of Object.entries(r.tecMeus || {})) {
        out[ponto] = out[ponto] || [];
        for (const n of nomes) if (!out[ponto].includes(n)) out[ponto].push(n);
      }
      for (const [ponto, nomes] of Object.entries(r.tecDele || {})) {
        out[ponto] = out[ponto] || [];
        for (const n of nomes) if (!out[ponto].includes(n)) out[ponto].push(n);
      }
    }
    return out;
  }, [rolls]);

  const recentesFoco = useMemo(() => {
    const conta = new Map();
    for (const ses of sessions) {
      for (const f of ses.focoTecnicas || []) conta.set(f.nome, (conta.get(f.nome) || 0) + 1);
    }
    return [...conta.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [sessions]);

  const maisUsadas = useMemo(() => {
    const conta = (lista) => {
      const m = new Map();
      for (const n of lista) m.set(n, (m.get(n) || 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 8);
    };
    return {
      apliquei: conta(rolls.flatMap((r) => r.subsAplicadas || [])),
      sofri: conta(rolls.flatMap((r) => r.subsSofridas || [])),
    };
  }, [rolls]);

  const rolasPorSessao = useMemo(() => {
    const m = new Map();
    for (const r of rolls) {
      if (!m.has(r.sessionId)) m.set(r.sessionId, []);
      m.get(r.sessionId).push(r);
    }
    return m;
  }, [rolls]);

  const filtrados = useMemo(() => sessions.filter((s) => {
    if (filtroTipo !== 'todos' && s.tipo !== filtroTipo) return false;
    if (!busca) return true;
    const rs = rolasPorSessao.get(s.id) || [];
    const textoRolas = rs.map((r) => r.notas || '').join(' ');
    return [s.foco, notaDaSessao(s), acadById[s.academiaId]?.nome, profById[s.professorId]?.nome, s.academia, s.professor, textoRolas]
      .some((c) => buscaMatch(c, busca));
  }), [sessions, busca, filtroTipo, rolasPorSessao, acadById, profById]);
  /* no plano grátis, com a cobrança ligada, o histórico mostra os
     últimos 30 dias e avisa quantos ficaram antes */
  const { itens: lista, cortados } = useMemo(() => recortarHistorico(filtrados, acesso), [filtrados, acesso]);

  /* o que a IA entendeu vira um treino aberto pra você conferir.
     Nada é salvo antes de você olhar. */
  /* o rola herda o tipo do treino: numa competição ela vale mais */
  const novaRolaDoTreino = (dur, ultima) => novaRola(dur, ultima, editando?.tipo);

  async function montarDoFalado(d, falado) {
    const base = novaSessao(settings);
    const s2 = {
      ...base,
      duracao: Number(d.duracao) || base.duracao,
      tipo: d.tipo || base.tipo,
      nota: d.nota || falado || '',
    };

    const semAcento = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    /* acha quem já existe, e cadastra quem é novo. O documento
       pediu pra não fazer a pessoa preencher o que já se sabe. */
    const acharOuCriar = async (nome) => {
      if (!nome) return null;
      const n = semAcento(nome);
      const achado = partners.find((x) => semAcento(x.nome) === n)
        || partners.find((x) => semAcento(x.nome).includes(n) || n.includes(semAcento(x.nome)));
      if (achado) return achado.id;
      const id = await db.partners.add({
        nome: String(nome).trim(), faixa: 'branca', graus: 0,
        academiaId: null, pesoKg: null, notas: '', criadoEm: Date.now(),
      });
      return Number(id);
    };

    const rs = [];
    for (const r of d.rolas || []) {
      rs.push({
        ...novaRola(Number(r.duracao) || settings.duracaoRolaPadrao || 5),
        partnerId: await acharOuCriar(r.parceiro),
        subsAplicadas: r.subsAplicadas || [],
        subsSofridas: r.subsSofridas || [],
        ptsMeus: r.ptsMeus || [],
        ptsDele: r.ptsDele || [],
      });
    }

    if (d.academia) {
      const a = academias.find((x) => semAcento(x.nome) === semAcento(d.academia));
      s2.academiaId = a ? a.id : null;
      s2.academia = d.academia;
    }
    if (d.professor) {
      const pr = professores.find((x) => semAcento(x.nome) === semAcento(d.professor));
      s2.professorId = pr ? pr.id : null;
      s2.professor = d.professor;
    }

    setEditando(s2);
    setRolasEdit(rs.length ? rs : [novaRola(settings.duracaoRolaPadrao || 5)]);
    toast(rs.length ? `Montei ${rs.length} ${rs.length === 1 ? 'rola' : 'rolas'}. Confira antes de salvar.` : 'Guardei o que você falou. Confira e complete.');
  }

  function abrirNova(minutosDaRola) {
    /* dentro de uma aba (Drill, Competição...), o treino novo já nasce daquele tipo */
    const tipo = filtroTipo !== 'todos' ? filtroTipo : 'gi';
    const divisao = divisaoDaIdade(idadeDe(settings.anoNascimento));
    setEditando({ ...novaSessao(settings, tipo), ...(ehCompeticao(tipo) ? { competicao: { ...competicaoVazia(), ...(divisao ? { divisao } : {}) } } : {}) });
    setRolasEdit([novaRolaDoTreino(minutosDaRola || settings.duracaoRolaPadrao || 5)]);
  }

  function abrirEdicao(s) {
    setEditando({ ...s, nota: notaDaSessao(s) });
    setRolasEdit((rolasPorSessao.get(s.id) || []).map((r) => ({ ...r })));
  }

  /* Um toque, um treino. Antes, se algo demorava ou falhava depois de
     gravar o treino, a folha ficava aberta sem aviso, a pessoa tocava
     de novo e cada toque virava um treino repetido. Agora o botão trava,
     treino e rolas gravam juntos (ou nada), e os pontos vêm depois. */
  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    try {
      await gravarTreino();
    } catch (e) {
      console.error('[treino]', e);
      toast('Não consegui salvar o treino. Nada foi gravado, tente de novo.', 'err');
    } finally {
      setSalvando(false);
    }
  }

  async function gravarTreino() {
    const s = { ...editando };
    // o foco vem das técnicas escolhidas, sem campo duplicado
    if (!s.foco) {
      const nomes = (s.focoTecnicas || []).map((f) => f.nome);
      s.foco = nomes.length
        ? (nomes.length <= 2 ? nomes.join(' e ') : `${nomes[0]} e mais ${nomes.length - 1}`)
        : '';
    }
    // guarda os nomes também, pra histórico não quebrar se apagar a academia
    s.academia = acadById[s.academiaId]?.nome || s.academia || '';
    s.professor = profById[s.professorId]?.nome || s.professor || '';
    let id = s.id;
    await db.transaction('rw', db.sessions, db.rolls, async () => {
      if (id) {
        await db.sessions.put(s);
        await db.rolls.where('sessionId').equals(id).delete();
      } else {
        id = await db.sessions.add({ ...s, criadoEm: Date.now() });
      }
      /* drill e aula particular: o rola vazio que nasce com o treino não é gravado */
      const paraGravar = formaDe(s.tipo).rolas === 'sempre' ? rolasEdit : rolasEdit.filter(rolaTemDado);
      for (const r of paraGravar) {
        const { id: _drop, uid: _u, updatedAt: _up, ...rest } = r;
        const pos = posicoesImplicadas(r, positions);
        await db.rolls.add({
          ...rest, ...pos,
          resultado: resultadoDerivado(r),
          /* o contexto sai do tipo do treino: rola de treino Drill nascia
             "rola" e contava como luta e como uso sob resistência */
          contexto: s.tipo === 'drill' ? 'drill' : ehCompeticao(s.tipo) ? 'competicao'
            : (['drill', 'competicao'].includes(r.contexto) ? 'rola' : r.contexto || 'rola'),
          v2: 1,                      // marca que esse rola passou pelo placar
          sessionId: id, data: s.data,
        });
      }
    });
    /* o treino já está gravado: daqui pra frente nada desfaz ele */
    setEditando(null);
    let ganho = 0;
    let metaFechada = null;
    try {
      await fecharLesaoAberta();
      ganho = await premiar(s, id);
      metaFechada = await fecharMetaDoCampeonato(s);
    } catch (e) {
      console.error('[treino] pontos', e);
    }
    toast(metaFechada ? `Campeonato registrado. Meta "${metaFechada}" concluída 🥋`
      : ganho > 0 ? `Treino salvo, +${ganho} pontos` : 'Treino salvo');
  }

  /* pontos pelo que foi registrado. Reflexão escrita vale mais,
     porque é ela que transforma registro em aprendizado. */
  /* Quem marcou "não sei quanto tempo" volta sem avisar. O
     primeiro treino registrado é o aviso. */
  async function fecharLesaoAberta() {
    const abertas = await db.injuries
      .filter((l) => l.impacto === 'parado' && l.status !== 'curada' && l.prazo === 'nsei')
      .toArray();
    for (const l of abertas) {
      await db.injuries.update(l.id, { status: 'curada', dataCura: hoje() });
    }
    if (abertas.length) toast('Bom te ver de volta. Fechei a lesão que estava aberta.');
  }

  async function premiar(s, id) {
    let total = 0;
    const temReflexao = String(s.nota || '').trim().length >= 15
      || rolasEdit.some((r) => String(r.notas || '').trim().length >= 15);

    if (temReflexao) {
      const p = await darXp('treino', { refId: `treino:${id}`, detalhe: s.data });
      if (p) total += p.xp;
    }

    /* competir vale um bônus, uma vez por dia */
    if (ehCompeticao(s.tipo)) {
      const p = await darXp('competicao', { refId: `competicao:${id}`, detalhe: s.competicao?.evento || s.data });
      if (p) total += p.xp;
    }

    /* drill não dá ponto de rola: sem resistência não é luta */
    for (const [i, r] of (s.tipo === 'drill' ? [] : rolasEdit.entries())) {
      /* na competição o adversário vem pelo nome, não pelo cadastro */
      const completa = (r.partnerId || (ehCompeticao(s.tipo) && String(r.adversario || '').trim())) && (
        (r.ptsMeus || []).length || (r.ptsDele || []).length ||
        (r.subsAplicadas || []).length || (r.subsSofridas || []).length
      );
      if (!completa) continue;
      const p = await darXp('rola', { refId: `rola:${id}:${i}`, detalhe: s.data });
      if (p) total += p.xp;
    }

    const c = await checarConsistencia([...sessions.filter((x) => x.id !== id), { ...s, id }]);
    if (c) total += c.xp;

    return total;
  }

  async function apagar(s) {
    await db.rolls.where('sessionId').equals(s.id).delete();
    await db.sessions.delete(s.id);
    toast('Treino excluído');
  }

  /* o cartão de um treino: o mesmo na tela e no popup de todos */
  const cartao = (s, i, visiveis) => {
      const rs = rolasPorSessao.get(s.id) || [];
      const abertaAqui = aberta === s.id;
      const fin = rs.flatMap((r) => r.subsAplicadas || []).length;
      const taps = rs.flatMap((r) => r.subsSofridas || []).length;
      const ptsM = rs.reduce((a, r) => a + somarPontos(r.ptsMeus), 0);
      const ptsD = rs.reduce((a, r) => a + somarPontos(r.ptsDele), 0);
      const nota = notaDaSessao(s);
      const comNotas = rs.filter((r) => r.notas?.trim()).length;
      const acad = acadById[s.academiaId]?.nome || s.academia;
      const prof = profById[s.professorId]?.nome || s.professor;
      const nomeTipo = TIPOS.find((t) => t.id === s.tipo)?.nome || s.tipo;

      const mes = (s.data || '').slice(0, 7);
      const novoMes = mes && (i === 0 || mes !== (visiveis[i - 1].data || '').slice(0, 7));

      return (
        <React.Fragment key={s.id}>
        {novoMes && <div className="eyebrow" style={{ marginTop: i ? 10 : 0 }}>{mesPorExtenso(mes)}</div>}
        <Card id={`treino-${s.id}`} className="pad-0 hover">
          <button
            className="list-item"
            style={{ borderBottom: abertaAqui ? '1px solid var(--seam)' : 0, padding: 15, alignItems: 'flex-start' }}
            onClick={() => setAberta(abertaAqui ? null : s.id)}
          >
            {/* registro de treino: a data num bloco, o que foi em cima,
                e os números do dia em destaque, sem virar tabela */}
            <span className="treino-data">
              <span className="treino-dia num">{String(s.data || '').slice(8, 10)}</span>
              <span className="treino-mes">{s.data ? new Date(`${s.data}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : ''}</span>
            </span>
            <div className="grow">
              <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                <span className="treino-titulo">{s.competicao?.evento || s.foco || nomeTipo || 'Treino'}</span>
                {s.rpe != null && <span className="treino-rpe num" title="esforço percebido, de 0 a 10">RPE {s.rpe}</span>}
              </div>
              <div className="micro muted" style={{ marginTop: 3 }}>
                {[(s.competicao?.evento || s.foco) && nomeTipo, s.duracao ? fmtDur(s.duracao) : null, relativo(s.data), prof, acad].filter(Boolean).join(' · ')}
              </div>
              {(rs.length > 0 || ptsM > 0 || ptsD > 0 || fin > 0 || taps > 0 || comNotas > 0) && (
                <div className="treino-numeros">
                  {rs.length > 0 && <span><b className="num">{rs.length}</b> {ehCompeticao(s.tipo) ? (rs.length > 1 ? 'lutas' : 'luta') : (rs.length > 1 ? 'rolas' : 'rola')}</span>}
                  {(ptsM > 0 || ptsD > 0) && <span><b className="num">{ptsM}×{ptsD}</b> pontos</span>}
                  {fin > 0 && <span className="bom"><b className="num">{fin}</b> {fin > 1 ? 'finalizações' : 'finalização'}</span>}
                  {taps > 0 && <span className="ruim"><b className="num">{taps}</b> {taps > 1 ? 'taps' : 'tap'}</span>}
                  {comNotas > 0 && <span><MessageSquare size={13} /> {comNotas}</span>}
                </div>
              )}
              {(s.competicao?.resultado || s.competicao?.categoria) && (
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {s.competicao?.resultado && (
                    <Chip tone={resultadoPorId(s.competicao.resultado)?.tone || ''}>
                      {ehPodio(s.competicao.resultado) && <Trophy size={11} />} {resultadoPorId(s.competicao.resultado)?.nome}
                    </Chip>
                  )}
                  {s.competicao?.categoria && (
                    <Chip>{s.competicao.categoria}{s.competicao.absoluto ? ' + absoluto' : ''}</Chip>
                  )}
                </div>
              )}
            </div>
            <span style={{ marginTop: 4 }}>
              {abertaAqui ? <ChevronDown size={17} className="muted" /> : <ChevronRight size={17} className="muted" />}
            </span>
          </button>

          {abertaAqui && (
            <div style={{ padding: 15 }}>
              {nota && (
                <div className="card" style={{ background: 'var(--void)', marginBottom: 12 }}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>anotação da aula</div>
                  <p className="tiny" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{nota}</p>
                </div>
              )}

              {ehCompeticao(s.tipo) && s.competicao?.podio && (
                <div style={{ marginBottom: 12 }}>
                  <div className="eyebrow">pódio da categoria</div>
                  <PodioCategoria podio={s.competicao.podio} />
                </div>
              )}
              {ehCompeticao(s.tipo) && (s.competicao?.chave || []).some((l) => l.a && l.b) && (
                <div className="col" style={{ gap: 6, marginBottom: 12 }}>
                  <div className="eyebrow">lutas da chave</div>
                  {s.competicao.chave.filter((l) => l.a && l.b).map((l, k) => (
                    <div key={k} className="micro">
                      <b style={{ color: l.venceu === 'a' ? 'var(--jade)' : 'var(--chalk)' }}>{l.a}</b>
                      <span className="muted"> x </span>
                      <b style={{ color: l.venceu === 'b' ? 'var(--jade)' : 'var(--chalk)' }}>{l.b}</b>
                      {l.venceu && <span className="muted"> · venceu {l.venceu === 'a' ? l.a : l.b}</span>}
                    </div>
                  ))}
                </div>
              )}

              {(s.focoTecnicas || []).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>técnicas da aula</div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    {s.focoTecnicas.map((f, k) => {
                      const a = APRENDIZADO.find((x) => x.id === f.aprendizado);
                      return (
                        <Chip key={k} tone={a?.cor || ''}>
                          {f.nome}{a && <span className="micro" style={{ opacity: .8 }}> · {a.nome}</span>}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              )}

              {(s.tecnicasDoDia || []).length > 0 && (
                <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
                  {s.tecnicasDoDia.map((t) => <Chip key={t}>{t}</Chip>)}
                </div>
              )}

              {rs.length > 0 && (
                <div className="col" style={{ gap: 9, marginBottom: 12 }}>
                  <span className="eyebrow">{ehCompeticao(s.tipo) ? 'suas lutas' : 'os rolas'}</span>
                  {rs.map((r, i) => {
                    const pl = placarDaRola(r);
                    const parceiro = partById[r.partnerId];
                    return (
                      <div key={i} className="card" style={{ background: 'var(--void)', padding: 13 }}>
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                          <span className="num micro muted">#{i + 1}</span>
                          <span className="tiny" style={{ fontWeight: 600 }}>{parceiro?.nome || r.adversario || 'Sem parceiro'}</span>
                          {parceiro?.faixa && <Chip>{parceiro.faixa}</Chip>}
                          {r.pesoRel && <Chip>{pesoRelPorId[r.pesoRel]?.icone} {r.pesoRel === 'similar' ? 'peso igual' : r.pesoRel}</Chip>}
                          <Chip tone={TOM_RESULTADO[pl.resultado] || ''}>{ROTULO_RESULTADO[pl.resultado]}</Chip>
                          <span className="spacer" />
                          <span className="micro muted num">{r.duracao}min</span>
                        </div>

                        {(pl.meus > 0 || pl.dele > 0 || (r.vantMinhas || 0) > 0 || (r.vantDele || 0) > 0) && (
                          <div className="row wrap" style={{ gap: 9, marginTop: 10, alignItems: 'center' }}>
                            <span className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--jade)' }}>{pl.meus}</span>
                            <span className="micro muted">×</span>
                            <span className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--blood)' }}>{pl.dele}</span>
                            <span className="micro muted">pontos</span>
                            {((r.vantMinhas || 0) > 0 || (r.vantDele || 0) > 0) && (
                              <span className="micro muted num">· vant {r.vantMinhas || 0}×{r.vantDele || 0}</span>
                            )}
                            {r.posInicial && <span className="micro muted">· de {posInicialPorId[r.posInicial]?.nome}</span>}
                          </div>
                        )}

                        {((r.ptsMeus || []).length > 0 || (r.ptsDele || []).length > 0) && (
                          <div className="row wrap" style={{ gap: 5, marginTop: 8 }}>
                            {agruparPontos(r.ptsMeus).map((x) => {
                              const tecs = (r.tecMeus || {})[x.id] || [];
                              return (
                                <Chip key={'pm' + x.id} tone="jade">
                                  ▲ {tecs.length ? tecs.join(' + ') : x.nome}
                                  {x.n > 1 && <b className="num"> ×{x.n}</b>}
                                </Chip>
                              );
                            })}
                            {agruparPontos(r.ptsDele).map((x) => {
                              const tecs = (r.tecDele || {})[x.id] || [];
                              return (
                                <Chip key={'pd' + x.id} tone="blood">
                                  ▼ {tecs.length ? tecs.join(' + ') : x.nome}
                                  {x.n > 1 && <b className="num"> ×{x.n}</b>}
                                </Chip>
                              );
                            })}
                          </div>
                        )}

                        {((r.subsAplicadas || []).length > 0 || (r.subsSofridas || []).length > 0) && (
                          <div className="row wrap" style={{ gap: 5, marginTop: 9 }}>
                            {agrupar(r.subsAplicadas).map(([x, n]) => <Chip key={'a' + x} tone="jade">▲ {x}{n > 1 && <b className="num"> ×{n}</b>}</Chip>)}
                            {agrupar(r.subsSofridas).map(([x, n]) => <Chip key={'s' + x} tone="blood">▼ {x}{n > 1 && <b className="num"> ×{n}</b>}</Chip>)}
                          </div>
                        )}

                        {((r.posDominadas || []).length > 0 || (r.posSofridas || []).length > 0) && (
                          <div className="row wrap" style={{ gap: 5, marginTop: 7 }}>
                            {(r.posDominadas || []).map((id) => posById[id] && <Chip key={'pd' + id} tone="jade">{posById[id].nome}</Chip>)}
                            {(r.posSofridas || []).map((id) => posById[id] && <Chip key={'ps' + id} tone="blood">{posById[id].nome}</Chip>)}
                          </div>
                        )}

                        {r.notas?.trim() && (
                          <div style={{ marginTop: 11, paddingTop: 10, borderTop: '1px solid var(--seam)' }}>
                            <p className="tiny" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{r.notas}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="row wrap" style={{ gap: 8 }}>
                <Btn size="sm" icon={Pencil} onClick={() => abrirEdicao(s)}>Editar</Btn>
                <Btn size="sm" icon={Copy} onClick={() => {
                  const { id, uid, updatedAt, ...rest } = s;
                  setEditando({ ...rest, data: hoje(), nota: notaDaSessao(s) });
                  setRolasEdit((rolasPorSessao.get(s.id) || []).map(({ id: _i, uid: _u, updatedAt: _up, sessionId, ...rr }) => ({ ...rr })));
                }}>Duplicar</Btn>
                <span className="spacer" />
                <Btn size="sm" variant="danger" icon={Trash2} onClick={() => setExcluir(s)}>Excluir</Btn>
              </div>
            </div>
          )}
        </Card>
        </React.Fragment>
      );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Treinos e rolas</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {ligada('timer') && <Btn icon={Timer} onClick={() => setCronoAberto(true)}>Cronômetro</Btn>}
          {temVoz() && ligada('voz') && <Btn icon={Mic} onClick={() => setVozAberta(true)}>Falar</Btn>}
          <Btn variant="primary" icon={Plus} onClick={() => abrirNova()}>Novo treino</Btn>
        </div>
      </div>

      <div className="row wrap" style={{ marginBottom: 14, gap: 8 }}>
        <Busca value={busca} onChange={setBusca} placeholder="Buscar no foco, nas notas e nos rolas…" />
      </div>
      <div className="chips-scroll" style={{ marginBottom: 14 }}>
        <button className={`chip ${filtroTipo === 'todos' ? 'on' : ''}`} onClick={() => setFiltroTipo('todos')}>Todos</button>
        {TIPOS.map((t) => (
          <button key={t.id} className={`chip ${filtroTipo === t.id ? 'on' : ''}`} onClick={() => setFiltroTipo(t.id)}>{t.nome}</button>
        ))}
      </div>

      {/* cada tipo com o seu resumo: o que importa pra ele, na cor dele */}
      {filtroTipo !== 'todos' && (
        <ResumoDoTipo tipo={filtroTipo} lista={lista} rolasPorSessao={rolasPorSessao} partners={partners} professores={professores} />
      )}

      {lista.length === 0 ? (
        <Card>
          <Empty
            icon={NotebookPen}
            titulo={!sessions.length ? 'Nenhum treino registrado'
              : filtroTipo === 'competicao' ? 'Nenhum campeonato ainda'
                : filtroTipo !== 'todos' && !busca ? `Nenhum treino de ${TIPOS.find((x) => x.id === filtroTipo)?.nome} ainda` : 'Nada com esse filtro'}
            texto={filtroTipo === 'competicao'
              ? 'Registre o campeonato com as suas lutas completas, as lutas da chave (só quem venceu) e o pódio da categoria. Competir ainda vale 30 pontos.'
              : 'Escolha as técnicas da aula e marque se pegou. Depois registre os rolas com os pontos e as anotações, é dali que sai o seu domínio e o seu estilo de jogo.'}
            acao={<Btn variant="primary" icon={Plus} onClick={() => abrirNova()}>{filtroTipo === 'competicao' ? 'Registrar campeonato' : filtroTipo !== 'todos' ? `Registrar ${TIPOS.find((x) => x.id === filtroTipo)?.nome}` : 'Registrar treino'}</Btn>}
          />
          <HistoricoCortado cortados={cortados} onAssinar={() => irPara('ajustes')} />
        </Card>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {lista.slice(0, NA_TELA).map(cartao)}
          {lista.length > NA_TELA && (
            <Btn variant="contorno" icon={History} onClick={() => setTodosAberto('lista')} style={{ alignSelf: 'center' }}>
              Ver todos os {lista.length} treinos
            </Btn>
          )}
          {lista.length <= NA_TELA && <HistoricoCortado cortados={cortados} onAssinar={() => irPara('ajustes')} />}
        </div>
      )}

      <Sheet aberto={!!todosAberto} onClose={() => setTodosAberto(null)} titulo="Todos os treinos" subtitulo={`${lista.length} ${lista.length === 1 ? 'treino' : 'treinos'}${filtroTipo !== 'todos' ? ` de ${TIPOS.find((x) => x.id === filtroTipo)?.nome}` : ''}`} wide>
        <Seg value={todosAberto || 'lista'} onChange={setTodosAberto} options={[{ id: 'lista', nome: 'Lista' }, { id: 'calendario', nome: 'Calendário' }]} />
        {todosAberto === 'calendario' ? (
          <Calendario
            modo="mes"
            sessions={lista} rolls={rolls} partners={partners} gradings={[]}
            aoAbrirTreino={(ses) => { setAberta(ses.id); setTodosAberto('lista'); setTimeout(() => document.getElementById(`treino-${ses.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250); }}
          />
        ) : (
          <div className="col" style={{ gap: 10 }}>
            {lista.slice(0, mostrar).map(cartao)}
            {lista.length > mostrar && (
              <Btn variant="ghost" onClick={() => setMostrar((m) => m + POR_VEZ)} style={{ alignSelf: 'center' }}>
                Mostrar mais ({lista.length - mostrar})
              </Btn>
            )}
            {lista.length <= mostrar && <HistoricoCortado cortados={cortados} onAssinar={() => irPara('ajustes')} />}
          </div>
        )}
      </Sheet>

      <Sheet
        aberto={!!editando}
        onClose={() => setEditando(null)}
        titulo={editando?.id ? 'Editar treino' : 'Novo treino'}
        wide
        footer={
          <>
            <Btn variant="ghost" onClick={() => setEditando(null)}>Cancelar</Btn>
            <Btn variant="primary" icon={Check} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar treino'}</Btn>
          </>
        }
      >
        {editando && (
          <EditorTreino
            s={editando} setS={setEditando}
            rolas={rolasEdit} setRolas={setRolasEdit}
            partners={partners} positions={positions}
            techniques={techniques} categories={categories}
            finalizacoes={finalizacoes} maisUsadas={maisUsadas}
            recentesPorPonto={recentesPorPonto} recentesFoco={recentesFoco}
            faixa={settings.faixa}
            academias={academias} professores={professores}
            duracaoPadrao={settings.duracaoRolaPadrao || 5}
            padraoDe={(tipo) => padraoDoTipo(settings, tipo)}
            idade={idadeDe(settings.anoNascimento)}
            liberadas={settings.tecnicasLiberadas || []}
            onLiberar={(nome) => salvarSettings({ tecnicasLiberadas: [...new Set([...(settings.tecnicasLiberadas || []), nome])] })}
            onSalvarPadrao={async (tipo, p) => {
              /* o de Gi continua sendo o padrão geral (graduação, Ajustes) */
              await salvarSettings({
                padroesTreino: { ...(settings.padroesTreino || {}), [tipo]: p },
                ...(tipo === 'gi' ? { academiaPadraoId: p.academiaId, professorPadraoId: p.professorId, duracaoTreinoPadrao: p.duracao } : {}),
              });
              toast(`Pronto: o próximo treino de ${TIPOS.find((x) => x.id === tipo)?.nome || tipo} já vem assim`);
            }}
          />
        )}
      </Sheet>

      <Voz
        aberto={vozAberta}
        onClose={() => setVozAberta(false)}
        techniques={techniques}
        partners={partners}
        academies={academias}
        professors={professores}
        onPronto={(dados, falado) => {
          setVozAberta(false);
          montarDoFalado(dados, falado);
        }}
      />

      <Cronometro
        aberto={cronoAberto}
        onClose={() => setCronoAberto(false)}
        onRegistrar={(minutos) => {
          setCronoAberto(false);
          if (editando) {
            /* já tem um treino aberto, então só adiciona o rola */
            setRolasEdit([...rolasEdit, novaRolaDoTreino(minutos, rolasEdit[rolasEdit.length - 1])]);
            toast('Rola adicionado. Preencha o que aconteceu.');
          } else {
            abrirNova(minutos);
          }
        }}
      />

      <Confirmar
        aberto={!!excluir}
        onClose={() => setExcluir(null)}
        onConfirmar={() => apagar(excluir)}
        titulo="Excluir treino"
        texto="O treino e todas os rolas dele somem. Não dá pra desfazer."
      />

    </div>
  );
}

/* ================= editor ================= */
/* ============================================================
   O CAMPEONATO

   Competição não é aula: o que importa é onde você lutou, em que
   categoria e como terminou. Cada luta entra como um rola, com
   placar e finalização, igual ao resto do app.
   ============================================================ */
/* ============================================================
   A CHAVE DA CATEGORIA

   As lutas dos outros que você viu, só com quem venceu (sem pontos:
   ninguém anota o que não viu), e o pódio: campeão, vice e os dois
   3º lugares. Você entra no pódio pelo "Como terminou" ou pelo botão
   "Eu"; os nomes da chave e dos seus adversários viram sugestão.
   ============================================================ */
function ChaveDaCategoria({ s, setS, rolas }) {
  const c = s.competicao || competicaoVazia();
  const chave = c.chave || [];
  const podio = c.podio || { ouro: '', prata: '', bronze: ['', ''] };
  const set = (patch) => setS({ ...s, competicao: { ...c, ...patch } });
  const mudarLuta = (i, patch) => set({ chave: chave.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const mudarPodio = (novo) => {
    /* você no pódio define a colocação; fora do pódio, a colocação fica */
    const r = resultadoDoPodio(novo);
    set({ podio: novo, resultado: r || (['ouro', 'prata', 'bronze'].includes(c.resultado) ? 'participou' : c.resultado) });
  };
  const atletas = atletasDaChave(chave, rolas);
  const lugares = [
    { k: 'ouro', nome: 'Campeão' }, { k: 'prata', nome: 'Vice' },
    { k: 'bronze0', nome: '3º lugar' }, { k: 'bronze1', nome: '3º lugar' },
  ];
  const valorDe = (k) => (k.startsWith('bronze') ? (podio.bronze || [])[Number(k.slice(6))] : podio[k]) || '';
  const porNoLugar = (k, v) => {
    const novo = { ...podio, bronze: [...(podio.bronze || ['', ''])] };
    /* você só ocupa um lugar */
    if (v === EU) {
      if (novo.ouro === EU) novo.ouro = '';
      if (novo.prata === EU) novo.prata = '';
      novo.bronze = novo.bronze.map((x) => (x === EU ? '' : x));
    }
    if (k.startsWith('bronze')) novo.bronze[Number(k.slice(6))] = v; else novo[k] = v;
    mudarPodio(novo);
  };

  return (
    <div className="card" style={{ background: 'var(--void)', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
      <div>
        <div className="eyebrow">a sua categoria</div>
        <h3 className="h-sec">A chave e o pódio</h3>
        <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.6 }}>
          As lutas dos outros entram só com quem venceu. As suas você registra completas, mais embaixo.
        </p>
      </div>

      {chave.map((l, i) => (
        <div key={i} className="chave-luta">
          <button type="button" className={`chave-atleta${l.venceu === 'a' ? ' venceu' : ''}`} onClick={() => mudarLuta(i, { venceu: 'a' })} aria-label="Venceu">
            <Trophy size={12} />
          </button>
          <Input value={l.a} onChange={(e) => mudarLuta(i, { a: e.target.value })} placeholder="Atleta" />
          <button type="button" className="btn ghost icon sm chave-tirar" aria-label="Tirar esta luta" onClick={() => set({ chave: chave.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
          <button type="button" className={`chave-atleta${l.venceu === 'b' ? ' venceu' : ''}`} onClick={() => mudarLuta(i, { venceu: 'b' })} aria-label="Venceu">
            <Trophy size={12} />
          </button>
          <Input value={l.b} onChange={(e) => mudarLuta(i, { b: e.target.value })} placeholder="Atleta" />
        </div>
      ))}
      <button type="button" className="btn ghost xs" style={{ alignSelf: 'flex-start' }} onClick={() => set({ chave: [...chave, { a: '', b: '', venceu: '' }] })}>
        <Plus size={13} /> Luta da chave
      </button>
      {chave.length > 0 && <p className="micro muted">Toque no troféu do lado de quem venceu.</p>}

      <div className="divider" />
      <span className="label">Pódio da categoria</span>
      <datalist id="atletas-da-chave">{atletas.map((a) => <option key={a} value={a} />)}</datalist>
      <div className="grid g2" style={{ gap: 10 }}>
        {lugares.map((l) => {
          const v = valorDe(l.k);
          return (
            <Field key={l.k} label={l.nome}>
              {v === EU ? (
                <button type="button" className="chip on" style={{ minHeight: 42, justifyContent: 'center' }} onClick={() => porNoLugar(l.k, '')}>
                  <Check size={12} /> Você
                </button>
              ) : (
                <div className="row" style={{ gap: 6 }}>
                  <Input list="atletas-da-chave" value={v} onChange={(e) => porNoLugar(l.k, e.target.value)} placeholder="Nome" />
                  <button type="button" className="btn contorno sm" onClick={() => porNoLugar(l.k, EU)}>Eu</button>
                </div>
              )}
            </Field>
          );
        })}
      </div>
      <PodioCategoria podio={podio} compacto />
    </div>
  );
}

/* O campeonato do treino e o da meta são o mesmo: registrou a
   competição com o nome da meta, a meta fecha sozinha. */
const semAcentoMin = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
async function fecharMetaDoCampeonato(s) {
  const evento = s.competicao?.evento;
  if (!ehCompeticao(s.tipo) || !evento) return null;
  const metas = await db.goals.where('status').equals('ativa').filter((g) => g.tipo === 'competicao'
    && g.alvo && semAcentoMin(g.alvo) === semAcentoMin(evento)).toArray();
  for (const g of metas) await db.goals.update(g.id, { status: 'concluida', concluidaEm: s.data });
  return metas.length ? evento : null;
}

function BlocoCompeticao({ s, setS, onAbrirRegras }) {
  /* os campeonatos que a pessoa marcou como meta: um toque preenche */
  const metasCamp = useLiveQuery(() => db.goals.where('status').equals('ativa')
    .filter((g) => g.tipo === 'competicao' && !!g.alvo).toArray(), [], []) || [];
  const c = s.competicao || competicaoVazia();
  const set = (patch) => setS({ ...s, competicao: { ...c, ...patch } });

  return (
    <div className="card" style={{ background: 'var(--void)', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">o campeonato</div>
          <h3 className="h-sec">Onde você lutou</h3>
        </div>
        <Btn size="sm" variant="ghost" icon={Trophy} onClick={onAbrirRegras}>Antes de competir</Btn>
      </div>

      <div className="grid g2" style={{ gap: 10 }}>
        <Field label="Campeonato">
          <Input value={c.evento} onChange={(e) => set({ evento: e.target.value })} placeholder="Ex.: Copa Bahia de Jiu-Jitsu" />
          {metasCamp.length > 0 && (
            <div className="row wrap" style={{ gap: 6, marginTop: 7 }}>
              {metasCamp.map((g) => (
                <button key={g.id} type="button" className={`chip ${semAcentoMin(c.evento) === semAcentoMin(g.alvo) ? 'on' : ''}`}
                  onClick={() => set({ evento: g.alvo })}>
                  🎯 {g.alvo}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Organização">
          <Select value={c.organizacao} onChange={(e) => set({ organizacao: e.target.value })}>
            {ORGANIZACOES.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Com ou sem kimono">
        <div className="seletor-pill" style={{ maxWidth: 240 }}>
          {[{ id: 'gi', nome: 'Gi' }, { id: 'nogi', nome: 'No-Gi' }].map((o) => (
            <button key={o.id} type="button" className={c.modalidade === o.id ? 'on' : ''} onClick={() => set({ modalidade: o.id })}>
              {o.nome}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid g3" style={{ gap: 10 }}>
        <Field label="Divisão">
          <Select value={c.divisao} onChange={(e) => set({ divisao: e.target.value })}>
            {DIVISOES.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </Select>
        </Field>
        <Field label="Categoria de peso">
          <Select value={c.categoria} onChange={(e) => set({ categoria: e.target.value })}>
            <option value="">Escolha</option>
            {CATEGORIAS_PESO.map((x) => <option key={x} value={x}>{x}</option>)}
          </Select>
        </Field>
        <Field label="Peso na balança (kg)" hint="com o kimono, como na pesagem">
          <Input type="number" inputMode="decimal" value={c.pesoKg} onChange={(e) => set({ pesoKg: e.target.value })} />
        </Field>
      </div>

      <button
        type="button"
        className={`chip ${c.absoluto ? 'on' : ''}`}
        style={{ alignSelf: 'flex-start', minHeight: 38, paddingInline: 16 }}
        onClick={() => set({ absoluto: !c.absoluto })}
      >
        <Weight size={12} /> Também lutei o absoluto
      </button>

      <Field label="Como terminou">
        <div className="row wrap" style={{ gap: 7 }}>
          {RESULTADOS.map((r) => (
            <button
              key={r.id} type="button"
              className={`chip ${c.resultado === r.id ? 'on' : ''}`}
              style={{ minHeight: 38, paddingInline: 16 }}
              onClick={() => {
                const novo = c.resultado === r.id ? '' : r.id;
                set({ resultado: novo, podio: podioComEu(c.podio, novo) });
              }}
            >
              {r.nome}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function EditorTreino({ s, setS, rolas, setRolas, partners, positions, techniques, categories, finalizacoes, maisUsadas, recentesPorPonto, recentesFoco, faixa, academias, professores, duracaoPadrao, padraoDe, onSalvarPadrao, idade = null, liberadas = [], onLiberar }) {
  const padrao = padraoDe(s.tipo);
  /* A REGRA DA TÉCNICA: quando a regra não permite (faixa, idade, Gi ou
     No-Gi), o app avisa e pergunta. Nunca proíbe: o professor pode
     liberar, e "não avisar mais" guarda isso pra aquela técnica. */
  const [aviso, setAviso] = useState(null);
  const checarTecnica = (nome, aplicar) => {
    const r = liberadas.includes(nome) ? null : avaliarTecnica(nome, { faixa, idade, modalidade: modalidadeDoTreino(s) });
    if (!r) { aplicar(); return; }
    setAviso({ ...r, nome, aplicar });
  };
  const forma = formaDe(s.tipo);
  /* aula particular: rola é extra, aparece quando a pessoa pede */
  const [comRola, setComRola] = useState(false);
  const temDado = rolas.some(rolaTemDado);
  const mostraRolas = forma.rolas === 'sempre' || temDado || (forma.rolas === 'extra' && comRola);
  const set = (k, v) => setS({ ...s, [k]: v });
  const ehPadrao = !!padrao.academiaId && s.academiaId === padrao.academiaId && (s.professorId || null) === (padrao.professorId || null);
  const [trocando, setTrocando] = useState(false);
  const [rolaAberta, setRolaAberta] = useState(rolas.length ? 0 : null);
  const [seletor, setSeletor] = useState(null);
  const [parceirosAberto, setParceirosAberto] = useState(false);
  const [antesDeCompetir, setAntesDeCompetir] = useState(false);

  const profsDaAcademia = useMemo(
    () => professores.filter((p) => !s.academiaId || p.academiaId === s.academiaId),
    [professores, s.academiaId]
  );

  const addRola = () => {
    setRolas([...rolas, novaRola(duracaoPadrao, rolas[rolas.length - 1])]);
    setRolaAberta(rolas.length);
  };
  const setRola = (i, patch) => setRolas(rolas.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <>
      <div className="grid g3" style={{ gap: 12 }}>
        <Field label="Quando foi"><EscolherData valor={s.data} onChange={(v) => set('data', v)} titulo="Quando foi o treino" /></Field>
        <Field label="Duração (min)"><NumeroInput valor={s.duracao} onChange={(v) => set('duracao', v)} /></Field>
        <Field label="Tipo">
          <Select value={s.tipo} onChange={(e) => {
            /* trocou o tipo: se academia, professor e duração ainda eram o
               padrão do tipo anterior, vêm os do tipo novo */
            const novo = e.target.value;
            const antes = padraoDe(s.tipo);
            const intocado = (s.academiaId || null) === (antes.academiaId || null)
              && (s.professorId || null) === (antes.professorId || null)
              && (!antes.duracao || Number(s.duracao) === Number(antes.duracao));
            if (!intocado) { set('tipo', novo); return; }
            const p = padraoDe(novo);
            setS({ ...s, tipo: novo, academiaId: p.academiaId || null, professorId: p.professorId || null, duracao: p.duracao || s.duracao });
          }}>
            {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Select>
        </Field>
      </div>

      {/* o campeonato: só aparece quando o treino é competição */}
      {ehCompeticao(s.tipo) && <BlocoCompeticao s={s} setS={setS} onAbrirRegras={() => setAntesDeCompetir(true)} />}

      {/* a aula: academia, professor, técnicas e anotação num bloco só.
          Com o padrão salvo, academia e professor já vêm marcados e ficam
          fechados numa linha; "Trocar" abre os chips. */}
      {forma.lutas && <ChaveDaCategoria s={s} setS={setS} rolas={rolas} />}

      {forma.aula && (<div className="bloco-cor aula">
      <div className="bloco-cor-titulo"><GraduationCap size={15} /> {forma.aula}</div>
      {academias.length > 0 && ehPadrao && !trocando ? (
        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tiny" style={{ fontWeight: 600 }}>{academias.find((a) => a.id === s.academiaId)?.nome}</div>
            <div className="micro muted" style={{ marginTop: 2 }}>
              {professores.find((p) => p.id === s.professorId)?.nome
                ? `Professor ${professores.find((p) => p.id === s.professorId).nome}`
                : 'Sem professor'} · o seu padrão
            </div>
          </div>
          <Btn size="sm" variant="contorno" onClick={() => setTrocando(true)}>Trocar</Btn>
        </div>
      ) : academias.length > 0 ? (
        <>
          <Field label="Academia">
            <div className="chips-scroll" style={{ margin: 0, padding: 0 }}>
              {academias.map((a) => (
                <button
                  key={a.id} type="button"
                  className={`chip ${s.academiaId === a.id ? 'on' : ''}`}
                  onClick={() => {
                    const profOk = professores.find((p) => p.id === s.professorId && p.academiaId === a.id);
                    setS({ ...s, academiaId: a.id, professorId: profOk ? s.professorId : null });
                  }}
                >
                  <Building2 size={11} /> {a.nome}
                </button>
              ))}
            </div>
          </Field>

          {forma.professor && profsDaAcademia.length > 0 && (
            <Field label="Professor">
              <div className="chips-scroll" style={{ margin: 0, padding: 0 }}>
                {profsDaAcademia.map((p) => (
                  <button
                    key={p.id} type="button"
                    className={`chip ${s.professorId === p.id ? 'on' : ''}`}
                    onClick={() => set('professorId', s.professorId === p.id ? null : p.id)}
                  >
                    <GraduationCap size={11} /> {p.nome}
                  </button>
                ))}
              </div>
            </Field>
          )}
          {forma.professor && s.academiaId && profsDaAcademia.length === 0 && (
            <p className="micro muted">Nenhum professor cadastrado nessa academia ainda. Cadastre em Parceiros → Professores.</p>
          )}
          {s.academiaId && !ehPadrao && (
            <button
              type="button" className="btn ghost xs" style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                onSalvarPadrao(s.tipo, { academiaId: s.academiaId, professorId: s.professorId || null, duracao: Number(s.duracao) || 90 });
                setTrocando(false);
              }}
            >
              <Check size={13} /> Usar sempre esta academia, professor e duração no {TIPOS.find((x) => x.id === s.tipo)?.nome || 'treino'}
            </button>
          )}
        </>
      ) : (
        <div className="valida atencao">
          <Building2 size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted">
            Cadastre sua academia e seus professores em <b style={{ color: 'var(--chalk)' }}>Parceiros → Academias</b> e
            você seleciona com um clique aqui, sem digitar.
          </p>
        </div>
      )}

      <Field label={forma.tecnicas} hint="Escolha da biblioteca e marque se pegou. Isso alimenta metas, planos e domínio.">
        <ListaFoco
          itens={s.focoTecnicas || []}
          onChange={(v) => set('focoTecnicas', v)}
          onAbrirSeletor={() => setSeletor({ tipo: 'foco' })}
        />
      </Field>

      {/* drill: quantas vezes cada técnica foi repetida */}
      {forma.repeticoes && (s.focoTecnicas || []).length > 0 && (
        <div className="col" style={{ gap: 8 }}>
          <span className="label">Repetições de cada uma</span>
          {s.focoTecnicas.map((ft, k) => (
            <div key={k} className="row" style={{ gap: 10, alignItems: 'center' }}>
              <span className="tiny" style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{ft.nome}</span>
              <Stepper value={Number(ft.reps) || 0} min={0} max={500}
                onChange={(v) => set('focoTecnicas', s.focoTecnicas.map((x, j) => (j === k ? { ...x, reps: v } : x)))} />
            </div>
          ))}
        </div>
      )}

      <Field label={forma.nota} hint="Detalhes, sacadas, o que focar da próxima, pergunta pro professor.">
        <Textarea value={s.nota || ''} onChange={(e) => set('nota', e.target.value)} placeholder="Escreve livre…" style={{ minHeight: 96 }} />
      </Field>
      </div>)}

      {forma.rolas === 'extra' && !mostraRolas && (
        <button type="button" className="btn ghost xs" style={{ alignSelf: 'flex-start' }} onClick={() => { setComRola(true); if (!rolas.length) addRola(); }}>
          <Plus size={13} /> Teve rola no fim da aula
        </button>
      )}

      {mostraRolas && <>
      <div className="divider" />
      <div className="row">
        <div>
          <div className="eyebrow">{forma.lutas ? 'suas lutas' : 'rolas'} ({rolas.length})</div>
          <p className="micro muted" style={{ marginTop: 3 }}>
            {forma.lutas
              ? 'Cada luta sua, com o adversário, os pontos e as finalizações. As lutas dos outros ficam na chave, lá em cima.'
              : 'Pontos, finalizações e anotação de cada rola. É daqui que sai tudo: placar, estilo de jogo e domínio.'}
          </p>
        </div>
        <span className="spacer" />
        <Btn size="sm" variant="primary" icon={Plus} onClick={addRola}>{forma.lutas ? 'Luta' : 'Rola'}</Btn>
      </div>

      <div className="col" style={{ gap: 9 }}>
        {rolas.map((r, i) => {
          /* o placar decide tudo: pontos, vantagem e empate também
             têm nome. A lista antiga só conhecia os quatro casos de
             finalização, e a etiqueta saía vazia no resto. */
          const res = resultadoDerivado(r);
          const open = rolaAberta === i;
          const parceiro = partners.find((p) => p.id === r.partnerId);
          return (
            <div key={i} className="card" style={{ padding: 0 }}>
              {/* a linha inteira abre o rola, menos a lixeira: por isso são
                  dois botões lado a lado, e não um dentro do outro */}
              <div className="list-item" style={{ padding: 12, borderBottom: open ? '1px solid var(--seam)' : 0 }}>
                <button
                  type="button"
                  className="grow row"
                  style={{ gap: 12, alignItems: 'center', textAlign: 'left', minWidth: 0 }}
                  onClick={() => setRolaAberta(open ? null : i)}
                  aria-expanded={open}
                >
                <span className="rola-n num">{i + 1}</span>
                <div className="grow col" style={{ gap: 6, minWidth: 0 }}>
                  <span className="tiny" style={{ fontWeight: 600, color: parceiro ? 'var(--roar)' : undefined }}>{parceiro?.nome || r.adversario || 'Sem parceiro'}</span>
                <div className="row wrap" style={{ gap: 6 }}>
                  <Chip tone={TOM_RESULTADO[res] || ''}>{ROTULO_RESULTADO[res]}</Chip>
                  <span className="micro muted num">{r.duracao}min</span>
                  {(r.contexto || 'rola') !== 'rola' && <Chip>{CONTEXTOS.find((c) => c.id === r.contexto)?.nome}</Chip>}
                  <Chip><Trophy size={10} /> {somarPontos(r.ptsMeus)}×{somarPontos(r.ptsDele)}</Chip>
                  {(r.subsAplicadas || []).length > 0 && <Chip tone="jade">+{r.subsAplicadas.length}</Chip>}
                  {(r.subsSofridas || []).length > 0 && <Chip tone="blood">−{r.subsSofridas.length}</Chip>}
                  {r.notas?.trim() && <MessageSquare size={12} className="muted" />}
                </div>
                </div>
                </button>
                <button type="button" className="btn ghost icon sm" onClick={() => setRolas(rolas.filter((_, j) => j !== i))} aria-label="Remover rola">
                  <Trash2 size={14} />
                </button>
              </div>

              {open && (
                <div className="col" style={{ padding: 12, gap: 12 }}>
                  {!partners.length && (
                    <button type="button" className="valida atencao" onClick={() => setParceirosAberto(true)} style={{ width: '100%', textAlign: 'left' }}>
                      <Users size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
                      <div>
                        <div className="tiny" style={{ fontWeight: 600 }}>Cadastre seus parceiros</div>
                        <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.6 }}>
                          Toque aqui. Com eles o app mostra contra quem você vence, e este treino fica esperando aberto.
                        </p>
                      </div>
                    </button>
                  )}
                  {/* o parceiro: com quem e o peso dele, num bloco com cor própria */}
                  <div className="bloco-cor parceiro">
                    <div className="bloco-cor-titulo"><Users size={15} /> {forma.lutas ? 'Contra quem' : 'Com quem foi'}</div>
                    {forma.lutas ? (
                      <div className="grid g2" style={{ gap: 10 }}>
                        <Field label="Adversário"><Input value={r.adversario || ''} onChange={(e) => setRola(i, { adversario: e.target.value })} placeholder="Nome do atleta" /></Field>
                        <Field label="Equipe dele"><Input value={r.equipeAdversario || ''} onChange={(e) => setRola(i, { equipeAdversario: e.target.value })} placeholder="Opcional" /></Field>
                      </div>
                    ) : (
                      <>
                        <ParceiroRapido
                          valor={r.partnerId}
                          partners={partners}
                          onEscolher={(id) => setRola(i, { partnerId: id })}
                        />
                        {!partners.length && <p className="micro muted">Escreva o nome e pronto. Academia e professor ficam pra depois.</p>}
                      </>
                    )}
                    <Field label="Peso dele em relação a você" hint="Encaixar em alguém mais pesado é mais difícil, e o app leva isso em conta.">
                      <EscolhaChips valor={r.pesoRel} onChange={(v) => setRola(i, { pesoRel: v })} opcoes={PESO_REL} />
                    </Field>
                  </div>

                  <div className="grid g2" style={{ gap: 10 }}>
                    <Field label="Duração (min)"><NumeroInput valor={r.duracao} onChange={(v) => setRola(i, { duracao: v })} /></Field>
                    <Field label="De onde começou" hint="Descobre de onde você ganha e de onde apanha.">
                      <Select value={r.posInicial || ''} onChange={(e) => setRola(i, { posInicial: e.target.value || null })}>
                        <option value="">Não anotei</option>
                        {POSICOES_INICIAIS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                      </Select>
                    </Field>
                  </div>

                  <Field label="Anotação deste rola" hint="O que funcionou, onde travou, o detalhe que faltou.">
                    <Textarea
                      value={r.notas || ''}
                      onChange={(e) => setRola(i, { notas: e.target.value })}
                      placeholder="Ex.: fiquei sem ar no final; ele passou por cima toda vez que abri a guarda…"
                      style={{ minHeight: 92 }}
                    />
                  </Field>

                  <Placar r={r} />

                  <div className="subs-bloco jade">
                    <div className="subs-titulo">
                      <Trophy size={12} /> Pontos que EU conquistei
                      <span className="spacer" />
                      <span className="num micro">{somarPontos(r.ptsMeus)} pts</span>
                    </div>
                    <PontosInput
                      valor={r.ptsMeus || []} onChange={(v) => setRola(i, { ptsMeus: v })}
                      catalogo={PONTOS} tone="jade"
                      nomes={r.tecMeus || {}}
                      onNomear={(p) => setSeletor({ tipo: 'ponto', rola: i, lado: 'tecMeus', ponto: p })}
                    />
                    <div className="row" style={{ gap: 8, marginTop: 11, alignItems: 'center' }}>
                      <span className="micro muted" style={{ flex: 1 }}>Vantagens, chegou perto, não segurou 3s</span>
                      <Stepper value={r.vantMinhas || 0} onChange={(v) => setRola(i, { vantMinhas: v })} min={0} max={20} />
                    </div>
                  </div>

                  <div className="subs-bloco blood">
                    <div className="subs-titulo">
                      <Trophy size={12} /> Pontos que EU sofri
                      <span className="spacer" />
                      <span className="num micro">{somarPontos(r.ptsDele)} pts</span>
                    </div>
                    <PontosInput
                      valor={r.ptsDele || []} onChange={(v) => setRola(i, { ptsDele: v })}
                      catalogo={PONTOS} tone="blood"
                      nomes={r.tecDele || {}}
                      onNomear={(p) => setSeletor({ tipo: 'ponto', rola: i, lado: 'tecDele', ponto: p })}
                    />
                    <div className="row" style={{ gap: 8, marginTop: 11, alignItems: 'center' }}>
                      <span className="micro muted" style={{ flex: 1 }}>Vantagens dele</span>
                      <Stepper value={r.vantDele || 0} onChange={(v) => setRola(i, { vantDele: v })} min={0} max={20} />
                    </div>
                  </div>

                  <div className="subs-bloco jade">
                    <div className="subs-titulo">
                      <span className="subs-seta">▲</span> Eu finalizei
                      <span className="spacer" />
                      <span className="num micro">{(r.subsAplicadas || []).length}</span>
                    </div>
                    <SubsInput
                      valor={r.subsAplicadas || []}
                      onChange={(v) => {
                        const nova = v.find((x) => !(r.subsAplicadas || []).includes(x));
                        if (!nova) { setRola(i, { subsAplicadas: v }); return; }
                        checarTecnica(nova, () => setRola(i, { subsAplicadas: v }));
                      }}
                      sugestoes={finalizacoes} rapidas={maisUsadas.apliquei}
                      tone="jade" placeholder="Qual finalização?"
                    />
                  </div>

                  <div className="subs-bloco blood">
                    <div className="subs-titulo">
                      <span className="subs-seta">▼</span> Ele me finalizou
                      <span className="spacer" />
                      <span className="num micro">{(r.subsSofridas || []).length}</span>
                    </div>
                    <SubsInput
                      valor={r.subsSofridas || []}
                      onChange={(v) => setRola(i, { subsSofridas: v })}
                      sugestoes={finalizacoes} rapidas={maisUsadas.sofri}
                      tone="blood" placeholder="Qual finalização?"
                    />
                  </div>


                </div>
              )}
            </div>
          );
        })}
        {rolas.length === 0 && (
          <p className="tiny muted">Sem rolas ainda. Cada rola registrado alimenta a escada posicional, o cálculo de domínio e as estatísticas.</p>
        )}
      </div>
      </>}

      <SeletorTecnica
        aberto={!!seletor}
        onClose={() => setSeletor(null)}
        techniques={techniques}
        categories={categories}
        positions={positions}
        faixa={faixa}
        idade={idade}
        modalidade={modalidadeDoTreino(s)}
        liberadas={liberadas}
        multiplo
        titulo={seletor?.tipo === 'foco' ? 'Técnicas da aula' : `Qual ${seletor?.ponto?.nome?.toLowerCase() || 'técnica'}?`}
        categoriaFiltro={seletor?.tipo === 'ponto' ? CAT_DO_PONTO[seletor.ponto.id] : null}
        recentes={seletor?.tipo === 'ponto' ? (recentesPorPonto[seletor.ponto.id] || []) : recentesFoco}
        jaEscolhidas={
          seletor?.tipo === 'foco'
            ? (s.focoTecnicas || []).map((x) => x.nome)
            : seletor
              ? ((rolas[seletor.rola]?.[seletor.lado] || {})[seletor.ponto.id] || [])
              : []
        }
        onEscolher={(tec) => {
          if (seletor.tipo === 'foco') {
            const atuais = s.focoTecnicas || [];
            if (atuais.some((x) => x.nome === tec.nome)) {
              set('focoTecnicas', atuais.filter((x) => x.nome !== tec.nome));
            } else {
              checarTecnica(tec.nome, () => set('focoTecnicas', [...atuais, { tecnicaId: tec.id, nome: tec.nome, aprendizado: null }]));
            }
          } else {
            const r = rolas[seletor.rola];
            const mapa = { ...(r[seletor.lado] || {}) };
            const lista = mapa[seletor.ponto.id] || [];
            const tirando = lista.includes(tec.nome);
            mapa[seletor.ponto.id] = tirando ? lista.filter((n) => n !== tec.nome) : [...lista, tec.nome];
            const aplicar = () => setRola(seletor.rola, { [seletor.lado]: mapa });
            if (tirando || seletor.lado !== 'tecMeus') aplicar();
            else checarTecnica(tec.nome, aplicar);
          }
        }}
      />

      <AntesDeCompetir aberto={antesDeCompetir} onClose={() => setAntesDeCompetir(false)} />

      <Sheet aberto={!!aviso} onClose={() => setAviso(null)} titulo={ehCompeticao(s.tipo) ? 'Em campeonato, isso é falta' : 'Essa técnica tem regra'}>
        {aviso && (
          <>
            <div className="valida atencao">
              <ShieldAlert size={16} className="valida-ico" style={{ color: 'var(--roar)' }} />
              <div>
                <div className="tiny" style={{ fontWeight: 700 }}>{aviso.nome}</div>
                <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{aviso.motivo}</p>
              </div>
            </div>
            <p className="tiny muted" style={{ lineHeight: 1.6 }}>
              {ehCompeticao(s.tipo)
                ? `Num campeonato da ${FONTE_DA_REGRA}, aplicar essa técnica desclassifica. Se foi isso mesmo que aconteceu, dá pra registrar.`
                : 'Na academia o professor pode liberar. Quer registrar mesmo assim?'}
            </p>
            <div className="col" style={{ gap: 8 }}>
              <Btn variant="primary" onClick={() => { aviso.aplicar(); setAviso(null); }}>Registrar mesmo assim</Btn>
              {!ehCompeticao(s.tipo) && (
                <Btn variant="contorno" onClick={() => { onLiberar?.(aviso.nome); aviso.aplicar(); setAviso(null); }}>
                  Meu professor libera, não avisar mais
                </Btn>
              )}
              <Btn variant="ghost" onClick={() => setAviso(null)}>Não registrar</Btn>
            </div>
          </>
        )}
      </Sheet>

      <Sheet aberto={parceirosAberto} onClose={() => setParceirosAberto(false)} titulo="Seus parceiros" subtitulo="cadastre e feche: o treino continua aqui">
        {parceirosAberto && (
          <Suspense fallback={<div className="entrada"><span className="brand-mark pulse" /></div>}>
            <AbaParceiros />
          </Suspense>
        )}
      </Sheet>
    </>
  );
}



/* placar do rola, calculado sozinho */
function Placar({ r }) {
  const p = placarDaRola(r);
  return (
    <div className="placar">
      <div className="placar-lado jade">
        <div className="placar-num num">{p.meus}</div>
        <div className="placar-lab">eu</div>
        {(p.finMeus > 0 || (r.vantMinhas || 0) > 0) && (
          <div className="placar-pts">
            {p.finMeus > 0 && `${p.finMeus} fin`}
            {p.finMeus > 0 && (r.vantMinhas || 0) > 0 && ' · '}
            {(r.vantMinhas || 0) > 0 && `${r.vantMinhas} vant`}
          </div>
        )}
      </div>
      <div className="placar-meio">
        <Chip tone={TOM_RESULTADO[p.resultado] || ''}>{ROTULO_RESULTADO[p.resultado]}</Chip>
        <span className="micro muted">sai dos pontos e finalizações</span>
      </div>
      <div className="placar-lado blood">
        <div className="placar-num num">{p.dele}</div>
        <div className="placar-lab">ele</div>
        {(p.finDele > 0 || (r.vantDele || 0) > 0) && (
          <div className="placar-pts">
            {p.finDele > 0 && `${p.finDele} fin`}
            {p.finDele > 0 && (r.vantDele || 0) > 0 && ' · '}
            {(r.vantDele || 0) > 0 && `${r.vantDele} vant`}
          </div>
        )}
      </div>
    </div>
  );
}
