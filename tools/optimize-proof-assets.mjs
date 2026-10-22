// Compresses the raw Blender exports (art/exports/*.glb) into the copies the game downloads
// (public/assets/proof/*.glb): dedupe, join primitives that share a material (one draw per material instead
// of one per building and material), weld, meshopt geometry, WebP textures capped at 2048 px.
// Joining merges node names; the engine finds backdrop cards by material name instead.
// KTX2 needs KTX-Software's toktx, which this environment doesn't have; WebP is the documented fallback.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

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
  if (!PLAY.has(file)) input = await markMovingParts(input, join(scratch, `moving-${file}`));
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

/**
 * The game moves the funicular by its funicular_* materials. dedup and join merge materials that are equal apart
 * from their name (the tram's wheels with the street's rails, its brass and pole with the street's), which would
 * leave those parts behind or drag the street along, so the moving materials get a marker that keeps them apart.
 */
async function markMovingParts(input, output) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(input);
  for (const material of document.getRoot().listMaterials()) {
    if (material.getName().startsWith('funicular_')) material.setExtras({ ...material.getExtras(), moving: 'funicular' });
  }
  await io.write(output, document);
  return output;
}
