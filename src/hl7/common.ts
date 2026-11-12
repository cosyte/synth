/**
 * Shared HL7 v2 building blocks for every message family `@cosyte/synth` generates: the MSH scaffold,
 * the seeded timestamp, and the patient-identity bundle + its `PID` segment. Factored out so `ADT`,
 * `ORU`, `ORM`, `SIU`, and `VXU` all mint identity from the **same** synthetic-safety providers in the
 * **same** draw order, and all emit through `@cosyte/hl7`'s conservative serializer. Nothing here draws a
 * value that is not sourced from `../safe`: the synthetic-by-construction
 * invariant holds by construction for every family.
 *
 * @module
 */

import type { Hl7Message, RawField } from "@cosyte/hl7";

import { type Rng } from "../rng/rng.js";
import {
  safe,
  type SyntheticName,
  type SyntheticAddress,
  type SyntheticIdentifier,
  type AnimalCode,
} from "../safe/index.js";

import { componentsField } from "./field.js";
import { hl7Peer } from "../peers.js";

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

/**
 * A `YYYYMMDDHHMMSS` timestamp moved by a number of seconds, carried across minute, hour, day, month
 * and year boundaries in UTC (the timestamps carry no zone, so no daylight-saving shift applies).
 *
 * @param timestamp - A 14-digit `YYYYMMDDHHMMSS` timestamp.
 * @param seconds - The seconds to add; negative moves it back.
 * @returns The moved 14-digit timestamp.
 * @example
 * ```ts
 * shiftTimestamp("20251231235959", 1); // "20260101000000"
 * ```
 * @internal
 */
export function shiftTimestamp(timestamp: string, seconds: number): string {
  const at = new Date(
    Date.UTC(
      Number(timestamp.slice(0, 4)),
      Number(timestamp.slice(4, 6)) - 1,
      Number(timestamp.slice(6, 8)),
      Number(timestamp.slice(8, 10)),
      Number(timestamp.slice(10, 12)),
      Number(timestamp.slice(12, 14)) + seconds,
    ),
  );
  const pad = (n: number, width = 2): string => String(n).padStart(width, "0");
  return (
    pad(at.getUTCFullYear(), 4) +
    pad(at.getUTCMonth() + 1) +
    pad(at.getUTCDate()) +
    pad(at.getUTCHours()) +
    pad(at.getUTCMinutes()) +
    pad(at.getUTCSeconds())
  );
}

/** The MSH scaffold shared by every generated message: the built message plus its seeded MSH values. */
export interface MessageScaffold {
  /** The `Hl7Message` with a complete MSH: chain `.addSegment(...)` to append the payload. */
  readonly message: Hl7Message;
  /** The seeded `YYYYMMDDHHMMSS` message timestamp (MSH-7), reused for event/observation times. */
  readonly timestamp: string;
  /** The seeded message control id (MSH-10). */
  readonly controlId: string;
}

/**
 * Build the MSH scaffold for a message of the given `MSH-9` type through `@cosyte/hl7`'s `buildMessage`,
 * so the delimiters, control id, and header layout are the parser's own conservative emit. Draws the
 * timestamp then the control id from `rng` (a fixed order: the reproducibility contract).
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
  const message = hl7Peer().buildMessage({
    type,
    sendingApp: "COSYTE-SYNTH",
    sendingFacility: "SYNTH-FAC",
    receivingApp: "RECEIVER",
    receivingFacility: "RECV-FAC",
    controlId,
    timestamp,
    version: "2.5",
    // MSH-11 processing ID `T` (HL7 table 0103: training), never `P` (production): every message
    // says it is test data in the field the standard gives for it.
    processingId: "T",
  });
  return { message, timestamp, controlId };
}

/** A complete synthetic patient identity: every field drawn from `../safe`. */
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
 * Mint a complete synthetic {@link PatientIdentity}. Every value comes from a synthetic-safety provider,
 * so no code path here can return a real or plausibly-real identifier. The draw order is
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
 * Lay out a fully-populated `PID` segment from a {@link PatientIdentity} as `addSegment` fields: the
 * PHI-dense segment shared by every family. Components go through {@link componentsField} so the parser
 * lays out the `^` separators (building *through* the parser).
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

/**
 * Who a message is about. `"person"`, the default, is the human patient every generator has always
 * written. `"animal"` writes a veterinary patient instead: see {@link AnimalIdentity}.
 */
export type Hl7Subject = "person" | "animal";

/**
 * Every value {@link Hl7Subject} takes. Erased at run time, so a caller's subject is resolved
 * against it.
 *
 * @returns The subjects, the default first.
 * @internal
 */
export function hl7Subjects(): readonly Hl7Subject[] {
  return ["person", "animal"];
}

/** An animal's owner: every value drawn from `../safe`. */
export interface AnimalOwner {
  /** The owner's name, from the shipped fake-name pool. */
  readonly person: SyntheticName;
  /** The owner's synthetic postal address (reserved non-real ZIP), which is also the animal's. */
  readonly address: SyntheticAddress;
  /** The owner's reserved `555-01xx` phone number. */
  readonly phone: string;
}

/** A complete synthetic animal patient: every value drawn from `../safe`. */
export interface AnimalIdentity {
  /** The pet's name, from the shipped fake pet-name pool. */
  readonly petName: string;
  /** The record number, scoped to the synthetic assigning authority. */
  readonly record: SyntheticIdentifier;
  /** A 15-digit microchip that begins `999`. */
  readonly microchip: string;
  /** The species, from our own short list. */
  readonly species: AnimalCode;
  /** The breed, one of the species' breeds. */
  readonly breed: AnimalCode;
  /** Birth date (`YYYYMMDD`), 0 to 20 years before the message date. */
  readonly dob: string;
  /** Administrative sex. */
  readonly sex: "M" | "F";
  /** The owner. */
  readonly owner: AnimalOwner;
}

/**
 * The identifier type the animal subject writes for a microchip in PID-3 (CX.5): `MCN`, which we
 * use for microchip number. We have not verified it against HL7 table 0203 (identifier type) in any
 * version. Not verified.
 */
// Stryker disable all: a module-level value is built once, at import, so per-test coverage cannot
// attribute it to the tests that check it; test/hl7/animal.test.ts asserts its exact value.
export const MICROCHIP_IDENTIFIER_TYPE = "MCN";
// Stryker restore all

/**
 * The owner relationship the animal subject writes in NK1-3: `OWN^Owner^HL70063`. We have not
 * verified that `OWN` is a value of HL7 table 0063 (relationship). Not verified.
 */
// Stryker disable all: a module-level value is built once, at import, so per-test coverage cannot
// attribute it to the tests that check it; test/hl7/animal.test.ts asserts its exact value.
export const OWNER_RELATIONSHIP = Object.freeze({ code: "OWN", text: "Owner", system: "HL70063" });
// Stryker restore all

/**
 * Mint a complete synthetic {@link AnimalIdentity}. The draw order is fixed (owner name, pet name,
 * record number, microchip, species and breed, birth date, sex, address, phone) so the same seed and
 * date yield the same animal.
 *
 * @param rng - The seeded generator.
 * @param onDate - The message date, `YYYYMMDD` or a longer timestamp: the birth date falls from 0
 *   to 20 years before it.
 * @returns A synthetic {@link AnimalIdentity}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { animalIdentity } from "@cosyte/synth/hl7";
 * const pet = animalIdentity(createRng(1), "20250101");
 * pet.species.text; // e.g. "Dog"
 * ```
 */
export function animalIdentity(rng: Rng, onDate: string): AnimalIdentity {
  const person = safe.name(rng);
  const petName = safe.petName(rng);
  const record = safe.identifier(rng, "MR");
  const microchip = safe.microchip(rng);
  const { species, breed } = safe.animalBreed(rng);
  const dob = safe.animalBirthDate(rng, onDate);
  const sex = rng.pick(["M", "F"] as const);
  const address = safe.address(rng);
  const phone = safe.phone(rng);
  return {
    petName,
    record,
    microchip,
    species,
    breed,
    dob,
    sex,
    owner: { person, address, phone },
  };
}

/** One `CE` triple as a field. */
function codedField(value: Readonly<{ code: string; text: string; system: string }>): RawField {
  return componentsField([value.code, value.text, value.system]);
}

/**
 * Lay out the `PID` segment of an {@link AnimalIdentity}: the record number and the microchip as two
 * PID-3 repetitions, the owner's family name and the pet's name in PID-5, the owner's address and
 * phone, and the species in PID-35 and breed in PID-36. PID-19 (SSN) stays empty.
 *
 * @param id - The synthetic animal to render.
 * @returns The `PID` field list for `Hl7Message.addSegment("PID", …)`.
 * @example
 * ```ts
 * // msg.addSegment("PID", animalPidSegment(animalIdentity(createRng(1), "20250101")));
 * ```
 */
export function animalPidSegment(id: AnimalIdentity): readonly (string | RawField)[] {
  const authority = id.record.assigningAuthority;
  const cx = (value: string, type: string): RawField["repetitions"][number] => ({
    components: [value, "", "", authority, type].map((c) => ({ subcomponents: [c] })),
  });
  const identifiers: RawField = {
    repetitions: [
      cx(id.record.value, id.record.typeCode),
      cx(id.microchip, MICROCHIP_IDENTIFIER_TYPE),
    ],
    isNull: false,
  };
  const { person, address, phone } = id.owner;
  return [
    "1", // PID-1 set id
    "", // PID-2
    identifiers, // PID-3 CX: record number, then microchip
    "", // PID-4
    componentsField([person.family, id.petName]), // PID-5 XPN: owner family, pet name
    "", // PID-6
    id.dob, // PID-7 DOB
    id.sex, // PID-8 sex
    "", // PID-9
    "", // PID-10
    componentsField([address.street, "", address.city, address.state, address.zip]), // PID-11 XAD
    "", // PID-12
    phone, // PID-13 phone
    ...Array<string>(21).fill(""), // PID-14 to PID-34
    codedField(id.species), // PID-35 species code (CE)
    codedField(id.breed), // PID-36 breed code (CE)
  ];
}

/**
 * Lay out the owner's `NK1` segment: the owner's name, relationship {@link OWNER_RELATIONSHIP}
 * (`OWN`, not verified against HL7 table 0063), address and phone.
 *
 * @param id - The synthetic animal whose owner to render.
 * @returns The `NK1` field list for `Hl7Message.addSegment("NK1", …)`.
 * @example
 * ```ts
 * // msg.addSegment("NK1", ownerNk1Segment(animalIdentity(createRng(1), "20250101")));
 * ```
 */
export function ownerNk1Segment(id: AnimalIdentity): readonly (string | RawField)[] {
  const { person, address, phone } = id.owner;
  return [
    "1", // NK1-1 set id
    componentsField([person.family, person.given]), // NK1-2 name
    codedField(OWNER_RELATIONSHIP), // NK1-3 relationship (CE)
    componentsField([address.street, "", address.city, address.state, address.zip]), // NK1-4
    phone, // NK1-5 phone
  ];
}

/**
 * Add the subject's segments after the MSH (and EVN): a person's `PID`, drawn exactly as every
 * generator always has, or an animal's `PID` and its owner's `NK1`.
 *
 * @param message - The message under construction.
 * @param rng - The seeded generator.
 * @param subject - The resolved subject.
 * @param timestamp - The message timestamp (MSH-7): an animal's birth date is set against it.
 * @internal
 */
export function addSubject(
  message: Hl7Message,
  rng: Rng,
  subject: Hl7Subject,
  timestamp: string,
): void {
  if (subject === "person") {
    message.addSegment("PID", pidSegment(patientIdentity(rng)));
    return;
  }
  const animal = animalIdentity(rng, timestamp);
  message.addSegment("PID", animalPidSegment(animal));
  message.addSegment("NK1", ownerNk1Segment(animal));
}
