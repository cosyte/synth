/**
 * How every property test in this repository runs, but the seed-sweep fuzz target (which keeps its
 * own time-budgeted nightly run, see `test/property/_fuzz-config.ts`): through `@cosyte/test-utils`,
 * at the depth and from the seed the environment names.
 *
 * - **Depth.** 100 cases a property by default, the depth of a pull request. A few sweeps name a
 *   larger count, because the number of cases is the strength of a synthetic-safety or conformance
 *   sweep and they are cheap enough to keep it; none names a smaller one. `COSYTE_PROPERTY_RUNS`
 *   wins over both: the nightly job (`.github/workflows/nightly-properties.yml`) sets it to 10,000.
 * - **Seed.** Each property draws a fresh seed and prints it with its name and depth, so the log of
 *   every run, a pull request's and a nightly one alike, records the seed of every property.
 * - **Replay.** A failure prints the seed and the path that replay it. Run the one test again with
 *   `COSYTE_PROPERTY_SEED=<seed> COSYTE_PROPERTY_PATH=<path>` to get the same case, already shrunk.
 * - **Time.** {@link propertyTimeout} scales a test's own timeout with the depth the environment
 *   asks for, so a deep run is not cut short by a ceiling sized for 100 cases.
 *
 * A value in any of the three variables that is set but malformed throws, so a typo cannot quietly
 * run the pull-request depth.
 *
 * @module
 */

import type fc from "fast-check";
import {
  DEFAULT_NUM_RUNS,
  PROPERTY_ENV,
  assertProperty,
  resolvePropertyRun,
  type PropertyRunOptions,
  type ResolvedPropertyRun,
} from "@cosyte/test-utils";
import { expect } from "vitest";

type Env = Readonly<Record<string, string | undefined>>;

/** A seed the way fast-check draws one when it is given none. */
function freshSeed(): number {
  return Date.now() ^ Math.floor(Math.random() * 0x1_0000_0000);
}

/** The name of the running test, which leads a failure message and a printed seed. */
function currentTestName(): string {
  return expect.getState().currentTestName ?? "property";
}

/**
 * The run a property takes: its depth, and a seed, drawn fresh when neither the test nor the
 * environment names one. It prints the property's name, depth and seed.
 *
 * @param options The test's own depth, seed or path; the environment wins over them.
 * @param env The environment; `process.env` by default.
 * @param log Where the seed line goes; standard output by default.
 * @returns The resolved run, always with a seed.
 */
export function propertyRun(
  options: PropertyRunOptions = {},
  env: Env = process.env,
  log: (line: string) => void = (line) => {
    process.stdout.write(`${line}\n`);
  },
): ResolvedPropertyRun & { readonly seed: number } {
  const run = resolvePropertyRun(options, env);
  const seed = run.seed ?? freshSeed();
  log(
    `property "${currentTestName()}": ${String(run.numRuns)} cases from ${PROPERTY_ENV.seed}=${String(seed)}`,
  );
  return { ...run, seed };
}

/**
 * Check a fast-check property through the shared runner, at the resolved depth and seed, and throw
 * an error that names the seed and path that replay a failure.
 *
 * @param property The property.
 * @param options The test's own depth (only ever more than 100), seed or path; the environment
 *   wins over them.
 */
export function checkProperty<Ts>(
  property: fc.IProperty<Ts>,
  options: PropertyRunOptions = {},
): void {
  assertProperty(currentTestName(), property, propertyRun(options));
}

/**
 * A test's timeout at the depth the run takes: the timeout it names for its own depth, times how
 * many more cases the environment asks for. Never less than the timeout it names.
 *
 * @param baseMs The timeout the test needs at its own depth.
 * @param numRuns The test's own depth; 100 by default.
 * @param env The environment; `process.env` by default.
 * @returns The timeout in milliseconds.
 */
export function propertyTimeout(
  baseMs: number,
  numRuns: number = DEFAULT_NUM_RUNS,
  env: Env = process.env,
): number {
  const { numRuns: resolved } = resolvePropertyRun({ numRuns }, env);
  return Math.ceil(baseMs * Math.max(1, resolved / numRuns));
}
