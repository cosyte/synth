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
 *   present + different         the mapping moved. Passes with a major changeset for this
 *                               package, or with a changeset that STATES the change (below), and
 *                               fails saying why when there is neither.
 *
 * A STATED OUTPUT CHANGE IS THE SECOND DOOR, by the operator's decision D57 (plans/decisions.md in
 * the umbrella, 2026-11-07: "Amend the gate to accept a stated output change in a patch, and release
 * 0.1.2."). A changeset of any bump for this package passes a moved mapping when its body carries an
 * `Output change:` section that names every format whose bytes moved, by its display name
 * (`C-CDA`, `HL7 v2`, ...). The consumer's protection was never the version number; it is being told,
 * in the changelog entry, which output moved, and the section is exactly that sentence. What it
 * cannot do: cover a NARROWED corpus, a changed window, algorithm or artifact count, or a format the
 * section leaves out. Those still need the major door, because none of them is an output change the
 * section can describe.
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

/** The display name an `Output change:` section has to use for each format the corpus grades. */
export const FORMAT_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  astm: "ASTM",
  ccda: "C-CDA",
  fhir: "FHIR",
  hl7v2: "HL7 v2",
  ncpdp: "NCPDP",
  x12: "X12",
};

/** The heading a stated output change opens with, at the start of a line in a changeset's body. */
const OUTPUT_CHANGE_HEADING = /^[ \t]*(?:[-*+][ \t]+)?(?:\*\*)?Output change:(?:\*\*)?/m;

/** What a changeset says about a moved mapping. */
export interface StatedOutputChange {
  /** True when it names this package and its `Output change:` section names every moved format. */
  readonly ok: boolean;
  /** The moved formats the section does not name (every one, when there is no section). */
  readonly missing: readonly string[];
}

/**
 * Whether a changeset STATES an output change for a package: its frontmatter names the package
 * (any bump), and its body carries an `Output change:` section, the paragraph that opens with that
 * heading, naming every moved format by its display name.
 *
 * @param text - The changeset file's text.
 * @param packageName - The package the frontmatter must name.
 * @param movedFormats - The format labels whose digests moved (`ccda`, `hl7v2`, ...).
 * @returns Whether the change is stated, and which moved formats the section leaves out.
 * @example
 * ```ts
 * statesOutputChangeFor(
 *   '---\n"@cosyte/synth": patch\n---\n\nSummary.\n\nOutput change: C-CDA documents gain a code.\n',
 *   "@cosyte/synth",
 *   ["ccda"],
 * ).ok; // true
 * ```
 */
export function statesOutputChangeFor(
  text: string,
  packageName: string,
  movedFormats: readonly string[],
): StatedOutputChange {
  const fence = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  const frontmatter = fence?.[1];
  const names = movedFormats.map((format) => FORMAT_DISPLAY_NAMES[format] ?? format);
  if (fence === null || frontmatter === undefined) return { ok: false, missing: names };
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declaration = new RegExp(
    `^\\s*["']?${escaped}["']?\\s*:\\s*["']?(?:patch|minor|major)["']?\\s*$`,
    "m",
  );
  if (!declaration.test(frontmatter)) return { ok: false, missing: names };
  const body = text.slice(fence[0].length);
  const heading = OUTPUT_CHANGE_HEADING.exec(body);
  if (heading === null) return { ok: false, missing: names };
  // The section is the paragraph the heading opens: everything up to the next blank line.
  const rest = body.slice(heading.index);
  const end = /\r?\n[ \t]*\r?\n/.exec(rest);
  const section = end === null ? rest : rest.slice(0, end.index);
  const missing = names.filter((name) => !section.toLowerCase().includes(name.toLowerCase()));
  return { ok: missing.length === 0, missing };
}

/**
 * The formats whose bytes moved between two baselines: a digest that changed or a pair that was
 * added. `undefined` when the difference is not one a stated output change can describe: a changed
 * window, algorithm or artifact count, or a pair that came out of the graded set.
 */
function movedFormats(current: Baseline, previous: Baseline): readonly string[] | undefined {
  if (current.package.window !== previous.package.window) return undefined;
  if (current.digestAlgorithm !== previous.digestAlgorithm) return undefined;
  if (current.artifactsPerPair !== previous.artifactsPerPair) return undefined;
  const before = new Map(previous.entries.map((e) => [pairKey(e.format, e.seed), e.digest]));
  const after = new Set(current.entries.map((e) => pairKey(e.format, e.seed)));
  for (const key of before.keys()) if (!after.has(key)) return undefined;
  const moved = new Set<string>();
  for (const entry of current.entries) {
    if (before.get(pairKey(entry.format, entry.seed)) !== entry.digest) moved.add(entry.format);
  }
  return [...moved].sort();
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
  "whose summary says which pairs moved and why, or (operator decision D57) a changeset whose " +
  "body carries an `Output change:` section naming every format that moved and what changed.";

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

  const moved = movedFormats(currentRead.baseline, previousRead.baseline);
  if (moved !== undefined && moved.length > 0) {
    const verdicts = input.changesets.map((changeset) => ({
      changeset,
      stated: statesOutputChangeFor(changeset.text, input.packageName, moved),
    }));
    const stating = verdicts.filter((v) => v.stated.ok);
    if (stating.length > 0) {
      return {
        status: "pass",
        message:
          `the committed determinism baseline differs from ${input.baseRef} for ` +
          `${moved.map((f) => FORMAT_DISPLAY_NAMES[f] ?? f).join(", ")}, and ` +
          `${stating.map((v) => v.changeset.name).join(", ")} states that output change in an ` +
          "`Output change:` section naming every format that moved (operator decision D57). The " +
          "changelog entry for the release will say so.",
      };
    }
    const partial = verdicts.find((v) => v.stated.missing.length < moved.length);
    if (partial !== undefined) {
      return {
        status: "fail",
        message:
          `the committed determinism baseline differs from ${input.baseRef}, and ` +
          `${partial.changeset.name} has an \`Output change:\` section, but it does not name ` +
          `${partial.stated.missing.join(", ")}, whose bytes moved too. Name every format that ` +
          `moved.\n\n${BREAKING_CHANGE_RULE}`,
      };
    }
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
