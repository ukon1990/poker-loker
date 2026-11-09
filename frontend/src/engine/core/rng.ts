export interface Rng {
  nextUint32(): number;
  /** Uniform integer from 0 up to but not including `maxExclusive`. */
  nextInt(maxExclusive: number): number;
  /** Uniform float in [0, 1). */
  nextFloat(): number;
  /** Pass this to `createRng` to continue the same sequence. */
  getState(): number;
}

const TWO_POW_32 = 4_294_967_296;

/** Mulberry32. The whole state is one integer, so it serializes with a saved hand. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  function nextUint32(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  return {
    nextUint32,
    nextInt(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > TWO_POW_32) {
        throw new RangeError(`Invalid range: ${maxExclusive}`);
      }
      // Rejection sampling removes the bias a plain modulo would add.
      const limit = TWO_POW_32 - (TWO_POW_32 % maxExclusive);
      let value = nextUint32();
      while (value >= limit) value = nextUint32();
      return value % maxExclusive;
    },
    nextFloat: () => nextUint32() / TWO_POW_32,
    getState: () => state,
  };
}

/** Mixes numbers into a new seed, for example a table's seed and a hand number. */
export function deriveSeed(...parts: readonly number[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    hash ^= part >>> 0;
    hash = Math.imul(hash, 0x01000193);
    hash ^= hash >>> 13;
  }
  return hash >>> 0;
}
