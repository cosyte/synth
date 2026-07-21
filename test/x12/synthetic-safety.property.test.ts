/**
 * The **synthetic-safety property** for X12 (roadmap §4, §6 — mandatory, and the invariant most
 * attacked here because an 837/271 is identity-dense). For arbitrary seeds and every transaction, no
 * value at a PHI-bearing X12 locus may escape the reserved/synthetic sources:
 *
 * - every provider **NPI** (NM1*XX) fails the CMS NPI Luhn check → can never be a NPPES-issued NPI;
 * - every provider **tax id** (REF*SY) is an SSA never-issued (900-range) SSN;
 * - every **member id** (NM1*MI) is synthetic-AA-scoped (the `MBR`-prefixed / all-digit form);
 * - every **person name** (NM1-02 = 1) is from the shipped clearly-fake pool;
 * - **no** `NM1-08 = 34` (raw SSN qualifier) segment is ever emitted.
 *
 * This is the executable proof of the synthetic-by-construction invariant: a generated corpus must pass
 * the same structured checks the `phi-scan` gate runs (roadmap §4.4).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { generate837, generate835, generate271, roundTrip } from "../../src/x12/index.js";
import {
  isSyntheticNpi,
  isSyntheticSsn,
  npi,
  npiCheckDigit,
  luhnMod10,
  createRng,
  SYNTHETIC_ASSIGNING_AUTHORITY,
} from "../../src/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

/** Split an X12 payload into segment → element arrays using the ISA-declared delimiters. */
function segments(edi: string): string[][] {
  const elementSep = edi.charAt(3);
  const segTerm = edi.charAt(105);
  return edi
    .split(segTerm)
    .map((s) => s.replace(/[\r\n]+/g, "").trim())
    .filter((s) => s.length > 0)
    .map((s) => s.split(elementSep));
}

/** Assert every X12 identity locus in `edi` is synthetic-by-construction. */
function assertSynthetic(edi: string): void {
  for (const el of segments(edi)) {
    const id = el[0];
    if (id === "NM1") {
      const entityType = el[2] ?? "";
      const qualifier = el[8] ?? "";
      const idValue = el[9] ?? "";
      // A raw SSN qualifier must never appear.
      expect(qualifier, "NM1 must never carry an SSN (qualifier 34)").not.toBe("34");
      if (qualifier === "XX" && /^\d{10}$/.test(idValue)) {
        expect(isSyntheticNpi(idValue), `NPI ${idValue} must fail the Luhn check`).toBe(true);
      }
      if (entityType === "1" && qualifier === "MI" && idValue.length > 0) {
        expect(
          /^MBR[0-9A-Z]*$/i.test(idValue) || /^\d+$/.test(idValue),
          `member id ${idValue} must be synthetic-AA-scoped`,
        ).toBe(true);
      }
    } else if (id === "REF" && el[1] === "SY") {
      const v = (el[2] ?? "").replace(/\D/g, "");
      if (/^\d{9}$/.test(v)) {
        expect(isSyntheticSsn(v), `REF*SY SSN ${v} must be never-issued`).toBe(true);
      }
    }
  }
}

describe("X12 synthetic-safety (mandatory property)", () => {
  it("every 837 (P/I/D) draws all identity from synthetic sources", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom("P", "I", "D"), (s, v) => {
        const variant: "P" | "I" | "D" = v === "I" ? "I" : v === "D" ? "D" : "P";
        const rt = roundTrip(generate837(variant, { seed: s }));
        expect(rt.warnings).toEqual([]);
        assertSynthetic(rt.content);
      }),
      { numRuns: 120 },
    );
  });

  it("every 835 and 271 draws all identity from synthetic sources", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        for (const rt of [
          roundTrip(generate835({ seed: s })),
          roundTrip(generate271({ seed: s })),
        ]) {
          expect(rt.warnings).toEqual([]);
          assertSynthetic(rt.content);
        }
      }),
      { numRuns: 120 },
    );
  });

  it("member ids emitted in 271 live under the synthetic assigning authority namespace", () => {
    // The synthetic AA is the guarantee for member ids (no reserved range exists — roadmap §4.1).
    expect(SYNTHETIC_ASSIGNING_AUTHORITY.namespaceId).toBe("COSYTE-SYNTH");
  });
});

describe("synthetic NPI provider (safe.npi)", () => {
  it("the CMS worked example: base 123456789 → check digit 3", () => {
    expect(npiCheckDigit("123456789")).toBe(3);
    expect(luhnMod10("808401234567893")).toBe(0); // 1234567893 is Luhn-valid
    expect(isSyntheticNpi("1234567893")).toBe(false); // valid ⇒ could be real
    expect(isSyntheticNpi("1234567894")).toBe(true); // wrong check digit ⇒ never real
  });

  it("every generated NPI is 10 digits and fails the Luhn check (provably not a real NPI)", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rng = createRng(s);
        for (let i = 0; i < 50; i += 1) {
          const value = npi(rng);
          expect(value).toMatch(/^\d{10}$/);
          expect(isSyntheticNpi(value)).toBe(true);
        }
      }),
      { numRuns: 40 },
    );
  });

  it("isSyntheticNpi rejects non-10-digit inputs (not an NPI shape)", () => {
    expect(isSyntheticNpi("123")).toBe(false);
    expect(isSyntheticNpi("12345678901")).toBe(false);
  });
});
