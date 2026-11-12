/**
 * Spec-clean HL7 v2 `ADT` generation, built **through `@cosyte/hl7`'s `buildMessage`** so MSH
 * delimiters, segment layout, and escaping are the parser's own conservative emit: spec-clean *by
 * construction*. Every PHI-bearing field (name, DOB, SSN, MRN,
 * address, phone) is drawn from the synthetic-safety providers (`../safe`), so no value can be real.
 *
 * Every trigger here requires the `EVN`, `PID` (patient) and `PV1` (visit) segments the parser's
 * structure net checks for, so a generated message round-trips through `@cosyte/hl7` with **zero
 * warnings**. The triggers and the structures they share (HL7 v2 chapter 3):
 *
 * - `A01` admit, `A04` register, `A08` update patient information, `A13` cancel discharge: `ADT_A01`.
 * - `A02` transfer a patient: `ADT_A02`. `A03` discharge or end visit: `ADT_A03`.
 * - `A11` cancel admit or visit notification: `ADT_A09`.
 * - `A28` add person or patient information, `A31` update person information: `ADT_A05`.
 *
 * @module
 */

import type { Hl7Message, RawField } from "@cosyte/hl7";

import { createRng } from "../rng/rng.js";

import { componentsField } from "./field.js";
import type { Rng } from "../rng/rng.js";

import { mshScaffold, patientIdentity, pidSegment, shiftTimestamp } from "./common.js";
import { resolveKind } from "../select.js";

/** Every value {@link GenerateAdtOptions.trigger} accepts. Erased at run time, so it is resolved. */
const ADT_TRIGGERS: readonly AdtTrigger[] = Object.freeze([
  "A01",
  "A04",
  "A08",
  "A02",
  "A03",
  "A11",
  "A13",
  "A28",
  "A31",
]);

/** The ADT trigger events this generator produces (all require the EVN, PID and PV1 segments). */
export type AdtTrigger = "A01" | "A04" | "A08" | "A02" | "A03" | "A11" | "A13" | "A28" | "A31";

/**
 * The published message structure behind each trigger added after the first three, stamped in
 * MSH-9.3. `A01`, `A04` and `A08` keep the two-component MSH-9 they have always carried, so a seed
 * gives the same bytes it did before.
 */
const STRUCTURES: Readonly<Record<Exclude<AdtTrigger, "A01" | "A04" | "A08">, string>> =
  Object.freeze({
    A02: "ADT_A02",
    A03: "ADT_A03",
    A11: "ADT_A09",
    A13: "ADT_A01",
    A28: "ADT_A05",
    A31: "ADT_A05",
  });

/** An assigned patient location (`PL`): the synthetic ward, the given room, bed `01`. */
function ward(room: number): RawField {
  return componentsField(["SYNTHWARD", String(room).padStart(3, "0"), "01"]);
}

/** A seeded `PV1-3` assigned patient location: a room from 1 to 999 on the synthetic ward. */
function location(rng: Rng): RawField {
  return ward(rng.int(1, 999));
}

/** A seeded admit time between one hour and fourteen days before `timestamp`. */
function admittedBefore(rng: Rng, timestamp: string): string {
  return shiftTimestamp(timestamp, -rng.int(3600, 14 * 86400));
}

/** Options for {@link generateAdt}. */
export interface GenerateAdtOptions {
  /** The seed: the same seed yields a byte-identical message. Defaults to `0`. */
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
 * A trigger added after `A01`, `A04` and `A08` also names its published structure in MSH-9.3 and
 * fills the `PV1` fields its event is about (a transfer's prior location, a discharge's times).
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
  const trigger = resolveKind(ADT_TRIGGERS, options.trigger ?? "A01");
  const rng = createRng(seed);

  if (trigger === "A01" || trigger === "A04" || trigger === "A08") {
    const { message, timestamp } = mshScaffold(rng, `ADT^${trigger}`);
    message.addSegment("EVN", [trigger, timestamp]);
    message.addSegment("PID", pidSegment(patientIdentity(rng)));

    const patientClass = rng.pick(["I", "O", "E"] as const);
    message.addSegment("PV1", [
      "1", // PV1-1 set id
      patientClass, // PV1-2 patient class
      location(rng), // PV1-3 PL
    ]);
    return message;
  }

  const { message, timestamp } = mshScaffold(rng, `ADT^${trigger}^${STRUCTURES[trigger]}`);
  message.addSegment("EVN", [trigger, timestamp]);
  message.addSegment("PID", pidSegment(patientIdentity(rng)));
  message.addSegment("PV1", visit(rng, trigger, timestamp));
  return message;
}

/**
 * The `PV1` of an added trigger, each carrying what its event is about:
 *
 * - `A02` transfer: an inpatient (`I`), the new location in PV1-3 and the prior one in PV1-6.
 * - `A03` discharge: the location, the admit time in PV1-44 and the discharge time (the event time)
 *   in PV1-45.
 * - `A11` cancel admit: the visit being cancelled, with its location.
 * - `A13` cancel discharge: an inpatient again, the location, and the admit time in PV1-44.
 * - `A28` and `A31` are person-level: patient class `N` (HL7 table 0004, not applicable) and no
 *   location.
 */
function visit(
  rng: Rng,
  trigger: Exclude<AdtTrigger, "A01" | "A04" | "A08">,
  timestamp: string,
): (string | RawField)[] {
  switch (trigger) {
    case "A02": {
      const room = rng.int(1, 998);
      const priorRoom = room + rng.int(1, 999 - room);
      // PV1-3 the new location, PV1-6 the prior one: never the same room.
      return ["1", "I", ward(room), "", "", ward(priorRoom)];
    }
    case "A03": {
      const patientClass = rng.pick(["I", "O", "E"] as const);
      const where = location(rng);
      const admitted = admittedBefore(rng, timestamp);
      // PV1-44 admit date/time, PV1-45 discharge date/time.
      return ["1", patientClass, where, ...Array<string>(40).fill(""), admitted, timestamp];
    }
    case "A11":
      return ["1", rng.pick(["I", "O", "E"] as const), location(rng)];
    case "A13": {
      const where = location(rng);
      const admitted = admittedBefore(rng, timestamp);
      return ["1", "I", where, ...Array<string>(40).fill(""), admitted];
    }
    case "A28":
    case "A31":
      return ["1", "N"];
  }
}
