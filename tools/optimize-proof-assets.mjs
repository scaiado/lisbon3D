// Compresses the raw Blender exports (art/exports/*.glb) into the copies the game downloads
// (public/assets/proof/*.glb): dedupe, weld, meshopt geometry, WebP textures capped at 2048 px.
// Node names are kept (no flatten/join), because the proof views look buildings up by name.
// KTX2 needs KTX-Software's toktx, which this environment doesn't have; WebP is the documented fallback.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const source = 'art/exports';
const target = 'public/assets/proof';
const cli = join('node_modules', '.bin', 'gltf-transform');
mkdirSync(target, { recursive: true });

const steps = [
  ['dedup'],
  ['prune'],
  ['weld'],
  ['resize', '--width', '2048', '--height', '2048'],
  ['webp', '--quality', '88'],
  ['meshopt', '--level', 'medium']
];

for (const file of readdirSync(source).filter((name) => name.endsWith('.glb'))) {
  let input = join(source, file);
  const scratch = join(tmpdir(), `proof-${process.pid}`);
  mkdirSync(scratch, { recursive: true });
  steps.forEach(([command, ...args], index) => {
    const output = index === steps.length - 1 ? join(target, file) : join(scratch, `${index}-${file}`);
    execFileSync(cli, [command, input, output, ...args], { stdio: ['ignore', 'ignore', 'inherit'] });
    input = output;
  });
  rmSync(scratch, { recursive: true, force: true });
  const before = statSync(join(source, file)).size;
  const after = statSync(join(target, file)).size;
  console.log(`${file}: ${(before / 1e6).toFixed(2)} MB → ${(after / 1e6).toFixed(2)} MB`);
}
