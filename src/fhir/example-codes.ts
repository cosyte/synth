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
