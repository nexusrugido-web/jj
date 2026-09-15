import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      onwarn(aviso, padrao) {
        /* Ciclo de importação no nosso código derruba o app com
           "Cannot access X before initialization", e às vezes só
           no celular. Então o build para aqui mesmo. Ciclo dentro
           de biblioteca de terceiro não é nosso problema. */
        if (aviso.code === 'CIRCULAR_DEPENDENCY') {
          const ids = aviso.ids || [];
          const nosso = ids.some((x) => !x.includes('node_modules'));
          const caminho = ids.map((x) => x.replace(process.cwd() + '/', '')).join('\n     -> ');
          if (nosso) {
            console.error('\nCICLO DE IMPORTAÇÃO NO CÓDIGO:\n     ' + caminho + '\n');
            throw new Error('ciclo de importação, o app não subiria');
          }
          return;
        }
        padrao(aviso);
      },
    },
    /* Sem divisão manual de pedaços aqui de propósito. Agrupar
       bibliotecas na mão cria dependência circular entre os
       arquivos gerados, e o app quebra com "Cannot access antes
       de inicializar". O Vite divide sozinho, e divide certo.
       O ganho de tamanho vem das telas carregando sob demanda. */
  },
})
