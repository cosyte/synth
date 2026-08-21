/**
 * The reserved / never-collide identifier facts that make a `@cosyte/synth` value **provably
 * synthetic**: the ground truth behind the synthetic-safety invariant.
 *
 * These are **facts**, not copyrighted prose: authoritative ranges published by SSA, the IRS, NANPA
 * and the IETF that are guaranteed never to denote a real person or a real routable resource. Where
 * two authorities share one number space (SSN and ITIN), a value must be outside both. Every provider
 * draws only from these; the predicates here are the executable half of the CI synthetic-safety gate:
 * they let a test assert that no emitted value falls **outside** a reserved source.
 *
 * Sources:
 * - **SSN**, SSA never issues area numbers `000`, `666`, or `900–999`. (ssa.gov)
 * - **ITIN**, an IRS Individual Taxpayer Identification Number shares the SSN number space by
 *   construction: it is a `9NN-GG-NNNN` value whose group `GG` falls in a published ITIN group
 *   range. Area `900-999` alone therefore does not prove a value cannot be a federally issued
 *   identifier, so a synthetic SSN also keeps its group outside every published range. (IRS
 *   Internal Revenue Manual 3.21.263)
 * - **Phone**, NANP reserves `555-0100…555-0199` as the fictional/non-working line range. (nanpa.com)
 * - **Email/domain**, RFC 2606 / RFC 6761 reserved: `example.com`/`.net`/`.org` and the `.example`,
 *   `.test`, `.invalid`, `.localhost` TLDs.
 * - **IP**, RFC 5737 IPv4 TEST-NET-1/2/3 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) and
 *   RFC 3849 IPv6 documentation prefix `2001:db8::/32`.
 * - **NPI**, a real National Provider Identifier is a 10-digit number whose last digit is a Luhn
 *   check digit computed over the `80840` prefix + the 9-digit base (CMS NPI check-digit rule, ISO
 *   7812). A number whose check digit is **wrong** therefore cannot be a NPPES-issued NPI. `synth`
 *   emits NPIs with a deliberately-invalid check digit, so no generated NPI can collide with a real
 *   provider.
 *
 * @module
 */

/**
 * The synthetic **assigning authority** `@cosyte/synth` mints MRNs / account / member identifiers
 * under. There is **no** reserved MRN range (an MRN is unique only within its assigning-authority /
 * OID namespace), so, as a documented design decision, every synthetic identifier
 * is scoped to a namespace that clearly cannot be a real facility's: a `SYNTH`-labelled authority whose
 * OID lives under HL7's designated **example** root `2.16.840.1.113883.19`. A value under this AA can
 * never collide with a real record because the *namespace itself* is synthetic.
 */
export const SYNTHETIC_ASSIGNING_AUTHORITY = Object.freeze({
  /** The human-readable assigning-authority namespace id (HL7 HD.1). */
  namespaceId: "COSYTE-SYNTH",
  /** The universal id, an OID under HL7's example arc `2.16.840.1.113883.19` (HD.2). */
  universalId: "2.16.840.1.113883.19.999",
  /** The universal id type (HD.3). */
  universalIdType: "ISO",
});

/** RFC 2606 / 6761 reserved email domains `@cosyte/synth` draws from. */
export const RESERVED_EMAIL_DOMAINS: readonly string[] = Object.freeze([
  "example.com",
  "example.org",
  "example.net",
]);

/** RFC 5737 IPv4 documentation (TEST-NET) `/24` network prefixes. */
export const TEST_NET_V4_PREFIXES: readonly string[] = Object.freeze([
  "192.0.2", // TEST-NET-1
  "198.51.100", // TEST-NET-2
  "203.0.113", // TEST-NET-3
]);

/** RFC 3849 IPv6 documentation prefix. */
export const DOC_V6_PREFIX = "2001:db8";

/**
 * The published **IRS ITIN group ranges**, inclusive `[min, max]` bands over the two group digits
 * (positions 4 and 5) of a `9NN-GG-NNNN` value. An Individual Taxpayer Identification Number is an
 * SSN-format number that begins with `9` and carries a group inside one of these bands, so these
 * bands are what separates a never-issued SSN from a validly formatted ITIN.
 *
 * These are **facts** about the number's shape, not copyrighted prose (IRS Internal Revenue Manual
 * 3.21.263). Group values `89` and `93` sit between the bands on purpose: the IRM records them as
 * reserved for other IRS programs rather than for ITINs, so a value carrying one is **not**
 * ITIN-formatted (see {@link isItinFormatted}).
 */
export const ITIN_GROUP_RANGES: readonly Readonly<{ min: number; max: number }>[] = Object.freeze([
  Object.freeze({ min: 50, max: 65 }),
  Object.freeze({ min: 70, max: 88 }),
  Object.freeze({ min: 90, max: 92 }),
  Object.freeze({ min: 94, max: 99 }),
]);

/**
 * The two group values the IRM records as reserved for other IRS programs rather than for ITINs.
 * They are **not** ITIN-formatted (so {@link isItinFormatted} must not claim them), and they are
 * still an issuing authority's space, so {@link SSN_SYNTHETIC_GROUPS} does not draw from them
 * either: the generator stays out of every federally used group, not merely out of the ITIN ones.
 *
 * @internal
 */
const ITIN_EXCLUDED_GROUPS: readonly number[] = Object.freeze([89, 93]);

/**
 * The two-digit **group values a synthetic SSN may carry**: every value from `00` to `99` that is
 * outside every band in {@link ITIN_GROUP_RANGES} and outside {@link ITIN_EXCLUDED_GROUPS}. Derived
 * from those two lists rather than written out, so the pool can never drift from the published
 * ranges it is defined against.
 *
 * Combined with the never-issued area `900-999`, a value drawn from this pool is provably outside
 * both issuing authorities that share the number space: SSA never issues the area, and the IRS
 * never issues an ITIN with this group.
 *
 * @internal
 */
export const SSN_SYNTHETIC_GROUPS: readonly string[] = Object.freeze(
  Array.from({ length: 100 }, (_unused, group) => group)
    .filter(
      (group) =>
        !ITIN_GROUP_RANGES.some((range) => group >= range.min && group <= range.max) &&
        !ITIN_EXCLUDED_GROUPS.includes(group),
    )
    .map((group) => String(group).padStart(2, "0")),
);

/**
 * The `80840` prefix prepended to a 10-digit NPI before the Luhn check (the CMS NPI check-digit
 * rule: `80840` is the ISO 7812 issuer identifier for the US health-application namespace). A real
 * NPI satisfies `luhn("80840" + npi) ≡ 0 (mod 10)`.
 */
export const NPI_LUHN_PREFIX = "80840";

/**
 * The Luhn sum (mod 10) of a numeric string, doubling every second digit from the right. Used to
 * verify (or deliberately break) an NPI check digit.
 *
 * @param digits - A string of decimal digits.
 * @returns The Luhn sum modulo 10 (0 ⇒ the string passes the Luhn check).
 * @internal
 */
export function luhnMod10(digits: string): number {
  let sum = 0;
  // Standard Luhn: the RIGHTMOST digit is never doubled; doubling starts one position in and
  // alternates. For a full payload+check string this makes a Luhn-valid string sum to 0 (mod 10);
  // for a payload with a `0` placeholder in the check position it yields the complement of the
  // correct check digit.
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) continue;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10;
}

/**
 * The correct NPI check digit for a 9-digit base: the value that makes `80840` + base + check pass
 * the Luhn check.
 *
 * @param base9 - The 9-digit NPI base (positions 1–9).
 * @returns The check digit (`0`–`9`) a real NPI would carry for this base.
 * @example
 * ```ts
 * import { npiCheckDigit } from "@cosyte/synth";
 * npiCheckDigit("123456789"); // 3, so 1234567893 is a Luhn-valid NPI shape
 * ```
 */
export function npiCheckDigit(base9: string): number {
  // Luhn over "80840" + base9 with a trailing 0 check placeholder; the check digit closes the sum.
  const partial = luhnMod10(`${NPI_LUHN_PREFIX}${base9}0`);
  return (10 - partial) % 10;
}

/**
 * The DEA-registration prefix letters `@cosyte/synth` draws a synthetic DEA number's first character
 * from. A real DEA number is `<registrant-type><last-name-initial>` + 7 digits; the first letter is the
 * registrant type (A/B/F/G/M/P/R/X are the widely-published values; the second letter is the
 * registrant's last-name initial). These letters are a **fact** about the number's shape, not
 * copyrighted prose: they only shape the value; the synthetic guarantee is the deliberately-**invalid
 * checksum** (see {@link dea} / {@link isSyntheticDea}).
 */
export const DEA_REGISTRANT_TYPES: readonly string[] = Object.freeze([
  "A",
  "B",
  "F",
  "G",
  "M",
  "P",
  "R",
  "X",
]);

/**
 * The correct DEA check digit for a 7-digit numeric base. The published DEA checksum is
 * `(d1 + d3 + d5) + 2·(d2 + d4 + d6)`, whose **units digit** is the 7th (check) digit. A real DEA
 * number satisfies this; a number whose 7th digit differs cannot be a validly-issued DEA registration.
 *
 * @param base6 - The first 6 digits of the DEA number (positions 1–6).
 * @returns The check digit (`0`–`9`) a real DEA number would carry for this base.
 * @example
 * ```ts
 * import { deaCheckDigit } from "@cosyte/synth";
 * deaCheckDigit("123456"); // the units digit of (1+3+5) + 2·(2+4+6)
 * ```
 */
export function deaCheckDigit(base6: string): number {
  let odd = 0;
  let even = 0;
  for (let i = 0; i < 6; i += 1) {
    const digit = base6.charCodeAt(i) - 48;
    if (i % 2 === 0) odd += digit;
    else even += digit;
  }
  return (odd + 2 * even) % 10;
}

/**
 * Whether a DEA number (`XX` + 7 digits, case-insensitive) is **provably synthetic**: its check digit
 * (the 7th digit) does **not** match the published DEA checksum, so it cannot be a validly-issued DEA
 * registration. A checksum-valid DEA number (which *could* denote a real prescriber) returns `false`; a
 * value that is not the DEA shape returns `false`.
 *
 * @param value - The candidate DEA number (with or without incidental separators).
 * @returns `true` when the DEA number's checksum is wrong (never a real DEA registration).
 * @example
 * ```ts
 * import { isSyntheticDea } from "@cosyte/synth";
 * isSyntheticDea("AF1234561"); // depends on the base: true when the 7th digit is wrong
 * ```
 */
export function isSyntheticDea(value: string): boolean {
  const compact = value.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{7}$/.test(compact)) return false;
  const digits = compact.slice(2);
  const check = digits.charCodeAt(6) - 48;
  return deaCheckDigit(digits.slice(0, 6)) !== check;
}

/**
 * Whether a 10-digit NPI is **provably synthetic**, i.e. its check digit is invalid, so it cannot be
 * a NPPES-issued NPI. A Luhn-valid 10-digit NPI (which *could* denote a real registered provider)
 * returns `false`; a non-10-digit value returns `false` (not an NPI shape).
 *
 * @param value - The candidate NPI (digits only, or with incidental separators).
 * @returns `true` when the NPI's check digit is wrong (never a real NPI).
 * @example
 * ```ts
 * import { isSyntheticNpi } from "@cosyte/synth";
 * isSyntheticNpi("1234567894"); // true: invalid check digit (valid would be 1234567893)
 * isSyntheticNpi("1234567893"); // false: Luhn-valid, could be a real NPI
 * ```
 */
export function isSyntheticNpi(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  return luhnMod10(`${NPI_LUHN_PREFIX}${digits}`) !== 0;
}

/**
 * Whether a `ddd-dd-dddd` (or `ddddddddd`) SSN string is drawn from an SSA never-issued / reserved
 * space: area `000`, `666`, or `900–999`. A real, issuable SSN returns `false`.
 *
 * @param value - The candidate SSN (dashes optional).
 * @returns `true` when the SSN is provably synthetic.
 * @example
 * ```ts
 * import { isSyntheticSsn } from "@cosyte/synth";
 * isSyntheticSsn("900-12-3456"); // true (never issued)
 * isSyntheticSsn("123456789");   // false (issuable area 123)
 * ```
 */
export function isSyntheticSsn(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return false;
  const area = Number(digits.slice(0, 3));
  return area === 0 || area === 666 || area >= 900;
}

/**
 * Whether a `ddd-dd-dddd` (or `ddddddddd`) value is a **validly formatted IRS ITIN**: it begins
 * with `9` and its group digits (positions 4 and 5) fall inside a published ITIN group range
 * ({@link ITIN_GROUP_RANGES}). This is the second issuing authority sharing the SSN number space,
 * so `isSyntheticSsn(v) && !isItinFormatted(v)` is the full "cannot be a federally issued national
 * id" guarantee, of which the area rule alone is only half.
 *
 * `true` means the value is ITIN-shaped and therefore **must not** be emitted at an SSN locus. A
 * value that is not exactly 9 digits once separators are stripped returns `false` (not an SSN/ITIN
 * shape) rather than throwing, as do the group values `89` and `93`, which the IRM reserves for
 * other IRS programs rather than for ITINs.
 *
 * @param value - The candidate national id (dashes and other separators optional).
 * @returns `true` when the value is formatted as a valid ITIN.
 * @example
 * ```ts
 * import { isItinFormatted } from "@cosyte/synth";
 * isItinFormatted("912-70-1234"); // true: group 70 is inside a published ITIN range
 * isItinFormatted("912-66-1234"); // false: group 66 is outside every published ITIN range
 * ```
 */
export function isItinFormatted(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return false;
  if (!digits.startsWith("9")) return false;
  const group = Number(digits.slice(3, 5));
  return ITIN_GROUP_RANGES.some((range) => group >= range.min && group <= range.max);
}

/**
 * Whether a phone string contains the NANP `555-0100…555-0199` reserved fictional line range.
 *
 * @param value - The candidate phone (any formatting).
 * @returns `true` when the number is in the reserved fictional block.
 * @example
 * ```ts
 * import { isSyntheticPhone } from "@cosyte/synth";
 * isSyntheticPhone("(202) 555-0142"); // true
 * ```
 */
export function isSyntheticPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  // The reserved guarantee is the 7-digit tail: exchange 555 + line 01NN.
  const tail = digits.slice(-7);
  return /^555 ?01\d\d$/.test(tail) || /^55501\d\d$/.test(tail);
}

/**
 * Whether an email's domain is an RFC 2606 / 6761 reserved / test domain.
 *
 * @param value - The candidate email address.
 * @returns `true` when the domain is reserved (never real).
 * @example
 * ```ts
 * import { isSyntheticEmail } from "@cosyte/synth";
 * isSyntheticEmail("faux.testerson@example.com"); // true
 * ```
 */
export function isSyntheticEmail(value: string): boolean {
  const at = value.lastIndexOf("@");
  if (at < 0) return false;
  const domain = value.slice(at + 1).toLowerCase();
  if (RESERVED_EMAIL_DOMAINS.includes(domain)) return true;
  return /\.(example|test|invalid|localhost)$/.test(domain);
}

/**
 * Whether an IP string is in an RFC 5737 (IPv4 TEST-NET) or RFC 3849 (IPv6 documentation) reserved
 * block. A real routable address returns `false`.
 *
 * @param value - The candidate IPv4 or IPv6 address.
 * @returns `true` when the address is a reserved documentation address.
 * @example
 * ```ts
 * import { isSyntheticIp } from "@cosyte/synth";
 * isSyntheticIp("192.0.2.44");  // true (TEST-NET-1)
 * isSyntheticIp("8.8.8.8");     // false (real)
 * ```
 */
export function isSyntheticIp(value: string): boolean {
  if (value.toLowerCase().startsWith(`${DOC_V6_PREFIX}:`)) return true;
  return TEST_NET_V4_PREFIXES.some((prefix) => value.startsWith(`${prefix}.`));
}
