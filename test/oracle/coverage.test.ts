/**
 * The coverage declaration: every format the library generates, marked graded or ungraded.
 *
 * THE SUBJECT IS DERIVED, WHICH IS THE POINT. The set of formats is not written down anywhere this
 * suite can edit: `scripts/oracle/formats.ts` reads the published subpaths out of `package.json` and
 * RUNS each subpath's corpus factories, taking the format label off the artifacts that come back. So
 * a seventh format cannot ship with nobody having said whether anything grades it, and the assertion
 * below that the declaration is complete is an assertion about the real generators rather than about
 * a list somebody remembered to update.
 *
 * Offline: generating one artifact per factory needs no network and no external tool.
 */

import { describe, expect, it } from "vitest";

import {
  buildCoverageDeclaration,
  independentlyGradedFormats,
  readCoveragePolicy,
  type CoveragePolicy,
} from "../../scripts/oracle/coverage.js";
import {
  fhirCorpusGenerator,
  generateDeclaredCorpus,
  readCorpusDeclaration,
} from "../../scripts/oracle/corpus.js";
import { generatedFormats, publishedSubpaths } from "../../scripts/oracle/formats.js";
import type { DeclaredArtifact, ExcludedArtifact } from "../../scripts/oracle/gate.js";

const GENERATION_TIMEOUT_MS = 120_000;

const artifact = (overrides: Partial<DeclaredArtifact> = {}): DeclaredArtifact => ({
  id: "fhir/Procedure/seed-61009",
  format: "fhir",
  kind: "Procedure",
  seed: 61009,
  profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
  ...overrides,
});

describe("the set of formats is derived from what the library generates, not from a list", () => {
  it(
    "derives every format by running the published subpaths' own corpus factories",
    async () => {
      const formats = await generatedFormats();

      // The label comes off a generated artifact, so the FHIR subpath's `hl7`-style naming cannot
      // silently rename a format inside the declaration: `./hl7` yields the label `hl7v2`.
      expect(formats).toContain("hl7v2");
      expect(formats).toContain("fhir");
      expect(new Set(formats).size).toBe(formats.length);

      // Derived from the published surface: `./deid` publishes no corpus factory and contributes
      // nothing, without being named anywhere.
      expect(publishedSubpaths()).toContain("deid");
      expect(formats).not.toContain("deid");
    },
    GENERATION_TIMEOUT_MS,
  );

  it("refuses rather than skips when the published surface cannot be read", () => {
    expect(() => publishedSubpaths(import.meta.dirname)).toThrow();
  });
});

describe("a generated format missing from the declaration fails the run", () => {
  it(
    "the committed policy accounts for every format the library actually generates",
    async () => {
      const result = buildCoverageDeclaration(await generatedFormats(), readCoveragePolicy(), []);
      expect(result.ok, result.ok ? "" : result.errors.join("\n")).toBe(true);
      if (!result.ok) return;

      expect(result.declaration.formats.map((entry) => entry.format)).toEqual(
        [...(await generatedFormats())].sort(),
      );
      for (const entry of result.declaration.formats) {
        if (entry.independentlyGraded) {
          expect(entry.grader.length, `${entry.format} names no grader`).toBeGreaterThan(0);
          expect(entry.gradedAgainst.length).toBeGreaterThan(0);
        } else {
          expect(entry.ungradedReason.length, `${entry.format} gives no reason`).toBeGreaterThan(0);
        }
      }
    },
    GENERATION_TIMEOUT_MS,
  );

  it("a format the library generates with no entry is a failure, not a silent omission", () => {
    const policy: CoveragePolicy = { fhir: { graded: false, reason: "nothing grades it" } };
    const result = buildCoverageDeclaration(["fhir", "hl7v2"], policy, []);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join("\n")).toContain('generates "hl7v2" and the coverage declaration');
  });

  it("an entry for a format the library does NOT generate is a failure too", () => {
    const policy: CoveragePolicy = {
      fhir: { graded: false, reason: "nothing grades it" },
      dicom: { graded: true, grader: "somebody", gradedAgainst: "something" },
    };
    const result = buildCoverageDeclaration(["fhir"], policy, []);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join("\n")).toContain(
      'names "dicom", which this library does not generate',
    );
  });

  it("a graded entry with no grader, and an ungraded entry with no reason, are both refused", () => {
    expect(() =>
      readCoveragePolicy(new URL("./fixtures/clean.json", import.meta.url).pathname),
    ).toThrow(/no `formats` object/);
  });

  it(
    "the FHIR entry is the one that claims an independent verdict",
    async () => {
      const result = buildCoverageDeclaration(await generatedFormats(), readCoveragePolicy(), []);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(independentlyGradedFormats(result.declaration)).toEqual(["fhir"]);
    },
    GENERATION_TIMEOUT_MS,
  );

  it(
    "every ungraded format says the round-trip is not an independent verdict",
    async () => {
      const result = buildCoverageDeclaration(await generatedFormats(), readCoveragePolicy(), []);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      for (const entry of result.declaration.formats) {
        if (entry.independentlyGraded) continue;
        expect(entry.ungradedReason, `${entry.format}`).toContain("not an independent verdict");
      }
    },
    GENERATION_TIMEOUT_MS,
  );
});

describe("an excluded artifact is named with its reason and counts toward nothing", () => {
  const excluded: readonly ExcludedArtifact[] = [
    { artifact: artifact(), reason: "no US Core profile exists for this resource" },
  ];

  it("the declaration names the artifact, its seed and its reason", () => {
    const policy: CoveragePolicy = { fhir: { graded: true, grader: "g", gradedAgainst: "p" } };
    const result = buildCoverageDeclaration(["fhir"], policy, excluded);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.declaration.exclusions).toEqual([
      {
        artifactId: "fhir/Procedure/seed-61009",
        format: "fhir",
        kind: "Procedure",
        seed: 61009,
        reason: "no US Core profile exists for this resource",
      },
    ]);
  });

  it("an exclusion with no reason is refused", () => {
    const policy: CoveragePolicy = { fhir: { graded: true, grader: "g", gradedAgainst: "p" } };
    const result = buildCoverageDeclaration(["fhir"], policy, [
      { artifact: artifact(), reason: "   " },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join("\n")).toContain("excluded from the graded corpus with no reason");
  });

  it("an exclusion cannot be expressed as a severity, because there is nowhere to put one", () => {
    const policy: CoveragePolicy = { fhir: { graded: true, grader: "g", gradedAgainst: "p" } };
    const result = buildCoverageDeclaration(["fhir"], policy, excluded);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The published exclusion record carries an artifact and a reason and nothing else. There is no
    // severity, no code, no threshold and no finding id, so an exclusion has no shape in which it
    // could reduce the severity of a validator finding.
    expect(Object.keys(result.declaration.exclusions[0] ?? {}).sort()).toEqual([
      "artifactId",
      "format",
      "kind",
      "reason",
      "seed",
    ]);
  });
});

describe("the declared seed corpus", () => {
  it("names only whole-number seeds and reasoned exclusions", () => {
    const entries = readCorpusDeclaration();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(Number.isInteger(entry.seed)).toBe(true);
      if (entry.excluded !== undefined) expect(entry.excluded.length).toBeGreaterThan(0);
    }
  });

  it(
    "grades every declared artifact against the profile the artifact itself claims",
    () => {
      const corpus = generateDeclaredCorpus(readCorpusDeclaration(), fhirCorpusGenerator);

      expect(corpus.graded.length).toBeGreaterThan(0);
      for (const member of corpus.graded) {
        const parsed: unknown = JSON.parse(member.content);
        const meta = (parsed as { meta?: { profile?: readonly string[] } }).meta;
        expect(meta?.profile?.[0]).toBe(member.artifact.profile);
        expect(member.artifact.id).toContain(String(member.artifact.seed));
      }
    },
    GENERATION_TIMEOUT_MS,
  );

  it("refuses a declared artifact that claims no profile rather than grading against a default", () => {
    const noProfile = () => ({
      artifacts: [{ format: "fhir", kind: "Thing", content: '{"resourceType":"Patient"}' }],
    });
    expect(() => generateDeclaredCorpus([{ kind: "Thing", seed: 1 }], noProfile)).toThrow(
      /claims no meta.profile/,
    );
  });

  it("refuses a declared artifact the generator does not produce", () => {
    const nothing = () => ({ artifacts: [] });
    expect(() => generateDeclaredCorpus([{ kind: "Nope", seed: 1 }], nothing)).toThrow(
      /produced nothing for it/,
    );
  });
});
