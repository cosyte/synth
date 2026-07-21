/**
 * Stable diagnostic codes for `@cosyte/synth` and the {@link SynthError} they travel on.
 *
 * Unlike a parser (which recovers from bad *input* into Tier-2 warnings), a **generator** has no input
 * to tolerate — its reflex is *synthetic-by-construction* and *fail-closed on impossibility*. So the
 * codes here are **fatal**: a caller asked for something the library cannot honor spec-clean, and the
 * only safe answer is to throw, never to silently fabricate a value or a byte workaround (roadmap §4,
 * §Phase 1 "Fail-safe behavior"). Codes are `key === value` and part of the public contract —
 * renaming one is a breaking change.
 *
 * @module
 */

/**
 * The stable **fatal** code registry. Additions-only thereafter (roadmap §Phase 1).
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
   * A format was requested that this build cannot generate through a real parser builder/serializer
   * (e.g. ASTM before `@cosyte/astm`'s serializer ships). Fatal — never a hand-written byte fallback.
   */
  SYNTH_UNSUPPORTED_FORMAT: "SYNTH_UNSUPPORTED_FORMAT",
  /**
   * A vendor quirk was requested that the target format's profile system does not support. Fatal —
   * never a silent no-op and never a fabricated quirk (roadmap §Phase 1).
   */
  SYNTH_UNSUPPORTED_QUIRK: "SYNTH_UNSUPPORTED_QUIRK",
} as const;

/**
 * A value from {@link SYNTH_FATAL_CODES} — the type carried by a thrown {@link SynthError}.
 */
export type SynthFatalCode = (typeof SYNTH_FATAL_CODES)[keyof typeof SYNTH_FATAL_CODES];

/**
 * The typed error every fatal `@cosyte/synth` condition throws. Carries a stable
 * {@link SynthFatalCode} so callers branch on `err.code` without matching message text.
 *
 * @example
 * ```ts
 * import { SynthError, SYNTH_FATAL_CODES } from "@cosyte/synth";
 * throw new SynthError(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_FORMAT, "astm is not yet generable");
 * ```
 */
export class SynthError extends Error {
  /** The stable fatal code. */
  public readonly code: SynthFatalCode;

  /**
   * @param code - The stable {@link SynthFatalCode}.
   * @param message - A human-readable detail (never contains PHI — there is none).
   */
  public constructor(code: SynthFatalCode, message: string) {
    super(message);
    this.name = "SynthError";
    this.code = code;
  }
}
