/**
 * `Rng` — the seeded, deterministic random source every `@cosyte/synth` provider draws from.
 *
 * **The reproducibility contract (roadmap §5).** A seed — and only the seed — determines the output.
 * `createRng(seed)` expands the integer seed through {@link ./splitmix32.splitmix32} into the four
 * `sfc32` state words, then every draw advances that state via {@link ./sfc32.sfc32Next}. Two `Rng`s
 * created from the same seed emit the **identical** sequence on any machine, any run — the property
 * the parsers', `transform`'s, and `deid`'s regression suites depend on.
 *
 * **Explicit, never global.** An `Rng` is a value you thread through a build; there is no ambient
 * shared generator and **`Math.random` is lint-banned** in `src/` (it is not seedable — its seed is
 * engine-chosen and cannot be reset, so a corpus built on it is not reproducible). Because each
 * generation creates a fresh `Rng` from its seed, generations are independent and parallel-safe.
 *
 * The `Rng` object is stateful by nature (a PRNG advances). Immutability in this library lives where it
 * is testable and matters: the generated **artifacts and the `Corpus` are deep-frozen** (see
 * `../corpus.ts`). Determinism, not object-immutability, is the `Rng`'s guarantee.
 *
 * @module
 */

import { splitmix32 } from "./splitmix32.js";
import { sfc32Next, type Sfc32State } from "./sfc32.js";

/**
 * A seeded, deterministic random source. Created via {@link createRng}; passed explicitly to every
 * provider. All draw methods advance the internal state deterministically.
 */
export interface Rng {
  /** The integer seed this generator was created from (part of the `Corpus` manifest). */
  readonly seed: number;
  /** The next unsigned 32-bit integer. */
  nextUint32(): number;
  /** The next float in `[0, 1)`. */
  float(): number;
  /**
   * A uniformly-distributed integer in the inclusive range `[min, max]`.
   *
   * @param min - Inclusive lower bound (integer).
   * @param max - Inclusive upper bound (integer, `>= min`).
   */
  int(min: number, max: number): number;
  /** `true` with probability `p` (default `0.5`). */
  bool(p?: number): boolean;
  /**
   * Pick one element from a non-empty array.
   *
   * @param items - A non-empty readonly array.
   */
  pick<T>(items: readonly T[]): T;
  /**
   * A string of `n` decimal digits (`0`–`9`), each drawn uniformly.
   *
   * @param n - The number of digits (`>= 0`).
   */
  digits(n: number): string;
}

/**
 * The concrete {@link Rng}. Holds the mutable `sfc32` state; every method advances it deterministically.
 */
class Sfc32Rng implements Rng {
  public readonly seed: number;
  readonly #state: Sfc32State;

  public constructor(seed: number) {
    this.seed = seed | 0;
    // Expand the single seed into four well-distributed state words. Seeding sfc32 directly from the
    // raw seed gives poor low-bit behavior; splitmix32 is the standard fix (bryc / roadmap §5).
    const mix = splitmix32(this.seed);
    this.#state = { a: mix(), b: mix(), c: mix(), d: mix() };
    // A short warm-up so nearby seeds diverge immediately.
    for (let i = 0; i < 8; i += 1) sfc32Next(this.#state);
  }

  public nextUint32(): number {
    return sfc32Next(this.#state);
  }

  public float(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  public int(min: number, max: number): number {
    if (max < min) throw new RangeError(`Rng.int: max (${String(max)}) < min (${String(min)})`);
    const span = max - min + 1;
    return min + Math.floor(this.float() * span);
  }

  public bool(p = 0.5): boolean {
    return this.float() < p;
  }

  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("Rng.pick: empty array");
    // `int(0, length-1)` is always in-bounds on a non-empty array, so this access cannot be a hole;
    // the cast discharges `noUncheckedIndexedAccess`'s `T | undefined` without a runtime re-check.
    return items[this.int(0, items.length - 1)] as T;
  }

  public digits(n: number): string {
    let out = "";
    for (let i = 0; i < n; i += 1) out += String(this.int(0, 9));
    return out;
  }
}

/**
 * Create a seeded, deterministic {@link Rng}. The same `seed` yields the same sequence everywhere.
 *
 * @param seed - The integer seed. Coerced to a 32-bit integer.
 * @returns A fresh, independent {@link Rng}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * const rng = createRng(12345);
 * rng.int(1, 6); // deterministic for seed 12345
 * ```
 */
export function createRng(seed: number): Rng {
  return new Sfc32Rng(seed);
}
