import React, { useMemo, useState, useRef, useEffect } from 'react';
import Capa from '../components/Capa';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Play, Check, GraduationCap, Search, Filter,
  BookOpen, ChevronRight, X, Layers, TriangleAlert, Lock,
} from 'lucide-react';
import { db } from '../db/db';
import Player from '../components/Player';
import { useApp } from '../contexto';
import {
  Card, Btn, Chip, Empty, Sheet, Busca, Seg, useToast,
} from '../components/UI';
import {
  aulasDoTema, resumoAcervo, capa, duracaoTexto, registrarAulaVista, aulasDeEntrada,
} from '../lib/aulas';
import { aulasPara } from '../lib/motor';
import { pedidoDaRec, DIFICULDADES, PEDIDO_DO_ESTILO, descreverPedido } from '../lib/necessidades';
import { medir, origem as origemDe } from '../lib/medir';
import { TEMAS_AULA } from '../db/aulas';
import { EscolherDificuldades, MAX_DIFICULDADES } from '../components/Dificuldades';
import { acervo } from '../lib/acervo';
import { minhasTecnicas, meusBuracos } from '../lib/graus';
import { recomendacoesDoAluno, chaveDaRec } from '../lib/recomendar';
import { estiloPorId } from '../db/scoring';
import { relativo } from '../lib/utils';
import Quiz from '../components/Quiz';
import { PERGUNTAS } from '../db/quiz';
import { useLimite } from '../components/Limite';
import { limitarLista, LIMITES, RECOMENDACOES_NA_TELA } from '../lib/plano';
import { jaComprou, ehLivre } from '../lib/pago';
import { EVENTOS } from '../lib/xp';

const NENHUMA = [];

export default function Estudo() {
  const { settings, salvarSettings, rolls, partners, sessions, techniques, irPara, ligada, acesso, acervoVer } = useApp();
  const toast = useToast();
  const { liberarVideo, aviso } = useLimite(acesso, irPara);
  const faixa = settings.faixa || 'branca';

  const assistidas = useLiveQuery(() => db.aulasVistas.toArray(), [], []) || [];
  const feitas = useLiveQuery(() => db.recFeitas.toArray(), [], []) || [];
  const vistas = useMemo(() => assistidas.map((a) => a.videoId), [assistidas]);

  const [aba, setAba] = useState('pravoce');
  const [vistasNaTela, setVistasNaTela] = useState(12);
  const [ajudaPontos, setAjudaPontos] = useState(false);
  const [tema, setTema] = useState(null);
  const [busca, setBusca] = useState('');

  /* Quando outra tela manda pra cá com um tema, abre direto nele.
     Chegar na lista inteira depois de clicar em "ver aulas sobre
     isso" faz a pessoa procurar de novo o que ela já pediu. */
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tema');
    if (t) { setAba('tema'); setTema(t); }
  }, []);
  const [tipo, setTipo] = useState('todos');
  const [pagina, setPagina] = useState(0);
  const [tocando, setTocando] = useState(null);

  /* antes de abrir, o app pergunta duas coisas: este vídeo é
     vendido à parte, e ainda cabe um hoje no plano grátis */
  async function tocar(a, origem = origemDe('estudo', aba)) {
    if (!a) return;
    /* a origem vai junto com o vídeo, pra conclusão saber de onde veio */
    if (await liberarVideo(a, origem)) setTocando({ ...a, origem });
  }
  const [dorAberta, setDorAberta] = useState(null);
  const [editandoDif, setEditandoDif] = useState(false);
  const minhas = settings.dificuldades || NENHUMA;
  const marcarDificuldades = (lista) => salvarSettings({ dificuldades: lista.slice(-MAX_DIFICULDADES) });

  const resumo = useMemo(() => resumoAcervo(vistas), [vistas, acervoVer]);

  const tecnicas = useMemo(
    () => minhasTecnicas(rolls, partners, sessions, techniques, faixa),
    [rolls, partners, sessions, techniques, faixa]
  );
  const buracos = useMemo(() => meusBuracos(rolls, partners, sessions, faixa), [rolls, partners, sessions, faixa]);
  const todasRecs = useMemo(
    () => recomendacoesDoAluno({ tecnicas, buracos, partners, sessions, rolls, faixa, feitas, limite: RECOMENDACOES_NA_TELA }),
    [tecnicas, buracos, partners, sessions, rolls, faixa, feitas]
  );

  /* no grátis abre uma, e o resto conta como o que está faltando */
  const { itens: recs, cortados: recsCortadas } = useMemo(
    () => limitarLista(todasRecs, acesso, LIMITES.recomendacoesAbertas),
    [todasRecs, acesso]
  );

  /* o que o app acha que você precisa ver agora */
  const paraVoce = useMemo(() => {
    const blocos = [];
    const usados = new Set();

    /* Cada recomendação puxa aula do assunto dela, pelo que o
       vídeo ensina, e nenhum vídeo se repete entre os blocos. */
    /* cada bloco diz de onde veio, e se caiu na reserva por não ter
       vídeo do assunto: é o que o painel mostra como pauta de gravação */
    const bloco = (b, pedido, lista) => blocos.push({
      ...b, aulas: lista, faltou: lista.every((a) => a.reserva || a.generico), pedidoTexto: descreverPedido(pedido),
    });

    for (const r of recs) {
      const pedido = pedidoDaRec(r);
      const lista = aulasPara(pedido, {
        faixa,
        vistas,
        excluir: [...usados],
        quantidade: 2,
        soAula: true,
      });
      for (const a of lista) usados.add(a.id);
      if (lista.length) bloco({ motivo: r.titulo, texto: r.texto, origem: origemDe('estudo', 'rec', chaveDaRec(r)) }, pedido, lista);
    }

    /* o que a pessoa disse que trava. Vale desde o primeiro dia,
       antes de existir rola registrado pra o app ler. */
    for (const id of minhas) {
      const d = DIFICULDADES.find((x) => x.id === id);
      if (!d) continue;
      const lista = aulasPara(d.pedido, { faixa, vistas, excluir: [...usados], quantidade: 3 });
      for (const a of lista) usados.add(a.id);
      if (lista.length) {
        bloco({
          motivo: d.nome,
          texto: 'Você marcou que isso te trava. Estas aulas vão direto nisso.',
          origem: origemDe('estudo', 'dificuldade', d.id),
        }, d.pedido, lista);
      }
    }

    if (PEDIDO_DO_ESTILO[settings.estiloDeclarado]) {
      const pedido = PEDIDO_DO_ESTILO[settings.estiloDeclarado];
      const lista = aulasPara(pedido, {
        faixa, vistas, excluir: [...usados], quantidade: 4,
      });
      if (lista.length) {
        bloco({
          motivo: `Combina com o seu jogo`,
          texto: `Você marcou que joga ${estiloPorId(settings.estiloDeclarado).nome.toLowerCase()}. Estas aulas puxam pra esse lado.`,
          origem: origemDe('estudo', 'estilo', settings.estiloDeclarado),
        }, pedido, lista);
      }
    }
    return blocos;
  }, [recs, faixa, vistas, settings.estiloDeclarado, minhas, acervoVer]);

  /* quem ainda não registrou nada precisa de algo pra ver hoje,
     e não de um aviso dizendo que a tela enche depois */
  const entrada = useMemo(
    () => aulasDeEntrada({ faixa, vistas, quantidade: RECOMENDACOES_NA_TELA }),
    [faixa, vistas, acervoVer]
  );

  /* quantas aulas e quantas vistas em cada tema, numa passada só */
  const contagemTemas = useMemo(() => {
    const v = new Set(vistas);
    const c = {};
    for (const a of acervo()) {
      for (const t of a.tm) {
        c[t] = c[t] || { n: 0, vistos: 0 };
        c[t].n += 1;
        if (v.has(a.id)) c[t].vistos += 1;
      }
    }
    return c;
  }, [vistas, acervoVer]);

  const doTema = useMemo(
    () => (tema ? aulasDoTema(tema, { faixa, vistas, busca, tipo, pagina }) : null),
    [tema, faixa, vistas, busca, tipo, pagina, acervoVer]
  );

  const aulasDaDor = useMemo(() => {
    const d = DIFICULDADES.find((x) => x.id === dorAberta);
    return d ? aulasPara(d.pedido, { faixa, vistas, quantidade: 5 }) : [];
  }, [dorAberta, faixa, vistas, acervoVer]);

  /* o que o app mostrou, pra o painel saber se a recomendação vira
     vídeo aberto. Conta uma vez por dia (src/lib/medir.js). */
  useEffect(() => {
    if (aba !== 'pravoce') return;
    const lista = paraVoce.length ? paraVoce : [{ origem: origemDe('estudo', 'entrada'), aulas: entrada }];
    for (const b of lista) {
      for (const a of b.aulas) medir('exibiu', { origem: b.origem, videoId: a.id });
      if (b.faltou) medir('faltou', { origem: b.origem, detalhe: b.pedidoTexto });
    }
  }, [aba, paraVoce, entrada]);

  useEffect(() => {
    if (aba !== 'dores' || !dorAberta) return;
    const o = origemDe('estudo', 'aba-dificuldade', dorAberta);
    for (const a of aulasDaDor) medir('exibiu', { origem: o, videoId: a.id });
    if (aulasDaDor.every((a) => a.reserva)) {
      medir('faltou', { origem: o, detalhe: DIFICULDADES.find((x) => x.id === dorAberta)?.nome });
    }
  }, [aba, dorAberta, aulasDaDor]);

  async function marcarVista(a, segundos) {
    const r = await registrarAulaVista(a, segundos);
    toast(r.xp ? `+${r.xp} pontos` : r.revisao ? 'Revisto' : 'Aula concluída');
  }


  return (
    <div className="page">
      <div className="page-head">
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <h1 className="h-page">Estudo</h1>
          <button className="ajuda" onClick={() => setAjudaPontos(true)} aria-label="Quanto vale cada aula">?</button>
        </div>
      </div>

      <PontosDoEstudo aberto={ajudaPontos} onClose={() => setAjudaPontos(false)} cobrando={ligada('cobranca')} />

      <Seg value={aba} onChange={(v) => { setAba(v); setTema(null); setPagina(0); }} options={[
        { id: 'pravoce', nome: 'Pra você' },
        { id: 'temas', nome: 'Por tema' },
        { id: 'dores', nome: 'Por dificuldade' },
        ...(ligada('quiz') ? [{ id: 'quiz', nome: 'Quiz' }] : []),
        { id: 'vistas', nome: `Vistas (${resumo.vistas})` },
      ]} />
      <div style={{ height: 14 }} />

      {/* ---------- pra você ---------- */}
      {aba === 'pravoce' && (!minhas.length || editandoDif ? (
        <Card style={{ marginBottom: 14 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">pro app escolher melhor</div>
              <h2 className="h-sec">O que mais te trava hoje?</h2>
            </div>
          </div>
          <p className="tiny muted" style={{ marginBottom: 12, lineHeight: 1.65 }}>
            Marque até três. As aulas desta tela passam a começar por aí.
          </p>
          <EscolherDificuldades
            valor={minhas}
            onChange={(lista) => { setEditandoDif(true); marcarDificuldades(lista); }}
          />
          {editandoDif && (
            <Btn size="sm" style={{ marginTop: 12 }} onClick={() => setEditandoDif(false)}>Pronto</Btn>
          )}
        </Card>
      ) : (
        <div className="row wrap" style={{ gap: 7, marginBottom: 14, alignItems: 'center' }}>
          <span className="micro muted">O que te trava:</span>
          {minhas.map((id) => <Chip key={id} tone="warn">{DIFICULDADES.find((d) => d.id === id)?.nome}</Chip>)}
          <button className="btn ghost xs" onClick={() => setEditandoDif(true)}>Mudar</button>
        </div>
      ))}

      {aba === 'pravoce' && (
        paraVoce.length === 0 ? (
          <Card>
            <div className="card-head">
              <div>
                <div className="eyebrow">por onde começar</div>
                <h2 className="h-sec">Comece por estas</h2>
              </div>
            </div>
            <p className="tiny muted" style={{ marginBottom: 14, lineHeight: 1.65 }}>
              Depois que você registrar alguns rolas, esta lista muda: o app passa a escolher a aula que ataca
              exatamente o que está te travando. Por enquanto, estas são as que mais destravam quem está
              chegando.
            </p>
            <ListaAulas aulas={entrada} vistas={vistas} onTocar={(a) => tocar(a, origemDe('estudo', 'entrada'))} />
          </Card>
        ) : (
          <div className="col" style={{ gap: 16 }}>
            {paraVoce.map((b, i) => (
              <Card key={i}>
                <div className="card-head">
                  <div>
                    <div className="eyebrow">por causa disso</div>
                    <h2 className="h-sec">{b.motivo}</h2>
                  </div>
                </div>
                <p className="tiny muted" style={{ marginBottom: 14, lineHeight: 1.65 }}>{b.texto}</p>
                <ListaAulas aulas={b.aulas} vistas={vistas} onTocar={(a) => tocar(a, b.origem)} />
              </Card>
            ))}

            {recsCortadas > 0 && (
              <button className="valida atencao" onClick={() => irPara('ajustes')} style={{ width: '100%', textAlign: 'left' }}>
                <p className="micro muted" style={{ lineHeight: 1.65 }}>
                  Tem mais {recsCortadas} {recsCortadas === 1 ? 'assunto' : 'assuntos'} que saíram dos seus registros.
                  No plano grátis abre um por vez. Toque aqui pra ver o premium.
                </p>
              </button>
            )}
          </div>
        )
      )}

      {/* ---------- por tema ---------- */}
      {aba === 'temas' && (
        !tema ? (
          <div className="grid g-cards">
            {TEMAS_AULA.map((t) => {
              const { n = 0, vistos = 0 } = contagemTemas[t.id] || {};
              return (
                <button key={t.id} className="card hover tema-card" onClick={() => { setTema(t.id); setPagina(0); setBusca(''); }}>
                  <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <span className="stat-ico"><BookOpen size={16} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontFamily: 'var(--display)', fontSize: 15.5 }}>{t.nome}</div>
                      <p className="micro muted" style={{ marginTop: 4 }}>{t.desc}</p>
                      <div className="row wrap" style={{ gap: 6, marginTop: 9 }}>
                        <Chip>{n} aulas</Chip>
                        {vistos > 0 && <Chip tone="jade">{vistos} vistas</Chip>}
                      </div>
                    </div>
                    <ChevronRight size={16} className="muted" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <Card style={{ marginBottom: 14 }}>
              <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                <button className="btn ghost sm" onClick={() => setTema(null)}>Voltar</button>
                <div style={{ flex: 1 }}>
                  <div className="h-sec">{TEMAS_AULA.find((t) => t.id === tema)?.nome}</div>
                  <div className="micro muted">{doTema.total} aulas</div>
                </div>
              </div>
              <Busca value={busca} onChange={(v) => { setBusca(v); setPagina(0); }} placeholder="Buscar no tema" />
              <div className="seletor-pill" style={{ marginTop: 10 }}>
                {[{ id: 'todos', nome: 'Tudo' }, { id: 'aula', nome: 'Aulas completas' }, { id: 'short', nome: 'Aulas rápidas' }].map((o) => (
                  <button key={o.id} className={tipo === o.id ? 'on' : ''} onClick={() => { setTipo(o.id); setPagina(0); }}>{o.nome}</button>
                ))}
              </div>
            </Card>
            <ListaAulas aulas={doTema.itens} vistas={vistas} onTocar={(a) => tocar(a, origemDe('estudo', 'tema', tema))} />
            {doTema.temMais && (
              <Btn onClick={() => setPagina(pagina + 1)} style={{ width: '100%', marginTop: 14 }}>
                Ver mais
              </Btn>
            )}
          </>
        )
      )}

      {/* ---------- por dificuldade ---------- */}
      {aba === 'dores' && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <p className="tiny muted" style={{ lineHeight: 1.7 }}>
              Estas são as dificuldades que os alunos mais contam. Escolha a que parece com a sua e o app monta
              uma trilha em cima dela.
            </p>
          </Card>
          <div className="col" style={{ gap: 12 }}>
            {DIFICULDADES.map((d) => (
              <Card key={d.id} className="hover">
                <button
                  className="row"
                  style={{ width: '100%', gap: 12, textAlign: 'left' }}
                  onClick={() => setDorAberta(dorAberta === d.id ? null : d.id)}
                >
                  <span className="stat-ico"><Layers size={15} /></span>
                  <span className="tiny" style={{ flex: 1, fontWeight: 600 }}>{d.nome}</span>
                  {minhas.includes(d.id) && <Chip tone="warn">sua</Chip>}
                  <ChevronRight size={16} className="muted" style={{ transform: dorAberta === d.id ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                </button>
                {dorAberta === d.id && (
                  <div style={{ marginTop: 14 }}>
                    <button
                      className="btn ghost xs"
                      style={{ marginBottom: 12 }}
                      onClick={() => marcarDificuldades(minhas.includes(d.id) ? minhas.filter((x) => x !== d.id) : [...minhas, d.id])}
                    >
                      {minhas.includes(d.id) ? 'Não me trava mais' : 'Isso me trava'}
                    </button>
                    <ListaAulas aulas={aulasDaDor} vistas={vistas} onTocar={(a) => tocar(a, origemDe('estudo', 'aba-dificuldade', d.id))} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ---------- quiz ---------- */}
      {aba === 'quiz' && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <div className="card-head">
              <div>
                <div className="eyebrow">{PERGUNTAS.length} perguntas de princípio</div>
                <h2 className="h-sec">Teste o que você entendeu</h2>
              </div>
            </div>
            <p className="tiny muted" style={{ lineHeight: 1.7 }}>
              Nenhuma pergunta aqui é de decorar nome de golpe. Todas mostram uma situação e perguntam o princípio,
              porque é isso que sai no rola. Errar vale ponto se você ler a explicação.
            </p>
          </Card>
          <Quiz faixa={faixa} onSair={() => setAba('pravoce')} />
        </>
      )}

      {/* ---------- vistas ---------- */}
      {aba === 'vistas' && (
        assistidas.length === 0 ? (
          <Card><Empty icon={Check} titulo="Nada assistido ainda" texto="As aulas que você concluir ficam guardadas aqui." /></Card>
        ) : (
          <div className="col" style={{ gap: 10 }}>
            <ListaAulas
              aulas={[...assistidas]
                .sort((a, b) => (b.ultima || '').localeCompare(a.ultima || ''))
                .slice(0, vistasNaTela)
                .map((a) => ({ id: a.videoId, t: a.titulo, d: a.duracao, k: a.tipo, vezes: a.vezes, ultima: a.ultima }))}
              vistas={vistas}
              onTocar={(a) => tocar(a, origemDe('estudo', 'vistas'))}
              rodape={(a) => (
                <>
                  {a.vezes > 1 && <Chip tone="jade">visto {a.vezes}x</Chip>}
                  {a.ultima && <span className="micro muted">{relativo(a.ultima)}</span>}
                </>
              )}
            />
            {assistidas.length > vistasNaTela && (
              <Btn variant="ghost" onClick={() => setVistasNaTela((n) => n + 12)} style={{ alignSelf: 'center' }}>
                Mostrar mais ({assistidas.length - vistasNaTela})
              </Btn>
            )}
          </div>
        )
      )}

      <Player aula={tocando} onClose={() => setTocando(null)} onConcluir={marcarVista} />
      {aviso}
    </div>
  );
}

/* ---------- quanto vale estudar ----------
   A pessoa vê o "+15 pontos" depois da aula e não sabe de onde saiu.
   Aqui está a tabela inteira, com o teto de cada dia e o porquê de
   cada valor. Sai do mesmo cadastro que dá os pontos, então nunca
   fica desencontrado. */
function PontosDoEstudo({ aberto, onClose, cobrando }) {
  const itens = Object.values(EVENTOS).filter((e) => e.familia === 'estudo');
  return (
    <Sheet
      aberto={aberto} onClose={onClose}
      titulo="Quanto vale estudar" subtitulo="o que cada coisa dá de ponto, e por quê"
    >
      <div className="col" style={{ gap: 8 }}>
        {itens.map((e) => (
          <div key={e.id} className="card" style={{ background: 'var(--void)', padding: 12 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="tiny" style={{ fontWeight: 600, flex: 1 }}>{e.nome}</span>
              {e.premium && <Chip tone="roar">premium</Chip>}
              <span className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>+{e.xp}</span>
            </div>
            <p className="micro muted" style={{ marginTop: 5, lineHeight: 1.6 }}>
              {e.desc} Até {e.tetoDia} {e.tetoDia === 1 ? 'vez' : 'vezes'} por dia.
            </p>
          </div>
        ))}
      </div>
      <p className="micro muted" style={{ lineHeight: 1.7 }}>
        Os pontos abrem as fases da Jornada e contam na liga da semana, que fecha segunda ao meio-dia.
        O teto por dia existe pra ninguém liderar maratonando vídeo.
        {cobrando ? ` No plano grátis dá pra ver ${LIMITES.aulasPorDia} aula completa e ${LIMITES.shortsPorDia} aula rápida por dia.` : ''}
      </p>
    </Sheet>
  );
}

/* ---------- lista de aulas ----------
   Sempre com a capa grande, em qualquer aba: a aula é o produto,
   e miniatura de lado ao texto some no meio da tela. */
function ListaAulas({ aulas, vistas, onTocar, rodape = null }) {
  const v = new Set(vistas);
  if (!aulas.length) return <p className="tiny muted">Nenhuma aula pra mostrar aqui.</p>;
  return (
    <div className="grid g-cards" style={{ gap: 12 }}>
      {aulas.map((a) => (
        <button key={a.id} className="aula-card" onClick={() => onTocar(a)}>
          <div className="aula-capa">
            <Capa id={a.id} propria={a.capa} tamanho="mq" />
            <span className="aula-dur">{duracaoTexto(a.d)}</span>
            {v.has(a.id) && <span className="aula-visto"><Check size={11} /></span>}
            <span className="aula-play">{!ehLivre(a) && !jaComprou(a.id) ? <Lock size={15} /> : <Play size={16} />}</span>
          </div>
          <div className="aula-txt">
            <div className="aula-titulo">{a.t}</div>
            <div className="row wrap" style={{ gap: 5, marginTop: 6 }}>
              {a.k === 'short' ? <Chip>aula rápida</Chip> : <Chip tone="warn">aula</Chip>}
              {!ehLivre(a) && (
                <Chip tone="roar">
                  {jaComprou(a.id) ? 'sua' : a.acesso === 'assinantes' ? 'premium' : 'à parte'}
                </Chip>
              )}
              {a.tm?.includes('logica') && <Chip tone="ice">lógica</Chip>}
            </div>
            {a.porque?.length > 0 && (
              <div className="micro muted" style={{ marginTop: 6 }}>
                {a.generico ? 'em geral: ' : 'ensina '}{a.porque.join(' · ')}
              </div>
            )}
            {rodape && <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>{rodape(a)}</div>}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------- o player ---------- */
