/**
 * `sfc32` (Small Fast Counter, 32-bit, 128-bit state) — the deterministic, non-cryptographic PRNG that
 * drives every value `@cosyte/synth` generates. Chosen over `mulberry32` (whose author flags that it
 * skips ~1/3 of 32-bit outputs) and over a CSPRNG (`node:crypto`, which is **not seedable** and would
 * defeat reproducibility). A synthetic-fixture generator has **no secrets** — statistical quality plus
 * byte-for-byte reproducibility is exactly the right trade (roadmap §5).
 *
 * The state is four 32-bit words. This module exposes the raw step function; {@link ../rng/rng.Rng}
 * wraps it with a seed-expansion ({@link ./splitmix32.splitmix32}) and the ergonomic draw helpers.
 *
 * @module
 */

/**
 * The mutable four-word `sfc32` state. Threaded explicitly (never global) by {@link ../rng/rng.Rng}.
 */
export interface Sfc32State {
  /** State word `a`. */
  a: number;
  /** State word `b`. */
  b: number;
  /** State word `c`. */
  c: number;
  /** Counter word `d`. */
  d: number;
}

/**
 * Advance an {@link Sfc32State} in place by one step and return the next unsigned 32-bit integer.
 *
 * This is the canonical `sfc32` step. The state object is mutated (the counter `d` increments and the
 * mixing words rotate); callers that need reproducible independence hold their own state and never
 * share it — {@link ../rng/rng.Rng} creates a fresh state per seed so two runs from the same seed are
 * identical (roadmap §5).
 *
 * @param s - The state to advance. Mutated in place.
 * @returns The next `uint32` in the stream.
 * @example
 * ```ts
 * import { sfc32Next, type Sfc32State } from "@cosyte/synth";
 * const s: Sfc32State = { a: 1, b: 2, c: 3, d: 4 };
 * const x = sfc32Next(s); // uint32
 * ```
 */
export function sfc32Next(s: Sfc32State): number {
  s.a |= 0;
  s.b |= 0;
  s.c |= 0;
  s.d |= 0;
  const t = (((s.a + s.b) | 0) + s.d) | 0;
  s.d = (s.d + 1) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.c = (s.c + t) | 0;
  return t >>> 0;
}
