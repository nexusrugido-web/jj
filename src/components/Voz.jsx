import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, Square, Check, Loader, TriangleAlert, RotateCcw, Sparkles, X, ShieldAlert,
} from 'lucide-react';
import { Btn, Chip, Sheet, useToast, Select, Field, Input } from './UI';
import { pontosPorId } from '../db/scoring';
import { cabecalhoIA } from '../lib/ai';
import { MAX_SEGUNDOS, formatoDeGravacao, dicaDaTranscricao } from '../lib/voz';
import { avaliarTecnica, FONTE_DA_REGRA } from '../lib/regras';

/* ============================================================
   FALAR EM VEZ DE DIGITAR

   Sair do treino às dez da noite e ter que digitar é o motivo
   número um de ninguém registrar nada. Aqui você fala do jeito
   que falaria pro parceiro, e o app monta.

   1. O app grava o áudio (com cronômetro e o medidor de voz, pra
      pessoa ver que está sendo ouvida) e o Whisper transcreve. O
      reconhecimento do navegador ficou pra trás: no Android ele
      parava sozinho no silêncio e repetia a frase a cada pedaço.
   2. Cada gravação soma no texto: dá pra gravar, parar, lembrar
      de mais uma coisa e gravar de novo. Se a internet cair, o
      áudio fica guardado e "Tentar de novo" manda outra vez.
   3. Antes de salvar você vê o que o app entendeu (tipo, professor,
      academia, técnicas, cada rola) e corrige. Nome que não está
      cadastrado vira cadastro novo.
   ============================================================ */

export const temVoz = () =>
  typeof window !== 'undefined' && !!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);

const EXEMPLOS = [
  'Treinei com o professor Felipe na academia e rolei com o Ismael. Ganhei uma queda, passei a guarda, cheguei na montada, tomei uma raspagem e fui finalizado com um armlock.',
  'Hoje a aula foi de raspagem de gancho. Depois dois rolas com o Marcão. Bati de mata-leão no primeiro e no segundo ele me passou duas vezes.',
  'Open mat de uma hora e meia. Quatro rolas, sem finalização, mas fiz duas quedas e passei uma guarda.',
];

const TIPOS_VOZ = [
  { id: 'gi', nome: 'Gi' }, { id: 'nogi', nome: 'No-Gi' }, { id: 'drill', nome: 'Drill' },
  { id: 'openmat', nome: 'Open mat' }, { id: 'privada', nome: 'Aula privada' }, { id: 'competicao', nome: 'Competição' },
];

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const paraBase64 = (blob) => new Promise((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = () => falha(r.error);
  r.readAsDataURL(blob);
});

/* a resposta de erro do servidor, em frase que a pessoa entende */
const erroDaResposta = (status, corpo) => (
  status === 401 ? 'Entre na sua conta pra registrar falando.'
    : status === 402 ? 'Registrar falando é do Premium.'
      : status === 429 ? 'Muita gravação seguida. Espera um minuto e tenta de novo.'
        : status === 413 ? corpo?.erro
          : 'A transcrição falhou. O áudio ficou guardado: tente de novo.'
);

export default function Voz({
  aberto, onClose, onPronto,
  techniques = [], finalizacoes = [], partners = [], academies = [], professors = [],
  regra = {},
}) {
  const toast = useToast();
  const [estado, setEstado] = useState('parado'); // parado | gravando | transcrevendo
  const [segundos, setSegundos] = useState(0);
  const [texto, setTexto] = useState('');
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [pendente, setPendente] = useState(false); // tem áudio guardado pra tentar de novo
  const [resumo, setResumo] = useState(null);
  const [exemplo] = useState(() => EXEMPLOS[Math.floor(Math.random() * EXEMPLOS.length)]);

  const grav = useRef(null);      // o que está gravando agora
  const ultimo = useRef(null);    // o último áudio, até transcrever
  const micRef = useRef(null);    // o botão, que cresce com a voz

  /* fechou: para tudo e descarta o que não virou texto */
  useEffect(() => {
    if (!aberto) {
      soltar(true);
      setTexto(''); setErro(''); setResumo(null); setPendente(false); setEstado('parado'); setSegundos(0);
      ultimo.current = null;
    }
  }, [aberto]);
  useEffect(() => () => soltar(true), []);

  function soltar(descartar = false) {
    const g = grav.current;
    if (!g) return;
    grav.current = null;
    g.descartar = descartar;
    clearInterval(g.timer);
    cancelAnimationFrame(g.raf);
    try { if (g.rec.state !== 'inactive') g.rec.stop(); } catch { /* já parou */ }
    g.stream.getTracks().forEach((t) => t.stop());
    g.ctx?.close?.().catch(() => {});
  }

  async function comecar() {
    setErro('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (e) {
      setErro(e?.name === 'NotAllowedError'
        ? 'O microfone está bloqueado. Libere nas permissões do navegador (o cadeado ao lado do endereço) e toque de novo.'
        : e?.name === 'NotFoundError' ? 'Não achei microfone neste aparelho.' : 'Não consegui abrir o microfone. Feche outro app que esteja usando ele e tente de novo.');
      return;
    }

    const formato = formatoDeGravacao(window.MediaRecorder);
    let rec;
    try {
      rec = new MediaRecorder(stream, { ...(formato.mime ? { mimeType: formato.mime } : {}), audioBitsPerSecond: 32000 });
    } catch {
      rec = new MediaRecorder(stream);
    }
    const pedacos = [];
    const g = { rec, stream, timer: 0, raf: 0, ctx: null, descartar: false };
    rec.ondataavailable = (e) => { if (e.data?.size) pedacos.push(e.data); };
    rec.onstop = () => {
      if (g.descartar) return;
      const tipo = rec.mimeType || formato.mime || 'audio/mp4';
      ultimo.current = { blob: new Blob(pedacos, { type: tipo }), ext: /mp4|m4a|aac/.test(tipo) ? 'mp4' : /ogg/.test(tipo) ? 'ogg' : 'webm' };
      transcrever();
    };

    /* o medidor: o botão cresce com o volume da voz */
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      try {
        g.ctx = new Ctx();
        const an = g.ctx.createAnalyser();
        an.fftSize = 512;
        g.ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.fftSize);
        const loop = () => {
          an.getByteTimeDomainData(buf);
          let soma = 0;
          for (const v of buf) { const x = (v - 128) / 128; soma += x * x; }
          micRef.current?.style.setProperty('--nivel', String(Math.min(1, Math.sqrt(soma / buf.length) * 5)));
          g.raf = requestAnimationFrame(loop);
        };
        loop();
      } catch { /* sem medidor, grava igual */ }
    }

    const inicio = Date.now();
    setSegundos(0);
    g.timer = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(s);
      if (s >= MAX_SEGUNDOS) { toast(`Chegou em ${MAX_SEGUNDOS / 60} minutos. Vou escrever o que você falou, e dá pra gravar mais depois.`); parar(); }
    }, 250);

    grav.current = g;
    /* pedaços de 1 segundo: com o áudio num bloco só, o Whisper
       corta a gravação do iPhone depois das primeiras palavras */
    rec.start(1000);
    setEstado('gravando');
  }

  function parar() {
    soltar(false);
    micRef.current?.style.setProperty('--nivel', '0');
  }

  async function transcrever() {
    const a = ultimo.current;
    if (!a) return;
    if (a.blob.size < 1500) {
      ultimo.current = null;
      setEstado('parado');
      setErro('A gravação ficou curta demais. Segure a fala por uns segundos e toque em parar.');
      return;
    }
    setEstado('transcrevendo');
    setErro('');
    try {
      const resposta = await fetch('/api/ia', {
        method: 'POST',
        headers: await cabecalhoIA(),
        body: JSON.stringify({
          acao: 'transcrever',
          audio: await paraBase64(a.blob),
          tipo: a.blob.type,
          ext: a.ext,
          dica: dicaDaTranscricao({
            professores: professors.map((p) => p.nome),
            academias: academies.map((x) => x.nome),
            parceiros: [...partners].sort((x, y) => (y.criadoEm || 0) - (x.criadoEm || 0)).map((p) => p.nome),
          }),
        }),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        setErro(erroDaResposta(resposta.status, corpo));
        setPendente(resposta.status !== 402 && resposta.status !== 401);
        if (resposta.status === 402 || resposta.status === 401) ultimo.current = null;
        return;
      }
      ultimo.current = null;
      setPendente(false);
      const novo = String(corpo.texto || '').trim();
      if (!novo) { setErro('Não deu pra entender nada nessa gravação. Fale um pouco mais perto do celular.'); return; }
      setTexto((t) => (t.trim() ? `${t.trim()} ${novo}` : novo));
    } catch {
      setErro('Sem internet agora. O áudio ficou guardado: tente de novo quando voltar.');
      setPendente(true);
    } finally {
      setEstado('parado');
    }
  }

  async function interpretar() {
    const falado = texto.trim();
    if (falado.length < 10) { setErro('Fale um pouco mais, não deu pra entender.'); return; }
    setLendo(true);
    setErro('');
    try {
      const resposta = await fetch('/api/ia', {
        method: 'POST',
        headers: await cabecalhoIA(),
        body: JSON.stringify({
          acao: 'ler_treino',
          texto: falado,
          tecnicas: techniques.map((x) => x.nome),
          finalizacoes,
          parceiros: partners.map((p) => p.nome),
          academias: academies.map((a) => a.nome),
          professores: professors.map((p) => p.nome),
        }),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (resposta.status === 402 || resposta.status === 401) { setErro(erroDaResposta(resposta.status, corpo)); return; }
      if (!resposta.ok || !corpo?.dados) throw new Error('falhou');
      setResumo(corpo.dados);
    } catch {
      /* sem IA, o que você falou vai pra anotação e você completa */
      onPronto({ nota: falado }, falado);
      toast('Guardei o que você falou na anotação');
      onClose();
    } finally {
      setLendo(false);
    }
  }

  function fechar() { soltar(true); onClose(); }

  /* ---------- a tela de conferência ---------- */
  if (resumo) {
    return (
      <Conferir
        resumo={resumo}
        falado={texto}
        partners={partners}
        academies={academies}
        professors={professors}
        regra={regra}
        onVoltar={() => setResumo(null)}
        onConfirmar={(final) => { onPronto(final, texto); onClose(); }}
        onClose={() => { setResumo(null); onClose(); }}
      />
    );
  }

  const gravando = estado === 'gravando';
  const transcrevendo = estado === 'transcrevendo';

  return (
    <Sheet
      aberto={aberto}
      onClose={fechar}
      titulo="Conte como foi o treino"
      wide
      footer={
        <>
          <Btn variant="ghost" onClick={fechar}>Cancelar</Btn>
          <Btn variant="primary" icon={lendo ? Loader : Sparkles} onClick={interpretar}
            disabled={texto.trim().length < 10 || lendo || gravando || transcrevendo}>
            {lendo ? 'Entendendo' : 'Montar treino'}
          </Btn>
        </>
      }
    >
      {!temVoz() ? (
        <div className="valida atencao">
          <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.65 }}>
            Este navegador não grava áudio. Atualize o navegador do celular, ou digite aqui embaixo do mesmo jeito.
          </p>
        </div>
      ) : (
        <div className="col center" style={{ alignItems: 'center', gap: 12 }}>
          <button
            ref={micRef}
            type="button"
            className={`mic ${gravando ? 'ouvindo' : ''}`}
            onClick={() => (gravando ? parar() : comecar())}
            disabled={transcrevendo || lendo}
            aria-label={gravando ? 'Parar de gravar' : 'Gravar'}
          >
            {transcrevendo ? <Loader size={26} className="gira" /> : gravando ? <Square size={24} fill="currentColor" /> : <Mic size={26} />}
          </button>
          <div className="center">
            <div className="tiny" style={{ fontWeight: 600 }}>
              {gravando ? <>Gravando <span className="num">{mmss(segundos)}</span></>
                : transcrevendo ? 'Escrevendo o que você falou'
                  : texto ? 'Toque pra gravar mais' : 'Toque pra falar'}
            </div>
            <p className="micro muted" style={{ marginTop: 4, maxWidth: 320, lineHeight: 1.6 }}>
              {gravando
                ? 'Fale normal, do jeito que você contaria pro parceiro. Toque no quadrado quando acabar.'
                : transcrevendo ? 'Leva uns segundos.'
                  : 'Diga o tipo de treino, o professor, com quem rolou e o que aconteceu em cada rola.'}
            </p>
          </div>
        </div>
      )}

      <div className="voz-caixa">
        <textarea
          className="input"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={exemplo}
          disabled={transcrevendo}
          style={{ minHeight: 130, lineHeight: 1.65, resize: 'vertical' }}
        />
        {texto && !gravando && !transcrevendo && (
          <button className="btn ghost xs" onClick={() => setTexto('')} style={{ marginTop: 8 }}>
            <RotateCcw size={12} /> Limpar
          </button>
        )}
      </div>

      {erro && (
        <div className="valida ruim">
          <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--blood)' }} />
          <div className="col" style={{ gap: 8 }}>
            <p className="micro muted" style={{ lineHeight: 1.6 }}>{erro}</p>
            {pendente && ultimo.current && !transcrevendo && (
              <Btn size="sm" variant="contorno" icon={RotateCcw} onClick={transcrever} style={{ alignSelf: 'flex-start' }}>Tentar de novo</Btn>
            )}
          </div>
        </div>
      )}

      {!texto && !gravando && !transcrevendo && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>pode falar assim</div>
          <p className="tiny muted" style={{ lineHeight: 1.7, fontStyle: 'italic' }}>"{exemplo}"</p>
        </div>
      )}
    </Sheet>
  );
}

/* ============================================================
   CONFERIR ANTES DE SALVAR
   O app mostra o que entendeu, separado por item, e você
   corrige o que estiver errado. Cada tipo de treino mostra só o
   que é dele (open mat sem professor, competição com adversário
   pelo nome, drill sem rola).
   ============================================================ */
function Conferir({ resumo, falado, partners, academies, professors, regra, onVoltar, onConfirmar, onClose }) {
  const tipoValido = TIPOS_VOZ.some((t) => t.id === resumo.tipo) ? resumo.tipo : 'gi';
  const [d, setD] = useState(() => ({
    duracao: Number(resumo.duracao) || 60,
    tipo: tipoValido,
    academia: resumo.academia || '',
    professor: resumo.professor || '',
    evento: resumo.evento || '',
    colocacao: resumo.colocacao || '',
    tecnicas: (resumo.tecnicas || []).filter((t) => t?.nome),
    nota: resumo.nota || falado,
    rolas: (resumo.rolas || []).map((r) => ({ ...r })),
  }));

  const alterarRola = (i, patch) =>
    setD({ ...d, rolas: d.rolas.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const tirarRola = (i) => setD({ ...d, rolas: d.rolas.filter((_, k) => k !== i) });

  const nomePonto = (p) => pontosPorId[p]?.nome || p;
  const competicao = d.tipo === 'competicao';
  const semProfessor = competicao || d.tipo === 'openmat';
  const semRola = d.tipo === 'drill';
  const modalidade = d.tipo === 'nogi' ? 'nogi' : 'gi';
  const foraDaRegra = (nome) => !(regra.liberadas || []).includes(nome)
    && avaliarTecnica(nome, { faixa: regra.faixa, idade: regra.idade, modalidade }) != null;

  return (
    <Sheet
      aberto
      onClose={onClose}
      titulo="Confira antes de salvar"
      subtitulo="corrija o que não bateu"
      wide
      footer={
        <>
          <Btn variant="ghost" onClick={onVoltar}>Falar de novo</Btn>
          <Btn variant="primary" icon={Check} onClick={() => onConfirmar({ ...d, rolas: semRola ? [] : d.rolas })}>Está certo</Btn>
        </>
      }
    >
      <div className="conf-bloco">
        <div className="eyebrow">o treino</div>
        <div className="grid g2" style={{ gap: 10, marginTop: 10 }}>
          <Field label="Tipo">
            <Select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>
              {TIPOS_VOZ.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Select>
          </Field>
          <Field label="Duração">
            <Select value={String(d.duracao)} onChange={(e) => setD({ ...d, duracao: Number(e.target.value) })}>
              {[...new Set([30, 45, 60, 75, 90, 120, 150, 180, d.duracao])].sort((a, b) => a - b)
                .map((m) => <option key={m} value={m}>{m} min</option>)}
            </Select>
          </Field>
        </div>
        {competicao ? (
          <Field label="Campeonato">
            <Input value={d.evento} onChange={(e) => setD({ ...d, evento: e.target.value })} placeholder="Nome do campeonato" />
          </Field>
        ) : (
          <div className="grid g2" style={{ gap: 10 }}>
            {!semProfessor && (
              <Field label="Professor">
                <Select value={d.professor} onChange={(e) => setD({ ...d, professor: e.target.value })}>
                  <option value="">Nenhum</option>
                  {professors.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  {d.professor && !professors.some((p) => p.nome === d.professor) && (
                    <option value={d.professor}>{d.professor} (novo)</option>
                  )}
                </Select>
              </Field>
            )}
            <Field label="Academia">
              <Select value={d.academia} onChange={(e) => setD({ ...d, academia: e.target.value })}>
                <option value="">Nenhuma</option>
                {academies.map((a) => <option key={a.id} value={a.nome}>{a.nome}</option>)}
                {d.academia && !academies.some((a) => a.nome === d.academia) && (
                  <option value={d.academia}>{d.academia} (nova)</option>
                )}
              </Select>
            </Field>
          </div>
        )}
        {d.tecnicas.length > 0 && !competicao && (
          <Field label={d.tipo === 'drill' ? 'O que você drillou' : 'Técnicas da aula'}>
            <div className="row wrap" style={{ gap: 6 }}>
              {d.tecnicas.map((t, k) => (
                <button key={k} type="button" className="chip on"
                  onClick={() => setD({ ...d, tecnicas: d.tecnicas.filter((_, j) => j !== k) })}>
                  {t.nome}{Number(t.reps) > 0 ? ` · ${t.reps}x` : ''} <X size={11} />
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>

      {semRola ? (
        d.rolas.length > 0 && (
          <div className="valida atencao">
            <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
            <p className="micro muted" style={{ lineHeight: 1.65 }}>
              Drill não tem rola. Se teve rola, troque o tipo pra Gi ou No-Gi e eles voltam.
            </p>
          </div>
        )
      ) : d.rolas.length > 0 ? (
        <div className="conf-bloco">
          <div className="eyebrow">
            {competicao ? (d.rolas.length === 1 ? 'a luta' : `as ${d.rolas.length} lutas`) : d.rolas.length === 1 ? 'o rola' : `os ${d.rolas.length} rolas`}
          </div>
          <div className="col" style={{ gap: 11, marginTop: 10 }}>
            {d.rolas.map((r, i) => (
              <div key={i} className="card" style={{ background: 'var(--void)', padding: 13 }}>
                <div className="row" style={{ gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  <span className="num micro muted">#{i + 1}</span>
                  {competicao ? (
                    <Input value={r.parceiro || ''} onChange={(e) => alterarRola(i, { parceiro: e.target.value })}
                      placeholder="Adversário" style={{ flex: 1, minWidth: 0 }} />
                  ) : (
                    <Select
                      value={r.parceiro || ''}
                      onChange={(e) => alterarRola(i, { parceiro: e.target.value })}
                      style={{ flex: 1, minWidth: 0, minHeight: 38 }}
                    >
                      <option value="">Sem parceiro</option>
                      {partners.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                      {r.parceiro && !partners.some((p) => p.nome === r.parceiro) && (
                        <option value={r.parceiro}>{r.parceiro} (novo)</option>
                      )}
                    </Select>
                  )}
                  <button type="button" className="btn ghost icon sm" onClick={() => tirarRola(i)}
                    aria-label={competicao ? 'Tirar esta luta' : 'Tirar este rola'}>
                    <X size={14} />
                  </button>
                </div>

                <div className="col" style={{ gap: 8 }}>
                  <LinhaEvento
                    titulo="Você fez"
                    itens={[
                      ...(r.ptsMeus || []).map((p) => ({ txt: nomePonto(p), tom: 'jade' })),
                      ...(Number(r.vantMinhas) > 0 ? [{ txt: `${r.vantMinhas} ${Number(r.vantMinhas) === 1 ? 'vantagem' : 'vantagens'}`, tom: 'jade' }] : []),
                      ...(r.subsAplicadas || []).map((s) => ({ txt: `finalizou com ${s}`, tom: 'jade', regra: foraDaRegra(s) })),
                    ]}
                    vazio="nada marcado"
                  />
                  <LinhaEvento
                    titulo="Você sofreu"
                    itens={[
                      ...(r.ptsDele || []).map((p) => ({ txt: nomePonto(p), tom: 'blood' })),
                      ...(Number(r.vantDele) > 0 ? [{ txt: `${r.vantDele} ${Number(r.vantDele) === 1 ? 'vantagem' : 'vantagens'}`, tom: 'blood' }] : []),
                      ...(r.subsSofridas || []).map((s) => ({ txt: `bateu de ${s}`, tom: 'blood' })),
                    ]}
                    vazio="nada marcado"
                  />
                </div>
              </div>
            ))}
          </div>
          {d.rolas.some((r) => (r.subsAplicadas || []).some(foraDaRegra)) && (
            <p className="micro muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
              <ShieldAlert size={11} style={{ color: 'var(--roar)', verticalAlign: -1 }} /> Pela regra da {FONTE_DA_REGRA}, essa finalização não é permitida
              {competicao ? ' em campeonato' : ' na sua faixa ou idade'}. Se o professor liberou, pode salvar assim mesmo.
            </p>
          )}
        </div>
      ) : (
        <div className="valida atencao">
          <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.65 }}>
            {competicao ? 'Não identifiquei nenhuma luta' : 'Não identifiquei nenhum rola'} no que você falou. Dá pra confirmar assim mesmo e adicionar depois,
            ou voltar e contar como foi.
          </p>
        </div>
      )}

      <div className="conf-bloco">
        <div className="eyebrow">sua anotação</div>
        <textarea
          className="input"
          value={d.nota}
          onChange={(e) => setD({ ...d, nota: e.target.value })}
          style={{ minHeight: 90, marginTop: 8, lineHeight: 1.6 }}
        />
      </div>
    </Sheet>
  );
}

function LinhaEvento({ titulo, itens, vazio }) {
  return (
    <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
      <span className="micro muted" style={{ minWidth: 82, paddingTop: 4 }}>{titulo}</span>
      <div className="row wrap" style={{ gap: 5, flex: 1 }}>
        {itens.length
          ? itens.map((x, k) => (
            <Chip key={k} tone={x.tom}>
              {x.regra && <ShieldAlert size={11} style={{ verticalAlign: -1, marginRight: 3 }} />}{x.txt}
            </Chip>
          ))
          : <span className="micro" style={{ color: 'var(--dimmer)', paddingTop: 4 }}>{vazio}</span>}
      </div>
    </div>
  );
}
