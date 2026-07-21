/**
 * The **synthetic-safety property** for NCPDP (roadmap §4, §6 — mandatory, and the invariant most
 * attacked here because SCRIPT + Telecom carry patient **and** prescriber identity, including the DEA
 * that X12 did not have). For arbitrary seeds and every transaction, no value at a PHI-bearing locus may
 * escape the reserved/synthetic sources:
 *
 * - every person **name** (SCRIPT `<FirstName>`/`<LastName>`; Telecom CA/CB/CC/CD) is from the shipped
 *   clearly-fake pool;
 * - every prescriber **NPI** (SCRIPT `<NPI>`; Telecom DB) fails the CMS NPI Luhn check;
 * - every prescriber **DEA** (SCRIPT `<DEANumber>`) fails the published DEA checksum;
 * - every **phone** (Telecom CQ) carries the reserved 555-01xx tail;
 * - every patient / cardholder **id** (Telecom CY/C2) is synthetic-AA-scoped (`MBR`-prefixed).
 *
 * This is the executable proof of the synthetic-by-construction invariant: a generated corpus must pass
 * the same structured checks the `phi-scan` gate runs (roadmap §4.4).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  generateNewRx,
  generateRxRenewalRequest,
  generateRxChangeRequest,
  generateTelecom,
} from "../../src/ncpdp/index.js";
import {
  createRng,
  isSyntheticNpi,
  isSyntheticDea,
  isSyntheticPhone,
  dea,
  deaCheckDigit,
  SYNTHETIC_GIVEN_NAMES,
  SYNTHETIC_FAMILY_NAMES,
} from "../../src/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

const NAME_POOL = new Set(
  [...SYNTHETIC_GIVEN_NAMES, ...SYNTHETIC_FAMILY_NAMES].map((n) => n.toUpperCase()),
);

/** Assert every identity locus in a SCRIPT XML string is synthetic-by-construction. */
function assertScriptSynthetic(xml: string): void {
  for (const m of xml.matchAll(/<(?:First|Last|Middle)Name>([^<]+)<\//g)) {
    expect(
      NAME_POOL.has((m[1] ?? "").trim().toUpperCase()),
      `name ${m[1] ?? ""} must be in the pool`,
    ).toBe(true);
  }
  for (const m of xml.matchAll(/<NPI>([^<]+)<\/NPI>/g)) {
    expect(isSyntheticNpi((m[1] ?? "").trim()), `NPI ${m[1] ?? ""} must fail the Luhn check`).toBe(
      true,
    );
  }
  for (const m of xml.matchAll(/<DEANumber>([^<]+)<\/DEANumber>/g)) {
    expect(isSyntheticDea((m[1] ?? "").trim()), `DEA ${m[1] ?? ""} must fail the checksum`).toBe(
      true,
    );
  }
}

/** Assert every identity locus in a Telecom wire string is synthetic-by-construction. */
function assertTelecomSynthetic(wire: string): void {
  for (const token of wire.split(/[\x1c\x1d\x1e]/)) {
    if (token.length < 2) continue;
    const id = token.slice(0, 2);
    const value = token.slice(2);
    if (["CA", "CB", "CC", "CD"].includes(id)) {
      expect(NAME_POOL.has(value.trim().toUpperCase()), `name ${value} must be in the pool`).toBe(
        true,
      );
    } else if (id === "CQ") {
      expect(isSyntheticPhone(value), `phone ${value} must be 555-01xx`).toBe(true);
    } else if (id === "CY" || id === "C2") {
      expect(/^MBR\d+$/.test(value.trim()), `id ${value} must be synthetic-AA-scoped`).toBe(true);
    } else if (id === "DB") {
      expect(isSyntheticNpi(value), `prescriber NPI ${value} must fail the Luhn check`).toBe(true);
    }
  }
}

describe("NCPDP synthetic-safety (mandatory property)", () => {
  it("every SCRIPT transaction draws all identity from synthetic sources", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        assertScriptSynthetic(generateNewRx({ seed: s }));
        assertScriptSynthetic(generateRxRenewalRequest({ seed: s }));
        assertScriptSynthetic(generateRxChangeRequest({ seed: s }));
      }),
      { numRuns: 120 },
    );
  });

  it("every Telecom transaction (B1/B2/B3) draws all identity from synthetic sources", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom("B1", "B2", "B3"), (s, code) => {
        const c: "B1" | "B2" | "B3" = code === "B2" ? "B2" : code === "B3" ? "B3" : "B1";
        assertTelecomSynthetic(generateTelecom(c, { seed: s }));
      }),
      { numRuns: 120 },
    );
  });
});

describe("synthetic DEA provider (safe.dea)", () => {
  it("the published DEA checksum: base 351234 → check digit", () => {
    // (3+1+3) + 2·(5+2+4) = 7 + 22 = 29 → units digit 9.
    expect(deaCheckDigit("351234")).toBe(9);
    expect(isSyntheticDea("AB3512349")).toBe(false); // matching check digit ⇒ could be real
    expect(isSyntheticDea("AB3512340")).toBe(true); // wrong check digit ⇒ never real
  });

  it("every generated DEA is XX+7-digits and fails the checksum (provably not a real DEA)", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rng = createRng(s);
        for (let i = 0; i < 40; i += 1) {
          const value = dea(rng);
          expect(value).toMatch(/^[A-Z]{2}\d{7}$/);
          expect(isSyntheticDea(value)).toBe(true);
        }
      }),
      { numRuns: 40 },
    );
  });

  it("isSyntheticDea rejects non-DEA-shaped inputs", () => {
    expect(isSyntheticDea("12345")).toBe(false);
    expect(isSyntheticDea("ABCDEFG")).toBe(false);
  });
});
