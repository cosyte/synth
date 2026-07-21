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
  generateCondition,
  generateMedicationRequest,
  generateObservationLab,
  generatePatient,
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

  it("the profiles under test are the published US Core 6.1.0 artifacts", () => {
    expect(SD.patient.url).toBe("http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient");
    // A snapshot must be present — validation binds against the profile's own element set.
    expect(SD.patient.snapshot?.length ?? 0).toBeGreaterThan(0);
  });
});
