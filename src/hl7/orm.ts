/**
 * Spec-clean HL7 v2 `ORM^O01` (general order) generation, built **through `@cosyte/hl7`'s
 * `buildMessage`** (roadmap §Phase 2). The parser's structure net requires the common-order segment
 * (`ORC`) for `ORM^O01`; this generator emits `ORC` + a matching `OBR`, plus a fully-populated `PID`,
 * so the message round-trips with **zero warnings**. Identity comes from `../safe`; the ordered service
 * comes from the license-clean example pool, never bundled terminology.
 *
 * @module
 */

import type { Hl7Message } from "@cosyte/hl7";

import { createRng } from "../rng/rng.js";

import { componentsField } from "./field.js";
import { mshScaffold, patientIdentity, pidSegment, seededTimestamp } from "./common.js";
import { EXAMPLE_ORDER_SERVICES } from "./example-codes.js";

/** Options for {@link generateOrm}. */
export interface GenerateOrmOptions {
  /** The seed — the same seed yields a byte-identical message. Defaults to `0`. */
  readonly seed?: number;
}

/**
 * Generate a spec-clean `ORM^O01` {@link Hl7Message} through `@cosyte/hl7`. Deterministic in `seed`.
 *
 * Layout: MSH, `PID` (synthetic identity), `ORC` (common order — control `NW`, new order), and a
 * matching `OBR` (order detail). The `ORC` satisfies the parser's `ORM^O01` structure net, so the
 * message re-parses with **zero warnings** (proven by {@link ./round-trip}).
 *
 * @param options - Seed. See {@link GenerateOrmOptions}.
 * @returns A spec-clean `ORM^O01` `Hl7Message`.
 * @example
 * ```ts
 * import { generateOrm } from "@cosyte/synth/hl7";
 * const msg = generateOrm({ seed: 12345 });
 * console.log(msg.toString());
 * ```
 */
export function generateOrm(options: GenerateOrmOptions = {}): Hl7Message {
  const seed = options.seed ?? 0;
  const rng = createRng(seed);

  const { message } = mshScaffold(rng, "ORM^O01");
  message.addSegment("PID", pidSegment(patientIdentity(rng)));

  const service = rng.pick(EXAMPLE_ORDER_SERVICES);
  const placer = rng.digits(8);
  const filler = rng.digits(8);
  const orderedAt = seededTimestamp(rng);

  message.addSegment("ORC", [
    "NW", // ORC-1 order control (new order)
    placer, // ORC-2 placer order number
    filler, // ORC-3 filler order number
    "", // ORC-4 placer group number
    "", // ORC-5 order status
    "", // ORC-6
    "", // ORC-7 quantity/timing
    "", // ORC-8
    orderedAt, // ORC-9 date/time of transaction
  ]);

  message.addSegment("OBR", [
    "1", // OBR-1 set id
    placer, // OBR-2 placer order number (matches ORC)
    filler, // OBR-3 filler order number (matches ORC)
    componentsField([service.code, service.text, service.system]), // OBR-4 universal service id (CE)
  ]);

  return message;
}
