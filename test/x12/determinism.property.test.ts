/**
 * The **seed-determinism property** for X12 (roadmap §5, §6 — mandatory). A seed, and only the seed,
 * determines the output: generating twice yields byte-identical serialized interchanges, for every
 * transaction generator and the corpus. This is the property that makes `synth` a reproducible fixture
 * source — every control number, date, and identifier is drawn from the seeded PRNG, never wall-clock
 * or ambient entropy.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { serializeX12 } from "@cosyte/x12";

import { generate837, generate835, generate271, x12Corpus } from "../../src/x12/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

describe("X12 seed-determinism (mandatory property)", () => {
  it("each transaction generator is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        for (const v of ["P", "I", "D"] as const) {
          expect(serializeX12(generate837(v, { seed: s }))).toBe(
            serializeX12(generate837(v, { seed: s })),
          );
        }
        expect(serializeX12(generate835({ seed: s }))).toBe(serializeX12(generate835({ seed: s })));
        expect(serializeX12(generate271({ seed: s }))).toBe(serializeX12(generate271({ seed: s })));
      }),
      { numRuns: 80 },
    );
  });

  it("a different seed generally changes the bytes", () => {
    // Not a strict guarantee, but the identity space is large enough that a collision is negligible.
    expect(serializeX12(generate837("P", { seed: 1 }))).not.toBe(
      serializeX12(generate837("P", { seed: 2 })),
    );
  });

  it("an X12 corpus is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), fc.integer({ min: 1, max: 5 }), (s, count) => {
        const c1 = x12Corpus({ seed: s, count }).artifacts.map((a) => a.content);
        const c2 = x12Corpus({ seed: s, count }).artifacts.map((a) => a.content);
        expect(c1).toEqual(c2);
      }),
      { numRuns: 40 },
    );
  });
});
