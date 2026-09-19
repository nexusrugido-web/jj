import React, { useState, useEffect } from 'react';
import { Gauge, RefreshCw, Clapperboard, TrendingDown, Lock, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, Btn, Chip, Stat, Bar, Empty, useToast } from './UI';
import { INTENCOES } from '../lib/recomendar';
import { DIFICULDADES } from '../lib/necessidades';
import { fmtData } from '../lib/utils';

/* ============================================================
   MEDIÇÃO DO ESTUDO

   Uma pergunta: a recomendação vira vídeo assistido?

   E duas que saem dela: qual vídeo a pessoa larga no meio, e onde
   falta vídeo. Esta última é a pauta de gravação: o aluno
   precisava de uma aula pra aquilo e o acervo não tinha, então o
   app mostrou uma aula de conceito no lugar.

   Tudo aqui são números somados (supabase/medicao.sql). Nenhuma
   linha é de uma pessoa.
   ============================================================ */

const PERIODOS = [{ dias: 7, nome: '7 dias' }, { dias: 30, nome: '30 dias' }, { dias: 90, nome: '90 dias' }];

const NOME_DO_TIPO = {
  rec: 'Recomendação dos rolas',
  dificuldade: 'Dificuldade que o aluno marcou',
  estilo: 'Estilo que o aluno marcou',
  entrada: 'Aluno novo, sem registro',
  'aba-dificuldade': 'Aba "Por dificuldade"',
  tema: 'Navegando por tema',
  vistas: 'Revendo o que já viu',
};

const taxa = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');

export default function Medicao() {
  const toast = useToast();
  const [dias, setDias] = useState(30);
  const [m, setM] = useState(null);
  const [carregando, setCarregando] = useState(true);

  async function buscar() {
    if (!supabase) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const { data, error } = await supabase.rpc('medicao_estudo', { p_dias: dias });
      if (error) throw error;
      setM(data);
    } catch (e) {
      console.error('[medicao]', e);
      toast('Não consegui ler a medição. Rodou o medicao.sql?', 'err');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { buscar(); }, [dias]);

  const porTipo = m?.por_tipo || [];
  const soma = (k) => porTipo.filter((t) => t.tipo !== 'tema' && t.tipo !== 'vistas').reduce((a, t) => a + (t[k] || 0), 0);
  const barrado = m?.barrado || {};

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">a recomendação vira vídeo assistido?</div>
            <h2 className="h-sec row" style={{ gap: 8 }}><Gauge size={16} /> Medição do Estudo</h2>
          </div>
          <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={buscar} disabled={carregando}>Atualizar</Btn>
        </div>

        <div className="seletor-pill" style={{ marginBottom: 14 }}>
          {PERIODOS.map((p) => (
            <button key={p.dias} className={dias === p.dias ? 'on' : ''} onClick={() => setDias(p.dias)}>{p.nome}</button>
          ))}
        </div>

        {carregando && !m ? (
          <p className="tiny muted">Somando.</p>
        ) : !m?.pessoas ? (
          <Empty
            icon={Gauge}
            titulo="Ainda sem medição"
            texto="Os números aparecem conforme os alunos abrem o Estudo com a versão nova do app."
          />
        ) : (
          <>
            <div className="grid g4" style={{ gap: 12 }}>
              <Stat size="sm" valor={m.pessoas} label="alunos medidos" />
              <Stat size="sm" valor={soma('exibiu')} label="vídeos recomendados" />
              <Stat size="sm" valor={taxa(soma('abriu'), soma('exibiu'))} label="viraram vídeo aberto" tone="accent" />
              <Stat size="sm" valor={taxa(soma('concluiu'), soma('abriu'))} label="dos abertos, terminados" tone="jade" />
            </div>
            <p className="micro muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
              Recomendado conta uma vez por dia por aluno e lugar. Não entram a navegação por tema e o rever.
            </p>
          </>
        )}
      </Card>

      {m?.pessoas > 0 && (
        <>
          {/* ---------- a pauta ---------- */}
          <Card style={{ marginBottom: 14 }}>
            <div className="card-head">
              <div>
                <div className="eyebrow">pauta de gravação</div>
                <h2 className="h-sec row" style={{ gap: 8 }}><Clapperboard size={16} /> Onde falta vídeo</h2>
              </div>
            </div>
            {!(m.faltou || []).length ? (
              <p className="tiny muted">No período, toda necessidade achou vídeo do assunto.</p>
            ) : (
              <>
                <p className="micro muted" style={{ marginBottom: 10, lineHeight: 1.6 }}>
                  O aluno precisava de uma aula pra isso e o acervo não tinha. O app mostrou uma aula de conceito no
                  lugar. Quanto mais gente, mais vale gravar.
                </p>
                <div className="col" style={{ gap: 6 }}>
                  {m.faltou.map((f, i) => (
                    <div key={i} className="liga-linha" style={{ alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="tiny" style={{ fontWeight: 600 }}>{f.pedido}</div>
                        <div className="micro muted">{NOME_DO_TIPO[f.tipo] || f.tipo} · última vez {fmtData(f.ultimo)}</div>
                      </div>
                      <Chip tone="roar">{f.pessoas} {f.pessoas === 1 ? 'aluno' : 'alunos'}</Chip>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* ---------- o funil por tipo ---------- */}
          <Card style={{ marginBottom: 14 }}>
            <div className="card-head">
              <div>
                <div className="eyebrow">de onde o aluno abre</div>
                <h2 className="h-sec">Cada tipo de recomendação</h2>
              </div>
            </div>
            <div className="col" style={{ gap: 10 }}>
              {porTipo.map((t) => (
                <Funil
                  key={t.tipo}
                  nome={NOME_DO_TIPO[t.tipo] || t.tipo}
                  exibiu={t.exibiu}
                  abriu={t.abriu}
                  concluiu={t.concluiu}
                  extra={[
                    t.faltou ? `${t.faltou} sem vídeo do assunto` : null,
                    t.barrado ? `${t.barrado} barrados` : null,
                  ].filter(Boolean).join(' · ')}
                />
              ))}
            </div>
          </Card>

          {!!(m.por_rec || []).length && (
            <Card style={{ marginBottom: 14 }}>
              <div className="card-head">
                <div>
                  <div className="eyebrow">o que sai dos rolas</div>
                  <h2 className="h-sec">Recomendação por intenção</h2>
                </div>
              </div>
              <div className="col" style={{ gap: 10 }}>
                {m.por_rec.map((r) => (
                  <Funil
                    key={r.intencao}
                    nome={INTENCOES[r.intencao]?.nome || DIFICULDADES.find((d) => d.id === r.intencao)?.nome || r.intencao}
                    exibiu={r.exibiu}
                    abriu={r.abriu}
                    concluiu={r.concluiu}
                    extra={r.faltou ? `${r.faltou} sem vídeo do assunto` : ''}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* ---------- os vídeos ---------- */}
          <div className="grid g2" style={{ gap: 14, marginBottom: 14 }}>
            <Card>
              <div className="card-head">
                <h2 className="h-sec">Mais abertos por recomendação</h2>
              </div>
              {!(m.videos || []).length ? (
                <p className="tiny muted">Nenhum ainda.</p>
              ) : (
                <div className="col" style={{ gap: 6 }}>
                  {m.videos.map((v) => (
                    <div key={v.video_id} className="liga-linha">
                      <span className="tiny" style={{ flex: 1, minWidth: 0 }}>{v.titulo}</span>
                      <span className="micro muted num">{v.abriu} abertos</span>
                      <Chip tone={v.concluiu / v.abriu >= 0.5 ? 'jade' : ''}>{taxa(v.concluiu, v.abriu)} terminam</Chip>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="card-head">
                <h2 className="h-sec row" style={{ gap: 8 }}><TrendingDown size={16} /> Largados no meio</h2>
              </div>
              {!(m.abandono || []).length ? (
                <p className="tiny muted">
                  Nenhum vídeo aberto 3 vezes ou mais ficou abaixo de 30% de gente terminando.
                </p>
              ) : (
                <>
                  <p className="micro muted" style={{ marginBottom: 10, lineHeight: 1.6 }}>
                    Aberto 3 vezes ou mais, e menos de 30% termina. Ou o vídeo não entrega o que o título promete, ou
                    está sendo recomendado pra quem não precisa dele.
                  </p>
                  <div className="col" style={{ gap: 6 }}>
                    {m.abandono.map((v) => (
                      <div key={v.video_id} className="liga-linha">
                        <span className="tiny" style={{ flex: 1, minWidth: 0 }}>{v.titulo}</span>
                        <Chip tone="blood">{v.concluiu} de {v.abriu}</Chip>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="grid g2" style={{ gap: 14, marginBottom: 14 }}>
            <Card>
              <div className="card-head">
                <h2 className="h-sec row" style={{ gap: 8 }}><Lock size={16} /> Quando o vídeo não abriu</h2>
              </div>
              <div className="grid g2" style={{ gap: 12 }}>
                <Stat size="sm" valor={barrado.limite || 0} label="bateram no limite do grátis" tone={barrado.limite ? 'roar' : undefined} />
                <Stat size="sm" valor={barrado.pago || 0} label="tentaram abrir vídeo pago" tone={barrado.pago ? 'roar' : undefined} />
              </div>
              <p className="micro muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
                Cada uma é alguém que quis assistir e viu o convite pra assinar ou comprar.
              </p>
            </Card>

            <Card>
              <div className="card-head">
                <h2 className="h-sec row" style={{ gap: 8 }}><Check size={16} /> "Já treinei isso"</h2>
              </div>
              {!(m.feitas || []).length ? (
                <p className="tiny muted">Ninguém marcou no período.</p>
              ) : (
                <div className="col" style={{ gap: 8 }}>
                  {m.feitas.map((f) => (
                    <div key={f.intencao} className="liga-linha">
                      <span className="tiny" style={{ flex: 1 }}>{INTENCOES[f.intencao]?.nome || f.intencao}</span>
                      <Chip tone="jade">{f.funcionou} funcionou</Chip>
                      {f.meio > 0 && <Chip tone="roar">{f.meio} mais ou menos</Chip>}
                      {f.nao > 0 && <Chip tone="blood">{f.nao} não saiu</Chip>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function Funil({ nome, exibiu, abriu, concluiu, extra }) {
  return (
    <div>
      <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="tiny" style={{ fontWeight: 600, flex: 1 }}>{nome}</span>
        <span className="micro muted num">
          {exibiu > 0 && `${exibiu} mostrados · `}
          {abriu} abertos{exibiu > 0 && ` (${taxa(abriu, exibiu)})`} · {concluiu} terminados ({taxa(concluiu, abriu)})
        </span>
      </div>
      {/* sem "mostrado" (a pessoa escolheu sozinha, navegando) não
          existe taxa de abertura, e a barra enganaria */}
      {exibiu > 0 && (
        <div style={{ marginTop: 6 }}>
          <Bar v={abriu} max={Math.max(exibiu, abriu, 1)} tone="jade" />
        </div>
      )}
      {extra && <div className="micro muted" style={{ marginTop: 4 }}>{extra}</div>}
    </div>
  );
}
