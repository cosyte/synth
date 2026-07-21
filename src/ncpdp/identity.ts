/**
 * Synthetic identity for NCPDP transactions — every patient, prescriber, pharmacy, and cardholder
 * identifier `synth` puts into a SCRIPT ePrescription or a Telecom claim is minted here, and **only**
 * from the synthetic-safety providers (roadmap §4). NCPDP is identity-dense in a way the refuter
 * attacks hardest: a NewRx carries the **patient** (name, DOB, gender) *and* the **prescriber** (name,
 * NPI, **DEA**); a Telecom claim adds the **cardholder / member** (name, member id). Every locus below
 * has a construction-level guarantee, not a heuristic:
 *
 * - **NPI** — a deliberately **invalid Luhn** check digit, so it can never be a NPPES-issued NPI
 *   ({@link ../safe/reserved.isSyntheticNpi}).
 * - **DEA** — a deliberately **invalid checksum**, so it can never be a validly-issued DEA registration
 *   ({@link ../safe/reserved.isSyntheticDea}). This is the NCPDP-specific identity locus X12 did not have.
 * - **member / cardholder / patient id** — minted under the synthetic assigning authority with an
 *   `MBR` prefix (no reserved range exists; the *namespace* is the guarantee — roadmap §4.1).
 * - **name** — the shipped clearly-fake pool; **DOB** — the seeded generator (no real event implied);
 *   **phone** — the reserved `555-01xx` block; **address** — synthetic street + reserved ZIP.
 *
 * @module
 */

import type { Rng } from "../rng/rng.js";
import { safe, type SyntheticName, type SyntheticAddress } from "../safe/index.js";

/** Synthetic pharmacy business names — clearly fictional. */
const SYNTHETIC_PHARMACY_NAMES: readonly string[] = Object.freeze([
  "SYNTH COMMUNITY PHARMACY",
  "FIXTURE DRUG MART",
  "PLACEHOLDER RX SERVICES",
  "SAMPLE APOTHECARY LLC",
  "MOCK PHARMACY GROUP",
]);

/** A synthetic patient — every field from `../safe`. */
export interface NcpdpPatient {
  /** Name from the shipped fake-name pool. */
  readonly person: SyntheticName;
  /** Date of birth `CCYYMMDD` from the seeded generator. */
  readonly dob: string;
  /** Administrative gender code (`1` = male, `2` = female — NCPDP gender codes). */
  readonly gender: "1" | "2";
  /** Patient id, synthetic-AA scoped (`MBR`-prefixed — never a bare SSN). */
  readonly patientId: string;
  /** Reserved `555-01xx` phone. */
  readonly phone: string;
  /** Synthetic postal address (reserved non-real ZIP). */
  readonly address: SyntheticAddress;
}

/** A synthetic prescriber — name + invalid-Luhn NPI + invalid-checksum DEA. */
export interface NcpdpPrescriber {
  /** A clearly-fake prescriber name. */
  readonly person: SyntheticName;
  /** A 10-digit NPI with a deliberately-invalid Luhn check digit (never a real NPI). */
  readonly npi: string;
  /** A DEA number with a deliberately-invalid checksum (never a real DEA registration). */
  readonly dea: string;
}

/** A synthetic dispensing pharmacy — business name + invalid-Luhn NPI + synthetic NCPDP id. */
export interface NcpdpPharmacy {
  /** A clearly-fictional pharmacy business name. */
  readonly businessName: string;
  /** A 10-digit NPI with a deliberately-invalid Luhn check digit. */
  readonly npi: string;
  /** A 7-digit NCPDP provider id (synthetic — an all-digit id under no real chain). */
  readonly ncpdpId: string;
}

/** A synthetic cardholder / insurance identity — the covered person on a Telecom claim. */
export interface NcpdpCardholder {
  /** The cardholder name (may differ from the patient). */
  readonly person: SyntheticName;
  /** Cardholder / member id, synthetic-AA scoped (`MBR`-prefixed). */
  readonly cardholderId: string;
  /** Group id, synthetic. */
  readonly groupId: string;
  /** Person code (`01` = cardholder, `02` = spouse, `03` = child — structural). */
  readonly personCode: string;
}

/**
 * Mint a synthetic patient. Fixed draw order (name → DOB → gender → id → phone → address) so the same
 * seed yields the same patient (roadmap §5).
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link NcpdpPatient}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { ncpdpPatient } from "@cosyte/synth/ncpdp";
 * const { person, patientId } = ncpdpPatient(createRng(1));
 * ```
 */
export function ncpdpPatient(rng: Rng): NcpdpPatient {
  const person = safe.name(rng);
  const dob = safe.dateYmd(rng, 1935, 2010);
  const gender = rng.pick(["1", "2"] as const);
  const patientId = `MBR${safe.identifier(rng, "MR").value}`;
  const phone = safe.phone(rng);
  const address = safe.address(rng);
  return { person, dob, gender, patientId, phone, address };
}

/**
 * Mint a synthetic prescriber — a person name, an invalid-Luhn NPI, and an invalid-checksum DEA (the
 * DEA's second letter is derived from the prescriber's family name so it reads plausibly).
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link NcpdpPrescriber}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { ncpdpPrescriber } from "@cosyte/synth/ncpdp";
 * const p = ncpdpPrescriber(createRng(1)); // p.npi invalid-Luhn; p.dea invalid-checksum
 * ```
 */
export function ncpdpPrescriber(rng: Rng): NcpdpPrescriber {
  const person = safe.name(rng);
  const npi = safe.npi(rng);
  const dea = safe.dea(rng, person);
  return { person, npi, dea };
}

/**
 * Mint a synthetic dispensing pharmacy — a fictional business name, an invalid-Luhn NPI, and a 7-digit
 * synthetic NCPDP provider id.
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link NcpdpPharmacy}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { ncpdpPharmacy } from "@cosyte/synth/ncpdp";
 * const rx = ncpdpPharmacy(createRng(1));
 * ```
 */
export function ncpdpPharmacy(rng: Rng): NcpdpPharmacy {
  const businessName = rng.pick(SYNTHETIC_PHARMACY_NAMES);
  const npi = safe.npi(rng);
  const ncpdpId = rng.digits(7);
  return { businessName, npi, ncpdpId };
}

/**
 * Mint a synthetic cardholder / insurance identity for a Telecom claim.
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link NcpdpCardholder}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { ncpdpCardholder } from "@cosyte/synth/ncpdp";
 * const c = ncpdpCardholder(createRng(1));
 * ```
 */
export function ncpdpCardholder(rng: Rng): NcpdpCardholder {
  const person = safe.name(rng);
  const cardholderId = `MBR${safe.identifier(rng, "MB").value}`;
  const groupId = `GRP${rng.digits(5)}`;
  const personCode = rng.pick(["01", "02", "03"] as const);
  return { person, cardholderId, groupId, personCode };
}

/** A seeded SCRIPT routing/correlation bundle — message ids + timestamps, all reproducible. */
export interface NcpdpScriptRouting {
  /** `<MessageID>` — a synthetic message id. */
  readonly messageId: string;
  /** `<SentTime>` — a seeded ISO-8601 timestamp (never wall-clock). */
  readonly sentTime: string;
  /** `<PrescriberOrderNumber>` — a synthetic order number. */
  readonly prescriberOrderNumber: string;
  /** A `CCYYMMDD` written / service date (seeded, recent window). */
  readonly date: string;
}

/**
 * Mint a seeded SCRIPT routing bundle. The timestamp is drawn from the seeded generator in a recent
 * window (2024–2026) so a message reads current while staying byte-reproducible (roadmap §5).
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link NcpdpScriptRouting}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { ncpdpScriptRouting } from "@cosyte/synth/ncpdp";
 * const r = ncpdpScriptRouting(createRng(1));
 * ```
 */
export function ncpdpScriptRouting(rng: Rng): NcpdpScriptRouting {
  const date = safe.dateYmd(rng, 2024, 2026); // CCYYMMDD
  const yyyy = date.slice(0, 4);
  const mm = date.slice(4, 6);
  const dd = date.slice(6, 8);
  const hh = String(rng.int(0, 23)).padStart(2, "0");
  const mi = String(rng.int(0, 59)).padStart(2, "0");
  return {
    messageId: `SYNTH-${rng.digits(10)}`,
    sentTime: `${yyyy}-${mm}-${dd}T${hh}:${mi}:00Z`,
    prescriberOrderNumber: `PON${rng.digits(8)}`,
    date,
  };
}
