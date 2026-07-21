/**
 * `@cosyte/synth/hl7` — the HL7 v2 generation surface, exposed as its own subpath so importing the
 * package root does **not** pull `@cosyte/hl7`. This is the **lazy, per-format** boundary the roadmap
 * mandates (roadmap §1 "optional peer-dep, lazily loaded per format"): a consumer who only needs HL7
 * fixtures imports `@cosyte/synth/hl7`; one who needs only the core primitives never loads a parser.
 * `@cosyte/hl7` is an **optional peer dependency** — present only for this subpath.
 *
 * @module
 */

import { createRng } from "../rng/rng.js";
import { makeCorpus, type Corpus } from "../corpus.js";

import { generateAdt, type AdtTrigger } from "./adt.js";
import { roundTrip } from "./round-trip.js";

export { generateAdt, type AdtTrigger, type GenerateAdtOptions } from "./adt.js";
export { roundTrip, type RoundTripResult } from "./round-trip.js";
export { componentsField } from "./field.js";

/** Options for {@link hl7Corpus}. */
export interface Hl7CorpusOptions {
  /** The seed for the whole corpus (deterministic). */
  readonly seed: number;
  /** How many messages to generate. Defaults to `1`. */
  readonly count?: number;
  /** The ADT triggers to cycle through. Defaults to all of `A01`/`A04`/`A08`. */
  readonly triggers?: readonly AdtTrigger[];
}

/**
 * Build a reproducible {@link Corpus} of spec-clean HL7 `ADT` messages. Each message is generated from
 * a distinct sub-seed derived from the corpus seed (so the set is deterministic) and round-tripped
 * through `@cosyte/hl7`; the per-artifact `warnings` record the parser's verdict.
 *
 * @param options - Seed, count, and triggers. See {@link Hl7CorpusOptions}.
 * @returns A deep-frozen {@link Corpus}.
 * @example
 * ```ts
 * import { hl7Corpus } from "@cosyte/synth/hl7";
 * const corpus = hl7Corpus({ seed: 42, count: 6 });
 * corpus.artifacts.every((a) => a.warnings.length === 0); // true — spec-clean
 * ```
 */
export function hl7Corpus(options: Hl7CorpusOptions): Corpus {
  const { seed, count = 1 } = options;
  const triggers = options.triggers ?? (["A01", "A04", "A08"] as const);
  // A seed stream derives one deterministic per-message seed from the corpus seed.
  const seedStream = createRng(seed);
  const artifacts = Array.from({ length: count }, (_unused, i) => {
    const trigger = triggers[i % triggers.length] ?? "A01";
    const messageSeed = seedStream.nextUint32();
    const msg = generateAdt({ seed: messageSeed, trigger });
    const rt = roundTrip(msg);
    return {
      format: "hl7v2" as const,
      kind: `ADT^${trigger}`,
      content: rt.content,
      warnings: rt.warnings,
    };
  });
  return makeCorpus(seed, artifacts);
}
