/**
 * Spec-clean HL7 v2 `OML^O21` (laboratory order) generation, built **through `@cosyte/hl7`'s
 * `buildMessage`**. The published `OML_O21` structure requires the common order (`ORC`); this
 * generator emits `PID`, `ORC` and a matching `OBR`, so the message round-trips with **zero
 * warnings**. Identity comes from `../safe`; the ordered service comes from the license-clean example
 * pool, never bundled terminology.
 *
 * @module
 */

import type { Hl7Message } from "@cosyte/hl7";

import { createRng } from "../rng/rng.js";

import { componentsField } from "./field.js";
import { mshScaffold, patientIdentity, pidSegment, seededTimestamp } from "./common.js";
import { EXAMPLE_ORDER_SERVICES } from "./example-codes.js";

/** Options for {@link generateOml}. */
export interface GenerateOmlOptions {
  /** The seed: the same seed yields a byte-identical message. Defaults to `0`. */
  readonly seed?: number;
}

/**
 * Generate a spec-clean `OML^O21` {@link Hl7Message} through `@cosyte/hl7`. Deterministic in `seed`.
 *
 * Layout: MSH (`OML^O21^OML_O21`), `PID` (synthetic identity), `ORC` (order control `NW`, a new
 * order) and an `OBR` carrying the same placer and filler numbers and a laboratory service.
 *
 * @param options - Seed. See {@link GenerateOmlOptions}.
 * @returns A spec-clean `OML^O21` `Hl7Message`.
 * @example
 * ```ts
 * import { generateOml } from "@cosyte/synth/hl7";
 * const msg = generateOml({ seed: 12345 });
 * const wire = msg.toString(); // the whole message, synthetic: assert on it, never log it
 * console.log(wire.split("\r")[0]?.split("|")[8]); // "OML^O21^OML_O21", the type in MSH-9
 * ```
 */
export function generateOml(options: GenerateOmlOptions = {}): Hl7Message {
  const seed = options.seed ?? 0;
  const rng = createRng(seed);

  const { message } = mshScaffold(rng, "OML^O21^OML_O21");
  message.addSegment("PID", pidSegment(patientIdentity(rng)));

  const service = rng.pick(EXAMPLE_ORDER_SERVICES);
  const placer = rng.digits(8);
  const filler = rng.digits(8);
  const orderedAt = seededTimestamp(rng);

  message.addSegment("ORC", [
    "NW", // ORC-1 order control (new order)
    placer, // ORC-2 placer order number
    filler, // ORC-3 filler order number
    ...Array<string>(5).fill(""), // ORC-4 to ORC-8
    orderedAt, // ORC-9 date/time of transaction
  ]);

  message.addSegment("OBR", [
    "1", // OBR-1 set id
    placer, // OBR-2 placer order number (matches ORC)
    filler, // OBR-3 filler order number (matches ORC)
    componentsField([service.code, service.text, service.system]), // OBR-4 universal service id
  ]);

  return message;
}
