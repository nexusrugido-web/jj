import React, { useState, useMemo } from 'react';
import {
  Dumbbell, Info, Search, ChevronRight, Check, Brain, CalendarDays, Hand, TriangleAlert,
  Repeat, Timer, Weight, MapPin,
} from 'lucide-react';
import { useApp } from '../contexto';
import { Card, Btn, Sheet, Busca, Empty } from '../components/UI';
import Guia, { Passos } from '../components/Guia';
import { Vitrine } from '../components/Plano';
import { GRUPOS, EXERCICIOS, orientacaoDeCarga, planoDoExercicio, ehNovo } from '../db/exercicios';
import { buscaMatch } from '../lib/utils';
import { podeVer } from '../lib/plano';
import { semanaDe } from '../lib/xp';

/* ============================================================
   FORÇA PRO JIU-JITSU

   Uma coisa só: qual exercício fazer pra ficar mais forte no
   tatame, e como encaixar ele no treino de academia que a pessoa
   já faz. Não é app de registrar academia; é o plano de cada
   exercício, com o que ele entrega no rola. No grátis, vitrine.
   ============================================================ */

export default function Academia() {
  const { sessions, acesso, irPara } = useApp();
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('todos');
  const [aberto, setAberto] = useState(null);
  const [duvidas, setDuvidas] = useState(false);
  const livre = podeVer(acesso, 'musculacao');

  const orientacao = useMemo(() => {
    const sem = semanaDe();
    const noTatame = sessions.filter((s) => semanaDe(s.data) === sem).length;
    return orientacaoDeCarga(noTatame);
  }, [sessions]);

  const lista = useMemo(() => EXERCICIOS.filter((e) => {
    if (grupo !== 'todos' && e.g !== grupo) return false;
    return buscaMatch(`${e.nome} ${e.entrega}`, busca);
  }), [grupo, busca]);

  const porGrupo = useMemo(() => {
    const mapa = {};
    for (const e of lista) (mapa[e.g] = mapa[e.g] || []).push(e);
    return mapa;
  }, [lista]);

  const grupos = (
    <div className="col" style={{ gap: 14 }}>
      {GRUPOS.filter((g) => porGrupo[g.id]?.length).map((g) => (
        <Card key={g.id} className="forca-grupo">
          <div className="card-head">
            <div>
              <div className="eyebrow">{g.desc}</div>
              <h2 className="h-sec">{g.nome}</h2>
            </div>
          </div>
          <div className="col" style={{ gap: 8 }}>
            {porGrupo[g.id].map((e) => {
              return (
                <button key={e.id} type="button" className="exerc-item" onClick={() => setAberto(e)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span className="tiny" style={{ fontWeight: 700 }}>{e.nome}</span>
                      {ehNovo(e) && <span className="forca-novo">novo</span>}
                    </div>
                    <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{e.entrega}</p>
                  </div>
                  <ChevronRight size={16} className="muted" style={{ flex: 'none' }} />
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );

  if (!livre) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="h-page">Força pro jiu-jitsu</h1>
          </div>
        </div>
        <Vitrine
          recurso="musculacao"
          fundo={grupos}
          titulo="Os exercícios que deixam o seu jiu-jitsu mais forte, com mais gás e menos lesão"
          texto={`A mão que não abre no terceiro minuto, o fôlego que aguenta o rola até o fim, o joelho e o pescoço que não te tiram do tatame. São ${EXERCICIOS.length} exercícios, e contando: a lista cresce com exercício novo o tempo todo, e cada um vem com o plano pronto (quantas séries, quanto descanso, em que dia entra e como subir nas próximas quatro semanas). Você não troca a academia que já faz, só coloca o que falta nela.`}
          itens={[
            'O plano de cada exercício pra somar no treino que você já faz',
            'Força: pegada, puxada e quadril, o que a ciência do grappling mais relaciona com resultado',
            'Resistência: treino de gás em rajadas, do jeito que o rola cansa de verdade',
            'Prevenção de lesão: joelho, ombro, virilha, lombar e pescoço, pra você não parar de treinar',
            'Por que a força chega antes do músculo: nas primeiras semanas quem muda é o seu sistema nervoso',
            'Quanta academia cabe na sua semana de tatame, sem roubar o seu rola',
          ]}
          onAssinar={() => irPara('ajustes')}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Força pro jiu-jitsu</h1>
        </div>
        <Btn icon={Info} onClick={() => setDuvidas(true)}>Dúvidas</Btn>
      </div>

      <Card className="accent" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <span className="stat-ico"><Dumbbell size={16} /></span>
          <div style={{ flex: 1 }}>
            <div className="eyebrow">Pela sua semana de tatame</div>
            <h2 className="h-sec">
              {orientacao.recomendado} {orientacao.recomendado === 1 ? 'sessão' : 'sessões'} de força por semana
            </h2>
            <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.7 }}>{orientacao.texto}</p>
            <p className="micro muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
              São {EXERCICIOS.length} exercícios de força, resistência e prevenção de lesão, e a lista não para de crescer.
              Toque num deles pra ver o plano e onde encaixar no treino que você já faz.
            </p>
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Busca value={busca} onChange={setBusca} placeholder="Buscar exercício ou o que ele resolve" />
        <div className="chips-scroll" style={{ marginTop: 10, marginBottom: 0 }}>
          <button className={`chip ${grupo === 'todos' ? 'on' : ''}`} onClick={() => setGrupo('todos')}>Todos</button>
          {GRUPOS.map((g) => (
            <button key={g.id} className={`chip ${grupo === g.id ? 'on' : ''}`} onClick={() => setGrupo(g.id)}>
              {g.nome}
            </button>
          ))}
        </div>
      </Card>

      {!lista.length && (
        <Card>
          <Empty icon={Search} titulo="Nada com esse nome" texto="Tente outro termo, ou limpe a busca pra ver tudo." />
        </Card>
      )}

      {grupos}

      <Sheet
        aberto={!!aberto}
        onClose={() => setAberto(null)}
        titulo={aberto?.nome}
        subtitulo={GRUPOS.find((g) => g.id === aberto?.g)?.nome}
      >
        {aberto && <PlanoDoExercicio e={aberto} />}
      </Sheet>

      <Sheet aberto={duvidas} onClose={() => setDuvidas(false)} titulo="Força pro jiu-jitsu" wide>
        <Duvidas />
      </Sheet>
    </div>
  );
}

/* o plano de um exercício, pronto pra encaixar no treino de academia */
function PlanoDoExercicio({ e }) {
  const p = planoDoExercicio(e);
  return (
    <>
      <div className="valida bom">
        <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
        <div>
          <div className="tiny" style={{ fontWeight: 600 }}>O que entrega no tatame</div>
          <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.65 }}>{e.entrega}</p>
        </div>
      </div>

      <div className="forca-plano">
        <div className="forca-linha"><MapPin size={15} /><div><b>Onde entra</b><span>{p.ondeEncaixa}</span></div></div>
        <div className="forca-linha"><Repeat size={15} /><div><b>Quanto</b><span>{p.series}</span></div></div>
        <div className="forca-linha"><Timer size={15} /><div><b>Descanso</b><span>{p.descanso}</span></div></div>
        <div className="forca-linha"><Weight size={15} /><div><b>Carga</b><span>{p.carga}</span></div></div>
      </div>

      {p.como && (
        <div>
          <div className="eyebrow row" style={{ gap: 6 }}><Hand size={13} /> Como fazer</div>
          <p className="tiny" style={{ lineHeight: 1.65 }}>{p.como}</p>
        </div>
      )}

      {p.erro && (
        <div className="valida atencao">
          <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>O erro que mais aparece</div>
            <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.65 }}>{p.erro}</p>
          </div>
        </div>
      )}

      <div>
        <div className="eyebrow row" style={{ gap: 6 }}><CalendarDays size={13} /> As próximas 4 semanas</div>
        <Passos itens={p.semanas} />
      </div>

      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        Sentiu dor na articulação (não é o cansaço do músculo), para e fala com quem te acompanha na academia.
      </p>
    </>
  );
}

function Duvidas() {
  return (
    <Guia inicial="neuro" topicos={[
      {
        id: 'neuro', icone: Brain, titulo: 'Por que a força chega antes do músculo',
        resumo: 'Nas primeiras semanas quem muda é o seu sistema nervoso',
        conteudo: (
          <>
            <p>Quando você começa a treinar força, os primeiros ganhos vêm do cérebro e dos nervos, não do músculo crescer. O sistema nervoso aprende a acionar mais fibras ao mesmo tempo e a mandar o sinal mais rápido.</p>
            <p>É por isso que a pegada fica mais firme em poucas semanas, antes de o antebraço mudar de tamanho. E é por isso que a técnica de cada exercício importa: você está ensinando o corpo a fazer força do jeito certo.</p>
          </>
        ),
      },
      {
        id: 'precisa', icone: Dumbbell, titulo: 'Preciso de musculação pra evoluir?',
        resumo: 'Não precisa, mas ajuda no que o tatame sozinho demora',
        conteudo: <p>Quem evolui mais é quem treina mais jiu-jitsu. A força ajuda a aguentar mais tempo, a machucar menos e a não depender só de braço. Nos estudos com atletas de jiu-jitsu, pegada e força máxima andam junto com resultado, mas vêm depois do tatame na ordem de importância.</p>,
      },
      {
        id: 'semana', icone: CalendarDays, titulo: 'Quantas vezes por semana?',
        resumo: 'Duas sessões curtas resolvem pra quem treina três vezes ou mais',
        conteudo: <p>Com três a quatro treinos de jiu-jitsu, dá pra fazer duas ou três sessões de força. Com cinco ou mais, duas já é bastante, porque o corpo precisa se recuperar de tudo junto.</p>,
      },
      {
        id: 'qual', icone: Hand, titulo: 'Qual exercício mais ajuda no rola?',
        resumo: 'Os de pegada, disparado',
        conteudo: <p>Boa parte do jiu-jitsu é segurar, e a mão é a primeira que falha. Depois vêm os de puxar e os de quadril, que é de onde sai a ponte e a raspagem. E o pescoço: fortalecer ele duas ou três vezes por semana é a prevenção que mais funciona em quem luta.</p>,
      },
      {
        id: 'quando', icone: Timer, titulo: 'Faço antes ou depois do treino?',
        resumo: 'Em dias separados; se não der, depois do jiu-jitsu',
        conteudo: <p>Você quer chegar no tatame descansado, não com a perna morta de agachamento. O pesado fica longe do dia de rola forte. Aquecimento de prevenção (ombro, pescoço, joelho) pode ir antes de tudo.</p>,
      },
      {
        id: 'pesado', icone: Weight, titulo: 'Vou ficar pesado e lento?',
        resumo: 'Não do jeito que você treina',
        conteudo: <p>Ficar grande exige comer muito e treinar volume alto de musculação, coisa que quem rola cinco vezes por semana não consegue nem se quiser. Os planos daqui são de força, com poucas repetições e parando antes de falhar.</p>,
      },
      {
        id: 'piorou', icone: TriangleAlert, titulo: 'Meu rola piorou depois que comecei',
        resumo: 'É volume demais, não falta de força',
        conteudo: <p>Corte uma sessão ou baixe a carga por duas semanas e veja se melhora. O tatame é o termômetro: se o rola piorou, a academia está roubando a recuperação dele.</p>,
      },
    ]} />
  );
}
