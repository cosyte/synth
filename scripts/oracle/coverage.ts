/**
 * scripts/oracle/coverage.ts
 *
 * THE COVERAGE DECLARATION: WHAT CARRIES AN INDEPENDENT VERDICT AND WHAT DOES NOT.
 *
 * The whole point of the oracle is that a consumer can point at somebody other than us. That is only
 * honest if the run also says, in the same breath, which formats it did NOT ask anybody about. So
 * every run publishes a declaration naming EVERY format the library generates and marking each one
 * either independently graded, with the grader named, or ungraded, with a reason.
 *
 * THE SUBJECT IS DERIVED, THE POLICY IS DECLARED, AND THE TWO ARE RECONCILED HERE.
 *
 *   * The SUBJECT (which formats exist) comes from `formats.ts`, which asks the library's own
 *     generators. It cannot be edited to make this declaration look complete.
 *   * The POLICY (graded by whom, or ungraded for what reason) is a committed JSON file, because a
 *     reason is a human judgement and belongs in review.
 *   * A format in the subject with no policy entry FAILS THE RUN. That is the rule that stops a
 *     seventh format shipping with nobody having said whether anything grades it.
 *   * A policy entry for a format the library does not generate ALSO fails the run. Drift in that
 *     direction is a declaration promising a verdict on something that does not exist.
 *
 * AN EXCLUSION IS A DECLARED ABSENCE, NEVER A SUPPRESSION. When an artifact is taken out of the
 * graded corpus, this declaration names the artifact and the reason, and the gate does not count it
 * toward the pass. There is no field anywhere in this file through which an exclusion could reduce
 * the severity of a validator finding, and there is no code path that reads one: an exclusion keys on
 * corpus membership only. `gate.ts` refuses outright when an exclusion names an artifact that was
 * graded anyway, which is the only shape in which the suppression reading could arise.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "./formats.js";
import type { ExcludedArtifact } from "./gate.js";

/** Where the committed policy lives. */
export const COVERAGE_POLICY_PATH = join(REPO_ROOT, "scripts", "oracle", "coverage-policy.json");

/** The committed judgement for one format. */
export type CoveragePolicyEntry =
  | { readonly graded: true; readonly grader: string; readonly gradedAgainst: string }
  | { readonly graded: false; readonly reason: string };

/** The committed policy: one entry per format, keyed by the label the library uses. */
export type CoveragePolicy = Readonly<Record<string, CoveragePolicyEntry>>;

/** One line of the published declaration. */
export interface CoverageEntry {
  /** The format label the library itself uses. */
  readonly format: string;
  /** Whether an independent, external grader passed a verdict on it in this run. */
  readonly independentlyGraded: boolean;
  /** The grader, when there is one. Empty for an ungraded format. */
  readonly grader: string;
  /** What it was graded against, when there is a grader. Empty otherwise. */
  readonly gradedAgainst: string;
  /** Why it is ungraded. Empty for a graded format. */
  readonly ungradedReason: string;
}

/** One artifact named as taken out of the graded corpus, and why. */
export interface CoverageExclusion {
  /** The artifact id. */
  readonly artifactId: string;
  /** Its format. */
  readonly format: string;
  /** Its generator kind. */
  readonly kind: string;
  /** Its generating seed, so the excluded artifact is reproducible too. */
  readonly seed: number;
  /** Why it was excluded. Never a statement about a finding's severity. */
  readonly reason: string;
}

/** The published declaration. */
export interface CoverageDeclaration {
  /** Every format the library generates, in sorted order, each marked. */
  readonly formats: readonly CoverageEntry[];
  /** Every artifact declared and then excluded from grading. */
  readonly exclusions: readonly CoverageExclusion[];
}

/** A declaration that could be built, or the reasons it could not. */
export type CoverageResult =
  | { readonly ok: true; readonly declaration: CoverageDeclaration }
  | { readonly ok: false; readonly errors: readonly string[] };

/** True for a plain JSON object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A non-empty string, or `undefined`. */
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

/**
 * Read and narrow the committed coverage policy.
 *
 * @param path - The policy file. Defaults to the committed one.
 * @returns The policy, keyed by format label.
 * @throws Error when the file is missing, unparseable, or an entry is neither a graded nor an
 *   ungraded declaration. A policy that cannot be read is never treated as an empty policy.
 * @example
 * ```ts
 * const policy = readCoveragePolicy();
 * policy["fhir"]?.graded; // true
 * ```
 */
export function readCoveragePolicy(path: string = COVERAGE_POLICY_PATH): CoveragePolicy {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(parsed) || !isRecord(parsed["formats"])) {
    throw new Error(`${path} has no \`formats\` object, so no coverage judgement can be read`);
  }
  const out: Record<string, CoveragePolicyEntry> = {};
  for (const [format, entry] of Object.entries(parsed["formats"])) {
    if (!isRecord(entry)) throw new Error(`${path}: formats["${format}"] is not an object`);
    if (entry["graded"] === true) {
      const grader = text(entry["grader"]);
      const gradedAgainst = text(entry["gradedAgainst"]);
      if (grader === undefined || gradedAgainst === undefined) {
        throw new Error(
          `${path}: formats["${format}"] claims an independent verdict but does not name the ` +
            "grader and what it graded against. An unattributed verdict is not one.",
        );
      }
      out[format] = { graded: true, grader, gradedAgainst };
      continue;
    }
    if (entry["graded"] === false) {
      const reason = text(entry["reason"]);
      if (reason === undefined) {
        throw new Error(
          `${path}: formats["${format}"] is marked ungraded with no reason. "Ungraded" with no ` +
            "reason is the silence this declaration exists to break.",
        );
      }
      out[format] = { graded: false, reason };
      continue;
    }
    throw new Error(
      `${path}: formats["${format}"] is neither graded:true nor graded:false, so it declares ` +
        "nothing. Refusing rather than reading the absence as either.",
    );
  }
  return out;
}

/**
 * Build the published coverage declaration, reconciling the derived format set against the policy.
 *
 * @param generated - Every format the library generates, derived from its own generators.
 * @param policy - The committed per-format judgement.
 * @param excluded - Artifacts declared and then taken out of the graded corpus.
 * @returns The declaration, or every reason it could not be built.
 * @example
 * ```ts
 * const result = buildCoverageDeclaration(["fhir"], { fhir: { graded: false, reason: "x" } }, []);
 * result.ok; // true
 * ```
 */
export function buildCoverageDeclaration(
  generated: readonly string[],
  policy: CoveragePolicy,
  excluded: readonly ExcludedArtifact[],
): CoverageResult {
  const errors: string[] = [];

  for (const format of generated) {
    if (policy[format] === undefined) {
      errors.push(
        `the library generates "${format}" and the coverage declaration does not name it. Every ` +
          "generated format must be marked either independently graded, with the grader named, or " +
          "ungraded, with a reason. Add it to scripts/oracle/coverage-policy.json.",
      );
    }
  }

  const generatedSet = new Set(generated);
  for (const format of Object.keys(policy)) {
    if (generatedSet.has(format)) continue;
    errors.push(
      `the coverage declaration names "${format}", which this library does not generate. A ` +
        "declaration that speaks for a format nothing emits is drift in the other direction, and " +
        "it is refused for the same reason a missing one is.",
    );
  }

  for (const exclusion of excluded) {
    if (exclusion.reason.trim().length === 0) {
      errors.push(
        `${exclusion.artifact.id} is excluded from the graded corpus with no reason. An exclusion ` +
          "is named and reasoned in the open or it is not made.",
      );
    }
    if (!generatedSet.has(exclusion.artifact.format)) {
      errors.push(
        `${exclusion.artifact.id} is excluded but its format "${exclusion.artifact.format}" is ` +
          "not one this library generates, so the exclusion names nothing.",
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const formats = [...generated].sort().map((format): CoverageEntry => {
    const entry = policy[format];
    if (entry === undefined || !entry.graded) {
      return {
        format,
        independentlyGraded: false,
        grader: "",
        gradedAgainst: "",
        ungradedReason: entry === undefined ? "" : entry.reason,
      };
    }
    return {
      format,
      independentlyGraded: true,
      grader: entry.grader,
      gradedAgainst: entry.gradedAgainst,
      ungradedReason: "",
    };
  });

  const exclusions = excluded.map(
    (item): CoverageExclusion => ({
      artifactId: item.artifact.id,
      format: item.artifact.format,
      kind: item.artifact.kind,
      seed: item.artifact.seed,
      reason: item.reason,
    }),
  );

  return { ok: true, declaration: { formats, exclusions } };
}

/** The formats a declaration claims an independent verdict for. */
export const independentlyGradedFormats = (declaration: CoverageDeclaration): readonly string[] =>
  declaration.formats.filter((entry) => entry.independentlyGraded).map((entry) => entry.format);
