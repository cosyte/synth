/**
 * Spec-clean HL7 v2 `ACK` (general acknowledgment) generation, for any message: built **through
 * `@cosyte/hl7`'s `buildMessage`** like every other kind. The published `ACK` structure requires
 * `MSH` and `MSA`; an error acknowledgment adds one `ERR`. The message round-trips with **zero
 * warnings**.
 *
 * `@cosyte/hl7`'s own `buildAck` stamps the current time and a fresh control id, which is right for a
 * live interface and wrong for a fixture. This generator draws both from the seed instead, so the
 * same seed and the same inbound message give the same bytes.
 *
 * @module
 */

import type { Hl7Message } from "@cosyte/hl7";

import { createRng } from "../rng/rng.js";
import { SYNTH_FATAL_CODES, SynthError } from "../codes.js";
import { resolveKind } from "../select.js";
import { hl7Peer } from "../peers.js";

import { componentsField } from "./field.js";
import { seededTimestamp, shiftTimestamp } from "./common.js";
import { generateAdt } from "./adt.js";

/**
 * An original-mode acknowledgment code (HL7 table 0008, MSA-1): `AA` application accept, `AE`
 * application error, `AR` application reject.
 */
export type Hl7AckCode = "AA" | "AE" | "AR";

/** Every value {@link Hl7AckCode} admits. Erased at run time, so it is resolved, not trusted. */
const ACK_CODES: readonly Hl7AckCode[] = Object.freeze(["AA", "AE", "AR"]);

/** Options for {@link generateAck}. */
export interface GenerateAckOptions {
  /** The seed: the same seed and inbound message yield a byte-identical ACK. Defaults to `0`. */
  readonly seed?: number;
  /**
   * The message being acknowledged. Defaults to the `ADT^A01` {@link generateAdt} makes from the same
   * seed. It must carry an MSH-10 message control id.
   */
  readonly inbound?: Hl7Message;
  /** The acknowledgment code in MSA-1. Defaults to `"AA"`. */
  readonly code?: Hl7AckCode;
}

/**
 * Generate a spec-clean `ACK` {@link Hl7Message} answering `inbound`. Deterministic in `seed` and
 * `inbound`.
 *
 * - **MSH**: the inbound receiver (MSH-5, MSH-6) becomes the sender (MSH-3, MSH-4) and the inbound
 *   sender the receiver. MSH-7 is one to fifty-nine seconds after the inbound MSH-7, or a seeded time
 *   when that is not a full `YYYYMMDDHHMMSS`. MSH-9 is `ACK^<inbound trigger>^ACK`, or `ACK` when
 *   the inbound names no trigger. MSH-10 is a seeded `SYNTHACK` control id. MSH-11 is always `T`, test
 *   data, whatever the inbound says. MSH-12 echoes the inbound version, `2.5` when it names none.
 * - **MSA**: MSA-1 is `code`, MSA-2 the inbound MSH-10.
 * - **ERR**, for `AE` and `AR` only: ERR-3 is condition `207`, application internal error (HL7 table
 *   0357), and ERR-4 severity `E`, error.
 *
 * @param options - Seed, inbound message and code. See {@link GenerateAckOptions}.
 * @returns A spec-clean `ACK` `Hl7Message`.
 * @throws SynthError `SYNTH_ACK_UNCORRELATED` when the inbound message has no MSH-10, and
 * `SYNTH_UNSUPPORTED_KIND` when `code` is not `AA`, `AE` or `AR`.
 * @example
 * ```ts
 * import { generateAck, generateOru } from "@cosyte/synth/hl7";
 * const ack = generateAck({ seed: 7, inbound: generateOru({ seed: 7 }) });
 * console.log(ack.toString()); // MSH|...|ACK^R01^ACK|SYNTHACK...|T|2.5 then MSA|AA|SYNTH...
 * ```
 */
export function generateAck(options: GenerateAckOptions = {}): Hl7Message {
  const seed = options.seed ?? 0;
  const code = resolveKind(ACK_CODES, options.code ?? "AA");
  const inbound = options.inbound ?? generateAdt({ seed });
  const inboundControlId = inbound.get("MSH.10") ?? "";
  if (inboundControlId === "") throw new SynthError(SYNTH_FATAL_CODES.SYNTH_ACK_UNCORRELATED);

  const rng = createRng(seed);
  const delaySeconds = rng.int(1, 59);
  const controlId = `SYNTHACK${rng.digits(10)}`;
  // An absent MSH-7 reads as "undefined", which is not a timestamp either.
  const inboundTime = String(inbound.get("MSH.7"));
  const timestamp = /^\d{14}$/.test(inboundTime)
    ? shiftTimestamp(inboundTime, delaySeconds)
    : seededTimestamp(rng);
  const trigger = inbound.get("MSH.9.2") ?? "";

  const message = hl7Peer().buildMessage({
    type: trigger === "" ? "ACK" : `ACK^${trigger}^ACK`,
    sendingApp: inbound.get("MSH.5") ?? "",
    sendingFacility: inbound.get("MSH.6") ?? "",
    receivingApp: inbound.get("MSH.3") ?? "",
    receivingFacility: inbound.get("MSH.4") ?? "",
    controlId,
    timestamp,
    version: inbound.get("MSH.12") ?? "2.5",
    // MSH-11 processing ID `T` (HL7 table 0103: training): an acknowledgment of test data is test
    // data, so it never echoes a `P` from the inbound message.
    processingId: "T",
  });
  message.addSegment("MSA", [code, inboundControlId]);
  if (code !== "AA") {
    message.addSegment("ERR", [
      "", // ERR-1 error code and location (backward compatible only)
      "", // ERR-2 error location
      componentsField(["207", "Application internal error", "HL70357"]), // ERR-3 HL7 error code
      "E", // ERR-4 severity (error)
    ]);
  }
  return message;
}
