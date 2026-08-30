/**
 * THE CROSS-ENGINE COMPARISON, DRIVEN OFFLINE.
 *
 * The condition this gate exists to observe, two Node majors disagreeing about what a seed maps to,
 * EXISTS ONLY IN CONTINUOUS INTEGRATION. A development session has one Node install, so nobody can
 * ever watch the mismatch case happen on their own machine. That is not worked around here, it is
 * designed around: every decision the comparison makes is a pure function over a set of reports,
 * and this suite feeds it reports that agree, reports that disagree, reports that are missing,
 * reports that are unreadable and reports about a different corpus.
 *
 * THE FIXTURES ARE HAND-AUTHORED AND SAY SO IN THEIR OWN TEXT. They are not captured matrix runs
 * and this suite does not pretend they are. What they buy is that the mismatch arm, the arm no
 * local run can reach and the one that matters most, is exercised on every single `pnpm test`.
 *
 * WHAT THE COMPARISON MAY NEVER DO, asserted here rather than trusted: report a pass over a partial
 * set of engines, read an unreadable report as agreement, or put generated artifact content into a
 * diagnostic. A mismatch is identified by seed, format and engine identity alone.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  compareEngines,
  renderComparison,
  type ComparisonResult,
  type ReportSource,
} from "../../scripts/determinism/compare.js";
import type { CorpusPair } from "../../scripts/determinism/corpus.js";

const FIXTURES = join(import.meta.dirname, "fixtures");
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");

/** The two engines and two pairs every fixture in this directory is written against. */
const ENGINES = [22, 24];
const PAIRS: readonly CorpusPair[] = [
  { format: "hl7v2", seed: 1 },
  { format: "fhir", seed: 2 },
];

/** The digests the fixtures carry, so a diagnostic can be asserted NOT to quote them. */
const DIGEST_22_HL7 = "1111111111111111111111111111111111111111111111111111111111111111";
const DIGEST_24_HL7 = "3333333333333333333333333333333333333333333333333333333333333333";

/** A source that reads a fixture file. */
const fromFixture = (name: string): ReportSource => ({
  kind: "text",
  label: `test/determinism/fixtures/${name}`,
  text: fixture(name),
});

/** Compare `node-22.json` against whatever the second engine is said to have produced. */
function compareAgainst(
  second: ReportSource | undefined,
  options: { engines?: readonly number[]; pairs?: readonly CorpusPair[] } = {},
): ComparisonResult {
  const sources = new Map<number, ReportSource>();
  sources.set(22, fromFixture("node-22.json"));
  if (second !== undefined) sources.set(24, second);
  return compareEngines({
    declaredEngines: options.engines ?? ENGINES,
    declaredPairs: options.pairs ?? PAIRS,
    sources,
  });
}

/** Every failure line joined, for substring assertions. */
const failureText = (result: ComparisonResult): string =>
  result.status === "fail" ? result.failures.join("\n") : "";

describe("agreement: every declared engine produced the same bytes", () => {
  it("passes and records which engines it compared and how many pairs", () => {
    const result = compareAgainst(fromFixture("node-24-agreeing.json"));
    expect(result.status).toBe("pass");
    if (result.status !== "pass") return;
    expect(result.engines).toEqual(["node-22", "node-24"]);
    expect(result.pairs).toBe(2);
    const rendered = renderComparison(result);
    expect(rendered).toContain("node-22");
    expect(rendered).toContain("node-24");
    expect(rendered).toContain("2 (format, seed) pair(s)");
  });
});

describe("mismatch: two engines disagree about what a seed maps to", () => {
  const result = compareAgainst(fromFixture("node-24-mismatch.json"));

  it("fails", () => {
    expect(result.status).toBe("fail");
  });

  it("names the seed, the format and BOTH engine identities", () => {
    const text = failureText(result);
    expect(text).toContain("hl7v2");
    expect(text).toContain("seed 1");
    expect(text).toContain("node-22");
    expect(text).toContain("node-24");
  });

  it("reports the disagreeing pair and only that pair", () => {
    expect(result.status).toBe("fail");
    if (result.status !== "fail") return;
    expect(result.failures).toHaveLength(1);
    // fhir seed 2 agrees in both fixtures, so it is not named.
    expect(result.failures[0]).not.toContain("fhir");
  });

  it("puts NO generated artifact content, and not even a digest, in the diagnostic or the verdict", () => {
    // A digest is not artifact content, but the contract is narrower than that: a mismatch is
    // identified by seed, format and engine identity ALONE. Asserting the digests are absent is
    // how "alone" stays true, and it is the assertion that would fail first if somebody made this
    // message more helpful by quoting the bytes.
    const text = `${failureText(result)}\n${renderComparison(result)}`;
    expect(text).not.toContain(DIGEST_22_HL7);
    expect(text).not.toContain(DIGEST_24_HL7);
    // The wire markers every one of the six formats opens with. None of them can be here, because
    // the comparison never sees an artifact at all: it only ever holds digests.
    for (const marker of [
      "MSH|",
      "resourceType",
      "<ClinicalDocument",
      "ISA*",
      "<Message",
      "H|\\^&",
    ]) {
      expect(text).not.toContain(marker);
    }
  });
});

describe("a missing report is never a pass over the engines that did report", () => {
  it("fails when a declared engine supplied nothing at all", () => {
    const result = compareAgainst(undefined);
    expect(result.status).toBe("fail");
    expect(failureText(result)).toContain("node-24");
  });

  it("fails when a declared engine's report is absent for a stated reason", () => {
    const result = compareAgainst({
      kind: "absent",
      label: ".determinism/reports/node-24.json",
      detail: "ENOENT: no such file or directory",
    });
    expect(result.status).toBe("fail");
    expect(failureText(result)).toContain(".determinism/reports/node-24.json");
    expect(failureText(result)).toContain("ENOENT");
  });

  it("has no shape in which a failing comparison carries the engines it 'passed' over", () => {
    const result = compareAgainst(undefined);
    expect(result.status).toBe("fail");
    expect(Object.hasOwn(result, "engines")).toBe(false);
    expect(Object.hasOwn(result, "pairs")).toBe(false);
    expect(renderComparison(result)).not.toContain("PASS");
  });
});

describe("an unreadable report is never read as agreement", () => {
  const cases: ReadonlyArray<readonly [string, ReportSource, string]> = [
    [
      "truncated part way through",
      fromFixture("node-24-truncated.json.txt"),
      "node-24-truncated.json.txt",
    ],
    [
      "in an unrecognised shape",
      fromFixture("node-24-unknown-shape.json"),
      "node-24-unknown-shape.json",
    ],
    [
      "not JSON at all",
      { kind: "text", label: "inline", text: "this is not a report\n" },
      "inline",
    ],
    [
      "covering a different (format, seed) set",
      fromFixture("node-24-wrong-corpus.json"),
      "node-24-wrong-corpus.json",
    ],
    [
      "filed under an engine it does not claim to be",
      fromFixture("node-24-wrong-engine.json"),
      "node-24-wrong-engine.json",
    ],
  ];

  for (const [what, source, label] of cases) {
    it(`fails and names the report when it is ${what}`, () => {
      const result = compareAgainst(source);
      expect(result.status).toBe("fail");
      expect(failureText(result)).toContain(label);
    });
  }

  it("names the pair a wrong-corpus report is missing and the one it invented", () => {
    const result = compareAgainst(fromFixture("node-24-wrong-corpus.json"));
    const text = failureText(result);
    expect(text).toContain("fhir/seed-2");
    expect(text).toContain("ccda/seed-9");
  });

  it("fails when two reports were taken with different digest algorithms", () => {
    const parsed: unknown = JSON.parse(fixture("node-24-agreeing.json"));
    const altered = { ...(parsed as Record<string, unknown>), digestAlgorithm: "sha512" };
    const result = compareAgainst({
      kind: "text",
      label: "inline-sha512",
      text: JSON.stringify(altered),
    });
    expect(result.status).toBe("fail");
    expect(failureText(result)).toContain("sha512");
  });
});

describe("a comparison that compared nothing never reports a pass", () => {
  it("fails on an empty declared corpus", () => {
    const result = compareAgainst(fromFixture("node-24-agreeing.json"), { pairs: [] });
    expect(result.status).toBe("fail");
    expect(failureText(result)).toContain("no (format, seed) pair");
  });

  it("fails when fewer than two distinct engine identities are being compared", () => {
    const result = compareEngines({
      declaredEngines: [22],
      declaredPairs: PAIRS,
      sources: new Map<number, ReportSource>([[22, fromFixture("node-22.json")]]),
    });
    expect(result.status).toBe("fail");
    expect(failureText(result)).toContain("fewer than two");
  });

  it("fails when the same engine is declared twice rather than two distinct ones", () => {
    const result = compareEngines({
      declaredEngines: [22, 22],
      declaredPairs: PAIRS,
      sources: new Map<number, ReportSource>([[22, fromFixture("node-22.json")]]),
    });
    expect(result.status).toBe("fail");
  });

  it("fails when a report arrives for an engine that is not declared", () => {
    const sources = new Map<number, ReportSource>([
      [22, fromFixture("node-22.json")],
      [24, fromFixture("node-24-agreeing.json")],
    ]);
    const result = compareEngines({
      declaredEngines: [22, 20],
      declaredPairs: PAIRS,
      sources,
    });
    expect(result.status).toBe("fail");
    expect(failureText(result)).toContain("node-24");
  });
});

describe("the fixtures are labelled as fixtures", () => {
  it("says in its own text that it is hand-authored rather than a captured matrix run", () => {
    for (const name of [
      "node-22.json",
      "node-24-agreeing.json",
      "node-24-mismatch.json",
      "node-24-wrong-corpus.json",
      "node-24-wrong-engine.json",
      "node-24-unknown-shape.json",
      "node-24-truncated.json.txt",
    ]) {
      expect(fixture(name), name).toContain("HAND-AUTHORED FIXTURE, NOT A CAPTURED MATRIX RUN");
    }
  });
});
