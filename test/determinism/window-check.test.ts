/**
 * THE COMPATIBILITY-WINDOW CHECK: A CHANGED SEED-TO-BYTES MAPPING IS A DECLARED BREAKING CHANGE.
 *
 * The published promise is that a consumer can commit a golden fixture and diff against it. That
 * promise survives a deliberate change to the mapping only if the release that makes it SAYS SO,
 * and the changeset summary is the changelog entry for this package, so the changeset is the thing
 * checked.
 *
 * The two states that are easy to get wrong are asserted first. Establishing a baseline where none
 * existed is NOT a break: nothing mapped to anything before, and calling it one would force a major
 * version bump to ship a check that changes no output at all. Deleting a baseline that DOES exist
 * upstream is a break that took its own evidence with it, and no changeset makes it acceptable.
 */

import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decideWindow,
  declaresMajorFor,
  statesOutputChangeFor,
} from "../../scripts/determinism/window.js";

const PACKAGE = "@cosyte/synth";

/** A committed baseline carrying one digest per named pair. */
const baseline = (
  digests: Readonly<Record<string, string>>,
  overrides: { window?: string; algorithm?: string; perPair?: number } = {},
): string =>
  JSON.stringify({
    schema: "cosyte-synth-determinism-baseline/1",
    package: { name: PACKAGE, version: "0.0.0", window: overrides.window ?? "0.x" },
    digestAlgorithm: overrides.algorithm ?? "sha256",
    artifactsPerPair: overrides.perPair ?? 3,
    entries: Object.entries(digests).map(([format, digest]) => ({ format, seed: 1, digest })),
  });

const A = "1111111111111111111111111111111111111111111111111111111111111111";
const B = "2222222222222222222222222222222222222222222222222222222222222222";

const changeset = (bump: string, name = "brave-pandas-shout.md") => ({
  name,
  text: `---\n"${PACKAGE}": ${bump}\n---\n\nSomething changed.\n`,
});

const decide = (
  current: string | null,
  previous: string | null,
  changesets: readonly { name: string; text: string }[] = [],
) => decideWindow({ current, previous, baseRef: "origin/main", changesets, packageName: PACKAGE });

describe("the two states that are easy to get wrong", () => {
  it("PASSES when the default branch has no baseline: this establishes the window, it breaks none", () => {
    const verdict = decide(baseline({ hl7v2: A }), null);
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("ESTABLISHES");
  });

  it("FAILS when a baseline that exists upstream has been deleted here", () => {
    const verdict = decide(null, baseline({ hl7v2: A }), [changeset("major")]);
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("REMOVED");
  });
});

describe("an unchanged mapping passes and a changed one needs a declared breaking change", () => {
  it("passes when the baseline is unchanged", () => {
    const verdict = decide(baseline({ hl7v2: A }), baseline({ hl7v2: A }));
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("unchanged");
  });

  it("passes when the two agree semantically but the file was reformatted", () => {
    const reformatted = JSON.stringify(JSON.parse(baseline({ hl7v2: A, fhir: B })), null, 4);
    const verdict = decide(reformatted, baseline({ fhir: B, hl7v2: A }));
    expect(verdict.status).toBe("pass");
  });

  it("FAILS with the breaking-change rule when a digest moved and no changeset declares major", () => {
    const verdict = decide(baseline({ hl7v2: B }), baseline({ hl7v2: A }));
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("A CHANGED SEED-TO-BYTES MAPPING IS A BREAKING CHANGE");
    expect(verdict.message).toContain("no changesets at all");
  });

  it("passes when a changeset declares a major change for this package", () => {
    const verdict = decide(baseline({ hl7v2: B }), baseline({ hl7v2: A }), [changeset("major")]);
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("brave-pandas-shout.md");
  });

  it("is not satisfied by a patch or a minor changeset", () => {
    for (const bump of ["patch", "minor"]) {
      const verdict = decide(baseline({ hl7v2: B }), baseline({ hl7v2: A }), [changeset(bump)]);
      expect(verdict.status, bump).toBe("fail");
      expect(verdict.message).toContain("none declaring major");
    }
  });

  it("fails when the corpus grew or shrank without the mapping being declared changed", () => {
    expect(decide(baseline({ hl7v2: A, fhir: B }), baseline({ hl7v2: A })).status).toBe("fail");
    expect(decide(baseline({ hl7v2: A }), baseline({ hl7v2: A, fhir: B })).status).toBe("fail");
  });

  it("says what actually changed when the corpus was NARROWED, without softening the refusal", () => {
    // Walking the sanctioned narrowing procedure (declare an exclusion, say why) leaves every
    // surviving digest untouched, so the headline sentence about a CHANGED mapping is not true of
    // that change on its own. The verdict is deliberately the same: a pair that is no longer
    // graded is a promise withdrawn, and a withdrawn promise is consumer-visible in the same way a
    // moved one is. What the diagnostic must not do is describe it wrongly.
    const verdict = decide(baseline({ hl7v2: A }), baseline({ hl7v2: A, fhir: B }));
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("A CHANGED SEED-TO-BYTES MAPPING IS A BREAKING CHANGE");
    expect(verdict.message).toContain("NO SEED MAPS TO DIFFERENT BYTES");
    expect(verdict.message).toContain("1 pair(s) came OUT of the graded set");
    expect(verdict.message).toContain("fhir");

    // A major changeset still clears it, by the same route as any other declared break.
    expect(
      decide(baseline({ hl7v2: A }), baseline({ hl7v2: A, fhir: B }), [changeset("major")]).status,
    ).toBe("pass");
  });

  it("does not call a MOVED digest a narrowing, even when the corpus also shrank", () => {
    const verdict = decide(baseline({ hl7v2: B }), baseline({ hl7v2: A, fhir: B }));
    expect(verdict.status).toBe("fail");
    expect(verdict.message).not.toContain("NO SEED MAPS TO DIFFERENT BYTES");
  });

  it("does not call a GROWN corpus a narrowing", () => {
    const verdict = decide(baseline({ hl7v2: A, fhir: B }), baseline({ hl7v2: A }));
    expect(verdict.status).toBe("fail");
    expect(verdict.message).not.toContain("NO SEED MAPS TO DIFFERENT BYTES");
  });

  it("fails when the window itself moved, which is not something a comparison can absorb", () => {
    const verdict = decide(
      baseline({ hl7v2: A }, { window: "1.x" }),
      baseline({ hl7v2: A }, { window: "0.x" }),
    );
    expect(verdict.status).toBe("fail");
  });

  it("fails when the digest algorithm or the corpus size changed", () => {
    expect(
      decide(baseline({ hl7v2: A }, { algorithm: "sha512" }), baseline({ hl7v2: A })).status,
    ).toBe("fail");
    expect(decide(baseline({ hl7v2: A }, { perPair: 5 }), baseline({ hl7v2: A })).status).toBe(
      "fail",
    );
  });
});

describe("the check refuses rather than passing when it cannot tell", () => {
  it("fails when there is no baseline anywhere", () => {
    const verdict = decide(null, null);
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("no committed determinism baseline");
  });

  it("fails when this tree's baseline is malformed", () => {
    expect(decide("{ not json", baseline({ hl7v2: A })).status).toBe("fail");
    expect(decide(JSON.stringify({ schema: "something-else" }), null).status).toBe("fail");
  });

  it("fails when the default branch's baseline is malformed", () => {
    const verdict = decide(baseline({ hl7v2: A }), "{ not json");
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("cannot say whether the mapping moved");
  });
});

describe("a major declaration is read from the changeset frontmatter and nowhere else", () => {
  it("reads a declaration with or without quotes", () => {
    expect(declaresMajorFor(`---\n"${PACKAGE}": major\n---\n\nx\n`, PACKAGE)).toBe(true);
    expect(declaresMajorFor(`---\n${PACKAGE}: major\n---\n\nx\n`, PACKAGE)).toBe(true);
    expect(declaresMajorFor(`---\n'${PACKAGE}': "major"\n---\n\nx\n`, PACKAGE)).toBe(true);
  });

  it("is not fooled by prose in the summary", () => {
    const text = `---\n"${PACKAGE}": patch\n---\n\nThis is a major change to ${PACKAGE}: major.\n`;
    expect(declaresMajorFor(text, PACKAGE)).toBe(false);
  });

  it("is not satisfied by another package declaring major", () => {
    const text = `---\n"@cosyte/hl7": major\n"${PACKAGE}": patch\n---\n\nx\n`;
    expect(declaresMajorFor(text, PACKAGE)).toBe(false);
  });

  it("is satisfied when this package is one of several", () => {
    const text = `---\n"@cosyte/hl7": patch\n"${PACKAGE}": major\n---\n\nx\n`;
    expect(declaresMajorFor(text, PACKAGE)).toBe(true);
  });

  it("reads nothing out of a file with no frontmatter", () => {
    expect(declaresMajorFor(`"${PACKAGE}": major\n`, PACKAGE)).toBe(false);
  });
});

/**
 * THE SECOND DOOR: A STATED OUTPUT CHANGE, by the operator's decision D57 (2026-11-07). A changeset of
 * any bump passes a moved mapping when its `Output change:` section names every format that moved.
 * The two committed fixtures are the same change, once stated for the gate and once only in prose:
 * the first must turn the check green and the second must leave it red.
 */
const fixture = (name: string): { name: string; text: string } => ({
  name,
  text: readFileSync(join(import.meta.dirname, "fixtures", name), "utf8"),
});
const STATED = fixture("changeset-output-stated.md");
const UNSTATED = fixture("changeset-output-unstated.md");

describe("a stated output change passes a moved mapping in a patch (D57)", () => {
  it("PASSES when a patch changeset's Output change section names the format that moved", () => {
    const verdict = decide(baseline({ ccda: B, hl7v2: A }), baseline({ ccda: A, hl7v2: A }), [
      STATED,
    ]);
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("changeset-output-stated.md");
    expect(verdict.message).toContain("C-CDA");
    expect(verdict.message).toContain("D57");
  });

  it("FAILS for the same change stated only in prose, with no Output change section", () => {
    const verdict = decide(baseline({ ccda: B, hl7v2: A }), baseline({ ccda: A, hl7v2: A }), [
      UNSTATED,
    ]);
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("A CHANGED SEED-TO-BYTES MAPPING IS A BREAKING CHANGE");
    expect(verdict.message).toContain("Output change:");
  });

  it("FAILS, naming the gap, when the section leaves out a format that also moved", () => {
    const verdict = decide(baseline({ ccda: B, hl7v2: B }), baseline({ ccda: A, hl7v2: A }), [
      STATED,
    ]);
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("does not name HL7 v2");
  });

  it("does not cover a NARROWED corpus: that still needs a major", () => {
    const verdict = decide(baseline({ ccda: A }), baseline({ ccda: A, hl7v2: A }), [STATED]);
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("came OUT of the graded set");
  });

  it("does not cover a moved window, which no section describes", () => {
    const verdict = decide(
      baseline({ ccda: B }, { window: "1.x" }),
      baseline({ ccda: A }, { window: "0.x" }),
      [STATED],
    );
    expect(verdict.status).toBe("fail");
  });

  it("still passes a major changeset with no section, the first door unchanged", () => {
    const verdict = decide(baseline({ ccda: B }), baseline({ ccda: A }), [changeset("major")]);
    expect(verdict.status).toBe("pass");
  });
});

describe("an Output change section is read from the changeset body, for this package only", () => {
  const body = (bump: string, section: string, pkg = PACKAGE): string =>
    `---\n"${pkg}": ${bump}\n---\n\nSummary sentence.\n\n${section}\n`;

  it("accepts the heading plain, bold, or as a list item", () => {
    for (const section of [
      "Output change: C-CDA documents gain a code.",
      "**Output change:** C-CDA documents gain a code.",
      "- **Output change:** C-CDA documents gain a code.",
    ]) {
      expect(statesOutputChangeFor(body("patch", section), PACKAGE, ["ccda"]).ok, section).toBe(
        true,
      );
    }
  });

  it("reads only the paragraph the heading opens", () => {
    const text = body(
      "patch",
      "Output change: FHIR resources gain a field.\n\nC-CDA is mentioned here.",
    );
    const stated = statesOutputChangeFor(text, PACKAGE, ["ccda"]);
    expect(stated.ok).toBe(false);
    expect(stated.missing).toEqual(["C-CDA"]);
  });

  it("is not satisfied by a section in a changeset for another package", () => {
    const text = body("patch", "Output change: C-CDA documents gain a code.", "@cosyte/hl7");
    expect(statesOutputChangeFor(text, PACKAGE, ["ccda"]).ok).toBe(false);
  });

  it("is not satisfied by a heading that only appears in the frontmatter", () => {
    const text = `---\n"${PACKAGE}": patch\nOutput change: C-CDA\n---\n\nSummary.\n`;
    expect(statesOutputChangeFor(text, PACKAGE, ["ccda"]).ok).toBe(false);
  });
});
