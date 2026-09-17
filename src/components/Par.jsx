import React, { useState, useEffect } from 'react';
import { Swords, RefreshCw } from 'lucide-react';
import { useApp } from '../contexto';
import { supabase } from '../lib/supabase';
import { Card, Btn, Chip, Bar } from './UI';

/* ============================================================
   VOCÊ CONTRA O SEU PAR

   Toda semana o app junta você com alguém que treina quantas
   vezes você treina. Não é o mais forte nem o mais fraco: é o
   de ritmo parecido, porque comparar quem treina 5x com quem
   treina 2x só diz o óbvio.

   O que aparece é o mesmo que já aparece na liga, o nome que a
   pessoa escolheu mostrar e os pontos da semana. Nada do que
   ela registra vaza.
   ============================================================ */

export default function Par({ compacto = false }) {
  const { sessao, ligada } = useApp();
  const [par, setPar] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const ativa = ligada?.('liga');

  async function buscar() {
    if (!supabase || !sessao) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const { data, error } = await supabase.rpc('meu_par');
      if (error) throw error;
      setPar(Array.isArray(data) ? data[0] || null : data);
    } catch (e) {
      console.error('[par]', e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { if (ativa) buscar(); else setCarregando(false); }, [ativa, sessao]);

  if (!ativa || carregando || !par) return null;

  const meus = par.meus_pontos || 0;
  const dele = par.rival_pontos || 0;
  const maior = Math.max(meus, dele, 1);
  const dif = meus - dele;

  const recado = dif > 0
    ? `Você está ${dif} na frente.`
    : dif < 0
      ? `Faltam ${-dif} pra passar.`
      : meus === 0
        ? 'Ninguém pontuou ainda esta semana.'
        : 'Empatados até agora.';

  return (
    <Card style={{ marginBottom: compacto ? 0 : 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">alguém que treina o que você treina</div>
          <h2 className="h-sec row" style={{ gap: 8 }}><Swords size={16} /> Você e {par.rival_nome}</h2>
        </div>
        <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={buscar}>Atualizar</Btn>
      </div>

      <div className="col" style={{ gap: 10 }}>
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 5 }}>
            <span className="tiny" style={{ flex: 1, fontWeight: 600 }}>Você</span>
            <span className="num tiny" style={{ color: 'var(--accent)' }}>{meus}</span>
          </div>
          <Bar v={meus} max={maior} tone={dif >= 0 ? 'jade' : ''} />
        </div>

        <div>
          <div className="row" style={{ gap: 8, marginBottom: 5 }}>
            <span className="tiny" style={{ flex: 1 }}>{par.rival_nome}</span>
            <span className="num tiny muted">{dele}</span>
          </div>
          <Bar v={dele} max={maior} />
        </div>
      </div>

      <p className="micro muted" style={{ marginTop: 12, lineHeight: 1.65 }}>
        {recado}
        {par.rival_ritmo
          ? ` Vocês dois treinam ${par.rival_ritmo === par.meu_ritmo
              ? `${par.rival_ritmo}x por semana`
              : `quase o mesmo tanto por semana`}.`
          : ''}
        {' '}Zera junto com a liga, na segunda.
      </p>
    </Card>
  );
}
