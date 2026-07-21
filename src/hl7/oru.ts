/**
 * Spec-clean HL7 v2 `ORU^R01` (unsolicited observation result) generation, built **through
 * `@cosyte/hl7`'s `buildMessage`** (roadmap §Phase 2). The parser's structure net requires the
 * result group (`OBR`/`OBX`) for `ORU^R01`; this generator always emits both, plus a fully-populated
 * `PID`, so the message round-trips with **zero warnings**. Patient identity comes from `../safe`;
 * observation codes come from the license-clean example pool (`./example-codes`), never bundled
 * terminology. A `synth` `ORU` is *structurally* valid, not clinically coherent (roadmap §2).
 *
 * @module
 */

import type { Hl7Message, RawField } from "@cosyte/hl7";

import { createRng, type Rng } from "../rng/rng.js";

import { componentsField } from "./field.js";
import { mshScaffold, patientIdentity, pidSegment, seededTimestamp } from "./common.js";
import { EXAMPLE_LAB_OBSERVATIONS, EXAMPLE_ORDER_SERVICES } from "./example-codes.js";

/** Options for {@link generateOru}. */
export interface GenerateOruOptions {
  /** The seed — the same seed yields a byte-identical message. Defaults to `0`. */
  readonly seed?: number;
}

/** Render one `OBX` result segment (set id `n`) for a numeric example observation. */
function obxSegment(rng: Rng, setId: number): readonly (string | RawField)[] {
  const obs = rng.pick(EXAMPLE_LAB_OBSERVATIONS);
  const value = `${String(rng.int(1, 300))}.${String(rng.int(0, 9))}`;
  const observedAt = seededTimestamp(rng);
  return [
    String(setId), // OBX-1 set id
    "NM", // OBX-2 value type (numeric)
    componentsField([obs.code, obs.text, obs.system]), // OBX-3 observation identifier (CE)
    "", // OBX-4 observation sub-id
    value, // OBX-5 observation value
    obs.units ?? "", // OBX-6 units
    "", // OBX-7 reference range
    "N", // OBX-8 abnormal flags (normal)
    "", // OBX-9
    "", // OBX-10
    "F", // OBX-11 observation result status (final)
    "", // OBX-12
    "", // OBX-13
    observedAt, // OBX-14 date/time of the observation
  ];
}

/**
 * Generate a spec-clean `ORU^R01` {@link Hl7Message} through `@cosyte/hl7`. Deterministic in `seed`.
 *
 * Layout: MSH, `PID` (synthetic identity), `OBR` (order/observation request), and 1–3 `OBX` result
 * rows. The `OBR`/`OBX` result group satisfies the parser's `ORU^R01` structure net, so the message
 * re-parses with **zero warnings** (proven by {@link ./round-trip}).
 *
 * @param options - Seed. See {@link GenerateOruOptions}.
 * @returns A spec-clean `ORU^R01` `Hl7Message`.
 * @example
 * ```ts
 * import { generateOru } from "@cosyte/synth/hl7";
 * const msg = generateOru({ seed: 12345 });
 * console.log(msg.toString());
 * ```
 */
export function generateOru(options: GenerateOruOptions = {}): Hl7Message {
  const seed = options.seed ?? 0;
  const rng = createRng(seed);

  const { message } = mshScaffold(rng, "ORU^R01");
  message.addSegment("PID", pidSegment(patientIdentity(rng)));

  const service = rng.pick(EXAMPLE_ORDER_SERVICES);
  const placer = rng.digits(8);
  const filler = rng.digits(8);
  message.addSegment("OBR", [
    "1", // OBR-1 set id
    placer, // OBR-2 placer order number
    filler, // OBR-3 filler order number
    componentsField([service.code, service.text, service.system]), // OBR-4 universal service id (CE)
    "", // OBR-5
    "", // OBR-6
    seededTimestamp(rng), // OBR-7 observation date/time
  ]);

  const obxCount = rng.int(1, 3);
  for (let i = 1; i <= obxCount; i += 1) {
    message.addSegment("OBX", obxSegment(rng, i));
  }

  return message;
}
