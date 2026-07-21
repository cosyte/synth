/**
 * The **round-trip-through-the-parser gate** for FHIR (roadmap §6). Every generated resource, fed back
 * into `@cosyte/fhir` (serialize → parse → validate(strict) → serialize), validates with **zero errors**
 * and re-serializes **byte-identically** — spec-clean by the parser's own judgment, not `@cosyte/synth`'s
 * opinion. Also a golden-fixture regression: the committed fixtures under `test/fixtures/fhir/` must
 * regenerate byte-for-byte from their seeds (the reproducibility contract, roadmap §5).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serializeResource } from "@cosyte/fhir";

import {
  fhirCorpus,
  generateAllergyIntolerance,
  generateBundle,
  generateCondition,
  generateDiagnosticReport,
  generateEncounter,
  generateImmunization,
  generateMedicationRequest,
  generateObservationLab,
  generatePatient,
  generateProcedure,
  generateVitalSign,
  roundTrip,
} from "../../src/fhir/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX_DIR = join(HERE, "..", "fixtures", "fhir");

/** Every FHIR resource generator, by label, as a nullary factory. */
const GENERATORS: Record<string, () => ReturnType<typeof generatePatient>> = {
  "patient-base": () => generatePatient({ seed: 1, profile: "base" }),
  "patient-us-core": () => generatePatient({ seed: 1, profile: "us-core" }),
  condition: () => generateCondition({ seed: 2 }),
  "observation-lab": () => generateObservationLab({ seed: 3 }),
  "vital-sign": () => generateVitalSign({ seed: 4 }),
  "medication-request": () => generateMedicationRequest({ seed: 5 }),
  encounter: () => generateEncounter({ seed: 11 }),
  immunization: () => generateImmunization({ seed: 13 }),
  "allergy-intolerance": () => generateAllergyIntolerance({ seed: 15 }),
  procedure: () => generateProcedure({ seed: 17 }),
  "diagnostic-report": () => generateDiagnosticReport({ seed: 19 }),
  "bundle-collection": () => generateBundle({ seed: 6, type: "collection" }),
  "bundle-transaction": () => generateBundle({ seed: 7, type: "transaction" }),
  "bundle-document": () => generateBundle({ seed: 8, type: "document" }),
};

describe("FHIR round-trip — spec-clean by construction (zero errors, byte-stable)", () => {
  for (const [label, make] of Object.entries(GENERATORS)) {
    it(`${label} round-trips through @cosyte/fhir with zero errors and byte-stable`, () => {
      const rt = roundTrip(make());
      expect(rt.errors, `${label} errors`).toEqual([]);
      expect(rt.valid).toBe(true);
      expect(rt.byteStable).toBe(true);
      expect(rt.specClean).toBe(true);
    });
  }

  it("a base Patient carries no US Core profile; a US Core Patient does", () => {
    const base = serializeResource(generatePatient({ seed: 1, profile: "base" }));
    const usCore = serializeResource(generatePatient({ seed: 1, profile: "us-core" }));
    expect(base).not.toContain("us-core-patient");
    expect(usCore).toContain("us-core-patient");
    // Both share the same synthetic identity (same seed) but differ in profile/extensions.
    expect(base).not.toBe(usCore);
  });

  it("a transaction Bundle carries request entries; a collection Bundle does not", () => {
    const coll = serializeResource(generateBundle({ seed: 6, type: "collection" }));
    const txn = serializeResource(generateBundle({ seed: 6, type: "transaction" }));
    expect(coll).not.toContain('"request"');
    expect(txn).toContain('"request"');
  });

  it("a document Bundle leads with a Composition and carries an identifier + timestamp", () => {
    const doc = serializeResource(generateBundle({ seed: 8, type: "document" }));
    const parsed = JSON.parse(doc) as {
      type: string;
      identifier?: unknown;
      timestamp?: string;
      entry: { resource: { resourceType: string } }[];
    };
    expect(parsed.type).toBe("document");
    expect(parsed.identifier).toBeDefined(); // bdl-9
    expect(parsed.timestamp).toBeDefined(); // bdl-10
    expect(parsed.entry[0]?.resource.resourceType).toBe("Composition"); // bdl-11
    // A document forbids entry.request (bdl-3a).
    expect(doc).not.toContain('"request"');
  });

  it("the fhirCorpus is spec-clean and self-describing across the full spine", () => {
    const corpus = fhirCorpus({ seed: 42, count: 11 });
    expect(corpus.artifacts).toHaveLength(11);
    expect(corpus.artifacts.every((a) => a.warnings.length === 0)).toBe(true);
    expect(corpus.manifest.formats).toEqual(["fhir"]);
    expect(corpus.manifest.counts["Encounter"]).toBe(1);
    expect(corpus.manifest.counts["DiagnosticReport"]).toBe(1);
    expect(corpus.seed).toBe(42);
  });
});

describe("FHIR golden fixtures regenerate byte-for-byte (reproducibility contract)", () => {
  const FIXTURES: Record<string, () => ReturnType<typeof generatePatient>> = {
    "patient-base-seed1001.json": () => generatePatient({ seed: 1001 }),
    "patient-uscore-seed1002.json": () => generatePatient({ seed: 1002, profile: "us-core" }),
    "condition-seed2001.json": () => generateCondition({ seed: 2001 }),
    "observation-lab-seed2002.json": () => generateObservationLab({ seed: 2002 }),
    "vital-sign-seed2003.json": () => generateVitalSign({ seed: 2003 }),
    "medication-request-seed2004.json": () => generateMedicationRequest({ seed: 2004 }),
    "encounter-seed2005.json": () => generateEncounter({ seed: 2005 }),
    "immunization-seed2006.json": () => generateImmunization({ seed: 2006 }),
    "allergy-intolerance-seed2007.json": () => generateAllergyIntolerance({ seed: 2007 }),
    "procedure-seed2008.json": () => generateProcedure({ seed: 2008 }),
    "diagnostic-report-seed2009.json": () => generateDiagnosticReport({ seed: 2009 }),
    "bundle-collection-seed3001.json": () => generateBundle({ seed: 3001, type: "collection" }),
    "bundle-transaction-seed3002.json": () => generateBundle({ seed: 3002, type: "transaction" }),
    "bundle-document-seed3003.json": () => generateBundle({ seed: 3003, type: "document" }),
  };

  for (const [file, make] of Object.entries(FIXTURES)) {
    it(`${file} matches its committed golden output`, () => {
      const expected = readFileSync(join(FIX_DIR, file), "utf8");
      expect(`${serializeResource(make())}\n`).toBe(expected);
    });
  }
});
