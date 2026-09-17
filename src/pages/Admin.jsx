import React, { useState, useEffect } from 'react';
import {
  Shield, Users, TrendingUp, Zap, RefreshCw, Check, X, Megaphone,
  Trophy, CreditCard, TriangleAlert, Sparkles, ShieldAlert, Copy,
} from 'lucide-react';
import { useApp } from '../contexto';
import { supabase } from '../lib/supabase';
import {
  Card, Btn, Chip, Stat, Empty, Field, Input, Textarea, Select, useToast, Bar,
} from '../components/UI';
import { carregarChaves, souAdminNoServidor } from '../lib/chaves';
import Acervo from '../components/Acervo';
import Numeros from '../components/Numeros';

/* ============================================================
   PAINEL DO ADMINISTRADOR

   Serve pra ligar e desligar recurso sem mexer em código nem
   fazer deploy. Você clica, e vale pra todo mundo na próxima
   vez que o app abrir.
   ============================================================ */

const GRUPOS = [
  { id: 'comunidade', nome: 'Comunidade', icone: Trophy },
  { id: 'registro', nome: 'Registro de treino', icone: Zap },
  { id: 'estudo', nome: 'Estudo', icone: Sparkles },
  { id: 'venda', nome: 'Cobrança', icone: CreditCard },
  { id: 'custo', nome: 'Custo', icone: TrendingUp },
  { id: 'geral', nome: 'Geral', icone: Shield },
];

export default function Admin() {
  const { sessao, irPara } = useApp();
  const toast = useToast();

  const [carregando, setCarregando] = useState(true);
  const [chaves, setChaves] = useState([]);
  const [numeros, setNumeros] = useState(null);
  const [liga, setLiga] = useState(null);
  const [recado, setRecado] = useState({ titulo: '', texto: '', tom: 'info', link: '' });
  const [salvando, setSalvando] = useState(null);
  /* null = ainda perguntando, false = a tela abriu pelo atalho do
     aparelho e o servidor não reconhece esta conta */
  const [permissaoReal, setPermissaoReal] = useState(null);
  const [aba, setAba] = useState('produto');

  async function buscar() {
    if (!supabase) return;
    setCarregando(true);
    try {
      const [c, n, l, r, perm] = await Promise.all([
        supabase.from('chave').select('*').order('grupo').order('nome'),
        supabase.rpc('numeros_do_produto'),
        supabase.rpc('pronto_pra_liga'),
        supabase.from('recado').select('*').eq('id', 1).single(),
        souAdminNoServidor(),
      ]);
      setPermissaoReal(!!perm);
      setChaves(c.data || []);
      setNumeros(Array.isArray(n.data) ? n.data[0] : n.data);
      setLiga(Array.isArray(l.data) ? l.data[0] : l.data);
      if (r.data) setRecado({ titulo: r.data.titulo || '', texto: r.data.texto || '', tom: r.data.tom || 'info', link: r.data.link || '' });
    } catch (e) {
      console.error('[admin]', e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { buscar(); }, []);

  /* ------------------------------------------------------------
     SALVAR DE VERDADE

     A regra do banco não devolve erro quando ela simplesmente não
     deixa a linha ser vista. O update roda, acerta zero linhas e
     volta como se tivesse dado certo. Era por isso que o botão
     virava, o aviso dizia que salvou, e no Atualizar voltava tudo
     pro lugar de antes.

     Pedindo a linha de volta com select(), zero linha vira erro
     na cara, e o painel diz o que fazer.
     ------------------------------------------------------------ */
  async function gravarChave(chave, campos) {
    const { data, error } = await supabase.from('chave')
      .update({ ...campos, atualizado: new Date().toISOString() })
      .eq('id', chave.id)
      .select('id, nome, ligada, porcentagem, grupo, descricao');

    if (error) throw error;
    if (!data || data.length === 0) {
      setPermissaoReal(false);
      throw new Error('sem permissão');
    }
    const salva = data[0];
    setChaves((lista) => lista.map((c) => (c.id === salva.id ? { ...c, ...salva } : c)));
    await carregarChaves();
    return salva;
  }

  async function virar(chave, valor) {
    setSalvando(chave.id);
    try {
      await gravarChave(chave, { ligada: valor });
      toast(valor ? `${chave.nome} ligado pra todo mundo` : `${chave.nome} desligado`);
    } catch (e) {
      toast(
        String(e?.message).includes('permissão')
          ? 'Esta conta não tem permissão de administrador no servidor'
          : 'Não consegui salvar',
        'err'
      );
    } finally {
      setSalvando(null);
    }
  }

  async function mudarFatia(chave, pct) {
    setSalvando(chave.id);
    try {
      await gravarChave(chave, { porcentagem: pct });
      toast(pct === 100 ? 'Liberado pra todo mundo' : `Liberado pra ${pct}%`);
    } catch (e) {
      toast(
        String(e?.message).includes('permissão')
          ? 'Esta conta não tem permissão de administrador no servidor'
          : 'Não consegui salvar',
        'err'
      );
    } finally {
      setSalvando(null);
    }
  }

  async function salvarRecado() {
    setSalvando('recado');
    try {
      const { data, error } = await supabase.from('recado')
        .update({ ...recado, atualizado: new Date().toISOString() })
        .eq('id', 1)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        setPermissaoReal(false);
        throw new Error('sem permissão');
      }
      toast('Recado salvo');
    } catch (e) {
      toast(
        String(e?.message).includes('permissão')
          ? 'Esta conta não tem permissão de administrador no servidor'
          : 'Não consegui salvar o recado',
        'err'
      );
    } finally {
      setSalvando(null);
    }
  }

  if (!supabase || !sessao) {
    return (
      <div className="page">
        <Card>
          <Empty icon={Shield} titulo="Precisa estar conectado" texto="O painel lê e escreve no servidor, então exige conta e internet." />
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">só você vê esta tela</div>
          <h1 className="h-page">Painel</h1>
        </div>
        <Btn icon={RefreshCw} onClick={buscar} disabled={carregando}>Atualizar</Btn>
      </div>

      <div className="seletor-pill" style={{ marginBottom: 14 }}>
        {[{ id: 'produto', nome: 'Produto' }, { id: 'acervo', nome: 'Acervo' }].map((o) => (
          <button key={o.id} className={aba === o.id ? 'on' : ''} onClick={() => setAba(o.id)}>{o.nome}</button>
        ))}
      </div>

      {aba === 'acervo' && <Acervo />}

      {permissaoReal === false && (
        <Card style={{ marginBottom: 14, borderLeft: '3px solid var(--blood)' }}>
          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <span className="stat-ico" style={{ color: 'var(--blood)' }}><ShieldAlert size={16} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="h-sec">Esta tela abriu, mas nada daqui vai ficar salvo</div>
              <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
                O painel destravou neste aparelho, e o servidor não conhece esta conta como administradora.
                Os interruptores viram na tela e voltam sozinhos no próximo Atualizar. Rode a linha abaixo
                uma vez no SQL Editor do Supabase e recarregue o app.
              </p>
              <pre className="codigo">{SQL_ADMIN(sessao?.user?.email)}</pre>
              <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                <Btn
                  size="sm"
                  icon={Copy}
                  onClick={() => {
                    navigator.clipboard?.writeText(SQL_ADMIN(sessao?.user?.email))
                      .then(() => toast('Copiado, cole no SQL Editor'))
                      .catch(() => toast('Copie o texto na mão', 'err'));
                  }}
                >
                  Copiar o comando
                </Btn>
                <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={buscar}>Conferir de novo</Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {permissaoReal === true && (
        <div className="valida bom" style={{ marginBottom: 14 }}>
          <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
          <p className="micro muted" style={{ lineHeight: 1.65 }}>
            O servidor reconhece esta conta. O que você ligar aqui vale pra todo mundo assim que o app abrir.
          </p>
        </div>
      )}

      {aba === 'produto' && (<>

      {/* números */}
      {numeros && (
        <Card style={{ marginBottom: 14 }}>
          <div className="card-head"><h2 className="h-sec">Como está o produto</h2></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 12 }}>
            <Stat size="sm" icon={Users} valor={numeros.contas} label="contas" />
            <Stat size="sm" valor={numeros.contas_semana} label="novas na semana" tone="accent" />
            <Stat size="sm" valor={numeros.ativos_7d} label="ativos 7 dias" tone="jade" />
            <Stat size="sm" valor={numeros.ativos_30d} label="ativos 30 dias" />
            <Stat size="sm" icon={CreditCard} valor={numeros.assinantes} label="assinantes" tone="jade" />
            <Stat size="sm" valor={numeros.assinantes_atraso} label="em atraso" tone={numeros.assinantes_atraso > 0 ? 'blood' : undefined} />
            <Stat size="sm" icon={Trophy} valor={numeros.na_liga} label="na liga" />
            <Stat size="sm" valor={numeros.xp_semana} label="pontos na semana" />
          </div>

          {numeros.contas > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <span className="tiny muted">quanto do total está ativo nos últimos 30 dias</span>
                <span className="spacer" />
                <span className="num tiny">{Math.round((numeros.ativos_30d / numeros.contas) * 100)}%</span>
              </div>
              <Bar v={numeros.ativos_30d} max={numeros.contas} tone="jade" />
            </div>
          )}
        </Card>
      )}

      {/* a liga */}
      {liga && (
        <Card className={liga.pronto ? 'accent' : ''} style={{ marginBottom: 14 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">o app te avisa quando vale a pena</div>
              <h2 className="h-sec">Liga entre praticantes</h2>
            </div>
            <Chip tone={chaves.find((c) => c.id === 'liga')?.ligada ? 'jade' : ''}>
              {chaves.find((c) => c.id === 'liga')?.ligada ? 'ligada' : 'desligada'}
            </Chip>
          </div>

          <div className={`valida ${liga.pronto ? 'bom' : 'atencao'}`}>
            {liga.pronto
              ? <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
              : <TriangleAlert size={15} className="valida-ico" style={{ color: 'var(--roar)' }} />}
            <p className="micro muted" style={{ lineHeight: 1.65 }}>{liga.recado}</p>
          </div>

          {!liga.pronto && liga.faltam > 0 && (
            <div style={{ marginTop: 12 }}>
              <Bar v={liga.participantes} max={30} />
              <p className="micro muted" style={{ marginTop: 6 }}>
                {liga.participantes} de 30 pontuando esta semana. Faltam {liga.faltam}.
              </p>
            </div>
          )}

          {(() => {
            const c = chaves.find((x) => x.id === 'liga');
            if (!c) return null;
            return (
              <div className="row wrap" style={{ gap: 9, marginTop: 14 }}>
                {c.ligada ? (
                  <Btn size="sm" variant="ghost" icon={X} onClick={() => virar(c, false)} disabled={salvando === c.id}>
                    Desligar a liga
                  </Btn>
                ) : (
                  <Btn
                    size="sm"
                    variant={liga.pronto ? 'primary' : ''}
                    icon={Check}
                    onClick={() => virar(c, true)}
                    disabled={salvando === c.id}
                  >
                    Ligar pra todo mundo
                  </Btn>
                )}
                {!liga.pronto && !c.ligada && (
                  <span className="micro muted" style={{ alignSelf: 'center' }}>
                    dá pra ligar mesmo assim, se quiser testar
                  </span>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {/* chaves por grupo */}
      {GRUPOS.map((g) => {
        const doGrupo = chaves.filter((c) => c.grupo === g.id);
        if (!doGrupo.length) return null;
        const Ico = g.icone;
        return (
          <Card key={g.id} style={{ marginBottom: 14 }}>
            <div className="card-head">
              <h2 className="h-sec row" style={{ gap: 8 }}><Ico size={16} /> {g.nome}</h2>
            </div>
            <div className="col" style={{ gap: 12 }}>
              {doGrupo.map((c) => (
                <div key={c.id} className="chave-linha">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="tiny" style={{ fontWeight: 600 }}>{c.nome}</span>
                      {c.ligada && c.porcentagem < 100 && <Chip tone="warn">{c.porcentagem}%</Chip>}
                    </div>
                    <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{c.descricao}</p>
                    {c.ligada && (
                      <div className="row wrap" style={{ gap: 5, marginTop: 8 }}>
                        {[10, 25, 50, 100].map((p) => (
                          <button
                            key={p}
                            className={`chip ${c.porcentagem === p ? 'on' : ''}`}
                            style={{ minHeight: 30, fontSize: 11 }}
                            onClick={() => mudarFatia(c, p)}
                            disabled={salvando === c.id}
                          >{p}%</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className={`interruptor ${c.ligada ? 'on' : ''}`}
                    onClick={() => virar(c, !c.ligada)}
                    disabled={salvando === c.id}
                    aria-label={c.ligada ? 'Desligar' : 'Ligar'}
                  >
                    <span />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      <Numeros />

      {/* recado */}
      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">aparece no topo pra todo mundo</div>
            <h2 className="h-sec row" style={{ gap: 8 }}><Megaphone size={16} /> Recado</h2>
          </div>
        </div>
        <Field label="Título"><Input value={recado.titulo} onChange={(e) => setRecado({ ...recado, titulo: e.target.value })} placeholder="Ex.: Liga aberta" /></Field>
        <Field label="Texto" hint="Deixe vazio pra não mostrar nada.">
          <Textarea value={recado.texto} onChange={(e) => setRecado({ ...recado, texto: e.target.value })} />
        </Field>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Tom">
            <Select value={recado.tom} onChange={(e) => setRecado({ ...recado, tom: e.target.value })}>
              <option value="info">Informação</option>
              <option value="bom">Boa notícia</option>
              <option value="atencao">Atenção</option>
            </Select>
          </Field>
          <Field label="Link (opcional)"><Input value={recado.link} onChange={(e) => setRecado({ ...recado, link: e.target.value })} /></Field>
        </div>
        <div className="row" style={{ gap: 9, marginTop: 12 }}>
          <Btn variant="primary" icon={Check} onClick={salvarRecado} disabled={salvando === 'recado'}>Salvar</Btn>
          {(() => {
            const c = chaves.find((x) => x.id === 'aviso_global');
            if (!c) return null;
            return (
              <Btn size="sm" variant="ghost" onClick={() => virar(c, !c.ligada)}>
                {c.ligada ? 'Parar de mostrar' : 'Começar a mostrar'}
              </Btn>
            );
          })()}
        </div>
      </Card>
      </>)}
    </div>
  );
}

/* O comando que falta rodar uma vez no Supabase pra esta conta
   virar administradora de verdade. */
function SQL_ADMIN(email) {
  const e = email || 'seu@email.com';
  return `insert into public.admin (user_id)\nselect id from auth.users where email = '${e}'\non conflict do nothing;`;
}
