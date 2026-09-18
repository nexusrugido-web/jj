import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageCircle, ShoppingCart, Send, CircleCheck, Wallet, Clock, TriangleAlert, Check,
  Plus, Trash2, Hand, Smartphone, Download, Bell, Ban, Ticket, Gauge, MousePointerClick, Wifi, WifiOff,
  X, LogIn, CircleDashed, PhoneOff, Mail, Phone, Tag, ShoppingBag, MapPin,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, Btn, Chip, Stat, Empty, Field, Input, Select, Seg, Switch, Bar, Confirmar, useToast } from './UI';
import { Evolucao, BarrasTop } from './Charts';
import { baixarPlanilha } from '../lib/planilha';

/* ============================================================
   RECUPERAÇÃO

   Quem chegou perto de pagar e não pagou recebe mensagens no
   WhatsApp. São três fluxos, cada um com as suas mensagens:
   carrinho (abandonou, o Pix venceu, o cartão não passou), Pix
   pendente (gerou e ainda não pagou) e renovação (já era
   assinante e a cobrança não passou).

   O texto salvo aqui é o que sai no próximo envio. O n8n não
   guarda cópia nenhuma: ele pergunta ao banco a cada 5 minutos.
   ============================================================ */

const STATUS = {
  ativo: { nome: 'na sequência', tom: 'warn' },
  respondeu: { nome: 'respondeu', tom: 'jade' },
  recuperado: { nome: 'recuperado', tom: 'jade' },
  comprou_sozinho: { nome: 'comprou antes', tom: '' },
  esgotado: { nome: 'não voltou', tom: '' },
  venceu: { nome: 'Pix venceu', tom: '' },
  bloqueado: { nome: 'pediu pra sair', tom: 'blood' },
  sem_telefone: { nome: 'sem telefone', tom: 'blood' },
  parado: { nome: 'parado', tom: '' },
};

const FLUXOS = [
  { id: 'carrinho', nome: 'Carrinho', resumo: 'Abandonou o checkout, deixou o Pix vencer ou o cartão não passou.' },
  { id: 'pix', nome: 'Pix pendente', resumo: 'Gerou o Pix ou o boleto e ainda não pagou. O código sai numa mensagem separada, pra copiar fácil.' },
  { id: 'renovacao', nome: 'Renovação', resumo: 'Já era assinante e a cobrança da renovação não passou. É dinheiro que sai sem a pessoa ter decidido sair.' },
];
const nomeFluxo = (id) => FLUXOS.find((f) => f.id === id)?.nome || id;

const ATRASOS = [
  [5, '5 min'], [15, '15 min'], [30, '30 min'], [60, '1 hora'], [120, '2 horas'], [180, '3 horas'],
  [360, '6 horas'], [720, '12 horas'], [1200, '20 horas'], [1440, '24 horas'], [2160, '36 horas'],
  [2820, '47 horas'], [2880, '48 horas'], [4320, '3 dias'], [7200, '5 dias'],
];

const CAMPOS = [
  ['{nome}', 'primeiro nome'],
  ['{produto}', 'o que ia comprar'],
  ['{link}', 'checkout já preenchido'],
  ['{motivo}', 'por que não pagou'],
  ['{cupom}', 'o cupom da aba Ajustes, já aplicado no link'],
  ['{pix}', 'o código do Pix, em mensagem separada'],
];

const EXEMPLO = {
  nome: 'Rafael',
  produto: 'NeuroJitsu',
  link: 'jj-theta-eight.vercel.app/r/k3f9a2c1d0',
  pix: '00020101021226900014br.gov.bcb.pix2568pix...6304152F',
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

const nomeBonito = (s) => (s ? s.split(' ').map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ') : '');

/* o mesmo que o banco faz na hora de mandar, pra prévia ser fiel.
   Devolve os balões: o código do Pix sai num balão só dele. */
function montar(texto, frase, cupom) {
  const t = (texto || '')
    .replaceAll('{nome}', EXEMPLO.nome)
    .replaceAll('{produto}', EXEMPLO.produto)
    .replaceAll('{link}', EXEMPLO.link)
    .replaceAll('{motivo}', frase || '')
    .replaceAll('{cupom}', cupom || 'CUPOM');
  if (!t.includes('{pix}')) return [t];
  const resto = t.replaceAll('{pix}', '').trim();
  return resto ? [resto, EXEMPLO.pix] : [EXEMPLO.pix];
}

export default function Recuperacao() {
  const [aba, setAba] = useState('resultado');
  const [dias, setDias] = useState(30);
  const [numeros, setNumeros] = useState(null);
  const [ajuste, setAjuste] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [lista, setLista] = useState([]);
  const [destinos, setDestinos] = useState([]);
  const [bloqueios, setBloqueios] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [vigia, setVigia] = useState(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function buscar() {
    if (!supabase) return;
    setCarregando(true);
    try {
      const [n, a, e, m, l, d, b, v] = await Promise.all([
        supabase.rpc('recuperacao_numeros', { p_dias: dias, p_fluxo: null }),
        supabase.from('recuperacao_ajuste').select('*').eq('id', 1).single(),
        supabase.from('recuperacao_etapa').select('*').order('fluxo').order('ordem'),
        supabase.from('recuperacao_motivo').select('*').order('evento', { ascending: false }),
        supabase.from('recuperacao').select('*').order('id', { ascending: false }).limit(300),
        supabase.from('aviso_destino').select('*').order('id'),
        supabase.from('recuperacao_bloqueio').select('*').order('criado_em', { ascending: false }),
        supabase.from('recuperacao_envio')
          .select('id, recuperacao_id, etapa, status, erro, criado_em, tipo, clicou_em')
          .not('recuperacao_id', 'is', null).order('id', { ascending: false }).limit(3000),
      ]);
      const falha = [n, a, e, m, l, d, b].find((x) => x.error);
      if (falha) throw falha.error;
      setNumeros(n.data);
      setAjuste(a.data);
      setEtapas(e.data || []);
      setMotivos(m.data || []);
      setLista(l.data || []);
      setDestinos(d.data || []);
      setBloqueios(b.data || []);
      setEnvios(v.data || []);
      setErro(false);
      /* o estado da vigia não trava o painel se a função ainda não existir */
      supabase.rpc('vigia_estado').then(({ data }) => setVigia(data || null), () => setVigia(null));
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
          texto="Rode o SQL mais novo no SQL Editor do Supabase e volte aqui."
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
      <Pulso ajuste={ajuste} setAjuste={setAjuste} numeros={numeros} vigia={vigia} onTeste={buscar} />

      <div className="row wrap" style={{ gap: 10, margin: '4px 0 14px' }}>
        <Seg
          value={aba}
          onChange={setAba}
          options={[
            { id: 'resultado', nome: 'Resultado' },
            { id: 'mensagens', nome: 'Mensagens' },
            { id: 'carrinhos', nome: 'Pessoas' },
            { id: 'ajustes', nome: 'Ajustes' },
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
          ajuste={ajuste} recarregar={buscar}
        />
      )}
      {aba === 'carrinhos' && <Pessoas lista={lista} setLista={setLista} etapas={etapas} motivos={motivos} envios={envios} />}
      {aba === 'ajustes' && (
        <Ajustes
          ajuste={ajuste} setAjuste={setAjuste}
          destinos={destinos} setDestinos={setDestinos}
          bloqueios={bloqueios} setBloqueios={setBloqueios}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------
   O PULSO

   Liga e desliga, e diz se as duas pontas estão vivas: o n8n
   (o banco anota cada vez que ele pergunta quem está na vez) e
   o WhatsApp (a vigia do banco pergunta ao Evolution Go a cada
   5 minutos).
   ------------------------------------------------------------ */
function Pulso({ ajuste, setAjuste, numeros, vigia, onTeste }) {
  const toast = useToast();
  const [tel, setTel] = useState('');
  const [fluxo, setFluxo] = useState('carrinho');
  const [enviando, setEnviando] = useState(false);

  const idade = ajuste?.ultimo_ciclo ? (Date.now() - new Date(ajuste.ultimo_ciclo).getTime()) / 60000 : null;
  const vivo = idade !== null && idade < 15;
  const vigiaViva = ajuste?.whatsapp_visto && (Date.now() - new Date(ajuste.whatsapp_visto).getTime()) / 60000 < 20;

  async function virar(ligado) {
    const { data, error } = await supabase.from('recuperacao_ajuste').update({ ligado }).eq('id', 1).select('*');
    if (error || !data?.length) { toast('Não consegui salvar', 'err'); return; }
    setAjuste(data[0]);
    toast(ligado ? 'Recuperação ligada' : 'Recuperação pausada. A fila espera.');
  }

  async function ligarVigia() {
    const { data, error } = await supabase.rpc('vigia_ligar');
    if (error) { toast('Não consegui ligar a vigia', 'err'); return; }
    toast(data === 'ligada' ? 'Vigia ligada. A primeira conferida aparece em até 10 minutos.' : data, data === 'ligada' ? undefined : 'err');
    onTeste();
  }

  async function teste() {
    setEnviando(true);
    const { data, error } = await supabase.rpc('recuperacao_teste', { p_telefone: tel, p_nome: 'Teste', p_fluxo: fluxo });
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
            <h2 className="h-sec">{ajuste.ligado ? 'Recuperando' : 'Recuperação desligada'}</h2>
          </div>
          <p className="micro muted" style={{ marginTop: 6, lineHeight: 1.65 }}>
            {ajuste.ultimo_ciclo === null
              ? 'O n8n ainda não passou por aqui. Importe o fluxo e ative.'
              : vivo
                ? `O n8n conferiu a fila ${haQuanto(ajuste.ultimo_ciclo)}. Mensagens saem das ${ajuste.hora_inicio}h às ${ajuste.hora_fim}h.`
                : `A última conferida do n8n foi ${haQuanto(ajuste.ultimo_ciclo)}. O fluxo pode ter caído.`}
            {numeros?.na_fila > 0 && ` ${numeros.na_fila} ${numeros.na_fila === 1 ? 'pessoa esperando' : 'pessoas esperando'}.`}
            {numeros && ` Hoje: ${numeros.hoje} de ${ajuste.limite_dia} mensagens.`}
          </p>
          {vigiaViva ? (
            <div className="row micro" style={{ gap: 6, marginTop: 6, color: ajuste.whatsapp_ok ? 'var(--jade)' : 'var(--blood)' }}>
              {ajuste.whatsapp_ok ? <Wifi size={13} /> : <WifiOff size={13} />}
              {ajuste.whatsapp_ok
                ? `WhatsApp conectado · conferido ${haQuanto(ajuste.whatsapp_visto)}`
                : 'WhatsApp desconectado: nenhuma mensagem sai até reconectar no Evolution Go'}
            </div>
          ) : vigia && (
            <div className="row wrap micro" style={{ gap: 8, marginTop: 6, color: 'var(--dim)' }}>
              <WifiOff size={13} />
              <span>
                {!vigia.agendada
                  ? `Ninguém está conferindo o WhatsApp: ${vigia.motivo}.`
                  : vigia.ultima?.status === 'failed'
                    ? `A vigia do WhatsApp deu erro: ${String(vigia.ultima.erro || '').slice(0, 120)}`
                    : 'Vigia do WhatsApp ligada. A primeira conferida aparece em até 10 minutos.'}
              </span>
              {(!vigia.agendada || vigia.ultima?.status === 'failed') && (
                <Btn size="xs" onClick={ligarVigia}>Ligar a vigia</Btn>
              )}
            </div>
          )}
        </div>
        <Switch on={ajuste.ligado} onChange={virar} label={ajuste.ligado ? 'ligada' : 'desligada'} />
      </div>

      {ajuste.ligado && ajuste.ultimo_ciclo && !vivo && (
        <div className="valida atencao" style={{ marginTop: 12 }}>
          <TriangleAlert size={14} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.65 }}>
            Abra o n8n e confira se o fluxo está ativo e se a última execução deu erro.
          </p>
        </div>
      )}

      <div className="row wrap rec-teste" style={{ gap: 8, marginTop: 14 }}>
        <Smartphone size={14} style={{ color: 'var(--dimmer)' }} />
        <span className="micro muted">Testar no seu número:</span>
        <div style={{ flex: '1 1 140px', maxWidth: 190 }}>
          <Input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="75 99999-9999" inputMode="tel" />
        </div>
        <div style={{ flex: '0 1 160px' }}>
          <Select value={fluxo} onChange={(e) => setFluxo(e.target.value)}>
            {FLUXOS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Select>
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
    const passo = Math.max(1, Math.ceil(pd.length / 10));
    return pd.map((d, i) => ({
      carrinhos: d.carrinhos,
      recuperados: d.recuperados,
      label: i % passo === 0 || i === pd.length - 1 ? `${d.dia.slice(8)}/${d.dia.slice(5, 7)}` : '',
    }));
  }, [n]);

  const funil = [
    { nome: 'Chegaram perto de pagar', v: n.carrinhos, tom: '' },
    { nome: 'Com telefone', v: n.com_telefone, tom: '' },
    { nome: 'Receberam mensagem', v: n.contatados, tom: 'accent' },
    { nome: 'Clicaram no link', v: n.clicaram, tom: 'accent' },
    { nome: 'Compraram', v: n.recuperados, tom: 'jade' },
  ];

  const nomeEtapa = (fluxo, ordem) => {
    const doFluxo = etapas.filter((e) => e.fluxo === fluxo);
    const i = doFluxo.findIndex((e) => e.ordem === ordem);
    return `${nomeFluxo(fluxo)} · mensagem ${i >= 0 ? i + 1 : ordem}`;
  };

  if (!n.carrinhos) {
    return (
      <Card>
        <Empty
          icon={ShoppingCart}
          titulo="Ninguém neste período"
          texto="Quando alguém parar no checkout ou gerar um Pix sem pagar, aparece aqui. Confira se esses eventos estão marcados no webhook da Hotmart."
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
          <Stat icon={MessageCircle} valor={n.responderam} label="responderam"
            sub={n.bloqueados ? `${n.bloqueados} ${n.bloqueados === 1 ? 'pediu' : 'pediram'} pra sair` : undefined} />
        </Card>
        <Card className="rec-kpi">
          <Stat
            icon={Send}
            valor={n.enviadas}
            label="mensagens enviadas"
            sub={n.falharam ? `${n.falharam} falharam` : (n.sozinhos ? `${n.sozinhos} ${n.sozinhos === 1 ? 'voltou' : 'voltaram'} sem mensagem` : undefined)}
            tone={n.falharam ? 'blood' : undefined}
          />
        </Card>
      </div>

      <div className="rec-duas">
        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">de onde até onde</div>
              <h2 className="h-sec">O caminho</h2>
            </div>
          </div>
          <div className="col" style={{ gap: 14 }}>
            {funil.map((f, i) => (
              <div key={f.nome}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className="tiny">{f.nome}</span>
                  <span className="spacer" />
                  <span className="num tiny" style={{ fontWeight: 600 }}>{f.v}</span>
                  {i > 0 && funil[i - 1].v > 0 ? (
                    <span className="num micro muted" style={{ width: 42, textAlign: 'right' }}>
                      {Math.round((f.v / funil[i - 1].v) * 100)}%
                    </span>
                  ) : <span style={{ width: 42 }} />}
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
              <h2 className="h-sec">Chegaram e compraram</h2>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <span className="rec-legenda"><i style={{ background: 'var(--dim)' }} />chegaram</span>
              <span className="rec-legenda"><i style={{ background: 'var(--jade)' }} />compraram</span>
            </div>
          </div>
          <Evolucao
            serie={serie}
            chaves={[
              { k: 'carrinhos', cor: 'var(--dim)', nome: 'Chegaram' },
              { k: 'recuperados', cor: 'var(--jade)', nome: 'Compraram' },
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
            dados={(n.por_etapa || []).map((e) => [nomeEtapa(e.fluxo, e.etapa), e.enviadas])}
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
function Mensagens({ etapas, setEtapas, motivos, setMotivos, ajuste, recarregar }) {
  const toast = useToast();
  const [fluxo, setFluxo] = useState('carrinho');
  const [rascunho, setRascunho] = useState({});
  const [apagar, setApagar] = useState(null);
  const [frases, setFrases] = useState({});
  const [previa, setPrevia] = useState(null);
  const campos = useRef({});

  useEffect(() => {
    setRascunho(Object.fromEntries(etapas.map((e) => [e.id, { texto: e.texto, atraso_min: e.atraso_min, ativa: e.ativa }])));
  }, [etapas]);

  useEffect(() => {
    setFrases(Object.fromEntries(motivos.map((m) => [m.evento, m.frase])));
  }, [motivos]);

  const doFluxo = etapas.filter((e) => e.fluxo === fluxo);
  const motivosDoFluxo = motivos.filter((m) => (m.fluxo || 'carrinho') === fluxo);
  const eventoPrevia = motivosDoFluxo.some((m) => m.evento === previa) ? previa : motivosDoFluxo[0]?.evento;
  const frasePrevia = frases[eventoPrevia] ?? motivosDoFluxo[0]?.frase;
  const camposDoFluxo = CAMPOS.filter(([c]) => c !== '{pix}' || fluxo === 'pix');

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
    const ultima = doFluxo[doFluxo.length - 1];
    const { error } = await supabase.from('recuperacao_etapa').insert({
      fluxo,
      ordem: (ultima?.ordem || 0) + 1,
      atraso_min: Math.max(60, (ultima?.atraso_min || 0) + 1440),
      texto: fluxo === 'pix' ? '{nome}, seu Pix ainda está valendo:\n\n{pix}' : '{nome}, última chamada: {link}',
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

  async function salvarMotivo(m, mudanca) {
    const { data, error } = await supabase.from('recuperacao_motivo').update(mudanca).eq('evento', m.evento).select('*');
    if (error || !data?.length) { toast('Não consegui salvar', 'err'); return; }
    setMotivos((l) => l.map((x) => (x.evento === m.evento ? data[0] : x)));
    toast('Salvo');
  }

  const info = FLUXOS.find((f) => f.id === fluxo);

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <Seg value={fluxo} onChange={setFluxo} options={FLUXOS.map((f) => ({ id: f.id, nome: f.nome }))} />
        <p className="micro muted" style={{ marginTop: 10, lineHeight: 1.65 }}>{info.resumo}</p>
      </Card>

      {doFluxo.map((e, idx) => {
        const r = rascunho[e.id];
        if (!r) return null;
        const mudou = r.texto !== e.texto || Number(r.atraso_min) !== e.atraso_min || r.ativa !== e.ativa;
        const faltaCaminho = fluxo === 'pix' ? !r.texto.includes('{pix}') && !r.texto.includes('{link}') : !r.texto.includes('{link}');
        const baloes = montar(r.texto, frasePrevia, ajuste?.cupom);
        return (
          <Card key={e.id} className={`rec-etapa ${r.ativa ? '' : 'off'}`} style={{ marginBottom: 14 }}>
            <div className="card-head">
              <div>
                <div className="eyebrow">
                  {ATRASOS.find(([m]) => m === Number(r.atraso_min))?.[1] || `${r.atraso_min} min`} depois
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
                    {ATRASOS.map(([m, nome]) => <option key={m} value={m}>{nome} depois</option>)}
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
                  {camposDoFluxo.map(([c, dica]) => (
                    <button key={c} type="button" className="chip rec-campo" title={dica} onClick={() => inserir(e.id, c)}>
                      <Plus size={10} /> {c}
                    </button>
                  ))}
                </div>

                {faltaCaminho && (
                  <p className="micro" style={{ color: 'var(--roar)', marginTop: 10 }}>
                    {fluxo === 'pix' ? 'Sem {pix} nem {link}' : 'Sem {link}'}, a pessoa não tem por onde pagar.
                  </p>
                )}
                {r.texto.includes('{cupom}') && !ajuste?.cupom && (
                  <p className="micro" style={{ color: 'var(--roar)', marginTop: 10 }}>
                    Esta mensagem usa {'{cupom}'}, mas nenhum cupom foi cadastrado na aba Ajustes.
                  </p>
                )}

                <div className="row" style={{ gap: 8, marginTop: 14 }}>
                  <Btn variant={mudou ? 'primary' : 'ghost'} size="sm" icon={Check} disabled={!mudou} onClick={() => salvarEtapa(e)}>
                    Salvar
                  </Btn>
                  {doFluxo.length > 1 && (
                    <Btn variant="ghost" size="sm" icon={Trash2} onClick={() => setApagar(e)}>Apagar</Btn>
                  )}
                </div>
              </div>

              <div className="rec-celular">
                <div className="rec-celular-topo">
                  <span className="brand-mark" style={{ width: 22, height: 22, borderRadius: 7 }} />
                  <span className="micro" style={{ fontWeight: 600 }}>NeuroJitsu</span>
                </div>
                {baloes.map((b, i) => (
                  <div key={i} className={`rec-balao ${i > 0 ? 'seguinte' : ''}`}>
                    {b}
                    <span className="rec-hora">09:41</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      })}

      <Btn icon={Plus} onClick={nova} style={{ marginBottom: 20 }}>Adicionar mensagem</Btn>

      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">o que entra no lugar de {'{motivo}'}</div>
            <h2 className="h-sec">O que aconteceu</h2>
          </div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          {motivosDoFluxo.map((m) => (
            <div key={m.evento} style={{ paddingTop: 12, borderTop: '1px solid var(--seam)' }}>
              <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
                <span className="tiny" style={{ fontWeight: 600 }}>{m.nome}</span>
                {motivosDoFluxo.length > 1 && (
                  <button
                    type="button"
                    className={`chip ${eventoPrevia === m.evento ? 'on' : ''}`}
                    style={{ minHeight: 26, fontSize: 11 }}
                    onClick={() => setPrevia(m.evento)}
                  >
                    ver na prévia
                  </button>
                )}
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
   AS PESSOAS

   Cada pessoa mostra a trilha inteira: quando entrou, cada
   mensagem (saiu, falhou, está agendada ou não vai mais sair),
   se clicou, se respondeu e como terminou. O horário vai em
   cada passo, pra dar pra conferir sem abrir o banco.

   A planilha sai marcando quem pediu pra sair: esse contato não
   pode ser usado de novo.
   ------------------------------------------------------------ */

function quandoCurto(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dia = (x) => x.toDateString();
  const hoje = new Date();
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
  if (dia(d) === dia(hoje)) return `hoje ${hora}`;
  if (dia(d) === dia(ontem)) return `ontem ${hora}`;
  if (dia(d) === dia(amanha)) return `amanhã ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

const iniciais = (s) => (s || '?').trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');

/* como a sequência terminou, pra fechar a trilha */
const DESFECHO = {
  recuperado: { ico: Wallet, tom: 'ok', titulo: 'Comprou' },
  comprou_sozinho: { ico: Wallet, tom: 'ok', titulo: 'Comprou sozinho', sub: 'antes da 1ª mensagem' },
  respondeu: { ico: MessageCircle, tom: 'ok', titulo: 'Respondeu' },
  bloqueado: { ico: Ban, tom: 'erro', titulo: 'Pediu pra sair', sub: 'não recebe mais nada' },
  esgotado: { ico: CircleDashed, tom: 'fim', titulo: 'Sequência terminou', sub: 'não comprou' },
  venceu: { ico: CircleDashed, tom: 'fim', titulo: 'Pix venceu', sub: 'segue no fluxo de carrinho' },
  sem_telefone: { ico: PhoneOff, tom: 'erro', titulo: 'Sem telefone', sub: 'nenhuma mensagem pode sair' },
  parado: { ico: Hand, tom: 'fim', titulo: 'Parado por você' },
};

/* cada mensagem da sequência e o que aconteceu com ela */
function montarTrilha(r, etapas, envios) {
  const meus = envios.filter((v) => v.recuperacao_id === r.id);
  const ordens = [...new Set([
    ...etapas.filter((e) => e.fluxo === r.fluxo && e.ativa).map((e) => e.ordem),
    ...meus.filter((v) => v.tipo === 'recuperacao').map((v) => v.etapa),
  ])].sort((a, b) => a - b);
  const proxima = r.status === 'ativo' ? ordens.find((o) => o > r.etapa) : null;

  return ordens.map((ordem, i) => {
    const titulo = `Mensagem ${i + 1}`;
    const v = meus.find((x) => x.etapa === ordem && x.tipo === 'recuperacao');
    const pix = meus.find((x) => x.etapa === ordem && x.tipo === 'pix');

    if (v) {
      if (v.status === 'enviado') {
        return { titulo, estado: 'ok', ico: Check, sub: `enviada ${quandoCurto(v.criado_em)}`, extra: pix ? `+ código do Pix${pix.status === 'falhou' ? ' (falhou)' : ''}` : null, clicou: v.clicou_em };
      }
      if (v.status === 'falhou') {
        return { titulo, estado: 'erro', ico: X, sub: `falhou ${quandoCurto(v.criado_em)}`, erro: v.erro };
      }
      const parada = Date.now() - new Date(v.criado_em).getTime() > 10 * 60000;
      return parada
        ? { titulo, estado: 'alerta', ico: TriangleAlert, sub: `sem confirmação desde ${quandoCurto(v.criado_em)}` }
        : { titulo, estado: 'saindo', ico: Send, sub: 'saindo agora' };
    }

    /* saiu, mas o registro do envio não veio na busca (é antigo) */
    if (ordem <= r.etapa) return { titulo, estado: 'ok', ico: Check, sub: 'enviada' };

    if (ordem === proxima) {
      const naFila = r.proximo_em && new Date(r.proximo_em).getTime() <= Date.now();
      return naFila
        ? { titulo, estado: 'agendada', ico: Clock, sub: 'na fila, sai no próximo ciclo' }
        : { titulo, estado: 'agendada', ico: Clock, sub: `agendada ${quandoCurto(r.proximo_em)}`, dica: daquiA(r.proximo_em) };
    }
    if (r.status === 'ativo') return { titulo, estado: 'depois', ico: CircleDashed, sub: 'depois da anterior' };
    return { titulo, estado: 'cancelada', ico: CircleDashed, sub: 'não vai mais sair' };
  });
}

function Passo({ ico: Ico, estado, titulo, sub, extra }) {
  return (
    <div className={`rec-passo ${estado}`}>
      <span className="rec-passo-ico"><Ico size={12} strokeWidth={2.5} /></span>
      <div className="rec-passo-txt">
        <b>{titulo}</b>
        <span>{sub}{extra ? ` · ${extra}` : ''}</span>
      </div>
    </div>
  );
}

function Pessoas({ lista, setLista, etapas, motivos, envios }) {
  const toast = useToast();
  const [filtro, setFiltro] = useState('todos');
  const [baixando, setBaixando] = useState(false);

  const contagem = useMemo(() => {
    const c = {};
    for (const r of lista) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [lista]);

  const mostrados = filtro === 'todos' ? lista : lista.filter((r) => r.status === filtro);
  const motivo = (ev) => motivos.find((m) => m.evento === ev)?.nome || ev;

  async function parar(r) {
    const { data, error } = await supabase.from('recuperacao')
      .update({ status: 'parado', proximo_em: null, fechado_em: new Date().toISOString() })
      .eq('id', r.id).select('*');
    if (error || !data?.length) { toast('Não consegui parar', 'err'); return; }
    setLista((l) => l.map((x) => (x.id === r.id ? data[0] : x)));
    toast('Parado. Essa pessoa não recebe mais nada.');
  }

  async function baixar() {
    setBaixando(true);
    try {
      let q = supabase.from('recuperacao').select('*').eq('teste', false).order('id', { ascending: false }).range(0, 9999);
      if (filtro !== 'todos') q = q.eq('status', filtro);
      const { data, error } = await q;
      if (error) throw error;
      baixarPlanilha(`neurojitsu-contatos${filtro !== 'todos' ? `-${filtro}` : ''}`, [
        [(r) => new Date(r.criado_em).toLocaleString('pt-BR'), 'Quando'],
        [(r) => nomeBonito(r.nome_completo || r.nome), 'Nome'],
        ['email', 'E-mail'],
        ['telefone', 'Telefone'],
        [(r) => nomeFluxo(r.fluxo), 'Fluxo'],
        [(r) => motivo(r.evento), 'O que aconteceu'],
        [(r) => STATUS[r.status]?.nome || r.status, 'Situação'],
        [(r) => (r.status === 'bloqueado' ? 'NÃO' : 'sim'), 'Pode contatar'],
        ['produto_nome', 'Produto'],
        ['origem', 'Origem'],
        [(r) => (r.clicou_em ? 'sim' : ''), 'Clicou'],
        ['resposta', 'Respondeu'],
        ['valor_recuperado', 'Valor recuperado'],
      ], data || []);
    } catch (e) {
      console.error('[recuperacao]', e);
      toast('Não consegui gerar a planilha', 'err');
    } finally {
      setBaixando(false);
    }
  }

  if (!lista.length) {
    return (
      <Card>
        <Empty icon={ShoppingCart} titulo="Ninguém ainda" texto="Quando alguém parar no checkout, aparece aqui." />
      </Card>
    );
  }

  return (
    <>
      <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
        <Chip on={filtro === 'todos'} onClick={() => setFiltro('todos')}>todos {lista.length}</Chip>
        {Object.entries(STATUS).filter(([s]) => contagem[s]).map(([s, st]) => (
          <Chip key={s} on={filtro === s} onClick={() => setFiltro(s)}>{st.nome} {contagem[s]}</Chip>
        ))}
        <span className="spacer" />
        <Btn size="sm" icon={Download} onClick={baixar} disabled={baixando}>Baixar planilha</Btn>
      </div>

      <div className="col" style={{ gap: 12 }}>
        {mostrados.map((r) => {
          const st = STATUS[r.status] || { nome: r.status, tom: '' };
          const nome = nomeBonito(r.nome_completo || r.nome);
          const passos = montarTrilha(r, etapas, envios);
          const falhas = passos.filter((p) => p.estado === 'erro' && p.erro);
          const fim = r.status !== 'ativo' ? DESFECHO[r.status] : null;

          return (
            <Card key={r.id} className="rec-pessoa">
              <div className="rec-pessoa-topo">
                <span className={`rec-avatar ${st.tom}`}>{iniciais(nome || r.email)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row wrap" style={{ gap: 7 }}>
                    <span className="rec-pessoa-nome truncate">{nome || r.email}</span>
                    <Chip tone={`${st.tom} dot`}>{st.nome}</Chip>
                    {r.teste && <Chip>teste</Chip>}
                  </div>
                  <div className="rec-pessoa-dados">
                    <span><Mail size={12} /> {r.email}</span>
                    {r.telefone && (
                      <a href={`https://wa.me/${r.telefone}`} target="_blank" rel="noopener noreferrer">
                        <Phone size={12} /> {telefoneBonito(r.telefone)}
                      </a>
                    )}
                    <span><Tag size={12} /> {nomeFluxo(r.fluxo)} · {motivo(r.evento)}</span>
                    {r.produto_nome && <span><ShoppingBag size={12} /> {r.produto_nome}</span>}
                    {r.origem && <span><MapPin size={12} /> veio de {r.origem}</span>}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {r.telefone && r.resposta && r.status !== 'bloqueado' && (
                    <Btn size="xs" variant="primary" icon={MessageCircle}
                      onClick={() => window.open(`https://wa.me/${r.telefone}`, '_blank', 'noopener')}>Responder</Btn>
                  )}
                  {r.status === 'ativo' && (
                    <Btn size="xs" variant="ghost" icon={Hand} onClick={() => parar(r)}>Parar</Btn>
                  )}
                </div>
              </div>

              <div className="rec-trilha">
                <Passo ico={LogIn} estado="inicio" titulo="Entrou" sub={quandoCurto(r.criado_em)} />
                {passos.map((p) => (
                  <React.Fragment key={p.titulo}>
                    <Passo {...p} />
                    {p.clicou && <Passo ico={MousePointerClick} estado="ok" titulo="Clicou no link" sub={quandoCurto(p.clicou)} />}
                  </React.Fragment>
                ))}
                {fim && (
                  <Passo
                    ico={fim.ico}
                    estado={fim.tom}
                    titulo={r.status === 'recuperado' && r.valor_recuperado ? `Comprou ${reais(r.valor_recuperado)}` : fim.titulo}
                    sub={[fim.sub, quandoCurto(r.status === 'respondeu' ? r.respondeu_em : r.fechado_em)].filter(Boolean).join(' · ')}
                  />
                )}
              </div>

              {r.resposta && <p className="rec-resposta">“{r.resposta}”</p>}

              {falhas.map((p) => (
                <p key={p.titulo} className="rec-falha">
                  <X size={12} /> {p.titulo} não saiu: {String(p.erro).replace(/\s+/g, ' ').slice(0, 160)}
                </p>
              ))}
            </Card>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------
   OS AJUSTES
   ------------------------------------------------------------ */
function Ajustes({ ajuste, setAjuste, destinos, setDestinos, bloqueios, setBloqueios }) {
  const toast = useToast();
  const [cupom, setCupom] = useState(ajuste.cupom || '');
  const [limite, setLimite] = useState(String(ajuste.limite_dia ?? 80));
  const [novo, setNovo] = useState({ nome: '', telefone: '' });

  async function salvar(mudanca, aviso = 'Salvo') {
    const { data, error } = await supabase.from('recuperacao_ajuste').update(mudanca).eq('id', 1).select('*');
    if (error || !data?.length) { toast('Não consegui salvar', 'err'); return; }
    setAjuste(data[0]);
    toast(aviso);
  }

  async function mudarDestino(d, mudanca) {
    const { data, error } = await supabase.from('aviso_destino').update(mudanca).eq('id', d.id).select('*');
    if (error || !data?.length) { toast('Não consegui salvar', 'err'); return; }
    setDestinos(destinos.map((x) => (x.id === d.id ? data[0] : x)));
  }

  async function criarDestino() {
    let t = novo.telefone.replace(/\D/g, '');
    if (t.length === 10 || t.length === 11) t = `55${t}`;
    if (!(t.length === 12 || t.length === 13) || !t.startsWith('55')) { toast('Use DDD + número', 'err'); return; }
    const { data, error } = await supabase.from('aviso_destino')
      .insert({ nome: novo.nome.trim() || 'Sem nome', telefone: t }).select('*');
    if (error || !data?.length) { toast('Não consegui adicionar', 'err'); return; }
    setDestinos([...destinos, data[0]]);
    setNovo({ nome: '', telefone: '' });
    toast('Número adicionado');
  }

  async function removerDestino(d) {
    const { error } = await supabase.from('aviso_destino').delete().eq('id', d.id);
    if (error) { toast('Não consegui remover', 'err'); return; }
    setDestinos(destinos.filter((x) => x.id !== d.id));
  }

  async function desbloquear(b) {
    const { error } = await supabase.from('recuperacao_bloqueio').delete().eq('chave', b.chave);
    if (error) { toast('Não consegui desbloquear', 'err'); return; }
    setBloqueios(bloqueios.filter((x) => x.chave !== b.chave));
    toast('Desbloqueado. Só faça isso se a pessoa pediu pra voltar a receber.');
  }

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">quem fica sabendo na hora</div>
            <h2 className="h-sec row" style={{ gap: 8 }}><Bell size={16} /> Avisos no WhatsApp</h2>
          </div>
        </div>
        <p className="micro muted" style={{ marginBottom: 12, lineHeight: 1.65 }}>
          <b>Lead quente</b>: alguém respondeu a recuperação, com o que a pessoa escreveu. <b>Alarme</b>: o n8n parou,
          mensagens falhando ou chegou venda de produto que o painel não conhece. <b>Venda</b>: cada venda nova, com a origem.
        </p>
        <div className="col">
          {destinos.map((d) => (
            <div key={d.id} className="rec-linha" style={{ opacity: d.ativo ? 1 : 0.6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tiny" style={{ fontWeight: 600 }}>{d.nome}</div>
                <div className="micro muted">{telefoneBonito(d.telefone)}</div>
                <div className="row wrap" style={{ gap: 5, marginTop: 8 }}>
                  {[['leads', 'Lead quente'], ['alarmes', 'Alarme'], ['vendas', 'Venda']].map(([k, nome]) => (
                    <button key={k} type="button" className={`chip ${d[k] ? 'on' : ''}`} style={{ minHeight: 28, fontSize: 11 }}
                      onClick={() => mudarDestino(d, { [k]: !d[k] })}>
                      {d[k] ? <Check size={10} /> : null} {nome}
                    </button>
                  ))}
                </div>
              </div>
              <Switch on={d.ativo} onChange={(v) => mudarDestino(d, { ativo: v })} />
              <button type="button" className="btn ghost xs" onClick={() => removerDestino(d)} aria-label="Remover">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          <div style={{ flex: '1 1 140px' }}>
            <Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome (ex.: sócio)" />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <Input value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} placeholder="75 99999-9999" inputMode="tel" />
          </div>
          <Btn size="sm" icon={Plus} onClick={criarDestino} disabled={novo.telefone.replace(/\D/g, '').length < 10}>Adicionar</Btn>
        </div>
      </Card>

      <div className="rec-duas">
        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">entra no lugar de {'{cupom}'}</div>
              <h2 className="h-sec row" style={{ gap: 8 }}><Ticket size={16} /> Cupom</h2>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Input value={cupom} onChange={(e) => setCupom(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="VOLTA10" />
            <Btn size="sm" variant={cupom !== (ajuste.cupom || '') ? 'primary' : 'ghost'} icon={Check}
              disabled={cupom === (ajuste.cupom || '')} onClick={() => salvar({ cupom: cupom || null }, cupom ? 'Cupom salvo' : 'Cupom removido')}>
              Salvar
            </Btn>
          </div>
          <p className="micro muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
            Crie o cupom na Hotmart antes. Na mensagem que tiver {'{cupom}'}, o link já abre o checkout com o desconto
            aplicado. Nas outras mensagens o link vai sem desconto.
          </p>
        </Card>

        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">protege o número de banimento</div>
              <h2 className="h-sec row" style={{ gap: 8 }}><Gauge size={16} /> Freios</h2>
            </div>
          </div>
          <Field label="No máximo, mensagens de recuperação por dia">
            <div className="row" style={{ gap: 8 }}>
              <Input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} min={1} max={1000} />
              <Btn size="sm" variant={Number(limite) !== ajuste.limite_dia ? 'primary' : 'ghost'} icon={Check}
                disabled={!(Number(limite) >= 1) || Number(limite) === ajuste.limite_dia}
                onClick={() => salvar({ limite_dia: Math.round(Number(limite)) })}>
                Salvar
              </Btn>
            </div>
          </Field>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <Switch on={ajuste.encurtar} onChange={(v) => salvar({ encurtar: v }, v ? 'Links curtos ligados' : 'Links vão direto pra Hotmart')}
              label="Link curto que conta clique" />
          </div>
          <p className="micro muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
            Número novo ou pouco usado aguenta menos. Os avisos pra você não entram nessa conta.
          </p>
        </Card>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">horário de Brasília</div>
            <h2 className="h-sec row" style={{ gap: 8 }}><Clock size={16} /> Quando pode mandar</h2>
          </div>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="A partir de">
            <Select value={ajuste.hora_inicio} onChange={(ev) => salvar({ hora_inicio: Number(ev.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}h</option>)}
            </Select>
          </Field>
          <Field label="Até">
            <Select value={ajuste.hora_fim} onChange={(ev) => salvar({ hora_fim: Number(ev.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{h}h</option>)}
            </Select>
          </Field>
        </div>
        <p className="micro muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
          Fora desse horário a fila espera e sai no começo do próximo. Entre uma mensagem e outra da mesma
          pessoa passam pelo menos 3 horas.
        </p>
      </Card>

      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">nunca mais recebem nada</div>
            <h2 className="h-sec row" style={{ gap: 8 }}><Ban size={16} /> Pediram pra sair</h2>
          </div>
          <Chip>{bloqueios.length}</Chip>
        </div>
        {bloqueios.length === 0 ? (
          <p className="micro muted" style={{ lineHeight: 1.6 }}>
            Quem responder “sair”, “parar”, “não quero” ou parecido entra aqui na hora, recebe uma confirmação e não
            recebe mais mensagem nenhuma.
          </p>
        ) : (
          <div className="col">
            {bloqueios.map((b) => (
              <div key={b.chave} className="rec-linha">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tiny">{telefoneBonito(b.telefone) || b.chave}</div>
                  <div className="micro muted truncate">{haQuanto(b.criado_em)} · {b.motivo}</div>
                </div>
                <Btn size="xs" variant="ghost" onClick={() => desbloquear(b)}>Desbloquear</Btn>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
