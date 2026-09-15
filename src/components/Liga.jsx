import React, { useState, useEffect } from 'react';
import {
  Trophy, Users, Lock, Check, X, Shield, Eye, EyeOff, RefreshCw, Info,
} from 'lucide-react';
import { useApp } from '../contexto';
import { supabase } from '../lib/supabase';
import {
  Card, Btn, Chip, Empty, Stat, Sheet, Field, Input, BeltTag, useToast,
} from './UI';
import { db } from '../db/db';
import { semanaDe } from '../lib/xp';

/* ============================================================
   LIGA

   Grupos de trinta pessoas com ritmo parecido, pra o ranking
   ser disputável de verdade.

   Ninguém entra sem escolher entrar, e dá pra participar com
   apelido em vez do nome.
   ============================================================ */

export default function Liga({ compacto = false }) {
  const { sessao, irPara, ligada } = useApp();
  const toast = useToast();

  const [carregando, setCarregando] = useState(true);
  const [linhas, setLinhas] = useState([]);
  const [perfil, setPerfil] = useState(null);
  const [entrando, setEntrando] = useState(false);
  const [apelido, setApelido] = useState('');
  const [anonimo, setAnonimo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const ativa = ligada?.('liga');

  async function buscar() {
    if (!supabase || !sessao) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const [r, p] = await Promise.all([
        supabase.rpc('minha_liga'),
        supabase.from('perfil').select('*').eq('user_id', sessao.user.id).single(),
      ]);
      setLinhas(r.data || []);
      setPerfil(p.data || null);
      if (p.data?.apelido) setApelido(p.data.apelido);
      setAnonimo(!!p.data?.anonimo);
    } catch (e) {
      console.error('[liga]', e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { if (ativa) buscar(); else setCarregando(false); }, [ativa, sessao]);

  /* manda os pontos que estão só no aparelho */
  async function subirPontos() {
    if (!supabase || !sessao) return;
    try {
      const sem = semanaDe();
      const locais = await db.pontos.where('semana').equals(sem).toArray();
      if (!locais.length) return;
      await supabase.rpc('subir_pontos', {
        p_linhas: locais.map((l) => ({
          evento: l.evento, refId: l.refId, detalhe: l.detalhe, data: l.data,
        })),
      });
    } catch (e) {
      console.error('[pontos]', e);
    }
  }

  async function entrar() {
    setEnviando(true);
    try {
      await subirPontos();
      const { data } = await supabase.rpc('entrar_na_liga', {
        p_apelido: apelido.trim() || null,
        p_anonimo: anonimo,
      });
      const r = Array.isArray(data) ? data[0] : data;
      toast(r?.mensagem || 'Pronto');
      setEntrando(false);
      await buscar();
    } catch {
      toast('Não consegui entrar agora', 'err');
    } finally {
      setEnviando(false);
    }
  }

  async function sair() {
    await supabase.rpc('sair_da_liga');
    toast('Você saiu da liga');
    setLinhas([]);
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

  /* ainda não aceitou participar */
  if (!perfil?.participa_liga) {
    return (
      <>
        <Card style={{ marginBottom: compacto ? 0 : 14 }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">você escolhe se quer</div>
              <h2 className="h-sec row" style={{ gap: 8 }}><Trophy size={16} /> Liga entre praticantes</h2>
            </div>
          </div>
          <p className="tiny muted" style={{ lineHeight: 1.75 }}>
            Você entra num grupo de até trinta pessoas com ritmo parecido com o seu, e durante a semana vocês
            acumulam pontos treinando e estudando. Na segunda-feira o placar zera e começa de novo.
          </p>
          <p className="tiny muted" style={{ marginTop: 10, lineHeight: 1.75 }}>
            Só aparece pros outros o seu nome, sua faixa e quantos pontos você fez. Nada do que você registra
            nos treinos fica visível pra ninguém.
          </p>
          <Btn variant="primary" icon={Trophy} onClick={() => setEntrando(true)} style={{ marginTop: 16 }}>
            Quero participar
          </Btn>
        </Card>

        <Sheet
          aberto={entrando}
          onClose={() => setEntrando(false)}
          titulo="Como você quer aparecer"
          footer={
            <>
              <Btn variant="ghost" onClick={() => setEntrando(false)}>Cancelar</Btn>
              <Btn variant="primary" icon={Check} onClick={entrar} disabled={enviando}>Entrar na liga</Btn>
            </>
          }
        >
          <div className="col" style={{ gap: 10 }}>
            <button type="button" className={`opcao-meta ${!anonimo ? 'on' : ''}`} onClick={() => setAnonimo(false)}>
              <div className="row" style={{ gap: 9 }}>
                <Eye size={15} style={{ flex: 'none' }} />
                <div>
                  <div className="tiny" style={{ fontWeight: 600 }}>Com o meu nome</div>
                  <p className="micro muted" style={{ marginTop: 3 }}>
                    Aparece como {perfil?.nome || 'seu nome'}, junto com a sua faixa.
                  </p>
                </div>
              </div>
            </button>
            <button type="button" className={`opcao-meta ${anonimo ? 'on' : ''}`} onClick={() => setAnonimo(true)}>
              <div className="row" style={{ gap: 9 }}>
                <EyeOff size={15} style={{ flex: 'none' }} />
                <div>
                  <div className="tiny" style={{ fontWeight: 600 }}>Com um apelido</div>
                  <p className="micro muted" style={{ marginTop: 3 }}>Ninguém vê o seu nome de verdade.</p>
                </div>
              </div>
            </button>
          </div>

          {anonimo && (
            <Field label="Seu apelido">
              <Input value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Como quer ser chamado" maxLength={20} />
            </Field>
          )}

          <div className="valida bom">
            <Shield size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
            <p className="micro muted" style={{ lineHeight: 1.65 }}>
              Dá pra sair a qualquer momento, e aí você some do ranking na hora. Seus treinos continuam privados
              dos dois jeitos.
            </p>
          </div>
        </Sheet>
      </>
    );
  }

  /* participa, mas o grupo ainda não montou */
  if (!linhas.length) {
    return (
      <Card style={{ marginBottom: compacto ? 0 : 14 }}>
        <div className="card-head">
          <h2 className="h-sec row" style={{ gap: 8 }}><Trophy size={16} /> Sua liga</h2>
          <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={buscar} disabled={carregando}>Atualizar</Btn>
        </div>
        <p className="tiny muted" style={{ lineHeight: 1.7 }}>
          {carregando
            ? 'Buscando o seu grupo.'
            : 'Você está na liga, mas o seu grupo ainda não montou. Isso acontece no começo da semana. Enquanto isso, os pontos continuam contando normal.'}
        </p>
        <button className="btn ghost xs" onClick={sair} style={{ marginTop: 12, opacity: 0.7 }}>Sair da liga</button>
      </Card>
    );
  }

  const eu = linhas.find((l) => l.sou_eu);
  const divisao = linhas[0]?.divisao;

  return (
    <Card style={{ marginBottom: compacto ? 0 : 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">
            {linhas[0]?.total} pessoas, zera segunda-feira
          </div>
          <h2 className="h-sec row" style={{ gap: 8 }}>
            <Trophy size={16} /> Liga {divisao}
          </h2>
        </div>
        <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={() => { subirPontos().then(buscar); }} disabled={carregando}>
          Atualizar
        </Btn>
      </div>

      {eu && (
        <div className="liga-eu">
          <span className="liga-pos num">{eu.posicao}º</span>
          <div style={{ flex: 1 }}>
            <div className="tiny" style={{ fontWeight: 600 }}>Você</div>
            <div className="micro muted">
              {eu.posicao === 1
                ? 'Na frente do grupo esta semana.'
                : eu.posicao <= 3
                  ? 'Entre os três primeiros.'
                  : `Faltam ${linhas[eu.posicao - 2].xp_semana - eu.xp_semana + 1} pontos pra subir uma posição.`}
            </div>
          </div>
          <span className="num" style={{ fontSize: 19, fontWeight: 700, color: 'var(--accent)' }}>{eu.xp_semana}</span>
        </div>
      )}

      <div className="col" style={{ gap: 6, marginTop: 12 }}>
        {linhas.slice(0, compacto ? 5 : 30).map((l) => (
          <div key={l.user_id} className={`liga-linha ${l.sou_eu ? 'eu' : ''}`}>
            <span className="liga-pos num">{l.posicao}</span>
            <span className="tiny" style={{ flex: 1, fontWeight: l.sou_eu ? 600 : 400 }}>{l.nome}</span>
            <BeltTag faixa={l.faixa} graus={l.graus} />
            <span className="num micro" style={{ minWidth: 38, textAlign: 'right' }}>{l.xp_semana}</span>
          </div>
        ))}
      </div>

      {!compacto && (
        <button className="btn ghost xs" onClick={sair} style={{ marginTop: 14, opacity: 0.7 }}>
          Sair da liga
        </button>
      )}
    </Card>
  );
}
