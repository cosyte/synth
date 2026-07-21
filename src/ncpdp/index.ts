/**
 * `@cosyte/synth/ncpdp` — the NCPDP generation surface, exposed as its own subpath so importing the
 * package root does **not** pull `@cosyte/ncpdp`. This is the **lazy, per-format** boundary the roadmap
 * mandates (roadmap §1 "optional peer-dep, lazily loaded per format"): a consumer who only needs NCPDP
 * fixtures imports `@cosyte/synth/ncpdp`; one who needs only the core primitives never loads a parser.
 * `@cosyte/ncpdp` is an **optional peer dependency** — present only for this subpath.
 *
 * SYNTH-7 (roadmap §Phase 6, the NCPDP arm) ships spec-clean generation across both NCPDP standards,
 * each built through `@cosyte/ncpdp`'s own emit surface:
 *
 * - **SCRIPT** ePrescribing (`@cosyte/ncpdp/script`): `generateNewRx` (via the validated `buildNewRx`
 *   builder), `generateRxRenewalRequest`, and `generateRxChangeRequest` (via the parser's public typed
 *   `ScriptMessage` model + `serializeScript`) — each round-tripping through `parseScript` with zero
 *   warnings, and carrying a prescriber whose NPI is invalid-Luhn and whose **DEA is invalid-checksum**.
 * - **Telecom** claims (`@cosyte/ncpdp/telecom`): `generateB1` (billing), `generateB2` (reversal), and
 *   `generateB3` (rebill) via `buildTelecomRequest` + `serializeTelecom` — each round-tripping through
 *   `parseTelecom` with zero warnings, with patient / cardholder identity from the synthetic providers.
 *
 * **Deferred (roadmap §Phase 6 / §3):** **ASTM** generation (gated on `@cosyte/astm`'s serializer,
 * `ASTM-7`, not yet shipped — SYNTH-8) and **quirk mode** (Phase 7). Both are noted in the README +
 * CHANGELOG. SCRIPT is limited to the transactions `@cosyte/ncpdp` can *build* — NewRx plus the
 * renewal/change **requests**; the renewal/change *responses* and the reversal cases beyond B2's
 * reference set track the parser's builder surface, never hand-written bytes (roadmap §3).
 *
 * @module
 */

import { createRng } from "../rng/rng.js";
import { makeCorpus, type Corpus } from "../corpus.js";

import { generateNewRx, generateRxRenewalRequest, generateRxChangeRequest } from "./script.js";
import { generateTelecom } from "./telecom.js";
import { scriptRoundTrip, telecomRoundTrip } from "./round-trip.js";

export {
  generateNewRx,
  generateRxRenewalRequest,
  generateRxChangeRequest,
  type GenerateScriptOptions,
} from "./script.js";
export {
  generateTelecom,
  generateB1,
  generateB2,
  generateB3,
  type TelecomTransactionCode,
  type GenerateTelecomOptions,
} from "./telecom.js";
export { scriptRoundTrip, telecomRoundTrip, type RoundTripResult } from "./round-trip.js";
export {
  ncpdpPatient,
  ncpdpPrescriber,
  ncpdpPharmacy,
  ncpdpCardholder,
  ncpdpScriptRouting,
  type NcpdpPatient,
  type NcpdpPrescriber,
  type NcpdpPharmacy,
  type NcpdpCardholder,
  type NcpdpScriptRouting,
} from "./identity.js";
export {
  EXAMPLE_DRUGS,
  EXAMPLE_SIG_TEXT,
  DAW_CODES,
  type NcpdpExampleDrug,
} from "./example-codes.js";

/** Every NCPDP transaction kind {@link ncpdpCorpus} generates — the label used as the corpus `kind`. */
export type NcpdpCorpusKind = "NewRx" | "RxRenewalRequest" | "RxChangeRequest" | "B1" | "B2" | "B3";

/** The default transaction mix for {@link ncpdpCorpus} — one of each shipped transaction. */
const DEFAULT_MIX: readonly NcpdpCorpusKind[] = Object.freeze([
  "NewRx",
  "RxRenewalRequest",
  "RxChangeRequest",
  "B1",
  "B2",
  "B3",
]);

/** Generate one transaction of the given kind from a sub-seed, returning the round-trip verdict. */
function generateKind(kind: NcpdpCorpusKind, seed: number): ReturnType<typeof scriptRoundTrip> {
  switch (kind) {
    case "NewRx":
      return scriptRoundTrip(generateNewRx({ seed }));
    case "RxRenewalRequest":
      return scriptRoundTrip(generateRxRenewalRequest({ seed }));
    case "RxChangeRequest":
      return scriptRoundTrip(generateRxChangeRequest({ seed }));
    case "B1":
    case "B2":
    case "B3":
      return telecomRoundTrip(generateTelecom(kind, { seed }));
  }
}

/** Options for {@link ncpdpCorpus}. */
export interface NcpdpCorpusOptions {
  /** The seed for the whole corpus (deterministic). */
  readonly seed: number;
  /** How many transactions to generate. Defaults to the length of the mix. */
  readonly count?: number;
  /** The transaction kinds to cycle through. Defaults to one of each. */
  readonly mix?: readonly NcpdpCorpusKind[];
}

/**
 * Build a reproducible {@link Corpus} of spec-clean NCPDP transactions. Each transaction is generated
 * from a distinct sub-seed derived from the corpus seed (so the set is deterministic) and round-tripped
 * through `@cosyte/ncpdp`; the per-artifact `warnings` record the parser's verdict (empty ⇒ spec-clean).
 *
 * @param options - Seed, count, and the transaction mix. See {@link NcpdpCorpusOptions}.
 * @returns A deep-frozen {@link Corpus}.
 * @example
 * ```ts
 * import { ncpdpCorpus } from "@cosyte/synth/ncpdp";
 * const corpus = ncpdpCorpus({ seed: 42 });
 * corpus.artifacts.every((a) => a.warnings.length === 0); // true — spec-clean
 * ```
 */
export function ncpdpCorpus(options: NcpdpCorpusOptions): Corpus {
  const { seed, mix = DEFAULT_MIX } = options;
  const count = options.count ?? mix.length;
  const seedStream = createRng(seed);
  const artifacts = Array.from({ length: count }, (_unused, i) => {
    const kind = mix[i % mix.length] ?? "NewRx";
    const txSeed = seedStream.nextUint32();
    const rt = generateKind(kind, txSeed);
    return {
      format: "ncpdp" as const,
      kind,
      content: rt.content,
      warnings: rt.warnings,
    };
  });
  return makeCorpus(seed, artifacts);
}
