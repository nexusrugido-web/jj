import { db } from '../db/db';
import { hoje, addDias, dataLocal } from './utils';

/* ============================================================
   XP E RANKING

   Três camadas, porque jiu-jitsu não é Duolingo:

   LIGA      semanal, 30 pessoas parecidas, reseta. Dá o hábito.
   TEMPORADA mensal, sua divisão, reseta. Dá o troféu.
   JORNADA   perpétua, você contra você, nunca reseta. Dá o sentido.

   A liga sozinha não serviria: graduação leva anos, e um ranking
   que zera toda segunda não conversa com isso.
   ============================================================ */

export const EVENTOS = {
  treino: {
    id: 'treino',
    nome: 'Treino registrado com reflexão',
    xp: 20,
    tetoDia: 1,
    desc: 'O tatame é o núcleo. A reflexão é o que impede registro vazio.',
  },
  rola: {
    id: 'rola',
    nome: 'Rola com dados completos',
    xp: 12,
    tetoDia: 8,
    desc: 'Parceiro, pontos e contexto preenchidos.',
  },
  aula: {
    id: 'aula',
    nome: 'Aula assistida',
    xp: 15,
    tetoDia: 2,
    familia: 'estudo',
    desc: 'Aula longa vista até o fim. É a que ensina de verdade, então é a que mais vale.',
  },
  revista: {
    id: 'revista',
    nome: 'Aula revista',
    xp: 5,
    tetoDia: 1,
    familia: 'estudo',
    desc: 'Rever aula longa vale um terço. Você já sabia, mas voltar é o que fixa.',
  },
  revistaShort: {
    id: 'revistaShort',
    nome: 'Short revisto',
    xp: 1,
    tetoDia: 3,
    familia: 'estudo',
    premium: true,
    desc: 'Rever short vale um ponto, e só no premium. No grátis o short vale uma vez só.',
  },
  short: {
    id: 'short',
    nome: 'Short visto',
    xp: 1,
    tetoDia: 6,
    familia: 'estudo',
    desc: 'Custa trinta segundos, então vale um ponto.',
  },
  quizAcerto: {
    id: 'quizAcerto',
    nome: 'Acertou no quiz',
    xp: 10,
    tetoDia: 6,
    familia: 'estudo',
    desc: 'Recompensa entendimento, não chute.',
  },
  quizErro: {
    id: 'quizErro',
    nome: 'Errou e leu a explicação',
    xp: 3,
    tetoDia: 6,
    familia: 'estudo',
    desc: 'Errar e entender por que vale ponto. Medo de errar trava o aprendizado.',
  },
  revisao: {
    id: 'revisao',
    nome: 'Revisão no prazo',
    xp: 5,
    tetoDia: 12,
    desc: 'Repetição espaçada.',
  },
  consistencia: {
    id: 'consistencia',
    nome: 'Ritmo mantido na semana',
    xp: 25,
    tetoDia: 1,
    desc: 'Treinou pelo menos o que você costuma treinar. Quem treina 2x compete de igual com quem treina 5x.',
  },
  grau: {
    id: 'grau',
    nome: 'Técnica subiu de grau',
    xp: 30,
    tetoDia: 3,
    desc: 'Evolução de verdade, comprovada pelos seus registros.',
  },
};

/* ============================================================
   O TETO DO SOFÁ

   Sem isto, dava pra liderar o ranking assistindo vídeo a
   semana inteira sem pisar no tatame. O estudo tem um limite
   semanal, e o limite é menor do que uma semana modesta de
   treino, porque é o tatame que faz você melhorar.
   ============================================================ */
export const TETO_ESTUDO_SEMANA = 140;

/* ---------- as divisões. Quatro, não dez ---------- */
export const DIVISOES = [
  { id: 'iniciante',  nome: 'Iniciante',  min: 0,     cor: 'dim' },
  { id: 'praticante', nome: 'Praticante', min: 800,   cor: 'ice' },
  { id: 'competidor', nome: 'Competidor', min: 3500,  cor: 'roar' },
  { id: 'veterano',   nome: 'Veterano',   min: 12000, cor: 'jade' },
];

export function divisaoPorXp(xp = 0) {
  let d = DIVISOES[0];
  for (const x of DIVISOES) if (xp >= x.min) d = x;
  return d;
}

export function proximaDivisao(xp = 0) {
  const atual = divisaoPorXp(xp);
  const i = DIVISOES.indexOf(atual);
  return i < DIVISOES.length - 1 ? DIVISOES[i + 1] : null;
}

/* ---------- chaves de período ---------- */
export function semanaDe(data = hoje()) {
  const d = new Date(data + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7;
  const seg = new Date(d);
  seg.setDate(d.getDate() - dow);
  return dataLocal(seg);
}

export const mesDe = (data = hoje()) => data.slice(0, 7);
export const anoDe = (data = hoje()) => data.slice(0, 4);

/* ============================================================
   AS QUATRO JANELAS

   Semana e mês zeram, porque servem pra medir ritmo. Ano zera
   também, e é o ciclo que faz a aula valer de novo. Jornada
   nunca zera, porque é o total da sua vida no tatame.

   Por que o ano importa: jiu-jitsu se revisita. A aula sobre
   guarda fechada que você viu de faixa branca diz outra coisa
   quando você é azul. Passado um ano, ela volta a valer ponto.
   ============================================================ */
export const JANELAS_XP = [
  { id: 'semana', nome: 'Ritmo', zera: 'toda segunda' },
  { id: 'mes', nome: 'Constância', zera: 'todo dia 1' },
  { id: 'ano', nome: 'Temporada', zera: 'em 1º de janeiro' },
  { id: 'total', nome: 'Jornada', zera: 'nunca' },
];

/* quantos dias até a aula poder valer ponto de novo */
export const DIAS_PRA_REVER = 365;

/* ============================================================
   CONCEDER XP

   Nada aqui grava direto no ranking. Isto é o registro local,
   que depois sobe pro servidor, e é lá que o ponto vale.
   ============================================================ */
export async function darXp(evento, { refId = null, data = hoje(), detalhe = '' } = {}) {
  const e = EVENTOS[evento];
  if (!e) return null;

  /* evento que só vale pra quem paga. O servidor recusa do mesmo
     jeito, então dar o ponto aqui só mostraria um número na tela
     que some depois. Com a cobrança desligada no painel, vale
     pra todo mundo, igual ao resto do app. */
  if (e.premium) {
    const { ligada } = await import('./chaves');
    if (ligada('cobranca')) {
      const { acessoLocal } = await import('./plano');
      const a = await acessoLocal();
      if (!a?.premium) return null;
    }
  }

  /* não repete o mesmo evento pro mesmo item */
  if (refId) {
    const ja = await db.pontos.where('refId').equals(String(refId)).toArray();
    if (ja.some((x) => x.evento === evento)) return null;
  }

  /* teto diário: ninguém lidera maratonando short */
  const doDia = await db.pontos.where('data').equals(data).toArray();
  const usados = doDia.filter((x) => x.evento === evento).length;
  if (usados >= e.tetoDia) return null;

  /* teto semanal do estudo: vídeo não substitui tatame */
  if (e.familia === 'estudo') {
    const sem = semanaDe(data);
    const daSemana = await db.pontos.where('semana').equals(sem).toArray();
    const jaEstudou = daSemana
      .filter((x) => EVENTOS[x.evento]?.familia === 'estudo')
      .reduce((a, x) => a + (x.xp || 0), 0);
    if (jaEstudou + e.xp > TETO_ESTUDO_SEMANA) return null;
  }

  const linha = {
    evento,
    xp: e.xp,
    refId: refId ? String(refId) : null,
    detalhe,
    data,
    semana: semanaDe(data),
    mes: mesDe(data),
    ano: anoDe(data),
    criadoEm: Date.now(),
  };
  const id = await db.pontos.add(linha);
  /* o ponto vai pra liga sozinho, e o primeiro da semana já coloca
     a pessoa na corrida */
  import('./liga').then((m) => m.agendarSubida()).catch(() => {});
  return { ...linha, id };
}

/* ---------- somatórios ---------- */
export async function meuXp() {
  const linhas = await db.pontos.toArray();
  const soma = (f) => linhas.filter(f).reduce((a, x) => a + (x.xp || 0), 0);

  const sem = semanaDe();
  const mes = mesDe();
  const total = soma(() => true);

  const porEvento = {};
  for (const l of linhas) porEvento[l.evento] = (porEvento[l.evento] || 0) + l.xp;

  const div = divisaoPorXp(total);
  const prox = proximaDivisao(total);

  const ano = anoDe();

  return {
    total,
    semana: soma((x) => x.semana === sem),
    mes: soma((x) => x.mes === mes),
    ano: soma((x) => (x.ano || String(x.data).slice(0, 4)) === ano),
    porEvento,
    divisao: div,
    proxima: prox,
    faltaProxima: prox ? prox.min - total : 0,
    pctDivisao: prox
      ? Math.round(((total - div.min) / (prox.min - div.min)) * 100)
      : 100,
    eventos: linhas.length,
  };
}

/* ---------- a série pra o gráfico da jornada ---------- */
export async function serieXp(dias = 30) {
  const linhas = await db.pontos.toArray();
  const fim = hoje();
  const out = [];
  let acc = 0;

  const antes = linhas.filter((l) => l.data < addDias(fim, -(dias - 1)));
  acc = antes.reduce((a, x) => a + x.xp, 0);

  for (let i = dias - 1; i >= 0; i--) {
    const d = addDias(fim, -i);
    const doDia = linhas.filter((l) => l.data === d).reduce((a, x) => a + x.xp, 0);
    acc += doDia;
    out.push({ data: d, dia: doDia, acumulado: acc });
  }
  return out;
}

/* ---------- o bônus de consistência ---------- */
export async function checarConsistencia(sessions) {
  const sem = semanaDe();
  const desta = sessions.filter((s) => semanaDe(s.data) === sem).length;
  if (!desta) return null;

  /* a sua média das últimas 8 semanas, não um número fixo */
  const porSemana = {};
  for (const s of sessions) {
    const k = semanaDe(s.data);
    if (k === sem) continue;
    porSemana[k] = (porSemana[k] || 0) + 1;
  }
  const semanas = Object.values(porSemana).slice(-8);
  if (semanas.length < 2) return null;

  const media = semanas.reduce((a, b) => a + b, 0) / semanas.length;
  if (desta < Math.floor(media)) return null;

  return darXp('consistencia', { refId: `consistencia:${sem}`, detalhe: `${desta} treinos, média ${media.toFixed(1)}` });
}

/* ---------- texto do progresso, sem jargão ---------- */
export function textoDivisao(xp) {
  const d = divisaoPorXp(xp);
  const p = proximaDivisao(xp);
  if (!p) return `${d.nome}. Você chegou no topo das divisões.`;
  const falta = p.min - xp;
  return `${d.nome}. Faltam ${falta} pontos pra ${p.nome}.`;
}
