/**
 * Spec-clean HL7 v2 `ADT` generation, built **through `@cosyte/hl7`'s `buildMessage`** so MSH
 * delimiters, segment layout, and escaping are the parser's own conservative emit — spec-clean *by
 * construction* (roadmap §1, §Phase 1 harness proof). Every PHI-bearing field (name, DOB, SSN, MRN,
 * address, phone) is drawn from the synthetic-safety providers (`../safe`), so no value can be real.
 *
 * `ADT^A01/A04/A08` all require the `PID` (patient) + `PV1` (visit) groups the parser's structure net
 * checks for — so a generated message round-trips through `@cosyte/hl7` with **zero warnings**.
 *
 * @module
 */

import type { Hl7Message } from "@cosyte/hl7";

import { createRng } from "../rng/rng.js";

import { componentsField } from "./field.js";
import { mshScaffold, patientIdentity, pidSegment } from "./common.js";

/** The ADT trigger events this generator produces (all require the PID + PV1 groups). */
export type AdtTrigger = "A01" | "A04" | "A08";

/** Options for {@link generateAdt}. */
export interface GenerateAdtOptions {
  /** The seed — the same seed yields a byte-identical message. Defaults to `0`. */
  readonly seed?: number;
  /** The ADT trigger event. Defaults to `"A01"`. */
  readonly trigger?: AdtTrigger;
}

/**
 * Generate a spec-clean `ADT` {@link Hl7Message} through `@cosyte/hl7`. Deterministic in `seed`.
 *
 * The message carries a complete MSH (seeded control id + timestamp, so the bytes are reproducible),
 * `EVN`, a fully-populated `PID` (identity from the synthetic providers), and `PV1` (the visit group),
 * so it parses back through `@cosyte/hl7` with **zero warnings** (proven by {@link ./round-trip}).
 *
 * @param options - Seed + trigger. See {@link GenerateAdtOptions}.
 * @returns A spec-clean `ADT` `Hl7Message`.
 * @example
 * ```ts
 * import { generateAdt } from "@cosyte/synth/hl7";
 * const msg = generateAdt({ seed: 12345, trigger: "A01" });
 * console.log(msg.toString());
 * ```
 */
export function generateAdt(options: GenerateAdtOptions = {}): Hl7Message {
  const seed = options.seed ?? 0;
  const trigger = options.trigger ?? "A01";
  const rng = createRng(seed);

  const { message, timestamp } = mshScaffold(rng, `ADT^${trigger}`);
  message.addSegment("EVN", [trigger, timestamp]);
  message.addSegment("PID", pidSegment(patientIdentity(rng)));

  const patientClass = rng.pick(["I", "O", "E"] as const);
  message.addSegment("PV1", [
    "1", // PV1-1 set id
    patientClass, // PV1-2 patient class
    componentsField(["SYNTHWARD", String(rng.int(1, 999)).padStart(3, "0"), "01"]), // PV1-3 PL
  ]);

  return message;
}
