import React, { useState } from 'react';
import {
  Check, Lock, Sparkles, Gem, Crown, Receipt, ExternalLink, RefreshCw,
} from 'lucide-react';
import { Card, Btn, Chip, Sheet, useToast } from './UI';
import { RECURSOS, LIMITES, diasParaVencer } from '../lib/plano';
import { HOTMART_MINHAS_COMPRAS } from './Renovacao';
import { MOTIVOS_PAUSA, ofertaDeSaida, pausar, pausaAtiva, retomar } from '../lib/retencao';
import { fmtData } from '../lib/utils';
import { abrirLink, linkDe } from '../lib/links';

/* ============================================================
   PLANO
   ============================================================ */

/* a forma de pagamento como a Hotmart manda, em português */
const FORMA = {
  'CREDIT_CARD': 'cartão', 'PIX': 'Pix', 'BILLET': 'boleto', 'PAYPAL': 'PayPal',
  'HOTMART_BALANCE': 'saldo Hotmart', 'GOOGLE_PAY': 'Google Pay', 'SAMSUNG_PAY': 'Samsung Pay',
};
const reais = (v, moeda) => (v == null ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: moeda || 'BRL' }));
const abrirHotmart = () => window.open(HOTMART_MINHAS_COMPRAS, '_blank', 'noopener');

/* O período pago: quanto já passou e quanto falta, numa barra.
   Mensal conta 30 dias, anual 365, pelo nome do plano. */
function DiasPagos({ acesso, dias }) {
  if (dias === null || dias < 0) return null;
  const total = /anual/i.test(acesso.plano || '') ? 365 : 30;
  const pct = Math.max(3, Math.min(100, Math.round((dias / total) * 100)));
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row micro" style={{ marginBottom: 6 }}>
        <span className="muted">{dias === 0 ? 'último dia pago' : `${dias} ${dias === 1 ? 'dia pago' : 'dias pagos'} pela frente`}</span>
        <span className="spacer" />
        <span className="num muted">{fmtData(String(acesso.venceEm).slice(0, 10))}</span>
      </div>
      <div className="bar"><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/* As cobranças que a Hotmart aprovou. Nota e recibo ficam lá. */
function Faturas({ aberto, onClose, faturas }) {
  return (
    <Sheet aberto={aberto} onClose={onClose} titulo="Suas faturas">
      {faturas.length === 0 ? (
        <p className="tiny muted" style={{ lineHeight: 1.65 }}>
          Nenhuma cobrança chegou por aqui ainda. As compras antigas continuam na Hotmart, em Minhas compras.
        </p>
      ) : (
        <div className="list">
          {faturas.map((x, i) => (
            <div key={i} className="list-item">
              <span className="stat-ico" style={{ color: 'var(--accent)' }}><Receipt size={16} /></span>
              <div className="grow">
                <div className="tiny" style={{ fontWeight: 600 }}>
                  {reais(x.valor, x.moeda)}{x.parcelas > 1 ? ` em ${x.parcelas}x` : ''}
                </div>
                <div className="micro muted">
                  {fmtData(String(x.data).slice(0, 10))}
                  {x.pagamento ? ` · ${FORMA[x.pagamento] || x.pagamento.toLowerCase()}` : ''}
                  {x.recorrencia > 1 ? ` · ${x.recorrencia}ª cobrança` : ''}
                </div>
              </div>
              {x.reembolsada ? <Chip tone="warn">reembolsada</Chip> : <Chip tone="jade">paga</Chip>}
            </div>
          ))}
        </div>
      )}
      <Btn variant="contorno" icon={ExternalLink} onClick={abrirHotmart}>Nota e recibo na Hotmart</Btn>
    </Sheet>
  );
}

export default function Plano({ acesso, compacto = false }) {
  const toast = useToast();
  const [saindo, setSaindo] = useState(false);
  const [verFaturas, setVerFaturas] = useState(false);
  const [pausa, setPausa] = useState(null);

  React.useEffect(() => { pausaAtiva().then(setPausa); }, []);

  const dias = diasParaVencer(acesso);
  const gratis = Object.entries(RECURSOS).filter(([, r]) => !r.premium);
  const pagos = Object.entries(RECURSOS).filter(([, r]) => r.premium);

  const faturas = acesso?.faturas || [];

  if (acesso?.premium) {
    return (
      <Card className="accent" style={{ marginBottom: compacto ? 0 : 14 }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <span className="stat-ico" style={{ color: 'var(--accent)' }}><Crown size={17} /></span>
          <div style={{ flex: 1 }}>
            <div className="row wrap" style={{ gap: 7 }}>
              <h2 className="h-sec">Premium ativo</h2>
              {acesso.status === 'carencia' && <Chip tone="warn">pagamento pendente</Chip>}
              {acesso.status !== 'carencia' && acesso.renova === false && <Chip tone="warn">não renova</Chip>}
            </div>
            <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.65 }}>
              {acesso.status === 'carencia'
                ? `${acesso.motivo} Atualize o cartão ou a forma de pagamento na Hotmart.`
                : !acesso.venceEm
                  ? 'Tudo liberado.'
                  : acesso.renova === false
                    ? `A renovação está desligada. O Premium fica até ${fmtData(String(acesso.venceEm).slice(0, 10))}, e depois as partes do Premium voltam a travar.`
                    : `${acesso.plano ? `${acesso.plano}. ` : ''}Renova sozinho em ${fmtData(String(acesso.venceEm).slice(0, 10))}.`}
            </p>
            {acesso.venceEm && <DiasPagos acesso={acesso} dias={dias} />}

            <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
              {acesso.status === 'carencia' && (
                <Btn size="sm" variant="primary" icon={ExternalLink} onClick={abrirHotmart}>Atualizar o pagamento</Btn>
              )}
              {acesso.status !== 'carencia' && acesso.renova === false && (
                <Btn size="sm" variant="primary" icon={RefreshCw} onClick={() => abrirLink('assinatura_mensal')}>Renovar o Premium</Btn>
              )}
              <Btn size="sm" variant="contorno" icon={Receipt} onClick={() => setVerFaturas(true)}>Faturas</Btn>
            </div>

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
        <Faturas aberto={verFaturas} onClose={() => setVerFaturas(false)} faturas={faturas} />
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
            <h2 className="h-sec">O que muda com o Premium</h2>
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
          <div className="eyebrow">no Premium</div>
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
          <Btn
            variant="primary"
            icon={Sparkles}
            disabled={!linkDe('assinatura_mensal')}
            onClick={() => abrirLink('assinatura_mensal')}
          >
            {!linkDe('assinatura_mensal') ? 'Assinatura ainda não abriu'
              : ['expirada', 'cancelada'].includes(acesso?.status) ? 'Renovar o Premium' : 'Assinar'}
          </Btn>
          {faturas.length > 0 && (
            <Btn variant="contorno" icon={Receipt} onClick={() => setVerFaturas(true)}>Faturas</Btn>
          )}
        </div>

        <p className="micro muted" style={{ marginTop: 14, lineHeight: 1.65 }}>
          Você pode registrar quantos treinos quiser no plano gratuito, hoje e sempre. E se um dia cancelar,
          continua vendo e baixando tudo que registrou.
        </p>
      </Card>

      <Faturas aberto={verFaturas} onClose={() => setVerFaturas(false)} faturas={faturas} />
    </>
  );
}

/* ============================================================
   A VITRINE

   A seção de verdade, com os números da própria pessoa, borrada
   atrás do convite. Ela vê que a resposta existe e é dela. Embaixo,
   o resto do que o Premium abre: ninguém assina por uma tela só.
   ============================================================ */
const tambemAbre = (recurso) => Object.entries(RECURSOS)
  .filter(([id, r]) => r.premium && id !== recurso)
  /* só a primeira letra desce: IA continua IA */
  .map(([, r]) => r.nome.charAt(0).toLowerCase() + r.nome.slice(1))
  .join(', ');

export function Vitrine({ recurso, fundo, titulo, texto, itens, onAssinar }) {
  return (
    <div className="vitrine">
      <div className="vitrine-fundo" aria-hidden="true">{fundo}</div>
      <div className="vitrine-frente">
        <span className="vitrine-selo"><Gem size={13} /> Premium</span>
        <h3 className="h-sec" style={{ marginTop: 10 }}>{titulo}</h3>
        <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.6 }}>{texto}</p>
        <ul className="vitrine-lista">
          {itens.map((x) => <li key={x}><Check size={15} /> {x}</li>)}
        </ul>
        <p className="micro muted" style={{ marginTop: 14, lineHeight: 1.6 }}>
          O Premium também abre: {tambemAbre(recurso)}.
        </p>
        <Btn variant="primary" onClick={onAssinar} style={{ marginTop: 14, width: '100%' }}>Liberar no Premium</Btn>
      </div>
    </div>
  );
}

/* o mesmo convite, em popup: pra quando a pessoa toca num botão do
   premium (a Análise IA, criar a própria meta) e não tem o que borrar */
export function Convite({ recurso, icone: Icone = Sparkles, marca = null, titulo, texto, itens, onAssinar }) {
  return (
    <div className="convite">
      <span className="convite-ico"><Icone size={22} /></span>
      <span className="vitrine-selo"><Gem size={13} /> Premium</span>
      <div>
        {marca && <div className="convite-marca">{marca}</div>}
        <h2 className="convite-titulo">{titulo}</h2>
      </div>
      <p className="tiny muted" style={{ lineHeight: 1.6 }}>{texto}</p>
      <ul className="vitrine-lista" style={{ marginTop: 0 }}>
        {itens.map((x) => <li key={x}><Check size={15} /> {x}</li>)}
      </ul>
      <p className="micro muted" style={{ lineHeight: 1.6 }}>O Premium também abre: {tambemAbre(recurso)}.</p>
      <Btn variant="primary" onClick={onAssinar} style={{ width: '100%' }}>Liberar no Premium</Btn>
    </div>
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
  aula: {
    feito: 'Você já viu a aula de hoje.',
    premium: 'No Premium a biblioteca abre inteira, com as aulas completas que puxam o seu assunto.',
  },
  short: {
    feito: 'Você já viu a aula rápida de hoje.',
    premium: 'No Premium dá pra ver quantos quiser, e rever também conta ponto.',
  },
  quiz: {
    feito: 'Você já fez a rodada de quiz de hoje.',
    premium: 'No Premium o quiz não acaba, e ele puxa pergunta do que você anda errando.',
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
        <Btn size="sm" variant="primary" onClick={onAssinar}>Ver o Premium</Btn>
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
        <button className="btn ghost xs" onClick={onAssinar} style={{ marginTop: 8 }}>Ver o Premium</button>
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
            <Btn
              variant="primary"
              disabled={!linkDe('assinatura_anual')}
              onClick={() => abrirLink('assinatura_anual')}
            >
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
