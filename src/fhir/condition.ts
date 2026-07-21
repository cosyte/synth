/**
 * Synthetic FHIR R4 **`Condition`** generation — a US Core "Problems and Health Concerns" problem-list
 * item (roadmap §Phase 3). Built through `@cosyte/fhir`; the `code` comes from the license-clean SNOMED
 * example pool, the `subject` from a supplied or derived synthetic Patient reference.
 *
 * @module
 */

import { complex, list } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import { createRng } from "../rng/rng.js";
import { codeableConcept, meta, narrative, prop, reference, str, type Prop } from "./builder.js";
import { EXAMPLE_CONDITIONS } from "./example-codes.js";
import { SYSTEM, US_CORE_PROFILE } from "./us-core.js";

/** Options for {@link generateCondition}. */
export interface GenerateConditionOptions {
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
  /** The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl). */
  readonly subject?: string;
  /** Whether to claim US Core via `meta.profile`. Defaults to `true`. */
  readonly usCore?: boolean;
}

/**
 * Generate a spec-clean synthetic US Core `Condition` (problem-list item), built through `@cosyte/fhir`.
 *
 * @param options - Seed, subject reference, and US Core posture. See {@link GenerateConditionOptions}.
 * @returns The `Condition` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateCondition } from "@cosyte/synth/fhir";
 * const condition = generateCondition({ seed: 7, subject: "Patient/syn-patient-1" });
 * ```
 */
export function generateCondition(options: GenerateConditionOptions = {}): FhirComplex {
  const { seed = 0, subject = "Patient/syn-patient-1", usCore = true } = options;
  const rng = createRng(seed);
  const code = rng.pick(EXAMPLE_CONDITIONS);

  const props: Prop[] = [
    prop("resourceType", str("Condition")),
    prop("id", str(`syn-cond-${rng.digits(8)}`)),
  ];
  if (usCore) props.push(prop("meta", meta([US_CORE_PROFILE.CONDITION])));
  props.push(prop("text", narrative(`Synthetic condition: ${code.display}.`)));
  props.push(
    prop(
      "clinicalStatus",
      codeableConcept({ system: SYSTEM.CONDITION_CLINICAL, code: "active", display: "Active" }),
    ),
  );
  props.push(
    prop(
      "verificationStatus",
      codeableConcept({
        system: SYSTEM.CONDITION_VER_STATUS,
        code: "confirmed",
        display: "Confirmed",
      }),
    ),
  );
  props.push(
    prop(
      "category",
      list([
        codeableConcept({
          system: SYSTEM.CONDITION_CATEGORY,
          code: "problem-list-item",
          display: "Problem List Item",
        }),
      ]),
    ),
  );
  props.push(prop("code", codeableConcept(code)));
  props.push(prop("subject", reference(subject)));
  return complex(props);
}
