/**
 * Co-validate `@cosyte/synth` with `@cosyte/deid`: generate, plant synthetic PHI sentinels,
 * de-identify, and check that every sentinel is gone while the clinical payload survives.
 *
 * This is a co-validation harness on synth's own output, not an independent audit of
 * `@cosyte/deid` against real-world data. The removal check is scoped to the former PHI positions,
 * so provider identity a de-identifier legitimately keeps never reads as a false survivor. Formats
 * with no `@cosyte/deid` adapter are skipped and named, never counted as passes.
 *
 * Run it after `pnpm build`:
 *
 *     pnpm tsx examples/deid-pairing-loop.ts
 */

import assert from "node:assert/strict";

import {
  ccdaDeidLoop,
  fhirDeidLoop,
  hl7DeidLoop,
  ncpdpTelecomDeidLoop,
  summarizeDeidCoverage,
  x12DeidLoop,
} from "@cosyte/synth/deid";

const oru = hl7DeidLoop({ seed: 42, kind: "ORU^R01" });
console.log(`HL7 ORU^R01: planted at ${oru.planted.map((sentinel) => sentinel.locus).join(", ")}`);
assert.equal(oru.pass, true);
assert.deepEqual(oru.survivors, [], "every planted sentinel was removed");
assert.deepEqual(oru.clinicalScrubbed, [], "no clinical value was over-scrubbed");

const summary = summarizeDeidCoverage([
  hl7DeidLoop({ seed: 1 }),
  fhirDeidLoop({ seed: 1 }),
  x12DeidLoop({ seed: 1, variant: "837P" }),
  ncpdpTelecomDeidLoop({ seed: 1, transaction: "B1" }),
  ccdaDeidLoop({ seed: 1 }),
]);

for (const row of summary.byFormat) {
  console.log(
    `${row.format.padEnd(14)} planted ${String(row.planted).padStart(2)}, survivors ${String(row.survivors)}, clinical scrubbed ${String(row.clinicalScrubbed)}`,
  );
}
console.log(`skipped: ${summary.skipped.map((entry) => entry.format).join(", ")}`);

assert.equal(summary.allPass, true);
assert.equal(summary.totalSurvivors, 0);
assert.equal(summary.totalClinicalScrubbed, 0);
assert.ok(summary.totalPlanted > 0, "the loop planted something to find");
