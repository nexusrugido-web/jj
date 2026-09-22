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
    if (error) throw error;
    await setMeta('liga_marca', marca);
  }

  /* a ofensiva sobe junto: é ela que o ranking e o grupo mostram */
  const dias = ofensiva(await db.pontos.toArray()).dias;
  const chaveSeq = `${uid}:${dias}`;
  if ((await getMeta('liga_sequencia', null)) !== chaveSeq) {
    const { error } = await supabase.from('perfil').update({ sequencia: dias }).eq('user_id', uid);
    if (!error) await setMeta('liga_sequencia', chaveSeq);
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
