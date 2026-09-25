/**
 * Generate one spec-clean artifact in each of the other five formats, from a seed, and round-trip
 * each through its own parser.
 *
 * FHIR R4 / US Core, C-CDA R2.1, X12 005010, NCPDP (SCRIPT and Telecom) and ASTM: each is built
 * through that format's own `@cosyte/*` builder or serializer, never hand-written bytes, and each
 * re-parses with zero warnings. Every parser is an optional peer dependency: install only the ones
 * whose fixtures you generate.
 *
 * Run it after `pnpm build`:
 *
 *     pnpm tsx examples/generate-every-format.ts
 */

import assert from "node:assert/strict";

import { astmRoundTrip, generateAstmResult } from "@cosyte/synth/astm";
import { generateCcd, roundTrip as ccdaRoundTrip } from "@cosyte/synth/ccda";
import { generateBundle, generatePatient, roundTrip as fhirRoundTrip } from "@cosyte/synth/fhir";
import { generateB1, generateNewRx, scriptRoundTrip, telecomRoundTrip } from "@cosyte/synth/ncpdp";
import { generate837P, roundTrip as x12RoundTrip } from "@cosyte/synth/x12";

interface RoundTripResult {
  readonly content: string;
  readonly warnings: readonly string[];
  readonly specClean: boolean;
}

/** Generate twice from one seed, require identical bytes and a spec-clean round trip, and say so. */
function check(label: string, generate: (seed: number) => RoundTripResult): void {
  const first = generate(12345);
  const second = generate(12345);
  console.log(
    `${label.padEnd(26)} ${String(first.content.length).padStart(6)} bytes, spec-clean ${String(first.specClean)}, warnings ${String(first.warnings.length)}`,
  );
  assert.equal(first.specClean, true, `${label} is spec-clean`);
  assert.deepEqual(first.warnings, [], `${label} re-parses with zero warnings`);
  assert.equal(
    second.content,
    first.content,
    `${label}: the same seed yields byte-identical output`,
  );
}

check("FHIR US Core Patient", (seed) =>
  fhirRoundTrip(generatePatient({ seed, profile: "us-core" })),
);
check("FHIR transaction Bundle", (seed) =>
  fhirRoundTrip(generateBundle({ seed, type: "transaction" })),
);
check("C-CDA CCD", (seed) => ccdaRoundTrip(generateCcd({ seed })));
check("X12 837P claim", (seed) => x12RoundTrip(generate837P({ seed })));
check("NCPDP SCRIPT NewRx", (seed) => scriptRoundTrip(generateNewRx({ seed })));
check("NCPDP Telecom B1", (seed) => telecomRoundTrip(generateB1({ seed })));
check("ASTM result report", (seed) => astmRoundTrip(generateAstmResult({ seed })));
