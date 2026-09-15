/* ============================================================
   VALIDAÇÃO DE TREINO DE ACADEMIA
   Baseado nas faixas de volume da literatura de hipertrofia
   (10–20 séries semanais por grupo) e equilíbrio de padrões.
   Educativo, não substitui educador físico.
   ============================================================ */

export const GRUPOS_MUSCULARES = [
  'peito', 'costas', 'ombro', 'biceps', 'triceps', 'quadriceps', 'posterior', 'gluteo', 'core', 'pescoco', 'antebraco',
];

/* mapeamento simples nome de exercício -> grupos */
const MAPA = [
  [/supino|flex[aã]o de bra|crucifixo|peck/i, ['peito', 'triceps', 'ombro']],
  [/remada|puxada|barra fixa|pull-?up|chin-?up|gi pull/i, ['costas', 'biceps', 'antebraco']],
  [/desenvolvimento|eleva[çc][ãa]o lateral|militar|arnold/i, ['ombro', 'triceps']],
  [/rosca|curl/i, ['biceps', 'antebraco']],
  [/tr[íi]ceps|mergulho|dip/i, ['triceps']],
  [/agachamento|leg press|afundo|b[úu]lgaro/i, ['quadriceps', 'gluteo']],
  [/terra romeno|stiff|mesa flexora|good morning/i, ['posterior', 'gluteo']],
  [/levantamento terra|deadlift/i, ['posterior', 'costas', 'gluteo']],
  [/prancha|abdominal|hollow|pallof|core|russian/i, ['core']],
  [/pesco[çc]o|neck/i, ['pescoco']],
  [/pendura|dead hang|toalha|pin[çc]a|corda|grip|farmer/i, ['antebraco']],
  [/kettlebell swing|hip thrust|gl[úu]teo/i, ['gluteo', 'posterior']],
  [/panturrilha/i, ['quadriceps']],
];

export function gruposDoExercicio(nome) {
  for (const [re, gr] of MAPA) if (re.test(nome || '')) return gr;
  return [];
}

/* programa: { dias: [{ assistencia: [{nome, series}], principal }] } */
export function volumeSemanal(programa) {
  const conta = {};
  const add = (g, n) => { conta[g] = (conta[g] || 0) + n; };

  for (const dia of programa.dias || []) {
    const itens = [...(dia.assistencia || [])];
    if (dia.principal) itens.push({ nome: dia.principal, series: 3 });
    for (const ex of itens) {
      const s = Number(ex.series) || 0;
      for (const g of gruposDoExercicio(ex.nome)) add(g, s);
    }
  }
  return conta;
}

export function validarPrograma(programa) {
  const vol = volumeSemanal(programa);
  const out = [];

  const principais = ['peito', 'costas', 'quadriceps', 'posterior', 'ombro'];
  for (const g of principais) {
    const v = vol[g] || 0;
    if (v === 0) out.push({ nivel: 'atencao', titulo: `Nada para ${g}`, texto: 'Esse grupo não aparece no programa. Grupo esquecido vira ponto fraco e depois lesão.' });
    else if (v < 10) out.push({ nivel: 'atencao', titulo: `${g}: ${v} séries/semana`, texto: 'Abaixo de 10 séties semanais o estímulo é pequeno. A faixa mais produtiva é 10–20.'.replace('séties', 'séries') });
    else if (v > 20) out.push({ nivel: 'atencao', titulo: `${g}: ${v} séries/semana`, texto: 'Acima de 20 séries os retornos caem e a fadiga sobra pro tatame.' });
    else out.push({ nivel: 'bom', titulo: `${g}: ${v} séries/semana`, texto: 'Dentro da faixa produtiva (10–20).' });
  }

  const empurrar = (vol.peito || 0) + (vol.ombro || 0);
  const puxar = vol.costas || 0;
  if (empurrar > 0 && puxar > 0) {
    const razao = empurrar / puxar;
    if (razao > 1.6) out.push({ nivel: 'ruim', titulo: 'Desequilíbrio empurrar/puxar', texto: `Você empurra ${razao.toFixed(1)}x mais do que puxa. No jiu-jitsu isso vira ombro dolorido. Adicione remada/barra.` });
    else if (razao < 0.5) out.push({ nivel: 'atencao', titulo: 'Muito puxar, pouco empurrar', texto: 'Equilibre com supino/desenvolvimento.' });
  }

  if (!(vol.pescoco > 0)) out.push({ nivel: 'atencao', titulo: 'Sem trabalho de pescoço', texto: 'Grappler que não treina pescoço paga caro. 2x por semana de isometria já ajuda.' });
  if (!(vol.antebraco > 0)) out.push({ nivel: 'atencao', titulo: 'Sem trabalho de pegada', texto: 'O kimono destrói antebraço. Dead hang e remada com toalha resolvem, mas nunca antes de rolar.' });
  if (!(vol.core > 0)) out.push({ nivel: 'atencao', titulo: 'Sem core', texto: 'Core anti-rotação sustenta guarda e passagem.' });

  const dias = (programa.dias || []).length;
  if (dias > 4) out.push({ nivel: 'atencao', titulo: `${dias} dias de academia`, texto: 'Quem treina BJJ 4-5x costuma render melhor com 2-3 sessões de força. Mais que isso rouba recuperação.' });

  return { volume: vol, alertas: out };
}

/* 1RM estimado, Epley */
export function e1rm(carga, reps) {
  const c = Number(carga) || 0;
  const r = Number(reps) || 0;
  if (!c || !r) return 0;
  if (r === 1) return c;
  return Math.round(c * (1 + r / 30));
}

export function trainingMax(um) { return Math.round((Number(um) || 0) * 0.9); }

export function arredondar(v, passo = 2.5) {
  return Math.round((Number(v) || 0) / passo) * passo;
}
