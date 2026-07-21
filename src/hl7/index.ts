/**
 * `@cosyte/synth/hl7` — the HL7 v2 generation surface, exposed as its own subpath so importing the
 * package root does **not** pull `@cosyte/hl7`. This is the **lazy, per-format** boundary the roadmap
 * mandates (roadmap §1 "optional peer-dep, lazily loaded per format"): a consumer who only needs HL7
 * fixtures imports `@cosyte/synth/hl7`; one who needs only the core primitives never loads a parser.
 * `@cosyte/hl7` is an **optional peer dependency** — present only for this subpath.
 *
 * Phase 2 completes the HL7 v2 message set: `ADT` (A01/A04/A08), `ORU^R01`, `ORM^O01`, `SIU^S12`, and
 * `VXU^V04` — each built through `@cosyte/hl7`'s `buildMessage` and round-tripping with zero warnings.
 *
 * @module
 */

import type { Hl7Message } from "@cosyte/hl7";

import { createRng } from "../rng/rng.js";
import { makeCorpus, type Corpus } from "../corpus.js";

import { generateAdt, type AdtTrigger } from "./adt.js";
import { generateOru } from "./oru.js";
import { generateOrm } from "./orm.js";
import { generateSiu } from "./siu.js";
import { generateVxu } from "./vxu.js";
import { roundTrip } from "./round-trip.js";

export { generateAdt, type AdtTrigger, type GenerateAdtOptions } from "./adt.js";
export { generateOru, type GenerateOruOptions } from "./oru.js";
export { generateOrm, type GenerateOrmOptions } from "./orm.js";
export { generateSiu, type GenerateSiuOptions } from "./siu.js";
export { generateVxu, type GenerateVxuOptions } from "./vxu.js";
export { roundTrip, type RoundTripResult } from "./round-trip.js";
export { componentsField } from "./field.js";
export {
  seededTimestamp,
  mshScaffold,
  patientIdentity,
  pidSegment,
  type MessageScaffold,
  type PatientIdentity,
} from "./common.js";
export {
  type ExampleCode,
  EXAMPLE_LAB_OBSERVATIONS,
  EXAMPLE_ORDER_SERVICES,
  EXAMPLE_VACCINES,
} from "./example-codes.js";
export {
  generateHl7Quirk,
  hl7QuirkRoundTrip,
  hl7QuirkCorpus,
  hl7QuirkProfile,
  HL7_QUIRKS,
  type Hl7QuirkName,
  type Hl7QuirkKind,
  type GenerateHl7QuirkOptions,
  type Hl7QuirkCorpusOptions,
} from "./quirk.js";

/**
 * Every HL7 v2 message kind Phase 2 generates — the `MSH-9` label used as the corpus `kind`. `ADT`
 * carries its trigger; the other families have a single generated trigger each.
 */
export type Hl7MessageKind =
  | "ADT^A01"
  | "ADT^A04"
  | "ADT^A08"
  | "ORU^R01"
  | "ORM^O01"
  | "SIU^S12"
  | "VXU^V04";

/** The default message mix for {@link hl7Corpus} — one of every Phase 2 family. */
const DEFAULT_MIX: readonly Hl7MessageKind[] = Object.freeze([
  "ADT^A01",
  "ADT^A04",
  "ADT^A08",
  "ORU^R01",
  "ORM^O01",
  "SIU^S12",
  "VXU^V04",
]);

/**
 * Generate one message of the given {@link Hl7MessageKind} from a seed, dispatching to the right
 * family generator. Every kind builds through `@cosyte/hl7` and is deterministic in `seed`.
 *
 * @param kind - The message kind to generate.
 * @param seed - The seed.
 * @returns The generated `Hl7Message`.
 * @example
 * ```ts
 * import { generateHl7 } from "@cosyte/synth/hl7";
 * generateHl7("ORU^R01", 42).toString();
 * ```
 */
export function generateHl7(kind: Hl7MessageKind, seed: number): Hl7Message {
  switch (kind) {
    case "ADT^A01":
      return generateAdt({ seed, trigger: "A01" });
    case "ADT^A04":
      return generateAdt({ seed, trigger: "A04" });
    case "ADT^A08":
      return generateAdt({ seed, trigger: "A08" });
    case "ORU^R01":
      return generateOru({ seed });
    case "ORM^O01":
      return generateOrm({ seed });
    case "SIU^S12":
      return generateSiu({ seed });
    case "VXU^V04":
      return generateVxu({ seed });
  }
}

/** Options for {@link hl7Corpus}. */
export interface Hl7CorpusOptions {
  /** The seed for the whole corpus (deterministic). */
  readonly seed: number;
  /** How many messages to generate. Defaults to `1`. */
  readonly count?: number;
  /**
   * The message kinds to cycle through. Defaults to one of every Phase 2 family
   * (`ADT^A01/A04/A08`, `ORU^R01`, `ORM^O01`, `SIU^S12`, `VXU^V04`).
   */
  readonly mix?: readonly Hl7MessageKind[];
  /**
   * ADT-only convenience: the triggers to cycle through, kept for back-compat with SYNTH-1. When
   * supplied it takes precedence over `mix` and restricts the corpus to `ADT` messages.
   */
  readonly triggers?: readonly AdtTrigger[];
}

/**
 * Build a reproducible {@link Corpus} of spec-clean HL7 messages across the Phase 2 families. Each
 * message is generated from a distinct sub-seed derived from the corpus seed (so the set is
 * deterministic) and round-tripped through `@cosyte/hl7`; the per-artifact `warnings` record the
 * parser's verdict (empty ⇒ spec-clean).
 *
 * @param options - Seed, count, and the message mix. See {@link Hl7CorpusOptions}.
 * @returns A deep-frozen {@link Corpus}.
 * @example
 * ```ts
 * import { hl7Corpus } from "@cosyte/synth/hl7";
 * const corpus = hl7Corpus({ seed: 42, count: 7 });
 * corpus.artifacts.every((a) => a.warnings.length === 0); // true — spec-clean
 * ```
 */
export function hl7Corpus(options: Hl7CorpusOptions): Corpus {
  const { seed, count = 1 } = options;
  const kinds: readonly Hl7MessageKind[] =
    options.triggers !== undefined
      ? options.triggers.map((t): Hl7MessageKind => `ADT^${t}`)
      : (options.mix ?? DEFAULT_MIX);
  // A seed stream derives one deterministic per-message seed from the corpus seed.
  const seedStream = createRng(seed);
  const artifacts = Array.from({ length: count }, (_unused, i) => {
    const kind = kinds[i % kinds.length] ?? "ADT^A01";
    const messageSeed = seedStream.nextUint32();
    const rt = roundTrip(generateHl7(kind, messageSeed));
    return {
      format: "hl7v2" as const,
      kind,
      content: rt.content,
      warnings: rt.warnings,
    };
  });
  return makeCorpus(seed, artifacts);
}
