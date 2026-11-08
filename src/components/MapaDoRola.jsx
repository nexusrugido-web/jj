import React from 'react';
import { Check, CornerDownRight, DoorOpen, GitMerge } from 'lucide-react';
import { correnteDoPlano, arvoreDoPlano, letraDo } from '../lib/planos';

/* R7.2: o mapa do plano em pé, pequeno, pra tocar na peça que você
   usou no rola. Cada plano (A, B...) é uma trilha, na ordem de leitura
   do mapa grande; entre uma peça e a próxima, a saída que leva até
   ela. A ligação extra (convergência) aparece embaixo da peça de onde
   sai: tocar nela marca a peça de destino já por aquela entrada. A
   situação (pra onde ele escapou) é lugar: aparece, mas não marca.
   É só leitura do plano: o que foi marcado vive no rola. */
const SAIDA = {
  encaixou: 'Encaixou', reagiu: 'Ele reagiu', feita: 'Montou', retoma: 'Volto a atacar',
  naoReagiu: 'Não reagiu', impediu: 'Não deixou', defendeu: 'Defendeu', escapou: 'Ele escapou',
};
const TIPO = { finta: 'Finta: ', preparacao: 'Preparação: ' };

export default function MapaDoRola({ plano, marcada, caminho = [], onPeca }) {
  const { posicao, passos, ligacoes } = correnteDoPlano(plano);
  const arv = arvoreDoPlano(passos);
  const trilhas = [];
  arv.ordem.forEach((k) => { (trilhas[arv.trilho[k]] ||= []).push(k); });
  const porId = new Map(passos.map((x, k) => [x.id, k]));
  const cor = (k) => ((passos[k].tipo || 'golpe') === 'golpe' ? `trilho-${arv.trilho[k] % 8}` : `t-${passos[k].tipo}`);
  /* convergência: chega na peça pela árvore e por mais uma ligação */
  const juntam = new Set(ligacoes.map((l) => l.para).filter((id) => id !== null && id !== undefined));
  const ultima = caminho[caminho.length - 1];

  const atalho = (l) => {
    const k = porId.get(l.para);
    const via = <span className="mapa-rola-via">{SAIDA[l.via]}</span>;
    if (k === undefined || passos[k].tipo === 'situacao') {
      return (
        <React.Fragment key={l.id}>
          {via}
          <div className="mapa-rola-lugar"><DoorOpen size={13} /> {k === undefined ? `Volta pra ${posicao || 'posição do começo'}` : passos[k].golpe}</div>
        </React.Fragment>
      );
    }
    const on = marcada === l.para && ultima === l.id;
    return (
      <React.Fragment key={l.id}>
        {via}
        <button
          type="button" className={`mapa-rola-peca atalho ${cor(k)}${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onPeca(l.para, l.id)}
          aria-label={`${TIPO[passos[k].tipo] || ''}${passos[k].golpe}, por esta entrada`}
        >
          <CornerDownRight size={14} aria-hidden="true" />
          <span>{TIPO[passos[k].tipo] || ''}{passos[k].golpe}</span>
        </button>
      </React.Fragment>
    );
  };

  return (
    <div className="mapa-rola" role="group" aria-label="Mapa do plano">
      {trilhas.map((lista, t) => {
        const primeira = passos[lista[0]];
        const de = primeira.pai === null || primeira.pai === undefined ? null : passos[primeira.pai];
        return (
          <div key={t} className="mapa-rola-trilha">
            <p className="mapa-rola-de">
              {arv.trilhos > 1 && <b>Plano {letraDo(t)} · </b>}
              {de ? `${de.golpe} → ${SAIDA[primeira.via]}` : posicao}
            </p>
            {lista.map((k, n) => {
              const x = passos[k];
              const via = n > 0 && <span className="mapa-rola-via">{SAIDA[x.via]}</span>;
              const extras = ligacoes.filter((l) => l.de === x.id).map(atalho);
              if (x.tipo === 'situacao') {
                return (
                  <React.Fragment key={x.id}>
                    {via}
                    <div className="mapa-rola-lugar"><DoorOpen size={13} /> {x.golpe}</div>
                    {extras}
                  </React.Fragment>
                );
              }
              const on = marcada === x.id && !(juntam.has(x.id) && ligacoes.some((l) => l.id === ultima));
              return (
                <React.Fragment key={x.id}>
                  {via}
                  <button type="button" className={`mapa-rola-peca ${cor(k)}${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onPeca(x.id)}>
                    <i aria-hidden="true">{on && <Check size={12} strokeWidth={3.5} />}</i>
                    <span>{TIPO[x.tipo] || ''}{x.golpe}</span>
                    {juntam.has(x.id) && <GitMerge size={13} className="mapa-rola-junta" aria-hidden="true" />}
                  </button>
                  {extras}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
