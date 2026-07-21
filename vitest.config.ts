import { cosyteVitest } from "@cosyte/vitest-config";

/**
 * Vitest config for @cosyte/synth from the shared @cosyte/vitest-config standard.
 *
 * Per-directory >= 90 coverage gates on the core dir(s). Add directories to `coverageDirs` as the
 * parser grows (e.g. "model", "serialize", "helpers", "builder") — mirror @cosyte/hl7's layout once
 * the corresponding source lands.
 */
export default cosyteVitest({
  coverageDirs: ["rng", "safe", "hl7", "fhir", "ccda", "x12"],
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
