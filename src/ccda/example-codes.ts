/**
 * The C-CDA example-code pool — a thin adapter that **reuses** the same license-clean, public
 * code facts the FHIR generators ship (`../fhir/example-codes.ts`), reshaped into `@cosyte/ccda`'s
 * `BuildCode` tuple (an OID `codeSystem` instead of a FHIR `system` URI). Reusing one source of truth
 * keeps the LOINC / RxNorm / SNOMED / CVX pools consistent across the FHIR and C-CDA surfaces (roadmap
 * §Phase 4 "reuse the existing example-code pools where they apply"); `@cosyte/synth` still bundles
 * **no** terminology content — these are public spec-example codes, not copyrighted tables (roadmap §2).
 *
 * Nothing here is PHI: codes and their display text are not patient identifiers. The synthetic-safety
 * invariant governs identity fields (name / DOB / MRN / telecom), which come from `../safe`.
 *
 * @module
 */

import { CVX, LOINC, NCI_ROUTE, RXNORM, SNOMED_CT } from "@cosyte/ccda";
import type { BuildCode, BuildQuantity } from "@cosyte/ccda";

import type { Rng } from "../rng/rng.js";
import {
  EXAMPLE_ALLERGENS,
  EXAMPLE_ALLERGY_MANIFESTATIONS,
  EXAMPLE_CONDITIONS,
  EXAMPLE_DIAGNOSTIC_REPORTS,
  EXAMPLE_LAB_OBSERVATIONS,
  EXAMPLE_MEDICATIONS,
  EXAMPLE_PROCEDURES,
  EXAMPLE_VACCINES,
  EXAMPLE_VITAL_SIGNS,
  type CodeConcept,
  type QuantConcept,
} from "../fhir/example-codes.js";

/** Map a FHIR code-system `system` URI to the C-CDA OID `@cosyte/ccda` expects. */
const URI_TO_OID: Readonly<Record<string, string>> = Object.freeze({
  "http://loinc.org": LOINC,
  "http://snomed.info/sct": SNOMED_CT,
  "http://www.nlm.nih.gov/research/umls/rxnorm": RXNORM,
  "http://hl7.org/fhir/sid/cvx": CVX,
});

/**
 * Adapt a FHIR {@link CodeConcept} to a `@cosyte/ccda` {@link BuildCode}, resolving its `system` URI to
 * the matching OID. The `codeSystem` is always set explicitly (never left to a per-slot default), so a
 * SNOMED allergen or a LOINC panel carries the right OID regardless of which builder slot consumes it.
 *
 * @param concept - The FHIR-shaped `{ system, code, display }` concept.
 * @returns The `@cosyte/ccda` `BuildCode`.
 * @throws {Error} When the concept's `system` URI has no known OID mapping.
 * @example
 * ```ts
 * import { toBuildCode } from "@cosyte/synth/ccda";
 * // toBuildCode({ system: "http://snomed.info/sct", code: "59621000", display: "Essential hypertension" });
 * ```
 */
export function toBuildCode(concept: CodeConcept): BuildCode {
  const codeSystem = URI_TO_OID[concept.system];
  if (codeSystem === undefined) {
    throw new Error(`ccda example-codes: no OID mapping for code system "${concept.system}"`);
  }
  return { code: concept.code, codeSystem, displayName: concept.display };
}

/**
 * Draw a synthetic-but-structurally-sane {@link BuildQuantity} for a quantitative concept — a value in
 * the concept's plausible band (from the seeded generator, so reproducible) rendered to the concept's
 * decimal precision, with its UCUM unit. The value implies **no** real measurement (roadmap §4.3).
 *
 * @param rng - The seeded generator.
 * @param concept - The quantitative concept (LOINC code + UCUM unit + value band).
 * @returns A `BuildQuantity` (`{ value, unit }`) for the C-CDA builder.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { quantityFor, LAB_RESULTS } from "@cosyte/synth/ccda";
 * // quantityFor(createRng(1), LAB_RESULTS[0]);
 * ```
 */
export function quantityFor(rng: Rng, concept: QuantConcept): BuildQuantity {
  const scale = 10 ** concept.decimals;
  const value = rng.int(concept.low * scale, concept.high * scale) / scale;
  return { value, unit: concept.unit };
}

/** SNOMED CT problem/condition example codes (Problems / Past Medical History). */
export const PROBLEMS: readonly CodeConcept[] = EXAMPLE_CONDITIONS;
/** RxNorm / SNOMED CT allergen example codes (Allergies). */
export const ALLERGENS: readonly CodeConcept[] = EXAMPLE_ALLERGENS;
/** SNOMED CT allergy-reaction manifestation example codes. */
export const ALLERGY_REACTIONS: readonly CodeConcept[] = EXAMPLE_ALLERGY_MANIFESTATIONS;
/** RxNorm medication example codes (Medications). */
export const MEDICATIONS: readonly CodeConcept[] = EXAMPLE_MEDICATIONS;
/** LOINC laboratory-result example codes with UCUM units + value bands (Results members). */
export const LAB_RESULTS: readonly QuantConcept[] = EXAMPLE_LAB_OBSERVATIONS;
/** LOINC panel example codes (the Result Organizer `code`). */
export const RESULT_PANELS: readonly CodeConcept[] = EXAMPLE_DIAGNOSTIC_REPORTS;
/** LOINC vital-sign example codes with UCUM units + value bands (Vital Signs members). */
export const VITAL_SIGNS: readonly QuantConcept[] = EXAMPLE_VITAL_SIGNS;
/** CVX vaccine example codes (Immunizations). */
export const VACCINES: readonly CodeConcept[] = EXAMPLE_VACCINES;
/** SNOMED CT procedure example codes (Procedures). */
export const PROCEDURES: readonly CodeConcept[] = EXAMPLE_PROCEDURES;

/**
 * SNOMED CT Current Smoking Status value-set example codes (Social History). Public SNOMED CT
 * identifiers used as structural fillers; `@cosyte/synth` bundles no SNOMED content.
 */
export const SMOKING_STATUSES: readonly BuildCode[] = Object.freeze([
  Object.freeze({ code: "266919005", codeSystem: SNOMED_CT, displayName: "Never smoker" }),
  Object.freeze({ code: "8517006", codeSystem: SNOMED_CT, displayName: "Former smoker" }),
  Object.freeze({
    code: "449868002",
    codeSystem: SNOMED_CT,
    displayName: "Current every day smoker",
  }),
  Object.freeze({
    code: "428041000124106",
    codeSystem: SNOMED_CT,
    displayName: "Current some day smoker",
  }),
]);

/**
 * NCI Thesaurus administration-route example codes (Medications / Immunizations `route`). Public NCI
 * concept ids used as structural fillers.
 */
export const ROUTES: readonly BuildCode[] = Object.freeze([
  Object.freeze({ code: "C38288", codeSystem: NCI_ROUTE, displayName: "Oral" }),
  Object.freeze({ code: "C28161", codeSystem: NCI_ROUTE, displayName: "Intramuscular" }),
  Object.freeze({ code: "C38276", codeSystem: NCI_ROUTE, displayName: "Intravenous" }),
  Object.freeze({ code: "C38299", codeSystem: NCI_ROUTE, displayName: "Subcutaneous" }),
]);
