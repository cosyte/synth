/**
 * The synthetic-safety providers held to their sources.
 *
 * `test/safe.test.ts` checks each provider against the predicates and constants `src/safe` exports.
 * That leaves a gap: a table that drifted (an email domain, a TEST-NET block, an ITIN band, a name
 * in the pool) would move the provider and its predicate together, and both checks would still
 * pass. This file writes each source out on its own, from the published text the table cites, and
 * holds the tables and every provider's output to that copy:
 *
 * - each reserved table equals the published range it cites, written out here, not read back;
 * - for every seed (a property), each provider's value lies inside its reserved range or its source
 *   list, checked with this file's own copy of the rule (its own Luhn, its own DEA checksum);
 * - a sweep over seeds draws every entry of every pool, so a pool entry that changed is seen.
 *
 * Each case imports `src/safe` afresh inside the test, so the module's tables are built while the
 * case runs and a mutation test sees which case reads them.
 */

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { createRng, type Rng } from "../src/rng/rng.js";
import {
  dateYmd,
  deaCheckDigit,
  ipv6,
  isSyntheticDea,
  isSyntheticEmail,
  isSyntheticNpi,
  isSyntheticPhone,
  isSyntheticSsn,
  luhnMod10,
} from "../src/safe/index.js";
import type * as SafeModule from "../src/safe/index.js";
import { checkProperty } from "./support/property.js";

/** `src/safe` imported afresh, so its module-level tables are built inside the running case. */
async function freshSafe(): Promise<typeof SafeModule> {
  vi.resetModules();
  return import("../src/safe/index.js");
}

/** Every seed `createRng` takes, as a property input. */
const anySeed = (): fc.Arbitrary<number> => fc.integer({ min: -(2 ** 31), max: 2 ** 31 - 1 });

/** `[lo, hi]` inclusive, as numbers. */
const span = (lo: number, hi: number): number[] =>
  Array.from({ length: hi - lo + 1 }, (_unused, i) => lo + i);

// --- The published sources, written out ---------------------------------------------------------

/** RFC 2606 section 3, "Reserved Example Second Level Domain Names". */
const RFC2606_EXAMPLE_DOMAINS = ["example.com", "example.org", "example.net"];

/** RFC 5737 section 3: TEST-NET-1, TEST-NET-2 and TEST-NET-3, each a /24. */
const RFC5737_TEST_NETS = ["192.0.2", "198.51.100", "203.0.113"];

/** RFC 3849: "The prefix allocated for documentation purposes is 2001:DB8::/32". */
const RFC3849_PREFIX = "2001:db8";

/** IRS IRM 3.21.263: an ITIN's 4th and 5th digits "are 50-65, 70-88, 90-92 and 94-99". */
const IRM_ITIN_BANDS: readonly (readonly [number, number])[] = [
  [50, 65],
  [70, 88],
  [90, 92],
  [94, 99],
];

/** IRS IRM 3.21.263: the two groups between the bands, kept for other IRS programs. */
const IRM_OTHER_PROGRAM_GROUPS = [89, 93];

/**
 * The groups a synthetic SSN may carry: 00 to 99 minus every ITIN band and minus 89 and 93, which
 * leaves 00 to 49 and 66 to 69. Written as those two spans, not derived the way `src/safe` derives
 * it, so a fault in that derivation cannot hide in this copy.
 */
const SSN_GROUPS = [...span(0, 49), ...span(66, 69)].map((g) => String(g).padStart(2, "0"));

/** 69 FR 3434 (FR Doc 04-1149): the NPI check digit is computed as though preceded by 80840. */
const FR_NPI_PREFIX = "80840";

/** The DEA registrant-type letters `src/safe` documents for a DEA number's first character. */
const DEA_TYPES = ["A", "B", "F", "G", "M", "P", "R", "X"];

/** The synthetic assigning authority `src/safe` mints identifiers under (no authority reserves it). */
const ASSIGNING_AUTHORITY = {
  namespaceId: "COSYTE-SYNTH",
  universalId: "2.16.840.1.113883.19.999",
  universalIdType: "ISO",
};

/** USPS Publication 28, Appendix B: the fifty states' two-letter abbreviations. */
// prettier-ignore
const USPS_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

/**
 * The shipped name pool, written out. It is this package's own source: no authority publishes a
 * list of names that belong to no one, so the pool is pinned word for word. A change to it changes
 * the bytes of every seed, so it is a deliberate edit here as well as there.
 */
// prettier-ignore
const POOL = {
  given: [
    "Testina", "Fixtura", "Synthos", "Placeholda", "Sampleton", "Prototius", "Stubbina",
    "Exampla", "Quilliam", "Fabrica", "Simula", "Testry", "Seedwin", "Corpora", "Reprodo",
    "Mocktavia", "Dummett", "Voidwin", "Deteria", "Randomir",
  ],
  family: [
    "Testerson", "Fauxman", "Placeholt", "Mockridge", "Fixtingham", "Synthwell", "Dummerton",
    "Examplewood", "Fabricant", "Simulacre", "Nonesuch", "Seedman", "Corpusworth", "Reprodus",
    "Voidmark", "Deterwood", "Randomson", "Quillfeather", "Notreal", "Genfield",
  ],
  street: [
    "Fixture Lane", "Sample Street", "Placeholder Avenue", "Synthetic Way", "Example Boulevard",
    "Testing Terrace", "Mock Road", "Prototype Court",
  ],
  city: ["Faketon", "Synthville", "Exampleburg", "Testford", "Mockhaven", "Fixtureton"],
} as const;

/** The Luhn sum mod 10, this file's own, doubling every second digit from the right. */
function referenceLuhn(digits: string): number {
  let sum = 0;
  [...digits].reverse().forEach((ch, i) => {
    const d = Number(ch) * (i % 2 === 1 ? 2 : 1);
    sum += d > 9 ? d - 9 : d;
  });
  return sum % 10;
}

/** The DEA checksum units digit, this file's own: (d1 + d3 + d5) + 2 (d2 + d4 + d6), mod 10. */
function referenceDeaCheck(base6: string): number {
  const d = [...base6].map(Number);
  return (
    ((d[0] ?? 0) + (d[2] ?? 0) + (d[4] ?? 0) + 2 * ((d[1] ?? 0) + (d[3] ?? 0) + (d[5] ?? 0))) % 10
  );
}

// --- The tables against their sources -----------------------------------------------------------

describe("each reserved table equals the published range it cites", () => {
  it("the email domains are RFC 2606's three example second-level names", async () => {
    const safe = await freshSafe();
    expect([...safe.RESERVED_EMAIL_DOMAINS]).toEqual(RFC2606_EXAMPLE_DOMAINS);
    expect(Object.isFrozen(safe.RESERVED_EMAIL_DOMAINS)).toBe(true);
  });

  it("the IPv4 prefixes are RFC 5737's three TEST-NET blocks, and IPv6 is RFC 3849's prefix", async () => {
    const safe = await freshSafe();
    expect([...safe.TEST_NET_V4_PREFIXES]).toEqual(RFC5737_TEST_NETS);
    expect(Object.isFrozen(safe.TEST_NET_V4_PREFIXES)).toBe(true);
    expect(safe.DOC_V6_PREFIX).toBe(RFC3849_PREFIX);
  });

  it("the ITIN bands are the IRM's four, and the SSN groups are exactly what they leave", async () => {
    const safe = await freshSafe();
    expect(safe.ITIN_GROUP_RANGES.map((r) => [r.min, r.max])).toEqual(IRM_ITIN_BANDS);
    expect(Object.isFrozen(safe.ITIN_GROUP_RANGES)).toBe(true);
    for (const range of safe.ITIN_GROUP_RANGES) expect(Object.isFrozen(range)).toBe(true);
    expect([...safe.SSN_SYNTHETIC_GROUPS]).toEqual(SSN_GROUPS);
    expect(Object.isFrozen(safe.SSN_SYNTHETIC_GROUPS)).toBe(true);
    // The two spans are the complement of the bands and of 89 and 93, checked group by group.
    const inBand = (g: number): boolean => IRM_ITIN_BANDS.some(([lo, hi]) => g >= lo && g <= hi);
    for (let g = 0; g < 100; g += 1) {
      const drawable = !inBand(g) && !IRM_OTHER_PROGRAM_GROUPS.includes(g);
      expect(SSN_GROUPS.includes(String(g).padStart(2, "0")), `group ${String(g)}`).toBe(drawable);
    }
  });

  it("the NPI prefix is 69 FR 3434's 80840, and the DEA letters and authority are the documented ones", async () => {
    const safe = await freshSafe();
    expect(safe.NPI_LUHN_PREFIX).toBe(FR_NPI_PREFIX);
    expect([...safe.DEA_REGISTRANT_TYPES]).toEqual(DEA_TYPES);
    expect(Object.isFrozen(safe.DEA_REGISTRANT_TYPES)).toBe(true);
    expect({ ...safe.SYNTHETIC_ASSIGNING_AUTHORITY }).toEqual(ASSIGNING_AUTHORITY);
    expect(Object.isFrozen(safe.SYNTHETIC_ASSIGNING_AUTHORITY)).toBe(true);
  });

  it("the name pool is the shipped pool, word for word, with no word in two lists", async () => {
    const safe = await freshSafe();
    expect([...safe.SYNTHETIC_GIVEN_NAMES]).toEqual(POOL.given);
    expect([...safe.SYNTHETIC_FAMILY_NAMES]).toEqual(POOL.family);
    expect([...safe.SYNTHETIC_STREET_NAMES]).toEqual(POOL.street);
    expect([...safe.SYNTHETIC_CITY_NAMES]).toEqual(POOL.city);
    const words = [...POOL.given, ...POOL.family, ...POOL.street, ...POOL.city];
    expect(new Set(words).size).toBe(words.length);
    for (const list of [
      safe.SYNTHETIC_GIVEN_NAMES,
      safe.SYNTHETIC_FAMILY_NAMES,
      safe.SYNTHETIC_STREET_NAMES,
      safe.SYNTHETIC_CITY_NAMES,
    ]) {
      expect(Object.isFrozen(list)).toBe(true);
    }
  });
});

// --- Every provider, every seed -----------------------------------------------------------------

describe("for every seed, each provider stays inside its source", () => {
  it("ssn: area 900-999, a group outside every IRM band, four serial digits", async () => {
    const safe = await freshSafe();
    checkProperty(
      fc.property(anySeed(), (seed) => {
        const value = safe.ssn(createRng(seed));
        const match = /^(\d{3})-(\d{2})-(\d{4})$/.exec(value);
        expect(match, value).not.toBeNull();
        expect(Number(match?.[1])).toBeGreaterThanOrEqual(900);
        expect(SSN_GROUPS).toContain(match?.[2]);
      }),
    );
  });

  it("ssn advertising: the fixed 987-00-4320 to 987-00-4329 display block", async () => {
    const safe = await freshSafe();
    checkProperty(
      fc.property(anySeed(), (seed) => {
        expect(safe.ssn(createRng(seed), "advertising")).toMatch(/^987-00-432\d$/);
      }),
    );
  });

  it("phone: an NXX area code and a line in NANPA's 555-0100 to 555-0199", async () => {
    const safe = await freshSafe();
    checkProperty(
      fc.property(anySeed(), (seed) => {
        expect(safe.phone(createRng(seed))).toMatch(/^\([2-9]\d\d\) 555-01\d\d$/);
      }),
    );
  });

  it("email: an RFC 2606 example domain, with a named or a numbered local part", async () => {
    const safe = await freshSafe();
    checkProperty(
      fc.property(anySeed(), (seed) => {
        const rng = createRng(seed);
        const person = safe.name(rng);
        const named = safe.email(rng, person).split("@");
        expect(named).toHaveLength(2);
        expect(named[0]).toBe(`${person.given}.${person.family}`.toLowerCase());
        expect(RFC2606_EXAMPLE_DOMAINS).toContain(named[1]);
        const numbered = safe.email(rng).split("@");
        expect(numbered[0]).toMatch(/^synth\d{6}$/);
        expect(RFC2606_EXAMPLE_DOMAINS).toContain(numbered[1]);
      }),
    );
  });

  it("ipv4 and ipv6: a host in an RFC 5737 TEST-NET block, and an RFC 3849 address", async () => {
    const safe = await freshSafe();
    checkProperty(
      fc.property(anySeed(), (seed) => {
        const v4 = safe.ipv4(createRng(seed)).split(".");
        expect(RFC5737_TEST_NETS).toContain(v4.slice(0, -1).join("."));
        const host = Number(v4.at(-1));
        expect(host).toBeGreaterThanOrEqual(1);
        expect(host).toBeLessThanOrEqual(254);
        expect(safe.ipv6(createRng(seed))).toMatch(/^2001:db8::[0-9a-f]{4}$/);
      }),
    );
  });

  it("npi: ten digits whose 80840-prefixed Luhn sum is never 0", async () => {
    const safe = await freshSafe();
    checkProperty(
      fc.property(anySeed(), (seed) => {
        const value = safe.npi(createRng(seed));
        expect(value).toMatch(/^\d{10}$/);
        expect(referenceLuhn(`${FR_NPI_PREFIX}${value}`), value).not.toBe(0);
        // The check digit is the correct one plus one (mod 10), and the check digit is never
        // doubled, so the sum is off by exactly one.
        expect(referenceLuhn(`${FR_NPI_PREFIX}${value}`)).toBe(1);
      }),
    );
  });

  it("dea: a registrant letter, a pool initial, and a check digit the checksum refuses", async () => {
    const safe = await freshSafe();
    checkProperty(
      fc.property(anySeed(), (seed) => {
        const rng = createRng(seed);
        const person = safe.name(rng);
        for (const value of [safe.dea(rng), safe.dea(rng, person)]) {
          const match = /^([A-Z])([A-Z])(\d{6})(\d)$/.exec(value);
          expect(match, value).not.toBeNull();
          expect(DEA_TYPES).toContain(match?.[1]);
          expect(POOL.family.map((f) => f.slice(0, 1))).toContain(match?.[2]);
          const correct = referenceDeaCheck(match?.[3] ?? "");
          expect(Number(match?.[4]), value).toBe((correct + 1) % 10);
        }
        expect(safe.dea(createRng(seed), person).slice(1, 2)).toBe(person.family.slice(0, 1));
      }),
    );
  });

  it("name, address and identifier: pool words, a 00000 ZIP, the synthetic authority", async () => {
    const safe = await freshSafe();
    checkProperty(
      fc.property(
        anySeed(),
        fc.constantFrom<"MR" | "AN" | "MB">("MR", "AN", "MB"),
        (seed, type) => {
          const rng = createRng(seed);
          const person = safe.name(rng);
          expect(POOL.given).toContain(person.given);
          expect(POOL.family).toContain(person.family);
          const where = safe.address(rng);
          const street = /^(\d{1,4}) (.+)$/.exec(where.street);
          expect(street, where.street).not.toBeNull();
          expect(Number(street?.[1])).toBeGreaterThanOrEqual(1);
          expect(POOL.street).toContain(street?.[2]);
          expect(POOL.city).toContain(where.city);
          expect(USPS_STATES).toContain(where.state);
          expect(where.zip).toBe("00000");
          const id = safe.identifier(rng, type);
          expect(id).toEqual({
            value: expect.stringMatching(/^\d{8}$/) as unknown,
            typeCode: type,
            assigningAuthority: ASSIGNING_AUTHORITY.namespaceId,
            assigningAuthorityOid: ASSIGNING_AUTHORITY.universalId,
          });
        },
      ),
    );
  });

  it("dateYmd and uuid: a real calendar day in the year range, and a v4 UUID", async () => {
    const safe = await freshSafe();
    checkProperty(
      fc.property(
        anySeed(),
        fc.integer({ min: 1, max: 9999 }),
        fc.nat(200),
        (seed, from, width) => {
          const to = Math.min(9999, from + width);
          const value = safe.dateYmd(createRng(seed), from, to);
          expect(value).toMatch(/^\d{8}$/);
          const [y, m, d] = [value.slice(0, 4), value.slice(4, 6), value.slice(6)].map(Number);
          expect(y).toBeGreaterThanOrEqual(from);
          expect(y).toBeLessThanOrEqual(to);
          const day = new Date(Date.UTC(2000, 0, 1));
          day.setUTCFullYear(y ?? 0, (m ?? 0) - 1, d ?? 0);
          expect([day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()]).toEqual([
            y,
            m,
            d,
          ]);
          expect(safe.uuid(createRng(seed))).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          );
        },
      ),
    );
  });
});

// --- Every pool entry is drawn ------------------------------------------------------------------

describe("a sweep over seeds draws every entry of every source, and nothing else", () => {
  /** The set of values `draw` gives over seeds 0, 1, 2, ... until it holds `size` or 20,000 seeds. */
  function drawn(size: number, draw: (rng: Rng) => string): Set<string> {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20_000 && seen.size < size; seed += 1)
      seen.add(draw(createRng(seed)));
    return seen;
  }

  it("names, streets, cities and states", async () => {
    const safe = await freshSafe();
    const sorted = (values: Iterable<string>): string[] => [...values].sort();
    expect(sorted(drawn(POOL.given.length, (rng) => safe.name(rng).given))).toEqual(
      sorted(POOL.given),
    );
    expect(sorted(drawn(POOL.family.length, (rng) => safe.name(rng).family))).toEqual(
      sorted(POOL.family),
    );
    expect(
      sorted(drawn(POOL.street.length, (rng) => safe.address(rng).street.replace(/^\d+ /, ""))),
    ).toEqual(sorted(POOL.street));
    expect(sorted(drawn(POOL.city.length, (rng) => safe.address(rng).city))).toEqual(
      sorted(POOL.city),
    );
    expect(sorted(drawn(USPS_STATES.length, (rng) => safe.address(rng).state))).toEqual(
      sorted(USPS_STATES),
    );
  });

  it("domains, TEST-NET blocks, SSN groups and DEA letters", async () => {
    const safe = await freshSafe();
    const sorted = (values: Iterable<string>): string[] => [...values].sort();
    expect(sorted(drawn(3, (rng) => safe.email(rng).split("@")[1] ?? ""))).toEqual(
      sorted(RFC2606_EXAMPLE_DOMAINS),
    );
    expect(sorted(drawn(3, (rng) => safe.ipv4(rng).split(".").slice(0, -1).join(".")))).toEqual(
      sorted(RFC5737_TEST_NETS),
    );
    expect(sorted(drawn(SSN_GROUPS.length, (rng) => safe.ssn(rng).slice(4, 6)))).toEqual(
      SSN_GROUPS,
    );
    expect(sorted(drawn(DEA_TYPES.length, (rng) => safe.dea(rng).slice(0, 1)))).toEqual(DEA_TYPES);
  });
});

// --- The predicates at the edges of their rules -------------------------------------------------

describe("each predicate holds at the edges of its rule", () => {
  it("isSyntheticDea reads through spaces, hyphens and case, and only the DEA shape", () => {
    // AB + 123456 has the checksum units digit 3 ((1+3+5) + 2(2+4+6) = 33), so 4 fails it.
    expect(referenceDeaCheck("123456")).toBe(3);
    expect(isSyntheticDea("AB1234564")).toBe(true);
    expect(isSyntheticDea("ab 123-4564")).toBe(true);
    expect(isSyntheticDea("AB1234563")).toBe(false); // the checksum holds: could be real
    // Anything before or after the shape makes it not a DEA number, whatever its digits.
    for (const value of ["XAB1234564", "1AB1234564", "AB12345640", "AB1234564X", "A1B1234564"]) {
      expect(isSyntheticDea(value), value).toBe(false);
    }
  });

  it("deaCheckDigit reads only the six base digits, so a seventh changes nothing", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const base = createRng(seed).digits(6);
      expect(deaCheckDigit(base)).toBe(referenceDeaCheck(base));
      for (let extra = 0; extra < 10; extra += 1) {
        expect(deaCheckDigit(`${base}${String(extra)}`)).toBe(deaCheckDigit(base));
      }
    }
  });

  it("luhnMod10 matches this file's Luhn over every doubled digit", () => {
    // Each digit in a doubled position, so every case of the subtract-nine step is reached.
    for (let d = 0; d < 10; d += 1) {
      expect(luhnMod10(`${String(d)}0`), String(d)).toBe(referenceLuhn(`${String(d)}0`));
    }
    for (let seed = 0; seed < 200; seed += 1) {
      const value = createRng(seed).digits(15);
      expect(luhnMod10(value), value).toBe(referenceLuhn(value));
    }
  });

  it("isSyntheticNpi reads through separators and refuses a Luhn-valid NPI", () => {
    expect(referenceLuhn(`${FR_NPI_PREFIX}1234567893`)).toBe(0);
    expect(isSyntheticNpi("1234567894")).toBe(true);
    expect(isSyntheticNpi("123-456-7894")).toBe(true);
    expect(isSyntheticNpi("1234567893")).toBe(false);
    expect(isSyntheticNpi("123456789")).toBe(false);
  });

  it("isSyntheticSsn wants exactly nine digits", () => {
    expect(isSyntheticSsn("900123456")).toBe(true);
    expect(isSyntheticSsn("9001234567")).toBe(false);
    expect(isSyntheticSsn("90012345")).toBe(false);
  });

  it("isSyntheticPhone wants 555-01NN as the last seven digits", () => {
    expect(isSyntheticPhone("(202) 555-0142")).toBe(true);
    expect(isSyntheticPhone("5550142")).toBe(true);
    expect(isSyntheticPhone("555-0199")).toBe(true);
    // A 555-01NN run that is not the end of the number is not the reserved line.
    expect(isSyntheticPhone("(202) 555-01423")).toBe(false);
    expect(isSyntheticPhone("555-0142 1")).toBe(false);
    // Lines outside 0100 to 0199, and too few digits.
    expect(isSyntheticPhone("(202) 555-0200")).toBe(false);
    expect(isSyntheticPhone("(202) 555-1142")).toBe(false);
    expect(isSyntheticPhone("555-014")).toBe(false);
  });

  it("isSyntheticEmail reads the domain after the last @, and a reserved name only as the suffix", () => {
    const at = (user: string, ...domain: string[]): string => `${user}@${domain.join(".")}`;
    expect(isSyntheticEmail(at("", "example", "com"))).toBe(true);
    expect(isSyntheticEmail(at("a@b", "example", "org"))).toBe(true);
    expect(isSyntheticEmail(at("x", "host", "invalid"))).toBe(true);
    expect(isSyntheticEmail(at("x", "host", "localhost"))).toBe(true);
    expect(isSyntheticEmail(at("x", "host", "example"))).toBe(true);
    // No @ at all: not an address, even when the text ends in a reserved name.
    expect(isSyntheticEmail(["host", "test"].join("."))).toBe(false);
    // A reserved name inside a real domain is not a reserved domain.
    expect(isSyntheticEmail(at("x", "host", "test", "co"))).toBe(false);
    expect(isSyntheticEmail(at("x", "example", "com", "co"))).toBe(false);
  });

  it("ipv6 keeps four hex digits when the draw is small", () => {
    const base = createRng(1);
    const small: Rng = {
      seed: 1,
      nextUint32: () => 0xab,
      float: () => base.float(),
      int: (min, max) => base.int(min, max),
      bool: (p) => base.bool(p),
      pick: (items) => base.pick(items),
      digits: (n) => base.digits(n),
    };
    expect(ipv6(small)).toBe("2001:db8::00ab");
  });

  it("dateYmd writes a year before 1000 with four digits", () => {
    expect(dateYmd(createRng(1), 999, 999)).toMatch(/^0999\d{4}$/);
    expect(dateYmd(createRng(1), 7, 7)).toMatch(/^0007\d{4}$/);
  });
});
