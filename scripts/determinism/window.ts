/**
 * scripts/determinism/window.ts
 *
 * THE COMPATIBILITY-WINDOW CHECK: A CHANGED MAPPING IS A BREAKING CHANGE, DECLARED AS ONE.
 *
 * A consumer is invited to commit a golden fixture and diff against it forever. That invitation is
 * worth exactly as much as the promise that the mapping behind it does not move inside a release
 * window, and the only thing that makes a move survivable for the consumer is being TOLD, in the
 * changelog entry for the release that moves it.
 *
 * So: if the committed baseline in this working tree differs from the one on the default branch,
 * some (format, seed) pair maps to different bytes than it did, and a changeset in the tree must
 * declare a MAJOR change for this package. No changeset, no landing. `.changeset/config.json` names
 * a changelog generator, so the changeset summary IS the changelog entry, which is why the
 * changeset is the thing checked rather than a hand-edited file.
 *
 * THE FIVE STATES, and the two that are easy to get wrong:
 *
 *   present + absent upstream   the window is being ESTABLISHED, not broken. Nothing mapped to
 *                               anything before, so nothing changed, so no breaking change is
 *                               declared. This is the state the first commit of a baseline is in,
 *                               and calling it a break would force a major version bump to ship a
 *                               check that changes no output at all.
 *   absent + present upstream   the baseline was DELETED. That fails, and it fails harder than a
 *                               changed one: a deleted baseline is a mapping change that removed
 *                               its own evidence, and there is no changeset that makes it fine.
 *   absent + absent             no baseline anywhere. Fails: the per-engine digest step has nothing
 *                               to compare against, so the toolchain-moved-everything case is
 *                               unguarded.
 *   present + equal             the mapping is unchanged. Passes.
 *   present + different         the mapping moved. Passes only with a major changeset for this
 *                               package, and fails saying why when there is not one.
 *
 * EQUALITY IS SEMANTIC, NOT TEXTUAL. Two baselines are the same when they agree about the window,
 * the algorithm, the corpus size and every (format, seed) digest. Reformatting a file is not a
 * mapping change and must not be reported as one, or the gate reds on correct work and gets
 * disabled.
 *
 * A NARROWED CORPUS IS REFUSED THE SAME WAY, AND THE DIAGNOSTIC SAYS THAT IS WHAT HAPPENED. Taking
 * a (format, seed) pair out of the graded set (the one sanctioned narrowing: declare the exclusion
 * and say why) leaves every surviving digest untouched, so NO SEED MAPS TO DIFFERENT BYTES, and the
 * headline sentence below would be a falsehood about that change if it were printed alone. The
 * VERDICT is unchanged, deliberately: what a consumer was promised is not only that the mapping
 * holds but that it is VERIFIED across the declared engines, and a pair that is no longer graded is
 * that promise quietly withdrawn. Widening a promise is easy and narrowing one is consumer-visible,
 * so both go through the same door. What changes is only that the refusal describes the change it
 * is refusing: a gate that reds correctly and then explains itself with a falsehood teaches the
 * next reader the wrong story, and that reader is the one walking the narrowing procedure with a
 * real cross-engine divergence in hand.
 */

import { parseBaseline, type Baseline } from "./baseline.js";
import { pairKey } from "./corpus.js";

/** One changeset file in the working tree. */
export interface ChangesetFile {
  /** Its name, for the diagnostic. */
  readonly name: string;
  /** Its text. */
  readonly text: string;
}

/** What the window check is given. */
export interface WindowInput {
  /** The baseline in this working tree, or `null` when there is none. */
  readonly current: string | null;
  /** The baseline on the default branch, or `null` when there is none there. */
  readonly previous: string | null;
  /** How to name the default branch in a diagnostic. */
  readonly baseRef: string;
  /** Every changeset in the working tree. */
  readonly changesets: readonly ChangesetFile[];
  /** The package name a changeset has to name. */
  readonly packageName: string;
}

/** The window check's verdict. */
export interface WindowVerdict {
  /** Whether the check passes. */
  readonly status: "pass" | "fail";
  /** What to print. */
  readonly message: string;
}

/**
 * Whether a changeset declares a major (breaking) change for a package.
 *
 * A changeset's frontmatter is a YAML block between the first two `---` fences, holding one
 * `"<package>": <bump>` line per affected package. This reads that block only, so a package name
 * mentioned in the prose summary cannot be mistaken for a declaration.
 *
 * @param text - The changeset file's text.
 * @param packageName - The package the declaration must name.
 * @returns True when the frontmatter declares `major` for that package.
 * @example
 * ```ts
 * declaresMajorFor('---\n"@cosyte/synth": major\n---\n\nSummary\n', "@cosyte/synth"); // true
 * ```
 */
export function declaresMajorFor(text: string, packageName: string): boolean {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  if (frontmatter === undefined) return false;
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declaration = new RegExp(`^\\s*["']?${escaped}["']?\\s*:\\s*["']?major["']?\\s*$`, "m");
  return declaration.test(frontmatter);
}

/** Whether two baselines describe the same seed-to-bytes mapping. */
function sameMapping(a: Baseline, b: Baseline): boolean {
  if (a.package.window !== b.package.window) return false;
  if (a.digestAlgorithm !== b.digestAlgorithm) return false;
  if (a.artifactsPerPair !== b.artifactsPerPair) return false;
  if (a.entries.length !== b.entries.length) return false;
  const left = new Map(a.entries.map((e) => [pairKey(e.format, e.seed), e.digest]));
  for (const entry of b.entries) {
    if (left.get(pairKey(entry.format, entry.seed)) !== entry.digest) return false;
  }
  return true;
}

/**
 * The pairs that came OUT of the graded set, when that is the ONLY difference between two
 * baselines, and `undefined` when the difference is anything else.
 *
 * "Anything else" is: a moved digest on a surviving pair, a pair that was added, or a change to the
 * window, the algorithm or the artifact count. Those are mapping changes and are described as such.
 * This reports what the two files show and says nothing about WHY a pair is gone: the declaration
 * that names an exclusion and its reason is checked where it is read, in the digest run, which
 * refuses a corpus that shrank without one.
 */
function narrowedPairs(current: Baseline, previous: Baseline): readonly string[] | undefined {
  if (current.package.window !== previous.package.window) return undefined;
  if (current.digestAlgorithm !== previous.digestAlgorithm) return undefined;
  if (current.artifactsPerPair !== previous.artifactsPerPair) return undefined;

  const remaining = new Map(previous.entries.map((e) => [pairKey(e.format, e.seed), e.digest]));
  for (const entry of current.entries) {
    const key = pairKey(entry.format, entry.seed);
    if (remaining.get(key) !== entry.digest) return undefined;
    remaining.delete(key);
  }
  return remaining.size > 0 ? [...remaining.keys()].sort() : undefined;
}

/** The sentence that has to be said whenever a mapping change is refused. */
const BREAKING_CHANGE_RULE =
  "A CHANGED SEED-TO-BYTES MAPPING IS A BREAKING CHANGE. A consumer is invited to commit a golden " +
  "fixture and diff against it, so a release that changes what a seed maps to has to say so in " +
  "that release's changelog entry. Add a changeset declaring a major change for this package, " +
  "whose summary says which pairs moved and why.";

/** What is added to a refusal when the change is a narrowed corpus rather than a moved mapping. */
const narrowingNote = (removed: readonly string[]): string =>
  `\n\nWHAT ACTUALLY CHANGED HERE, and it does not change the verdict above: NO SEED MAPS TO ` +
  `DIFFERENT BYTES. Every (format, seed) pair present in both baselines carries the same digest, ` +
  `and ${String(removed.length)} pair(s) came OUT of the graded set (${removed.join(", ")}). That ` +
  "is what the sanctioned narrowing looks like: an exclusion declared with its reason, never a " +
  "tolerated difference. It is still refused without a major declaration, because the promise is " +
  "not only that the mapping holds but that it is VERIFIED across the declared engines, and a " +
  "pair that is no longer graded is that promise withdrawn without the consumer being told. " +
  "Widening a promise is easy; narrowing one is consumer-visible, so it goes through this door " +
  "too, and the changeset summary is where the consumer reads about it.";

/**
 * Decide the compatibility-window check.
 *
 * @param input - The two baselines, the changesets, and the package name.
 * @returns The verdict and what to print.
 * @example
 * ```ts
 * decideWindow({ current, previous: null, baseRef: "origin/main", changesets: [], packageName });
 * // { status: "pass", message: "... establishes the baseline ..." }
 * ```
 */
export function decideWindow(input: WindowInput): WindowVerdict {
  if (input.current === null && input.previous === null) {
    return {
      status: "fail",
      message:
        "there is no committed determinism baseline in this tree and none on " +
        `${input.baseRef}. Without one, a toolchain or dependency change that moves the ` +
        "seed-to-bytes mapping on every engine at once is unguarded: every engine agrees, and " +
        "the golden file a consumer committed stops matching with nothing red anywhere.",
    };
  }

  if (input.current === null) {
    return {
      status: "fail",
      message:
        `the committed determinism baseline exists on ${input.baseRef} and has been REMOVED in ` +
        "this tree. Deleting the baseline is a mapping change that takes its own evidence with " +
        "it, and there is no changeset that makes that acceptable. Restore it, or regenerate it " +
        `and declare the change.\n\n${BREAKING_CHANGE_RULE}`,
    };
  }

  const currentRead = parseBaseline(input.current);
  if (!currentRead.ok) {
    return {
      status: "fail",
      message: `the committed determinism baseline in this tree ${currentRead.error}`,
    };
  }

  if (input.previous === null) {
    return {
      status: "pass",
      message:
        `${input.baseRef} carries no determinism baseline, so this change ESTABLISHES the window ` +
        `for ${currentRead.baseline.package.window} rather than breaking one. Nothing mapped to ` +
        "anything before, so no mapping has changed and no breaking change is declared. Every " +
        "later change to it is measured against this one.",
    };
  }

  const previousRead = parseBaseline(input.previous);
  if (!previousRead.ok) {
    return {
      status: "fail",
      message:
        `the determinism baseline on ${input.baseRef} ${previousRead.error}, so this check ` +
        "cannot say whether the mapping moved. Refusing rather than reporting a pass it has not " +
        "earned.",
    };
  }

  if (sameMapping(currentRead.baseline, previousRead.baseline)) {
    return {
      status: "pass",
      message:
        `the committed determinism baseline is unchanged against ${input.baseRef}: the ` +
        `seed-to-bytes mapping for window ${currentRead.baseline.package.window} still holds ` +
        `over ${String(currentRead.baseline.entries.length)} (format, seed) pair(s).`,
    };
  }

  const declaring = input.changesets.filter((changeset) =>
    declaresMajorFor(changeset.text, input.packageName),
  );
  if (declaring.length > 0) {
    return {
      status: "pass",
      message:
        `the committed determinism baseline differs from ${input.baseRef}, and ` +
        `${declaring.map((c) => c.name).join(", ")} declares a major change for ` +
        `${input.packageName}. The window is broken deliberately and the changelog entry for the ` +
        "release will say so.",
    };
  }

  const narrowed = narrowedPairs(currentRead.baseline, previousRead.baseline);
  return {
    status: "fail",
    message:
      `the committed determinism baseline differs from ${input.baseRef} and no changeset in this ` +
      `tree declares a major change for ${input.packageName}` +
      (input.changesets.length === 0
        ? " (there are no changesets at all)"
        : ` (${String(input.changesets.length)} changeset(s) present, none declaring major)`) +
      `.\n\n${BREAKING_CHANGE_RULE}` +
      (narrowed === undefined ? "" : narrowingNote(narrowed)),
  };
}
