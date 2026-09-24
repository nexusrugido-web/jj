import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Award, TrendingUp, TrendingDown, Minus, Swords, Target, Info,
  ChevronRight, ShieldAlert, Check, Dumbbell,
} from 'lucide-react';
import { db } from '../db/db';
import { useApp } from '../contexto';
import { Card, Btn, Chip, Empty, Stat, Sheet, Busca, Bar } from '../components/UI';
import {
  minhasTecnicas, meusBuracos, resumoGraus, jogoPrincipal,
  GRAUS, grauPorN, TENDENCIAS, contextoPorId, requisitosDaFaixa,
} from '../lib/graus';
import { Ponteira } from '../components/Ponteira';
import { faltaPara, recomendacoesDoAluno, INTENCOES, aderencia } from '../lib/recomendar';
import Recomendacao from '../components/Recomendacao';
import { buscaMatch, relativo } from '../lib/utils';
import { posInicialPorId } from '../db/scoring';
import { limitarLista, LIMITES, RECOMENDACOES_NA_TELA } from '../lib/plano';

export default function Dominio() {
  const { rolls, partners, sessions, techniques, categories, goals, gradings, settings, irPara, acesso } = useApp();
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState(null);
  const [comoFunciona, setComoFunciona] = useState(false);

  const faixa = settings.faixa || 'branca';
  const feitas = useLiveQuery(() => db.recFeitas.toArray(), [], []) || [];
  const vistas = useLiveQuery(() => db.aulasVistas.toArray(), [], []) || [];

  const tecnicas = useMemo(
    () => minhasTecnicas(rolls, partners, sessions, techniques, faixa, gradings),
    [rolls, partners, sessions, techniques, faixa, gradings]
  );
  const buracos = useMemo(() => meusBuracos(rolls, partners, sessions, faixa), [rolls, partners, sessions, faixa]);
  const resumo = useMemo(() => resumoGraus(tecnicas), [tecnicas]);
  const principal = useMemo(() => jogoPrincipal(tecnicas), [tecnicas]);
  const todasRecs = useMemo(
    () => recomendacoesDoAluno({ tecnicas, buracos, partners, sessions, rolls, faixa, feitas, limite: RECOMENDACOES_NA_TELA }),
    [tecnicas, buracos, partners, sessions, rolls, faixa, feitas]
  );

  /* no grátis abre uma, e o resto vira o tamanho do que falta */
  const { itens: recs, cortados } = useMemo(
    () => limitarLista(todasRecs, acesso, LIMITES.recomendacoesAbertas),
    [todasRecs, acesso]
  );
  const adesao = useMemo(() => aderencia(feitas), [feitas]);
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const lista = useMemo(() => tecnicas.filter((t) => {
    if (filtro !== 'todas' && String(t.grau) !== filtro) return false;
    return buscaMatch(`${t.nome} ${t.nomeEn}`, busca);
  }), [tecnicas, filtro, busca]);

  if (!tecnicas.length) {
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
        <ComoFunciona aberto={comoFunciona} onClose={() => setComoFunciona(false)} faixa={faixa} />
      </div>
    );
  }

  return (
    <div className="page">
      <Cabecalho onComo={() => setComoFunciona(true)} />

      {/* os graus */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', marginBottom: 14 }}>
        {[4, 3, 2, 1].map((n) => {
          const g = grauPorN(n);
          const ativo = filtro === String(n);
          return (
            <Card key={n} className="hover pointer"
              onClick={() => setFiltro(ativo ? 'todas' : String(n))}
              style={{ borderColor: ativo ? `color-mix(in srgb, var(--${g.cor}) 45%, var(--seam))` : undefined }}>
              <div className="row" style={{ gap: 8, marginBottom: 7 }}>
                <Ponteira n={n} />
              </div>
              <div className="stat-val num sm" style={{ color: `var(--${g.cor})` }}>{resumo[`g${n}`]}</div>
              <div className="stat-lab">{g.curto}</div>
            </Card>
          );
        })}
      </div>

      {/* o que fazer agora */}
      {recs.length > 0 && (
        <Card className="accent" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">sai dos seus registros</div>
              <h2 className="h-sec">O que treinar agora</h2>
            </div>
          </div>
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

          {cortados > 0 && (
            <button className="valida atencao" onClick={() => irPara('ajustes')} style={{ width: '100%', textAlign: 'left', marginTop: 12 }}>
              <p className="micro muted" style={{ lineHeight: 1.65 }}>
                O app achou mais {cortados} {cortados === 1 ? 'coisa' : 'coisas'} pra você treinar a partir dos seus
                registros. No plano grátis abre uma por vez. Toque aqui pra ver o premium.
              </p>
            </button>
          )}

          {adesao && adesao.total >= 2 && (
            <p className="micro muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
              No último mês você treinou {adesao.total} das coisas que apareceram aqui,
              {adesao.funcionou > 0
                ? ` e ${adesao.funcionou} ${adesao.funcionou === 1 ? 'funcionou' : 'funcionaram'}.`
                : ' e o app segue ajustando conforme você marca.'}
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
                  {t.soDrill
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

      <Detalhe
        t={detalhe} onClose={() => setDetalhe(null)}
        cat={detalhe ? catById[detalhe.categoriaId] : null}
        faixa={faixa} partners={partners} sessions={sessions} goals={goals}
      />
      <ComoFunciona aberto={comoFunciona} onClose={() => setComoFunciona(false)} faixa={faixa} />
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
function Detalhe({ t, onClose, cat, faixa, partners, sessions, goals }) {
  if (!t) return null;
  const g = grauPorN(t.grau);
  const falta = faltaPara(t, faixa);
  const req = requisitosDaFaixa(faixa);
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
    </Sheet>
  );
}

/* ================= explicação ================= */
function ComoFunciona({ aberto, onClose, faixa }) {
  const req = requisitosDaFaixa(faixa);
  return (
    <Sheet aberto={aberto} onClose={onClose} titulo="Como os graus funcionam" wide>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        Cada técnica tem uma ponteira de quatro graus, igual à da faixa. Ela não sobe porque você marcou que sabe,
        sobe porque apareceu nos seus treinos.
      </p>

      <div className="col" style={{ gap: 10 }}>
        {GRAUS.slice(1).map((g) => (
          <div key={g.n} className="card" style={{ background: 'var(--void)', padding: 13 }}>
            <div className="row" style={{ gap: 10, marginBottom: 7 }}>
              <Ponteira n={g.n} />
              <span className="tiny" style={{ fontWeight: 700, color: `var(--${g.cor})` }}>{g.nome}</span>
              <span className="spacer" />
              <span className="micro muted">{g.curto}</span>
            </div>
            <p className="micro muted" style={{ lineHeight: 1.6 }}>{g.frase}</p>
          </div>
        ))}
      </div>

      <div className="divider" />
      <div className="eyebrow">o que o app olha em cada uso</div>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        Encaixar cinco vezes no mesmo colega de sempre não é a mesma coisa que encaixar cinco vezes em pessoas
        diferentes, e nenhuma das duas é igual a encaixar num faixa roxa. Por isso cada uso vale um tanto,
        dependendo de cinco coisas.
      </p>

      <div className="col" style={{ gap: 9 }}>
        {[
          ['Onde aconteceu', 'Treinar com o parceiro colaborando constrói o movimento e coloca a técnica no 1º grau. Encaixar no rola, com ele tentando impedir, é o que faz subir. Competição vale ainda mais.', 'ice'],
          ['A faixa do parceiro', 'Encaixar num azul não é o mesmo que encaixar num branca. Quanto mais graduado, mais aquele uso pesa. Pra chegar na Assinatura, uma parte dos encaixes tem que ser em quem tem mais tempo que você.', 'roar'],
          ['O peso dele', 'Raspar alguém bem mais pesado exige alavanca e timing que não são necessários contra alguém do seu tamanho. Isso conta a favor.', 'roar'],
          ['Em quantas pessoas saiu', 'Cada parceiro tem um jogo. Funcionar em gente diferente mostra que a técnica não depende de um corpo específico.', 'jade'],
          ['Quando saiu', 'Uma semana inspirada não faz uma técnica. Do 3º grau em diante, ela precisa sair em semanas diferentes, e a Assinatura pede meses.', 'jade'],
        ].map(([t, d, cor]) => (
          <div key={t} className="card" style={{ background: 'var(--void)', padding: 13, borderLeft: `2px solid var(--${cor})` }}>
            <div className="tiny" style={{ fontWeight: 600, marginBottom: 5 }}>{t}</div>
            <p className="micro muted" style={{ lineHeight: 1.65 }}>{d}</p>
          </div>
        ))}
      </div>

      <div className="divider" />
      <div className="eyebrow">o que não entra na conta</div>
      <div className="valida ruim">
        <ShieldAlert size={14} className="valida-ico" style={{ color: 'var(--blood)' }} />
        <p className="micro muted" style={{ lineHeight: 1.65 }}>
          Ter levado a técnica. Isso vai pra "Onde você apanha" e mostra onde vale trabalhar a defesa,
          sem mexer no grau do seu ataque.
        </p>
      </div>

      <div className="divider" />
      <div className="eyebrow">o que cada grau pede</div>
      <div className="col" style={{ gap: 9 }}>
        {[
          ['1º grau', 'Apareceu uma vez, até no treino técnico.'],
          ['2º grau', `Saiu ${req[2].usos} vezes no rola, com alguém tentando impedir.`],
          ['3º grau', `Saiu ${req[3].usos} vezes, em pelo menos ${req[3].transferencia} pessoas e em ${req[3].semanas} semanas diferentes${req[3].acima ? ', com uma delas em faixa acima da sua' : ''}.`],
          ['4º grau', `Saiu ${req[4].usos} vezes, em pelo menos ${req[4].transferencia} pessoas, em ${req[4].meses} meses diferentes e ${req[4].acima} vezes em faixa acima da sua.`],
        ].map(([n, d]) => (
          <div key={n} className="row" style={{ gap: 10, alignItems: 'baseline' }}>
            <span className="tiny" style={{ fontWeight: 700, minWidth: 58 }}>{n}</span>
            <p className="micro muted" style={{ lineHeight: 1.6 }}>{d}</p>
          </div>
        ))}
      </div>
      <p className="micro muted" style={{ lineHeight: 1.65 }}>
        Treinar sempre com o mesmo grupo não trava ninguém: duas pessoas já bastam pro 3º grau. E encaixar muitas
        vezes no mesmo parceiro, que já conhece a sua entrada, aparece na ficha da técnica como sinal de refinamento.
      </p>

      <div className="divider" />
      <div className="eyebrow">o grau que você conquistou fica</div>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        Uma técnica nunca desce de grau. Quando você pega faixa nova, a régua sobe pro próximo grau, mas o que você
        já conquistou com a faixa anterior continua seu.
      </p>

      <div className="divider" />
      <div className="eyebrow">a régua sobe com a sua faixa</div>
      <p className="tiny muted" style={{ lineHeight: 1.7 }}>
        Os números acima são pra faixa {faixa}. Quanto mais graduado, mais alta fica a exigência, porque o que é
        notável na branca vira rotina na roxa.
      </p>
    </Sheet>
  );
}
