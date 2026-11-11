/**
 * The 005010 claim guides transmit an ICD-10-CM code in `HI` without its decimal point, and
 * `@cosyte/deid` 0.2 removes a code at `HI` that does not have that shape. These pin the pool and
 * the generated claims to the transmitted form.
 */
import { describe, expect, it } from "vitest";

import { DIAGNOSES, x12Corpus } from "../../src/x12/index.js";

/** The shape of an ICD-10-CM code as an `HI` composite carries it: no decimal point. */
const ICD10_CM_WIRE = /^[A-Z]\d[A-Z0-9]{1,5}$/;

describe("X12 diagnosis codes", () => {
  it("writes every pooled ICD-10-CM code without its decimal point", () => {
    for (const { code } of DIAGNOSES) expect(code).toMatch(ICD10_CM_WIRE);
  });

  it("writes every HI diagnosis of a generated 837 without a decimal point", () => {
    const corpus = x12Corpus({ seed: 6001, count: 30, verify: false });
    const hi = corpus.artifacts
      .flatMap((a) => a.content.split("~"))
      .filter((segment) => segment.startsWith("HI*"));
    expect(hi.length).toBeGreaterThan(0);
    for (const segment of hi) {
      const [, composite = ""] = segment.split("*");
      const [qualifier, code = ""] = composite.split(":");
      expect(["ABK", "ABF"]).toContain(qualifier);
      expect(code).toMatch(ICD10_CM_WIRE);
    }
  });
});
