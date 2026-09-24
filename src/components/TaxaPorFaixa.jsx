import React, { useMemo, useState } from 'react';
import { TriangleAlert, Check } from 'lucide-react';
import { Stat } from './UI';
import { taxaPorFaixa, PRESETS, periodoDeDados, primeiroTreino } from '../lib/periodo';

const COR_FAIXA = {
  branca: '#e8e6e1', azul: '#3b7dd8', roxa: '#7b4fc4', marrom: '#7a4a2b', preta: '#1a1a1a',
};

export default function TaxaPorFaixa({
  sessions, rolls, partners, minhaFaixa = 'branca',
  periodoInicial = 'desde-inicio',
  periodo: periodoFora = null,   // o objeto de periodoDeDados; quando a página manda, o seletor some
}) {
  const [periodoLocal, setPeriodoLocal] = useState(periodoInicial);
  const controlado = periodoFora !== null;
  const periodo = useMemo(
    () => periodoFora || periodoDeDados(periodoLocal, { desde: primeiroTreino(sessions) }),
    [periodoFora, periodoLocal, sessions]
  );
  const t = useMemo(
    () => taxaPorFaixa(sessions, rolls, partners, periodo, minhaFaixa),
    [sessions, rolls, partners, periodo, minhaFaixa]
  );

  /* fica na tela mesmo sem rola no período, pra dar pra trocar */
  const seletor = !controlado && (
    <div className="seletor-pill">
      {PRESETS.map((id) => periodoDeDados(id)).map((p) => (
        <button key={p.id} className={periodo.id === p.id ? 'on' : ''} onClick={() => setPeriodoLocal(p.id)}>
          {p.rotuloCurto}
        </button>
      ))}
    </div>
  );

  if (!t.total.n) {
    return (
      <div className="col" style={{ gap: 14 }}>
        {seletor}
        <p className="tiny muted">
          {t.semParceiro > 0
            ? `Vincule parceiros aos seus rolas pra ver contra quem você venceu. Sem isso, a taxa de vitória não significa nada. Você tem ${t.semParceiro} ${t.semParceiro === 1 ? 'rola' : 'rolas'} sem parceiro marcado.`
            : `Nenhum rola no período (${periodo.rotulo.toLowerCase()}).`}
        </p>
      </div>
    );
  }

  return (
    <div className="col anima-troca" key={periodo.id} style={{ gap: 14 }}>
      {seletor}

      <div className="taxa-total">
        <div>
          <div className="stat-val num" style={{ fontSize: 34, color: t.total.taxa >= 50 ? 'var(--jade)' : 'var(--chalk)' }}>
            {t.total.taxa}%
          </div>
          <div className="stat-lab">{t.semParceiro ? 'com parceiro marcado' : 'taxa geral'}</div>
        </div>
        <div className="taxa-total-detalhe">
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span className="tiny"><b className="num" style={{ color: 'var(--jade)' }}>{t.total.v}</b> <span className="muted">{t.total.v === 1 ? 'vitória' : 'vitórias'}</span></span>
            <span className="tiny"><b className="num" style={{ color: 'var(--blood)' }}>{t.total.d}</b> <span className="muted">{t.total.d === 1 ? 'derrota' : 'derrotas'}</span></span>
            {t.total.e > 0 && <span className="tiny"><b className="num muted">{t.total.e}</b> <span className="muted">empates</span></span>}
          </div>
          <p className="micro muted" style={{ marginTop: 6 }}>
            {t.total.n} {t.total.n === 1 ? 'rola' : 'rolas'} contra {t.total.parceiros} {t.total.parceiros === 1 ? 'parceiro' : 'parceiros diferentes'}
          </p>
        </div>
      </div>

      <div className="col" style={{ gap: 11 }}>
        {t.linhas.map((l) => (
          <div key={l.faixa} className="taxa-linha">
            <div className="row" style={{ gap: 9, alignItems: 'center', marginBottom: 6 }}>
              <span className="taxa-faixa-cor" style={{ background: COR_FAIXA[l.faixa], border: l.faixa === 'preta' ? '1px solid #4a5250' : 'none' }} />
              <span className="tiny" style={{ fontWeight: 600, flex: 1 }}>
                <span style={{ textTransform: 'capitalize' }}>{l.faixa}</span>
                {l.acima && <span className="micro" style={{ color: 'var(--roar)', marginLeft: 6, whiteSpace: 'nowrap' }}>acima de você</span>}
                {l.igual && <span className="micro muted" style={{ marginLeft: 6, whiteSpace: 'nowrap' }}>sua faixa</span>}
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
              <span className="micro muted">{l.n} {l.n === 1 ? 'rola' : 'rolas'} · {l.parceiros} {l.parceiros === 1 ? 'parceiro' : 'parceiros'}</span>
              {l.fin > 0 && <span className="micro" style={{ color: 'var(--jade)' }}>{l.fin} por finalização</span>}
              {l.pontos > 0 && <span className="micro" style={{ color: 'var(--roar)' }}>{l.pontos} nos pontos</span>}
              {l.tap > 0 && <span className="micro" style={{ color: 'var(--blood)' }}>{l.tap} finalizaç{l.tap > 1 ? 'ões' : 'ão'} sofrida{l.tap > 1 ? 's' : ''}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="divider" />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 12 }}>
        {t.contraAcima.n > 0 && (
          <Stat size="sm" valor={`${t.contraAcima.taxa}%`} label="contra faixa acima" sub={`${t.contraAcima.n} ${t.contraAcima.n === 1 ? 'rola' : 'rolas'}`} tone="roar" />
        )}
        {t.contraIgual.n > 0 && (
          <Stat size="sm" valor={`${t.contraIgual.taxa}%`} label="contra a sua faixa" sub={`${t.contraIgual.n} ${t.contraIgual.n === 1 ? 'rola' : 'rolas'}`} />
        )}
        {t.contraAbaixo.n > 0 && (
          <Stat size="sm" valor={`${t.contraAbaixo.taxa}%`} label="contra faixa abaixo" sub={`${t.contraAbaixo.n} ${t.contraAbaixo.n === 1 ? 'rola' : 'rolas'}`} />
        )}
      </div>

      <Honestidade t={t} />

      {t.semParceiro > 0 && (
        <p className="micro muted">
          {t.semParceiro === 1 ? '1 rola sem parceiro marcado ficou' : `${t.semParceiro} rolas sem parceiro marcado ficaram`} de fora desta conta.
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
            {acima.taxa}% contra faixas acima da sua, em {acima.n} {acima.n === 1 ? 'rola' : 'rolas'}. Ganhar de quem sabe mais é o único
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
            Você não registrou nenhum rola contra faixa acima da sua. {t.total.taxa}% assim não diz muita coisa ,
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
