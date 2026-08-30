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
 * WHY A DIGEST AND NOT ONLY A VERSION. The download URL the validator's own README publishes resolves
 * to the LATEST release, so the version alone moves under us without a commit here. The digest is
 * what makes the pin real: upstream moving reds this gate, loudly, and moving the pin is then a
 * reviewed one-line commit that says which build the verdicts after it came from.
 *
 * WHY AN ABSENT EXPECTED DIGEST IS A REFUSAL, NOT A BOOTSTRAP. A lock entry with no digest recorded
 * would otherwise mean "accept anything", which is the failure with extra steps. It refuses, and the
 * run prints the digest it observed so the pin can be recorded deliberately.
 *
 * Pure: it compares strings. The downloading and the hashing happen in the runner; every decision
 * this file makes is testable offline. See `test/oracle/acquisition.test.ts`.
 */

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
