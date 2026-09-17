import React, { useState, useEffect, useMemo } from 'react';
import {
  Film, Check, X, TriangleAlert, Plus, Search, Lock, Unlock, Trash2, RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Card, Btn, Chip, Field, Input, Textarea, Busca, Empty, Stat, Sheet, useToast,
} from './UI';
import Capa from './Capa';
import { lerColado, categorizar } from '../lib/categorizar';
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

export default function Acervo() {
  const toast = useToast();

  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');

  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState('');
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

  /* o que o texto colado vira, antes de gravar qualquer coisa */
  const previa = useMemo(() => (texto.trim() ? lerColado(texto) : []), [texto]);
  const validas = previa.filter((x) => !x.erro);
  const comErro = previa.filter((x) => x.erro);
  const jaExistem = useMemo(() => {
    const ids = new Set(lista.map((a) => a.id));
    return validas.filter((x) => ids.has(x.id));
  }, [validas, lista]);
  const aRevisar = validas.filter((x) => x.precisaRevisar);

  async function gravar() {
    if (!validas.length) return;
    setGravando(true);
    try {
      const linhas = validas.map((v) => ({
        id: v.id,
        titulo: v.t,
        duracao: v.d,
        tipo: v.tipo,
        temas: v.temas.length ? v.temas : ['geral'],
        posicoes: v.posicoes,
        faixa: v.faixa,
        revisar: v.precisaRevisar,
      }));

      const { data, error } = await supabase
        .from('aula')
        .upsert(linhas, { onConflict: 'id' })
        .select('id');

      if (error) throw error;
      if (!data?.length) throw new Error('sem permissão');

      toast(`${data.length} ${data.length === 1 ? 'vídeo gravado' : 'vídeos gravados'}`);
      setTexto('');
      setColando(false);
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
      if (filtro === 'premium' && !a.premium) return false;
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
    premium: lista.filter((a) => a.premium).length,
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
            { id: 'premium', nome: 'Pagos' },
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
                  {a.premium && <Chip tone="roar">pago</Chip>}
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

      {/* ---------- colar vídeos novos ---------- */}
      <Sheet
        aberto={colando}
        onClose={() => setColando(false)}
        titulo="Adicionar vídeos"
        wide
        footer={
          <>
            <Btn variant="ghost" onClick={() => setColando(false)}>Cancelar</Btn>
            <Btn variant="primary" icon={Check} onClick={gravar} disabled={!validas.length || gravando}>
              {gravando ? 'Gravando…' : `Gravar ${validas.length || ''}`}
            </Btn>
          </>
        }
      >
        <Field
          label="Uma linha por vídeo"
          hint="título | link do YouTube | duração. A duração aceita 2:07, 1:04:37 ou o número de segundos."
        >
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={7}
            placeholder={'Como raspar na guarda laço | https://www.youtube.com/watch?v=qMr-tps8s70 | 2:07'}
          />
        </Field>

        {previa.length > 0 && (
          <div className="col" style={{ gap: 10, marginTop: 4 }}>
            <div className="row wrap" style={{ gap: 7 }}>
              <Chip tone="jade">{validas.length} {validas.length === 1 ? 'linha lida' : 'linhas lidas'}</Chip>
              {comErro.length > 0 && <Chip tone="blood">{comErro.length} com problema</Chip>}
              {jaExistem.length > 0 && <Chip>{jaExistem.length} já no acervo</Chip>}
              {aRevisar.length > 0 && <Chip tone="roar">{aRevisar.length} sem categoria</Chip>}
            </div>

            {comErro.map((x) => (
              <div key={x.linha} className="valida ruim">
                <X size={14} className="valida-ico" style={{ color: 'var(--blood)' }} />
                <p className="micro muted" style={{ lineHeight: 1.6 }}>
                  Linha {x.linha}: {x.erro}
                </p>
              </div>
            ))}

            {jaExistem.length > 0 && (
              <div className="valida atencao">
                <TriangleAlert size={14} className="valida-ico" style={{ color: 'var(--roar)' }} />
                <p className="micro muted" style={{ lineHeight: 1.6 }}>
                  {jaExistem.length} {jaExistem.length === 1 ? 'vídeo já está' : 'vídeos já estão'} no acervo.
                  Gravar vai atualizar o título, a duração e as categorias, e não vai criar linha repetida.
                </p>
              </div>
            )}

            {validas.slice(0, 30).map((x) => (
              <div key={x.id} className="row" style={{ gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--void)', borderRadius: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tiny" style={{ fontWeight: 600 }}>{x.t}</div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <span className="micro muted num">{duracaoTexto(x.d)}</span>
                    <Chip>{x.tipo === 'aula' ? 'aula' : 'short'}</Chip>
                    {x.faixa && <Chip>{x.faixa}</Chip>}
                    {x.temas.map((t) => <Chip key={t} tone="jade">{nomeTema(t)}</Chip>)}
                    {x.precisaRevisar && <Chip tone="roar">não bateu com nenhuma</Chip>}
                  </div>
                </div>
              </div>
            ))}
            {validas.length > 30 && (
              <p className="micro muted">e mais {validas.length - 30}.</p>
            )}
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

   É aqui que o vídeo vira pago e ganha o link de compra dele.
   O link fica no banco e não no código porque preço e produto
   mudam por vídeo.
   ============================================================ */
function EditarAula({ aula, onClose, onSalvar }) {
  const toast = useToast();
  const [f, setF] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setF(aula ? {
      titulo: aula.titulo,
      premium: !!aula.premium,
      checkout_url: aula.checkout_url || '',
      ativo: aula.ativo !== false,
      temas: (aula.temas || []).join(', '),
      revisar: !!aula.revisar,
    } : null);
  }, [aula]);

  if (!aula || !f) return null;

  async function salvar() {
    setSalvando(true);
    const temas = f.temas.split(',').map((x) => x.trim()).filter(Boolean);
    const r = await onSalvar(aula, {
      titulo: f.titulo.trim(),
      premium: f.premium,
      checkout_url: f.premium ? (f.checkout_url.trim() || null) : null,
      ativo: f.ativo,
      temas: temas.length ? temas : ['geral'],
      /* escolheu a categoria, então não precisa mais de revisão */
      revisar: temas.length ? false : f.revisar,
    });
    setSalvando(false);
    if (r) { toast('Salvo'); onClose(); }
  }

  const sugerido = categorizar(f.titulo);

  return (
    <Sheet
      aberto={!!aula}
      onClose={onClose}
      titulo="Vídeo"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" icon={Check} onClick={salvar} disabled={salvando}>Salvar</Btn>
        </>
      }
    >
      <div className="row" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 6 }}>
        <Capa id={aula.id} tamanho="mq" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="micro muted num">{duracaoTexto(aula.duracao)}</div>
          <div className="micro muted" style={{ marginTop: 3 }}>{aula.tipo === 'aula' ? 'aula longa' : 'short'}</div>
        </div>
      </div>

      <Field label="Título">
        <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
      </Field>

      <Field
        label="Categorias"
        hint={sugerido.temas.length
          ? `Pelo título, o app diria: ${sugerido.temas.join(', ')}.`
          : 'O título não bate com nenhuma categoria existente. Escolha uma.'}
      >
        <Input
          value={f.temas}
          onChange={(e) => setF({ ...f, temas: e.target.value })}
          placeholder="guarda, raspagem"
        />
      </Field>

      <div className="row wrap" style={{ gap: 7, marginTop: -4, marginBottom: 10 }}>
        {TEMAS_AULA.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            onClick={() => {
              const atuais = f.temas.split(',').map((x) => x.trim()).filter(Boolean);
              if (atuais.includes(t.id)) return;
              setF({ ...f, temas: [...atuais, t.id].join(', ') });
            }}
          >
            {t.nome}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`opcao-meta ${f.premium ? 'on' : ''}`}
        onClick={() => setF({ ...f, premium: !f.premium })}
      >
        <div className="row" style={{ gap: 9 }}>
          {f.premium ? <Lock size={15} style={{ flex: 'none' }} /> : <Unlock size={15} style={{ flex: 'none' }} />}
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>
              {f.premium ? 'Este vídeo é pago' : 'Este vídeo está liberado'}
            </div>
            <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.6 }}>
              {f.premium
                ? 'Quem assina vê o link de compra avulsa. Quem está no grátis vê o link da assinatura.'
                : 'Entra nos limites normais do plano, sem cobrança à parte.'}
            </p>
          </div>
        </div>
      </button>

      {f.premium && (
        <Field label="Link de compra avulsa" hint="O checkout da Hotmart deste vídeo. Deixe vazio se ainda não criou.">
          <Input
            value={f.checkout_url}
            onChange={(e) => setF({ ...f, checkout_url: e.target.value })}
            placeholder="https://pay.hotmart.com/..."
          />
        </Field>
      )}

      <button
        type="button"
        className={`opcao-meta ${!f.ativo ? 'on' : ''}`}
        onClick={() => setF({ ...f, ativo: !f.ativo })}
        style={{ marginTop: 10 }}
      >
        <div className="row" style={{ gap: 9 }}>
          <Trash2 size={15} style={{ flex: 'none' }} />
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
