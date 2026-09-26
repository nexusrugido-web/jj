import { supabase } from './supabase';
import { db, getMeta, setMeta } from '../db/db';
import { semanaDe } from './xp';
import { hoje, addDias } from './utils';
import { ofensiva } from './ofensiva';

/* ============================================================
   A LIGA, DO LADO DO APARELHO

   O ponto nasce no aparelho (src/lib/xp.js) e a liga mora no
   servidor. Antes, o ponto só subia quando a pessoa abria a liga
   e tocava em Atualizar: a Jornada mostrava 20 pontos e a liga
   mostrava zero, e ninguém entrava em grupo nenhum.

   Agora sobe sozinho: quando um ponto nasce, quando o app abre e
   quando ele volta pra frente. É o primeiro ponto da semana que
   coloca a pessoa na corrida (supabase/liga-automatica.sql).

   Sobem os pontos desta semana e da passada, porque a passada só
   fecha segunda ao meio-dia: o treino de domingo registrado na
   segunda de manhã ainda conta. O servidor ignora o que já tem
   (cada ponto tem o seu identificador), então mandar de novo não
   duplica nada. Mesmo assim, só manda quando alguma coisa mudou.

   Junto vai a sequência de semanas, a mesma do Painel, pra
   aparecer do lado do nome no grupo.
   ============================================================ */

/* ============================================================
   O NOME DAS DIVISÕES

   O servidor guarda branca, azul, roxa, marrom e preta. Na tela
   isso confundia com a faixa de verdade: um faixa branca aparecia
   na "divisão preta". O nome agora é o do circuito de campeonato,
   que todo mundo que treina reconhece e ninguém confunde com faixa.
   ============================================================ */
export const DIVISOES_LIGA = {
  branca: { nome: 'Academia', tom: '' },
  azul: { nome: 'Estadual', tom: '' },
  roxa: { nome: 'Nacional', tom: 'jade' },
  marrom: { nome: 'Pan', tom: 'on' },
  preta: { nome: 'Mundial', tom: 'warn' },
};
export const nomeDivisao = (id) => (DIVISOES_LIGA[id] || DIVISOES_LIGA.branca).nome;

let emCurso = null;
let espera = null;

export function agendarSubida(ms = 3000) {
  clearTimeout(espera);
  espera = setTimeout(() => { subirPraLiga().catch(() => {}); }, ms);
}

export function subirPraLiga() {
  if (!supabase) return Promise.resolve(false);
  if (!emCurso) {
    emCurso = subir().finally(() => { emCurso = null; });
  }
  return emCurso;
}

async function subir() {
  const { data } = await supabase.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) return false;

  const semanas = [semanaDe(), semanaDe(addDias(hoje(), -7))];
  const linhas = await db.pontos.where('semana').anyOf(semanas).toArray();

  /* a impressão digital do que tem pra mandar: mudou, manda */
  const marca = `${uid}:${semanas[0]}:${linhas.length}:${Math.max(0, ...linhas.map((l) => l.criadoEm || 0))}`;
  if (linhas.length && (await getMeta('liga_marca', null)) !== marca) {
    const { error } = await supabase.rpc('subir_pontos', {
      p_linhas: linhas.map((l) => ({
        evento: l.evento,
        refId: l.refId || `local:${l.uid || l.id}`,
        detalhe: l.detalhe,
        data: l.data,
      })),
    });
    /* falhar aqui não pode impedir a ofensiva de subir logo
       abaixo: são duas coisas independentes, e antes um throw
       daqui matava a outra em silêncio. Quem chama engole o erro,
       então sem este log não sobrava rastro nenhum. */
    if (error) console.error('[liga] pontos', error);
    else await setMeta('liga_marca', marca);
  }

  /* a ofensiva sobe junto: é ela que o ranking e o grupo mostram */
  const dias = ofensiva(await db.pontos.toArray()).dias;
  const chaveSeq = `${uid}:${dias}`;
  if ((await getMeta('liga_sequencia', null)) !== chaveSeq) {
    const { error } = await supabase.from('perfil').update({ sequencia: dias }).eq('user_id', uid);
    if (error) console.error('[liga] ofensiva', error);
    else await setMeta('liga_sequencia', chaveSeq);
  }
  return true;
}

/* ============================================================
   AS REGRAS QUE A TELA ESPELHA

   Iguais às do fechamento no servidor: o corte do painel, mas
   nunca mais que um terço do grupo. Com 2, um sobe e ninguém
   desce. Com 3, um sobe e um desce. Sozinho, não correu.
   ============================================================ */
export function corteDoGrupo(n, corte = 3) {
  if (n < 2) return { sobem: 0, descem: 0 };
  const c = Math.max(1, Math.min(corte, Math.floor(n / 3)));
  return { sobem: c, descem: n >= c * 2 + 1 ? c : 0 };
}

/* "pra Academia", "pro Estadual": a divisão com o artigo certo */
export const praDivisao = (id) => (id === 'branca' || !DIVISOES_LIGA[id] ? 'pra Academia' : `pro ${nomeDivisao(id)}`);
export const naDivisao = (id) => (id === 'branca' || !DIVISOES_LIGA[id] ? 'na Academia' : `no ${nomeDivisao(id)}`);

/* ============================================================
   O RELÓGIO DA SEMANA

   A semana da liga vai de segunda a domingo e fecha na segunda ao
   meio-dia, no horário de Brasília (o servidor roda às 15h no horário universal).
   Entre meia-noite e meio-dia de segunda a semana nova já começou,
   mas a passada ainda está sendo apurada: o treino de domingo
   registrado nesse meio-tempo ainda conta pra ela.
   ============================================================ */
const BRASILIA = -3 * 3600 * 1000; // sem horário de verão desde 2019
const DIA = 24 * 3600 * 1000;

export function relogioDaLiga(agora = new Date()) {
  const br = new Date(agora.getTime() + BRASILIA);
  const diaDaSemana = (br.getUTCDay() + 6) % 7; // segunda = 0
  const meiaNoite = Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()) - BRASILIA;
  const segunda = meiaNoite - diaDaSemana * DIA;
  const apurando = diaDaSemana === 0 && br.getUTCHours() < 12;
  return {
    /* o dia da semana em Brasília (0 = segunda) e se a passada ainda está aberta */
    diaDaSemana,
    apurando,
    /* quando esta semana fecha, e quando sai o resultado da passada (só na segunda de manhã) */
    fecha: new Date(segunda + 7 * DIA + 12 * 3600 * 1000),
    resultadoDaPassada: apurando ? new Date(segunda + 12 * 3600 * 1000) : null,
  };
}

/* "2d 5h", "5h 20min", "12min" */
export function faltaTexto(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m ? `${h}h ${m}min` : `${h}h`;
  return m > 0 ? `${m}min` : 'menos de 1min';
}

/* ============================================================
   O RESULTADO DA SEMANA EM PALAVRAS

   A linha de minha_semana_passada() (supabase/liga-resultado.sql)
   vira o que a tela diz: o título grande, a frase e o tom.
   ============================================================ */
export function resultadoEmPalavras(r) {
  if (!r) return null;
  const lugar = `${r.posicao}º de ${r.total}`;
  const pts = `${r.xp} ${r.xp === 1 ? 'ponto' : 'pontos'}`;
  if (!r.fechada) {
    return { tom: 'accent', titulo: 'Apurando a semana passada', texto: `Você está em ${lugar}, com ${pts}. O resultado sai hoje ao meio-dia, e o treino de domingo registrado até lá ainda conta.` };
  }
  switch (r.resultado) {
    case 'subiu': return { tom: 'jade', titulo: `Você subiu ${praDivisao(r.divisao_depois)}`, texto: `Terminou em ${lugar}, com ${pts}. Nesta semana você corre num grupo da nova divisão.` };
    case 'desceu': return { tom: 'blood', titulo: `Você desceu ${praDivisao(r.divisao_depois)}`, texto: `Terminou em ${lugar}, com ${pts}. Uma semana boa e você volta.` };
    case 'ficou': return { tom: '', titulo: `Você continua ${naDivisao(r.divisao_depois)}`, texto: `Terminou em ${lugar}, com ${pts}. Pra subir, é terminar entre os primeiros do grupo.` };
    case 'sozinho': return { tom: '', titulo: 'Ninguém correu com você', texto: `Ninguém do seu ritmo pontuou na semana passada, então não teve corrida: ninguém sobe nem desce sozinho. Os seus ${pts} continuam no seu total.` };
    default: return { tom: '', titulo: `Você terminou em ${r.posicao}º`, texto: `De ${r.total} no grupo, com ${pts}.` };
  }
}

/* o nome como aparece pros outros, pra mostrar antes de salvar */
export function nomeCurto(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return 'Praticante';
  const cap = (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  if (partes.length === 1) return cap(partes[0]);
  return `${cap(partes[0])} ${partes[partes.length - 1].charAt(0).toUpperCase()}.`;
}

/* ============================================================
   OS PONTOS QUE O APARELHO PERDEU

   A liga guarda uma cópia de cada ponto no servidor (public.pontos,
   que só o dono lê). Quem reinstala o app ou limpa o navegador volta
   com os treinos da nuvem, mas sem os pontos que ainda estavam na
   fila de envio, e a ofensiva zerava. Aqui o aparelho pega de volta
   o que o servidor tem e ele não. Não apaga nada, só completa.
   ============================================================ */
export async function restaurarPontos() {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from('pontos')
    .select('evento, xp, ref_id, detalhe, data, semana, mes, criado_em')
    .order('criado_em', { ascending: true })
    .limit(5000);
  if (error || !data?.length) return 0;

  const locais = await db.pontos.toArray();
  const tem = new Set(locais.map((p) => `${p.evento}|${p.refId}`));
  /* o servidor guarda "local:<uid>" quando o ponto não tinha refId */
  const temUid = new Set(locais.map((p) => `local:${p.uid || p.id}`));
  let n = 0;
  for (const p of data) {
    if (tem.has(`${p.evento}|${p.ref_id}`) || temUid.has(p.ref_id)) continue;
    await db.pontos.add({
      evento: p.evento,
      xp: p.xp,
      refId: p.ref_id,
      detalhe: p.detalhe || '',
      data: p.data,
      semana: p.semana,
      mes: p.mes,
      ano: String(p.data).slice(0, 4),
      criadoEm: Date.parse(p.criado_em) || Date.now(),
    });
    n += 1;
  }
  return n;
}
