import React, { useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { Btn } from './UI';

/* ============================================================
   ACEITE

   Pedido uma vez só, antes de a pessoa usar o app. Registra
   data e versão do documento aceito, que é o que serve de
   prova se algum dia precisar.

   Os dois itens ficam separados: um é o contrato, o outro é o
   reconhecimento de que isto não substitui professor nem
   médico. Juntar os dois numa caixa só enfraquece os dois.
   ============================================================ */

export const VERSAO_DOCS = '2026-09-14';

export default function Aceite({ onAceitar, onSair, irPara }) {
  const [contrato, setContrato] = useState(false);
  const [limites, setLimites] = useState(false);
  const pronto = contrato && limites;

  return (
    <div className="entrada">
      <div className="entrada-card">
        <div className="entrada-topo">
          <span className="brand-mark" />
          <div className="entrada-marca">
            <span className="entrada-nome">NeuroJitsu</span>
            <span className="entrada-sub">antes de começar</span>
          </div>
        </div>

        <div className="entrada-corpo">
          <div>
            <h1 className="entrada-titulo">Duas coisas rápidas</h1>
            <p className="entrada-apoio" style={{ marginTop: 8 }}>
              É pedido uma vez só, e depois você não vê mais.
            </p>
          </div>

          <button type="button" className={`aceite ${contrato ? 'on' : ''}`} onClick={() => setContrato(!contrato)}>
            <span className="aceite-caixa"><Check size={12} strokeWidth={3} /></span>
            <span className="aceite-txt">
              Li e aceito os{' '}
              <a onClick={(e) => { e.stopPropagation(); irPara('termos'); }}>termos de uso</a>
              {' '}e a{' '}
              <a onClick={(e) => { e.stopPropagation(); irPara('privacidade'); }}>política de privacidade</a>.
            </span>
          </button>

          <button type="button" className={`aceite ${limites ? 'on' : ''}`} onClick={() => setLimites(!limites)}>
            <span className="aceite-caixa"><Check size={12} strokeWidth={3} /></span>
            <span className="aceite-txt">
              Entendo que o NeuroJitsu organiza os meus treinos e sugere o que estudar, mas não substitui o meu
              professor nem orientação médica.
            </span>
          </button>

          <p className="micro muted" style={{ lineHeight: 1.65 }}>
            Os seus treinos ficam no seu aparelho e não são mostrados pra ninguém sem você mandar.
          </p>
        </div>

        <div className="entrada-pe">
          <button className="btn ghost" onClick={onSair}>Agora não</button>
          <span className="spacer" />
          <Btn
            variant="primary"
            icon={Check}
            disabled={!pronto}
            onClick={() => onAceitar({ versao: VERSAO_DOCS, em: new Date().toISOString() })}
          >
            Aceitar e continuar
          </Btn>
        </div>
      </div>
    </div>
  );
}
