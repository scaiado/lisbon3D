// Compresses the raw Blender exports (art/exports/*.glb) into the copies the game downloads
// (public/assets/proof/*.glb): dedupe, join primitives that share a material (one draw per material instead
// of one per building and material), weld, meshopt geometry, WebP textures capped at 2048 px.
// Joining merges node names; the engine finds backdrop cards by material name instead.
// KTX2 needs KTX-Software's toktx, which this environment doesn't have; WebP is the documented fallback.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const source = 'art/exports';
const cli = join('node_modules', '.bin', 'gltf-transform');
// The player car keeps its node tree (wheels spin and steer), so it is not flattened or joined, and it ships with
// the game's other data in public/assets/play/.
const PLAY = new Set(['player_car.glb']);
const targetOf = (file) => (PLAY.has(file) ? 'public/assets/play' : 'public/assets/proof');
mkdirSync('public/assets/proof', { recursive: true });
mkdirSync('public/assets/play', { recursive: true });
copyFileSync(join(source, 'bica_gameplay.json'), join('public/assets/play', 'bica_gameplay.json'));

const steps = [
  ['dedup'],
  ['flatten'],
  ['join'],
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
  const target = targetOf(file);
  const fileSteps = PLAY.has(file) ? steps.filter(([command]) => command !== 'flatten' && command !== 'join') : steps;
  fileSteps.forEach(([command, ...args], index) => {
    const output = index === fileSteps.length - 1 ? join(target, file) : join(scratch, `${index}-${file}`);
    execFileSync(cli, [command, input, output, ...args], { stdio: ['ignore', 'ignore', 'inherit'] });
    input = output;
  });
  rmSync(scratch, { recursive: true, force: true });
  const before = statSync(join(source, file)).size;
  const after = statSync(join(target, file)).size;
  console.log(`${file}: ${(before / 1e6).toFixed(2)} MB → ${(after / 1e6).toFixed(2)} MB`);
}
