/**
 * scripts/determinism/baseline.ts
 *
 * THE COMMITTED BASELINE FOR THE CURRENT COMPATIBILITY WINDOW.
 *
 * A cross-engine comparison catches a mapping that moved on ONE engine. It is blind, by
 * construction, to a mapping that moved on ALL of them at once, which is precisely what a
 * toolchain or dependency change does: every job upgrades together, every job agrees, and the
 * golden file a consumer committed last month stops matching with nothing red anywhere. So each
 * per-engine run also compares its own digests against a BASELINE committed in this repository, and
 * any divergence fails that engine's job.
 *
 * THE BASELINE IS GENERATED, NEVER HAND-WRITTEN (`pnpm run determinism:digest --update-baseline`).
 * A hand-edited digest is a claim about bytes nobody generated.
 *
 * IT CARRIES THE WINDOW IT BELONGS TO, and a run whose package version has moved into a different
 * window FAILS rather than comparing against it. A stale baseline compared across a window boundary
 * would either red for a reason nobody can act on or, worse, pass because the two happened to
 * match; neither is the thing being asked. Regenerating the baseline is what a deliberate mapping
 * change looks like, and `check-determinism-window` is what makes that regeneration a declared
 * breaking change rather than a quiet commit.
 *
 * LIKE THE REPORT, IT CARRIES NO ARTIFACT CONTENT. Digests and identities only.
 */

import { readFileSync } from "node:fs";

import { pairKey, type DigestEntry } from "./corpus.js";
import type { DigestReport } from "./report.js";

/** The baseline shape this repository writes and reads. */
export const BASELINE_SCHEMA = "cosyte-synth-determinism-baseline/1";

/** The committed record of what a seed maps to inside one compatibility window. */
export interface Baseline {
  /** The baseline shape. */
  readonly schema: string;
  /** The package and the window this baseline is the mapping for. */
  readonly package: { readonly name: string; readonly version: string; readonly window: string };
  /** The hash the digests were taken with. */
  readonly digestAlgorithm: string;
  /** How many artifacts each (format, seed) pair generates. */
  readonly artifactsPerPair: number;
  /** One digest per graded (format, seed) pair. */
  readonly entries: readonly DigestEntry[];
}

/**
 * Build a baseline from a report the current run produced.
 *
 * @param report - The report to freeze. Its engine identity is deliberately NOT carried: a baseline
 *   is the mapping the window promises, not a record of one engine's run.
 * @returns The baseline.
 * @example
 * ```ts
 * const baseline = baselineFromReport(report);
 * baseline.schema; // "cosyte-synth-determinism-baseline/1"
 * ```
 */
export function baselineFromReport(report: DigestReport): Baseline {
  return {
    schema: BASELINE_SCHEMA,
    package: report.package,
    digestAlgorithm: report.digestAlgorithm,
    artifactsPerPair: report.artifactsPerPair,
    entries: [...report.entries].sort((a, b) =>
      pairKey(a.format, a.seed).localeCompare(pairKey(b.format, b.seed)),
    ),
  };
}

/** A baseline, serialized, with one trailing newline. */
export const renderBaseline = (baseline: Baseline): string =>
  `${JSON.stringify(baseline, null, 2)}\n`;

/** True for a plain JSON object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A whole number at or above zero. */
const isWholeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/** What reading a baseline produced. */
export type BaselineRead =
  | { readonly ok: true; readonly baseline: Baseline }
  | { readonly ok: false; readonly error: string };

/**
 * Parse a committed baseline, failing closed on every shape it does not recognise.
 *
 * @param text - The baseline text.
 * @returns The baseline, or the reason it is not one.
 * @example
 * ```ts
 * parseBaseline("{}").ok; // false
 * ```
 */
export function parseBaseline(text: string): BaselineRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `is not valid JSON (${message})` };
  }
  if (!isRecord(parsed)) return { ok: false, error: "did not parse to an object" };
  if (parsed["schema"] !== BASELINE_SCHEMA) {
    return {
      ok: false,
      error: `declares schema ${JSON.stringify(parsed["schema"])} rather than "${BASELINE_SCHEMA}"`,
    };
  }
  const pkg = parsed["package"];
  if (
    !isRecord(pkg) ||
    typeof pkg["name"] !== "string" ||
    typeof pkg["version"] !== "string" ||
    typeof pkg["window"] !== "string"
  ) {
    return { ok: false, error: "names no package, version and compatibility window" };
  }
  const digestAlgorithm = parsed["digestAlgorithm"];
  if (typeof digestAlgorithm !== "string" || digestAlgorithm.length === 0) {
    return { ok: false, error: "names no digest algorithm" };
  }
  const artifactsPerPair = parsed["artifactsPerPair"];
  if (!isWholeNumber(artifactsPerPair) || artifactsPerPair === 0) {
    return { ok: false, error: "names no positive artifacts-per-pair count" };
  }
  const rawEntries = parsed["entries"];
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    return { ok: false, error: "carries no non-empty `entries` array" };
  }
  const entries: DigestEntry[] = [];
  for (const [index, raw] of rawEntries.entries()) {
    if (
      !isRecord(raw) ||
      typeof raw["format"] !== "string" ||
      raw["format"].length === 0 ||
      !isWholeNumber(raw["seed"]) ||
      typeof raw["digest"] !== "string" ||
      !/^[0-9a-f]{64}$/.test(raw["digest"])
    ) {
      return { ok: false, error: `has a malformed entry at ${String(index)}` };
    }
    entries.push({ format: raw["format"], seed: raw["seed"], digest: raw["digest"] });
  }
  return {
    ok: true,
    baseline: {
      schema: BASELINE_SCHEMA,
      package: { name: pkg["name"], version: pkg["version"], window: pkg["window"] },
      digestAlgorithm,
      artifactsPerPair,
      entries,
    },
  };
}

/**
 * Compare one engine's report against the committed baseline for its window.
 *
 * @param report - The report this run produced.
 * @param baseline - The committed baseline.
 * @returns Every divergence found, empty when the mapping is unchanged.
 * @example
 * ```ts
 * compareToBaseline(report, baseline); // [] when every digest matches
 * ```
 */
export function compareToBaseline(report: DigestReport, baseline: Baseline): readonly string[] {
  const failures: string[] = [];

  if (report.package.window !== baseline.package.window) {
    failures.push(
      `the committed baseline is for compatibility window ${baseline.package.window} and this ` +
        `run is in window ${report.package.window}. A baseline is the mapping ONE window ` +
        "promises, so it is not compared across a window boundary. Regenerate it as part of the " +
        "change that opened the new window.",
    );
    return failures;
  }
  if (report.digestAlgorithm !== baseline.digestAlgorithm) {
    failures.push(
      `this run digests with ${report.digestAlgorithm} and the committed baseline was taken with ` +
        `${baseline.digestAlgorithm}, so the two are not comparable.`,
    );
    return failures;
  }
  if (report.artifactsPerPair !== baseline.artifactsPerPair) {
    failures.push(
      `this run generates ${String(report.artifactsPerPair)} artifact(s) per pair and the ` +
        `committed baseline was taken over ${String(baseline.artifactsPerPair)}, so the two are ` +
        "about different corpora.",
    );
    return failures;
  }

  const committed = new Map(
    baseline.entries.map((entry) => [pairKey(entry.format, entry.seed), entry.digest]),
  );
  const produced = new Map(
    report.entries.map((entry) => [pairKey(entry.format, entry.seed), entry.digest]),
  );

  for (const key of [...committed.keys()].sort()) {
    if (!produced.has(key)) {
      failures.push(
        `the committed baseline records ${key} and this run digested no such pair, so the ` +
          "declared corpus has shrunk without the baseline being regenerated.",
      );
    }
  }
  for (const key of [...produced.keys()].sort()) {
    if (!committed.has(key)) {
      failures.push(
        `this run digested ${key} and the committed baseline records no such pair, so the ` +
          "declared corpus has grown without the baseline being regenerated.",
      );
    }
  }
  for (const [key, digest] of [...produced].sort(([a], [b]) => a.localeCompare(b))) {
    const expected = committed.get(key);
    if (expected !== undefined && expected !== digest) {
      failures.push(
        `${key}: this engine no longer produces the bytes the committed baseline records for the ` +
          "current compatibility window. A toolchain or dependency change that moves every engine " +
          "together is still a change to the seed-to-bytes mapping.",
      );
    }
  }

  return failures;
}

/**
 * Read the committed baseline from disk.
 *
 * @param path - The baseline file.
 * @returns The baseline.
 * @throws Error when it is missing or malformed. There is no default: a run that cannot read the
 *   baseline is a run that cannot say whether the mapping moved.
 * @example
 * ```ts
 * readBaseline(BASELINE_PATH).entries.length > 0; // true
 * ```
 */
export function readBaseline(path: string): Baseline {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `the committed determinism baseline at ${path} could not be read: ${message}. Without it ` +
        "this run cannot say whether a toolchain change moved the seed-to-bytes mapping on every " +
        "engine at once, so it fails rather than reporting a pass it has not earned.",
      { cause: error },
    );
  }
  const read = parseBaseline(text);
  if (!read.ok) throw new Error(`the committed determinism baseline at ${path} ${read.error}`);
  return read.baseline;
}
