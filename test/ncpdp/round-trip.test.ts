/**
 * Round-trip verification over the **committed** NCPDP fixtures (SYNTH-7) and the identity/example-code
 * building blocks. The committed `.xml` (SCRIPT) and `.ncpdp` (Telecom) fixtures under
 * `test/fixtures/ncpdp/` are the golden inputs a downstream repo pins; each must re-parse through
 * `@cosyte/ncpdp` with zero warnings and re-serialize byte-identically, and each must match what its
 * seed regenerates (the reproducibility contract).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseScript, serializeScript } from "@cosyte/ncpdp/script";
import { parseTelecom, serializeTelecom } from "@cosyte/ncpdp/telecom";

import {
  generateNewRx,
  generateRxRenewalRequest,
  generateRxChangeRequest,
  generateB1,
  generateB2,
  generateB3,
  ncpdpPatient,
  ncpdpPrescriber,
  ncpdpPharmacy,
  ncpdpCardholder,
  EXAMPLE_DRUGS,
} from "../../src/ncpdp/index.js";
import { createRng, isSyntheticNpi, isSyntheticDea } from "../../src/index.js";

const FIXTURE_DIR = join(process.cwd(), "test", "fixtures", "ncpdp");

/** Regenerate a fixture from its committed name (`<kind>-seed<NNNN>.<ext>`). */
function regenerate(name: string): string {
  const seed = Number(/seed(\d+)/.exec(name)?.[1]);
  if (name.startsWith("newrx")) return generateNewRx({ seed });
  if (name.startsWith("rxrenewal")) return generateRxRenewalRequest({ seed });
  if (name.startsWith("rxchange")) return generateRxChangeRequest({ seed });
  if (name.startsWith("b1")) return generateB1({ seed });
  if (name.startsWith("b2")) return generateB2({ seed });
  return generateB3({ seed });
}

describe("committed NCPDP fixtures", () => {
  const fixtures = readdirSync(FIXTURE_DIR).filter(
    (f) => f.endsWith(".xml") || f.endsWith(".ncpdp"),
  );

  it("has a fixture for each shipped transaction kind (3 SCRIPT + 3 Telecom)", () => {
    expect(fixtures.filter((f) => f.endsWith(".xml")).length).toBe(3);
    expect(fixtures.filter((f) => f.endsWith(".ncpdp")).length).toBe(3);
  });

  for (const name of fixtures) {
    it(`${name} re-parses clean, is byte-stable, and matches its seed`, () => {
      const content = readFileSync(join(FIXTURE_DIR, name), "utf8");
      if (name.endsWith(".xml")) {
        const msg = parseScript(content);
        expect(msg.warnings.map((w) => String(w.code))).toEqual([]);
        expect(serializeScript(msg)).toBe(content);
      } else {
        const tx = parseTelecom(content);
        expect(tx.warnings.map((w) => String(w.code))).toEqual([]);
        expect(serializeTelecom(tx)).toBe(content);
      }
      expect(regenerate(name)).toBe(content);
    });
  }
});

describe("NCPDP identity building blocks", () => {
  it("mints a synthetic patient / prescriber / pharmacy / cardholder", () => {
    const rng = createRng(4242);
    const patient = ncpdpPatient(rng);
    expect(patient.patientId).toMatch(/^MBR\d+$/);
    expect(patient.dob).toMatch(/^\d{8}$/);
    expect(["1", "2"]).toContain(patient.gender);

    const prescriber = ncpdpPrescriber(rng);
    expect(prescriber.npi).toMatch(/^\d{10}$/);
    expect(isSyntheticNpi(prescriber.npi)).toBe(true);
    expect(prescriber.dea).toMatch(/^[A-Z]{2}\d{7}$/);
    expect(isSyntheticDea(prescriber.dea)).toBe(true);

    const pharmacy = ncpdpPharmacy(rng);
    expect(pharmacy.npi).toMatch(/^\d{10}$/);
    expect(pharmacy.ncpdpId).toMatch(/^\d{7}$/);

    const cardholder = ncpdpCardholder(rng);
    expect(cardholder.cardholderId).toMatch(/^MBR\d+$/);
    expect(cardholder.groupId).toMatch(/^GRP\d{5}$/);
  });

  it("ships a license-clean example-drug pool with example (non-real) NDCs", () => {
    expect(EXAMPLE_DRUGS.length).toBeGreaterThan(0);
    // Every NDC uses the invented `00000` labeler prefix — transparently an example, never a real NDC.
    expect(EXAMPLE_DRUGS.every((d) => /^00000\d{6}$/.test(d.ndc))).toBe(true);
  });
});
