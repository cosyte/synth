/**
 * The **seed-determinism property** for ASTM (roadmap §5, §6 — mandatory). A seed, and only the seed,
 * determines the output: generating twice yields a byte-identical record stream (and framed byte stream)
 * for every generator and the corpus. Every name, DOB, identifier, result value, and comment is drawn
 * from the seeded PRNG, never wall-clock or ambient entropy — and `buildAstmMessage` injects no clock
 * (unlike `buildCcda`'s `effectiveTime`), so the report is reproducible end to end.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  generateAstmResult,
  generateAstmOrder,
  generateAstmResultFramed,
  astmCorpus,
} from "../../src/astm/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

describe("ASTM seed-determinism (mandatory property)", () => {
  it("each record generator is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        expect(generateAstmResult({ seed: s })).toBe(generateAstmResult({ seed: s }));
        expect(generateAstmOrder({ seed: s })).toBe(generateAstmOrder({ seed: s }));
      }),
      { numRuns: 80 },
    );
  });

  it("the framed generator is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        expect([...generateAstmResultFramed({ seed: s })]).toEqual([
          ...generateAstmResultFramed({ seed: s }),
        ]);
      }),
      { numRuns: 60 },
    );
  });

  it("a different seed generally changes the bytes", () => {
    expect(generateAstmResult({ seed: 1 })).not.toBe(generateAstmResult({ seed: 2 }));
  });

  it("an ASTM corpus is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), fc.integer({ min: 1, max: 6 }), (s, count) => {
        const c1 = astmCorpus({ seed: s, count }).artifacts.map((a) => a.content);
        const c2 = astmCorpus({ seed: s, count }).artifacts.map((a) => a.content);
        expect(c1).toEqual(c2);
      }),
      { numRuns: 40 },
    );
  });
});
