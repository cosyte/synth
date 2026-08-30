/**
 * scripts/oracle/lock.ts
 *
 * THE PIN, AND HOW A DOWNLOADED ARTIFACT'S VERSION IS DERIVED WITHOUT ASKING IT.
 *
 * `oracle-lock.json` is the committed record of what this gate grades WITH: the validator jar and
 * the conformance package, each with the version and the sha256 this repository pins, plus the FHIR
 * version and the terminology setting the run is configured with. Moving any of them is a reviewed
 * commit, which is the whole point: a verdict is only attributable if the thing that passed it is.
 *
 * DERIVING THE OBSERVED VERSION FROM THE RESOLVED URL, and why that beats asking the artifact. The
 * validator's own README publishes a download that resolves to the LATEST release, so the bytes that
 * arrive carry no version this side of running them. GitHub redirects that download to
 * `/releases/download/<tag>/validator_cli.jar`, so the effective URL after redirects names the
 * release, and the acquisition records it. Reading a tag out of a URL is a pure string operation this
 * environment can test offline; starting a JVM to ask the jar is not, and a version read from a
 * banner is a version read from text the tool chose to print.
 *
 * The package registry needs no such trick: the requested URL carries the version, so the same
 * extraction covers both by taking the last path segment when there is no release marker.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "./formats.js";

/** Where the committed pin lives. */
export const ORACLE_LOCK_PATH = join(REPO_ROOT, "scripts", "oracle", "oracle-lock.json");

/** One pinned external artifact. */
export interface PinnedComponent {
  /** What it is, for the record and the diagnostics. */
  readonly name: string;
  /** Where it is fetched from. This is also an endpoint the run contacts. */
  readonly downloadUrl: string;
  /** The version this repository pins. Empty means nothing is pinned, which is refused. */
  readonly version: string;
  /** The sha256 this repository pins, lower-case hex. Empty is refused. */
  readonly sha256: string;
}

/** The whole pin. */
export interface OracleLock {
  /** The external validator. */
  readonly validator: PinnedComponent;
  /** The conformance package the artifacts are graded against. */
  readonly conformancePackage: PinnedComponent;
  /** The FHIR version the validator is told to read the artifacts as. */
  readonly fhirVersion: string;
  /**
   * The terminology server the run is configured to use, or `null` for none.
   *
   * `null` is a DECLARATION, not a silence: it is passed to the validator explicitly so the endpoint
   * record is the configured set rather than a guess at a default, and so a reader can see that no
   * generated content leaves the runner for terminology resolution. Terminology-bound checks are
   * therefore not part of this verdict, which the coverage declaration and the published limitations
   * page both say in words.
   */
  readonly terminologyServer: string | null;
}

/** True for a plain JSON object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Narrow one pinned component, refusing anything that is not fully spelled out. */
function readComponent(raw: unknown, where: string): PinnedComponent {
  if (!isRecord(raw)) throw new Error(`${where} is not an object`);
  const name = raw["name"];
  const downloadUrl = raw["downloadUrl"];
  const version = raw["version"];
  const sha256 = raw["sha256"];
  if (typeof name !== "string" || name.length === 0) throw new Error(`${where} has no name`);
  if (typeof downloadUrl !== "string" || !downloadUrl.startsWith("https://")) {
    throw new Error(`${where} has no https download URL, so it names no source`);
  }
  if (typeof version !== "string") throw new Error(`${where} has no version field`);
  if (typeof sha256 !== "string") throw new Error(`${where} has no sha256 field`);
  return { name, downloadUrl, version, sha256 };
}

/**
 * Read the committed pin.
 *
 * @param path - The lock file. Defaults to the committed one.
 * @returns The pinned components and the run configuration.
 * @throws Error when the lock is missing or a component is not fully spelled out.
 * @example
 * ```ts
 * const lock = readOracleLock();
 * lock.fhirVersion; // "4.0.1"
 * ```
 */
export function readOracleLock(path: string = ORACLE_LOCK_PATH): OracleLock {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(parsed)) throw new Error(`${path} did not parse to an object`);
  const fhirVersion = parsed["fhirVersion"];
  if (typeof fhirVersion !== "string" || fhirVersion.length === 0) {
    throw new Error(`${path} names no fhirVersion, so the validator would be told nothing`);
  }
  const terminology = parsed["terminologyServer"];
  if (terminology !== null && typeof terminology !== "string") {
    throw new Error(
      `${path}: terminologyServer must be a URL or null. It is a declaration either way, because ` +
        "it decides whether generated content leaves the runner.",
    );
  }
  return {
    validator: readComponent(parsed["validator"], `${path}: validator`),
    conformancePackage: readComponent(parsed["conformancePackage"], `${path}: conformancePackage`),
    fhirVersion,
    terminologyServer: terminology,
  };
}

/**
 * The version an acquired artifact's resolved URL names.
 *
 * A GitHub release download resolves to `/releases/download/<tag>/<file>`, so the tag is the
 * version. Anything else falls back to the last non-empty path segment, which is how the FHIR
 * package registry spells `.../hl7.fhir.us.core/6.1.0`.
 *
 * @param resolvedUrl - The URL the download ended at, after redirects.
 * @returns The version it names, or an empty string when it names none.
 * @example
 * ```ts
 * versionFromResolvedUrl("https://github.com/o/r/releases/download/6.6.9/validator_cli.jar");
 * // "6.6.9"
 * ```
 */
export function versionFromResolvedUrl(resolvedUrl: string): string {
  let path: string;
  try {
    path = new URL(resolvedUrl).pathname;
  } catch {
    return "";
  }
  const segments = path.split("/").filter((s) => s.length > 0);
  const marker = segments.findIndex((s, i) => s === "download" && segments[i - 1] === "releases");
  if (marker >= 0) return segments[marker + 1] ?? "";
  return segments.at(-1) ?? "";
}
