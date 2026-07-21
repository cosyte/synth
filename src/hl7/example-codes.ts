/**
 * A tiny, curated, **license-clean** pool of example codes used to fill coded fields in generated HL7
 * messages (`OBR`/`OBX` observations, `ORC`/`OBR` orders, `RXA` vaccines). These are **public code
 * facts** — the spec examples' own values — not copyrighted terminology tables: `@cosyte/synth` bundles
 * **no** SNOMED/CPT/LOINC/RxNorm content (roadmap §2 "no bundled terminology"; NCPDP/terminology BYO
 * posture). The pool exists only so a generated message is *structurally* realistic; a consumer who
 * needs their own codes supplies them.
 *
 * Nothing here is PHI — codes and their display text are not identifiers. The synthetic-safety
 * invariant governs identity fields (name/DOB/SSN/MRN/phone/address), which come from `../safe`.
 *
 * @module
 */

/** A coded concept: an identifier code, human-readable text, and its code system (HL7 `CE`/`CWE`). */
export interface ExampleCode {
  /** The code value (component 1). */
  readonly code: string;
  /** The human-readable display text (component 2). */
  readonly text: string;
  /** The coding-system id (component 3), e.g. `"LN"` (LOINC) or `"CVX"`. */
  readonly system: string;
  /** Reporting units (UCUM), where the concept is a measured quantity. */
  readonly units?: string;
}

/**
 * A handful of common LOINC laboratory-observation example codes (for `OBX`). Public LOINC identifiers
 * used purely as illustrative structural fillers.
 */
export const EXAMPLE_LAB_OBSERVATIONS: readonly ExampleCode[] = Object.freeze([
  Object.freeze({ code: "4548-4", text: "Hemoglobin A1c", system: "LN", units: "%" }),
  Object.freeze({ code: "718-7", text: "Hemoglobin", system: "LN", units: "g/dL" }),
  Object.freeze({ code: "2345-7", text: "Glucose", system: "LN", units: "mg/dL" }),
  Object.freeze({ code: "2951-2", text: "Sodium", system: "LN", units: "mmol/L" }),
  Object.freeze({ code: "2823-3", text: "Potassium", system: "LN", units: "mmol/L" }),
  Object.freeze({ code: "789-8", text: "Erythrocytes", system: "LN", units: "10*6/uL" }),
]);

/**
 * A handful of LOINC panel/service example codes (for the `OBR`/`ORC` universal service id). Public
 * identifiers used as structural fillers.
 */
export const EXAMPLE_ORDER_SERVICES: readonly ExampleCode[] = Object.freeze([
  Object.freeze({ code: "24323-8", text: "Comprehensive metabolic panel", system: "LN" }),
  Object.freeze({ code: "58410-2", text: "CBC panel", system: "LN" }),
  Object.freeze({ code: "24356-8", text: "Urinalysis panel", system: "LN" }),
  Object.freeze({ code: "24331-1", text: "Lipid panel", system: "LN" }),
]);

/**
 * A handful of CDC CVX vaccine example codes (for `RXA-5`). Public CVX identifiers used as structural
 * fillers; `@cosyte/synth` bundles no vaccine terminology.
 */
export const EXAMPLE_VACCINES: readonly ExampleCode[] = Object.freeze([
  Object.freeze({ code: "08", text: "Hep B, adolescent or pediatric", system: "CVX" }),
  Object.freeze({ code: "20", text: "DTaP", system: "CVX" }),
  Object.freeze({ code: "03", text: "MMR", system: "CVX" }),
  Object.freeze({ code: "10", text: "IPV", system: "CVX" }),
  Object.freeze({ code: "141", text: "Influenza, seasonal, injectable", system: "CVX" }),
  Object.freeze({ code: "21", text: "Varicella", system: "CVX" }),
]);
