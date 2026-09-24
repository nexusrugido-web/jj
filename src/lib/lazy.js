import { lazy as lazyDoReact } from 'react';

/* ============================================================
   TELA QUE CHEGA DEPOIS, SEM TELA DE ERRO

   Cada versão publicada troca o nome dos arquivos das telas. Quem
   estava com o app aberto pede o arquivo antigo, que já não existe,
   e o React guarda essa falha: tentar de novo dá o mesmo erro.

   Aqui o app recarrega sozinho uma vez e cai direto na tela pedida,
   porque o endereço (?go=) já mudou antes do carregamento. Quem vê
   só o carregando de sempre.
   ============================================================ */
export const lazy = (importar) => lazyDoReact(() => importar().catch((erro) => {
  try {
    const ultima = Number(sessionStorage.getItem('tela:recarregou')) || 0;
    if (Date.now() - ultima > 60000) {
      sessionStorage.setItem('tela:recarregou', String(Date.now()));
      location.reload();
      return new Promise(() => {}); // fica no carregando até a versão nova abrir
    }
  } catch { /* sem armazenamento não dá pra saber se já tentou: não arrisca repetir */ }
  throw erro;
}));
