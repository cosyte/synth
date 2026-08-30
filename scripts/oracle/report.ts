/**
 * scripts/oracle/report.ts
 *
 * READING AN EXTERNAL VALIDATOR'S REPORT, AND REFUSING TO GUESS.
 *
 * The oracle gate exists because every "spec-clean" claim this package makes today is
 * `artifact.warnings === []` where the artifact was built by the same library that reads it back. A
 * shared misreading of a standard is invisible to that check. The oracle asks an independent,
 * HL7-maintained validator instead, and THIS file is the one place its answer is turned into data.
 *
 * IT IS A PURE FUNCTION OVER TEXT. No network, no JRE, no filesystem. That is deliberate and it is
 * what makes every decision the gate takes testable offline, over reports committed as fixtures, in
 * an environment that can never run the external tool. See `test/oracle/gate-decision.test.ts`.
 *
 * THE FAIL-CLOSED DIRECTION IS THE WHOLE POINT. A report this file cannot read is NOT zero errors.
 * Every refusal below returns a reason naming what could not be read, and the gate turns a refusal
 * into a failed run, never into a pass and never into a warning. The routes that were considered and
 * deliberately closed:
 *
 *   * NOT JSON, or truncated mid-document. `JSON.parse` throws; the throw is the answer.
 *   * A JSON document that is not an object, or an array at the top level.
 *   * A resource that is not an `OperationOutcome`. The validator can be asked for other shapes and
 *     a future flag change could silently hand back one; grading against a shape this file does not
 *     understand would report a clean run over a document it never read.
 *   * `issue` absent, or not an array.
 *   * `issue` present and EMPTY. A FHIR `OperationOutcome` carries `issue` 1..*, so an empty array
 *     is not a clean report, it is an incomplete one. Treating it as zero errors is exactly the
 *     "unreadable report read as clean" the gate forbids.
 *   * An issue whose `severity` is absent, or is a string outside the value set. An unknown severity
 *     cannot be classified, and classifying it as anything but a refusal is a severity downgrade
 *     arriving through a typo.
 *
 * WHAT IS DELIBERATELY TOLERATED: unknown members anywhere. A validator release that adds a field is
 * not a report this file failed to read, and refusing on one would make the gate brittle in the
 * direction that gets it disabled rather than the direction that keeps it honest.
 */

/**
 * The FHIR `issue-severity` value set, spelled exactly as a report spells it.
 *
 * `success` is R5's addition and is accepted so an R5-shaped report is readable; it is not a
 * blocking severity. Nothing outside this set is classified: see `parseValidatorReport`.
 */
export const ISSUE_SEVERITIES = Object.freeze([
  "fatal",
  "error",
  "warning",
  "information",
  "success",
] as const);

/** One severity a validator issue may carry. */
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

/**
 * The severities that fail the gate.
 *
 * THIS IS THE ONE PLACE THE FAIL RULE IS SPELLED, and it has no configuration, no threshold and no
 * suppression list. Widening it is a code change in a reviewed commit; narrowing it is the thing the
 * spec forbids outright.
 */
export const BLOCKING_SEVERITIES: readonly IssueSeverity[] = Object.freeze(["fatal", "error"]);

/** True when a severity fails the gate. */
export const isBlocking = (severity: IssueSeverity): boolean =>
  BLOCKING_SEVERITIES.includes(severity);

/** One issue read out of a validator report, carrying its severity VERBATIM. */
export interface ValidatorIssue {
  /** The severity the report gave, unchanged. */
  readonly severity: IssueSeverity;
  /** The issue type code, when the report carried one. */
  readonly code: string;
  /** The human-readable text: `details.text` when present, else `diagnostics`. */
  readonly detail: string;
  /** Where in the resource the issue was found, as the report expressed it. */
  readonly location: readonly string[];
}

/** A report that was read, or the reason it could not be. */
export type ParsedReport =
  | { readonly ok: true; readonly issues: readonly ValidatorIssue[] }
  | { readonly ok: false; readonly reason: string };

/** A refusal, spelled once so every route reads the same way. */
const unreadable = (reason: string): ParsedReport => ({ ok: false, reason });

/** True for a plain JSON object (not null, not an array). */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A severity string, narrowed against the closed set. Anything else is unclassifiable. */
function toSeverity(value: unknown): IssueSeverity | undefined {
  if (typeof value !== "string") return undefined;
  return ISSUE_SEVERITIES.find((s) => s === value);
}

/** The first string in a JSON array of strings, ignoring anything that is not a string. */
const stringsOf = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** `details.text`, `diagnostics`, or an empty string. Never throws on an odd shape. */
function detailOf(issue: Record<string, unknown>): string {
  const details = issue["details"];
  if (isRecord(details) && typeof details["text"] === "string") return details["text"];
  if (typeof issue["diagnostics"] === "string") return issue["diagnostics"];
  return "";
}

/**
 * Read one external validator report.
 *
 * @param raw - The report text exactly as the validator wrote it.
 * @returns The issues it carries, or a refusal naming what could not be read.
 * @example
 * ```ts
 * const parsed = parseValidatorReport('{"resourceType":"OperationOutcome","issue":[]}');
 * parsed.ok; // false: an OperationOutcome with no issue is not a clean report
 * ```
 */
export function parseValidatorReport(raw: string): ParsedReport {
  if (raw.trim().length === 0) {
    return unreadable("the report is empty, so nothing was graded and nothing can be concluded");
  }

  let document: unknown;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return unreadable(
      `the report is not readable JSON (truncated or corrupt): ${message}. An unreadable report ` +
        "is not zero errors.",
    );
  }

  if (!isRecord(document)) {
    return unreadable(
      "the report's top level is not a JSON object, so it is not an OperationOutcome. Refusing to " +
        "read a shape this gate does not understand as a clean result.",
    );
  }

  const resourceType = document["resourceType"];
  if (resourceType !== "OperationOutcome") {
    const seen = typeof resourceType === "string" ? `"${resourceType}"` : "nothing at all";
    return unreadable(
      `the report declares resourceType ${seen} rather than "OperationOutcome", so this gate ` +
        "cannot tell what it is looking at.",
    );
  }

  const issueList = document["issue"];
  if (!Array.isArray(issueList)) {
    return unreadable(
      "the OperationOutcome carries no `issue` array. A report whose findings are missing is " +
        "unreadable, not clean.",
    );
  }
  if (issueList.length === 0) {
    return unreadable(
      "the OperationOutcome carries an EMPTY `issue` array. FHIR requires issue 1..*, so an empty " +
        "one is an incomplete report rather than a clean verdict, and reading it as zero errors " +
        "is exactly the failure this rule exists to prevent.",
    );
  }

  const issues: ValidatorIssue[] = [];
  for (const [index, entry] of issueList.entries()) {
    if (!isRecord(entry)) {
      return unreadable(`issue[${String(index)}] is not a JSON object, so it cannot be classified`);
    }
    const severity = toSeverity(entry["severity"]);
    if (severity === undefined) {
      const seen = typeof entry["severity"] === "string" ? `"${entry["severity"]}"` : "absent";
      return unreadable(
        `issue[${String(index)}] has severity ${seen}, which is outside the FHIR issue-severity ` +
          `value set [${ISSUE_SEVERITIES.join(", ")}]. An unclassifiable severity is refused ` +
          "rather than assumed harmless.",
      );
    }
    issues.push({
      severity,
      code: typeof entry["code"] === "string" ? entry["code"] : "",
      detail: detailOf(entry),
      location: [...stringsOf(entry["expression"]), ...stringsOf(entry["location"])],
    });
  }

  return { ok: true, issues };
}
