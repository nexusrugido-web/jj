import React, { useState, useEffect, useMemo } from 'react';
import { Users, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, Btn, Chip, Busca, Empty, Stat, BeltTag, useToast } from './UI';
import { fmtData, relativo } from '../lib/utils';
import { nomeDivisao } from '../lib/liga';

/* ============================================================
   AS CONTAS

   A única tela do app que tem motivo pra ver conta de outra
   pessoa, e mesmo aqui ela mostra o mínimo: quem é, onde está na
   liga, o que assinou e o que comprou.

   Nada do que a pessoa registra nos treinos aparece. Isso não é
   informação de administração, é o diário dela.
   ============================================================ */

const ROTULO_ASSINATURA = {
  ativa: { nome: 'assinante', tom: 'jade' },
  carencia: { nome: 'em carência', tom: 'warn' },
  atrasada: { nome: 'em atraso', tom: 'roar' },
  cancelada: { nome: 'cancelada', tom: '' },
  expirada: { nome: 'venceu', tom: '' },
  reembolsada: { nome: 'reembolsada', tom: 'blood' },
};

export default function Contas() {
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  async function buscar() {
    if (!supabase) return;
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.rpc('contas_do_app', { p_busca: null, p_limite: 300 });
      if (error) throw error;
      setLista(data || []);
    } catch (e) {
      console.error('[contas]', e);
      setErro('Não consegui ler as contas. Confira se o admin2.sql já rodou no Supabase.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { buscar(); }, []);

  const mostradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((c) =>
      (c.email || '').toLowerCase().includes(q) || (c.nome || '').toLowerCase().includes(q));
  }, [lista, busca]);

  const resumo = useMemo(() => ({
    total: lista.length,
    naLiga: lista.filter((c) => c.na_liga).length,
    assinantes: lista.filter((c) => c.assinatura === 'ativa').length,
    compradores: lista.filter((c) => Number(c.compras) > 0).length,
  }), [lista]);

  if (erro) {
    return (
      <Card>
        <Empty
          icon={Users}
          titulo="A lista de contas ainda não existe no banco"
          texto={erro}
          acao={<Btn variant="primary" icon={RefreshCw} onClick={buscar}>Tentar de novo</Btn>}
        />
      </Card>
    );
  }

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">quem usa o app</div>
            <h2 className="h-sec row" style={{ gap: 8 }}><Users size={16} /> Contas</h2>
          </div>
          <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={buscar} disabled={carregando}>Atualizar</Btn>
        </div>

        <div className="grid g4" style={{ gap: 12, marginTop: 4 }}>
          <Stat size="sm" valor={resumo.total} label="contas" />
          <Stat size="sm" valor={resumo.naLiga} label="na liga" />
          <Stat size="sm" valor={resumo.assinantes} label="assinantes" tone={resumo.assinantes ? 'jade' : undefined} />
          <Stat size="sm" valor={resumo.compradores} label="compraram avulso" />
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Busca value={busca} onChange={setBusca} placeholder="Buscar por nome ou e-mail" />
      </Card>

      {carregando ? (
        <Card><p className="tiny muted">Buscando as contas.</p></Card>
      ) : !mostradas.length ? (
        <Card>
          <Empty icon={Search} titulo="Nada com essa busca" texto="Tente outro nome ou outro e-mail." />
        </Card>
      ) : (
        <div className="col" style={{ gap: 9 }}>
          {mostradas.map((c) => {
            const ass = ROTULO_ASSINATURA[c.assinatura];
            return (
              <Card key={c.user_id}>
                <div className="row wrap" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="tiny" style={{ fontWeight: 600 }}>{c.nome}</span>
                      <BeltTag faixa={c.faixa} graus={c.graus} />
                    </div>
                    <div className="micro muted" style={{ marginTop: 4 }}>{c.email}</div>
                  </div>

                  <div className="row wrap" style={{ gap: 6, justifyContent: 'flex-end' }}>
                    {ass && <Chip tone={ass.tom}>{ass.nome}</Chip>}
                    {!ass && <Chip>plano grátis</Chip>}
                    {Number(c.compras) > 0 && <Chip tone="accent">{c.compras} avulso(s)</Chip>}
                    {c.na_liga
                      ? <Chip tone="jade">divisão {nomeDivisao(c.divisao)}</Chip>
                      : <Chip>fora da liga</Chip>}
                  </div>
                </div>

                <div className="row wrap" style={{ gap: 14, marginTop: 10 }}>
                  <span className="micro muted">
                    {c.treinos_semana ? `treina ${c.treinos_semana}x por semana` : 'ritmo não declarado'}
                  </span>
                  <span className="micro muted num">{c.total_xp} pontos</span>
                  <span className="micro muted num">{c.xp_semana} nesta semana</span>
                  <span className="micro muted">
                    {c.ultimo_ponto ? `ativo ${relativo(c.ultimo_ponto)}` : 'nunca pontuou'}
                  </span>
                  <span className="micro muted">entrou {fmtData(String(c.criado_em).slice(0, 10))}</span>
                  {c.vence_em && (
                    <span className="micro muted">vence {fmtData(String(c.vence_em).slice(0, 10))}</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
