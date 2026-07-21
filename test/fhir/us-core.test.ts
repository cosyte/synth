/**
 * The **US Core conformance gate** (roadmap §Phase 3). Every US-Core generator's output is validated by
 * `@cosyte/fhir.validateResource` against the **real, published US Core 6.1.0 `StructureDefinition`s**
 * (committed under `test/us-core-profiles/`, BYO — none is bundled in the package, matching
 * `@cosyte/fhir`'s content-free posture). A resource is US-Core-conformant iff the parser reports **zero
 * `error`/`fatal` findings** against the profile snapshot. This is the firsthand grounding the roadmap
 * requires: the profiles here are the IG's own artifacts, not a summary.
 *
 * The real profiles carry FHIRPath invariants and must-support obligations; `MUST_SUPPORT_ABSENT`,
 * `INVARIANT_UNCHECKED`, and base `dom-*` best-practice findings are advisory (information/warning) and
 * never fail conformance — only an `error` does (roadmap §4.5, the false-spec-clean head).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadStructureDefinition, parseResource, type StructureDefinition } from "@cosyte/fhir";

import {
  generateAllergyIntolerance,
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
const SD_DIR = join(HERE, "..", "us-core-profiles");

function loadSD(file: string): StructureDefinition {
  const { resource } = parseResource(readFileSync(join(SD_DIR, `${file}.json`), "utf8"));
  const sd = loadStructureDefinition(resource);
  if (sd === undefined) throw new Error(`could not load StructureDefinition ${file}`);
  return sd;
}

const SD = {
  patient: loadSD("us-core-patient"),
  condition: loadSD("us-core-condition-problems-health-concerns"),
  observationLab: loadSD("us-core-observation-lab"),
  vitalSigns: loadSD("us-core-vital-signs"),
  medicationRequest: loadSD("us-core-medicationrequest"),
  encounter: loadSD("us-core-encounter"),
  immunization: loadSD("us-core-immunization"),
  allergyIntolerance: loadSD("us-core-allergyintolerance"),
  procedure: loadSD("us-core-procedure"),
  diagnosticReportLab: loadSD("us-core-diagnosticreport-lab"),
};

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

describe("US Core conformance — validated against the real US Core 6.1.0 profiles (zero errors)", () => {
  it("US Core Patient validates clean against us-core-patient", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rt = roundTrip(generatePatient({ seed: s, profile: "us-core" }), {
          profiles: [SD.patient],
        });
        expect(rt.errors, `patient seed ${String(s)}`).toEqual([]);
        expect(rt.specClean).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("US Core Condition (problem-list item) validates clean", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rt = roundTrip(generateCondition({ seed: s }), { profiles: [SD.condition] });
        expect(rt.errors, `condition seed ${String(s)}`).toEqual([]);
        expect(rt.specClean).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("US Core Laboratory Result Observation validates clean", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rt = roundTrip(generateObservationLab({ seed: s }), {
          profiles: [SD.observationLab],
        });
        expect(rt.errors, `obs-lab seed ${String(s)}`).toEqual([]);
        expect(rt.specClean).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("US Core Vital Signs Observation validates clean", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rt = roundTrip(generateVitalSign({ seed: s }), { profiles: [SD.vitalSigns] });
        expect(rt.errors, `vital-sign seed ${String(s)}`).toEqual([]);
        expect(rt.specClean).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("US Core MedicationRequest validates clean (incl. the us-core-21 requester invariant)", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rt = roundTrip(generateMedicationRequest({ seed: s }), {
          profiles: [SD.medicationRequest],
        });
        expect(rt.errors, `med-req seed ${String(s)}`).toEqual([]);
        expect(rt.specClean).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("US Core Encounter validates clean against us-core-encounter", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rt = roundTrip(generateEncounter({ seed: s }), { profiles: [SD.encounter] });
        expect(rt.errors, `encounter seed ${String(s)}`).toEqual([]);
        expect(rt.specClean).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("US Core Immunization validates clean against us-core-immunization", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rt = roundTrip(generateImmunization({ seed: s }), { profiles: [SD.immunization] });
        expect(rt.errors, `immunization seed ${String(s)}`).toEqual([]);
        expect(rt.specClean).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("US Core AllergyIntolerance validates clean (incl. ait-1/ait-2)", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rt = roundTrip(generateAllergyIntolerance({ seed: s }), {
          profiles: [SD.allergyIntolerance],
        });
        expect(rt.errors, `allergy seed ${String(s)}`).toEqual([]);
        expect(rt.specClean).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("US Core Procedure validates clean against us-core-procedure", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rt = roundTrip(generateProcedure({ seed: s }), { profiles: [SD.procedure] });
        expect(rt.errors, `procedure seed ${String(s)}`).toEqual([]);
        expect(rt.specClean).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("US Core Laboratory DiagnosticReport validates clean (incl. LAB category + us-core-8/9)", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rt = roundTrip(generateDiagnosticReport({ seed: s }), {
          profiles: [SD.diagnosticReportLab],
        });
        expect(rt.errors, `diagnostic-report seed ${String(s)}`).toEqual([]);
        expect(rt.specClean).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("the profiles under test are the published US Core 6.1.0 artifacts", () => {
    expect(SD.patient.url).toBe("http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient");
    expect(SD.encounter.url).toBe(
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
    );
    expect(SD.diagnosticReportLab.url).toBe(
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab",
    );
    // A snapshot must be present — validation binds against the profile's own element set.
    expect(SD.patient.snapshot?.length ?? 0).toBeGreaterThan(0);
    expect(SD.procedure.snapshot?.length ?? 0).toBeGreaterThan(0);
  });
});
