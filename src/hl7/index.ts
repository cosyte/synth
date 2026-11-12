/**
 * `@cosyte/synth/hl7`: the HL7 v2 generation surface, exposed as its own subpath so importing the
 * package root does **not** pull `@cosyte/hl7`. This is the **lazy, per-format** boundary: a consumer
 * who only needs HL7 fixtures imports `@cosyte/synth/hl7`; one who needs only the core primitives
 * never loads a parser.
 * `@cosyte/hl7` is an **optional peer dependency**, present only for this subpath.
 *
 * The HL7 v2 message set: `ADT` (A01, A02, A03, A04, A08, A11, A13, A28, A31), `ORU^R01`, `ORM^O01`,
 * `SIU^S12`, `VXU^V04`, `MDM^T02`, `DFT^P03`, `OML^O21`, and an `ACK` for any of them, each built
 * through `@cosyte/hl7`'s `buildMessage`, stamped HL7 v2.5, and round-tripping with zero warnings.
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
import { generateMdm } from "./mdm.js";
import { generateDft } from "./dft.js";
import { generateOml } from "./oml.js";
import { generateAck } from "./ack.js";
import { hl7CorpusArtifact } from "./round-trip.js";
import { requireSelection, resolveKind, resolveMix } from "../select.js";

export { generateAdt, type AdtTrigger, type GenerateAdtOptions } from "./adt.js";
export { generateOru, type GenerateOruOptions } from "./oru.js";
export { generateOrm, type GenerateOrmOptions } from "./orm.js";
export { generateSiu, type GenerateSiuOptions } from "./siu.js";
export { generateVxu, type GenerateVxuOptions } from "./vxu.js";
export { generateMdm, type GenerateMdmOptions } from "./mdm.js";
export { generateDft, type GenerateDftOptions } from "./dft.js";
export { generateOml, type GenerateOmlOptions } from "./oml.js";
export { generateAck, type GenerateAckOptions, type Hl7AckCode } from "./ack.js";
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
 * Every HL7 v2 message kind this subpath generates: the `MSH-9` label used as the corpus `kind`. `ADT`
 * carries its trigger; the other families have a single generated trigger each. `ACK` acknowledges
 * an `ADT^A01` generated from the same seed (see {@link generateAck} to acknowledge any message).
 */
export type Hl7MessageKind =
  | "ADT^A01"
  | "ADT^A04"
  | "ADT^A08"
  | "ORU^R01"
  | "ORM^O01"
  | "SIU^S12"
  | "VXU^V04"
  | "ACK"
  | "ADT^A02"
  | "ADT^A03"
  | "ADT^A11"
  | "ADT^A13"
  | "ADT^A28"
  | "ADT^A31"
  | "MDM^T02"
  | "DFT^P03"
  | "OML^O21";

/**
 * Every kind {@link generateHl7} and {@link hl7Corpus} accept, in a fixed order: the first seven
 * kinds, then each kind added since. Pass it as a corpus `mix` to cycle through all of them.
 *
 * @example
 * ```ts
 * import { HL7_MESSAGE_KINDS, hl7Corpus } from "@cosyte/synth/hl7";
 * hl7Corpus({ seed: 1, count: HL7_MESSAGE_KINDS.length, mix: HL7_MESSAGE_KINDS });
 * ```
 */
export const HL7_MESSAGE_KINDS: readonly Hl7MessageKind[] = Object.freeze([
  "ADT^A01",
  "ADT^A04",
  "ADT^A08",
  "ORU^R01",
  "ORM^O01",
  "SIU^S12",
  "VXU^V04",
  "ACK",
  "ADT^A02",
  "ADT^A03",
  "ADT^A11",
  "ADT^A13",
  "ADT^A28",
  "ADT^A31",
  "MDM^T02",
  "DFT^P03",
  "OML^O21",
]);

/**
 * The default corpus mix: the first seven kinds, one of each. The kinds added since are not in it,
 * so a seed's default corpus keeps the bytes it had; name them in `mix` to include them.
 */
const DEFAULT_MIX: readonly Hl7MessageKind[] = Object.freeze(HL7_MESSAGE_KINDS.slice(0, 7));

/** Every `ADT` trigger the `triggers` option accepts. */
const ADT_TRIGGERS: readonly AdtTrigger[] = Object.freeze([
  "A01",
  "A04",
  "A08",
  "A02",
  "A03",
  "A11",
  "A13",
  "A28",
  "A31",
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
  switch (resolveKind(HL7_MESSAGE_KINDS, kind)) {
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
    case "ACK":
      return generateAck({ seed });
    case "ADT^A02":
      return generateAdt({ seed, trigger: "A02" });
    case "ADT^A03":
      return generateAdt({ seed, trigger: "A03" });
    case "ADT^A11":
      return generateAdt({ seed, trigger: "A11" });
    case "ADT^A13":
      return generateAdt({ seed, trigger: "A13" });
    case "ADT^A28":
      return generateAdt({ seed, trigger: "A28" });
    case "ADT^A31":
      return generateAdt({ seed, trigger: "A31" });
    case "MDM^T02":
      return generateMdm({ seed });
    case "DFT^P03":
      return generateDft({ seed });
    case "OML^O21":
      return generateOml({ seed });
  }
}

/** Options for {@link hl7Corpus}. */
export interface Hl7CorpusOptions {
  /** The seed for the whole corpus (deterministic). */
  readonly seed: number;
  /** How many messages to generate. Defaults to `1`. */
  readonly count?: number;
  /**
   * The message kinds to cycle through, any of {@link HL7_MESSAGE_KINDS}. Defaults to one each of
   * the first seven kinds (`ADT^A01/A04/A08`, `ORU^R01`, `ORM^O01`, `SIU^S12`, `VXU^V04`), so a seed's
   * default corpus is unchanged as kinds are added. An empty list throws `SYNTH_EMPTY_POOL`.
   */
  readonly mix?: readonly Hl7MessageKind[];
  /**
   * ADT-only convenience: the triggers to cycle through, kept for back-compat. When
   * supplied it takes precedence over `mix` and restricts the corpus to `ADT` messages. An empty
   * list throws `SYNTH_EMPTY_POOL`.
   */
  readonly triggers?: readonly AdtTrigger[];
  /**
   * Whether each artifact is read back through its parser and the parser's findings recorded as its
   * `warnings`. Defaults to `true`. `false` skips the read, a large share of a corpus's time; every
   * artifact's `warnings` is then empty without having been checked.
   */
  readonly verify?: boolean;
}

/**
 * Build a reproducible {@link Corpus} of spec-clean HL7 messages across the families. Each
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
 * corpus.artifacts.every((a) => a.warnings.length === 0); // true, spec-clean
 * ```
 */
export function hl7Corpus(options: Hl7CorpusOptions): Corpus {
  const { seed, count = 1, verify = true } = options;
  const kinds: readonly Hl7MessageKind[] = requireSelection(
    options.triggers !== undefined
      ? options.triggers.map(
          (t): Hl7MessageKind => `ADT^${resolveKind(ADT_TRIGGERS, t)}` as Hl7MessageKind,
        )
      : resolveMix(HL7_MESSAGE_KINDS, options.mix, DEFAULT_MIX),
  );
  // A seed stream derives one deterministic per-message seed from the corpus seed.
  const seedStream = createRng(seed);
  const artifacts = Array.from({ length: count }, (_unused, i) => {
    const kind = kinds[i % kinds.length] as Hl7MessageKind;
    const messageSeed = seedStream.nextUint32();
    const rt = hl7CorpusArtifact(generateHl7(kind, messageSeed), verify);
    return {
      format: "hl7v2" as const,
      kind,
      content: rt.content,
      warnings: rt.warnings,
    };
  });
  return makeCorpus(seed, artifacts);
}
