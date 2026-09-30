/* Graduação IBJJF, junho de 2026. A idade competitiva é ano atual menos
   ano de nascimento; por isso o app não precisa guardar o aniversário. */
const CRIANCAS = [
  ['cinza-branca', 'Cinza e branca', '#858b89', '#edf2ef', 4],
  ['cinza', 'Cinza', '#858b89', null, 4],
  ['cinza-preta', 'Cinza e preta', '#858b89', '#2a2f2e', 4],
  ['amarela-branca', 'Amarela e branca', '#e6bd35', '#edf2ef', 7],
  ['amarela', 'Amarela', '#e6bd35', null, 7],
  ['amarela-preta', 'Amarela e preta', '#e6bd35', '#2a2f2e', 7],
  ['laranja-branca', 'Laranja e branca', '#e98235', '#edf2ef', 10],
  ['laranja', 'Laranja', '#e98235', null, 10],
  ['laranja-preta', 'Laranja e preta', '#e98235', '#2a2f2e', 10],
  ['verde-branca', 'Verde e branca', '#379c65', '#edf2ef', 13],
  ['verde', 'Verde', '#379c65', null, 13],
  ['verde-preta', 'Verde e preta', '#379c65', '#2a2f2e', 13],
];

export const FAIXAS = [
  { id: 'branca', nome: 'Branca', cor: '#edf2ef', idadeMin: 4 },
  ...CRIANCAS.map(([id, nome, cor, centro, idadeMin]) => ({
    id, nome, cor, centro, idadeMin, idadeMax: 15,
  })),
  { id: 'azul', nome: 'Azul', cor: '#3b7ae4', idadeMin: 16 },
  { id: 'roxa', nome: 'Roxa', cor: '#8b5cf6', idadeMin: 16 },
  { id: 'marrom', nome: 'Marrom', cor: '#8a5a34', idadeMin: 18 },
  { id: 'preta', nome: 'Preta', cor: '#2a2f2e', idadeMin: 19 },
];

/* Adultos mantêm a escala 0–4 usada pelos gráficos já salvos. As faixas
   infantis ocupam o intervalo entre branca e azul. */
export const FAIXA_ORDEM = {
  branca: 0,
  ...Object.fromEntries(CRIANCAS.map(([id], i) => [id, (i + 1) / 13])),
  azul: 1, roxa: 2, marrom: 3, preta: 4,
};

export function faixaValidaNaIdade(faixa, idade) {
  const f = FAIXAS.find((x) => x.id === faixa);
  if (!f) return false;
  if (idade == null) return true;
  return idade >= f.idadeMin && (f.idadeMax == null || idade <= f.idadeMax);
}

export function faixasDaIdade(idade) {
  return FAIXAS.filter((f) => faixaValidaNaIdade(f.id, idade));
}

/* Conteúdo e régua técnica hoje são personalizados em cinco níveis adultos.
   Até haver curadoria infantil própria, usar fundamentos de branca é honesto. */
export const faixaDeConteudo = (faixa) => (FAIXA_ORDEM[faixa] > 0 && FAIXA_ORDEM[faixa] < 1 ? 'branca' : faixa);

export function visualDaFaixa(faixa) {
  const f = FAIXAS.find((x) => x.id === faixa) || FAIXAS[0];
  return f.centro
    ? `linear-gradient(180deg, ${f.cor} 0 25%, ${f.centro} 25% 75%, ${f.cor} 75%)`
    : f.cor;
}

/* Só sugere uma faixa que já cabe na idade. Graduar é decisão do professor. */
export function proximaFaixa(faixa, idade) {
  const ordem = FAIXAS.findIndex((f) => f.id === faixa);
  return FAIXAS.slice(ordem + 1).find((f) => faixaValidaNaIdade(f.id, idade))?.id || faixa;
}
