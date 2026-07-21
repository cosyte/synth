/**
 * Synthetic FHIR R4 **`Patient`** generation — the anchor of the US Core clinical spine (roadmap
 * §Phase 3). Built through `@cosyte/fhir`'s model constructors, every identity field drawn from the
 * synthetic-safety providers (roadmap §4). In `us-core` mode the resource claims US Core Patient via
 * `meta.profile`, satisfies its required elements (`identifier` + `system` + `value`, `name`, `gender`),
 * and carries the must-support race / ethnicity / birthsex extensions.
 *
 * @module
 */

import { complex, list } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import { createRng } from "../rng/rng.js";
import {
  bool,
  coding,
  fhirPatientIdentity,
  meta,
  mrnIdentifier,
  narrative,
  prop,
  str,
  type Prop,
} from "./builder.js";
import { EXAMPLE_ETHNICITY_CATEGORIES, EXAMPLE_RACE_CATEGORIES } from "./example-codes.js";
import {
  US_CORE_BIRTHSEX_EXTENSION,
  US_CORE_ETHNICITY_EXTENSION,
  US_CORE_PROFILE,
  US_CORE_RACE_EXTENSION,
} from "./us-core.js";

/** Options for {@link generatePatient}. */
export interface GeneratePatientOptions {
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
  /**
   * The profile posture. `"base"` (default) emits a spec-clean base-R4 `Patient`; `"us-core"` adds the
   * US Core `meta.profile` and the race/ethnicity/birthsex must-support extensions (the required
   * elements — identifier/name/gender — are always present).
   */
  readonly profile?: "base" | "us-core";
}

/** A US Core `us-core-race` / `us-core-ethnicity` complex extension with one OMB category + text. */
function ombExtension(
  url: string,
  category: { system: string; code: string; display: string },
): FhirComplex {
  return complex([
    prop("url", str(url)),
    prop(
      "extension",
      list([
        complex([prop("url", str("ombCategory")), prop("valueCoding", coding(category))]),
        complex([prop("url", str("text")), prop("valueString", str(category.display))]),
      ]),
    ),
  ]);
}

/**
 * Generate a spec-clean synthetic FHIR R4 `Patient` (base or US Core), built through `@cosyte/fhir`.
 *
 * @param options - Seed and profile posture. See {@link GeneratePatientOptions}.
 * @returns The `Patient` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generatePatient } from "@cosyte/synth/fhir";
 * import { serializeResource } from "@cosyte/fhir";
 * const patient = generatePatient({ seed: 42, profile: "us-core" });
 * serializeResource(patient);
 * ```
 */
export function generatePatient(options: GeneratePatientOptions = {}): FhirComplex {
  const { seed = 0, profile = "base" } = options;
  const rng = createRng(seed);
  const id = fhirPatientIdentity(rng);
  const usCore = profile === "us-core";

  const props: Prop[] = [
    prop("resourceType", str("Patient")),
    prop("id", str(`syn-patient-${id.id}`)),
  ];
  if (usCore) props.push(prop("meta", meta([US_CORE_PROFILE.PATIENT])));
  props.push(
    prop(
      "text",
      narrative(
        `Synthetic patient ${id.person.given} ${id.person.family} (${id.gender}, born ${id.birthDate}).`,
      ),
    ),
  );

  if (usCore) {
    const race = rng.pick(EXAMPLE_RACE_CATEGORIES);
    const ethnicity = rng.pick(EXAMPLE_ETHNICITY_CATEGORIES);
    const birthsex = id.gender === "male" ? "M" : "F";
    props.push(
      prop(
        "extension",
        list([
          ombExtension(US_CORE_RACE_EXTENSION, race),
          ombExtension(US_CORE_ETHNICITY_EXTENSION, ethnicity),
          complex([prop("url", str(US_CORE_BIRTHSEX_EXTENSION)), prop("valueCode", str(birthsex))]),
        ]),
      ),
    );
  }

  props.push(prop("identifier", list([mrnIdentifier(id.mrn)])));
  props.push(prop("active", bool(true)));
  props.push(
    prop(
      "name",
      list([
        complex([
          prop("use", str("official")),
          prop("family", str(id.person.family)),
          prop("given", list([str(id.person.given)])),
        ]),
      ]),
    ),
  );
  props.push(
    prop(
      "telecom",
      list([
        complex([
          prop("system", str("phone")),
          prop("value", str(id.phone)),
          prop("use", str("home")),
        ]),
        complex([prop("system", str("email")), prop("value", str(id.email))]),
      ]),
    ),
  );
  props.push(prop("gender", str(id.gender)));
  props.push(prop("birthDate", str(id.birthDate)));
  props.push(
    prop(
      "address",
      list([
        complex([
          prop("use", str("home")),
          prop("line", list([str(id.address.street)])),
          prop("city", str(id.address.city)),
          prop("state", str(id.address.state)),
          prop("postalCode", str(id.address.zip)),
        ]),
      ]),
    ),
  );
  return complex(props);
}
