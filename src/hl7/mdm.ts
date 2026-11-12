/**
 * Spec-clean HL7 v2 `MDM^T02` (original document notification and content) generation, built
 * **through `@cosyte/hl7`'s `buildMessage`**. The published `MDM_T02` structure requires `EVN`, `PID`,
 * `PV1`, `TXA` (the document header) and at least one `OBX` (the document body); this generator emits
 * each of them, so the message round-trips with **zero warnings**. Identity comes from `../safe`; the
 * document body is a fixed set of sentences that say they are synthetic.
 *
 * @module
 */

import type { Hl7Message } from "@cosyte/hl7";

import { createRng } from "../rng/rng.js";

import { componentsField } from "./field.js";
import { mshScaffold, patientIdentity, pidSegment } from "./common.js";

/**
 * The `TXA-2` document types drawn from (HL7 table 0270): consultation, discharge summary, history and
 * physical examination, procedure note.
 */
const DOCUMENT_TYPES = Object.freeze(["CN", "DS", "HP", "PN"] as const);

/** The document body lines drawn from: each says it is synthetic, none describes a person. */
const NOTE_LINES = Object.freeze([
  "Synthetic test document for interface testing.",
  "Synthetic note text: no real patient is described here.",
  "Synthetic content generated from a seed.",
] as const);

/** Options for {@link generateMdm}. */
export interface GenerateMdmOptions {
  /** The seed: the same seed yields a byte-identical message. Defaults to `0`. */
  readonly seed?: number;
}

/**
 * Generate a spec-clean `MDM^T02` {@link Hl7Message} through `@cosyte/hl7`. Deterministic in `seed`.
 *
 * Layout: MSH (`MDM^T02^MDM_T02`), `EVN`, `PID` (synthetic identity), `PV1`, `TXA` (document type
 * from HL7 table 0270, content presentation `TX`, a `SYNTHDOC` unique document number, completion
 * status `DO`, documented) and one to three `OBX` lines of `TX` text, each final (`F`).
 *
 * @param options - Seed. See {@link GenerateMdmOptions}.
 * @returns A spec-clean `MDM^T02` `Hl7Message`.
 * @example
 * ```ts
 * import { generateMdm } from "@cosyte/synth/hl7";
 * const msg = generateMdm({ seed: 12345 });
 * console.log(msg.toString());
 * ```
 */
export function generateMdm(options: GenerateMdmOptions = {}): Hl7Message {
  const seed = options.seed ?? 0;
  const rng = createRng(seed);

  const { message, timestamp } = mshScaffold(rng, "MDM^T02^MDM_T02");
  message.addSegment("EVN", ["T02", timestamp]);
  message.addSegment("PID", pidSegment(patientIdentity(rng)));
  message.addSegment("PV1", ["1", rng.pick(["I", "O", "E"] as const)]);

  const documentType = rng.pick(DOCUMENT_TYPES);
  const documentNumber = `SYNTHDOC${rng.digits(10)}`;
  message.addSegment("TXA", [
    "1", // TXA-1 set id
    documentType, // TXA-2 document type
    "TX", // TXA-3 document content presentation (text)
    timestamp, // TXA-4 activity date/time
    ...Array<string>(7).fill(""), // TXA-5 to TXA-11
    componentsField([documentNumber, "COSYTE-SYNTH"]), // TXA-12 unique document number (EI)
    ...Array<string>(4).fill(""), // TXA-13 to TXA-16
    "DO", // TXA-17 document completion status (documented)
  ]);

  const lines = rng.int(1, 3);
  for (let i = 1; i <= lines; i += 1) {
    message.addSegment("OBX", [
      String(i), // OBX-1 set id
      "TX", // OBX-2 value type
      componentsField(["SYNTHNOTE", "Synthetic note", "99SYN"]), // OBX-3 observation id (local)
      "", // OBX-4 sub-id
      rng.pick(NOTE_LINES), // OBX-5 the document text
      ...Array<string>(5).fill(""), // OBX-6 to OBX-10
      "F", // OBX-11 result status (final)
    ]);
  }

  return message;
}
