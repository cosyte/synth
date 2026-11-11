import type { ViteUserConfig } from "vitest/config";
import { configDefaults } from "vitest/config";

import shared from "./vitest.config.js";

const config = shared as ViteUserConfig;

/**
 * The Vitest run StrykerJS uses for mutation testing (`stryker.config.mjs`): the suite of
 * `vitest.config.ts`, without the files that cannot judge a mutant.
 *
 * StrykerJS mutates `src/` inside a sandbox and switches each mutant on in the test process. The
 * files left out below never run that instrumented code:
 *
 * - `test/docs-content.test.ts` runs `pnpm build` and loads the docs samples from `dist/`, which is
 *   built from the plain sources, and it would add a build to every run;
 * - `test/examples-typecheck.test.ts` type-checks `examples/` with the TypeScript compiler, which
 *   runs no code;
 * - `test/scripts/` tests this repository's own tooling in `scripts/` (the PHI scan, the version
 *   sync, the changelog), each in a child process;
 * - `test/quality-standard.test.ts` reads this repository's configuration and workflow files, and
 *   imports no source file.
 *
 * What they prove is proved by `pnpm test` on every pull request. `SYNTH_MUTATION_RUN` tells a test
 * that reads `src/` as text that it is reading the instrumented copy, so it can skip by name. The instrumented code runs
 * several times slower than the plain build, so a test's budget here is 60 s rather than 10 s;
 * StrykerJS sets each mutant's own timeout from the time the test took in its first run, so this
 * budget does not slow the mutant runs.
 */
const mutation: ViteUserConfig = {
  ...config,
  test: {
    ...config.test,
    exclude: [
      ...configDefaults.exclude,
      "test/docs-content.test.ts",
      "test/examples-typecheck.test.ts",
      "test/quality-standard.test.ts",
      "test/scripts/**",
    ],
    env: { ...config.test?.env, SYNTH_MUTATION_RUN: "1" },
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
};

export default mutation;
