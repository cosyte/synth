/**
 * Generate vendor-quirk fixtures: off-spec on purpose, each round-tripping to exactly the one parser
 * warning it was built to cause.
 *
 * Spec-clean fixtures test that a parser reads a correct message. Quirk fixtures test that it
 * tolerates a realistic deviation and names it with the right stable code. A quirk changes shape,
 * never provenance: every value is still synthetic. Where a public parser profile claims the
 * deviation, the fixture also round-trips cleanly under that profile.
 *
 * Run it after `pnpm build`:
 *
 *     pnpm tsx examples/vendor-quirk.ts
 */

import assert from "node:assert/strict";

import { astmQuirkRoundTrip, generateAstmQuirk } from "@cosyte/synth/astm";
import { ccdaQuirkRoundTrip, generateCcdaQuirk } from "@cosyte/synth/ccda";
import { generateHl7Quirk, hl7QuirkRoundTrip } from "@cosyte/synth/hl7";

const results = [
  [
    "HL7 v2 unknown Z-segment",
    hl7QuirkRoundTrip(generateHl7Quirk({ seed: 1, quirk: "unknown-zsegment" })),
  ],
  [
    "C-CDA deprecated LOINC",
    ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: 1, quirk: "deprecated-loinc" })),
  ],
  [
    "ASTM unknown escape",
    astmQuirkRoundTrip(generateAstmQuirk({ seed: 1, quirk: "unknown-escape" })),
  ],
] as const;

for (const [label, result] of results) {
  console.log(
    `${label.padEnd(25)} warns ${result.warnings.join(", ")}; under the ${String(result.withProfile?.profileName)} profile: ${String(result.withProfile?.disposition)}`,
  );
  assert.equal(result.intendedWarningHeld, true, `${label} produces exactly its intended warning`);
  assert.deepEqual(result.warnings, result.intendedWarnings);
  assert.equal(result.warnings.length, 1);
  assert.equal(
    result.withProfile?.tolerated,
    true,
    `${label} is tolerated by the profile that claims it`,
  );
}
