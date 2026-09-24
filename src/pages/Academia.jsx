import React, { useState, useMemo } from 'react';
import { Dumbbell, Info, Search, ChevronRight, Check } from 'lucide-react';
import { useApp } from '../contexto';
import { Card, Btn, Chip, Sheet, Busca, Empty } from '../components/UI';
import { GRUPOS, EXERCICIOS, orientacaoDeCarga } from '../db/exercicios';
import { buscaMatch } from '../lib/utils';
import { semanaDe } from '../lib/xp';

/* ============================================================
   MUSCULAÇÃO

   Aqui não se registra treino. Já existe app bom pra isso, e
   duplicar viraria mais um lugar pra lembrar de preencher.

   O que o NeuroJitsu faz de diferente é dizer o que cada
   exercício entrega pro seu jiu-jitsu, que é a pergunta que
   ninguém responde: "pra que serve isso no tatame?".
   ============================================================ */

export default function Academia() {
  const { sessions } = useApp();
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('todos');
  const [aberto, setAberto] = useState(null);
  const [porque, setPorque] = useState(false);

  const orientacao = useMemo(() => {
    const sem = semanaDe();
    const noTatame = sessions.filter((s) => semanaDe(s.data) === sem).length;
    return orientacaoDeCarga(noTatame);
  }, [sessions]);

  const lista = useMemo(() => {
    return EXERCICIOS.filter((e) => {
      if (grupo !== 'todos' && e.g !== grupo) return false;
      return buscaMatch(`${e.nome} ${e.entrega}`, busca);
    });
  }, [grupo, busca]);

  const porGrupo = useMemo(() => {
    const mapa = {};
    for (const e of lista) (mapa[e.g] = mapa[e.g] || []).push(e);
    return mapa;
  }, [lista]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Musculação</h1>
        </div>
        <Btn icon={Info} onClick={() => setPorque(true)}>Dúvidas</Btn>
      </div>

      <Card className="accent" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <span className="stat-ico"><Dumbbell size={16} /></span>
          <div style={{ flex: 1 }}>
            <h2 className="h-sec">
              {orientacao.recomendado} {orientacao.recomendado === 1 ? 'sessão' : 'sessões'} por semana
            </h2>
            <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.7 }}>{orientacao.texto}</p>
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

      <div className="col" style={{ gap: 14 }}>
        {GRUPOS.filter((g) => porGrupo[g.id]?.length).map((g) => (
          <Card key={g.id}>
            <div className="card-head">
              <div>
                <div className="eyebrow">{g.desc}</div>
                <h2 className="h-sec">{g.nome}</h2>
              </div>
              <Chip>{porGrupo[g.id].length}</Chip>
            </div>
            <div className="col" style={{ gap: 9 }}>
              {porGrupo[g.id].map((e) => (
                <button key={e.id} className="exerc-item" onClick={() => setAberto(e)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tiny" style={{ fontWeight: 600 }}>{e.nome}</div>
                    <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{e.entrega}</p>
                  </div>
                  <ChevronRight size={15} className="muted" style={{ flex: 'none' }} />
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Sheet
        aberto={!!aberto}
        onClose={() => setAberto(null)}
        titulo={aberto?.nome}
        subtitulo={GRUPOS.find((g) => g.id === aberto?.g)?.nome}
      >
        {aberto && (
          <>
            <div className="valida bom">
              <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
              <div>
                <div className="tiny" style={{ fontWeight: 600 }}>O que entrega pro seu jiu-jitsu</div>
                <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.65 }}>{aberto.entrega}</p>
              </div>
            </div>
            <p className="tiny muted" style={{ lineHeight: 1.7 }}>
              A carga e a quantidade de séries dependem do seu histórico e de quanto você treina. Isso quem
              define é você ou quem te acompanha na academia.
            </p>
          </>
        )}
      </Sheet>

      <Sheet aberto={porque} onClose={() => setPorque(false)} titulo="Musculação pro jiu-jitsu" wide>
        <div className="col" style={{ gap: 11 }}>
          {[
            ['Preciso fazer musculação pra evoluir?',
             'Não precisa. Quem evolui mais é quem treina mais jiu-jitsu. A musculação ajuda a aguentar mais tempo, machucar menos e não depender só de força bruta, mas vem depois do tatame na ordem de importância.'],
            ['Por que o app não registra meus treinos de academia?',
             'Porque já existe app bom pra isso, e mais um lugar pra lembrar de preencher acaba virando lugar nenhum. Aqui o que importa é saber pra que serve cada exercício no tatame, que é a pergunta que os outros não respondem.'],
            ['Quantas vezes por semana?',
             'Duas sessões curtas resolvem pra quem treina jiu-jitsu três vezes ou mais. Se você rola cinco vezes por semana, duas já é bastante, porque o corpo precisa se recuperar de tudo junto.'],
            ['Qual exercício mais ajuda no rola?',
             'Os de pegada, disparado. Grande parte do jiu-jitsu é segurar, e a mão é o que falha primeiro. Depois vêm os de puxar e os de quadril, que é de onde sai a ponte e a raspagem.'],
            ['Vou ficar pesado e lento?',
             'Não do jeito que você treina. Ficar grande exige comer muito e treinar volume alto de musculação, coisa que quem roda cinco vezes por semana não consegue nem se quiser.'],
            ['Faço antes ou depois do treino?',
             'Se der, em dias separados. Se não der, faça depois do jiu-jitsu, porque você quer chegar no tatame descansado, não com a perna morta de agachamento.'],
            ['Meu rola piorou depois que comecei. E agora?',
             'É volume demais, não falta de força. Corte uma sessão ou reduza a carga por duas semanas e veja se melhora. O tatame é o termômetro.'],
          ].map(([t, d]) => (
            <div key={t} className="card" style={{ background: 'var(--void)', padding: 13 }}>
              <div className="tiny" style={{ fontWeight: 600, marginBottom: 5 }}>{t}</div>
              <p className="micro muted" style={{ lineHeight: 1.65 }}>{d}</p>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
