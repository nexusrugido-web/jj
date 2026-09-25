/* ============================================================
   COMPETIÇÃO

   O que o app pergunta quando o treino é campeonato. Os nomes
   seguem a tabela da IBJJF, que é a que as federações copiam.

   Os quilos não entram aqui de propósito: mudam de federação pra
   federação, são diferentes com e sem kimono e mexem de ano em
   ano. O que fica registrado é a categoria que você lutou e o
   peso que deu na balança no dia.
   ============================================================ */
import { placarDaRola } from './game';

export const ORGANIZACOES = [
  'IBJJF / CBJJ',
  'Federação estadual',
  'CBJJE',
  'AJP / UAEJJF',
  'Copa ou liga local',
  'Outra',
];

export const DIVISOES = [
  { id: 'juvenil', nome: 'Juvenil' },
  { id: 'adulto', nome: 'Adulto' },
  { id: 'master1', nome: 'Master 1 (30+)' },
  { id: 'master2', nome: 'Master 2 (36+)' },
  { id: 'master3', nome: 'Master 3 (41+)' },
  { id: 'master4', nome: 'Master 4 (46+)' },
  { id: 'master5', nome: 'Master 5 (51+)' },
  { id: 'master6', nome: 'Master 6 (56+)' },
  { id: 'master7', nome: 'Master 7 (61+)' },
];

export const CATEGORIAS_PESO = [
  'Galo', 'Pluma', 'Pena', 'Leve', 'Médio',
  'Meio-pesado', 'Pesado', 'Super-pesado', 'Pesadíssimo',
];

export const RESULTADOS = [
  { id: 'ouro', nome: 'Campeão', curto: '1º lugar', tone: 'accent' },
  { id: 'prata', nome: 'Vice', curto: '2º lugar', tone: 'ice' },
  { id: 'bronze', nome: '3º lugar', curto: '3º lugar', tone: 'warn' },
  { id: 'participou', nome: 'Sem pódio', curto: 'sem pódio', tone: '' },
];

export const resultadoPorId = (id) => RESULTADOS.find((r) => r.id === id) || null;
export const ehPodio = (id) => ['ouro', 'prata', 'bronze'].includes(id);

/* o que vem da tela antiga de Competições, onde a colocação era texto livre */
export function resultadoDoTexto(txt) {
  const t = String(txt || '').toLowerCase();
  if (!t) return '';
  if (/ouro|campe|1º|1o|^1$/.test(t)) return 'ouro';
  if (/prata|vice|2º|2o|^2$/.test(t)) return 'prata';
  if (/bronze|3º|3o|^3$/.test(t)) return 'bronze';
  return 'participou';
}

export const competicaoVazia = (modalidade = 'gi') => ({
  evento: '', organizacao: 'IBJJF / CBJJ', modalidade,
  divisao: 'adulto', categoria: '', absoluto: false, pesoKg: '', resultado: '',
});

/* o resumo que aparece quando você filtra Treinos por Competição */
export function resumoDeCompeticoes(sessoes, rolasPorSessao) {
  let lutas = 0, vitorias = 0, podios = 0;
  for (const s of sessoes) {
    const rs = rolasPorSessao.get(s.id) || [];
    lutas += rs.length || Number(s.competicao?.lutas) || 0;
    /* a mesma regra do resto do app: quem finalizou mais, depois pontos e
       vantagem. Antes, qualquer luta com finalização contava como vitória,
       até a que terminou 1 a 2 nas finalizações. A luta registrada antes do
       placar (sem v2) ainda vale pelo resultado que foi marcado nela. */
    const ganhou = (r) => placarDaRola(r).ganhou
      || (!r.v2 && ['finalizei', 'venci_pontos', 'venci_vantagem'].includes(r.resultado));
    vitorias += rs.length ? rs.filter(ganhou).length : Number(s.competicao?.vitorias) || 0;
    if (ehPodio(s.competicao?.resultado)) podios++;
  }
  return { campeonatos: sessoes.length, lutas, vitorias, podios };
}
