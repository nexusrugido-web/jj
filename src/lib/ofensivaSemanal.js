/* Regra semanal v2. Independente de XP, metas e do cálculo diário legado.
   Calendário de Brasília, segunda a domingo. Registros retroativos recompõem
   a sequência pela data do treino; excluir ou editar também recompõe escudos. */
export const SEMANAS_POR_ESCUDO = 4;
export const MAX_ESCUDOS = 2;
const DIA = 86400000;

export function hojeOfensiva(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(agora);
  const ler = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${ler('year')}-${ler('month')}-${ler('day')}`;
}

function dataValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const d = new Date(`${data}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

export function somarDiasOfensiva(data, dias) {
  return new Date(Date.parse(`${data}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
}

export function semanaOfensiva(data = hojeOfensiva()) {
  const d = new Date(`${data}T00:00:00Z`);
  return somarDiasOfensiva(data, -((d.getUTCDay() + 6) % 7));
}

/* Uma competição planejada não é presença. O resultado registrado confirma
   participação. Para os demais tipos, salvar o treino
   é a declaração de presença, sem exigir reflexão, finalização ou XP. */
export function treinoDaOfensiva(sessao, ate = hojeOfensiva()) {
  if (!dataValida(sessao.data) || sessao.data > ate || sessao.evento) return false;
  if (!['gi', 'nogi', 'drill', 'openmat', 'privada', 'competicao'].includes(sessao.tipo || 'gi')) return false;
  if (sessao.tipo !== 'competicao') return true;
  return ['ouro', 'prata', 'bronze', 'participou'].includes(sessao.competicao?.resultado);
}

export function ofensivaSemanal(sessions = [], ate = hojeOfensiva(), lesoes = [], {
  maxEscudos = MAX_ESCUDOS,
} = {}) {
  if (!dataValida(ate)) throw new Error('Data inválida para a ofensiva semanal');
  const limite = maxEscudos === 3 ? 3 : MAX_ESCUDOS;
  const atual = semanaOfensiva(ate);
  const treinos = sessions.filter((s) => treinoDaOfensiva(s, ate));
  const semanasTreinadas = new Set(treinos.map((s) => semanaOfensiva(s.data)));
  const intervalos = lesoes.filter((l) => l.impacto === 'parado' && dataValida(l.data) && l.data <= ate)
    .map((l) => ({ inicio: l.data, fim: l.dataCura || l.fechadaEm || ate }))
    .filter((l) => dataValida(l.fim) && l.fim >= l.inicio);
  const pausada = (semana) => intervalos.some((l) => l.inicio <= somarDiasOfensiva(semana, 6) && l.fim >= semana);
  const primeira = [...semanasTreinadas].sort()[0];
  const historico = [];
  let semanas = 0;
  let recorde = 0;
  let escudos = 0;
  let gastos = 0;
  let progressoEscudo = 0;
  let desde = null;

  for (let semana = primeira; semana && semana <= atual; semana = somarDiasOfensiva(semana, 7)) {
    let estado;
    if (semanasTreinadas.has(semana)) {
      if (!semanas) desde = semana;
      semanas++;
      recorde = Math.max(recorde, semanas);
      progressoEscudo++;
      if (progressoEscudo === SEMANAS_POR_ESCUDO) {
        escudos = Math.min(limite, escudos + 1);
        progressoEscudo = 0;
      }
      estado = 'treinada';
    } else if (pausada(semana)) {
      estado = 'pausada';
    } else if (semana === atual) {
      estado = 'pendente';
    } else if (semanas > 0 && escudos > 0) {
      escudos--;
      gastos++;
      estado = 'protegida';
    } else {
      semanas = 0;
      progressoEscudo = 0;
      desde = null;
      estado = 'sem_treino';
    }
    historico.push({ semana, estado });
  }
  const treinouEstaSemana = semanasTreinadas.has(atual);
  const congelada = !treinouEstaSemana && pausada(atual);
  return {
    versao: 2, unidade: 'semanas', semanaAtual: atual, calculadaEm: ate,
    semanas, recorde, viva: semanas > 0, treinouEstaSemana, congelada,
    estado: treinouEstaSemana ? 'treinada' : congelada ? 'pausada' : 'pendente',
    escudos, maxEscudos: limite, gastos,
    faltaProEscudo: escudos >= limite ? 0 : SEMANAS_POR_ESCUDO - progressoEscudo,
    desde, historico,
    ultimoTreino: treinos.map((s) => s.data).sort().at(-1) || null,
  };
}

export function textoOfensivaSemanal(o) {
  if (o.congelada) return {
    titulo: 'Ofensiva pausada por lesão',
    texto: 'A pausa preserva sua sequência, sem somar semanas nem gastar escudos. Estudar é opcional e continua valendo XP.', tom: 'ice',
  };
  if (o.treinouEstaSemana) return {
    titulo: 'Semana garantida',
    texto: 'Seu treino manteve a ofensiva. A meta acompanha quantas vezes você quer treinar; o XP segue as regras de cada atividade.', tom: 'jade',
  };
  if (o.viva) return {
    titulo: 'Esta semana ainda está aberta',
    texto: o.escudos > 0
      ? 'Um treino mantém sua sequência. Se a semana terminar sem treino, um escudo protege sem acrescentar semanas.'
      : 'Um treino até domingo mantém sua sequência. Você ainda tem a semana para treinar.', tom: '',
  };
  return {
    titulo: o.recorde ? 'Seu próximo treino começa uma nova sequência' : 'Sua ofensiva começa no tatame',
    texto: 'Registre um treino realizado nesta semana. A ofensiva é semanal e independente da meta e dos pontos de estudo.', tom: '',
  };
}
