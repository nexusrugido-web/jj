/* UUID determinístico a partir de uma chave de texto.
   Serve pra biblioteca padrão (posições, categorias, técnicas...) receber
   SEMPRE o mesmo id em qualquer aparelho. Sem isso, o celular semeava um
   conjunto e o computador outro, e o sync baixava os dois, duplicando tudo. */
export function uidEstavel(chave) {
  let h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
  const s = String(chave);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c + i, 2246822519) >>> 0;
    h3 = Math.imul(h3 ^ (c + i * 7), 3266489917) >>> 0;
    h4 = Math.imul(h4 + c * (i + 3), 668265263) >>> 0;
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  const t = hex(h1) + hex(h2) + hex(h3) + hex(h4);
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-4${t.slice(13, 16)}-a${t.slice(17, 20)}-${t.slice(20, 32)}`;
}

export const chaveNome = (tabela, nome) =>
  `${tabela}:${String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()}`;
