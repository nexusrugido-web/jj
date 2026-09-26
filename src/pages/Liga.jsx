import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Flame, Info, Swords, ChevronRight, UsersRound, Trophy, LogIn, Flag, Layers, Zap, CalendarCheck,
  Timer, Eye, TrendingUp,
} from 'lucide-react';
import { db } from '../db/db';
import { useApp } from '../contexto';
import { Card, Btn, Empty, Sheet } from '../components/UI';
import Guia, { Passos, Linha } from '../components/Guia';
import Liga from '../components/Liga';
import RankingOfensivas from '../components/RankingOfensivas';
import ListaResumida from '../components/ListaResumida';
import { EVENTOS } from '../lib/xp';
import { DIVISOES_LIGA, MINIMO_PRA_SUBIR, MINIMO_DO_GRUPO, nomeDivisao } from '../lib/liga';
import { ofensiva, MAX_ESCUDOS, DIAS_POR_ESCUDO } from '../lib/ofensiva';
import { relativo, fmtData } from '../lib/utils';

/* ============================================================
   A LIGA

   Esforço, social, e zera toda segunda: pontos de treino, de aula
   e de quiz contra um grupo de gente com ritmo parecido. O que é
   do seu jogo (técnicas, graus, rolas) fica nas telas de Evolução
   e ninguém mais vê.
   ============================================================ */
export default function LigaPagina() {
  const { irPara } = useApp();
  const pontos = useLiveQuery(() => db.pontos.toArray(), [], []) || [];
  const [comoFunciona, setComoFunciona] = useState(false);
  const [rankingAberto, setRankingAberto] = useState(false);

  const recentes = useMemo(
    () => [...pontos].sort((a, b) => b.criadoEm - a.criadoEm),
    [pontos]
  );

  if (!pontos.length) {
    return (
      <div className="page">
        <Cabecalho onComo={() => setComoFunciona(true)} />
        <Card>
          <Empty
            icon={Flame}
            titulo="Sua liga começa no primeiro ponto"
            texto="Cada treino anotado, cada aula assistida e cada pergunta do quiz vale pontos na semana. O primeiro ponto já te coloca num grupo com gente de ritmo parecido com o seu."
            acao={<Btn variant="primary" onClick={() => irPara('treinos')}>Registrar treino</Btn>}
          />
        </Card>
        <ComoFunciona aberto={comoFunciona} onClose={() => setComoFunciona(false)} />
      </div>
    );
  }

  return (
    <div className="page">
      <Cabecalho onComo={() => setComoFunciona(true)} />

      {/* a corrida desta semana primeiro; amigos e sala moram na aba deles */}
      <Liga />

      <button type="button" className="card atalho" onClick={() => irPara('amigos')} style={{ marginBottom: 14 }}>
        <span className="stat-ico" style={{ color: 'var(--accent)' }}><UsersRound size={17} /></span>
        <span style={{ flex: 1, textAlign: 'left' }}>
          <span className="h-sec" style={{ display: 'block', fontSize: 16 }}>Amigos e sala</span>
          <span className="tiny muted">Chame os amigos pra correr a liga numa sala só de vocês.</span>
        </span>
        <ChevronRight size={18} className="muted" />
      </button>

      {/* o ranking de todo mundo abre por um toque: a tela é da liga do aluno */}
      <button type="button" className="card atalho" onClick={() => setRankingAberto(true)} style={{ marginBottom: 14 }}>
        <span className="stat-ico" style={{ color: 'var(--roar)' }}><Flame size={17} /></span>
        <span style={{ flex: 1, textAlign: 'left' }}>
          <span className="h-sec" style={{ display: 'block', fontSize: 16 }}>Os faixas-pretas da ofensiva</span>
          <span className="tiny muted">Os 10 que mais apareceram seguido no app, e a sua posição.</span>
        </span>
        <ChevronRight size={18} className="muted" />
      </button>
      <Sheet aberto={rankingAberto} onClose={() => setRankingAberto(false)} titulo="Os faixas-pretas da ofensiva">
        <RankingOfensivas limite={10} />
      </Sheet>

      {/* histórico */}
      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">o que entrou por último</div>
            <h2 className="h-sec">Últimos pontos</h2>
          </div>
        </div>
        {/* 5 na tela; a folha tem todos, agrupados pelo dia do ponto */}
        <ListaResumida itens={recentes} quantos={5} titulo="Todos os pontos" subtitulo="do dia mais recente pro mais antigo">
          {(lista, completa) => {
            const ordem = completa
              ? [...lista].sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.criadoEm - a.criadoEm)
              : lista;
            return (
              <div className="col" style={{ gap: 7 }}>
                {ordem.map((l, i) => (
                  <React.Fragment key={l.id}>
                    {completa && (i === 0 || ordem[i - 1].data !== l.data) && (
                      <div className="eyebrow" style={{ marginTop: i ? 10 : 0 }}>{fmtData(l.data)} · {relativo(l.data)}</div>
                    )}
                    <div className="xp-evento">
                      <span className="tiny" style={{ flex: 1 }}>
                        {EVENTOS[l.evento]?.nome || l.evento}
                        {l.detalhe && !/^\d{4}-\d{2}-\d{2}$/.test(l.detalhe) && <span className="micro muted"> · {String(l.detalhe).slice(0, 34)}</span>}
                      </span>
                      {!completa && <span className="micro muted">{relativo(l.data)}</span>}
                      <span className="xp-evento-xp">+{l.xp}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            );
          }}
        </ListaResumida>
      </Card>

      <ComoFunciona aberto={comoFunciona} onClose={() => setComoFunciona(false)} />
    </div>
  );
}

function Cabecalho({ onComo }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="h-page">Liga</h1>
      </div>
      <Btn icon={Info} onClick={onComo}>Como funciona</Btn>
    </div>
  );
}

function ComoFunciona({ aberto, onClose }) {
  const { irPara } = useApp();
  const eventos = Object.values(EVENTOS).filter((e) => !e.antigo).sort((a, b) => b.xp - a.xp);
  const divisoes = Object.values(DIVISOES_LIGA);

  return (
    <Sheet aberto={aberto} onClose={onClose} titulo="Como a liga funciona" wide>
      <p className="tiny muted" style={{ lineHeight: 1.65 }}>
        Uma corrida de esforço que recomeça toda segunda. Toque numa pergunta pra ver a resposta.
      </p>

      <Guia
        inicial="oque"
        topicos={[
          {
            id: 'oque', icone: Trophy, titulo: 'O que é a liga', resumo: 'Quem aparece mais na semana sobe',
            conteudo: (
              <>
                <p>Cada coisa que você registra vale pontos: treino, rola, aula, quiz. Toda semana você corre num grupo pequeno, com gente de ritmo parecido com o seu.</p>
                <p>Quem faz mais pontos sobe de divisão, quem faz menos desce. Treinar vale mais que assistir aula, porque é o tatame que faz você melhorar.</p>
              </>
            ),
          },
          {
            id: 'entrar', icone: LogIn, titulo: 'Como eu entro', resumo: 'Sozinho, no primeiro ponto da semana',
            conteudo: (
              <Passos itens={[
                'Registre qualquer coisa que dê ponto: um treino, uma aula, uma pergunta do quiz.',
                'O app te coloca num grupo com quem treina no mesmo ritmo que você marcou no cadastro. Enquanto você está sozinho, ele fica procurando adversários.',
                'O grupo recebe gente a semana toda, até domingo: quem pontua pela primeira vez na semana ocupa uma vaga.',
                `A subida e a descida só valem com ${MINIMO_DO_GRUPO} ou mais no grupo. Com 2, a corrida conta os pontos, mas ninguém sobe nem desce.`,
              ]} />
            ),
          },
          {
            id: 'fim', icone: Flag, titulo: 'Como a semana termina', resumo: 'Segunda ao meio-dia, com sobe e desce',
            conteudo: (
              <Passos itens={[
                'A semana vai de segunda a domingo e fecha na segunda ao meio-dia, no horário de Brasília.',
                'Quem termina em 1º, com o mínimo de pontos da divisão, sobe. Quem termina em último desce.',
                'O resultado aparece na Liga: em que lugar você ficou, se subiu, e o pódio do grupo.',
                'Na mesma hora começa a semana nova, com os pontos zerados e um grupo novo.',
                'Quem entrou fica até domingo: dá pra sair, mas só vale na semana seguinte.',
              ]} />
            ),
          },
          {
            id: 'subir', icone: TrendingUp, titulo: 'Como subir de divisão', resumo: 'Terminar em 1º e fazer o mínimo de pontos',
            conteudo: (
              <>
                <Passos itens={[
                  `O grupo precisa ter ${MINIMO_DO_GRUPO} pessoas ou mais. Com 2, ninguém sobe nem desce, pra ninguém subir só porque o outro sumiu.`,
                  'Em grupo de 3 a 5, só o 1º sobe e só o último desce. De 6 a 8, sobem os 2 primeiros e descem os 2 últimos.',
                  'Além de terminar na frente, precisa de uma semana de verdade: o mínimo de pontos cresce a cada divisão.',
                ]} />
                <div className="col" style={{ gap: 6 }}>
                  {Object.entries(MINIMO_PRA_SUBIR).map(([de, min]) => {
                    const ordem = Object.keys(DIVISOES_LIGA);
                    const pra = ordem[ordem.indexOf(de) + 1];
                    return <Linha key={de} nome={`${nomeDivisao(de)} → ${nomeDivisao(pra)}`} valor={`${min} pts`} />;
                  })}
                </div>
                <p>Uma semana cheia (3 treinos com rolas, 2 aulas e o quiz) rende uns 260 pontos. Terminou em 1º sem o mínimo? Você fica na divisão, e a Liga mostra quanto faltou.</p>
              </>
            ),
          },
          {
            id: 'divisoes', icone: Layers, titulo: 'As divisões', resumo: `${divisoes[0].nome} até ${divisoes[divisoes.length - 1].nome}`,
            conteudo: (
              <>
                <div className="guia-degraus">
                  {divisoes.map((d, i) => (
                    <span key={d.nome} className="guia-degrau"><span className="num micro muted">{i + 1}</span> {d.nome}</span>
                  ))}
                </div>
                <p>A divisão é só da liga e muda toda semana. A sua faixa continua sendo a do tatame, e quem gradua é o seu professor.</p>
              </>
            ),
          },
          {
            id: 'pontos', icone: Zap, titulo: 'Quanto vale cada coisa', resumo: `De +${eventos[eventos.length - 1].xp} a +${eventos[0].xp}, com teto por dia`,
            conteudo: (
              <div className="col" style={{ gap: 6 }}>
                {eventos.map((e) => (
                  <Linha key={e.id} nome={e.nome} valor={`+${e.xp}`} detalhe={`${e.desc} Até ${e.tetoDia}x por dia.`} />
                ))}
              </div>
            ),
          },
          {
            id: 'semana', icone: CalendarCheck, titulo: 'O que uma semana cheia rende', resumo: 'Uns 260 pontos, e o treino pesa mais',
            conteudo: (
              <>
                <div className="col" style={{ gap: 6 }}>
                  {[
                    ['3 treinos com reflexão', 60], ['9 rolas com dados completos', 108], ['2 aulas completas', 30],
                    ['6 aulas rápidas', 6], ['3 perguntas do quiz', 30], ['Bônus de ritmo', 25],
                  ].map(([o, q]) => <Linha key={o} nome={o} valor={`+${q}`} />)}
                  <Linha nome="A semana toda" valor="259" tom="jade" />
                </div>
                <p>Quem treina duas vezes por semana não fica pra trás: o bônus de ritmo compara você com a sua própria média, e o grupo junta gente de ritmo parecido.</p>
                <p>Estudar rende no máximo 140 pontos por semana. Assistir vídeo a semana inteira nunca vale mais que ir treinar.</p>
              </>
            ),
          },
          {
            id: 'limite', icone: Timer, titulo: 'Por que tem limite por dia', resumo: 'Vinte vídeos numa tarde não valem um treino',
            conteudo: <p>Cada coisa tem um teto diário. Maratonar vídeo não vale mais que ir treinar, porque o que faz você melhorar é o tatame.</p>,
          },
          {
            id: 'ofensiva', icone: Flame, titulo: 'A ofensiva', resumo: 'Dias seguidos aparecendo, não de tatame',
            conteudo: (
              <>
                <Passos itens={[
                  'Qualquer coisa que dê ponto fecha o dia: uma aula rápida de trinta segundos, uma pergunta do quiz, o treino registrado.',
                  'Treino paga os dois dias seguintes, porque recuperação faz parte. Quem treina 3x por semana não perde a ofensiva sem estudar.',
                  `A cada ${DIAS_POR_ESCUDO} dias seguidos você ganha um escudo, até ${MAX_ESCUDOS}. Ele é gasto sozinho no dia em que você não aparecer.`,
                ]} />
                <p>Quem está em {DIAS_POR_ESCUDO - 1} dias e some perde tudo. Quem passou dos {DIAS_POR_ESCUDO} tem um escudo pra voltar.</p>
              </>
            ),
          },
          {
            id: 'arena', icone: Swords, titulo: 'A arena da semana', resumo: 'Você contra a sua semana passada',
            conteudo: <p>Além do grupo, você sempre tem um adversário: a sua semana passada. Ela já tem placar, então dá pra ganhar dela mesmo quando o grupo está parado.</p>,
          },
          {
            id: 'sala', icone: UsersRound, titulo: 'Correr com os amigos', resumo: 'Uma sala só de vocês, de 3 a 5',
            conteudo: (
              <>
                <p>Na aba Amigos você cria uma sala e chama quem já é seu amigo com um toque, ou manda o link pelo WhatsApp. Com 3 pessoas ela começa na segunda seguinte e corre no lugar da liga automática, com o mesmo sobe e desce.</p>
                <Btn size="sm" variant="contorno" icon={UsersRound} onClick={() => { onClose(); irPara('amigos'); }}>Abrir Amigos</Btn>
              </>
            ),
          },
          {
            id: 'privado', icone: Eye, titulo: 'O que os outros veem', resumo: 'Pontos sim; técnicas e graus nunca',
            conteudo: <p>O seu nome ou apelido, a foto, a faixa, a divisão, os pontos da semana, a ofensiva e quantas vezes por semana você disse que treina. As suas técnicas, os graus e o que acontece nos seus rolas ficam só com você.</p>,
          },
        ]}
      />
    </Sheet>
  );
}
