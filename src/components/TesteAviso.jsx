import React, { useState } from 'react';
import { Bell, Stethoscope, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, Btn, Field, Input, useToast } from './UI';

/* ============================================================
   TESTAR AVISOS (só admin)

   Manda um aviso de verdade, pelo mesmo caminho dos avisos que o
   aluno recebe (banco → Edge Function notificar → serviço de push →
   celular), sem esperar a hora nem as regras. E o diagnóstico diz
   qual elo arrebentou quando não chega. As duas funções do banco
   (testar_aviso, diagnostico_de_aviso) só respondem pro admin.
   ============================================================ */
export default function TesteAviso({ email }) {
  const toast = useToast();
  const [alvo, setAlvo] = useState(email || '');
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState('');
  const [diag, setDiag] = useState(null);

  async function testar() {
    setEnviando(true); setResposta('');
    const { data, error } = await supabase.rpc('testar_aviso', { p_email: alvo.trim() });
    setEnviando(false);
    if (error) { toast(String(error.message).includes('administrador') ? 'Esta conta não é admin no servidor.' : 'Não consegui mandar.', 'err'); return; }
    setResposta(data);
  }

  async function diagnosticar() {
    const { data, error } = await supabase.rpc('diagnostico_de_aviso', { p_email: alvo.trim() });
    if (error) { toast('Não consegui ler o diagnóstico.', 'err'); return; }
    setDiag(data || []);
  }

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h2 className="h-sec row" style={{ gap: 8 }}><Bell size={17} /> Testar avisos</h2>
      </div>
      <p className="tiny muted" style={{ lineHeight: 1.65, marginBottom: 12 }}>
        Toque em mandar e minimize o app na hora: o aviso chega em poucos segundos na barra de notificações,
        do mesmo jeito que chega pro aluno. O celular precisa estar com os avisos ligados (Ajustes → Avisos).
      </p>
      <Field label="Pra qual conta">
        <Input value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder="email@da.conta" />
      </Field>
      <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
        <Btn variant="primary" icon={enviando ? Loader : Bell} disabled={enviando || !alvo.trim()} onClick={testar}>
          {enviando ? 'Mandando' : 'Mandar aviso de teste'}
        </Btn>
        <Btn variant="contorno" icon={Stethoscope} disabled={!alvo.trim()} onClick={diagnosticar}>Ver o diagnóstico</Btn>
      </div>
      {resposta && <p className="micro" style={{ marginTop: 10, lineHeight: 1.6 }}>{resposta}</p>}
      {diag && (
        <div className="col" style={{ gap: 6, marginTop: 12 }}>
          {diag.map((d) => (
            <div key={d.elo} className="row" style={{ gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: 'var(--void)', borderRadius: 9 }}>
              <span className="micro" style={{ fontWeight: 700, minWidth: 34, color: d.situacao === 'NAO' ? 'var(--blood)' : d.situacao === 'ok' ? 'var(--jade)' : 'var(--dim)' }}>
                {d.situacao}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="micro" style={{ fontWeight: 600 }}>{d.elo}</div>
                <div className="micro muted" style={{ overflowWrap: 'anywhere' }}>{d.detalhe}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
