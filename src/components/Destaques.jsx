import React from 'react';
import { Swords, TriangleAlert, Target, ShieldAlert } from 'lucide-react';
import { Card, Chip } from './UI';

/* ============================================================
   OS DOIS NÚMEROS QUE IMPORTAM

   De tudo que o app calcula, dois respondem a pergunta que o
   aluno realmente faz: qual é a minha arma, e o que mais me
   pega. O resto é detalhe.

   Por isso eles ganham card próprio em vez de virar mais uma
   linha numa lista de oito.
   ============================================================ */

export default function Destaques({ resumo, onVerTudo }) {
  const arma = primeiro(resumo.topAplicadas);
  const buraco = primeiro(resumo.topSofridas);

  if (!arma && !buraco) return null;

  return (
    <div className="grid g2" style={{ gap: 12, marginBottom: 14 }}>
      <Destaque
        tom="jade"
        icone={Swords}
        rotulo="sua melhor arma"
        nome={arma?.nome}
        vezes={arma?.n}
        vazio="Registre uma finalização pra descobrir"
        leitura={arma && (arma.empate
          ? `${arma.empate}, ${arma.n} ${arma.n === 1 ? 'vez' : 'vezes'} cada. A que sair de novo passa na frente.`
          : `Saiu ${arma.n} ${arma.n === 1 ? 'vez' : 'vezes'}. É por aqui que o seu jogo fecha.`)}
      />
      <Destaque
        tom="blood"
        icone={ShieldAlert}
        rotulo="o que mais te pega"
        nome={buraco?.nome}
        vezes={buraco?.n}
        vazio="Nada te pegou ainda"
        leitura={buraco && (buraco.empate
          ? `${buraco.empate}, ${buraco.n} ${buraco.n === 1 ? 'vez' : 'vezes'} cada. Treinar a saída rende mais que técnica nova.`
          : `Você bateu ${buraco.n} ${buraco.n === 1 ? 'vez' : 'vezes'} disso. Treinar a saída rende mais que técnica nova.`)}
      />
    </div>
  );
}

/* A lista vem de contar(): pares [nome, vezes], do mais pro menos.
   Empatadas no topo, nenhuma é "a melhor": o card diz o empate. */
function primeiro(lista = []) {
  if (!lista.length) return null;
  const n = lista[0][1];
  const nomes = lista.filter(([, v]) => v === n).map(([nome]) => nome);
  if (nomes.length === 1) return { nome: nomes[0], n };
  const juntos = `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
  return { nome: 'Empate', n, empate: juntos };
}

function Destaque({ tom, icone: Icone, rotulo, nome, vezes, vazio, leitura }) {
  return (
    <Card className="hover" style={{ borderLeft: `3px solid var(--${nome ? tom : 'seam'})` }}>
      <div className="row" style={{ gap: 9, marginBottom: 12 }}>
        <span className="stat-ico" style={{ color: nome ? `var(--${tom})` : 'var(--dimmer)' }}>
          <Icone size={15} />
        </span>
        <span className="eyebrow" style={{ marginBottom: 0, alignSelf: 'center' }}>{rotulo}</span>
      </div>

      {nome ? (
        <>
          <div className="destaque-nome" style={{ color: `var(--${tom})` }}>{nome}</div>
          <p className="micro muted" style={{ marginTop: 8, lineHeight: 1.55 }}>{leitura}</p>
        </>
      ) : (
        <p className="tiny muted" style={{ lineHeight: 1.6 }}>{vazio}</p>
      )}
    </Card>
  );
}
