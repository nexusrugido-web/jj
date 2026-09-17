import React, { useMemo, useState, useRef, useEffect } from 'react';
import Capa from '../components/Capa';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Play, Check, Clock, GraduationCap, Search, Filter,
  BookOpen, ChevronRight, X, Film, Layers, TriangleAlert, Lock,
} from 'lucide-react';
import { db } from '../db/db';
import Player from '../components/Player';
import { useApp } from '../contexto';
import {
  Card, Btn, Chip, Empty, Stat, Sheet, Busca, Bar, Seg, useToast,
} from '../components/UI';
import {
  aulasDoTema, aulasParaEstilo, aulasParaDor, aulasParaTecnica, aulaParaSituacao,
  resumoAcervo, capa, duracaoTexto, registrarAulaVista, aulasDeEntrada,
} from '../lib/aulas';
import { TEMAS_AULA, TEMA_POR_DOR } from '../db/aulas';
import { minhasTecnicas, meusBuracos } from '../lib/graus';
import { gerarRecomendacoes } from '../lib/recomendar';
import { estiloPorId } from '../db/scoring';
import { relativo } from '../lib/utils';
import Quiz from '../components/Quiz';
import { PERGUNTAS } from '../db/quiz';
import { useLimite } from '../components/Limite';
import { limitarLista, LIMITES, RECOMENDACOES_NA_TELA } from '../lib/plano';
import { jaComprou } from '../lib/pago';

export default function Estudo() {
  const { settings, rolls, partners, sessions, techniques, irPara, ligada, acesso, acervoVer } = useApp();
  const toast = useToast();
  const { liberarVideo, aviso } = useLimite(acesso, irPara);
  const faixa = settings.faixa || 'branca';

  const assistidas = useLiveQuery(() => db.aulasVistas.toArray(), [], []) || [];
  const vistas = useMemo(() => assistidas.map((a) => a.videoId), [assistidas]);

  const [aba, setAba] = useState('pravoce');
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
  async function tocar(a) {
    if (!a) return;
    if (await liberarVideo(a)) setTocando(a);
  }
  const [dorAberta, setDorAberta] = useState(null);

  const resumo = useMemo(() => resumoAcervo(vistas), [vistas, acervoVer]);

  const tecnicas = useMemo(
    () => minhasTecnicas(rolls, partners, sessions, techniques, faixa),
    [rolls, partners, sessions, techniques, faixa]
  );
  const buracos = useMemo(() => meusBuracos(rolls, partners, sessions, faixa), [rolls, partners, sessions, faixa]);
  const todasRecs = useMemo(
    () => gerarRecomendacoes({ tecnicas, buracos, partners, sessions, faixa, limite: RECOMENDACOES_NA_TELA }),
    [tecnicas, buracos, partners, sessions, faixa]
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

    /* Cada recomendação puxa aula do assunto dela, não do estilo
       genérico. Antes, recomendação sem técnica nomeada caía no
       estilo e vinha vídeo de guarda pra problema de defesa. */
    for (const r of recs) {
      const lista = aulaParaSituacao({
        tecnica: r.alvo || null,
        posicao: r.posicao || null,
        intencao: r.intencao,
        faixa,
        vistas: [...vistas, ...usados],
        quantidade: 2,
        soAula: true,
      });
      for (const a of lista) usados.add(a.id);
      if (lista.length) blocos.push({ motivo: r.titulo, texto: r.texto, aulas: lista });
    }

    if (settings.estiloDeclarado) {
      const lista = aulasParaEstilo(settings.estiloDeclarado, { faixa, vistas: [...vistas, ...usados], quantidade: 4 });
      if (lista.length) blocos.push({
        motivo: `Combina com o seu jogo`,
        texto: `Você marcou que joga ${estiloPorId(settings.estiloDeclarado).nome.toLowerCase()}. Estas aulas puxam pra esse lado.`,
        aulas: lista,
      });
    }
    return blocos;
  }, [recs, faixa, vistas, settings.estiloDeclarado, acervoVer]);

  /* quem ainda não registrou nada precisa de algo pra ver hoje,
     e não de um aviso dizendo que a tela enche depois */
  const entrada = useMemo(
    () => aulasDeEntrada({ faixa, vistas, quantidade: RECOMENDACOES_NA_TELA }),
    [faixa, vistas, acervoVer]
  );

  const doTema = useMemo(
    () => (tema ? aulasDoTema(tema, { faixa, vistas, busca, tipo, pagina }) : null),
    [tema, faixa, vistas, busca, tipo, pagina, acervoVer]
  );

  async function marcarVista(a, segundos) {
    const r = await registrarAulaVista(a, segundos);
    toast(r.xp ? `+${r.xp} pontos` : r.revisao ? 'Revisto' : 'Aula concluída');
  }


  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">entender o porquê, não decorar o passo</div>
          <h1 className="h-page">Estudo</h1>
        </div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="grid g4" style={{ gap: 12 }}>
          <Stat size="sm" icon={Film} valor={resumo.total} label="aulas no acervo" />
          <Stat size="sm" icon={Clock} valor={`${resumo.horas}h`} label="de conteúdo" />
          <Stat size="sm" icon={Check} valor={resumo.vistas} label="você já viu" tone={resumo.vistas ? 'jade' : undefined} />
          <Stat size="sm" valor={`${resumo.horasVistas}h`} label="estudadas" tone="accent" />
        </div>
        {resumo.vistas > 0 && (
          <div style={{ marginTop: 14 }}>
            <Bar v={resumo.vistas} max={resumo.total} tone="jade" />
            <p className="micro muted" style={{ marginTop: 7 }}>
              {resumo.pct}% do acervo. Não precisa ver tudo, o app escolhe o que faz sentido pra você agora.
            </p>
          </div>
        )}
      </Card>

      <Seg value={aba} onChange={(v) => { setAba(v); setTema(null); setPagina(0); }} options={[
        { id: 'pravoce', nome: 'Pra você' },
        { id: 'temas', nome: 'Por tema' },
        { id: 'dores', nome: 'Por dificuldade' },
        ...(ligada('quiz') ? [{ id: 'quiz', nome: 'Quiz' }] : []),
        { id: 'vistas', nome: `Vistas (${resumo.vistas})` },
      ]} />
      <div style={{ height: 14 }} />

      {/* ---------- pra você ---------- */}
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
            <ListaAulas aulas={entrada} vistas={vistas} onTocar={tocar} />
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
                <ListaAulas aulas={b.aulas} vistas={vistas} onTocar={tocar} />
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
              const n = aulasDoTema(t.id, { faixa, vistas, porPagina: 1 }).total;
              const vistos = aulasDoTema(t.id, { faixa, vistas, porPagina: 999 }).itens.filter((x) => x.vista).length;
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
                {[{ id: 'todos', nome: 'Tudo' }, { id: 'aula', nome: 'Aulas longas' }, { id: 'short', nome: 'Shorts' }].map((o) => (
                  <button key={o.id} className={tipo === o.id ? 'on' : ''} onClick={() => { setTipo(o.id); setPagina(0); }}>{o.nome}</button>
                ))}
              </div>
            </Card>
            <ListaAulas aulas={doTema.itens} vistas={vistas} onTocar={tocar} grade />
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
              Estas são as dificuldades que mais aparecem entre quem está começando. Escolha a que parece com a sua
              e o app monta uma trilha em cima dela.
            </p>
          </Card>
          <div className="col" style={{ gap: 12 }}>
            {Object.entries(TEMA_POR_DOR).map(([id, d]) => (
              <Card key={id} className="hover">
                <button
                  className="row"
                  style={{ width: '100%', gap: 12, textAlign: 'left' }}
                  onClick={() => setDorAberta(dorAberta === id ? null : id)}
                >
                  <span className="stat-ico"><Layers size={15} /></span>
                  <span className="tiny" style={{ flex: 1, fontWeight: 600 }}>{d.nome}</span>
                  <ChevronRight size={16} className="muted" style={{ transform: dorAberta === id ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                </button>
                {dorAberta === id && (
                  <div style={{ marginTop: 14 }}>
                    <ListaAulas aulas={aulasParaDor(id, { faixa, vistas, quantidade: 5 })} vistas={vistas} onTocar={tocar} />
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
            {[...assistidas].sort((a, b) => (b.ultima || '').localeCompare(a.ultima || '')).map((a) => (
              <button
                key={a.id}
                className="vista-item"
                onClick={() => tocar({ id: a.videoId, t: a.titulo, d: a.duracao, k: a.tipo })}
              >
                <Capa id={a.videoId} tamanho="mq" />
                <div className="vista-txt">
                  <div className="vista-titulo">{a.titulo}</div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <span className="micro muted num">{duracaoTexto(a.duracao)}</span>
                    {a.vezes > 1 && <Chip tone="jade">visto {a.vezes}x</Chip>}
                    {a.ultima && <span className="micro muted">{relativo(a.ultima)}</span>}
                  </div>
                </div>
                <span className="vista-play"><Play size={14} /></span>
              </button>
            ))}
          </div>
        )
      )}

      <Player aula={tocando} onClose={() => setTocando(null)} onConcluir={marcarVista} />
      {aviso}
    </div>
  );
}

/* ---------- lista de aulas ---------- */
function ListaAulas({ aulas, vistas, onTocar, grade = false }) {
  const v = new Set(vistas);
  if (!aulas.length) return <p className="tiny muted">Nenhuma aula pra mostrar aqui.</p>;
  return (
    <div className={grade ? 'grid g-cards' : 'col'} style={{ gap: grade ? 12 : 10 }}>
      {aulas.map((a) => (
        <button key={a.id} className="aula-card" onClick={() => onTocar(a)}>
          <div className="aula-capa">
            <Capa id={a.id} tamanho="mq" />
            <span className="aula-dur">{duracaoTexto(a.d)}</span>
            {v.has(a.id) && <span className="aula-visto"><Check size={11} /></span>}
            <span className="aula-play">{a.premium && !jaComprou(a.id) ? <Lock size={15} /> : <Play size={16} />}</span>
          </div>
          <div className="aula-txt">
            <div className="aula-titulo">{a.t}</div>
            <div className="row wrap" style={{ gap: 5, marginTop: 6 }}>
              {a.k === 'short' ? <Chip>short</Chip> : <Chip tone="warn">aula</Chip>}
              {a.premium && <Chip tone="roar">{jaComprou(a.id) ? 'sua' : 'à parte'}</Chip>}
              {a.f && <Chip>{a.f}</Chip>}
              {a.tm?.includes('logica') && <Chip tone="ice">lógica</Chip>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------- o player ---------- */
