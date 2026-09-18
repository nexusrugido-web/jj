import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageCircle, ShoppingCart, Send, CircleCheck, Wallet, Clock, TriangleAlert, Check,
  Plus, Trash2, Hand, Smartphone,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, Btn, Chip, Stat, Empty, Field, Input, Select, Seg, Switch, Bar, Confirmar, useToast } from './UI';
import { Evolucao, BarrasTop } from './Charts';

/* ============================================================
   RECUPERAÇÃO DE CARRINHO

   Quem chegou no checkout e não pagou recebe mensagens no
   WhatsApp. Aqui você vê quanto isso trouxe de volta, escreve as
   mensagens e acompanha cada carrinho.

   O texto salvo aqui é o que sai no próximo envio. O n8n não
   guarda cópia nenhuma: ele pergunta ao banco a cada 5 minutos.
   ============================================================ */

const STATUS = {
  ativo: { nome: 'na sequência', tom: 'warn' },
  recuperado: { nome: 'recuperado', tom: 'jade' },
  comprou_sozinho: { nome: 'comprou antes', tom: '' },
  esgotado: { nome: 'não voltou', tom: '' },
  respondeu: { nome: 'respondeu', tom: 'jade' },
  sem_telefone: { nome: 'sem telefone', tom: 'blood' },
  parado: { nome: 'parado', tom: '' },
};

const ATRASOS = [
  [15, '15 min'], [30, '30 min'], [60, '1 hora'], [120, '2 horas'], [180, '3 horas'],
  [360, '6 horas'], [720, '12 horas'], [1440, '24 horas'], [2160, '36 horas'],
  [2880, '48 horas'], [4320, '3 dias'], [7200, '5 dias'],
];

const CAMPOS = [
  ['{nome}', 'primeiro nome'],
  ['{produto}', 'o que ia comprar'],
  ['{link}', 'checkout já preenchido'],
  ['{motivo}', 'por que não pagou'],
];

const EXEMPLO = {
  nome: 'Rafael',
  produto: 'NeuroJitsu',
  link: 'https://pay.hotmart.com/…?email=rafael@…',
};

const reais = (v) => {
  const n = Number(v || 0);
  const casas = Number.isInteger(n) ? 0 : 2;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas });
};

function haQuanto(iso) {
  if (!iso) return null;
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)}h`;
  return `há ${Math.floor(min / 1440)}d`;
}

function daquiA(iso) {
  if (!iso) return null;
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (min <= 0) return 'no próximo ciclo';
  if (min < 60) return `em ${min} min`;
  if (min < 1440) return `em ${Math.round(min / 60)}h`;
  return `em ${Math.round(min / 1440)}d`;
}

const telefoneBonito = (t) => (t ? `+${t.slice(0, 2)} ${t.slice(2, 4)} ${t.slice(4, -4)}-${t.slice(-4)}` : '');

/* o mesmo que o banco faz na hora de mandar, pra prévia ser fiel */
function montar(texto, frase) {
  return (texto || '')
    .replaceAll('{nome}', EXEMPLO.nome)
    .replaceAll('{produto}', EXEMPLO.produto)
    .replaceAll('{link}', EXEMPLO.link)
    .replaceAll('{motivo}', frase || '');
}

export default function Recuperacao() {
  const [aba, setAba] = useState('resultado');
  const [dias, setDias] = useState(30);
  const [numeros, setNumeros] = useState(null);
  const [ajuste, setAjuste] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [lista, setLista] = useState([]);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function buscar() {
    if (!supabase) return;
    setCarregando(true);
    try {
      const [n, a, e, m, l] = await Promise.all([
        supabase.rpc('recuperacao_numeros', { p_dias: dias }),
        supabase.from('recuperacao_ajuste').select('*').eq('id', 1).single(),
        supabase.from('recuperacao_etapa').select('*').order('ordem'),
        supabase.from('recuperacao_motivo').select('*').order('evento', { ascending: false }),
        supabase.from('recuperacao').select('*').order('id', { ascending: false }).limit(200),
      ]);
      const falha = [n, a, e, m, l].find((x) => x.error);
      if (falha) throw falha.error;
      setNumeros(n.data);
      setAjuste(a.data);
      setEtapas(e.data || []);
      setMotivos(m.data || []);
      setLista(l.data || []);
      setErro(false);
    } catch (x) {
      console.error('[recuperacao]', x);
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
          icon={MessageCircle}
          titulo="O recuperador ainda não existe no banco"
          texto="Rode o recuperacao.sql e o webhook.sql de novo no SQL Editor do Supabase, e volte aqui."
          acao={<Btn variant="primary" onClick={buscar}>Tentar de novo</Btn>}
        />
      </Card>
    );
  }

  if (carregando && !ajuste) {
    return <Card><p className="tiny muted">Buscando os carrinhos.</p></Card>;
  }

  return (
    <>
      <Pulso ajuste={ajuste} setAjuste={setAjuste} numeros={numeros} onTeste={buscar} />

      <div className="row wrap" style={{ gap: 10, margin: '4px 0 14px' }}>
        <Seg
          value={aba}
          onChange={setAba}
          options={[
            { id: 'resultado', nome: 'Resultado' },
            { id: 'mensagens', nome: 'Mensagens' },
            { id: 'carrinhos', nome: 'Carrinhos' },
          ]}
        />
        <span className="spacer" />
        {aba === 'resultado' && (
          <Seg
            value={dias}
            onChange={setDias}
            options={[{ id: 7, nome: '7 dias' }, { id: 30, nome: '30 dias' }, { id: 90, nome: '90 dias' }]}
          />
        )}
      </div>

      {aba === 'resultado' && numeros && <Resultado n={numeros} etapas={etapas} />}
      {aba === 'mensagens' && (
        <Mensagens
          etapas={etapas} setEtapas={setEtapas}
          motivos={motivos} setMotivos={setMotivos}
          ajuste={ajuste} setAjuste={setAjuste}
          recarregar={buscar}
        />
      )}
      {aba === 'carrinhos' && <Carrinhos lista={lista} setLista={setLista} etapas={etapas} />}
    </>
  );
}

/* ------------------------------------------------------------
   O PULSO

   Liga e desliga, e diz se o n8n está vivo. O banco anota cada
   vez que o n8n pergunta quem está na vez; se isso parou de
   mudar, o fluxo caiu e ninguém está recebendo nada.
   ------------------------------------------------------------ */
function Pulso({ ajuste, setAjuste, numeros, onTeste }) {
  const toast = useToast();
  const [tel, setTel] = useState('');
  const [enviando, setEnviando] = useState(false);

  const idade = ajuste?.ultimo_ciclo ? (Date.now() - new Date(ajuste.ultimo_ciclo).getTime()) / 60000 : null;
  const vivo = idade !== null && idade < 15;

  async function virar(ligado) {
    const { data, error } = await supabase.from('recuperacao_ajuste').update({ ligado }).eq('id', 1).select('*');
    if (error || !data?.length) { toast('Não consegui salvar', 'err'); return; }
    setAjuste(data[0]);
    toast(ligado ? 'Recuperação ligada' : 'Recuperação pausada. A fila espera.');
  }

  async function teste() {
    setEnviando(true);
    const { data, error } = await supabase.rpc('recuperacao_teste', { p_telefone: tel, p_nome: 'Teste' });
    setEnviando(false);
    if (error) { toast('Não consegui colocar na fila', 'err'); return; }
    if (data !== 'na fila') { toast(data, 'err'); return; }
    toast(ajuste.ligado ? 'Na fila. Chega em até 5 minutos.' : 'Na fila, mas a recuperação está desligada');
    onTeste();
  }

  return (
    <Card className={`rec-pulso ${ajuste.ligado ? 'on' : ''}`} style={{ marginBottom: 14 }}>
      <div className="row wrap" style={{ gap: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div className="row" style={{ gap: 10 }}>
            <span className={`rec-luz ${ajuste.ligado && vivo ? 'viva' : ajuste.ligado ? 'alerta' : ''}`} />
            <h2 className="h-sec">{ajuste.ligado ? 'Recuperando carrinhos' : 'Recuperação desligada'}</h2>
          </div>
          <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.65 }}>
            {ajuste.ultimo_ciclo === null
              ? 'O n8n ainda não passou por aqui. Importe o recuperacao.json e ative o fluxo.'
              : vivo
                ? `O n8n conferiu a fila ${haQuanto(ajuste.ultimo_ciclo)}. Mensagens saem das ${ajuste.hora_inicio}h às ${ajuste.hora_fim}h.`
                : `A última conferida do n8n foi ${haQuanto(ajuste.ultimo_ciclo)}. O fluxo pode ter caído.`}
            {numeros?.na_fila > 0 && ` ${numeros.na_fila} ${numeros.na_fila === 1 ? 'carrinho esperando' : 'carrinhos esperando'}.`}
          </p>
        </div>
        <Switch on={ajuste.ligado} onChange={virar} label={ajuste.ligado ? 'ligada' : 'desligada'} />
      </div>

      {ajuste.ligado && ajuste.ultimo_ciclo && !vivo && (
        <div className="valida atencao" style={{ marginTop: 12 }}>
          <TriangleAlert size={14} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.65 }}>
            Abra o n8n e confira se o fluxo "Tatame OS - Recuperacao de carrinho" está ativo e se a última execução deu erro.
          </p>
        </div>
      )}

      <div className="row wrap rec-teste" style={{ gap: 8, marginTop: 14 }}>
        <Smartphone size={14} style={{ color: 'var(--dimmer)' }} />
        <span className="micro muted">Mandar a sequência pro seu número:</span>
        <div style={{ flex: '1 1 150px', maxWidth: 200 }}>
          <Input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="75 99999-9999" inputMode="tel" />
        </div>
        <Btn size="sm" icon={Send} onClick={teste} disabled={enviando || tel.replace(/\D/g, '').length < 10}>
          Testar
        </Btn>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------
   O RESULTADO
   ------------------------------------------------------------ */
function Resultado({ n, etapas }) {
  const taxa = n.contatados ? Math.round((n.recuperados / n.contatados) * 100) : 0;

  const serie = useMemo(() => {
    const pd = n.por_dia || [];
    const passo = Math.ceil(pd.length / 10);
    return pd.map((d, i) => ({
      carrinhos: d.carrinhos,
      recuperados: d.recuperados,
      label: i % passo === 0 || i === pd.length - 1 ? `${d.dia.slice(8)}/${d.dia.slice(5, 7)}` : '',
    }));
  }, [n]);

  const funil = [
    { nome: 'Carrinhos', v: n.carrinhos, tom: '' },
    { nome: 'Com telefone', v: n.com_telefone, tom: '' },
    { nome: 'Receberam mensagem', v: n.contatados, tom: 'accent' },
    { nome: 'Compraram', v: n.recuperados, tom: 'jade' },
  ];

  const nomeEtapa = (o) => `Mensagem ${etapas.findIndex((e) => e.ordem === o) + 1 || o}`;

  if (!n.carrinhos) {
    return (
      <Card>
        <Empty
          icon={ShoppingCart}
          titulo="Nenhum carrinho neste período"
          texto="Quando alguém parar no checkout, aparece aqui. Confira se a Hotmart está mandando o evento de abandono de carrinho pro webhook."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="rec-kpis">
        <Card className="rec-kpi destaque">
          <Stat icon={Wallet} valor={reais(n.receita)} label="voltaram pro caixa" tone="jade" />
        </Card>
        <Card className="rec-kpi">
          <Stat icon={CircleCheck} valor={`${taxa}%`} label="de quem recebeu, comprou" sub={`${n.recuperados} de ${n.contatados}`} tone="accent" />
        </Card>
        <Card className="rec-kpi">
          <Stat icon={ShoppingCart} valor={n.carrinhos} label="carrinhos" sub={n.sozinhos ? `${n.sozinhos} ${n.sozinhos === 1 ? 'voltou' : 'voltaram'} sem mensagem` : undefined} />
        </Card>
        <Card className="rec-kpi">
          <Stat
            icon={Send}
            valor={n.enviadas}
            label="mensagens enviadas"
            sub={n.falharam ? `${n.falharam} falharam` : `${n.responderam} responderam`}
            tone={n.falharam ? 'blood' : undefined}
          />
        </Card>
      </div>

      <div className="rec-duas">
        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">de onde até onde</div>
              <h2 className="h-sec">O caminho do carrinho</h2>
            </div>
          </div>
          <div className="col" style={{ gap: 14 }}>
            {funil.map((f, i) => (
              <div key={f.nome}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className="tiny">{f.nome}</span>
                  <span className="spacer" />
                  <span className="num tiny" style={{ fontWeight: 600 }}>{f.v}</span>
                  {i > 0 && funil[i - 1].v > 0 && (
                    <span className="num micro muted" style={{ width: 42, textAlign: 'right' }}>
                      {Math.round((f.v / funil[i - 1].v) * 100)}%
                    </span>
                  )}
                  {i === 0 && <span style={{ width: 42 }} />}
                </div>
                <Bar v={f.v} max={n.carrinhos} tone={f.tom} />
              </div>
            ))}
          </div>
          {n.com_telefone < n.carrinhos && (
            <p className="micro muted" style={{ marginTop: 14, lineHeight: 1.6 }}>
              {n.carrinhos - n.com_telefone} sem telefone que dê pra usar. Deixar o telefone obrigatório no checkout da
              Hotmart resolve.
            </p>
          )}
        </Card>

        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">dia a dia</div>
              <h2 className="h-sec">Carrinhos e recuperados</h2>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <span className="rec-legenda"><i style={{ background: 'var(--dim)' }} />carrinhos</span>
              <span className="rec-legenda"><i style={{ background: 'var(--jade)' }} />recuperados</span>
            </div>
          </div>
          <Evolucao
            serie={serie}
            chaves={[
              { k: 'carrinhos', cor: 'var(--dim)', nome: 'Carrinhos' },
              { k: 'recuperados', cor: 'var(--jade)', nome: 'Recuperados' },
            ]}
          />
        </Card>
      </div>

      <div className="rec-duas">
        <Card>
          <div className="card-head"><h2 className="h-sec">Por que não pagaram</h2></div>
          <BarrasTop dados={(n.por_motivo || []).map((m) => [m.nome, m.total])} tone="roar" />
        </Card>
        <Card>
          <div className="card-head"><h2 className="h-sec">Mensagens por etapa</h2></div>
          <BarrasTop
            dados={(n.por_etapa || []).map((e) => [nomeEtapa(e.etapa), e.enviadas])}
            vazio="Nenhuma mensagem saiu ainda."
          />
        </Card>
      </div>
    </>
  );
}

/* ------------------------------------------------------------
   AS MENSAGENS
   ------------------------------------------------------------ */
function Mensagens({ etapas, setEtapas, motivos, setMotivos, ajuste, setAjuste, recarregar }) {
  const toast = useToast();
  const [rascunho, setRascunho] = useState({});
  const [apagar, setApagar] = useState(null);
  const [frases, setFrases] = useState({});
  const [previa, setPrevia] = useState(motivos[0]?.evento);
  const campos = useRef({});

  useEffect(() => {
    setRascunho(Object.fromEntries(etapas.map((e) => [e.id, { texto: e.texto, atraso_min: e.atraso_min, ativa: e.ativa }])));
  }, [etapas]);

  useEffect(() => {
    setFrases(Object.fromEntries(motivos.map((m) => [m.evento, m.frase])));
  }, [motivos]);

  const frasePrevia = frases[previa] ?? motivos[0]?.frase;

  function inserir(id, campo) {
    const el = campos.current[id];
    const atual = rascunho[id].texto;
    const i = el ? el.selectionStart : atual.length;
    const j = el ? el.selectionEnd : atual.length;
    setRascunho({ ...rascunho, [id]: { ...rascunho[id], texto: atual.slice(0, i) + campo + atual.slice(j) } });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(i + campo.length, i + campo.length);
    });
  }

  async function salvarEtapa(e) {
    const r = rascunho[e.id];
    if (!r.texto.trim()) { toast('A mensagem não pode ficar vazia', 'err'); return; }
    const { data, error } = await supabase.from('recuperacao_etapa')
      .update({ texto: r.texto, atraso_min: Number(r.atraso_min), ativa: r.ativa })
      .eq('id', e.id).select('*');
    if (error || !data?.length) { toast('Não consegui salvar', 'err'); return; }
    setEtapas((l) => l.map((x) => (x.id === e.id ? data[0] : x)));
    toast('Salvo. O próximo envio já sai assim.');
  }

  async function nova() {
    const ultima = etapas[etapas.length - 1];
    const { error } = await supabase.from('recuperacao_etapa').insert({
      ordem: (ultima?.ordem || 0) + 1,
      atraso_min: Math.max(60, (ultima?.atraso_min || 0) + 1440),
      texto: '{nome}, última chamada: {link}',
      ativa: false,
    });
    if (error) { toast('Não consegui criar', 'err'); return; }
    toast('Mensagem criada desligada. Escreva e ligue quando estiver pronta.');
    recarregar();
  }

  async function remover(e) {
    const { error } = await supabase.from('recuperacao_etapa').delete().eq('id', e.id);
    if (error) { toast('Não consegui apagar', 'err'); return; }
    setEtapas((l) => l.filter((x) => x.id !== e.id));
  }

  async function salvarMotivo(m, campos2) {
    const { data, error } = await supabase.from('recuperacao_motivo').update(campos2).eq('evento', m.evento).select('*');
    if (error || !data?.length) { toast('Não consegui salvar', 'err'); return; }
    setMotivos((l) => l.map((x) => (x.evento === m.evento ? data[0] : x)));
    toast('Salvo');
  }

  async function salvarHorario(campo, valor) {
    const { data, error } = await supabase.from('recuperacao_ajuste').update({ [campo]: Number(valor) }).eq('id', 1).select('*');
    if (error || !data?.length) { toast('Não consegui salvar', 'err'); return; }
    setAjuste(data[0]);
  }

  return (
    <>
      {etapas.map((e, idx) => {
        const r = rascunho[e.id];
        if (!r) return null;
        const mudou = r.texto !== e.texto || Number(r.atraso_min) !== e.atraso_min || r.ativa !== e.ativa;
        const semLink = !r.texto.includes('{link}');
        return (
          <Card key={e.id} className={`rec-etapa ${r.ativa ? '' : 'off'}`} style={{ marginBottom: 14 }}>
            <div className="card-head">
              <div>
                <div className="eyebrow">
                  {ATRASOS.find(([m]) => m === Number(r.atraso_min))?.[1] || `${r.atraso_min} min`} depois do abandono
                </div>
                <h2 className="h-sec">Mensagem {idx + 1}</h2>
              </div>
              <Switch on={r.ativa} onChange={(v) => setRascunho({ ...rascunho, [e.id]: { ...r, ativa: v } })} />
            </div>

            <div className="rec-editor">
              <div style={{ minWidth: 0 }}>
                <Field label="Quando sai">
                  <Select value={r.atraso_min} onChange={(ev) => setRascunho({ ...rascunho, [e.id]: { ...r, atraso_min: ev.target.value } })}>
                    {!ATRASOS.some(([m]) => m === Number(r.atraso_min)) && <option value={r.atraso_min}>{r.atraso_min} min</option>}
                    {ATRASOS.map(([m, nome]) => <option key={m} value={m}>{nome} depois do abandono</option>)}
                  </Select>
                </Field>

                <Field label="Texto">
                  <textarea
                    className="textarea"
                    ref={(el) => { campos.current[e.id] = el; }}
                    rows={7}
                    value={r.texto}
                    onChange={(ev) => setRascunho({ ...rascunho, [e.id]: { ...r, texto: ev.target.value } })}
                  />
                </Field>

                <div className="row wrap" style={{ gap: 6 }}>
                  {CAMPOS.map(([c, dica]) => (
                    <button key={c} type="button" className="chip rec-campo" title={dica} onClick={() => inserir(e.id, c)}>
                      <Plus size={10} /> {c}
                    </button>
                  ))}
                </div>

                {semLink && (
                  <p className="micro" style={{ color: 'var(--roar)', marginTop: 10 }}>
                    Sem {'{link}'}, a pessoa não tem por onde voltar pro checkout.
                  </p>
                )}

                <div className="row" style={{ gap: 8, marginTop: 14 }}>
                  <Btn variant={mudou ? 'primary' : 'ghost'} size="sm" icon={Check} disabled={!mudou} onClick={() => salvarEtapa(e)}>
                    Salvar
                  </Btn>
                  {etapas.length > 1 && (
                    <Btn variant="ghost" size="sm" icon={Trash2} onClick={() => setApagar(e)}>Apagar</Btn>
                  )}
                </div>
              </div>

              <div className="rec-celular">
                <div className="rec-celular-topo">
                  <span className="brand-mark" style={{ width: 22, height: 22, borderRadius: 7 }} />
                  <span className="micro" style={{ fontWeight: 600 }}>NeuroJitsu</span>
                </div>
                <div className="rec-balao">
                  {montar(r.texto, frasePrevia)}
                  <span className="rec-hora">09:41</span>
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      <Btn icon={Plus} onClick={nova} style={{ marginBottom: 20 }}>Adicionar mensagem</Btn>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">o que entra no lugar de {'{motivo}'}</div>
            <h2 className="h-sec">Por que não pagou</h2>
          </div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          {motivos.map((m) => (
            <div key={m.evento} style={{ paddingTop: 12, borderTop: '1px solid var(--seam)' }}>
              <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
                <span className="tiny" style={{ fontWeight: 600 }}>{m.nome}</span>
                <button
                  type="button"
                  className={`chip ${previa === m.evento ? 'on' : ''}`}
                  style={{ minHeight: 26, fontSize: 11 }}
                  onClick={() => setPrevia(m.evento)}
                >
                  ver na prévia
                </button>
                <span className="spacer" />
                <Switch on={m.ativo} onChange={(v) => salvarMotivo(m, { ativo: v })} label={m.ativo ? 'recupera' : 'ignora'} />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Input value={frases[m.evento] ?? ''} onChange={(ev) => setFrases({ ...frases, [m.evento]: ev.target.value })} />
                <Btn
                  size="sm"
                  variant={frases[m.evento] !== m.frase ? 'primary' : 'ghost'}
                  icon={Check}
                  disabled={frases[m.evento] === m.frase || !frases[m.evento]?.trim()}
                  onClick={() => salvarMotivo(m, { frase: frases[m.evento].trim() })}
                >
                  Salvar
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">horário de Brasília</div>
            <h2 className="h-sec row" style={{ gap: 8 }}><Clock size={16} /> Quando pode mandar</h2>
          </div>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="A partir de">
            <Select value={ajuste.hora_inicio} onChange={(ev) => salvarHorario('hora_inicio', ev.target.value)}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}h</option>)}
            </Select>
          </Field>
          <Field label="Até">
            <Select value={ajuste.hora_fim} onChange={(ev) => salvarHorario('hora_fim', ev.target.value)}>
              {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{h}h</option>)}
            </Select>
          </Field>
        </div>
        <p className="micro muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
          Fora desse horário a fila espera e sai no começo do próximo. Entre uma mensagem e outra da mesma
          pessoa passam pelo menos 3 horas.
        </p>
      </Card>

      <Confirmar
        aberto={!!apagar}
        onClose={() => setApagar(null)}
        onConfirmar={() => remover(apagar)}
        titulo="Apagar esta mensagem"
        texto="Quem está na sequência pula direto pra próxima. O que já foi enviado continua nos números."
      />
    </>
  );
}

/* ------------------------------------------------------------
   OS CARRINHOS
   ------------------------------------------------------------ */
function Carrinhos({ lista, setLista, etapas }) {
  const toast = useToast();
  const [filtro, setFiltro] = useState('todos');

  const contagem = useMemo(() => {
    const c = {};
    for (const r of lista) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [lista]);

  const mostrados = filtro === 'todos' ? lista : lista.filter((r) => r.status === filtro);
  const ativas = etapas.filter((e) => e.ativa);
  const posicao = (ordem) => ativas.filter((e) => e.ordem <= ordem).length;

  async function parar(r) {
    const { data, error } = await supabase.from('recuperacao')
      .update({ status: 'parado', proximo_em: null, fechado_em: new Date().toISOString() })
      .eq('id', r.id).select('*');
    if (error || !data?.length) { toast('Não consegui parar', 'err'); return; }
    setLista((l) => l.map((x) => (x.id === r.id ? data[0] : x)));
    toast('Parado. Essa pessoa não recebe mais nada.');
  }

  if (!lista.length) {
    return (
      <Card>
        <Empty icon={ShoppingCart} titulo="Nenhum carrinho ainda" texto="Quando alguém parar no checkout, aparece aqui." />
      </Card>
    );
  }

  return (
    <Card>
      <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
        <Chip on={filtro === 'todos'} onClick={() => setFiltro('todos')}>todos {lista.length}</Chip>
        {Object.entries(STATUS).filter(([s]) => contagem[s]).map(([s, st]) => (
          <Chip key={s} on={filtro === s} onClick={() => setFiltro(s)}>{st.nome} {contagem[s]}</Chip>
        ))}
      </div>

      <div className="col">
        {mostrados.map((r) => {
          const st = STATUS[r.status] || { nome: r.status, tom: '' };
          return (
            <div key={r.id} className="rec-linha">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row wrap" style={{ gap: 7 }}>
                  <span className="tiny truncate" style={{ fontWeight: 600, maxWidth: 220 }}>
                    {r.nome ? r.nome[0].toUpperCase() + r.nome.slice(1).toLowerCase() : r.email}
                  </span>
                  <Chip tone={`${st.tom} dot`}>{st.nome}</Chip>
                  {r.teste && <Chip>teste</Chip>}
                </div>
                <div className="micro muted truncate" style={{ marginTop: 4 }}>
                  {r.email}{r.telefone && ` · ${telefoneBonito(r.telefone)}`}
                </div>
                <div className="micro muted" style={{ marginTop: 3 }}>
                  {haQuanto(r.criado_em)}
                  {r.produto_nome && ` · ${r.produto_nome}`}
                  {r.etapa > 0 && ` · recebeu ${posicao(r.etapa)} de ${ativas.length}`}
                  {r.status === 'ativo' && r.proximo_em && ` · próxima ${daquiA(r.proximo_em)}`}
                  {r.valor_recuperado && ` · ${reais(r.valor_recuperado)}`}
                </div>
              </div>
              {r.status === 'ativo' && (
                <Btn size="xs" variant="ghost" icon={Hand} onClick={() => parar(r)}>Parar</Btn>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
