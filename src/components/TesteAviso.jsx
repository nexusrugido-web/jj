import React, { useState } from 'react';
import { Bell, Stethoscope, Loader, Target, Check } from 'lucide-react';
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
  { id: 'ofensiva', tipo: 'ofensiva_semanal', nome: 'Ofensiva semanal', quando: 'Domingo, na hora de costume (antes das 21h), se a semana ainda não tem treino e não está pausada por lesão.' },
  { id: 'reta', tipo: 'ofensiva_reta_final', nome: 'Reta final da ofensiva', quando: 'Domingo às 21h de Brasília, 3h antes da semana fechar, com o relógio de quanto falta.' },
  { id: 'liga', tipo: 'liga', nome: 'A liga fecha hoje', quando: 'Domingo às 10h, pra quem está num grupo da liga e já treinou na semana.' },
  { id: 'ligafinal', tipo: 'liga_reta_final', nome: 'Reta final da liga', quando: 'Domingo das 21h à meia-noite, só pra quem está na zona de rebaixamento, com o relógio.' },
  { id: 'pos', tipo: 'pos_treino', nome: 'Treinou hoje?', quando: 'Nos dias em que a pessoa costuma treinar, 1h depois da hora de registrar, se o treino não entrou.' },
  { id: 'amigo', tipo: 'amigo:teste', nome: 'Amigo te passou na liga', quando: 'Na hora em que um amigo passa você nos pontos da semana. Uma vez por amigo por semana.' },
  { id: 'grau', tipo: 'grau:teste', nome: 'Técnica perto do grau', quando: 'Meio-dia de um dia de treino, faltando até 2 usos pro próximo grau. Uma vez por semana.' },
  { id: 'camp', tipo: 'campeonato', nome: 'Campeonato chegando', quando: 'Faltando 7, 3, 2 e 1 dia pro campeonato da meta, na hora de costume.' },
  { id: 'resumo', tipo: 'resumo', nome: 'Resumo da semana', quando: 'Segunda às 14h: treinos e rolas da semana, a liga e as técnicas que subiram.' },
  { id: 'volta', tipo: 'volta', nome: 'Volta pro tatame', quando: 'Depois de 7 dias sem nada, no máximo uma vez por mês.' },
  { id: 'dia', tipo: 'dia:0', nome: 'Aviso do dia', quando: 'Todo dia às 21h, se nenhum outro aviso saiu. Um tema por dia da semana: aula rápida, seu jogo, meta, técnica, liga.' },
];

/* o e-mail confirmado fica neste navegador, pra não digitar de novo */
const CHAVE_ALVO = 'teste-aviso-alvo';
const lerAlvo = () => { try { return localStorage.getItem(CHAVE_ALVO) || ''; } catch { return ''; } };

export default function TesteAviso({ email }) {
  const toast = useToast();
  const [alvo, setAlvo] = useState(() => lerAlvo() || email || '');
  /* os botões só mandam pra conta confirmada: o servidor diz se ela
     existe e quantos aparelhos têm os avisos ligados */
  const [confirmado, setConfirmado] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState('');
  const [resposta, setResposta] = useState('');
  const [vezes, setVezes] = useState({});
  const [diag, setDiag] = useState(null);
  const [inspecao, setInspecao] = useState(null);
  const [carregandoMetas, setCarregandoMetas] = useState(false);
  const [testeMeta, setTesteMeta] = useState('');
  const [estadoMeta, setEstadoMeta] = useState({});

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

  async function confirmar() {
    setConfirmando(true);
    const { data, error } = await supabase.rpc('diagnostico_de_aviso', { p_email: alvo.trim() });
    setConfirmando(false);
    if (error) { toast(String(error.message || '').includes('administrador') ? 'Esta conta não é admin no servidor.' : 'Não consegui conferir a conta.', 'err'); return; }
    const linha = (n) => (data || []).find((x) => x.elo.startsWith(n));
    if (linha('1.')?.situacao !== 'ok') { setConfirmado(null); toast('Nenhuma conta com esse e-mail.', 'err'); return; }
    const aparelhos = linha('2.')?.situacao === 'ok' ? Number(String(linha('2.').detalhe).match(/^\d+/)?.[0]) || 1 : 0;
    setConfirmado({ email: alvo.trim().toLowerCase(), aparelhos });
    try { localStorage.setItem(CHAVE_ALVO, alvo.trim()); } catch { /* sem armazenamento, só não lembra */ }
    toast(aparelhos ? 'E-mail confirmado e salvo' : 'Conta confirmada, mas sem aparelho com avisos ligados', aparelhos ? undefined : 'err');
  }
  const pronto = !!confirmado && confirmado.email === alvo.trim().toLowerCase();

  async function diagnosticar() {
    const { data, error } = await supabase.rpc('diagnostico_de_aviso', { p_email: alvo.trim() });
    if (error) { toast('Não consegui ler o diagnóstico.', 'err'); return; }
    setDiag(data || []);
  }

  async function verMetas() {
    setCarregandoMetas(true);
    const { data, error } = await supabase.rpc('inspecionar_avisos_metas', { p_email: alvo.trim() });
    setCarregandoMetas(false);
    if (error) {
      toast(error.code === 'PGRST202' ? 'Aplique o SQL 33 no Supabase para ver avisos por meta.'
        : `Não consegui consultar as metas: ${error.message}`, 'err');
      return;
    }
    if (data?.erro) { toast(data.erro, 'err'); setInspecao(null); return; }
    setInspecao(data);
    setEstadoMeta({});
  }

  async function enviarMeta(meta) {
    setTesteMeta(meta.id);
    setEstadoMeta((atual) => ({ ...atual, [meta.id]: { estado: 'solicitando' } }));
    const { data, error } = await supabase.rpc('testar_aviso_meta', {
      p_email: alvo.trim(), p_meta: meta.id,
    });
    if (error) {
      setTesteMeta('');
      setEstadoMeta((atual) => ({ ...atual, [meta.id]: { estado: 'erro', erro: error.message } }));
      return;
    }
    setEstadoMeta((atual) => ({ ...atual, [meta.id]: data }));
    // pg_net responde depois que a transação termina. Mostrar o resultado
    // real da Edge Function, sem confundir "solicitado" com "entregue".
    let respondeu = false;
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status = await supabase.rpc('estado_teste_aviso_meta', { p_request_id: data.request_id });
      if (status.error) {
        setEstadoMeta((atual) => ({ ...atual, [meta.id]: { estado: 'erro', erro: status.error.message } }));
        respondeu = true;
        break;
      }
      if (status.data?.estado !== 'aguardando') {
        setEstadoMeta((atual) => ({ ...atual, [meta.id]: status.data }));
        respondeu = true;
        break;
      }
    }
    if (!respondeu) setEstadoMeta((atual) => ({ ...atual, [meta.id]: { estado: 'demora' } }));
    setTesteMeta('');
  }

  function textoEstadoMeta(estado) {
    if (!estado) return '';
    if (estado.estado === 'erro') return `Falhou: ${estado.erro || `HTTP ${estado.status_http}`}`;
    if (estado.estado === 'demora') return 'A função ainda não respondeu. Confira os logs da Edge Function notificar.';
    if (estado.estado === 'respondido') return estado.enviados > 0
      ? `Serviço de push aceitou ${estado.enviados} envio(s). Confira o aparelho.`
      : 'A função respondeu, mas não aceitou nenhum envio. Confira o aparelho e os logs.';
    return 'Pedido enviado; aguardando resposta da função…';
  }

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h2 className="h-sec row" style={{ gap: 8 }}><Bell size={17} /> Testar avisos</h2>
      </div>
      <p className="tiny muted" style={{ lineHeight: 1.65, marginBottom: 12 }}>
        Toque em mandar e minimize o app na hora: o aviso chega em poucos segundos na barra de notificações.
        Este teste ignora horário, interruptor do perfil e regras de elegibilidade; receber aqui não comprova
        que o envio automático está funcionando. Tocar de novo no mesmo aviso manda a próxima versão do texto.
        O celular precisa estar com os avisos ligados (Ajustes → Avisos).
      </p>
      <Field label="Pra qual conta">
        <div className="row" style={{ gap: 8 }}>
          <Input value={alvo} onChange={(e) => { setAlvo(e.target.value); setInspecao(null); setDiag(null); }} placeholder="email@da.conta" style={{ flex: 1 }} />
          <Btn variant={pronto ? 'contorno' : 'primary'} icon={confirmando ? Loader : Check}
            disabled={!alvo.trim() || confirmando} onClick={confirmar}>
            {pronto ? 'Confirmado' : 'Confirmar'}
          </Btn>
        </div>
      </Field>
      {pronto ? (
        <p className="micro" style={{ marginTop: 6, color: confirmado.aparelhos ? 'var(--jade)' : 'var(--roar)' }}>
          ✓ Os testes vão pra {confirmado.email} · {confirmado.aparelhos
            ? `${confirmado.aparelhos} ${confirmado.aparelhos === 1 ? 'aparelho' : 'aparelhos'} com avisos ligados`
            : 'nenhum aparelho com avisos ligados (Ajustes → Avisos no celular)'}
        </p>
      ) : (
        <p className="micro muted" style={{ marginTop: 6 }}>Confirme o e-mail pra liberar os testes.</p>
      )}
      <div className="col" style={{ gap: 6, marginTop: 12 }}>
        {AVISOS.map((a) => (
          <div key={a.id} className="row" style={{ gap: 10, alignItems: 'center', padding: '10px 12px', background: 'var(--void)', borderRadius: 9 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tiny" style={{ fontWeight: 600 }}>{a.nome}</div>
              <div className="micro muted" style={{ lineHeight: 1.5 }}>{a.quando}</div>
            </div>
            <Btn size="sm" variant={a.id === 'teste' ? 'primary' : 'contorno'} icon={enviando === a.id ? Loader : Bell}
              disabled={!!enviando || !pronto} onClick={() => testar(a)}>
              {enviando === a.id ? 'Mandando' : vezes[a.id] ? 'De novo' : 'Mandar'}
            </Btn>
          </div>
        ))}
      </div>
      {resposta && <p className="micro" style={{ marginTop: 10, lineHeight: 1.6 }}>{resposta}</p>}
      <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
        <Btn variant="contorno" icon={Stethoscope} disabled={!alvo.trim()} onClick={diagnosticar}>Ver o diagnóstico</Btn>
        <Btn variant="contorno" icon={Target} disabled={!alvo.trim() || carregandoMetas} onClick={verMetas}>
          {carregandoMetas ? 'Consultando metas' : 'Ver avisos de cada meta'}
        </Btn>
      </div>
      {inspecao && (
        <div style={{ marginTop: 16 }}>
          <div className="tiny" style={{ fontWeight: 700 }}>Metas de {inspecao.email}</div>
          <p className="micro muted" style={{ margin: '6px 0 10px', lineHeight: 1.6 }}>
            {inspecao.aparelhos_elegiveis} de {inspecao.aparelhos} aparelho(s) apto(s) · avisos {inspecao.notificar ? 'ligados' : 'desligados'} · horário de costume {inspecao.hora_local}h ({inspecao.fuso}).
            Cada prévia usa o mesmo gerador da fila real com os dados de agora; o progresso pode mudar até o envio. O teste ignora horário e limites e não conta como envio automático.
            Na rotina, sai no máximo uma meta por vez e duas por semana, com rodízio entre as metas elegíveis.
          </p>
          {!inspecao.metas?.length && <p className="micro muted">Nenhuma meta ativa e sincronizada nesta conta.</p>}
          <div className="col" style={{ gap: 8 }}>
            {inspecao.metas?.map((m) => (
              <div key={m.id} style={{ padding: '12px', background: 'var(--void)', borderRadius: 9 }}>
                <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tiny" style={{ fontWeight: 700 }}>{m.titulo}</div>
                    <div className="micro muted">{m.tipo}</div>
                  </div>
                  <Btn size="sm" variant="contorno" icon={testeMeta === m.id ? Loader : Bell}
                    disabled={!!testeMeta || !m.aviso || inspecao.aparelhos === 0}
                    onClick={() => enviarMeta(m)}>
                    {testeMeta === m.id ? 'Enviando' : 'Testar esta meta'}
                  </Btn>
                </div>
                {m.aviso ? (
                  <div className="micro" style={{ marginTop: 8, lineHeight: 1.6 }}>
                    <strong>{m.aviso.titulo}</strong><br />{m.aviso.corpo}
                  </div>
                ) : <div className="micro muted" style={{ marginTop: 8 }}>Esta meta não gera aviso com os dados atuais.</div>}
                <div className="micro muted" style={{ marginTop: 6 }}>
                  {m.ultimo_envio ? `Último envio automático: ${new Date(m.ultimo_envio).toLocaleString('pt-BR', { timeZone: inspecao.fuso })}${m.ultimo_respondeu ? ' · aberto' : ''}` : 'Nenhum envio automático registrado para esta meta.'}
                </div>
                {estadoMeta[m.id] && <div className="micro" style={{ marginTop: 6 }}>{textoEstadoMeta(estadoMeta[m.id])}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
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
