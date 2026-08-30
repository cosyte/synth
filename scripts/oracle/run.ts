#!/usr/bin/env tsx
/**
 * scripts/oracle/run.ts
 *
 * THE ORACLE RUN. Reached by `pnpm run oracle`.
 *
 * Every "spec-clean" claim this package makes today is `artifact.warnings === []` where the artifact
 * was built by the same library that reads it back, so a shared misreading of a standard is
 * invisible to the check and a consumer has no way to point at anyone but us. This run asks an
 * independent, HL7-maintained validator instead: it regenerates a declared, seeded corpus of FHIR R4
 * artifacts, has that validator grade each one against the US Core package this repository pins, and
 * turns the validator's OWN report into the verdict.
 *
 * THIS FILE IS THE ONLY IMPURE PART, AND IT IS DELIBERATELY THIN. It downloads nothing itself, hashes
 * files, starts a JVM, writes two files and sets an exit code. Every decision it takes is delegated
 * to a pure module beside it, because the environment that writes this code has no Java and no
 * egress, and a gate whose behaviour can only be observed in CI is a gate nobody can test:
 *
 *   scripts/oracle/acquisition.ts  is what we graded with the thing we pinned?
 *   scripts/oracle/formats.ts      which formats does this library actually generate?
 *   scripts/oracle/coverage.ts     what do we claim a verdict on, and what do we not?
 *   scripts/oracle/corpus.ts       what is graded, from which seeds, against which profile?
 *   scripts/oracle/report.ts       what does one validator report say, and when is it unreadable?
 *   scripts/oracle/gate.ts         pass or fail, and why
 *   scripts/oracle/verdict.ts      the record: validator, package, endpoints, per-artifact outcome
 *
 * THE ORDER MATTERS AND IS PART OF THE CONTRACT. The acquisition identity is checked BEFORE anything
 * is generated or graded, so a run that could not prove which validator it has never produces a
 * finding about this package's output at all.
 *
 * ACQUISITION IS THE WORKFLOW'S JOB, VERIFICATION IS THIS FILE'S. The CI job downloads the two
 * artifacts and writes `.oracle/acquisition.json` naming where each one landed and the URL the
 * download resolved to after redirects. A missing or unreadable manifest is a FAILED RUN, never a
 * skip: "the validator could not be acquired" and "the artifacts are fine" must never look the same
 * from outside.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { verifyAcquisition, type AcquisitionCheck } from "./acquisition.js";
import {
  buildCoverageDeclaration,
  independentlyGradedFormats,
  readCoveragePolicy,
} from "./coverage.js";
import { fhirCorpusGenerator, generateDeclaredCorpus, readCorpusDeclaration } from "./corpus.js";
import { generatedFormats, REPO_ROOT } from "./formats.js";
import { decideGate, type GradedArtifact, type ReportSource } from "./gate.js";
import { readOracleLock, versionFromResolvedUrl, type OracleLock } from "./lock.js";
import { buildVerdict, renderVerdict, type GradingComponent } from "./verdict.js";

/** Where the CI job leaves what it downloaded, and where this run leaves what it decided. */
const ACQUISITION_DIR = join(REPO_ROOT, ".oracle");
const ACQUISITION_MANIFEST = join(ACQUISITION_DIR, "acquisition.json");
const OUTPUT_DIR = join(REPO_ROOT, ".oracle", "out");

/** Refuse loudly. A run that cannot do its job never reports a result from one that did not. */
function refuse(message: string): never {
  process.stderr.write(`\noracle: REFUSING TO REPORT\n  ${message}\n`);
  process.exit(1);
}

/** True for a plain JSON object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** One acquired file, as the workflow recorded it. */
interface AcquiredArtifact {
  readonly path: string;
  readonly resolvedUrl: string;
}

/** Read what the workflow says it downloaded. */
function readAcquisitionManifest(): {
  validator: AcquiredArtifact;
  conformancePackage: AcquiredArtifact;
} {
  if (!existsSync(ACQUISITION_MANIFEST)) {
    refuse(
      `${ACQUISITION_MANIFEST} does not exist, so the external validator was never acquired. The ` +
        "run FAILS rather than skipping: an ungraded corpus is not a passing one, and no format " +
        "is reported as covered. The CI job writes this manifest after downloading the pinned " +
        "validator and package.",
    );
  }
  const parsed: unknown = JSON.parse(readFileSync(ACQUISITION_MANIFEST, "utf8"));
  if (!isRecord(parsed)) refuse(`${ACQUISITION_MANIFEST} did not parse to an object`);
  const read = (key: string): AcquiredArtifact => {
    const raw = parsed[key];
    if (
      !isRecord(raw) ||
      typeof raw["path"] !== "string" ||
      typeof raw["resolvedUrl"] !== "string"
    ) {
      refuse(`${ACQUISITION_MANIFEST}: "${key}" does not name a path and a resolved URL`);
    }
    return { path: raw["path"], resolvedUrl: raw["resolvedUrl"] };
  };
  return { validator: read("validator"), conformancePackage: read("conformancePackage") };
}

/** The sha256 of a file, lower-case hex, or an empty string when it cannot be read. */
function sha256OfFile(path: string): string {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return "";
  }
}

/** Build the pre-grading integrity checks from the pin and what actually arrived. */
function acquisitionChecks(
  lock: OracleLock,
  acquired: { validator: AcquiredArtifact; conformancePackage: AcquiredArtifact },
): readonly AcquisitionCheck[] {
  return [
    {
      name: lock.validator.name,
      source: acquired.validator.resolvedUrl,
      expected: { version: lock.validator.version, sha256: lock.validator.sha256 },
      observed: {
        version: versionFromResolvedUrl(acquired.validator.resolvedUrl),
        sha256: sha256OfFile(acquired.validator.path),
      },
    },
    {
      name: lock.conformancePackage.name,
      source: acquired.conformancePackage.resolvedUrl,
      expected: {
        version: lock.conformancePackage.version,
        sha256: lock.conformancePackage.sha256,
      },
      observed: {
        version: versionFromResolvedUrl(acquired.conformancePackage.resolvedUrl),
        sha256: sha256OfFile(acquired.conformancePackage.path),
      },
    },
  ];
}

/**
 * Run the external validator over one artifact and hand back its report, or the reason there is
 * none. Every non-report outcome (a JVM that would not start, a non-zero exit with no output file,
 * an output file that vanished) becomes an ABSENT report, which the gate turns into a failed run.
 */
function gradeOne(
  jar: string,
  packageTgz: string,
  lock: OracleLock,
  artifactPath: string,
  profile: string,
  reportPath: string,
): ReportSource {
  const args = [
    "-jar",
    jar,
    artifactPath,
    "-version",
    lock.fhirVersion,
    "-ig",
    packageTgz,
    "-profile",
    profile,
    "-tx",
    lock.terminologyServer ?? "n/a",
    "-output",
    reportPath,
  ];
  const result = spawnSync("java", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const tail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    .trim()
    .split("\n")
    .slice(-20)
    .join("\n");

  if (result.error !== undefined) {
    return {
      kind: "absent",
      detail: `the validator could not be started (${result.error.message})`,
    };
  }
  if (!existsSync(reportPath)) {
    return {
      kind: "absent",
      detail:
        `the validator exited ${String(result.status)} without writing a report to ${reportPath}. ` +
        `Last output:\n${tail}`,
    };
  }
  try {
    return { kind: "text", text: readFileSync(reportPath, "utf8") };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "absent", detail: `the report at ${reportPath} could not be read: ${message}` };
  }
}

async function main(): Promise<void> {
  const lock = readOracleLock();
  const acquired = readAcquisitionManifest();

  // 1. IDENTITY FIRST. Nothing is generated and nothing is graded until we can say which validator
  //    and which package this run is using.
  const checks = acquisitionChecks(lock, acquired);
  const acquisition = verifyAcquisition(checks);
  for (const check of checks) {
    process.stdout.write(
      `oracle: acquired ${check.name}\n  from    ${check.source}\n  version ${check.observed.version}\n  sha256  ${check.observed.sha256}\n`,
    );
  }
  if (!acquisition.ok) {
    refuse(
      `the acquired validator artifacts do not match the identity recorded in this repository, so ` +
        `nothing was graded:\n  - ${acquisition.refusals.join("\n  - ")}`,
    );
  }

  // 2. THE DECLARATION. Derived subject, committed policy, reconciled.
  const formats = await generatedFormats();
  const corpus = generateDeclaredCorpus(readCorpusDeclaration(), fhirCorpusGenerator);
  const coverage = buildCoverageDeclaration(formats, readCoveragePolicy(), corpus.excluded);
  if (!coverage.ok) {
    refuse(
      "the coverage declaration does not account for every format this library generates:\n  - " +
        coverage.errors.join("\n  - "),
    );
  }

  // 3. GRADE. One invocation per artifact, against the profile the artifact itself claims.
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const graded: GradedArtifact[] = [];
  for (const member of corpus.graded) {
    const stem = member.artifact.id.replace(/[^A-Za-z0-9]+/g, "-");
    const artifactPath = join(OUTPUT_DIR, `${stem}.json`);
    const reportPath = join(OUTPUT_DIR, `${stem}.report.json`);
    writeFileSync(artifactPath, member.content);
    process.stdout.write(
      `oracle: grading ${member.artifact.id} against ${member.artifact.profile}\n`,
    );
    graded.push({
      artifact: member.artifact,
      report: gradeOne(
        acquired.validator.path,
        acquired.conformancePackage.path,
        lock,
        artifactPath,
        member.artifact.profile,
        reportPath,
      ),
    });
  }

  // 4. DECIDE.
  const decision = decideGate({
    graded,
    excluded: corpus.excluded,
    independentlyGradedFormats: independentlyGradedFormats(coverage.declaration),
  });

  const component = (
    name: string,
    version: string,
    sha256: string,
    source: string,
  ): GradingComponent => ({ name, version, sha256, source });

  const verdict = buildVerdict({
    validator: component(
      lock.validator.name,
      lock.validator.version,
      lock.validator.sha256,
      acquired.validator.resolvedUrl,
    ),
    conformancePackage: component(
      lock.conformancePackage.name,
      lock.conformancePackage.version,
      lock.conformancePackage.sha256,
      acquired.conformancePackage.resolvedUrl,
    ),
    endpoints: [
      lock.validator.downloadUrl,
      lock.conformancePackage.downloadUrl,
      ...(lock.terminologyServer === null ? [] : [lock.terminologyServer]),
    ],
    terminology:
      lock.terminologyServer === null
        ? "no terminology server was configured (-tx n/a), so no generated content left this " +
          "runner for terminology resolution and terminology-bound checks are not part of this " +
          "verdict"
        : `terminology resolution was directed at ${lock.terminologyServer}, which therefore saw ` +
          "the generated fixtures",
    coverage: coverage.declaration,
    decision,
  });

  writeFileSync(join(OUTPUT_DIR, "verdict.json"), `${JSON.stringify(verdict, null, 2)}\n`);
  writeFileSync(
    join(OUTPUT_DIR, "coverage.json"),
    `${JSON.stringify(coverage.declaration, null, 2)}\n`,
  );
  process.stdout.write(`\n${renderVerdict(verdict)}\n`);

  if (verdict.status !== "pass") {
    process.stderr.write(
      "\noracle: the external validator's own report is the gate, and it did not come back clean.\n" +
        "  The sanctioned responses are to fix the oracle if it asked the wrong question, to fix\n" +
        "  the generated artifact, or to narrow the DECLARED corpus and name the excluded artifact\n" +
        "  and its reason in scripts/oracle/coverage-policy.json so the coverage declaration\n" +
        "  publishes the gap. Softening the finding is not one of them: there is no severity\n" +
        "  downgrade, no warning-only mode and no suppression list in this gate, deliberately.\n",
    );
    process.exit(1);
  }
}

await main();
