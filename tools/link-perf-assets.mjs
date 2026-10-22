// After `vite build --mode perf`: link perf/dist/assets/{proof,play} to public/assets/ (relative symlinks), so the
// static perf bundle serves the same compressed assets without a second 18 MB copy in git.
import { mkdirSync, rmSync, symlinkSync } from 'node:fs';

mkdirSync('perf/dist/assets', { recursive: true });
for (const folder of ['proof', 'play']) {
  rmSync(`perf/dist/assets/${folder}`, { recursive: true, force: true });
  symlinkSync(`../../../public/assets/${folder}`, `perf/dist/assets/${folder}`, 'dir');
  console.log(`perf/dist/assets/${folder} -> public/assets/${folder}`);
}
