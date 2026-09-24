import { hoje, addDias, diasEntre } from './utils';
import { placarDaRola } from './game';
import { semanaDe } from './xp';
import { calcularAtaque } from './graus';

/* ============================================================
   SEQUÊNCIA E RESUMO DA SEMANA

   A sequência conta semanas em que você treinou, não dias
   seguidos. Ninguém treina jiu-jitsu sete dias por semana, e
   uma sequência que quebra toda segunda não serviria pra nada.

   O tom nunca cobra. Quem parou de treinar não precisa de app
   dizendo que falhou.
   ============================================================ */

export function sequencia(sessions) {
  if (!sessions.length) {
    return { semanas: 0, recorde: 0, ativa: false, ultimoTreino: null, diasParados: null };
  }

  const semanas = [...new Set(sessions.map((s) => semanaDe(s.data)))].sort();
  const atual = semanaDe();
  const passada = semanaDe(addDias(hoje(), -7));

  let corrente = 0;
  let recorde = 0;
  let anterior = null;
  for (const w of semanas) {
    if (anterior && diasEntre(anterior, w) === 7) corrente++;
    else corrente = 1;
    recorde = Math.max(recorde, corrente);
    anterior = w;
  }

  const ultima = semanas[semanas.length - 1];
  /* a sequência só quebra depois que a semana passada fecha
     sem treino, então você tem a semana inteira pra manter */
  const ativa = ultima === atual || ultima === passada;
  const ultimoTreino = sessions.map((s) => s.data).sort().pop();

  return {
    semanas: ativa ? corrente : 0,
    recorde,
    ativa,
    treinouEstaSemana: ultima === atual,
    ultimoTreino,
    diasParados: ultimoTreino ? diasEntre(ultimoTreino, hoje()) : null,
  };
}


/* ============================================================
   RESUMO DA SEMANA
   O que você fez, em quatro linhas, sem gráfico.
   ============================================================ */
export function resumoSemana(sessions, rolls, tecnicas = [], { semana = null, faixa = 'branca' } = {}) {
  const alvo = semana || semanaDe();
  const fim = addDias(alvo, 6);

  const doPeriodo = sessions.filter((s) => s.data >= alvo && s.data <= fim);
  const ids = new Set(doPeriodo.map((s) => s.id));
  const rs = rolls.filter((r) => ids.has(r.sessionId));

  let venceu = 0, perdeu = 0, fin = 0, tap = 0;
  const tecUsadas = new Set();
  for (const r of rs) {
    const p = placarDaRola(r);
    if (p.ganhou) venceu++; else if (p.perdeu) perdeu++;
    fin += (r.subsAplicadas || []).length;
    tap += (r.subsSofridas || []).length;
    for (const n of r.subsAplicadas || []) tecUsadas.add(n);
    for (const nomes of Object.values(r.tecMeus || {})) for (const n of nomes) tecUsadas.add(n);
  }

  const minutos = doPeriodo.reduce((a, s) => a + (Number(s.duracao) || 0), 0);

  /* comparação com a semana anterior */
  const ant = addDias(alvo, -7);
  const antSes = sessions.filter((s) => s.data >= ant && s.data < alvo);
  const variacao = antSes.length ? doPeriodo.length - antSes.length : null;

  /* subiu de grau nesta semana: o grau com os usos até domingo passado
     contra o de hoje. Antes era um palpite pelo progresso, que quase
     nunca acertava e nunca via ninguém chegar no 4º grau. */
  const subiram = tecnicas.filter((t) => t.grau >= 2 && t.ultima >= alvo
    && Math.max(t.grauGuardado || 0, calcularAtaque((t.historico || []).filter((u) => u.data && u.data < alvo), faixa).grau) < t.grau);

  return {
    semana: alvo,
    inicio: alvo,
    fim,
    treinos: doPeriodo.length,
    horas: Math.round((minutos / 60) * 10) / 10,
    rolas: rs.length,
    venceu, perdeu, fin, tap,
    tecnicas: tecUsadas.size,
    variacao,
    subiram,
    vazia: doPeriodo.length === 0,
  };
}

/* ---------- a leitura da semana, em uma frase ---------- */
export function lerSemana(r, faixa = 'branca') {
  if (r.vazia) {
    return 'Nenhum treino registrado nesta semana. Se você foi e esqueceu de anotar, dá pra registrar com a data certa.';
  }

  const partes = [];
  partes.push(`${r.treinos} ${r.treinos === 1 ? 'treino' : 'treinos'}`);
  if (r.horas) partes.push(`${r.horas}h de tatame`);
  if (r.rolas) partes.push(`${r.rolas} ${r.rolas === 1 ? 'rola' : 'rolas'}`);

  let txt = partes.join(', ') + '.';

  if (r.fin > 0) {
    txt += ` Você finalizou ${r.fin} ${r.fin === 1 ? 'vez' : 'vezes'}`;
    txt += r.tap > 0 ? ` e bateu ${r.tap}.` : '.';
  } else if (r.tap > 0) {
    txt += ` Bateu ${r.tap} ${r.tap === 1 ? 'vez' : 'vezes'} e não finalizou ninguém, o que é normal quando se está rolando com gente mais graduada.`;
  }

  if (r.tecnicas >= 5) {
    txt += ` Apareceram ${r.tecnicas} técnicas diferentes, o que mostra um jogo variado.`;
  } else if (r.tecnicas > 0 && r.tecnicas <= 2 && faixa !== 'branca') {
    txt += ` Só ${r.tecnicas} ${r.tecnicas === 1 ? 'técnica apareceu' : 'técnicas apareceram'}. Vale abrir o repertório.`;
  }

  if (r.variacao !== null) {
    if (r.variacao > 0) txt += ` Foram ${r.variacao} ${r.variacao === 1 ? 'treino' : 'treinos'} a mais que na semana passada.`;
    else if (r.variacao < 0) txt += ` Foi ${Math.abs(r.variacao)} a menos que na semana passada, e uma semana mais leve faz parte.`;
  }

  return txt;
}


/* ============================================================
   ESCUDO DE CONSTÂNCIA

   A ideia: quem é constante não pode ser punido por uma semana
   ruim. Lesão acontece, viagem acontece, trabalho aperta.

   Como funciona: a cada 4 semanas seguidas de treino você
   ganha um escudo, até três guardados. Se você perder uma
   semana, o escudo é gasto e a sequência continua de pé.

   Só falha de verdade quem passa semanas seguidas fora e já
   gastou tudo que tinha acumulado. E mesmo aí, os pontos da
   Jornada continuam intactos, porque o que foi treinado foi.
   ============================================================ */

export const SEMANAS_POR_ESCUDO = 4;
export const MAX_ESCUDOS = 3;


export function escudos(sessions, protegidas = new Set()) {
  /* semana com treino, mais semana em que a pessoa estava
     machucada e estudou. As duas contam como presença. */
  const comTreino = new Set(sessions.map((s) => semanaDe(s.data)));
  for (const w of protegidas) comTreino.add(w);
  const semanas = [...comTreino].sort();
  if (!semanas.length) return { tem: 0, gastos: 0, faltaPro: SEMANAS_POR_ESCUDO, protegida: null };

  let corrente = 0;
  let ganhos = 0;
  let gastos = 0;
  let anterior = null;
  let ultimaProtegida = null;

  for (const w of semanas) {
    if (!anterior) { corrente = 1; anterior = w; continue; }

    const distancia = diasEntre(anterior, w) / 7;

    if (distancia === 1) {
      corrente += 1;
    } else if (distancia > 1) {
      /* buracos entre uma semana e outra */
      const perdidas = distancia - 1;
      const cobertas = Math.min(perdidas, ganhos - gastos);
      gastos += cobertas;
      if (cobertas > 0) ultimaProtegida = w;
      corrente = cobertas >= perdidas ? corrente + 1 : 1;
    }

    if (corrente > 0 && corrente % SEMANAS_POR_ESCUDO === 0) {
      ganhos = Math.min(MAX_ESCUDOS + gastos, ganhos + 1);
    }
    anterior = w;
  }

  const tem = Math.max(0, Math.min(MAX_ESCUDOS, ganhos - gastos));
  /* quem acabou de ganhar um escudo recomeça a contagem inteira */
  const resto = corrente % SEMANAS_POR_ESCUDO;
  const faltaPro = resto === 0 ? SEMANAS_POR_ESCUDO : SEMANAS_POR_ESCUDO - resto;

  return {
    tem,
    gastos,
    faltaPro: tem >= MAX_ESCUDOS ? 0 : faltaPro,
    protegida: ultimaProtegida,
    corrente,
  };
}

