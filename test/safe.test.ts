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
  isSyntheticPhone,
  isSyntheticEmail,
  isSyntheticIp,
  SYNTHETIC_ASSIGNING_AUTHORITY,
  SYNTHETIC_GIVEN_NAMES,
  SYNTHETIC_FAMILY_NAMES,
} from "../src/index.js";

describe("synthetic-safety providers — every value is provably synthetic", () => {
  it("ssn draws the SSA never-issued area space (900-999)", () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const value = ssn(createRng(seed));
      expect(value).toMatch(/^\d{3}-\d{2}-\d{4}$/);
      expect(isSyntheticSsn(value)).toBe(true);
      expect(Number(value.slice(0, 3))).toBeGreaterThanOrEqual(900);
    }
  });

  it("ssn advertising block is the reserved 987-65-432x range", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const value = ssn(createRng(seed), "advertising");
      expect(value).toMatch(/^987-65-432\d$/);
      expect(isSyntheticSsn(value)).toBe(true);
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
    expect(isSyntheticSsn("123-45-6789")).toBe(false); // issuable area ⇒ not synthetic
    expect(isSyntheticSsn("12-34-5678")).toBe(false); // wrong length
    expect(isSyntheticSsn("000-12-3456")).toBe(true);
    expect(isSyntheticSsn("666-12-3456")).toBe(true);
  });

  it("isSyntheticPhone rejects a real working number", () => {
    expect(isSyntheticPhone("(212) 867-5309")).toBe(false);
  });

  it("isSyntheticEmail rejects a real domain", () => {
    expect(isSyntheticEmail("someone@gmail.com")).toBe(false);
    expect(isSyntheticEmail("no-at-sign")).toBe(false);
    expect(isSyntheticEmail("x@host.test")).toBe(true);
  });

  it("isSyntheticIp rejects a routable address", () => {
    expect(isSyntheticIp("8.8.8.8")).toBe(false);
    expect(isSyntheticIp("2001:db8::1")).toBe(true);
  });
});
