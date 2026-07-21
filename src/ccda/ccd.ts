/**
 * Synthetic **C-CDA document generation** (roadmap §Phase 4) — a spec-clean Continuity of Care Document
 * (CCD) or Referral Note built **through `@cosyte/ccda`'s `buildCcda`**, so template IDs, LOINC section
 * codes, and structured/narrative agreement are the builder's own (spec-clean *by construction*), and
 * every `recordTarget` / clinical identifier is drawn from the synthetic-safety providers (roadmap §4).
 *
 * The document round-trips through `parseCcda` with **zero warnings** — the builder's round-trip-by-
 * construction guarantee, re-verified independently by {@link ./round-trip.roundTrip}. Coverage tracks
 * `buildCcda`'s section/doc-type maturity (roadmap §Phase 4): the CCD SHALL sections (Problems,
 * Allergies, Medications, Results, Vital Signs) plus Immunizations, Procedures, and Social History
 * (Smoking Status). Clinical *content* is drawn from the reused, license-clean example-code pools; a
 * `synth` document exercises the parser, it is **not** a clinically-coherent record (roadmap §2 — a
 * format generator, not Synthea).
 *
 * @module
 */

import { buildCcda, type BuildCcdaInit, type CcdaDocument } from "@cosyte/ccda";

import { createRng, type Rng } from "../rng/rng.js";
import { safe } from "../safe/index.js";

import {
  ALLERGENS,
  ALLERGY_REACTIONS,
  LAB_RESULTS,
  MEDICATIONS,
  PROBLEMS,
  PROCEDURES,
  RESULT_PANELS,
  ROUTES,
  SMOKING_STATUSES,
  VACCINES,
  VITAL_SIGNS,
  quantityFor,
  toBuildCode,
} from "./example-codes.js";
import { ccdaPatientIdentity } from "./identity.js";

/** The C-CDA document type a generator emits — the two `buildCcda` supports (roadmap §Phase 4). */
export type CcdaDocumentType = "ccd" | "referralNote";

/** Options common to every C-CDA generator. */
export interface GenerateCcdaOptions {
  /** The seed (deterministic — same seed yields a byte-identical document). Defaults to `0`. */
  readonly seed?: number;
  /** The document type to emit. Defaults to `"ccd"`. */
  readonly documentType?: CcdaDocumentType;
}

/** Pick `n` **distinct** items from a pool (`n` clamped to the pool size) using the seeded generator. */
function pickN<T>(rng: Rng, pool: readonly T[], n: number): T[] {
  const take = Math.min(n, pool.length);
  const indices = pool.map((_v, i) => i);
  const out: T[] = [];
  for (let i = 0; i < take; i += 1) {
    const j = rng.int(0, indices.length - 1);
    // `j` is in `[0, indices.length-1]` on a non-empty array, so `indices[j]` and `pool[idx]` are
    // never holes; the casts discharge `noUncheckedIndexedAccess`'s `| undefined` with no runtime
    // re-check (mirroring `Rng.pick`).
    const idx = indices[j] as number;
    indices.splice(j, 1);
    out.push(pool[idx] as T);
  }
  return out;
}

/**
 * Assemble the synthetic {@link BuildCcdaInit} — the identity + clinical content the builder turns into
 * a spec-clean document. Section counts vary with the seed (each SHALL clinical section is always
 * non-empty; the optional sections are always populated for a rich fixture), and every code is drawn
 * from the reused example-code pools.
 */
function buildInit(rng: Rng, documentType: CcdaDocumentType): BuildCcdaInit {
  const effectiveTime = safe.dateYmd(rng, 2020, 2025);
  const { patient, person } = ccdaPatientIdentity(rng);

  const problems = pickN(rng, PROBLEMS, rng.int(1, 3)).map((c) => ({
    problem: toBuildCode(c),
    status: "active" as const,
    onset: safe.dateYmd(rng, 2010, 2019),
  }));

  const allergen = rng.pick(ALLERGENS);
  const reaction = rng.pick(ALLERGY_REACTIONS);
  const allergies = [{ allergen: toBuildCode(allergen), reaction: toBuildCode(reaction) }];

  const medications = pickN(rng, MEDICATIONS, rng.int(1, 2)).map((c) => ({
    drug: toBuildCode(c),
    dose: { value: 1, unit: "{tablet}" },
    route: rng.pick(ROUTES),
    frequency: { value: rng.pick([8, 12, 24]), unit: "h" },
  }));

  const panel = rng.pick(RESULT_PANELS);
  const resultMembers = pickN(rng, LAB_RESULTS, 2).map((q) => ({
    test: toBuildCode(q),
    quantity: quantityFor(rng, q),
    effectiveTime,
  }));
  const results = [{ code: toBuildCode(panel), effectiveTime, results: resultMembers }];

  const vitalMembers = pickN(rng, VITAL_SIGNS, 2).map((q) => ({
    code: toBuildCode(q),
    quantity: quantityFor(rng, q),
  }));
  const vitalSigns = [{ effectiveTime, vitals: vitalMembers }];

  const vaccine = rng.pick(VACCINES);
  const immunizations = [
    {
      vaccine: toBuildCode(vaccine),
      dose: { value: 0.5, unit: "mL" },
      route: rng.pick(ROUTES),
      effectiveTime: safe.dateYmd(rng, 2018, 2024),
    },
  ];

  const procedure = rng.pick(PROCEDURES);
  const procedures = [
    {
      code: toBuildCode(procedure),
      disposition: "performed" as const,
      effectiveTime: safe.dateYmd(rng, 2015, 2023),
    },
  ];

  const smokingStatus = [{ value: rng.pick(SMOKING_STATUSES), effectiveTime }];

  const base: BuildCcdaInit = {
    documentType,
    effectiveTime,
    patient,
    problems,
    allergies,
    medications,
    results,
    vitalSigns,
    immunizations,
    procedures,
    smokingStatus,
  };

  if (documentType === "referralNote") {
    // The Referral Note's narrative-only SHALL sections — synthetic free text (never fabricated
    // clinical judgment about a real person; the "patient" does not exist).
    return {
      ...base,
      reasonForReferral: `Synthetic referral for evaluation of ${person.given} ${person.family}.`,
      assessment: "Synthetic assessment narrative. Not a real clinical assessment.",
    };
  }
  return base;
}

/**
 * Generate a spec-clean synthetic C-CDA document (CCD by default, or Referral Note), built through
 * `@cosyte/ccda`'s `buildCcda`. The returned {@link CcdaDocument} round-trips through `parseCcda` with
 * zero warnings, and the same seed yields a byte-identical document.
 *
 * @param options - Seed and document type. See {@link GenerateCcdaOptions}.
 * @returns The `@cosyte/ccda` `CcdaDocument` (serialize via `serializeCcda(doc)` or `doc.toString()`).
 * @example
 * ```ts
 * import { generateCcda } from "@cosyte/synth/ccda";
 * import { serializeCcda } from "@cosyte/ccda";
 * const xml = serializeCcda(generateCcda({ seed: 42 }));
 * ```
 */
export function generateCcda(options: GenerateCcdaOptions = {}): CcdaDocument {
  const { seed = 0, documentType = "ccd" } = options;
  const rng = createRng(seed);
  return buildCcda(buildInit(rng, documentType));
}

/**
 * Generate a spec-clean synthetic **Continuity of Care Document (CCD)**.
 *
 * @param options - Seed (deterministic). See {@link GenerateCcdaOptions}.
 * @returns The `CcdaDocument`.
 * @example
 * ```ts
 * import { generateCcd, roundTrip } from "@cosyte/synth/ccda";
 * roundTrip(generateCcd({ seed: 1 })).specClean; // true
 * ```
 */
export function generateCcd(options: Omit<GenerateCcdaOptions, "documentType"> = {}): CcdaDocument {
  return generateCcda({ ...options, documentType: "ccd" });
}

/**
 * Generate a spec-clean synthetic **Referral Note** — the second document type `buildCcda` supports,
 * with its own US Realm Header specialization and Reason-for-Referral / Assessment narrative sections.
 *
 * @param options - Seed (deterministic). See {@link GenerateCcdaOptions}.
 * @returns The `CcdaDocument`.
 * @example
 * ```ts
 * import { generateReferralNote } from "@cosyte/synth/ccda";
 * generateReferralNote({ seed: 1 }).documentType; // "referralNote"
 * ```
 */
export function generateReferralNote(
  options: Omit<GenerateCcdaOptions, "documentType"> = {},
): CcdaDocument {
  return generateCcda({ ...options, documentType: "referralNote" });
}
