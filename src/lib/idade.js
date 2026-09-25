/* ============================================================
   A IDADE NO APP

   O app guarda só o ano de nascimento (o mínimo que resolve). Dele
   saem a regra das técnicas (regras.js), a divisão de campeonato e
   o que a Nutrição mostra de suplemento.

   A partir de 8 anos: jiu-jitsu é pra criança também. Abaixo de 16,
   um responsável precisa estar de acordo (LGPD, dado de criança e
   adolescente).
   ============================================================ */
export const IDADE_MINIMA = 8;
export const IDADE_SEM_RESPONSAVEL = 16;

/* a divisão da IBJJF pela idade (os ids de DIVISOES, em competicao.js):
   infantil até 15, juvenil 16 e 17, adulto de 18 a 29, e os masters
   de 30 em diante, de 5 em 5 anos (o Master 1 vai até 35) */
export function divisaoDaIdade(idade) {
  if (idade == null) return null;
  if (idade < 16) return 'infantil';
  if (idade < 18) return 'juvenil';
  if (idade < 30) return 'adulto';
  if (idade < 36) return 'master1';
  return `master${Math.min(7, 2 + Math.floor((idade - 36) / 5))}`;
}
