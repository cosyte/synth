/**
 * `splitmix32` — a tiny, well-studied 32-bit mixing PRNG used **only** to expand a single integer
 * seed into the four 32-bit state words that seed {@link ../rng/sfc32.sfc32}. It is not the corpus
 * generator itself (that is `sfc32`); it exists so that a one-number seed deterministically produces a
 * well-distributed 128-bit `sfc32` state, avoiding the poor low-bit behavior of naive
 * `state = seed`-style initialization.
 *
 * Zero-dependency, `Math.random`-free (lint-enforced): the whole point of the library is that a seed —
 * and only the seed — determines the output, on any machine, any run. See the meta-repo roadmap
 * `operations/roadmaps/synth.md` §5 and the reproducibility contract in `documentation/`.
 *
 * @module
 */

/**
 * A stateful `splitmix32` step function. Each call advances the internal 32-bit state and returns the
 * next unsigned 32-bit integer. Deterministic for a given seed.
 *
 * @param seed - The 32-bit seed. Coerced to a 32-bit integer via `| 0`.
 * @returns A nullary function returning the next `uint32` in the stream.
 * @example
 * ```ts
 * import { splitmix32 } from "@cosyte/synth";
 * const next = splitmix32(12345);
 * const a = next(); // deterministic uint32
 * ```
 */
export function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return function next(): number {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  };
}
