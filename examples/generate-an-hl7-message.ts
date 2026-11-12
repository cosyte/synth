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
// Print what is safe to log: the message type and the segment names. Never the message itself,
// even a synthetic one: code copied from here runs on real messages.
const segments = message.content.split("\r").filter((segment) => segment.length > 0);
const messageType = segments[0]?.split("|")[8];
console.log(
  `message type ${String(messageType)}, segments ${segments.map((s) => s.slice(0, 3)).join(" ")}`,
);
assert.equal(messageType, "ADT^A01");

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
// Read the identifying fields into variables; print only what the checks say about them.
const mrnAuthority = pid?.[3]?.split("^")[3]; // "COSYTE-SYNTH", the synthetic assigning authority
const phone = pid?.[13] ?? ""; // "(528) 555-0105", synthetic
const ssn = pid?.[19] ?? ""; // "969217321", synthetic
const authorityIsSynthetic = mrnAuthority === "COSYTE-SYNTH";
const phoneIsSynthetic = isSyntheticPhone(phone);
const ssnNeverIssued = isSyntheticSsn(ssn);
const ssnItinShaped = isItinFormatted(ssn);
console.log(`PID-3 assigning authority is the synthetic one: ${String(authorityIsSynthetic)}`);
console.log(`PID-13 phone is synthetic: ${String(phoneIsSynthetic)}`);
console.log(
  `PID-19 SSN never issued: ${String(ssnNeverIssued)}, ITIN-shaped: ${String(ssnItinShaped)}`,
);
assert.equal(authorityIsSynthetic, true, "the MRN lives under the synthetic assigning authority");
assert.equal(phoneIsSynthetic, true, "the phone is a reserved 555-01xx number");
assert.equal(ssnNeverIssued, true, "the SSN is one the SSA never issues");
assert.equal(ssnItinShaped, false, "and it is not a validly formatted IRS ITIN either");

// A reproducible mixed corpus: one of each message family, all spec-clean.
const corpus = hl7Corpus({ seed: 42, count: 7 });
console.log(`corpus: ${Object.keys(corpus.manifest.counts).join(", ")}`);
assert.equal(corpus.artifacts.length, 7);
assert.ok(corpus.artifacts.every((artifact) => artifact.warnings.length === 0));
