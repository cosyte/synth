/**
 * Unit tests for the FHIR generators' option branches — the non-default paths (base vs US Core,
 * custom subject/requester, the full corpus mix) the property/round-trip suites do not exercise.
 */

import { describe, it, expect } from "vitest";
import { serializeResource } from "@cosyte/fhir";

import {
  fhirCorpus,
  generateCondition,
  generateMedicationRequest,
  generateObservationLab,
  generateVitalSign,
  roundTrip,
  type FhirResourceKind,
} from "../../src/fhir/index.js";

describe("FHIR generator option branches", () => {
  it("usCore:false omits meta.profile on the clinical resources", () => {
    for (const json of [
      serializeResource(generateCondition({ seed: 1, usCore: false })),
      serializeResource(generateObservationLab({ seed: 1, usCore: false })),
      serializeResource(generateVitalSign({ seed: 1, usCore: false })),
      serializeResource(generateMedicationRequest({ seed: 1, usCore: false })),
    ]) {
      expect(json).not.toContain('"meta"');
      expect(json).not.toContain("us-core");
    }
  });

  it("a custom subject and requester are honored", () => {
    const cond = serializeResource(generateCondition({ seed: 1, subject: "Patient/custom-x" }));
    expect(cond).toContain("Patient/custom-x");
    const mr = serializeResource(
      generateMedicationRequest({ seed: 1, subject: "Patient/p", requester: "Organization/org-9" }),
    );
    expect(mr).toContain("Organization/org-9");
  });

  it("even without US Core profiles, the clinical resources are structurally valid", () => {
    // No profiles supplied → base-R4 validation only; still zero errors, byte-stable.
    expect(roundTrip(generateCondition({ seed: 1, usCore: false })).specClean).toBe(true);
    expect(roundTrip(generateVitalSign({ seed: 1, usCore: false })).specClean).toBe(true);
  });

  it("fhirCorpus honors a custom mix and reports per-kind counts", () => {
    const mix: FhirResourceKind[] = ["Patient", "USCorePatient", "Condition", "ObservationLab"];
    const corpus = fhirCorpus({ seed: 9, count: 8, mix });
    expect(corpus.artifacts).toHaveLength(8);
    expect(corpus.manifest.counts["Patient"]).toBe(2);
    expect(corpus.manifest.counts["Condition"]).toBe(2);
    expect(corpus.artifacts.every((a) => a.warnings.length === 0)).toBe(true);
  });

  it("fhirCorpus defaults to a single US Core Patient when count/mix are omitted", () => {
    const corpus = fhirCorpus({ seed: 3 });
    expect(corpus.artifacts).toHaveLength(1);
    expect(corpus.artifacts[0]?.kind).toBe("USCorePatient");
  });
});
