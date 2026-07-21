/**
 * The **synthetic-safety property** for ASTM (roadmap §4, §6 — mandatory) plus the **spec-clean
 * round-trip** property (roadmap §4.5, the two-headed hazard). For arbitrary seeds and every message,
 * no value at the `P` (patient) record's PHI-bearing loci may escape the reserved/synthetic sources:
 *
 * - every patient **name** component (field 6, `Last^First^Middle`, tokens ≥ 2 chars) is from the
 *   shipped clearly-fake pool;
 * - the **practice-assigned** (field 3) and **laboratory-assigned** (field 4) patient ids are each
 *   synthetic-AA-scoped (`PRA` / `LAB`-prefixed) and stay **distinct**.
 *
 * And the first head of the hazard: every generated message (bare and framed) round-trips through
 * `@cosyte/astm` **spec-clean** — zero warnings and byte-stable — so a "spec-clean" claim can never
 * hide an unintended warning. This is the executable proof of synthetic-by-construction: the same
 * structured checks the `phi-scan` ASTM arm runs (roadmap §4.4).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  generateAstmResult,
  generateAstmOrder,
  generateAstmResultFramed,
  astmRoundTrip,
  astmFramedRoundTrip,
} from "../../src/astm/index.js";
import { SYNTHETIC_GIVEN_NAMES, SYNTHETIC_FAMILY_NAMES } from "../../src/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

const NAME_POOL = new Set(
  [...SYNTHETIC_GIVEN_NAMES, ...SYNTHETIC_FAMILY_NAMES].map((n) => n.toUpperCase()),
);

/** Extract each `P`-record field array from a bare or framed ASTM stream (tolerating a frame prefix). */
function patientRecords(text: string): string[][] {
  const out: string[][] = [];
  for (const m of text.matchAll(/(?:[\r\n]|^|\x02[0-7])P\|([^\r\n\x03\x17]*)/g)) {
    out.push(`P|${m[1] ?? ""}`.split("|"));
  }
  return out;
}

/** Assert every `P`-record identity locus in an ASTM stream is synthetic-by-construction. */
function assertAstmSynthetic(text: string): void {
  const patients = patientRecords(text);
  expect(patients.length).toBeGreaterThan(0);
  for (const fields of patients) {
    // Field 6 (index 5) — name components. Every ≥ 2-char token must be in the fake-name pool.
    for (const token of (fields[5] ?? "").split("^")) {
      const t = token.trim();
      if (t.length < 2) continue;
      expect(NAME_POOL.has(t.toUpperCase()), `name ${t} must be in the pool`).toBe(true);
    }
    // Fields 3 + 4 — practice / lab ids: synthetic-AA-scoped and distinct.
    const practice = (fields[2] ?? "").trim();
    const lab = (fields[3] ?? "").trim();
    expect(/^PRA\d+$/.test(practice), `practice id ${practice} synthetic-AA-scoped`).toBe(true);
    expect(/^LAB\d+$/.test(lab), `lab id ${lab} synthetic-AA-scoped`).toBe(true);
    expect(practice).not.toBe(lab);
  }
}

describe("ASTM synthetic-safety (mandatory property)", () => {
  it("every record message draws all P-record identity from synthetic sources", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        assertAstmSynthetic(generateAstmResult({ seed: s }));
        assertAstmSynthetic(generateAstmOrder({ seed: s }));
      }),
      { numRuns: 150 },
    );
  });

  it("the framed twin carries the same synthetic P-record identity", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const bytes = generateAstmResultFramed({ seed: s });
        let text = "";
        for (const b of bytes) text += String.fromCharCode(b);
        assertAstmSynthetic(text);
      }),
      { numRuns: 80 },
    );
  });
});

describe("ASTM spec-clean round-trip (mandatory property — the first head of the hazard)", () => {
  it("every generated record message round-trips spec-clean (zero warnings, byte-stable)", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        expect(astmRoundTrip(generateAstmResult({ seed: s })).specClean).toBe(true);
        expect(astmRoundTrip(generateAstmOrder({ seed: s })).specClean).toBe(true);
      }),
      { numRuns: 150 },
    );
  });

  it("every generated framed message round-trips spec-clean (zero frame + record warnings)", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        expect(astmFramedRoundTrip(generateAstmResultFramed({ seed: s })).specClean).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
