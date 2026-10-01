import React, { useMemo } from 'react';
import { Sheet, BeltTag, Chip } from './UI';
import { Vitrine } from './Plano';
import { podeVer, pedirOferta } from '../lib/plano';
import { raioX } from '../lib/raioX';
import { pesoRelPorId } from '../db/scoring';

/* ============================================================
   A FOLHA DO RAIO-X

   No grátis, o placar entre vocês. No Premium, o resto: de onde
   você vai bem e mal contra ele, o que você encaixa, o que ele faz
   em você e o plano pro próximo rola.
   ============================================================ */
export default function RaioXParceiro({ parceiro, rolls, acesso, onClose }) {
  const rx = useMemo(() => (parceiro ? raioX(parceiro.id, rolls) : null), [parceiro, rolls]);
  const livre = podeVer(acesso, 'raioX');

  const detalhe = rx && (
    <div className="col" style={{ gap: 10 }}>
      {rx.melhor && <div className="rel-linha">✅ <span>Você vai bem começando <b>{rx.melhor.nome.toLowerCase()}</b> ({rx.melhor.v} de {rx.melhor.n})</span></div>}
      {rx.pior && <div className="rel-linha">🔻 <span>Contra ele, cuidado ao começar <b>{rx.pior.nome.toLowerCase()}</b> ({rx.pior.v} de {rx.pior.n})</span></div>}
      {rx.minhas.length > 0 && <div className="rel-linha">🎯 <span>O que já entrou nele: <b>{rx.minhas.map((x) => `${x.nome} (${x.vezes}x)`).join(', ')}</b></span></div>}
      {rx.dele.length > 0 && <div className="rel-linha">⚠️ <span>Ele te pega com: <b>{rx.dele.map((x) => `${x.nome} (${x.vezes}x)`).join(', ')}</b></span></div>}
      {rx.dele.length === 0 && rx.pontosDele.length > 0 && <div className="rel-linha">⚠️ <span>Ele pontua mais com: <b>{rx.pontosDele.map((x) => x.nome).join(', ')}</b></span></div>}
      {rx.plano
        ? <div className="raiox-plano"><b>Próximo rola:</b> {rx.plano.charAt(0).toUpperCase() + rx.plano.slice(1)}.</div>
        : <p className="micro muted">Com 3 rolas registrados com ele, o app monta o plano do próximo.</p>}
    </div>
  );

  return (
    <Sheet aberto={!!parceiro} onClose={onClose} titulo={parceiro ? `Você × ${parceiro.nome}` : ''} subtitulo="raio-x dos rolas entre vocês">
      {parceiro && rx && (
        <>
          <div className="row wrap" style={{ gap: 6 }}>
            {parceiro.faixa ? <BeltTag faixa={parceiro.faixa} graus={parceiro.graus} /> : <Chip>faixa não informada</Chip>}
            {parceiro.pesoRel && <Chip>{pesoRelPorId[parceiro.pesoRel]?.icone} {pesoRelPorId[parceiro.pesoRel]?.nome}</Chip>}
          </div>
          {rx.rolas === 0 ? (
            <p className="tiny muted">Nenhum rola registrado com {parceiro.nome} ainda. Escolhe ele no próximo rola que o raio-x começa a montar.</p>
          ) : (
            <>
              <div className="rel-numeros">
                <div><b className="num" style={{ color: 'var(--jade)' }}>{rx.venceu}</b><small>você ganhou</small></div>
                <div><b className="num" style={{ color: 'var(--blood)' }}>{rx.perdeu}</b><small>ele ganhou</small></div>
                <div><b className="num">{rx.empate}</b><small>{rx.empate === 1 ? 'empate' : 'empates'}</small></div>
              </div>
              <p className="micro muted">{rx.rolas} {rx.rolas === 1 ? 'rola registrado' : 'rolas registrados'} entre vocês.</p>
              {livre ? detalhe : (
                <Vitrine
                  recurso="raioX"
                  fundo={detalhe}
                  titulo={`O raio-x contra ${parceiro.nome}`}
                  texto="De onde você vai bem contra ele, o que ele faz em você e o plano pro próximo rola."
                  itens={['A posição de onde você ganha dele', 'O que ele mais encaixa em você', 'Um plano pro próximo rola']}
                  onAssinar={() => pedirOferta('raioX')}
                />
              )}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
