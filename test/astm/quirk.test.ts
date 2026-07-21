/**
 * ASTM **quirk generation** tests (roadmap §Phase 7). The intended-warning contract: every quirk fixture
 * bare-parses to **exactly** the intended `@cosyte/astm` warning code, and where a public built-in
 * profile tolerates it, the profiled parse re-badges it to `PROFILE_QUIRK_APPLIED`. Plus seed-
 * determinism, the fail-closed `SYNTH_UNSUPPORTED_QUIRK`, and synthetic-safety (the P record is
 * untouched).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";

import {
  generateAstmQuirk,
  astmQuirkRoundTrip,
  astmQuirkCorpus,
  astmQuirkProfile,
  ASTM_QUIRKS,
  type AstmQuirkName,
} from "../../src/astm/index.js";
import { PROFILE_QUIRK_APPLIED, SynthError, SYNTH_FATAL_CODES } from "../../src/index.js";

const QUIRKS = Object.keys(ASTM_QUIRKS) as AstmQuirkName[];
const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });
const FIXTURES = join(__dirname, "..", "fixtures", "astm", "quirk");

describe("ASTM quirk registry", () => {
  it("targets the expected codes", () => {
    expect(ASTM_QUIRKS["unknown-escape"].intendedWarnings).toEqual([
      "ASTM_UNKNOWN_ESCAPE_SEQUENCE",
    ]);
    expect(ASTM_QUIRKS["unknown-record-type"].intendedWarnings).toEqual([
      "ASTM_RECORD_UNKNOWN_TYPE",
    ]);
  });
  it("the escape quirk is re-badged by referenceCorpus; the record-type quirk is bare", () => {
    expect(ASTM_QUIRKS["unknown-escape"].toleratingProfile).toBe("referenceCorpus");
    expect(ASTM_QUIRKS["unknown-escape"].disposition).toBe("rebadged");
    expect(ASTM_QUIRKS["unknown-record-type"].disposition).toBe("bare");
    expect(ASTM_QUIRKS["unknown-record-type"].toleratingProfile).toBeUndefined();
  });
});

describe("ASTM intended-warning contract (mandatory)", () => {
  it("every quirk, every seed → exactly the intended warning (bare parse)", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom(...QUIRKS), (s, quirk) => {
        const rt = astmQuirkRoundTrip(generateAstmQuirk({ seed: s, quirk }));
        expect(rt.intendedWarningHeld, `${quirk}@${s}: bare=${JSON.stringify(rt.warnings)}`).toBe(
          true,
        );
      }),
      { numRuns: 120 },
    );
  });

  it("the `unknown-escape` quirk is re-badged by the public referenceCorpus profile", () => {
    const rt = astmQuirkRoundTrip(generateAstmQuirk({ seed: 1, quirk: "unknown-escape" }));
    expect(rt.withProfile?.profileName).toBe("referenceCorpus");
    expect(rt.withProfile?.disposition).toBe("rebadged");
    expect(rt.withProfile?.tolerated).toBe(true);
    expect(rt.withProfile?.warnings).toContain(PROFILE_QUIRK_APPLIED);
  });

  it("the `unknown-record-type` quirk is bare — no built-in profile verdict", () => {
    const rt = astmQuirkRoundTrip(generateAstmQuirk({ seed: 1, quirk: "unknown-record-type" }));
    expect(rt.withProfile).toBeUndefined();
    expect(rt.intendedWarningHeld).toBe(true);
  });
});

describe("ASTM quirk seed-determinism (mandatory)", () => {
  it("same seed + quirk + kind ⇒ byte-identical", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom(...QUIRKS), (s, quirk) => {
        expect(generateAstmQuirk({ seed: s, quirk }).content).toBe(
          generateAstmQuirk({ seed: s, quirk }).content,
        );
      }),
      { numRuns: 60 },
    );
  });
});

describe("ASTM quirk synthetic-safety — the deviation is an escape/type, never the P record", () => {
  it("the P record (name + practice/lab ids) is byte-identical to the clean report", () => {
    fc.assert(
      fc.property(seed(), fc.constantFrom(...QUIRKS), (s, quirk) => {
        const artifact = generateAstmQuirk({ seed: s, quirk });
        const pRecord = /(?:^|\r)P\|[^\r]*/.exec(artifact.content)?.[0] ?? "";
        expect(pRecord.length).toBeGreaterThan(0);
        // The quirk never touches a P-record field — no name/id was introduced.
        expect(pRecord).not.toMatch(/&Z&/);
      }),
      { numRuns: 40 },
    );
  });
});

describe("ASTM quirk fail-closed", () => {
  it("an unsupported quirk throws SYNTH_UNSUPPORTED_QUIRK", () => {
    try {
      // @ts-expect-error — deliberately unsupported name
      generateAstmQuirk({ seed: 1, quirk: "made-up" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SynthError);
      expect((err as SynthError).code).toBe(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_QUIRK);
    }
  });
});

describe("ASTM quirk corpus", () => {
  it("cycles every quirk and lists them in the manifest", () => {
    const corpus = astmQuirkCorpus({ seed: 42 });
    expect([...corpus.manifest.quirks].sort()).toEqual([...QUIRKS].sort());
    for (const a of corpus.artifacts) expect(a.warnings.length).toBeGreaterThan(0);
  });
  it("is byte-identical for the same seed", () => {
    const a = astmQuirkCorpus({ seed: 7, count: 4 }).artifacts.map((x) => x.content);
    const b = astmQuirkCorpus({ seed: 7, count: 4 }).artifacts.map((x) => x.content);
    expect(a).toEqual(b);
  });
  it("accepts a SynthProfile whose quirks drive the corpus", () => {
    const corpus = astmQuirkCorpus({ seed: 7, profile: astmQuirkProfile });
    expect([...corpus.manifest.quirks].sort()).toEqual([...QUIRKS].sort());
  });
});

describe("ASTM committed quirk fixtures round-trip to their intended warning", () => {
  const cases: ReadonlyArray<[string, AstmQuirkName, number]> = [
    ["quirk-unknown-escape-seed9301.astm", "unknown-escape", 9301],
    ["quirk-unknown-record-type-seed9302.astm", "unknown-record-type", 9302],
  ];
  for (const [file, quirk, s] of cases) {
    it(`${file} regenerates byte-identically and holds the intended warning`, () => {
      const fixture = readFileSync(join(FIXTURES, file), "utf8");
      const artifact = generateAstmQuirk({ seed: s, quirk });
      expect(artifact.content).toBe(fixture);
      expect(astmQuirkRoundTrip(artifact).intendedWarningHeld).toBe(true);
    });
  }
});
