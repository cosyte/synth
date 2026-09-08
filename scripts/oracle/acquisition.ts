/**
 * scripts/oracle/acquisition.ts
 *
 * PROVING WE GRADED AGAINST THE BINARY WE SAID WE WOULD.
 *
 * The oracle's value is that the verdict comes from somebody else's code. That value evaporates the
 * moment nobody can say WHICH somebody else's code: an unpinned download is a third party with write
 * access to this repository's gate, and "the validator says it is fine" means nothing if the
 * validator is whatever answered the URL this morning.
 *
 * So both acquired artifacts (the validator jar and the US Core package) carry a recorded identity in
 * `scripts/oracle/oracle-lock.json`, and this file compares what was downloaded against it BEFORE
 * anything is generated or graded. A mismatch fails the run at that point. It does not grade against
 * the unverified artifact and report the result with a caveat; a caveat on a graded run is a result
 * somebody will quote.
 *
 * WHY A DIGEST AND NOT ONLY A VERSION. A version-addressed source stops the bytes moving for a
 * reason this repository could have prevented; it does not stop them moving at all. Upstream
 * replaces published release assets in place, so the address can stay fixed while what it serves
 * does not. The digest is what makes the pin real: bytes moving behind a pinned address reds this
 * gate, loudly, and moving the pin is then a reviewed one-line commit that says which build the
 * verdicts after it came from.
 *
 * WHY AN ABSENT EXPECTED DIGEST IS A REFUSAL, NOT A BOOTSTRAP. A lock entry with no digest recorded
 * would otherwise mean "accept anything", which is the failure with extra steps. It refuses, and the
 * run prints the digest it observed so the pin can be recorded deliberately.
 *
 * THE OTHER HALF, `acquireArtifacts`, IS THE STEP BEFORE THAT ONE: an artifact that never arrived
 * cannot be compared against anything, so a download that fails stops the job right there, naming
 * the artifact and its pinned source. It performs no I/O of its own; the caller injects the
 * downloader, which is what lets the refusal be proven offline rather than only in CI.
 *
 * Pure: it compares strings, and sequences a downloader somebody else supplies. Nothing here opens
 * a socket or touches a disk, so every decision is testable offline. See
 * `test/oracle/acquisition.test.ts` and `test/oracle/ci-wiring.test.ts`.
 */

import type { PinnedKey } from "./lock.js";

/** What the repository RECORDS about an artifact it intends to grade with. */
export interface RecordedIdentity {
  /** The version the repository pinned. */
  readonly version: string;
  /** The sha256 the repository pinned, lower-case hex. Empty means nothing was recorded. */
  readonly sha256: string;
}

/** What was actually acquired. */
export interface ObservedIdentity {
  /** The version the acquisition reported. */
  readonly version: string;
  /** The sha256 of the bytes on disk, lower-case hex. */
  readonly sha256: string;
}

/** One artifact to check before anything is graded. */
export interface AcquisitionCheck {
  /** What the artifact is, for the diagnostic (`validator_cli.jar`, `hl7.fhir.us.core`). */
  readonly name: string;
  /** Where it came from, for the diagnostic and for the endpoint record. */
  readonly source: string;
  /** What the repository recorded. */
  readonly expected: RecordedIdentity;
  /** What arrived. */
  readonly observed: ObservedIdentity;
}

/** The outcome of the whole pre-grading check. */
export type AcquisitionVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusals: readonly string[] };

/** A sha256 as hex, case-insensitively, and nothing else. */
const SHA256_HEX = /^[0-9a-f]{64}$/i;

/** Compare two digests without letting case decide the answer. */
const sameDigest = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/**
 * Check every acquired artifact against the identity the repository recorded.
 *
 * @param checks - One entry per acquired artifact.
 * @returns `ok` when every artifact matches, otherwise every refusal, so one run reports all of them.
 * @example
 * ```ts
 * const verdict = verifyAcquisition([]);
 * verdict.ok; // false: a check over nothing proves nothing
 * ```
 */
export function verifyAcquisition(checks: readonly AcquisitionCheck[]): AcquisitionVerdict {
  const refusals: string[] = [];

  if (checks.length === 0) {
    return {
      ok: false,
      refusals: [
        "no acquired artifact was checked, so nothing was verified. A check over an empty set " +
          "passes vacuously, which is indistinguishable from a check that ran, and this gate does " +
          "not get to pass on that.",
      ],
    };
  }

  for (const check of checks) {
    if (check.expected.sha256.trim().length === 0) {
      refusals.push(
        `${check.name}: no sha256 is recorded in the repository for this artifact, so there is ` +
          "nothing to verify it against. An unrecorded identity is refused rather than read as " +
          `"accept anything". Observed sha256 was ${check.observed.sha256 || "(not computed)"}; ` +
          "record it in scripts/oracle/oracle-lock.json deliberately, in its own reviewed commit.",
      );
      continue;
    }
    if (!SHA256_HEX.test(check.expected.sha256)) {
      refusals.push(
        `${check.name}: the recorded sha256 "${check.expected.sha256}" is not 64 hex characters, ` +
          "so it cannot be a digest and cannot be compared.",
      );
      continue;
    }
    if (!SHA256_HEX.test(check.observed.sha256)) {
      refusals.push(
        `${check.name}: the acquired artifact from ${check.source} produced no readable sha256 ` +
          `("${check.observed.sha256}"), so it cannot be shown to be the pinned one.`,
      );
      continue;
    }
    if (!sameDigest(check.expected.sha256, check.observed.sha256)) {
      refusals.push(
        `${check.name}: INTEGRITY MISMATCH. ${check.source} served sha256 ` +
          `${check.observed.sha256.toLowerCase()}, and this repository pins ` +
          `${check.expected.sha256.toLowerCase()}. Refusing to grade against an unverified ` +
          "binary. If upstream released a new build, move the pin in a reviewed commit so the " +
          "verdicts after it say which build produced them.",
      );
      continue;
    }
    if (check.expected.version !== check.observed.version) {
      refusals.push(
        `${check.name}: VERSION MISMATCH. The acquisition reports "${check.observed.version}" and ` +
          `this repository pins "${check.expected.version}". The digest and the version have to ` +
          "agree, or one of the two is describing a different artifact.",
      );
    }
  }

  return refusals.length === 0 ? { ok: true } : { ok: false, refusals };
}

/** One artifact to fetch: the pinned address, and where its bytes are to land. */
export interface AcquisitionAttempt {
  /** Which entry of the pin this is, and the key it is recorded under. */
  readonly key: PinnedKey;
  /** What the artifact is, for the diagnostic. */
  readonly name: string;
  /** The pinned address. This is fetched, and this is what gets recorded. */
  readonly source: string;
  /** Where the bytes are to land, relative to the repository root. */
  readonly destination: string;
}

/** What the run records about one artifact it obtained. */
export interface AcquiredRecord {
  /** Which entry of the pin this is. */
  readonly key: PinnedKey;
  /** Where the bytes landed, relative to the repository root. */
  readonly path: string;
  /** The PINNED address it came from, which names its version. */
  readonly source: string;
}

/** Either everything arrived, or every reason something did not. */
export type AcquisitionOutcome =
  | { readonly ok: true; readonly acquired: readonly AcquiredRecord[] }
  | { readonly ok: false; readonly refusals: readonly string[] };

/**
 * Fetch every pinned artifact and record what was obtained.
 *
 * WHAT IS RECORDED IS THE PINNED ADDRESS, NOT WHERE THE FETCH ENDED UP. Following a release download
 * lands on a signed storage address naming a GUID and carrying a short-lived token; a verdict
 * quoting that says nothing to the person who reads it a month later, and it names no version, so a
 * run that recorded it could not state which release it graded with. The pin already names the
 * release, so the address asked for is the address recorded.
 *
 * @param attempts - One entry per pinned artifact.
 * @param download - Fetches a source into a destination, throwing when it cannot.
 * @returns What was acquired, or every refusal, each naming its artifact.
 * @example
 * ```ts
 * const outcome = acquireArtifacts([], () => undefined);
 * outcome.ok; // false: acquiring nothing is not acquiring everything
 * ```
 */
export function acquireArtifacts(
  attempts: readonly AcquisitionAttempt[],
  download: (source: string, destination: string) => void,
): AcquisitionOutcome {
  if (attempts.length === 0) {
    return {
      ok: false,
      refusals: [
        "no artifact was acquired, so there is nothing for the integrity check to verify and " +
          "nothing for the validator to run. An acquisition over an empty set succeeds vacuously, " +
          "which is indistinguishable from one that fetched the pinned artifacts.",
      ],
    };
  }

  const acquired: AcquiredRecord[] = [];
  const refusals: string[] = [];
  for (const attempt of attempts) {
    try {
      download(attempt.source, attempt.destination);
      acquired.push({ key: attempt.key, path: attempt.destination, source: attempt.source });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      refusals.push(
        `${attempt.name}: could not be obtained from its pinned source ${attempt.source} ` +
          `(${detail}). The job stops here rather than continuing with an absent artifact: a run ` +
          "that could not fetch the validator must not look like a run that graded cleanly.",
      );
    }
  }

  return refusals.length === 0 ? { ok: true, acquired } : { ok: false, refusals };
}
