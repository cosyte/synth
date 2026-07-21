/**
 * The **`@cosyte/deid` pairing loop** (roadmap §Phase 8) — the closed-loop co-validation harness.
 *
 * These tests exercise the loop end to end across every covered format and assert its three contracts:
 * the **removal** side (no planted synthetic PHI sentinel survives de-identification), the **over-scrub**
 * side (no clinical value is lost), and **seed-determinism** (a seed fixes the verdict). Two further
 * groups prove the parts the `conformance-refuter` cares about: **non-vacuity** (the loop genuinely
 * fails when a sentinel survives — proven by tampering) and the **synthetic-safety** of the sentinels
 * themselves (every planted token is drawn from a guaranteed-non-colliding source, never realistic).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { isSyntheticSsn, isSyntheticPhone, isSyntheticEmail } from "../../src/index.js";
import {
  SYNTHETIC_GIVEN_NAMES,
  SYNTHETIC_FAMILY_NAMES,
  SYNTHETIC_STREET_NAMES,
  SYNTHETIC_CITY_NAMES,
} from "../../src/safe/names-pool.js";
import type { GenericLocus } from "@cosyte/deid";

import {
  hl7DeidLoop,
  fhirDeidLoop,
  x12DeidLoop,
  ncpdpTelecomDeidLoop,
  ccdaDeidLoop,
  summarizeDeidCoverage,
  sweepSurvivors,
  assembleVerdict,
  deidLoopPolicy,
  identifierSentinels,
  recordTargetSentinels,
  clinicalRetention,
  DEID_LOOP_POLICY_NAME,
  DEID_LOOP_COVERED_FORMATS,
  DEID_LOOP_SKIPPED,
  type DeidLoopResult,
} from "../../src/deid/index.js";

const SEEDS = [0, 1, 42, 999, 2024, 123456] as const;

/** Every loop run across every format/variant, for a given seed — the corpus these tests assert over. */
function allRuns(seed: number): DeidLoopResult[] {
  return [
    hl7DeidLoop({ seed, kind: "ORU^R01" }),
    hl7DeidLoop({ seed, kind: "ADT^A01" }),
    hl7DeidLoop({ seed, kind: "ORM^O01" }),
    hl7DeidLoop({ seed, kind: "VXU^V04" }),
    fhirDeidLoop({ seed }),
    x12DeidLoop({ seed, variant: "837P" }),
    x12DeidLoop({ seed, variant: "837I" }),
    x12DeidLoop({ seed, variant: "271" }),
    ncpdpTelecomDeidLoop({ seed, transaction: "B1" }),
    ccdaDeidLoop({ seed, documentType: "ccd" }),
    ccdaDeidLoop({ seed, documentType: "referral" }),
  ];
}

describe("the deid pairing loop — removal + over-scrub, every covered format", () => {
  for (const seed of SEEDS) {
    it(`every artifact passes: no sentinel survives, no clinical value is scrubbed (seed ${seed})`, () => {
      for (const r of allRuns(seed)) {
        // Removal side: sentinels were planted, and none survived de-identification.
        expect(r.planted.length, `${r.format}/${r.artifact} planted`).toBeGreaterThan(0);
        expect(r.survivors, `${r.format}/${r.artifact} survivors`).toStrictEqual([]);
        // Over-scrub side: nothing clinical was lost.
        expect(r.clinicalScrubbed, `${r.format}/${r.artifact} over-scrub`).toStrictEqual([]);
        expect(r.pass, `${r.format}/${r.artifact} pass`).toBe(true);
      }
    });
  }

  it("the over-scrub guard actually runs on the clinically-dense artifacts", () => {
    // ORU (labs), 837P (procedures), a Bundle (observations), and a CCD (problems/meds) each carry
    // distinctive structured clinical codes, so the retention guard is exercised, not vacuous.
    expect(hl7DeidLoop({ seed: 999, kind: "ORU^R01" }).clinicalProbed.length).toBeGreaterThan(0);
    expect(x12DeidLoop({ seed: 1, variant: "837P" }).clinicalProbed.length).toBeGreaterThan(0);
    expect(fhirDeidLoop({ seed: 1 }).clinicalProbed.length).toBeGreaterThan(0);
    expect(ccdaDeidLoop({ seed: 1 }).clinicalProbed.length).toBeGreaterThan(0);
  });

  it("passes for every X12 variant and every NCPDP Telecom transaction", () => {
    for (const variant of ["837P", "837I", "837D", "271", "835"] as const) {
      expect(x12DeidLoop({ seed: 3, variant }).pass, `x12 ${variant}`).toBe(true);
    }
    for (const transaction of ["B1", "B2", "B3"] as const) {
      expect(ncpdpTelecomDeidLoop({ seed: 3, transaction }).pass, `ncpdp ${transaction}`).toBe(
        true,
      );
    }
  });

  it("the removal policy needs no key context and is the removal-oriented one", () => {
    const policy = deidLoopPolicy();
    expect(policy.name).toBe(DEID_LOOP_POLICY_NAME);
    // A run completes without throwing DEID_NO_KEY — i.e. no keyed transform is reached.
    expect(() => hl7DeidLoop({ seed: 5 })).not.toThrow();
  });
});

describe("the deid pairing loop — seed-determinism", () => {
  it("the same seed yields the byte-identical spec-clean artifact, de-identified output, and sentinels", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        const a = hl7DeidLoop({ seed, kind: "ORU^R01" });
        const b = hl7DeidLoop({ seed, kind: "ORU^R01" });
        expect(b.original).toBe(a.original);
        expect(b.deidentified).toBe(a.deidentified);
        expect(b.planted.map((s) => s.token)).toStrictEqual(a.planted.map((s) => s.token));
      }),
      { numRuns: 100 },
    );
  });

  it("determinism holds across the other formats too", () => {
    for (const seed of [7, 313]) {
      expect(fhirDeidLoop({ seed }).deidentified).toBe(fhirDeidLoop({ seed }).deidentified);
      expect(x12DeidLoop({ seed }).deidentified).toBe(x12DeidLoop({ seed }).deidentified);
      expect(ncpdpTelecomDeidLoop({ seed }).deidentified).toBe(
        ncpdpTelecomDeidLoop({ seed }).deidentified,
      );
      expect(ccdaDeidLoop({ seed }).deidentified).toBe(ccdaDeidLoop({ seed }).deidentified);
    }
  });
});

describe("the deid pairing loop — non-vacuity (it genuinely detects a surviving sentinel)", () => {
  it("the sweep finds every planted sentinel in the ORIGINAL (pre-de-id) artifact", () => {
    // If de-id did nothing, every sentinel is present — proving the sweep detects presence, so a clean
    // run's empty survivor set is a real result, not a sweep that can never match.
    for (const r of allRuns(42)) {
      const survivorsIfUntouched = sweepSurvivors(r.original, r.planted);
      expect(survivorsIfUntouched.map((s) => s.token).sort()).toStrictEqual(
        r.planted.map((s) => s.token).sort(),
      );
    }
  });

  it("a de-id that removed nothing (deidentified === original) fails the loop", () => {
    const r = hl7DeidLoop({ seed: 7 });
    const tampered = assembleVerdict({
      format: r.format,
      artifact: r.artifact,
      seed: r.seed,
      planted: r.planted,
      original: r.original,
      deidentified: r.original, // pretend de-id was a no-op
      clinicalCodes: [],
    });
    expect(tampered.survivors.length).toBe(r.planted.length);
    expect(tampered.pass).toBe(false);
  });

  it("re-injecting a single sentinel into the de-identified output is caught", () => {
    const r = fhirDeidLoop({ seed: 11 });
    expect(r.pass).toBe(true);
    const leaked = r.planted[0];
    expect(leaked).toBeDefined();
    if (leaked === undefined) return;
    const tamperedOutput = `${r.deidentified}\n<!-- leaked: ${leaked.token} -->`;
    const survivors = sweepSurvivors(tamperedOutput, r.planted);
    expect(survivors.map((s) => s.token)).toContain(leaked.token);

    const tamperedVerdict = assembleVerdict({
      format: r.format,
      artifact: r.artifact,
      seed: r.seed,
      planted: r.planted,
      original: r.original,
      deidentified: tamperedOutput,
      clinicalCodes: [],
    });
    expect(tamperedVerdict.pass).toBe(false);
  });

  it("over-scrubbing a clinical code fails the loop", () => {
    const r = x12DeidLoop({ seed: 1, variant: "837P" });
    expect(r.pass).toBe(true);
    const probed = r.clinicalProbed[0];
    expect(probed).toBeDefined();
    if (probed === undefined) return;
    // Simulate de-id stripping a clinical code it should have kept.
    const overscrubbed = r.deidentified.split(probed).join("REDACTED");
    const tampered = assembleVerdict({
      format: r.format,
      artifact: r.artifact,
      seed: r.seed,
      planted: r.planted,
      original: r.original,
      deidentified: overscrubbed,
      clinicalCodes: r.clinicalProbed,
    });
    expect(tampered.clinicalScrubbed).toContain(probed);
    expect(tampered.pass).toBe(false);
  });
});

describe("the deid pairing loop — synthetic-safety of the planted sentinels", () => {
  const POOL_WORDS: ReadonlySet<string> = new Set(
    [
      ...SYNTHETIC_GIVEN_NAMES,
      ...SYNTHETIC_FAMILY_NAMES,
      ...SYNTHETIC_STREET_NAMES,
      ...SYNTHETIC_CITY_NAMES,
    ]
      .flatMap((entry) => entry.split(/\s+/))
      .map((w) => w.toLowerCase()),
  );
  const SYNTHETIC_ID_PREFIX = /^(MBR|GRP|PRA|LAB|PTACCT|ACCT|MR|MRN)\d+$/i;

  it("every planted token is drawn from a guaranteed-non-colliding synthetic source", () => {
    const tokens = new Set<string>();
    for (const seed of SEEDS)
      for (const r of allRuns(seed)) for (const s of r.planted) tokens.add(s.token);
    expect(tokens.size).toBeGreaterThan(20);

    for (const token of tokens) {
      if (token.includes("@")) {
        expect(isSyntheticEmail(token), `${token} email`).toBe(true);
      } else if (/^9\d{8}$/.test(token) || /^\d{3}-\d{2}-\d{4}$/.test(token)) {
        // SSN-shaped: must be a never-issued synthetic SSN, never a real one.
        expect(isSyntheticSsn(token), `${token} ssn`).toBe(true);
      } else if (/^[\d()\s.+-]+$/.test(token) && /555/.test(token)) {
        expect(isSyntheticPhone(token), `${token} phone`).toBe(true);
      } else if (/^\d+$/.test(token)) {
        // A purely-numeric identifier (MRN/member) minted under the synthetic assigning authority.
        // Guard the one real-looking shape a bare number could take: a 9-digit run is an SSN shape and
        // must be a never-issued synthetic SSN. Anything else is an institution-local id under a
        // synthetic namespace (never an SSN — SSNs are always emitted 9-digit).
        if (token.length === 9) {
          expect(isSyntheticSsn(token), `${token} 9-digit id`).toBe(true);
        }
        expect(token.length, `${token} numeric id length`).toBeGreaterThanOrEqual(6);
      } else if (SYNTHETIC_ID_PREFIX.test(token)) {
        // A synthetic-assigning-authority id (member/group/account) — clearly-synthetic prefix.
        expect(true).toBe(true);
      } else {
        // Alphabetic: every word must come from the shipped clearly-fake name/place pools.
        expect(POOL_WORDS.has(token.toLowerCase()), `${token} pool`).toBe(true);
      }
    }
  });
});

describe("the deid pairing loop — the sentinel/clinical primitives", () => {
  it("identifierSentinels: scopes to identifier loci, requires literal presence, de-dupes", () => {
    const original = "NAME=Examplewood~Mocktavia PHONE=555-0142 CODE=ok";
    const loci: GenericLocus[] = [
      { path: "PID-5", kind: "identifier", value: "Examplewood^Mocktavia", category: "NAMES" },
      { path: "PID-13", kind: "identifier", value: "555-0142" }, // no category (undefined branch)
      { path: "PID-7", kind: "date", value: "19800101" }, // not identifier → skipped
      { path: "EMPTY", kind: "identifier", value: "" }, // empty → skipped
      { path: "SHORT", kind: "identifier", value: "ab" }, // not distinctive → skipped
      { path: "ABSENT", kind: "identifier", value: "Ghostwood" }, // not in original → skipped
      { path: "DUP", kind: "identifier", value: "Examplewood" }, // duplicate token → de-duped
    ];
    const sentinels = identifierSentinels(loci, original);
    const tokens = sentinels.map((s) => s.token).sort();
    expect(tokens).toStrictEqual(["555-0142", "Examplewood", "Mocktavia"]);
    // the phone locus carried no category
    expect(sentinels.find((s) => s.token === "555-0142")?.category).toBeUndefined();
    expect(sentinels.find((s) => s.token === "Examplewood")?.category).toBe("NAMES");
  });

  it("recordTargetSentinels: returns [] with no recordTarget, and de-dupes / drops non-distinctive", () => {
    expect(recordTargetSentinels("<ClinicalDocument/>")).toStrictEqual([]);
    const xml =
      '<recordTarget><patientRole><id extension="55512345"/><patient>' +
      "<name><given>Testina</given><given>Testina</given><given>Al</given><family>Quillfeather</family></name>" +
      "</patient></patientRole></recordTarget><author><name><given>Provider</given></name></author>";
    const tokens = recordTargetSentinels(xml)
      .map((s) => s.token)
      .sort();
    // "Al" is too short (dropped), the duplicate "Testina" is de-duped, the author name is out of scope.
    expect(tokens).toStrictEqual(["55512345", "Quillfeather", "Testina"]);
  });

  it("clinicalRetention: ignores short codes and flags a scrubbed distinctive code", () => {
    const before = "code 4548-4 and 08 present";
    const after = "code present"; // both removed, but 08 is too short to probe
    const { probed, scrubbed } = clinicalRetention(before, after, ["4548-4", "08", "99999"]);
    expect(probed).toStrictEqual(["4548-4"]); // "08" short, "99999" absent from before
    expect(scrubbed).toStrictEqual(["4548-4"]);
  });

  it("sweepSurvivors returns the subset still present", () => {
    const s = [
      { token: "Alpha", locus: "a" },
      { token: "Beta", locus: "b" },
    ];
    expect(sweepSurvivors("only Beta here", s).map((x) => x.token)).toStrictEqual(["Beta"]);
  });
});

describe("the deid pairing loop — coverage summary & honest scope", () => {
  it("summarizes coverage per format with zero survivors and zero over-scrub", () => {
    const results = SEEDS.flatMap((seed) => allRuns(seed));
    const summary = summarizeDeidCoverage(results);
    expect(summary.allPass).toBe(true);
    expect(summary.totalSurvivors).toBe(0);
    expect(summary.totalClinicalScrubbed).toBe(0);
    expect(summary.totalPlanted).toBeGreaterThan(100);
    expect(summary.byFormat.map((r) => r.format).sort()).toStrictEqual(
      [...DEID_LOOP_COVERED_FORMATS].sort(),
    );
    for (const row of summary.byFormat) {
      expect(row.survivors).toBe(0);
      expect(row.clinicalScrubbed).toBe(0);
      expect(row.pass).toBe(true);
    }
  });

  it("names every deliberately-skipped format path (SCRIPT, ASTM, DICOM), never silently", () => {
    const skipped = DEID_LOOP_SKIPPED.map((s) => s.format);
    expect(skipped).toStrictEqual(["ncpdp-script", "astm", "dicom"]);
    for (const s of DEID_LOOP_SKIPPED) expect(s.reason.length).toBeGreaterThan(20);
  });
});
