/**
 * Synthetic FHIR R4 **`Encounter`** generation: a US Core Encounter. Built through `@cosyte/fhir`'s model
 * constructors; `class` and `type` come from the
 * license-clean v3-ActCode / SNOMED example pools, `subject` from a supplied or derived synthetic
 * Patient reference. The required elements (`status`, `class`, `type`, `subject`) are always present.
 *
 * @module
 */

import type { FhirComplex } from "@cosyte/fhir";

import { createRng } from "../rng/rng.js";
import { safe } from "../safe/index.js";
import {
  coding,
  codeableConcept,
  meta,
  narrative,
  prop,
  reference,
  str,
  toFhirDate,
  type Prop,
} from "./builder.js";
import { EXAMPLE_ENCOUNTER_CLASSES, EXAMPLE_ENCOUNTER_TYPES } from "./example-codes.js";
import { US_CORE_PROFILE } from "./us-core.js";
import { fhirPeer } from "../peers.js";

/** Options for {@link generateEncounter}. */
export interface GenerateEncounterOptions {
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
  /** The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl). */
  readonly subject?: string;
  /** Whether to claim US Core via `meta.profile`. Defaults to `true`. */
  readonly usCore?: boolean;
}

/**
 * Generate a spec-clean synthetic US Core `Encounter`, built through `@cosyte/fhir`.
 *
 * @param options - Seed, subject reference, and US Core posture. See {@link GenerateEncounterOptions}.
 * @returns The `Encounter` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateEncounter } from "@cosyte/synth/fhir";
 * const encounter = generateEncounter({ seed: 11, subject: "Patient/syn-patient-1" });
 * ```
 */
export function generateEncounter(options: GenerateEncounterOptions = {}): FhirComplex {
  const { seed = 0, subject = "Patient/syn-patient-1", usCore = true } = options;
  const rng = createRng(seed);
  const cls = rng.pick(EXAMPLE_ENCOUNTER_CLASSES);
  const type = rng.pick(EXAMPLE_ENCOUNTER_TYPES);
  const id = safe.identifier(rng, "AN");
  const start = toFhirDate(safe.dateYmd(rng, 2018, 2024));

  const props: Prop[] = [
    prop("resourceType", str("Encounter")),
    prop("id", str(`syn-enc-${rng.digits(8)}`)),
  ];
  if (usCore) props.push(prop("meta", meta([US_CORE_PROFILE.ENCOUNTER])));
  props.push(prop("text", narrative(`Synthetic encounter: ${type.display}.`)));
  props.push(
    prop(
      "identifier",
      fhirPeer().list([
        fhirPeer().complex([
          prop("system", str(`urn:oid:${id.assigningAuthorityOid}`)),
          prop("value", str(id.value)),
        ]),
      ]),
    ),
  );
  props.push(prop("status", str("finished")));
  props.push(prop("class", coding(cls)));
  props.push(prop("type", fhirPeer().list([codeableConcept(type)])));
  props.push(prop("subject", reference(subject)));
  props.push(prop("period", fhirPeer().complex([prop("start", str(`${start}T09:00:00Z`))])));
  return fhirPeer().complex(props);
}
