/**
 * The **synthetic-safety gate** for C-CDA (roadmap §4.4, §6 — mandatory, must be ZERO). For arbitrary
 * seeds and both document types, **no emitted value falls outside a reserved / synthetic source** — so
 * no generated document can carry real or plausibly-real PHI (roadmap §4.5, the synthetic-safety breach
 * head the refuter attacks).
 *
 * Two sweeps: a **raw cross-cutting sweep** (no issuable-area dashed SSN, no non-reserved email, anywhere
 * in the serialized XML) and a **structured sweep** over the C-CDA identity loci — the recordTarget
 * patient `name` (`<given>` / `<family>` from the shipped pool), any `telecom` phone (reserved
 * `555-01xx`), and the patientRole MRN `id` (scoped to the synthetic assigning-authority OID, never a
 * real facility namespace).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { serializeCcda } from "@cosyte/ccda";

import { generateCcd, generateReferralNote } from "../../src/ccda/index.js";
import {
  isSyntheticEmail,
  isSyntheticPhone,
  isSyntheticSsn,
  SYNTHETIC_ASSIGNING_AUTHORITY,
  SYNTHETIC_FAMILY_NAMES,
  SYNTHETIC_GIVEN_NAMES,
} from "../../src/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

const NAME_POOL = new Set<string>([...SYNTHETIC_GIVEN_NAMES, ...SYNTHETIC_FAMILY_NAMES]);
const SYNTH_OID = SYNTHETIC_ASSIGNING_AUTHORITY.universalId;

/** A conservative real-data sweep: any issuable-area dashed SSN, or any non-reserved email. */
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

/** Structured sweep over a serialized C-CDA document; pushes a hit for any non-synthetic identity value. */
function structuredHits(xml: string): string[] {
  const hits: string[] = [];
  // Patient name tokens — every <given>/<family> must be from the shipped pool.
  for (const m of xml.matchAll(/<(given|family)(?:\s[^>]*)?>([^<]+)<\/\1>/g)) {
    const token = (m[2] ?? "").trim();
    if (token.length > 0 && !NAME_POOL.has(token)) hits.push(`${m[1] ?? "name"}:${token}`);
  }
  // Telecom phone — a tel: value must carry the reserved 555-01xx tail.
  for (const m of xml.matchAll(/<telecom\b[^>]*\bvalue="tel:([^"]+)"/g)) {
    const value = m[1] ?? "";
    if (/\d{7,}/.test(value.replace(/\D/g, "")) && !isSyntheticPhone(value)) {
      hits.push(`phone:${value}`);
    }
  }
  return hits;
}

// `buildCcda` parses XML through @xmldom/xmldom on every build, so a C-CDA build is materially heavier
// than a FHIR/HL7 one — these sweeps are sized (and given a generous per-test timeout) so the gate stays
// meaningful without timing out under v8 coverage instrumentation.
describe("synthetic-safety gate — generated C-CDA output (must be ZERO)", () => {
  it("no document leaks a real-data SSN or non-reserved email shape", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        for (const doc of [generateCcd({ seed: s }), generateReferralNote({ seed: s })]) {
          expect(realDataHits(serializeCcda(doc))).toEqual([]);
        }
      }),
      { numRuns: 60 },
    );
  }, 60_000);

  it("every C-CDA identity locus is provably synthetic", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        for (const doc of [generateCcd({ seed: s }), generateReferralNote({ seed: s })]) {
          const xml = serializeCcda(doc);
          expect(structuredHits(xml)).toEqual([]);
          // The MRN lives under the synthetic assigning-authority OID — never a real facility namespace.
          const patientId = /<patientRole><id root="([^"]+)"/.exec(xml);
          expect(patientId?.[1]).toBe(SYNTH_OID);
        }
      }),
      { numRuns: 60 },
    );
  }, 60_000);
});
