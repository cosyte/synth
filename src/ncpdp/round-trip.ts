/**
 * The **round-trip-through-the-parser harness** for NCPDP — the headline gate for the synthetic-fixture
 * generator (roadmap §6). A generated SCRIPT XML or Telecom claim is "spec-clean" only if
 * `@cosyte/ncpdp` — not `@cosyte/synth`'s own opinion — reads it back cleanly. Each harness parses the
 * generated wire text straight back through the parser and reports what it found, so a false
 * "spec-clean" claim cannot hide (roadmap §4.5, the first head of the two-headed hazard).
 *
 * SCRIPT and Telecom are two structurally unrelated standards, so each gets its own harness; both
 * report the same {@link RoundTripResult} shape.
 *
 * @module
 */

import { parseScript, serializeScript } from "@cosyte/ncpdp/script";
import { parseTelecom, serializeTelecom } from "@cosyte/ncpdp/telecom";

/** The verdict of one round-trip through `@cosyte/ncpdp`. */
export interface RoundTripResult {
  /** The serialized NCPDP wire text (the serializer's own conservative emit). */
  readonly content: string;
  /** The warning codes the parser emitted on re-parse. Empty ⇒ spec-clean. */
  readonly warnings: readonly string[];
  /** Whether re-serializing the re-parsed message is byte-identical to `content`. */
  readonly byteStable: boolean;
  /** `true` iff the artifact is spec-clean: zero warnings **and** byte-stable. */
  readonly specClean: boolean;
}

/**
 * Round-trip a generated **SCRIPT** XML string through parse → serialize and report the verdict. A
 * spec-clean message re-parses with **zero warnings** and re-serializes byte-identically.
 *
 * @param xml - The SCRIPT XML (typically from `generateNewRx` / `generateRxRenewalRequest` / …).
 * @returns The {@link RoundTripResult}.
 * @example
 * ```ts
 * import { generateNewRx, scriptRoundTrip } from "@cosyte/synth/ncpdp";
 * const { specClean } = scriptRoundTrip(generateNewRx({ seed: 1 })); // specClean === true
 * ```
 */
export function scriptRoundTrip(xml: string): RoundTripResult {
  const message = parseScript(xml);
  const warnings = message.warnings.map((w) => String(w.code));
  const byteStable = serializeScript(message) === xml;
  return { content: xml, warnings, byteStable, specClean: warnings.length === 0 && byteStable };
}

/**
 * Round-trip a generated **Telecom** wire string through parse → serialize and report the verdict. A
 * spec-clean transaction re-parses with **zero warnings** and re-serializes byte-identically.
 *
 * @param wire - The Telecom wire string (typically from `generateB1` / `generateB2` / `generateB3`).
 * @returns The {@link RoundTripResult}.
 * @example
 * ```ts
 * import { generateB1, telecomRoundTrip } from "@cosyte/synth/ncpdp";
 * const { specClean } = telecomRoundTrip(generateB1({ seed: 1 })); // specClean === true
 * ```
 */
export function telecomRoundTrip(wire: string): RoundTripResult {
  const transaction = parseTelecom(wire);
  const warnings = transaction.warnings.map((w) => String(w.code));
  const byteStable = serializeTelecom(transaction) === wire;
  return { content: wire, warnings, byteStable, specClean: warnings.length === 0 && byteStable };
}
