import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Mic, MicOff, Check, X, Loader, TriangleAlert, RotateCcw, Pencil, Sparkles,
} from 'lucide-react';
import { Card, Btn, Chip, Sheet, useToast, Select, Field } from './UI';
import { pontosPorId } from '../db/scoring';

/* ============================================================
   FALAR EM VEZ DE DIGITAR

   Sair do treino às dez da noite e ter que digitar é o motivo
   número um de ninguém registrar nada. Aqui você fala do jeito
   que falaria pro parceiro, e o app monta.

   Duas coisas importantes acontecem aqui:

   1. A transcrição nunca repete. O navegador reentrega trechos
      já fechados, então o texto é sempre relido do começo em
      vez de ser somado, senão vira "treinei treinei com o
      treinei com o professor".

   2. Antes de salvar você vê um resumo do que o app entendeu,
      com professor, academia, parceiro e cada evento separado.
      Aí confirma ou corrige.
   ============================================================ */

export const temVoz = () =>
  typeof window !== 'undefined' &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition);

const EXEMPLOS = [
  'Treinei com o professor Felipe na academia e rolei com o Ismael. Ganhei uma queda, passei a guarda, cheguei na montada, tomei uma raspagem e fui finalizado com um armlock.',
  'Hoje foi drill de passagem, uma hora. Depois dois rolas com o Marcão. Bati de mata-leão no primeiro e no segundo ele me passou duas vezes.',
  'Open mat de uma hora e meia. Quatro rolas, sem finalização, mas fiz duas quedas e passei uma guarda.',
];

/* ---------- limpa a repetição que o navegador produz ---------- */
function limparRepeticao(txt) {
  const palavras = String(txt).trim().split(/\s+/);
  const saida = [];

  for (let i = 0; i < palavras.length; i++) {
    /* se os próximos N já apareceram como os últimos N, é eco */
    let pulou = false;
    for (let n = Math.min(8, palavras.length - i); n >= 2; n--) {
      const bloco = palavras.slice(i, i + n).join(' ').toLowerCase();
      const anterior = saida.slice(-n).join(' ').toLowerCase();
      if (bloco && bloco === anterior) { i += n - 1; pulou = true; break; }
    }
    if (!pulou) saida.push(palavras[i]);
  }

  /* palavra repetida coladinha também é eco */
  return saida
    .filter((p, i) => i === 0 || p.toLowerCase() !== saida[i - 1].toLowerCase())
    .join(' ');
}

export default function Voz({
  aberto, onClose, onPronto,
  techniques = [], partners = [], academies = [], professors = [],
}) {
  const toast = useToast();
  const [ouvindo, setOuvindo] = useState(false);
  const [texto, setTexto] = useState('');
  const [parcial, setParcial] = useState('');
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [resumo, setResumo] = useState(null);
  const [exemplo] = useState(() => EXEMPLOS[Math.floor(Math.random() * EXEMPLOS.length)]);

  const rec = useRef(null);
  const base = useRef('');

  useEffect(() => {
    if (!aberto) {
      parar();
      setTexto(''); setParcial(''); setErro(''); setResumo(null);
      base.current = '';
    }
  }, [aberto]);

  function comecar() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErro('Seu navegador não escuta. No celular, tente pelo Chrome.'); return; }

    const r = new SR();
    r.lang = 'pt-BR';
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e) => {
      /* relê tudo do começo em vez de somar. Somar é o que faz
         o texto virar "treinei treinei com o treinei com o". */
      let fechado = '';
      let emCurso = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fechado += t + ' ';
        else emCurso += t;
      }
      setTexto(limparRepeticao((base.current + ' ' + fechado).trim()));
      setParcial(emCurso.trim());
    };

    r.onerror = (e) => {
      if (e.error === 'not-allowed') setErro('Precisa liberar o microfone pro navegador.');
      else if (e.error === 'no-speech') setErro('Não ouvi nada. Fale mais perto do aparelho.');
      else if (e.error === 'aborted') { /* parada normal */ }
      else setErro('A escuta falhou. Dá pra digitar aqui embaixo também.');
      setOuvindo(false);
    };

    r.onend = () => { setOuvindo(false); setParcial(''); };

    rec.current = r;
    setErro('');
    setOuvindo(true);
    try { r.start(); } catch { setOuvindo(false); }
  }

  function parar() {
    /* guarda o que já foi dito, pra continuar de onde parou */
    base.current = texto;
    try { rec.current?.stop(); } catch { /* já parou */ }
    rec.current = null;
    setOuvindo(false);
  }

  const completo = useMemo(
    () => limparRepeticao(`${texto} ${parcial}`.trim()),
    [texto, parcial]
  );

  async function interpretar() {
    if (completo.length < 10) { setErro('Fale um pouco mais, não deu pra entender.'); return; }

    parar();
    setLendo(true);
    setErro('');

    try {
      const resposta = await fetch('/api/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'ler_treino',
          texto: completo,
          tecnicas: techniques.slice(0, 400).map((x) => x.nome),
          parceiros: partners.map((p) => p.nome),
          academias: academies.map((a) => a.nome),
          professores: professors.map((p) => p.nome),
        }),
      });

      if (!resposta.ok) throw new Error('falhou');
      const corpo = await resposta.json();
      if (!corpo?.dados) throw new Error('a IA não devolveu o treino');
      setResumo(corpo.dados);
    } catch {
      /* sem IA, o que você falou vai pra anotação e você completa */
      onPronto({ nota: completo }, completo);
      toast('Guardei o que você falou na anotação');
      onClose();
    } finally {
      setLendo(false);
    }
  }

  /* ---------- a tela de conferência ---------- */
  if (resumo) {
    return (
      <Conferir
        resumo={resumo}
        falado={completo}
        partners={partners}
        academies={academies}
        professors={professors}
        onVoltar={() => setResumo(null)}
        onConfirmar={(final) => { onPronto(final, completo); onClose(); }}
        onClose={() => { setResumo(null); onClose(); }}
      />
    );
  }

  return (
    <Sheet
      aberto={aberto}
      onClose={() => { parar(); onClose(); }}
      titulo="Conte como foi o treino"
      wide
      footer={
        <>
          <Btn variant="ghost" onClick={() => { parar(); onClose(); }}>Cancelar</Btn>
          <Btn variant="primary" icon={lendo ? Loader : Sparkles} onClick={interpretar} disabled={completo.length < 10 || lendo}>
            {lendo ? 'Entendendo' : 'Montar treino'}
          </Btn>
        </>
      }
    >
      {!temVoz() ? (
        <div className="valida atencao">
          <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.65 }}>
            Seu navegador não escuta. No celular funciona no Chrome, e no computador no Chrome ou no Edge.
            Dá pra digitar aqui embaixo do mesmo jeito.
          </p>
        </div>
      ) : (
        <div className="col center" style={{ alignItems: 'center', gap: 14 }}>
          <button
            className={`mic ${ouvindo ? 'ouvindo' : ''}`}
            onClick={() => (ouvindo ? parar() : comecar())}
            disabled={lendo}
          >
            {ouvindo ? <MicOff size={26} /> : <Mic size={26} />}
          </button>
          <div className="center">
            <div className="tiny" style={{ fontWeight: 600 }}>
              {ouvindo ? 'Estou ouvindo' : completo ? 'Pausado' : 'Toque pra falar'}
            </div>
            <p className="micro muted" style={{ marginTop: 4, maxWidth: 320 }}>
              {ouvindo
                ? 'Fale normal, do jeito que você contaria pro parceiro. Pode pausar e continuar.'
                : 'Diga com quem treinou, com quem rolou e o que aconteceu.'}
            </p>
          </div>
        </div>
      )}

      <div className="voz-caixa">
        <textarea
          className="input"
          value={completo}
          onChange={(e) => { base.current = e.target.value; setTexto(e.target.value); setParcial(''); }}
          placeholder={exemplo}
          style={{ minHeight: 130, lineHeight: 1.65, resize: 'vertical' }}
        />
        {completo && (
          <button
            className="btn ghost xs"
            onClick={() => { base.current = ''; setTexto(''); setParcial(''); }}
            style={{ marginTop: 8 }}
          >
            <RotateCcw size={12} /> Limpar
          </button>
        )}
      </div>

      {erro && (
        <div className="valida ruim">
          <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--blood)' }} />
          <p className="micro muted">{erro}</p>
        </div>
      )}

      {!completo && (
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
   corrige o que estiver errado.
   ============================================================ */
function Conferir({ resumo, falado, partners, academies, professors, onVoltar, onConfirmar, onClose }) {
  const [d, setD] = useState(() => ({
    duracao: Number(resumo.duracao) || 60,
    tipo: resumo.tipo || 'gi',
    academia: resumo.academia || '',
    professor: resumo.professor || '',
    nota: resumo.nota || falado,
    rolas: (resumo.rolas || []).map((r) => ({ ...r })),
  }));

  const alterarRola = (i, patch) =>
    setD({ ...d, rolas: d.rolas.map((r, k) => (k === i ? { ...r, ...patch } : r)) });

  const nomePonto = (p) => pontosPorId[p]?.nome || p;

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
          <Btn variant="primary" icon={Check} onClick={() => onConfirmar(d)}>Está certo</Btn>
        </>
      }
    >
      <div className="conf-bloco">
        <div className="eyebrow">o treino</div>
        <div className="grid g2" style={{ gap: 10, marginTop: 10 }}>
          <Field label="Duração">
            <Select value={String(d.duracao)} onChange={(e) => setD({ ...d, duracao: Number(e.target.value) })}>
              {[30, 45, 60, 75, 90, 120, 150].map((m) => <option key={m} value={m}>{m} min</option>)}
            </Select>
          </Field>
          <Field label="Tipo">
            <Select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>
              <option value="gi">Gi</option>
              <option value="nogi">No-Gi</option>
              <option value="drill">Drill</option>
              <option value="openmat">Open mat</option>
              <option value="competicao">Competição</option>
            </Select>
          </Field>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Professor">
            <Select value={d.professor} onChange={(e) => setD({ ...d, professor: e.target.value })}>
              <option value="">Nenhum</option>
              {professors.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
              {d.professor && !professors.some((p) => p.nome === d.professor) && (
                <option value={d.professor}>{d.professor} (novo)</option>
              )}
            </Select>
          </Field>
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
      </div>

      {d.rolas.length > 0 ? (
        <div className="conf-bloco">
          <div className="eyebrow">{d.rolas.length === 1 ? 'o rola' : `os ${d.rolas.length} rolas`}</div>
          <div className="col" style={{ gap: 11, marginTop: 10 }}>
            {d.rolas.map((r, i) => (
              <div key={i} className="card" style={{ background: 'var(--void)', padding: 13 }}>
                <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
                  <span className="num micro muted">#{i + 1}</span>
                  <Select
                    value={r.parceiro || ''}
                    onChange={(e) => alterarRola(i, { parceiro: e.target.value })}
                    style={{ flex: 1, minWidth: 140, minHeight: 38 }}
                  >
                    <option value="">Sem parceiro</option>
                    {partners.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                    {r.parceiro && !partners.some((p) => p.nome === r.parceiro) && (
                      <option value={r.parceiro}>{r.parceiro} (novo)</option>
                    )}
                  </Select>
                </div>

                <div className="col" style={{ gap: 8 }}>
                  <LinhaEvento
                    titulo="Você fez"
                    itens={[
                      ...(r.ptsMeus || []).map((p) => ({ txt: nomePonto(p), tom: 'jade' })),
                      ...(r.subsAplicadas || []).map((s) => ({ txt: `finalizou com ${s}`, tom: 'jade' })),
                    ]}
                    vazio="nada marcado"
                  />
                  <LinhaEvento
                    titulo="Você sofreu"
                    itens={[
                      ...(r.ptsDele || []).map((p) => ({ txt: nomePonto(p), tom: 'blood' })),
                      ...(r.subsSofridas || []).map((s) => ({ txt: `bateu de ${s}`, tom: 'blood' })),
                    ]}
                    vazio="nada marcado"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="valida atencao">
          <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.65 }}>
            Não identifiquei nenhum rola no que você falou. Dá pra confirmar assim mesmo e adicionar depois,
            ou voltar e contar como foram as lutas.
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
          ? itens.map((x, k) => <Chip key={k} tone={x.tom}>{x.txt}</Chip>)
          : <span className="micro" style={{ color: 'var(--dimmer)', paddingTop: 4 }}>{vazio}</span>}
      </div>
    </div>
  );
}
