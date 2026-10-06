import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Award, TrendingUp, TrendingDown, Minus, Swords, Info, ChevronRight, ShieldAlert, Check,
  Dumbbell, ListChecks, Scale, Lock,
} from 'lucide-react';
import Guia, { Linha } from '../components/Guia';
import { db } from '../db/db';
import { useApp } from '../contexto';
import { Card, Btn, Chip, Empty, Stat, Sheet, Busca, Bar } from '../components/UI';
import {
  minhasTecnicas, meusBuracos, resumoGraus, jogoPrincipal,
  GRAUS, grauPorN, TENDENCIAS, contextoPorId, requisitosDaFaixa, vezesNaPosicao,
} from '../lib/graus';
import { Ponteira } from '../components/Ponteira';
import { faltaPara, recomendacoesDoAluno, aderencia } from '../lib/recomendar';
import Recomendacao, { VitrineRecomendacao } from '../components/Recomendacao';
import { buscaMatch, relativo } from '../lib/utils';
import { posInicialPorId } from '../db/scoring';
import { podeVer, RECOMENDACOES_NA_TELA, pedirOferta } from '../lib/plano';
import { ehPosicao, repertorioPorPosicao } from '../lib/posicoes';
import { golpeDe, nomeDoGolpe } from '../lib/golpes';

export default function Dominio() {
  const { rolls, partners, sessions, techniques, categories, positions, goals, gradings, settings, irPara, acesso } = useApp();
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState(null);
  const [comoFunciona, setComoFunciona] = useState(false);

  const faixa = settings.faixa || 'branca';
  const feitas = useLiveQuery(() => db.recFeitas.toArray(), [], []) || [];
  const vistas = useLiveQuery(() => db.aulasVistas.toArray(), [], []) || [];

  const tecnicas = useMemo(
    () => minhasTecnicas(rolls, partners, sessions, techniques, faixa, gradings, settings.graus || 0, { comPosicoes: true }),
    [rolls, partners, sessions, techniques, faixa, gradings, settings.graus]
  );
  const buracos = useMemo(() => meusBuracos(rolls, partners, sessions, faixa), [rolls, partners, sessions, faixa]);

  /* posição (De La Riva, Montada) não é golpe: fica na seção dela, com o
     grau que já tinha guardado, e não entra na conta das técnicas */
  const posicaoDoNome = useMemo(() => {
    const slug = Object.fromEntries(positions.map((p) => [p.id, p.slug]));
    return new Map(techniques.filter(ehPosicao).map((t) => [t.nome, slug[t.origemId]]));
  }, [techniques, positions]);
  const soTecnicas = useMemo(() => tecnicas.filter((t) => !posicaoDoNome.has(t.nome)), [tecnicas, posicaoDoNome]);
  const secaoPosicoes = useMemo(() => {
    const rep = Object.fromEntries(repertorioPorPosicao({ rolls, sessions, techniques, categories, positions }).map((p) => [p.slug, p]));
    const linhas = new Map();
    const linha = (slug) => {
      const p = positions.find((x) => x.slug === slug);
      if (!p) return null;
      if (!linhas.has(slug)) linhas.set(slug, { slug, nome: p.nome, aulas: 0, grau: 0, ficha: null, rep: rep[slug] || null });
      return linhas.get(slug);
    };
    for (const s of sessions) {
      const temas = new Set([...(s.focoPosicoes || []), ...(s.focoTecnicas || []).map((f) => posicaoDoNome.get(f.nome)).filter(Boolean)]);
      for (const slug of temas) { const l = linha(slug); if (l) l.aulas++; }
    }
    for (const t of tecnicas) {
      const l = posicaoDoNome.has(t.nome) && linha(posicaoDoNome.get(t.nome));
      if (l && t.grau >= l.grau) { l.grau = t.grau; l.ficha = t; }
    }
    return [...linhas.values()].sort((a, b) => ((b.rep?.usos || 0) - (a.rep?.usos || 0)) || (b.aulas - a.aulas));
  }, [rolls, sessions, techniques, categories, positions, tecnicas, posicaoDoNome]);

  const resumo = useMemo(() => resumoGraus(soTecnicas), [soTecnicas]);
  const principal = useMemo(() => jogoPrincipal(soTecnicas), [soTecnicas]);
  /* as outras origens do mesmo golpe (armlock da guarda, da montada...) */
  const variacoesDoGolpe = (nome) => {
    const g = golpeDe(nome);
    if (!g) return null;
    const fin = new Set(categories.filter((c) => ['estrangulamento', 'articular', 'perna'].includes(c.slug)).map((c) => c.id));
    const minhas = new Map(soTecnicas.map((t) => [t.nome, t]));
    const outras = techniques.filter((t) => fin.has(t.categoriaId) && t.nome !== nome && golpeDe(t.nome) === g)
      .map((t) => ({ nome: t.nome, minha: minhas.get(t.nome) || null }))
      .sort((a, b) => (b.minha?.usosResistencia || 0) - (a.minha?.usosResistencia || 0));
    return outras.length ? { golpe: nomeDoGolpe(g), outras } : null;
  };
  const todasRecs = useMemo(
    () => recomendacoesDoAluno({ tecnicas, buracos, partners, sessions, rolls, faixa, feitas, limite: RECOMENDACOES_NA_TELA }),
    [tecnicas, buracos, partners, sessions, rolls, faixa, feitas]
  );

  /* no grátis "o que treinar agora" vira vitrine: sai dos rolas, é do Premium */
  const recsLivres = podeVer(acesso, 'recomendacoes');
  const recs = todasRecs;
  const adesao = useMemo(() => aderencia(feitas), [feitas]);
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const lista = useMemo(() => soTecnicas.filter((t) => {
    if (filtro !== 'todas' && String(t.grau) !== filtro) return false;
    return buscaMatch(`${t.nome} ${t.nomeEn}`, busca);
  }), [soTecnicas, filtro, busca]);

  if (!tecnicas.length && !secaoPosicoes.length) {
    return (
      <div className="page">
        <Cabecalho onComo={() => setComoFunciona(true)} />
        <Card>
          <Empty
            icon={Award}
            titulo="Suas técnicas aparecem aqui"
            texto="Esta tela não te pergunta o que você sabe. Ela olha o que você fez nos treinos. Marque as técnicas da aula e o que você encaixou nos rolas, que a lista se monta sozinha."
            acao={<Btn variant="primary" icon={Swords} onClick={() => irPara('treinos')}>Registrar treino</Btn>}
          />
        </Card>
        <ComoFunciona aberto={comoFunciona} onClose={() => setComoFunciona(false)} faixa={faixa} graus={settings.graus || 0} />
      </div>
    );
  }

  return (
    <div className="page">
      <Cabecalho onComo={() => setComoFunciona(true)} />

      {/* os graus */}
      {/* o arsenal num cartão só; cada grau filtra a lista ao ser tocado */}
      <Card className="arsenal" style={{ marginBottom: 14 }}>
        {[4, 3, 2, 1].map((n) => {
          const g = grauPorN(n);
          const ativo = filtro === String(n);
          return (
            <button key={n} type="button" className={`arsenal-cel ${ativo ? 'on' : ''}`} aria-pressed={ativo}
              onClick={() => setFiltro(ativo ? 'todas' : String(n))}>
              <Ponteira n={n} />
              <span className="arsenal-num num" style={{ color: `var(--${g.cor})` }}>{resumo[`g${n}`]}</span>
              <span className="arsenal-lab">{g.curto}</span>
            </button>
          );
        })}
      </Card>

      {/* o que fazer agora */}
      {recs.length > 0 && (
        <Card className="accent" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">sai dos seus registros</div>
              <h2 className="h-sec">O que treinar agora</h2>
            </div>
          </div>
          {recsLivres ? (
            <div className="col" style={{ gap: 10 }}>
              {recs.map((r, i) => (
                <Recomendacao
                  key={`${r.intencao}:${r.alvo || i}`}
                  rec={r}
                  tela="dominio"
                  faixa={faixa}
                  vistas={vistas.map((v) => v.videoId)}
                />
              ))}
            </div>
          ) : (
            <VitrineRecomendacao recs={recs} faixa={faixa} vistas={vistas.map((v) => v.videoId)} onAssinar={() => pedirOferta('recomendacoes')} />
          )}

          {adesao && adesao.total >= 2 && (
            <p className="micro muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
              No último mês você estudou {adesao.total} das coisas que apareceram aqui. O app segue
              ajustando pelo que você assiste e pelo que aparece nos seus rolas.
            </p>
          )}
        </Card>
      )}

      {/* onde você apanha */}
      {buracos.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: 'color-mix(in srgb, var(--blood) 26%, var(--seam))' }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">contado separado do seu ataque</div>
              <h2 className="h-sec row" style={{ gap: 8 }}>
                <ShieldAlert size={16} style={{ color: 'var(--blood)' }} /> Onde você apanha
              </h2>
            </div>
          </div>
          <p className="tiny muted" style={{ marginBottom: 12 }}>
            Levar uma técnica não derruba o grau da sua. São coisas diferentes, e aqui ficam só as que te pegam.
          </p>
          <div className="col" style={{ gap: 10 }}>
            {buracos.map((b) => (
              <div key={b.nome} className="row wrap" style={{ gap: 8, padding: '10px 12px', background: 'var(--void)', borderRadius: 10 }}>
                <span className="tiny" style={{ flex: 1, fontWeight: 600, minWidth: 120 }}>{b.nome}</span>
                <span className="micro muted">
                  {b.vezes} {b.vezes === 1 ? 'vez' : 'vezes'}
                  {b.recente > 0 && `, ${b.recente} no último mês`}
                  {b.inicioComum && `, quase sempre em rola que começou de ${posInicialPorId[b.inicioComum.id]?.nome || 'uma mesma posição'}`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* seu jogo */}
      {principal.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">o que mais aparece nos seus rolas</div>
              <h2 className="h-sec">Seu jogo</h2>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            {principal.map((t) => {
              const g = grauPorN(t.grau);
              return (
                <button key={t.nome} className="chip" onClick={() => setDetalhe(t)}
                  style={{ color: `var(--${g.cor})`, borderColor: `color-mix(in srgb, var(--${g.cor}) 40%, var(--seam))` }}>
                  {t.nome} <Ponteira n={t.grau} mini />
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 14 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <Busca value={busca} onChange={setBusca} placeholder="Buscar nas suas técnicas" />
        </div>
        <div className="chips-scroll" style={{ marginTop: 10 }}>
          <button className={`chip ${filtro === 'todas' ? 'on' : ''}`} onClick={() => setFiltro('todas')}>Todas</button>
          {[4, 3, 2, 1].map((n) => (
            <button key={n} className={`chip ${filtro === String(n) ? 'on' : ''}`} onClick={() => setFiltro(String(n))}>
              {grauPorN(n).nome}
            </button>
          ))}
        </div>
      </Card>

      <div className="trilha">
        {lista.map((t) => {
          const g = grauPorN(t.grau);
          const falta = faltaPara(t, faixa);
          const cat = catById[t.categoriaId];
          const tend = TENDENCIAS[t.tendencia];
          /* posição (100kg, montada): no rola conta quando um ponto te levou até ela */
          const naPosicao = t.soDrill ? vezesNaPosicao(t.nome, rolls, sessions) : null;
          return (
            <button key={t.nome} className="trilha-item" onClick={() => setDetalhe(t)}>
              <span className="trilha-selo" style={{ color: `var(--${g.cor})` }}>
                <Ponteira n={t.grau} vertical />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{t.nome}</span>
                  <Chip tone={g.cor === 'dim' || g.cor === 'dimmer' ? '' : g.cor}>{g.curto}</Chip>
                  {t.tendencia !== 'novo' && t.tendencia !== 'estavel' && (
                    <span className="micro" style={{ color: `var(--${tend.cor})` }}>{tend.seta} {tend.nome}</span>
                  )}
                </div>
                <div className="micro muted" style={{ marginTop: 3 }}>
                  {naPosicao > 0
                    ? `${t.usosDrill} ${t.usosDrill === 1 ? 'vez' : 'vezes'} no drill, e no rola você chegou nela ${naPosicao} ${naPosicao === 1 ? 'vez' : 'vezes'}`
                    : t.soDrill
                    ? `${t.usosDrill} ${t.usosDrill === 1 ? 'vez' : 'vezes'} no drill, nenhuma no rola`
                    : `${t.usosResistencia} ${t.usosResistencia === 1 ? 'vez' : 'vezes'} no rola, em ${t.transferencia} ${t.transferencia === 1 ? 'pessoa' : 'pessoas'}`}
                  {t.ultima && `, ${relativo(t.ultima)}`}
                </div>
                {falta && t.grau < 4 && (
                  <>
                    <div className="trilha-barra">
                      <i style={{ width: `${Math.max(3, t.progresso)}%`, background: `var(--${grauPorN(t.proximo).cor})` }} />
                    </div>
                    <div className="micro" style={{ color: 'var(--dimmer)', marginTop: 4 }}>{falta.resumo}</div>
                  </>
                )}
              </div>
              <ChevronRight size={16} className="muted" />
            </button>
          );
        })}
      </div>

      {secaoPosicoes.length > 0 && (
        <Card style={{ margin: '14px 0' }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">guardas e posições, contadas separado das técnicas</div>
              <h2 className="h-sec">Posições</h2>
            </div>
          </div>
          <div className="col" style={{ gap: 4 }}>
            {secaoPosicoes.map((p) => {
              const conteudo = (
                <>
                  <span className="trilha-selo" style={{ color: `var(--${grauPorN(p.grau).cor})` }}>
                    <Ponteira n={p.grau} vertical />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{p.nome}</span>
                      {p.ficha && <Chip>{grauPorN(p.grau).curto}</Chip>}
                    </div>
                    <div className="micro muted" style={{ marginTop: 3 }}>
                      {[
                        p.aulas > 0 && `${p.aulas} ${p.aulas === 1 ? 'aula' : 'aulas'} de tema`,
                        p.rep ? `${p.rep.tecnicas.length} ${p.rep.tecnicas.length === 1 ? 'saída entra' : 'saídas entram'} no rola, ${p.rep.usos}x` : 'nenhuma saída dela no rola ainda',
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {p.ficha ? <ChevronRight size={16} className="muted" /> : <span />}
                </>
              );
              return p.ficha
                ? <button key={p.slug} type="button" className="trilha-item" onClick={() => setDetalhe(p.ficha)}>{conteudo}</button>
                : <div key={p.slug} className="trilha-item">{conteudo}</div>;
            })}
          </div>
        </Card>
      )}

      <Detalhe
        t={detalhe} onClose={() => setDetalhe(null)}
        variacoes={detalhe ? variacoesDoGolpe(detalhe.nome) : null}
        onAbrir={setDetalhe}
        cat={detalhe ? catById[detalhe.categoriaId] : null}
        faixa={faixa} graus={settings.graus || 0} partners={partners} sessions={sessions} goals={goals}
      />
      <ComoFunciona aberto={comoFunciona} onClose={() => setComoFunciona(false)} faixa={faixa} graus={settings.graus || 0} />
    </div>
  );
}


function Cabecalho({ onComo }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="h-page">Minhas técnicas</h1>
      </div>
      <Btn icon={Info} onClick={onComo}>Como funciona</Btn>
    </div>
  );
}

/* ================= a ficha da técnica ================= */
function Detalhe({ t, onClose, cat, faixa, graus = 0, partners, sessions, goals, variacoes = null, onAbrir }) {
  if (!t) return null;
  const g = grauPorN(t.grau);
  const falta = faltaPara(t, faixa);
  const req = requisitosDaFaixa(faixa, 'v2', graus);
  const tend = TENDENCIAS[t.tendencia];
  const nomeP = (id) => partners.find((p) => p.id === id)?.nome || 'esse parceiro';

  const emAula = sessions.reduce((a, s) =>
    a + (s.focoTecnicas || []).filter((f) => f.nome === t.nome).length, 0);
  const peguei = sessions.reduce((a, s) =>
    a + (s.focoTecnicas || []).filter((f) => f.nome === t.nome && f.aprendizado === 'peguei').length, 0);
  const comMeta = goals.filter((x) => x.alvo === t.nome && x.status !== 'concluida' && x.origem !== 'sugerida');

  const porFaixa = {};
  for (const h of t.historico.filter((x) => contextoPorId(x.contexto).evidencia === 'resistencia')) {
    const f = h.faixaParceiro || 'faixa não marcada';
    porFaixa[f] = (porFaixa[f] || 0) + 1;
  }

  return (
    <Sheet aberto={!!t} onClose={onClose} titulo={t.nome} subtitulo={t.nomeEn || cat?.nome} wide>
      <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="ficha-selo" style={{ borderColor: `color-mix(in srgb, var(--${g.cor}) 45%, var(--seam))` }}>
          <Ponteira n={t.grau} />
          <div className="ficha-grau" style={{ color: `var(--${g.cor})` }}>{g.nome}</div>
        </div>
        <div style={{ flex: 1, minWidth: 170 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{g.curto}</div>
          <p className="tiny muted" style={{ marginTop: 4 }}>{g.frase}</p>
        </div>
      </div>

      {falta && t.grau < 4 && (
        <div className="card" style={{ background: 'var(--void)' }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="eyebrow">próximo grau</span>
            <span className="spacer" />
            <span className="num micro" style={{ color: `var(--${falta.alvo.cor})` }}>{t.progresso}% do caminho</span>
          </div>
          <Bar v={t.progresso} max={100} tone={falta.alvo.cor === 'dim' ? '' : falta.alvo.cor} />
          <p className="tiny" style={{ marginTop: 11, lineHeight: 1.65 }}>{falta.texto}</p>
        </div>
      )}

      <div>
        <div className="eyebrow" style={{ marginBottom: 9 }}>o que conta pro grau dela</div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 10 }}>
          <Card style={{ padding: 12 }}><Stat size="sm" valor={t.usosResistencia} label="vezes no rola" tone="jade" /></Card>
          <Card style={{ padding: 12 }}><Stat size="sm" valor={t.transferencia} label="pessoas" /></Card>
          <Card style={{ padding: 12 }}><Stat size="sm" valor={t.semanas} label="semanas diferentes" /></Card>
          <Card style={{ padding: 12 }}><Stat size="sm" valor={t.meses} label="meses diferentes" /></Card>
          <Card style={{ padding: 12 }}><Stat size="sm" valor={t.contraAcima} label="em faixa acima" tone={t.contraAcima ? 'roar' : undefined} /></Card>
          <Card style={{ padding: 12 }}><Stat size="sm" valor={t.usosDrill} label="no treino técnico" /></Card>
        </div>
        <p className="micro muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
          Cada encaixe vale mais quando o parceiro é de faixa acima da sua ou mais pesado que você.
        </p>
      </div>

      {t.refinamento >= 3 && t.melhorParceiro && (
        <div className="valida bom">
          <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>Ela sobrevive a quem já te conhece</div>
            <p className="micro muted" style={{ marginTop: 4 }}>
              Você encaixou {t.refinamento} vezes no {nomeP(t.melhorParceiro)}. Ele já viu sua entrada e você continua
              encaixando, o que é mais difícil do que estrear em alguém novo.
            </p>
          </div>
        </div>
      )}

      {t.usosDrill > 0 && (
        <div className="row wrap" style={{ gap: 8 }}>
          <Chip><Dumbbell size={11} /> {t.usosDrill} no drill</Chip>
          <Chip tone="jade">{t.usosResistencia} com resistência</Chip>
          {t.soDrill && <Chip tone="warn">ainda não testada no rola</Chip>}
        </div>
      )}

      {Object.keys(porFaixa).length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 9 }}>contra cada faixa</div>
          <div className="col" style={{ gap: 7 }}>
            {Object.entries(porFaixa).map(([f, n]) => (
              <div key={f} className="row" style={{ gap: 10, padding: '8px 11px', background: 'var(--void)', borderRadius: 10 }}>
                <span className="tiny" style={{ flex: 1, textTransform: 'capitalize' }}>{f}</span>
                <span className="num micro">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {t.tendencia !== 'novo' && (
        <div className={`valida ${t.tendencia === 'melhorando' ? 'bom' : t.tendencia === 'enferrujando' ? 'ruim' : 'atencao'}`}>
          <span className="valida-ico">
            {t.tendencia === 'melhorando' ? <TrendingUp size={15} /> : t.tendencia === 'enferrujando' ? <TrendingDown size={15} /> : <Minus size={15} />}
          </span>
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>{tend.nome}</div>
            <p className="micro muted" style={{ marginTop: 3 }}>
              {t.tendencia === 'melhorando'
                ? 'Ela apareceu mais nas últimas semanas do que antes. Está entrando no seu jogo.'
                : t.tendencia === 'enferrujando'
                  ? 'Ela aparecia mais antes. Ou você parou de buscar, ou o pessoal já leu essa entrada.'
                  : 'O uso tem se mantido parecido ao longo do tempo.'}
            </p>
          </div>
        </div>
      )}

      {(emAula > 0 || comMeta.length > 0 || t.sofriTambem > 0) && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 9 }}>onde ela aparece</div>
          <div className="col" style={{ gap: 7 }}>
            {emAula > 0 && (
              <div className="ficha-linha">
                <span className="tiny">Treinada em aula</span>
                <span className="num micro" style={{ color: 'var(--accent)' }}>
                  {emAula}x{peguei > 0 && `, pegou ${peguei}`}
                </span>
              </div>
            )}
            {comMeta.length > 0 && (
              <div className="ficha-linha">
                <span className="tiny">Tem meta sua ligada a ela</span>
                <span className="num micro" style={{ color: 'var(--jade)' }}>{comMeta.length}</span>
              </div>
            )}
            {t.sofriTambem > 0 && (
              <div className="ficha-linha">
                <span className="tiny">Você também já levou essa</span>
                <span className="num micro" style={{ color: 'var(--blood)' }}>{t.sofriTambem}x</span>
              </div>
            )}
          </div>
          {t.sofriTambem > 0 && (
            <p className="micro muted" style={{ marginTop: 9 }}>
              Ter levado não muda o grau da sua. Atacar e defender são coisas separadas aqui.
            </p>
          )}
        </div>
      )}

      {variacoes && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 9 }}>o mesmo {variacoes.golpe.toLowerCase()}, de outro lugar</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {[...variacoes.outras.filter((v) => v.minha), ...variacoes.outras.filter((v) => !v.minha).slice(0, 4)].map((v) => (v.minha
              ? <button key={v.nome} type="button" className="chip on" onClick={() => onAbrir(v.minha)}>{v.nome} <Ponteira n={v.minha.grau} mini /></button>
              : <span key={v.nome} className="chip" style={{ opacity: 0.6 }}>{v.nome}</span>))}
            {variacoes.outras.filter((v) => !v.minha).length > 4 && (
              <span className="chip" style={{ opacity: 0.6 }}>e mais {variacoes.outras.filter((v) => !v.minha).length - 4}</span>
            )}
          </div>
          <p className="micro muted" style={{ marginTop: 9, lineHeight: 1.6 }}>
            Cada origem tem o grau dela: o {variacoes.golpe.toLowerCase()} que entra da guarda não garante o que sai de outra posição.
          </p>
        </div>
      )}
    </Sheet>
  );
}

/* ================= explicação ================= */
function ComoFunciona({ aberto, onClose, faixa, graus = 0 }) {
  const req = requisitosDaFaixa(faixa, 'v2', graus);
  return (
    <Sheet aberto={aberto} onClose={onClose} titulo="Como os graus funcionam" wide>
      <p className="tiny muted" style={{ lineHeight: 1.65 }}>
        Cada técnica tem uma ponteira de quatro graus, igual à da faixa. Ela sobe porque apareceu nos seus treinos,
        não porque você marcou que sabe.
      </p>

      <Guia
        inicial="graus"
        topicos={[
          {
            id: 'graus', icone: Award, titulo: 'Os quatro graus', resumo: 'Da primeira vez até a Assinatura',
            conteudo: (
              <div className="col" style={{ gap: 8 }}>
                {GRAUS.slice(1).map((g) => (
                  <div key={g.n} className="guia-linha">
                    <div className="row" style={{ gap: 10, marginBottom: 5 }}>
                      <Ponteira n={g.n} />
                      <span className="tiny" style={{ fontWeight: 700, color: `var(--${g.cor})` }}>{g.nome}</span>
                      <span className="spacer" />
                      <span className="micro muted">{g.curto}</span>
                    </div>
                    <p className="micro muted" style={{ lineHeight: 1.6 }}>{g.frase}</p>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: 'pede', icone: ListChecks, titulo: 'O que cada grau pede',
            resumo: `Os números da faixa ${faixa}${graus ? ` com ${graus} ${graus === 1 ? 'grau' : 'graus'}` : ''}`,
            conteudo: (
              <>
                <div className="col" style={{ gap: 6 }}>
                  <Linha nome="1º grau" detalhe="Apareceu uma vez, até no treino técnico." />
                  <Linha nome="2º grau" detalhe={`Saiu ${req[2].usos} vezes no rola, com alguém tentando impedir.`} />
                  <Linha nome="3º grau" detalhe={`Saiu ${req[3].usos} vezes, em pelo menos ${req[3].transferencia} pessoas e em ${req[3].semanas} semanas diferentes${req[3].acima ? ', com uma delas em faixa acima da sua' : ''}.`} />
                  <Linha nome="4º grau" detalhe={`Saiu ${req[4].usos} vezes, em pelo menos ${req[4].transferencia} pessoas, em ${req[4].meses} meses diferentes e ${req[4].acima} vezes em faixa acima da sua.`} />
                </div>
                <p>Treinar sempre com o mesmo grupo não trava ninguém: duas pessoas já bastam pro 3º grau.</p>
              </>
            ),
          },
          {
            id: 'uso', icone: Scale, titulo: 'Quanto vale cada uso', resumo: 'Onde, contra quem e quando saiu',
            conteudo: (
              <>
                <p>Encaixar cinco vezes no mesmo colega não é igual a encaixar em cinco pessoas, e nenhuma das duas é igual a encaixar num faixa roxa. Cada uso pesa por cinco coisas:</p>
                <div className="col" style={{ gap: 6 }}>
                  <Linha nome="Onde aconteceu" detalhe="No treino técnico a técnica chega no 1º grau. É no rola, com o parceiro tentando impedir, que ela sobe. Competição vale mais." />
                  <Linha nome="A faixa do parceiro" detalhe="Quanto mais graduado, mais o uso pesa. A Assinatura pede encaixes em quem tem mais tempo que você." />
                  <Linha nome="O peso dele" detalhe="Raspar alguém bem mais pesado pede alavanca e tempo. Conta a favor." />
                  <Linha nome="Em quantas pessoas" detalhe="Funcionar em gente diferente mostra que a técnica não depende de um corpo só." />
                  <Linha nome="Quando saiu" detalhe="Do 3º grau em diante ela precisa sair em semanas diferentes, e a Assinatura pede meses." />
                </div>
              </>
            ),
          },
          {
            id: 'nao', icone: ShieldAlert, titulo: 'O que não entra na conta', resumo: 'Levar a técnica não mexe no grau',
            conteudo: <p>Ter levado a técnica vai pra "Onde você apanha" e mostra onde trabalhar a defesa, sem mexer no grau do seu ataque.</p>,
          },
          {
            id: 'fica', icone: Lock, titulo: 'O grau conquistado fica', resumo: 'Uma técnica nunca desce de grau',
            conteudo: <p>Quando você pega faixa nova, a régua do próximo grau sobe, mas o que você já conquistou continua seu.</p>,
          },
          {
            id: 'regua', icone: TrendingUp, titulo: 'A régua sobe com a graduação', resumo: 'O que é notável na branca é rotina na roxa',
            conteudo: <p>Cada grau que o professor te dá sobe um pouco a exigência, e a faixa nova sobe de vez. Registre a graduação na tela de Conquistas pra régua acompanhar.</p>,
          },
        ]}
      />
    </Sheet>
  );
}
