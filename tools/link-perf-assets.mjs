// After `vite build --mode perf`: link perf/dist/assets/proof to public/assets/proof (relative symlink), so the
// static perf bundle serves the same compressed proof assets without a second 18 MB copy in git.
import { mkdirSync, rmSync, symlinkSync } from 'node:fs';

mkdirSync('perf/dist/assets', { recursive: true });
rmSync('perf/dist/assets/proof', { recursive: true, force: true });
symlinkSync('../../../public/assets/proof', 'perf/dist/assets/proof', 'dir');
console.log('perf/dist/assets/proof -> public/assets/proof');
