import { hoje, diasEntre, addDias } from './utils';

/* ============================================================
   OFENSIVA

   Dias seguidos aparecendo. Não dias seguidos de tatame:
   ninguém treina jiu-jitsu sete dias por semana, e uma ofensiva
   que cobra isso quebra na primeira semana.

   O dia fecha com qualquer coisa que dê ponto: uma aula rápida
   de trinta segundos, uma pergunta do quiz, uma revisão, ou o
   treino registrado. No dia de treino ela fecha sozinha, sem
   esforço a mais. No dia de folga custa meio minuto.

   E O TREINO PAGA OS DOIS DIAS SEGUINTES

   Quem treinou hoje já tem amanhã e depois fechados. Não é
   regalia: recuperação é parte do treino, e quem rolou duas
   horas na terça não pode ver "ofensiva zerada" na quarta.
   Seria o app dizendo que o vídeo de trinta segundos vale mais
   que o tatame.

   Dois dias, e não um, porque um não fecha a semana: quem
   treina de segunda a sexta ainda quebraria todo domingo, já
   que sexta só pagaria o sábado. Com dois, quem treina 3x
   (seg/qua/sex) ou 5x nunca quebra sem estudar nada.

   Quem treina 2x por semana ainda precisa abrir o app no fim de
   semana. São trinta segundos, e é o único jeito de a ofensiva
   continuar querendo dizer alguma coisa.

   Só o treino paga. Assistir aula não paga dia nenhum, senão um
   vídeo compraria a semana.

   É de propósito que o sofá consiga manter ofensiva. A ofensiva
   mede presença, não evolução. Quem só assiste vídeo nunca vai
   ganhar a liga, porque lá o estudo tem teto (TETO_ESTUDO_SEMANA
   em xp.js). São réguas diferentes, e cada uma mede o que diz
   medir.

   O ESCUDO

   A cada 15 dias seguidos você ganha um, até dois guardados.
   Ele é gasto sozinho, sem perguntar: o único escudo que
   protege é o que já estava lá quando o dia passou. Perguntar
   não adianta, porque quem esqueceu o dia não abriu o app.

   Quem está em 14 dias e some perde tudo. Quem chegou aos 15
   tem como voltar. É o que separa ter construído alguma coisa
   de ainda estar começando.

   A LESÃO CONGELA, NÃO GASTA

   Quem registrou lesão que tira do tatame não perde ofensiva
   pelos dias parados, e não gasta escudo com eles: a contagem
   simplesmente para e continua de onde estava quando a pessoa
   voltar.

   Não é o mesmo que o escudo. O escudo é pra vida atrapalhando:
   viagem, trabalho, esquecimento, e ele acaba. A lesão não tem
   limite, porque não é falta de vontade e ninguém escolhe o
   tamanho dela. Quem está operado não devia estar competindo
   por ofensiva com quem está treinando.

   Se a pessoa estudar durante a lesão, o dia conta normal e a
   ofensiva cresce. Congelar é o piso, não o teto.
   ============================================================ */

export const DIAS_POR_ESCUDO = 15;
export const MAX_ESCUDOS = 2;
export const DIAS_QUE_O_TREINO_PAGA = 2;

/* O dia de hoje ainda não acabou.

   Sem isto, quem não estudou até as 23h já apareceria com a
   ofensiva quebrada, e a notificação que avisa disso chegaria
   depois do estrago. Hoje em aberto não é dia perdido: é o dia
   que ainda dá pra fechar. */

export function ofensiva(pontos = [], hojeIso = hoje(), lesoes = []) {
  const dias = diasFechados(pontos, hojeIso);
  const congelados = diasParados(lesoes, hojeIso);

  /* os dias perdidos entre dois dias com ponto, tirando os que a
     lesão congelou. Sem lesão nenhuma nem vale a pena caminhar. */
  const perdidosEntre = (a, b) => {
    const total = diasEntre(a, b) - 1;
    if (total <= 0) return 0;
    if (!congelados.size) return total;
    let n = 0;
    for (let i = 1; i <= total; i += 1) if (!congelados.has(addDias(a, i))) n += 1;
    return n;
  };

  if (!dias.length) {
    return {
      dias: 0, recorde: 0, viva: false, fechouHoje: false, emRisco: false,
      escudos: 0, gastos: 0, faltaProEscudo: DIAS_POR_ESCUDO, ultimoDia: null, diasParados: null,
    };
  }

  /* A simulação anda pra frente no tempo, porque o escudo só
     cobre um buraco se já tinha sido ganho antes dele. Contar
     de trás pra frente daria escudo a quem ainda não tinha. */
  let corrente = 0;
  let recorde = 0;
  let ganhos = 0;
  let gastos = 0;
  let anterior = null;

  const creditar = () => {
    if (corrente > 0 && corrente % DIAS_POR_ESCUDO === 0) {
      ganhos = Math.min(MAX_ESCUDOS + gastos, ganhos + 1);
    }
    recorde = Math.max(recorde, corrente);
  };

  for (const d of dias) {
    if (!anterior) {
      corrente = 1;
    } else {
      const distancia = diasEntre(anterior, d);
      if (distancia === 1) {
        corrente += 1;
      } else if (distancia > 1) {
        const perdidos = perdidosEntre(anterior, d);
        const cobertos = Math.min(perdidos, ganhos - gastos);
        gastos += cobertos;
        /* o dia coberto não conta ponto na ofensiva, só impede
           a queda. Quem viajou não ganha dia de presente. */
        corrente = cobertos >= perdidos ? corrente + 1 : 1;
      }
    }
    anterior = d;
    creditar();
  }

  /* Da última vez que apareceu até hoje. Hoje não entra na
     conta de dias perdidos porque ainda está aberto. */
  const ultimoDia = dias[dias.length - 1];
  const parados = diasEntre(ultimoDia, hojeIso);
  const perdidos = perdidosEntre(ultimoDia, hojeIso);
  const cobertos = Math.min(perdidos, ganhos - gastos);
  gastos += cobertos;
  const viva = cobertos >= perdidos;

  return {
    dias: viva ? corrente : 0,
    recorde,
    viva,
    fechouHoje: parados === 0,
    /* não fechou hoje, e hoje é o último dia que segura. Quem
       está de molho não está em risco: a contagem está parada. */
    emRisco: viva && parados >= 1 && !congelados.has(hojeIso),
    congelada: congelados.has(hojeIso),
    escudos: viva ? Math.max(0, Math.min(MAX_ESCUDOS, ganhos - gastos)) : 0,
    gastos,
    faltaProEscudo: faltaPro(viva ? corrente : 0, viva ? Math.max(0, ganhos - gastos) : 0),
    ultimoDia,
    diasParados: parados,
  };
}

/* ============================================================
   OS DIAS FECHADOS

   O dia com ponto, mais os dois dias seguintes a um treino.
   Ordenados, sem repetição, e nunca no futuro: treinar hoje não
   adianta o dia de amanhã, que ainda não chegou.

   Mora aqui e não na tela porque a pista da Jornada precisa
   pintar exatamente os mesmos dias que a conta usou. Em dois
   lugares, um dia os dois discordariam.
   ============================================================ */
export function diasFechados(pontos = [], ate = hoje()) {
  const set = new Set();
  for (const p of pontos) {
    if (!p.data) continue;
    set.add(p.data);
    if (p.evento === 'treino') {
      for (let i = 1; i <= DIAS_QUE_O_TREINO_PAGA; i += 1) {
        const seguinte = addDias(p.data, i);
        if (seguinte <= ate) set.add(seguinte);
      }
    }
  }
  return [...set].sort();
}

/* ============================================================
   OS DIAS QUE A LESÃO CONGELOU

   Só a lesão que tira do tatame ('parado'). Lesão que deixa
   treinar adaptado não congela nada, porque a pessoa continua
   indo.

   O fim é a cura, e enquanto não tem cura é hoje: lesão aberta
   congela até a pessoa fechar.
   ============================================================ */
export function diasParadosPorLesao(lesoes = [], ate = hoje()) {
  return diasParados(lesoes, ate);
}

function diasParados(lesoes, ate) {
  const set = new Set();
  for (const l of lesoes) {
    if (l.impacto !== 'parado' || !l.data) continue;
    const fim = l.dataCura || l.fechadaEm || ate;
    let d = l.data;
    /* trava de segurança: lesão de anos não vira laço infinito */
    for (let i = 0; d <= fim && d <= ate && i < 1100; i += 1) {
      set.add(d);
      d = addDias(d, 1);
    }
  }
  return set;
}

function faltaPro(corrente, emMao) {
  if (emMao >= MAX_ESCUDOS) return 0;
  const resto = corrente % DIAS_POR_ESCUDO;
  return resto === 0 && corrente > 0 ? DIAS_POR_ESCUDO : DIAS_POR_ESCUDO - resto;
}

/* ---------- a frase da ofensiva, sem cobrança ---------- */
export function textoOfensiva(o) {
  if (!o.ultimoDia) {
    return {
      titulo: 'A ofensiva começa hoje',
      texto: 'Qualquer coisa que dê ponto fecha o dia: uma aula rápida, uma pergunta do quiz, ou o treino registrado.',
      tom: '',
    };
  }

  if (!o.viva) {
    return {
      titulo: o.recorde >= DIAS_POR_ESCUDO ? `Seu recorde foi de ${o.recorde} dias` : 'Ofensiva zerada',
      texto: 'Uma ação hoje começa a próxima. O que você já treinou continua valendo, porque ponto na Jornada não volta pra trás.',
      tom: '',
    };
  }

  if (o.congelada) {
    return {
      titulo: o.dias === 1 ? 'Ofensiva congelada em 1 dia' : `Ofensiva congelada em ${o.dias} dias`,
      texto: 'Você registrou lesão que tira do tatame. Enquanto ela estiver aberta a contagem fica parada, e não gasta escudo. Se estudar, ela volta a crescer.',
      tom: 'ice',
    };
  }

  if (o.emRisco) {
    return {
      titulo: o.dias === 1 ? 'Sua ofensiva fecha hoje' : `${o.dias} dias, e hoje ainda está aberto`,
      texto: o.escudos > 0
        ? `Se o dia passar, um escudo segura. Você tem ${o.escudos}.`
        : 'Sem escudo guardado ainda. Meio minuto de aula rápida mantém de pé.',
      tom: 'roar',
    };
  }

  if (o.dias >= 100) {
    return { titulo: `${o.dias} dias seguidos`, texto: 'Cem dias aparecendo. Isso é mais constância do que a maioria dos faixas-pretas teve no primeiro ano.', tom: 'jade' };
  }
  if (o.dias >= 30) {
    return { titulo: `${o.dias} dias seguidos`, texto: 'Um mês sem falhar um dia. É esse tipo de rotina que muda faixa.', tom: 'jade' };
  }
  if (o.dias >= DIAS_POR_ESCUDO) {
    return { titulo: `${o.dias} dias seguidos`, texto: 'Você já tem escudo guardado. Agora dá pra faltar um dia sem perder o que construiu.', tom: 'jade' };
  }
  return {
    titulo: o.dias === 1 ? 'Primeiro dia' : `${o.dias} dias seguidos`,
    texto: `Faltam ${o.faltaProEscudo} ${o.faltaProEscudo === 1 ? 'dia' : 'dias'} pro primeiro escudo, que segura a ofensiva quando a vida atrapalhar.`,
    tom: '',
  };
}
