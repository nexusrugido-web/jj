import React, { useState, useEffect } from 'react';
import {
  Trophy, Check, Eye, EyeOff, RefreshCw, Flame, Hourglass, LogOut, UserRound, Undo2, Dumbbell,
} from 'lucide-react';
import { useApp } from '../contexto';
import { supabase } from '../lib/supabase';
import {
  Card, Btn, Chip, Empty, Stat, Sheet, Field, Input, BeltTag, useToast,
} from './UI';
import { ajusteDe } from '../lib/ajustes';
import { subirPraLiga, corteDoGrupo, nomeCurto, DIVISOES_LIGA, nomeDivisao } from '../lib/liga';
import { fmtData } from '../lib/utils';

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

  const ativa = ligada?.('liga');

  async function buscar({ subir = false } = {}) {
    if (!supabase || !sessao) { setCarregando(false); return; }
    setCarregando(true);
    try {
      /* o que ainda está só no aparelho sobe antes: é o primeiro
         ponto da semana que coloca a pessoa no grupo */
      if (subir) await subirPraLiga().catch(() => {});
      const [r, p] = await Promise.all([
        supabase.rpc('minha_liga'),
        supabase.from('perfil').select('participa_liga, anonimo, apelido').eq('user_id', sessao.user.id).single(),
      ]);
      setLinhas(r.data || []);
      setPerfil(p.data || null);
    } catch (e) {
      console.error('[liga]', e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { if (ativa) buscar({ subir: true }); else setCarregando(false); }, [ativa, sessao]);

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

  const comoAparece = (
    <ComoAparece
      aberto={aparencia}
      onClose={() => setAparencia(false)}
      perfil={perfil}
      nome={settings?.nome}
      userId={sessao.user.id}
      onSalvo={() => { setAparencia(false); buscar(); }}
    />
  );

  /* ---------- fora da liga ---------- */
  if (perfil && !perfil.participa_liga && !linhas.length) {
    return (
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
    );
  }

  /* ---------- ainda sem grupo esta semana ---------- */
  if (!linhas.length) {
    return (
      <Card style={{ marginBottom: compacto ? 0 : 14 }}>
        <div className="card-head">
          <h2 className="h-sec row" style={{ gap: 8 }}><Trophy size={16} /> Sua liga</h2>
          <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={() => buscar({ subir: true })} disabled={carregando}>Atualizar</Btn>
        </div>
        <p className="tiny muted" style={{ lineHeight: 1.7 }}>
          {carregando
            ? 'Buscando o seu grupo.'
            : 'Registre um treino e você entra na corrida desta semana, num grupo com gente que treina mais ou menos o mesmo tanto que você.'}
        </p>
        {!carregando && (
          <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
            <Btn variant="primary" icon={Dumbbell} onClick={() => irPara('treinos')}>Registrar treino</Btn>
            <Btn variant="ghost" icon={UserRound} onClick={() => setAparencia(true)}>Como eu apareço</Btn>
          </div>
        )}
        {comoAparece}
      </Card>
    );
  }

  const eu = linhas.find((l) => l.sou_eu);
  const divisao = linhas[0]?.divisao || 'branca';
  const total = Number(linhas[0]?.total) || linhas.length;
  const comecou = total >= 2 && linhas[0]?.comecou !== false;
  const { sobem, descem } = corteDoGrupo(total, ajusteDe('liga_corte', 3));
  const misturado = linhas.some((l) => (l.divisao_pessoa || divisao) !== divisao);
  const acimaDeMim = eu ? linhas.filter((l) => l.xp_semana > eu.xp_semana) : [];

  return (
    <Card style={{ marginBottom: compacto ? 0 : 14 }}>
      <div className="card-head">
        <div>
          <Chip tone="warn">
            <Hourglass size={11} /> {total} {total === 1 ? 'pessoa' : 'pessoas'} · fecha segunda ao meio-dia
          </Chip>
          <h2 className="h-sec row" style={{ gap: 8 }}>
            <Trophy size={16} /> Divisão <DivisaoTag id={divisao} />
          </h2>
        </div>
        <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={() => buscar({ subir: true })} disabled={carregando}>
          Atualizar
        </Btn>
      </div>

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
        <div className="liga-eu">
          <Hourglass size={18} style={{ color: 'var(--accent)', flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <div className="tiny" style={{ fontWeight: 600 }}>Esperando adversário</div>
            <div className="micro muted" style={{ lineHeight: 1.6 }}>
              Você já está na liga desta semana. A corrida começa quando mais alguém registrar treino, e seus
              pontos já estão contando.
            </div>
          </div>
          <span className="num" style={{ fontSize: 19, fontWeight: 700, color: 'var(--accent)' }}>{eu?.xp_semana ?? 0}</span>
        </div>
      ) : eu && (
        <div className="liga-eu">
          <span className="liga-pos num">{eu.posicao}º</span>
          <div style={{ flex: 1 }}>
            <div className="tiny" style={{ fontWeight: 600 }}>Você</div>
            <div className="micro muted">
              {eu.posicao === 1
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

      <div className="col" style={{ gap: 6, marginTop: 12 }}>
        {linhas.slice(0, compacto ? 5 : undefined).map((l) => {
          const div = l.divisao_pessoa || divisao;
          const sobe = comecou && l.posicao <= sobem && l.xp_semana > 0 && div !== 'preta';
          const desce = comecou && descem > 0 && l.posicao > total - descem && div !== 'branca';
          return (
            <button key={l.user_id} type="button" className={`liga-linha ${l.sou_eu ? 'eu' : ''}`} onClick={() => setVendo(l)}>
              <span className="liga-pos num">{l.posicao}</span>
              <span className="tiny" style={{ flex: 1, fontWeight: l.sou_eu ? 600 : 400, textAlign: 'left' }}>
                {l.nome}{l.sou_eu ? ' (você)' : ''}
              </span>
              {misturado && <DivisaoTag id={div} />}
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
      </div>

      {!compacto && (
        <p className="micro muted" style={{ marginTop: 12, lineHeight: 1.65 }}>
          {!comecou
            ? 'Grupo de uma pessoa só não corre: ninguém sobe nem desce enquanto você estiver sozinho.'
            : <>
                A semana fecha segunda ao meio-dia, e o treino de domingo registrado até lá ainda conta.{' '}
                {sobem === 1 ? 'O primeiro que pontuou sobe' : `Os ${sobem} primeiros que pontuaram sobem`} de divisão
                {divisao === 'preta' || misturado ? '' : `, pra ${nomeDivisao(acima(divisao))}`}
                {descem
                  ? (descem === 1 ? ', e o último desce.' : `, e os ${descem} últimos descem.`)
                  : '. Com o grupo deste tamanho, ninguém desce.'}
                {misturado ? ' Cada um sobe ou desce a partir da própria divisão.' : ''}
              </>}
          {' '}Toque em alguém pra ver o perfil.
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
  );
}

/* ============================================================
   COMO VOCÊ APARECE PROS OUTROS
   ============================================================ */
function ComoAparece({ aberto, onClose, perfil, nome, userId, onSalvo }) {
  const toast = useToast();
  const modoAtual = perfil?.anonimo ? (perfil?.apelido ? 'apelido' : 'anonimo') : 'nome';
  const [modo, setModo] = useState(modoAtual);
  const [apelido, setApelido] = useState(perfil?.apelido || '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setModo(modoAtual);
    setApelido(perfil?.apelido || '');
  }, [aberto]);

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
          <p className="micro muted" style={{ lineHeight: 1.6 }}>
            Os treinos de cada um continuam privados. Aqui aparece só o que a liga mostra.
          </p>
        </div>
      )}
    </Sheet>
  );
}
