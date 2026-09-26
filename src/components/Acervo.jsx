import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Film, Check, X, TriangleAlert, Plus, Lock, Unlock, Trash2, RefreshCw, Sparkles, ListChecks,
  CloudDownload, SkipForward, Pause,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Card, Btn, Chip, Field, Input, Textarea, Busca, Empty, Stat, Sheet, Bar, EscolhaChips, useToast,
} from './UI';
import Capa from './Capa';
import { lerLinha, idDoYoutube, tipoPorDuracao } from '../lib/categorizar';
import { duracaoTexto, TEMAS_AULA } from '../db/aulas';
import { buscarNoYoutube } from '../lib/youtube';
import { semAcento, conflitoDeTecnica } from '../lib/classificar';
import { CATALOGO_TECNICAS as TECNICAS, TECNICA_POR_UID as tecnicaPorUid, INDICE_TECNICAS } from '../lib/tecnicas';
import { naEsteira, rodarEsteira, gravarYoutube, LimiteDoDia } from '../lib/esteira';
import {
  POSICOES, LADOS, HABILIDADES, FORMATOS, NIVEIS, SITUACOES, CLASSIFICACOES,
  juntar, separar, familiaDaHabilidade, doLegado, paraLegado,
} from '../lib/vocab';

/* ============================================================
   ACERVO, PELO PAINEL

   Cadastrar vídeo é colar o link. O título e a duração vêm do
   YouTube, e a esteira (src/lib/esteira.js) classifica sozinha:
   a IA diz o que o vídeo ensina, no mesmo vocabulário do resto do
   acervo, e ele já aparece no tema certo e entra na recomendação.

   Você entra só na exceção. O que a IA não teve certeza cai em
   "Revisar", com o motivo escrito, e continua no ar enquanto isso.
   ============================================================ */

const nomeTema = (id) => TEMAS_AULA.find((t) => t.id === id)?.nome || id;

/* 980 -> "16:20", 3877 -> "1:04:37". É o formato que o campo de
   duração lê de volta, ao contrário do duracaoTexto ("1h04"). */
function relogio(s) {
  const p = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`;
}

const ytComProblema = (a) => a.yt_status === 'sumiu' || a.yt_status === 'sem_embed';

/* a linha colada pode ser só o link. O link com "youtu" ganha de
   uma palavra solta que por acaso parece um id. */
function idDaLinha(linha) {
  const partes = linha.split('|').map((p) => p.trim());
  return idDoYoutube(partes.find((p) => /youtu/i.test(p)) || '') || partes.map(idDoYoutube).find(Boolean) || null;
}

/* As técnicas que um vídeo pode ensinar são as da biblioteca
   (src/lib/tecnicas.js), com o mesmo uid estável que elas têm em
   todo aparelho. É por ele que a técnica que o aluno erra no rola
   encontra o vídeo que ensina ela. */

/* ============================================================
   DE QUEM E O VIDEO

   Tres respostas possiveis, e a lista precisa deixar isso claro
   sem ninguem abrir nada. Antes era um booleano de premium, e
   olhando a lista nao dava pra saber se o video era da
   assinatura ou vendido separado.
   ============================================================ */
export const ACESSOS = [
  {
    id: 'todos', nome: 'Gratuito', chip: 'grátis', tom: 'jade',
    resumo: 'Qualquer conta abre, dentro do limite do dia do plano grátis.',
  },
  {
    id: 'assinantes', nome: 'Só assinantes', chip: 'premium', tom: 'accent',
    resumo: 'Faz parte da assinatura e não é vendido separado. Quem assina abre, quem não assina vê o convite.',
  },
  {
    id: 'avulso', nome: 'Vendido à parte', chip: 'avulso', tom: 'roar',
    resumo: 'Não entra na assinatura. Tem checkout próprio, e nem quem assina abre sem comprar.',
  },
];

const acessoDe = (id) => ACESSOS.find((a) => a.id === id) || ACESSOS[0];

export default function Acervo() {
  const toast = useToast();

  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');

  const [colando, setColando] = useState(false);
  const [modo, setModo] = useState('um');
  const [texto, setTexto] = useState('');
  const [fila, setFila] = useState([]);
  const [um, setUm] = useState({ t: '', link: '', d: '' });
  const [ytUm, setYtUm] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);

  const [editando, setEditando] = useState(null);
  const [revisando, setRevisando] = useState(false);
  const [pulados, setPulados] = useState([]);

  const [esteira, setEsteira] = useState(null);
  const [pausada, setPausada] = useState(false);
  const [avisoEsteira, setAvisoEsteira] = useState(null);
  const rodandoEsteira = useRef(false);
  const pararEsteira = useRef(false);
  const [conferindoYt, setConferindoYt] = useState(false);

  async function buscar() {
    if (!supabase) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('aula')
        .select('*')
        .order('atualizado_em', { ascending: false })
        .limit(2000);
      if (error) throw error;
      setLista(data || []);
    } catch (e) {
      console.error('[acervo]', e);
      toast('Não consegui ler o acervo', 'err');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { buscar(); }, []);

  /* vídeo sem a proporção (em pé ou deitado): pergunta ao YouTube uma
     vez, em silêncio. Os 680 custam umas 14 perguntas. Antes do SQL
     23 a coluna não existe e nada acontece. */
  const completouProporcao = useRef(false);
  useEffect(() => {
    if (carregando || completouProporcao.current || !lista.length || !('vertical' in lista[0])) return;
    const faltam = lista.filter((a) => a.vertical == null).map((a) => a.id);
    completouProporcao.current = true;
    if (!faltam.length) return;
    /* diz o que aconteceu: antes a falha passava em silêncio e os 680
       continuavam sem proporção sem ninguém saber por quê */
    gravarYoutube(faltam)
      .then((r) => {
        const com = [...r.values()].filter((x) => x.vertical != null);
        const emPe = com.filter((x) => x.vertical).length;
        toast(com.length
          ? `Proporção de ${com.length} vídeos conferida no YouTube: ${emPe} em pé, ${com.length - emPe} deitados`
          : `O YouTube não mandou a proporção de nenhum dos ${faltam.length} vídeos`, com.length ? '' : 'err');
        buscar();
      })
      .catch((e) => {
        console.error('[acervo] proporção', e);
        toast(`Não consegui conferir a proporção no YouTube: ${String(e?.message || e).slice(0, 120)}`, 'err');
      });
  }, [carregando, lista.length]);

  /* ------------------------------------------------------------
     A ESTEIRA

     Abriu o painel e tem vídeo esperando a IA, ela anda sozinha,
     do mais novo pro mais antigo. Cada vídeo aparece classificado
     na lista assim que fica pronto.
     ------------------------------------------------------------ */
  const pendentes = useMemo(() => lista.filter(naEsteira), [lista]);

  async function ligarEsteira() {
    if (rodandoEsteira.current || !pendentes.length) return;
    rodandoEsteira.current = true;
    pararEsteira.current = false;
    setAvisoEsteira(null);
    setEsteira({ feitos: 0, revisar: 0, total: pendentes.length });
    try {
      const r = await rodarEsteira(pendentes, {
        indice: INDICE_TECNICAS,
        parar: () => pararEsteira.current,
        aoAndar: (linha, conta) => {
          setLista((l) => l.map((x) => (x.id === linha.id ? linha : x)));
          setEsteira((e) => ({ ...e, feitos: conta.feitos, revisar: conta.revisar }));
        },
      });
      const avisos = [];
      if (r.erros) avisos.push(`${r.erros} ${r.erros === 1 ? 'vídeo não passou' : 'vídeos não passaram'} pela IA desta vez. Na próxima vez que o painel abrir, a esteira tenta de novo.`);
      if (r.semYoutube) avisos.push('Não consegui falar com o YouTube, então a IA classificou só pelo título. Confira se a chave do YouTube está salva no banco.');
      if (avisos.length) setAvisoEsteira(avisos.join(' '));
    } catch (e) {
      setAvisoEsteira(e instanceof LimiteDoDia
        ? 'A IA chegou no limite de uso de hoje. O que já passou está salvo, e amanhã a esteira continua sozinha quando o painel abrir.'
        : `A esteira parou: ${e.message}`);
    } finally {
      rodandoEsteira.current = false;
      setEsteira(null);
    }
  }

  useEffect(() => {
    if (!carregando && pendentes.length && !rodandoEsteira.current && !avisoEsteira && !pausada) ligarEsteira();
  }, [carregando, pendentes.length]);

  /* ------------------------------------------------------------
     A etiqueta que contradiz o título. A esteira passou a conferir
     isso; os vídeos que ela já tinha classificado antes são
     conferidos aqui, uma vez por abertura do painel: título que
     cita Americana com a técnica marcada como Triângulo vai pra
     revisão, com o motivo escrito.
     ------------------------------------------------------------ */
  const reconferiu = useRef(false);
  useEffect(() => {
    if (carregando || reconferiu.current || !lista.length) return;
    reconferiu.current = true;
    const suspeitos = lista
      .filter((a) => a.classificacao === 'automatica')
      .map((a) => ({ a, citado: conflitoDeTecnica(a.titulo, a.tecnicas, INDICE_TECNICAS) }))
      .filter((x) => x.citado);
    if (!suspeitos.length) return;
    (async () => {
      let n = 0;
      for (const { a, citado } of suspeitos) {
        const r = await salvarUm(a, {
          classificacao: 'revisar',
          classificacao_motivo: `o título fala de ${citado} e a técnica marcada é outra`,
        });
        if (r) n++;
      }
      if (n) toast(`${n} ${n === 1 ? 'vídeo foi' : 'vídeos foram'} pra revisão: a técnica marcada contradiz o título`);
    })();
  }, [carregando, lista.length]);

  function pausarEsteira() {
    pararEsteira.current = true;
    setPausada(true);
  }

  function continuarEsteira() {
    setPausada(false);
    setAvisoEsteira(null);
    ligarEsteira();
  }

  async function conferirNoYoutube() {
    setConferindoYt(true);
    try {
      const r = await gravarYoutube(lista.map((a) => a.id));
      const problemas = [...r.values()].filter((x) => x.status !== 'ok').length;
      toast(problemas
        ? `${r.size} conferidos, ${problemas} com problema no YouTube`
        : `${r.size} conferidos, todos tocam no app`);
      await buscar();
    } catch (e) {
      toast(String(e?.message).includes('administrador')
        ? 'Esta conta não tem permissão de administrador'
        : 'Não consegui falar com o YouTube', 'err');
    } finally {
      setConferindoYt(false);
    }
  }

  /* ------------------------------------------------------------
     A FILA

     Os dois jeitos de cadastrar terminam no mesmo lugar: um link
     de cada vez, ou vários colados. O título e a duração vêm do
     YouTube. Nada é gravado até você conferir a fila.
     ------------------------------------------------------------ */
  const idsNoAcervo = useMemo(() => new Set(lista.map((a) => a.id)), [lista]);
  const jaExistem = fila.filter((x) => idsNoAcervo.has(x.id));
  const aRevisar = fila.filter((x) => x.precisaRevisar);

  const umPronto = lerLinha(`${um.t} | ${um.link} | ${um.d}`);
  const idUm = idDoYoutube(um.link);
  const ytAtual = ytUm && ytUm.id === idUm ? ytUm : null;

  /* colou o link: o título e a duração vêm do YouTube */
  useEffect(() => {
    if (!idUm || ytUm?.id === idUm) return undefined;
    let vivo = true;
    const t = setTimeout(async () => {
      setYtUm({ id: idUm, estado: 'buscando' });
      try {
        const v = (await buscarNoYoutube([idUm])).get(idUm);
        if (!vivo) return;
        setYtUm({ id: idUm, estado: v.status, info: v });
        if (v.titulo) setUm((u) => ({ ...u, t: u.t || v.titulo, d: u.d || relogio(v.duracao) }));
      } catch {
        if (vivo) setYtUm({ id: idUm, estado: 'erro' });
      }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [idUm]);

  function porNaFila(itens) {
    const novos = itens.filter((x) => !x.erro);
    if (!novos.length) return 0;
    setFila((f) => {
      const mapa = new Map(f.map((x) => [x.id, x]));
      for (const v of novos) mapa.set(v.id, v);
      return [...mapa.values()];
    });
    return novos.length;
  }

  function adicionarUm() {
    if (umPronto.erro) { toast(umPronto.erro, 'err'); return; }
    porNaFila([{ ...umPronto, yt: ytAtual?.info }]);
    setUm({ t: '', link: '', d: '' });
    setYtUm(null);
  }

  /* a linha completa vale como está. Só o link, ou sem a duração,
     o YouTube completa. O título que você escreveu ganha do dele. */
  function montar(linha, info) {
    const lida = lerLinha(linha);
    if (!lida.erro) return { ...lida, yt: info };
    const id = idDaLinha(linha);
    if (!id) return lida;
    if (!info?.titulo) return { erro: info?.status === 'sumiu' ? 'o YouTube não achou este vídeo' : lida.erro };
    const proprio = linha.split('|').map((p) => p.trim())
      .filter((p) => p && !idDoYoutube(p) && !/^\[?[\d:]+\]?$/.test(p)).join(' ').trim();
    const t = proprio || info.titulo;
    return { id, t, d: info.duracao, ...categorizar(t, info.duracao), yt: info };
  }

  async function adicionarColados() {
    const linhas = String(texto).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (!linhas.length) return;
    setLendo(true);
    let yt = new Map();
    try {
      yt = await buscarNoYoutube(linhas.map(idDaLinha).filter(Boolean));
    } catch {
      toast('Não consegui falar com o YouTube. Só entram as linhas com título, link e duração.', 'err');
    }
    const lidas = linhas.map((l) => montar(l, yt.get(idDaLinha(l))));
    setLendo(false);
    const ruins = lidas.filter((x) => x.erro);
    const n = porNaFila(lidas);
    setTexto('');
    if (!n) { toast(ruins[0]?.erro ? `Nenhuma linha entrou: ${ruins[0].erro}` : 'Não consegui ler nenhuma linha', 'err'); return; }
    toast(ruins.length ? `${n} na fila, ${ruins.length} com problema` : `${n} na fila`);
  }

  function fecharCadastro() {
    setColando(false);
    setFila([]);
    setTexto('');
    setUm({ t: '', link: '', d: '' });
    setYtUm(null);
  }

  async function gravar() {
    if (!fila.length) return;
    setGravando(true);
    try {
      /* o vídeo novo entra "pelo título" e a esteira pega ele */
      const novos = fila.filter((v) => !idsNoAcervo.has(v.id)).map((v) => {
        const n = doLegado(v);
        return {
          id: v.id,
          titulo: v.t,
          duracao: v.d,
          tipo: v.tipo,
          temas: v.temas.length ? v.temas : ['geral'],
          posicoes: v.posicoes,
          faixa: v.faixa,
          revisar: v.precisaRevisar,
          acesso: 'todos',
          posicao_lado: n.posicaoLado,
          habilidades: n.habilidades,
          formato: n.formato,
          nivel: n.nivel,
          classificacao: 'legado',
          yt_descricao: v.yt?.descricao || null,
          yt_tags: v.yt?.tags || null,
          yt_status: v.yt?.status || null,
        };
      });
      /* o que já está no acervo só troca título e duração. O que ele
         ensina, conferido ou não, fica como está. */
      const velhos = fila.filter((v) => idsNoAcervo.has(v.id))
        .map((v) => ({ id: v.id, titulo: v.t, duracao: v.d, tipo: v.tipo }));

      let n = 0;
      for (const linhas of [novos, velhos]) {
        if (!linhas.length) continue;
        const { data, error } = await supabase
          .from('aula')
          .upsert(linhas, { onConflict: 'id' })
          .select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('sem permissão');
        n += data.length;
      }

      toast(novos.length
        ? `${n} ${n === 1 ? 'vídeo gravado' : 'vídeos gravados'}. A IA já está classificando.`
        : `${n} ${n === 1 ? 'vídeo atualizado' : 'vídeos atualizados'}`);
      fecharCadastro();
      setAvisoEsteira(null);
      setPausada(false);
      await buscar();
    } catch (e) {
      toast(
        String(e?.message).includes('permissão')
          ? 'Esta conta não tem permissão de administrador no servidor'
          : 'Não consegui gravar',
        'err'
      );
    } finally {
      setGravando(false);
    }
  }

  async function salvarUm(aula, campos) {
    try {
      const { data, error } = await supabase
        .from('aula').update(campos).eq('id', aula.id).select('*');
      if (error) throw error;
      if (!data?.length) throw new Error('sem permissão');
      setLista((l) => l.map((x) => (x.id === aula.id ? data[0] : x)));
      return data[0];
    } catch (e) {
      toast(
        String(e?.message).includes('permissão')
          ? 'Esta conta não tem permissão de administrador'
          : 'Não consegui salvar',
        'err'
      );
      return null;
    }
  }

  /* ------------------------------------------------------------
     A FILA DE REVISÃO

     Um vídeo depois do outro, só os que a IA não teve certeza.
     Pular deixa o vídeo em Revisar pra depois.
     ------------------------------------------------------------ */
  const restaRevisar = lista.filter((a) => a.classificacao === 'revisar' && !pulados.includes(a.id));

  function comecarRevisao() {
    const primeira = lista.find((a) => a.classificacao === 'revisar');
    if (!primeira) return;
    setPulados([]);
    setRevisando(true);
    setEditando(primeira);
  }

  function seguirRevisao(pular) {
    const atual = editando?.id;
    if (pular) setPulados((l) => [...l, atual]);
    const proxima = restaRevisar.find((a) => a.id !== atual);
    if (proxima) { setEditando(proxima); return; }
    setEditando(null);
    setRevisando(false);
    toast(pular || pulados.length ? 'Fim da fila. Os pulados continuam em Revisar.' : 'Nada mais pra revisar');
  }

  function fecharEditor() {
    setEditando(null);
    setRevisando(false);
  }

  const mostradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((a) => {
      if (filtro === 'revisar' && a.classificacao !== 'revisar') return false;
      if (filtro === 'youtube' && !ytComProblema(a)) return false;
      if (filtro === 'pagos' && a.acesso === 'todos') return false;
      if (filtro === 'entrada' && !a.destaque) return false;
      if (filtro === 'inativos' && a.ativo !== false) return false;
      if (filtro === 'aula' && a.tipo !== 'aula') return false;
      if (filtro === 'short' && a.tipo !== 'short') return false;
      return !q || a.titulo.toLowerCase().includes(q);
    });
  }, [lista, busca, filtro]);

  const resumo = useMemo(() => ({
    total: lista.length,
    aulas: lista.filter((a) => a.tipo === 'aula').length,
    shorts: lista.filter((a) => a.tipo === 'short').length,
    revisar: lista.filter((a) => a.classificacao === 'revisar').length,
    automaticas: lista.filter((a) => a.classificacao === 'automatica').length,
    conferidas: lista.filter((a) => a.classificacao === 'revisada').length,
    youtube: lista.filter(ytComProblema).length,
    pagos: lista.filter((a) => a.acesso !== 'todos').length,
    entrada: lista.filter((a) => a.destaque).length,
  }), [lista]);
  const passaram = resumo.automaticas + resumo.revisar + resumo.conferidas;

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">cole o link, o resto é automático</div>
            <h2 className="h-sec row" style={{ gap: 8 }}><Film size={16} /> Acervo</h2>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={buscar} disabled={carregando}>Atualizar</Btn>
            <Btn size="sm" variant="primary" icon={Plus} onClick={() => setColando(true)}>Adicionar</Btn>
          </div>
        </div>

        <div className="grid g4" style={{ gap: 12, marginTop: 4 }}>
          <Stat size="sm" valor={resumo.total} label="no acervo" />
          <Stat size="sm" valor={resumo.aulas} label="aulas longas" />
          <Stat size="sm" valor={resumo.shorts} label="shorts" />
          <Stat size="sm" valor={resumo.revisar} label="pra revisar" tone={resumo.revisar ? 'roar' : undefined} />
        </div>

        {/* ---------- a esteira ---------- */}
        <div className="col" style={{ gap: 8, marginTop: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div className="tiny" style={{ fontWeight: 600 }}>
              {esteira
                ? `A IA está classificando: ${esteira.feitos} de ${esteira.total}`
                : pendentes.length
                  ? `${pendentes.length} ${pendentes.length === 1 ? 'vídeo esperando' : 'vídeos esperando'} a IA`
                  : 'Todo o acervo passou pela IA'}
            </div>
            {esteira ? (
              <Btn size="xs" variant="ghost" icon={Pause} onClick={pausarEsteira}>Pausar</Btn>
            ) : pendentes.length > 0 && (
              <Btn size="xs" variant="ghost" icon={Sparkles} onClick={continuarEsteira}>
                {pausada ? 'Continuar' : 'Classificar agora'}
              </Btn>
            )}
          </div>
          <Bar v={esteira ? esteira.feitos : passaram} max={esteira ? esteira.total : resumo.total} tone="jade" />
          <p className="micro muted" style={{ lineHeight: 1.6 }}>
            {passaram} de {resumo.total} já passaram pela IA · {resumo.automaticas} automáticos · {resumo.conferidas} conferidos por você
            {esteira?.revisar ? ` · ${esteira.revisar} desta vez foram pra revisão` : ''}
          </p>
          {avisoEsteira && (
            <div className="valida atencao">
              <TriangleAlert size={14} className="valida-ico" style={{ color: 'var(--roar)' }} />
              <p className="micro muted" style={{ lineHeight: 1.6 }}>{avisoEsteira}</p>
            </div>
          )}
        </div>

        {resumo.revisar > 0 && (
          <button className="valida atencao" style={{ width: '100%', textAlign: 'left', marginTop: 12 }}
            onClick={comecarRevisao}>
            <p className="micro muted" style={{ lineHeight: 1.65 }}>
              Em {resumo.revisar} {resumo.revisar === 1 ? 'vídeo' : 'vídeos'} a IA não teve certeza ou discordou do que
              já estava etiquetado. Eles continuam no ar. Toque aqui pra conferir um de cada vez.
            </p>
          </button>
        )}

        {resumo.youtube > 0 && (
          <button className="valida ruim" style={{ width: '100%', textAlign: 'left', marginTop: 12 }}
            onClick={() => setFiltro('youtube')}>
            <p className="micro muted" style={{ lineHeight: 1.65 }}>
              {resumo.youtube} {resumo.youtube === 1 ? 'vídeo sumiu' : 'vídeos sumiram'} do YouTube ou não
              {resumo.youtube === 1 ? ' toca' : ' tocam'} fora dele. Quem abrir no app vê erro. Toque pra ver quais.
            </p>
          </button>
        )}

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <Btn size="xs" variant="ghost" icon={CloudDownload} onClick={conferirNoYoutube} disabled={conferindoYt || !lista.length}>
            {conferindoYt ? 'Conferindo…' : 'Conferir tudo no YouTube'}
          </Btn>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Busca value={busca} onChange={setBusca} placeholder="Buscar no acervo" />
        <div className="seletor-pill" style={{ marginTop: 10 }}>
          {[
            { id: 'todos', nome: 'Tudo' },
            { id: 'aula', nome: 'Aulas' },
            { id: 'short', nome: 'Shorts' },
            { id: 'pagos', nome: 'Pagos' },
            { id: 'entrada', nome: 'Entrada' },
            { id: 'inativos', nome: 'Fora do ar' },
            { id: 'revisar', nome: 'Revisar' },
            ...(resumo.youtube ? [{ id: 'youtube', nome: 'YouTube' }] : []),
          ].map((o) => (
            <button key={o.id} className={filtro === o.id ? 'on' : ''} onClick={() => setFiltro(o.id)}>{o.nome}</button>
          ))}
        </div>
      </Card>

      {carregando ? (
        <Card><p className="tiny muted">Buscando o acervo.</p></Card>
      ) : !mostradas.length ? (
        <Card>
          <Empty
            icon={Film}
            titulo={lista.length ? 'Nada com esse filtro' : 'O acervo está vazio'}
            texto={lista.length
              ? 'Tente outro filtro ou outra busca.'
              : 'Rode o aulas.sql e o aulas-carga.sql no Supabase, ou cole os links aqui no Adicionar.'}
          />
        </Card>
      ) : (
        <div className="col" style={{ gap: 9 }}>
          {mostradas.slice(0, 120).map((a) => (
            <button key={a.id} className="vista-item" onClick={() => setEditando(a)}>
              <Capa id={a.id} propria={a.capa_url} tamanho="mq" />
              <div className="vista-txt">
                <div className="vista-titulo">{a.titulo}</div>
                <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                  <span className="micro muted num">{duracaoTexto(a.duracao)}</span>
                  <Chip>{a.tipo === 'aula' ? 'aula' : 'short'}</Chip>
                  {a.acesso !== 'todos' && (
                    <Chip tone={acessoDe(a.acesso).tom}>{acessoDe(a.acesso).chip}</Chip>
                  )}
                  {a.destaque && <Chip tone="jade">entrada</Chip>}
                  {a.acesso === 'avulso' && !a.checkout_url && (
                    <Chip tone="blood">falta o link</Chip>
                  )}
                  {a.acesso === 'avulso' && !a.produto_hotmart && (
                    <Chip tone="blood">falta o produto</Chip>
                  )}
                  {a.curso_id && <Chip tone="ice">curso {a.curso_id}</Chip>}
                  {a.classificacao === 'revisar' && <Chip tone="roar">revisar</Chip>}
                  {a.classificacao === 'revisada' && <Chip tone="jade">conferido</Chip>}
                  {a.yt_status === 'sumiu' && <Chip tone="blood">sumiu do YouTube</Chip>}
                  {a.yt_status === 'sem_embed' && <Chip tone="blood">não toca no app</Chip>}
                  {!a.ativo && <Chip>fora do ar</Chip>}
                  {(a.temas || []).map((t) => <Chip key={t}>{nomeTema(t)}</Chip>)}
                </div>
              </div>
            </button>
          ))}
          {mostradas.length > 120 && (
            <p className="micro muted center">Mostrando 120 de {mostradas.length}. Use a busca pra achar o resto.</p>
          )}
        </div>
      )}

      {/* ---------- cadastrar vídeos novos ---------- */}
      <Sheet
        aberto={colando}
        onClose={fecharCadastro}
        titulo="Adicionar vídeos"
        subtitulo={fila.length ? `${fila.length} na fila` : undefined}
        wide
        footer={
          <>
            <Btn variant="ghost" onClick={fecharCadastro}>Cancelar</Btn>
            <Btn variant="primary" icon={Check} onClick={gravar} disabled={!fila.length || gravando}>
              {gravando ? 'Gravando…' : `Gravar ${fila.length || ''}`}
            </Btn>
          </>
        }
      >
        <div className="seletor-pill">
          {[{ id: 'um', nome: 'Um de cada vez' }, { id: 'varios', nome: 'Colar vários' }].map((o) => (
            <button key={o.id} className={modo === o.id ? 'on' : ''} onClick={() => setModo(o.id)}>{o.nome}</button>
          ))}
        </div>

        {modo === 'um' ? (
          <div className="col" style={{ gap: 2, marginTop: 14 }}>
            <Field label="Link do YouTube" hint="O título e a duração vêm sozinhos.">
              <Input
                value={um.link}
                onChange={(e) => setUm({ ...um, link: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                inputMode="url"
              />
            </Field>

            {ytAtual?.estado === 'buscando' && <p className="micro muted" style={{ marginBottom: 10 }}>Buscando no YouTube…</p>}
            {['sumiu', 'sem_embed', 'erro'].includes(ytAtual?.estado) && (
              <div className={`valida ${ytAtual.estado === 'erro' ? 'atencao' : 'ruim'}`} style={{ marginBottom: 10 }}>
                <TriangleAlert size={14} className="valida-ico" style={{ color: ytAtual.estado === 'erro' ? 'var(--roar)' : 'var(--blood)' }} />
                <p className="micro muted" style={{ lineHeight: 1.6 }}>
                  {ytAtual.estado === 'sumiu' && 'O YouTube não achou este vídeo. Pode ter sido apagado, estar privado, ou o link está errado.'}
                  {ytAtual.estado === 'sem_embed' && 'O dono deste vídeo proibiu tocar fora do YouTube. Dá pra gravar, mas no app ele não abre.'}
                  {ytAtual.estado === 'erro' && 'Não consegui falar com o YouTube. Preencha o título e a duração na mão.'}
                </p>
              </div>
            )}

            <Field label="Título">
              <Input
                value={um.t}
                onChange={(e) => setUm({ ...um, t: e.target.value })}
                placeholder="Como raspar na guarda laço"
              />
            </Field>
            <Field label="Duração" hint="Aceita 2:07, 1:04:37 ou o número de segundos.">
              <Input
                value={um.d}
                onChange={(e) => setUm({ ...um, d: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') adicionarUm(); }}
                placeholder="2:07"
                inputMode="numeric"
              />
            </Field>

            {/* o que o app entendeu, antes de entrar na fila */}
            {!umPronto.erro && (
              <div className="valida bom" style={{ marginBottom: 10 }}>
                <Check size={14} className="valida-ico" style={{ color: 'var(--jade)' }} />
                <div className="row wrap" style={{ gap: 6 }}>
                  <Chip>{umPronto.tipo === 'aula' ? 'aula longa' : 'short'}</Chip>
                  {umPronto.faixa && <Chip>{umPronto.faixa}</Chip>}
                  {umPronto.temas.map((t) => <Chip key={t} tone="jade">{nomeTema(t)}</Chip>)}
                  <Chip>a IA classifica depois de gravar</Chip>
                </div>
              </div>
            )}

            <Btn variant="primary" icon={Plus} onClick={adicionarUm} disabled={!!umPronto.erro}>
              Pôr na fila
            </Btn>
          </div>
        ) : (
          <div className="col" style={{ gap: 2, marginTop: 14 }}>
            <Field
              label="Um vídeo por linha"
              hint="O link sozinho basta. Se quiser escrever o título, use: título | link | duração"
            >
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={6}
                placeholder={'https://www.youtube.com/watch?v=qMr-tps8s70\nhttps://youtu.be/x6rUwSGHVMY'}
              />
            </Field>
            <Btn variant="primary" icon={Plus} onClick={adicionarColados} disabled={!texto.trim() || lendo}>
              {lendo ? 'Buscando no YouTube…' : 'Pôr tudo na fila'}
            </Btn>
          </div>
        )}

        {/* ---------- a fila ---------- */}
        {fila.length > 0 && (
          <div className="col" style={{ gap: 10, marginTop: 18 }}>
            <div className="row wrap" style={{ gap: 7 }}>
              <div className="eyebrow" style={{ flex: 1 }}>na fila pra gravar</div>
              {jaExistem.length > 0 && <Chip>{jaExistem.length} já no acervo</Chip>}
              {aRevisar.length > 0 && <Chip>{aRevisar.length} o título não diz, a IA descobre</Chip>}
            </div>

            {jaExistem.length > 0 && (
              <div className="valida atencao">
                <TriangleAlert size={14} className="valida-ico" style={{ color: 'var(--roar)' }} />
                <p className="micro muted" style={{ lineHeight: 1.6 }}>
                  {jaExistem.length} {jaExistem.length === 1 ? 'já está' : 'já estão'} no acervo. Gravar troca só
                  o título e a duração. O que o vídeo ensina continua como está.
                </p>
              </div>
            )}

            {fila.map((x) => (
              <div key={x.id} className="row" style={{ gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--void)', borderRadius: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tiny" style={{ fontWeight: 600 }}>{x.t}</div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <span className="micro muted num">{duracaoTexto(x.d)}</span>
                    <Chip>{x.tipo === 'aula' ? 'aula' : 'short'}</Chip>
                    {x.faixa && <Chip>{x.faixa}</Chip>}
                    {x.temas.map((t) => <Chip key={t} tone="jade">{nomeTema(t)}</Chip>)}
                    {x.yt?.status === 'sem_embed' && <Chip tone="blood">não toca no app</Chip>}
                    {idsNoAcervo.has(x.id) && <Chip>já no acervo</Chip>}
                  </div>
                </div>
                <button
                  className="btn ghost xs"
                  aria-label="Tirar da fila"
                  onClick={() => setFila((f) => f.filter((y) => y.id !== x.id))}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      {/* ---------- um vídeo ---------- */}
      <EditarAula
        aula={editando}
        onClose={fecharEditor}
        onSalvar={salvarUm}
        revisao={revisando ? {
          resta: restaRevisar.length,
          onPular: () => seguirRevisao(true),
          onSalvo: () => seguirRevisao(false),
        } : null}
      />
    </>
  );
}

/* ============================================================
   UM VÍDEO

/* ============================================================
   UM VÍDEO

   Tudo que decide a vida do vídeo dentro do app fica aqui,
   agrupado por pergunta em vez de por campo:

     o que é          título, descrição, o que o YouTube diz
     de quem é        gratuito, de assinante ou vendido à parte
     o que ensina     posição e lado, habilidades, situação,
                      formato, nível e técnicas
     onde aparece     etiquetas, ordem, capa
     está no ar       ativo, e se abre pra quem acabou de chegar

   A IA já preencheu o que ensina. Aqui você só corrige, e o que
   você conferiu nada automático mexe mais.

   O link de compra só aparece quando o vídeo é vendido à parte.
   Campo de checkout em vídeo gratuito não tem sentido e só dá
   margem pra cadastrar errado.
   ============================================================ */
function EditarAula({ aula, onClose, onSalvar, revisao }) {
  const toast = useToast();
  const [f, setF] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [yt, setYt] = useState(null);
  const [buscaTec, setBuscaTec] = useState('');

  useEffect(() => {
    setF(aula ? {
      titulo: aula.titulo || '',
      descricao: aula.descricao || '',
      acesso: aula.acesso || 'todos',
      checkout_url: aula.checkout_url || '',
      produto_hotmart: aula.produto_hotmart || '',
      capa_url: aula.capa_url || '',
      ordem: aula.ordem ?? '',
      ativo: aula.ativo !== false,
      destaque: !!aula.destaque,
      tags: (aula.tags || []).join(', '),
      curso_id: aula.curso_id ?? '',
      duracao: aula.duracao,
      posicaoLado: aula.posicao_lado || [],
      habilidades: aula.habilidades || [],
      situacoes: aula.situacoes || [],
      tecnicas: aula.tecnicas || [],
      formato: aula.formato || null,
      nivel: aula.nivel || null,
      conferida: aula.classificacao === 'revisada',
    } : null);
    setBuscaTec('');
  }, [aula]);

  /* o que o YouTube diz agora: título, duração e se ainda toca */
  useEffect(() => {
    setYt(null);
    if (!aula?.id) return undefined;
    let vivo = true;
    buscarNoYoutube([aula.id])
      .then((m) => { if (vivo) setYt(m.get(aula.id)); })
      .catch(() => { if (vivo) setYt({ status: 'erro' }); });
    return () => { vivo = false; };
  }, [aula?.id]);

  if (!aula || !f) return null;

  const listar = (txt) => String(txt).split(',').map((x) => x.trim()).filter(Boolean);
  const acesso = acessoDe(f.acesso);
  const faltaLink = f.acesso === 'avulso' && !f.checkout_url.trim();
  const faltaProduto = f.acesso === 'avulso' && !f.produto_hotmart.trim();

  /* mexer no que o vídeo ensina já conta como conferir */
  const ensina = (campos) => setF({ ...f, ...campos, conferida: true });
  const alternar = (lista, id) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  const volta = paraLegado(f);
  const estado = CLASSIFICACOES.find((c) => c.id === aula.classificacao);

  const sugeridas = (() => {
    const q = semAcento(buscaTec);
    const livre = (t) => !f.tecnicas.includes(t.uid);
    if (q) return TECNICAS.filter((t) => livre(t) && t.busca.includes(q)).slice(0, 8);
    const cats = new Set(f.habilidades.flatMap(familiaDaHabilidade));
    if (!cats.size) return [];
    const posicoes = new Set(f.posicaoLado.map((pl) => separar(pl).posicao));
    return TECNICAS.filter((t) => livre(t) && cats.has(t.cat) && (!posicoes.size || posicoes.has(t.posicao))).slice(0, 8);
  })();

  async function salvar(conferir = f.conferida) {
    setSalvando(true);
    const campos = {
      titulo: f.titulo.trim(),
      descricao: f.descricao.trim() || null,
      acesso: f.acesso,
      checkout_url: f.acesso === 'avulso' ? (f.checkout_url.trim() || null) : null,
      produto_hotmart: f.acesso === 'avulso' ? (f.produto_hotmart.trim() || null) : null,
      capa_url: f.capa_url.trim() || null,
      ordem: f.ordem === '' ? null : Number(f.ordem),
      ativo: f.ativo,
      destaque: f.destaque,
      tags: listar(f.tags),
      curso_id: f.curso_id === '' ? null : Number(f.curso_id),
      posicao_lado: f.posicaoLado,
      habilidades: f.habilidades,
      situacoes: f.situacoes,
      tecnicas: f.tecnicas,
      formato: f.formato,
      nivel: f.nivel,
    };
    if (f.duracao !== aula.duracao) Object.assign(campos, { duracao: f.duracao, tipo: tipoPorDuracao(f.duracao) });
    if (yt?.status && yt.status !== 'erro') {
      Object.assign(campos, { yt_descricao: yt.descricao || null, yt_tags: yt.tags || null, yt_status: yt.status });
    }

    const ensinaAntes = JSON.stringify([aula.posicao_lado || [], aula.habilidades || [], aula.situacoes || [],
      aula.tecnicas || [], aula.formato || null, aula.nivel || null]);
    const ensinaAgora = JSON.stringify([f.posicaoLado, f.habilidades, f.situacoes, f.tecnicas, f.formato, f.nivel]);

    if (conferir && (aula.classificacao !== 'revisada' || ensinaAntes !== ensinaAgora)) {
      Object.assign(campos, {
        classificacao: 'revisada',
        classificacao_motivo: null,
        classificado_em: new Date().toISOString(),
        /* conferido por alguém, o tema do Estudo segue o que foi conferido */
        temas: volta.temas.length ? volta.temas : aula.temas,
        posicoes: volta.posicoes,
        revisar: false,
      });
    } else if (!conferir && aula.classificacao === 'revisada') {
      /* tirou a marca: o vídeo volta pra esteira */
      Object.assign(campos, { classificacao: 'legado', classificacao_motivo: null });
    }

    const r = await onSalvar(aula, campos);
    setSalvando(false);
    if (!r) return;
    toast('Salvo');
    if (revisao) revisao.onSalvo();
    else onClose();
  }

  return (
    <Sheet
      aberto={!!aula}
      onClose={onClose}
      titulo={revisao ? 'Revisar' : 'Vídeo'}
      subtitulo={revisao ? `${revisao.resta} na fila` : duracaoTexto(aula.duracao)}
      wide
      footer={revisao ? (
        <>
          <Btn variant="ghost" icon={SkipForward} onClick={revisao.onPular} disabled={salvando}>Pular</Btn>
          <Btn variant="primary" icon={Check} onClick={() => salvar(true)} disabled={salvando}>Conferido, próximo</Btn>
        </>
      ) : (
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" icon={Check} onClick={() => salvar()} disabled={salvando}>Salvar</Btn>
        </>
      )}
    >
      <div className="row" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        <Capa id={aula.id} propria={f.capa_url || null} tamanho="mq" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 6 }}>
            <Chip>{aula.tipo === 'aula' ? 'aula longa' : 'short'}</Chip>
            <Chip tone={acesso.tom}>{acesso.chip}</Chip>
            {!f.ativo && <Chip>fora do ar</Chip>}
            {f.destaque && <Chip tone="jade">entrada</Chip>}
          </div>
          <div className="micro muted num" style={{ marginTop: 6 }}>{aula.id}</div>
        </div>
      </div>

      {aula.classificacao_motivo && aula.classificacao !== 'revisada' && (
        <div className="valida atencao" style={{ marginBottom: 12 }}>
          <TriangleAlert size={14} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.6 }}>Por que está em revisão: {aula.classificacao_motivo}.</p>
        </div>
      )}

      {/* ---------- o que o YouTube diz ---------- */}
      {(yt?.status === 'sumiu' || yt?.status === 'sem_embed') && (
        <div className="valida ruim" style={{ marginBottom: 12 }}>
          <TriangleAlert size={14} className="valida-ico" style={{ color: 'var(--blood)' }} />
          <p className="micro muted" style={{ lineHeight: 1.6 }}>
            {yt.status === 'sumiu'
              ? 'O YouTube não devolve mais este vídeo: foi apagado ou ficou privado. Quem abrir no app vê erro. Tire do ar ou cadastre o link novo.'
              : 'O dono deste vídeo proibiu tocar fora do YouTube. No app ele não abre.'}
          </p>
        </div>
      )}
      {yt?.titulo && yt.titulo !== f.titulo && (
        <div className="valida" style={{ marginBottom: 10, border: '1px solid var(--seam)', alignItems: 'center' }}>
          <p className="micro muted" style={{ lineHeight: 1.6, flex: 1 }}>No YouTube o título é “{yt.titulo}”.</p>
          <Btn size="xs" variant="ghost" onClick={() => setF({ ...f, titulo: yt.titulo })}>Usar</Btn>
        </div>
      )}
      {yt?.duracao > 0 && Math.abs(yt.duracao - f.duracao) > 2 && (
        <div className="valida" style={{ marginBottom: 10, border: '1px solid var(--seam)', alignItems: 'center' }}>
          <p className="micro muted" style={{ lineHeight: 1.6, flex: 1 }}>
            No YouTube dura {relogio(yt.duracao)}, aqui está {relogio(f.duracao)}.
          </p>
          <Btn size="xs" variant="ghost" onClick={() => setF({ ...f, duracao: yt.duracao })}>Usar</Btn>
        </div>
      )}

      <Field label="Título">
        <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
      </Field>

      <Field label="Descrição" hint="Uma ou duas frases sobre o que esta aula resolve. Aparece embaixo do vídeo, no player.">
        <Textarea
          value={f.descricao}
          onChange={(e) => setF({ ...f, descricao: e.target.value })}
          rows={3}
          placeholder="O que muda no jogo de quem assistir isto."
        />
      </Field>

      <div className="eyebrow" style={{ marginTop: 6, marginBottom: 8 }}>de quem é este vídeo</div>
      <div className="col" style={{ gap: 8, marginBottom: 12 }}>
        {ACESSOS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={'opcao-meta ' + (f.acesso === a.id ? 'on' : '')}
            onClick={() => setF({ ...f, acesso: a.id })}
          >
            <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
              {a.id === 'todos'
                ? <Unlock size={15} style={{ flex: 'none', marginTop: 2 }} />
                : <Lock size={15} style={{ flex: 'none', marginTop: 2 }} />}
              <div>
                <div className="tiny" style={{ fontWeight: 600 }}>{a.nome}</div>
                <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.6 }}>{a.resumo}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {f.acesso === 'avulso' && (
        <>
          <Field
            label="Link de compra"
            hint="O checkout da Hotmart deste vídeo. Sem ele, quem clicar não tem pra onde ir."
          >
            <Input
              value={f.checkout_url}
              onChange={(e) => setF({ ...f, checkout_url: e.target.value })}
              placeholder="https://pay.hotmart.com/..."
              inputMode="url"
            />
          </Field>

          <Field
            label="Produto na Hotmart"
            hint="O id do produto que vende este vídeo. É por ele que a compra chega neste vídeo e não em outro."
          >
            <Input
              value={f.produto_hotmart}
              onChange={(e) => setF({ ...f, produto_hotmart: e.target.value })}
              placeholder="1234567"
              inputMode="numeric"
            />
          </Field>
        </>
      )}

      {(faltaLink || faltaProduto) && (
        <div className="valida ruim" style={{ marginBottom: 12 }}>
          <TriangleAlert size={14} className="valida-ico" style={{ color: 'var(--blood)' }} />
          <p className="micro muted" style={{ lineHeight: 1.6 }}>
            {faltaLink && faltaProduto
              ? 'Sem o link, quem clicar não tem pra onde ir. Sem o produto, a compra não chega neste vídeo. Dá pra salvar assim, mas este vídeo ainda não vende.'
              : faltaLink
                ? 'Falta o link de compra. Quem clicar não vai ter pra onde ir.'
                : 'Falta o produto da Hotmart. A pessoa consegue comprar, mas a compra não chega neste vídeo e o acesso não libera sozinho.'}
          </p>
        </div>
      )}

      {/* ---------- o que ensina ---------- */}
      <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 6, marginBottom: 6 }}>
        <div className="eyebrow">o que este vídeo ensina</div>
        {estado && <Chip tone={estado.id === 'revisar' ? 'warn' : estado.id === 'revisada' ? 'jade' : ''}>{estado.nome}</Chip>}
      </div>
      {estado && <p className="micro muted" style={{ lineHeight: 1.6, marginBottom: 10 }}>{estado.desc}.</p>}

      {yt?.descricao && (
        <details style={{ marginBottom: 12 }}>
          <summary className="micro muted" style={{ cursor: 'pointer' }}>Descrição no YouTube</summary>
          <p className="micro muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 180, overflow: 'auto', marginTop: 6 }}>
            {yt.descricao}
          </p>
        </details>
      )}

      <div className="field" style={{ marginBottom: 12 }}>
        <span className="label">Posição e lado</span>
        <div className="col" style={{ gap: 0 }}>
          {POSICOES.map((p) => (
            <div key={p.id} className="ens-pos">
              <span className="tiny">{p.nome}</span>
              <div className="row wrap" style={{ gap: 5, justifyContent: 'flex-end' }}>
                {LADOS.map((l) => {
                  const pl = juntar(p.id, l.id);
                  return (
                    <Chip key={l.id} on={f.posicaoLado.includes(pl)} onClick={() => ensina({ posicaoLado: alternar(f.posicaoLado, pl) })}>
                      {l.nome}
                    </Chip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <span className="micro muted">O lado é o de quem assiste: “100kg por baixo” ensina a sair de baixo do 100kg. Aula de conceito geral pode ficar sem posição.</span>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <span className="label">Habilidades</span>
        <div className="row wrap" style={{ gap: 7 }}>
          {HABILIDADES.map((h) => (
            <Chip key={h.id} on={f.habilidades.includes(h.id)} onClick={() => ensina({ habilidades: alternar(f.habilidades, h.id) })}>
              {h.nome}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <span className="label">Situação de quem assiste</span>
        <div className="row wrap" style={{ gap: 7 }}>
          {SITUACOES.map((x) => (
            <Chip key={x.id} on={f.situacoes.includes(x.id)} onClick={() => ensina({ situacoes: alternar(f.situacoes, x.id) })}>
              {x.nome}
            </Chip>
          ))}
        </div>
        <span className="micro muted">Saíram das respostas do formulário dos alunos. Marque quando o vídeo ajuda quem está nessa situação.</span>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <span className="label">Formato</span>
        <EscolhaChips valor={f.formato} onChange={(v) => ensina({ formato: v })} opcoes={FORMATOS} />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <span className="label">Nível</span>
        <EscolhaChips valor={f.nivel} onChange={(v) => ensina({ nivel: v })} opcoes={NIVEIS} />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <span className="label">Técnicas</span>
        {f.tecnicas.length > 0 && (
          <div className="row wrap" style={{ gap: 7, marginBottom: 4 }}>
            {f.tecnicas.map((uid) => (
              <Chip key={uid} on onClick={() => ensina({ tecnicas: f.tecnicas.filter((x) => x !== uid) })}>
                {tecnicaPorUid.get(uid)?.nome || 'fora da biblioteca'} <X size={11} />
              </Chip>
            ))}
          </div>
        )}
        <Input value={buscaTec} onChange={(e) => setBuscaTec(e.target.value)} placeholder="Buscar: armlock, triângulo, fuga de quadril" />
        {sugeridas.length > 0 && (
          <div className="row wrap" style={{ gap: 7, marginTop: 4 }}>
            {sugeridas.map((t) => (
              <Chip key={t.uid} onClick={() => { ensina({ tecnicas: [...f.tecnicas, t.uid] }); setBuscaTec(''); }}>
                <Plus size={11} /> {t.nome}
              </Chip>
            ))}
          </div>
        )}
        {!buscaTec && (
          <span className="micro muted">Sem busca, aparecem as da biblioteca que combinam com a posição e a habilidade marcadas.</span>
        )}
      </div>

      <button
        type="button"
        className={'opcao-meta ' + (f.conferida ? 'on' : '')}
        onClick={() => setF({ ...f, conferida: !f.conferida })}
        style={{ marginBottom: 12 }}
      >
        <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
          <ListChecks size={15} style={{ flex: 'none', marginTop: 2 }} />
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>
              {f.conferida ? 'Classificação conferida' : 'Marcar como conferida'}
            </div>
            <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.6 }}>
              {f.conferida
                ? `No Estudo, aparece em: ${(volta.temas.length ? volta.temas : aula.temas || []).map(nomeTema).join(', ') || 'Geral'}. A IA não mexe mais.`
                : 'Mexer em qualquer campo acima já marca. O que você conferiu a IA não mexe mais.'}
            </p>
          </div>
        </div>
      </button>

      <div className="eyebrow" style={{ marginTop: 6, marginBottom: 8 }}>onde aparece</div>

      <Field label="Etiquetas" hint="Suas, livres, só pra você achar depois. Não mudam o que o app recomenda.">
        <Input
          value={f.tags}
          onChange={(e) => setF({ ...f, tags: e.target.value })}
          placeholder="regravar, campeonato 2026"
        />
      </Field>

      <div className="grid g2" style={{ gap: 12 }}>
        <Field label="Ordem" hint="Menor vem primeiro na lista do tema e nos vídeos de entrada. Vazio deixa o app ordenar.">
          <Input
            type="number"
            inputMode="numeric"
            value={f.ordem}
            onChange={(e) => setF({ ...f, ordem: e.target.value })}
            placeholder="vazio"
          />
        </Field>
        <Field label="Curso" hint="Nenhum curso cadastrado ainda. O campo fica pronto pra quando existir.">
          <Input
            type="number"
            inputMode="numeric"
            value={f.curso_id}
            onChange={(e) => setF({ ...f, curso_id: e.target.value })}
            placeholder="nenhum"
          />
        </Field>
      </div>

      <Field label="Miniatura própria" hint="Vazio usa a do YouTube, que é o normal.">
        <Input
          value={f.capa_url}
          onChange={(e) => setF({ ...f, capa_url: e.target.value })}
          placeholder="https://..."
          inputMode="url"
        />
      </Field>

      <div className="eyebrow" style={{ marginTop: 6, marginBottom: 8 }}>está no ar</div>

      <button
        type="button"
        className={'opcao-meta ' + (f.destaque ? 'on' : '')}
        onClick={() => setF({ ...f, destaque: !f.destaque })}
      >
        <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
          <Sparkles size={15} style={{ flex: 'none', marginTop: 2 }} />
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>
              {f.destaque ? 'Aparece pra quem acabou de chegar' : 'Mostrar pra quem acabou de chegar'}
            </div>
            <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.6 }}>
              Quem cria conta ainda não registrou nada, então o app não tem o que recomendar. Estes vídeos
              aparecem no lugar da tela vazia.
            </p>
          </div>
        </div>
      </button>

      <button
        type="button"
        className={'opcao-meta ' + (!f.ativo ? 'on' : '')}
        onClick={() => setF({ ...f, ativo: !f.ativo })}
        style={{ marginTop: 8 }}
      >
        <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
          <Trash2 size={15} style={{ flex: 'none', marginTop: 2 }} />
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>
              {f.ativo ? 'Tirar do ar' : 'Vai ficar fora do ar'}
            </div>
            <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.6 }}>
              Some do app sem ser apagado. Quem já viu continua com o registro.
            </p>
          </div>
        </div>
      </button>
    </Sheet>
  );
}
