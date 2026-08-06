/**
 * Stable diagnostic codes for `@cosyte/synth` and the {@link SynthError} they travel on.
 *
 * Unlike a parser (which recovers from bad *input* into Tier-2 warnings), a **generator** has no input
 * to tolerate: its reflex is *synthetic-by-construction* and *fail-closed on impossibility*. So the
 * codes here are **fatal**: a caller asked for something the library cannot honor spec-clean, and the
 * only safe answer is to throw, never to silently fabricate a value or a byte workaround. Codes are `key ===
 * value` and part of the public contract:
 * renaming one is a breaking change.
 *
 * @module
 */

/**
 * The stable **fatal** code registry. Additions-only thereafter.
 *
 * @example
 * ```ts
 * import { SYNTH_FATAL_CODES, SynthError } from "@cosyte/synth";
 * try {
 *   // ...generate...
 * } catch (err) {
 *   if (err instanceof SynthError && err.code === SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_FORMAT) {
 *     // handle an unsupported format request
 *   }
 * }
 * ```
 */
export const SYNTH_FATAL_CODES = {
  /**
   * A format was requested that this build cannot generate through a real parser builder/serializer.
   * Fatal, never a hand-written byte fallback.
   *
   * **No code path in this build raises it.** All six formats generate, so it is reserved for a
   * future format that does not, and is kept because removing a published code is a breaking change.
   * An unsupported *kind* within a format that does generate is `SYNTH_UNSUPPORTED_KIND`.
   */
  SYNTH_UNSUPPORTED_FORMAT: "SYNTH_UNSUPPORTED_FORMAT",
  /**
   * A vendor quirk was requested that the target format's profile system does not support. Fatal,
   * never a silent no-op and never a fabricated quirk.
   */
  SYNTH_UNSUPPORTED_QUIRK: "SYNTH_UNSUPPORTED_QUIRK",
  /**
   * A quirk transform found no structural anchor to mutate, so the fixture would not carry the
   * deviation it is labelled with. Fatal: a golden file that lies about its parser verdict is worse
   * than no golden file.
   */
  SYNTH_QUIRK_ANCHOR_ABSENT: "SYNTH_QUIRK_ANCHOR_ABSENT",
  /**
   * A bare parse of a freshly-generated quirk artifact did not produce exactly the declared intended
   * warning code(s). Fatal, never emit a mislabeled fixture.
   */
  SYNTH_INTENDED_WARNING_MISMATCH: "SYNTH_INTENDED_WARNING_MISMATCH",
  /** A concept's code-system URI has no OID mapping in the C-CDA example-code table. Fatal. */
  SYNTH_UNMAPPED_CODE_SYSTEM: "SYNTH_UNMAPPED_CODE_SYSTEM",
  /** A money value could not be read as an X12 decimal. Fatal: a generator never rounds to a float. */
  SYNTH_INVALID_DECIMAL: "SYNTH_INVALID_DECIMAL",
  /** An integer range was requested with its maximum below its minimum. Fatal. */
  SYNTH_INVALID_RANGE: "SYNTH_INVALID_RANGE",
  /** A value was drawn from an empty pool. Fatal, never a fabricated substitute. */
  SYNTH_EMPTY_POOL: "SYNTH_EMPTY_POOL",
  /** A `defineSynthProfile` spec was not usable (a missing or blank `name`). Fatal. */
  SYNTH_INVALID_PROFILE: "SYNTH_INVALID_PROFILE",
  /**
   * A caller-supplied selector (a message kind, a document type, a corpus mix entry, a claim
   * variant, a Bundle type, a resource profile) is not in the closed set that governs it. Fatal:
   * see `resolveKind`: a selector union is erased at run time, and a selector that falls through
   * either mislabels the fixture or hands the value to a peer builder that quotes it back.
   */
  SYNTH_UNSUPPORTED_KIND: "SYNTH_UNSUPPORTED_KIND",
} as const;

/**
 * A value from {@link SYNTH_FATAL_CODES}: the type carried by a thrown {@link SynthError}.
 */
export type SynthFatalCode = (typeof SYNTH_FATAL_CODES)[keyof typeof SYNTH_FATAL_CODES];

/**
 * The **frozen message registry**: the only place a {@link SynthError} message can come from.
 *
 * A message here is a fixed string. It never quotes the request that produced it, and there is no
 * parameter through which it could: {@link SynthError} takes a code and nothing else. That is the
 * whole mechanism, and it is deliberately a mechanism rather than a habit. Every one of these
 * messages used to be assembled by interpolating the caller's value into a template, and the reason
 * that was safe was not the design: it was that the caller happened to be passing a quirk name.
 *
 * The trade is real and is accepted: a fatal no longer tells you *which* value it rejected. It tells
 * you which rule refused, on `err.code`, and the stack frame tells you where. The caller already
 * holds the value it passed.
 *
 * @example
 * ```ts
 * import { SYNTH_FATAL_CODES, SYNTH_FATAL_MESSAGES } from "@cosyte/synth";
 * SYNTH_FATAL_MESSAGES[SYNTH_FATAL_CODES.SYNTH_EMPTY_POOL]; // => "A value was drawn from an empty pool."
 * ```
 */
export const SYNTH_FATAL_MESSAGES: Readonly<Record<SynthFatalCode, string>> = Object.freeze({
  SYNTH_UNSUPPORTED_FORMAT:
    "The requested format is not generable by this build. A generator has no byte fallback: it " +
    "builds through a parser's own serializer or it refuses.",
  SYNTH_UNSUPPORTED_QUIRK:
    "The requested vendor quirk is not in the target format's quirk registry. Compare the request " +
    "against that format's exported registry (HL7_QUIRKS, CCDA_QUIRKS, ASTM_QUIRKS).",
  SYNTH_QUIRK_ANCHOR_ABSENT:
    "The quirk transform found no structural anchor to mutate, so the fixture would not carry the " +
    "deviation it is labelled with. Refusing to emit a mislabeled fixture.",
  SYNTH_INTENDED_WARNING_MISMATCH:
    "A bare parse of the generated quirk artifact did not produce exactly the declared intended " +
    "warning code(s). Refusing to emit a mislabeled fixture.",
  SYNTH_UNMAPPED_CODE_SYSTEM:
    "The concept's code-system URI has no OID mapping in the C-CDA example-code table.",
  SYNTH_INVALID_DECIMAL: "The value could not be read as an X12 decimal.",
  SYNTH_INVALID_RANGE: "An integer range was requested with its maximum below its minimum.",
  SYNTH_EMPTY_POOL: "A value was drawn from an empty pool.",
  SYNTH_INVALID_PROFILE: "defineSynthProfile requires a non-empty string name.",
  SYNTH_UNSUPPORTED_KIND:
    "The requested kind, document type, corpus mix entry, variant or profile is not one this " +
    "generator supports. The supported set is the exported union for that option.",
});

/**
 * The typed error every fatal `@cosyte/synth` condition throws. Carries a stable
 * {@link SynthFatalCode} so callers branch on `err.code` without matching message text.
 *
 * It takes **no value parameter**. The message is whatever {@link SYNTH_FATAL_MESSAGES} holds for the
 * code, so no caller-supplied string can reach a diagnostic surface by any route, not `message`, not
 * `stack`, not a field on the thrown object.
 *
 * @example
 * ```ts
 * import { SynthError, SYNTH_FATAL_CODES } from "@cosyte/synth";
 * throw new SynthError(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_FORMAT);
 * ```
 */
export class SynthError extends Error {
  /** The stable fatal code. */
  public readonly code: SynthFatalCode;

  /**
   * @param code - The stable {@link SynthFatalCode}. The message comes from the frozen registry.
   */
  public constructor(code: SynthFatalCode) {
    super(SYNTH_FATAL_MESSAGES[code]);
    this.name = "SynthError";
    this.code = code;
  }
}
