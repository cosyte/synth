/**
 * Generate a spec-clean HL7 v2 ADT^A01 from a seed, prove the seed alone decides the bytes, and check
 * that every identifier in it is synthetic by construction.
 *
 * The message is built through `@cosyte/hl7`'s own builder and read straight back by its parser: a
 * spec-clean artifact re-parses with zero warnings. `@cosyte/hl7` is an optional peer dependency:
 * install it beside `@cosyte/synth` to use this subpath.
 *
 * Run it after `pnpm build`:
 *
 *     pnpm tsx examples/generate-an-hl7-message.ts
 */

import assert from "node:assert/strict";

import { isItinFormatted, isSyntheticPhone, isSyntheticSsn } from "@cosyte/synth";
import { generateAdt, hl7Corpus, roundTrip } from "@cosyte/synth/hl7";

const message = roundTrip(generateAdt({ seed: 12345, trigger: "A01" }));
console.log(message.content.split("\r").join("\n"));

// Spec-clean by construction: zero warnings on re-parse, and the re-serialized bytes are identical.
assert.equal(message.specClean, true);
assert.deepEqual(message.warnings, []);
assert.equal(message.byteStable, true);

// The seed, and only the seed, decides the output: same seed, same bytes, on any machine.
const again = roundTrip(generateAdt({ seed: 12345, trigger: "A01" }));
assert.equal(again.content, message.content, "the same seed yields byte-identical output");
const other = roundTrip(generateAdt({ seed: 12346, trigger: "A01" }));
assert.notEqual(other.content, message.content, "a different seed yields a different message");
console.log("seed 12345 twice: byte-identical");

// Every identifier is drawn from a reserved range or a shipped fake-name pool.
const pid = message.content
  .split("\r")
  .find((segment) => segment.startsWith("PID|"))
  ?.split("|");
const mrnAuthority = pid?.[3]?.split("^")[3];
const phone = pid?.[13] ?? "";
const ssn = pid?.[19] ?? "";
console.log(`PID-3 assigning authority: ${String(mrnAuthority)}`);
console.log(`PID-13 phone ${phone}: synthetic ${String(isSyntheticPhone(phone))}`);
console.log(
  `PID-19 SSN ${ssn}: never issued ${String(isSyntheticSsn(ssn))}, ITIN-shaped ${String(isItinFormatted(ssn))}`,
);
assert.equal(mrnAuthority, "COSYTE-SYNTH", "the MRN lives under the synthetic assigning authority");
assert.equal(isSyntheticPhone(phone), true, "the phone is a reserved 555-01xx number");
assert.equal(isSyntheticSsn(ssn), true, "the SSN is one the SSA never issues");
assert.equal(isItinFormatted(ssn), false, "and it is not a validly formatted IRS ITIN either");

// A reproducible mixed corpus: one of each message family, all spec-clean.
const corpus = hl7Corpus({ seed: 42, count: 7 });
console.log(`corpus: ${Object.keys(corpus.manifest.counts).join(", ")}`);
assert.equal(corpus.artifacts.length, 7);
assert.ok(corpus.artifacts.every((artifact) => artifact.warnings.length === 0));
