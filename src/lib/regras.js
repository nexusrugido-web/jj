import { FAIXA_ORDEM } from './utils';
import { CATALOGO_TECNICAS } from './tecnicas';
import { SEED } from '../db/seed';

/* sem acento e em minúscula, mantendo o hífen e o apóstrofo (bate-estaca, d'arce) */
const normal = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ============================================================
   O QUE A REGRA PERMITE (IBJJF / CBJJ, 2025)

   A técnica, a faixa, a idade e se é Gi ou No-Gi. O app nunca
   proíbe o registro: quando a regra não permite, ele avisa e
   pergunta se a pessoa quer registrar mesmo assim (na academia o
   professor pode liberar). Tudo que é regra mora aqui, com a fonte:
   quando a IBJJF mudar, muda este arquivo.

   Fontes: livro de regras da IBJJF; resumos por faixa e idade em
   matgoat.com, open-bjj.com e bjjlf.pro (conferidos em 25/09/2026).

   Os grupos:
     sempre     proibida em qualquer faixa e idade (bate-estaca,
                tesoura voadora, chave de coluna sem estrangulamento)
     calcanhar  chave de calcanhar: nunca no Gi; no No-Gi, só
                marrom e preta adultos
     marrom     chave de joelho, toe hold, chave de bíceps, calf
                slicer e parecidas: marrom e preta, adulto
     punho      chave de punho: faixa azul em diante, a partir dos 18
     cabecaFora single leg com a cabeça por fora: não na branca nem
                até os 12 anos
     peReta     chave de pé reta: só a partir dos 16 anos
     infantil   omoplata, triângulo, katagatame, guilhotina,
                ezequiel e outras: não até os 12 anos
   ============================================================ */
export const FONTE_DA_REGRA = 'IBJJF';

const GRUPOS = [
  { id: 'sempre', re: /\b(slam|bate-estaca|kani basami|tesoura voadora|texas cloverleaf|chave de coluna|neck crank|chave de pescoco)\b|^twister( twister)?$/ },
  { id: 'calcanhar', re: /heel hook|chave de calcanhar/ },
  { id: 'marrom', re: /kneebar|chave de joelho|toe hold|chave de dedao|bicep|biceps|calf slicer|panturrilha|banana split|estima lock|aoki lock/ },
  { id: 'punho', re: /chave de pulso|chave de punho|mao de vaca|wrist lock/ },
  { id: 'peReta', re: /pe reta|botinha|straight ankle|ankle lock|chave de tornozelo/ },
  { id: 'infantil', re: /omoplata|baratoplata|monoplata|tarikoplata|triangulo|katagatame|kata gatame|arm triangle|brabo|d'arce|anaconda|gravata peruana|gravata japonesa|guilhotina|guillotine|marcelotine|ezequiel|ezekiel/ },
  { id: 'cabecaFora', re: /head outside single|cabeca por fora/ },
];

/* só a finalização e a queda têm regra: "Defesa de heel hook" e
   "Entrada no ashi garami" não são a técnica proibida */
const CATEGORIAS_COM_REGRA = new Set(['articular', 'perna', 'estrangulamento', 'queda']);
const catalogoPorNome = new Map(CATALOGO_TECNICAS.map((t) => [t.nome, t]));

export function grupoDaTecnica(nome) {
  const t = catalogoPorNome.get(nome);
  if (t && !CATEGORIAS_COM_REGRA.has(t.cat)) return null;
  const texto = normal(`${nome} ${t?.en || ''}`);
  if (!t && /^(defesa|escapada|saida|entrada|transicao)\b/.test(texto)) return null;
  return GRUPOS.find((g) => g.re.test(texto))?.id || null;
}

/* a idade pelo ano de nascimento (o app só guarda o ano) */
export const idadeDe = (ano, hoje = new Date()) => {
  const a = Number(ano);
  return a > 1900 ? hoje.getFullYear() - a : null;
};

const abaixo = (faixa, min) => (FAIXA_ORDEM[faixa] ?? 0) < (FAIXA_ORDEM[min] ?? 0);

/**
 * null quando pode; senão { motivo, grupo }.
 * idade null = não sabe a idade: as regras de idade não entram.
 * modalidade 'gi' ou 'nogi'.
 */
export function avaliarTecnica(nome, { faixa = 'branca', idade = null, modalidade = 'gi' } = {}) {
  const grupo = grupoDaTecnica(nome);
  const menor = (n) => idade != null && idade < n;
  const adulto = idade == null || idade >= 18;
  if (grupo === 'sempre') {
    return { grupo, motivo: `A ${FONTE_DA_REGRA} não permite ${nome} em nenhuma faixa nem idade.` };
  }
  if (grupo === 'calcanhar') {
    if (modalidade === 'gi') return { grupo, motivo: `No Gi, a ${FONTE_DA_REGRA} não permite chave de calcanhar em nenhuma faixa.` };
    if (abaixo(faixa, 'marrom') || !adulto) return { grupo, motivo: `No No-Gi, a chave de calcanhar só é permitida pra marrom e preta adultos.` };
    return null;
  }
  if (grupo === 'marrom' && (abaixo(faixa, 'marrom') || !adulto)) {
    return { grupo, motivo: `A ${FONTE_DA_REGRA} só permite ${nome} a partir da faixa marrom, no adulto.` };
  }
  if (grupo === 'punho' && (menor(18) || abaixo(faixa, 'azul'))) {
    return {
      grupo,
      motivo: menor(18) ? 'Chave de punho não é permitida até os 17 anos, em nenhuma faixa.'
        : `A ${FONTE_DA_REGRA} só permite chave de punho a partir da faixa azul.`,
    };
  }
  if (grupo === 'cabecaFora' && (menor(13) || abaixo(faixa, 'azul'))) {
    return { grupo, motivo: `A ${FONTE_DA_REGRA} não permite o single leg com a cabeça por fora na faixa branca nem até os 12 anos.` };
  }
  if (grupo === 'peReta' && menor(16)) {
    return { grupo, motivo: 'Chave de pé reta não é permitida até os 15 anos.' };
  }
  if (grupo === 'infantil' && menor(13)) {
    return { grupo, motivo: `Até os 12 anos, a ${FONTE_DA_REGRA} não permite ${nome}.` };
  }
  /* a faixa mínima que a biblioteca já conhecia */
  const t = catalogoPorNome.get(nome);
  const min = t && CATEGORIAS_COM_REGRA.has(t.cat) ? SEED_FAIXA.get(nome) : null;
  if (min && abaixo(faixa, min)) {
    return { grupo: 'faixa', motivo: `Pela ${FONTE_DA_REGRA}, ${nome} é da faixa ${min} em diante.` };
  }
  return null;
}

/* a faixa mínima de cada técnica, como veio da biblioteca */
const SEED_FAIXA = new Map(SEED.techniques.filter((t) => t.faixaMin && t.faixaMin !== 'branca').map((t) => [t.pt, t.faixaMin]));

/* a modalidade do treino: No-Gi pelo tipo, a competição pelo que foi marcado nela */
export const modalidadeDoTreino = (s) => (s.tipo === 'nogi' ? 'nogi'
  : s.tipo === 'competicao' ? (s.competicao?.modalidade || 'gi') : 'gi');
