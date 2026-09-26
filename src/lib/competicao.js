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
  { id: 'infantil', nome: 'Infantil (até 15)' },
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

/* ============================================================
   A CHAVE E O PÓDIO DA CATEGORIA

   A chave guarda as lutas dos outros só com quem venceu:
     chave: [{ a: 'Fulano', b: 'Beltrano', venceu: 'a' }]
   O pódio tem campeão, vice e os dois 3º lugares (IBJJF):
     podio: { ouro, prata, bronze: [x, y] }
   EU no pódio é você. A colocação do "Como terminou" e o pódio
   andam juntos: marcar um preenche o outro.
   ============================================================ */
export const EU = '__eu';

export function resultadoDoPodio(podio) {
  if (!podio) return null;
  if (podio.ouro === EU) return 'ouro';
  if (podio.prata === EU) return 'prata';
  if ((podio.bronze || []).includes(EU)) return 'bronze';
  return null;
}

export function podioComEu(podio = {}, resultado) {
  const semEu = {
    ouro: podio.ouro === EU ? '' : podio.ouro || '',
    prata: podio.prata === EU ? '' : podio.prata || '',
    bronze: (podio.bronze || ['', '']).map((x) => (x === EU ? '' : x || '')),
  };
  while (semEu.bronze.length < 2) semEu.bronze.push('');
  if (resultado === 'ouro') semEu.ouro = EU;
  else if (resultado === 'prata') semEu.prata = EU;
  else if (resultado === 'bronze') semEu.bronze[semEu.bronze[0] ? 1 : 0] = EU;
  return semEu;
}

/* os nomes que já apareceram na chave e nas suas lutas, pra escolher no pódio */
export function atletasDaChave(chave = [], lutas = []) {
  const nomes = [...lutas.map((r) => r.adversario), ...chave.flatMap((l) => [l.a, l.b])]
    .map((x) => String(x || '').trim()).filter(Boolean);
  /* "Emilio" e "emílio" são a mesma pessoa: fica a primeira grafia */
  const vistos = new Map();
  for (const n of nomes) if (!vistos.has(chaveDoNome(n))) vistos.set(chaveDoNome(n), n);
  return [...vistos.values()];
}
const chaveDoNome = (n) => String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/* ============================================================
   O CAMPEONATO, NA ORDEM DO DIA

   A pessoa registra no campeonato, enquanto ele acontece: primeiro
   onde está lutando, depois cada luta quando ela acaba (ninguém sabe
   de manhã quantas vai ter), as lutas dos outros se quiser, e o pódio
   quando a categoria termina. Cada etapa grava sozinha. O pódio só
   aceita nomes que já apareceram, e tempo não se pergunta: a luta
   vale o tempo oficial da faixa.
   ============================================================ */
export function situacaoDoCampeonato(s, lutas = []) {
  const c = s?.competicao || {};
  const p = c.podio || {};
  return {
    campeonato: !!String(c.evento || '').trim(),
    lutas: lutas.filter((r) => String(r.adversario || '').trim()).length,
    chave: (c.chave || []).filter((l) => String(l.a || '').trim() || String(l.b || '').trim()).length,
    podio: !c.andamento && (!!(p.ouro || p.prata || (p.bronze || []).some(Boolean)) || !!c.resultado),
  };
}

/* 1ª, 2ª, 3ª luta */
export const ordinal = (n) => `${n}ª`;

/* o tempo oficial da luta na IBJJF: só pra conta de horas no tatame */
const TEMPO_ADULTO = { branca: 5, azul: 6, roxa: 7, marrom: 8, preta: 10 };
const TEMPO_MASTER1 = { branca: 5, azul: 5, roxa: 6, marrom: 6, preta: 6 };
export function tempoDaLuta(faixa, divisao) {
  if (divisao === 'infantil') return 4;
  if (divisao === 'juvenil') return 5;
  if (divisao === 'master1') return TEMPO_MASTER1[faixa] || 5;
  if (String(divisao || '').startsWith('master')) return 5;
  return TEMPO_ADULTO[faixa] || 5;
}

/* venceu todas as lutas: o app já sugere você campeão e o último
   adversário vice (dá pra mudar) */
export function podioSugerido(lutas = []) {
  if (!lutas.length || !lutas.every((r) => placarDaRola(r).ganhou)) return null;
  return { ouro: EU, prata: String(lutas[lutas.length - 1].adversario || '').trim(), bronze: ['', ''] };
}

/* põe alguém num lugar do pódio (ou tira, com lugar null). Cada
   pessoa ocupa um lugar só; o 3º lugar tem duas vagas. */
export function colocarNoPodio(podio = {}, nome, lugar) {
  const mesmo = (x) => x && chaveDoNome(x) === chaveDoNome(nome);
  const novo = {
    ouro: mesmo(podio.ouro) ? '' : podio.ouro || '',
    prata: mesmo(podio.prata) ? '' : podio.prata || '',
    bronze: [...(podio.bronze || []), '', ''].slice(0, 2).map((x) => (mesmo(x) ? '' : x || '')),
  };
  if (lugar === 'ouro' || lugar === 'prata') novo[lugar] = nome;
  if (lugar === 'bronze') novo.bronze[novo.bronze[0] ? 1 : 0] = nome;
  return novo;
}
export function lugarNoPodio(podio = {}, nome) {
  const mesmo = (x) => x && chaveDoNome(x) === chaveDoNome(nome);
  if (mesmo(podio.ouro)) return 'ouro';
  if (mesmo(podio.prata)) return 'prata';
  if ((podio.bronze || []).some(mesmo)) return 'bronze';
  return null;
}
