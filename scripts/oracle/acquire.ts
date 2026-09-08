#!/usr/bin/env tsx
/**
 * scripts/oracle/acquire.ts
 *
 * THE ACQUISITION STEP. Reached by `pnpm run oracle:acquire`, and run by the CI oracle job before
 * `pnpm run oracle` grades anything.
 *
 * It fetches the two artifacts the committed pin names and leaves `.oracle/acquisition.json` behind
 * saying where each one landed and which address it came from. THE ADDRESS IT RECORDS IS THE PINNED
 * ONE. That is the whole difference between this file and the shell step it replaced: that step had
 * to read a redirect to discover which release a floating `latest` download would serve, and the
 * first run of the job recorded the signed storage GUID at the end of the redirect chain as the
 * validator's "version". With the pin naming a release, there is nothing to resolve: the address
 * asked for is the address recorded, and it names its own version.
 *
 * THIS FILE IS DELIBERATELY THIN, for the same reason `run.ts` is. It shells out to curl, hashes
 * what arrived, writes one JSON file and sets an exit code. Every decision it takes belongs to a
 * pure module beside it, because the environment that writes this code has neither egress nor a JRE:
 *
 *   scripts/oracle/lock.ts         which addresses, and does each one name exactly one version?
 *   scripts/oracle/acquisition.ts  did everything arrive, and what is recorded about it?
 *
 * IT DOES NOT VERIFY THE DIGEST, and that is not an omission. `run.ts` compares what arrived against
 * the pin before it generates or grades anything, so the check sits in front of the grading rather
 * than in front of the download, where a passing acquisition step could be mistaken for a verified
 * one. This step prints the digest it observed, which is the evidence a pin move is made from.
 *
 * NO ESCAPE HATCH. Every failure below exits non-zero and names the artifact. A step that cannot
 * obtain the validator and lets the job continue would hand `run.ts` an absent artifact, and
 * "nothing could be downloaded" must never be reported the way "nothing was wrong" is.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { acquireArtifacts, type AcquisitionAttempt } from "./acquisition.js";
import { REPO_ROOT } from "./formats.js";
import { planAcquisition, readOracleLock, type PinnedKey } from "./lock.js";

/** Where the job leaves what it downloaded, relative to the repository root. */
const ACQUISITION_DIR = ".oracle";

/** What each pinned artifact is called on disk. The pin names addresses, not file names. */
const FILE_NAMES: Record<PinnedKey, string> = {
  validator: "validator_cli.jar",
  conformancePackage: "us-core.tgz",
};

/** Refuse loudly. A step that could not do its job never lets the job continue past it. */
function refuse(message: string): never {
  process.stderr.write(`\noracle: REFUSING TO ACQUIRE\n  ${message}\n`);
  process.exit(1);
}

/**
 * Fetch one address into one file, throwing when curl cannot.
 *
 * Redirects are followed, because a release download is served through them; where the chain ENDS
 * is simply not recorded anywhere. The runner image ships curl, so this takes no dependency on a
 * third-party action to obtain a file.
 */
function curlInto(source: string, destination: string): void {
  const result = spawnSync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--retry",
      "3",
      "--output",
      join(REPO_ROOT, destination),
      source,
    ],
    { encoding: "utf8" },
  );
  if (result.error !== undefined) {
    throw new Error(`curl could not be started: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`curl exited ${String(result.status)}: ${(result.stderr ?? "").trim()}`);
  }
}

const lock = readOracleLock();
const plan = planAcquisition(lock);
if (!plan.ok) {
  refuse(
    "the committed pin does not name a version for every artifact it pins, so nothing was " +
      `downloaded:\n  - ${plan.refusals.join("\n  - ")}`,
  );
}

mkdirSync(join(REPO_ROOT, ACQUISITION_DIR), { recursive: true });

const attempts: readonly AcquisitionAttempt[] = plan.artifacts.map((artifact) => ({
  key: artifact.key,
  name: artifact.name,
  source: artifact.source,
  destination: `${ACQUISITION_DIR}/${FILE_NAMES[artifact.key]}`,
}));

const outcome = acquireArtifacts(attempts, curlInto);
if (!outcome.ok) {
  refuse(`the pinned artifacts could not be acquired:\n  - ${outcome.refusals.join("\n  - ")}`);
}

const manifest: Record<string, { path: string; source: string }> = {};
for (const record of outcome.acquired) {
  manifest[record.key] = { path: record.path, source: record.source };
}
writeFileSync(
  join(REPO_ROOT, ACQUISITION_DIR, "acquisition.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

// The log is where a pin move is decided from, so it carries the identity, not just the outcome.
//
// ONE READ PER ARTIFACT, and the size comes from the bytes that were hashed rather than from a
// separate `statSync`. Two reads of one path are two different files if anything writes between
// them, so a size and a digest sourced separately can describe different things, and a digest
// reported next to somebody else's byte count is the kind of evidence a pin move gets made from.
for (const artifact of plan.artifacts) {
  const bytes = readFileSync(join(REPO_ROOT, manifest[artifact.key]?.path ?? ""));
  process.stdout.write(
    `oracle: acquired ${artifact.name}\n` +
      `  from    ${artifact.source}\n` +
      `  version ${artifact.version}\n` +
      `  bytes   ${String(bytes.byteLength)}\n` +
      `  sha256  ${createHash("sha256").update(bytes).digest("hex")}\n`,
  );
}
