/**
 * scripts/oracle/gate.ts
 *
 * THE GATE DECISION, AS A PURE FUNCTION OVER VALIDATOR REPORTS.
 *
 * Everything that decides whether the oracle run passes or fails lives here, and nothing here
 * touches the network, a JRE, a clock or the filesystem. Hand it a declared corpus and, for each
 * graded artifact, either the text of a validator report or the reason there is none, and it returns
 * the verdict. That shape is what lets an environment with no Java and no egress test every branch
 * this gate can take, over reports committed as hand-authored fixtures.
 *
 * THE FIVE DECISIONS, and the failure each one closes:
 *
 *   1. A report carrying an issue of severity `error` or `fatal` FAILS THE RUN. The finding keeps
 *      the severity the report gave it, verbatim. There is no downgrade path, no warning-only mode
 *      and no suppression list anywhere in this file, and the absence is the feature: a gate you can
 *      quiet is a gate that reports green over the defect it exists to catch.
 *   2. NO REPORT AT ALL (the validator could not be reached, could not be acquired, or exited
 *      without writing one) FAILS THE RUN, and the format does not become covered. Skipping is not
 *      an outcome this function can produce.
 *   3. A REPORT THAT CANNOT BE READ fails the run with a diagnostic naming the artifact and what
 *      could not be read. `report.ts` owns the reading; this file owns never treating a refusal as
 *      zero errors.
 *   4. A FORMAT CLAIMED AS INDEPENDENTLY GRADED WITH NO GRADED ARTIFACT fails the run. A gate that
 *      graded nothing must never be able to report a pass, and an empty corpus is the cheapest way
 *      to get one.
 *   5. AN EXCLUSION THAT COLLIDES WITH A GRADED ARTIFACT fails the run. An exclusion removes an
 *      artifact from the graded corpus and says why, in the open, in the coverage declaration. It is
 *      not a way to hold a finding down: if the same artifact is both graded and excluded, the
 *      configuration is trying to do the second thing, and that is refused rather than resolved.
 *
 * A FAILING ARTIFACT IS IDENTIFIED BY FORMAT AND BY GENERATING SEED, never by a job id or a run
 * number, so the failure is reproduced by regenerating from the seed rather than by rerunning the
 * job. Every finding carries both.
 */

import {
  isBlocking,
  parseValidatorReport,
  type IssueSeverity,
  type ValidatorIssue,
} from "./report.js";

/** One artifact the declared corpus names, identified so a failure can be regenerated. */
export interface DeclaredArtifact {
  /** A stable id for this artifact within the run (`<format>/<kind>/seed-<n>`). */
  readonly id: string;
  /** The format the library generated it in, as the library labels it. */
  readonly format: string;
  /** The generator kind label. */
  readonly kind: string;
  /** The seed it was generated from: regenerating from this seed reproduces the bytes. */
  readonly seed: number;
  /** The profile it was graded against. */
  readonly profile: string;
}

/** The validator's answer for one artifact: its report text, or why there is none. */
export type ReportSource =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "absent"; readonly detail: string };

/** One artifact that was submitted for grading, with whatever came back. */
export interface GradedArtifact {
  /** The artifact that was submitted. */
  readonly artifact: DeclaredArtifact;
  /** What the grading run produced for it. */
  readonly report: ReportSource;
}

/** One artifact the declared corpus names but deliberately does not grade. */
export interface ExcludedArtifact {
  /** The artifact that was excluded. */
  readonly artifact: DeclaredArtifact;
  /** Why it is excluded. Never a statement about the severity of a finding. */
  readonly reason: string;
}

/** Why the gate failed on one thing. */
export type FindingKind =
  | "validator-issue"
  | "no-report"
  | "unreadable-report"
  | "no-graded-artifact"
  | "exclusion-collision";

/** One reason the run failed, tied to the artifact it came from. */
export interface GateFinding {
  /** What kind of failure this is. */
  readonly kind: FindingKind;
  /** The artifact id, or the format name for a whole-format finding. */
  readonly subject: string;
  /** The format involved. */
  readonly format: string;
  /** The generating seed, or `null` for a finding that is not about one artifact. */
  readonly seed: number | null;
  /**
   * The severity the VALIDATOR gave, copied unchanged, or `null` where the finding is this gate's
   * own (a missing report has no severity to copy, and inventing one would be a fabrication).
   */
  readonly severity: IssueSeverity | null;
  /** What went wrong, in words a reader can act on. */
  readonly detail: string;
}

/** What one artifact's grading produced, for the verdict record. */
export interface ArtifactOutcome {
  /** The artifact. */
  readonly artifact: DeclaredArtifact;
  /** `graded` = a report was read; `no-report` / `unreadable` = it was not. */
  readonly status: "graded" | "no-report" | "unreadable";
  /** Issue counts by severity, for a report that was read. Empty otherwise. */
  readonly counts: Readonly<Partial<Record<IssueSeverity, number>>>;
  /**
   * EVERY issue the report carried, verbatim, blocking or not.
   *
   * A passing run that shows only a count tells a reader nothing about what the external validator
   * actually said, and the non-blocking half is where the next conformance question lives. Carrying
   * them all, at the severity the report gave each one, is also what makes the fail rule auditable:
   * the reader can see which issues were treated as blocking and which were not, rather than
   * trusting that the sorting happened.
   */
  readonly issues: readonly ValidatorIssue[];
  /** The blocking issues, verbatim. A subset of `issues`. */
  readonly blocking: readonly ValidatorIssue[];
}

/** What the gate was asked to decide over. */
export interface GateInput {
  /** Every artifact submitted to the validator, with its report or the reason there is none. */
  readonly graded: readonly GradedArtifact[];
  /** Every artifact the declared corpus names and deliberately did not submit. */
  readonly excluded: readonly ExcludedArtifact[];
  /**
   * The formats the coverage declaration claims an independent verdict for. Each one must have at
   * least one artifact that was graded and read, or the run fails.
   */
  readonly independentlyGradedFormats: readonly string[];
}

/** The gate's decision. */
export interface GateDecision {
  /** True only when there is not one finding. */
  readonly passed: boolean;
  /** Every reason the run failed. Empty on a pass. */
  readonly findings: readonly GateFinding[];
  /** Per-artifact outcomes, in submission order. */
  readonly outcomes: readonly ArtifactOutcome[];
  /**
   * The formats an independent verdict was actually established for: every submitted artifact of
   * that format produced a readable report with no blocking issue, and there was at least one.
   * A format with a missing or unreadable report is NEVER in this list.
   */
  readonly coverageEstablished: readonly string[];
}

/** Count issues by severity without inventing a bucket for a severity that did not occur. */
function countBySeverity(
  issues: readonly ValidatorIssue[],
): Readonly<Partial<Record<IssueSeverity, number>>> {
  const counts: Partial<Record<IssueSeverity, number>> = {};
  for (const issue of issues) counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
  return counts;
}

/**
 * Decide the run.
 *
 * @param input - The graded artifacts, the declared exclusions, and the formats claimed as graded.
 * @returns The verdict, its findings, and the coverage it actually established.
 * @example
 * ```ts
 * const decision = decideGate({ graded: [], excluded: [], independentlyGradedFormats: ["fhir"] });
 * decision.passed; // false: a gate that graded nothing cannot pass
 * ```
 */
export function decideGate(input: GateInput): GateDecision {
  const findings: GateFinding[] = [];
  const outcomes: ArtifactOutcome[] = [];

  // Formats that produced at least one readable, clean report, minus any that produced a problem.
  const cleanFormats = new Set<string>();
  const spoiltFormats = new Set<string>();

  for (const entry of input.graded) {
    const { artifact } = entry;

    if (entry.report.kind === "absent") {
      spoiltFormats.add(artifact.format);
      outcomes.push({ artifact, status: "no-report", counts: {}, issues: [], blocking: [] });
      findings.push({
        kind: "no-report",
        subject: artifact.id,
        format: artifact.format,
        seed: artifact.seed,
        severity: null,
        detail:
          `no validator report was produced for ${artifact.id} (${artifact.kind}, seed ` +
          `${String(artifact.seed)}): ${entry.report.detail}. The run fails: an ungraded artifact ` +
          "is not a passing one, and this format is not reported as covered.",
      });
      continue;
    }

    const parsed = parseValidatorReport(entry.report.text);
    if (!parsed.ok) {
      spoiltFormats.add(artifact.format);
      outcomes.push({ artifact, status: "unreadable", counts: {}, issues: [], blocking: [] });
      findings.push({
        kind: "unreadable-report",
        subject: artifact.id,
        format: artifact.format,
        seed: artifact.seed,
        severity: null,
        detail:
          `the validator report for ${artifact.id} (${artifact.kind}, seed ` +
          `${String(artifact.seed)}, profile ${artifact.profile}) could not be read: ` +
          `${parsed.reason}`,
      });
      continue;
    }

    const blocking = parsed.issues.filter((issue) => isBlocking(issue.severity));
    outcomes.push({
      artifact,
      status: "graded",
      counts: countBySeverity(parsed.issues),
      issues: parsed.issues,
      blocking,
    });

    if (blocking.length === 0) {
      cleanFormats.add(artifact.format);
      continue;
    }

    spoiltFormats.add(artifact.format);
    for (const issue of blocking) {
      // The severity is copied, never mapped. Recording an `error` as a warning, a note or an
      // informational finding is the one thing this gate is forbidden to do.
      const where = issue.location.length > 0 ? ` at ${issue.location.join(", ")}` : "";
      findings.push({
        kind: "validator-issue",
        subject: artifact.id,
        format: artifact.format,
        seed: artifact.seed,
        severity: issue.severity,
        detail:
          `${issue.severity}: ${issue.detail}${where} (${artifact.kind}, seed ` +
          `${String(artifact.seed)}, profile ${artifact.profile}). Reproduce by regenerating ` +
          `${artifact.format} ${artifact.kind} from seed ${String(artifact.seed)}.`,
      });
    }
  }

  // An exclusion is a declared absence from the graded corpus, never a lever on a finding.
  const gradedIds = new Set(input.graded.map((entry) => entry.artifact.id));
  for (const exclusion of input.excluded) {
    if (!gradedIds.has(exclusion.artifact.id)) continue;
    findings.push({
      kind: "exclusion-collision",
      subject: exclusion.artifact.id,
      format: exclusion.artifact.format,
      seed: exclusion.artifact.seed,
      severity: null,
      detail:
        `${exclusion.artifact.id} is declared excluded ("${exclusion.reason}") and was ALSO ` +
        "submitted for grading. An exclusion removes an artifact from the graded corpus and says " +
        "so in the coverage declaration; it is not a way to hold down a finding on an artifact " +
        "that was graded anyway. Refusing rather than choosing one of the two readings.",
    });
  }

  // A format claimed as independently graded must actually have been graded.
  for (const format of input.independentlyGradedFormats) {
    const submitted = input.graded.filter((entry) => entry.artifact.format === format);
    if (submitted.length > 0) continue;
    findings.push({
      kind: "no-graded-artifact",
      subject: format,
      format,
      seed: null,
      severity: null,
      detail:
        `the coverage declaration marks ${format} as independently graded, but the declared ` +
        "corpus yielded no artifact for it, so nothing was graded. A gate that graded nothing " +
        "can never report a pass.",
    });
  }

  const coverageEstablished = [...cleanFormats].filter((f) => !spoiltFormats.has(f)).sort();

  return {
    passed: findings.length === 0,
    findings,
    outcomes,
    coverageEstablished,
  };
}
