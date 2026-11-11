import { cosyteVitest } from "@cosyte/vitest-config";

/**
 * Vitest config for @cosyte/synth from the shared @cosyte/vitest-config standard, which owns the
 * coverage provider, reporters, and coverage include and exclude sets. What follows is only what
 * this repository adds.
 *
 * Coverage is gated at 100% for lines, branches, functions and statements across every file in
 * `src/` (barrels excepted, per the shared standard), and `coverageDirs` holds each listed `src/`
 * directory to the same 100% on its own, so a well-covered directory cannot carry a poorly covered
 * one: the seeded PRNG (`rng`), the synthetic-by-construction value providers (`safe`), and the
 * HL7 v2, FHIR, C-CDA, X12, NCPDP and ASTM generators, and the de-identification round trip
 * (`deid`). A threshold only rises: a line that truly cannot be reached carries an inline
 * `v8 ignore` comment naming its reason, never a lowered number here. `quality-floor.json` holds
 * the same 100 for the ratchet (`pnpm quality:check`).
 */
const COVERAGE_DIRS = ["rng", "safe", "hl7", "fhir", "ccda", "x12", "ncpdp", "astm", "deid"];

/** Every metric at 100. */
const FULL = { lines: 100, branches: 100, functions: 100, statements: 100 };

export default cosyteVitest({
  coverageDirs: COVERAGE_DIRS,
  coverageThresholds: {
    ...FULL,
    ...Object.fromEntries(COVERAGE_DIRS.map((dir) => [`src/${dir}/**`, FULL])),
  },
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
