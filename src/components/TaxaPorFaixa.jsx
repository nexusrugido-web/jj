import React, { useMemo, useState } from 'react';
import { TriangleAlert, Check } from 'lucide-react';
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

      {/* o total: o número grande e a barra de vitória, empate e derrota */}
      <div className="taxa-total">
        <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div className="stat-val num" style={{ fontSize: 38, lineHeight: 1, color: t.total.taxa >= 50 ? 'var(--jade)' : 'var(--chalk)' }}>
              {t.total.taxa}%
            </div>
            <div className="stat-lab" style={{ marginTop: 4 }}>de vitória {t.semParceiro ? 'com parceiro marcado' : 'no período'}</div>
          </div>
          <div className="micro muted" style={{ textAlign: 'right', lineHeight: 1.5 }}>
            <b className="num" style={{ color: 'var(--chalk)' }}>{t.total.n}</b> {t.total.n === 1 ? 'rola' : 'rolas'}<br />
            <b className="num" style={{ color: 'var(--chalk)' }}>{t.total.parceiros}</b> {t.total.parceiros === 1 ? 'parceiro' : 'parceiros'}
          </div>
        </div>
        <BarraVED v={t.total.v} e={t.total.e} d={t.total.d} grossa />
        <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
          <span className="tiny"><i className="taxa-ponto" style={{ background: 'var(--jade)' }} /><b className="num">{t.total.v}</b> <span className="muted">{t.total.v === 1 ? 'vitória' : 'vitórias'}</span></span>
          {t.total.e > 0 && <span className="tiny"><i className="taxa-ponto" style={{ background: 'var(--dim)' }} /><b className="num">{t.total.e}</b> <span className="muted">{t.total.e === 1 ? 'empate' : 'empates'}</span></span>}
          <span className="tiny"><i className="taxa-ponto" style={{ background: 'var(--blood)' }} /><b className="num">{t.total.d}</b> <span className="muted">{t.total.d === 1 ? 'derrota' : 'derrotas'}</span></span>
        </div>
      </div>

      {/* uma faixa por bloco */}
      <div className="col" style={{ gap: 10 }}>
        {t.linhas.map((l) => (
          <div key={l.faixa} className="taxa-bloco">
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <span className="taxa-faixa-cor" style={{ background: COR_FAIXA[l.faixa], border: l.faixa === 'preta' ? '1px solid #4a5250' : 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tiny" style={{ fontWeight: 800, textTransform: 'capitalize' }}>{l.faixa}</div>
                <div className="micro" style={{ color: l.acima ? 'var(--roar)' : 'var(--dim)', fontWeight: 600 }}>
                  {l.acima ? 'acima de você' : l.igual ? 'sua faixa' : 'abaixo de você'}
                </div>
              </div>
              <span className="num" style={{ fontSize: 22, fontWeight: 800, color: l.taxa >= 50 ? 'var(--jade)' : 'var(--blood)' }}>{l.taxa}%</span>
            </div>
            <BarraVED v={l.v} e={l.e} d={l.d} />
            <div className="micro muted">{l.n} {l.n === 1 ? 'rola' : 'rolas'} com {l.parceiros} {l.parceiros === 1 ? 'parceiro' : 'parceiros'}: {l.v} {l.v === 1 ? 'vitória' : 'vitórias'}, {l.d} {l.d === 1 ? 'derrota' : 'derrotas'}{l.e ? `, ${l.e} ${l.e === 1 ? 'empate' : 'empates'}` : ''}</div>
            <div className="taxa-numeros">
              <div><b className="num" style={{ color: 'var(--jade)' }}>{l.fin}</b><span>venceu no tap</span></div>
              <div><b className="num" style={{ color: 'var(--jade-claro)' }}>{l.pontos}</b><span>venceu no placar</span></div>
              <div><b className="num" style={{ color: 'var(--blood)' }}>{l.tap}</b><span>{l.tap === 1 ? 'vez que você bateu' : 'vezes que você bateu'}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* a comparação que importa, em barras */}
      <div className="col" style={{ gap: 10 }}>
        <div className="eyebrow">vitória por faixa do parceiro</div>
        {[
          { k: 'acima', nome: 'Contra faixa acima', o: t.contraAcima, cor: 'var(--roar)' },
          { k: 'igual', nome: 'Contra a sua faixa', o: t.contraIgual, cor: 'var(--chalk)' },
          { k: 'abaixo', nome: 'Contra faixa abaixo', o: t.contraAbaixo, cor: 'var(--dim)' },
        ].filter((x) => x.o.n > 0).map((x) => (
          <div key={x.k}>
            <div className="row" style={{ gap: 8, alignItems: 'baseline', marginBottom: 5 }}>
              <span className="tiny" style={{ fontWeight: 600, flex: 1 }}>{x.nome}</span>
              <span className="micro muted">{x.o.n} {x.o.n === 1 ? 'rola' : 'rolas'}</span>
              <span className="num tiny" style={{ fontWeight: 800, minWidth: 40, textAlign: 'right', color: x.cor }}>{x.o.taxa}%</span>
            </div>
            <div className="taxa-barra"><i style={{ width: `${Math.max(2, x.o.taxa)}%`, background: x.cor }} /></div>
          </div>
        ))}
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

/* vitória, empate e derrota numa barra só, na proporção */
function BarraVED({ v, e, d, grossa = false }) {
  const n = v + e + d || 1;
  return (
    <div className={`taxa-ved${grossa ? ' grossa' : ''}`} role="img" aria-label={`${v} vitórias, ${e} empates, ${d} derrotas`}>
      {v > 0 && <i style={{ flex: v / n, background: 'var(--jade)' }} />}
      {e > 0 && <i style={{ flex: e / n, background: 'var(--dim)' }} />}
      {d > 0 && <i style={{ flex: d / n, background: 'var(--blood)' }} />}
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
