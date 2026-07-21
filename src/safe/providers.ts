/**
 * The synthetic-safety provider layer — every identifier, contact point, name, and date
 * `@cosyte/synth` emits is minted here, and **only** from a guaranteed-non-colliding source
 * (roadmap §4). There is no code path that returns a value not drawn from a reserved range or the
 * shipped fake-name pool. This is the inverse of a parser's liberality: the generator is *closed-world*
 * on its data sources, so no output *can* be real or plausibly-real PHI.
 *
 * All providers are pure functions of an explicit {@link ../rng/rng.Rng} — same seed, same values.
 *
 * @module
 */

import type { Rng } from "../rng/rng.js";

import {
  RESERVED_EMAIL_DOMAINS,
  TEST_NET_V4_PREFIXES,
  DOC_V6_PREFIX,
  SYNTHETIC_ASSIGNING_AUTHORITY,
  npiCheckDigit,
} from "./reserved.js";
import {
  SYNTHETIC_GIVEN_NAMES,
  SYNTHETIC_FAMILY_NAMES,
  SYNTHETIC_STREET_NAMES,
  SYNTHETIC_CITY_NAMES,
} from "./names-pool.js";

/** A synthetic person name drawn from the shipped fake-name pool. */
export interface SyntheticName {
  /** A clearly-fake given name. */
  readonly given: string;
  /** A clearly-fake family name. */
  readonly family: string;
}

/** A synthetic postal address — synthetic street + city, a fixed non-real ZIP. */
export interface SyntheticAddress {
  /** A clearly-fake street line. */
  readonly street: string;
  /** A clearly-fake city. */
  readonly city: string;
  /** A US state abbreviation (structural only; never combined with a real street + name + DOB). */
  readonly state: string;
  /** A reserved non-real ZIP (`00000`). */
  readonly zip: string;
}

/** A synthetic identifier scoped to the synthetic assigning authority. */
export interface SyntheticIdentifier {
  /** The identifier value (digits) — unique only within the synthetic namespace. */
  readonly value: string;
  /** HL7 identifier type code (`MR` = medical record, `AN` = account, `MB` = member). */
  readonly typeCode: "MR" | "AN" | "MB";
  /** The synthetic assigning-authority namespace id. */
  readonly assigningAuthority: string;
  /** The synthetic assigning-authority OID (HL7 example arc). */
  readonly assigningAuthorityOid: string;
}

/** Which SSN reserved space to draw from. */
export type SsnBlock = "never-issued" | "advertising";

/**
 * A **synthetic SSN** — dashed `AAA-GG-SSSS`. Default draws the SSA never-issued area space
 * (`900–999`); `block: "advertising"` draws SSA's reserved advertising block (`987-65-4320…4329`).
 * A value from this function can never be a real SSN (roadmap §4.1).
 *
 * @param rng - The seeded generator.
 * @param block - Which reserved space to draw from. Defaults to `"never-issued"`.
 * @returns A dashed synthetic SSN string.
 * @example
 * ```ts
 * import { createRng, ssn } from "@cosyte/synth";
 * ssn(createRng(1)); // e.g. a 900-area, never-issued SSN
 * ```
 */
export function ssn(rng: Rng, block: SsnBlock = "never-issued"): string {
  if (block === "advertising") {
    // SSA's explicitly-reserved advertising block: last digit 0..9 within -4320..-4329.
    return `987-65-432${String(rng.int(0, 9))}`;
  }
  const area = rng.int(900, 999); // SSA never issues 900-999.
  const group = rng.digits(2);
  const serial = rng.digits(4);
  return `${String(area)}-${group}-${serial}`;
}

/**
 * A **synthetic phone** in the NANP reserved fictional block — `(AAA) 555-01NN`. The reserved
 * guarantee is the `555-01NN` tail (exchange 555, line 0100–0199); the area code is any NANP-valid
 * `NXX`. Can never be a working number (roadmap §4.2).
 *
 * @param rng - The seeded generator.
 * @returns A formatted synthetic phone string.
 * @example
 * ```ts
 * import { createRng, phone } from "@cosyte/synth";
 * phone(createRng(1)); // e.g. "(2XX) 555-01NN"
 * ```
 */
export function phone(rng: Rng): string {
  const area = `${String(rng.int(2, 9))}${rng.digits(2)}`; // NXX area code.
  const line = `01${rng.digits(2)}`; // reserved 0100-0199.
  return `(${area}) 555-${line}`;
}

/**
 * A **synthetic name** drawn from the shipped clearly-fake pool.
 *
 * @param rng - The seeded generator.
 * @returns A {@link SyntheticName}.
 * @example
 * ```ts
 * import { createRng, name } from "@cosyte/synth";
 * const { given, family } = name(createRng(1));
 * ```
 */
export function name(rng: Rng): SyntheticName {
  return { given: rng.pick(SYNTHETIC_GIVEN_NAMES), family: rng.pick(SYNTHETIC_FAMILY_NAMES) };
}

/**
 * A **synthetic email** at an RFC 2606 / 6761 reserved domain — `<slug>@example.com`.
 *
 * @param rng - The seeded generator.
 * @param person - Optional name to derive the local-part slug from; otherwise a random slug is used.
 * @returns A synthetic email address.
 * @example
 * ```ts
 * import { createRng, email, name } from "@cosyte/synth";
 * email(createRng(1), name(createRng(1))); // "<given>.<family>@example.com"
 * ```
 */
export function email(rng: Rng, person?: SyntheticName): string {
  const domain = rng.pick(RESERVED_EMAIL_DOMAINS);
  const slug = person ? `${person.given}.${person.family}`.toLowerCase() : `synth${rng.digits(6)}`;
  return `${slug}@${domain}`;
}

/**
 * A **synthetic IPv4** in an RFC 5737 TEST-NET block — never routable (roadmap §4.2).
 *
 * @param rng - The seeded generator.
 * @returns A TEST-NET IPv4 address string.
 * @example
 * ```ts
 * import { createRng, ipv4 } from "@cosyte/synth";
 * ipv4(createRng(1)); // e.g. "192.0.2.NN"
 * ```
 */
export function ipv4(rng: Rng): string {
  return `${rng.pick(TEST_NET_V4_PREFIXES)}.${String(rng.int(1, 254))}`;
}

/**
 * A **synthetic IPv6** in the RFC 3849 documentation prefix `2001:db8::/32` — never routable.
 *
 * @param rng - The seeded generator.
 * @returns A documentation-prefix IPv6 address string.
 * @example
 * ```ts
 * import { createRng, ipv6 } from "@cosyte/synth";
 * ipv6(createRng(1)); // e.g. "2001:db8::NNNN"
 * ```
 */
export function ipv6(rng: Rng): string {
  const tail = rng.nextUint32().toString(16).padStart(4, "0").slice(-4);
  return `${DOC_V6_PREFIX}::${tail}`;
}

/**
 * A **deterministic UUIDv4-shaped** surrogate key from the seeded generator. Because it is seeded (not
 * from `node:crypto`, which is not reproducible), the cryptographic non-collision argument is weaker —
 * acceptable because the identifier namespace is synthetic anyway, and noted honestly (roadmap §4.1).
 *
 * @param rng - The seeded generator.
 * @returns A canonical `8-4-4-4-12` lowercase-hex UUID string with version `4` and RFC 4122 variant.
 * @example
 * ```ts
 * import { createRng, uuid } from "@cosyte/synth";
 * uuid(createRng(1)); // "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
 * ```
 */
export function uuid(rng: Rng): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = rng.int(0, 255);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

/**
 * A **synthetic NPI** — a 10-digit National Provider Identifier with a **deliberately-invalid Luhn
 * check digit**, so it can never be a NPPES-issued NPI (a real NPI must satisfy the `80840`-prefixed
 * Luhn check — roadmap §4.1). The 9-digit base is drawn from the seeded generator; the check digit is
 * set to `(correct + 1) mod 10`, guaranteeing the full value fails validation.
 *
 * @param rng - The seeded generator.
 * @returns A 10-digit NPI-shaped string that is provably not a real NPI.
 * @example
 * ```ts
 * import { createRng, npi, isSyntheticNpi } from "@cosyte/synth";
 * isSyntheticNpi(npi(createRng(1))); // true — invalid check digit by construction
 * ```
 */
export function npi(rng: Rng): string {
  const base9 = rng.digits(9);
  const wrongCheck = (npiCheckDigit(base9) + 1) % 10;
  return `${base9}${String(wrongCheck)}`;
}

/**
 * A **synthetic identifier** (MRN / account / member id) scoped to the synthetic assigning authority.
 * There is no reserved MRN range, so non-collision is guaranteed by the *namespace*, not the value
 * (roadmap §4.1, §10 Q2): the identifier lives under a `SYNTH` authority no real facility uses.
 *
 * @param rng - The seeded generator.
 * @param typeCode - The HL7 identifier type: `MR` (default), `AN`, or `MB`.
 * @returns A {@link SyntheticIdentifier}.
 * @example
 * ```ts
 * import { createRng, identifier } from "@cosyte/synth";
 * identifier(createRng(1), "MR"); // { value, typeCode: "MR", assigningAuthority: "COSYTE-SYNTH", ... }
 * ```
 */
export function identifier(
  rng: Rng,
  typeCode: SyntheticIdentifier["typeCode"] = "MR",
): SyntheticIdentifier {
  return {
    value: rng.digits(8),
    typeCode,
    assigningAuthority: SYNTHETIC_ASSIGNING_AUTHORITY.namespaceId,
    assigningAuthorityOid: SYNTHETIC_ASSIGNING_AUTHORITY.universalId,
  };
}

/**
 * A **synthetic address** — a fake street + city, a reserved non-real ZIP (`00000`). A real state
 * abbreviation may appear (structural only) but is never combined with a real street + name + DOB
 * (roadmap §4.3).
 *
 * @param rng - The seeded generator.
 * @returns A {@link SyntheticAddress}.
 * @example
 * ```ts
 * import { createRng, address } from "@cosyte/synth";
 * address(createRng(1)); // { street, city, state, zip: "00000" }
 * ```
 */
export function address(rng: Rng): SyntheticAddress {
  const number = rng.int(1, 9999);
  return {
    street: `${String(number)} ${rng.pick(SYNTHETIC_STREET_NAMES)}`,
    city: rng.pick(SYNTHETIC_CITY_NAMES),
    state: rng.pick(US_STATES),
    zip: "00000",
  };
}

/**
 * A **synthetic date** in HL7 `YYYYMMDD` form, drawn uniformly within an inclusive year range. Comes
 * from the seeded generator (never wall-clock), so it is reproducible and implies no real event
 * (roadmap §4.3, §5).
 *
 * @param rng - The seeded generator.
 * @param minYear - Inclusive lower year bound (default `1930`).
 * @param maxYear - Inclusive upper year bound (default `2010`).
 * @returns An `YYYYMMDD` date string (always a valid calendar day).
 * @example
 * ```ts
 * import { createRng, dateYmd } from "@cosyte/synth";
 * dateYmd(createRng(1), 1970, 2000); // "YYYYMMDD"
 * ```
 */
export function dateYmd(rng: Rng, minYear = 1930, maxYear = 2010): string {
  const year = rng.int(minYear, maxYear);
  const month = rng.int(1, 12);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = rng.int(1, daysInMonth);
  return `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

/** US state abbreviations — structural only (see {@link address}). */
const US_STATES: readonly string[] = Object.freeze([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
]);
