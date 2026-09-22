import React, { useState, useEffect } from 'react';
import { Flame, RefreshCw, Medal } from 'lucide-react';
import { useApp } from '../contexto';
import { supabase } from '../lib/supabase';
import { Card, Btn, BeltTag } from './UI';

/* ============================================================
   AS MAIORES OFENSIVAS

   Dias seguidos aparecendo, de todo mundo que está na liga. O
   ranking do servidor (supabase/ofensiva.sql) devolve os vinte
   primeiros, e a sua linha no fim quando você não couber neles.

   Com pouca gente no app isso não é vergonha, é o contrário:
   ver que dá pra estar entre os cinco primeiros é o que faz
   alguém abrir amanhã.

   Aparece só quem escolheu participar da liga, com o mesmo nome
   curto que já aparece lá. Nada do que a pessoa registra sai
   daqui.
   ============================================================ */

export default function RankingOfensivas() {
  const { sessao, ligada } = useApp();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const ativa = ligada?.('liga');

  async function buscar() {
    if (!supabase || !sessao) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const { data, error } = await supabase.rpc('ranking_ofensivas');
      if (error) throw error;
      setLinhas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[ranking]', e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { if (ativa) buscar(); else setCarregando(false); }, [ativa, sessao]);

  if (!ativa || carregando || !linhas.length) return null;

  const eu = linhas.find((l) => l.sou_eu);

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">dias seguidos aparecendo</div>
          <h2 className="h-sec row" style={{ gap: 8 }}><Flame size={16} /> As maiores ofensivas</h2>
        </div>
        <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={buscar}>Atualizar</Btn>
      </div>

      <div className="col" style={{ gap: 5 }}>
        {linhas.map((l) => (
          <React.Fragment key={`${l.posicao}-${l.nome}-${l.de_fora}`}>
            {l.de_fora && <div className="rank-corte">sua posição</div>}
            <div className={`rank-linha${l.sou_eu ? ' eu' : ''}${l.posicao <= 3 && !l.de_fora ? ' podio' : ''}`}>
              <span className="rank-pos num">
                {l.posicao <= 3 && !l.de_fora ? <Medal size={14} /> : l.posicao}
              </span>
              <span className="rank-nome tiny">{l.nome}{l.sou_eu ? ' (você)' : ''}</span>
              <BeltTag faixa={l.faixa} graus={l.graus || 0} />
              <span className="rank-dias num row">
                <Flame size={12} /> {l.dias}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>

      <p className="micro muted" style={{ marginTop: 12, lineHeight: 1.65 }}>
        {eu && !eu.de_fora && eu.posicao === 1
          ? 'Ninguém no app apareceu mais dias seguidos que você.'
          : eu
            ? `Você é o ${eu.posicao}º. Quem está na sua frente só fez uma coisa a mais: apareceu ontem.`
            : 'A sua ofensiva entra aqui no primeiro dia fechado.'}
        {' '}A faixa ao lado é a de verdade, a do tatame.
      </p>
    </Card>
  );
}
