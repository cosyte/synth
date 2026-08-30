/**
 * scripts/oracle/verdict.ts
 *
 * THE VERDICT RECORD: WHAT GRADED WHAT, AND WHO SAW THE FIXTURES.
 *
 * A run that only says "pass" is not evidence. This file assembles the record that makes the pass
 * mean something and the fail actionable:
 *
 *   * WHICH VALIDATOR AND WHICH PACKAGE. A verdict names the external validator's version and the US
 *     Core package version it graded against. Without both, "validated against US Core" is a claim
 *     about nothing in particular, and next month's run is not comparable with this one.
 *   * EVERY EXTERNAL ENDPOINT THE RUN WAS CONFIGURED TO CONTACT. This is the one irreversible,
 *     declarable act in the whole gate: executing a third party's binary over generated content, and
 *     possibly sending that content to a public terminology server. The content is synthetic by
 *     construction, so the exposure is bounded by this package's central promise rather than by this
 *     gate, but it is still a transmission to a third party and a reader is entitled to know exactly
 *     which third parties. The list is the CONFIGURED set, not a guess at a default: the runner
 *     passes the terminology setting explicitly so this record can be exact.
 *   * PER-ARTIFACT OUTCOMES, each carrying the format and the GENERATING SEED, so a failure is
 *     reproduced by regenerating from the seed rather than by rerunning the job.
 *   * THE COVERAGE DECLARATION, naming every format the library generates as graded or ungraded.
 *
 * Pure: it maps inputs to a record. No clock, no filesystem, no network, which is what lets
 * `test/oracle/verdict-report.test.ts` assert its content offline.
 */

import type { CoverageDeclaration } from "./coverage.js";
import type { GateDecision } from "./gate.js";

/** An external artifact this run acquired and graded with. */
export interface GradingComponent {
  /** What it is. */
  readonly name: string;
  /** The version this run used. */
  readonly version: string;
  /** The sha256 of the bytes used. */
  readonly sha256: string;
  /** Where it came from. */
  readonly source: string;
}

/** What the verdict is assembled from. */
export interface VerdictInput {
  /** The external validator that produced the reports. */
  readonly validator: GradingComponent;
  /** The conformance package the artifacts were graded against. */
  readonly conformancePackage: GradingComponent;
  /**
   * Every external network endpoint the grading run was CONFIGURED to contact, including the ones
   * used only to acquire the components above. An empty list is refused: a run that acquired a jar
   * over the network contacted something, and a record claiming otherwise is false.
   */
  readonly endpoints: readonly string[];
  /** How terminology resolution was configured, in words, for the reader of the endpoint list. */
  readonly terminology: string;
  /** The published coverage declaration. */
  readonly coverage: CoverageDeclaration;
  /** The gate's decision. */
  readonly decision: GateDecision;
}

/** One artifact's line in the verdict. */
export interface VerdictArtifact {
  /** The artifact id. */
  readonly id: string;
  /** Its format. */
  readonly format: string;
  /** Its generator kind. */
  readonly kind: string;
  /** The seed that reproduces it. */
  readonly seed: number;
  /** The profile it was graded against. */
  readonly profile: string;
  /** Whether a report was read for it. */
  readonly status: "graded" | "no-report" | "unreadable";
  /** Issue counts by severity, exactly as the report spelled them. */
  readonly counts: Readonly<Record<string, number>>;
}

/** The published verdict. */
export interface OracleVerdict {
  /** `pass` only when the gate found nothing. */
  readonly status: "pass" | "fail";
  /** The validator that produced the reports. */
  readonly validator: GradingComponent;
  /** The conformance package graded against. */
  readonly conformancePackage: GradingComponent;
  /** Every external endpoint this run was configured to contact. */
  readonly endpoints: readonly string[];
  /** How terminology resolution was configured. */
  readonly terminology: string;
  /** The coverage declaration. */
  readonly coverage: CoverageDeclaration;
  /** The formats an independent verdict was actually established for in THIS run. */
  readonly coverageEstablished: readonly string[];
  /** One line per submitted artifact. */
  readonly artifacts: readonly VerdictArtifact[];
  /** Every reason the run failed. Empty on a pass. */
  readonly findings: GateDecision["findings"];
}

/**
 * Assemble the verdict.
 *
 * @param input - The components, the endpoints, the declaration and the decision.
 * @returns The verdict record.
 * @throws Error when the endpoint list is empty, or a component names no version.
 * @example
 * ```ts
 * const verdict = buildVerdict(input);
 * verdict.status; // "pass" | "fail"
 * ```
 */
export function buildVerdict(input: VerdictInput): OracleVerdict {
  if (input.endpoints.length === 0) {
    throw new Error(
      "the verdict would record no external endpoint at all. This run downloads a validator and a " +
        "conformance package, so it contacted something; a record saying otherwise is false, and " +
        "the point of this field is that a reader can tell what saw the generated fixtures.",
    );
  }
  for (const component of [input.validator, input.conformancePackage]) {
    if (component.version.trim().length === 0) {
      throw new Error(
        `the verdict would name ${component.name} with no version. "Validated against US Core" ` +
          "with no version attached is a claim about nothing in particular.",
      );
    }
  }
  if (input.terminology.trim().length === 0) {
    throw new Error(
      "the verdict would say nothing about how terminology resolution was configured, which is " +
        "the setting that decides whether generated content leaves the runner at all.",
    );
  }

  const artifacts = input.decision.outcomes.map(
    (outcome): VerdictArtifact => ({
      id: outcome.artifact.id,
      format: outcome.artifact.format,
      kind: outcome.artifact.kind,
      seed: outcome.artifact.seed,
      profile: outcome.artifact.profile,
      status: outcome.status,
      counts: { ...outcome.counts },
    }),
  );

  return {
    status: input.decision.passed ? "pass" : "fail",
    validator: input.validator,
    conformancePackage: input.conformancePackage,
    endpoints: [...input.endpoints],
    terminology: input.terminology,
    coverage: input.coverage,
    coverageEstablished: input.decision.coverageEstablished,
    artifacts,
    findings: input.decision.findings,
  };
}

/** Render the verdict as the run's human-readable summary. */
export function renderVerdict(verdict: OracleVerdict): string {
  const lines: string[] = [];
  lines.push(`oracle: ${verdict.status.toUpperCase()}`);
  lines.push(
    `  validator : ${verdict.validator.name} ${verdict.validator.version} ` +
      `(sha256 ${verdict.validator.sha256})`,
  );
  lines.push(
    `  package   : ${verdict.conformancePackage.name} ${verdict.conformancePackage.version} ` +
      `(sha256 ${verdict.conformancePackage.sha256})`,
  );
  lines.push(`  endpoints : ${verdict.endpoints.join(", ")}`);
  lines.push(`  terminology: ${verdict.terminology}`);
  lines.push("  coverage  :");
  for (const entry of verdict.coverage.formats) {
    lines.push(
      entry.independentlyGraded
        ? `    ${entry.format}: independently graded by ${entry.grader} against ${entry.gradedAgainst}`
        : `    ${entry.format}: UNGRADED (${entry.ungradedReason})`,
    );
  }
  for (const exclusion of verdict.coverage.exclusions) {
    lines.push(
      `    excluded from the graded corpus: ${exclusion.artifactId} (seed ` +
        `${String(exclusion.seed)}) because ${exclusion.reason}`,
    );
  }
  lines.push(`  established this run: ${verdict.coverageEstablished.join(", ") || "(none)"}`);
  lines.push("  artifacts :");
  for (const artifact of verdict.artifacts) {
    const counts = Object.entries(artifact.counts)
      .map(([severity, n]) => `${severity}=${String(n)}`)
      .join(" ");
    lines.push(
      `    ${artifact.id} [${artifact.status}] seed=${String(artifact.seed)} ${counts}`.trimEnd(),
    );
  }
  if (verdict.findings.length > 0) {
    lines.push("  findings  :");
    for (const finding of verdict.findings) {
      lines.push(`    [${finding.kind}] ${finding.subject}: ${finding.detail}`);
    }
  }
  return lines.join("\n");
}
