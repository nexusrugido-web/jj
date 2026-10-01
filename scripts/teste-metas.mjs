import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);

/* ============================================================
   AS METAS FALAM A MESMA LÍNGUA

   As horas de tatame nascem do ritmo (treinos por semana × semanas
   que faltam × duração do treino), e meta que depende de técnica não
   existe sem técnica. Casos pedidos em 30/09/2026.
   ============================================================ */
const { horasPeloRitmo, alvoDeHoras, ritmoSemanal, modoDasHoras, metaIncompleta, progressoDaMeta } = await import('../src/lib/metas.js');
const { hoje, addDias } = await import('../src/lib/utils.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}${bom ? '' : `\n      veio ${JSON.stringify(real)}, esperava ${JSON.stringify(esperado)}`}`);
};

/* ---------- a conta ---------- */
const set30 = horasPeloRitmo({ frequencia: 5, duracaoMin: 90, desde: '2026-09-30' });
ok('30/09 com 5x por semana de 1h30: 13 semanas, 66 treinos, 99h', [set30.semanas, set30.treinos, set30.horas], [13, 66, 99]);
const horasPorRitmo = [1, 2, 3, 4, 5].map((f) => horasPeloRitmo({ frequencia: f, duracaoMin: 90, desde: '2026-09-30' }).horas);
ok('1 a 5 treinos por semana dão horas diferentes e crescentes', horasPorRitmo.every((h, i) => i === 0 || h > horasPorRitmo[i - 1]), true);
ok('o dobro do ritmo dá o dobro das horas (arredondando)', Math.abs(horasPorRitmo[3] - 2 * horasPorRitmo[1]) <= 2, true);
const jan = horasPeloRitmo({ frequencia: 3, duracaoMin: 90, desde: '2026-01-01' });
const out = horasPeloRitmo({ frequencia: 3, duracaoMin: 90, desde: '2026-10-01' });
ok('em janeiro a meta é do ano inteiro (3x de 1h30: 156 treinos, 234h)', [jan.treinos, jan.horas], [156, 234]);
ok('em outubro, só o que falta do ano', out.horas < jan.horas / 3, true);
ok('a duração do treino entra na conta: 1h dá menos que 1h30', horasPeloRitmo({ frequencia: 3, duracaoMin: 60, desde: '2026-10-01' }).horas < out.horas, true);

/* ---------- de onde vem o alvo ---------- */
const novo = { metaSemanal: 5, metaAnualHorasModo: 'derivada', metaAnualHorasDesde: '2026-09-30' };
ok('aluno novo: o alvo sai do ritmo, com a origem explicada', [alvoDeHoras(novo, [], [], '2026-09-30').alvo, alvoDeHoras(novo, [], [], '2026-09-30').origem],
  [99, 'calculada pelo seu ritmo: 5x por semana']);
ok('a meta de frequência assumida manda no ritmo', ritmoSemanal({ metaSemanal: 2 }, [{ tipo: 'frequencia', alvo: 4, status: 'ativa', origem: 'confirmada' }]), 4);
ok('sugestão não confirmada não manda no ritmo', ritmoSemanal({ metaSemanal: 2 }, [{ tipo: 'frequencia', alvo: 4, status: 'ativa', origem: 'sugerida' }]), 2);
ok('mudou o ritmo: a meta derivada acompanha', alvoDeHoras({ ...novo, metaSemanal: 3 }, [], [], '2026-09-30').alvo < 99, true);
ok('número escolhido na mão não é sobrescrito pelo ritmo', alvoDeHoras({ ...novo, metaAnualHorasModo: 'manual', metaAnualHoras: 150 }, [], [], '2026-09-30').alvo, 150);
ok('quem desligou não tem meta de horas', alvoDeHoras({ ...novo, metaAnualHorasModo: 'desligada' }, [], [], '2026-09-30'), null);
ok('virada de ano: a meta derivada passa a valer o ano novo inteiro', alvoDeHoras({ ...novo, metaSemanal: 3 }, [], [], '2027-01-01').desde, '2027-01-01');
ok('conta antiga nos 200h prontos vira derivada; outro número fica manual', [modoDasHoras({ metaAnualHoras: 200 }), modoDasHoras({ metaAnualHoras: 300 }), modoDasHoras({ metaAnualHoras: 0 })], ['derivada', 'manual', 'desligada']);
ok('conta antiga derivada conta do primeiro treino do ano',
  alvoDeHoras({ metaSemanal: 3, metaAnualHoras: 200 }, [], [{ data: '2026-08-01' }, { data: '2025-12-30' }], '2026-09-30').desde, '2026-08-01');

/* ---------- meta que depende de técnica ---------- */
ok('defesa sem técnica é incompleta', metaIncompleta({ tipo: 'defesa', alvo: '' }), true);
ok('técnica sem nome é incompleta', metaIncompleta({ tipo: 'tecnica', alvo: '  ' }), true);
ok('defesa com técnica acompanha', metaIncompleta({ tipo: 'defesa', alvo: 'Americana' }), false);
ok('frequência não depende de técnica', metaIncompleta({ tipo: 'frequencia', alvo: 5 }), false);

/* ---------- defesa: conta a partir do começo da meta (o bug de 30/09) ---------- */
const defesaNova = { tipo: 'defesa', alvo: 'Americana da guarda', origem: 'usuario', status: 'ativa', inicio: hoje() };
ok('meta de defesa recém-criada, nunca pego: não nasce batida', progressoDaMeta(defesaNova, { buracos: [] }).pct, 0);
ok('10 dias depois do começo, sem ser pego: 10 de 30', progressoDaMeta({ ...defesaNova, inicio: addDias(hoje(), -10) }, { buracos: [] }).atual, 10);
ok('pego depois do começo: conta da última vez', progressoDaMeta({ ...defesaNova, inicio: addDias(hoje(), -20) }, { buracos: [{ nome: 'Americana da guarda', ultima: addDias(hoje(), -3) }] }).atual, 3);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
