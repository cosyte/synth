/**
 * The **seed-determinism property** (roadmap §5, §6 — mandatory). A seed, and only the seed,
 * determines the output: for an arbitrary seed, generating twice yields byte-identical artifacts, on
 * any machine, any run. This is the property the parsers', `transform`'s, and `deid`'s regression
 * suites depend on.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { createRng } from "../../src/index.js";
import { generateAdt, hl7Corpus } from "../../src/hl7/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

describe("seed-determinism (mandatory property)", () => {
  it("the raw RNG stream is identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const a = createRng(s);
        const b = createRng(s);
        for (let i = 0; i < 32; i += 1) expect(a.nextUint32()).toBe(b.nextUint32());
      }),
      { numRuns: 300 },
    );
  });

  it("HL7 ADT generation is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom(...(["A01", "A04", "A08"] as const)), (s, trigger) => {
        const a = generateAdt({ seed: s, trigger }).toString();
        const b = generateAdt({ seed: s, trigger }).toString();
        expect(a).toBe(b);
      }),
      { numRuns: 300 },
    );
  });

  it("an HL7 corpus is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), fc.integer({ min: 1, max: 8 }), (s, count) => {
        const c1 = hl7Corpus({ seed: s, count }).artifacts.map((x) => x.content);
        const c2 = hl7Corpus({ seed: s, count }).artifacts.map((x) => x.content);
        expect(c1).toEqual(c2);
      }),
      { numRuns: 150 },
    );
  });
});
