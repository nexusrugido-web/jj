import { db, getMeta, setMeta } from '../db/db';
import { hoje, addDias, diasEntre } from './utils';
import { semanaDe } from './xp';

/* ============================================================
   ATIVAÇÃO E RECONQUISTA

   Duas coisas aqui:

   1. Saber se a pessoa chegou no ponto em que o app passa a
      valer. Sem três treinos registrados, nada do que o app
      faz de melhor consegue aparecer.

   2. Falar com quem sumiu, sem cobrar. Quem parou de treinar
      não precisa de aplicativo dizendo que falhou.
   ============================================================ */

/* o marco que separa quem fica de quem desiste */
export const MARCO_ATIVACAO = 3;

export function estadoDeAtivacao(sessions, rolls, tecnicas = []) {
  const n = sessions.length;
  const comRola = sessions.filter((s) => rolls.some((r) => r.sessionId === s.id)).length;
  const comReflexao = sessions.filter((s) =>
    String(s.nota || '').trim().length >= 15
    || rolls.some((r) => r.sessionId === s.id && String(r.notas || '').trim().length >= 15)
  ).length;

  const passos = [
    { id: 'primeiro', feito: n >= 1, nome: 'Registrar o primeiro treino', dica: 'Data, duração e as técnicas da aula. Leva um minuto.' },
    { id: 'rola', feito: comRola >= 1, nome: 'Anotar um rola', dica: 'Com quem foi, o que pontuou e duas linhas do que aconteceu.' },
    { id: 'tres', feito: n >= MARCO_ATIVACAO, nome: `Chegar a ${MARCO_ATIVACAO} treinos`, dica: 'A partir daqui o app começa a enxergar padrão no seu jogo.' },
    { id: 'reflexao', feito: comReflexao >= 1, nome: 'Escrever o que travou', dica: 'É a parte que mais vale quando você voltar aqui daqui a três meses.' },
    { id: 'tecnica', feito: tecnicas.length >= 1, nome: 'Ter uma técnica acompanhada', dica: 'Aparece sozinha quando você marca uma finalização ou um ponto com nome.' },
  ];

  const feitos = passos.filter((p) => p.feito).length;

  return {
    passos,
    feitos,
    total: passos.length,
    ativado: n >= MARCO_ATIVACAO,
    pct: Math.round((feitos / passos.length) * 100),
    proximo: passos.find((p) => !p.feito) || null,
  };
}

/* ============================================================
   QUEM SUMIU

   O tom muda conforme o tempo, mas nunca cobra. A pessoa pode
   ter se machucado, mudado de cidade ou só cansado. Nenhuma
   dessas merece culpa vinda de um aplicativo.
   ============================================================ */
export function estadoDeAusencia(sessions) {
  if (!sessions.length) return { sumiu: false, dias: null };

  const ultimo = sessions.map((s) => s.data).sort().pop();
  const dias = diasEntre(ultimo, hoje());

  if (dias < 10) return { sumiu: false, dias, ultimo };

  if (dias < 21) {
    return {
      sumiu: true, nivel: 'leve', dias, ultimo,
      titulo: 'Faz uma semana e pouco',
      texto: 'Se você treinou e não anotou, dá pra registrar com a data de trás que entra tudo certinho no histórico.',
      acao: 'Registrar treino atrasado',
    };
  }

  if (dias < 60) {
    return {
      sumiu: true, nivel: 'medio', dias, ultimo,
      titulo: `${dias} dias sem registro`,
      texto: 'Lesão, trabalho, cabeça cheia, acontece com todo mundo que treina. Quando voltar, o seu histórico está inteiro esperando.',
      acao: 'Ver o que eu já tinha',
    };
  }

  return {
    sumiu: true, nivel: 'longo', dias, ultimo,
    titulo: 'Bom te ver por aqui',
    texto: `Seu último treino registrado foi há ${Math.round(dias / 30)} meses. Nada se perdeu. Quando voltar pro tatame, é só continuar de onde parou.`,
    acao: 'Registrar treino',
  };
}

/* ============================================================
   PAUSA EM VEZ DE CANCELAMENTO

   Quem vai parar por dois meses não precisa cancelar e
   recomeçar depois. Pausar resolve melhor pros dois lados.
   ============================================================ */
export const MOTIVOS_PAUSA = [
  { id: 'lesao', nome: 'Estou lesionado', sugestao: 3, texto: 'Recuperação leva o tempo que leva. Pausamos até você voltar.' },
  { id: 'tempo', nome: 'Sem tempo agora', sugestao: 2, texto: 'Trabalho aperta, acontece. A conta fica guardada.' },
  { id: 'viagem', nome: 'Vou viajar', sugestao: 1, texto: 'Um mês parado não apaga nada do que você já registrou.' },
  { id: 'parei', nome: 'Parei de treinar', sugestao: 6, texto: 'Sem problema. Se um dia voltar, seus dados estarão aqui.' },
  { id: 'preco', nome: 'Está pesando no bolso', sugestao: 0, texto: '' },
  { id: 'outro', nome: 'Outro motivo', sugestao: 2, texto: '' },
];

export async function pausar(meses, motivo) {
  const ate = addDias(hoje(), meses * 30);
  await setMeta('pausa', { ate, motivo, criadaEm: hoje() });
  return { ate, motivo };
}

export async function pausaAtiva() {
  const p = await getMeta('pausa', null);
  if (!p) return null;
  if (p.ate < hoje()) { await setMeta('pausa', null); return null; }
  return { ...p, diasRestantes: diasEntre(hoje(), p.ate) };
}

export async function retomar() {
  await setMeta('pausa', null);
}

/* ============================================================
   O QUE FALAR NA TELA DE CANCELAMENTO

   Regra: oferecer pausa antes de oferecer desconto. Quem
   aprende que basta ameaçar sair pra ganhar desconto vai
   fazer isso toda renovação.
   ============================================================ */
export function ofertaDeSaida(motivo, resumo = {}) {
  const m = MOTIVOS_PAUSA.find((x) => x.id === motivo);

  if (motivo === 'preco') {
    return {
      tipo: 'anual',
      titulo: 'O plano anual sai bem mais barato',
      texto: 'Dá menos da metade por mês comparado com o mensal. Se o problema é valor, esse é o caminho antes de cancelar.',
      acao: 'Ver o anual',
    };
  }

  if (m?.sugestao) {
    return {
      tipo: 'pausa',
      meses: m.sugestao,
      titulo: `Quer pausar ${m.sugestao} ${m.sugestao === 1 ? 'mês' : 'meses'} em vez de cancelar?`,
      texto: `${m.texto} Nesse período não cobramos nada, e quando voltar está tudo como você deixou.`,
      acao: 'Pausar',
    };
  }

  return {
    tipo: 'nenhuma',
    titulo: 'Tudo bem',
    texto: resumo.treinos
      ? `Você registrou ${resumo.treinos} treinos aqui. Tudo isso continua seu, dá pra baixar quando quiser.`
      : 'Seus dados continuam disponíveis pra baixar quando quiser.',
    acao: 'Baixar meus dados',
  };
}

/* ============================================================
   O FUNIL, PRA VOCÊ SABER ONDE A GENTE PERDE GENTE

   Fica só no aparelho e serve pra o app decidir o que mostrar.
   ============================================================ */
export async function marcarEvento(nome, dados = {}) {
  const eventos = await getMeta('funil', {});
  if (eventos[nome]) return eventos;
  const novo = { ...eventos, [nome]: { data: hoje(), ...dados } };
  await setMeta('funil', novo);
  return novo;
}

export async function funil() {
  return getMeta('funil', {});
}

/* quantos dias entre criar a conta e o terceiro treino */
export function tempoAteAtivar(eventos) {
  if (!eventos?.conta || !eventos?.ativado) return null;
  return diasEntre(eventos.conta.data, eventos.ativado.data);
}
