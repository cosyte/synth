#!/usr/bin/env tsx
/**
 * scripts/determinism/digest.ts
 *
 * THE PER-ENGINE DIGEST RUN. Reached by `pnpm run determinism:digest`.
 *
 * It regenerates the declared seed corpus on WHATEVER ENGINE IT IS RUNNING ON, digests each
 * (format, seed) pair, compares those digests against the committed baseline for the current
 * compatibility window, and leaves behind a report carrying digests and identities and no artifact
 * content at all. One of these runs per declared engine; a separate job compares what they left.
 *
 * THIS FILE IS THE IMPURE PART AND IT IS DELIBERATELY THIN. It reads three committed files, calls
 * six corpus factories, hashes, writes one file and sets an exit code. Every DECISION it takes is
 * delegated to a pure module beside it, because the multi-engine condition exists only in CI and a
 * gate whose behaviour can only be observed where it runs is a gate nobody can test:
 *
 *   scripts/determinism/policy.ts    what is declared, and is the declaration well formed?
 *   scripts/determinism/engines.ts   does the declared engine set match the range and the jobs?
 *   scripts/determinism/corpus.ts    which pairs, and what is the digest of each?
 *   scripts/determinism/report.ts    what leaves this job, and what may never be in it?
 *   scripts/determinism/baseline.ts  did the mapping move on every engine at once?
 *
 * THE ORDER MATTERS AND IS PART OF THE CONTRACT. The declaration is reconciled against
 * `engines.node` and against the jobs the workflow runs BEFORE anything is generated, so a run
 * whose declaration is unsound never produces a report at all, let alone one somebody compares.
 *
 * CARRYING THE REPORT OUT OF THE JOB. When `GITHUB_OUTPUT` is set, the report is appended there as
 * a single-line `report=` value, which is how it reaches the comparison job. That is deliberately
 * NOT a third-party artifact action: this repository already refuses to take a supply-chain
 * dependency on an action to buy something it can do itself (see the `setup-java` note in
 * `.github/workflows/ci.yml`), and a few kilobytes of hex digests is exactly what a job output is
 * for. Nothing about the local run depends on it.
 *
 * THE ARGUMENT GUARD IS AN ALLOW-LIST. `--update-baseline` is the only flag, and anything else
 * exits 2. A deny-list on a gate's own entry point is the shape a refuter has walked through in
 * this repository before (`scripts/attw.mjs`), and there is nothing to be gained by repeating it.
 */

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { generatedFormats } from "../oracle/formats.js";

import { baselineFromReport, compareToBaseline, readBaseline, renderBaseline } from "./baseline.js";
import { declareCorpus, digestDeclaredCorpus, DIGEST_ALGORITHM } from "./corpus.js";
import { readWorkflow, reconcileDeclaredEngines, reconcileWorkflowEngines } from "./engines.js";
import {
  BASELINE_PATH,
  CI_WORKFLOW_PATH,
  compatibilityWindow,
  readPackageFacts,
  readPolicy,
  REPORT_DIR,
} from "./policy.js";
import { buildReport, currentEngine, reportFileName, writeReport } from "./report.js";

/** Refuse loudly. A run that cannot do its job never reports a result from one that did not. */
function refuse(message: string): never {
  process.stderr.write(`\ndeterminism: REFUSING TO REPORT\n  ${message}\n`);
  process.exit(1);
}

/** The complete set of flags this entry point accepts. Anything else is an invocation error. */
const ALLOWED_FLAGS = new Set(["--update-baseline"]);

/** Parse argv against the allow-list. */
function parseArguments(argv: readonly string[]): { updateBaseline: boolean } {
  for (const argument of argv) {
    if (!ALLOWED_FLAGS.has(argument)) {
      process.stderr.write(
        `determinism: unrecognised argument "${argument}".\n` +
          `  The only accepted flag is --update-baseline. This guard is an allow-list rather than\n` +
          `  a deny-list on purpose: a flag nobody anticipated must not reach the gate.\n`,
      );
      process.exit(2);
    }
  }
  return { updateBaseline: argv.includes("--update-baseline") };
}

/**
 * Create the report directory, failing the same way a failed write does.
 *
 * A destination that cannot be created and one that cannot be written are the same problem from
 * outside, and neither may end as a run that exited 0 having produced nothing.
 */
function prepareReportDirectory(directory: string): void {
  try {
    mkdirSync(directory, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    refuse(
      `the digest report destination ${directory} could not be created: ${message}. This run ` +
        "FAILS rather than exiting successfully having produced no report.",
    );
  }
}

async function main(): Promise<void> {
  const { updateBaseline } = parseArguments(process.argv.slice(2));

  const policy = readPolicy();
  const facts = readPackageFacts();
  const window = compatibilityWindow(facts.version);

  // 1. THE DECLARATION, RECONCILED, BEFORE ANYTHING IS GENERATED.
  const declarationProblems = [
    ...reconcileDeclaredEngines(policy.engines, facts.engineRange),
    ...reconcileWorkflowEngines(policy.engines, readWorkflow(CI_WORKFLOW_PATH)),
  ];
  if (declarationProblems.length > 0) {
    refuse(
      "the declared supported-engine set does not reconcile, so nothing was generated:\n  - " +
        declarationProblems.join("\n  - "),
    );
  }

  const engine = currentEngine();
  if (!policy.engines.includes(engine.nodeMajor)) {
    refuse(
      `this run is on ${engine.id} (${engine.nodeVersion}), which is not in the declared ` +
        `supported-engine set [${policy.engines.map((e) => String(e)).join(", ")}]. A report from ` +
        "an undeclared engine could not be compared, so it is not produced.",
    );
  }

  // 2. THE CORPUS. The registry is reconciled against what the library actually generates, so a
  //    seventh format cannot ship with nothing comparing it across engines.
  const corpus = declareCorpus(policy, await generatedFormats());
  process.stdout.write(
    `determinism: digesting ${String(corpus.graded.length)} (format, seed) pair(s) on ` +
      `${engine.id} (${engine.nodeVersion}), ${String(policy.artifactsPerPair)} artifact(s) each\n`,
  );
  for (const exclusion of corpus.excluded) {
    process.stdout.write(
      `determinism: EXCLUDED ${exclusion.format} seed ${String(exclusion.seed)}: ${exclusion.reason}\n`,
    );
  }

  const report = buildReport({
    engine,
    packageName: facts.name,
    packageVersion: facts.version,
    window,
    digestAlgorithm: DIGEST_ALGORITHM,
    artifactsPerPair: policy.artifactsPerPair,
    entries: digestDeclaredCorpus(corpus, policy.artifactsPerPair),
    excluded: corpus.excluded,
  });

  // 3. THE BASELINE. Either this run is regenerating it deliberately, or it is being measured
  //    against it.
  if (updateBaseline) {
    prepareReportDirectory(dirname(BASELINE_PATH));
    const baseline = baselineFromReport(report);
    try {
      writeFileSync(BASELINE_PATH, renderBaseline(baseline));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      refuse(`the baseline could not be written to ${BASELINE_PATH}: ${message}`);
    }
    process.stdout.write(
      `determinism: REGENERATED the baseline at ${BASELINE_PATH} for window ${window} over ` +
        `${String(baseline.entries.length)} pair(s). Committing a changed baseline requires a ` +
        "changeset declaring a major change: `pnpm run check:determinism-window` is the gate.\n",
    );
    return;
  }

  // 4. THE REPORT LEAVES THE JOB FIRST, so a baseline divergence still leaves the evidence behind.
  prepareReportDirectory(REPORT_DIR);
  const reportPath = join(REPORT_DIR, reportFileName(engine.nodeMajor));
  try {
    writeReport(reportPath, report);
  } catch (error) {
    refuse(error instanceof Error ? error.message : String(error));
  }
  process.stdout.write(`determinism: wrote ${reportPath}\n`);

  const githubOutput = process.env["GITHUB_OUTPUT"];
  if (githubOutput !== undefined && githubOutput.length > 0) {
    try {
      appendFileSync(githubOutput, `report=${JSON.stringify(report)}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      refuse(
        `the digest report could not be carried out of this job through ${githubOutput}: ` +
          `${message}. A report the comparison job cannot receive is a missing report, and a ` +
          "missing report is a failed comparison rather than a silent one.",
      );
    }
  }

  const divergences = compareToBaseline(report, readBaseline(BASELINE_PATH));
  if (divergences.length > 0) {
    process.stderr.write(
      `\ndeterminism: FAIL on ${engine.id}, against the committed baseline ` +
        `(${String(divergences.length)} problem(s))\n\n` +
        divergences.map((d) => `  - ${d}`).join("\n\n") +
        "\n\n" +
        "  The cross-engine comparison cannot see this: a toolchain or dependency change moves\n" +
        "  every engine together, so every engine agrees and the golden file a consumer committed\n" +
        "  stops matching with nothing red anywhere. That is what the baseline is for.\n\n" +
        "  THE SANCTIONED RESPONSES, in order: fix the harness if the digest is not a pure\n" +
        "  function of the generated bytes; if the generated output really changed, that is a\n" +
        "  change to the seed-to-bytes mapping and it is regenerated with\n" +
        "  `pnpm run determinism:digest --update-baseline` AND declared as a major change in a\n" +
        "  changeset. There is no tolerance on a digest and no suppression list, deliberately.\n",
    );
    process.exit(1);
  }

  process.stdout.write(
    `determinism: PASS on ${engine.id}: ${String(report.entries.length)} (format, seed) pair(s) ` +
      `match the committed baseline for window ${window}\n`,
  );
}

await main();
