/**
 * HL7 v2 **quirk generation** tests (roadmap §Phase 7). The headline is the **intended-warning
 * contract**: every quirk fixture, bare-parsed by `@cosyte/hl7`, produces **exactly** the intended
 * warning code — and where a public built-in profile claims the deviation, the profiled parse suppresses
 * it. Plus seed-determinism, the fail-closed `SYNTH_UNSUPPORTED_QUIRK`, and that a quirk never disturbs
 * the synthetic-by-construction identity (it only appends a structural segment).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";

import {
  generateHl7Quirk,
  hl7QuirkRoundTrip,
  hl7QuirkCorpus,
  hl7QuirkProfile,
  HL7_QUIRKS,
  type Hl7QuirkName,
  type Hl7QuirkKind,
} from "../../src/hl7/index.js";
import { SynthError, SYNTH_FATAL_CODES } from "../../src/index.js";

const QUIRKS = Object.keys(HL7_QUIRKS) as Hl7QuirkName[];
const KINDS: readonly Hl7QuirkKind[] = [
  "ADT^A01",
  "ADT^A04",
  "ADT^A08",
  "ORU^R01",
  "ORM^O01",
  "SIU^S12",
  "VXU^V04",
];
const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });
const FIXTURES = join(__dirname, "..", "fixtures", "hl7", "quirk");

describe("HL7 quirk registry", () => {
  it("every descriptor targets exactly the code its name implies", () => {
    expect(HL7_QUIRKS["unknown-zsegment"].intendedWarnings).toEqual(["UNKNOWN_SEGMENT"]);
    expect(HL7_QUIRKS["unknown-escape"].intendedWarnings).toEqual(["UNKNOWN_ESCAPE_SEQUENCE"]);
  });
  it("each descriptor carries a public grounding note", () => {
    for (const q of QUIRKS) expect(HL7_QUIRKS[q].grounding.length).toBeGreaterThan(20);
  });
});

describe("HL7 intended-warning contract (mandatory)", () => {
  it("every quirk, every kind, every seed → exactly the intended warning (bare parse)", () => {
    fc.assert(
      fc.property(
        seed(),
        fc.constantFrom(...QUIRKS),
        fc.constantFrom(...KINDS),
        (s, quirk, kind) => {
          const rt = hl7QuirkRoundTrip(generateHl7Quirk({ seed: s, quirk, kind }));
          expect(
            rt.intendedWarningHeld,
            `${quirk}/${kind}@${s}: bare=${JSON.stringify(rt.warnings)}`,
          ).toBe(true);
        },
      ),
      { numRuns: 120 },
    );
  });

  it("the `unknown-zsegment` quirk is suppressed by the matching public profile (visage)", () => {
    const rt = hl7QuirkRoundTrip(generateHl7Quirk({ seed: 1, quirk: "unknown-zsegment" }));
    expect(rt.withProfile?.profileName).toBe("visage");
    expect(rt.withProfile?.disposition).toBe("suppressed");
    expect(rt.withProfile?.tolerated).toBe(true);
    expect(rt.withProfile?.warnings).toEqual([]);
  });

  it("the `unknown-escape` quirk is a bare quirk — HL7 v2 has no re-badge, so no profile verdict", () => {
    const rt = hl7QuirkRoundTrip(generateHl7Quirk({ seed: 1, quirk: "unknown-escape" }));
    expect(rt.withProfile).toBeUndefined();
    expect(rt.intendedWarningHeld).toBe(true);
  });
});

describe("HL7 quirk seed-determinism (mandatory)", () => {
  it("same seed + quirk + kind ⇒ byte-identical", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom(...QUIRKS), (s, quirk) => {
        expect(generateHl7Quirk({ seed: s, quirk }).content).toBe(
          generateHl7Quirk({ seed: s, quirk }).content,
        );
      }),
      { numRuns: 60 },
    );
  });
  it("a different seed generally changes the bytes", () => {
    expect(generateHl7Quirk({ seed: 1, quirk: "unknown-zsegment" }).content).not.toBe(
      generateHl7Quirk({ seed: 2, quirk: "unknown-zsegment" }).content,
    );
  });
});

describe("HL7 quirk synthetic-safety (mandatory) — the quirk only adds structure", () => {
  it("the quirked message is the spec-clean message plus one appended structural segment", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom(...QUIRKS), (s, quirk) => {
        const artifact = generateHl7Quirk({ seed: s, quirk });
        // The appended segment carries no identity locus (PID is untouched, no new name/ssn/phone).
        const added = quirk === "unknown-zsegment" ? "ZDS|1|SYNTHETIC-Z-SEGMENT" : "NTE|1||";
        expect(artifact.content).toContain(added);
      }),
      { numRuns: 40 },
    );
  });
});

describe("HL7 quirk fail-closed", () => {
  it("an unsupported quirk throws SYNTH_UNSUPPORTED_QUIRK", () => {
    try {
      // @ts-expect-error — deliberately unsupported name
      generateHl7Quirk({ seed: 1, quirk: "made-up" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SynthError);
      expect((err as SynthError).code).toBe(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_QUIRK);
    }
  });
});

describe("HL7 quirk corpus", () => {
  it("cycles every quirk by default and lists them in the manifest", () => {
    const corpus = hl7QuirkCorpus({ seed: 42 });
    expect([...corpus.manifest.quirks].sort()).toEqual([...QUIRKS].sort());
    for (const a of corpus.artifacts) expect(a.warnings.length).toBeGreaterThan(0);
  });
  it("is byte-identical for the same seed", () => {
    const a = hl7QuirkCorpus({ seed: 7, count: 4 }).artifacts.map((x) => x.content);
    const b = hl7QuirkCorpus({ seed: 7, count: 4 }).artifacts.map((x) => x.content);
    expect(a).toEqual(b);
  });
  it("accepts a SynthProfile whose quirks drive the corpus", () => {
    const corpus = hl7QuirkCorpus({ seed: 7, profile: hl7QuirkProfile });
    expect([...corpus.manifest.quirks].sort()).toEqual([...QUIRKS].sort());
  });
  it("respects an explicit quirk subset", () => {
    const corpus = hl7QuirkCorpus({ seed: 7, quirks: ["unknown-escape"], count: 2 });
    expect(corpus.manifest.quirks).toEqual(["unknown-escape"]);
    expect(corpus.artifacts).toHaveLength(2);
  });
});

describe("HL7 committed quirk fixtures round-trip to their intended warning", () => {
  const cases: ReadonlyArray<[string, Hl7QuirkName, number]> = [
    ["quirk-unknown-zsegment-seed9101.hl7", "unknown-zsegment", 9101],
    ["quirk-unknown-escape-seed9102.hl7", "unknown-escape", 9102],
  ];
  for (const [file, quirk, s] of cases) {
    it(`${file} regenerates byte-identically and holds the intended warning`, () => {
      const fixture = readFileSync(join(FIXTURES, file), "utf8");
      const artifact = generateHl7Quirk({ seed: s, quirk });
      expect(artifact.content).toBe(fixture);
      expect(hl7QuirkRoundTrip(artifact).intendedWarningHeld).toBe(true);
    });
  }
});
