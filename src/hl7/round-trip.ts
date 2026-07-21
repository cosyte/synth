/**
 * The **round-trip-through-the-parser harness** — the headline gate for the synthetic-fixture
 * generator (roadmap §6). A generated artifact is "spec-clean" only if `@cosyte/hl7` — not
 * `@cosyte/synth`'s own opinion — reads it back cleanly. This harness feeds a generated message
 * straight back into the parser and reports what the parser found, so a false "spec-clean" claim
 * cannot hide (roadmap §4.5, the first head of the two-headed hazard).
 *
 * @module
 */

import { parseHL7, type Hl7Message } from "@cosyte/hl7";

/** The verdict of one round-trip through `@cosyte/hl7`. */
export interface RoundTripResult {
  /** The serialized wire text (the parser's own conservative emit). */
  readonly content: string;
  /** The warning codes the parser emitted on re-parse. Empty ⇒ spec-clean. */
  readonly warnings: readonly string[];
  /** Whether re-serializing the re-parsed message is byte-identical to `content`. */
  readonly byteStable: boolean;
  /** `true` iff the artifact is spec-clean: zero warnings **and** byte-stable. */
  readonly specClean: boolean;
}

/**
 * Round-trip an `@cosyte/hl7` `Hl7Message` through serialize → parse → serialize and report the
 * verdict. A spec-clean artifact re-parses with **zero warnings** and re-serializes byte-identically.
 *
 * @param message - The message to check (typically from `generateAdt`).
 * @returns The {@link RoundTripResult}.
 * @example
 * ```ts
 * import { generateAdt, roundTrip } from "@cosyte/synth/hl7";
 * const { specClean, warnings } = roundTrip(generateAdt({ seed: 1 }));
 * // specClean === true, warnings.length === 0
 * ```
 */
export function roundTrip(message: Hl7Message): RoundTripResult {
  const content = message.toString();
  const reparsed = parseHL7(content);
  const warnings = reparsed.warnings.map((w) => String(w.code));
  const byteStable = reparsed.toString() === content;
  return {
    content,
    warnings,
    byteStable,
    specClean: warnings.length === 0 && byteStable,
  };
}
