import { pertoDoGrau } from './graus';
import { hoje, addDias } from './utils';
import { semanaDe } from './xp';

/* ============================================================
   O TREINO DE HOJE

   Antes do treino, nos dias em que a pessoa costuma treinar (2 ou
   mais treinos naquele dia da semana nas últimas 6 semanas, a mesma
   conta do aviso pós-treino no servidor), um cartão curto junta o
   que o app já sabe:
     - a técnica que está perto de subir de grau
     - o que mais te finaliza
     - a posição inicial de onde você mais ganha
     - a meta de treinos da semana
   Nada inventado: cada linha só aparece com dado que sustente.
   ============================================================ */
/* o artigo pelo nome da técnica: 'a Americana', 'o Armlock'. Termina em
   'a' é feminino; algumas femininas não terminam em 'a' (a Chave de pé) */
const FEMININAS = ['chave', 'passagem', 'raspagem', 'pegada', 'queda', 'montada', 'finalização', 'gravata'];
export function artigo(nome = '') {
  /* a primeira palavra manda; com hífen, a última parte dela (o Mata-leão) */
  const primeira = String(nome).trim().split(/\s+/)[0].split('-').pop().toLowerCase();
  return primeira.endsWith('a') || FEMININAS.includes(primeira) ? 'a' : 'o';
}

const isoDow = (iso) => ((new Date(`${iso}T12:00:00`).getDay() + 6) % 7) + 1;

export function diasDeTreino(sessions = [], hj = hoje()) {
  const desde = addDias(hj, -42);
  const conta = {};
  for (const s of sessions) {
    if (!s.data || s.data < desde || s.data >= hj || s.tipo === 'competicao') continue;
    const d = isoDow(s.data);
    conta[d] = (conta[d] || 0) + 1;
  }
  return Object.keys(conta).filter((d) => conta[d] >= 2).map(Number).sort();
}

/* a posição de hoje: o tema da aula da semana que ainda não chegou no
   rola; senão, a posição em que você só tem uma saída */
export function posicaoDeHoje({ sessions = [], repertorio = [], positions = [], hj = hoje() }) {
  const desde = addDias(hj, -7);
  const nomeDe = (slug) => positions.find((p) => p.slug === slug)?.nome;
  const daSemana = [...sessions].filter((s) => s.data >= desde && s.data <= hj)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))
    .flatMap((s) => s.focoPosicoes || []);
  const usada = new Set(repertorio.map((p) => p.slug));
  const tema = daSemana.find((slug) => !usada.has(slug) && nomeDe(slug));
  if (tema) {
    const nome = nomeDe(tema);
    return { id: 'posicao', icone: '🧩', forte: nome, texto: `Leva pro rola a aula de ${nome}: nenhuma saída dessa posição entrou ainda` };
  }
  const unica = repertorio.find((p) => p.tecnicas.length === 1 && p.usos >= 3);
  if (unica) {
    return { id: 'posicao', icone: '🧩', forte: unica.nome, texto: `Da posição ${unica.nome} você só tem 1 saída: tenta outra hoje` };
  }
  return null;
}

export function treinoDeHoje({ sessions = [], esteira = [], buracos = [], jogo = null, metaSemanal = 0, hj = hoje(), repertorio = [], positions = [] }) {
  const diaDeTreino = diasDeTreino(sessions, hj).includes(isoDow(hj));
  const treinouHoje = sessions.some((s) => s.data === hj);
  const linhas = [];

  const perto = pertoDoGrau(esteira);
  if (perto) {
    linhas.push({ id: 'grau', icone: '🎯', forte: perto.nome, texto: `Tenta ${artigo(perto.nome)} ${perto.nome}: falta ${perto.usos} ${perto.usos === 1 ? 'uso' : 'usos'} pro ${perto.grau}º grau` });
  }

  const pega = buracos.find((b) => (b.vezes || 0) >= 2);
  if (pega) {
    linhas.push({ id: 'cuidado', icone: '⚠️', forte: pega.nome, texto: `Cuidado com ${artigo(pega.nome)} ${pega.nome}: te pegou ${pega.vezes} vezes` });
  }

  /* de onde você mais ganha: posição com 3+ rolas e mais da metade vencida */
  const melhor = (jogo?.porPosicao || [])
    .filter((p) => p.n >= 3 && p.v / p.n > 0.5)
    .sort((a, b) => b.v / b.n - a.v / a.n || b.n - a.n)[0];
  if (melhor) {
    linhas.push({ id: 'comeco', icone: '🥋', forte: melhor.nome.toLowerCase(), texto: `Começa ${melhor.nome.toLowerCase()}: você ganha ${melhor.v} de ${melhor.n} rolas assim` });
  }

  const pos = posicaoDeHoje({ sessions, repertorio, positions, hj });
  if (pos) linhas.push(pos);

  const meta = Number(metaSemanal) || 0;
  if (meta > 0) {
    const ini = semanaDe(hj);
    const feitos = sessions.filter((s) => s.data >= ini && s.data <= hj && s.tipo !== 'competicao').length;
    if (feitos < meta) linhas.push({ id: 'semana', icone: '📅', forte: `${feitos} de ${meta}`, texto: `${feitos} de ${meta} treinos na semana: hoje conta` });
  }

  return { diaDeTreino, treinouHoje, linhas, mostrar: diaDeTreino && !treinouHoje && linhas.length > 0 };
}
