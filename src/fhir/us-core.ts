/**
 * US Core + base-FHIR **canonical URLs and code-system identifiers**: the facts `@cosyte/synth` needs
 * to emit US-Core-conformant resources, and nothing more.
 *
 * **Content-free, exactly like `@cosyte/fhir`.** These are *identifiers*: canonical URLs and code
 * `system` URIs, not the copyrighted terminology tables or the profile `StructureDefinition` content
 * they name. `@cosyte/synth` bundles **no** US Core IG: a consumer who wants to *validate* generated
 * output against US Core supplies the `StructureDefinition`s themselves (BYO), exactly as
 * `@cosyte/fhir.validateResource({ profiles })` requires. What is encoded here is only which canonical
 * URL a resource's `meta.profile` claims and which `system` a coding carries: public facts.
 *
 * The URLs target **US Core 6.1.0** (the USCDI v3 / ONC HTI-1 §170.315(g)(10) anchor, FHIR R4 4.0.1),
 * grounded firsthand against the published IG (`hl7.org/fhir/us/core/STU6.1`): the same version the
 * test corpus validates against.
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
  /** US Core Encounter. */
  ENCOUNTER: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
  /** US Core DiagnosticReport Profile for Laboratory Results Reporting. */
  DIAGNOSTIC_REPORT_LAB:
    "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab",
  /** US Core Immunization. */
  IMMUNIZATION: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
  /** US Core AllergyIntolerance. */
  ALLERGY_INTOLERANCE: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
  /** US Core Procedure. */
  PROCEDURE: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
  /** US Core Provenance. */
  PROVENANCE: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-provenance",
} as const);

/**
 * The canonical prefix every US Core 6.1.0 resource profile's `url` shares. A profile's canonical is
 * this prefix followed by its profile id.
 *
 * @example
 * ```ts
 * import { US_CORE_PROFILE_BASE } from "@cosyte/synth/fhir";
 * `${US_CORE_PROFILE_BASE}us-core-provenance`;
 * ```
 */
export const US_CORE_PROFILE_BASE = "http://hl7.org/fhir/us/core/StructureDefinition/";

/**
 * The **adopted set**: the profile ids of every US Core 6.1.0 **resource profile** the implementation
 * guide publishes, transcribed from the guide's own artifact index ("Structures: Resource Profiles").
 * This is the closed set a profile-addressed request is resolved against, and it is *identifiers
 * only*, never IG content, exactly like {@link US_CORE_PROFILE}.
 *
 * `45 CFR 170.215` adopts FHIR R4.0.1 and US Core STU 6.1.0, so this is the profile set a developer
 * building to `45 CFR 170.315(g)(10)` addresses. It is **not** the count of
 * `StructureDefinition-us-core-*.json` files in the guide's source tree: that directory also holds
 * the guide's extension definitions and omits profiles the guide publishes.
 *
 * The guide's 10 **extension definitions** (`us-core-race`, `us-core-birthsex`, …) are deliberately
 * absent: an extension is not a standalone artifact, so a request naming one is refused like any
 * other name outside this set.
 *
 * @example
 * ```ts
 * import { US_CORE_ADOPTED_PROFILES } from "@cosyte/synth/fhir";
 * US_CORE_ADOPTED_PROFILES.includes("us-core-provenance"); // true
 * ```
 */
export const US_CORE_ADOPTED_PROFILES = Object.freeze([
  "head-occipital-frontal-circumference-percentile",
  "pediatric-bmi-for-age",
  "pediatric-weight-for-height",
  "us-core-allergyintolerance",
  "us-core-blood-pressure",
  "us-core-bmi",
  "us-core-body-height",
  "us-core-body-temperature",
  "us-core-body-weight",
  "us-core-careplan",
  "us-core-careteam",
  "us-core-condition-encounter-diagnosis",
  "us-core-condition-problems-health-concerns",
  "us-core-coverage",
  "us-core-diagnosticreport-lab",
  "us-core-diagnosticreport-note",
  "us-core-documentreference",
  "us-core-encounter",
  "us-core-goal",
  "us-core-head-circumference",
  "us-core-heart-rate",
  "us-core-immunization",
  "us-core-implantable-device",
  "us-core-location",
  "us-core-medication",
  "us-core-medicationdispense",
  "us-core-medicationrequest",
  "us-core-observation-clinical-result",
  "us-core-observation-lab",
  "us-core-observation-occupation",
  "us-core-observation-pregnancyintent",
  "us-core-observation-pregnancystatus",
  "us-core-observation-screening-assessment",
  "us-core-observation-sexual-orientation",
  "us-core-organization",
  "us-core-patient",
  "us-core-practitioner",
  "us-core-practitionerrole",
  "us-core-procedure",
  "us-core-provenance",
  "us-core-pulse-oximetry",
  "us-core-questionnaireresponse",
  "us-core-relatedperson",
  "us-core-respiratory-rate",
  "us-core-servicerequest",
  "us-core-simple-observation",
  "us-core-smokingstatus",
  "us-core-specimen",
  "us-core-vital-signs",
] as const);

/** One profile id from the adopted US Core 6.1.0 set. Erased at run time, so it is resolved, not trusted. */
export type UsCoreProfileId = (typeof US_CORE_ADOPTED_PROFILES)[number];

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
 * The code-system `system` URIs the generators reference. Public identity URIs (HL7-published),
 * never the code-system *content*, no SNOMED/LOINC/RxNorm table is bundled.
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
  /** LOINC, `Observation.code` (lab + vital-signs). */
  LOINC: "http://loinc.org",
  /** SNOMED CT, `Condition.code`. */
  SNOMED: "http://snomed.info/sct",
  /** RxNorm, `MedicationRequest.medicationCodeableConcept` + an allergen substance. */
  RXNORM: "http://www.nlm.nih.gov/research/umls/rxnorm",
  /** UCUM, `Quantity.system` for units of measure. */
  UCUM: "http://unitsofmeasure.org",
  /** CVX (CDC vaccine administered), `Immunization.vaccineCode`. */
  CVX: "http://hl7.org/fhir/sid/cvx",
  /** HL7 v3 `ActCode`, `Encounter.class`. */
  V3_ACT_CODE: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  /** HL7 v2 `0074` diagnostic-service-section, `DiagnosticReport.category` (`LAB`). */
  DIAGNOSTIC_SERVICE_SECTION: "http://terminology.hl7.org/CodeSystem/v2-0074",
  /** HL7 Terminology `allergyintolerance-clinical`, `AllergyIntolerance.clinicalStatus`. */
  ALLERGY_CLINICAL: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
  /** HL7 Terminology `allergyintolerance-verification`, `AllergyIntolerance.verificationStatus`. */
  ALLERGY_VERIFICATION: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
  /** HL7 Terminology `provenance-participant-type`, `Provenance.agent.type` (`author`). */
  PROVENANCE_PARTICIPANT_TYPE: "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
  /** US Core `us-core-provenance-participant-type`, `Provenance.agent.type` (`transmitter`). */
  US_CORE_PROVENANCE_PARTICIPANT_TYPE:
    "http://hl7.org/fhir/us/core/CodeSystem/us-core-provenance-participant-type",
} as const);

/** A US Core profile canonical URL. */
export type UsCoreProfileUrl = (typeof US_CORE_PROFILE)[keyof typeof US_CORE_PROFILE];
