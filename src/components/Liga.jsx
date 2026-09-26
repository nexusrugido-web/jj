import React, { useState, useEffect } from 'react';
import {
  Trophy, Check, Eye, EyeOff, RefreshCw, Flame, LogOut, UserRound, Undo2, Dumbbell, Crown, Camera, Trash2, UserPlus,
  Flag, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { useApp } from '../contexto';
import { supabase } from '../lib/supabase';
import {
  Card, Btn, Chip, Empty, Stat, Sheet, Field, Input, BeltTag, useToast,
} from './UI';
import { ajusteDe } from '../lib/ajustes';
import {
  subirPraLiga, corteDoGrupo, nomeCurto, DIVISOES_LIGA, relogioDaLiga, faltaTexto, resultadoEmPalavras,
  MINIMO_DO_GRUPO, minimoPraSubir, praDivisao,
} from '../lib/liga';
import { getMeta, setMeta } from '../db/db';
import { fmtData } from '../lib/utils';
import { enviarFoto, removerFoto } from '../lib/perfil';
import { pedirAmizade } from '../lib/amigos';
import Avatar from './Avatar';

/* ============================================================
   LIGA

   Ninguém precisa entrar: o primeiro treino da semana coloca a
   pessoa num grupo, com gente de ritmo parecido. Sozinho, o grupo
   espera, e a corrida começa quando chega a segunda pessoa.
   Entrou no grupo, fica até a semana fechar.

   A divisão é o degrau em que você está na liga, com nome de
   circuito de campeonato (lib/liga, DIVISOES_LIGA): um faixa
   branca que vai bem chega no Mundial e continua faixa branca.

   Pros outros aparece o nome curto (primeiro nome e a inicial),
   o apelido, ou "Anônimo". Nada do que a pessoa registra nos
   treinos.
   ============================================================ */

const ACIMA = { branca: 'azul', azul: 'roxa', roxa: 'marrom', marrom: 'preta', preta: 'preta' };
const acima = (d) => ACIMA[d] || 'azul';

/* ============================================================
   O PÓDIO

   Os três primeiros como num pódio de campeonato: o líder no meio
   e mais alto, o segundo à esquerda, o terceiro à direita. Sem
   foto, a inicial basta, e ninguém precisa subir foto pra aparecer.
   ============================================================ */
export function Podio({ tres, marca, onVer }) {
  const ordem = [[tres[1], 2], [tres[0], 1], [tres[2], 3]];
  return (
    <div className="podio">
      {ordem.map(([l, lugar]) => {
        const m = marca(l);
        return (
          <button key={l.user_id} type="button" className={`podio-lugar p${lugar} ${l.sou_eu ? 'eu' : ''}`} onClick={() => onVer(l)}>
            {lugar === 1 && <Crown size={18} className="podio-coroa" />}
            <Avatar nome={l.nome} foto={l.foto} className="podio-avatar">
              <span className="podio-n num">{l.posicao}</span>
            </Avatar>
            <span className="podio-base">
              {l.sou_eu && <span className="podio-voce">você</span>}
              <span className="podio-nome">{l.nome}</span>
              <span className="podio-pts num">{l.xp_semana}<small> pts</small></span>
              {m.sobe && <Chip tone="jade">sobe</Chip>}
              {m.desce && <Chip tone="blood">desce</Chip>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   O RELÓGIO DA SEMANA

   Quanto falta pra fechar, em letra grande, e a semana desenhada:
   os dias que já foram, o de hoje, e a bandeira de segunda ao
   meio-dia, que é quando sai o resultado.
   ============================================================ */
const DIAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function RelogioDaSemana() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const r = relogioDaLiga(agora);
  return (
    <div className="liga-relogio">
      <div className="liga-relogio-topo">
        <span className="micro muted">A semana fecha em</span>
        <span className="liga-contagem num">{faltaTexto(r.fecha - agora)}</span>
      </div>
      <div className="liga-dias" aria-hidden="true">
        {DIAS.map((d, i) => (
          <span key={i} className={`liga-dia${i < r.diaDaSemana ? ' foi' : ''}${i === r.diaDaSemana ? ' hoje' : ''}`}>{d}</span>
        ))}
        <span className="liga-dia fim"><Flag size={11} /> seg 12h</span>
      </div>
    </div>
  );
}

/* ============================================================
   O RESULTADO DA SEMANA PASSADA

   Em que lugar você terminou, se subiu, desceu ou ficou, pra qual
   divisão, e o pódio do grupo. Segunda de manhã, antes do
   fechamento, mostra a posição parcial e a hora do resultado.
   ============================================================ */
const ICONE_DO_RESULTADO = { subiu: ArrowUp, desceu: ArrowDown, ficou: Minus };

function ResultadoDaSemana({ r, grande = false }) {
  const { settings } = useApp();
  const p = resultadoEmPalavras(r);
  if (!p) return null;
  /* no popup do fechamento, o pódio de verdade: foto, coroa e degrau */
  const podioGrande = grande && (r.podio || []).length >= 3;
  const Icone = ICONE_DO_RESULTADO[r.resultado];
  const mudou = r.fechada && r.divisao_antes && r.divisao_depois && r.divisao_antes !== r.divisao_depois;
  return (
    <div className={`liga-resultado ${p.tom}${grande ? ' grande' : ''}`}>
      {!grande && <div className="eyebrow">{r.fechada ? 'resultado da semana passada' : 'a semana passada'}</div>}
      <div className="row" style={{ gap: 14, alignItems: 'center' }}>
        <span className="liga-resultado-pos num">{r.posicao}º</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h-sec row" style={{ gap: 6 }}>{Icone && <Icone size={17} />} {p.titulo}</div>
          <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{p.texto}</p>
        </div>
      </div>
      {mudou && (
        <div className="liga-degrau">
          <DivisaoTag id={r.divisao_antes} /> <span className="muted">→</span> <DivisaoTag id={r.divisao_depois} />
        </div>
      )}
      {podioGrande && (
        <Podio
          tres={r.podio.slice(0, 3).map((x) => ({ ...x, user_id: `p${x.posicao}`, xp_semana: x.xp }))}
          marca={() => ({})}
          onVer={() => {}}
        />
      )}
      {!podioGrande && (r.podio || []).length > 1 && (
        <div className="liga-podio-mini">
          {r.podio.map((x) => (
            <div key={x.posicao + x.nome} className={`liga-podio-mini-linha p${x.posicao}${x.sou_eu ? ' eu' : ''}`}>
              <span className="liga-podio-mini-n num">{x.posicao}º</span>
              <Avatar nome={x.sou_eu ? (settings?.nome || x.nome) : x.nome} foto={x.foto} className="liga-avatar" />
              <span className="tiny" style={{ flex: 1, minWidth: 0, fontWeight: x.sou_eu ? 700 : 500 }}>{x.nome}{x.sou_eu ? ' (você)' : ''}</span>
              <span className="num micro">{x.xp} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   O GRUPO ENCHENDO

   O grupo recebe gente a semana toda, até o tamanho do painel:
   quem pontua pela primeira vez na semana cai num grupo com vaga.
   Aqui aparece quem já está (com a foto) e as vagas que ainda
   estão procurando alguém.
   ============================================================ */
function VagasDoGrupo({ linhas, tamanho }) {
  const vagas = Math.max(0, tamanho - linhas.length);
  if (!vagas) return null;
  return (
    <div className="liga-vagas">
      <div className="liga-vagas-fila">
        {linhas.map((l) => (
          <Avatar key={l.user_id} nome={l.nome} foto={l.foto} className={`liga-vaga-cheia${l.sou_eu ? ' eu' : ''}`} />
        ))}
        {Array.from({ length: Math.min(vagas, 6) }, (_, i) => <span key={i} className="liga-vaga" style={{ animationDelay: `${i * 0.3}s` }} />)}
      </div>
      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        {linhas.length} de até {tamanho} no grupo. Quem treinar no seu ritmo e pontuar pela primeira vez esta semana
        ocupa uma vaga, até domingo.
      </p>
    </div>
  );
}

function DivisaoTag({ id, prefixo = '' }) {
  const d = DIVISOES_LIGA[id] || DIVISOES_LIGA.branca;
  return <Chip tone={d.tom}><Trophy size={11} /> {prefixo}{d.nome}</Chip>;
}

export default function Liga({ compacto = false }) {
  const { sessao, irPara, ligada, settings } = useApp();
  const toast = useToast();

  const [carregando, setCarregando] = useState(true);
  const [linhas, setLinhas] = useState([]);
  const [perfil, setPerfil] = useState(null);
  const [aparencia, setAparencia] = useState(false);
  const [vendo, setVendo] = useState(null);
  /* a semana passada (supabase/liga-resultado.sql) e o popup de quando ela fecha */
  const [passada, setPassada] = useState(null);
  const [anuncio, setAnuncio] = useState(false);

  const ativa = ligada?.('liga');

  async function buscar({ subir = false } = {}) {
    if (!supabase || !sessao) { setCarregando(false); return; }
    setCarregando(true);
    try {
      /* o que ainda está só no aparelho sobe antes: é o primeiro
         ponto da semana que coloca a pessoa no grupo */
      if (subir) await subirPraLiga().catch(() => {});
      const [r, p, sp] = await Promise.all([
        supabase.rpc('minha_liga'),
        supabase.from('perfil').select('participa_liga, anonimo, apelido, avatar_url').eq('user_id', sessao.user.id).single(),
        /* antes do SQL do resultado rodar, a função não existe: fica sem */
        supabase.rpc('minha_semana_passada').then((x) => x, () => ({ data: null })),
      ]);
      setLinhas(r.data || []);
      setPerfil(p.data || null);
      const ultima = (Array.isArray(sp?.data) ? sp.data[0] : sp?.data) || null;
      setPassada(ultima);
      /* a semana fechou e a pessoa ainda não viu: o resultado abre sozinho, uma vez */
      if (!compacto && ultima?.fechada && ultima.resultado && ultima.resultado !== 'sozinho'
        && (await getMeta('liga_resultado_visto', null)) !== ultima.semana) {
        setAnuncio(true);
      }
    } catch (e) {
      console.error('[liga]', e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { if (ativa) buscar({ subir: true }); else setCarregando(false); }, [ativa, sessao]);

  /* a corrida anda enquanto a tela está aberta: busca de novo a cada
     minuto e quando o app volta pra frente, sem precisar de Atualizar */
  useEffect(() => {
    if (!ativa || !sessao) return undefined;
    const aberta = () => document.visibilityState === 'visible';
    const t = setInterval(() => { if (aberta()) buscar(); }, 60000);
    const voltou = () => { if (aberta()) buscar(); };
    document.addEventListener('visibilitychange', voltou);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', voltou); };
  }, [ativa, sessao]);

  async function voltar() {
    const { data } = await supabase.rpc('entrar_na_liga');
    const r = Array.isArray(data) ? data[0] : data;
    toast(r?.mensagem || 'Você está na liga de novo');
    await buscar();
  }

  if (!ativa) return null;

  if (!sessao) {
    return (
      <Card style={{ marginBottom: compacto ? 0 : 14 }}>
        <Empty
          icon={Trophy}
          titulo="A liga precisa de conta"
          texto="O ranking fica na nuvem, então só funciona com você conectado."
          acao={<Btn variant="primary" onClick={() => irPara('ajustes')}>Entrar na conta</Btn>}
        />
      </Card>
    );
  }

  const viuResultado = () => { setAnuncio(false); setMeta('liga_resultado_visto', passada.semana); };
  const semanaPassada = !compacto && passada && (
    <>
      <Card style={{ marginBottom: 14 }}>
        <ResultadoDaSemana r={passada} />
      </Card>
      <Sheet
        aberto={anuncio}
        onClose={viuResultado}
        titulo="A semana da liga fechou"
        footer={<Btn variant="primary" onClick={viuResultado} style={{ flex: 1 }}>Bora pra semana nova</Btn>}
      >
        <ResultadoDaSemana r={passada} grande />
        <p className="micro muted" style={{ lineHeight: 1.6 }}>
          A semana nova já começou, com os pontos zerados e um grupo novo. O primeiro ponto te coloca na corrida.
        </p>
      </Sheet>
    </>
  );

  const comoAparece = (
    <ComoAparece
      aberto={aparencia}
      onClose={() => setAparencia(false)}
      perfil={perfil}
      nome={settings?.nome}
      userId={sessao.user.id}
      onSalvo={() => { setAparencia(false); buscar(); }}
      onFoto={() => buscar()}
    />
  );

  /* ---------- fora da liga ---------- */
  if (perfil && !perfil.participa_liga && !linhas.length) {
    return (
      <>
      {semanaPassada}
      <Card style={{ marginBottom: compacto ? 0 : 14 }}>
        <div className="card-head">
          <h2 className="h-sec row" style={{ gap: 8 }}><Trophy size={16} /> Liga entre praticantes</h2>
        </div>
        <p className="tiny muted" style={{ lineHeight: 1.7 }}>
          Você está fora da liga. Voltando, você entra na corrida da semana no próximo treino que registrar,
          num grupo com gente de ritmo parecido com o seu.
        </p>
        <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
          <Btn variant="primary" icon={Undo2} onClick={voltar}>Voltar pra liga</Btn>
          <Btn variant="ghost" icon={UserRound} onClick={() => setAparencia(true)}>Como eu apareço</Btn>
        </div>
        {comoAparece}
      </Card>
      </>
    );
  }

  /* ---------- ainda sem grupo esta semana ---------- */
  if (!linhas.length) {
    return (
      <>
      {semanaPassada}
      <Card style={{ marginBottom: compacto ? 0 : 14 }}>
        <div className="card-head">
          <h2 className="h-sec row" style={{ gap: 8 }}><Trophy size={16} /> Sua liga desta semana</h2>
          <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={() => buscar({ subir: true })} disabled={carregando} aria-label="Atualizar" />
        </div>
        {carregando ? (
          <p className="tiny muted">Buscando o seu grupo.</p>
        ) : (
          <>
            <p className="tiny muted" style={{ lineHeight: 1.7 }}>Você ainda não entrou na corrida desta semana. É assim:</p>
            <ol className="liga-passos">
              <li><b>Registre um treino</b> (ou veja uma aula, ou responda o quiz). O primeiro ponto te coloca na corrida.</li>
              <li><b>O app acha o seu grupo</b>, com gente que treina no mesmo ritmo que você.</li>
              <li><b>Corrida até domingo:</b> cada treino, rola e aula soma pontos.</li>
              <li><b>Segunda ao meio-dia sai o resultado:</b> quem termina em cima sobe de divisão, quem termina embaixo desce.</li>
            </ol>
            {!compacto && <RelogioDaSemana />}
          </>
        )}
        {!carregando && (
          <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
            <Btn variant="primary" icon={Dumbbell} onClick={() => irPara('treinos')}>Registrar treino</Btn>
            <Btn variant="ghost" icon={UserRound} onClick={() => setAparencia(true)}>Como eu apareço</Btn>
          </div>
        )}
        {comoAparece}
      </Card>
      </>
    );
  }

  const eu = linhas.find((l) => l.sou_eu);
  const divisao = linhas[0]?.divisao || 'branca';
  const total = Number(linhas[0]?.total) || linhas.length;
  const comecou = total >= 2 && linhas[0]?.comecou !== false;
  /* subir e descer só vale com 3 ou mais no grupo */
  const valendo = total >= MINIMO_DO_GRUPO;
  const { sobem, descem } = corteDoGrupo(total, ajusteDe('liga_corte', 3));
  /* o grupo pode juntar divisões vizinhas quando falta gente: o
     cabeçalho mostra a sua, e a etiqueta só aparece em quem é de outra */
  const minhaDiv = eu?.divisao_pessoa || divisao;
  const misturado = linhas.some((l) => (l.divisao_pessoa || divisao) !== minhaDiv);
  const acimaDeMim = eu ? linhas.filter((l) => l.xp_semana > eu.xp_semana) : [];
  /* quem está na zona de subir ou de descer, igual no pódio e na lista.
     Subir pede também o mínimo de pontos da divisão da pessoa. */
  const marca = (l) => {
    const div = l.divisao_pessoa || divisao;
    const min = minimoPraSubir(div);
    return {
      sobe: valendo && l.posicao <= sobem && min != null && l.xp_semana >= min,
      desce: valendo && descem > 0 && l.posicao > total - descem && div !== 'branca',
    };
  };
  const meuMinimo = minimoPraSubir(minhaDiv);
  const podio = !compacto && comecou && linhas.length >= 3;

  return (
    <>
    {semanaPassada}
    <Card style={{ marginBottom: compacto ? 0 : 14 }}>
      <div className="card-head" style={{ marginBottom: 4 }}>
        <h2 className="h-sec row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Trophy size={16} /> {linhas[0]?.em_sala ? 'Sua sala' : 'Divisão'} <DivisaoTag id={minhaDiv} />
        </h2>
        <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={() => buscar({ subir: true })} disabled={carregando} aria-label="Atualizar" />
      </div>
      <p className="micro muted row" style={{ gap: 6, marginBottom: 12 }}>
        <UserRound size={12} /> {total} {total === 1 ? 'pessoa' : 'pessoas'} no grupo
      </p>
      {!compacto && <RelogioDaSemana />}
      {!compacto && !linhas[0]?.em_sala && <VagasDoGrupo linhas={linhas} tamanho={Math.max(2, ajusteDe('liga_tamanho', 10))} />}

      {eu?.saindo && (
        <div className="valida atencao" style={{ marginBottom: 12, alignItems: 'center' }}>
          <LogOut size={14} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.6, flex: 1 }}>
            Você sai da liga quando esta semana fechar. Até lá, a corrida segue com você nela.
          </p>
          <Btn size="xs" variant="ghost" onClick={voltar}>Continuar</Btn>
        </div>
      )}

      {!comecou ? (
        <div className="liga-procurando">
          <div className="liga-radar" aria-hidden="true">
            <span className="liga-radar-onda" />
            <span className="liga-radar-onda dois" />
            <Avatar nome={eu?.nome} foto={eu?.foto} className="liga-radar-eu" />
          </div>
          <div className="tiny" style={{ fontWeight: 700, marginTop: 4 }}>Procurando adversários</div>
          <p className="micro muted" style={{ lineHeight: 1.6, maxWidth: 320, textAlign: 'center' }}>
            Você já está na corrida desta semana, com <b className="num" style={{ color: 'var(--accent)' }}>{eu?.xp_semana ?? 0}</b> pontos
            contando. Quem treina no seu ritmo e pontuar esta semana cai no seu grupo, e a disputa começa na hora.
          </p>
        </div>
      ) : eu && (
        <div className="liga-eu">
          <span className="liga-pos num">{eu.posicao}º</span>
          <div style={{ flex: 1 }}>
            <div className="tiny" style={{ fontWeight: 600 }}>Você</div>
            <div className="micro muted">
              {valendo && eu.posicao <= sobem && meuMinimo && eu.xp_semana < meuMinimo
                ? `Na frente, mas pra subir ${praDivisao(acima(minhaDiv))} precisa de ${meuMinimo} pontos. Faltam ${meuMinimo - eu.xp_semana}.`
                : eu.posicao === 1
                ? 'Na frente do grupo esta semana.'
                : eu.posicao <= sobem
                  ? 'Na zona de subir de divisão.'
                  : acimaDeMim.length
                    ? `Faltam ${Math.min(...acimaDeMim.map((l) => l.xp_semana)) - eu.xp_semana + 1} pontos pra passar mais um.`
                    : 'Empatado com quem está na frente.'}
            </div>
          </div>
          <span className="num" style={{ fontSize: 19, fontWeight: 700, color: 'var(--accent)' }}>{eu.xp_semana}</span>
        </div>
      )}

      {comecou && !valendo && (
        <div className="valida atencao" style={{ marginTop: 12 }}>
          <UserRound size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />
          <p className="micro muted" style={{ lineHeight: 1.6 }}>
            <b style={{ color: 'var(--chalk)' }}>Grupo de 2 ainda não vale subida.</b> A corrida conta os pontos, mas
            ninguém sobe nem desce de divisão com menos de {MINIMO_DO_GRUPO} pessoas. Quando a {MINIMO_DO_GRUPO}ª entrar, passa a valer.
          </p>
        </div>
      )}

      {podio && <Podio tres={linhas.slice(0, 3)} marca={marca} onVer={setVendo} />}

      {/* sozinho, a lista só repetiria você: o radar já diz tudo */}
      {comecou && <div className="col" style={{ gap: 6, marginTop: 12 }}>
        {linhas.slice(podio ? 3 : 0, compacto ? 5 : undefined).map((l) => {
          const div = l.divisao_pessoa || divisao;
          const { sobe, desce } = marca(l);
          return (
            <button key={l.user_id} type="button" className={`liga-linha ${l.sou_eu ? 'eu' : ''}`} onClick={() => setVendo(l)}>
              <span className="liga-pos num">{l.posicao}</span>
              <Avatar nome={l.nome} foto={l.foto} className="liga-avatar" />
              <span className="tiny liga-nome" style={{ fontWeight: l.sou_eu ? 600 : 400 }}>
                {l.nome}{l.sou_eu ? ' (você)' : ''}
              </span>
              {div !== minhaDiv && <DivisaoTag id={div} />}
              {l.sequencia > 0 && (
                <span className="micro num row" style={{ gap: 3, color: 'var(--roar)' }} title="dias de ofensiva">
                  <Flame size={12} /> {l.sequencia}
                </span>
              )}
              {sobe && <Chip tone="jade">sobe</Chip>}
              {desce && <Chip tone="blood">desce</Chip>}
              <span className="num micro" style={{ minWidth: 38, textAlign: 'right' }}>{l.xp_semana}</span>
            </button>
          );
        })}
      </div>}

      {!compacto && (
        <p className="micro muted" style={{ marginTop: 12, lineHeight: 1.65 }}>
          {!comecou
            ? 'Grupo de uma pessoa só não corre: ninguém sobe nem desce enquanto você estiver sozinho.'
            : !valendo
            ? 'A semana fecha segunda ao meio-dia, e o treino de domingo registrado até lá ainda conta.'
            : <>
                A semana fecha segunda ao meio-dia, e o treino de domingo registrado até lá ainda conta.{' '}
                {sobem === 1 ? 'O 1º sobe' : `Os ${sobem} primeiros sobem`} de divisão
                {minhaDiv === 'preta' || misturado ? '' : ` ${praDivisao(acima(minhaDiv))}`}
                {meuMinimo && !misturado ? `, se fizer pelo menos ${meuMinimo} pontos` : ''}
                {descem
                  ? (descem === 1 ? ', e o último desce.' : `, e os ${descem} últimos descem.`)
                  : '. Com o grupo deste tamanho, ninguém desce.'}
                {misturado ? ' Cada um sobe ou desce a partir da própria divisão, com o mínimo de pontos dela.' : ''}
              </>}
          {comecou && ' Toque em alguém pra ver o perfil.'}
        </p>
      )}

      {!compacto && (
        <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
          <Btn size="xs" variant="ghost" icon={UserRound} onClick={() => setAparencia(true)}>Como eu apareço</Btn>
        </div>
      )}

      {comoAparece}
      <PerfilDoColega linha={vendo} onClose={() => setVendo(null)} />
    </Card>
    </>
  );
}

/* ============================================================
   COMO VOCÊ APARECE PROS OUTROS
   ============================================================ */
function ComoAparece({ aberto, onClose, perfil, nome, userId, onSalvo, onFoto }) {
  const toast = useToast();
  const modoAtual = perfil?.anonimo ? (perfil?.apelido ? 'apelido' : 'anonimo') : 'nome';
  const [modo, setModo] = useState(modoAtual);
  const [apelido, setApelido] = useState(perfil?.apelido || '');
  const [salvando, setSalvando] = useState(false);
  const [foto, setFoto] = useState(perfil?.avatar_url || null);
  const [mandando, setMandando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setModo(modoAtual);
    setApelido(perfil?.apelido || '');
    setFoto(perfil?.avatar_url || null);
  }, [aberto]);

  async function escolherFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMandando(true);
    try {
      setFoto(await enviarFoto(file));
      toast('Foto atualizada');
      onFoto?.();
    } catch (err) {
      toast(err?.message?.includes('conta') ? err.message : 'Não consegui mandar a foto agora', 'err');
    } finally {
      setMandando(false);
    }
  }

  async function tirarFoto() {
    setMandando(true);
    await removerFoto().catch(() => {});
    setFoto(null);
    setMandando(false);
    onFoto?.();
  }

  const opcoes = [
    { id: 'nome', icone: Eye, titulo: 'Com o meu nome', texto: `Aparece como ${nomeCurto(nome)}: o primeiro nome e a inicial do sobrenome.` },
    { id: 'apelido', icone: EyeOff, titulo: 'Com um apelido', texto: 'Ninguém vê o seu nome de verdade.' },
    { id: 'anonimo', icone: EyeOff, titulo: 'Anônimo', texto: 'Aparece só "Anônimo", com os seus pontos.' },
  ];

  async function salvar() {
    if (modo === 'apelido' && !apelido.trim()) { toast('Escreva o apelido', 'err'); return; }
    setSalvando(true);
    const { error } = await supabase.from('perfil').update({
      anonimo: modo !== 'nome',
      apelido: modo === 'apelido' ? apelido.trim().slice(0, 20) : null,
      atualizado_em: new Date().toISOString(),
    }).eq('user_id', userId);
    setSalvando(false);
    if (error) { toast('Não consegui salvar', 'err'); return; }
    toast('Salvo');
    onSalvo?.();
  }

  return (
    <Sheet
      aberto={aberto}
      onClose={onClose}
      titulo="Como você aparece"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" icon={Check} onClick={salvar} disabled={salvando}>Salvar</Btn>
        </>
      }
    >
      <div className="row" style={{ gap: 14, alignItems: 'center' }}>
        <Avatar nome={modo === 'apelido' && apelido.trim() ? apelido : nomeCurto(nome)} foto={modo === 'anonimo' ? null : foto} className="perfil-avatar" />
        <div className="col" style={{ gap: 8, flex: 1 }}>
          <label className={`btn sm ${mandando ? 'disabled' : ''}`} style={{ alignSelf: 'flex-start' }}>
            <Camera size={14} /> {mandando ? 'Mandando…' : foto ? 'Trocar foto' : 'Colocar foto'}
            <input type="file" accept="image/*" hidden disabled={mandando} onChange={escolherFoto} />
          </label>
          {foto && !mandando && (
            <button type="button" className="btn ghost xs" style={{ alignSelf: 'flex-start' }} onClick={tirarFoto}>
              <Trash2 size={12} /> Tirar a foto
            </button>
          )}
          <p className="micro muted" style={{ lineHeight: 1.55 }}>
            {modo === 'anonimo'
              ? 'No modo Anônimo a foto não aparece pra ninguém.'
              : 'Sem foto, aparecem as iniciais. A foto aparece pro seu grupo da liga.'}
          </p>
        </div>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {opcoes.map((o) => (
          <button key={o.id} type="button" className={`opcao-meta ${modo === o.id ? 'on' : ''}`} onClick={() => setModo(o.id)}>
            <div className="row" style={{ gap: 9 }}>
              <o.icone size={15} style={{ flex: 'none' }} />
              <div>
                <div className="tiny" style={{ fontWeight: 600 }}>{o.titulo}</div>
                <p className="micro muted" style={{ marginTop: 3 }}>{o.texto}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {modo === 'apelido' && (
        <Field label="Seu apelido">
          <Input value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Como quer ser chamado" maxLength={20} />
        </Field>
      )}

      <p className="micro muted" style={{ lineHeight: 1.65, marginTop: 12 }}>
        Quem está no seu grupo vê como você aparece, a sua faixa, a sua divisão, a sequência de semanas e os
        pontos. Nada do que você registra nos treinos.
      </p>
    </Sheet>
  );
}

/* ============================================================
   O PERFIL DE QUEM ESTÁ NO GRUPO
   ============================================================ */
function PerfilDoColega({ linha, onClose }) {
  const [p, setP] = useState(null);
  const [pedindo, setPedindo] = useState(false);
  const toast = useToast();

  async function adicionar() {
    setPedindo(true);
    try {
      const r = await pedirAmizade(linha.user_id);
      toast(r.mensagem, r.ok ? '' : 'err');
    } catch { toast('Não deu agora. Tenta de novo.', 'err'); }
    setPedindo(false);
  }

  useEffect(() => {
    setP(null);
    if (!linha) return undefined;
    let vivo = true;
    supabase.rpc('perfil_na_liga', { p_user: linha.user_id })
      .then(({ data }) => { if (vivo) setP((Array.isArray(data) ? data[0] : data) || false); })
      .catch(() => { if (vivo) setP(false); });
    return () => { vivo = false; };
  }, [linha?.user_id]);

  return (
    <Sheet aberto={!!linha} onClose={onClose} titulo={linha?.nome || ''} subtitulo={linha?.sou_eu ? 'você' : 'no seu grupo'}>
      {p === null ? (
        <p className="tiny muted">Buscando.</p>
      ) : p === false ? (
        <p className="tiny muted">Não deu pra abrir este perfil agora.</p>
      ) : (
        <div className="col" style={{ gap: 16 }}>
          <Avatar nome={linha?.nome} foto={p.foto} className="perfil-avatar" />
          <div className="row wrap" style={{ gap: 8 }}>
            <BeltTag faixa={p.faixa} graus={p.graus || 0}>Faixa {p.faixa}</BeltTag>
            <DivisaoTag id={p.divisao} prefixo="Divisão " />
          </div>
          <div className="grid g2" style={{ gap: 14 }}>
            <Stat size="sm" icon={Flame} valor={p.sequencia || 0} label={p.sequencia === 1 ? 'dia de ofensiva' : 'dias de ofensiva'} tone={p.sequencia ? 'roar' : undefined} />
            <Stat size="sm" icon={Dumbbell} valor={p.treinos_semana ? `${p.treinos_semana}x` : '?'} label="treinos por semana" />
            <Stat size="sm" icon={Trophy} valor={p.xp_semana || 0} label="pontos nesta semana" tone="accent" />
          </div>
          {p.semanas > 0 && (
            <p className="micro muted">
              {p.semanas} {Number(p.semanas) === 1 ? 'semana' : 'semanas'} na liga, desde {fmtData(p.desde)}.
            </p>
          )}
          {!linha?.sou_eu && (
            <Btn variant="primary" icon={UserPlus} onClick={adicionar} disabled={pedindo} style={{ alignSelf: 'flex-start' }}>
              {pedindo ? 'Mandando…' : 'Adicionar amigo'}
            </Btn>
          )}
          <p className="micro muted" style={{ lineHeight: 1.6 }}>
            Os treinos de cada um continuam privados. Aqui aparece só o que a liga mostra.
          </p>
        </div>
      )}
    </Sheet>
  );
}
