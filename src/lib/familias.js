import { SEED } from '../db/seed';
import { nomeAtual } from '../db/renomeios';
import { origemDaTecnica } from './tecnicas';

/* ============================================================
   AS FAMÍLIAS DE FINALIZAÇÃO

   Família é um grupo de técnicas com a mesma mecânica de
   finalização: o armlock é extensão do cotovelo, seja da guarda,
   da montada ou das costas. Só muda a posição de onde sai.

   O que NÃO é família:
   - sinônimo: outro nome da mesma técnica (vai na busca, pelo
     inglês e pelo nome antigo do seed);
   - técnica relacionada: parece, mas a mecânica é outra (Monoplata
     e Baratoplata não são Omoplata; Anaconda e Brabo não são
     Guilhotina). Fica avulsa;
   - posição: onde a luta está (Backside 50/50 não é finalização).

   O id é permanente e nunca é o nome de uma técnica: "Kimura",
   "Triângulo" e "Mata-leão" já são técnicas (a da guarda, a das
   costas). Quem pertence a cada família está escrito na própria
   técnica, no campo "fam" do seed. Nada entra por nome parecido.
   Técnica avulsa não é erro: o catálogo segue o Jiu-Jitsu.
   ============================================================ */
export const FAMILIAS = [
  { id: 'fam:armlock', nome: 'Armlock', qualquer: 'qualquer armlock', num: 'num armlock', mecanismo: 'estica o cotovelo' },
  { id: 'fam:kimura', nome: 'Kimura', qualquer: 'qualquer kimura', num: 'numa kimura', mecanismo: 'gira o ombro pra dentro, com o braço dobrado nas costas' },
  { id: 'fam:americana', nome: 'Americana', qualquer: 'qualquer americana', num: 'numa americana', mecanismo: 'gira o ombro pra fora, com o braço dobrado no chão' },
  { id: 'fam:omoplata', nome: 'Omoplata', qualquer: 'qualquer omoplata', num: 'numa omoplata', mecanismo: 'trava o ombro com a perna' },
  { id: 'fam:triangulo', nome: 'Triângulo', qualquer: 'qualquer triângulo', num: 'num triângulo', mecanismo: 'estrangula com as pernas, prendendo pescoço e um braço' },
  { id: 'fam:guilhotina', nome: 'Guilhotina', qualquer: 'qualquer guilhotina', num: 'numa guilhotina', mecanismo: 'estrangula pela frente, com o braço por baixo do queixo' },
  { id: 'fam:mata_leao', nome: 'Mata-leão', qualquer: 'qualquer mata-leão', num: 'num mata-leão', mecanismo: 'estrangula pelas costas, com o braço em volta do pescoço' },
  { id: 'fam:katagatame', nome: 'Katagatame', qualquer: 'qualquer katagatame', num: 'num katagatame', mecanismo: 'estrangula com o braço e o ombro dele fechando o pescoço' },
  { id: 'fam:ezequiel', nome: 'Ezequiel', qualquer: 'qualquer ezequiel', num: 'num ezequiel', mecanismo: 'estrangula com o antebraço, a mão dentro da própria manga' },
  { id: 'fam:cruzada', nome: 'Cruzada', qualquer: 'qualquer cruzada', num: 'numa cruzada', mecanismo: 'estrangula com as duas mãos cruzadas na gola' },
  { id: 'fam:pe_reta', nome: 'Chave de pé reta', qualquer: 'qualquer chave de pé reta', num: 'numa chave de pé reta', mecanismo: 'estica o tornozelo' },
  { id: 'fam:heel_hook', nome: 'Heel hook', qualquer: 'qualquer heel hook', num: 'num heel hook', mecanismo: 'gira o calcanhar e torce o joelho' },
  { id: 'fam:kneebar', nome: 'Kneebar', qualquer: 'qualquer kneebar', num: 'num kneebar', mecanismo: 'estica o joelho' },
  { id: 'fam:pulso', nome: 'Chave de pulso', qualquer: 'qualquer chave de pulso', num: 'numa chave de pulso', mecanismo: 'dobra o punho' },
];
export const FAMILIA_POR_ID = new Map(FAMILIAS.map((f) => [f.id, f]));
export const ehFamilia = (item) => typeof item === 'string' && item.startsWith('fam:');

/* as variações de cada família, pelo nome de hoje */
export const MEMBROS = new Map(FAMILIAS.map((f) => [f.id, SEED.techniques.filter((t) => t.fam === f.id).map((t) => t.pt)]));
const FAM_POR_NOME = new Map(SEED.techniques.filter((t) => t.fam).map((t) => [t.pt, t.fam]));

/* a família de um golpe pelo nome gravado (nome antigo também vale).
   Técnica criada pela pessoa só entra numa família quando ela
   confirmou (campo fam): pra isso, quem chama passa a lista de
   técnicas do aparelho. Nome parecido nunca decide família. */
export function familiaDoGolpe(nome, tecnicas = null) {
  const doSeed = FAM_POR_NOME.get(nome) || FAM_POR_NOME.get(nomeAtual(nome));
  if (doSeed || !Array.isArray(tecnicas)) return doSeed || null;
  const propria = tecnicas.find((t) => t.nome === nome && t.fam && origemDaTecnica(t.uid) === 'propria');
  return FAMILIA_POR_ID.has(propria?.fam) ? propria.fam : null;
}

/* as variações pra mostrar embaixo do nome ("da guarda fechada, da
   montada..."): o nome da família no começo sai, pra não repetir */
export const quantasVariacoes = (id) => (MEMBROS.get(id) || []).length;
export function variacoesEmResumo(id, quantas = 3) {
  const f = FAMILIA_POR_ID.get(id);
  const membros = MEMBROS.get(id) || [];
  const corta = (n) => (n.toLowerCase().startsWith(`${f.nome.toLowerCase()} `) ? n.slice(f.nome.length + 1) : n);
  /* a que tem só o nome da família ("Kimura", a da guarda) conta, mas não aparece */
  const lista = membros.filter((n) => n !== f.nome).map(corta);
  const mostra = lista.slice(0, quantas).join(', ');
  return `${mostra}${lista.length > quantas ? '…' : ''}`;
}

/* o nome que a pessoa lê: a técnica pelo nome, a família como "qualquer armlock" */
export const nomeDoItem = (item, maiuscula = false) => {
  if (!ehFamilia(item)) return item;
  const q = FAMILIA_POR_ID.get(item)?.qualquer || item;
  return maiuscula ? q[0].toUpperCase() + q.slice(1) : q;
};
