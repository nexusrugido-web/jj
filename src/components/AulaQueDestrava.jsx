import React from 'react';
import { Lock, Crown, Play } from 'lucide-react';
import Capa from './Capa';
import { Btn } from './UI';
import { aulasPara } from '../lib/motor';
import { acervo } from '../lib/acervo';
import { duracaoTexto } from '../lib/aulas';

/* ============================================================
   A AULA QUE DESTRAVA ISSO

   O app já sabe o que trava a pessoa (o golpe que mais pega, a
   recomendação do Pra você). Aqui ele procura, entre as aulas
   exclusivas do Premium, a que vai direto naquilo, pelo mesmo
   motor que escolhe as outras. Só aparece se ela for do assunto
   de verdade: nada de exclusiva aleatória.

   Quem é grátis vê a aula com cadeado e o convite pra desbloquear;
   quem assina vê o botão de assistir.
   ============================================================ */
export function exclusivaPara(pedido, { faixa, vistas = [], excluir = [] } = {}) {
  if (!pedido) return null;
  const lista = acervo().filter((a) => a.acesso === 'assinantes' && a.k === 'aula' && !excluir.includes(a.id));
  if (!lista.length) return null;
  const [a] = aulasPara(pedido, { faixa, vistas, quantidade: 1, lista });
  return a && !a.reserva && !a.generico ? a : null;
}

export default function AulaQueDestrava({ aula, motivo, livre, onAbrir, texto = null }) {
  if (!aula) return null;
  return (
    <button type="button" className="destrava" onClick={() => onAbrir(aula)}>
      <div className="destrava-capa">
        <Capa id={aula.id} propria={aula.capa} tamanho="sd" />
        {!livre && <span className="destrava-cadeado"><Lock size={16} /></span>}
        <span className="aula-dur">{duracaoTexto(aula.d)}</span>
      </div>
      <div className="destrava-txt">
        <div className="destrava-eyebrow"><Crown size={11} /> só no app · a aula que destrava isso</div>
        <div className="destrava-titulo">{aula.t}</div>
        <p className="micro muted" style={{ lineHeight: 1.55 }}>
          {texto || (livre
            ? 'Exclusiva do Premium, escolhida pelo que te trava. Ela vai mais fundo que as do YouTube.'
            : `Você trava em ${motivo}. Essa aula vai fundo nisso, e não está no YouTube nem em lugar nenhum além do app.`)}
        </p>
        <Btn size="sm" variant="primary" icon={livre ? Play : Crown} style={{ marginTop: 8 }}>
          {livre ? 'Assistir' : 'Desbloquear a aula'}
        </Btn>
      </div>
    </button>
  );
}
