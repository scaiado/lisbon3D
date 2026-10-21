import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  server: {
    host: true,
    port: 5173
  },
  preview: {
    port: 4173
  },
  build: {
    outDir: 'dist',
    target: 'es2023',
    sourcemap: true,
    rollupOptions: {
      input: {
        spike: 'index.html',
        proof: 'proof.html'
      }
    },
    // Each renderer route is its own dynamic chunk, so the size of every route can be read separately.
    chunkSizeWarningLimit: 1500
  }
});
