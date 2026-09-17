import React, { useState } from 'react';
import {
  Check, Lock, Sparkles, Download, CloudOff, Ticket, TriangleAlert, Crown,
} from 'lucide-react';
import { Card, Btn, Chip, Input, Field, Sheet, useToast } from './UI';
import { RECURSOS, LIMITES, ativarCodigo, diasParaVencer } from '../lib/plano';
import { MOTIVOS_PAUSA, ofertaDeSaida, pausar, pausaAtiva, retomar } from '../lib/retencao';
import { fmtData } from '../lib/utils';

/* ============================================================
   PLANO
   ============================================================ */

export default function Plano({ acesso, recarregar, compacto = false }) {
  const toast = useToast();
  const [ativando, setAtivando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [pausa, setPausa] = useState(null);

  React.useEffect(() => { pausaAtiva().then(setPausa); }, []);

  const dias = diasParaVencer(acesso);
  const gratis = Object.entries(RECURSOS).filter(([, r]) => !r.premium);
  const pagos = Object.entries(RECURSOS).filter(([, r]) => r.premium);

  async function ativar() {
    setEnviando(true);
    try {
      const r = await ativarCodigo(codigo);
      toast(r.mensagem, r.ok ? '' : 'err');
      if (r.ok) { setAtivando(false); setCodigo(''); recarregar?.(); }
    } finally {
      setEnviando(false);
    }
  }

  if (acesso?.premium) {
    return (
      <Card className="accent" style={{ marginBottom: compacto ? 0 : 14 }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <span className="stat-ico" style={{ color: 'var(--accent)' }}><Crown size={17} /></span>
          <div style={{ flex: 1 }}>
            <div className="row wrap" style={{ gap: 7 }}>
              <h2 className="h-sec">Premium ativo</h2>
              {acesso.status === 'carencia' && <Chip tone="warn">pagamento pendente</Chip>}
            </div>
            <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.65 }}>
              {acesso.status === 'carencia'
                ? acesso.motivo
                : acesso.venceEm
                  ? `Renova em ${fmtData(String(acesso.venceEm).slice(0, 10))}${dias !== null && dias <= 7 ? `, daqui a ${dias} dias` : ''}.`
                  : 'Tudo liberado.'}
            </p>

            {pausa ? (
              <div className="valida atencao" style={{ marginTop: 12 }}>
                <Check size={14} className="valida-ico" style={{ color: 'var(--roar)' }} />
                <div>
                  <p className="micro muted" style={{ lineHeight: 1.65 }}>
                    Sua conta está pausada até {fmtData(pausa.ate)}. Não cobramos nada nesse período.
                  </p>
                  <button className="btn ghost xs" style={{ marginTop: 8 }}
                    onClick={async () => { await retomar(); setPausa(null); toast('Bom te ver de volta'); }}>
                    Voltar agora
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn ghost xs" style={{ marginTop: 12, opacity: 0.7 }} onClick={() => setSaindo(true)}>
                Preciso parar por um tempo
              </button>
            )}
          </div>
        </div>

        <Saida
          aberto={saindo}
          onClose={() => setSaindo(false)}
          onPausar={async (meses, motivo) => {
            const p = await pausar(meses, motivo);
            setPausa({ ...p, diasRestantes: meses * 30 });
            setSaindo(false);
            toast(`Pausado até ${fmtData(p.ate)}`);
          }}
        />
      </Card>
    );
  }

  return (
    <>
      <Card style={{ marginBottom: compacto ? 0 : 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">
              {acesso?.status === 'expirada' ? 'sua assinatura venceu' : 'você está no plano gratuito'}
            </div>
            <h2 className="h-sec">O que muda com o premium</h2>
          </div>
        </div>

        {acesso?.status === 'expirada' && (
          <div className="valida bom" style={{ marginBottom: 14 }}>
            <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
            <div>
              <div className="tiny" style={{ fontWeight: 600 }}>Seus dados continuam aqui</div>
              <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.65 }}>
                Nada do que você registrou foi apagado ou bloqueado. Você continua vendo e podendo exportar tudo.
                O que ficou travado foram os recursos de análise.
              </p>
            </div>
          </div>
        )}

        <div className="col" style={{ gap: 10, marginBottom: 16 }}>
          <div className="eyebrow">grátis pra sempre</div>
          {gratis.map(([k, r]) => (
            <div key={k} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <Check size={14} style={{ color: 'var(--jade)', flex: 'none', marginTop: 2 }} />
              <div>
                <div className="tiny" style={{ fontWeight: 600 }}>{r.nome}</div>
                <p className="micro muted" style={{ marginTop: 2 }}>{r.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="divider" />

        <div className="col" style={{ gap: 10 }}>
          <div className="eyebrow">no premium</div>
          {pagos.map(([k, r]) => (
            <div key={k} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <Lock size={14} style={{ color: 'var(--accent)', flex: 'none', marginTop: 2 }} />
              <div>
                <div className="tiny" style={{ fontWeight: 600 }}>{r.nome}</div>
                <p className="micro muted" style={{ marginTop: 2 }}>{r.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="row wrap" style={{ gap: 9, marginTop: 18 }}>
          <Btn variant="primary" icon={Sparkles} onClick={() => window.open('https://hotmart.com', '_blank')}>
            Assinar
          </Btn>
          <Btn variant="ghost" icon={Ticket} onClick={() => setAtivando(true)}>
            Já assinei
          </Btn>
        </div>

        <p className="micro muted" style={{ marginTop: 14, lineHeight: 1.65 }}>
          Você pode registrar quantos treinos quiser no plano gratuito, hoje e sempre. E se um dia cancelar,
          continua vendo e baixando tudo que registrou.
        </p>
      </Card>

      <Sheet
        aberto={ativando}
        onClose={() => setAtivando(false)}
        titulo="Liberar o seu acesso"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAtivando(false)}>Cancelar</Btn>
            <Btn variant="primary" icon={Check} onClick={ativar} disabled={!codigo.trim() || enviando}>
              Ativar
            </Btn>
          </>
        }
      >
        <p className="tiny muted" style={{ lineHeight: 1.7 }}>
          Se você comprou com o mesmo e-mail da sua conta aqui, o acesso libera sozinho em alguns minutos.
          Se comprou com outro e-mail, use o código que chegou junto com a confirmação da compra.
        </p>
        <Field label="Código de ativação">
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            autoFocus
            style={{ fontFamily: 'var(--mono)', fontSize: 18, letterSpacing: '0.14em', textAlign: 'center' }}
          />
        </Field>
        <p className="micro muted">
          Não achou o código? Fale com o suporte com o e-mail que você usou na compra.
        </p>
      </Sheet>
    </>
  );
}

/* ---------- o bloqueio que aparece dentro das telas ---------- */
export function Travado({ recurso, acesso, onAssinar, children }) {
  const r = RECURSOS[recurso];
  if (!r?.premium || acesso?.premium) return children;

  return (
    <Card style={{ borderStyle: 'dashed' }}>
      <div className="col center" style={{ alignItems: 'center', gap: 12, padding: '10px 0' }}>
        <span className="stat-ico" style={{ color: 'var(--accent)' }}><Lock size={17} /></span>
        <div className="center">
          <div className="tiny" style={{ fontWeight: 600 }}>{r.nome}</div>
          <p className="micro muted" style={{ marginTop: 5, maxWidth: 300, lineHeight: 1.6 }}>{r.desc}</p>
        </div>
        <Btn size="sm" variant="primary" onClick={onAssinar}>Ver o premium</Btn>
      </div>
    </Card>
  );
}

/* ============================================================
   O LIMITE DO DIA BATEU

   O texto fala do que a pessoa acabou de fazer, não do que ela
   não pode. Quem viu a aula de hoje fez a coisa certa, e a
   mensagem começa reconhecendo isso.

   Volta amanhã é informação útil: o limite é diário, então o
   grátis continua servindo pra quem treina três vezes por
   semana. Sem essa frase parece bloqueio permanente.
   ============================================================ */
const TEXTO_LIMITE = {
  rola: {
    feito: 'Você já registrou o rola de hoje.',
    premium: 'No premium você registra quantos rolas quiser, e o app enxerga muito mais do seu jogo.',
  },
  aula: {
    feito: 'Você já viu a aula de hoje.',
    premium: 'No premium a biblioteca abre inteira, com as aulas longas que puxam o seu assunto.',
  },
  short: {
    feito: 'Você já viu o short de hoje.',
    premium: 'No premium dá pra ver quantos quiser, e rever também conta ponto.',
  },
  quiz: {
    feito: 'Você já fez a rodada de quiz de hoje.',
    premium: 'No premium o quiz não acaba, e ele puxa pergunta do que você anda errando.',
  },
};

export function LimiteDoDia({ tipo, onAssinar }) {
  const t = TEXTO_LIMITE[tipo];
  if (!t) return null;

  return (
    <Card style={{ borderStyle: 'dashed' }}>
      <div className="col center" style={{ alignItems: 'center', gap: 12, padding: '10px 0' }}>
        <span className="stat-ico" style={{ color: 'var(--accent)' }}><Lock size={17} /></span>
        <div className="center">
          <div className="tiny" style={{ fontWeight: 600 }}>{t.feito}</div>
          <p className="micro muted" style={{ marginTop: 5, maxWidth: 320, lineHeight: 1.6 }}>
            {t.premium} Amanhã libera de novo.
          </p>
        </div>
        <Btn size="sm" variant="primary" onClick={onAssinar}>Ver o premium</Btn>
      </div>
    </Card>
  );
}

/* ---------- aviso de corte no histórico ---------- */
export function HistoricoCortado({ cortados, onAssinar }) {
  if (!cortados) return null;
  return (
    <div className="valida atencao" style={{ marginTop: 12 }}>
      <Lock size={14} className="valida-ico" style={{ color: 'var(--roar)' }} />
      <div>
        <p className="micro muted" style={{ lineHeight: 1.65 }}>
          Tem mais {cortados} {cortados === 1 ? 'registro' : 'registros'} antes disso. No plano gratuito o app
          mostra os últimos {LIMITES.historicoDias} dias, mas nada foi apagado.
        </p>
        <button className="btn ghost xs" onClick={onAssinar} style={{ marginTop: 8 }}>Ver o premium</button>
      </div>
    </div>
  );
}


/* ============================================================
   QUANDO ALGUÉM QUER PARAR

   A ordem importa: primeiro entender o motivo, depois oferecer
   pausa. Desconto só aparece pra quem disse que o problema é
   preço, senão vira jogo de ameaçar sair toda renovação.
   ============================================================ */
function Saida({ aberto, onClose, onPausar }) {
  const [motivo, setMotivo] = useState(null);
  const oferta = motivo ? ofertaDeSaida(motivo) : null;

  return (
    <Sheet
      aberto={aberto}
      onClose={() => { setMotivo(null); onClose(); }}
      titulo={motivo ? '' : 'O que está acontecendo?'}
      wide
    >
      {!motivo ? (
        <>
          <p className="tiny muted" style={{ lineHeight: 1.7 }}>
            Saber o motivo ajuda a gente a resolver do jeito certo. Talvez nem precise cancelar.
          </p>
          <div className="col" style={{ gap: 9 }}>
            {MOTIVOS_PAUSA.map((m) => (
              <button key={m.id} type="button" className="opcao-meta" onClick={() => setMotivo(m.id)}>
                <div className="row" style={{ gap: 9 }}>
                  <span className="tiny" style={{ fontWeight: 600, flex: 1 }}>{m.nome}</span>
                  <span className="muted">›</span>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="col" style={{ gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
              {oferta.titulo}
            </h3>
            <p className="tiny muted" style={{ marginTop: 9, lineHeight: 1.75 }}>{oferta.texto}</p>
          </div>

          {oferta.tipo === 'pausa' && (
            <>
              <div className="row wrap" style={{ gap: 7 }}>
                {[1, 2, 3, 6].map((n) => (
                  <button key={n} type="button" className="chip" style={{ minHeight: 42, paddingInline: 16 }}
                    onClick={() => onPausar(n, motivo)}>
                    {n} {n === 1 ? 'mês' : 'meses'}
                  </button>
                ))}
              </div>
              <p className="micro muted" style={{ lineHeight: 1.65 }}>
                Durante a pausa você continua entrando e vendo tudo que registrou. Só não cobramos.
              </p>
            </>
          )}

          {oferta.tipo === 'anual' && (
            <Btn variant="primary" onClick={() => window.open('https://hotmart.com', '_blank')}>
              Ver o plano anual
            </Btn>
          )}

          <div className="divider" />
          <p className="micro muted" style={{ lineHeight: 1.7 }}>
            Se preferir cancelar mesmo, é pela Hotmart, no e-mail da compra. Seus dados continuam aqui e você
            pode baixar tudo quando quiser.
          </p>
          <button className="btn ghost xs" onClick={() => setMotivo(null)} style={{ alignSelf: 'flex-start' }}>
            Voltar
          </button>
        </div>
      )}
    </Sheet>
  );
}
