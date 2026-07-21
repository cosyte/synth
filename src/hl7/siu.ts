/**
 * Spec-clean HL7 v2 `SIU^S12` (notification of new appointment booking) generation, built **through
 * `@cosyte/hl7`'s `buildMessage`** (roadmap §Phase 2). The parser's structure net requires the schedule
 * activity segment (`SCH`) for `SIU^S12`; this generator emits `SCH` + `PID` + a resource group
 * (`RGS`/`AIL`), so the message round-trips with **zero warnings**. Identity comes from `../safe`.
 *
 * @module
 */

import type { Hl7Message } from "@cosyte/hl7";

import { createRng } from "../rng/rng.js";

import { componentsField } from "./field.js";
import { mshScaffold, patientIdentity, pidSegment, seededTimestamp } from "./common.js";

/** Options for {@link generateSiu}. */
export interface GenerateSiuOptions {
  /** The seed — the same seed yields a byte-identical message. Defaults to `0`. */
  readonly seed?: number;
}

/**
 * Generate a spec-clean `SIU^S12` {@link Hl7Message} through `@cosyte/hl7`. Deterministic in `seed`.
 *
 * Layout: MSH, `SCH` (schedule activity — the required group), `PID` (synthetic identity), `RGS`
 * (resource group), `AIL` (location resource). The `SCH` satisfies the parser's `SIU^S12` structure
 * net, so the message re-parses with **zero warnings** (proven by {@link ./round-trip}).
 *
 * @param options - Seed. See {@link GenerateSiuOptions}.
 * @returns A spec-clean `SIU^S12` `Hl7Message`.
 * @example
 * ```ts
 * import { generateSiu } from "@cosyte/synth/hl7";
 * const msg = generateSiu({ seed: 12345 });
 * console.log(msg.toString());
 * ```
 */
export function generateSiu(options: GenerateSiuOptions = {}): Hl7Message {
  const seed = options.seed ?? 0;
  const rng = createRng(seed);

  const { message } = mshScaffold(rng, "SIU^S12");

  const placerAppt = rng.digits(8);
  const fillerAppt = rng.digits(8);
  const startAt = seededTimestamp(rng);
  const durationMinutes = String(rng.int(15, 90));

  message.addSegment("SCH", [
    placerAppt, // SCH-1 placer appointment id
    fillerAppt, // SCH-2 filler appointment id
    "", // SCH-3 occurrence number
    "", // SCH-4 placer group number
    "", // SCH-5 schedule id
    "", // SCH-6 event reason
    componentsField(["ROUTINE", "Routine appointment", "L"]), // SCH-7 appointment reason (CE)
    "", // SCH-8 appointment type
    durationMinutes, // SCH-9 appointment duration
    componentsField(["min", "minutes", "UCUM"]), // SCH-10 appointment duration units (CE)
    componentsField(["1", "", startAt, "", "", "", durationMinutes]), // SCH-11 appointment timing quantity (TQ)
  ]);

  message.addSegment("PID", pidSegment(patientIdentity(rng)));

  message.addSegment("RGS", [
    "1", // RGS-1 set id
    "A", // RGS-2 segment action code (add)
  ]);

  message.addSegment("AIL", [
    "1", // AIL-1 set id
    "A", // AIL-2 segment action code
    componentsField(["SYNTHCLINIC", "Synthetic Clinic", "COSYTE-SYNTH"]), // AIL-3 location resource id
  ]);

  return message;
}
