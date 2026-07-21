/**
 * Synthetic FHIR R4 **`Observation`** generation — US Core Laboratory Result and US Core Vital Signs
 * (roadmap §Phase 3). Built through `@cosyte/fhir`; `code` and the measured `valueQuantity` come from
 * the license-clean LOINC/UCUM example pool, `subject` from a supplied or derived Patient reference.
 * The measured value is drawn from the seeded generator within a structurally-sane band — it implies no
 * real measurement (roadmap §2: structural, not clinical, realism).
 *
 * @module
 */

import { complex, list } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import { createRng, type Rng } from "../rng/rng.js";
import {
  codeableConcept,
  dec,
  meta,
  narrative,
  prop,
  reference,
  str,
  type Prop,
} from "./builder.js";
import {
  EXAMPLE_LAB_OBSERVATIONS,
  EXAMPLE_VITAL_SIGNS,
  type QuantConcept,
} from "./example-codes.js";
import { SYSTEM, US_CORE_PROFILE } from "./us-core.js";

/** Options for {@link generateObservationLab} / {@link generateVitalSign}. */
export interface GenerateObservationOptions {
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
  /** The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl). */
  readonly subject?: string;
  /** Whether to claim US Core via `meta.profile`. Defaults to `true`. */
  readonly usCore?: boolean;
}

/** Draw a synthetic `decimal` value string within the concept's band, at its declared precision. */
function drawValue(rng: Rng, concept: QuantConcept): string {
  const span = concept.high - concept.low;
  const raw = concept.low + rng.float() * span;
  return raw.toFixed(concept.decimals);
}

/** A UCUM `valueQuantity` for a measured concept — `value` (decimal), `unit`, UCUM `system` + `code`. */
function valueQuantity(rng: Rng, concept: QuantConcept): FhirComplex {
  return complex([
    prop("value", dec(drawValue(rng, concept))),
    prop("unit", str(concept.unit)),
    prop("system", str(SYSTEM.UCUM)),
    prop("code", str(concept.unit)),
  ]);
}

/** Build an `Observation` of the given category from a measured concept pool. */
function buildObservation(
  seed: number,
  subject: string,
  usCore: boolean,
  profileUrl: string,
  category: { code: string; display: string },
  pool: readonly QuantConcept[],
  effective: boolean,
): FhirComplex {
  const rng = createRng(seed);
  const concept = rng.pick(pool);
  const props: Prop[] = [
    prop("resourceType", str("Observation")),
    prop("id", str(`syn-obs-${rng.digits(8)}`)),
  ];
  if (usCore) props.push(prop("meta", meta([profileUrl])));
  props.push(
    prop("text", narrative(`Synthetic ${category.display.toLowerCase()}: ${concept.display}.`)),
  );
  props.push(prop("status", str("final")));
  props.push(
    prop(
      "category",
      list([
        codeableConcept({
          system: SYSTEM.OBSERVATION_CATEGORY,
          code: category.code,
          display: category.display,
        }),
      ]),
    ),
  );
  props.push(prop("code", codeableConcept(concept)));
  props.push(prop("subject", reference(subject)));
  // Draw the effective instant deterministically (a plausible recent date) before the value.
  const y = rng.int(2020, 2025);
  const m = String(rng.int(1, 12)).padStart(2, "0");
  const d = String(rng.int(1, 28)).padStart(2, "0");
  if (effective) props.push(prop("effectiveDateTime", str(`${String(y)}-${m}-${d}`)));
  props.push(prop("valueQuantity", valueQuantity(rng, concept)));
  return complex(props);
}

/**
 * Generate a spec-clean synthetic US Core **Laboratory Result** `Observation`.
 *
 * @param options - Seed, subject reference, US Core posture. See {@link GenerateObservationOptions}.
 * @returns The `Observation` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateObservationLab } from "@cosyte/synth/fhir";
 * const obs = generateObservationLab({ seed: 3, subject: "Patient/syn-patient-1" });
 * ```
 */
export function generateObservationLab(options: GenerateObservationOptions = {}): FhirComplex {
  const { seed = 0, subject = "Patient/syn-patient-1", usCore = true } = options;
  return buildObservation(
    seed,
    subject,
    usCore,
    US_CORE_PROFILE.OBSERVATION_LAB,
    { code: "laboratory", display: "Laboratory" },
    EXAMPLE_LAB_OBSERVATIONS,
    false,
  );
}

/**
 * Generate a spec-clean synthetic US Core **Vital Signs** `Observation` (a single-value vital such as
 * heart rate or body weight; `effectiveDateTime` is required by the vital-signs profile).
 *
 * @param options - Seed, subject reference, US Core posture. See {@link GenerateObservationOptions}.
 * @returns The `Observation` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateVitalSign } from "@cosyte/synth/fhir";
 * const vs = generateVitalSign({ seed: 5, subject: "Patient/syn-patient-1" });
 * ```
 */
export function generateVitalSign(options: GenerateObservationOptions = {}): FhirComplex {
  const { seed = 0, subject = "Patient/syn-patient-1", usCore = true } = options;
  return buildObservation(
    seed,
    subject,
    usCore,
    US_CORE_PROFILE.VITAL_SIGNS,
    { code: "vital-signs", display: "Vital Signs" },
    EXAMPLE_VITAL_SIGNS,
    true,
  );
}
