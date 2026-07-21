/**
 * Round-trip verification over the **committed** ASTM fixtures (SYNTH-8) and the identity/example-code
 * building blocks. The committed `.astm` (E1394 record) and `.frame` (E1381 framed) fixtures under
 * `test/fixtures/astm/` are the golden inputs a downstream repo pins; each must re-parse through
 * `@cosyte/astm` with zero warnings and re-serialize byte-identically, and each must match what its seed
 * regenerates (the reproducibility contract, roadmap §5).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  parseAstmRecords,
  serializeAstmRecords,
  parseFramedAstm,
  serializeFramedAstm,
} from "@cosyte/astm";

import {
  generateAstmResult,
  generateAstmOrder,
  generateAstmResultFramed,
  astmPatient,
  astmOrder,
  astmHeaderIdentity,
  EXAMPLE_ASTM_TESTS,
} from "../../src/astm/index.js";
import { createRng } from "../../src/index.js";

const FIXTURE_DIR = join(process.cwd(), "test", "fixtures", "astm");

describe("committed ASTM record fixtures", () => {
  const fixtures = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".astm"));

  it("has record fixtures for the result and order kinds", () => {
    expect(fixtures.filter((f) => f.startsWith("result")).length).toBeGreaterThanOrEqual(1);
    expect(fixtures.filter((f) => f.startsWith("order")).length).toBeGreaterThanOrEqual(1);
  });

  for (const name of fixtures) {
    it(`${name} re-parses clean, is byte-stable, and matches its seed`, () => {
      const content = readFileSync(join(FIXTURE_DIR, name), "latin1");
      const msg = parseAstmRecords(content);
      expect(msg.warnings.map((w) => String(w.code))).toEqual([]);
      expect(serializeAstmRecords(msg)).toBe(content);
      const seed = Number(/seed(\d+)/.exec(name)?.[1]);
      const regenerated = name.startsWith("order")
        ? generateAstmOrder({ seed })
        : generateAstmResult({ seed });
      expect(regenerated).toBe(content);
    });
  }
});

describe("committed ASTM framed fixture", () => {
  const framed = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".frame"));

  it("has a framed (E1381) fixture", () => {
    expect(framed.length).toBeGreaterThanOrEqual(1);
  });

  for (const name of framed) {
    it(`${name} decodes with zero frame + record warnings and is byte-stable`, () => {
      const bytes = new Uint8Array(readFileSync(join(FIXTURE_DIR, name)));
      const { message, frameWarnings } = parseFramedAstm(bytes);
      expect(frameWarnings.map((w) => String(w.code))).toEqual([]);
      expect(message.warnings.map((w) => String(w.code))).toEqual([]);
      expect([...serializeFramedAstm(message)]).toEqual([...bytes]);
      const seed = Number(/seed(\d+)/.exec(name)?.[1]);
      expect([...generateAstmResultFramed({ seed })]).toEqual([...bytes]);
    });
  }
});

describe("ASTM identity building blocks", () => {
  it("mints a synthetic patient with distinct practice + lab ids", () => {
    const rng = createRng(4242);
    const patient = astmPatient(rng);
    expect(patient.practiceAssignedId).toMatch(/^PRA\d+$/);
    expect(patient.laboratoryAssignedId).toMatch(/^LAB\d+$/);
    // The roadmap's stressed invariant: the practice- and lab-assigned ids stay DISTINCT.
    expect(patient.practiceAssignedId).not.toBe(patient.laboratoryAssignedId);
    expect(patient.birthDate).toMatch(/^\d{8}$/);
    expect(["M", "F"]).toContain(patient.sex);

    const order = astmOrder(rng);
    expect(order.specimenId).toMatch(/^ACC\d{8}$/);
    expect(["R", "S"]).toContain(order.priority);

    const header = astmHeaderIdentity(rng);
    expect(header.sender.length).toBeGreaterThan(0);
    expect(header.analyzer.length).toBeGreaterThan(0);
  });

  it("ships a license-clean example-test pool with a public LOINC + dash reference ranges", () => {
    expect(EXAMPLE_ASTM_TESTS.length).toBeGreaterThan(0);
    // Every reference range is in the parser's closed `low-high` grammar (so a result is spec-clean).
    expect(
      EXAMPLE_ASTM_TESTS.every((t) => /^-?\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(t.referenceRange)),
    ).toBe(true);
    expect(EXAMPLE_ASTM_TESTS.every((t) => /^\d+-\d+$/.test(t.loinc))).toBe(true);
  });
});
