/**
 * Unit tests for the C-CDA generators' option branches and read-back — that a generated document is not
 * only spec-clean but carries the intended synthetic content, read through `@cosyte/ccda`'s own
 * accessors (the parser is the judge of what the builder actually emitted).
 */

import { describe, it, expect } from "vitest";
import { buildCcda, parseCcda, serializeCcda } from "@cosyte/ccda";

import {
  ccdaCorpus,
  generateCcd,
  generateCcda,
  generateReferralNote,
  roundTrip,
  toBuildCode,
  type CcdaCorpusKind,
} from "../../src/ccda/index.js";
import { SYNTHETIC_ASSIGNING_AUTHORITY } from "../../src/index.js";

describe("C-CDA generator read-back", () => {
  it("a generated CCD reads back a synthetic MRN, problems, medications, and results", () => {
    const doc = generateCcd({ seed: 5001 });
    expect(doc.documentType).toBe("ccd");
    // The MRN value is synthetic and lives under the synthetic assigning-authority OID.
    expect(doc.getMrn()).toMatch(/^\d{8}$/);
    expect(doc.getProblems().length).toBeGreaterThanOrEqual(1);
    expect(doc.getMedications().length).toBeGreaterThanOrEqual(1);
    expect(doc.getResults().length).toBeGreaterThanOrEqual(1);
    // The recordTarget id is scoped to the synthetic assigning-authority OID, never a real facility.
    expect(serializeCcda(doc)).toContain(`root="${SYNTHETIC_ASSIGNING_AUTHORITY.universalId}"`);
  });

  it("generateCcda defaults to a CCD; generateReferralNote specializes the header", () => {
    expect(generateCcda({ seed: 7 }).documentType).toBe("ccd");
    const rn = generateReferralNote({ seed: 7 });
    expect(rn.documentType).toBe("referralNote");
    // The Referral Note carries the Reason for Referral + Assessment narrative SHALL sections.
    const xml = serializeCcda(rn);
    expect(xml).toContain('code="42349-1"'); // Reason for Referral
    expect(xml).toContain('code="51848-0"'); // Assessment
  });

  it("a re-parse of a generated document is clean and preserves the patient name from the pool", () => {
    const doc = generateCcd({ seed: 5001 });
    const reparsed = parseCcda(serializeCcda(doc));
    expect(reparsed.warnings).toEqual([]);
    // The patient name round-trips (a synthetic given + family from the shipped pool).
    const name = reparsed.getPatient()?.name;
    expect(name).toBeDefined();
  });

  it("ccdaCorpus honors a custom mix and reports per-kind counts", () => {
    const mix: CcdaCorpusKind[] = ["ccd", "ccd", "referralNote"];
    const corpus = ccdaCorpus({ seed: 9, count: 6, mix });
    expect(corpus.artifacts).toHaveLength(6);
    expect(corpus.manifest.counts["ccd"]).toBe(4);
    expect(corpus.manifest.counts["referralNote"]).toBe(2);
    expect(corpus.artifacts.every((a) => a.warnings.length === 0)).toBe(true);
  });

  it("ccdaCorpus defaults to a single CCD when count/mix are omitted", () => {
    const corpus = ccdaCorpus({ seed: 3 });
    expect(corpus.artifacts).toHaveLength(1);
    expect(corpus.artifacts[0]?.kind).toBe("ccd");
    expect(corpus.artifacts[0]?.format).toBe("ccda");
  });

  it("toBuildCode throws on a code system with no OID mapping (never silently mis-codes)", () => {
    expect(() =>
      toBuildCode({ system: "http://example.com/unknown", code: "X", display: "X" }),
    ).toThrow(/no OID mapping/);
  });
});

describe("C-CDA round-trip harness surfaces parser warnings faithfully", () => {
  it("a document with an explicit-unknown smoking status round-trips to exactly that warning", () => {
    // Build a document whose Social History carries an *omitted* smoking-status value — the parser
    // reads it back as an explicit unknown and flags `SMOKING_STATUS_UNKNOWN`. The synth roundTrip
    // harness must report that warning (proving it does not launder a real parser warning to green).
    const doc = buildCcda({
      effectiveTime: "20240101",
      patient: { mrn: "12345678", given: ["Testina"], family: "Nonesuch", gender: "F" },
      smokingStatus: [{}],
    });
    const rt = roundTrip(doc);
    expect(rt.warnings).toContain("SMOKING_STATUS_UNKNOWN");
    expect(rt.specClean).toBe(false);
    // Byte-stability is independent of warnings — a warned document still re-serializes identically.
    expect(rt.byteStable).toBe(true);
  });
});
