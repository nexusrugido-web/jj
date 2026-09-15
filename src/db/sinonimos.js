/* ============================================================
   APELIDOS

   A mesma posição tem nome diferente em cada canto do Brasil.
   "Baiana", "double leg" e "queda dupla" são a mesma coisa.
   Aqui ficam os apelidos aceitos na busca, pra achar de
   qualquer jeito e mostrar sempre o nome de catálogo.
   ============================================================ */

export const APELIDOS = {
  "Controle lateral, 100kg": [
    "cem quilos",
    "side control",
    "lateral",
    "cruzada",
    "yoko shiho gatame",
    "100kg"
  ],
  "Controle lateral sofrido, 100kg": [
    "sob cem quilos",
    "bottom side control",
    "embaixo da lateral"
  ],
  "Joelho na barriga": [
    "knee on belly",
    "joelho no abdome",
    "kob"
  ],
  "Norte-sul": [
    "north south",
    "meia-nove",
    "69",
    "kami shiho gatame"
  ],
  "Gravata, kesa gatame": [
    "scarf hold",
    "quadro",
    "kesa"
  ],
  "Controle das costas": [
    "back control",
    "costas",
    "back",
    "pegada de costas"
  ],
  "Montada": [
    "mount",
    "montado"
  ],
  "Montada técnica": [
    "technical mount"
  ],
  "Meia-guarda": [
    "half guard",
    "meia"
  ],
  "Guarda De La Riva": [
    "dlr",
    "de la riva",
    "guarda pudim"
  ],
  "Guarda X": [
    "x guard",
    "xguard"
  ],
  "Guarda X simples, single leg X": [
    "slx",
    "one leg x"
  ],
  "Ashi garami": [
    "ashi",
    "enrosco de perna"
  ],
  "Enrosco interno, 411": [
    "saddle",
    "honeyhole",
    "inside sankaku",
    "411"
  ],
  "Escudo de joelho, z-guard": [
    "z guard",
    "knee shield",
    "meia-guarda com escudo"
  ],
  "Tartaruga": [
    "turtle",
    "quatro apoios"
  ],
  "Guarda 50/50": [
    "fifty fifty",
    "5050"
  ],
  "Chave de braço, armlock": [
    "armlock",
    "arm bar",
    "juji gatame",
    "chave no braço"
  ],
  "Americana": [
    "key lock",
    "chave americana",
    "ude garami"
  ],
  "Kimura": [
    "chave de ombro",
    "ude garami reverso"
  ],
  "Mata-leão": [
    "rnc",
    "rear naked choke",
    "hadaka jime",
    "estrangulamento pelas costas"
  ],
  "Omoplata": [
    "sankaku garami"
  ],
  "Guilhotina": [
    "guillotine",
    "mata-leão frontal"
  ],
  "Katagatame, braço e cabeça": [
    "arm triangle",
    "kata gatame",
    "braço cabeça"
  ],
  "Chave de pé reta": [
    "straight ankle lock",
    "ankle lock",
    "chave de calcanhar reta"
  ],
  "Triângulo": [
    "sankaku jime",
    "triangle choke"
  ],
  "Estrangulamento Ezequiel": [
    "ezekiel",
    "sode guruma jime"
  ],
  "Passagem toureando": [
    "toreando",
    "toreada",
    "bullfighter pass",
    "toureio"
  ],
  "Raspagem de tesoura": [
    "scissor sweep",
    "tesourinha"
  ],
  "Crossface": [
    "cross face",
    "pressão no rosto"
  ]
};

/* apelidos que valem pra qualquer técnica que contenha a palavra */
export const APELIDOS_GERAIS = {
  'baiana': ['queda dupla', 'double leg'],
  'mão de vaca': ['chave de punho', 'wrist lock'],
  'gravata': ['kesa', 'headlock'],
  'leg drag': ['arraste de perna'],
  'brabo': ["d'arce", 'darce'],
  'chave de pé': ['toe hold', 'americana no pé'],
};

const semAcento = (t) => String(t).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* a busca acha pelo nome de catálogo ou por qualquer apelido */
export function casaApelido(nome, busca) {
  if (!busca) return true;
  const b = semAcento(busca);
  if (semAcento(nome).includes(b)) return true;

  const lista = APELIDOS[nome] || [];
  if (lista.some((a) => semAcento(a).includes(b))) return true;

  for (const [chave, aps] of Object.entries(APELIDOS_GERAIS)) {
    if (semAcento(nome).includes(semAcento(chave))) {
      if (aps.some((a) => semAcento(a).includes(b))) return true;
    }
  }
  return false;
}
