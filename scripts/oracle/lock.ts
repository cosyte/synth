/**
 * scripts/oracle/lock.ts
 *
 * THE PIN, AND HOW AN ARTIFACT'S VERSION IS DERIVED WITHOUT ASKING IT.
 *
 * `oracle-lock.json` is the committed record of what this gate grades WITH: the validator jar and
 * the conformance package, each with the version and the sha256 this repository pins, plus the FHIR
 * version and the terminology setting the run is configured with. Moving any of them is a reviewed
 * commit, which is the whole point: a verdict is only attributable if the thing that passed it is.
 *
 * THE PINNED SOURCE IS WHAT NAMES THE VERSION, and that is the load-bearing rule here. A GitHub
 * release download spelled `/releases/download/<tag>/<file>` names its release in the address, and
 * the package registry spells `.../<package>/<version>`, so both can be identified before a byte is
 * fetched. Reading a tag out of a URL is a pure string operation this environment can test offline;
 * starting a JVM to ask the jar is not, and a version read from a banner is a version read from text
 * the tool chose to print.
 *
 * WHICH IS WHY A FLOATING SOURCE IS REFUSED RATHER THAN RESOLVED. `/releases/latest/download/<file>`
 * names no release, and neither does a `latest` segment on a registry address: both mean "whatever
 * upstream published most recently", which cannot agree with a recorded version for longer than
 * upstream stays still. `versionNamedBySource` answers with an empty string for those, and
 * `planAcquisition` turns that into a named refusal at the acquisition step, before anything is
 * downloaded.
 *
 * A VERSION-ADDRESSED SOURCE IS STILL NOT AN IMMUTABLE ONE. Upstream replaces published assets in
 * place, so the digest comparison in `acquisition.ts` stays exactly as strict as it is: this file
 * removes the drift that was guaranteed, not the drift that is possible.
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
 * What a version looks like in an address: a number, optionally behind a `v`.
 *
 * A SHAPE RULE RATHER THAN A LIST OF FLOATING SPELLINGS, deliberately. A list of the words that mean
 * "whatever was published most recently" (`latest`, `stable`, `current`, and whatever the next
 * registry calls it) accepts every spelling it does not happen to name, which is the wrong polarity
 * for a rule whose entire job is to refuse an address that identifies nothing. A version starts with
 * a number; `latest` and `validator_cli.jar` do not, and neither has to be enumerated to be refused.
 * A tag that genuinely does not start with a number reds here and is pinned deliberately or not at
 * all, which is the direction this gate is supposed to fail in.
 */
const VERSION_SHAPED = /^v?\d/;

/**
 * The version a download source NAMES, read out of the address itself.
 *
 * A GitHub release download is `/releases/download/<tag>/<file>`, so the tag is the version. Any
 * OTHER shape under `/releases/` names no single release: `/releases/latest/download/<file>` is the
 * one that matters, and reading its last segment would otherwise report the file name as a version.
 * Everything outside `/releases/` falls back to the last non-empty path segment, which is how the
 * FHIR package registry spells `.../hl7.fhir.us.core/6.1.0`. Whatever that lands on still has to
 * LOOK like a version (see `VERSION_SHAPED`), so a segment that names a moving target or a file
 * rather than a release answers with an empty string instead of a plausible-looking lie.
 *
 * @param source - The address the pin names for an artifact.
 * @returns The version it names, or an empty string when it names none.
 * @example
 * ```ts
 * versionNamedBySource("https://github.com/o/r/releases/download/6.6.9/validator_cli.jar");
 * // "6.6.9"
 * ```
 */
export function versionNamedBySource(source: string): string {
  let path: string;
  try {
    path = new URL(source).pathname;
  } catch {
    return "";
  }
  const segments = path.split("/").filter((s) => s.length > 0);
  const releases = segments.indexOf("releases");
  const named =
    releases >= 0
      ? segments[releases + 1] === "download"
        ? (segments[releases + 2] ?? "")
        : ""
      : (segments.at(-1) ?? "");
  return VERSION_SHAPED.test(named) ? named : "";
}

/** The pinned artifacts, in the order the run acquires and reports them. */
export type PinnedKey = "validator" | "conformancePackage";

/** One artifact the pin says to acquire, with the version its own source names. */
export interface PlannedArtifact {
  /** Which entry of the pin this came from. Also the key it is recorded under. */
  readonly key: PinnedKey;
  /** What the artifact is, for the diagnostics. */
  readonly name: string;
  /** The address the pin names, which is what gets downloaded AND what gets recorded. */
  readonly source: string;
  /** The version that source names, which agrees with the recorded version or this refuses. */
  readonly version: string;
}

/** Either every pinned artifact can be identified, or the reasons none of them will be fetched. */
export type AcquisitionPlan =
  | { readonly ok: true; readonly artifacts: readonly PlannedArtifact[] }
  | { readonly ok: false; readonly refusals: readonly string[] };

/**
 * What the pin says to acquire, refusing before anything is downloaded when a source cannot say
 * which version it serves or disagrees with the version recorded beside it.
 *
 * BOTH REFUSALS ARE ABOUT THE SAME FAILURE: a run that cannot name what it graded with. Resolving a
 * floating source at run time would produce a version, and a verdict quoting it would be telling a
 * reader which build happened to answer that morning rather than which build this repository chose.
 *
 * @param lock - The committed pin.
 * @returns The artifacts to fetch, or every refusal so one run reports all of them.
 * @example
 * ```ts
 * const plan = planAcquisition(readOracleLock());
 * plan.ok; // true: every pinned source names exactly one version, and it is the recorded one
 * ```
 */
export function planAcquisition(lock: OracleLock): AcquisitionPlan {
  const artifacts: PlannedArtifact[] = [];
  const refusals: string[] = [];

  const components: readonly (readonly [PinnedKey, PinnedComponent])[] = [
    ["validator", lock.validator],
    ["conformancePackage", lock.conformancePackage],
  ];

  for (const [key, component] of components) {
    const named = versionNamedBySource(component.downloadUrl);
    if (named.length === 0) {
      refusals.push(
        `${component.name}: its pinned source ${component.downloadUrl} names no single release or ` +
          "registry version, so a run using it could not say which build it graded with. A source " +
          "that resolves to whatever upstream published most recently is refused here rather than " +
          "resolved at acquisition time; pin the address of one published release instead.",
      );
      continue;
    }
    if (named !== component.version) {
      refusals.push(
        `${component.name}: SOURCE AND VERSION DISAGREE. The pinned source ` +
          `${component.downloadUrl} names "${named}" and this repository records ` +
          `"${component.version}". One of the two is describing a different artifact, and the ` +
          "digest recorded beside them can only belong to one of them.",
      );
      continue;
    }
    artifacts.push({ key, name: component.name, source: component.downloadUrl, version: named });
  }

  return refusals.length === 0 ? { ok: true, artifacts } : { ok: false, refusals };
}
