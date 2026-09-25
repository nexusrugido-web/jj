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

/* Todo aviso que o aluno pode receber. O texto de cada um mora no
   public/sw.js; aqui só diz qual mandar. */
const AVISOS = [
  { id: 'teste', tipo: 'teste', nome: 'Teste geral', quando: 'Só pra ver se a corrente inteira funciona.' },
  { id: 'ofensiva1', tipo: 'ofensiva', dias: 1, nome: 'Ofensiva no primeiro dia', quando: 'Na hora de costume, quando o dia ainda não fechou e a ofensiva é de 1 dia.' },
  { id: 'ofensiva', tipo: 'ofensiva', dias: 12, nome: 'Ofensiva de vários dias', quando: 'Na hora de costume, quando o dia ainda não fechou (o teste usa 12 dias).' },
  { id: 'liga', tipo: 'liga', nome: 'A liga fecha hoje', quando: 'Domingo às 10h, pra quem está num grupo da liga.' },
  { id: 'resultado', tipo: 'resultado', nome: 'Resultado da liga', quando: 'Segunda às 14h, depois que a semana fecha.' },
  { id: 'volta', tipo: 'volta', nome: 'Volta pro tatame', quando: 'Depois de 7 dias sem nada, no máximo uma vez por mês.' },
];

export default function TesteAviso({ email }) {
  const toast = useToast();
  const [alvo, setAlvo] = useState(email || '');
  const [enviando, setEnviando] = useState('');
  const [resposta, setResposta] = useState('');
  const [vezes, setVezes] = useState({});
  const [diag, setDiag] = useState(null);

  async function testar(a) {
    setEnviando(a.id); setResposta('');
    /* cada toque manda a próxima versão do texto, pra ver todas */
    const versao = vezes[a.id] || 0;
    const { data, error } = await supabase.rpc('testar_aviso', {
      p_email: alvo.trim(), p_tipo: a.tipo, p_dias: a.dias || 1, p_versao: versao,
    });
    setEnviando('');
    if (error) {
      /* é tela de admin: diz o motivo de verdade, que é o que resolve */
      const msg = String(error.message || '');
      toast(msg.includes('administrador') ? 'Esta conta não é admin no servidor.'
        : error.code === 'PGRST202' ? 'O banco ainda não tem o teste de cada aviso: rode o SQL 17b.'
          : `Não consegui mandar: ${msg}`, 'err');
      return;
    }
    setVezes((v) => ({ ...v, [a.id]: versao + 1 }));
    setResposta(`${a.nome}: ${data}`);
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
        do mesmo jeito que chega pro aluno. Tocar de novo no mesmo aviso manda a próxima versão do texto.
        O celular precisa estar com os avisos ligados (Ajustes → Avisos).
      </p>
      <Field label="Pra qual conta">
        <Input value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder="email@da.conta" />
      </Field>
      <div className="col" style={{ gap: 6, marginTop: 12 }}>
        {AVISOS.map((a) => (
          <div key={a.id} className="row" style={{ gap: 10, alignItems: 'center', padding: '10px 12px', background: 'var(--void)', borderRadius: 9 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tiny" style={{ fontWeight: 600 }}>{a.nome}</div>
              <div className="micro muted" style={{ lineHeight: 1.5 }}>{a.quando}</div>
            </div>
            <Btn size="sm" variant={a.id === 'teste' ? 'primary' : 'contorno'} icon={enviando === a.id ? Loader : Bell}
              disabled={!!enviando || !alvo.trim()} onClick={() => testar(a)}>
              {enviando === a.id ? 'Mandando' : vezes[a.id] ? 'De novo' : 'Mandar'}
            </Btn>
          </div>
        ))}
      </div>
      {resposta && <p className="micro" style={{ marginTop: 10, lineHeight: 1.6 }}>{resposta}</p>}
      <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
        <Btn variant="contorno" icon={Stethoscope} disabled={!alvo.trim()} onClick={diagnosticar}>Ver o diagnóstico</Btn>
      </div>
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
