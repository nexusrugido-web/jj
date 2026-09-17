import { supabase } from './supabase';
import { db, getMeta, setMeta } from '../db/db';
import { hoje, addDias, diasEntre } from './utils';
import { ligada } from './chaves';

/* ============================================================
   PLANO

   O direito de acesso mora no servidor. Aqui o app só guarda
   a data de validade que o servidor mandou, pra continuar
   funcionando offline sem precisar de internet toda vez.

   Duas regras que não se quebram:
   1. Registrar o treino é grátis e ilimitado, sempre. O que tem
      dose no plano grátis é o detalhe: um rola por dia, uma
      aula, um short, uma rodada de quiz. Aparecer no tatame e
      marcar que apareceu nunca custa.
   2. Assinatura vencida não bloqueia os seus dados. Você
      continua vendo e exportando tudo que registrou.
   ============================================================ */

export const LIMITES = {
  historicoDias: 30,
  tecnicasAcompanhadas: 10,
  planosAtaque: 1,
  metasAtivas: 2,

  /* Por dia, não por semana. No grátis o app funciona inteiro,
     só que na dose de quem está conhecendo: dá pra registrar
     um rola por dia, ver uma aula, ver um short e responder
     uma rodada de quiz. Quem treina todo dia sente o limite,
     e é esse o ponto. */
  rolasPorDia: 1,
  aulasPorDia: 1,
  shortsPorDia: 1,
  perguntasPorDia: 5,
  recomendacoesAbertas: 1,
};

/* Quantas recomendações o app monta pra mostrar na tela. Não é
   limite de plano, é tamanho de lista: quanto mais a pessoa
   registra, mais o app tem o que apontar. Quem está no grátis vê
   quantas existem e abre uma. */
export const RECOMENDACOES_NA_TELA = 10;

export const RECURSOS = {
  registro:      { premium: false, nome: 'Registrar treino', desc: 'Todo treino que você fizer, sempre grátis.' },
  biblioteca:    { premium: false, nome: 'Biblioteca de técnicas', desc: 'As 626 técnicas, completa.' },
  offline:       { premium: false, nome: 'Funciona sem internet', desc: 'E sem conta, se você quiser.' },
  exportar:      { premium: false, nome: 'Exportar os seus dados', desc: 'Seus dados são seus, com ou sem assinatura.' },

  historico:     { premium: true, nome: 'Histórico completo', desc: `No grátis você vê os últimos ${LIMITES.historicoDias} dias.` },
  analise:       { premium: true, nome: 'Análise e gráficos', desc: 'Evolução, escada posicional, taxa por faixa.' },
  meujogo:       { premium: true, nome: 'Estilo detectado', desc: 'O que os seus números dizem sobre o seu jogo.' },
  ia:            { premium: true, nome: 'Leitura da IA', desc: 'Insights e sugestões em cima do seu histórico.' },
  sync:          { premium: true, nome: 'Sincronizar aparelhos', desc: 'Celular, tablet e computador no mesmo lugar.' },
  registroIlimitado:{ premium: true, nome: 'Rolas sem limite', desc: `No grátis é ${LIMITES.rolasPorDia} rola por dia.` },
  aulasIlimitadas:{ premium: true, nome: 'Aulas sem limite', desc: `No grátis é ${LIMITES.aulasPorDia} aula e ${LIMITES.shortsPorDia} short por dia.` },
  quizIlimitado: { premium: true, nome: 'Quiz sem limite', desc: `No grátis é uma rodada por dia.` },
  tecnicas:      { premium: true, nome: 'Técnicas sem limite', desc: `No grátis o app acompanha ${LIMITES.tecnicasAcompanhadas}.` },
  planos:        { premium: true, nome: 'Planos de ataque', desc: `No grátis é ${LIMITES.planosAtaque}.` },
  liga:          { premium: true, nome: 'Liga entre praticantes', desc: 'Ranking semanal com gente do seu nível.' },
  musculacao:    { premium: true, nome: 'Musculação com histórico', desc: 'Recordes e progressão de carga.' },
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

/* corta o histórico, sem esconder que existe mais */
export function recortarHistorico(lista, acesso, campoData = 'data') {
  if (!ligada('cobranca') || acesso?.premium) return { itens: lista, cortados: 0 };
  const limite = addDias(hoje(), -LIMITES.historicoDias);
  const dentro = lista.filter((x) => (x[campoData] || '') >= limite);
  return { itens: dentro, cortados: lista.length - dentro.length };
}

export function limitarLista(lista, acesso, limite) {
  if (!ligada('cobranca') || acesso?.premium) return { itens: lista, cortados: 0 };
  return { itens: lista.slice(0, limite), cortados: Math.max(0, lista.length - limite) };
}

/* ============================================================
   O LIMITE DO DIA

   Uma função só pros quatro limites, porque a pergunta é sempre
   a mesma: quantos disto você já fez hoje, e quantos você pode.

   Conta o que está no aparelho, e não o ponto que o servidor
   concedeu. São coisas diferentes: rola sem parceiro preenchido
   não ganha ponto, mas ocupa o lugar do rola do dia do mesmo
   jeito, porque foi registrado.
   ============================================================ */
const TETO_DO_DIA = {
  rola:  LIMITES.rolasPorDia,
  aula:  LIMITES.aulasPorDia,
  short: LIMITES.shortsPorDia,
  quiz:  LIMITES.perguntasPorDia,
};

export async function usadoHoje(tipo) {
  const d = hoje();
  try {
    if (tipo === 'rola') return await db.rolls.where('data').equals(d).count();
    if (tipo === 'aula' || tipo === 'short') {
      /* conta vídeo aberto hoje, não vídeo descoberto hoje. Se
         contasse só o primeiro acesso, dava pra passar o dia
         revendo o que já tinha visto e o limite não existiria. */
      const vistas = await db.aulasVistas.toArray();
      return vistas.filter((a) => a.tipo === tipo && (a.ultima || a.data) === d).length;
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

/* ---------- o texto que aparece quando bate no limite ---------- */
export function textoDoLimite(recurso) {
  const r = RECURSOS[recurso];
  if (!r) return '';
  return r.desc;
}

export function diasParaVencer(acesso) {
  if (!acesso?.venceEm) return null;
  return diasEntre(hoje(), String(acesso.venceEm).slice(0, 10));
}
