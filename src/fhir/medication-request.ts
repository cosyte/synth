/**
 * Synthetic FHIR R4 **`MedicationRequest`** generation — a US Core MedicationRequest with an inline
 * `medicationCodeableConcept` (roadmap §Phase 3). Built through `@cosyte/fhir`; the medication comes
 * from the license-clean RxNorm example pool. US Core invariant `us-core-21` requires a `requester`
 * whenever `intent = order`, so a synthetic requester reference is always emitted.
 *
 * @module
 */

import { complex } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import { createRng } from "../rng/rng.js";
import { codeableConcept, meta, narrative, prop, reference, str, type Prop } from "./builder.js";
import { EXAMPLE_MEDICATIONS } from "./example-codes.js";
import { US_CORE_PROFILE } from "./us-core.js";

/** Options for {@link generateMedicationRequest}. */
export interface GenerateMedicationRequestOptions {
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
  /** The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl). */
  readonly subject?: string;
  /** The `requester` reference. Defaults to a synthetic `Practitioner` reference. */
  readonly requester?: string;
  /** Whether to claim US Core via `meta.profile`. Defaults to `true`. */
  readonly usCore?: boolean;
}

/**
 * Generate a spec-clean synthetic US Core `MedicationRequest`, built through `@cosyte/fhir`.
 *
 * @param options - Seed, subject/requester references, US Core posture.
 * @returns The `MedicationRequest` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateMedicationRequest } from "@cosyte/synth/fhir";
 * const mr = generateMedicationRequest({ seed: 9, subject: "Patient/syn-patient-1" });
 * ```
 */
export function generateMedicationRequest(
  options: GenerateMedicationRequestOptions = {},
): FhirComplex {
  const {
    seed = 0,
    subject = "Patient/syn-patient-1",
    requester = "Practitioner/syn-practitioner-1",
    usCore = true,
  } = options;
  const rng = createRng(seed);
  const med = rng.pick(EXAMPLE_MEDICATIONS);
  const y = rng.int(2020, 2025);
  const m = String(rng.int(1, 12)).padStart(2, "0");
  const d = String(rng.int(1, 28)).padStart(2, "0");

  const props: Prop[] = [
    prop("resourceType", str("MedicationRequest")),
    prop("id", str(`syn-medreq-${rng.digits(8)}`)),
  ];
  if (usCore) props.push(prop("meta", meta([US_CORE_PROFILE.MEDICATION_REQUEST])));
  props.push(prop("text", narrative(`Synthetic medication order: ${med.display}.`)));
  props.push(prop("status", str("active")));
  props.push(prop("intent", str("order")));
  props.push(prop("medicationCodeableConcept", codeableConcept(med)));
  props.push(prop("subject", reference(subject)));
  props.push(prop("authoredOn", str(`${String(y)}-${m}-${d}`)));
  props.push(prop("requester", reference(requester)));
  return complex(props);
}
