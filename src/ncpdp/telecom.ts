/**
 * Spec-clean NCPDP **Telecommunication vD.0** claim generation — `B1` (billing), `B2` (reversal), and
 * `B3` (rebill) — built through `@cosyte/ncpdp`'s `buildTelecomRequest` + `serializeTelecom` so the
 * fixed Transaction Header, the FS/GS/RS framing, and every field are the parser's own conservative
 * emit (roadmap §Phase 6). Every field id below is a real 2-character NCPDP field identifier, and every
 * value at a PHI-bearing locus is drawn from the synthetic-safety providers via {@link ./identity}: the
 * patient / cardholder names come from the fake-name pool, the DOB / dates from the seeded generator,
 * the phone from the reserved `555-01xx` block, the member / cardholder ids under the synthetic
 * assigning authority, and the prescriber NPI with an invalid Luhn check digit. Each transaction
 * round-trips through `parseTelecom` with zero warnings (roadmap §6).
 *
 * @module
 */

import {
  buildTelecomRequest,
  serializeTelecom,
  type TelecomHeaderInput,
  type TelecomSegmentInput,
  type TelecomFieldInput,
} from "@cosyte/ncpdp/telecom";

import { createRng, type Rng } from "../rng/rng.js";
import { ncpdpPatient, ncpdpCardholder, ncpdpPharmacy, ncpdpPrescriber } from "./identity.js";
import { EXAMPLE_DRUGS, DAW_CODES } from "./example-codes.js";

/** The Telecom transaction codes `synth` generates. */
export type TelecomTransactionCode = "B1" | "B2" | "B3";

/** A synthetic routing BIN (an ISO/IIN routing number — not patient identity, kept clearly synthetic). */
const SYNTHETIC_BIN = "999999";

/** Options for the Telecom generators. */
export interface GenerateTelecomOptions {
  /** The seed (deterministic — same seed yields a byte-identical transaction). */
  readonly seed: number;
}

/** Drop any incidental separators; keep the compact wire value (never carries FS/GS/RS). */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Build the fixed Transaction Header for the given transaction code, from seeded identity. */
function header(
  rng: Rng,
  transactionCode: TelecomTransactionCode,
  pharmacyNpi: string,
): TelecomHeaderInput {
  const date = serviceDate(rng);
  return {
    binNumber: SYNTHETIC_BIN,
    versionRelease: "D0",
    transactionCode,
    processorControlNumber: `SYN${rng.digits(4)}`,
    transactionCount: "1",
    serviceProviderIdQualifier: "01", // 01 = NPI
    serviceProviderId: pharmacyNpi,
    dateOfService: date,
    softwareCertificationId: `SW${rng.digits(6)}`,
  };
}

/** A seeded `CCYYMMDD` service date in a recent window. */
function serviceDate(rng: Rng): string {
  const year = rng.int(2024, 2026);
  const month = rng.int(1, 12);
  const day = rng.int(1, 28);
  return `${String(year)}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

/** A field pair; dropped when the value is empty so no empty field is emitted. */
function field(id: string, value: string): TelecomFieldInput {
  return { id, value };
}

/** The Patient segment (01) — CA/CB name, C4 DOB, C5 gender, CM address, CQ phone, CY patient id. */
function patientSegment(rng: Rng): TelecomSegmentInput {
  const p = ncpdpPatient(rng);
  return {
    segmentId: "01",
    fields: [
      field("C4", p.dob),
      field("C5", p.gender),
      field("CA", p.person.given),
      field("CB", p.person.family),
      field("CM", p.address.street),
      field("CQ", digitsOnly(p.phone)),
      field("CY", p.patientId),
    ],
  };
}

/** The Insurance segment (04) — C2 cardholder id, C1 group, C3 person code, CC/CD cardholder name. */
function insuranceSegment(rng: Rng): TelecomSegmentInput {
  const c = ncpdpCardholder(rng);
  return {
    segmentId: "04",
    fields: [
      field("C2", c.cardholderId),
      field("C1", c.groupId),
      field("C3", c.personCode),
      field("CC", c.person.given),
      field("CD", c.person.family),
    ],
  };
}

/** The Prescriber segment (03) — DB prescriber id (NPI), EZ qualifier (`01` = NPI). */
function prescriberSegment(rng: Rng): TelecomSegmentInput {
  const dr = ncpdpPrescriber(rng);
  return {
    segmentId: "03",
    fields: [field("EZ", "01"), field("DB", dr.npi)],
  };
}

/** The Claim segment (07) — Rx ref, product (NDC), quantity, days supply, DAW. `minimal` for a reversal. */
function claimSegment(rng: Rng, minimal: boolean): TelecomSegmentInput {
  const drug = rng.pick(EXAMPLE_DRUGS);
  const rxRef = `RX${rng.digits(7)}`;
  const fill = String(rng.int(0, 5));
  if (minimal) {
    return {
      segmentId: "07",
      fields: [field("EM", "1"), field("D2", rxRef), field("D3", fill)],
    };
  }
  return {
    segmentId: "07",
    fields: [
      field("EM", "1"), // 1 = Rx Billing
      field("D2", rxRef),
      field("D3", fill),
      field("E1", "03"), // 03 = NDC
      field("D7", drug.ndc),
      field("E7", String(rng.int(30, 90))),
      field("D5", String(rng.pick([30, 60, 90] as const))),
      field("D8", rng.pick(DAW_CODES)),
    ],
  };
}

/**
 * Generate a spec-clean Telecom transaction of the given code, built through
 * `@cosyte/ncpdp`'s `buildTelecomRequest` + `serializeTelecom`. `B1`/`B3` carry the full
 * patient / insurance / prescriber / claim segment set; `B2` (reversal) is the minimal
 * insurance + claim-reference set a reversal actually carries. Every identity value is
 * synthetic-by-construction (roadmap §4); the transaction round-trips through `parseTelecom` with zero
 * warnings.
 *
 * @param code - `"B1"` billing, `"B2"` reversal, or `"B3"` rebill.
 * @param options - The seed. See {@link GenerateTelecomOptions}.
 * @returns The serialized Telecom wire string.
 * @example
 * ```ts
 * import { generateTelecom } from "@cosyte/synth/ncpdp";
 * const wire = generateTelecom("B1", { seed: 42 });
 * ```
 */
export function generateTelecom(
  code: TelecomTransactionCode,
  options: GenerateTelecomOptions,
): string {
  const rng = createRng(options.seed);
  const pharmacy = ncpdpPharmacy(rng);
  const head = header(rng, code, pharmacy.npi);
  const segments: TelecomSegmentInput[] =
    code === "B2"
      ? [insuranceSegment(rng), claimSegment(rng, true)]
      : [
          patientSegment(rng),
          insuranceSegment(rng),
          prescriberSegment(rng),
          claimSegment(rng, false),
        ];
  return serializeTelecom(buildTelecomRequest({ header: head, segments }));
}

/**
 * Generate a spec-clean Telecom **B1** billing claim.
 *
 * @param options - The seed.
 * @returns The serialized Telecom wire string.
 * @example
 * ```ts
 * import { generateB1 } from "@cosyte/synth/ncpdp";
 * const wire = generateB1({ seed: 1 });
 * ```
 */
export function generateB1(options: GenerateTelecomOptions): string {
  return generateTelecom("B1", options);
}

/**
 * Generate a spec-clean Telecom **B2** reversal.
 *
 * @param options - The seed.
 * @returns The serialized Telecom wire string.
 * @example
 * ```ts
 * import { generateB2 } from "@cosyte/synth/ncpdp";
 * const wire = generateB2({ seed: 1 });
 * ```
 */
export function generateB2(options: GenerateTelecomOptions): string {
  return generateTelecom("B2", options);
}

/**
 * Generate a spec-clean Telecom **B3** rebill.
 *
 * @param options - The seed.
 * @returns The serialized Telecom wire string.
 * @example
 * ```ts
 * import { generateB3 } from "@cosyte/synth/ncpdp";
 * const wire = generateB3({ seed: 1 });
 * ```
 */
export function generateB3(options: GenerateTelecomOptions): string {
  return generateTelecom("B3", options);
}
