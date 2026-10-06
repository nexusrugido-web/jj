import React, { useMemo, useState } from 'react';
import { Share2, ChevronRight } from 'lucide-react';
import { Card, Btn, Sheet } from './UI';
import { Vitrine } from './Plano';
import Figurinha from './Figurinha';
import { podeVer, pedirOferta } from '../lib/plano';
import { relatorioDoMes, retrospectivaDoAno } from '../lib/relatorio';
import { artigo } from '../lib/treinoDeHoje';
import { hoje, mesCompleto } from '../lib/utils';

/* ============================================================
   O RELATÓRIO DO MÊS NO PAINEL

   Do dia 1 ao 10, o cartão do mês que fechou; de 1º de dezembro a
   15 de janeiro, a retrospectiva do ano no lugar dele. Os números
   são de todo mundo; os graus que subiram, as vitórias, o que ainda
   te pega e o foco são do Premium. O story sai de graça (é o que
   leva o app pra quem ainda não conhece).
   ============================================================ */
const sinal = (n) => (n > 0 ? `+${n}` : String(n));

function qualMostrar(hj) {
  const [a, m, d] = hj.split('-').map(Number);
  if (m === 12) return { tipo: 'ano', ano: a };
  if (m === 1 && d <= 15) return { tipo: 'ano', ano: a - 1 };
  if (d <= 10) return { tipo: 'mes' };
  return null;
}

export default function RelatorioDoMes({ sessions, rolls, esteira, faixa, acesso, techniques = [], categories = [], positions = [] }) {
  const [aberto, setAberto] = useState(false);
  const [story, setStory] = useState(false);
  const hj = hoje();
  const qual = qualMostrar(hj);
  const r = useMemo(() => {
    if (!qual) return null;
    const dados = { sessions, rolls, esteira, faixa, techniques, categories, positions };
    return qual.tipo === 'ano' ? retrospectivaDoAno({ ano: qual.ano, ...dados }) : relatorioDoMes({ hj, ...dados });
  }, [qual?.tipo, qual?.ano, sessions, rolls, esteira, faixa, hj, techniques, categories, positions]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r || r.vazio) return null;

  const ano = qual.tipo === 'ano';
  const nome = ano ? r.periodo.nome : r.periodo.nome.toLowerCase();
  const titulo = ano ? `Seu ${r.periodo.nome} no tatame` : `Seu ${nome}`;
  const livre = podeVer(acesso, 'relatorio');
  const proximo = ano ? `${Number(r.periodo.nome) + 1}` : mesCompleto((r.periodo.mes + 1) % 12).toLowerCase();

  const numeros = (
    <div className="rel-numeros">
      <div><b className="num">{r.treinos}</b><small>{r.treinos === 1 ? 'treino' : 'treinos'}</small></div>
      <div><b className="num">{r.horas}h</b><small>de tatame</small></div>
      <div><b className="num">{r.rolas}</b><small>{r.rolas === 1 ? 'rola' : 'rolas'}</small></div>
    </div>
  );

  const detalhe = (
    <div className="col" style={{ gap: 10 }}>
      {r.posicaoDoMes && (
        <div className="rel-linha">📍 <span><b>A posição {ano ? 'do ano' : 'do mês'}:</b> {r.posicaoDoMes.nome}, {r.posicaoDoMes.usos} vezes no rola com {r.posicaoDoMes.tecnicas} {r.posicaoDoMes.tecnicas === 1 ? 'técnica' : 'técnicas'}</span></div>
      )}
      {r.novasNoRepertorio.length > 0 && (
        <div className="rel-linha">🆕 <span><b>Entrou no seu jogo:</b> {r.novasNoRepertorio.map((t) => t.nome).join(', ')}</span></div>
      )}
      {r.subiram.length > 0 && (
        <div className="rel-linha">⬆️ <span><b>Subiram de grau:</b> {r.subiram.map((t) => `${t.nome} (${t.para}º)`).join(', ')}</span></div>
      )}
      {r.taxa != null && (
        <div className="rel-linha">✅ <span>Ganhou <b>{r.venceu} de {r.rolas}</b> rolas ({r.taxa}%){r.taxaAntes != null && <>, era {r.taxaAntes}%</>}</span></div>
      )}
      {r.cede && (
        <div className="rel-linha">⚠️ <span>Ainda cede: <b>{r.cede.nome}</b>, te pegou {r.cede.vezes} {r.cede.vezes === 1 ? 'vez' : 'vezes'}</span></div>
      )}
      {r.foco && (
        <div className="rel-linha">🎯 <span><b>Pra {proximo}:</b> foca na defesa contra {artigo(r.foco)} {r.foco}</span></div>
      )}
    </div>
  );

  return (
    <>
      <Card className="hover rel-card" style={{ marginBottom: 14, cursor: 'pointer' }} onClick={() => setAberto(true)}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div className="eyebrow">{ano ? 'retrospectiva' : 'o mês que fechou'}</div>
            <h2 className="h-sec">📊 {titulo}</h2>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--dim)', marginTop: 4 }} />
        </div>
        <div style={{ marginTop: 12 }}>{numeros}</div>
        {r.variacao && r.variacao.rolas !== 0 && (
          <p className="micro muted" style={{ marginTop: 8 }}>{sinal(r.variacao.rolas)} rolas que {ano ? `em ${Number(r.periodo.nome) - 1}` : 'no mês anterior'}</p>
        )}
      </Card>

      <Sheet aberto={aberto} onClose={() => setAberto(false)} titulo={titulo} subtitulo={ano ? 'o ano inteiro' : 'do dia 1 ao último dia do mês'}>
        {numeros}
        {r.variacao && (
          <p className="micro muted">
            {sinal(r.variacao.treinos)} treinos e {sinal(r.variacao.rolas)} rolas que {ano ? `em ${Number(r.periodo.nome) - 1}` : 'no mês anterior'}.
          </p>
        )}
        {livre ? detalhe : (
          <Vitrine
            recurso="relatorio"
            fundo={detalhe}
            titulo={`O resto do seu ${nome}`}
            texto="O que subiu de grau, quantos rolas você ganhou, o que ainda te pega e o foco do próximo mês."
            itens={['As técnicas que subiram de grau', 'Quantos rolas você ganhou, e quanto mudou', 'O foco pro mês que começa']}
            onAssinar={() => pedirOferta('relatorio')}
          />
        )}
        <Btn variant="contorno" icon={Share2} onClick={() => setStory(true)} style={{ width: '100%' }}>Postar no story</Btn>
      </Sheet>

      <Figurinha
        aberto={story}
        onClose={() => setStory(false)}
        tipo={ano ? 'ano' : 'mes'}
        dados={{ selo: ano ? `meu ${r.periodo.nome}` : `meu ${nome}`, grande: `${r.treinos} ${r.treinos === 1 ? 'treino' : 'treinos'}`, sub: `${r.horas}h de tatame · ${r.rolas} ${r.rolas === 1 ? 'rola' : 'rolas'}`, faixa }}
      />
    </>
  );
}
