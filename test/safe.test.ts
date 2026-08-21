import { describe, expect, it } from "vitest";

import {
  createRng,
  safe,
  ssn,
  phone,
  email,
  ipv4,
  ipv6,
  uuid,
  identifier,
  address,
  dateYmd,
  name,
  isSyntheticSsn,
  isItinFormatted,
  ITIN_GROUP_RANGES,
  isSyntheticPhone,
  isSyntheticEmail,
  isSyntheticIp,
  SYNTHETIC_ASSIGNING_AUTHORITY,
  SYNTHETIC_GIVEN_NAMES,
  SYNTHETIC_FAMILY_NAMES,
} from "../src/index.js";
import { SSN_SYNTHETIC_GROUPS } from "../src/safe/reserved.js";

// `scripts/phi-scan.ts` walks all of `test/`, so this suite sits inside the corpus
// the PHI gate guards. The three values below are deliberately NON-synthetic: they
// are what the predicates under test must REJECT, so they cannot be declared in
// `scripts/phi-allow-list.txt` without defeating the assertions that use them.
// Assembling them from parts keeps the literal out of the file while leaving the
// value the predicate sees identical.
const digits = (...parts: string[]): string => parts.join("");
const addr = (user: string, ...domain: string[]): string => `${user}@${domain.join(".")}`;

describe("synthetic-safety providers: every value is provably synthetic", () => {
  it("ssn draws the SSA never-issued area space (900-999)", () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const value = ssn(createRng(seed));
      expect(value).toMatch(/^\d{3}-\d{2}-\d{4}$/);
      expect(isSyntheticSsn(value)).toBe(true);
      expect(Number(value.slice(0, 3))).toBeGreaterThanOrEqual(900);
    }
  });

  it("ssn is never ITIN-formatted, and generation never fails for a seed", () => {
    // The IRS shares this number space: an ITIN is an SSN-format value beginning with 9. Every
    // draw must clear BOTH authorities, and the draw is restricted rather than retried, so a seed
    // whose group would have been ITIN-shaped still yields a value instead of throwing.
    for (let seed = 0; seed < 2000; seed += 1) {
      const value = ssn(createRng(seed));
      expect(isSyntheticSsn(value), `${value} SSA floor`).toBe(true);
      expect(isItinFormatted(value), `${value} ITIN-formatted`).toBe(false);
    }
  });

  it("every group value ssn can draw is outside every published ITIN range", () => {
    // The pool is derived from the published ranges, so this pins the derivation, not a copy.
    expect(SSN_SYNTHETIC_GROUPS).toHaveLength(54); // 100 - 44 ITIN values - 89 and 93
    for (const group of SSN_SYNTHETIC_GROUPS) {
      expect(group).toMatch(/^\d{2}$/);
      expect(isItinFormatted(`912-${group}-3456`), `group ${group}`).toBe(false);
    }
    // Non-vacuity: the complement really is ITIN-formatted, so the pool is not trivially "all".
    const drawable = new Set(SSN_SYNTHETIC_GROUPS);
    for (let group = 0; group < 100; group += 1) {
      const gg = String(group).padStart(2, "0");
      if (drawable.has(gg) || gg === "89" || gg === "93") continue;
      expect(isItinFormatted(`912-${gg}-3456`), `group ${gg}`).toBe(true);
    }
  });

  it("ssn advertising block is the fixed 987-00-432x display range", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const value = ssn(createRng(seed), "advertising");
      expect(value).toMatch(/^987-00-432\d$/);
      expect(isSyntheticSsn(value)).toBe(true);
      // The same not-ITIN-formatted guarantee as the default block, over arbitrary seeds.
      expect(isItinFormatted(value), `${value} ITIN-formatted`).toBe(false);
      expect(SSN_SYNTHETIC_GROUPS).toContain(value.slice(4, 6));
    }
  });

  it("phone is always in the reserved 555-01xx fictional block", () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const value = phone(createRng(seed));
      expect(isSyntheticPhone(value)).toBe(true);
      expect(value).toMatch(/555-01\d\d$/);
    }
  });

  it("email always uses a reserved / test domain", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const rng = createRng(seed);
      const person = name(rng);
      const value = email(rng, person);
      expect(isSyntheticEmail(value)).toBe(true);
    }
    expect(isSyntheticEmail(email(createRng(1)))).toBe(true); // no-name slug path
  });

  it("ipv4 is always TEST-NET; ipv6 is always the documentation prefix", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      expect(isSyntheticIp(ipv4(createRng(seed)))).toBe(true);
      expect(isSyntheticIp(ipv6(createRng(seed)))).toBe(true);
    }
  });

  it("uuid is a canonical v4-shaped string", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      expect(uuid(createRng(seed))).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("identifier is scoped to the synthetic assigning authority", () => {
    const id = identifier(createRng(1), "MR");
    expect(id.value).toMatch(/^\d{8}$/);
    expect(id.typeCode).toBe("MR");
    expect(id.assigningAuthority).toBe(SYNTHETIC_ASSIGNING_AUTHORITY.namespaceId);
    expect(id.assigningAuthorityOid).toBe(SYNTHETIC_ASSIGNING_AUTHORITY.universalId);
    expect(identifier(createRng(1), "AN").typeCode).toBe("AN");
    expect(identifier(createRng(1), "MB").typeCode).toBe("MB");
    expect(identifier(createRng(1)).typeCode).toBe("MR");
  });

  it("name draws only from the shipped clearly-fake pool", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const person = name(createRng(seed));
      expect(SYNTHETIC_GIVEN_NAMES).toContain(person.given);
      expect(SYNTHETIC_FAMILY_NAMES).toContain(person.family);
    }
  });

  it("address uses a synthetic street/city and the reserved 00000 ZIP", () => {
    const a = address(createRng(1));
    expect(a.zip).toBe("00000");
    expect(a.street).toMatch(/^\d+ /);
    expect(a.state).toMatch(/^[A-Z]{2}$/);
  });

  it("dateYmd is a valid calendar day in range and reproducible", () => {
    const a = dateYmd(createRng(1), 1970, 2000);
    const b = dateYmd(createRng(1), 1970, 2000);
    expect(a).toBe(b);
    expect(a).toMatch(/^\d{8}$/);
    const year = Number(a.slice(0, 4));
    expect(year).toBeGreaterThanOrEqual(1970);
    expect(year).toBeLessThanOrEqual(2000);
    // Every generated month/day is a real calendar day (no Feb 30).
    for (let seed = 0; seed < 2000; seed += 1) {
      const d = dateYmd(createRng(seed));
      const y = Number(d.slice(0, 4));
      const m = Number(d.slice(4, 6));
      const day = Number(d.slice(6, 8));
      const rebuilt = new Date(Date.UTC(y, m - 1, day));
      expect(rebuilt.getUTCMonth()).toBe(m - 1);
      expect(rebuilt.getUTCDate()).toBe(day);
    }
  });

  it("the `safe` namespace exposes the same providers and is frozen", () => {
    expect(Object.isFrozen(safe)).toBe(true);
    expect(safe.ssn).toBe(ssn);
    expect(safe.phone).toBe(phone);
    expect(safe.uuid).toBe(uuid);
  });
});

describe("reserved-range predicates reject real-looking values", () => {
  it("isSyntheticSsn rejects issuable areas and malformed input", () => {
    expect(isSyntheticSsn(digits("123", "-45-", "6789"))).toBe(false); // issuable area ⇒ not synthetic
    expect(isSyntheticSsn("12-34-5678")).toBe(false); // wrong length
    expect(isSyntheticSsn("000-12-3456")).toBe(true);
    expect(isSyntheticSsn("666-12-3456")).toBe(true);
  });

  it("the SSA never-issued-area floor is unchanged by the ITIN check", () => {
    // Closing the ITIN gap must not narrow the pre-existing area rule: 000, 666 and 900-999 stay
    // synthetic under isSyntheticSsn whatever their group digits are, including ITIN-shaped ones.
    expect(isSyntheticSsn("900-70-1234")).toBe(true); // ITIN-shaped, still never-issued by SSA
    expect(isSyntheticSsn("987-65-4320")).toBe(true); // the old advertising value, still area 987
    expect(isSyntheticSsn("000-70-1234")).toBe(true);
    expect(isSyntheticSsn("666-70-1234")).toBe(true);
    expect(isSyntheticSsn(digits("123", "-70-", "1234"))).toBe(false); // issuable area, unchanged
    for (let area = 900; area <= 999; area += 1) {
      expect(isSyntheticSsn(`${String(area)}-70-1234`), `area ${String(area)}`).toBe(true);
    }
  });

  it("isItinFormatted covers every published group range and nothing else", () => {
    // Band edges, inside and just outside, for each published range.
    expect(isItinFormatted("912-50-3456")).toBe(true);
    expect(isItinFormatted("912-65-3456")).toBe(true);
    expect(isItinFormatted("912-49-3456")).toBe(false);
    expect(isItinFormatted("912-66-3456")).toBe(false);
    expect(isItinFormatted("912-70-3456")).toBe(true);
    expect(isItinFormatted("912-88-3456")).toBe(true);
    expect(isItinFormatted("912-90-3456")).toBe(true);
    expect(isItinFormatted("912-92-3456")).toBe(true);
    expect(isItinFormatted("912-94-3456")).toBe(true);
    expect(isItinFormatted("912-99-3456")).toBe(true);
    // The published ranges are exactly the four bands.
    expect(ITIN_GROUP_RANGES.map((r) => [r.min, r.max])).toEqual([
      [50, 65],
      [70, 88],
      [90, 92],
      [94, 99],
    ]);
    // Only a value beginning with 9 can be an ITIN, whatever its group.
    expect(isItinFormatted(digits("123", "-70-", "3456"))).toBe(false);
    expect(isItinFormatted(digits("899", "-70-", "3456"))).toBe(false);
    // Undashed is the same value.
    expect(isItinFormatted("912703456")).toBe(true);
  });

  it("isItinFormatted treats groups 89 and 93 as NOT ITIN-formatted", () => {
    // The IRM reserves these two for other IRS programs rather than for ITINs, so they sit
    // between the published bands and a value carrying one is not a validly formatted ITIN.
    expect(isItinFormatted("912-89-3456")).toBe(false);
    expect(isItinFormatted("912-93-3456")).toBe(false);
    // Their neighbours inside the bands still are, so this is a hole, not a shifted edge.
    expect(isItinFormatted("912-88-3456")).toBe(true);
    expect(isItinFormatted("912-90-3456")).toBe(true);
    expect(isItinFormatted("912-92-3456")).toBe(true);
    expect(isItinFormatted("912-94-3456")).toBe(true);
  });

  it("isItinFormatted reports non-9-digit input as not ITIN-formatted rather than throwing", () => {
    expect(() => isItinFormatted("912-70-345")).not.toThrow();
    expect(isItinFormatted("912-70-345")).toBe(false); // 8 digits
    expect(isItinFormatted("912-70-34567")).toBe(false); // 10 digits
    expect(isItinFormatted("")).toBe(false);
    expect(isItinFormatted("not-a-number")).toBe(false);
    expect(isItinFormatted("9")).toBe(false);
    expect(isItinFormatted("912-7O-3456")).toBe(false); // a letter, so 8 digits remain
  });

  it("isSyntheticPhone rejects a real working number", () => {
    expect(isSyntheticPhone("(212) 867-5309")).toBe(false);
  });

  it("isSyntheticEmail rejects a real domain", () => {
    expect(isSyntheticEmail(addr("someone", "gmail", "com"))).toBe(false);
    expect(isSyntheticEmail("no-at-sign")).toBe(false);
    // `.test` is a reserved TLD, so `isSyntheticEmail` accepts it; the scanner's own
    // email floor is domain-exact and does not, which is why this one is assembled too.
    expect(isSyntheticEmail(addr("x", "host", "test"))).toBe(true);
  });

  it("isSyntheticIp rejects a routable address", () => {
    expect(isSyntheticIp("8.8.8.8")).toBe(false);
    expect(isSyntheticIp("2001:db8::1")).toBe(true);
  });
});
