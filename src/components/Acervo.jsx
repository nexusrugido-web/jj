import React, { useState, useEffect, useMemo } from 'react';
import {
  Film, Check, X, TriangleAlert, Plus, Search, Lock, Unlock, Trash2, RefreshCw, Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Card, Btn, Chip, Field, Input, Textarea, Busca, Empty, Stat, Sheet, useToast,
} from './UI';
import Capa from './Capa';
import { lerColado, lerLinha, categorizar } from '../lib/categorizar';
import { duracaoTexto, TEMAS_AULA } from '../db/aulas';

/* ============================================================
   ACERVO, PELO PAINEL

   Cadastrar vídeo deixou de ser deploy e deixou de ser SQL. Você
   cola uma linha por vídeo, no formato que já usa nos seus
   arquivos, e confere antes de gravar.

   O app não inventa categoria. Quando o título não bate com
   nenhuma das que já existem, o vídeo aparece marcado e fica
   esperando você dizer o que ele é.
   ============================================================ */

const nomeTema = (id) => TEMAS_AULA.find((t) => t.id === id)?.nome || id;

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
  const [gravando, setGravando] = useState(false);

  const [editando, setEditando] = useState(null);

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

  /* ------------------------------------------------------------
     A FILA

     Os dois jeitos de cadastrar terminam no mesmo lugar: um campo
     de cada vez, pra quando você está copiando do YouTube com o
     vídeo aberto do lado, e o colar de uma vez, pra quando você
     tem a lista pronta. Nada é gravado até você conferir a fila.
     ------------------------------------------------------------ */
  const idsNoAcervo = useMemo(() => new Set(lista.map((a) => a.id)), [lista]);
  const jaExistem = fila.filter((x) => idsNoAcervo.has(x.id));
  const aRevisar = fila.filter((x) => x.precisaRevisar);

  const umPronto = lerLinha(`${um.t} | ${um.link} | ${um.d}`);

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
    porNaFila([umPronto]);
    setUm({ t: '', link: '', d: '' });
  }

  function adicionarColados() {
    const lidas = lerColado(texto);
    const ruins = lidas.filter((x) => x.erro);
    const n = porNaFila(lidas);
    setTexto('');
    if (!n) { toast('Não consegui ler nenhuma linha', 'err'); return; }
    toast(ruins.length ? `${n} na fila, ${ruins.length} com problema` : `${n} na fila`);
  }

  function fecharCadastro() {
    setColando(false);
    setFila([]);
    setTexto('');
    setUm({ t: '', link: '', d: '' });
  }

  async function gravar() {
    if (!fila.length) return;
    setGravando(true);
    try {
      const linhas = fila.map((v) => ({
        id: v.id,
        titulo: v.t,
        duracao: v.d,
        tipo: v.tipo,
        temas: v.temas.length ? v.temas : ['geral'],
        posicoes: v.posicoes,
        faixa: v.faixa,
        revisar: v.precisaRevisar,
        acesso: 'todos',
      }));

      const { data, error } = await supabase
        .from('aula')
        .upsert(linhas, { onConflict: 'id' })
        .select('id');

      if (error) throw error;
      if (!data?.length) throw new Error('sem permissão');

      toast(`${data.length} ${data.length === 1 ? 'vídeo gravado' : 'vídeos gravados'}`);
      fecharCadastro();
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

  const mostradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((a) => {
      if (filtro === 'revisar' && !a.revisar) return false;
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
    revisar: lista.filter((a) => a.revisar).length,
    pagos: lista.filter((a) => a.acesso !== 'todos').length,
    entrada: lista.filter((a) => a.destaque).length,
  }), [lista]);

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">cadastro sem deploy e sem SQL</div>
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

        {resumo.revisar > 0 && (
          <button className="valida atencao" style={{ width: '100%', textAlign: 'left', marginTop: 12 }}
            onClick={() => setFiltro('revisar')}>
            <p className="micro muted" style={{ lineHeight: 1.65 }}>
              {resumo.revisar} {resumo.revisar === 1 ? 'vídeo não bateu' : 'vídeos não bateram'} com nenhuma
              categoria existente. O app não chutou nem criou categoria nova. Toque aqui pra escolher.
            </p>
          </button>
        )}
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
              : 'Rode o aulas.sql e o aulas-carga.sql no Supabase, ou cole os vídeos aqui no Adicionar.'}
          />
        </Card>
      ) : (
        <div className="col" style={{ gap: 9 }}>
          {mostradas.slice(0, 120).map((a) => (
            <button key={a.id} className="vista-item" onClick={() => setEditando(a)}>
              <Capa id={a.id} tamanho="mq" />
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
                  {a.revisar && <Chip tone="roar">revisar</Chip>}
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
            <Field label="Título">
              <Input
                value={um.t}
                onChange={(e) => setUm({ ...um, t: e.target.value })}
                placeholder="Como raspar na guarda laço"
              />
            </Field>
            <Field label="Link do YouTube">
              <Input
                value={um.link}
                onChange={(e) => setUm({ ...um, link: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
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
                  {umPronto.precisaRevisar && <Chip tone="roar">sem categoria, você escolhe depois</Chip>}
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
              label="Uma linha por vídeo"
              hint="título | link do YouTube | duração"
            >
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={6}
                placeholder={'Como raspar na guarda laço | https://www.youtube.com/watch?v=qMr-tps8s70 | 2:07'}
              />
            </Field>
            <Btn variant="primary" icon={Plus} onClick={adicionarColados} disabled={!texto.trim()}>
              Pôr tudo na fila
            </Btn>
          </div>
        )}

        {/* ---------- a fila ---------- */}
        {fila.length > 0 && (
          <div className="col" style={{ gap: 10, marginTop: 18 }}>
            <div className="row wrap" style={{ gap: 7 }}>
              <div className="eyebrow" style={{ flex: 1 }}>na fila pra gravar</div>
              {jaExistem.length > 0 && <Chip>{jaExistem.length} já no acervo</Chip>}
              {aRevisar.length > 0 && <Chip tone="roar">{aRevisar.length} sem categoria</Chip>}
            </div>

            {jaExistem.length > 0 && (
              <div className="valida atencao">
                <TriangleAlert size={14} className="valida-ico" style={{ color: 'var(--roar)' }} />
                <p className="micro muted" style={{ lineHeight: 1.6 }}>
                  {jaExistem.length} {jaExistem.length === 1 ? 'já está' : 'já estão'} no acervo. Gravar atualiza
                  o título, a duração e as categorias, sem criar linha repetida.
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
                    {x.precisaRevisar && <Chip tone="roar">sem categoria</Chip>}
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
        onClose={() => setEditando(null)}
        onSalvar={salvarUm}
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

     o que é          título, descrição
     de quem é        gratuito, de assinante ou vendido à parte
     onde aparece     categorias, etiquetas, ordem, capa
     está no ar       ativo, e se abre pra quem acabou de chegar

   O link de compra só aparece quando o vídeo é vendido à parte.
   Campo de checkout em vídeo gratuito não tem sentido e só dá
   margem pra cadastrar errado.
   ============================================================ */
function EditarAula({ aula, onClose, onSalvar }) {
  const toast = useToast();
  const [f, setF] = useState(null);
  const [salvando, setSalvando] = useState(false);

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
      temas: (aula.temas || []).join(', '),
      tags: (aula.tags || []).join(', '),
      curso_id: aula.curso_id ?? '',
      revisar: !!aula.revisar,
    } : null);
  }, [aula]);

  if (!aula || !f) return null;

  const listar = (txt) => String(txt).split(',').map((x) => x.trim()).filter(Boolean);
  const acesso = acessoDe(f.acesso);
  const faltaLink = f.acesso === 'avulso' && !f.checkout_url.trim();
  const faltaProduto = f.acesso === 'avulso' && !f.produto_hotmart.trim();
  const sugerido = categorizar(f.titulo);

  async function salvar() {
    setSalvando(true);
    const temas = listar(f.temas);
    const r = await onSalvar(aula, {
      titulo: f.titulo.trim(),
      descricao: f.descricao.trim() || null,
      acesso: f.acesso,
      checkout_url: f.acesso === 'avulso' ? (f.checkout_url.trim() || null) : null,
      produto_hotmart: f.acesso === 'avulso' ? (f.produto_hotmart.trim() || null) : null,
      capa_url: f.capa_url.trim() || null,
      ordem: f.ordem === '' ? null : Number(f.ordem),
      ativo: f.ativo,
      destaque: f.destaque,
      temas: temas.length ? temas : ['geral'],
      tags: listar(f.tags),
      curso_id: f.curso_id === '' ? null : Number(f.curso_id),
      revisar: temas.length ? false : f.revisar,
    });
    setSalvando(false);
    if (r) { toast('Salvo'); onClose(); }
  }

  return (
    <Sheet
      aberto={!!aula}
      onClose={onClose}
      titulo="Vídeo"
      subtitulo={duracaoTexto(aula.duracao)}
      wide
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" icon={Check} onClick={salvar} disabled={salvando}>Salvar</Btn>
        </>
      }
    >
      <div className="row" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        <Capa id={aula.id} tamanho="mq" />
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

      <Field label="Título">
        <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
      </Field>

      <Field label="Descrição" hint="Uma ou duas frases sobre o que esta aula resolve.">
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

      <div className="eyebrow" style={{ marginTop: 6, marginBottom: 8 }}>onde aparece</div>

      <Field
        label="Categorias"
        hint={sugerido.temas.length
          ? 'Pelo título, o app diria: ' + sugerido.temas.join(', ') + '.'
          : 'O título não bate com nenhuma categoria existente. Escolha uma.'}
      >
        <Input
          value={f.temas}
          onChange={(e) => setF({ ...f, temas: e.target.value })}
          placeholder="guarda, raspagem"
        />
      </Field>

      <div className="row wrap" style={{ gap: 7, marginTop: -4, marginBottom: 12 }}>
        {TEMAS_AULA.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            onClick={() => {
              const atuais = listar(f.temas);
              if (atuais.includes(t.id)) return;
              setF({ ...f, temas: [...atuais, t.id].join(', ') });
            }}
          >
            {t.nome}
          </button>
        ))}
      </div>

      <Field label="Etiquetas" hint="Suas, livres, só pra você achar depois. Não mudam o que o app recomenda.">
        <Input
          value={f.tags}
          onChange={(e) => setF({ ...f, tags: e.target.value })}
          placeholder="regravar, campeonato 2026"
        />
      </Field>

      <div className="grid g2" style={{ gap: 12 }}>
        <Field label="Ordem" hint="Menor vem primeiro. Vazio deixa o app ordenar.">
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

