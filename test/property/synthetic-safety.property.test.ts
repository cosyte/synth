/**
 * The **synthetic-safety gate** (roadmap §4.4, §6 — mandatory, must be ZERO). This is the executable
 * proof of the #1 invariant: for arbitrary seeds and the wired format, **no emitted value falls outside
 * a reserved / synthetic source** — so no generated value can be real or plausibly-real PHI. It is the
 * inverse of `deid`'s leak test: where `deid` proves real PHI is gone, this proves plausibly-real PHI
 * was never generated.
 *
 * It runs two ways: a **structured sweep** of the generated HL7 output at every PHI locus (parsed back
 * with `@cosyte/hl7`, then each field checked against the reserved-range predicates), and a
 * **provider-level sweep** over every safe primitive. A single value outside a synthetic source fails
 * the suite.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseHL7 } from "@cosyte/hl7";

import {
  createRng,
  safe,
  isSyntheticSsn,
  isSyntheticPhone,
  isSyntheticEmail,
  isSyntheticIp,
  SYNTHETIC_GIVEN_NAMES,
  SYNTHETIC_FAMILY_NAMES,
  SYNTHETIC_ASSIGNING_AUTHORITY,
} from "../../src/index.js";
import { generateAdt } from "../../src/hl7/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

/** A conservative real-data sweep: any dashed SSN in issuable-area form, or any non-reserved email. */
function realDataHits(content: string): string[] {
  const hits: string[] = [];
  for (const m of content.matchAll(/\b\d{3}-\d{2}-\d{4}\b/g)) {
    if (!isSyntheticSsn(m[0])) hits.push(`ssn:${m[0]}`);
  }
  for (const m of content.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g)) {
    if (!isSyntheticEmail(m[0])) hits.push(`email:${m[0]}`);
  }
  return hits;
}

describe("synthetic-safety gate — generated HL7 output (must be ZERO)", () => {
  it("every PHI-bearing PID locus is provably synthetic", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom(...(["A01", "A04", "A08"] as const)), (s, trigger) => {
        const content = generateAdt({ seed: s, trigger }).toString();
        const msg = parseHL7(content);

        // PID-19 SSN — never-issued area only.
        const ssnValue = msg.get("PID.19") ?? "";
        expect(isSyntheticSsn(ssnValue), `SSN ${ssnValue}`).toBe(true);

        // PID-13 phone — reserved 555-01xx block only.
        const phoneValue = msg.get("PID.13") ?? "";
        expect(isSyntheticPhone(phoneValue), `phone ${phoneValue}`).toBe(true);

        // PID-5 name — drawn only from the shipped fake-name pool.
        expect(SYNTHETIC_FAMILY_NAMES).toContain(msg.get("PID.5.1"));
        expect(SYNTHETIC_GIVEN_NAMES).toContain(msg.get("PID.5.2"));

        // PID-3 identifier — scoped to the synthetic assigning authority.
        expect(msg.get("PID.3.4")).toBe(SYNTHETIC_ASSIGNING_AUTHORITY.namespaceId);

        // Address ZIP is the reserved non-real 00000.
        expect(msg.get("PID.11.5")).toBe("00000");
      }),
      { numRuns: 400 },
    );
  });

  it("a raw real-data sweep over generated output finds ZERO hits", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom(...(["A01", "A04", "A08"] as const)), (s, trigger) => {
        const content = generateAdt({ seed: s, trigger }).toString();
        expect(realDataHits(content)).toEqual([]);
      }),
      { numRuns: 400 },
    );
  });
});

describe("synthetic-safety gate — provider-level (must be ZERO)", () => {
  it("no primitive value escapes its reserved / synthetic source", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rng = createRng(s);
        expect(isSyntheticSsn(safe.ssn(rng))).toBe(true);
        expect(isSyntheticSsn(safe.ssn(rng, "advertising"))).toBe(true);
        expect(isSyntheticPhone(safe.phone(rng))).toBe(true);
        const person = safe.name(rng);
        expect(SYNTHETIC_GIVEN_NAMES).toContain(person.given);
        expect(SYNTHETIC_FAMILY_NAMES).toContain(person.family);
        expect(isSyntheticEmail(safe.email(rng, person))).toBe(true);
        expect(isSyntheticIp(safe.ipv4(rng))).toBe(true);
        expect(isSyntheticIp(safe.ipv6(rng))).toBe(true);
        expect(safe.identifier(rng).assigningAuthority).toBe(
          SYNTHETIC_ASSIGNING_AUTHORITY.namespaceId,
        );
        expect(safe.address(rng).zip).toBe("00000");
      }),
      { numRuns: 500 },
    );
  });
});
