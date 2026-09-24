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
const { resumo } = await import('../src/lib/stats.js');
const M = await import('../src/lib/metas.js');
const { calcularDefesa, posicoesSofridas } = await import('../src/lib/graus.js');
const { filtrarFeitas } = await import('../src/lib/recomendar.js');
const { hoje, addDias } = await import('../src/lib/utils.js');

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
ok('no botão, este ano é o ano', ano.rotuloCurto, '2026');
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


/* ---------- os blocos da Análise contam a mesma coisa ----------
   Borda de dentro, dia de fora, treino no futuro, rola sem
   parceiro, parceiro sem faixa e drill (que não é luta). */
const parceiros = [{ id: 'azul', faixa: 'azul' }, { id: 'semFaixa' }];
const treinosA = [
  { id: 'a0', data: '2026-03-20', duracao: 60 },
  { id: 'a1', data: '2026-08-20', duracao: 60 },
  { id: 'a2', data: '2026-08-21', duracao: 60 },
  { id: 'a3', data: '2026-09-10', duracao: 60 },
  { id: 'a4', data: '2026-09-19', duracao: 60 },
  { id: 'a5', data: '2026-09-20', duracao: 60 },
  { id: 'a6', data: '2025-09-19', duracao: 60 },
  { id: 'a7', data: '2025-09-20', duracao: 60 },
];
const fin = ['Americana'];
const rolasA = [
  { sessionId: 'a0', partnerId: 'azul', subsAplicadas: fin },
  { sessionId: 'a1', partnerId: 'azul', subsAplicadas: fin },
  { sessionId: 'a2', partnerId: 'azul', subsAplicadas: fin },
  { sessionId: 'a2', partnerId: 'azul', subsAplicadas: fin, contexto: 'drill' },
  { sessionId: 'a3', partnerId: 'semFaixa', ptsDele: ['passagem'] },
  { sessionId: 'a3', ptsMeus: ['montada'] },
  { sessionId: 'a4', partnerId: 'azul', subsSofridas: fin },
  { sessionId: 'a5', partnerId: 'azul', subsAplicadas: fin },
  { sessionId: 'a6', partnerId: 'azul', subsAplicadas: fin },
];
const noPeriodo = (p) => {
  const ses = P.dentroDoPeriodo(treinosA, p);
  const ids = new Set(ses.map((x) => x.id));
  return resumo(ses, rolasA.filter((r) => ids.has(r.sessionId)));
};
const soma = (serie, k) => serie.reduce((a, b) => a + b[k], 0);

const p30 = P.periodoDeDados('ultimos-30', { hoje: '2026-09-19' });
const r30 = noPeriodo(p30);
ok('resumo: 4 lutas (borda entra; véspera, futuro e drill não)', [r30.rolas, r30.vitorias, r30.derrotas, r30.taxaVitoria], [4, 2, 2, 50]);

const t30 = P.totaisComparados(treinosA, rolasA, parceiros, p30);
ok('Evolução soma igual ao resumo', [t30.atual.rolas, t30.atual.vitorias, t30.atual.taxaVitoria], [r30.rolas, r30.vitorias, r30.taxaVitoria]);
ok('o anterior são os 30 dias antes, até a véspera do início', t30.anterior.sessoes, 1);

const f30 = P.taxaPorFaixa(treinosA, rolasA, parceiros, p30, 'branca');
ok('Contra quem: com parceiro + sem parceiro = as lutas do resumo', f30.total.n + f30.semParceiro, r30.rolas);
ok('parceiro sem faixa conta como branca', f30.linhas.map((l) => [l.faixa, l.n]), [['branca', 1], ['azul', 2]]);

const s30 = P.serieDoPeriodo(treinosA, rolasA, parceiros, p30);
ok('o gráfico de 30 dias tem 30 pontos e soma igual', [s30.serie.length, soma(s30.serie, 'rolas'), soma(s30.serie, 'vitorias')], [30, 4, 2]);

const j30 = P.janelaDoCalendario(treinosA, rolasA, { fim: '2026-09-19' });
ok('o calendário conta as mesmas lutas', j30.resumo.rolas, r30.rolas);

const p6 = P.periodoDeDados('6m', { hoje: '2026-09-19' });
const s6 = P.serieDoPeriodo(treinosA, rolasA, parceiros, p6);
ok('6 meses: a primeira semana começa no início do período, não na segunda antes', [s6.serie[0].ini, s6.serie[0].label], ['2026-03-22', '22/03']);
ok('e o último balde não passa de hoje', s6.serie[s6.serie.length - 1].fim, '2026-09-19');
ok('6 meses: gráfico, totais e resumo batem', [soma(s6.serie, 'rolas'), P.totaisComparados(treinosA, rolasA, parceiros, p6).atual.rolas], [noPeriodo(p6).rolas, noPeriodo(p6).rolas]);

const pAno = P.periodoDeDados('ano-atual', { hoje: '2026-09-19' });
const tAno = P.totaisComparados(treinosA, rolasA, parceiros, pAno);
ok('este ano compara com o mesmo trecho do ano passado', [tAno.anterior.sessoes, tAno.atual.rolas], [1, noPeriodo(pAno).rolas]);

const tTudo = P.totaisComparados(treinosA, rolasA, parceiros, P.periodoDeDados('desde-inicio', { hoje: '2026-09-19', desde: P.primeiroTreino(treinosA) }));
ok('desde o início não tem anterior pra comparar', [tTudo.anterior, tTudo.variacao], [null, {}]);
ok('e o contexto da vitória não quebra sem anterior', P.contextoDaVitoria(tTudo.atual, tTudo.anterior) === undefined, false);
ok('o primeiro treino é o mais antigo, não o primeiro da lista', P.primeiroTreino(treinosA), '2025-09-19');

/* ---------- cada meta diz de quando é a conta ----------
   Contas feitas com o relógio de verdade, então as datas são
   relativas a hoje. */
const H = hoje();
const antes = (n) => addDias(H, -n);
const semanaAgora = P.periodoDeDados('semana-atual');
const treinosM = [
  { id: 'm1', data: H, duracao: 120 },
  { id: 'm2', data: antes(29), duracao: 60 },
  { id: 'm3', data: antes(30), duracao: 60 },
  { id: 'm4', data: antes(95), duracao: 60 },
  { id: 'm5', data: `${H.slice(0, 4)}-01-01`, duracao: 60 },
];
const assumida = (x) => ({ origem: 'usuario', ...x });
const prog = (x, dados = {}) => M.progressoDaMeta(assumida(x), { sessions: treinosM, ...dados });

const freq = prog({ tipo: 'frequencia', alvo: 3 });
ok('frequência: conta a semana e escreve qual', [freq.atual, freq.valor, freq.quando],
  [P.dentroDoPeriodo(treinosM, semanaAgora).length, `${P.dentroDoPeriodo(treinosM, semanaAgora).length} de 3`, 'Esta semana']);
ok('a meta diz o período pelo nome, sem o intervalo de datas', freq.quando.includes('/'), false);

const buracosM = [{ nome: 'Americana', recente: 2, ultima: addDias(hoje(), -10) }];
const defesa = prog({ tipo: 'defesa', alvo: 'Americana', ajuste: 3 }, { buracos: buracosM });
ok('defesa: dias sem ser pego, a barra anda', [defesa.valor, defesa.pct, defesa.semBotao], ['10 de 30 dias', 33, true]);
ok('defesa: diz desde quando, em português', defesa.quando.startsWith('Sem bater pra americana desde'), true);
ok('defesa: ajuste antigo (da conta invertida) não entra', defesa.atual, 10);
ok('defesa de quem nunca te pegou é meta batida', prog({ tipo: 'defesa', alvo: 'Kimura' }, { buracos: buracosM }).pct, 100);
ok('pego hoje: a contagem recomeça', prog({ tipo: 'defesa', alvo: 'Americana' }, { buracos: [{ nome: 'Americana', ultima: hoje() }] }).atual, 0);

const sofridas = [antes(29), antes(30), H].map((data) => ({ data }));
ok('o "recente" da defesa são os mesmos 30 dias', calcularDefesa(sofridas).recente, 2);

ok('treinos: desde o primeiro treino', [prog({ tipo: 'treinos', alvo: 100 }).valor, prog({ tipo: 'treinos', alvo: 100 }).quando], ['5 de 100', 'Desde o primeiro treino']);

const volume = prog({ tipo: 'volume', alvo: 10 });
const em90 = treinosM.filter((x) => x.data >= antes(89) && x.data <= H).reduce((a, x) => a + x.duracao, 0);
ok('horas sem data de início: 3 meses, com h', [volume.valor, volume.quando.startsWith('Últimos 3 meses')], [`${Math.round(em90 / 60)}h de 10h`, true]);
const doDia = prog({ tipo: 'rolas', alvo: 5, inicio: antes(10) }, { rolls: [{ sessionId: 'm1' }, { sessionId: 'm2' }, { sessionId: 'm1', contexto: 'drill' }] });
ok('meta com início conta desde a meta', [doDia.valor, doDia.quando.startsWith('Desde a meta')], ['1 de 5', true]);

const horas = M.metaDeHorasNoAno(treinosM, 200);
const noAno = treinosM.filter((s) => s.data.slice(0, 4) === H.slice(0, 4)).reduce((a, s) => a + s.duracao, 0);
ok('horas no ano: meta como as outras, com o período', [horas.valor, horas.quando], [`${Math.round(noAno / 60)}h de 200h`, 'Este ano']);

/* ---------- as janelas que não vão pra tela ---------- */
ok('ultimosDias: n dias até hoje, inclusivos', faixa(P.ultimosDias(14, { hoje: '2026-09-19' })), ['2026-09-06', '2026-09-19', 14]);
const presoEm = [H, antes(29), antes(30)].map((data, i) => ({ id: 'p' + i, data }));
const presas = posicoesSofridas(presoEm.map((x) => ({ sessionId: x.id, posInicial: 'cem_baixo' })), presoEm);
ok('onde você fica preso: recente são os mesmos 30 dias', [presas[0].vezes, presas[0].recente], [3, 2]);
const feitasR = [{ chave: 'corrigir:Americana', data: antes(13), resultado: 'funcionou' }, { chave: 'corrigir:Kimura', data: antes(14), resultado: 'funcionou' }];
ok('recomendação feita descansa 14 dias, contando hoje', filtrarFeitas([{ intencao: 'corrigir', alvo: 'Americana' }, { intencao: 'corrigir', alvo: 'Kimura' }], feitasR).map((r) => r.alvo), ['Kimura']);

const offset = new Date(2026, 8, 6, 12).getTimezoneOffset();
console.log(`${process.env.FUSO_DO_TESTE} (${offset > 0 ? '-' : '+'}${Math.abs(offset) / 60}h): ${falhas ? `${falhas} falha(s)` : 'ok'}`);
process.exit(falhas ? 1 : 0);
