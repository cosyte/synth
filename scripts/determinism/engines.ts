/**
 * scripts/determinism/engines.ts
 *
 * THE DECLARED SUPPORTED-ENGINE SET, AND THE FOUR RECONCILIATIONS THAT KEEP IT HONEST.
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
 * So the set is DECLARED, in `determinism-policy.json`, and this file is the set of
 * reconciliations that stop the declaration drifting away from the facts that constrain it:
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
 *   (3) AGAINST CONDITIONAL EXECUTION, because "a job that EXISTS" and "a job that RUNS" are not
 *       the same claim and (2) on its own only ever asked the first. `if: false` on a digest job,
 *       or on the digest STEP inside a job that still starts, leaves the declaration intact, the
 *       job named, the version pinned, the `report` output wired and the `needs:` list satisfied,
 *       and the engine is never digested. A `needs:` on a skipped job SKIPS the dependent, and
 *       GitHub reports a skipped job as SUCCESS for a required status check, so the whole gate goes
 *       off AND GREEN. THE NON-MALICIOUS ROUTE IS THE ONE THAT MATTERS: `if: github.event_name !=
 *       'pull_request'` on the Node 24 job, added in good faith to save CI minutes, turns this gate
 *       off on every pull request and reds nothing. That is drift, which is precisely what this
 *       file exists to catch. So NO `if:` IS PERMITTED ANYWHERE INSIDE A DETERMINISM JOB, at job
 *       level or step level, and the same rule covers the comparison job, whose absence from a run
 *       means two engines never meet. It is an allow-list of nothing rather than a list of
 *       forbidden expressions: enumerating the expressions that switch a job off is unbounded, and
 *       this repository has already paid for a deny-list of argument spellings once
 *       (`scripts/attw.mjs`). The workflow's own TRIGGERS are read for the same reason: deleting
 *       `pull_request:` and writing `if: github.event_name != 'pull_request'` have the identical
 *       effect, and closing one route while leaving its twin open would be a check that only
 *       catches the spelling it was written against.
 *   (4) AGAINST THE JOB GRAPH, because rule (3) reads ONE job block at a time and a job does not
 *       have to carry its own `if:` to skip. `needs:` a job that is itself switched off and the
 *       dependent skips too, reported as SUCCESS, with the declaration, the job name, the pinned
 *       version, the `report` output, the `needs:` list and the report reference ALL INTACT. THE
 *       RULE AS WRITTEN MAKES THAT THE COMPLIANT-LOOKING ROUTE: an editor told "no `if:` on these
 *       jobs" who still wants to save CI minutes puts the `if:` on a NEW job and writes a `needs:`,
 *       which is the mainstream idiom for gating expensive jobs behind change detection. So every
 *       job a determinism job reaches through `needs:`, TRANSITIVELY, must itself be guaranteed to
 *       run: no `if:`, no `strategy:`, and it has to be a job this reader can find at all. Reading
 *       the graph is bounded because the edges and their targets are in the same file. THE RULE ON
 *       A REACHED JOB IS THE SAME BLANKET ONE, ANY `if:` AT ANY LEVEL, WHICH IS DELIBERATELY WIDER
 *       THAN THE MECHANISM AND IS SAID HERE RATHER THAN DISCOVERED: a STEP-level `if:` in a reached
 *       job does not on its own skip that job, so this can refuse an edge that would in fact have
 *       been safe. Narrowing it would mean teaching this reader which indent is a job key and which
 *       is a step key, which is the kind of precision that becomes the next hole, and no
 *       determinism job depends on a foreign job today, so the cost is currently zero.
 *
 * NO RECONCILIATION IS ALLOWED TO SKIP. A workflow that cannot be read, a job whose shape is
 * not understood and a range this file cannot parse are all reported as failures. A subject that
 * cannot be derived is not a subject that is absent. `strategy:` on a determinism job is refused on
 * exactly that ground: a matrix decides how many times a job runs and on what, so the job's name
 * and its pinned `node-version` stop being the answer to the question this file asks. A YAML FLOW
 * MAPPING inside a determinism job is refused on the same ground and it is the same lesson learned
 * twice: every rule here reads the file LINE BY LINE, a key written inside `{ }` is not at the head
 * of a line, and a runner reads `- { if: false, run: ... }` exactly as it reads the block spelling.
 * A reader that understands one of two spellings a runner treats alike is a reader that can be
 * edited around, so the spelling it cannot read is refused rather than passed over.
 *
 * WHAT THIS READER CANNOT SEE, STATED RATHER THAN IMPLIED. This is a TEXT SCAN over one file, and
 * "actually runs" is a property of a run, not of a file. It CAN see the routes above. It CANNOT
 * see: a required-status-check ruleset that stopped requiring these contexts (nothing inside this
 * repository can observe its own ruleset, and the same sentence is already in CLAUDE.md for the
 * same reason); a `runs-on:` label no runner ever answers, which leaves a job queued rather than
 * red; an organisation or repository setting that disables Actions entirely; a re-usable workflow
 * or composite action reached from here whose own contents are elsewhere; or a `pnpm run
 * determinism:digest` whose SCRIPT was redefined in `package.json` to do nothing. The last of those
 * is what `test/determinism/` and `pnpm check:test-selection` are for.
 *
 * AND IT IS A LINE READER, WHICH IS A LIMIT OF ITS OWN AND NOT AN ITEM ON THAT LIST. Two YAML
 * spellings a runner treats alike were invisible to it before they were found: a flow-mapping step
 * and a `paths:` filter added under a trigger whose `branches:` was left in place. Both are refused
 * now, and the honest statement is the general one rather than a longer list. THE CLAIM THIS FILE
 * MAKES IS BOUNDED: every route below is closed and each is exercised in
 * `test/determinism/engine-set.test.ts`, and a shape this reader does not understand is refused
 * rather than approved. IT IS NOT "the workflow file cannot be edited into a false green": that
 * sentence stood here, and a refuter answered it with a route it did not cover. A gate that reds
 * correctly and then explains itself with a falsehood teaches the next reader the wrong story, so
 * when the next route turns up, WEAKEN THIS SENTENCE OR CLOSE THE ROUTE, and never quietly widen
 * what the sentence claims. Read it as "these routes are closed and an unreadable shape is
 * refused", never as "the digest definitely ran".
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
  /**
   * Majors whose per-engine digest job the workflow runs UNCONDITIONALLY. This is the set the
   * criterion is about: a job that exists and is switched off does not run the digest step.
   */
  readonly digestEngines: readonly number[];
  /** Majors with a per-engine digest job at all, whether or not its execution is conditional. */
  readonly digestJobs: readonly number[];
  /** Majors the comparison job declares a dependency on. */
  readonly verifyNeeds: readonly number[];
  /** Majors whose report the comparison job actually reads and materialises. */
  readonly verifyConsumes: readonly number[];
  /**
   * Determinism jobs that are not guaranteed to execute: their own `if:`, a conditional step, or a
   * `needs:` reaching a job that can itself skip. Named for the diagnostic.
   */
  readonly conditionalJobs: readonly string[];
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

/**
 * The lines of a block that YAML reads as STRUCTURE, with every block-scalar body dropped.
 *
 * A `run: |` body is text, not YAML, and the workflow this reads has shell in it. Scanning those
 * lines for keys would read a shell line as a workflow key and would make the checks below depend
 * on the contents of a script. A block scalar's body is every following line indented deeper than
 * the key that introduced it, plus the blank lines inside it, so it ends where the indentation
 * comes back. Nothing here guesses at indentation: it only compares one line's against another's.
 */
function structuralLines(block: string): readonly string[] {
  const kept: string[] = [];
  let scalarIndent: number | undefined;
  for (const line of block.split("\n")) {
    const indent = line.length - line.trimStart().length;
    if (scalarIndent !== undefined) {
      if (line.trim().length === 0 || indent > scalarIndent) continue;
      scalarIndent = undefined;
    }
    kept.push(line);
    if (/:\s*[|>][+-]?\d*\s*$/.test(line)) scalarIndent = indent;
  }
  return kept;
}

/**
 * A line declaring an `if:` key, at job level, as a step key, or as the first key of a step.
 *
 * Both quoted spellings are matched because YAML accepts them and a runner reads them identically;
 * a check keyed on one spelling is a check that teaches the next reader the wrong story.
 */
const IF_KEY = /^(?:-\s+)?(?:if|"if"|'if')\s*:/;

/** Every conditional-execution declaration inside one job block, as written. */
function conditionsIn(block: string): readonly string[] {
  return structuralLines(block)
    .map((line) => line.trim())
    .filter((line) => IF_KEY.test(line));
}

/** A `strategy:` key, which makes "how many times, and on what" unanswerable from the job name. */
const STRATEGY_KEY = /^(?:strategy|"strategy"|'strategy')\s*:/;

/** Whether a job block declares a `strategy:`, which this reader refuses rather than approximates. */
const declaresStrategy = (block: string): boolean =>
  structuralLines(block).some((line) => STRATEGY_KEY.test(line.trim()));

/** Strip the surrounding quotes YAML allows around a scalar, so one name has one spelling. */
const unquote = (text: string): string => text.trim().replace(/^(["'])([\s\S]*)\1$/, "$2");

/** A GitHub expression. Its braces are the workflow language's, not YAML flow syntax. */
const EXPRESSION = /\$\{\{[\s\S]*?\}\}/g;

/** A shell parameter expansion, masked for the same reason on a single-line `run:`. */
const SHELL_EXPANSION = /\$\{[^{}]*\}/g;

/**
 * Every structural line of a job block that carries YAML FLOW syntax, as written.
 *
 * Everything in this file reads the workflow line by line, so a key written inside `{ }` is not at
 * the head of a line and no rule here sees it, while a runner reads `- { if: false, run: ... }`
 * exactly as it reads the four block spellings the `if:` rule covers. The two brace languages that
 * legitimately appear in this file, `${{ github.ref }}` and a shell `${VAR}`, are masked first, so
 * what is left is YAML's own.
 */
function flowSyntaxIn(block: string): readonly string[] {
  return structuralLines(block)
    .filter((line) => line.replace(EXPRESSION, "").replace(SHELL_EXPANSION, "").includes("{"))
    .map((line) => line.trim());
}

/** The scalars an inline value lists, in the flow-sequence and the plain-scalar spellings. */
function scalarsInValue(value: string): readonly string[] {
  const inline = value.trim();
  if (inline.startsWith("[")) {
    const close = inline.lastIndexOf("]");
    const body = close < 0 ? inline.slice(1) : inline.slice(1, close);
    return body
      .split(",")
      .map((name) => unquote(name))
      .filter((name) => name.length > 0);
  }
  const scalar = unquote(inline.split("#")[0] ?? "");
  return scalar.length === 0 ? [] : [scalar];
}

/**
 * The scalars one `key:` declares, whichever of YAML's three sequence spellings it uses.
 *
 * The lesson of the flow mapping again, and the reason this is shared rather than written twice:
 * `[main]`, `main` and a nested `- main` are one thing to a runner, so a reader that understands
 * one of them is wrong in one direction (a hole) or the other (a refusal nobody keeps).
 *
 * @param lines - The block being read, already stripped of block-scalar bodies.
 * @param at - The index of the `key:` line.
 * @param indent - That line's indent; the nested form ends where the indent comes back to it.
 * @param inline - Whatever followed the colon on that line.
 */
function scalarSequence(
  lines: readonly string[],
  at: number,
  indent: number,
  inline: string,
): readonly string[] {
  if (inline.length > 0) return scalarsInValue(inline);
  const items: string[] = [];
  for (let i = at + 1; i < lines.length; i += 1) {
    const next = lines[i] ?? "";
    if (next.trim().length === 0) continue;
    if (next.length - next.trimStart().length <= indent) break;
    const item = /^-\s*(.+)$/.exec(next.trim())?.[1];
    if (item !== undefined) items.push(unquote(item.split("#")[0] ?? ""));
  }
  return items.filter((item) => item.length > 0);
}

/**
 * Every job one job block declares a `needs:` on, whatever spelling it uses.
 *
 * A name this cannot read is a name that matches no job, which is reported as an unfindable
 * dependency rather than dropped: the failure direction of a misparse here is a REFUSAL.
 */
function declaredNeeds(block: string): readonly string[] {
  const lines = structuralLines(block);
  const names: string[] = [];
  for (const [index, line] of lines.entries()) {
    const match = /^(\s*)(?:needs|"needs"|'needs')\s*:\s*(.*)$/.exec(line);
    if (match === null) continue;
    names.push(...scalarSequence(lines, index, (match[1] ?? "").length, (match[2] ?? "").trim()));
  }
  return names;
}

/** Why a job this gate depends on might not run, or `undefined` when its execution is guaranteed. */
function whyNotGuaranteed(block: string | undefined): string | undefined {
  if (block === undefined) {
    return (
      "which this reader cannot find as a job block in this workflow, so whether that dependency " +
      "runs cannot be derived. Refusing rather than assuming it does: an underivable subject is " +
      "not an absent one"
    );
  }
  const conditions = conditionsIn(block);
  if (conditions.length > 0) {
    return `which is CONDITIONAL (${conditions.map((c) => `\`${c}\``).join(", ")})`;
  }
  if (declaresStrategy(block)) {
    return "which declares a `strategy:`, so how many times it runs, and whether that is zero times, is not answerable from this file";
  }
  return undefined;
}

/**
 * Walk the `needs:` graph out of one determinism job and report every dependency that could skip.
 *
 * Rule (3) reads one job block at a time, and a job does not have to carry its own `if:` to skip: a
 * `needs:` on a job that is switched off skips the dependent, GitHub reports a skipped job as
 * SUCCESS for a required status check, and the whole gate goes off AND GREEN with every line rule
 * (3) reads still intact. The edges and their targets are in this same file, so the closure is a
 * bounded thing to read.
 *
 * Determinism jobs reached on the way are walked THROUGH but not reported: each is already checked
 * on its own account, and reporting it twice would make one edit read as two defects.
 */
function dependencyProblems(
  job: string,
  blocks: ReadonlyMap<string, string>,
  determinismJobs: ReadonlySet<string>,
): readonly string[] {
  const problems: string[] = [];
  const seen = new Set<string>([job]);
  const queue = [...declaredNeeds(blocks.get(job) ?? "")];
  while (queue.length > 0) {
    const name = queue.shift() ?? "";
    if (seen.has(name)) continue;
    seen.add(name);
    const block = blocks.get(name);
    if (block !== undefined) queue.push(...declaredNeeds(block));
    if (determinismJobs.has(name)) continue;
    const why = whyNotGuaranteed(block);
    if (why === undefined) continue;
    problems.push(
      `job \`${job}\` depends on job \`${name}\` through \`needs:\`, ${why}. A \`needs:\` on a ` +
        "job that does not run SKIPS the dependent, and GitHub reports a skipped job as SUCCESS " +
        "for a required status check, so this gate would be off AND GREEN with the declaration, " +
        "the job name, the pinned `node-version`, the `report` output and the `needs:` list all " +
        "intact. A determinism job may only depend on jobs that are themselves guaranteed to run: " +
        "putting the `if:` on a new job and reaching it with a `needs:` is the same hole as " +
        "writing the `if:` here.",
    );
  }
  return problems;
}

/** The name of the job that compares the per-engine reports. */
const VERIFY_JOB = "determinism-verify";

/** How a flow mapping inside a determinism job is refused. */
function flowSyntaxProblem(name: string, lines: readonly string[]): string {
  return (
    `job \`${name}\` writes YAML FLOW syntax (${lines.map((l) => `\`${l}\``).join(", ")}), which ` +
    "this reconciliation REFUSES to read rather than approximate. Every rule here reads this file " +
    "LINE BY LINE, so a key inside `{ }` is not at the head of a line and no rule sees it, while a " +
    "runner reads `- { if: false, run: ... }` exactly as it reads the block spelling. Write the " +
    "determinism jobs in block style; a reader that understands one of two spellings a runner " +
    "treats alike is a reader that can be edited around."
  );
}

/** How a conditional determinism job is reported. The quoted conditions make the edit visible. */
function conditionalProblem(
  name: string,
  conditions: readonly string[],
  consequence: string,
): string {
  return (
    `job \`${name}\` is CONDITIONAL (${conditions.map((c) => `\`${c}\``).join(", ")}), so ` +
    `${consequence} A skipped job satisfies a \`needs:\` and GitHub reports it as SUCCESS for a ` +
    "required status check, so this gate would be off AND GREEN. No `if:` is permitted inside a " +
    "determinism job, at job level or step level, and that is a rule about the key rather than " +
    "about any particular expression."
  );
}

/** The `on:` block of a workflow, or `undefined` when the triggers are not where this can read. */
function triggerBlock(text: string): string | undefined {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => /^(?:on|"on"|'on')\s*:\s*$/.test(line));
  if (at < 0) return undefined;
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i += 1) {
    if (/^\S/.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(at, end).join("\n");
}

/** What one event under `on:` declares: the keys it carries, and the branches it names. */
interface EventDeclaration {
  readonly keys: readonly string[];
  readonly branches: readonly string[];
}

/**
 * Read one event out of the `on:` block, as the keys it carries rather than as one line pair.
 *
 * The pair `<event>:` followed by `branches: [main]` was what this read before, and it read no
 * further, so a `paths:` filter added under an otherwise untouched trigger was invisible to the
 * very check that exists because "deleting a trigger and writing an `if:` have the identical
 * effect". A filter decides whether the workflow STARTS AT ALL, which is that same effect again.
 * Only the keys at the event's own indent are collected; anything nested under one of them belongs
 * to that key, not to the event.
 */
function eventDeclaration(block: string, event: string): EventDeclaration | undefined {
  const lines = block.split("\n");
  const head = new RegExp(`^ {2}(?:${event}|"${event}"|'${event}')\\s*:\\s*$`);
  const at = lines.findIndex((line) => head.test(line));
  if (at < 0) return undefined;

  const keys: string[] = [];
  let branches: readonly string[] = [];
  let keyIndent: number | undefined;
  for (let i = at + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    if (indent <= 2) break;
    keyIndent ??= indent;
    if (indent !== keyIndent) continue;
    const match = /^([A-Za-z0-9_-]+|"[^"]+"|'[^']+')\s*:\s*(.*)$/.exec(trimmed);
    if (match === null) {
      keys.push(trimmed);
      continue;
    }
    const key = unquote(match[1] ?? "");
    keys.push(key);
    if (key === "branches") branches = scalarSequence(lines, i, indent, (match[2] ?? "").trim());
  }
  return { keys, branches };
}

/**
 * Reconcile the workflow's TRIGGERS against the events this gate has to be observed on.
 *
 * Deleting `pull_request:` and writing `if: github.event_name != 'pull_request'` on a digest job
 * have the identical effect, so both are read here. The default branch is checked too: a push-only
 * or pull-request-only workflow leaves one half of the comparison never re-measured. And the event
 * must carry `branches: [main]` AND NOTHING ELSE, because every other key under an event is a
 * filter on whether the workflow starts.
 */
function reconcileTriggers(text: string): readonly string[] {
  const block = triggerBlock(text);
  if (block === undefined) {
    return [
      "the workflow declares no `on:` block this reader could find, so the events the determinism " +
        "jobs run on cannot be derived. Refusing rather than assuming they run on pull requests: " +
        "an underivable trigger is not a trigger that is present.",
    ];
  }
  const problems: string[] = [];
  for (const [event, why] of [
    [
      "pull_request",
      "so no determinism job ever runs on the change under review. Switching a trigger off is the " +
        "same hole as switching a job off with an `if:`: the gate is not red, it is absent.",
    ],
    [
      "push",
      "so the mapping is never re-measured on the default branch and a baseline that landed there " +
        "is never compared against a second engine again.",
    ],
  ] as const) {
    const declaration = eventDeclaration(block, event);
    if (
      declaration === undefined ||
      declaration.branches.length !== 1 ||
      declaration.branches[0] !== "main"
    ) {
      problems.push(
        `the workflow does not run on \`${event}\` to \`main\` (its \`on:\` block does not carry ` +
          `\`${event}: { branches: [main] }\`), ${why}`,
      );
      continue;
    }
    const extra = declaration.keys.filter((key) => key !== "branches");
    if (extra.length > 0) {
      problems.push(
        `the workflow's \`${event}:\` trigger carries ${extra.map((k) => `\`${k}\``).join(", ")} ` +
          "alongside `branches: [main]`. A `paths:`, `paths-ignore:`, `branches-ignore:` or " +
          "`types:` filter decides whether the workflow STARTS AT ALL, which is the same hole as " +
          "switching a job off with an `if:` and quieter: a workflow that never starts leaves a " +
          "required check unreported rather than red. This reconciliation permits `branches: " +
          "[main]` and nothing else on the events the determinism gate rides on.",
      );
    }
  }
  return problems;
}

/** Every major named by a per-engine digest job, and what the comparison job does with them. */
export function readWorkflowDeterminismJobs(text: string): WorkflowDeterminismJobs {
  const problems: string[] = [];
  const blocks = jobBlocks(text);
  if (blocks.size === 0) {
    return {
      digestEngines: [],
      digestJobs: [],
      verifyNeeds: [],
      verifyConsumes: [],
      conditionalJobs: [],
      problems: [
        "the workflow declares no `jobs:` mapping this reader could split, so the engines CI runs " +
          "the digest step on cannot be derived. Refusing rather than reporting an empty set: an " +
          "underivable subject is not an absent one.",
      ],
    };
  }

  problems.push(...reconcileTriggers(text));

  // Which job blocks this file is responsible for. A determinism job reached through another's
  // `needs:` is walked through rather than reported twice; everything else is a foreign job.
  const determinismJobs = new Set<string>(
    [...blocks.keys()].filter(
      (name) => /^determinism-digest-\d+$/.test(name) || name === VERIFY_JOB,
    ),
  );

  const digestEngines: number[] = [];
  const digestJobs: number[] = [];
  const conditionalJobs: string[] = [];
  for (const [name, block] of blocks) {
    const major = /^determinism-digest-(\d+)$/.exec(name)?.[1];
    if (major === undefined) continue;
    const engine = Number(major);
    digestJobs.push(engine);

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

    // Does it RUN? Everything above only ever asked whether it EXISTS.
    let unconditional = true;
    const conditions = conditionsIn(block);
    if (conditions.length > 0) {
      conditionalJobs.push(name);
      unconditional = false;
      problems.push(
        conditionalProblem(
          name,
          conditions,
          `Node ${major} is DECLARED but its digest step is not guaranteed to run.`,
        ),
      );
    }
    if (declaresStrategy(block)) {
      unconditional = false;
      problems.push(
        `job \`${name}\` declares a \`strategy:\`, which this reconciliation REFUSES to read ` +
          "rather than approximate: a matrix decides how many times a job runs and on which " +
          `engine, so the job name and its pinned \`node-version: "${major}"\` stop being the ` +
          "answer to what CI digests. Explicit per-engine jobs are the design here, because " +
          "matrix legs share one `outputs` map and overwrite each other by key.",
      );
    }
    const flowSyntax = flowSyntaxIn(block);
    if (flowSyntax.length > 0) {
      unconditional = false;
      problems.push(flowSyntaxProblem(name, flowSyntax));
    }

    // Does it reach a job that can skip? Everything above only ever read this job's own block.
    const dependencies = dependencyProblems(name, blocks, determinismJobs);
    if (dependencies.length > 0) {
      if (!conditionalJobs.includes(name)) conditionalJobs.push(name);
      unconditional = false;
      problems.push(...dependencies);
    }
    if (unconditional) digestEngines.push(engine);
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
    const verifyConditions = conditionsIn(verify);
    if (verifyConditions.length > 0) {
      conditionalJobs.push(VERIFY_JOB);
      problems.push(
        conditionalProblem(
          VERIFY_JOB,
          verifyConditions,
          "the comparison is not guaranteed to happen at all and the two engines never meet.",
        ),
      );
    }
    if (declaresStrategy(verify)) {
      problems.push(
        `job \`${VERIFY_JOB}\` declares a \`strategy:\`, which this reconciliation REFUSES to read ` +
          "rather than approximate: a matrix decides how many times the comparison runs, and one " +
          "that runs zero times is a comparison nobody made.",
      );
    }
    const verifyFlowSyntax = flowSyntaxIn(verify);
    if (verifyFlowSyntax.length > 0) problems.push(flowSyntaxProblem(VERIFY_JOB, verifyFlowSyntax));

    // The comparison job is the one whose absence means two engines never meet, so the same
    // graph walk is made from it: a `needs:` it carries on a switched-off job skips it too.
    const verifyDependencies = dependencyProblems(VERIFY_JOB, blocks, determinismJobs);
    if (verifyDependencies.length > 0) {
      if (!conditionalJobs.includes(VERIFY_JOB)) conditionalJobs.push(VERIFY_JOB);
      problems.push(...verifyDependencies);
    }

    for (const name of declaredNeeds(verify)) {
      const match = /^determinism-digest-(\d+)$/.exec(name);
      if (match !== null) verifyNeeds.push(Number(match[1]));
    }
    for (const engine of digestJobs) {
      const referenced = verify.includes(
        `needs.determinism-digest-${String(engine)}.outputs.report`,
      );
      const materialised = verify.includes(`${engineId(engine)}.json`);
      if (referenced && materialised) verifyConsumes.push(engine);
    }
  }

  return {
    digestEngines: digestEngines.sort((a, b) => a - b),
    digestJobs: digestJobs.sort((a, b) => a - b),
    verifyNeeds: [...new Set(verifyNeeds)].sort((a, b) => a - b),
    verifyConsumes: verifyConsumes.sort((a, b) => a - b),
    conditionalJobs,
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
      `the continuous-integration workflow UNCONDITIONALLY runs the per-engine digest step on ` +
        `[${renderSet(found.digestEngines)}] while the declared supported-engine set is ` +
        `[${renderSet(unique)}]. The declaration and the jobs cannot drift apart: an engine that ` +
        "is declared and never run is a promise nothing checks, and one that is run and never " +
        "declared is a comparison nobody asked for. An engine missing from the left-hand set " +
        "either has no digest job at all or has one whose execution is not guaranteed; the " +
        "problems above this one say which.",
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
