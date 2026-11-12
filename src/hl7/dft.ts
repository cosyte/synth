/**
 * Spec-clean HL7 v2 `DFT^P03` (post detail financial transactions) generation, built **through
 * `@cosyte/hl7`'s `buildMessage`**. The published `DFT_P03` structure requires `EVN`, `PID` and at
 * least one `FT1` (the financial transaction); this generator emits them and a `PV1`, so the message
 * round-trips with **zero warnings**. Identity comes from `../safe`; the charge code is a local code
 * that says it is synthetic, never a real chargemaster or procedure code.
 *
 * @module
 */

import type { Hl7Message } from "@cosyte/hl7";

import { createRng } from "../rng/rng.js";

import { componentsField } from "./field.js";
import { mshScaffold, patientIdentity, pidSegment } from "./common.js";

/** The local charge codes drawn from (`FT1-7`, coding system `99SYN`): plainly fake. */
function charges(): readonly { readonly code: string; readonly text: string }[] {
  return [
    { code: "SYNTHCHG01", text: "Synthetic office visit charge" },
    { code: "SYNTHCHG02", text: "Synthetic laboratory charge" },
    { code: "SYNTHCHG03", text: "Synthetic imaging charge" },
    { code: "SYNTHCHG04", text: "Synthetic supply charge" },
  ];
}

/** Options for {@link generateDft}. */
export interface GenerateDftOptions {
  /** The seed: the same seed yields a byte-identical message. Defaults to `0`. */
  readonly seed?: number;
}

/**
 * Generate a spec-clean `DFT^P03` {@link Hl7Message} through `@cosyte/hl7`. Deterministic in `seed`.
 *
 * Layout: MSH (`DFT^P03^DFT_P03`), `EVN`, `PID` (synthetic identity), `PV1`, and one `FT1`: a
 * `SYNTHTXN` transaction id, the transaction date, type `CG` (charge, HL7 table 0017), a local
 * `SYNTHCHG` charge code and a quantity of one to three.
 *
 * @param options - Seed. See {@link GenerateDftOptions}.
 * @returns A spec-clean `DFT^P03` `Hl7Message`.
 * @example
 * ```ts
 * import { generateDft } from "@cosyte/synth/hl7";
 * const msg = generateDft({ seed: 12345 });
 * console.log(msg.toString());
 * ```
 */
export function generateDft(options: GenerateDftOptions = {}): Hl7Message {
  const seed = options.seed ?? 0;
  const rng = createRng(seed);

  const { message, timestamp } = mshScaffold(rng, "DFT^P03^DFT_P03");
  message.addSegment("EVN", ["P03", timestamp]);
  message.addSegment("PID", pidSegment(patientIdentity(rng)));
  message.addSegment("PV1", ["1", rng.pick(["I", "O", "E"] as const)]);

  const transactionId = `SYNTHTXN${rng.digits(8)}`;
  const charge = rng.pick(charges());
  const quantity = String(rng.int(1, 3));
  message.addSegment("FT1", [
    "1", // FT1-1 set id
    transactionId, // FT1-2 transaction id
    "", // FT1-3 transaction batch id
    timestamp, // FT1-4 transaction date
    "", // FT1-5 transaction posting date
    "CG", // FT1-6 transaction type (charge)
    componentsField([charge.code, charge.text, "99SYN"]), // FT1-7 transaction code (local)
    "", // FT1-8 transaction description
    "", // FT1-9 transaction description, alternate
    quantity, // FT1-10 transaction quantity
  ]);

  return message;
}
