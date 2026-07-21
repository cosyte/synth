/**
 * `@cosyte/synth/ccda` — the C-CDA generation surface, exposed as its own subpath so importing the
 * package root does **not** pull `@cosyte/ccda`. This is the **lazy, per-format** boundary the roadmap
 * mandates (roadmap §1 "optional peer-dep, lazily loaded per format"): a consumer who only needs C-CDA
 * fixtures imports `@cosyte/synth/ccda`; one who needs only the core primitives never loads a parser.
 * `@cosyte/ccda` is an **optional peer dependency** — present only for this subpath.
 *
 * SYNTH-5 (roadmap §Phase 4) ships spec-clean C-CDA document generation via `@cosyte/ccda`'s
 * `buildCcda`: a **CCD** (`generateCcd`) and a **Referral Note** (`generateReferralNote`), each built
 * through the parser's own emitter so it round-trips through `parseCcda` with zero warnings, and each
 * drawing every identity value from the synthetic-safety providers (roadmap §4). Quirk generation is
 * deferred to Phase 7.
 *
 * @module
 */

import { createRng } from "../rng/rng.js";
import { makeCorpus, type Corpus } from "../corpus.js";

import { generateCcda, type CcdaDocumentType } from "./ccd.js";
import { roundTrip } from "./round-trip.js";

export {
  generateCcda,
  generateCcd,
  generateReferralNote,
  type CcdaDocumentType,
  type GenerateCcdaOptions,
} from "./ccd.js";
export { roundTrip, type RoundTripResult } from "./round-trip.js";
export { ccdaPatientIdentity, type CcdaPatientIdentity } from "./identity.js";
export {
  toBuildCode,
  quantityFor,
  PROBLEMS,
  ALLERGENS,
  ALLERGY_REACTIONS,
  MEDICATIONS,
  LAB_RESULTS,
  RESULT_PANELS,
  VITAL_SIGNS,
  VACCINES,
  PROCEDURES,
  SMOKING_STATUSES,
  ROUTES,
} from "./example-codes.js";
export {
  generateCcdaQuirk,
  injectCcdaQuirk,
  ccdaQuirkRoundTrip,
  ccdaQuirkCorpus,
  ccdaQuirkProfile,
  CCDA_QUIRKS,
  type CcdaQuirkName,
  type GenerateCcdaQuirkOptions,
  type CcdaQuirkCorpusOptions,
} from "./quirk.js";

/** Every C-CDA document kind {@link ccdaCorpus} generates — the `documentType` used as the corpus `kind`. */
export type CcdaCorpusKind = CcdaDocumentType;

/** The default document mix for {@link ccdaCorpus} — one CCD and one Referral Note. */
const DEFAULT_MIX: readonly CcdaCorpusKind[] = Object.freeze(["ccd", "referralNote"]);

/** Options for {@link ccdaCorpus}. */
export interface CcdaCorpusOptions {
  /** The seed for the whole corpus (deterministic). */
  readonly seed: number;
  /** How many documents to generate. Defaults to `1`. */
  readonly count?: number;
  /** The document types to cycle through. Defaults to one CCD + one Referral Note. */
  readonly mix?: readonly CcdaCorpusKind[];
}

/**
 * Build a reproducible {@link Corpus} of spec-clean C-CDA documents. Each document is generated from a
 * distinct sub-seed derived from the corpus seed (so the set is deterministic) and round-tripped through
 * `@cosyte/ccda`; the per-artifact `warnings` record the parser's verdict (empty ⇒ spec-clean).
 *
 * @param options - Seed, count, and the document mix. See {@link CcdaCorpusOptions}.
 * @returns A deep-frozen {@link Corpus}.
 * @example
 * ```ts
 * import { ccdaCorpus } from "@cosyte/synth/ccda";
 * const corpus = ccdaCorpus({ seed: 42, count: 4 });
 * corpus.artifacts.every((a) => a.warnings.length === 0); // true — spec-clean
 * ```
 */
export function ccdaCorpus(options: CcdaCorpusOptions): Corpus {
  const { seed, count = 1, mix = DEFAULT_MIX } = options;
  const seedStream = createRng(seed);
  const artifacts = Array.from({ length: count }, (_unused, i) => {
    const documentType = mix[i % mix.length] ?? "ccd";
    const docSeed = seedStream.nextUint32();
    const rt = roundTrip(generateCcda({ seed: docSeed, documentType }));
    return {
      format: "ccda" as const,
      kind: documentType,
      content: rt.content,
      warnings: rt.warnings,
    };
  });
  return makeCorpus(seed, artifacts);
}
