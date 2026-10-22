import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * `vite build --mode perf` (npm run build:perf) writes a self-contained static copy of the proof to perf/dist/ with
 * relative paths, so it can be measured on another machine with any static server and no npm install. The proof and
 * play assets are not copied: perf/dist/assets/{proof,play} are tracked symlinks to public/assets/.
 */
export default defineConfig(({ mode }) => ({
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
  base: mode === 'perf' ? './' : '/',
  build: {
    outDir: mode === 'perf' ? 'perf/dist' : 'dist',
    target: 'es2023',
    sourcemap: mode !== 'perf',
    copyPublicDir: mode !== 'perf',
    rollupOptions: {
      input: (mode === 'perf' ? { proof: 'proof.html', play: 'play.html' } : { spike: 'index.html', proof: 'proof.html', play: 'play.html' }) as Record<string, string>
    },
    // Each renderer route is its own dynamic chunk, so the size of every route can be read separately.
    chunkSizeWarningLimit: 1500
  }
}));
