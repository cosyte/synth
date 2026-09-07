/**
 * The **US Core conformance gate** (roadmap §Phase 3). Every US-Core generator's output is validated by
 * `@cosyte/fhir.validateResource` against the **real, published US Core 6.1.0 `StructureDefinition`s**
 * (committed under `test/us-core-profiles/`, BYO, none is bundled in the package, matching
 * `@cosyte/fhir`'s content-free posture). A resource is US-Core-conformant iff the parser reports **zero
 * `error`/`fatal` findings** against the profile snapshot. This is the firsthand grounding the roadmap
 * requires: the profiles here are the IG's own artifacts, not a summary.
 *
 * The real profiles carry FHIRPath invariants and must-support obligations; `MUST_SUPPORT_ABSENT`,
 * `INVARIANT_UNCHECKED`, and base `dom-*` best-practice findings are advisory (information/warning) and
 * never fail conformance, only an `error` does (roadmap §4.5, the false-spec-clean head).
 *
 * **The graded set is driven by the coverage surface, not by a list kept here.** The last describe in
 * this file walks every profile `usCoreCoverage()` reports as generated and requires a committed
 * `StructureDefinition` for each: a coverage claim with no profile behind it FAILS the suite rather
 * than being skipped, so the claim can never outrun the evidence for it.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { existsSync, readFileSync } from "node:fs";
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
  generateProvenance,
  generateUsCoreProfile,
  generateVitalSign,
  roundTrip,
  usCoreCoverage,
} from "../../src/fhir/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SD_DIR = join(HERE, "..", "us-core-profiles");

/** The committed `StructureDefinition` for one profile id, by the name its siblings are filed under. */
const sdPath = (file: string): string => join(SD_DIR, `${file}.json`);

function loadSD(file: string): StructureDefinition {
  const { resource } = parseResource(readFileSync(sdPath(file), "utf8"));
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
  provenance: loadSD("us-core-provenance"),
};

/** The canonical URLs a resource claims in `meta.profile`, read back off the serialized artifact. */
function claimedProfiles(content: string): string[] {
  const json = JSON.parse(content) as { meta?: { profile?: unknown } };
  const claimed = json.meta?.profile;
  return Array.isArray(claimed) ? claimed.map((p) => String(p)) : [];
}

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

describe("US Core conformance: validated against the real US Core 6.1.0 profiles (zero errors)", () => {
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

  it("US Core Provenance validates clean against us-core-provenance", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const rt = roundTrip(generateProvenance({ seed: s }), { profiles: [SD.provenance] });
        expect(rt.errors, `provenance seed ${String(s)}`).toEqual([]);
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
    expect(SD.provenance.url).toBe(
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-provenance",
    );
    // A snapshot must be present, validation binds against the profile's own element set.
    expect(SD.patient.snapshot?.length ?? 0).toBeGreaterThan(0);
    expect(SD.procedure.snapshot?.length ?? 0).toBeGreaterThan(0);
    expect(SD.provenance.snapshot?.length ?? 0).toBeGreaterThan(0);
  });
});

/**
 * **The coverage claim never outruns its evidence.** The graded set here is whatever
 * `usCoreCoverage()` reports as generated: adding a profile to that surface without committing its
 * published `StructureDefinition` reds this describe rather than quietly reducing the graded set.
 *
 * Each profile also gets its own `it`, so a failure names the profile rather than the loop.
 */
describe("profile-addressed generation validates against the profile it claims", () => {
  const covered = usCoreCoverage().filter((entry) => entry.generated);

  it("grades a non-empty set (a suite over nothing passes vacuously)", () => {
    expect(covered.length).toBeGreaterThan(0);
  });

  it("FAILS rather than skips when a profile has no StructureDefinition in the corpus", () => {
    // The positive control for the requirement below: the loader throws for an absent profile, so a
    // covered profile with no committed StructureDefinition cannot be silently passed over.
    expect(existsSync(sdPath("us-core-not-a-real-profile"))).toBe(false);
    expect(() => loadSD("us-core-not-a-real-profile")).toThrow();
  });

  for (const entry of covered) {
    it(`${entry.profile} has a committed StructureDefinition and validates with zero errors`, () => {
      expect(
        existsSync(sdPath(entry.profile)),
        `${entry.profile} is reported as generated but has no StructureDefinition in test/us-core-profiles/`,
      ).toBe(true);
      const sd = loadSD(entry.profile);
      // The canonical the coverage surface publishes is the profile's own `url`, not an assembled one.
      expect(sd.url).toBe(entry.canonical);
      expect(sd.snapshot?.length ?? 0).toBeGreaterThan(0);

      fc.assert(
        fc.property(seed(), (s) => {
          const rt = roundTrip(generateUsCoreProfile({ profile: entry.profile, seed: s }), {
            profiles: [sd],
          });
          expect(rt.errors, `${entry.profile} seed ${String(s)}`).toEqual([]);
          expect(rt.specClean).toBe(true);
          expect(claimedProfiles(rt.content)).toContain(entry.canonical);
        }),
        { numRuns: 40 },
      );
    });
  }
});
