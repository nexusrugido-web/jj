import { supabase } from './supabase';
import { db, getMeta, setMeta } from '../db/db';
import { hoje, diasEntre } from './utils';
import { ligada } from './chaves';
import { ultimosDias, dentroDoPeriodo } from './periodo';

/* ============================================================
   PLANO

   O direito de acesso mora no servidor. Aqui o app só guarda
   a data de validade que o servidor mandou, pra continuar
   funcionando offline sem precisar de internet toda vez.

   Duas regras que não se quebram:
   1. Registrar o treino e os rolas é grátis e ilimitado, sempre,
      e o grau das técnicas também. O que tem dose no plano grátis
      é o estudo: uma aula, um short, uma rodada de quiz por dia.
      Aparecer no tatame e marcar que apareceu nunca custa.
   2. Assinatura vencida não bloqueia os seus dados. Você
      continua vendo e exportando tudo que registrou.
   ============================================================ */

export const LIMITES = {
  historicoDias: 30,
  metasAtivas: 2,

  /* Por dia, não por semana. Registrar treino e rola nunca tem
     limite: é o hábito que segura o aluno nos primeiros meses, quando
     mais gente desiste, e é o registro que faz as técnicas subirem.
     O limite fica no estudo: uma aula, um short e uma rodada de quiz
     por dia. */
  aulasPorDia: 1,
  shortsPorDia: 1,
  perguntasPorDia: 5,
};

/* Quantas recomendações o app monta pra mostrar na tela. Não é
   limite de plano, é tamanho de lista: quanto mais a pessoa
   registra, mais o app tem o que apontar. No grátis elas ficam na
   vitrine: é o premium que abre. */
export const RECOMENDACOES_NA_TELA = 10;

export const RECURSOS = {
  registro:      { premium: false, nome: 'Registrar treinos e rolas', desc: 'Todo treino e todo rola, sem limite, sempre grátis.' },
  graus:         { premium: false, nome: 'Grau de todas as técnicas', desc: 'Cada técnica que sai nos seus rolas ganha grau, e você vê quando ela sobe.' },
  estilo:        { premium: false, nome: 'Seu estilo de jogo', desc: 'O Meu jogo mostra o seu estilo, onde você ganha e onde você cede.' },
  liga:          { premium: false, nome: 'Liga e ofensiva', desc: 'O ranking da semana, a ofensiva e o card pra compartilhar.' },
  biblioteca:    { premium: false, nome: 'Biblioteca de técnicas', desc: 'As 626 técnicas, completa.' },
  offline:       { premium: false, nome: 'Funciona sem internet', desc: 'E sem conta, se você quiser.' },
  sync:          { premium: false, nome: 'Sincronizar aparelhos', desc: 'Celular, tablet e computador no mesmo lugar, e os seus dados guardados na conta.' },
  exportar:      { premium: false, nome: 'Exportar os seus dados', desc: 'Seus dados são seus, com ou sem assinatura.' },

  historico:     { premium: true, nome: 'Histórico completo', desc: `No grátis você vê os últimos ${LIMITES.historicoDias} dias.` },
  analise:       { premium: true, nome: 'Análise e gráficos', desc: 'Evolução, presença no tatame, contra quem você luta e onde fica por cima, aqui e no Painel.' },
  ia:            { premium: true, nome: 'Análise da IA', desc: 'O botão Análise IA do Painel lê o seu histórico e diz o que os seus números mostram.' },
  meujogo:       { premium: true, nome: 'Meu jogo por situação', desc: 'Como você vai contra mais pesado, mais leve e em cada posição em que o rola começa.' },
  aulasIlimitadas:{ premium: true, nome: 'Aulas sem limite', desc: `No grátis é ${LIMITES.aulasPorDia} aula completa e ${LIMITES.shortsPorDia} aula rápida por dia.` },
  quizIlimitado: { premium: true, nome: 'Quiz sem limite', desc: 'E ele volta nas perguntas que você errou. No grátis é uma rodada por dia, com perguntas sorteadas.' },
  recomendacoes: { premium: true, nome: 'O que treinar agora', desc: 'Escolhido pelos seus rolas, no Painel, em Minhas técnicas e no Estudo (Pra você).' },
  metas:         { premium: true, nome: 'Metas sem limite', desc: `No grátis você assume até ${LIMITES.metasAtivas} metas que o app sugere pra você. Criar as suas e ter mais ativas é do premium.` },
};

const CHAVE = 'acesso';

/* ---------- o que está guardado no aparelho ---------- */
export async function acessoLocal() {
  let a = null;
  try { a = await getMeta(CHAVE, null); } catch { /* banco fechado */ }
  if (!a) return { premium: false, status: 'sem_assinatura', motivo: 'Você está no plano gratuito.' };

  /* o app confia na data que o servidor mandou, e só até ela */
  const limite = a.carenciaAte || a.venceEm;
  if (a.premium && limite && new Date(limite) < new Date()) {
    return { ...a, premium: false, status: 'expirada', motivo: 'Sua assinatura venceu. Seus dados continuam aqui, inteiros.' };
  }
  return a;
}

/* ---------- pergunta pro servidor e guarda a resposta ---------- */
export async function sincronizarAcesso() {
  if (!supabase) return acessoLocal();
  try {
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao?.session) {
      const a = { premium: false, status: 'sem_conta', motivo: 'Entre com a sua conta pra liberar o premium.' };
      await setMeta(CHAVE, a);
      return a;
    }

    const { data, error } = await supabase.rpc('meu_acesso');
    if (error) throw error;

    const r = Array.isArray(data) ? data[0] : data;
    const a = {
      premium: !!r?.premium,
      status: r?.status || 'sem_assinatura',
      plano: r?.plano || null,
      venceEm: r?.vence_em || null,
      carenciaAte: r?.carencia_ate || null,
      motivo: r?.motivo || '',
      checadoEm: new Date().toISOString(),
    };
    await setMeta(CHAVE, a);
    return a;
  } catch (e) {
    console.error('[acesso]', e);
    /* sem internet, vale o que está guardado até a data vencer */
    return acessoLocal();
  }
}

export async function ativarCodigo(codigo) {
  if (!supabase) return { ok: false, mensagem: 'Precisa de internet pra ativar.' };
  const { data, error } = await supabase.rpc('ativar_codigo', { p_codigo: codigo });
  if (error) return { ok: false, mensagem: 'Não consegui ativar agora. Tente de novo.' };
  const r = Array.isArray(data) ? data[0] : data;
  if (r?.ok) await sincronizarAcesso();
  return { ok: !!r?.ok, mensagem: r?.mensagem || '' };
}

/* ---------- os limites do plano grátis ---------- */
export function podeVer(acesso, recurso) {
  /* com a cobrança desligada no painel, todo mundo usa tudo.
     Serve pra rodar o app aberto antes de começar a vender. */
  if (!ligada('cobranca')) return true;
  const r = RECURSOS[recurso];
  if (!r) return true;
  if (!r.premium) return true;
  return !!acesso?.premium;
}

/* corta o histórico, sem esconder que existe mais. Só vale com a
   cobrança ligada: desligada, todo mundo vê tudo. */
export function recortarHistorico(lista, acesso, campoData = 'data') {
  if (!ligada('cobranca') || acesso?.premium) return { itens: lista, cortados: 0 };
  const dentro = dentroDoPeriodo(lista, ultimosDias(LIMITES.historicoDias), campoData);
  return { itens: dentro, cortados: lista.length - dentro.length };
}

/* ============================================================
   O LIMITE DO DIA

   Uma função só pros quatro limites, porque a pergunta é sempre
   a mesma: quantos disto você já fez hoje, e quantos você pode.

   Conta o que está no aparelho, e não o ponto que o servidor
   concedeu.
   ============================================================ */
const TETO_DO_DIA = {
  aula:  LIMITES.aulasPorDia,
  short: LIMITES.shortsPorDia,
  quiz:  LIMITES.perguntasPorDia,
};

export async function usadoHoje(tipo) {
  const d = hoje();
  try {
    if (tipo === 'aula' || tipo === 'short') {
      /* conta vídeo ABERTO hoje. Antes contava só o que foi marcado
         como visto, e quem não apertava o botão assistia sem limite. */
      const { abertosHoje } = await import('./aulas');
      return (await abertosHoje(tipo)).size;
    }
    if (tipo === 'quiz') {
      const p = await db.pontos.where('data').equals(d).toArray();
      return p.filter((x) => x.evento === 'quizAcerto' || x.evento === 'quizErro').length;
    }
  } catch { /* banco fechado, não trava a tela */ }
  return 0;
}

export async function limiteDoDia(acesso, tipo) {
  const teto = TETO_DO_DIA[tipo];
  if (!teto) return { pode: true, usados: 0, teto: null, restantes: null };

  /* com a cobrança desligada no painel, ninguém esbarra em nada */
  if (!ligada('cobranca') || acesso?.premium) {
    return { pode: true, usados: 0, teto: null, restantes: null };
  }

  const usados = await usadoHoje(tipo);
  return {
    pode: usados < teto,
    usados,
    teto,
    restantes: Math.max(0, teto - usados),
  };
}


export function diasParaVencer(acesso) {
  if (!acesso?.venceEm) return null;
  return diasEntre(hoje(), String(acesso.venceEm).slice(0, 10));
}
