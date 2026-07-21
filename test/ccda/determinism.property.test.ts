/**
 * The **seed-determinism property** for C-CDA (roadmap §5, §6 — mandatory). A seed, and only the seed,
 * determines the output: generating twice yields byte-identical serialized documents, for both the CCD
 * and Referral Note generators and the corpus. This is the property that makes `synth` a reproducible
 * fixture source — and the one `buildCcda`'s default `effectiveTime: new Date()` would silently break
 * if the generator did not pass an explicit synthetic date.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { serializeCcda } from "@cosyte/ccda";

import { ccdaCorpus, generateCcd, generateReferralNote } from "../../src/ccda/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

describe("C-CDA seed-determinism (mandatory property)", () => {
  // `buildCcda` parses XML through @xmldom/xmldom on every build, so a C-CDA build is materially
  // heavier than a FHIR/HL7 one — the seed sweeps here are sized (and given a generous per-test
  // timeout) so the property stays meaningful without timing out under v8 coverage instrumentation.
  it("each document generator is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        expect(serializeCcda(generateCcd({ seed: s }))).toBe(
          serializeCcda(generateCcd({ seed: s })),
        );
        expect(serializeCcda(generateReferralNote({ seed: s }))).toBe(
          serializeCcda(generateReferralNote({ seed: s })),
        );
      }),
      { numRuns: 60 },
    );
  }, 60_000);

  it("a C-CDA corpus is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), fc.integer({ min: 1, max: 4 }), (s, count) => {
        const c1 = ccdaCorpus({ seed: s, count }).artifacts.map((x) => x.content);
        const c2 = ccdaCorpus({ seed: s, count }).artifacts.map((x) => x.content);
        expect(c1).toEqual(c2);
      }),
      { numRuns: 30 },
    );
  }, 60_000);

  it("a different seed produces different output", () => {
    expect(serializeCcda(generateCcd({ seed: 1 }))).not.toBe(
      serializeCcda(generateCcd({ seed: 2 })),
    );
  });
});
