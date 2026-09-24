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
