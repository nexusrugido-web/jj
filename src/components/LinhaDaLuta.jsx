import React, { useEffect, useRef, useState } from 'react';
import { Undo2, Flag, Check, Plus, Search, RotateCcw, Square, MapPin, Target, MessageSquareText, ArrowDown } from 'lucide-react';
import Sheet from './Sheet';
import { Btn, Input } from './UI';
import { PONTOS } from '../db/scoring';
import { tecnicasDaPosicao } from '../lib/posicoes';
import { buscaMatch } from '../lib/utils';
import {
  pergunta, proximasDoPlano, pecasDoPlano, resultadosDe, tipoDoPasso, nomeDoPasso, finalizouNoPasso,
  chegouNoObjetivo, ACOES_DELE, NAO_SEI, ehBom, fugasDe, defesasDe, posicaoAtual, ladoDe,
  iniciar, fazer, responder, comoDefendeu, fugir, ficou, fuiPara, recomecar, dele, continuou, acabou, desfazer,
  pontosDaLinha, estadoDosPontosDaLinha, pecaDoPasso,
} from '../lib/linha';
import { caminhoDoRola, OBJETIVO_FINALIZAR, finalizacoesDoObjetivo } from '../lib/planos';

/* ============================================================
   LINHA DA LUTA (R7.5): o fluxograma da execução real.
   Em cima, o objetivo do plano (o destino, não o começo). Depois, o
   início real e cada acontecimento num quadro com a cor da natureza
   dele: posição, finta, técnica, o que ele fez. O resultado vai na
   seta entre um quadro e o próximo. Embaixo, perto do polegar, só a
   pergunta da vez; as sugestões do plano aparecem como quadros
   tracejados ("fantasmas"): só viram fato quando a pessoa toca. O
   mapa do plano não muda nunca por aqui.
   ============================================================ */

const DELE = Object.fromEntries(ACOES_DELE.map((a) => [a.id, a.nome]));
const NATUREZA = { golpe: 'tecnica', finta: 'finta', preparacao: 'preparacao' };
const ROTULO = { tecnica: 'Técnica', finta: 'Finta', preparacao: 'Preparação' };
const tomDoRes = (res) => (ehBom(res) ? 'bom' : res === 'defendeu' ? 'meio' : res === NAO_SEI || !res ? 'neutro' : 'ruim');

/* o nome da posição pelo catálogo; { plano: true } é a posição do plano */
export function nomeDoLugar(onde, plano, posicoes = []) {
  if (!onde) return '';
  if (onde.plano) return plano?.posicao || 'Posição do plano';
  if (!onde.pos) return 'Posição não dita';
  return posicoes.find((x) => x.slug === onde.pos)?.nome || onde.pos;
}
/* o objetivo do plano em palavras */
function textoDoObjetivo(plano) {
  if (!plano?.objetivo) return '';
  const pref = finalizacoesDoObjetivo(plano)[0];
  if (plano.objetivo === OBJETIVO_FINALIZAR) return pref ? `Finalizar com ${pref.replace(/^fam:/, '')}` : 'Finalizar';
  return plano.objetivo;
}

/* o "como" do passo do plano: a defesa ou a fuga que o plano tem */
function comoDoPasso(plano, p) {
  if (!plano || !p.peca || !p.saida) return '';
  const l = caminhoDoRola(plano, [p.saida]).ligacoes[0];
  if (!l) return '';
  if (p.res === 'defendeu') return l.gatilho || '';
  return l.para == null ? `voltou pra ${plano.posicao || 'posição do começo'}` : `foi pra ${pecaDoPasso(plano, { peca: l.para })?.golpe || 'outro lugar'}`;
}

/* resumo pro cartão do rola: uma linha por tentativa */
export function ResumoDaLinha({ linha, planoDe, destinoDe, max = 3 }) {
  const seqs = (linha?.seqs || []).filter((s) => s.inicio || s.passos.length);
  if (!seqs.length) return null;
  const tecnicas = destinoDe?.tecnicas || [];
  const posicoes = destinoDe?.posicoes || [];
  return (
    <ol className="linha-resumo">
      {seqs.slice(0, max).map((s, n) => {
        const plano = planoDe(s.plano);
        const partes = s.passos.map((p) => {
          if (p.quem === 'ele') return { t: `${DELE[p.acao] || 'Ele'}${p.tec ? `: ${p.tec}` : ''}`, tom: 'ruim' };
          if (p.quem === 'lugar') return { t: nomeDoLugar(p, plano, posicoes), tom: 'lugar' };
          const fin = finalizouNoPasso(plano, p, destinoDe);
          const res = p.res ? resultadosDe(plano, p, destinoDe).find((x) => x.id === p.res)?.nome || (p.res === NAO_SEI ? 'não sei' : '') : '';
          return { t: `${nomeDoPasso(plano, p, tecnicas)}${res ? ` (${res.toLowerCase()})` : ''}`, tom: fin ? 'fin' : tomDoRes(p.res) };
        });
        return (
          <li key={s.id}>
            <span className="linha-resumo-n">{seqs.length > 1 ? `${n + 1}ª` : ''}</span>
            <span className="linha-resumo-txt">
              <span className="muted">{nomeDoLugar(s.inicio, plano, posicoes) || '…'}</span>
              {partes.map((x, k) => <React.Fragment key={k}> → <span className={`linha-resumo-${x.tom}`}>{x.t}</span></React.Fragment>)}
            </span>
          </li>
        );
      })}
      {seqs.length > max && <li className="micro muted">+ {seqs.length - max} {seqs.length - max === 1 ? 'tentativa' : 'tentativas'}</li>}
      {linha.fim && <li className="micro muted"><Square size={11} /> Fim do rola</li>}
    </ol>
  );
}

/* um quadro do fluxograma */
function Quadro({ nat, rotulo, children, sub, extra, fin = false }) {
  return (
    <li className={`fluxo-no n-${nat}${fin ? ' fin' : ''}`}>
      <span className="fluxo-rotulo">{fin && <Flag size={11} strokeWidth={3} />}{rotulo}</span>
      <span className="fluxo-nome">{children}</span>
      {sub && <span className="fluxo-sub">{sub}</span>}
      {extra}
    </li>
  );
}
/* a seta entre dois quadros, com o resultado quando tem */
const Seta = ({ res = '', tom = '' }) => (
  <li className={`fluxo-seta ${tom}`} aria-hidden={!res}>
    {res ? <span className="fluxo-seta-res">{res}</span> : null}
    <ArrowDown size={14} strokeWidth={2.5} />
  </li>
);
/* opção da pergunta: sugestão (tracejada) ou resposta */
function Opcao({ children, sub, tag, nat = '', fantasma = false, onClick, icon: Icon }) {
  return (
    <button type="button" className={`fluxo-opcao n-${nat || 'neutro'}${fantasma ? ' fantasma' : ''}`} onClick={onClick}>
      {Icon && <Icon size={16} className="fluxo-opcao-ico" aria-hidden="true" />}
      <span className="fluxo-opcao-txt">
        {tag && <span className="fluxo-opcao-tag">{tag}</span>}
        <span className="fluxo-opcao-nome">{children}</span>
        {sub && <span className="fluxo-opcao-sub">{sub}</span>}
      </span>
      <Plus size={16} className="fluxo-opcao-mais" aria-hidden="true" />
    </button>
  );
}

export default function LinhaDaLuta({
  aberto, onClose, linha, planoUid = '', planoDe = () => null, destinoDe = () => null,
  onMudar, onTecnica, r, pontos = true, onPonto, luta = false, catalogo = {},
}) {
  const fim = useRef(null);
  const [lugares, setLugares] = useState(null); /* popup de posições: (slug) => void */
  const [buscaLugar, setBuscaLugar] = useState('');
  const [deleAberto, setDeleAberto] = useState(false);
  const [pecasAberto, setPecasAberto] = useState(false);
  const [texto, setTexto] = useState(null); /* finta ou preparação em texto: { tipo, valor } */
  const l = linha;
  const q = pergunta(l, planoDe, destinoDe);
  const seqs = l?.seqs || [];
  const seq = seqs[seqs.length - 1];
  const plano = planoDe(seq?.plano || planoUid);
  const planoDoRola = planoDe(planoUid);
  const tecnicas = destinoDe.tecnicas || [];
  const posicoes = destinoDe.posicoes || catalogo.positions || [];
  const nomePos = (slug) => posicoes.find((x) => x.slug === slug)?.nome || slug;
  const oRola = luta ? 'a luta' : 'o rola';

  /* a pergunta nova aparece embaixo e vem pra vista */
  const passosAgora = seqs.reduce((n, s) => n + s.passos.length * 4 + (s.inicio ? 1 : 0) + s.passos.reduce((m, p) => m + (p.res ? 1 : 0) + (p.saida ? 1 : 0), 0), 0) + (l?.fim ? 1 : 0);
  useEffect(() => {
    setDeleAberto(false); setTexto(null);
    const t = setTimeout(() => fim.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' }), 60);
    return () => clearTimeout(t);
  }, [passosAgora, aberto]);

  const mudar = (nova) => onMudar(nova);
  const quer = pontos ? pontosDaLinha(l, planoDe, destinoDe) : [];
  const estados = estadoDosPontosDaLinha(quer, l?.pontuou, r?.ptsMeus, r?.tecMeus);
  const confirmados = estados.filter((x) => x.estado === 'meu').reduce((n, x) => n + (PONTOS.find((p) => p.id === x.ponto)?.pts || 0), 0);

  const chipsDePonto = (id) => {
    const meus = estados.filter((x) => x.ev === id);
    if (!meus.length) return null;
    return (
      <div className="fluxo-pontos">
        <span className="micro">Contou ponto? Só se estabilizou 3 segundos.</span>
        <div className="row wrap" style={{ gap: 6 }}>
          {meus.map((x) => {
            const pt = PONTOS.find((y) => y.id === x.ponto);
            if (x.estado === 'ja') return <span key={`${x.ponto}|${x.nome}`} className="chip muted">{pt.nome}: já está nos lances</span>;
            return (
              <button key={`${x.ponto}|${x.nome}`} type="button" className={`chip ${x.estado === 'meu' ? 'on jade' : ''}`} onClick={() => onPonto(x)} aria-pressed={x.estado === 'meu'}>
                {x.estado === 'meu' && <Check size={12} strokeWidth={3} className="chip-check" aria-hidden />}
                {pt.nome} +{pt.pts}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /* ---------- o que já aconteceu ---------- */
  /* o resultado do que eu fiz vai na seta que sai do quadro */
  const resDe = (pl, p) => {
    if (p?.quem !== 'eu' || !p.res) return {};
    const nome = finalizouNoPasso(pl, p, destinoDe) ? 'Finalizou' : p.res === NAO_SEI ? 'Não sei' : resultadosDe(pl, p, destinoDe).find((x) => x.id === p.res)?.nome || '';
    const como = comoDoPasso(pl, p);
    return { res: `${nome}${como ? ` · ${como}` : ''}`, tom: tomDoRes(p.res) };
  };
  const quadrosDaSeq = (s) => {
    const pl = planoDe(s.plano);
    const out = [];
    s.passos.forEach((p, k) => {
      out.push(<Seta key={`s${p.id}`} {...resDe(pl, s.passos[k - 1])} />);
      if (p.quem === 'ele') {
        out.push(<Quadro key={p.id} nat="ele" rotulo="Ele">{DELE[p.acao]}{p.tec ? `: ${nomeDoPasso(null, p, tecnicas)}` : ''}</Quadro>);
        return;
      }
      if (p.quem === 'lugar') {
        out.push(
          <Quadro key={p.id} nat="posicao" rotulo={p.por === 'eu' ? 'Posição conquistada' : 'Posição real'} sub={p.por === 'ele' ? 'A luta foi pra cá' : ''} extra={chipsDePonto(p.id)}>
            {nomeDoLugar(p, pl, posicoes)}
          </Quadro>,
        );
        return;
      }
      const nat = NATUREZA[tipoDoPasso(pl, p)];
      const fin = finalizouNoPasso(pl, p, destinoDe);
      const origem = p.peca ? 'do plano' : p.texto ? 'texto livre' : 'fora do plano';
      out.push(
        <Quadro key={p.id} nat={fin ? 'objetivo' : nat} fin={fin} rotulo={`${fin ? 'Finalização' : ROTULO[nat]} · ${origem}`}
          sub={chegouNoObjetivo(pl, p, destinoDe) ? 'Objetivo do plano alcançado' : ''} extra={chipsDePonto(p.id)}>
          {nomeDoPasso(pl, p, tecnicas) || 'Peça que saiu do plano'}
        </Quadro>,
      );
    });
    return out;
  };
  const resFinal = (s) => resDe(planoDe(s?.plano), s?.passos?.[s.passos.length - 1]);

  /* ---------- a pergunta da vez ---------- */
  const abrirLugares = (fn) => { setBuscaLugar(''); setLugares(() => fn); };
  const perguntaInicio = () => {
    const d = q.depois;
    const titulo = q.primeira ? `De onde ${oRola} começou?` : d && finalizouNoPasso(planoDe(seqs[seqs.length - 2]?.plano), d, destinoDe) ? 'De onde recomeçou?' : 'Onde a luta recomeçou?';
    const pl = planoDe(seq && !seq.inicio ? seq.plano || planoUid : planoUid);
    const doPlano = pl && destinoDe.slugDoPlano?.(pl);
    const ir = (inicio) => mudar(iniciar(l, inicio, planoUid));
    return (
      <>
        <h4 className="fluxo-pergunta">{titulo}</h4>
        <p className="micro muted">Onde a luta começou de verdade, mesmo que o plano comece em outro lugar.</p>
        <div className="fluxo-opcoes">
          {doPlano !== 'em_pe' && <Opcao nat="posicao" icon={MapPin} onClick={() => ir({ pos: 'em_pe' })}>{nomePos('em_pe')}</Opcao>}
          {pl && (doPlano
            ? <Opcao nat="posicao" icon={MapPin} tag="Onde o plano começa" onClick={() => ir({ pos: doPlano })}>{nomePos(doPlano)}</Opcao>
            : <Opcao nat="posicao" icon={MapPin} tag="Onde o plano começa" onClick={() => ir({ plano: true })}>{pl.posicao || 'Posição do plano'}</Opcao>)}
          <Opcao nat="posicao" icon={Search} onClick={() => abrirLugares((slug) => ir({ pos: slug }))}>Outra posição…</Opcao>
        </div>
      </>
    );
  };

  const perguntaOnde = () => {
    const d = q.depois;
    const pl = planoDe(seq.plano);
    const fugas = d?.quem === 'eu' && d.peca && (d.res === 'escapou' || d.res === 'puxou') && pl ? fugasDe(pl, d.peca) : [];
    /* onde a técnica costuma terminar: sugestão, nunca escolha */
    const destino = d?.quem === 'eu' && d.res === 'encaixou' ? destinoDe(nomeDoPasso(pl, d, tecnicas))?.slug : '';
    const vistas = [...new Set([destino, ...seqs.flatMap((s) => s.passos.filter((p) => p.quem === 'lugar').map((p) => p.pos)), seq.inicio?.pos, 'em_pe'])]
      .filter((x) => x && posicoes.some((y) => y.slug === x)).slice(0, 4);
    return (
      <>
        <h4 className="fluxo-pergunta">Onde a luta ficou?</h4>
        <div className="fluxo-opcoes">
          {fugas.map((f) => <Opcao key={f.lig} nat="posicao" icon={MapPin} tag="Do seu plano" fantasma onClick={() => mudar(fugir(l, f.lig))}>{f.nome}</Opcao>)}
          {vistas.map((slug) => (
            <Opcao key={slug} nat="posicao" icon={MapPin} tag={slug === destino ? 'Onde essa técnica costuma terminar' : ''} onClick={() => mudar(ficou(l, slug))}>{nomePos(slug)}</Opcao>
          ))}
          <Opcao nat="posicao" icon={Search} onClick={() => abrirLugares((slug) => mudar(ficou(l, slug)))}>Outra posição…</Opcao>
          <Opcao nat="neutro" onClick={() => mudar(ficou(l, ''))}>Não sei</Opcao>
        </div>
      </>
    );
  };

  const perguntaAcao = () => {
    const proximas = proximasDoPlano(plano, seq, destinoDe);
    const depois = q.depois;
    const ultimaDoPlano = [...(seq?.passos || [])].reverse().find((p) => p.quem === 'eu' && p.peca);
    const defendeuAgora = depois?.quem === 'eu' && depois.res === 'defendeu' && depois === ultimaDoPlano;
    const defesas = defendeuAgora && plano ? defesasDe(plano, ultimaDoPlano.peca) : [];
    const onde = posicaoAtual(seq);
    const lado = ladoDe(onde?.pos, destinoDe);
    const acoes = ACOES_DELE.filter((a) => !a.lado || !lado || a.lado === lado);
    const temOutras = plano && pecasDoPlano(plano).length > proximas.length;
    /* do catálogo, a partir da posição em que a luta está (as que você mais usa primeiro) */
    const doCatalogo = onde?.pos && catalogo.techniques
      ? tecnicasDaPosicao(onde.pos, { techniques: catalogo.techniques, categories: catalogo.categories || [], positions: posicoes, usadas: catalogo.usadas || [] })
        .filter((t) => !proximas.some((x) => x.golpe === t.nome)).slice(0, 3)
      : [];
    return (
      <>
        <h4 className="fluxo-pergunta">{depois ? 'E depois, o que aconteceu?' : 'O que aconteceu?'}</h4>
        {defesas.length > 0 && (
          <div className="fluxo-como">
            <span className="micro">Como ele defendeu?</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {defesas.map((d) => (
                <button key={d.lig} type="button" className={`chip ${ultimaDoPlano.saida === d.lig ? 'on' : ''}`} aria-pressed={ultimaDoPlano.saida === d.lig}
                  onClick={() => mudar(comoDefendeu(l, ultimaDoPlano.saida === d.lig ? '' : d.lig))}>
                  {ultimaDoPlano.saida === d.lig && <Check size={12} strokeWidth={3} className="chip-check" aria-hidden />}{d.nome}
                </button>
              ))}
              <button type="button" className={`chip ${!ultimaDoPlano.saida ? 'on' : ''}`} aria-pressed={!ultimaDoPlano.saida} onClick={() => mudar(comoDefendeu(l, ''))}>
                {!ultimaDoPlano.saida && <Check size={12} strokeWidth={3} className="chip-check" aria-hidden />}Não sei
              </button>
            </div>
          </div>
        )}
        {proximas.length > 0 && <p className="fluxo-grupo">Possibilidades do seu plano</p>}
        <div className="fluxo-opcoes">
          {proximas.map((x) => (
            <Opcao key={`${x.peca}|${x.lig}|${x.gatilho}`} fantasma nat={NATUREZA[x.tipo] || 'tecnica'} tag={`${ROTULO[NATUREZA[x.tipo]] || 'Técnica'} · Plano ${x.letra}`}
              sub={x.gatilho && x.via !== null ? `quando ele ${x.gatilho}` : ''} onClick={() => mudar(fazer(l, { peca: x.peca, lig: x.lig }, plano))}>
              {x.golpe}
            </Opcao>
          ))}
        </div>
        {doCatalogo.length > 0 && <p className="fluxo-grupo">Técnicas de {nomePos(onde.pos)}</p>}
        <div className="fluxo-opcoes">
          {doCatalogo.map((t) => (
            <Opcao key={t.id} nat="fora" tag="Fora do plano" onClick={() => mudar(fazer(l, { tec: t.nome, tecUid: t.uid || null }))}>{t.nome}</Opcao>
          ))}
        </div>
        {texto ? (
          <form className="fluxo-texto" onSubmit={(e) => { e.preventDefault(); if (texto.valor.trim()) mudar(fazer(l, { tipo: texto.tipo, texto: texto.valor })); }}>
            <div className="row" style={{ gap: 6 }}>
              {['finta', 'preparacao'].map((t) => (
                <button key={t} type="button" className={`chip ${texto.tipo === t ? 'on' : ''}`} aria-pressed={texto.tipo === t} onClick={() => setTexto({ ...texto, tipo: t })}>{ROTULO[t]}</button>
              ))}
            </div>
            <Input autoFocus value={texto.valor} maxLength={120} onChange={(e) => setTexto({ ...texto, valor: e.target.value })}
              placeholder={texto.tipo === 'finta' ? 'Ex.: ameaçar puxar pra guarda' : 'Ex.: pegar a gola e quebrar a postura'} />
            <Btn variant="primary" type="submit" disabled={!texto.valor.trim()}>Pôr na linha</Btn>
          </form>
        ) : null}
        <div className="fluxo-acoes">
          <button type="button" className="fluxo-mais" onClick={() => onTecnica({ titulo: 'Qual técnica você fez?', minha: true, cb: (tec) => mudar(fazer(l, { tec: tec.nome, tecUid: tec.uid })) })}>
            <Search size={14} /> Outra técnica
          </button>
          {!texto && <button type="button" className="fluxo-mais" onClick={() => setTexto({ tipo: 'finta', valor: '' })}><MessageSquareText size={14} /> Finta ou preparação</button>}
          {temOutras && <button type="button" className="fluxo-mais" onClick={() => setPecasAberto(true)}><Target size={14} /> Outra peça do plano</button>}
          <button type="button" className="fluxo-mais" onClick={() => abrirLugares((slug) => mudar(fuiPara(l, slug)))}><MapPin size={14} /> Fui pra outra posição</button>
        </div>
        <div className="fluxo-dele">
          {!deleAberto ? (
            <button type="button" className="fluxo-mais ele" onClick={() => setDeleAberto(true)}>Foi ele que fez algo</button>
          ) : (
            <>
              <p className="fluxo-grupo">O que ele fez?</p>
              <div className="row wrap" style={{ gap: 6 }}>
                {acoes.map((a) => (
                  <button key={a.id} type="button" className="chip"
                    onClick={() => (a.id === 'finalizou'
                      ? onTecnica({ titulo: 'Com o que ele te finalizou?', cb: (tec) => mudar(dele(l, 'finalizou', { tec: tec.nome, tecUid: tec.uid })) })
                      : mudar(dele(l, a.id)))}>
                    {a.nome}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="fluxo-fecho">
          <button type="button" className="fluxo-mais" onClick={() => mudar(recomecar(l, planoUid))}><RotateCcw size={14} /> A luta recomeçou</button>
          <button type="button" className="fluxo-mais" onClick={() => mudar(acabou(l))}><Square size={13} /> Acabou {oRola}</button>
        </div>
      </>
    );
  };

  const perguntaResultado = () => {
    const p = q.passo;
    const pl = planoDe(seq.plano);
    const tipo = tipoDoPasso(pl, p);
    return (
      <>
        <h4 className="fluxo-pergunta">{tipo === 'finta' ? 'Ele reagiu à finta?' : tipo === 'preparacao' ? 'Conseguiu montar?' : 'O que aconteceu?'}</h4>
        <div className="fluxo-opcoes">
          {resultadosDe(pl, p, destinoDe).map((x) => (
            <Opcao key={x.id} nat={`res-${tomDoRes(x.id)}`} onClick={() => mudar(responder(l, x.id))}>{x.nome}</Opcao>
          ))}
          <Opcao nat="neutro" onClick={() => mudar(responder(l, NAO_SEI))}>Não sei</Opcao>
        </div>
      </>
    );
  };

  const perguntaContinuou = () => (
    <>
      <h4 className="fluxo-pergunta">{q.quem === 'ele' ? 'Ele te finalizou.' : 'Finalizou!'} {luta ? 'A luta' : 'O rola'} continuou?</h4>
      <div className="fluxo-opcoes">
        <Opcao nat="posicao" icon={RotateCcw} sub="Começa outra tentativa, sem apagar esta" onClick={() => mudar(continuou(l, true))}>Sim, recomeçou</Opcao>
        <Opcao nat="neutro" icon={Square} onClick={() => mudar(continuou(l, false))}>Não, acabou aí</Opcao>
      </div>
    </>
  );

  const corpo = { inicio: perguntaInicio, onde: perguntaOnde, acao: perguntaAcao, resultado: perguntaResultado, continuou: perguntaContinuou }[q.tipo];
  const vazio = !seqs.length && !l?.fim;
  const objetivo = textoDoObjetivo(planoDoRola);

  return (
    <Sheet
      aberto={aberto} onClose={onClose} alturaMobile={96}
      titulo="Linha da luta" subtitulo={planoDoRola ? `Plano: ${planoDoRola.nome}` : 'Sem plano: conte com as técnicas'}
      footer={(
        <div className="fluxo-rodape">
          {pontos && <span className="fluxo-placar">{confirmados ? `${confirmados} ${confirmados === 1 ? 'ponto confirmado' : 'pontos confirmados'}` : 'Nenhum ponto confirmado'}</span>}
          <div className="row" style={{ gap: 8 }}>
            <Btn variant="ghost" icon={Undo2} disabled={vazio} onClick={() => mudar(desfazer(l))}>Desfazer</Btn>
            <Btn variant="contorno" onClick={onClose}>Voltar pro treino</Btn>
          </div>
        </div>
      )}
    >
      <ol className="fluxo" aria-label="O que aconteceu, na ordem">
        {objetivo && <Quadro nat="objetivo" rotulo="Objetivo do plano" sub="O destino, não o começo">{objetivo}</Quadro>}
        {seqs.map((s, n) => (
          <React.Fragment key={s.id}>
            {n > 0 && resFinal(seqs[n - 1]).res && <Seta {...resFinal(seqs[n - 1])} />}
            {n > 0 && <li className="fluxo-tentativa">{n + 1}ª tentativa · a anterior continua guardada</li>}
            {s.inicio && (
              <>
                {(n > 0 || objetivo) && <Seta />}
                <Quadro nat="posicao" rotulo={n === 0 ? 'Início real' : 'Recomeçou em'}>{nomeDoLugar(s.inicio, planoDe(s.plano), posicoes)}</Quadro>
              </>
            )}
            {quadrosDaSeq(s)}
          </React.Fragment>
        ))}
        {(seqs.length > 0 || objetivo) && <Seta {...resFinal(seq)} />}
        <li className={`fluxo-agora${q.tipo === 'fim' ? ' fim' : ''}`} ref={fim}>
          {q.tipo === 'fim' ? (
            <>
              <h4 className="fluxo-pergunta">Fim {luta ? 'da luta' : 'do rola'}</h4>
              <p className="micro muted">A história fica neste {luta ? 'luta' : 'rola'} quando você salvar o treino. Quer contar mais? Toque em Desfazer.</p>
            </>
          ) : corpo?.()}
        </li>
      </ol>

      <Sheet aberto={pecasAberto} onClose={() => setPecasAberto(false)} titulo="Outra peça do plano" subtitulo="Fora da ordem do plano: o caminho não é deduzido">
        <div className="fluxo-opcoes">
          {pecasDoPlano(plano).map((x) => (
            <Opcao key={x.id} fantasma nat={NATUREZA[x.tipo] || 'tecnica'} tag={`${ROTULO[NATUREZA[x.tipo]] || 'Técnica'} · Plano ${x.letra}`}
              onClick={() => {
                const pela = proximasDoPlano(plano, seq, destinoDe).find((y) => y.peca === x.id);
                mudar(fazer(l, { peca: x.id, lig: pela?.lig || '' }, plano));
                setPecasAberto(false);
              }}>
              {x.golpe}
            </Opcao>
          ))}
        </div>
      </Sheet>
      <Sheet aberto={!!lugares} onClose={() => setLugares(null)} titulo="Qual posição?">
        <div className="col" style={{ gap: 10 }}>
          <Input value={buscaLugar} onChange={(e) => setBuscaLugar(e.target.value)} placeholder="Buscar posição" />
          <div className="row wrap" style={{ gap: 6 }}>
            {posicoes.filter((x) => x.slug !== 'finalizado' && x.slug !== 'finalizacao' && (!buscaLugar.trim() || buscaMatch(x.nome, buscaLugar))).map((x) => (
              <button key={x.slug} type="button" className="chip" onClick={() => { const fn = lugares; setLugares(null); fn(x.slug); }}>{x.nome}</button>
            ))}
          </div>
        </div>
      </Sheet>
    </Sheet>
  );
}
