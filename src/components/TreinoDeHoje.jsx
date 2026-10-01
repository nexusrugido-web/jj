import React from 'react';
import { Card } from './UI';
import { Vitrine } from './Plano';
import { podeVer, pedirOferta } from '../lib/plano';

/* ============================================================
   O CARTÃO DO TREINO DE HOJE

   Aparece no Painel nos dias em que a pessoa costuma treinar, antes
   de registrar o treino do dia. No grátis, a primeira linha aparece e
   o resto fica na vitrine; no Premium, o cartão inteiro.
   ============================================================ */
function Linha({ l }) {
  /* o destaque só existe se o texto tiver ele; senão, a linha vai inteira */
  const i = l.forte ? l.texto.indexOf(l.forte) : -1;
  if (i < 0) return <div className="hoje-linha"><span className="hoje-ico" aria-hidden="true">{l.icone}</span><span>{l.texto}</span></div>;
  const antes = l.texto.slice(0, i);
  const depois = l.texto.slice(i + l.forte.length);
  return (
    <div className="hoje-linha">
      <span className="hoje-ico" aria-hidden="true">{l.icone}</span>
      <span>{antes}<b>{l.forte}</b>{depois}</span>
    </div>
  );
}

export default function TreinoDeHoje({ hoje: t, acesso }) {
  if (!t?.mostrar) return null;
  const livre = podeVer(acesso, 'treinoHoje');
  const [primeira, ...resto] = t.linhas;
  return (
    <Card style={{ marginBottom: 14 }} className="hoje-card">
      <div className="eyebrow">antes de pisar no tatame</div>
      <h2 className="h-sec">Hoje no tatame</h2>
      <div className="col" style={{ gap: 10, marginTop: 12 }}>
        <Linha l={primeira} />
        {livre && resto.map((l) => <Linha key={l.id} l={l} />)}
      </div>
      {!livre && resto.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Vitrine
            recurso="treinoHoje"
            fundo={<div className="col" style={{ gap: 10 }}>{resto.map((l) => <Linha key={l.id} l={l} />)}</div>}
            titulo="O resto do treino de hoje"
            texto="O que te pega, de onde você mais ganha e a meta da semana, escolhidos pelos seus rolas antes de cada treino."
            itens={['O que mais te finaliza, pra ficar esperto', 'A posição de onde você mais vence', 'A meta da semana, pra hoje contar']}
            onAssinar={() => pedirOferta('treinoHoje')}
          />
        </div>
      )}
    </Card>
  );
}
