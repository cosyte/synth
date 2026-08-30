/**
 * The **seed-determinism property** for FHIR (roadmap §5, §6: mandatory). A seed, and only the seed,
 * determines the output: generating twice yields byte-identical serialized resources, every generator,
 * every Bundle shape, and the corpus.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
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
  generateProvenance,
  generateUsCoreProfile,
  generateVitalSign,
  usCoreCoverage,
} from "../../src/fhir/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

describe("FHIR seed-determinism (mandatory property)", () => {
  it("each resource generator is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        expect(serializeResource(generatePatient({ seed: s, profile: "us-core" }))).toBe(
          serializeResource(generatePatient({ seed: s, profile: "us-core" })),
        );
        expect(serializeResource(generateCondition({ seed: s }))).toBe(
          serializeResource(generateCondition({ seed: s })),
        );
        expect(serializeResource(generateObservationLab({ seed: s }))).toBe(
          serializeResource(generateObservationLab({ seed: s })),
        );
        expect(serializeResource(generateVitalSign({ seed: s }))).toBe(
          serializeResource(generateVitalSign({ seed: s })),
        );
        expect(serializeResource(generateMedicationRequest({ seed: s }))).toBe(
          serializeResource(generateMedicationRequest({ seed: s })),
        );
        expect(serializeResource(generateEncounter({ seed: s }))).toBe(
          serializeResource(generateEncounter({ seed: s })),
        );
        expect(serializeResource(generateImmunization({ seed: s }))).toBe(
          serializeResource(generateImmunization({ seed: s })),
        );
        expect(serializeResource(generateAllergyIntolerance({ seed: s }))).toBe(
          serializeResource(generateAllergyIntolerance({ seed: s })),
        );
        expect(serializeResource(generateProcedure({ seed: s }))).toBe(
          serializeResource(generateProcedure({ seed: s })),
        );
        expect(serializeResource(generateDiagnosticReport({ seed: s }))).toBe(
          serializeResource(generateDiagnosticReport({ seed: s })),
        );
        expect(serializeResource(generateProvenance({ seed: s }))).toBe(
          serializeResource(generateProvenance({ seed: s })),
        );
      }),
      { numRuns: 250 },
    );
  });

  it("profile-addressed generation is byte-identical for the same seed, every covered profile", () => {
    const covered = usCoreCoverage().filter((entry) => entry.generated);
    expect(covered.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(seed(), (s) => {
        for (const entry of covered) {
          expect(
            serializeResource(generateUsCoreProfile({ profile: entry.profile, seed: s })),
            entry.profile,
          ).toBe(serializeResource(generateUsCoreProfile({ profile: entry.profile, seed: s })));
        }
      }),
      { numRuns: 120 },
    );
  });

  it("each Bundle shape is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(
        seed(),
        fc.constantFrom("collection" as const, "transaction" as const, "document" as const),
        (s, type) => {
          expect(serializeResource(generateBundle({ seed: s, type }))).toBe(
            serializeResource(generateBundle({ seed: s, type })),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it("a FHIR corpus is byte-identical for the same seed", () => {
    fc.assert(
      fc.property(seed(), fc.integer({ min: 1, max: 6 }), (s, count) => {
        const c1 = fhirCorpus({ seed: s, count }).artifacts.map((x) => x.content);
        const c2 = fhirCorpus({ seed: s, count }).artifacts.map((x) => x.content);
        expect(c1).toEqual(c2);
      }),
      { numRuns: 120 },
    );
  });

  it("a different seed produces different output", () => {
    const a = serializeResource(generatePatient({ seed: 1, profile: "us-core" }));
    const b = serializeResource(generatePatient({ seed: 2, profile: "us-core" }));
    expect(a).not.toBe(b);
  });
});
