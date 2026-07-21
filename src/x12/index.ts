/**
 * `@cosyte/synth/x12` — the X12 EDI generation surface, exposed as its own subpath so importing the
 * package root does **not** pull `@cosyte/x12`. This is the **lazy, per-format** boundary the roadmap
 * mandates (roadmap §1 "optional peer-dep, lazily loaded per format"): a consumer who only needs X12
 * fixtures imports `@cosyte/synth/x12`; one who needs only the core primitives never loads a parser.
 * `@cosyte/x12` is an **optional peer dependency** — present only for this subpath.
 *
 * SYNTH-6 (roadmap §Phase 5) ships spec-clean HIPAA 005010 generation via `@cosyte/x12`'s domain
 * builders: **837P/I/D** claims (`generate837P`/`generate837I`/`generate837D`), the **835** remittance
 * (`generate835`), and the **271** eligibility response (`generate271`) — each built through the
 * parser's own builder so the ISA/GS/ST…SE/GE/IEA envelope and every segment are spec-clean by
 * construction, each round-tripping through `@cosyte/x12` with zero warnings, and each drawing every
 * subscriber/patient/provider identifier from the synthetic-safety providers (roadmap §4).
 *
 * **Deferred (coverage tracks the builder — roadmap §3):** the **270** request (`@cosyte/x12` ships no
 * `build270`) and **quirk mode** (Phase 7 / SYNTH-7). Both are noted in the README + CHANGELOG.
 *
 * @module
 */

import { createRng } from "../rng/rng.js";
import { makeCorpus, type Corpus } from "../corpus.js";

import { generate837, type Claim837Variant } from "./claim-837.js";
import { generate835 } from "./remit-835.js";
import { generate271 } from "./eligibility-271.js";
import { roundTrip } from "./round-trip.js";

export {
  generate837,
  generate837P,
  generate837I,
  generate837D,
  type Claim837Variant,
  type Generate837Options,
} from "./claim-837.js";
export { generate835, type Generate835Options } from "./remit-835.js";
export { generate271, type Generate271Options } from "./eligibility-271.js";
export { roundTrip, type RoundTripResult } from "./round-trip.js";
export { dec, money } from "./money.js";
export {
  x12Person,
  x12Organization,
  x12ProviderPerson,
  x12Payer,
  x12TradingPartners,
  x12EnvelopeTiming,
  type X12Person,
  type X12Organization,
  type X12Payer,
  type X12TradingPartners,
  type X12EnvelopeTiming,
} from "./identity.js";
export {
  PROFESSIONAL_PROCEDURES,
  INSTITUTIONAL_PROCEDURES,
  DENTAL_PROCEDURES,
  REVENUE_CODES,
  DIAGNOSES,
  PLACES_OF_SERVICE,
  PROCEDURE_MODIFIERS,
  CARC_CODES,
  SERVICE_TYPE_CODES,
  TOOTH_CODES,
  TOOTH_SURFACES,
  type X12ExampleCode,
} from "./example-codes.js";

/** Every X12 transaction kind {@link x12Corpus} generates — the label used as the corpus `kind`. */
export type X12CorpusKind = "837P" | "837I" | "837D" | "835" | "271";

/** The default transaction mix for {@link x12Corpus} — one of each shipped transaction. */
const DEFAULT_MIX: readonly X12CorpusKind[] = Object.freeze(["837P", "837I", "837D", "835", "271"]);

/** Options for {@link x12Corpus}. */
export interface X12CorpusOptions {
  /** The seed for the whole corpus (deterministic). */
  readonly seed: number;
  /** How many transactions to generate. Defaults to the length of the mix. */
  readonly count?: number;
  /** The transaction kinds to cycle through. Defaults to one of each. */
  readonly mix?: readonly X12CorpusKind[];
}

/** Generate one interchange of the given kind from a sub-seed, returning the round-trip verdict. */
function generateKind(kind: X12CorpusKind, seed: number): ReturnType<typeof roundTrip> {
  if (kind === "835") return roundTrip(generate835({ seed }));
  if (kind === "271") return roundTrip(generate271({ seed }));
  const variant: Claim837Variant = kind === "837I" ? "I" : kind === "837D" ? "D" : "P";
  return roundTrip(generate837(variant, { seed }));
}

/**
 * Build a reproducible {@link Corpus} of spec-clean X12 transactions. Each transaction is generated from
 * a distinct sub-seed derived from the corpus seed (so the set is deterministic) and round-tripped
 * through `@cosyte/x12`; the per-artifact `warnings` record the parser's verdict (empty ⇒ spec-clean).
 *
 * @param options - Seed, count, and the transaction mix. See {@link X12CorpusOptions}.
 * @returns A deep-frozen {@link Corpus}.
 * @example
 * ```ts
 * import { x12Corpus } from "@cosyte/synth/x12";
 * const corpus = x12Corpus({ seed: 42 });
 * corpus.artifacts.every((a) => a.warnings.length === 0); // true — spec-clean
 * ```
 */
export function x12Corpus(options: X12CorpusOptions): Corpus {
  const { seed, mix = DEFAULT_MIX } = options;
  const count = options.count ?? mix.length;
  const seedStream = createRng(seed);
  const artifacts = Array.from({ length: count }, (_unused, i) => {
    const kind = mix[i % mix.length] ?? "837P";
    const txSeed = seedStream.nextUint32();
    const rt = generateKind(kind, txSeed);
    return {
      format: "x12" as const,
      kind,
      content: rt.content,
      warnings: rt.warnings,
    };
  });
  return makeCorpus(seed, artifacts);
}
