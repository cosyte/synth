/**
 * Synthetic FHIR R4 **`Immunization`** generation — a US Core Immunization (roadmap §Phase 3, deferred
 * to SYNTH-4). Built through `@cosyte/fhir`; `vaccineCode` comes from the license-clean CVX example
 * pool, `patient` from a supplied or derived synthetic Patient reference. The required elements
 * (`status`, `vaccineCode`, `patient`, `occurrenceDateTime`) are always present.
 *
 * @module
 */

import { complex } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import { createRng } from "../rng/rng.js";
import { safe } from "../safe/index.js";
import {
  bool,
  codeableConcept,
  meta,
  narrative,
  prop,
  reference,
  str,
  toFhirDate,
  type Prop,
} from "./builder.js";
import { EXAMPLE_VACCINES } from "./example-codes.js";
import { US_CORE_PROFILE } from "./us-core.js";

/** Options for {@link generateImmunization}. */
export interface GenerateImmunizationOptions {
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
  /** The `patient` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl). */
  readonly patient?: string;
  /** Whether to claim US Core via `meta.profile`. Defaults to `true`. */
  readonly usCore?: boolean;
}

/**
 * Generate a spec-clean synthetic US Core `Immunization`, built through `@cosyte/fhir`.
 *
 * @param options - Seed, patient reference, and US Core posture. See {@link GenerateImmunizationOptions}.
 * @returns The `Immunization` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateImmunization } from "@cosyte/synth/fhir";
 * const imm = generateImmunization({ seed: 13, patient: "Patient/syn-patient-1" });
 * ```
 */
export function generateImmunization(options: GenerateImmunizationOptions = {}): FhirComplex {
  const { seed = 0, patient = "Patient/syn-patient-1", usCore = true } = options;
  const rng = createRng(seed);
  const vaccine = rng.pick(EXAMPLE_VACCINES);
  const occurrence = toFhirDate(safe.dateYmd(rng, 2015, 2024));

  const props: Prop[] = [
    prop("resourceType", str("Immunization")),
    prop("id", str(`syn-imm-${rng.digits(8)}`)),
  ];
  if (usCore) props.push(prop("meta", meta([US_CORE_PROFILE.IMMUNIZATION])));
  props.push(prop("text", narrative(`Synthetic immunization: ${vaccine.display}.`)));
  props.push(prop("status", str("completed")));
  props.push(prop("vaccineCode", codeableConcept(vaccine)));
  props.push(prop("patient", reference(patient)));
  props.push(prop("occurrenceDateTime", str(occurrence)));
  props.push(prop("primarySource", bool(true)));
  return complex(props);
}
