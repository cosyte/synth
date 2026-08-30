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

import { decideWindow, declaresMajorFor } from "../../scripts/determinism/window.js";

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
