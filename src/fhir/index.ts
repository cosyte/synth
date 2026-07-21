/**
 * `@cosyte/synth/fhir` — the FHIR R4 / US Core generation surface, exposed as its own subpath so
 * importing the package root does **not** pull `@cosyte/fhir`. This is the **lazy, per-format** boundary
 * the roadmap mandates (roadmap §1 "optional peer-dep, lazily loaded per format"): a consumer who only
 * needs FHIR fixtures imports `@cosyte/synth/fhir`; one who needs only the core primitives never loads a
 * parser. `@cosyte/fhir` is an **optional peer dependency** — present only for this subpath.
 *
 * Phase 3 (SYNTH-3) ships the US Core clinical spine — `Patient` (base + US Core), `Condition`,
 * `Observation` (US Core Laboratory Result + US Core Vital Signs), `MedicationRequest`, and `Bundle`
 * (collection + transaction) — each built through `@cosyte/fhir`'s model constructors so it is
 * **spec-clean by construction**, validating clean under `@cosyte/fhir.validateResource` and, against
 * caller-supplied (BYO) US Core `StructureDefinition`s, conformant to US Core 6.1.0. `Encounter`,
 * `DiagnosticReport`, `Immunization`, `AllergyIntolerance`, `Procedure`, the `document` Bundle shape,
 * and quirk generation are deferred to SYNTH-4 / Phase 7.
 *
 * @module
 */

export { generatePatient, type GeneratePatientOptions } from "./patient.js";
export { generateCondition, type GenerateConditionOptions } from "./condition.js";
export {
  generateObservationLab,
  generateVitalSign,
  type GenerateObservationOptions,
} from "./observation.js";
export {
  generateMedicationRequest,
  type GenerateMedicationRequestOptions,
} from "./medication-request.js";
export {
  generateBundle,
  fhirCorpus,
  type FhirBundleType,
  type GenerateBundleOptions,
  type FhirCorpusOptions,
  type FhirResourceKind,
} from "./bundle.js";
export { roundTrip, type RoundTripOptions, type RoundTripResult } from "./round-trip.js";

// Model-construction helpers (the vocabulary the generators build through) + the synthetic FHIR identity.
export {
  bool,
  coding,
  codeableConcept,
  dec,
  fhirPatientIdentity,
  meta,
  mrnIdentifier,
  narrative,
  prop,
  reference,
  str,
  toFhirDate,
  type FhirPatientIdentity,
  type Prop,
} from "./builder.js";

// US Core canonical URLs + code-system identifiers (facts only — no bundled profile/terminology content).
export {
  SYSTEM,
  US_CORE_PROFILE,
  US_CORE_BIRTHSEX_EXTENSION,
  US_CORE_ETHNICITY_EXTENSION,
  US_CORE_RACE_EXTENSION,
  type UsCoreProfileUrl,
} from "./us-core.js";

// The license-clean example code pool.
export {
  EXAMPLE_CONDITIONS,
  EXAMPLE_ETHNICITY_CATEGORIES,
  EXAMPLE_LAB_OBSERVATIONS,
  EXAMPLE_MEDICATIONS,
  EXAMPLE_RACE_CATEGORIES,
  EXAMPLE_VITAL_SIGNS,
  type CodeConcept,
  type QuantConcept,
} from "./example-codes.js";
