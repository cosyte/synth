/**
 * C-CDA **quirk generation** tests (roadmap §Phase 7). The intended-warning contract: every quirk
 * fixture bare-parses to **exactly** the intended `@cosyte/ccda` warning code, and the matching public
 * profile **re-badges** it to `PROFILE_QUIRK_APPLIED`. Plus seed-determinism, the fail-closed
 * `SYNTH_UNSUPPORTED_QUIRK`, and that a quirk never disturbs the synthetic identity.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";

import {
  generateCcdaQuirk,
  injectCcdaQuirk,
  ccdaQuirkRoundTrip,
  ccdaQuirkCorpus,
  ccdaQuirkProfile,
  CCDA_QUIRKS,
  type CcdaQuirkName,
  type CcdaDocumentType,
} from "../../src/ccda/index.js";
import { PROFILE_QUIRK_APPLIED, SynthError, SYNTH_FATAL_CODES } from "../../src/index.js";

const QUIRKS = Object.keys(CCDA_QUIRKS) as CcdaQuirkName[];
const DOC_TYPES: readonly CcdaDocumentType[] = ["ccd", "referralNote"];
const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });
const FIXTURES = join(__dirname, "..", "fixtures", "ccda", "quirk");

describe("C-CDA quirk registry", () => {
  it("targets the expected codes", () => {
    expect(CCDA_QUIRKS["template-extension-absent"].intendedWarnings).toEqual([
      "TEMPLATE_EXTENSION_ABSENT",
    ]);
    expect(CCDA_QUIRKS["deprecated-loinc"].intendedWarnings).toEqual(["DEPRECATED_LOINC"]);
    expect(CCDA_QUIRKS["deprecated-code-system"].intendedWarnings).toEqual([
      "DEPRECATED_CODE_SYSTEM",
    ]);
  });
  it("each quirk names a tolerating public profile", () => {
    for (const q of QUIRKS) {
      expect(CCDA_QUIRKS[q].disposition).toBe("rebadged");
      expect(CCDA_QUIRKS[q].toleratingProfile).toBeTruthy();
    }
  });
});

describe("C-CDA intended-warning contract (mandatory)", () => {
  it("every quirk, every seed → exactly the intended warning (bare) and PROFILE_QUIRK_APPLIED (profiled)", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom(...QUIRKS), (s, quirk) => {
        const rt = ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: s, quirk }));
        expect(rt.intendedWarningHeld, `${quirk}@${s}: bare=${JSON.stringify(rt.warnings)}`).toBe(
          true,
        );
        expect(rt.withProfile?.tolerated, `${quirk}@${s}: profiled`).toBe(true);
        expect(rt.withProfile?.warnings).toContain(PROFILE_QUIRK_APPLIED);
      }),
      { numRuns: 90 },
    );
  });
  it("holds for EVERY document type — ccd AND referralNote (regression: a doc-type-specific anchor)", () => {
    fc.assert(
      fc.property(
        seed(),
        fc.constantFrom(...QUIRKS),
        fc.constantFrom(...DOC_TYPES),
        (s, quirk, documentType) => {
          const rt = ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: s, quirk, documentType }));
          expect(
            rt.intendedWarningHeld,
            `${quirk}/${documentType}@${s}: bare=${JSON.stringify(rt.warnings)}`,
          ).toBe(true);
          expect(rt.withProfile?.tolerated).toBe(true);
        },
      ),
      { numRuns: 90 },
    );
  });
  it("the re-badge names the right built-in profile", () => {
    expect(
      ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: 1, quirk: "template-extension-absent" }))
        .withProfile?.profileName,
    ).toBe("legacyR11");
    expect(
      ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: 1, quirk: "deprecated-loinc" })).withProfile
        ?.profileName,
    ).toBe("smartScorecard");
  });
});

describe("C-CDA quirk seed-determinism (mandatory)", () => {
  it("same seed + quirk ⇒ byte-identical", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom(...QUIRKS), (s, quirk) => {
        expect(generateCcdaQuirk({ seed: s, quirk }).content).toBe(
          generateCcdaQuirk({ seed: s, quirk }).content,
        );
      }),
      { numRuns: 50 },
    );
  });
});

describe("C-CDA quirk synthetic-safety — the deviation is a template/code, never a value", () => {
  it("the deprecated-loinc quirk introduces the deprecated code but no PHI locus changes", () => {
    const artifact = generateCcdaQuirk({ seed: 1, quirk: "deprecated-loinc" });
    expect(artifact.content).toContain('code="41909-3"');
    // The recordTarget identity is still synthetic-AA-scoped (untouched by the quirk).
    expect(artifact.content).toContain('assigningAuthorityName="COSYTE-SYNTH"');
  });
  it("the template-extension-absent quirk drops the R2.1 stamp on the document templateId", () => {
    const artifact = generateCcdaQuirk({ seed: 1, quirk: "template-extension-absent" });
    expect(artifact.content).toContain('<templateId root="2.16.840.1.113883.10.20.22.1.1"/>');
  });
});

describe("C-CDA quirk fail-closed + anchor guard", () => {
  it("an unsupported quirk throws SYNTH_UNSUPPORTED_QUIRK", () => {
    try {
      // @ts-expect-error — deliberately unsupported name
      generateCcdaQuirk({ seed: 1, quirk: "made-up" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SynthError);
      expect((err as SynthError).code).toBe(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_QUIRK);
    }
  });
  it("injectCcdaQuirk fails closed when the structural anchor is absent", () => {
    // A minimal document that carries none of the quirks' anchors.
    expect(() => injectCcdaQuirk("deprecated-loinc", "<ClinicalDocument/>")).toThrow(
      /no structural anchor/,
    );
  });
});

describe("C-CDA quirk corpus", () => {
  it("cycles every quirk and lists them in the manifest", () => {
    const corpus = ccdaQuirkCorpus({ seed: 42 });
    expect([...corpus.manifest.quirks].sort()).toEqual([...QUIRKS].sort());
    for (const a of corpus.artifacts) expect(a.warnings.length).toBeGreaterThan(0);
  });
  it("is byte-identical for the same seed", () => {
    const a = ccdaQuirkCorpus({ seed: 7, count: 4 }).artifacts.map((x) => x.content);
    const b = ccdaQuirkCorpus({ seed: 7, count: 4 }).artifacts.map((x) => x.content);
    expect(a).toEqual(b);
  });
  it("accepts a SynthProfile whose quirks drive the corpus", () => {
    const corpus = ccdaQuirkCorpus({ seed: 7, profile: ccdaQuirkProfile });
    expect([...corpus.manifest.quirks].sort()).toEqual([...QUIRKS].sort());
  });
  it("respects an explicit quirk subset", () => {
    const corpus = ccdaQuirkCorpus({ seed: 7, quirks: ["deprecated-loinc"], count: 2 });
    expect(corpus.manifest.quirks).toEqual(["deprecated-loinc"]);
    expect(corpus.artifacts).toHaveLength(2);
  });
  it("falls back to every quirk when given an empty quirk list", () => {
    const corpus = ccdaQuirkCorpus({ seed: 7, quirks: [] });
    expect([...corpus.manifest.quirks].sort()).toEqual([...QUIRKS].sort());
  });
});

describe("C-CDA committed quirk fixtures round-trip to their intended warning", () => {
  const cases: ReadonlyArray<[string, CcdaQuirkName, number]> = [
    ["quirk-template-extension-absent-seed9201.xml", "template-extension-absent", 9201],
    ["quirk-deprecated-loinc-seed9202.xml", "deprecated-loinc", 9202],
    ["quirk-deprecated-code-system-seed9203.xml", "deprecated-code-system", 9203],
  ];
  for (const [file, quirk, s] of cases) {
    it(`${file} regenerates byte-identically and holds the intended warning`, () => {
      const fixture = readFileSync(join(FIXTURES, file), "utf8");
      const artifact = generateCcdaQuirk({ seed: s, quirk });
      expect(artifact.content).toBe(fixture);
      const rt = ccdaQuirkRoundTrip(artifact);
      expect(rt.intendedWarningHeld).toBe(true);
      expect(rt.withProfile?.tolerated).toBe(true);
    });
  }
});
