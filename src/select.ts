/**
 * The **selector chokepoint**. A generator's options are almost all *selectors*: a message kind, a
 * document type, a corpus mix, a claim variant, a Bundle type, a profile. Each is typed as a closed
 * union, and every one of those unions is **erased at run time**, so a JavaScript caller (or a
 * `as never` in someone's test) reaches the branch with any string at all.
 *
 * Three things went wrong when that was left unchecked, and they are all the same bug:
 *
 * 1. **The value reached a diagnostic.** An unrecognised `documentType` travelled into
 *    `@cosyte/ccda`'s `buildCcda`, which is entitled to quote it back in its own `TypeError` and
 *    does. This package then has a caller-supplied string on an `err.message` and an `err.stack`,
 *    through its own public entry point, having taken no care of it.
 * 2. **The value reached the model.** A corpus mix entry becomes an `Artifact.kind` and a
 *    `manifest.counts` key, which is precisely the structural-identifier position a downstream
 *    package interpolates to describe a location.
 * 3. **The fixture was silently mislabeled.** An exhaustive `switch` over an erased union takes no
 *    branch and returns `undefined`, or a trailing `else` quietly generates something else. A corpus
 *    whose manifest says it holds one transaction and holds another is a golden file that lies.
 *
 * So a selector is resolved against its own set, once, before anything is generated, and an
 * unrecognised one is a fatal `SYNTH_UNSUPPORTED_KIND`. Like every fatal here it carries a code and a
 * fixed message, and quotes neither the request nor the set.
 *
 * @module
 */

import { SYNTH_FATAL_CODES, SynthError } from "./codes.js";

/**
 * Resolve one caller-supplied selector against the closed set that governs it, or **fail closed**.
 *
 * @param allowed - Every value the selector may take.
 * @param requested - The selector the caller supplied.
 * @returns `requested`, narrowed to the union.
 * @throws SynthError `SYNTH_UNSUPPORTED_KIND` when `requested` is not in `allowed`.
 * @example
 * ```ts
 * import { resolveKind } from "@cosyte/synth";
 * resolveKind(["ccd", "referralNote"] as const, "ccd"); // "ccd"
 * ```
 */
export function resolveKind<T extends string>(allowed: readonly T[], requested: string): T {
  const match = allowed.find((value) => value === requested);
  if (match === undefined) throw new SynthError(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_KIND);
  return match;
}

/**
 * Resolve every entry of a caller-supplied corpus mix, in order, or **fail closed** on the first
 * unrecognised one.
 *
 * It substitutes the default **only** when the caller supplied nothing, which is exactly what the
 * `??` it replaced did. An empty array is a supplied mix and is returned as one. An earlier version
 * of this function also treated `[]` as "nothing supplied", on the stated grounds that it matched the
 * previous behaviour; it did not: `??` fires on `undefined` and never on `[]`, and it changed the
 * result of six published entry points, turning an explicit empty selection into "generate one of
 * everything". A convenience that fails open is not a convenience.
 *
 * @param allowed - Every kind the corpus may generate.
 * @param requested - The mix the caller supplied, or `undefined` for the default.
 * @param fallback - The default mix, used only when `requested` is `undefined`.
 * @returns The resolved mix.
 * @throws SynthError `SYNTH_UNSUPPORTED_KIND` on the first unrecognised entry.
 * @example
 * ```ts
 * import { resolveMix } from "@cosyte/synth";
 * resolveMix(["Result", "Order"] as const, ["Order"], ["Result", "Order"]); // ["Order"]
 * ```
 */
export function resolveMix<T extends string>(
  allowed: readonly T[],
  requested: readonly string[] | undefined,
  fallback: readonly T[],
): readonly T[] {
  if (requested === undefined) return fallback;
  return requested.map((entry) => resolveKind(allowed, entry));
}
