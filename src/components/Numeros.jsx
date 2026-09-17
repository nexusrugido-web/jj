import React, { useState, useEffect } from 'react';
import { Sliders } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, Stepper, useToast } from './UI';
import { carregarAjustes } from '../lib/ajustes';

/* ============================================================
   OS AJUSTES QUE VOCÊ MEXE SEM DEPLOY

   A tabela de chaves diz o que está ligado. Esta tela mexe no
   resto: de quanto, e pra onde.

   Número vira botão de mais e menos, com o mínimo e o máximo
   vindo do banco, porque valor fora da faixa quebra a liga em
   silêncio. Texto vira campo com botão de salvar, porque link
   você cola e confere antes.

   O corte da jornada fica fora desta lista. Ele é uma data que
   o sistema escreveu uma vez, e mudar ela na mão mudaria o total
   de todo mundo sem ninguém entender por quê.
   ============================================================ */

const ESCONDIDOS = ['zerado_em'];

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
      const itens = (data || []).filter((a) => !ESCONDIDOS.includes(a.id));
      setLista(itens);
    } catch (e) {
      console.error('[ajustes]', e);
    }
  }

  useEffect(() => { buscar(); }, []);

  async function salvar(a, campos) {
    setSalvando(a.id);
    try {
      const { data, error } = await supabase
        .from('ajuste')
        .update({ ...campos, atualizado: new Date().toISOString() })
        .eq('id', a.id)
        .select('id, valor, texto');

      if (error) throw error;
      if (!data?.length) throw new Error('sem permissão');

      setLista((l) => l.map((x) => (x.id === a.id ? { ...x, ...data[0] } : x)));
      await carregarAjustes();
      toast(`${a.nome} salvo`);
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

  const numeros = lista;

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">muda na hora, sem deploy</div>
          <h2 className="h-sec row" style={{ gap: 8 }}><Sliders size={16} /> Ajustes</h2>
        </div>
      </div>

      {/* ---------- os números ---------- */}
      <div className="col" style={{ gap: 12 }}>
        {numeros.map((a) => (
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
              onChange={(v) => salvar(a, { valor: v })}
            />
          </div>
        ))}
      </div>

      <p className="micro muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
        O app pega isto na próxima vez que abrir. Quem já está com a tela aberta continua com o de antes até
        fechar.
      </p>
    </Card>
  );
}
