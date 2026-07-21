/**
 * The **seed-determinism property** for NCPDP (roadmap §5, §6 — mandatory). A seed, and only the seed,
 * determines the output: generating twice yields byte-identical SCRIPT XML / Telecom wire, for every
 * generator and the corpus. Every message id, timestamp, date, and identifier is drawn from the seeded
 * PRNG, never wall-clock or ambient entropy — the property that makes `synth` a reproducible fixture
 * source. (`buildNewRx`/`buildTelecomRequest` do not inject any clock; SCRIPT `SentTime` is seeded.)
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  generateNewRx,
  generateRxRenewalRequest,
  generateRxChangeRequest,
  generateB1,
  generateB2,
  generateB3,
  ncpdpCorpus,
} from "../../src/ncpdp/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

describe("NCPDP seed-determinism (mandatory property)", () => {
  it("each generator is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        for (const g of [
          generateNewRx,
          generateRxRenewalRequest,
          generateRxChangeRequest,
          generateB1,
          generateB2,
          generateB3,
        ]) {
          expect(g({ seed: s })).toBe(g({ seed: s }));
        }
      }),
      { numRuns: 80 },
    );
  });

  it("a different seed generally changes the bytes", () => {
    expect(generateNewRx({ seed: 1 })).not.toBe(generateNewRx({ seed: 2 }));
    expect(generateB1({ seed: 1 })).not.toBe(generateB1({ seed: 2 }));
  });

  it("an NCPDP corpus is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), fc.integer({ min: 1, max: 6 }), (s, count) => {
        const c1 = ncpdpCorpus({ seed: s, count }).artifacts.map((a) => a.content);
        const c2 = ncpdpCorpus({ seed: s, count }).artifacts.map((a) => a.content);
        expect(c1).toEqual(c2);
      }),
      { numRuns: 40 },
    );
  });
});
