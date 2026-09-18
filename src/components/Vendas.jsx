import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, ShoppingBag, Repeat, Undo2, MousePointerClick, Link as LinkIcon, Copy, Plus, Check,
  TriangleAlert, Download, Package, TrendingUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, Btn, Chip, Stat, Empty, Field, Input, Select, Seg, Switch, Sheet, useToast } from './UI';
import { Evolucao } from './Charts';
import { baixarPlanilha } from '../lib/planilha';

/* ============================================================
   VENDAS

   De onde vem cada venda, e quanto cada canal trouxe. A venda
   chega da Hotmart com o sck e o src do link que a pessoa usou,
   e é por isso que todo link divulgado precisa sair daqui.

   Produtos: a Hotmart manda aviso de todos os produtos da conta.
   Só gera acesso ao app o que estiver marcado como NeuroJitsu.
   ============================================================ */

const CANAIS = [
  ['instagram_bio', 'Instagram · bio'],
  ['instagram_reels', 'Instagram · Reels'],
  ['instagram_stories', 'Instagram · Stories'],
  ['instagram_direct', 'Instagram · Direct'],
  ['youtube_video', 'YouTube · vídeo'],
  ['youtube_shorts', 'YouTube · Shorts'],
  ['tiktok_video', 'TikTok'],
  ['whatsapp_grupo', 'WhatsApp · grupo'],
  ['whatsapp_status', 'WhatsApp · status'],
  ['email_lista', 'E-mail'],
  ['parceiro_indicacao', 'Parceiro ou indicação'],
  ['anuncio_meta', 'Anúncio pago'],
  ['outro_link', 'Outro'],
];

const nomeCanal = (c) => CANAIS.find(([id]) => id === c)?.[1]
  || ({ app: 'Dentro do app', recuperacao: 'Recuperação', 'sem origem': 'Sem origem' })[c]
  || c;

const EVENTOS = {
  'PURCHASE_APPROVED': { nome: 'venda', tom: 'jade' },
  'PURCHASE_COMPLETE': { nome: 'garantia passou', tom: 'jade' },
  'PURCHASE_BILLET_PRINTED': { nome: 'Pix ou boleto gerado', tom: 'warn' },
  'PURCHASE_OUT_OF_SHOPPING_CART': { nome: 'abandono', tom: 'warn' },
  'PURCHASE_EXPIRED': { nome: 'venceu', tom: '' },
  'PURCHASE_CANCELED': { nome: 'não passou', tom: '' },
  'PURCHASE_DELAYED': { nome: 'atrasou', tom: 'warn' },
  'PURCHASE_REFUNDED': { nome: 'reembolso', tom: 'blood' },
  'PURCHASE_CHARGEBACK': { nome: 'chargeback', tom: 'blood' },
  'PURCHASE_PROTEST': { nome: 'contestação', tom: 'blood' },
  'SUBSCRIPTION_CANCELLATION': { nome: 'cancelou', tom: 'blood' },
  'SWITCH_PLAN': { nome: 'trocou de plano', tom: '' },
};

const reais = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const quando = (iso) => new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

const paraCodigo = (s) => (s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

function copiar(texto, toast, oque = 'Link copiado') {
  navigator.clipboard?.writeText(texto)
    .then(() => toast(oque))
    .catch(() => toast('Copie na mão, o navegador não deixou', 'err'));
}

export default function Vendas() {
  const [aba, setAba] = useState('resultado');
  const [dias, setDias] = useState(30);
  const [n, setN] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [ajuste, setAjuste] = useState(null);
  const [aulas, setAulas] = useState([]);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function buscar() {
    if (!supabase) return;
    setCarregando(true);
    try {
      const [a, p, c, e, j, v] = await Promise.all([
        supabase.rpc('vendas_numeros', { p_dias: dias }),
        supabase.from('produto_hotmart').select('*').order('ultimo_em', { ascending: false }),
        supabase.from('campanha').select('*').order('criado_em', { ascending: false }),
        supabase.from('hotmart_evento')
          .select('id, evento, criado_em, transacao, email, nome, telefone, produto, produto_nome, valor, pagamento, parcelas, src, sck, cupom, processado')
          .order('criado_em', { ascending: false }).limit(500),
        supabase.from('vendas_ajuste').select('*').eq('id', 1).single(),
        supabase.from('aula').select('id, titulo, checkout_url').not('checkout_url', 'is', null).order('titulo'),
      ]);
      const falha = [a, p, c, e, j].find((x) => x.error);
      if (falha) throw falha.error;
      setN(a.data);
      setProdutos(p.data || []);
      setCampanhas(c.data || []);
      setEventos(e.data || []);
      setAjuste(j.data);
      setAulas(v.data || []);
      setErro(false);
    } catch (x) {
      console.error('[vendas]', x);
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { buscar(); }, [dias]);

  if (erro) {
    return (
      <Card>
        <Empty
          icon={TrendingUp}
          titulo="O registro de vendas ainda não existe no banco"
          texto="Rode o SQL mais novo no SQL Editor do Supabase e volte aqui."
          acao={<Btn variant="primary" onClick={buscar}>Tentar de novo</Btn>}
        />
      </Card>
    );
  }

  if (carregando && !n) return <Card><p className="tiny muted">Buscando as vendas.</p></Card>;

  const semClassificar = produtos.filter((p) => !p.tipo).length;

  return (
    <>
      {semClassificar > 0 && aba !== 'produtos' && (
        <div className="valida atencao" style={{ marginBottom: 14, alignItems: 'center' }}>
          <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.65, flex: 1 }}>
            {semClassificar === 1 ? 'Um produto da Hotmart está' : `${semClassificar} produtos da Hotmart estão`} esperando
            você dizer se é do NeuroJitsu. Enquanto isso, as vendas dele ficam guardadas e ninguém ganha acesso.
          </p>
          <Btn size="sm" variant="primary" onClick={() => setAba('produtos')}>Resolver</Btn>
        </div>
      )}

      <div className="row wrap" style={{ gap: 10, marginBottom: 14 }}>
        <Seg
          value={aba}
          onChange={setAba}
          options={[
            { id: 'resultado', nome: 'Resultado' },
            { id: 'links', nome: 'Links rastreados' },
            { id: 'vendas', nome: 'Vendas' },
            { id: 'produtos', nome: 'Produtos' },
          ]}
        />
        <span className="spacer" />
        {aba === 'resultado' && (
          <Seg
            value={dias}
            onChange={setDias}
            options={[{ id: 7, nome: '7 dias' }, { id: 30, nome: '30 dias' }, { id: 90, nome: '90 dias' }, { id: 365, nome: '1 ano' }]}
          />
        )}
      </div>

      {aba === 'resultado' && <Resultado n={n} dias={dias} />}
      {aba === 'links' && (
        <Links
          campanhas={campanhas} setCampanhas={setCampanhas} n={n} ajuste={ajuste} setAjuste={setAjuste}
          aulas={aulas} recarregar={buscar}
        />
      )}
      {aba === 'vendas' && <Lista eventos={eventos} produtos={produtos} />}
      {aba === 'produtos' && <Produtos produtos={produtos} recarregar={buscar} />}
    </>
  );
}

/* ------------------------------------------------------------
   O RESULTADO
   ------------------------------------------------------------ */
function Resultado({ n, dias }) {
  const liquido = Number(n.receita) - Number(n.reembolsado);
  const ticket = n.vendas ? Number(n.receita) / n.vendas : 0;

  const serie = useMemo(() => {
    const pd = n.por_dia || [];
    const passo = Math.max(1, Math.ceil(pd.length / 10));
    return pd.map((d, i) => ({
      receita: Number(d.receita),
      label: i % passo === 0 || i === pd.length - 1 ? `${d.dia.slice(8)}/${d.dia.slice(5, 7)}` : '',
    }));
  }, [n]);

  const maxCanal = Math.max(1, ...(n.por_canal || []).map((c) => Number(c.receita)));

  return (
    <>
      <div className="rec-kpis">
        <Card className="rec-kpi destaque">
          <Stat icon={Wallet} valor={reais(liquido)} label="entrou, já sem reembolso" tone="jade"
            sub={n.reembolsado > 0 ? `${reais(n.receita)} bruto` : undefined} />
        </Card>
        <Card className="rec-kpi">
          <Stat icon={ShoppingBag} valor={n.vendas} label="vendas" sub={n.vendas ? `ticket médio ${reais(ticket)}` : undefined} tone="accent" />
        </Card>
        <Card className="rec-kpi">
          <Stat icon={Repeat} valor={reais(n.mrr)} label="receita recorrente por mês" sub={`${n.assinantes} assinantes ativos`} />
        </Card>
        <Card className="rec-kpi">
          <Stat
            icon={Undo2}
            valor={n.reembolsos}
            label="reembolsos e chargebacks"
            sub={n.cancelamentos ? `${n.cancelamentos} cancelaram a assinatura` : undefined}
            tone={n.reembolsos ? 'blood' : undefined}
          />
        </Card>
      </div>

      <div className="rec-duas">
        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">últimos {dias} dias</div>
              <h2 className="h-sec">Receita por dia</h2>
            </div>
          </div>
          {n.vendas ? (
            <Evolucao serie={serie} chaves={[{ k: 'receita', cor: 'var(--jade)', nome: 'Receita' }]} />
          ) : (
            <p className="tiny muted center" style={{ padding: '30px 0' }}>Nenhuma venda neste período.</p>
          )}
        </Card>

        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">de onde veio o dinheiro</div>
              <h2 className="h-sec">Por canal</h2>
            </div>
          </div>
          {(n.por_canal || []).length === 0 ? (
            <p className="tiny muted center" style={{ padding: '30px 0' }}>Nenhuma venda neste período.</p>
          ) : (
            <div className="col" style={{ gap: 12 }}>
              {n.por_canal.map((c) => (
                <div key={c.canal}>
                  <div className="row tiny" style={{ marginBottom: 5 }}>
                    <span className="truncate" style={{ flex: 1 }}>{nomeCanal(c.canal)}</span>
                    <span className="micro muted">{c.vendas} {c.vendas === 1 ? 'venda' : 'vendas'}</span>
                    <span className="num micro" style={{ color: 'var(--jade)', minWidth: 86, textAlign: 'right' }}>{reais(c.receita)}</span>
                  </div>
                  <div className="bar thin jade"><i style={{ width: `${(Number(c.receita) / maxCanal) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">do clique à venda</div>
            <h2 className="h-sec">Por campanha</h2>
          </div>
          <Chip><MousePointerClick size={11} /> {n.cliques} cliques</Chip>
        </div>
        {(n.por_campanha || []).length === 0 ? (
          <p className="tiny muted" style={{ lineHeight: 1.7 }}>
            Ainda não tem clique nem venda por link rastreado neste período. Crie um link na aba Links rastreados e
            use ele na bio, no Reels ou na descrição do vídeo.
          </p>
        ) : (
          <div className="vd-tabela">
            <div className="vd-linha vd-topo">
              <span>Campanha</span><span>Cliques</span><span>Vendas</span><span>Conversão</span><span>Receita</span>
            </div>
            {n.por_campanha.map((c) => (
              <div key={c.codigo} className="vd-linha">
                <span className="truncate">
                  <b style={{ fontWeight: 600 }}>{c.canal ? c.nome : nomeCanal(c.codigo)}</b>
                  <span className="micro muted"> · {nomeCanal(c.canal || c.codigo)}</span>
                </span>
                <span className="num">{c.cliques}</span>
                <span className="num">{c.vendas}</span>
                <span className="num">{c.cliques ? `${((c.vendas / c.cliques) * 100).toFixed(1).replace('.', ',')}%` : '-'}</span>
                <span className="num" style={{ color: 'var(--jade)' }}>{reais(c.receita)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------
   OS LINKS RASTREADOS
   ------------------------------------------------------------ */
const vazio = () => ({ nome: '', codigo: '', canal: 'instagram_reels', destino: 'assinatura', url: '', cupom: '' });

function Links({ campanhas, setCampanhas, n, ajuste, setAjuste, aulas, recarregar }) {
  const toast = useToast();
  const [novo, setNovo] = useState(null);
  const [codigoMexido, setCodigoMexido] = useState(false);
  const [base, setBase] = useState(ajuste?.link_base || '');
  const [completo, setCompleto] = useState({});
  const [salvando, setSalvando] = useState(false);

  const baseLimpa = (ajuste?.link_base || '').replace(/\/+$/, '');
  const curto = (c) => `${baseLimpa}/r/${c.codigo}`;
  const numeros = Object.fromEntries((n?.por_campanha || []).map((c) => [c.codigo, c]));

  async function verCompleto(c) {
    const { data } = await supabase.rpc('link_destino', { p_codigo: c.codigo, p_contar: false });
    if (!data) { toast('O destino deste link ainda não tem endereço. Confira a aba Links.', 'err'); return; }
    setCompleto({ ...completo, [c.codigo]: data });
  }

  async function salvarBase() {
    const url = base.trim().replace(/\/+$/, '');
    if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(url)) { toast('Use um endereço que comece com https://', 'err'); return; }
    const { data, error } = await supabase.from('vendas_ajuste').update({ link_base: url }).eq('id', 1).select('*');
    if (error || !data?.length) { toast('Não consegui salvar', 'err'); return; }
    setAjuste(data[0]);
    toast('Os links curtos passam a usar este endereço');
  }

  async function criar() {
    const codigo = paraCodigo(novo.codigo || novo.nome);
    if (!novo.nome.trim() || codigo.length < 2) { toast('Dê um nome pro link', 'err'); return; }
    if (novo.destino === 'url' && !/^https:\/\//.test(novo.url.trim())) { toast('O endereço precisa começar com https://', 'err'); return; }
    setSalvando(true);
    const { data, error } = await supabase.from('campanha').insert({
      codigo,
      nome: novo.nome.trim(),
      canal: novo.canal,
      destino: novo.destino,
      url: novo.destino === 'url' ? novo.url.trim() : null,
      cupom: novo.cupom.trim() || null,
    }).select('*');
    setSalvando(false);
    if (error) {
      toast(String(error.message).includes('duplicate') ? 'Já existe um link com esse código' : 'Não consegui criar', 'err');
      return;
    }
    setCampanhas([data[0], ...campanhas]);
    setNovo(null);
    copiar(`${baseLimpa}/r/${codigo}`, toast, 'Link criado e copiado');
  }

  async function virar(c, ativo) {
    const { data, error } = await supabase.from('campanha').update({ ativo }).eq('codigo', c.codigo).select('*');
    if (error || !data?.length) { toast('Não consegui salvar', 'err'); return; }
    setCampanhas(campanhas.map((x) => (x.codigo === c.codigo ? data[0] : x)));
    toast(ativo ? 'Link ligado' : 'Link desligado. Quem clicar cai no app.');
  }

  const destinoNome = (c) => (c.destino === 'assinatura' ? 'Assinatura mensal'
    : c.destino === 'anual' ? 'Assinatura anual'
      : c.destino === 'url' ? 'Endereço próprio'
        : `Vídeo: ${aulas.find((a) => a.id === c.destino)?.titulo || c.destino}`);

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">um link por lugar onde você divulga</div>
            <h2 className="h-sec row" style={{ gap: 8 }}><LinkIcon size={16} /> Links rastreados</h2>
          </div>
          <Btn variant="primary" size="sm" icon={Plus} onClick={() => { setNovo(vazio()); setCodigoMexido(false); }}>Criar link</Btn>
        </div>
        <p className="micro muted" style={{ lineHeight: 1.7 }}>
          Cada link leva a pessoa pro checkout com a origem marcada. Quando ela compra, a venda aparece aqui com o
          canal e a campanha certos. Use um link diferente na bio, em cada Reels, em cada vídeo do YouTube: é assim
          que dá pra saber qual conteúdo vende.
        </p>
      </Card>

      {campanhas.length === 0 ? (
        <Card>
          <Empty icon={LinkIcon} titulo="Nenhum link ainda" texto="Crie o primeiro pra bio do Instagram." />
        </Card>
      ) : (
        <Card style={{ marginBottom: 14 }}>
          <div className="col">
            {campanhas.map((c) => {
              const x = numeros[c.codigo];
              return (
                <div key={c.codigo} className="rec-linha" style={{ alignItems: 'flex-start', opacity: c.ativo ? 1 : 0.6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 7 }}>
                      <span className="tiny" style={{ fontWeight: 600 }}>{c.nome}</span>
                      <Chip>{nomeCanal(c.canal)}</Chip>
                      {c.cupom && <Chip tone="warn">cupom {c.cupom}</Chip>}
                      {!c.ativo && <Chip>desligado</Chip>}
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 8 }}>
                      <code className="vd-link truncate">{curto(c)}</code>
                      <Btn size="xs" icon={Copy} onClick={() => copiar(curto(c), toast)}>Copiar</Btn>
                    </div>
                    <div className="micro muted" style={{ marginTop: 6 }}>
                      {destinoNome(c)}
                      {x ? ` · ${x.cliques} cliques · ${x.vendas} vendas · ${reais(x.receita)}` : ' · sem clique neste período'}
                    </div>
                    {completo[c.codigo] ? (
                      <div className="row" style={{ gap: 6, marginTop: 6 }}>
                        <code className="vd-link truncate" style={{ opacity: 0.8 }}>{completo[c.codigo]}</code>
                        <Btn size="xs" variant="ghost" icon={Copy} onClick={() => copiar(completo[c.codigo], toast)}>Copiar</Btn>
                      </div>
                    ) : (
                      <button type="button" className="btn ghost xs" style={{ marginTop: 4, paddingLeft: 0 }} onClick={() => verCompleto(c)}>
                        ver o link completo da Hotmart
                      </button>
                    )}
                  </div>
                  <Switch on={c.ativo} onChange={(v) => virar(c, v)} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">o começo de todo link curto</div>
            <h2 className="h-sec">Endereço dos links</h2>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://neurojitsu.com.br" inputMode="url" />
          <Btn size="sm" variant={base.replace(/\/+$/, '') !== baseLimpa ? 'primary' : 'ghost'} icon={Check}
            disabled={base.replace(/\/+$/, '') === baseLimpa} onClick={salvarBase}>Salvar</Btn>
        </div>
        <p className="micro muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
          Quando o domínio próprio estiver apontando pra Vercel, troque aqui. Os links que você já divulgou com o
          endereço antigo continuam funcionando.
        </p>
      </Card>

      <Sheet
        aberto={!!novo}
        onClose={() => setNovo(null)}
        titulo="Novo link rastreado"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setNovo(null)}>Cancelar</Btn>
            <Btn variant="primary" icon={Check} onClick={criar} disabled={salvando}>Criar e copiar</Btn>
          </>
        }
      >
        {novo && (
          <>
            <Field label="Nome" hint="Pra você reconhecer depois. Ex.: Reels da guarda fechada">
              <Input
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value, codigo: codigoMexido ? novo.codigo : paraCodigo(e.target.value) })}
                placeholder="Reels da guarda fechada"
              />
            </Field>
            <Field label="Código" hint="Vai no fim do link e volta com a venda. Só letra, número e hífen.">
              <Input
                value={novo.codigo}
                onChange={(e) => { setCodigoMexido(true); setNovo({ ...novo, codigo: paraCodigo(e.target.value) }); }}
                placeholder="reels-guarda-fechada"
              />
            </Field>
            <Field label="Onde vai ser divulgado">
              <Select value={novo.canal} onChange={(e) => setNovo({ ...novo, canal: e.target.value })}>
                {CANAIS.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </Select>
            </Field>
            <Field label="Pra onde leva">
              <Select value={novo.destino} onChange={(e) => setNovo({ ...novo, destino: e.target.value })}>
                <option value="assinatura">Assinatura mensal</option>
                <option value="anual">Assinatura anual</option>
                {aulas.map((a) => <option key={a.id} value={a.id}>Vídeo avulso: {a.titulo}</option>)}
                <option value="url">Outro endereço da Hotmart</option>
              </Select>
            </Field>
            {novo.destino === 'url' && (
              <Field label="Endereço">
                <Input value={novo.url} onChange={(e) => setNovo({ ...novo, url: e.target.value })} placeholder="https://pay.hotmart.com/..." inputMode="url" />
              </Field>
            )}
            <Field label="Cupom (opcional)" hint="Crie o cupom na Hotmart antes. Ele entra aplicado sozinho no checkout.">
              <Input value={novo.cupom} onChange={(e) => setNovo({ ...novo, cupom: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="REELS10" />
            </Field>
            {novo.nome && (
              <p className="micro muted" style={{ lineHeight: 1.6 }}>
                Vai ficar: <code className="vd-link">{baseLimpa}/r/{paraCodigo(novo.codigo || novo.nome)}</code>
              </p>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------
   A LISTA DE VENDAS
   ------------------------------------------------------------ */
function Lista({ eventos, produtos }) {
  const [filtro, setFiltro] = useState('vendas');
  const tipo = Object.fromEntries(produtos.map((p) => [p.id, p.tipo]));

  const mostrados = eventos.filter((e) => {
    if (filtro === 'todos') return true;
    if (tipo[e.produto] !== 'neurojitsu') return false;
    if (filtro === 'vendas') return e.evento === 'PURCHASE_APPROVED';
    return ['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'SUBSCRIPTION_CANCELLATION', 'PURCHASE_PROTEST'].includes(e.evento);
  });

  function baixar() {
    baixarPlanilha(`neurojitsu-${filtro}`, [
      [(e) => quando(e.criado_em), 'Quando'],
      [(e) => EVENTOS[e.evento]?.nome || e.evento, 'O que foi'],
      ['nome', 'Nome'], ['email', 'E-mail'], ['telefone', 'Telefone'],
      ['produto_nome', 'Produto'], ['valor', 'Valor'], ['pagamento', 'Pagamento'], ['parcelas', 'Parcelas'],
      ['src', 'Canal (src)'], ['sck', 'Campanha (sck)'], ['cupom', 'Cupom'],
      ['transacao', 'Transação'], ['processado', 'O que o app fez'],
    ], mostrados);
  }

  return (
    <Card>
      <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
        <Seg
          value={filtro}
          onChange={setFiltro}
          options={[
            { id: 'vendas', nome: 'Vendas' },
            { id: 'perdas', nome: 'Reembolsos e cancelamentos' },
            { id: 'todos', nome: 'Tudo que chegou' },
          ]}
        />
        <span className="spacer" />
        <Btn size="sm" icon={Download} onClick={baixar} disabled={!mostrados.length}>Baixar planilha</Btn>
      </div>

      {mostrados.length === 0 ? (
        <Empty icon={ShoppingBag} titulo="Nada por aqui ainda" texto="Assim que a Hotmart avisar, aparece aqui." />
      ) : (
        <div className="col">
          {mostrados.map((e) => {
            const ev = EVENTOS[e.evento] || { nome: e.evento, tom: '' };
            const origem = [e.src, e.sck].filter(Boolean).join(' / ');
            return (
              <div key={e.id} className="rec-linha" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row wrap" style={{ gap: 7 }}>
                    <span className="tiny truncate" style={{ fontWeight: 600, maxWidth: 240 }}>{e.nome || e.email || 'sem nome'}</span>
                    <Chip tone={`${ev.tom} dot`}>{ev.nome}</Chip>
                    {tipo[e.produto] !== 'neurojitsu' && <Chip>{tipo[e.produto] === 'fora' ? 'outro produto' : 'produto sem classificar'}</Chip>}
                  </div>
                  <div className="micro muted truncate" style={{ marginTop: 4 }}>
                    {quando(e.criado_em)} · {e.produto_nome || 'produto ?'}{e.email && e.nome ? ` · ${e.email}` : ''}
                  </div>
                  <div className="micro muted" style={{ marginTop: 3 }}>
                    {origem ? `origem: ${origem}` : 'sem origem'}
                    {e.cupom && ` · cupom ${e.cupom}`}
                    {e.pagamento && ` · ${e.pagamento.toLowerCase().replace('_', ' ')}`}
                  </div>
                </div>
                {e.valor != null && <span className="num tiny" style={{ color: ev.tom === 'blood' ? 'var(--blood)' : 'var(--chalk)' }}>{reais(e.valor)}</span>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------
   OS PRODUTOS
   ------------------------------------------------------------ */
function Produtos({ produtos, recarregar }) {
  const toast = useToast();
  const [mexendo, setMexendo] = useState(null);

  async function classificar(p, tipo) {
    setMexendo(p.id);
    const { data, error } = await supabase.rpc('produto_classificar', { p_id: p.id, p_tipo: tipo });
    setMexendo(null);
    if (error) { toast('Não consegui salvar', 'err'); return; }
    toast(tipo === 'neurojitsu' ? `Marcado como NeuroJitsu. ${data}.` : `Marcado como de fora. ${data}.`);
    recarregar();
  }

  if (!produtos.length) {
    return (
      <Card>
        <Empty
          icon={Package}
          titulo="Nenhum produto ainda"
          texto="Cada produto aparece aqui no primeiro aviso que a Hotmart mandar dele."
        />
      </Card>
    );
  }

  const ordem = [...produtos].sort((a, b) => (a.tipo ? 1 : 0) - (b.tipo ? 1 : 0));

  return (
    <Card>
      <p className="micro muted" style={{ marginBottom: 14, lineHeight: 1.7 }}>
        A Hotmart avisa sobre todos os produtos da sua conta, inclusive coprodução. Só o que for NeuroJitsu libera
        acesso ao app e entra na recuperação. Mudar a classificação vale na hora, inclusive pro que estava esperando.
      </p>
      <div className="col">
        {ordem.map((p) => (
          <div key={p.id} className="rec-linha">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row wrap" style={{ gap: 7 }}>
                <span className="tiny" style={{ fontWeight: 600 }}>{p.nome || 'sem nome'}</span>
                {!p.tipo && <Chip tone="warn dot">esperando você</Chip>}
                {p.tipo === 'neurojitsu' && <Chip tone="jade dot">NeuroJitsu</Chip>}
                {p.tipo === 'fora' && <Chip>de fora</Chip>}
              </div>
              <div className="micro muted" style={{ marginTop: 4 }}>
                id {p.id} · {p.eventos} {p.eventos === 1 ? 'aviso' : 'avisos'} · último {quando(p.ultimo_em)}
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <Btn size="xs" variant={p.tipo === 'neurojitsu' ? 'primary' : 'ghost'} disabled={mexendo === p.id || p.tipo === 'neurojitsu'}
                onClick={() => classificar(p, 'neurojitsu')}>É do NeuroJitsu</Btn>
              <Btn size="xs" variant="ghost" disabled={mexendo === p.id || p.tipo === 'fora'}
                onClick={() => classificar(p, 'fora')}>Não é</Btn>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
