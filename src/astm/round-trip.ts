/**
 * The **round-trip-through-the-parser harness** for ASTM — the headline gate for the synthetic-fixture
 * generator (roadmap §6). A generated ASTM record stream (or framed byte stream) is "spec-clean" only
 * if `@cosyte/astm` — not `@cosyte/synth`'s own opinion — reads it back cleanly. Each harness parses the
 * generated wire straight back through the parser and reports what it found, so a false "spec-clean"
 * claim cannot hide (roadmap §4.5, the first head of the two-headed hazard).
 *
 * The **record** layer (E1394) and the **frame** layer (E1381) are separate concerns, so each gets its
 * own harness; both report the same {@link AstmRoundTripResult} shape (the framed one additionally folds
 * the frame-layer warnings — bad checksum, sequence gap, unterminated, oversize — into `warnings`, so a
 * framing defect is caught by the same gate).
 *
 * @module
 */

import {
  parseAstmRecords,
  serializeAstmRecords,
  parseFramedAstm,
  serializeFramedAstm,
} from "@cosyte/astm";

/** The verdict of one round-trip through `@cosyte/astm`. */
export interface AstmRoundTripResult {
  /** The serialized ASTM wire text (records: the `CR`-terminated stream; framed: the raw bytes as latin1). */
  readonly content: string;
  /** The warning codes the parser emitted on re-parse (record + frame layers). Empty ⇒ spec-clean. */
  readonly warnings: readonly string[];
  /** Whether re-serializing the re-parsed message is byte-identical to the input. */
  readonly byteStable: boolean;
  /** `true` iff the artifact is spec-clean: zero warnings **and** byte-stable. */
  readonly specClean: boolean;
}

/**
 * Round-trip a generated ASTM **record** stream through parse → serialize and report the verdict. A
 * spec-clean message re-parses with **zero warnings** and re-serializes byte-identically.
 *
 * @param raw - The ASTM record stream (typically from `generateAstmResult` / `generateAstmOrder`).
 * @returns The {@link AstmRoundTripResult}.
 * @example
 * ```ts
 * import { generateAstmResult, astmRoundTrip } from "@cosyte/synth/astm";
 * const { specClean } = astmRoundTrip(generateAstmResult({ seed: 1 })); // specClean === true
 * ```
 */
export function astmRoundTrip(raw: string): AstmRoundTripResult {
  const message = parseAstmRecords(raw);
  const warnings = message.warnings.map((w) => String(w.code));
  const byteStable = serializeAstmRecords(message) === raw;
  return { content: raw, warnings, byteStable, specClean: warnings.length === 0 && byteStable };
}

/**
 * Round-trip a generated **framed** ASTM byte stream (E1381) through decode+parse → re-frame and report
 * the verdict. A spec-clean framed message re-parses with **zero record and zero frame warnings** (every
 * modulo-256 checksum verifies, no sequence gap, no unterminated/oversize frame) and re-frames
 * byte-identically.
 *
 * @param bytes - The framed byte stream (typically from `generateAstmResultFramed`).
 * @returns The {@link AstmRoundTripResult} — `content` holds the framed bytes decoded as latin1.
 * @example
 * ```ts
 * import { generateAstmResultFramed, astmFramedRoundTrip } from "@cosyte/synth/astm";
 * const { specClean } = astmFramedRoundTrip(generateAstmResultFramed({ seed: 1 })); // true
 * ```
 */
export function astmFramedRoundTrip(bytes: Uint8Array): AstmRoundTripResult {
  const { message, frameWarnings } = parseFramedAstm(bytes);
  const warnings = [
    ...frameWarnings.map((w) => String(w.code)),
    ...message.warnings.map((w) => String(w.code)),
  ];
  const reframed = serializeFramedAstm(message);
  const byteStable = bytesEqual(reframed, bytes);
  const content = latin1(bytes);
  return { content, warnings, byteStable, specClean: warnings.length === 0 && byteStable };
}

/** Byte-for-byte equality of two frame streams. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** Decode a frame stream as latin1 for a lossless `string` view (the frame envelope is single-byte). */
function latin1(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}
