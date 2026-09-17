import React, { useState, useEffect } from 'react';
import { Sliders, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, Btn, Stepper, useToast } from './UI';
import { carregarAjustes } from '../lib/ajustes';

/* ============================================================
   OS NÚMEROS QUE VOCÊ MEXE SEM DEPLOY

   A tabela de chaves diz o que está ligado. Esta tela mexe no
   de quanto: tamanho do grupo da liga, quantos sobem e descem,
   quantas recomendações aparecem, teto de estudo da semana.

   O mínimo e o máximo vêm do banco junto com o valor, porque
   um número fora da faixa quebra a liga em silêncio.
   ============================================================ */

export default function Numeros() {
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [salvando, setSalvando] = useState(null);

  async function buscar() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('ajuste').select('*').not('valor', 'is', null).order('grupo').order('nome');
      if (error) throw error;
      setLista(data || []);
    } catch (e) {
      console.error('[numeros]', e);
    }
  }

  useEffect(() => { buscar(); }, []);

  async function salvar(a, valor) {
    setSalvando(a.id);
    try {
      const { data, error } = await supabase
        .from('ajuste')
        .update({ valor, atualizado: new Date().toISOString() })
        .eq('id', a.id)
        .select('id, valor');

      if (error) throw error;
      if (!data?.length) throw new Error('sem permissão');

      setLista((l) => l.map((x) => (x.id === a.id ? { ...x, valor } : x)));
      await carregarAjustes();
      toast(`${a.nome}: ${valor}`);
    } catch (e) {
      toast(
        String(e?.message).includes('permissão')
          ? 'Esta conta não tem permissão de administrador no servidor'
          : 'Não consegui salvar',
        'err'
      );
      buscar();
    } finally {
      setSalvando(null);
    }
  }

  if (!lista.length) return null;

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">muda na hora, sem deploy</div>
          <h2 className="h-sec row" style={{ gap: 8 }}><Sliders size={16} /> Números</h2>
        </div>
      </div>

      <div className="col" style={{ gap: 12 }}>
        {lista.map((a) => (
          <div key={a.id} className="row wrap" style={{ gap: 10, alignItems: 'flex-start', paddingTop: 10, borderTop: '1px solid var(--seam)' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="tiny" style={{ fontWeight: 600 }}>{a.nome}</div>
              {a.descricao && (
                <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{a.descricao}</p>
              )}
            </div>
            <Stepper
              value={a.valor}
              min={a.minimo}
              max={a.maximo}
              onChange={(v) => salvar(a, v)}
            />
          </div>
        ))}
      </div>

      <p className="micro muted" style={{ marginTop: 14, lineHeight: 1.6 }}>
        O app pega estes números na próxima vez que abrir. Quem já está com a tela aberta continua com os
        antigos até fechar.
      </p>
    </Card>
  );
}
