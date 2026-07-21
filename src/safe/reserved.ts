/**
 * The reserved / never-collide identifier facts that make a `@cosyte/synth` value **provably
 * synthetic** — the ground truth behind the synthetic-safety invariant (roadmap §4).
 *
 * These are **facts**, not copyrighted prose: authoritative ranges published by SSA, NANPA, and the
 * IETF that are guaranteed never to denote a real person or a real routable resource. Every provider
 * draws only from these; the predicates here are the executable half of the CI synthetic-safety gate —
 * they let a test assert that no emitted value falls **outside** a reserved source (roadmap §6).
 *
 * Sources (roadmap §11, verified firsthand):
 * - **SSN** — SSA never issues area numbers `000`, `666`, or `900–999`; the `987-65-4320…4329` block
 *   is SSA's explicitly-reserved advertising range. (ssa.gov)
 * - **Phone** — NANP reserves `555-0100…555-0199` as the fictional/non-working line range. (nanpa.com)
 * - **Email/domain** — RFC 2606 / RFC 6761 reserved: `example.com`/`.net`/`.org` and the `.example`,
 *   `.test`, `.invalid`, `.localhost` TLDs.
 * - **IP** — RFC 5737 IPv4 TEST-NET-1/2/3 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) and
 *   RFC 3849 IPv6 documentation prefix `2001:db8::/32`.
 *
 * @module
 */

/**
 * The synthetic **assigning authority** `@cosyte/synth` mints MRNs / account / member identifiers
 * under. There is **no** reserved MRN range (an MRN is unique only within its assigning-authority /
 * OID namespace), so — a documented design decision (roadmap §4.1, §10 Q2) — every synthetic identifier
 * is scoped to a namespace that clearly cannot be a real facility's: a `SYNTH`-labelled authority whose
 * OID lives under HL7's designated **example** root `2.16.840.1.113883.19`. A value under this AA can
 * never collide with a real record because the *namespace itself* is synthetic.
 */
export const SYNTHETIC_ASSIGNING_AUTHORITY = Object.freeze({
  /** The human-readable assigning-authority namespace id (HL7 HD.1). */
  namespaceId: "COSYTE-SYNTH",
  /** The universal id — an OID under HL7's example arc `2.16.840.1.113883.19` (HD.2). */
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
 * Whether a `ddd-dd-dddd` (or `ddddddddd`) SSN string is drawn from an SSA never-issued / reserved
 * space — area `000`, `666`, or `900–999`. A real, issuable SSN returns `false`.
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
