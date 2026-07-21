/**
 * Shared HL7 v2 building blocks for every message family `@cosyte/synth` generates — the MSH scaffold,
 * the seeded timestamp, and the patient-identity bundle + its `PID` segment. Factored out so `ADT`,
 * `ORU`, `ORM`, `SIU`, and `VXU` all mint identity from the **same** synthetic-safety providers in the
 * **same** draw order, and all emit through `@cosyte/hl7`'s conservative serializer (roadmap §1, §Phase
 * 2). Nothing here draws a value that is not sourced from `../safe` — the synthetic-by-construction
 * invariant holds by construction for every family.
 *
 * @module
 */

import { buildMessage, type Hl7Message, type RawField } from "@cosyte/hl7";

import { type Rng } from "../rng/rng.js";
import {
  safe,
  type SyntheticName,
  type SyntheticAddress,
  type SyntheticIdentifier,
} from "../safe/index.js";

import { componentsField } from "./field.js";

/**
 * A seeded HL7 `YYYYMMDDHHMMSS` timestamp (message/event time; recent-year range). Strict HL7 DTM, so
 * `@cosyte/hl7` parses it back with no `TIMESTAMP_FALLBACK_FORMAT` warning.
 *
 * @param rng - The seeded generator.
 * @returns A 14-digit `YYYYMMDDHHMMSS` timestamp string.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * // "20230714…"
 * ```
 */
export function seededTimestamp(rng: Rng): string {
  const date = safe.dateYmd(rng, 2020, 2025);
  const hh = String(rng.int(0, 23)).padStart(2, "0");
  const mm = String(rng.int(0, 59)).padStart(2, "0");
  const ss = String(rng.int(0, 59)).padStart(2, "0");
  return `${date}${hh}${mm}${ss}`;
}

/** The MSH scaffold shared by every generated message: the built message plus its seeded MSH values. */
export interface MessageScaffold {
  /** The `Hl7Message` with a complete MSH — chain `.addSegment(...)` to append the payload. */
  readonly message: Hl7Message;
  /** The seeded `YYYYMMDDHHMMSS` message timestamp (MSH-7), reused for event/observation times. */
  readonly timestamp: string;
  /** The seeded message control id (MSH-10). */
  readonly controlId: string;
}

/**
 * Build the MSH scaffold for a message of the given `MSH-9` type through `@cosyte/hl7`'s `buildMessage`,
 * so the delimiters, control id, and header layout are the parser's own conservative emit. Draws the
 * timestamp then the control id from `rng` (a fixed order — the reproducibility contract, roadmap §5).
 *
 * @param rng - The seeded generator.
 * @param type - The `MSH-9` message type, e.g. `"ORU^R01"`.
 * @returns The {@link MessageScaffold}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * // mshScaffold(createRng(1), "ORU^R01").message.addSegment("PID", […]);
 * ```
 */
export function mshScaffold(rng: Rng, type: string): MessageScaffold {
  const timestamp = seededTimestamp(rng);
  const controlId = `SYNTH${rng.digits(10)}`;
  const message = buildMessage({
    type,
    sendingApp: "COSYTE-SYNTH",
    sendingFacility: "SYNTH-FAC",
    receivingApp: "RECEIVER",
    receivingFacility: "RECV-FAC",
    controlId,
    timestamp,
    version: "2.5",
    processingId: "P",
  });
  return { message, timestamp, controlId };
}

/** A complete synthetic patient identity — every field drawn from `../safe` (roadmap §4). */
export interface PatientIdentity {
  /** Name from the shipped fake-name pool. */
  readonly person: SyntheticName;
  /** Medical-record identifier scoped to the synthetic assigning authority. */
  readonly mrn: SyntheticIdentifier;
  /** Date of birth (`YYYYMMDD`) from the seeded generator. */
  readonly dob: string;
  /** Administrative sex. */
  readonly sex: "M" | "F";
  /** Synthetic postal address (reserved non-real ZIP). */
  readonly address: SyntheticAddress;
  /** Reserved `555-01xx` phone number. */
  readonly phone: string;
  /** Never-issued SSN as 9 digits (no dashes), for `PID-19`. */
  readonly ssnDigits: string;
}

/**
 * Mint a complete synthetic {@link PatientIdentity}. Every value comes from a synthetic-safety provider
 * — no code path here can return a real or plausibly-real identifier (roadmap §4). The draw order is
 * fixed (name → MRN → DOB → sex → address → phone → SSN) so the same seed yields the same identity.
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link PatientIdentity}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * // const id = patientIdentity(createRng(1)); // id.person, id.mrn, …
 * ```
 */
export function patientIdentity(rng: Rng): PatientIdentity {
  const person = safe.name(rng);
  const mrn = safe.identifier(rng, "MR");
  const dob = safe.dateYmd(rng, 1930, 2010);
  const sex = rng.pick(["M", "F"] as const);
  const address = safe.address(rng);
  const phone = safe.phone(rng);
  const ssnDigits = safe.ssn(rng).replace(/-/g, "");
  return { person, mrn, dob, sex, address, phone, ssnDigits };
}

/**
 * Lay out a fully-populated `PID` segment from a {@link PatientIdentity} as `addSegment` fields — the
 * PHI-dense segment shared by every family. Components go through {@link componentsField} so the parser
 * lays out the `^` separators (building *through* the parser, roadmap §1).
 *
 * @param id - The synthetic identity to render.
 * @returns The `PID` field list for `Hl7Message.addSegment("PID", …)`.
 * @example
 * ```ts
 * // msg.addSegment("PID", pidSegment(patientIdentity(createRng(1))));
 * ```
 */
export function pidSegment(id: PatientIdentity): readonly (string | RawField)[] {
  return [
    "1", // PID-1 set id
    "", // PID-2 (legacy, absent)
    componentsField([id.mrn.value, "", "", id.mrn.assigningAuthority, id.mrn.typeCode]), // PID-3 CX
    "", // PID-4
    componentsField([id.person.family, id.person.given]), // PID-5 XPN
    "", // PID-6
    id.dob, // PID-7 DOB
    id.sex, // PID-8 sex
    "", // PID-9
    "", // PID-10
    componentsField([id.address.street, "", id.address.city, id.address.state, id.address.zip]), // PID-11 XAD
    "", // PID-12
    id.phone, // PID-13 phone
    "", // PID-14
    "", // PID-15
    "", // PID-16
    "", // PID-17
    "", // PID-18
    id.ssnDigits, // PID-19 SSN (digits)
  ];
}
