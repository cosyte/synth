import { cosyteVitest } from "@cosyte/vitest-config";

/**
 * Vitest config for @cosyte/synth from the shared @cosyte/vitest-config standard, which owns the
 * coverage provider, reporters, coverage include and exclude sets and the 90% gate. What follows is
 * only what this repository adds.
 *
 * `coverageDirs` holds each of these `src/` directories to the 90% gate on its own, so a
 * well-covered directory cannot carry a poorly covered one: the seeded PRNG (`rng`), the
 * synthetic-by-construction value providers (`safe`), and the HL7 v2, FHIR, C-CDA and X12
 * generators.
 */
export default cosyteVitest({
  coverageDirs: ["rng", "safe", "hl7", "fhir", "ccda", "x12"],
  test: {
    // THE SOLE SELECTOR FOR EVERY TEST CI RUNS, and it is guarded: the shared config supplies no
    // `include` of its own, so narrowing this line silently drops the synthetic-safety suites
    // while every required check stays green. `pnpm check:test-selection` reds if a tracked test
    // file is not selected.
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    // The shared config sets no timeout, so vitest's 5 s default would apply; this raises the
    // floor for the whole-corpus suites. A genuinely slow test takes its own ceiling instead.
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
