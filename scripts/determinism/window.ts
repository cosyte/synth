/**
 * scripts/determinism/window.ts
 *
 * THE COMPATIBILITY-WINDOW CHECK: A CHANGED MAPPING IS STATED IN THE CHANGELOG ENTRY.
 *
 * A consumer is invited to commit a golden fixture and diff against it forever. That invitation is
 * worth exactly as much as the promise that the mapping behind it does not move unannounced, and
 * the only thing that makes a move survivable for the consumer is being TOLD, in the changelog
 * entry for the release that moves it.
 *
 * So: if the committed baseline in this working tree differs from the one on the default branch, a
 * changeset in the tree must STATE every kind of difference, each in its own named section. No
 * statement, no landing. `.changeset/config.json` names a changelog generator, so the changeset
 * summary IS the changelog entry, which is why the changeset is the thing checked rather than a
 * hand-edited file.
 *
 * EVERY RELEASE IS A PATCH, so the version number tells a consumer nothing about which output
 * moved, and a bump of any size is not a statement. A major changeset that states nothing is
 * refused like a patch changeset that states nothing. Every change this check allows can be made
 * with a patch changeset.
 *
 * THE FIVE STATES, and the two that are easy to get wrong:
 *
 *   present + absent upstream   the window is being ESTABLISHED, not broken. Nothing mapped to
 *                               anything before, so nothing changed, so nothing has to be stated.
 *                               This is the state the first commit of a baseline is in.
 *   absent + present upstream   the baseline was DELETED. That fails, and it fails harder than a
 *                               changed one: a deleted baseline is a mapping change that removed
 *                               its own evidence, and there is no changeset that makes it fine.
 *   absent + absent             no baseline anywhere. Fails: the per-engine digest step has nothing
 *                               to compare against, so the toolchain-moved-everything case is
 *                               unguarded.
 *   present + equal             the mapping is unchanged. Passes.
 *   present + different         the mapping moved. Passes when the changesets for this package
 *                               state every kind of difference (below), and fails saying which
 *                               section is missing when they do not.
 *
 * THE SECTIONS. Each is a paragraph in a changeset's body that opens with its heading, in a
 * changeset whose frontmatter names this package. One changeset may carry several, and several
 * changesets may share them out, but each section has to name everything of its kind on its own:
 *
 *   `Output change:`            a digest moved or a pair was added. Names every such format by its
 *                               display name (`C-CDA`, `HL7 v2`, ...).
 *   `Corpus narrowed:`          a (format, seed) pair came OUT of the graded set. Names every
 *                               format that lost a pair.
 *   `Window change:`            the baseline's compatibility window moved. Names the new window.
 *   `Digest algorithm change:`  the digest algorithm changed. Names the new algorithm.
 *   `Artifact count change:`    the artifacts digested per pair changed. Names the new count.
 *
 * A changed algorithm or artifact count moves every digest without a byte of output moving, so
 * while either changes this check cannot tell a moved output from a re-taken digest and asks only
 * for the section that names the change. Make such a change on its own: the next change is measured
 * against the new baseline in full.
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
 * so it has to be stated too, in its own section. What changes is only that the refusal describes
 * the change it is refusing: a gate that reds correctly and then explains itself with a falsehood
 * teaches the next reader the wrong story, and that reader is the one walking the narrowing
 * procedure with a real cross-engine divergence in hand.
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

/** The display name an `Output change:` section has to use for each format the corpus grades. */
export const FORMAT_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  astm: "ASTM",
  ccda: "C-CDA",
  fhir: "FHIR",
  hl7v2: "HL7 v2",
  ncpdp: "NCPDP",
  x12: "X12",
};

/** The kinds of difference a changed baseline can show, each stated in its own section. */
export type ChangeKind = "output" | "narrowed" | "window" | "algorithm" | "artifacts";

/** The heading that opens the section stating each kind of change, in the order they are asked for. */
export const SECTION_HEADINGS: Readonly<Record<ChangeKind, string>> = {
  output: "Output change:",
  narrowed: "Corpus narrowed:",
  window: "Window change:",
  algorithm: "Digest algorithm change:",
  artifacts: "Artifact count change:",
};

/** What a changeset says in one section. */
export interface StatedOutputChange {
  /** True when it names this package and its section names everything it has to. */
  readonly ok: boolean;
  /** The names the section does not carry (every one, when there is no section). */
  readonly missing: readonly string[];
}

/** A regular expression's special characters, escaped. */
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether a changeset STATES one kind of change for a package: its frontmatter names the package
 * (any bump), and its body carries a section, the paragraph that opens with the heading, naming
 * every one of the given names.
 *
 * A format name is matched anywhere in the section. A window, an algorithm or a count is matched
 * only as a whole token, so `5` is not found inside `15`.
 *
 * @param text - The changeset file's text.
 * @param packageName - The package the frontmatter must name.
 * @param heading - The heading the section opens with (`Output change:`, ...).
 * @param names - What the section has to name.
 * @param wholeToken - Whether each name has to stand as a whole token.
 * @returns Whether the change is stated, and which names the section leaves out.
 * @example
 * ```ts
 * statesSectionFor(
 *   '---\n"@cosyte/synth": patch\n---\n\nSummary.\n\nWindow change: now 1.x.\n',
 *   "@cosyte/synth",
 *   "Window change:",
 *   ["1.x"],
 *   true,
 * ).ok; // true
 * ```
 */
export function statesSectionFor(
  text: string,
  packageName: string,
  heading: string,
  names: readonly string[],
  wholeToken: boolean,
): StatedOutputChange {
  const fence = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  const frontmatter = fence?.[1];
  if (fence === null || frontmatter === undefined) return { ok: false, missing: names };
  const declaration = new RegExp(
    `^\\s*["']?${escape(packageName)}["']?\\s*:\\s*["']?(?:patch|minor|major)["']?\\s*$`,
    "m",
  );
  if (!declaration.test(frontmatter)) return { ok: false, missing: names };
  const body = text.slice(fence[0].length);
  const opening = new RegExp(
    `^[ \\t]*(?:[-*+][ \\t]+)?(?:\\*\\*)?${escape(heading)}(?:\\*\\*)?`,
    "m",
  ).exec(body);
  if (opening === null) return { ok: false, missing: names };
  // The section is the paragraph the heading opens: everything up to the next blank line.
  const rest = body.slice(opening.index);
  const end = /\r?\n[ \t]*\r?\n/.exec(rest);
  const section = end === null ? rest : rest.slice(0, end.index);
  const carries = (name: string): boolean =>
    wholeToken
      ? new RegExp(`(?<![A-Za-z0-9.])${escape(name)}(?![A-Za-z0-9])`, "i").test(section)
      : section.toLowerCase().includes(name.toLowerCase());
  const missing = names.filter((name) => !carries(name));
  return { ok: missing.length === 0, missing };
}

/**
 * Whether a changeset STATES an output change for a package: its `Output change:` section names
 * every moved format by its display name.
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
  return statesSectionFor(
    text,
    packageName,
    SECTION_HEADINGS.output,
    displayNames(movedFormats),
    false,
  );
}

/** Display names for format labels, in the order given. */
const displayNames = (formats: Iterable<string>): readonly string[] =>
  [...formats].map((format) => FORMAT_DISPLAY_NAMES[format] ?? format);

/** One section a changed baseline needs, and what it has to name. */
interface Requirement {
  readonly kind: ChangeKind;
  readonly names: readonly string[];
}

/**
 * Every section the difference between two baselines needs, in the order of `SECTION_HEADINGS`.
 *
 * A pair that was added is an output change. A digest that moved on a surviving pair is one too,
 * but only while the algorithm and the artifact count hold: when either changes, every digest moves
 * with no output moving, so the digests are not compared and only the section naming that change is
 * asked for.
 */
function requirements(current: Baseline, previous: Baseline): readonly Requirement[] {
  const comparable =
    current.digestAlgorithm === previous.digestAlgorithm &&
    current.artifactsPerPair === previous.artifactsPerPair;
  const before = new Map(previous.entries.map((e) => [pairKey(e.format, e.seed), e]));
  const after = new Set(current.entries.map((e) => pairKey(e.format, e.seed)));
  const moved = new Set<string>();
  for (const entry of current.entries) {
    const earlier = before.get(pairKey(entry.format, entry.seed));
    if (earlier === undefined || (comparable && earlier.digest !== entry.digest)) {
      moved.add(entry.format);
    }
  }
  const removed = new Set<string>();
  for (const [key, entry] of before) if (!after.has(key)) removed.add(entry.format);

  const needed: Requirement[] = [];
  if (moved.size > 0) needed.push({ kind: "output", names: displayNames([...moved].sort()) });
  if (removed.size > 0) needed.push({ kind: "narrowed", names: displayNames([...removed].sort()) });
  if (current.package.window !== previous.package.window) {
    needed.push({ kind: "window", names: [current.package.window] });
  }
  if (current.digestAlgorithm !== previous.digestAlgorithm) {
    needed.push({ kind: "algorithm", names: [current.digestAlgorithm] });
  }
  if (current.artifactsPerPair !== previous.artifactsPerPair) {
    needed.push({ kind: "artifacts", names: [String(current.artifactsPerPair)] });
  }
  return needed;
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

/** The sentence that has to be said whenever a changed baseline is refused. */
const MAPPING_RULE =
  "A CHANGED SEED-TO-BYTES MAPPING HAS TO BE STATED. A consumer is invited to commit a golden " +
  "fixture and diff against it, so a release that changes the committed baseline has to say how " +
  "in that release's changelog entry, which is the changeset summary. Every release is a patch, " +
  "so add a patch changeset for this package whose body carries one section for each kind of " +
  "change, a paragraph that opens with its heading: `Output change:` naming every format whose " +
  "bytes moved or that gained a pair, `Corpus narrowed:` naming every format that lost a pair " +
  "and saying why, `Window change:` naming the new window, `Digest algorithm change:` naming the " +
  "new algorithm, and `Artifact count change:` naming the new count. A major changeset does not " +
  "pass this check: the version number tells a consumer nothing about which output moved.";

/** What is added to a refusal when the change is a narrowed corpus rather than a moved mapping. */
const narrowingNote = (removed: readonly string[]): string =>
  `\n\nWHAT ACTUALLY CHANGED HERE, and it does not change the verdict above: NO SEED MAPS TO ` +
  `DIFFERENT BYTES. Every (format, seed) pair present in both baselines carries the same digest, ` +
  `and ${String(removed.length)} pair(s) came OUT of the graded set (${removed.join(", ")}). That ` +
  "is what the sanctioned narrowing looks like: an exclusion declared with its reason, never a " +
  "tolerated difference. It is still refused until a `Corpus narrowed:` section states it, " +
  "because the promise is not only that the mapping holds but that it is VERIFIED across the " +
  "declared engines, and a pair that is no longer graded is that promise withdrawn without the " +
  "consumer being told. Widening a promise is easy; narrowing one is consumer-visible, so it is " +
  "stated too, and the changeset summary is where the consumer reads about it.";

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
        "with `pnpm run determinism:digest --update-baseline` and state the change." +
        `\n\n${MAPPING_RULE}`,
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
        "anything before, so no mapping has changed and nothing has to be stated. Every later " +
        "change to it is measured against this one.",
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

  const stated: string[] = [];
  const unstated: string[] = [];
  for (const requirement of requirements(currentRead.baseline, previousRead.baseline)) {
    const heading = SECTION_HEADINGS[requirement.kind];
    const verdicts = input.changesets.map((changeset) => ({
      changeset,
      section: statesSectionFor(
        changeset.text,
        input.packageName,
        heading,
        requirement.names,
        requirement.kind !== "output" && requirement.kind !== "narrowed",
      ),
    }));
    const naming = requirement.names.join(", ");
    const stating = verdicts.filter((v) => v.section.ok);
    if (stating.length > 0) {
      stated.push(`${heading} (${naming}) in ${stating.map((v) => v.changeset.name).join(", ")}`);
      continue;
    }
    const partial = verdicts.find((v) => v.section.missing.length < requirement.names.length);
    unstated.push(
      `${heading} naming ${naming}` +
        (partial === undefined
          ? ""
          : ` (${partial.changeset.name} has the section, but it does not name ` +
            `${partial.section.missing.join(", ")})`),
    );
  }

  if (unstated.length === 0) {
    return {
      status: "pass",
      message:
        `the committed determinism baseline differs from ${input.baseRef}, and the changesets ` +
        `state every change: ${stated.join("; ")}. The changelog entry for the release will say ` +
        "so.",
    };
  }

  const narrowed = narrowedPairs(currentRead.baseline, previousRead.baseline);
  return {
    status: "fail",
    message:
      `the committed determinism baseline differs from ${input.baseRef} and the changesets for ` +
      `${input.packageName} do not state every change` +
      (input.changesets.length === 0
        ? " (there are no changesets at all)"
        : ` (${String(input.changesets.length)} changeset(s) present)`) +
      `. Missing:\n${unstated.map((line) => `  - ${line}`).join("\n")}` +
      `\n\n${MAPPING_RULE}` +
      (narrowed === undefined ? "" : narrowingNote(narrowed)),
  };
}
