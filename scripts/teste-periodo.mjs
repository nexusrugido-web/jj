import { register } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/* ============================================================
   O PERÍODO ESCRITO NA TELA É O PERÍODO CONTADO

   "30 dias" é hoje e os 29 antes, nem 31 nem com o treino de
   amanhã. A semana começa na segunda. O ano vira sem perder dia.
   E tudo isso igual no Brasil, em Greenwich, do outro lado do
   mundo (+14) e em Santiago, onde o horário de verão começa à
   meia-noite e a meia-noite daquele dia não existe.

   O arquivo roda a si mesmo uma vez em cada fuso.
   ============================================================ */

const FUSOS = ['America/Sao_Paulo', 'UTC', 'Pacific/Kiritimati', 'America/Santiago'];

if (!process.env.FUSO_DO_TESTE) {
  let falhou = false;
  for (const TZ of FUSOS) {
    try {
      const saida = execFileSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, TZ, FUSO_DO_TESTE: TZ } });
      console.log(saida.toString().trim());
    } catch (e) {
      falhou = true;
      console.log(e.stdout?.toString().trim() || e.message);
    }
  }
  console.log(falhou ? '\nfalhou em algum fuso' : '\ntudo certo nos 4 fusos');
  process.exit(falhou ? 1 : 0);
}

register('./como-vite.mjs', import.meta.url);
const P = await import('../src/lib/periodo.js');
const { dataLocal } = await import('../src/lib/utils.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) {
    falhas++;
    console.log(`FALHA ${nome}: ${JSON.stringify(real)} (esperado ${JSON.stringify(esperado)})`);
  }
};
const faixa = (p) => [p.ini, p.fim, p.dias];

/* ---------- últimos 30 dias ---------- */
const trinta = P.periodoDeDados('ultimos-30', { hoje: '2026-09-19' });
ok('30 dias: hoje e os 29 antes', faixa(trinta), ['2026-08-21', '2026-09-19', 30]);
ok('30 dias é por dia', trinta.grao, 'dia');
ok('rótulo com as datas', P.rotuloDoPeriodo(trinta), 'Últimos 30 dias · 21/08 a 19/09');

const treinos = ['2026-08-20', '2026-08-21', '2026-09-19', '2026-09-20'].map((data) => ({ data }));
ok('a borda de dentro entra, a de fora e o futuro não',
  P.dentroDoPeriodo(treinos, trinta).map((s) => s.data), ['2026-08-21', '2026-09-19']);

ok('virada de mês com fevereiro curto', faixa(P.periodoDeDados('ultimos-30', { hoje: '2026-03-01' })), ['2026-01-31', '2026-03-01', 30]);
const virada = P.periodoDeDados('ultimos-30', { hoje: '2026-01-10' });
ok('virada de ano', faixa(virada), ['2025-12-12', '2026-01-10', 30]);
ok('rótulo que vira o ano leva o ano', P.rotuloDoPeriodo(virada), 'Últimos 30 dias · 12/12/2025 a 10/01/2026');
ok('atravessando o horário de verão de Santiago', faixa(P.periodoDeDados('ultimos-30', { hoje: '2026-09-10' })), ['2026-08-12', '2026-09-10', 30]);

/* ---------- semana ---------- */
ok('sábado: semana de segunda a domingo', faixa(P.periodoDeDados('semana-atual', { hoje: '2026-09-19' })), ['2026-09-14', '2026-09-20', 7]);
ok('segunda é o primeiro dia', P.periodoDeDados('semana-atual', { hoje: '2026-09-14' }).ini, '2026-09-14');
ok('domingo ainda é da mesma semana', P.periodoDeDados('semana-atual', { hoje: '2026-09-20' }).ini, '2026-09-14');
ok('semana do horário de verão de Santiago', faixa(P.periodoDeDados('semana-atual', { hoje: '2026-09-06' })), ['2026-08-31', '2026-09-06', 7]);
ok('semana que vira o ano', faixa(P.periodoDeDados('semana-atual', { hoje: '2027-01-01' })), ['2026-12-28', '2027-01-03', 7]);
ok('rótulo da semana', P.rotuloDoPeriodo(P.periodoDeDados('semana-atual', { hoje: '2026-09-19' })), 'Esta semana · 14/09 a 20/09');

/* ---------- meses, ano, desde ---------- */
ok('3 meses', faixa(P.periodoDeDados('3m', { hoje: '2026-09-19' })), ['2026-06-22', '2026-09-19', 90]);
ok('6 meses', faixa(P.periodoDeDados('6m', { hoje: '2026-09-19' })), ['2026-03-22', '2026-09-19', 182]);
const ano = P.periodoDeDados('ano-atual', { hoje: '2026-09-19' });
ok('este ano: de 1º de janeiro a hoje', faixa(ano), ['2026-01-01', '2026-09-19', 262]);
ok('este ano no 1º de janeiro', faixa(P.periodoDeDados('ano-atual', { hoje: '2026-01-01' })), ['2026-01-01', '2026-01-01', 1]);

const tudo = P.periodoDeDados('desde-inicio', { hoje: '2026-09-19', desde: '2025-03-10' });
ok('desde o início: do primeiro treino a hoje, por mês', [...faixa(tudo), tudo.grao], ['2025-03-10', '2026-09-19', 559, 'mes']);
ok('sem treino ainda: só hoje', faixa(P.periodoDeDados('desde-inicio', { hoje: '2026-09-19' })), ['2026-09-19', '2026-09-19', 1]);
const meta = P.periodoDeDados('desde-a-meta', { hoje: '2026-09-19', desde: '2026-09-01' });
ok('desde a meta', [...faixa(meta), meta.grao, meta.rotulo], ['2026-09-01', '2026-09-19', 19, 'dia', 'Desde a meta']);
ok('período que não existe vira 30 dias', P.periodoDeDados('xyz', { hoje: '2026-09-19' }).id, 'ultimos-30');

/* ---------- o dia é o do relógio de quem usa ---------- */
ok('23h30 ainda é hoje', dataLocal(new Date(2026, 8, 19, 23, 30)), '2026-09-19');
ok('0h05 já é amanhã', dataLocal(new Date(2026, 8, 20, 0, 5)), '2026-09-20');

/* ---------- calendário ---------- */
const sessions = [
  { id: 1, data: '2026-08-20', duracao: 60 },
  { id: 2, data: '2026-08-21', duracao: 60 },
  { id: 3, data: '2026-08-22', duracao: 60 },
  { id: 4, data: '2026-09-19', duracao: 90 },
  { id: 5, data: '2026-09-20', duracao: 60 },
];
const rolls = [
  { sessionId: 1 }, { sessionId: 2 }, { sessionId: 2, subsAplicadas: ['a'] }, { sessionId: 4 }, { sessionId: 5 },
];
const janela = P.janelaDoCalendario(sessions, rolls, { fim: '2026-09-19' });
const dias = janela.dias.filter(Boolean);
ok('janela do calendário = os mesmos 30 dias dos números', [janela.ini, janela.fim, dias.length], ['2026-08-21', '2026-09-19', 30]);
ok('sexta 21/08: 4 vazios antes, a semana começa na segunda', janela.dias.indexOf(dias[0]), 4);
ok('resumo só da janela', [janela.resumo.treinados, janela.resumo.horas, janela.resumo.rolas, janela.resumo.maiorSequencia], [3, 4, 3, 2]);
ok('rótulo da janela', P.rotuloDoPeriodo(janela), 'Últimos 30 dias · 21/08 a 19/09');

const setembro = P.mesDoCalendario(sessions, rolls, 2026, 8);
ok('mês do histórico: 1º de setembro é terça, 1 vazio', [setembro.ini, setembro.fim, setembro.dias.indexOf(setembro.dias.find(Boolean)), setembro.dias.filter(Boolean).length], ['2026-09-01', '2026-09-30', 1, 30]);
ok('resumo só do mês', [setembro.resumo.treinados, setembro.resumo.rolas], [2, 2]);
ok('rótulo do mês', setembro.rotulo, 'setembro de 2026');
ok('fevereiro de 2028 tem 29 dias', P.mesDoCalendario([], [], 2028, 1).dias.filter(Boolean).length, 29);

const doAno = P.calendarioDoAno(sessions, rolls, 2026);
ok('o ano continua com 12 meses e o resumo do ano', [doAno.meses.length, doAno.resumo.treinados, doAno.resumo.melhorMes?.nome], [12, 5, 'ago']);

const offset = new Date(2026, 8, 6, 12).getTimezoneOffset();
console.log(`${process.env.FUSO_DO_TESTE} (${offset > 0 ? '-' : '+'}${Math.abs(offset) / 60}h): ${falhas ? `${falhas} falha(s)` : 'ok'}`);
process.exit(falhas ? 1 : 0);
