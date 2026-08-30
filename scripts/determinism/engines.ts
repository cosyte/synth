/**
 * scripts/determinism/engines.ts
 *
 * THE DECLARED SUPPORTED-ENGINE SET, AND THE TWO RECONCILIATIONS THAT KEEP IT HONEST.
 *
 * "Each supported Node major" names no set on its own, and the set cannot be read off any single
 * file in this repository:
 *
 *   * `package.json` declares `"engines": { "node": ">=22.0.0" }`. That is OPEN-ENDED. It fixes a
 *     floor and names no ceiling and no member list, so it can say which majors are ALLOWED and
 *     never which are CHECKED.
 *   * `.github/workflows/ci.yml` delegates the universal gates to a shared pipeline whose Node
 *     matrix lives in ANOTHER REPOSITORY. Nothing here may edit it, and a gate that depended on it
 *     would be a gate this repository cannot keep true.
 *
 * So the set is DECLARED, in `determinism-policy.json`, and this file is the pair of
 * reconciliations that stop the declaration drifting away from the two facts that constrain it:
 *
 *   (1) AGAINST THE PUBLISHED RANGE. Every declared major must satisfy `engines.node`; the MINIMUM
 *       major that range permits must be in the set (otherwise the floor the package publishes is
 *       the one major nothing checks); and the set must hold at least two distinct majors, because
 *       a "cross-engine" comparison over one engine compares nothing while looking like it passed.
 *   (2) AGAINST THE JOBS CI ACTUALLY RUNS. A declaration listing 22 and 24 while the workflow runs
 *       the digest on 22 alone is the exact silent hole this gate exists to close, and it is not
 *       hypothetical: it is one line of YAML. So the workflow is read, the per-engine digest jobs
 *       are extracted from it by name, and the two sets must be equal. The comparison job is
 *       checked the same way: it must NEED every digest job and it must actually CONSUME every
 *       one's report, since a job that runs and is then ignored is a job that proves nothing.
 *
 * NEITHER RECONCILIATION IS ALLOWED TO SKIP. A workflow that cannot be read, a job whose shape is
 * not understood and a range this file cannot parse are all reported as failures. A subject that
 * cannot be derived is not a subject that is absent.
 *
 * THE RANGE PARSER IS DELIBERATELY NARROW AND REFUSES WHAT IT DOES NOT UNDERSTAND. It accepts
 * space-separated `>=`, `>`, `<=` and `<` comparators over full `X.Y.Z` versions, which is what
 * this package publishes and what the shared standard uses. `||`, `^`, `~`, `*`, `x` and hyphen
 * ranges are REFUSED rather than approximated: a range read wrongly in the permissive direction
 * would silently bless a major the package does not support, and no semver dependency is available
 * here (this package's runtime dependency count is zero and that is a standing rule).
 */

import { readFileSync } from "node:fs";

import { engineId } from "./report.js";

/** A parsed version, as the three whole numbers a comparator compares. */
type Version = readonly [number, number, number];

/** One end of the interval a range permits. */
interface Bound {
  readonly version: Version;
  readonly inclusive: boolean;
}

/** The interval a range permits, as a lower bound and an optional upper bound. */
interface RangeInterval {
  readonly lower: Bound;
  readonly upper: Bound | undefined;
}

/** The largest number a version part is compared against. Versions are unbounded above in practice. */
const PART_MAX = Number.MAX_SAFE_INTEGER;

/** The highest major this file will consider when asking which majors a range permits. */
const MAJOR_SCAN_LIMIT = 200;

/** Lexicographic comparison of two versions. */
function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

/** The next version above this one, in the discrete space of whole-number triples. */
const successor = (v: Version): Version => [v[0], v[1], v[2] + 1];

/** The version immediately below this one, or `undefined` when there is none. */
function predecessor(v: Version): Version | undefined {
  if (v[2] > 0) return [v[0], v[1], v[2] - 1];
  if (v[1] > 0) return [v[0], v[1] - 1, PART_MAX];
  if (v[0] > 0) return [v[0] - 1, PART_MAX, PART_MAX];
  return undefined;
}

/**
 * Parse an `engines.node` range into the single interval it permits.
 *
 * @param range - The range, as `package.json` spells it.
 * @returns The permitted interval.
 * @throws Error when the range uses syntax this file refuses to approximate.
 * @example
 * ```ts
 * parseEngineRange(">=22.0.0").lower.version; // [22, 0, 0]
 * ```
 */
export function parseEngineRange(range: string): RangeInterval {
  const text = range.trim();
  if (text.length === 0) throw new Error("the `engines.node` range is empty");
  if (text.includes("||") || text.includes(" - ")) {
    throw new Error(
      `the \`engines.node\` range "${range}" is a union or a hyphen range, which this ` +
        "reconciliation refuses to approximate. Reading a range wrongly in the permissive " +
        "direction would bless a major the package does not support.",
    );
  }

  let lower: Bound = { version: [0, 0, 0], inclusive: true };
  let upper: Bound | undefined;

  for (const token of text.split(/\s+/)) {
    const match = /^(>=|<=|>|<)(\d+)\.(\d+)\.(\d+)$/.exec(token);
    if (match === null) {
      throw new Error(
        `the \`engines.node\` range "${range}" contains "${token}", which is not a >=, >, <= or < ` +
          "comparator over a full X.Y.Z version. This reconciliation refuses what it does not " +
          "understand rather than guessing at it.",
      );
    }
    const operator = match[1] ?? "";
    const version: Version = [Number(match[2]), Number(match[3]), Number(match[4])];

    if (operator === ">=" || operator === ">") {
      const inclusive = operator === ">=";
      const order = compareVersions(version, lower.version);
      if (order > 0 || (order === 0 && !inclusive)) lower = { version, inclusive };
    } else {
      const inclusive = operator === "<=";
      if (upper === undefined) {
        upper = { version, inclusive };
      } else {
        const order = compareVersions(version, upper.version);
        if (order < 0 || (order === 0 && !inclusive)) upper = { version, inclusive };
      }
    }
  }

  return { lower, upper };
}

/**
 * Whether a range permits at least one version carrying this major.
 *
 * @param range - The `engines.node` range.
 * @param major - The Node major to ask about.
 * @returns True when some `major.x.y` satisfies the range.
 * @throws Error when the range cannot be parsed.
 * @example
 * ```ts
 * majorIsPermitted(">=22.0.0", 24); // true
 * majorIsPermitted(">=22.0.0", 20); // false
 * ```
 */
export function majorIsPermitted(range: string, major: number): boolean {
  const interval = parseEngineRange(range);

  // The lower end: the tighter of the range's own lower bound and this major's first version,
  // normalised to an inclusive bound so the two ends can simply be compared.
  const majorFloor: Version = [major, 0, 0];
  let low: Version =
    compareVersions(interval.lower.version, majorFloor) > 0 ? interval.lower.version : majorFloor;
  if (
    !interval.lower.inclusive &&
    compareVersions(interval.lower.version, majorFloor) >= 0 &&
    compareVersions(low, interval.lower.version) === 0
  ) {
    low = successor(low);
  }

  // The upper end: the tighter of the range's upper bound and this major's last version.
  const majorCeiling: Version = [major, PART_MAX, PART_MAX];
  let high: Version = majorCeiling;
  if (interval.upper !== undefined) {
    if (compareVersions(interval.upper.version, majorCeiling) < 0) high = interval.upper.version;
    if (!interval.upper.inclusive && compareVersions(high, interval.upper.version) === 0) {
      const below = predecessor(high);
      if (below === undefined) return false;
      high = below;
    }
  }

  return compareVersions(low, high) <= 0;
}

/**
 * The lowest Node major the range permits.
 *
 * @param range - The `engines.node` range.
 * @returns The minimum permitted major.
 * @throws Error when the range permits no major at all inside the scanned space.
 * @example
 * ```ts
 * minimumPermittedMajor(">=22.0.0"); // 22
 * ```
 */
export function minimumPermittedMajor(range: string): number {
  for (let major = 0; major <= MAJOR_SCAN_LIMIT; major += 1) {
    if (majorIsPermitted(range, major)) return major;
  }
  throw new Error(
    `the \`engines.node\` range "${range}" permits no Node major at or below ` +
      `${String(MAJOR_SCAN_LIMIT)}, so no supported-engine set can be reconciled against it.`,
  );
}

/**
 * Reconcile the declared engine set against the range the package publishes.
 *
 * @param declared - The declared Node majors.
 * @param engineRange - The `engines.node` range.
 * @returns Every problem found, empty when the declaration is sound.
 * @example
 * ```ts
 * reconcileDeclaredEngines([22, 24], ">=22.0.0"); // []
 * reconcileDeclaredEngines([24], ">=22.0.0").length; // 2: no minimum major, fewer than two
 * ```
 */
export function reconcileDeclaredEngines(
  declared: readonly number[],
  engineRange: string,
): readonly string[] {
  const problems: string[] = [];
  const unique = [...new Set(declared)].sort((a, b) => a - b);

  let minimum: number | undefined;
  try {
    minimum = minimumPermittedMajor(engineRange);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  for (const major of unique) {
    let permitted: boolean;
    try {
      permitted = majorIsPermitted(engineRange, major);
    } catch {
      continue; // the range itself is already reported above
    }
    if (!permitted) {
      problems.push(
        `the declared supported-engine set names Node ${String(major)}, which the package's ` +
          `\`engines.node\` range "${engineRange}" excludes. This gate verifies the promise the ` +
          "package already makes; it does not enlarge it.",
      );
    }
  }

  if (minimum !== undefined && !unique.includes(minimum)) {
    problems.push(
      `the declared supported-engine set omits Node ${String(minimum)}, the minimum major the ` +
        `package's \`engines.node\` range "${engineRange}" permits. The floor the package ` +
        "publishes cannot be the one engine nothing checks.",
    );
  }

  if (unique.length < 2) {
    problems.push(
      `the declared supported-engine set holds ${String(unique.length)} distinct major(s). A ` +
        "cross-engine comparison over fewer than two engines compares nothing while looking like " +
        "it passed.",
    );
  }

  return problems;
}

// ---------------------------------------------------------------------------
// THE WORKFLOW SIDE.

/** What the workflow says about the determinism gate. */
export interface WorkflowDeterminismJobs {
  /** Majors with a per-engine digest job. */
  readonly digestEngines: readonly number[];
  /** Majors the comparison job declares a dependency on. */
  readonly verifyNeeds: readonly number[];
  /** Majors whose report the comparison job actually reads and materialises. */
  readonly verifyConsumes: readonly number[];
  /** Shapes this reader did not understand. Each is a failure, never a skip. */
  readonly problems: readonly string[];
}

/**
 * Split the `jobs:` mapping of a workflow into one text block per job.
 *
 * Read as TEXT on purpose, in the same shape `test/oracle/ci-wiring.test.ts` reads this file: a
 * YAML parse would be a nicer object and a worse check, because what is being asserted is what a
 * reader and the runner both see. The scan starts at the `jobs:` line so the two-space keys under
 * `on:` (`push:`, `pull_request:`) are never mistaken for job names.
 */
function jobBlocks(text: string): Map<string, string> {
  const lines = text.split("\n");
  const jobsAt = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  const blocks = new Map<string, string>();
  if (jobsAt < 0) return blocks;

  const starts: { name: string; at: number }[] = [];
  for (let i = jobsAt + 1; i < lines.length; i += 1) {
    const name = /^ {2}([A-Za-z0-9_.-]+):\s*$/.exec(lines[i] ?? "")?.[1];
    if (name !== undefined) starts.push({ name, at: i });
  }
  for (const [index, start] of starts.entries()) {
    const end = starts[index + 1]?.at ?? lines.length;
    blocks.set(start.name, lines.slice(start.at, end).join("\n"));
  }
  return blocks;
}

/** The name of the job that compares the per-engine reports. */
const VERIFY_JOB = "determinism-verify";

/** Every major named by a per-engine digest job, and what the comparison job does with them. */
export function readWorkflowDeterminismJobs(text: string): WorkflowDeterminismJobs {
  const problems: string[] = [];
  const blocks = jobBlocks(text);
  if (blocks.size === 0) {
    return {
      digestEngines: [],
      verifyNeeds: [],
      verifyConsumes: [],
      problems: [
        "the workflow declares no `jobs:` mapping this reader could split, so the engines CI runs " +
          "the digest step on cannot be derived. Refusing rather than reporting an empty set: an " +
          "underivable subject is not an absent one.",
      ],
    };
  }

  const digestEngines: number[] = [];
  for (const [name, block] of blocks) {
    const major = /^determinism-digest-(\d+)$/.exec(name)?.[1];
    if (major === undefined) continue;
    const engine = Number(major);
    digestEngines.push(engine);

    if (!new RegExp(`node-version:\\s*"${major}"`).test(block)) {
      problems.push(
        `job \`${name}\` does not pin \`node-version: "${major}"\`, so the engine it runs the ` +
          "digest on is not the engine its name claims.",
      );
    }
    if (!block.includes("pnpm run determinism:digest")) {
      problems.push(`job \`${name}\` does not run \`pnpm run determinism:digest\``);
    }
    if (!/^\s*report:\s/m.test(block)) {
      problems.push(
        `job \`${name}\` exposes no \`report\` output, so its digest report cannot reach the ` +
          "comparison job and the job proves nothing.",
      );
    }
  }

  const verify = blocks.get(VERIFY_JOB);
  const verifyNeeds: number[] = [];
  const verifyConsumes: number[] = [];
  if (verify === undefined) {
    problems.push(
      `the workflow declares no \`${VERIFY_JOB}\` job, so nothing compares the per-engine digest ` +
        "reports. Per-engine jobs on their own are two runs that never meet.",
    );
  } else {
    if (!verify.includes("pnpm run determinism:verify")) {
      problems.push(`job \`${VERIFY_JOB}\` does not run \`pnpm run determinism:verify\``);
    }
    const needsLine = /^\s*needs:\s*(.*)$/m.exec(verify)?.[1] ?? "";
    for (const match of needsLine.matchAll(/determinism-digest-(\d+)/g)) {
      verifyNeeds.push(Number(match[1]));
    }
    for (const engine of digestEngines) {
      const referenced = verify.includes(
        `needs.determinism-digest-${String(engine)}.outputs.report`,
      );
      const materialised = verify.includes(`${engineId(engine)}.json`);
      if (referenced && materialised) verifyConsumes.push(engine);
    }
  }

  return {
    digestEngines: digestEngines.sort((a, b) => a - b),
    verifyNeeds: [...new Set(verifyNeeds)].sort((a, b) => a - b),
    verifyConsumes: verifyConsumes.sort((a, b) => a - b),
    problems,
  };
}

/** Render a set of majors for a diagnostic. */
const renderSet = (majors: readonly number[]): string =>
  majors.length === 0 ? "(none)" : majors.map((m) => String(m)).join(", ");

/**
 * Reconcile the declared engine set against the jobs the workflow actually runs.
 *
 * @param declared - The declared Node majors.
 * @param workflowText - The continuous-integration workflow, as text.
 * @returns Every problem found, empty when the declaration and the workflow agree.
 * @example
 * ```ts
 * reconcileWorkflowEngines([22, 24], readFileSync(CI_WORKFLOW_PATH, "utf8")); // []
 * ```
 */
export function reconcileWorkflowEngines(
  declared: readonly number[],
  workflowText: string,
): readonly string[] {
  const unique = [...new Set(declared)].sort((a, b) => a - b);
  const found = readWorkflowDeterminismJobs(workflowText);
  const problems = [...found.problems];

  const same = (a: readonly number[], b: readonly number[]): boolean =>
    a.length === b.length && a.every((value, index) => value === b[index]);

  if (!same(found.digestEngines, unique)) {
    problems.push(
      `the continuous-integration workflow runs the per-engine digest step on ` +
        `[${renderSet(found.digestEngines)}] while the declared supported-engine set is ` +
        `[${renderSet(unique)}]. The declaration and the jobs cannot drift apart: an engine that ` +
        "is declared and never run is a promise nothing checks, and one that is run and never " +
        "declared is a comparison nobody asked for.",
    );
  }
  if (!same(found.verifyNeeds, unique)) {
    problems.push(
      `the comparison job depends on [${renderSet(found.verifyNeeds)}] while the declared ` +
        `supported-engine set is [${renderSet(unique)}], so it can complete without one of the ` +
        "declared engines having run at all.",
    );
  }
  if (!same(found.verifyConsumes, unique)) {
    problems.push(
      `the comparison job reads a digest report for [${renderSet(found.verifyConsumes)}] while ` +
        `the declared supported-engine set is [${renderSet(unique)}]. A per-engine job whose ` +
        "report is never read is a job that proves nothing.",
    );
  }

  return problems;
}

/**
 * Read the continuous-integration workflow from disk.
 *
 * @param path - The workflow file.
 * @returns Its text.
 * @throws Error when it cannot be read.
 * @example
 * ```ts
 * readWorkflow(CI_WORKFLOW_PATH).includes("determinism-verify"); // true
 * ```
 */
export function readWorkflow(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${path} could not be read, so the engines CI runs the digest step on cannot be reconciled ` +
        `against the declaration: ${message}`,
      { cause: error },
    );
  }
}
