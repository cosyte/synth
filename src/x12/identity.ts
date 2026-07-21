/**
 * Synthetic identity for X12 healthcare transactions — every subscriber, patient, provider, and payer
 * identifier `synth` puts into an 837 / 835 / 271 is minted here, and **only** from the
 * synthetic-safety providers (roadmap §4). X12 is uniquely identity-dense: a claim carries subscriber
 * *and* patient names, member ids, provider NPIs, a provider tax id, dates of birth, and addresses —
 * across two HL loops. The synthetic-by-construction invariant is therefore attacked hardest here, so
 * every locus below has a construction-level guarantee, not a heuristic:
 *
 * - **member id** — minted under the synthetic assigning authority (no reserved range exists; the
 *   *namespace* is the guarantee — roadmap §4.1).
 * - **NPI** — a deliberately **invalid Luhn** check digit, so it can never be a NPPES-issued NPI
 *   ({@link ../safe/reserved.isSyntheticNpi}).
 * - **provider tax id** — emitted as an SSN (REF*SY) in the SSA **never-issued** 900-range, so it can
 *   never be a real, issuable SSN (900–999 is never assigned as an SSN — the universal synthetic-safe
 *   SSN convention).
 * - **name** — the shipped clearly-fake pool; **DOB / dates** — the seeded generator (no real event
 *   implied); **address** — synthetic street + reserved ZIP.
 *
 * @module
 */

import type { Rng } from "../rng/rng.js";
import { safe, type SyntheticName, type SyntheticAddress } from "../safe/index.js";

/** Synthetic trading-partner (submitter / receiver / payer id) codes — never real assigned ids. */
const SYNTHETIC_ORG_NAMES: readonly string[] = Object.freeze([
  "SYNTH BILLING GROUP",
  "FIXTURE CLINIC INC",
  "PLACEHOLDER MEDICAL CTR",
  "SAMPLE HEALTH PARTNERS",
  "MOCK CARE ASSOCIATES",
  "PROTOTYPE PHYSICIANS LLC",
]);

/** Synthetic payer names — clearly fictional carriers. */
const SYNTHETIC_PAYER_NAMES: readonly string[] = Object.freeze([
  "SYNTHCARE HEALTH PLAN",
  "FIXTURE MUTUAL INSURANCE",
  "PLACEHOLDER BENEFIT ADMIN",
  "SAMPLE STATE MEDICAID",
  "MOCK NATIONAL INSURER",
]);

/** A synthetic person (subscriber / patient / rendering provider) — all fields from `../safe`. */
export interface X12Person {
  /** Name from the shipped fake-name pool. */
  readonly person: SyntheticName;
  /** Member/cardholder id, synthetic-AA scoped (all-digit under a synthetic namespace). */
  readonly memberId: string;
  /** Date of birth `CCYYMMDD` from the seeded generator. */
  readonly dob: string;
  /** Administrative sex (X12 DMG-03 `M`/`F`). */
  readonly sex: "M" | "F";
  /** Synthetic postal address (reserved non-real ZIP). */
  readonly address: SyntheticAddress;
}

/** A synthetic billing organization — org name + invalid-Luhn NPI + never-issued-SSN tax id. */
export interface X12Organization {
  /** A clearly-fictional organization name. */
  readonly name: string;
  /** A 10-digit NPI with a deliberately-invalid Luhn check digit (never a real NPI). */
  readonly npi: string;
  /** The provider tax id as a never-issued (900-range) SSN — emitted at REF*SY. */
  readonly taxIdSsn: string;
  /** Synthetic postal address. */
  readonly address: SyntheticAddress;
}

/** A synthetic payer — name + a synthetic payer id (PI). */
export interface X12Payer {
  /** A clearly-fictional payer name. */
  readonly name: string;
  /** The payer identifier (NM1*PR*...*PI), synthetic. */
  readonly payerId: string;
}

/** The submitter / receiver trading-partner identity for the interchange envelope. */
export interface X12TradingPartners {
  /** ISA-06 / submitter id. */
  readonly senderId: string;
  /** ISA-08 / receiver id. */
  readonly receiverId: string;
}

/**
 * Mint a synthetic person. Fixed draw order (name → member id → DOB → sex → address) so the same seed
 * yields the same person (roadmap §5).
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link X12Person}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { x12Person } from "@cosyte/synth/x12";
 * const { person, memberId } = x12Person(createRng(1));
 * ```
 */
export function x12Person(rng: Rng): X12Person {
  const person = safe.name(rng);
  const memberId = `MBR${safe.identifier(rng, "MB").value}`;
  const dob = safe.dateYmd(rng, 1935, 2010);
  const sex = rng.pick(["M", "F"] as const);
  const address = safe.address(rng);
  return { person, memberId, dob, sex, address };
}

/**
 * Mint a synthetic billing organization — org name, an invalid-Luhn NPI, a never-issued-SSN tax id,
 * and an address.
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link X12Organization}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { x12Organization } from "@cosyte/synth/x12";
 * const org = x12Organization(createRng(1)); // org.npi is invalid-Luhn; org.taxIdSsn is 900-range
 * ```
 */
export function x12Organization(rng: Rng): X12Organization {
  const name = rng.pick(SYNTHETIC_ORG_NAMES);
  const npiValue = safe.npi(rng);
  const taxIdSsn = safe.ssn(rng).replace(/\D/g, ""); // 900-range, 9 digits, no dashes for REF*SY.
  const address = safe.address(rng);
  return { name, npi: npiValue, taxIdSsn, address };
}

/**
 * Mint a synthetic rendering/service provider **person** — a person name plus an invalid-Luhn NPI.
 *
 * @param rng - The seeded generator.
 * @returns The provider name and NPI.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { x12ProviderPerson } from "@cosyte/synth/x12";
 * const rendering = x12ProviderPerson(createRng(1));
 * ```
 */
export function x12ProviderPerson(rng: Rng): {
  readonly person: SyntheticName;
  readonly npi: string;
} {
  const person = safe.name(rng);
  const npiValue = safe.npi(rng);
  return { person, npi: npiValue };
}

/**
 * Mint a synthetic payer — a fictional name and a synthetic payer id.
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link X12Payer}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { x12Payer } from "@cosyte/synth/x12";
 * const payer = x12Payer(createRng(1));
 * ```
 */
export function x12Payer(rng: Rng): X12Payer {
  const name = rng.pick(SYNTHETIC_PAYER_NAMES);
  const payerId = `SYN${rng.digits(5)}`;
  return { name, payerId };
}

/**
 * Mint synthetic submitter/receiver trading-partner ids for the interchange envelope. These are not
 * PHI, but are kept clearly synthetic for consistency.
 *
 * @param rng - The seeded generator.
 * @returns Synthetic {@link X12TradingPartners}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { x12TradingPartners } from "@cosyte/synth/x12";
 * const { senderId, receiverId } = x12TradingPartners(createRng(1));
 * ```
 */
export function x12TradingPartners(rng: Rng): X12TradingPartners {
  return { senderId: `SYNSUB${rng.digits(3)}`, receiverId: `SYNRCV${rng.digits(3)}` };
}

/** A seeded interchange/group/transaction envelope timing + control-number bundle. */
export interface X12EnvelopeTiming {
  /** ISA-09 interchange date `YYMMDD`. */
  readonly interchangeDate: string;
  /** ISA-10 interchange time `HHMM`. */
  readonly interchangeTime: string;
  /** ISA-13 interchange control number (9 digits). */
  readonly interchangeControlNumber: string;
  /** GS-06 group control number. */
  readonly groupControlNumber: string;
  /** ST-02 transaction set control number (4+ digits). */
  readonly transactionSetControlNumber: string;
  /** A `CCYYMMDD` transaction/service base date (recent, seeded). */
  readonly serviceDate: string;
}

/**
 * Mint a seeded envelope timing + control-number bundle. The service/transaction date is drawn in a
 * recent plausible window (2024–2026) so a generated transaction reads like a current one; every value
 * is seeded, so the interchange is byte-reproducible (roadmap §5).
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link X12EnvelopeTiming}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { x12EnvelopeTiming } from "@cosyte/synth/x12";
 * const timing = x12EnvelopeTiming(createRng(1));
 * ```
 */
export function x12EnvelopeTiming(rng: Rng): X12EnvelopeTiming {
  const serviceDate = safe.dateYmd(rng, 2024, 2026); // CCYYMMDD
  const yy = serviceDate.slice(2, 4);
  const mmdd = serviceDate.slice(4, 8);
  const hh = String(rng.int(0, 23)).padStart(2, "0");
  const mi = String(rng.int(0, 59)).padStart(2, "0");
  return {
    interchangeDate: `${yy}${mmdd}`,
    interchangeTime: `${hh}${mi}`,
    interchangeControlNumber: rng.digits(9),
    groupControlNumber: String(rng.int(1, 99999)),
    transactionSetControlNumber: rng.digits(4),
    serviceDate,
  };
}
