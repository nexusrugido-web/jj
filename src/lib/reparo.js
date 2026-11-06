import { db } from '../db/db';
import { SEED } from '../db/seed';
import { uidEstavel, chaveNome } from './uid';
import { nomeAtual } from '../db/renomeios';

/* ============================================================
   REPARO DAS RELAÇÕES QUE JÁ ESTÃO NO APARELHO (S4, 06/11/2026)

   Até a S3, o registro que vinha de outro aparelho chegava com o
   número local de lá (rola → treino nº 3), e aqui o nº 3 podia ser
   outro treino. A S3 corrigiu daqui pra frente; isto confere o que
   já está gravado. Só corrige com prova, nunca por aproximação:

   - rola: o rola é sempre gravado com a data do treino. Se o treino
     apontado tem a mesma data, fica. Se não tem e existe UM treino
     só naquela data, liga nele. Senão, fica como está (incerto).
   - treino: academia, professor e técnica do foco guardam o nome
     junto. Se o apontado tem outro nome e existe UM com aquele nome,
     liga nele. Senão, fica como está (incerto).
   - ponto: mesma regra do rola, pela data do ponto.
   - técnica da biblioteca: categoria e posições voltam às do
     catálogo, pelo uid (é a mesma técnica em todo aparelho).
   - sem prova nenhuma (parceiro do rola, técnica criada pelo atleta,
     academia do professor, padrões das configurações): não mexe,
     só conta.

   simular: só conta, não grava nada. Aplicado, o que mudou sobe
   pra nuvem já com os ids permanentes (S3) e conserta os outros
   aparelhos; a técnica da biblioteca é ajeitada só aqui, sem subir.
   ============================================================ */

const DA_BIBLIOTECA = new Map(SEED.techniques.flatMap((t) =>
  [t.antigo || t.pt, ...(t.juntou || [])].map((n) => [uidEstavel(chaveNome('techniques', n)), t])));

const limpo = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/* o único registro com aquele valor, ou null (nenhum ou mais de um) */
function unico(lista, igual) {
  const achados = lista.filter(igual);
  return achados.length === 1 ? achados[0] : null;
}

export async function repararRelacoes({ simular = true } = {}) {
  const r = {
    rolas: { conferidos: 0, corrigidos: 0, incertos: 0 },
    parceiros: { semProva: 0 },
    treinos: { corrigidos: 0, incertos: 0 },
    pontos: { corrigidos: 0, incertos: 0 },
    biblioteca: { corrigidas: 0 },
    tecnicasProprias: { semProva: 0 },
    campos: {},
  };
  const mudou = (tabela, campo) => { r.campos[`${tabela}.${campo}`] = (r.campos[`${tabela}.${campo}`] || 0) + 1; };

  const sessoes = await db.sessions.toArray();
  const porId = new Map(sessoes.map((s) => [s.id, s]));
  const naData = (data) => unico(sessoes, (s) => s.data === data);

  /* rolas */
  for (const rola of await db.rolls.toArray()) {
    if (rola.partnerId) r.parceiros.semProva++;
    if (rola.sessionId == null) continue;
    const atual = porId.get(rola.sessionId);
    if (atual && rola.data && atual.data === rola.data) { r.rolas.conferidos++; continue; }
    const certo = rola.data ? naData(rola.data) : null;
    if (!certo) { r.rolas.incertos++; continue; }
    r.rolas.corrigidos++; mudou('rolls', 'sessionId');
    if (!simular) await db.rolls.update(rola.id, { sessionId: certo.id });
  }

  /* treinos: academia, professor e foco, pelo nome guardado junto */
  const academias = await db.academies.toArray();
  const professores = await db.professors.toArray();
  const tecnicas = await db.techniques.toArray();
  const tecPorId = new Map(tecnicas.map((t) => [t.id, t]));
  for (const s of sessoes) {
    const patch = {};
    let incerto = false;
    const religar = (campo, lista, nome) => {
      const id = s[campo];
      if (id == null || !String(nome || '').trim()) return;
      const atual = lista.find((x) => x.id === id);
      if (atual && limpo(atual.nome) === limpo(nome)) return;
      const certo = unico(lista, (x) => limpo(x.nome) === limpo(nome));
      if (certo) { patch[campo] = certo.id; mudou('sessions', campo); } else incerto = true;
    };
    religar('academiaId', academias, s.academia);
    religar('professorId', professores, s.professor);
    if (Array.isArray(s.focoTecnicas) && s.focoTecnicas.some((f) => f?.tecnicaId != null)) {
      let trocou = false;
      const foco = s.focoTecnicas.map((f) => {
        if (f?.tecnicaId == null || !f.nome) return f;
        const atual = tecPorId.get(f.tecnicaId);
        if (atual && (atual.nome === f.nome || atual.nome === nomeAtual(f.nome))) return f;
        const certo = unico(tecnicas, (t) => t.nome === f.nome || t.nome === nomeAtual(f.nome));
        if (!certo) { incerto = true; return f; }
        trocou = true;
        return { ...f, tecnicaId: certo.id };
      });
      if (trocou) { patch.focoTecnicas = foco; mudou('sessions', 'focoTecnicas.tecnicaId'); }
    }
    if (incerto) r.treinos.incertos++;
    if (!Object.keys(patch).length) continue;
    r.treinos.corrigidos++;
    if (!simular) await db.sessions.update(s.id, patch);
  }

  /* pontos: "treino:12" pela data do ponto */
  for (const p of await db.pontos.toArray()) {
    const m = String(p.refId || '').match(/^(treino|competicao|rola):(\d+)(.*)$/);
    if (!m || !p.data) continue;
    const atual = porId.get(Number(m[2]));
    if (atual && atual.data === p.data) continue;
    const certo = naData(p.data);
    if (!certo) { r.pontos.incertos++; continue; }
    r.pontos.corrigidos++; mudou('pontos', 'refId');
    if (!simular) await db.pontos.update(p.id, { refId: `${m[1]}:${certo.id}${m[3]}` });
  }

  /* técnicas: a da biblioteca volta pro catálogo; a criada pelo atleta não tem prova */
  const catPorSlug = new Map((await db.categories.toArray()).filter((c) => c.slug).map((c) => [c.slug, c.id]));
  const posPorSlug = new Map((await db.positions.toArray()).filter((p) => p.slug).map((p) => [p.slug, p.id]));
  for (const t of tecnicas) {
    const seed = DA_BIBLIOTECA.get(t.uid);
    if (!seed) { if (t.categoriaId != null || t.origemId != null || t.destinoId != null) r.tecnicasProprias.semProva++; continue; }
    const patch = {};
    const certo = { categoriaId: catPorSlug.get(seed.cat), origemId: posPorSlug.get(seed.from), destinoId: posPorSlug.get(seed.to) };
    for (const [campo, id] of Object.entries(certo)) {
      if (id != null && t[campo] !== id) { patch[campo] = id; mudou('techniques', campo); }
    }
    if (!Object.keys(patch).length) continue;
    r.biblioteca.corrigidas++;
    /* a biblioteca é igual em todo aparelho: ajeita só aqui, sem subir */
    if (!simular) await db.techniques.update(t.id, { ...patch, __local: Math.random() });
  }

  return r;
}
