/**
 * The oracle gate's decision, exercised offline against validator reports committed as fixtures.
 *
 * THE FIXTURES ARE HAND-AUTHORED AND SAY SO IN THEIR OWN BYTES. Not one of them is a captured
 * validator run. The environment this suite is written in has no JRE and no network, so the external
 * validator cannot execute here at all; CI is the first and only place it runs, and the oracle check
 * there is the only evidence that a real validator said anything about this package's output. What
 * these fixtures prove is narrower and is the half that can be proven here: that every decision the
 * gate takes over a report is the decision it is supposed to take, including the decisions a passing
 * CI run would never reach.
 *
 * A gate is worth what its unhappy paths are worth, so each one is exercised on its own: a blocking
 * finding, a report that never arrived, a report that cannot be read, and a corpus that graded
 * nothing.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  decideGate,
  type DeclaredArtifact,
  type GradedArtifact,
  type ReportSource,
} from "../../scripts/oracle/gate.js";
import { parseValidatorReport } from "../../scripts/oracle/report.js";

const FIXTURES = join(import.meta.dirname, "fixtures");

/** Read one committed report fixture. */
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");

/**
 * The truncated fixture carries its provenance note as prose above a `---` line, because a file that
 * is deliberately not readable JSON cannot carry that note as a JSON member and stay broken in the
 * way the case needs. Everything below the marker is what the gate is handed.
 */
const truncatedReport = (): string => {
  const raw = fixture("truncated.json.txt");
  const marker = raw.indexOf("\n---\n");
  expect(marker, "the truncated fixture must keep its provenance marker").toBeGreaterThan(0);
  return raw.slice(marker + 5);
};

const artifactOf = (overrides: Partial<DeclaredArtifact> = {}): DeclaredArtifact => ({
  id: "fhir/USCorePatient/seed-61001",
  format: "fhir",
  kind: "USCorePatient",
  seed: 61001,
  profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
  ...overrides,
});

const graded = (
  report: ReportSource,
  overrides: Partial<DeclaredArtifact> = {},
): GradedArtifact => ({
  artifact: artifactOf(overrides),
  report,
});

const withReport = (name: string, overrides: Partial<DeclaredArtifact> = {}): GradedArtifact =>
  graded({ kind: "text", text: fixture(name) }, overrides);

const run = (entries: readonly GradedArtifact[], formats: readonly string[] = ["fhir"]) =>
  decideGate({ graded: entries, excluded: [], independentlyGradedFormats: formats });

describe("every report fixture declares in its own bytes that it is hand-authored", () => {
  const jsonFixtures = [
    "clean.json",
    "error.json",
    "fatal.json",
    "warning-only.json",
    "empty-issue.json",
    "wrong-resource.json",
    "unknown-severity.json",
  ];

  it.each(jsonFixtures)("%s carries its provenance note", (name) => {
    const parsed: unknown = JSON.parse(fixture(name));
    const provenance = (parsed as { fixtureProvenance?: unknown }).fixtureProvenance;
    expect(provenance).toContain("HAND-AUTHORED FIXTURE, NOT A CAPTURED VALIDATOR RUN");
  });

  it("the truncated fixture carries its provenance note as prose", () => {
    expect(fixture("truncated.json.txt")).toContain(
      "HAND-AUTHORED FIXTURE, NOT A CAPTURED VALIDATOR RUN",
    );
  });

  it("a provenance note does not stop a fixture being read as a report", () => {
    // The note is an unknown member. The reader tolerates unknown members on purpose: a validator
    // release that adds a field is not a report it failed to read.
    const parsed = parseValidatorReport(fixture("clean.json"));
    expect(parsed.ok).toBe(true);
  });
});

describe("a report carrying error or fatal fails the run, and is never recorded as anything less", () => {
  it("an error fails the run and keeps the severity the report gave it", () => {
    const decision = run([withReport("error.json")]);

    expect(decision.passed).toBe(false);
    const blocking = decision.findings.filter((f) => f.kind === "validator-issue");
    expect(blocking).toHaveLength(1);
    expect(blocking[0]?.severity).toBe("error");

    // The one thing the gate is forbidden to do: re-label it. No finding, anywhere in the decision,
    // carries this issue as a warning, a note or an informational finding.
    for (const finding of decision.findings) {
      expect(finding.severity).not.toBe("warning");
      expect(finding.severity).not.toBe("information");
    }
    expect(decision.findings.some((f) => /\bwarning\b/i.test(f.detail.split(":")[0] ?? ""))).toBe(
      false,
    );
  });

  it("a fatal fails the run just as an error does", () => {
    const decision = run([withReport("fatal.json")]);
    expect(decision.passed).toBe(false);
    expect(decision.findings.map((f) => f.severity)).toEqual(["fatal"]);
  });

  it("the other severities in the same report are still counted, verbatim, without blocking", () => {
    const decision = run([withReport("error.json")]);
    const outcome = decision.outcomes[0];
    expect(outcome?.status).toBe("graded");
    expect(outcome?.counts).toEqual({ information: 1, warning: 1, error: 1 });
    expect(outcome?.blocking.map((issue) => issue.severity)).toEqual(["error"]);
  });

  it("a warning-only report PASSES, so a red on the error fixture means something", () => {
    const decision = run([withReport("warning-only.json")]);
    expect(decision.findings).toEqual([]);
    expect(decision.passed).toBe(true);
    expect(decision.coverageEstablished).toEqual(["fhir"]);
  });

  it("a clean report passes and establishes the format's coverage", () => {
    const decision = run([withReport("clean.json")]);
    expect(decision.passed).toBe(true);
    expect(decision.coverageEstablished).toEqual(["fhir"]);
  });

  it("one blocking artifact spoils the format's coverage even beside a clean one", () => {
    const decision = run([
      withReport("clean.json"),
      withReport("error.json", { id: "fhir/Condition/seed-61002", kind: "Condition", seed: 61002 }),
    ]);
    expect(decision.passed).toBe(false);
    expect(decision.coverageEstablished).toEqual([]);
  });
});

describe("a validator that could not be reached fails the run and covers nothing", () => {
  const absent = (detail: string): ReportSource => ({ kind: "absent", detail });

  it.each([
    ["the validator could not be started", "java could not be started (ENOENT)"],
    ["the validator exited without a report", "exited 1 without writing a report"],
    ["the report could not be read back", "the report could not be read: EACCES"],
  ])("%s", (_label, detail) => {
    const decision = run([graded(absent(detail))]);

    expect(decision.passed).toBe(false);
    expect(decision.findings.map((f) => f.kind)).toEqual(["no-report"]);
    // Not skipped, not passed, and NOT reported as covered.
    expect(decision.coverageEstablished).toEqual([]);
    expect(decision.outcomes[0]?.status).toBe("no-report");
    expect(decision.findings[0]?.detail).toContain(detail);
    // A missing report has no severity to copy, and the gate does not invent one.
    expect(decision.findings[0]?.severity).toBeNull();
  });

  it("an unreachable validator does not become a pass just because another artifact was clean", () => {
    const decision = run([
      withReport("clean.json"),
      graded(absent("exited 1 without writing a report"), {
        id: "fhir/Condition/seed-61002",
        kind: "Condition",
        seed: 61002,
      }),
    ]);
    expect(decision.passed).toBe(false);
    expect(decision.coverageEstablished).toEqual([]);
  });
});

describe("a report that cannot be read is never read as zero errors", () => {
  it.each([
    ["truncated mid-document", () => truncatedReport(), "not readable JSON"],
    ["an unrecognised resource", () => fixture("wrong-resource.json"), "OperationOutcome"],
    ["an empty issue array", () => fixture("empty-issue.json"), "EMPTY `issue` array"],
    [
      "a severity outside the value set",
      () => fixture("unknown-severity.json"),
      "issue-severity value set",
    ],
    ["an empty file", () => "", "the report is empty"],
    ["a JSON array at the top level", () => "[]", "not a JSON object"],
  ])(
    "%s fails the run with a diagnostic naming the artifact and the report",
    (_label, read, needle) => {
      const decision = run([graded({ kind: "text", text: read() })]);

      expect(decision.passed).toBe(false);
      expect(decision.findings.map((f) => f.kind)).toEqual(["unreadable-report"]);

      const finding = decision.findings[0];
      expect(finding?.detail).toContain("fhir/USCorePatient/seed-61001");
      expect(finding?.detail).toContain(needle);
      expect(finding?.severity).toBeNull();
      expect(decision.outcomes[0]?.status).toBe("unreadable");
      expect(decision.outcomes[0]?.counts).toEqual({});
      expect(decision.coverageEstablished).toEqual([]);
    },
  );
});

describe("a gate that graded nothing can never report a pass", () => {
  it("a format claimed as independently graded with no artifact fails the run", () => {
    const decision = run([], ["fhir"]);
    expect(decision.passed).toBe(false);
    expect(decision.findings.map((f) => f.kind)).toEqual(["no-graded-artifact"]);
    expect(decision.findings[0]?.detail).toContain("yielded no artifact");
  });

  it("a corpus that yields nothing for ONE claimed format still fails, even beside a graded one", () => {
    const decision = run([withReport("clean.json")], ["fhir", "hl7v2"]);
    expect(decision.passed).toBe(false);
    expect(decision.findings.map((f) => f.subject)).toEqual(["hl7v2"]);
  });

  it("claiming nothing and grading nothing is still not a pass anyone can quote as coverage", () => {
    const decision = decideGate({ graded: [], excluded: [], independentlyGradedFormats: [] });
    expect(decision.passed).toBe(true);
    // The verdict a run of this shape would publish establishes coverage for no format at all,
    // which is the property that matters: an empty claim cannot masquerade as a graded one.
    expect(decision.coverageEstablished).toEqual([]);
  });
});

describe("a failing artifact is identified by format and by generating seed", () => {
  it.each([
    ["a blocking validator issue", () => withReport("error.json")],
    ["a missing report", () => graded({ kind: "absent", detail: "no report" })],
    ["an unreadable report", () => graded({ kind: "text", text: "{" })],
  ])("%s names the format and the seed, so it reproduces without the job", (_label, make) => {
    const entry = make();
    const decision = run([entry]);
    const finding = decision.findings[0];

    expect(finding?.format).toBe("fhir");
    expect(finding?.seed).toBe(61001);
    expect(finding?.detail).toContain("61001");
    // The identification is by SEED, not by a job or run identifier: nothing in the finding names
    // one, because rerunning the job is not how a reader is meant to reproduce this.
    expect(finding?.detail).not.toMatch(/run[ -]?id|job[ -]?id|attempt/i);
  });

  it("the finding names the profile the artifact was graded against", () => {
    const decision = run([withReport("error.json")]);
    expect(decision.findings[0]?.detail).toContain("us-core-patient");
  });
});

describe("an exclusion is a declared absence, never a lever on a finding", () => {
  it("an artifact that is both excluded and graded fails the run rather than being suppressed", () => {
    const artifact = artifactOf();
    const decision = decideGate({
      graded: [withReport("error.json")],
      excluded: [{ artifact, reason: "deferred to a follow-on change" }],
      independentlyGradedFormats: ["fhir"],
    });

    expect(decision.passed).toBe(false);
    // Both findings stand: the error is still reported at its own severity, and the collision is
    // reported as well. The exclusion did not reduce, hide or reclassify the validator's finding.
    expect(decision.findings.map((f) => f.kind).sort()).toEqual([
      "exclusion-collision",
      "validator-issue",
    ]);
    expect(decision.findings.find((f) => f.kind === "validator-issue")?.severity).toBe("error");
  });

  it("an excluded artifact that was not graded contributes no outcome and no pass", () => {
    const excludedArtifact = artifactOf({
      id: "fhir/Procedure/seed-61009",
      kind: "Procedure",
      seed: 61009,
    });
    const decision = decideGate({
      graded: [withReport("clean.json")],
      excluded: [{ artifact: excludedArtifact, reason: "no independent profile to grade against" }],
      independentlyGradedFormats: ["fhir"],
    });

    expect(decision.passed).toBe(true);
    expect(decision.outcomes.map((o) => o.artifact.id)).toEqual(["fhir/USCorePatient/seed-61001"]);
  });
});
