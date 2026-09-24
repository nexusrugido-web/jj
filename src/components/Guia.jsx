import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/* ============================================================
   GUIA EM TÓPICOS

   Toda explicação do app segue este formato: uma lista de
   perguntas, cada uma com uma linha de resumo, que abre quando
   tocada. Quem quer uma resposta acha ela em dois segundos, sem
   rolar um texto inteiro.

   topicos  [{ id, icone, titulo, resumo, conteudo }]
   inicial  o id do que já vem aberto
   ============================================================ */
export default function Guia({ topicos, inicial = null }) {
  const [aberto, setAberto] = useState(inicial);
  return (
    <div className="guia">
      {topicos.filter(Boolean).map((t) => {
        const on = aberto === t.id;
        const Ico = t.icone;
        return (
          <div key={t.id} className={`guia-item ${on ? 'on' : ''}`}>
            <button type="button" className="guia-cab" onClick={() => setAberto(on ? null : t.id)} aria-expanded={on}>
              {Ico && <span className="guia-ico"><Ico size={17} /></span>}
              <span className="guia-txt">
                <span className="guia-tit">{t.titulo}</span>
                {t.resumo && <span className="guia-res">{t.resumo}</span>}
              </span>
              <ChevronDown size={18} className="guia-seta" />
            </button>
            {on && <div className="guia-corpo">{t.conteudo}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* passos numerados, pra "como funciona" que tem ordem */
export function Passos({ itens }) {
  return (
    <ol className="guia-passos">
      {itens.map((x, i) => (
        <li key={i}><span className="guia-n num">{i + 1}</span><span>{x}</span></li>
      ))}
    </ol>
  );
}

/* linha de tabela: o que é, quanto vale, e um detalhe embaixo */
export function Linha({ nome, valor, detalhe, tom = 'accent' }) {
  return (
    <div className="guia-linha">
      <div className="row" style={{ gap: 10 }}>
        <span className="tiny" style={{ flex: 1, fontWeight: 600 }}>{nome}</span>
        {valor != null && <span className="num tiny" style={{ color: `var(--${tom})`, fontWeight: 700 }}>{valor}</span>}
      </div>
      {detalhe && <p className="micro muted" style={{ marginTop: 3 }}>{detalhe}</p>}
    </div>
  );
}
