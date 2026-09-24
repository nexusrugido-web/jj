import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  UserPlus, Users, Check, X, Flame, Send, LogOut, Crown, Hourglass, Link2, Swords,
} from 'lucide-react';
import { useApp } from '../contexto';
import {
  Card, Btn, Chip, Sheet, Confirmar, Empty, Busca, useToast,
} from '../components/UI';
import Avatar from '../components/Avatar';
import {
  meusAmigos, meusConvitesDeSala, meuPar, pedirAmizade, responderAmizade, chamarPraSala, recusarConviteDeSala,
} from '../lib/amigos';
import {
  minhaSala, criarSala, entrarNaSala, sairDaSala, verSala, convidar, conviteDaURL, esquecerConvite,
} from '../lib/sala';
import { hoje, addDias, emQuanto } from '../lib/utils';
import { inicioSemana } from '../lib/stats';

/* ============================================================
   AMIGOS

   Tudo de gente num lugar só, fora da Liga: o que está esperando
   resposta, a sua sala e a lista de amigos. Pra montar a sala, o
   primeiro caminho é chamar quem já é amigo, com um toque. O link
   pelo WhatsApp fica pra quem ainda não está no app.
   ============================================================ */
const MINIMO = 3;
const MAXIMO = 5;
const NA_TELA = 12;

export default function AmigosPagina() {
  const { sessao, ligada, irPara, abrirLogin } = useApp();
  const toast = useToast();
  const [dados, setDados] = useState(null);
  const [indo, setIndo] = useState(null);
  const [convite, setConvite] = useState(null);
  const [saindo, setSaindo] = useState(false);
  const [busca, setBusca] = useState('');
  const [todos, setTodos] = useState(false);

  const ativa = ligada?.('liga');

  const buscar = useCallback(async () => {
    if (!sessao) return;
    const [amigos, convites, par, sala] = await Promise.all([
      meusAmigos().catch(() => []),
      meusConvitesDeSala().catch(() => []),
      meuPar().catch(() => null),
      minhaSala().catch(() => []),
    ]);
    setDados({ amigos, convites, par, sala });
  }, [sessao]);

  useEffect(() => { if (ativa) buscar(); }, [ativa, buscar]);

  /* chegou pelo link de convite de alguém */
  useEffect(() => {
    if (!ativa || !sessao) return;
    const cod = conviteDaURL();
    if (!cod) return;
    verSala(cod)
      .then((info) => setConvite({ codigo: cod, info }))
      .catch(() => setConvite({ codigo: cod, info: null }));
  }, [ativa, sessao]);

  const deVerdade = useMemo(
    () => (dados?.amigos || []).filter((a) => a.status === 'amigo').sort((a, b) => (b.xp_semana || 0) - (a.xp_semana || 0)),
    [dados]
  );

  if (!ativa) {
    return (
      <div className="page">
        <h1 className="h-page" style={{ marginBottom: 18 }}>Amigos</h1>
        <Card><Empty icon={Users} titulo="A liga está desligada" texto="Amigos e sala voltam quando a liga voltar." /></Card>
      </div>
    );
  }
  if (!sessao) {
    return (
      <div className="page">
        <h1 className="h-page" style={{ marginBottom: 18 }}>Amigos</h1>
        <Card>
          <Empty
            icon={Users}
            titulo="Entre na sua conta pra ter amigos"
            texto="Amigo e sala precisam da conta: é por ela que um vê os pontos da semana do outro."
            acao={<Btn variant="primary" onClick={abrirLogin}>Entrar</Btn>}
          />
        </Card>
      </div>
    );
  }
  if (!dados) return <div className="page"><h1 className="h-page">Amigos</h1></div>;

  /* cada botão mostra que está indo e recarrega tudo no fim */
  const fazer = async (chave, acao) => {
    setIndo(chave);
    try {
      const r = await acao();
      if (r?.mensagem) toast(r.mensagem, r.ok === false ? 'err' : '');
      await buscar();
    } catch {
      toast('Não deu agora. Tenta de novo.', 'err');
    }
    setIndo(null);
  };

  const { amigos, convites, par, sala } = dados;
  const recebidos = amigos.filter((a) => a.status === 'recebido');
  const enviados = amigos.filter((a) => a.status === 'enviado');
  const sugestao = par?.rival_id && !par.amizade && !amigos.some((a) => a.user_id === par.rival_id) ? par : null;
  const proximaSegunda = addDias(inicioSemana(hoje()), 7);

  const filtrados = busca.trim()
    ? deVerdade.filter((a) => a.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    : deVerdade;
  const naTela = todos ? filtrados : filtrados.slice(0, NA_TELA);

  const esperando = convites.length + recebidos.length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h-page">Amigos</h1>
        </div>
      </div>

      {/* ---- o que espera resposta ---- */}
      {esperando > 0 && (
        <Card className="accent" style={{ marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>esperando você</div>
          <div className="col" style={{ gap: 8 }}>
            {convites.map((c) => (
              <div key={c.codigo} className="amigo-aviso">
                <Avatar nome={c.quem_chamou} foto={c.foto} className="liga-avatar" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tiny" style={{ fontWeight: 600 }}>{c.quem_chamou} te chamou pra sala</div>
                  <div className="micro muted">{c.pessoas} de {MAXIMO} · começa {emQuanto(proximaSegunda)}</div>
                </div>
                <Btn size="sm" variant="primary" disabled={indo === c.codigo}
                  onClick={() => fazer(c.codigo, () => entrarNaSala(c.codigo))}>Entrar</Btn>
                <button type="button" className="btn ghost icon sm" aria-label="Agora não"
                  onClick={() => fazer(c.codigo, () => recusarConviteDeSala(c.codigo))}><X size={14} /></button>
              </div>
            ))}
            {recebidos.map((a) => (
              <div key={a.user_id} className="amigo-aviso">
                <Avatar nome={a.nome} foto={a.foto} className="liga-avatar" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tiny" style={{ fontWeight: 600 }}>{a.nome} quer ser seu amigo</div>
                </div>
                <Btn size="sm" variant="primary" icon={Check} disabled={indo === a.user_id}
                  onClick={() => fazer(a.user_id, async () => { await responderAmizade(a.user_id, true); return { mensagem: 'Agora vocês são amigos.' }; })}>Aceitar</Btn>
                <button type="button" className="btn ghost icon sm" aria-label="Recusar"
                  onClick={() => fazer(a.user_id, () => responderAmizade(a.user_id, false))}><X size={14} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ---- a sala ---- */}
      <SuaSala
        sala={sala} amigos={deVerdade} indo={indo} proximaSegunda={proximaSegunda}
        onCriar={() => fazer('criar', criarSala)}
        onChamar={(id) => fazer(id, () => chamarPraSala(id))}
        onSair={() => setSaindo(true)}
      />

      {/* ---- os amigos ---- */}
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">pontos desta semana</div>
            <h2 className="h-sec row" style={{ gap: 8 }}>
              <Users size={17} /> {deVerdade.length ? `${deVerdade.length} ${deVerdade.length === 1 ? 'amigo' : 'amigos'}` : 'Seus amigos'}
            </h2>
          </div>
        </div>

        {deVerdade.length > 6 && (
          <div style={{ marginBottom: 12 }}>
            <Busca value={busca} onChange={setBusca} placeholder="Procurar amigo" />
          </div>
        )}

        {deVerdade.length === 0 ? (
          <div className="col" style={{ gap: 12 }}>
            <p className="tiny muted" style={{ lineHeight: 1.65 }}>
              Na Liga, toque no nome de alguém do seu grupo pra adicionar. Amigo vê os seus pontos da semana, e você chama
              ele direto pra sua sala.
            </p>
            <Btn variant="contorno" icon={Swords} onClick={() => irPara('liga')} style={{ alignSelf: 'flex-start' }}>Ver o grupo da Liga</Btn>
          </div>
        ) : (
          <div className="col" style={{ gap: 6 }}>
            {naTela.map((a) => (
              <div key={a.user_id} className="liga-linha">
                <span className="liga-pos num">{deVerdade.indexOf(a) + 1}</span>
                <Avatar nome={a.nome} foto={a.foto} className="liga-avatar" />
                <span className="tiny liga-nome">{a.nome}</span>
                {a.sequencia > 0 && (
                  <span className="micro num row" style={{ gap: 3, color: 'var(--roar)' }} title="dias de ofensiva">
                    <Flame size={12} /> {a.sequencia}
                  </span>
                )}
                {a.na_sala && <Chip tone="jade">na sala</Chip>}
                <span className="num tiny" style={{ minWidth: 34, textAlign: 'right', fontWeight: 700 }}>{a.xp_semana}</span>
              </div>
            ))}
            {!filtrados.length && <p className="tiny muted">Ninguém com esse nome.</p>}
            {filtrados.length > NA_TELA && (
              <Btn size="sm" variant="ghost" onClick={() => setTodos(!todos)}>
                {todos ? 'Mostrar menos' : `Ver todos os ${filtrados.length}`}
              </Btn>
            )}
          </div>
        )}

        {enviados.length > 0 && (
          <div className="col" style={{ gap: 6, marginTop: 12 }}>
            {enviados.map((a) => (
              <div key={a.user_id} className="liga-linha" style={{ opacity: 0.65 }}>
                <Avatar nome={a.nome} foto={a.foto} className="liga-avatar" />
                <span className="tiny liga-nome">{a.nome}</span>
                <span className="micro muted">pedido enviado</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ---- alguém do seu ritmo ---- */}
      {sugestao && (
        <Card style={{ marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>treina no seu ritmo</div>
          <div className="amigo-aviso sugestao">
            <Avatar nome={sugestao.rival_nome} foto={sugestao.rival_foto} className="liga-avatar" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tiny" style={{ fontWeight: 600 }}>{sugestao.rival_nome}</div>
              <div className="micro muted">
                {sugestao.rival_ritmo ? `Treina ${sugestao.rival_ritmo}x por semana, como você.` : 'Treina no seu ritmo.'}
              </div>
            </div>
            <Btn size="sm" icon={UserPlus} disabled={indo === sugestao.rival_id}
              onClick={() => fazer(sugestao.rival_id, () => pedirAmizade(sugestao.rival_id))}>Adicionar</Btn>
          </div>
        </Card>
      )}

      <Sheet
        aberto={!!convite}
        onClose={() => { esquecerConvite(); setConvite(null); }}
        titulo="Convite pra uma sala"
        footer={(
          <>
            <Btn variant="ghost" onClick={() => { esquecerConvite(); setConvite(null); }}>Agora não</Btn>
            <Btn variant="primary" icon={UserPlus} disabled={indo === 'link' || !convite?.info || convite?.info?.cheia}
              onClick={() => fazer('link', async () => {
                const r = await entrarNaSala(convite.codigo);
                if (r.ok) { esquecerConvite(); setConvite(null); }
                return r;
              })}>Entrar na sala</Btn>
          </>
        )}
      >
        {!convite?.info ? (
          <p className="tiny muted">Esse convite não existe mais. Peça um link novo pra quem te chamou.</p>
        ) : convite.info.cheia ? (
          <p className="tiny muted">A sala de {convite.info.quem_convidou} já está com {MAXIMO} pessoas.</p>
        ) : (
          <>
            <p className="tiny" style={{ lineHeight: 1.7 }}>
              <b>{convite.info.quem_convidou}</b> te chamou pra correr a liga junto. A sala tem {convite.info.pessoas}{' '}
              {convite.info.pessoas === 1 ? 'pessoa' : 'pessoas'} e cabe até {MAXIMO}.
            </p>
            <p className="micro muted" style={{ lineHeight: 1.65 }}>
              Ela começa {emQuanto(proximaSegunda)}, na segunda, e corre no lugar da liga automática: pontos de treino,
              aula e quiz, com pódio e sobe e desce de divisão. Tem sempre um grupo seu, toda semana, até alguém sair.
            </p>
          </>
        )}
      </Sheet>

      <Confirmar
        aberto={saindo}
        onClose={() => setSaindo(false)}
        titulo="Sair da sala?"
        rotulo="Sair"
        texto={sala[0]?.sou_dono && sala.length > 1
          ? 'Você criou a sala, mas ela continua com os outros. Você corre nela até domingo e depois volta pra liga automática.'
          : 'Você corre nela até domingo e depois volta pra liga automática.'}
        onConfirmar={async () => { await sairDaSala().catch(() => {}); await buscar(); toast('Você sai da sala no fim da semana'); }}
      />
    </div>
  );
}

/* ============================================================
   A SALA
   Sem sala: criar. Com sala: quem está e, logo embaixo, os amigos
   pra chamar com um toque. O link é o plano B, pra quem não é
   amigo ou ainda nem tem o app.
   ============================================================ */
function SuaSala({ sala, amigos, indo, proximaSegunda, onCriar, onChamar, onSair }) {
  if (!sala.length) {
    return (
      <Card style={{ marginBottom: 14 }}>
        <div className="eyebrow">liga só de vocês</div>
        <h2 className="h-sec" style={{ marginTop: 4 }}>Monte a sua sala</h2>
        <p className="tiny muted" style={{ marginTop: 8, lineHeight: 1.65 }}>
          De {MINIMO} a {MAXIMO} pessoas. A sala corre no lugar da liga automática, toda semana, com pódio e sobe e desce de
          divisão. Você cria e chama os seus amigos daqui mesmo.
        </p>
        <Btn variant="primary" icon={UserPlus} onClick={onCriar} disabled={indo === 'criar'} style={{ marginTop: 14 }}>
          {indo === 'criar' ? 'Criando…' : 'Criar sala'}
        </Btn>
      </Card>
    );
  }

  const n = sala.length;
  const { valendo, proxima, codigo } = sala[0];
  const estado = valendo
    ? { tom: 'jade', texto: 'valendo esta semana' }
    : proxima
      ? { tom: 'warn', texto: `começa ${emQuanto(proximaSegunda)}` }
      : { tom: '', texto: `falta${MINIMO - n === 1 ? '' : 'm'} ${MINIMO - n} pra começar` };
  const cabe = n < MAXIMO;
  const praChamar = amigos.filter((a) => !a.na_sala);

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">liga só de vocês</div>
          <h2 className="h-sec" style={{ marginTop: 4 }}>Sua sala · {n} de {MAXIMO}</h2>
        </div>
        <Chip tone={estado.tom}>{estado.tom === 'warn' && <Hourglass size={11} />} {estado.texto}</Chip>
      </div>

      <div className="col" style={{ gap: 6 }}>
        {sala.map((m) => (
          <div key={m.user_id} className={`liga-linha ${m.sou_eu ? 'eu' : ''}`}>
            <Avatar nome={m.nome} foto={m.foto} className="liga-avatar" />
            <span className="tiny liga-nome" style={{ fontWeight: m.sou_eu ? 600 : 400 }}>
              {m.nome}{m.sou_eu ? ' (você)' : ''}
            </span>
            {m.dono && <Chip><Crown size={11} /> criou</Chip>}
            {m.vale_desde > hoje() && <span className="micro muted">começa {emQuanto(m.vale_desde)}</span>}
          </div>
        ))}
        {Array.from({ length: Math.max(0, MINIMO - n) }).map((_, i) => (
          <div key={`vaga${i}`} className="liga-linha sala-vaga"><span className="micro muted">vaga</span></div>
        ))}
      </div>

      {cabe && (
        <div style={{ marginTop: 18 }}>
          <div className="tiny" style={{ fontWeight: 600, marginBottom: 10 }}>Chamar pra sala</div>
          {praChamar.length > 0 ? (
            <div className="col" style={{ gap: 6 }}>
              {praChamar.map((a) => (
                <div key={a.user_id} className="liga-linha">
                  <Avatar nome={a.nome} foto={a.foto} className="liga-avatar" />
                  <span className="tiny liga-nome">{a.nome}</span>
                  {a.chamado ? <Chip>chamado</Chip> : (
                    <Btn size="sm" variant="contorno" icon={Send} disabled={indo === a.user_id} onClick={() => onChamar(a.user_id)}>
                      Chamar
                    </Btn>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="tiny muted" style={{ lineHeight: 1.65 }}>
              {amigos.length ? 'Todos os seus amigos já estão na sala.' : 'Você ainda não tem amigos no app. Mande o link pra quem treina com você.'}
            </p>
          )}
          {praChamar.length ? (
            <button type="button" className="btn ghost sm" style={{ marginTop: 10, paddingLeft: 0 }} onClick={() => convidar(codigo)}>
              <Link2 size={14} /> Ou mandar o link pra quem não está no app
            </button>
          ) : (
            <Btn variant="primary" icon={Link2} onClick={() => convidar(codigo)} style={{ marginTop: 12 }}>Mandar o link pelo WhatsApp</Btn>
          )}
        </div>
      )}

      <p className="micro muted" style={{ marginTop: 14, lineHeight: 1.6 }}>
        Quem entra hoje corre a partir da próxima segunda. Sair vale a partir da semana seguinte, e com menos de {MINIMO}{' '}
        a sala para e cada um volta pra liga automática.
      </p>
      <Btn variant="ghost" size="sm" icon={LogOut} onClick={onSair} style={{ marginTop: 8, paddingLeft: 0 }}>Sair da sala</Btn>
    </Card>
  );
}
