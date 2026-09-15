import React, { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Flame, Clock, Swords, CalendarDays, Medal,
  ExternalLink, Trophy,
} from 'lucide-react';
import { Sheet, Chip, Stat, Card, Btn, BeltTag } from './UI';
import { calendarioDoAno, anosComTreino, PERIODOS } from '../lib/periodo';
import { fmtData, fmtDur, relativo, hoje, mesNome } from '../lib/utils';
import { placarDaRola, ROTULO_RESULTADO, TOM_RESULTADO } from '../lib/game';
import { agruparPontos, posInicialPorId, pesoRelPorId, somarPontos } from '../db/scoring';
import { APRENDIZADO } from './SeletorTecnica';

const SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const SEMANA_LONGA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export default function Calendario({
  sessions, rolls, partners, gradings = [],
  modo = 'ano',          // 'ano' = meses do período | 'mes' = um mês por vez
  periodo = null,        // quando vem de fora, manda nos meses exibidos
  aoAbrirTreino,
  aoVerTudo,
}) {
  const anos = useMemo(() => anosComTreino(sessions), [sessions]);
  const agora = new Date();
  const [ano, setAno] = useState(anos[0] || agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth());
  const [dia, setDia] = useState(null);

  const { meses, resumo } = useMemo(() => calendarioDoAno(sessions, rolls, ano), [sessions, rolls, ano]);

  const gradPorDia = useMemo(() => {
    const m = new Map();
    for (const g of gradings) m.set(g.data, g);
    return m;
  }, [gradings]);

  const umMes = modo === 'mes';

  /* quando o período vem da página, o calendário obedece a ele */
  const janela = useMemo(() => {
    if (!periodo || periodo === 'tudo') return null;
    const p = PERIODOS.find((x) => x.id === periodo);
    if (!p || !p.dias) return null;
    const fim = new Date();
    const ini = new Date();
    ini.setDate(ini.getDate() - (p.dias - 1));
    return { ini, fim };
  }, [periodo]);

  const visiveis = umMes
    ? [meses[mes]]
    : janela
      ? meses.filter((m) => {
          const ultimoDia = new Date(ano, m.mes + 1, 0);
          const primeiro = new Date(ano, m.mes, 1);
          return ultimoDia >= janela.ini && primeiro <= janela.fim;
        })
      : meses;

  const irMes = (delta) => {
    let m = mes + delta, a = ano;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    if (a > agora.getFullYear() || (a === agora.getFullYear() && m > agora.getMonth())) return;
    setMes(m); setAno(a);
  };

  const doMes = meses[mes]?.dias.filter((d) => d && d.info) || [];
  const minMes = doMes.reduce((a, d) => a + d.info.minutos, 0);
  const rolasMes = doMes.reduce((a, d) => a + d.info.rolas, 0);

  return (
    <div className="col" style={{ gap: 14 }}>
      {/* navegação */}
      {!(janela && !umMes) && (
      <div className="cal-nav">
        <button className="btn icon" onClick={() => (umMes ? irMes(-1) : setAno(ano - 1))} aria-label="Anterior">
          <ChevronLeft size={16} />
        </button>
        <div className="cal-nav-titulo">
          {umMes ? (
            <>
              <span className="cal-nav-mes">{mesNome(mes)}</span>
              <span className="cal-nav-ano num">{ano}</span>
            </>
          ) : (
            <span className="cal-nav-ano num" style={{ fontSize: 22 }}>{ano}</span>
          )}
        </div>
        <button
          className="btn icon"
          onClick={() => (umMes ? irMes(1) : setAno(ano + 1))}
          disabled={umMes
            ? (ano === agora.getFullYear() && mes >= agora.getMonth())
            : ano >= agora.getFullYear()}
          aria-label="Próximo"
        ><ChevronRight size={16} /></button>
      </div>
      )}

      {/* resumo */}
      {umMes ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <Stat size="sm" valor={doMes.length} label="dias" tone={doMes.length ? 'accent' : undefined} />
          <Stat size="sm" valor={fmtDur(minMes)} label="tatame" />
          <Stat size="sm" valor={rolasMes} label="rolas" />
        </div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 12 }}>
            <Stat size="sm" icon={CalendarDays} valor={resumo.treinados} label="dias no tatame" tone="accent" />
            <Stat size="sm" icon={Clock} valor={`${resumo.horas}h`} label="horas" />
            <Stat size="sm" icon={Swords} valor={resumo.rolas} label="rolas" />
            <Stat size="sm" icon={Flame} valor={resumo.maiorSequencia} label="maior sequência" tone="roar" />
          </div>
          {resumo.melhorMes && (
            <p className="tiny muted">
              Média de <b style={{ color: 'var(--chalk)' }}>{resumo.mediaSemana} dias por semana</b>.
              Melhor mês: <b style={{ color: 'var(--accent)' }}>{resumo.melhorMes.nome}</b>, {resumo.melhorMes.horas}h.
            </p>
          )}
        </>
      )}

      <div className={umMes ? 'cal-grade solo anima-troca' : 'cal-grade anima-troca'} key={`${ano}-${umMes ? mes : "ano"}-${periodo || "livre"}`}>
        {visiveis.filter(Boolean).map((m) => (
          <div key={m.mes} className="cal-mes">
            {!umMes && <div className="cal-mes-nome">{m.nome}</div>}
            <div className="cal-semana">
              {SEMANA.map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="cal-dias">
              {m.dias.map((d, i) => {
                if (!d) return <span key={i} className="cal-vazio" />;
                const grad = gradPorDia.get(d.iso);
                return (
                  <button
                    key={i}
                    className={`cal-dia n${d.nivel} ${d.futuro ? 'futuro' : ''} ${d.hoje ? 'hoje' : ''} ${grad ? 'grad' : ''}`}
                    style={{ animationDelay: `${Math.min(500, i * 7)}ms` }}
                    onClick={() => (d.info || grad) && setDia({ ...d, grad })}
                    disabled={!d.info && !grad}
                  >
                    {d.dia}
                    {grad && <span className="cal-grad-ponto" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="micro muted">menos</span>
        {[0, 1, 2, 3, 4].map((n) => <span key={n} className={`cal-dia n${n} legenda`} />)}
        <span className="micro muted">mais</span>
        <span className="spacer" />
        {umMes && aoVerTudo && (
          <button className="btn ghost xs" onClick={aoVerTudo}>ano inteiro <ChevronRight size={12} /></button>
        )}
      </div>

      <DetalheDia
        d={dia} onClose={() => setDia(null)}
        rolls={rolls} partners={partners}
        aoAbrirTreino={aoAbrirTreino}
      />
    </div>
  );
}

/* ---------- o pop-up do dia ---------- */
function DetalheDia({ d, onClose, rolls, partners, aoAbrirTreino }) {
  if (!d) return null;

  const dt = new Date(d.iso + 'T00:00:00');
  const diaSemana = SEMANA_LONGA[(dt.getDay() + 6) % 7];
  const porExtenso = `${diaSemana}, ${dt.getDate()} de ${dt.toLocaleDateString('pt-BR', { month: 'long' })}`;

  const treinos = d.info?.treinos || [];
  const partById = Object.fromEntries(partners.map((p) => [p.id, p]));

  return (
    <Sheet aberto={!!d} onClose={onClose} titulo={porExtenso} subtitulo={`${dt.getFullYear()} · ${relativo(d.iso)}`} wide>
      {d.grad && (
        <div className="valida bom">
          <Medal size={16} className="valida-ico" style={{ color: 'var(--accent)' }} />
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>
              {d.grad.tipo === 'faixa' ? `Ganhou a faixa ${d.grad.faixa}` : `Ganhou o ${d.grad.graus}º grau`}
            </div>
            {d.grad.notas && <p className="micro muted" style={{ marginTop: 3 }}>{d.grad.notas}</p>}
          </div>
        </div>
      )}

      {!treinos.length ? (
        <p className="tiny muted">Nenhum treino registrado neste dia.</p>
      ) : (
        <>
          <div className="grid g3" style={{ gap: 10 }}>
            <Card style={{ padding: 12 }}><Stat size="sm" valor={treinos.length} label={treinos.length > 1 ? 'treinos' : 'treino'} /></Card>
            <Card style={{ padding: 12 }}><Stat size="sm" valor={fmtDur(d.info.minutos)} label="no tatame" tone="accent" /></Card>
            <Card style={{ padding: 12 }}><Stat size="sm" valor={d.info.rolas} label="rolas" /></Card>
          </div>

          {treinos.map((s) => {
            const rs = rolls.filter((r) => r.sessionId === s.id);
            return (
              <div key={s.id} className="card" style={{ background: 'var(--void)' }}>
                <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
                  <Chip tone="warn">{s.tipo === 'gi' ? 'Gi' : s.tipo === 'nogi' ? 'No-Gi' : s.tipo}</Chip>
                  <Chip>{fmtDur(s.duracao)}</Chip>
                  <Chip>RPE {s.rpe}</Chip>
                  {s.professor && <Chip>{s.professor}</Chip>}
                  {s.academia && <Chip>{s.academia}</Chip>}
                </div>

                {s.foco && <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 9 }}>{s.foco}</div>}

                {(s.focoTecnicas || []).length > 0 && (
                  <div style={{ marginBottom: 11 }}>
                    <div className="eyebrow" style={{ marginBottom: 7 }}>técnicas da aula</div>
                    <div className="row wrap" style={{ gap: 5 }}>
                      {s.focoTecnicas.map((f, k) => {
                        const a = APRENDIZADO.find((x) => x.id === f.aprendizado);
                        return <Chip key={k} tone={a?.cor || ''}>{f.nome}{a && ` · ${a.nome}`}</Chip>;
                      })}
                    </div>
                  </div>
                )}

                {rs.length > 0 && (
                  <div style={{ marginBottom: 11 }}>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>os rolas do dia</div>
                    <div className="col" style={{ gap: 9 }}>
                      {rs.map((r, i) => {
                        const pl = placarDaRola(r);
                        const p = partById[r.partnerId];
                        return (
                          <div key={i} className="rola-card">
                            <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
                              <span className="num micro muted">#{i + 1}</span>
                              <span className="tiny" style={{ fontWeight: 600 }}>{p?.nome || 'Sem parceiro'}</span>
                              {p?.faixa && <BeltTag faixa={p.faixa} graus={p.graus} />}
                              {p?.pesoKg && <Chip>{p.pesoKg} kg</Chip>}
                              {r.pesoRel && <Chip>{pesoRelPorId[r.pesoRel]?.icone} {r.pesoRel === 'similar' ? 'peso igual' : r.pesoRel}</Chip>}
                              <span className="spacer" />
                              <span className="micro muted num">{r.duracao}min</span>
                            </div>

                            <div className="row wrap" style={{ gap: 10, marginTop: 9, alignItems: 'center' }}>
                              <span className="num" style={{ fontSize: 19, fontWeight: 700, color: 'var(--jade)' }}>{pl.meus}</span>
                              <span className="micro muted">×</span>
                              <span className="num" style={{ fontSize: 19, fontWeight: 700, color: 'var(--blood)' }}>{pl.dele}</span>
                              <Chip tone={TOM_RESULTADO[pl.resultado] || ''}>{ROTULO_RESULTADO[pl.resultado]}</Chip>
                              {r.posInicial && <span className="micro muted">de {posInicialPorId[r.posInicial]?.nome}</span>}
                            </div>

                            {((r.ptsMeus || []).length > 0 || (r.ptsDele || []).length > 0) && (
                              <div className="row wrap" style={{ gap: 5, marginTop: 8 }}>
                                {agruparPontos(r.ptsMeus).map((x) => {
                                  const tecs = (r.tecMeus || {})[x.id] || [];
                                  return <Chip key={'pm' + x.id} tone="jade">▲ {tecs.length ? tecs.join(' + ') : x.nome}{x.n > 1 && <b className="num"> ×{x.n}</b>}</Chip>;
                                })}
                                {agruparPontos(r.ptsDele).map((x) => {
                                  const tecs = (r.tecDele || {})[x.id] || [];
                                  return <Chip key={'pd' + x.id} tone="blood">▼ {tecs.length ? tecs.join(' + ') : x.nome}{x.n > 1 && <b className="num"> ×{x.n}</b>}</Chip>;
                                })}
                              </div>
                            )}

                            {((r.subsAplicadas || []).length > 0 || (r.subsSofridas || []).length > 0) && (
                              <div className="row wrap" style={{ gap: 5, marginTop: 7 }}>
                                {(r.subsAplicadas || []).map((x, k) => <Chip key={'a' + k} tone="jade">▲ {x}</Chip>)}
                                {(r.subsSofridas || []).map((x, k) => <Chip key={'s' + k} tone="blood">▼ {x}</Chip>)}
                              </div>
                            )}

                            {r.notas?.trim() && (
                              <p className="tiny" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--seam)' }}>
                                {r.notas}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(s.nota || s.funcionou || s.focar) && (
                  <div style={{ borderTop: '1px solid var(--seam)', paddingTop: 10 }}>
                    <div className="eyebrow" style={{ marginBottom: 6 }}>anotação da aula</div>
                    <p className="tiny muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {s.nota || [s.funcionou, s.falhou, s.focar].filter(Boolean).join('\n')}
                    </p>
                  </div>
                )}

                {aoAbrirTreino && (
                  <Btn size="sm" icon={ExternalLink} onClick={() => { onClose(); aoAbrirTreino(s); }} style={{ marginTop: 12 }}>
                    Abrir este treino
                  </Btn>
                )}
              </div>
            );
          })}
        </>
      )}
    </Sheet>
  );
}
