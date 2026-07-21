/**
 * License-clean example drug + code pools for synthetic NCPDP generation. NCPDP charges for its
 * standards and is protective of their prose, so — like every other `synth` format — **no NCPDP
 * copyrighted text is bundled**: these are widely-known generic drug descriptions and invented,
 * clearly-example product codes, not lifted from any NCPDP data dictionary (roadmap §2 "no bundled
 * terminology"; the ncpdp `CLAUDE.md` standards-licensing rule).
 *
 * A drug code is **not** PHI — it names a product, never a patient — so realism here carries no
 * synthetic-safety hazard; the pool exists only to give a generated NewRx / claim a plausible,
 * license-clean drug. Patient / prescriber identity comes from the synthetic-safety providers
 * (`../safe`), never from here.
 *
 * `# synthetic: true`
 *
 * @module
 */

/** One example drug: a widely-known generic description + an invented, clearly-example NDC. */
export interface NcpdpExampleDrug {
  /** A widely-known generic drug description (RxNorm-style; public knowledge, not NCPDP prose). */
  readonly description: string;
  /** An invented 11-digit NDC (`5-4-2`, digits only) — an example product code, never a real NDC. */
  readonly ndc: string;
  /** The dispense quantity unit-of-measure qualifier hint (structural only). */
  readonly form: string;
}

/**
 * A small pool of license-clean example drugs. The NDCs use the invented labeler prefix `00000`
 * (never an FDA-assigned labeler), so they are transparently examples; the descriptions are common
 * generics anyone can name without a licensed database.
 */
export const EXAMPLE_DRUGS: readonly NcpdpExampleDrug[] = Object.freeze([
  { description: "Amoxicillin 500 MG Oral Capsule", ndc: "00000010101", form: "EA" },
  { description: "Lisinopril 10 MG Oral Tablet", ndc: "00000020202", form: "EA" },
  { description: "Atorvastatin 20 MG Oral Tablet", ndc: "00000030303", form: "EA" },
  { description: "Metformin 500 MG Oral Tablet", ndc: "00000040404", form: "EA" },
  { description: "Amlodipine 5 MG Oral Tablet", ndc: "00000050505", form: "EA" },
  { description: "Omeprazole 20 MG Delayed Release Capsule", ndc: "00000060606", form: "EA" },
  { description: "Levothyroxine 50 MCG Oral Tablet", ndc: "00000070707", form: "EA" },
  { description: "Azithromycin 250 MG Oral Tablet", ndc: "00000080808", form: "EA" },
  { description: "Sertraline 50 MG Oral Tablet", ndc: "00000090909", form: "EA" },
  { description: "Albuterol 90 MCG Metered Dose Inhaler", ndc: "00000101010", form: "EA" },
]);

/** Example free-text SIG directions (public, common-sense dosing text — not NCPDP prose). */
export const EXAMPLE_SIG_TEXT: readonly string[] = Object.freeze([
  "Take 1 tablet by mouth once daily",
  "Take 1 capsule by mouth twice daily with food",
  "Take 2 tablets by mouth every 12 hours as needed",
  "Take 1 tablet by mouth at bedtime",
  "Inhale 2 puffs by mouth every 4 to 6 hours as needed",
]);

/** Dispense-as-written / product-selection codes (single-digit, structural). */
export const DAW_CODES: readonly string[] = Object.freeze(["0", "1", "2"]);
