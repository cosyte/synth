/**
 * US Core + base-FHIR **canonical URLs and code-system identifiers** — the facts `@cosyte/synth` needs
 * to emit US-Core-conformant resources, and nothing more (roadmap §Phase 3).
 *
 * **Content-free, exactly like `@cosyte/fhir`.** These are *identifiers* — canonical URLs and code
 * `system` URIs — not the copyrighted terminology tables or the profile `StructureDefinition` content
 * they name. `@cosyte/synth` bundles **no** US Core IG: a consumer who wants to *validate* generated
 * output against US Core supplies the `StructureDefinition`s themselves (BYO), exactly as
 * `@cosyte/fhir.validateResource({ profiles })` requires. What is encoded here is only which canonical
 * URL a resource's `meta.profile` claims and which `system` a coding carries — public facts.
 *
 * The URLs target **US Core 6.1.0** (the USCDI v3 / ONC HTI-1 §170.315(g)(10) anchor, FHIR R4 4.0.1),
 * grounded firsthand against the published IG (`hl7.org/fhir/us/core/STU6.1`) — the same version the
 * Phase-3 test corpus validates against.
 *
 * @module
 */

/** The canonical `meta.profile` URLs for the US Core 6.1.0 profiles `@cosyte/synth` generates. */
export const US_CORE_PROFILE = Object.freeze({
  /** US Core Patient. */
  PATIENT: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
  /** US Core Condition (Problems and Health Concerns). */
  CONDITION:
    "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns",
  /** US Core Laboratory Result Observation. */
  OBSERVATION_LAB: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
  /** US Core Vital Signs (derived from the base FHIR vital-signs profile). */
  VITAL_SIGNS: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs",
  /** US Core MedicationRequest. */
  MEDICATION_REQUEST: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
  /** US Core Encounter (SYNTH-4). */
  ENCOUNTER: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
  /** US Core DiagnosticReport Profile for Laboratory Results Reporting (SYNTH-4). */
  DIAGNOSTIC_REPORT_LAB:
    "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab",
  /** US Core Immunization (SYNTH-4). */
  IMMUNIZATION: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
  /** US Core AllergyIntolerance (SYNTH-4). */
  ALLERGY_INTOLERANCE: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
  /** US Core Procedure (SYNTH-4). */
  PROCEDURE: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
} as const);

/** The US Core `us-core-race` extension URL (a Patient must-support extension). */
export const US_CORE_RACE_EXTENSION =
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race";
/** The US Core `us-core-ethnicity` extension URL (a Patient must-support extension). */
export const US_CORE_ETHNICITY_EXTENSION =
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity";
/** The US Core `us-core-birthsex` extension URL (a Patient must-support extension). */
export const US_CORE_BIRTHSEX_EXTENSION =
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex";

/**
 * The code-system `system` URIs the Phase-3 generators reference. Public identity URIs (HL7-published),
 * never the code-system *content* — no SNOMED/LOINC/RxNorm table is bundled (roadmap §2).
 */
export const SYSTEM = Object.freeze({
  /** FHIR `administrative-gender` (`Patient.gender`). */
  ADMINISTRATIVE_GENDER: "http://hl7.org/fhir/administrative-gender",
  /** HL7 Terminology `observation-category`. */
  OBSERVATION_CATEGORY: "http://terminology.hl7.org/CodeSystem/observation-category",
  /** HL7 Terminology `condition-category`. */
  CONDITION_CATEGORY: "http://terminology.hl7.org/CodeSystem/condition-category",
  /** HL7 Terminology `condition-clinical`. */
  CONDITION_CLINICAL: "http://terminology.hl7.org/CodeSystem/condition-clinical",
  /** HL7 Terminology `condition-ver-status`. */
  CONDITION_VER_STATUS: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
  /** HL7 v2 `0203` identifier-type (`Identifier.type.coding.code` = `MR`). */
  IDENTIFIER_TYPE: "http://terminology.hl7.org/CodeSystem/v2-0203",
  /** OMB race & ethnicity category system (US Core race/ethnicity `ombCategory`). */
  OMB_RACE_ETHNICITY: "urn:oid:2.16.840.1.113883.6.238",
  /** LOINC — `Observation.code` (lab + vital-signs). */
  LOINC: "http://loinc.org",
  /** SNOMED CT — `Condition.code`. */
  SNOMED: "http://snomed.info/sct",
  /** RxNorm — `MedicationRequest.medicationCodeableConcept` + an allergen substance. */
  RXNORM: "http://www.nlm.nih.gov/research/umls/rxnorm",
  /** UCUM — `Quantity.system` for units of measure. */
  UCUM: "http://unitsofmeasure.org",
  /** CVX (CDC vaccine administered) — `Immunization.vaccineCode` (SYNTH-4). */
  CVX: "http://hl7.org/fhir/sid/cvx",
  /** HL7 v3 `ActCode` — `Encounter.class` (SYNTH-4). */
  V3_ACT_CODE: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  /** HL7 v2 `0074` diagnostic-service-section — `DiagnosticReport.category` (`LAB`) (SYNTH-4). */
  DIAGNOSTIC_SERVICE_SECTION: "http://terminology.hl7.org/CodeSystem/v2-0074",
  /** HL7 Terminology `allergyintolerance-clinical` — `AllergyIntolerance.clinicalStatus` (SYNTH-4). */
  ALLERGY_CLINICAL: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
  /** HL7 Terminology `allergyintolerance-verification` — `AllergyIntolerance.verificationStatus`. */
  ALLERGY_VERIFICATION: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
} as const);

/** A US Core profile canonical URL. */
export type UsCoreProfileUrl = (typeof US_CORE_PROFILE)[keyof typeof US_CORE_PROFILE];
