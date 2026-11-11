/**
 * THE COMPATIBILITY-WINDOW CHECK: A CHANGED SEED-TO-BYTES MAPPING IS STATED IN THE CHANGELOG.
 *
 * The published promise is that a consumer can commit a golden fixture and diff against it. That
 * promise survives a deliberate change to the mapping only if the release that makes it SAYS SO,
 * and the changeset summary is the changelog entry for this package, so the changeset is the thing
 * checked. Every release is a patch, so the statement is a named section in a patch changeset, one
 * for each kind of change the baseline shows, and a major bump alone is no statement.
 *
 * The two states that are easy to get wrong are asserted first. Establishing a baseline where none
 * existed is NOT a change: nothing mapped to anything before, and calling it one would force a
 * statement to ship a check that changes no output at all. Deleting a baseline that DOES exist
 * upstream is a change that took its own evidence with it, and no changeset makes it acceptable.
 */

import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decideWindow, statesOutputChangeFor } from "../../scripts/determinism/window.js";

const PACKAGE = "@cosyte/synth";

/** The headline every refusal of a changed baseline opens its rule with. */
const MAPPING_RULE = "A CHANGED SEED-TO-BYTES MAPPING HAS TO BE STATED";

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

describe("an unchanged mapping passes and a changed one has to be stated", () => {
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

  it("FAILS with the rule when a digest moved and there is no changeset", () => {
    const verdict = decide(baseline({ hl7v2: B }), baseline({ hl7v2: A }));
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain(MAPPING_RULE);
    expect(verdict.message).toContain("no changesets at all");
  });

  it("is not satisfied by a changeset of any bump that states nothing", () => {
    for (const bump of ["patch", "minor", "major"]) {
      const verdict = decide(baseline({ hl7v2: B }), baseline({ hl7v2: A }), [changeset(bump)]);
      expect(verdict.status, bump).toBe("fail");
      expect(verdict.message).toContain("Output change: naming HL7 v2");
    }
  });

  it("FAILS a major changeset alone, and says a major is no route", () => {
    const verdict = decide(baseline({ hl7v2: B }), baseline({ hl7v2: A }), [changeset("major")]);
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("A major changeset does not pass this check");
  });

  it("fails when the corpus grew or shrank without the change being stated", () => {
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
    expect(verdict.message).toContain(MAPPING_RULE);
    expect(verdict.message).toContain("NO SEED MAPS TO DIFFERENT BYTES");
    expect(verdict.message).toContain("1 pair(s) came OUT of the graded set");
    expect(verdict.message).toContain("Corpus narrowed: naming FHIR");

    // A major changeset alone no longer clears it.
    expect(
      decide(baseline({ hl7v2: A }), baseline({ hl7v2: A, fhir: B }), [changeset("major")]).status,
    ).toBe("fail");
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

  it("fails when the window itself moved and nothing states it", () => {
    const verdict = decide(
      baseline({ hl7v2: A }, { window: "1.x" }),
      baseline({ hl7v2: A }, { window: "0.x" }),
      [changeset("major")],
    );
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("Window change: naming 1.x");
  });

  it("fails when the digest algorithm or the corpus size changed and nothing states it", () => {
    const algorithm = decide(
      baseline({ hl7v2: A }, { algorithm: "sha512" }),
      baseline({ hl7v2: A }),
    );
    expect(algorithm.status).toBe("fail");
    expect(algorithm.message).toContain("Digest algorithm change: naming sha512");
    const perPair = decide(baseline({ hl7v2: A }, { perPair: 5 }), baseline({ hl7v2: A }));
    expect(perPair.status).toBe("fail");
    expect(perPair.message).toContain("Artifact count change: naming 5");
  });
});

/** A patch changeset for this package whose body carries the given sections, one paragraph each. */
const stating = (...sections: string[]) => ({
  name: "quiet-otters-say.md",
  text: `---\n"${PACKAGE}": patch\n---\n\nSummary sentence.\n\n${sections.join("\n\n")}\n`,
});

describe("every change the check allows lands with a patch changeset that states it", () => {
  it("passes a NARROWED corpus with a Corpus narrowed section naming the format", () => {
    const verdict = decide(baseline({ hl7v2: A }), baseline({ hl7v2: A, fhir: B }), [
      stating("Corpus narrowed: FHIR seed 1 is no longer graded, because it diverged."),
    ]);
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("quiet-otters-say.md");
    expect(verdict.message).toContain("Corpus narrowed:");
  });

  it("passes a moved window with a Window change section naming the new window", () => {
    const verdict = decide(
      baseline({ hl7v2: A }, { window: "1.x" }),
      baseline({ hl7v2: A }, { window: "0.x" }),
      [stating("Window change: the baseline now covers 1.x.")],
    );
    expect(verdict.status).toBe("pass");
  });

  it("passes a changed algorithm with a Digest algorithm change section naming it", () => {
    const verdict = decide(
      baseline({ hl7v2: B }, { algorithm: "sha512" }),
      baseline({ hl7v2: A }),
      [stating("Digest algorithm change: the baseline is now taken with sha512.")],
    );
    expect(verdict.status).toBe("pass");
  });

  it("passes a changed artifact count with an Artifact count change section naming it", () => {
    const verdict = decide(baseline({ hl7v2: B }, { perPair: 5 }), baseline({ hl7v2: A }), [
      stating("Artifact count change: each pair now digests 5 artifacts."),
    ]);
    expect(verdict.status).toBe("pass");
  });

  it("does not take a number inside another number as the artifact count", () => {
    const verdict = decide(baseline({ hl7v2: A }, { perPair: 5 }), baseline({ hl7v2: A }), [
      stating("Artifact count change: each pair now digests 15 artifacts."),
    ]);
    expect(verdict.status).toBe("fail");
  });

  it("needs a section for EVERY kind of change the baseline shows", () => {
    const current = baseline({ ccda: B }, { window: "1.x" });
    const previous = baseline({ ccda: A, hl7v2: A }, { window: "0.x" });
    const partial = decide(current, previous, [
      stating("Output change: C-CDA documents gain a code."),
    ]);
    expect(partial.status).toBe("fail");
    expect(partial.message).toContain("Corpus narrowed: naming HL7 v2");
    expect(partial.message).toContain("Window change: naming 1.x");
    expect(partial.message).not.toContain("Output change: naming");

    const whole = decide(current, previous, [
      stating(
        "Output change: C-CDA documents gain a code.",
        "Corpus narrowed: HL7 v2 seed 1 is no longer graded.",
        "Window change: the baseline now covers 1.x.",
      ),
    ]);
    expect(whole.status).toBe("pass");
  });

  it("takes the sections from more than one changeset", () => {
    const verdict = decide(baseline({ ccda: B }), baseline({ ccda: A, hl7v2: A }), [
      stating("Output change: C-CDA documents gain a code."),
      { ...stating("Corpus narrowed: HL7 v2 seed 1 is no longer graded."), name: "b.md" },
    ]);
    expect(verdict.status).toBe("pass");
  });

  it("does not read a section from a changeset for another package", () => {
    const other = {
      name: "other.md",
      text: '---\n"@cosyte/hl7": patch\n---\n\nCorpus narrowed: FHIR.\n',
    };
    const verdict = decide(baseline({ hl7v2: A }), baseline({ hl7v2: A, fhir: B }), [other]);
    expect(verdict.status).toBe("fail");
  });
});

describe("the check's own words name no major route and no internal reference", () => {
  const scripts = ["window.ts", "digest.ts", "check-window.ts"].map((name) => ({
    name,
    text: readFileSync(join(import.meta.dirname, "../../scripts/determinism", name), "utf8"),
  }));

  it("never tells a contributor to declare a major", () => {
    for (const { name, text } of scripts) {
      expect(text, name).not.toMatch(/declar\w*\s+(?:a\s+)?major/i);
    }
  });

  it("cites no decision id and no path into a private plan", () => {
    for (const { name, text } of scripts) {
      expect(text, name).not.toMatch(/\bD\d{1,3}\b/);
      expect(text, name).not.toContain("decisions.md");
    }
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

/**
 * A STATED OUTPUT CHANGE. A changeset passes a moved mapping when its `Output change:` section names
 * every format that moved.
 * The two committed fixtures are the same change, once stated for the gate and once only in prose:
 * the first must turn the check green and the second must leave it red.
 */
const fixture = (name: string): { name: string; text: string } => ({
  name,
  text: readFileSync(join(import.meta.dirname, "fixtures", name), "utf8"),
});
const STATED = fixture("changeset-output-stated.md");
const UNSTATED = fixture("changeset-output-unstated.md");

describe("a stated output change passes a moved mapping in a patch", () => {
  it("PASSES when a patch changeset's Output change section names the format that moved", () => {
    const verdict = decide(baseline({ ccda: B, hl7v2: A }), baseline({ ccda: A, hl7v2: A }), [
      STATED,
    ]);
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("changeset-output-stated.md");
    expect(verdict.message).toContain("C-CDA");
  });

  it("FAILS for the same change stated only in prose, with no Output change section", () => {
    const verdict = decide(baseline({ ccda: B, hl7v2: A }), baseline({ ccda: A, hl7v2: A }), [
      UNSTATED,
    ]);
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain(MAPPING_RULE);
    expect(verdict.message).toContain("Output change:");
  });

  it("FAILS, naming the gap, when the section leaves out a format that also moved", () => {
    const verdict = decide(baseline({ ccda: B, hl7v2: B }), baseline({ ccda: A, hl7v2: A }), [
      STATED,
    ]);
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("does not name HL7 v2");
  });

  it("does not cover a NARROWED corpus: that has its own section", () => {
    const verdict = decide(baseline({ ccda: A }), baseline({ ccda: A, hl7v2: A }), [STATED]);
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("came OUT of the graded set");
    expect(verdict.message).toContain("Corpus narrowed: naming HL7 v2");
  });

  it("does not cover a moved window: that has its own section", () => {
    const verdict = decide(
      baseline({ ccda: B }, { window: "1.x" }),
      baseline({ ccda: A }, { window: "0.x" }),
      [STATED],
    );
    expect(verdict.status).toBe("fail");
  });

  it("does not pass a major changeset with no section", () => {
    const verdict = decide(baseline({ ccda: B }), baseline({ ccda: A }), [changeset("major")]);
    expect(verdict.status).toBe("fail");
    expect(verdict.message).toContain("Output change: naming C-CDA");
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
