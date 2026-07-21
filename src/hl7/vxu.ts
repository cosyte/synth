/**
 * Spec-clean HL7 v2 `VXU^V04` (unsolicited vaccination record update) generation, built **through
 * `@cosyte/hl7`'s `buildMessage`** (roadmap §Phase 2). The parser's structure net requires the patient
 * group (`PID`) for `VXU^V04` (per the CDC IG, `RXA` lives in the optional order group); this generator
 * emits `PID` + `ORC` + `RXA` + `RXR`, so the message round-trips with **zero warnings**. Identity comes
 * from `../safe`; the vaccine code comes from the license-clean example pool, never bundled terminology.
 *
 * @module
 */

import type { Hl7Message } from "@cosyte/hl7";

import { createRng } from "../rng/rng.js";

import { componentsField } from "./field.js";
import { mshScaffold, patientIdentity, pidSegment, seededTimestamp } from "./common.js";
import { EXAMPLE_VACCINES } from "./example-codes.js";

/** Options for {@link generateVxu}. */
export interface GenerateVxuOptions {
  /** The seed — the same seed yields a byte-identical message. Defaults to `0`. */
  readonly seed?: number;
}

/**
 * Generate a spec-clean `VXU^V04` {@link Hl7Message} through `@cosyte/hl7`. Deterministic in `seed`.
 *
 * Layout: MSH, `PID` (synthetic identity — the required group), `ORC` (common order), `RXA` (vaccine
 * administration, CVX example code), `RXR` (route). The `PID` satisfies the parser's `VXU^V04`
 * structure net, so the message re-parses with **zero warnings** (proven by {@link ./round-trip}).
 *
 * @param options - Seed. See {@link GenerateVxuOptions}.
 * @returns A spec-clean `VXU^V04` `Hl7Message`.
 * @example
 * ```ts
 * import { generateVxu } from "@cosyte/synth/hl7";
 * const msg = generateVxu({ seed: 12345 });
 * console.log(msg.toString());
 * ```
 */
export function generateVxu(options: GenerateVxuOptions = {}): Hl7Message {
  const seed = options.seed ?? 0;
  const rng = createRng(seed);

  const { message } = mshScaffold(rng, "VXU^V04");
  message.addSegment("PID", pidSegment(patientIdentity(rng)));

  const placer = rng.digits(8);
  const filler = rng.digits(8);
  message.addSegment("ORC", [
    "RE", // ORC-1 order control (observation to follow / record)
    placer, // ORC-2 placer order number
    filler, // ORC-3 filler order number
  ]);

  const vaccine = rng.pick(EXAMPLE_VACCINES);
  const administeredAt = seededTimestamp(rng);
  const doseAmount = String(rng.int(1, 5) / 10); // 0.1–0.5 mL, structural only

  message.addSegment("RXA", [
    "0", // RXA-1 give sub-id counter
    "1", // RXA-2 administration sub-id counter
    administeredAt, // RXA-3 date/time start of administration
    administeredAt, // RXA-4 date/time end of administration
    componentsField([vaccine.code, vaccine.text, vaccine.system]), // RXA-5 administered code (CE)
    doseAmount, // RXA-6 administered amount
    componentsField(["mL", "milliliters", "UCUM"]), // RXA-7 administered units (CE)
    "", // RXA-8
    "", // RXA-9 administration notes
    "", // RXA-10
    "", // RXA-11
    "", // RXA-12
    "", // RXA-13
    "", // RXA-14
    "", // RXA-15 substance lot number
    "", // RXA-16
    "", // RXA-17
    "", // RXA-18
    "", // RXA-19
    "CP", // RXA-20 completion status (complete)
  ]);

  message.addSegment("RXR", [
    componentsField(["IM", "Intramuscular", "HL70162"]), // RXR-1 route (CE)
    componentsField(["LD", "Left Deltoid", "HL70163"]), // RXR-2 administration site (CE)
  ]);

  return message;
}
