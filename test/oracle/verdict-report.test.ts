/**
 * The verdict record: what graded what, and who saw the generated fixtures.
 *
 * The endpoint list is the assertion that matters most here. Running the oracle executes a third
 * party's binary over content this library generated, and, depending on how terminology resolution
 * is configured, can send that content to a public server. The content is synthetic by construction,
 * so the exposure is bounded by this package's central promise rather than by this gate, but it is
 * still a transmission to a third party and the run has to say which third parties. A verdict that
 * records none is refused rather than published.
 */

import { describe, expect, it } from "vitest";

import type { CoverageDeclaration } from "../../scripts/oracle/coverage.js";
import { decideGate, type DeclaredArtifact } from "../../scripts/oracle/gate.js";
import { buildVerdict, renderVerdict, type VerdictInput } from "../../scripts/oracle/verdict.js";

const CLEAN_REPORT = JSON.stringify({
  resourceType: "OperationOutcome",
  issue: [{ severity: "information", code: "informational", details: { text: "All OK" } }],
});

const ERROR_REPORT = JSON.stringify({
  resourceType: "OperationOutcome",
  issue: [
    {
      severity: "error",
      code: "structure",
      details: { text: "required element is absent" },
      expression: ["Patient.identifier"],
    },
  ],
});

const ARTIFACT: DeclaredArtifact = {
  id: "fhir/USCorePatient/seed-61001",
  format: "fhir",
  kind: "USCorePatient",
  seed: 61001,
  profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
};

const COVERAGE: CoverageDeclaration = {
  formats: [
    {
      format: "fhir",
      independentlyGraded: true,
      grader: "the HL7-maintained FHIR validator",
      gradedAgainst: "the US Core 6.1.0 package",
      ungradedReason: "",
    },
    {
      format: "hl7v2",
      independentlyGraded: false,
      grader: "",
      gradedAgainst: "",
      ungradedReason:
        "no public file-based grader was found; the round-trip is not an independent verdict",
    },
  ],
  exclusions: [],
};

const input = (overrides: Partial<VerdictInput> = {}): VerdictInput => ({
  validator: {
    name: "validator_cli.jar",
    version: "6.6.9",
    sha256: "a".repeat(64),
    source:
      "https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.6.9/validator_cli.jar",
  },
  conformancePackage: {
    name: "hl7.fhir.us.core",
    version: "6.1.0",
    sha256: "b".repeat(64),
    source: "https://packages.fhir.org/hl7.fhir.us.core/6.1.0",
  },
  endpoints: [
    "https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.6.9/validator_cli.jar",
    "https://packages.fhir.org/hl7.fhir.us.core/6.1.0",
  ],
  terminology: "no terminology server was configured (-tx n/a)",
  coverage: COVERAGE,
  decision: decideGate({
    graded: [{ artifact: ARTIFACT, report: { kind: "text", text: CLEAN_REPORT } }],
    excluded: [],
    independentlyGradedFormats: ["fhir"],
  }),
  ...overrides,
});

describe("the verdict names the validator version and the package version it graded against", () => {
  it("carries both, so `validated against US Core` is a claim about something in particular", () => {
    const verdict = buildVerdict(input());
    expect(verdict.status).toBe("pass");
    expect(verdict.validator.version).toBe("6.6.9");
    expect(verdict.conformancePackage.version).toBe("6.1.0");
    expect(renderVerdict(verdict)).toContain("6.6.9");
    expect(renderVerdict(verdict)).toContain("6.1.0");
  });

  it("refuses to publish a verdict naming a component with no version", () => {
    expect(() =>
      buildVerdict(
        input({
          validator: {
            name: "validator_cli.jar",
            version: "",
            sha256: "a".repeat(64),
            source: "https://example.invalid/jar",
          },
        }),
      ),
    ).toThrow(/no version/);
  });
});

describe("the verdict records every external endpoint the run was configured to contact", () => {
  it("names the acquisition endpoints, so a reader can tell what saw the generated fixtures", () => {
    const verdict = buildVerdict(input());
    expect(verdict.endpoints).toEqual([
      "https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.6.9/validator_cli.jar",
      "https://packages.fhir.org/hl7.fhir.us.core/6.1.0",
    ]);
    expect(renderVerdict(verdict)).toContain("packages.fhir.org");
  });

  it("names a terminology server when one is configured, because it sees the fixtures", () => {
    const verdict = buildVerdict(
      input({
        endpoints: [
          "https://example.invalid/jar",
          "https://example.invalid/pkg",
          "https://tx.example.invalid",
        ],
        terminology: "terminology resolution was directed at https://tx.example.invalid",
      }),
    );
    expect(verdict.endpoints).toContain("https://tx.example.invalid");
    expect(verdict.terminology).toContain("tx.example.invalid");
  });

  it("refuses a verdict that would record no endpoint at all", () => {
    expect(() => buildVerdict(input({ endpoints: [] }))).toThrow(/no external endpoint/);
  });

  it("refuses a verdict that says nothing about how terminology was configured", () => {
    expect(() => buildVerdict(input({ terminology: "  " }))).toThrow(/terminology/);
  });
});

describe("the verdict is per artifact, and identifies each one by seed", () => {
  it("records the format, kind, seed, profile and severity counts", () => {
    const verdict = buildVerdict(input());
    expect(verdict.artifacts).toEqual([
      {
        id: "fhir/USCorePatient/seed-61001",
        format: "fhir",
        kind: "USCorePatient",
        seed: 61001,
        profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
        status: "graded",
        counts: { information: 1 },
        issues: [
          { severity: "information", code: "informational", detail: "All OK", location: [] },
        ],
      },
    ]);
  });

  it("publishes every issue verbatim, so a PASSING run still says what the validator said", () => {
    const withWarning = JSON.stringify({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "warning",
          code: "business-rule",
          details: { text: "narrative is recommended" },
          expression: ["Patient"],
        },
      ],
    });
    const verdict = buildVerdict(
      input({
        decision: decideGate({
          graded: [{ artifact: ARTIFACT, report: { kind: "text", text: withWarning } }],
          excluded: [],
          independentlyGradedFormats: ["fhir"],
        }),
      }),
    );

    expect(verdict.status).toBe("pass");
    expect(verdict.artifacts[0]?.issues).toEqual([
      {
        severity: "warning",
        code: "business-rule",
        detail: "narrative is recommended",
        location: ["Patient"],
      },
    ]);
    // Rendered at the severity the report gave it, and marked as not blocking BESIDE that severity
    // rather than instead of it.
    const rendered = renderVerdict(verdict);
    expect(rendered).toContain("warning (not blocking): narrative is recommended at Patient");
  });

  it("marks a blocking issue as failing the gate without changing its severity", () => {
    const verdict = buildVerdict(
      input({
        decision: decideGate({
          graded: [{ artifact: ARTIFACT, report: { kind: "text", text: ERROR_REPORT } }],
          excluded: [],
          independentlyGradedFormats: ["fhir"],
        }),
      }),
    );
    expect(renderVerdict(verdict)).toContain("error (FAILS THE GATE): required element is absent");
    expect(verdict.artifacts[0]?.issues.map((i) => i.severity)).toEqual(["error"]);
  });

  it("a failing run records the finding at the severity the validator gave it", () => {
    const verdict = buildVerdict(
      input({
        decision: decideGate({
          graded: [{ artifact: ARTIFACT, report: { kind: "text", text: ERROR_REPORT } }],
          excluded: [],
          independentlyGradedFormats: ["fhir"],
        }),
      }),
    );

    expect(verdict.status).toBe("fail");
    expect(verdict.findings.map((f) => f.severity)).toEqual(["error"]);
    expect(verdict.coverageEstablished).toEqual([]);
    expect(renderVerdict(verdict)).toContain("seed=61001");
  });
});

describe("the verdict publishes the coverage declaration alongside the result", () => {
  it("names every format as graded with a grader, or ungraded with a reason", () => {
    const rendered = renderVerdict(buildVerdict(input()));
    expect(rendered).toContain("fhir: independently graded by the HL7-maintained FHIR validator");
    expect(rendered).toContain("hl7v2: UNGRADED");
    expect(rendered).toContain("not an independent verdict");
  });

  it("names an excluded artifact and its reason in the same record", () => {
    const rendered = renderVerdict(
      buildVerdict(
        input({
          coverage: {
            ...COVERAGE,
            exclusions: [
              {
                artifactId: "fhir/Procedure/seed-61009",
                format: "fhir",
                kind: "Procedure",
                seed: 61009,
                reason: "no US Core profile exists for it",
              },
            ],
          },
        }),
      ),
    );
    expect(rendered).toContain("excluded from the graded corpus: fhir/Procedure/seed-61009");
    expect(rendered).toContain("no US Core profile exists for it");
  });
});
