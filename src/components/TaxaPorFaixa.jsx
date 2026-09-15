import React, { useMemo, useState } from 'react';
import { Percent, TriangleAlert, Check, Trophy } from 'lucide-react';
import { Chip, Stat } from './UI';
import { taxaPorFaixa, PERIODOS } from '../lib/periodo';

const COR_FAIXA = {
  branca: '#e8e6e1', azul: '#3b7dd8', roxa: '#7b4fc4', marrom: '#7a4a2b', preta: '#1a1a1a',
};

export default function TaxaPorFaixa({
  sessions, rolls, partners, minhaFaixa = 'branca',
  periodoInicial = 'tudo',
  periodo: periodoFora = null,   // quando a página manda, o seletor some
}) {
  const [periodoLocal, setPeriodoLocal] = useState(periodoInicial);
  const controlado = periodoFora !== null;
  const periodo = controlado ? periodoFora : periodoLocal;
  const setPeriodo = setPeriodoLocal;
  const t = useMemo(
    () => taxaPorFaixa(sessions, rolls, partners, periodo, minhaFaixa),
    [sessions, rolls, partners, periodo, minhaFaixa]
  );

  if (!t.total.n) {
    return (
      <p className="tiny muted">
        Vincule parceiros às suas rolas pra ver contra quem você venceu. Sem isso, a taxa de vitória não significa nada.
        {t.semParceiro > 0 && ` Você tem ${t.semParceiro} rola(s) sem parceiro marcado.`}
      </p>
    );
  }

  return (
    <div className="col anima-troca" key={periodo} style={{ gap: 14 }}>
      {!controlado && (
        <div className="seletor-pill">
          {PERIODOS.map((p) => (
            <button key={p.id} className={periodo === p.id ? 'on' : ''} onClick={() => setPeriodo(p.id)}>
              {p.nome}
            </button>
          ))}
        </div>
      )}

      <div className="taxa-total">
        <div>
          <div className="stat-val num" style={{ fontSize: 34, color: t.total.taxa >= 50 ? 'var(--jade)' : 'var(--chalk)' }}>
            {t.total.taxa}%
          </div>
          <div className="stat-lab">taxa geral</div>
        </div>
        <div className="taxa-total-detalhe">
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span className="tiny"><b className="num" style={{ color: 'var(--jade)' }}>{t.total.v}</b> <span className="muted">vitórias</span></span>
            <span className="tiny"><b className="num" style={{ color: 'var(--blood)' }}>{t.total.d}</b> <span className="muted">derrotas</span></span>
            {t.total.e > 0 && <span className="tiny"><b className="num muted">{t.total.e}</b> <span className="muted">empates</span></span>}
          </div>
          <p className="micro muted" style={{ marginTop: 6 }}>
            {t.total.n} rolas contra {t.total.parceiros} parceiro(s) diferente(s)
          </p>
        </div>
      </div>

      <div className="col" style={{ gap: 11 }}>
        {t.linhas.map((l) => (
          <div key={l.faixa} className="taxa-linha">
            <div className="row" style={{ gap: 9, alignItems: 'center', marginBottom: 6 }}>
              <span className="taxa-faixa-cor" style={{ background: COR_FAIXA[l.faixa], border: l.faixa === 'preta' ? '1px solid #4a5250' : 'none' }} />
              <span className="tiny" style={{ fontWeight: 600, textTransform: 'capitalize', flex: 1 }}>
                {l.faixa}
                {l.acima && <span className="micro" style={{ color: 'var(--roar)', marginLeft: 6 }}>acima de você</span>}
                {l.igual && <span className="micro muted" style={{ marginLeft: 6 }}>sua faixa</span>}
              </span>
              <span className="num micro muted">{l.v}V {l.d}D</span>
              <span className="num tiny" style={{ minWidth: 40, textAlign: 'right', fontWeight: 700, color: l.taxa >= 50 ? 'var(--jade)' : 'var(--blood)' }}>
                {l.taxa}%
              </span>
            </div>
            <div className="taxa-barra">
              <i style={{ width: `${l.taxa}%`, background: l.taxa >= 50 ? 'var(--jade)' : 'var(--blood)' }} />
            </div>
            <div className="row" style={{ gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
              <span className="micro muted">{l.n} rolas · {l.parceiros} parceiro(s)</span>
              {l.fin > 0 && <span className="micro" style={{ color: 'var(--jade)' }}>{l.fin} por finalização</span>}
              {l.pontos > 0 && <span className="micro" style={{ color: 'var(--roar)' }}>{l.pontos} nos pontos</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="divider" />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 12 }}>
        {t.contraAcima.n > 0 && (
          <Stat size="sm" valor={`${t.contraAcima.taxa}%`} label="contra faixa acima" sub={`${t.contraAcima.n} rolas`} tone="roar" />
        )}
        {t.contraIgual.n > 0 && (
          <Stat size="sm" valor={`${t.contraIgual.taxa}%`} label="contra a sua faixa" sub={`${t.contraIgual.n} rolas`} />
        )}
        {t.contraAbaixo.n > 0 && (
          <Stat size="sm" valor={`${t.contraAbaixo.taxa}%`} label="contra faixa abaixo" sub={`${t.contraAbaixo.n} rolas`} />
        )}
      </div>

      <Honestidade t={t} />

      {t.semParceiro > 0 && (
        <p className="micro muted">
          {t.semParceiro} rola(s) sem parceiro marcado ficaram de fora desta conta.
        </p>
      )}
    </div>
  );
}

function Honestidade({ t }) {
  const acima = t.contraAcima;
  const abaixo = t.contraAbaixo;

  if (acima.n >= 5 && acima.taxa >= 35) {
    return (
      <div className="valida bom">
        <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
        <div>
          <div className="tiny" style={{ fontWeight: 600 }}>Isso aqui é o número que vale</div>
          <p className="micro muted" style={{ marginTop: 3 }}>
            {acima.taxa}% contra faixas acima da sua, em {acima.n} rolas. Ganhar de quem sabe mais é o único
            indicador que não mente.
          </p>
        </div>
      </div>
    );
  }
  if (abaixo.n > 0 && acima.n === 0 && t.total.n >= 8) {
    return (
      <div className="valida atencao">
        <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
        <div>
          <div className="tiny" style={{ fontWeight: 600 }}>Sua taxa está inflada</div>
          <p className="micro muted" style={{ marginTop: 3 }}>
            Você não registrou nenhuma rola contra faixa acima da sua. {t.total.taxa}% assim não diz muita coisa ,
            procure os mais graduados e veja o número de verdade.
          </p>
        </div>
      </div>
    );
  }
  if (abaixo.n >= 5 && acima.n >= 5 && abaixo.taxa - acima.taxa >= 35) {
    return (
      <div className="valida atencao">
        <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
        <div>
          <div className="tiny" style={{ fontWeight: 600 }}>A diferença é grande</div>
          <p className="micro muted" style={{ marginTop: 3 }}>
            {abaixo.taxa}% contra quem está abaixo e {acima.taxa}% contra quem está acima.
            Normal, só não deixe a média geral te enganar.
          </p>
        </div>
      </div>
    );
  }
  return null;
}
