/**
 * Spec-clean HL7 v2 `ADT` generation, built **through `@cosyte/hl7`'s `buildMessage`** so MSH
 * delimiters, segment layout, and escaping are the parser's own conservative emit — spec-clean *by
 * construction* (roadmap §1, §Phase 1 harness proof). Every PHI-bearing field (name, DOB, SSN, MRN,
 * address, phone) is drawn from the synthetic-safety providers (`../safe`), so no value can be real.
 *
 * Phase 1 proves the end-to-end round-trip harness on this one message family (`ADT^A01/A04/A08`, which
 * all require `PID` + `PV1`). The full HL7 message set (ORU/ORM/SIU/VXU) is Phase 2.
 *
 * @module
 */

import { buildMessage, type Hl7Message } from "@cosyte/hl7";

import { createRng, type Rng } from "../rng/rng.js";
import { safe } from "../safe/index.js";

import { componentsField } from "./field.js";

/** The ADT trigger events Phase 1 generates (all require the PID + PV1 groups). */
export type AdtTrigger = "A01" | "A04" | "A08";

/** Options for {@link generateAdt}. */
export interface GenerateAdtOptions {
  /** The seed — the same seed yields a byte-identical message. Defaults to `0`. */
  readonly seed?: number;
  /** The ADT trigger event. Defaults to `"A01"`. */
  readonly trigger?: AdtTrigger;
}

/** A seeded HL7 `YYYYMMDDHHMMSS` timestamp (message time; recent-year range). */
function seededTimestamp(rng: Rng): string {
  const date = safe.dateYmd(rng, 2020, 2025);
  const hh = String(rng.int(0, 23)).padStart(2, "0");
  const mm = String(rng.int(0, 59)).padStart(2, "0");
  const ss = String(rng.int(0, 59)).padStart(2, "0");
  return `${date}${hh}${mm}${ss}`;
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

  const timestamp = seededTimestamp(rng);
  const controlId = `SYNTH${rng.digits(10)}`;

  const person = safe.name(rng);
  const mrn = safe.identifier(rng, "MR");
  const dob = safe.dateYmd(rng, 1930, 2010);
  const sex = rng.pick(["M", "F"] as const);
  const addr = safe.address(rng);
  const tel = safe.phone(rng);
  const ssnDigits = safe.ssn(rng).replace(/-/g, "");
  const patientClass = rng.pick(["I", "O", "E"] as const);

  const msg = buildMessage({
    type: `ADT^${trigger}`,
    sendingApp: "COSYTE-SYNTH",
    sendingFacility: "SYNTH-FAC",
    receivingApp: "RECEIVER",
    receivingFacility: "RECV-FAC",
    controlId,
    timestamp,
    version: "2.5",
    processingId: "P",
  });

  msg.addSegment("EVN", [trigger, timestamp]);

  msg.addSegment("PID", [
    "1", // PID-1 set id
    "", // PID-2 (legacy, absent)
    componentsField([mrn.value, "", "", mrn.assigningAuthority, mrn.typeCode]), // PID-3 CX
    "", // PID-4
    componentsField([person.family, person.given]), // PID-5 XPN
    "", // PID-6
    dob, // PID-7 DOB
    sex, // PID-8 sex
    "", // PID-9
    "", // PID-10
    componentsField([addr.street, "", addr.city, addr.state, addr.zip]), // PID-11 XAD
    "", // PID-12
    tel, // PID-13 phone
    "", // PID-14
    "", // PID-15
    "", // PID-16
    "", // PID-17
    "", // PID-18
    ssnDigits, // PID-19 SSN (digits)
  ]);

  msg.addSegment("PV1", [
    "1", // PV1-1 set id
    patientClass, // PV1-2 patient class
    componentsField(["SYNTHWARD", String(rng.int(1, 999)).padStart(3, "0"), "01"]), // PV1-3 PL
  ]);

  return msg;
}
