/**
 * A tiny, curated, **license-clean** pool of example codes for filling coded fields in generated FHIR
 * resources (`Observation.code`, `Condition.code`, `MedicationRequest.medication[x]`, and the OMB
 * race/ethnicity categories). These are **public code facts** — codes drawn from the published FHIR R4
 * and US Core specification examples — not copyrighted terminology tables: `@cosyte/synth` bundles
 * **no** SNOMED/LOINC/RxNorm content (roadmap §2 "no bundled terminology"). The pool exists only so a
 * generated resource is *structurally* realistic; a consumer who needs their own codes supplies them.
 *
 * Nothing here is PHI — codes and their display text are not patient identifiers. The synthetic-safety
 * invariant governs identity fields (name/DOB/identifier/telecom/address), which come from `../safe`.
 *
 * @module
 */

/** A coded concept: a `system` URI, a `code`, and its human-readable `display`. */
export interface CodeConcept {
  /** The code-system URI (`Coding.system`). */
  readonly system: string;
  /** The code value (`Coding.code`). */
  readonly code: string;
  /** The human-readable display text (`Coding.display`). */
  readonly display: string;
}

/**
 * A quantitative observation concept: a LOINC code plus the UCUM unit and a plausible synthetic value
 * range the seeded generator draws within. The range implies **no** real measurement — it only keeps a
 * generated result inside a structurally-sane band.
 */
export interface QuantConcept extends CodeConcept {
  /** The UCUM unit code (`Quantity.code` and, as text, `Quantity.unit`). */
  readonly unit: string;
  /** Inclusive lower bound of the synthetic value (in `unit`). */
  readonly low: number;
  /** Inclusive upper bound of the synthetic value (in `unit`). */
  readonly high: number;
  /** Decimal places to render (keeps the emitted `decimal` lexical form stable and realistic). */
  readonly decimals: number;
}

import { SYSTEM } from "./us-core.js";

/**
 * LOINC laboratory-result example codes (for a US Core Laboratory Result `Observation`). Public LOINC
 * identifiers used purely as illustrative structural fillers, with UCUM units and synthetic value bands.
 */
export const EXAMPLE_LAB_OBSERVATIONS: readonly QuantConcept[] = Object.freeze([
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "2345-7",
    display: "Glucose [Mass/volume] in Serum or Plasma",
    unit: "mg/dL",
    low: 70,
    high: 140,
    decimals: 0,
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "718-7",
    display: "Hemoglobin [Mass/volume] in Blood",
    unit: "g/dL",
    low: 12,
    high: 17,
    decimals: 1,
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "2951-2",
    display: "Sodium [Moles/volume] in Serum or Plasma",
    unit: "mmol/L",
    low: 135,
    high: 145,
    decimals: 0,
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "2823-3",
    display: "Potassium [Moles/volume] in Serum or Plasma",
    unit: "mmol/L",
    low: 4,
    high: 5,
    decimals: 1,
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "4548-4",
    display: "Hemoglobin A1c/Hemoglobin.total in Blood",
    unit: "%",
    low: 4,
    high: 9,
    decimals: 1,
  }),
]);

/**
 * LOINC vital-sign example codes (for a US Core Vital Signs `Observation`). Public LOINC identifiers
 * with their required UCUM units and synthetic value bands. Simple single-value vitals only —
 * multi-component vitals (e.g. blood-pressure panel `85354-9`) are deferred to SYNTH-4.
 */
export const EXAMPLE_VITAL_SIGNS: readonly QuantConcept[] = Object.freeze([
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "8867-4",
    display: "Heart rate",
    unit: "/min",
    low: 55,
    high: 100,
    decimals: 0,
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "9279-1",
    display: "Respiratory rate",
    unit: "/min",
    low: 12,
    high: 20,
    decimals: 0,
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "8310-5",
    display: "Body temperature",
    unit: "Cel",
    low: 36,
    high: 38,
    decimals: 1,
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "29463-7",
    display: "Body weight",
    unit: "kg",
    low: 50,
    high: 100,
    decimals: 1,
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "8302-2",
    display: "Body height",
    unit: "cm",
    low: 150,
    high: 190,
    decimals: 0,
  }),
]);

/**
 * SNOMED CT problem/condition example codes (for a US Core `Condition.code`). Public SNOMED identifiers
 * used as structural fillers; `@cosyte/synth` bundles no SNOMED content.
 */
export const EXAMPLE_CONDITIONS: readonly CodeConcept[] = Object.freeze([
  Object.freeze({ system: SYSTEM.SNOMED, code: "59621000", display: "Essential hypertension" }),
  Object.freeze({ system: SYSTEM.SNOMED, code: "44054006", display: "Type 2 diabetes mellitus" }),
  Object.freeze({ system: SYSTEM.SNOMED, code: "195967001", display: "Asthma" }),
  Object.freeze({
    system: SYSTEM.SNOMED,
    code: "13645005",
    display: "Chronic obstructive lung disease",
  }),
  Object.freeze({ system: SYSTEM.SNOMED, code: "38341003", display: "Hypertensive disorder" }),
]);

/**
 * RxNorm medication example codes (for a US Core `MedicationRequest.medicationCodeableConcept`). Public
 * RxNorm identifiers used as structural fillers; `@cosyte/synth` bundles no RxNorm content.
 */
export const EXAMPLE_MEDICATIONS: readonly CodeConcept[] = Object.freeze([
  Object.freeze({
    system: SYSTEM.RXNORM,
    code: "1049221",
    display: "Acetaminophen 325 MG Oral Tablet",
  }),
  Object.freeze({ system: SYSTEM.RXNORM, code: "197361", display: "Amlodipine 5 MG Oral Tablet" }),
  Object.freeze({
    system: SYSTEM.RXNORM,
    code: "860975",
    display: "24 HR Metformin hydrochloride 500 MG Extended Release Oral Tablet",
  }),
  Object.freeze({
    system: SYSTEM.RXNORM,
    code: "308136",
    display: "Amoxicillin 250 MG Oral Capsule",
  }),
  Object.freeze({
    system: SYSTEM.RXNORM,
    code: "617314",
    display: "Atorvastatin 40 MG Oral Tablet",
  }),
]);

/**
 * OMB race categories (US Core `us-core-race` `ombCategory`) — the five OMB categories, public code
 * facts from the CDC Race &amp; Ethnicity code system (`urn:oid:2.16.840.1.113883.6.238`).
 */
export const EXAMPLE_RACE_CATEGORIES: readonly CodeConcept[] = Object.freeze([
  Object.freeze({ system: SYSTEM.OMB_RACE_ETHNICITY, code: "2106-3", display: "White" }),
  Object.freeze({
    system: SYSTEM.OMB_RACE_ETHNICITY,
    code: "2054-5",
    display: "Black or African American",
  }),
  Object.freeze({ system: SYSTEM.OMB_RACE_ETHNICITY, code: "2028-9", display: "Asian" }),
  Object.freeze({
    system: SYSTEM.OMB_RACE_ETHNICITY,
    code: "1002-5",
    display: "American Indian or Alaska Native",
  }),
  Object.freeze({
    system: SYSTEM.OMB_RACE_ETHNICITY,
    code: "2076-8",
    display: "Native Hawaiian or Other Pacific Islander",
  }),
]);

/**
 * OMB ethnicity categories (US Core `us-core-ethnicity` `ombCategory`) — the two OMB categories, public
 * code facts from the CDC Race &amp; Ethnicity code system.
 */
export const EXAMPLE_ETHNICITY_CATEGORIES: readonly CodeConcept[] = Object.freeze([
  Object.freeze({
    system: SYSTEM.OMB_RACE_ETHNICITY,
    code: "2135-2",
    display: "Hispanic or Latino",
  }),
  Object.freeze({
    system: SYSTEM.OMB_RACE_ETHNICITY,
    code: "2186-5",
    display: "Not Hispanic or Latino",
  }),
]);

/**
 * CVX vaccine-administered example codes (for a US Core `Immunization.vaccineCode`). Public CDC CVX
 * identifiers used as structural fillers; `@cosyte/synth` bundles no CVX content (SYNTH-4).
 */
export const EXAMPLE_VACCINES: readonly CodeConcept[] = Object.freeze([
  Object.freeze({
    system: SYSTEM.CVX,
    code: "140",
    display: "Influenza, seasonal, injectable, preservative free",
  }),
  Object.freeze({ system: SYSTEM.CVX, code: "03", display: "MMR" }),
  Object.freeze({ system: SYSTEM.CVX, code: "20", display: "DTaP" }),
  Object.freeze({ system: SYSTEM.CVX, code: "133", display: "Pneumococcal conjugate PCV 13" }),
  Object.freeze({
    system: SYSTEM.CVX,
    code: "208",
    display: "COVID-19, mRNA, LNP-S, PF, 30 mcg/0.3 mL dose",
  }),
]);

/**
 * Allergen-substance example codes (for a US Core `AllergyIntolerance.code`). Public RxNorm / SNOMED CT
 * identifiers used as structural fillers; no terminology content is bundled (SYNTH-4).
 */
export const EXAMPLE_ALLERGENS: readonly CodeConcept[] = Object.freeze([
  Object.freeze({ system: SYSTEM.RXNORM, code: "7980", display: "Penicillin G" }),
  Object.freeze({ system: SYSTEM.RXNORM, code: "2670", display: "Codeine" }),
  Object.freeze({ system: SYSTEM.SNOMED, code: "762952008", display: "Peanut (substance)" }),
  Object.freeze({ system: SYSTEM.SNOMED, code: "227493005", display: "Cashew nuts (substance)" }),
  Object.freeze({ system: SYSTEM.SNOMED, code: "3718001", display: "Cow's milk (substance)" }),
]);

/**
 * Allergy-reaction manifestation example codes (for `AllergyIntolerance.reaction.manifestation`).
 * Public SNOMED CT clinical-finding identifiers used as structural fillers (SYNTH-4).
 */
export const EXAMPLE_ALLERGY_MANIFESTATIONS: readonly CodeConcept[] = Object.freeze([
  Object.freeze({ system: SYSTEM.SNOMED, code: "247472004", display: "Wheal (finding)" }),
  Object.freeze({ system: SYSTEM.SNOMED, code: "126485001", display: "Urticaria (disorder)" }),
  Object.freeze({
    system: SYSTEM.SNOMED,
    code: "271807003",
    display: "Eruption of skin (disorder)",
  }),
  Object.freeze({ system: SYSTEM.SNOMED, code: "267036007", display: "Dyspnea (finding)" }),
  Object.freeze({ system: SYSTEM.SNOMED, code: "422587007", display: "Nausea (finding)" }),
]);

/**
 * SNOMED CT procedure example codes (for a US Core `Procedure.code`). Public SNOMED identifiers used as
 * structural fillers — **not** CPT (which is never bundled, roadmap §2) (SYNTH-4).
 */
export const EXAMPLE_PROCEDURES: readonly CodeConcept[] = Object.freeze([
  Object.freeze({
    system: SYSTEM.SNOMED,
    code: "80146002",
    display: "Excision of appendix (procedure)",
  }),
  Object.freeze({ system: SYSTEM.SNOMED, code: "73761001", display: "Colonoscopy (procedure)" }),
  Object.freeze({
    system: SYSTEM.SNOMED,
    code: "5880005",
    display: "Physical examination procedure (procedure)",
  }),
  Object.freeze({
    system: SYSTEM.SNOMED,
    code: "108252007",
    display: "Laboratory procedure (procedure)",
  }),
  Object.freeze({ system: SYSTEM.SNOMED, code: "71651007", display: "Mammography (procedure)" }),
]);

/**
 * LOINC diagnostic-report example codes (for a US Core Laboratory `DiagnosticReport.code`). Public LOINC
 * panel identifiers used as structural fillers (SYNTH-4).
 */
export const EXAMPLE_DIAGNOSTIC_REPORTS: readonly CodeConcept[] = Object.freeze([
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "24323-8",
    display: "Comprehensive metabolic 2000 panel - Serum or Plasma",
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "58410-2",
    display: "CBC panel - Blood by Automated count",
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "24357-6",
    display: "Urinalysis complete panel - Urine",
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "24331-1",
    display: "Lipid 1996 panel - Serum or Plasma",
  }),
  Object.freeze({
    system: SYSTEM.LOINC,
    code: "24321-2",
    display: "Basic metabolic 1998 panel - Serum or Plasma",
  }),
]);

/**
 * SNOMED CT encounter-type example codes (for a US Core `Encounter.type`). Public SNOMED identifiers
 * used as structural fillers (SYNTH-4).
 */
export const EXAMPLE_ENCOUNTER_TYPES: readonly CodeConcept[] = Object.freeze([
  Object.freeze({
    system: SYSTEM.SNOMED,
    code: "308335008",
    display: "Patient encounter procedure (procedure)",
  }),
  Object.freeze({
    system: SYSTEM.SNOMED,
    code: "185349003",
    display: "Encounter for check up (procedure)",
  }),
  Object.freeze({
    system: SYSTEM.SNOMED,
    code: "185347001",
    display: "Encounter for problem (procedure)",
  }),
  Object.freeze({
    system: SYSTEM.SNOMED,
    code: "390906007",
    display: "Follow-up encounter (procedure)",
  }),
]);

/**
 * HL7 v3 `ActCode` encounter-class example codes (for `Encounter.class`, a single `Coding`). Public
 * ActCode identifiers used as structural fillers (SYNTH-4).
 */
export const EXAMPLE_ENCOUNTER_CLASSES: readonly CodeConcept[] = Object.freeze([
  Object.freeze({ system: SYSTEM.V3_ACT_CODE, code: "AMB", display: "ambulatory" }),
  Object.freeze({ system: SYSTEM.V3_ACT_CODE, code: "EMER", display: "emergency" }),
  Object.freeze({ system: SYSTEM.V3_ACT_CODE, code: "IMP", display: "inpatient encounter" }),
]);
