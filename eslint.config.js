import cosyte from "@cosyte/eslint-config";

/**
 * ESLint for @cosyte/synth. The shared cosyte config plus one repo guardrail:
 *
 * **`Math.random` is banned in `src/`.** The whole library is built on the promise that a *seed* — and
 * only the seed — determines the output, byte-for-byte, on any machine and any run (roadmap §5).
 * `Math.random` breaks that: its seed is engine-chosen and cannot be reset (MDN), and its algorithm is
 * implementation-defined, so a corpus built on it is not reproducible. All randomness must come from
 * the hand-rolled seeded PRNG (`src/rng/`). The rule is scoped to `src/` — tests and scripts may use
 * `Math.random` freely.
 */
export default [
  ...cosyte(import.meta.dirname),

  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message:
            "Math.random is not seedable, so it breaks reproducibility. Use the seeded PRNG in " +
            "src/rng/ (createRng) instead — a seed must fully determine the output (roadmap §5).",
        },
      ],
    },
  },
];
