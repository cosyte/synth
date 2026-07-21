/**
 * Synthetic FHIR R4 **`Procedure`** generation — a US Core Procedure (roadmap §Phase 3, deferred to
 * SYNTH-4). Built through `@cosyte/fhir`; the `code` comes from the license-clean SNOMED procedure
 * example pool (never CPT — roadmap §2), `subject` from a supplied or derived synthetic Patient
 * reference. The required elements (`status`, `code`, `subject`) plus the must-support
 * `performedDateTime` are always present.
 *
 * @module
 */

import { complex } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import { createRng } from "../rng/rng.js";
import { safe } from "../safe/index.js";
import {
  codeableConcept,
  meta,
  narrative,
  prop,
  reference,
  str,
  toFhirDate,
  type Prop,
} from "./builder.js";
import { EXAMPLE_PROCEDURES } from "./example-codes.js";
import { US_CORE_PROFILE } from "./us-core.js";

/** Options for {@link generateProcedure}. */
export interface GenerateProcedureOptions {
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
  /** The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl). */
  readonly subject?: string;
  /** Whether to claim US Core via `meta.profile`. Defaults to `true`. */
  readonly usCore?: boolean;
}

/**
 * Generate a spec-clean synthetic US Core `Procedure`, built through `@cosyte/fhir`.
 *
 * @param options - Seed, subject reference, and US Core posture. See {@link GenerateProcedureOptions}.
 * @returns The `Procedure` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateProcedure } from "@cosyte/synth/fhir";
 * const procedure = generateProcedure({ seed: 17, subject: "Patient/syn-patient-1" });
 * ```
 */
export function generateProcedure(options: GenerateProcedureOptions = {}): FhirComplex {
  const { seed = 0, subject = "Patient/syn-patient-1", usCore = true } = options;
  const rng = createRng(seed);
  const code = rng.pick(EXAMPLE_PROCEDURES);
  const performed = toFhirDate(safe.dateYmd(rng, 2018, 2024));

  const props: Prop[] = [
    prop("resourceType", str("Procedure")),
    prop("id", str(`syn-proc-${rng.digits(8)}`)),
  ];
  if (usCore) props.push(prop("meta", meta([US_CORE_PROFILE.PROCEDURE])));
  props.push(prop("text", narrative(`Synthetic procedure: ${code.display}.`)));
  props.push(prop("status", str("completed")));
  props.push(prop("code", codeableConcept(code)));
  props.push(prop("subject", reference(subject)));
  props.push(prop("performedDateTime", str(`${performed}T10:00:00Z`)));
  return complex(props);
}
