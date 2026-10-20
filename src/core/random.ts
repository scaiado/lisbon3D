/** Small seeded RNG (mulberry32) so generated scenes are identical on every run and every machine. */
export interface Random {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  sign(): number;
  pick<T>(items: readonly T[]): T;
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    chance: (probability) => next() < probability,
    sign: () => (next() < 0.5 ? -1 : 1),
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('pick() needs a non-empty list');
      return item;
    }
  };
}
