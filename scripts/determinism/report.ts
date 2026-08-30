/**
 * scripts/determinism/report.ts
 *
 * THE PER-ENGINE DIGEST REPORT: THE ONLY THING THAT LEAVES A DIGEST JOB.
 *
 * A report carries one digest per declared (format, seed) pair, the identity of the engine that
 * produced it, the corpus parameters it was taken under, and the declared exclusions. IT CARRIES NO
 * GENERATED ARTIFACT CONTENT, and that is not a style preference:
 *
 *   * The whole point of comparing digests rather than artifacts is that a digest of a synthetic
 *     fixture is inert. `pnpm phi-scan` with no arguments reconciles its walk against `git ls-files`
 *     and reads EVERY tracked file, so anything this gate commits is in its scope. A report or a
 *     baseline carrying artifact bytes would put generated fixture content into a permanently
 *     tracked file and into the scanner's reach, to buy nothing the comparison needs.
 *   * A mismatch is identified by seed, format and engine identity ALONE. Naming the differing
 *     bytes would make a red build the place a reader goes to read generated output, and it is not
 *     needed: the corpus is reproducible by seed on any machine, so anyone can regenerate both
 *     sides without access to the job.
 *
 * THE ENGINE IDENTITY IS THE MAJOR, not the full version. Two jobs on the same major with different
 * patch releases must be comparable, and the declared supported set is a set of majors, so keying
 * the comparison on anything finer would make it impossible to satisfy. The full `process.version`
 * rides along in the report as a record of what actually ran.
 *
 * PARSING FAILS CLOSED. Every shape check below returns a reason rather than a partially-trusted
 * object, and the comparison turns any reason into a failed run. An unreadable report is never
 * treated as agreement: "we could not read what that engine produced" and "that engine produced
 * the same bytes" must never look the same from outside.
 */

import { writeFileSync } from "node:fs";

import type { DigestEntry } from "./corpus.js";
import type { ExclusionDeclaration } from "./policy.js";

/** The report shape this repository writes and reads. Carried in the file so a change is visible. */
export const REPORT_SCHEMA = "cosyte-synth-determinism-report/1";

/** The engine identity a report is filed under and a diagnostic names. */
export const engineId = (major: number): string => `node-${String(major)}`;

/** The file name a report for one engine is carried in. */
export const reportFileName = (major: number): string => `${engineId(major)}.json`;

/** Which engine produced a report. */
export interface EngineIdentity {
  /** The comparison key: `node-<major>`. */
  readonly id: string;
  /** The Node major. */
  readonly nodeMajor: number;
  /** The full `process.version` of the run that produced the report, for the record. */
  readonly nodeVersion: string;
}

/** One per-engine digest report. */
export interface DigestReport {
  /** The report shape. */
  readonly schema: string;
  /** The engine that produced it. */
  readonly engine: EngineIdentity;
  /** The package, and the version whose compatibility window this report belongs to. */
  readonly package: { readonly name: string; readonly version: string; readonly window: string };
  /** The hash the digests were taken with. */
  readonly digestAlgorithm: string;
  /** How many artifacts each (format, seed) pair generated. */
  readonly artifactsPerPair: number;
  /** One digest per graded (format, seed) pair. */
  readonly entries: readonly DigestEntry[];
  /** The declared exclusions, published so a narrowed corpus is never a quiet one. */
  readonly excluded: readonly ExclusionDeclaration[];
}

/**
 * The engine identity of the running process.
 *
 * @param version - A `process.version` string. Defaults to this process's.
 * @returns The identity a report is filed under.
 * @throws Error when the version carries no whole-number major.
 * @example
 * ```ts
 * currentEngine("v22.11.0").id; // "node-22"
 * ```
 */
export function currentEngine(version: string = process.version): EngineIdentity {
  const major = /^v?(\d+)\./.exec(version)?.[1];
  if (major === undefined) {
    throw new Error(
      `"${version}" carries no Node major, so this run cannot say which engine produced its ` +
        "digests. A report that cannot name its engine is worthless to a cross-engine comparison.",
    );
  }
  return { id: engineId(Number(major)), nodeMajor: Number(major), nodeVersion: version };
}

/** What `buildReport` needs to know. */
export interface ReportInput {
  /** The producing engine. */
  readonly engine: EngineIdentity;
  /** The package name. */
  readonly packageName: string;
  /** The package version. */
  readonly packageVersion: string;
  /** The compatibility window that version belongs to. */
  readonly window: string;
  /** The hash the digests were taken with. */
  readonly digestAlgorithm: string;
  /** Artifacts generated per pair. */
  readonly artifactsPerPair: number;
  /** The digests. */
  readonly entries: readonly DigestEntry[];
  /** The declared exclusions. */
  readonly excluded: readonly ExclusionDeclaration[];
}

/**
 * Build a per-engine digest report.
 *
 * @param input - Everything the report records.
 * @returns The report.
 * @example
 * ```ts
 * const report = buildReport({ ...input });
 * report.schema; // "cosyte-synth-determinism-report/1"
 * ```
 */
export function buildReport(input: ReportInput): DigestReport {
  return {
    schema: REPORT_SCHEMA,
    engine: input.engine,
    package: { name: input.packageName, version: input.packageVersion, window: input.window },
    digestAlgorithm: input.digestAlgorithm,
    artifactsPerPair: input.artifactsPerPair,
    entries: input.entries,
    excluded: input.excluded,
  };
}

/** True for a plain JSON object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A whole number at or above zero. */
const isWholeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/** A lower-case hex digest of the expected width. */
const isDigest = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

/** What reading a report produced: a report, or the reason there is not one. */
export type ReportRead =
  | { readonly ok: true; readonly report: DigestReport }
  | { readonly ok: false; readonly error: string };

/**
 * Parse a per-engine digest report, failing closed on every shape it does not recognise.
 *
 * @param text - The report text.
 * @returns The report, or the reason it is not one.
 * @example
 * ```ts
 * parseReport("{").ok; // false
 * ```
 */
export function parseReport(text: string): ReportRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `is not valid JSON (${message})` };
  }
  if (!isRecord(parsed)) return { ok: false, error: "did not parse to an object" };
  if (parsed["schema"] !== REPORT_SCHEMA) {
    return {
      ok: false,
      error: `declares schema ${JSON.stringify(parsed["schema"])} rather than "${REPORT_SCHEMA}"`,
    };
  }

  const engine = parsed["engine"];
  if (
    !isRecord(engine) ||
    typeof engine["id"] !== "string" ||
    !isWholeNumber(engine["nodeMajor"]) ||
    typeof engine["nodeVersion"] !== "string"
  ) {
    return { ok: false, error: "names no engine identity" };
  }
  if (engine["id"] !== engineId(engine["nodeMajor"])) {
    return {
      ok: false,
      error:
        `has engine id "${engine["id"]}" and Node major ${String(engine["nodeMajor"])}, which ` +
        "do not agree",
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
  if (!Array.isArray(rawEntries)) return { ok: false, error: "carries no `entries` array" };
  const entries: DigestEntry[] = [];
  const seen = new Set<string>();
  for (const [index, raw] of rawEntries.entries()) {
    if (!isRecord(raw)) return { ok: false, error: `has a non-object entry at ${String(index)}` };
    const format = raw["format"];
    const seed = raw["seed"];
    const digest = raw["digest"];
    if (typeof format !== "string" || format.length === 0 || !isWholeNumber(seed)) {
      return { ok: false, error: `has an entry at ${String(index)} naming no format and seed` };
    }
    if (!isDigest(digest)) {
      return {
        ok: false,
        error: `has an entry at ${String(index)} ("${format}", seed ${String(seed)}) whose digest is not 64 lower-case hex characters`,
      };
    }
    const key = `${format}/seed-${String(seed)}`;
    if (seen.has(key)) return { ok: false, error: `names ${key} twice` };
    seen.add(key);
    entries.push({ format, seed, digest });
  }

  const rawExcluded = parsed["excluded"];
  if (!Array.isArray(rawExcluded)) return { ok: false, error: "carries no `excluded` array" };
  const excluded: ExclusionDeclaration[] = [];
  for (const [index, raw] of rawExcluded.entries()) {
    if (
      !isRecord(raw) ||
      typeof raw["format"] !== "string" ||
      !isWholeNumber(raw["seed"]) ||
      typeof raw["reason"] !== "string" ||
      raw["reason"].trim().length === 0
    ) {
      return { ok: false, error: `has an exclusion at ${String(index)} that names no reason` };
    }
    excluded.push({ format: raw["format"], seed: raw["seed"], reason: raw["reason"] });
  }

  return {
    ok: true,
    report: {
      schema: REPORT_SCHEMA,
      engine: {
        id: engine["id"],
        nodeMajor: engine["nodeMajor"],
        nodeVersion: engine["nodeVersion"],
      },
      package: { name: pkg["name"], version: pkg["version"], window: pkg["window"] },
      digestAlgorithm,
      artifactsPerPair,
      entries,
      excluded,
    },
  };
}

/** A report, serialized. One trailing newline, so the file is a well-formed text file. */
export const renderReport = (report: DigestReport): string =>
  `${JSON.stringify(report, null, 2)}\n`;

/**
 * Write a digest report, naming the destination when it cannot be written.
 *
 * IT DOES NOT CREATE THE DIRECTORY, deliberately. A destination that does not exist, or that cannot
 * be written to, is a FAILED RUN with the path in the message, not a run that quietly produced no
 * report and exited 0: those two must never look the same from outside. The caller creates the
 * directory first, through `prepareReportDirectory`, which fails the same way.
 *
 * @param path - Where to write.
 * @param report - The report.
 * @throws Error naming the destination when the write fails for any reason.
 * @example
 * ```ts
 * writeReport(join(REPORT_DIR, reportFileName(22)), report);
 * ```
 */
export function writeReport(path: string, report: DigestReport): void {
  try {
    writeFileSync(path, renderReport(report));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `the digest report could not be written to ${path}: ${message}. This run FAILS rather than ` +
        "exiting successfully having produced no report: a missing report and an agreeing one " +
        "must never look the same to the cross-engine comparison.",
      { cause: error },
    );
  }
}
