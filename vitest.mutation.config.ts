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
 *   sync, the changelog), each in a child process.
 *
 * What they prove is proved by `pnpm test` on every pull request. The instrumented code runs
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
      "test/scripts/**",
    ],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
};

export default mutation;
