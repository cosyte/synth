/**
 * Synthetic FHIR R4 **`AllergyIntolerance`** generation — a US Core AllergyIntolerance (roadmap
 * §Phase 3, deferred to SYNTH-4). Built through `@cosyte/fhir`; the allergen `code` and reaction
 * `manifestation` come from the license-clean RxNorm/SNOMED example pools, `patient` from a supplied or
 * derived synthetic Patient reference. `clinicalStatus` + `verificationStatus` are emitted together so
 * the base `ait-1`/`ait-2` invariants hold; the required `code` and `patient` are always present.
 *
 * @module
 */

import { complex, list } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import { createRng } from "../rng/rng.js";
import { codeableConcept, meta, narrative, prop, reference, str, type Prop } from "./builder.js";
import { EXAMPLE_ALLERGENS, EXAMPLE_ALLERGY_MANIFESTATIONS } from "./example-codes.js";
import { SYSTEM, US_CORE_PROFILE } from "./us-core.js";

/** Options for {@link generateAllergyIntolerance}. */
export interface GenerateAllergyIntoleranceOptions {
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
  /** The `patient` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl). */
  readonly patient?: string;
  /** Whether to claim US Core via `meta.profile`. Defaults to `true`. */
  readonly usCore?: boolean;
}

/**
 * Generate a spec-clean synthetic US Core `AllergyIntolerance`, built through `@cosyte/fhir`.
 *
 * @param options - Seed, patient reference, and US Core posture. See
 *   {@link GenerateAllergyIntoleranceOptions}.
 * @returns The `AllergyIntolerance` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateAllergyIntolerance } from "@cosyte/synth/fhir";
 * const allergy = generateAllergyIntolerance({ seed: 15, patient: "Patient/syn-patient-1" });
 * ```
 */
export function generateAllergyIntolerance(
  options: GenerateAllergyIntoleranceOptions = {},
): FhirComplex {
  const { seed = 0, patient = "Patient/syn-patient-1", usCore = true } = options;
  const rng = createRng(seed);
  const allergen = rng.pick(EXAMPLE_ALLERGENS);
  const manifestation = rng.pick(EXAMPLE_ALLERGY_MANIFESTATIONS);

  const props: Prop[] = [
    prop("resourceType", str("AllergyIntolerance")),
    prop("id", str(`syn-allergy-${rng.digits(8)}`)),
  ];
  if (usCore) props.push(prop("meta", meta([US_CORE_PROFILE.ALLERGY_INTOLERANCE])));
  props.push(prop("text", narrative(`Synthetic allergy: ${allergen.display}.`)));
  props.push(
    prop(
      "clinicalStatus",
      codeableConcept({ system: SYSTEM.ALLERGY_CLINICAL, code: "active", display: "Active" }),
    ),
  );
  props.push(
    prop(
      "verificationStatus",
      codeableConcept({
        system: SYSTEM.ALLERGY_VERIFICATION,
        code: "confirmed",
        display: "Confirmed",
      }),
    ),
  );
  props.push(prop("code", codeableConcept(allergen)));
  props.push(prop("patient", reference(patient)));
  props.push(
    prop(
      "reaction",
      list([complex([prop("manifestation", list([codeableConcept(manifestation)]))])]),
    ),
  );
  return complex(props);
}
