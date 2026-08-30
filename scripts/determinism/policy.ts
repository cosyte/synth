/**
 * scripts/determinism/policy.ts
 *
 * THE COMMITTED DECLARATION THE CROSS-ENGINE DETERMINISM GATE IS BUILT ON.
 *
 * One file, `scripts/determinism/determinism-policy.json`, holds three things and nothing else:
 *
 *   * `engines`   the SUPPORTED NODE MAJORS this package promises a seed-to-bytes mapping across.
 *                 It is a DECISION, so it is declared rather than inferred, and it is reconciled
 *                 mechanically against `package.json`'s `engines.node` and against the jobs
 *                 `.github/workflows/ci.yml` actually runs (`scripts/determinism/engines.ts`).
 *                 `engines.node` is an open-ended range (`>=22.0.0`): it fixes a floor and names no
 *                 member list, so it can say which majors are ALLOWED and never which are CHECKED.
 *   * `corpus`    the fixed seed list and the artifact count per (format, seed) pair. Fixed, so the
 *                 same bytes are asked for in every job on every engine. The FORMAT half is NOT
 *                 here: it is derived from what the library actually generates, reconciled against
 *                 the factory registry in `corpus.ts`, because a hand-written format list is a
 *                 second lever on this gate's own scope.
 *   * `exclusions` the only sanctioned way to make the graded set smaller: name the (format, seed)
 *                 pair and say why. There is no tolerance, no warning-only mode and no suppression
 *                 list anywhere in this gate; an exclusion removes a pair from the comparison and
 *                 publishes the gap, and it is never a statement that a difference is acceptable.
 *
 * IT REFUSES RATHER THAN DEFAULTS. A missing file, a missing key, a non-integer seed, an empty seed
 * list and an exclusion with no reason are all thrown. A declaration that cannot be read is not a
 * declaration that is absent: falling back to a default would let this gate grade a corpus nobody
 * declared while printing the same OK a real run prints.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root, from this file's own location. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The committed declaration. */
export const POLICY_PATH = join(REPO_ROOT, "scripts", "determinism", "determinism-policy.json");

/** The committed baseline for the current compatibility window. */
export const BASELINE_PATH = join(REPO_ROOT, "scripts", "determinism", "baseline.json");

/** The baseline path as git spells it, for reading the default branch's copy. */
export const BASELINE_GIT_PATH = "scripts/determinism/baseline.json";

/** Where a per-engine digest report is written, and where the comparison looks for one. */
export const REPORT_DIR = join(REPO_ROOT, ".determinism", "reports");

/** The workflow whose declared jobs must match the declared engine set. */
export const CI_WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "ci.yml");

/** The package manifest, read for `engines.node`, the package name and the version. */
export const PACKAGE_JSON_PATH = join(REPO_ROOT, "package.json");

/** One (format, seed) pair taken out of the graded set, with the reason it came out. */
export interface ExclusionDeclaration {
  /** The format label, as the library's own artifacts spell it. */
  readonly format: string;
  /** The seed the excluded artifact is generated from. */
  readonly seed: number;
  /** Why it is not graded. Never a statement that a digest difference is tolerated. */
  readonly reason: string;
}

/** The whole committed declaration, validated. */
export interface DeterminismPolicy {
  /** The declared supported Node majors. */
  readonly engines: readonly number[];
  /** The fixed seed list every engine generates. */
  readonly seeds: readonly number[];
  /** How many artifacts each (format, seed) pair generates. */
  readonly artifactsPerPair: number;
  /** Pairs declared and deliberately not graded. */
  readonly exclusions: readonly ExclusionDeclaration[];
}

/** True for a plain JSON object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A whole number at or above zero. */
const isWholeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/**
 * Validate a declaration that has already been parsed from JSON.
 *
 * @param parsed - The parsed declaration.
 * @param label - How to name the declaration in a diagnostic (usually its path).
 * @returns The validated policy.
 * @throws Error when any member is missing or malformed. Nothing is defaulted.
 * @example
 * ```ts
 * const policy = validatePolicy(
 *   { engines: [22, 24], corpus: { artifactsPerPair: 3, seeds: [1] }, exclusions: [] },
 *   "inline",
 * );
 * policy.engines.length; // 2
 * ```
 */
export function validatePolicy(parsed: unknown, label: string): DeterminismPolicy {
  if (!isRecord(parsed)) throw new Error(`${label} did not parse to an object`);

  const rawEngines = parsed["engines"];
  if (!Array.isArray(rawEngines) || rawEngines.length === 0) {
    throw new Error(
      `${label} has no non-empty \`engines\` array, so no supported-engine set is declared. This ` +
        "set is a decision and cannot be read off `engines.node`, which is an open-ended range.",
    );
  }
  const engines: number[] = [];
  for (const [index, raw] of rawEngines.entries()) {
    if (!isWholeNumber(raw) || raw === 0) {
      throw new Error(`${label}: engines[${String(index)}] is not a whole Node major number`);
    }
    if (engines.includes(raw)) {
      throw new Error(`${label}: engines lists ${String(raw)} twice`);
    }
    engines.push(raw);
  }

  const corpus = parsed["corpus"];
  if (!isRecord(corpus)) throw new Error(`${label} has no \`corpus\` object`);

  const rawSeeds = corpus["seeds"];
  if (!Array.isArray(rawSeeds) || rawSeeds.length === 0) {
    throw new Error(
      `${label} declares no seeds, so the corpus is empty and a comparison over it would compare ` +
        "nothing while reporting a pass.",
    );
  }
  const seeds: number[] = [];
  for (const [index, raw] of rawSeeds.entries()) {
    if (!isWholeNumber(raw)) {
      throw new Error(
        `${label}: corpus.seeds[${String(index)}] is not a whole number, so the artifact it names ` +
          "could not be regenerated from this declaration.",
      );
    }
    if (seeds.includes(raw)) throw new Error(`${label}: corpus.seeds lists ${String(raw)} twice`);
    seeds.push(raw);
  }

  const artifactsPerPair = corpus["artifactsPerPair"];
  if (!isWholeNumber(artifactsPerPair) || artifactsPerPair === 0) {
    throw new Error(`${label}: corpus.artifactsPerPair is not a positive whole number`);
  }

  const rawExclusions = parsed["exclusions"];
  if (!Array.isArray(rawExclusions)) {
    throw new Error(
      `${label} has no \`exclusions\` array. An empty array is the declaration that nothing is ` +
        "excluded; an absent one is a declaration nobody made.",
    );
  }
  const exclusions: ExclusionDeclaration[] = [];
  for (const [index, raw] of rawExclusions.entries()) {
    if (!isRecord(raw)) throw new Error(`${label}: exclusions[${String(index)}] is not an object`);
    const format = raw["format"];
    const seed = raw["seed"];
    const reason = raw["reason"];
    if (typeof format !== "string" || format.length === 0) {
      throw new Error(`${label}: exclusions[${String(index)}] names no format`);
    }
    if (!isWholeNumber(seed)) {
      throw new Error(`${label}: exclusions[${String(index)}] ("${format}") names no whole seed`);
    }
    if (typeof reason !== "string" || reason.trim().length === 0) {
      throw new Error(
        `${label}: exclusions[${String(index)}] ("${format}", seed ${String(seed)}) has no ` +
          "reason. An exclusion is named and reasoned in the open or it is not made.",
      );
    }
    exclusions.push({ format, seed, reason: reason.trim() });
  }

  return { engines, seeds, artifactsPerPair, exclusions };
}

/**
 * Read and validate the committed declaration.
 *
 * @param path - The declaration file. Defaults to the committed one.
 * @returns The validated policy.
 * @throws Error when the file is missing, unparseable or malformed.
 * @example
 * ```ts
 * const policy = readPolicy();
 * policy.seeds.length > 0; // true
 * ```
 */
export function readPolicy(path: string = POLICY_PATH): DeterminismPolicy {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `the determinism declaration at ${path} could not be read: ${message}. Refusing rather ` +
        "than falling back to a default corpus nobody declared.",
      { cause: error },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`the determinism declaration at ${path} is not valid JSON: ${message}`, {
      cause: error,
    });
  }
  return validatePolicy(parsed, path);
}

/** The members of `package.json` this gate reads. */
export interface PackageFacts {
  /** The published package name, which a changeset has to name to declare a breaking change. */
  readonly name: string;
  /** The current version, which fixes the compatibility window a baseline belongs to. */
  readonly version: string;
  /** The `engines.node` range the declared engine set is reconciled against. */
  readonly engineRange: string;
}

/**
 * Read the package manifest members this gate reconciles against.
 *
 * @param path - The manifest. Defaults to this repository's.
 * @returns The name, version and `engines.node` range.
 * @throws Error when any of the three is missing.
 * @example
 * ```ts
 * const facts = readPackageFacts();
 * facts.engineRange; // ">=22.0.0"
 * ```
 */
export function readPackageFacts(path: string = PACKAGE_JSON_PATH): PackageFacts {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(parsed)) throw new Error(`${path} did not parse to an object`);
  const name = parsed["name"];
  const version = parsed["version"];
  const engines = parsed["engines"];
  if (typeof name !== "string" || name.length === 0) throw new Error(`${path} declares no name`);
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(`${path} declares no version, so no compatibility window can be identified`);
  }
  if (!isRecord(engines) || typeof engines["node"] !== "string") {
    throw new Error(
      `${path} declares no \`engines.node\` range, so the declared supported-engine set cannot be ` +
        "reconciled against the range the package publishes. Refusing rather than skipping the " +
        "reconciliation: an unreconciled declaration is the drift this gate exists to prevent.",
    );
  }
  return { name, version, engineRange: engines["node"] };
}

/**
 * The compatibility window a version belongs to.
 *
 * A seed-to-bytes mapping is promised inside a window and across nothing wider, which is what
 * `docs-content/limitations.md` has always said. The window is keyed on the MAJOR version, because
 * AC-level rule for this gate is that changing the mapping is a breaking change, and a breaking
 * change is a major one. A baseline carries the window it was generated in, so a baseline left
 * behind by a superseded window is caught rather than compared against.
 *
 * @param version - A package version.
 * @returns The window identifier.
 * @throws Error when the version has no leading whole-number major.
 * @example
 * ```ts
 * compatibilityWindow("0.0.9"); // "0.x"
 * ```
 */
export function compatibilityWindow(version: string): string {
  const major = /^(\d+)\./.exec(version)?.[1];
  if (major === undefined) {
    throw new Error(
      `"${version}" has no leading major version, so it names no compatibility window`,
    );
  }
  return `${major}.x`;
}
