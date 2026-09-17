import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, Check, Plus, Trash2, ExternalLink, Lock, TriangleAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, Btn, Chip, Field, Input, Sheet, Empty, Confirmar, useToast } from './UI';
import { carregarLinks } from '../lib/links';

/* ============================================================
   OS LINKS

   O app manda a pessoa pra fora em poucos momentos, e cada um
   precisa do endereço certo. Antes o da assinatura ficava num
   ajuste de texto e outros dois estavam escritos no meio do
   código, sendo que o botão do plano anual apontava pro mesmo
   lugar do mensal.

   Os que o app chama pelo nome vêm marcados e não somem. Os
   outros você cria e apaga como quiser.
   ============================================================ */

const GRUPOS = {
  venda: 'Venda',
  ajuda: 'Ajuda',
  geral: 'Outros',
};

const vazio = () => ({ chave: '', nome: '', descricao: '', url: '', grupo: 'geral' });

export default function Links() {
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [rascunho, setRascunho] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [novo, setNovo] = useState(null);
  const [apagar, setApagar] = useState(null);
  const [salvando, setSalvando] = useState(null);

  async function buscar() {
    if (!supabase) return;
    setCarregando(true);
    try {
      const { data, error } = await supabase.from('link').select('*').order('ordem').order('nome');
      if (error) throw error;
      setLista(data || []);
      setRascunho(Object.fromEntries((data || []).map((l) => [l.chave, l.url || ''])));
      setErro(false);
    } catch (e) {
      console.error('[links]', e);
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { buscar(); }, []);

  async function salvarUrl(l) {
    setSalvando(l.chave);
    try {
      const url = (rascunho[l.chave] || '').trim() || null;
      const { data, error } = await supabase
        .from('link').update({ url }).eq('chave', l.chave).select('chave, url');
      if (error) throw error;
      if (!data?.length) throw new Error('sem permissão');
      setLista((x) => x.map((y) => (y.chave === l.chave ? { ...y, url } : y)));
      await carregarLinks();
      toast(`${l.nome} salvo`);
    } catch (e) {
      toast(String(e?.message).includes('permissão')
        ? 'Esta conta não tem permissão de administrador'
        : 'Não consegui salvar', 'err');
    } finally {
      setSalvando(null);
    }
  }

  async function criar() {
    const chave = novo.chave.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!chave || !novo.nome.trim()) { toast('Precisa de um nome e de uma chave', 'err'); return; }

    setSalvando('novo');
    try {
      const { data, error } = await supabase.from('link').insert({
        chave,
        nome: novo.nome.trim(),
        descricao: novo.descricao.trim() || null,
        url: novo.url.trim() || null,
        grupo: novo.grupo,
        ordem: 50,
      }).select('*');
      if (error) throw error;
      if (!data?.length) throw new Error('sem permissão');
      toast('Link criado');
      setNovo(null);
      await buscar();
      await carregarLinks();
    } catch (e) {
      toast(String(e?.message).includes('duplicate')
        ? 'Já existe um link com essa chave'
        : String(e?.message).includes('permissão')
          ? 'Esta conta não tem permissão de administrador'
          : 'Não consegui criar', 'err');
    } finally {
      setSalvando(null);
    }
  }

  async function remover(l) {
    try {
      const { error } = await supabase.from('link').delete().eq('chave', l.chave);
      if (error) throw error;
      setApagar(null);
      toast(`${l.nome} apagado`);
      await buscar();
      await carregarLinks();
    } catch {
      toast('Não consegui apagar', 'err');
    }
  }

  if (erro) {
    return (
      <Card>
        <Empty
          icon={LinkIcon}
          titulo="A tabela de links ainda não existe"
          texto="Rode o links.sql no SQL Editor do Supabase e volte aqui."
          acao={<Btn variant="primary" onClick={buscar}>Tentar de novo</Btn>}
        />
      </Card>
    );
  }

  const porGrupo = Object.keys(GRUPOS)
    .map((g) => ({ g, itens: lista.filter((l) => l.grupo === g) }))
    .filter((x) => x.itens.length);

  const semUrl = lista.filter((l) => l.fixo && !l.url).length;

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">para onde o app manda a pessoa</div>
            <h2 className="h-sec row" style={{ gap: 8 }}><LinkIcon size={16} /> Links</h2>
          </div>
          <Btn size="sm" variant="primary" icon={Plus} onClick={() => setNovo(vazio())}>Adicionar</Btn>
        </div>

        {semUrl > 0 && (
          <div className="valida atencao">
            <TriangleAlert size={14} className="valida-ico" style={{ color: 'var(--roar)' }} />
            <p className="micro muted" style={{ lineHeight: 1.65 }}>
              {semUrl === 1 ? 'Um link que o app usa está' : `${semUrl} links que o app usa estão`} sem
              endereço. Enquanto estiver assim, o botão que leva até ele fica desligado em vez de abrir uma
              página vazia.
            </p>
          </div>
        )}
      </Card>

      {carregando ? (
        <Card><p className="tiny muted">Buscando os links.</p></Card>
      ) : porGrupo.map(({ g, itens }) => (
        <Card key={g} style={{ marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{GRUPOS[g]}</div>

          <div className="col" style={{ gap: 14 }}>
            {itens.map((l) => {
              const mudou = (rascunho[l.chave] || '') !== (l.url || '');
              return (
                <div key={l.chave} style={{ paddingTop: 12, borderTop: '1px solid var(--seam)' }}>
                  <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
                    <span className="tiny" style={{ fontWeight: 600 }}>{l.nome}</span>
                    {l.fixo && <Chip><Lock size={10} /> o app usa</Chip>}
                    {!l.url && <Chip tone="roar">sem endereço</Chip>}
                    <span className="spacer" />
                    {l.url && (
                      <button
                        className="btn ghost xs"
                        onClick={() => window.open(l.url, '_blank', 'noopener')}
                      >
                        <ExternalLink size={12} /> Abrir
                      </button>
                    )}
                    {!l.fixo && (
                      <button className="btn ghost xs" onClick={() => setApagar(l)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {l.descricao && (
                    <p className="micro muted" style={{ marginBottom: 7, lineHeight: 1.6 }}>{l.descricao}</p>
                  )}

                  <div className="row" style={{ gap: 8 }}>
                    <Input
                      value={rascunho[l.chave] ?? ''}
                      onChange={(e) => setRascunho({ ...rascunho, [l.chave]: e.target.value })}
                      placeholder="https://pay.hotmart.com/..."
                      inputMode="url"
                    />
                    <Btn
                      size="sm"
                      variant={mudou ? 'primary' : 'ghost'}
                      icon={Check}
                      disabled={!mudou || salvando === l.chave}
                      onClick={() => salvarUrl(l)}
                    >
                      Salvar
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* ---------- criar um link novo ---------- */}
      <Sheet
        aberto={!!novo}
        onClose={() => setNovo(null)}
        titulo="Novo link"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setNovo(null)}>Cancelar</Btn>
            <Btn variant="primary" icon={Check} onClick={criar} disabled={salvando === 'novo'}>Criar</Btn>
          </>
        }
      >
        {novo && (
          <>
            <Field label="Nome" hint="Como ele aparece aqui pra você.">
              <Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                placeholder="Turma presencial" />
            </Field>
            <Field label="Chave" hint="Sem espaço nem acento. É por ela que o app acha o link, se um dia usar.">
              <Input value={novo.chave} onChange={(e) => setNovo({ ...novo, chave: e.target.value })}
                placeholder="turma_presencial" />
            </Field>
            <Field label="Para que serve">
              <Input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
                placeholder="Quando e onde este link aparece" />
            </Field>
            <Field label="Endereço">
              <Input value={novo.url} onChange={(e) => setNovo({ ...novo, url: e.target.value })}
                placeholder="https://..." inputMode="url" />
            </Field>
            <div className="row wrap" style={{ gap: 7 }}>
              {Object.entries(GRUPOS).map(([g, nome]) => (
                <button key={g} type="button"
                  className={`chip ${novo.grupo === g ? 'on' : ''}`}
                  onClick={() => setNovo({ ...novo, grupo: g })}>
                  {nome}
                </button>
              ))}
            </div>
          </>
        )}
      </Sheet>

      <Confirmar
        aberto={!!apagar}
        onClose={() => setApagar(null)}
        onConfirmar={() => remover(apagar)}
        titulo="Apagar este link"
        texto={apagar ? `${apagar.nome} some do painel. Nenhuma tela do app depende dele.` : ''}
      />
    </>
  );
}
