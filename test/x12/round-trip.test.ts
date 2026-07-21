/**
 * Round-trip verification over the **committed** X12 fixtures (SYNTH-6) and the identity/example-code
 * building blocks. The committed `.edi` fixtures under `test/fixtures/x12/` are the golden inputs a
 * downstream repo pins; each must re-parse through `@cosyte/x12` with zero warnings and re-serialize
 * byte-identically, and each must match what its seed regenerates (the reproducibility contract).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseX12, serializeX12 } from "@cosyte/x12";

import { generate837, generate835, generate271, roundTrip } from "../../src/x12/index.js";
import {
  x12Person,
  x12Organization,
  x12ProviderPerson,
  x12Payer,
  x12TradingPartners,
  x12EnvelopeTiming,
} from "../../src/x12/identity.js";
import {
  PROFESSIONAL_PROCEDURES,
  DENTAL_PROCEDURES,
  SERVICE_TYPE_CODES,
} from "../../src/x12/example-codes.js";
import { dec, money } from "../../src/x12/money.js";
import { createRng } from "../../src/index.js";

const FIXTURE_DIR = join(process.cwd(), "test", "fixtures", "x12");

/** Regenerate a fixture from its committed name (`<kind>-seed<NNNN>.edi`). */
function regenerate(name: string): string {
  const seedMatch = /seed(\d+)/.exec(name);
  const seed = Number(seedMatch?.[1]);
  if (name.startsWith("837p")) return roundTrip(generate837("P", { seed })).content;
  if (name.startsWith("837i")) return roundTrip(generate837("I", { seed })).content;
  if (name.startsWith("837d")) return roundTrip(generate837("D", { seed })).content;
  if (name.startsWith("835")) return roundTrip(generate835({ seed })).content;
  return roundTrip(generate271({ seed })).content;
}

describe("committed X12 fixtures", () => {
  const fixtures = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".edi"));

  it("has a fixture for each shipped transaction kind", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(5);
  });

  for (const name of readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".edi"))) {
    it(`${name} re-parses clean, is byte-stable, and matches its seed`, () => {
      const content = readFileSync(join(FIXTURE_DIR, name), "utf8");
      const reparsed = parseX12(content);
      expect(reparsed.warnings.map((w) => String(w.code))).toEqual([]);
      expect(serializeX12(reparsed)).toBe(content);
      expect(regenerate(name)).toBe(content);
    });
  }
});

describe("X12 identity building blocks", () => {
  it("mints synthetic person / organization / provider / payer / partners / timing", () => {
    const rng = createRng(1234);
    const person = x12Person(rng);
    expect(person.memberId).toMatch(/^MBR\d+$/);
    expect(person.dob).toMatch(/^\d{8}$/);
    expect(["M", "F"]).toContain(person.sex);

    const org = x12Organization(rng);
    expect(org.npi).toMatch(/^\d{10}$/);
    expect(Number(org.taxIdSsn.slice(0, 3))).toBeGreaterThanOrEqual(900);

    const provider = x12ProviderPerson(rng);
    expect(provider.npi).toMatch(/^\d{10}$/);

    const payer = x12Payer(rng);
    expect(payer.payerId).toMatch(/^SYN\d{5}$/);

    const partners = x12TradingPartners(rng);
    expect(partners.senderId).toMatch(/^SYNSUB\d{3}$/);
    expect(partners.receiverId).toMatch(/^SYNRCV\d{3}$/);

    const timing = x12EnvelopeTiming(rng);
    expect(timing.interchangeDate).toMatch(/^\d{6}$/);
    expect(timing.interchangeControlNumber).toMatch(/^\d{9}$/);
    expect(Number(timing.serviceDate.slice(0, 4))).toBeGreaterThanOrEqual(2024);
  });

  it("ships license-clean example-code pools", () => {
    expect(PROFESSIONAL_PROCEDURES.length).toBeGreaterThan(0);
    expect(DENTAL_PROCEDURES.every((c) => c.code.startsWith("D"))).toBe(true);
    expect(SERVICE_TYPE_CODES).toContain("30");
  });
});

describe("X12 money helpers", () => {
  it("money formats whole dollars and dec parses them", () => {
    expect(money(150)).toBe("150.00");
    expect(dec("150.00").toString()).toBe("150.00");
  });

  it("dec throws on an unparseable decimal (the defensive guard)", () => {
    expect(() => dec("not-a-number")).toThrow(/invalid synthetic decimal/);
  });
});
