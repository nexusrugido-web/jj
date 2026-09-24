import { db } from '../db/db';
import { hoje } from './utils';

/* ============================================================
   MARCOS, o lugar do XP.
   Sem pontinho genérico. Só evento que significa alguma coisa
   de verdade: hora de tatame acumulada, técnica que virou
   dominada, primeira finalização, graduação.
   ============================================================ */

export const MARCOS_HORAS = [10, 25, 50, 100, 200, 300, 500, 750, 1000];
export const MARCOS_ROLAS = [10, 50, 100, 250, 500, 1000];

export function definirMarcos({ matHoras, rolas, sessoes, dominadas, primeiraFinalizacao, streakRecorde, pontos, primeiraRaspagemAcima, saldoPositivoPesado, taxaVitoria, rolasComPontos }) {
  const lista = [];

  for (const h of MARCOS_HORAS) {
    if (matHoras >= h) lista.push({
      chave: `horas_${h}`,
      titulo: `${h} horas de tatame`,
      texto: h >= 500 ? 'Isso é tempo de faixa colorida. Poucos chegam aqui.' :
             h >= 100 ? 'Cem horas mudam o corpo e a leitura do rola.' :
             'Hora no tatame é o que separa quem evolui de quem só assiste.',
      tipo: 'horas', valor: h,
    });
  }
  for (const r of MARCOS_ROLAS) {
    if (rolas >= r) lista.push({
      chave: `rolas_${r}`,
      titulo: `${r} rolas registrados`,
      texto: 'Cada um desses foi você escolhendo ir treinar.',
      tipo: 'rolas', valor: r,
    });
  }
  if (sessoes >= 1) lista.push({ chave: 'primeiro_treino', titulo: 'Primeiro treino registrado', texto: 'Começou. O resto é consequência.', tipo: 'inicio', valor: 1 });
  if (primeiraFinalizacao) lista.push({ chave: 'primeira_finalizacao', titulo: 'Primeira finalização no rola', texto: `Contra resistência de verdade: ${primeiraFinalizacao}.`, tipo: 'tecnica', valor: 1 });
  for (const n of [1, 3, 5, 10, 20]) {
    if (dominadas >= n) lista.push({
      chave: `dominadas_${n}`,
      titulo: n === 1 ? 'Primeira técnica dominada' : `${n} técnicas dominadas`,
      texto: 'Dominada de verdade, o seu histórico de rola provou.',
      tipo: 'dominio', valor: n,
    });
  }
  for (const s of [7, 14, 30, 60, 100]) {
    if (streakRecorde >= s) lista.push({ chave: `streak_${s}`, titulo: `${s} dias seguidos`, texto: 'Consistência é a técnica mais difícil do jiu-jitsu.', tipo: 'streak', valor: s });
  }

  /* ---- marcos de pontuação ---- */
  for (const p of [50, 100, 250, 500, 1000, 2500]) {
    if (pontos >= p) lista.push({
      chave: `pontos_${p}`,
      titulo: `${p} pontos conquistados`,
      texto: p >= 500 ? 'Isso é volume de competidor. Cada ponto foi uma posição que você tomou.' : 'Ponto é posição conquistada contra alguém resistindo.',
      tipo: 'pontos', valor: p,
    });
  }
  if (primeiraRaspagemAcima) lista.push({
    chave: 'raspagem_faixa_acima',
    titulo: 'Raspou uma faixa acima da sua',
    texto: 'Inverter alguém que sabe mais que você é das coisas mais difíceis do jiu-jitsu.',
    tipo: 'pontos', valor: 1,
  });
  if (saldoPositivoPesado) lista.push({
    chave: 'saldo_pesado',
    titulo: 'Saldo positivo contra mais pesado',
    texto: 'Alavanca vencendo massa. É exatamente pra isso que o jiu-jitsu existe.',
    tipo: 'pontos', valor: 1,
  });
  if (rolasComPontos >= 15) lista.push({
    chave: 'estilo_calculado',
    titulo: 'Seu estilo saiu dos seus treinos',
    texto: '15 rolas com pontos marcados. O Meu jogo agora mostra o estilo que aparece no tatame, não mais o do teste.',
    tipo: 'tecnica', valor: 15,
  });
  if (taxaVitoria >= 50 && rolasComPontos >= 20) lista.push({
    chave: 'taxa_50',
    titulo: 'Mais de 50% de vitória',
    texto: 'Em 20+ rolas registrados. O jogo virou pro seu lado.',
    tipo: 'pontos', valor: 50,
  });
  return lista;
}

/* registra os novos e devolve só os que acabaram de acontecer */
export async function sincronizarMarcos(dados) {
  const alvo = definirMarcos(dados);
  const existentes = await db.milestones.toArray();
  const jaTem = new Map(existentes.map((m) => [m.chave, m]));
  const novos = [];

  for (const m of alvo) {
    const velho = jaTem.get(m.chave);
    if (velho) {
      /* texto corrigido chega também em quem já tinha a conquista */
      if (velho.titulo !== m.titulo || velho.texto !== m.texto) await db.milestones.update(velho.id, { titulo: m.titulo, texto: m.texto });
      continue;
    }
    const registro = { ...m, data: hoje(), visto: 0, criadoEm: Date.now() };
    await db.milestones.add(registro);
    novos.push(registro);
  }
  return novos;
}

export const FAIXAS_ORDEM = ['branca', 'azul', 'roxa', 'marrom', 'preta'];

export function proximaGraduacao(faixa, graus) {
  if (graus < 4) return { tipo: 'grau', label: `${graus + 1}º grau na faixa ${faixa}` };
  const i = FAIXAS_ORDEM.indexOf(faixa);
  const prox = FAIXAS_ORDEM[i + 1];
  return prox ? { tipo: 'faixa', label: `Faixa ${prox}` } : { tipo: 'grau', label: 'Mais um grau' };
}
