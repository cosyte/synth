/**
 * `@cosyte/synth/astm` — the ASTM generation surface, exposed as its own subpath so importing the
 * package root does **not** pull `@cosyte/astm`. This is the **lazy, per-format** boundary the roadmap
 * mandates (roadmap §1 "optional peer-dep, lazily loaded per format"): a consumer who only needs ASTM
 * fixtures imports `@cosyte/synth/astm`; one who needs only the core primitives never loads a parser.
 * `@cosyte/astm` is an **optional peer dependency** — present only for this subpath.
 *
 * SYNTH-8 (roadmap §Phase 6, the ASTM arm — unblocked once `@cosyte/astm`'s serializer/builder shipped
 * with `ASTM-7`) ships spec-clean generation of the E1394 record report and its E1381 framed twin, each
 * built through `@cosyte/astm`'s own emit surface:
 *
 * - **Records (E1394):** `generateAstmResult` (`H`/`P`/`O`/`R`…/`C`/`L`) and `generateAstmOrder`
 *   (`H`/`P`/`O`/`L`) via `buildAstmMessage` — each round-tripping through `parseAstmRecords` with zero
 *   warnings and byte-stable, and carrying a `P` record whose name / DOB / practice+lab IDs are all
 *   synthetic-by-construction (roadmap §4). The practice- and laboratory-assigned patient IDs are
 *   minted independently, so they stay **distinct**.
 * - **Framing (E1381):** `generateAstmResultFramed` via `composeAstmFrames` — the modulo-256 checksum
 *   and the `0`–`7` frame number are **computed by the parser, never faked**, and the bytes round-trip
 *   through `parseFramedAstm` with zero frame **and** record warnings.
 *
 * **Deferred (roadmap §Phase 7+):** quirk mode (lowercase ASTM checksum, framing-dropped-over-TCP, and
 * the other tolerances `@cosyte/astm`'s profile system advertises) is a later phase, noted in the README
 * + CHANGELOG. The spec-clean generation core is now feature-complete across all six formats.
 *
 * @module
 */

import { createRng } from "../rng/rng.js";
import { makeCorpus, type Corpus } from "../corpus.js";

import { generateAstmResult, generateAstmOrder } from "./message.js";
import { astmRoundTrip } from "./round-trip.js";

export {
  generateAstmResult,
  generateAstmOrder,
  generateAstmResultFramed,
  type GenerateAstmOptions,
} from "./message.js";
export { astmRoundTrip, astmFramedRoundTrip, type AstmRoundTripResult } from "./round-trip.js";
export {
  astmPatient,
  astmOrder,
  astmHeaderIdentity,
  type AstmPatient,
  type AstmOrder,
  type AstmHeaderIdentity,
} from "./identity.js";
export {
  EXAMPLE_ASTM_TESTS,
  ASTM_ABNORMAL_FLAGS,
  ASTM_RESULT_STATUSES,
  ASTM_COMMENT_TEXT,
  type AstmExampleTest,
} from "./example-codes.js";
export {
  generateAstmQuirk,
  astmQuirkRoundTrip,
  astmQuirkCorpus,
  astmQuirkProfile,
  ASTM_QUIRKS,
  type AstmQuirkName,
  type AstmQuirkKind,
  type GenerateAstmQuirkOptions,
  type AstmQuirkCorpusOptions,
} from "./quirk.js";

/** Every ASTM message kind {@link astmCorpus} generates — the label used as the corpus `kind`. */
export type AstmCorpusKind = "Result" | "Order";

/** The default message mix for {@link astmCorpus} — a result report and an order. */
const DEFAULT_MIX: readonly AstmCorpusKind[] = Object.freeze(["Result", "Order"]);

/** Generate one message of the given kind from a sub-seed, returning the round-trip verdict. */
function generateKind(kind: AstmCorpusKind, seed: number): ReturnType<typeof astmRoundTrip> {
  switch (kind) {
    case "Result":
      return astmRoundTrip(generateAstmResult({ seed }));
    case "Order":
      return astmRoundTrip(generateAstmOrder({ seed }));
  }
}

/** Options for {@link astmCorpus}. */
export interface AstmCorpusOptions {
  /** The seed for the whole corpus (deterministic). */
  readonly seed: number;
  /** How many messages to generate. Defaults to the length of the mix. */
  readonly count?: number;
  /** The message kinds to cycle through. Defaults to one of each. */
  readonly mix?: readonly AstmCorpusKind[];
}

/**
 * Build a reproducible {@link Corpus} of spec-clean ASTM messages. Each message is generated from a
 * distinct sub-seed derived from the corpus seed (so the set is deterministic) and round-tripped through
 * `@cosyte/astm`; the per-artifact `warnings` record the parser's verdict (empty ⇒ spec-clean).
 *
 * @param options - Seed, count, and the message mix. See {@link AstmCorpusOptions}.
 * @returns A deep-frozen {@link Corpus}.
 * @example
 * ```ts
 * import { astmCorpus } from "@cosyte/synth/astm";
 * const corpus = astmCorpus({ seed: 42 });
 * corpus.artifacts.every((a) => a.warnings.length === 0); // true — spec-clean
 * ```
 */
export function astmCorpus(options: AstmCorpusOptions): Corpus {
  const { seed, mix = DEFAULT_MIX } = options;
  const count = options.count ?? mix.length;
  const seedStream = createRng(seed);
  const artifacts = Array.from({ length: count }, (_unused, i) => {
    const kind = mix[i % mix.length] ?? "Result";
    const msgSeed = seedStream.nextUint32();
    const rt = generateKind(kind, msgSeed);
    return {
      format: "astm" as const,
      kind,
      content: rt.content,
      warnings: rt.warnings,
    };
  });
  return makeCorpus(seed, artifacts);
}
