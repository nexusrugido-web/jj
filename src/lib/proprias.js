import { db, nomeFinal } from '../db/db';
import { SEED } from '../db/seed';
import { RENOMEAR } from '../db/renomeios';
import { APELIDOS } from '../db/sinonimos';
import { CATALOGO_TECNICAS, TECNICA_POR_UID } from './tecnicas';
import { FAMILIA_POR_ID } from './familias';
import { LIMITE_TECNICAS_PROPRIAS, NOME_TECNICA_MAX, DETALHES_TECNICA_MAX } from './limites';

/* ============================================================
   AS TÉCNICAS QUE O ATLETA CRIA (contrato em docs/CONTRATO-TECNICAS.md)

   A técnica própria mora na mesma tabela do catálogo, com uuid
   aleatório (o hook creating do db.js) e `propria: 1`. O catálogo
   tem uid fixo, tirado do nome (uidEstavel), então dá pra separar
   as duas pelo uid.

   Só que o uid sozinho não é prova em todo aparelho. A biblioteca
   já foi semeada sem uid fixo (versão 1 do banco não tinha uid; a
   primeira subida dava um uuid aleatório pra quem não tinha) e com
   nomes que depois mudaram ("Passagem em toureio"). Nesses
   aparelhos, a técnica do catálogo tem uid de fora. Por isso a
   técnica antiga só vira própria com uid de fora E nome que não é
   do catálogo E sem ter nascido junto com a biblioteca. O resto é
   duvidoso: não marca, não conta, só aparece nos números.
   ============================================================ */

const limpo = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase().replace(/\s+/g, ' ');

/* todo nome que já foi de uma técnica do catálogo: o de hoje, o antigo,
   os que juntaram, os da lista de renomeios, os apelidos e o inglês */
const NOMES_DO_CATALOGO = new Map();
const guarda = (nome, atual) => { const k = limpo(nome); if (k && !NOMES_DO_CATALOGO.has(k)) NOMES_DO_CATALOGO.set(k, atual); };
for (const t of SEED.techniques) {
  guarda(t.pt, t.pt);
  if (t.antigo) guarda(t.antigo, t.pt);
  for (const n of t.juntou || []) guarda(n, t.pt);
  for (const n of String(t.en || '').split('/')) guarda(n, t.pt);
}
const ATUAIS = new Set(CATALOGO_TECNICAS.map((t) => t.nome));
for (const [antigo, novo] of Object.entries(RENOMEAR)) if (ATUAIS.has(novo)) guarda(antigo, novo);
for (const [nome, apelidos] of Object.entries(APELIDOS)) if (ATUAIS.has(nome)) apelidos.forEach((a) => guarda(a, nome));

/* o nome de hoje da técnica do catálogo que tem esse nome, ou null */
export function nomeDoCatalogo(nome) {
  return NOMES_DO_CATALOGO.get(limpo(nome)) || NOMES_DO_CATALOGO.get(limpo(nomeFinal(nome))) || null;
}

/* a biblioteca é semeada de uma vez: centenas de técnicas no mesmo
   minuto. Pela tela, ninguém cria 20 técnicas num minuto. */
const JANELA_DA_SEMENTE = 60 * 1000;
const MINIMO_DA_SEMENTE = 20;

function nascidasComABiblioteca(tecnicas) {
  const datas = tecnicas.map((t) => t.criadoEm).filter(Number.isFinite).sort((a, b) => a - b);
  const vizinhas = (d) => {
    let n = 0;
    for (const x of datas) if (Math.abs(x - d) <= JANELA_DA_SEMENTE) n++;
    return n;
  };
  const cache = new Map();
  return (t) => {
    if (!cache.has(t.criadoEm)) cache.set(t.criadoEm, vizinhas(t.criadoEm) >= MINIMO_DA_SEMENTE);
    return cache.get(t.criadoEm);
  };
}

/* de onde a técnica do aparelho vem: 'catalogo', 'propria' ou
   'duvidosa' (com o motivo). Recebe a lista inteira porque a prova
   da semente depende das outras. */
function classificador(tecnicas) {
  const daSemente = nascidasComABiblioteca(tecnicas);
  return (t) => {
    if (t.propria) return { origem: 'propria' };
    if (!t.uid) return { origem: 'duvidosa', motivo: 'sem_uid' };
    if (TECNICA_POR_UID.has(t.uid)) return { origem: 'catalogo' };
    if (nomeDoCatalogo(t.nome)) return { origem: 'duvidosa', motivo: 'nome_do_catalogo' };
    if (!Number.isFinite(t.criadoEm)) return { origem: 'duvidosa', motivo: 'sem_data' };
    if (daSemente(t)) return { origem: 'duvidosa', motivo: 'nasceu_com_a_biblioteca' };
    return { origem: 'propria' };
  };
}

/* ---------- cota ----------
   Conta as próprias do aparelho, arquivadas também. A apagada não
   está mais no aparelho e não dá pra contar aqui: o app não apaga
   técnica (só o limparDuplicados e a descida de uma apagada na
   nuvem tiram a linha). Quem conta a apagada é o servidor, pelo
   deleted_at; se passar de 100, ele recusa e o registro fica na fila. */
export function contarProprias(tecnicas) {
  const origem = classificador(tecnicas);
  return tecnicas.filter((t) => origem(t).origem === 'propria').length;
}

export const podeCriarPropria = (tecnicas) => contarProprias(tecnicas) < LIMITE_TECNICAS_PROPRIAS;

export function textoDaCota(criadas) {
  if (criadas >= LIMITE_TECNICAS_PROPRIAS) {
    return `Chegou nas ${LIMITE_TECNICAS_PROPRIAS}. Pra criar outra, edite uma que você não usa mais.`;
  }
  return `Você criou ${criadas} de ${LIMITE_TECNICAS_PROPRIAS} técnicas.`;
}

/* ---------- nome repetido ----------
   Nome do catálogo (de hoje, antigo, sinônimo, inglês) ou de outra
   técnica do aparelho, arquivada também: o rola aponta pelo nome, e
   dois com o mesmo nome viram um só no limparDuplicados. */
export function nomeRepetido(nome, tecnicas = []) {
  const doCatalogo = nomeDoCatalogo(nome);
  if (doCatalogo) return `Já existe "${doCatalogo}" no app. Escolha ela na lista.`;
  const k = limpo(nome);
  const igual = tecnicas.find((t) => limpo(t.nome) === k);
  if (!igual) return null;
  if (TECNICA_POR_UID.has(igual.uid)) return `Já existe "${igual.nome}" no app. Escolha ela na lista.`;
  return igual.arquivada
    ? `Você já criou "${igual.nome}". Ela está arquivada.`
    : `Você já criou "${igual.nome}". Escolha ela na lista.`;
}

/* ---------- criar ---------- */
/* o registro da própria: nome e "como você faz" dentro do limite, e
   versaoDe, fam e contra só quando vierem (o catálogo nunca é alterado) */
export function novaPropria(c) {
  const t = {
    nome: String(c.nome || '').trim().slice(0, NOME_TECNICA_MAX).trim(),
    nomeEn: c.nomeEn || '',
    categoriaId: c.categoriaId ?? null,
    origemId: c.origemId ?? null, destinoId: c.destinoId ?? null,
    modo: c.modo || 'ambos', faixaMin: c.faixaMin || 'branca',
    restricao: c.restricao || '',
    detalhes: String(c.detalhes || '').slice(0, DETALHES_TECNICA_MAX),
    status: 'aprendendo', nivel: 0, favorita: 0, tags: [], video: '',
    arquivada: 0, propria: 1, criadoEm: Date.now(),
  };
  if (typeof c.versaoDe === 'string' && c.versaoDe) t.versaoDe = c.versaoDe;
  if (FAMILIA_POR_ID.has(c.fam)) t.fam = c.fam;
  if (Array.isArray(c.contra) && c.contra.length) t.contra = c.contra.filter((x) => typeof x === 'string' && x);
  return t;
}

/* grava a própria. Devolve { tecnica } ou { erro } com o texto pra tela. */
export async function criarTecnicaPropria(campos) {
  const tecnicas = await db.techniques.toArray();
  if (!String(campos.nome || '').trim()) return { erro: 'Coloca o nome' };
  const criadas = contarProprias(tecnicas);
  if (criadas >= LIMITE_TECNICAS_PROPRIAS) return { erro: textoDaCota(criadas) };
  const nova = novaPropria(campos);
  const repetido = nomeRepetido(nova.nome, tecnicas);
  if (repetido) return { erro: repetido };
  const id = await db.techniques.add(nova);
  return { tecnica: await db.techniques.get(id) };
}

/* ---------- marcar as próprias que já existem ----------
   Uma passada por aparelho, simular primeiro: o dono vê os números
   antes de aplicar (como o reparo S4). Só marca com prova (uid de
   fora, nome que não é do catálogo, fora da semente); a duvidosa
   fica como está e é contada pelo motivo. Rodar de novo não muda
   nada: quem já tem `propria` não entra. Aplicada, a marca sobe pela
   fila (o servidor conta a cota por ela). */
export async function marcarProprias(tecnicas, { simular = true } = {}) {
  const origem = classificador(tecnicas);
  const r = { marcadas: 0, jaMarcadas: 0, catalogo: 0, duvidosas: 0, motivos: {}, patches: [] };
  for (const t of tecnicas) {
    if (t.propria) { r.jaMarcadas++; continue; }
    const o = origem(t);
    if (o.origem === 'catalogo') { r.catalogo++; continue; }
    if (o.origem === 'duvidosa') {
      r.duvidosas++;
      r.motivos[o.motivo] = (r.motivos[o.motivo] || 0) + 1;
      continue;
    }
    r.marcadas++;
    r.patches.push({ id: t.id, uid: t.uid, nome: t.nome, patch: { propria: 1 } });
  }
  if (!simular) for (const p of r.patches) await db.techniques.update(p.id, p.patch);
  return r;
}
